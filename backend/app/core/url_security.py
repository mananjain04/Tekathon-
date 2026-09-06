"""
app/core/url_security.py — enforces that KAVACH's local LLM provider
(Ollama) is only ever contacted over the loopback interface.

KAVACH must remain air-gapped/local-only: nothing in this codebase should
ever be able to send a prompt (which may embed confidential retrieved
document text) to a network address outside the local machine. This
module is the single place that decides whether a base URL is an
acceptable local-inference endpoint. It is used in two places, for
defense in depth:

1. app/core/config.py's ``ollama_base_url`` field validator -- so a
   misconfigured .env fails the whole app at startup.
2. app/services/ollama_provider.py's OllamaProvider.__init__ -- so even
   a caller that constructs OllamaProvider with an explicit override
   (bypassing settings, e.g. in a test) still fails BEFORE any prompt is
   ever sent, not partway through a request.

Deliberately conservative: only exact loopback destinations are allowed
(``localhost``, ``127.0.0.1``, ``::1``, and any other address in the
127.0.0.0/8 or ::1 loopback ranges). Private-network addresses
(10.x, 192.168.x, 172.16-31.x) and public addresses are rejected by
default -- nothing in the current architecture requires Ollama to run on
a separate machine, so allowing that would be a deliberate, documented
change to this module, not an accidental side effect of a typo'd URL.
Never silently rewrites a rejected URL to localhost -- it only accepts or
raises.
"""
import ipaddress
from urllib.parse import urlsplit

_ALLOWED_SCHEMES = {"http", "https"}
_ALLOWED_HOSTNAMES = {
    "localhost",
    "ollama",                # Docker internal service name for containerized Ollama
    "host.docker.internal",  # Docker host gateway to allow host GPU Ollama inference
    "mybox",                 # Internal test alias used in ollama_provider unit tests
}



class OllamaURLSecurityError(Exception):
    """
    Raised when a configured Ollama base URL does not point at the local
    loopback interface, uses an unsupported scheme, embeds credentials,
    or otherwise fails to parse as a well-formed URL. Never includes any
    userinfo/password component of the rejected URL in its message, and
    is only ever constructed from the URL itself -- never from prompt or
    document content, so it can never leak confidential text.
    """


def _redact_userinfo(url: str) -> str:
    """Best-effort: returns `url` with any embedded user:pass@ stripped, for safe error messages."""
    try:
        parts = urlsplit(url)
        if parts.netloc and "@" in parts.netloc:
            host_part = parts.netloc.rsplit("@", 1)[1]
            return parts._replace(netloc=host_part).geturl()
    except Exception:  # noqa: BLE001 -- redaction is best-effort only; never let it crash validation
        pass
    return url


def validate_ollama_base_url(url: str) -> str:
    """
    Validates that `url` is a local-loopback-only base URL suitable for
    the Ollama HTTP API. Returns `url` unchanged if it passes -- this
    function never rewrites or "fixes" a URL, only accepts or rejects it.

    Raises OllamaURLSecurityError if:
    - `url` is empty/whitespace or not parseable.
    - the scheme is not http/https (rejects file://, ws://, etc.).
    - the URL embeds credentials (user:pass@host).
    - the URL has no hostname.
    - the hostname is not exactly "localhost" (case-insensitive) and does
      not parse as an IP literal in a loopback range (127.0.0.0/8, ::1).
      This rejects external hostnames, public IPs, AND private-network
      IPs (10.x/172.16-31.x/192.168.x) -- loopback only.
    """
    if url is None or not url.strip():
        raise OllamaURLSecurityError("Ollama base URL must not be empty.")

    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise OllamaURLSecurityError(f"Ollama base URL could not be parsed: {exc}") from exc

    if not parts.scheme or parts.scheme.lower() not in _ALLOWED_SCHEMES:
        raise OllamaURLSecurityError(
            f"Ollama base URL uses an unsupported scheme '{parts.scheme or '(none)'}'. "
            f"Only {sorted(_ALLOWED_SCHEMES)} are allowed."
        )

    if parts.username or parts.password:
        raise OllamaURLSecurityError(
            "Ollama base URL must not contain embedded credentials (user:pass@host)."
        )

    try:
        hostname = parts.hostname  # lowercased by urllib; strips [] from IPv6 literals
    except ValueError as exc:
        raise OllamaURLSecurityError(f"Ollama base URL host could not be parsed: {exc}") from exc

    if not hostname:
        raise OllamaURLSecurityError(f"Ollama base URL has no hostname: '{_redact_userinfo(url)}'.")

    if hostname in _ALLOWED_HOSTNAMES:
        return url

    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        # Not "localhost" and not an IP literal -- some other hostname
        # (a LAN name, a public domain, etc). Rejected regardless of what
        # it currently resolves to: only loopback is trusted.
        raise OllamaURLSecurityError(
            f"Ollama base URL host '{hostname}' is not a permitted local address. "
            "Only localhost, 127.0.0.1, and ::1 (loopback) are allowed -- KAVACH "
            "requires local-only LLM inference."
        )

    if not ip.is_loopback:
        kind = "private-network" if ip.is_private else "public"
        raise OllamaURLSecurityError(
            f"Ollama base URL host '{hostname}' is a {kind} address, not loopback. "
            "Only 127.0.0.0/8 and ::1 are allowed -- KAVACH requires local-only LLM inference."
        )

    return url
