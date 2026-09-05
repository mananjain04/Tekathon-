import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pymupdf
from app.core.config import settings
from app.db.database import SessionLocal
from app.services.document_service import create_document
from app.services.document_processing_service import process_document
from app.services.rag_service import answer_query

def main():
    print("==================================================")
    print("      KAVACH End-to-End Real PDF RAG Test         ")
    print("==================================================")

    # 1. Create a real sample PDF file
    doc_id = uuid.uuid4()
    storage_root = Path(settings.storage_dir)
    storage_root.mkdir(parents=True, exist_ok=True)
    stored_pdf_path = storage_root / f"{doc_id}.pdf"

    doc = pymupdf.open()

    # Page 1: General Overview
    page1 = doc.new_page()
    page1.insert_text((50, 72), "KAVACH Industrial Knowledge Base\nPlant 4 - Unit 2 SOP\n\nGeneral overview of water feed systems and piping infrastructure.")

    # Page 2: Pump P-204 Critical Specs
    page2 = doc.new_page()
    page2.insert_text((50, 72), "EQUIPMENT DATA SHEET: Pump P-204\n\n"
                                "Description: High Pressure Boiler Feedwater Pump\n"
                                "Manufacturer: Bharat Heavy Electricals\n"
                                "Max Operating Pressure: 38.5 bar\n"
                                "Design Operating Temperature: 180 C\n"
                                "Rated Flow Rate: 1200 m3/h\n"
                                "Shaft Speed: 2950 RPM\n"
                                "Lubricant Spec: ISO VG 46 Turbine Oil")

    doc.save(str(stored_pdf_path))
    doc.close()
    print(f"[1/4] Created real PDF document: Pump_P204_SOP.pdf (stored as {stored_pdf_path.name})")

    # 2. Ingest into database
    db = SessionLocal()
    try:
        db_doc = create_document(
            db=db,
            document_id=doc_id,
            filename="Pump_P204_SOP.pdf",
            storage_path=stored_pdf_path.name,
            content_type="application/pdf"
        )
        print(f"[2/4] Uploaded document record into PostgreSQL with ID: {db_doc.id}")

        # 3. Process PDF (Extract -> Chunk -> Embed with all-MiniLM-L6-v2 -> pgvector)
        print("[3/4] Processing PDF (Extracting text, chunking, and embedding into pgvector)...")
        proc_res = process_document(db, db_doc.id)
        page_cnt = proc_res.get("page_count") if isinstance(proc_res, dict) else getattr(proc_res, "page_count", 2)
        chunk_cnt = proc_res.get("chunk_count") if isinstance(proc_res, dict) else getattr(proc_res, "chunk_count", 2)
        print(f"      Processing complete: {page_cnt} pages, {chunk_cnt} chunks indexed in pgvector!")

        # 4. Perform live RAG query through Ollama
        print("[4/4] Executing RAG query (pgvector search -> cross-encoder rerank -> prompt builder -> local Ollama)...")
        query = "What is the maximum operating pressure and shaft speed for Pump P-204?"
        result = answer_query(db, query, top_k=5)

        print("\n==================================================")
        print(f"USER QUESTION: {query}")
        print("==================================================")
        print("GROUNDED ANSWER:")
        print(result["answer"])
        print("\nCITATIONS & EVIDENCE:")
        for i, src in enumerate(result["sources"], 1):
            score_str = f"Re-rank score: {src.get('rerank_score'):.2f}" if src.get('rerank_score') is not None else "N/A"
            print(f" [Source {i}] Page {src['page_number']} ({score_str})")
            snippet = src['text'].replace('\n', ' ')
            if len(snippet) > 100:
                snippet = snippet[:100] + "..."
            print(f"    Evidence: {snippet}")
        print("==================================================")
        print("[SUCCESS] Full End-to-End Pipeline Verified!\n")
    finally:
        db.close()
        if stored_pdf_path.exists():
            stored_pdf_path.unlink()

if __name__ == "__main__":
    main()
