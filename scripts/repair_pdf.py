#!/usr/bin/env python3
import argparse
import os
import sys
from typing import Optional


def log(message: str) -> None:
    print(message, flush=True)


def attempt_repair_with_pikepdf(input_path: str, output_path: str, password: Optional[str]) -> bool:
    try:
        import pikepdf

        open_kwargs = {}
        if password:
            open_kwargs["password"] = password

        with pikepdf.open(input_path, **open_kwargs) as pdf:
            pdf.save(
                output_path,
                linearize=True,
                fix_metadata=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                min_pdf_version="1.4",
                optimize_version=True,
            )

        # Validate the output can be opened
        with pikepdf.open(output_path):
            pass

        return True
    except Exception as exc:  # noqa: BLE001
        log(f"[pikepdf] Repair attempt failed: {exc}")
        return False


def attempt_repair_with_pypdf(input_path: str, output_path: str, password: Optional[str]) -> bool:
    try:
        # pypdf >= 3.x
        from pypdf import PdfReader, PdfWriter

        reader = PdfReader(input_path)
        if reader.is_encrypted and password:
            try:
                reader.decrypt(password)
            except Exception as exc:  # noqa: BLE001
                log(f"[pypdf] Decrypt failed: {exc}")

        writer = PdfWriter()

        try:
            metadata = reader.metadata or {}
        except Exception:  # noqa: BLE001
            metadata = {}

        # Copy pages; this can often rebuild cross-references
        for index, page in enumerate(reader.pages):
            try:
                writer.add_page(page)
            except Exception as exc:  # noqa: BLE001
                log(f"[pypdf] Skipping page {index + 1}: {exc}")

        if metadata:
            try:
                writer.add_metadata(metadata)
            except Exception:  # noqa: BLE001
                pass

        with open(output_path, "wb") as file_obj:
            writer.write(file_obj)

        # Validate by reopening
        _ = PdfReader(output_path)
        return True
    except Exception as exc:  # noqa: BLE001
        log(f"[pypdf] Repair attempt failed: {exc}")
        return False


def salvage_text_to_txt(input_path: str, txt_output_path: str) -> bool:
    try:
        from pdfminer.high_level import extract_text

        text = extract_text(input_path) or ""
        with open(txt_output_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        return True
    except Exception as exc:  # noqa: BLE001
        log(f"[pdfminer] Text salvage failed: {exc}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Attempt to repair a possibly corrupted PDF.")
    parser.add_argument("input", help="Path to the input PDF file")
    parser.add_argument(
        "-o",
        "--output",
        help="Path to write the repaired PDF (default: <input>.repaired.pdf)",
        default=None,
    )
    parser.add_argument(
        "--password",
        help="Password for encrypted PDFs (if applicable)",
        default=None,
    )
    parser.add_argument(
        "--salvage-text",
        help="Also write a TXT with salvaged text next to the output PDF",
        action="store_true",
    )
    parser.add_argument(
        "-f",
        "--force",
        help="Overwrite the output file if it already exists",
        action="store_true",
    )

    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    if not os.path.isfile(input_path):
        log(f"Input not found: {input_path}")
        return 2

    output_path = (
        os.path.abspath(args.output)
        if args.output
        else os.path.splitext(input_path)[0] + ".repaired.pdf"
    )

    if os.path.exists(output_path) and not args.force:
        log(f"Output already exists: {output_path}. Use --force to overwrite.")
        return 3

    # Try pikepdf first, then pypdf fallback
    log("Attempting repair with pikepdf…")
    ok = attempt_repair_with_pikepdf(input_path, output_path, args.password)
    if not ok:
        log("Attempting repair with pypdf…")
        ok = attempt_repair_with_pypdf(input_path, output_path, args.password)

    if ok:
        log(f"Repaired PDF written to: {output_path}")
        if args.salvage_text:
            txt_output = os.path.splitext(output_path)[0] + ".txt"
            if salvage_text_to_txt(input_path, txt_output):
                log(f"Salvaged text written to: {txt_output}")
        return 0

    log("Unable to repair the PDF. You can try --salvage-text to extract readable text.")
    if args.salvage_text:
        txt_output = os.path.splitext(output_path)[0] + ".txt"
        if salvage_text_to_txt(input_path, txt_output):
            log(f"Salvaged text written to: {txt_output}")
            return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

