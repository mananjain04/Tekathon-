import sys
from pathlib import Path

# Ensure the backend directory is in the python search path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.llm_service import get_llm_service, reset_llm_service
from app.services.prompt_builder import build_prompt

def main():
    print("==================================================")
    print("      KAVACH Offline RAG - Ollama LLM Test        ")
    print("==================================================")

    # 1. Initialize local LLM provider
    reset_llm_service()
    llm = get_llm_service()
    print(f"[1/3] Loaded Provider : {type(llm).__name__}")

    # 2. Simulate retrieved context from pgvector + reranker
    sample_context = """[Source 1] (Document: Turbine_Manual.pdf, Page: 14)
Tag: Turbine-T101
Max Safe Vibration: 4.5 mm/s
Trip Point: 7.2 mm/s
Current Status: Operational"""

    user_query = "What is the trip point for Turbine-T101?"

    # 3. Build grounded prompt
    prompt = build_prompt(query=user_query, context=sample_context)

    print(f"[2/3] User Question   : {user_query}")
    print(f"\n[3/3] Querying local Ollama server...")
    print("--------------------------------------------------")

    # 4. Generate answer locally
    answer = llm.generate(prompt)

    print("--- ANSWER FROM LOCAL MODEL ---")
    print(answer)
    print("--------------------------------------------------")
    print("[SUCCESS] Ollama local generation verified!\n")

if __name__ == "__main__":
    main()
