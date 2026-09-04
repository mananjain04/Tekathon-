import pytest

from app.services.chunker import approx_token_count, chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("", chunk_size=100, chunk_overlap=10) == []
    assert chunk_text("   \n  ", chunk_size=100, chunk_overlap=10) == []


def test_short_text_returns_single_chunk():
    spans = chunk_text("hello world", chunk_size=100, chunk_overlap=10)
    assert len(spans) == 1
    assert spans[0].text == "hello world"
    assert spans[0].start_char == 0
    assert spans[0].end_char == 11


def test_long_text_is_split_with_overlap():
    text = "a" * 250
    spans = chunk_text(text, chunk_size=100, chunk_overlap=20)
    # 250 chars, 100-char windows advancing by 80 -> starts at 0, 80, 160.
    # The window starting at 160 would naively advance to 240, but since
    # start(160) + chunk_size(100) = 260 already reaches/exceeds n(250),
    # that window is capped to [160, 250) and the loop stops there instead
    # of emitting a small trailing 240-260 chunk.
    assert [s.start_char for s in spans] == [0, 80, 160]
    assert spans[-1].end_char == 250
    # every chunk (except the last) is exactly chunk_size long
    for s in spans[:-1]:
        assert len(s.text) == 100
    # consecutive chunks overlap by exactly chunk_overlap characters
    for prev, nxt in zip(spans, spans[1:]):
        assert prev.end_char - nxt.start_char == 20


def test_overlap_never_causes_infinite_loop_when_misconfigured():
    # overlap >= chunk_size would infinite-loop without the clamp in chunk_text
    text = "b" * 500
    spans = chunk_text(text, chunk_size=50, chunk_overlap=999)
    assert len(spans) > 0
    assert spans[-1].end_char == 500


def test_negative_overlap_falls_back_to_default():
    # A negative overlap is also "invalid" and clamped, same as overlap >= chunk_size.
    text = "c" * 300
    spans = chunk_text(text, chunk_size=100, chunk_overlap=-5)
    assert len(spans) > 0
    assert spans[-1].end_char == 300
    # fallback overlap is chunk_size // 4 == 25, so step is 75
    assert [s.start_char for s in spans[:2]] == [0, 75]


def test_zero_or_negative_chunk_size_raises_value_error():
    with pytest.raises(ValueError):
        chunk_text("some text", chunk_size=0, chunk_overlap=0)
    with pytest.raises(ValueError):
        chunk_text("some text", chunk_size=-10, chunk_overlap=0)


def test_all_chunks_reconstruct_within_bounds():
    text = "The quick brown fox jumps over the lazy dog. " * 5
    spans = chunk_text(text, chunk_size=40, chunk_overlap=10)
    for s in spans:
        assert text.strip()[s.start_char:s.end_char] == s.text


def test_character_offsets_are_contiguous_or_overlapping():
    # Offsets should never skip characters (a gap would silently drop text).
    text = "x" * 340
    spans = chunk_text(text, chunk_size=90, chunk_overlap=15)
    for prev, nxt in zip(spans, spans[1:]):
        assert nxt.start_char <= prev.end_char


def test_approx_token_count_is_word_count():
    assert approx_token_count("one two three") == 3
    assert approx_token_count("") == 0
