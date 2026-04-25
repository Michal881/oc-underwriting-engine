from pathlib import Path
from pypdf import PdfReader

SOURCE_DIR = Path("data/source_pdfs")
OUTPUT_DIR = Path("data/extracted")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

for pdf_path in sorted(SOURCE_DIR.glob("*.pdf")):
    print(f"Reading: {pdf_path.name}")

    reader = PdfReader(str(pdf_path))
    pages_text = []

    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages_text.append(f"\n\n--- PAGE {i} ---\n\n{text}")

    output_path = OUTPUT_DIR / f"{pdf_path.stem}.txt"
    output_path.write_text("\n".join(pages_text), encoding="utf-8")

    print(f"Saved: {output_path}")

print("Done.")