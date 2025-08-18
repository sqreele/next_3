#!/usr/bin/env bash
set -euo pipefail

if [ "${1-}" = "-h" ] || [ "${1-}" = "--help" ] || [ $# -lt 1 ]; then
	echo "Usage: $(basename "$0") INPUT_PDF [OUTPUT_DIR]" >&2
	echo "Repairs a potentially corrupted PDF using multiple tools (qpdf, mutool, gs)." >&2
	exit 2
fi

input_pdf="$1"
if [ ! -f "$input_pdf" ]; then
	echo "Input file not found: $input_pdf" >&2
	exit 1
fi

output_dir="${2:-$(dirname "$input_pdf")}"
mkdir -p "$output_dir"

base_name="$(basename "$input_pdf")"
name_wo_ext="${base_name%.*}"

work_dir="$output_dir/${name_wo_ext}.repaired_work"
mkdir -p "$work_dir"

log() {
	echo "[$(date +"%Y-%m-%d %H:%M:%S")] $*" >&2
}

test_pdf_ok() {
	local f="$1"
	if command -v qpdf >/dev/null 2>&1; then
		if qpdf --check "$f" >/dev/null 2>&1; then
			return 0
		fi
	fi
	if command -v pdfinfo >/dev/null 2>&1; then
		if pdfinfo "$f" >/dev/null 2>&1; then
			return 0
		fi
	fi
	return 1
}

get_pdf_pages() {
	local f="$1"
	if command -v pdfinfo >/dev/null 2>&1; then
		pdfinfo "$f" 2>/dev/null | awk -F': *' '/^Pages:/ {print $2; exit}'
	else
		echo 0
	fi
}

declare -a candidates=()

log "Input: $input_pdf"
if command -v file >/dev/null 2>&1; then
	log "File type: $(file -b "$input_pdf" || true)"
fi

# Attempt 1: qpdf
if command -v qpdf >/dev/null 2>&1; then
	log "Trying qpdf repair..."
	qpdf --object-streams=disable --force-version=1.7 --linearize \
		"$input_pdf" "$work_dir/${name_wo_ext}.qpdf.pdf" \
		2>"$work_dir/qpdf.log" || true
	if [ -s "$work_dir/${name_wo_ext}.qpdf.pdf" ] && test_pdf_ok "$work_dir/${name_wo_ext}.qpdf.pdf"; then
		candidates+=("$work_dir/${name_wo_ext}.qpdf.pdf")
		log "qpdf produced a valid candidate."
	else
		log "qpdf failed or produced invalid output. See $work_dir/qpdf.log"
	fi
else
	log "qpdf not available; skipping."
fi

# Attempt 2: mutool clean
if command -v mutool >/dev/null 2>&1; then
	log "Trying mutool clean..."
	mutool clean -d -a "$input_pdf" "$work_dir/${name_wo_ext}.mutool.pdf" \
		>/dev/null 2>"$work_dir/mutool.log" || true
	if [ -s "$work_dir/${name_wo_ext}.mutool.pdf" ] && test_pdf_ok "$work_dir/${name_wo_ext}.mutool.pdf"; then
		candidates+=("$work_dir/${name_wo_ext}.mutool.pdf")
		log "mutool produced a valid candidate."
	else
		log "mutool failed or produced invalid output. See $work_dir/mutool.log"
	fi
else
	log "mutool not available; skipping."
fi

# Attempt 3: Ghostscript re-distill
if command -v gs >/dev/null 2>&1; then
	log "Trying Ghostscript re-distill..."
	gs -o "$work_dir/${name_wo_ext}.gs.pdf" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress \
		-dSAFER -dCompatibilityLevel=1.7 -dNOPAUSE -dBATCH "$input_pdf" \
		>/dev/null 2>"$work_dir/gs.log" || true
	if [ -s "$work_dir/${name_wo_ext}.gs.pdf" ] && test_pdf_ok "$work_dir/${name_wo_ext}.gs.pdf"; then
		candidates+=("$work_dir/${name_wo_ext}.gs.pdf")
		log "Ghostscript produced a valid candidate."
	else
		log "Ghostscript failed or produced invalid output. See $work_dir/gs.log"
	fi
else
	log "Ghostscript not available; skipping."
fi

if [ "${#candidates[@]}" -eq 0 ]; then
	log "No successful repair candidates produced."
	log "Inspect logs in $work_dir"
	exit 3
fi

# Select best candidate by highest page count
best_candidate=""
best_pages=-1
for c in "${candidates[@]}"; do
	pages="$(get_pdf_pages "$c")"
	pages="${pages:-0}"
	if [ "${pages}" -gt "${best_pages}" ]; then
		best_candidate="$c"
		best_pages="$pages"
	fi
done

final_out="$output_dir/${name_wo_ext}.repaired.pdf"
cp -f "$best_candidate" "$final_out"
log "Best candidate pages: $best_pages"
log "Output: $final_out"
echo "$final_out"

