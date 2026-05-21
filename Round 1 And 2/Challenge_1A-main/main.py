import os
import sys
import json
import fitz        # PyMuPDF
from tqdm import tqdm
import re
import shutil
from operator import itemgetter

script_dir = os.path.dirname(os.path.abspath(__file__))

if script_dir not in sys.path:
    sys.path.append(script_dir)

pdf_utils_dir = os.path.join(script_dir, "pdf_utils")
if pdf_utils_dir not in sys.path:
    sys.path.append(pdf_utils_dir)

from pdf_utils import (
    extract_blocks,
    classify_headings,
    structure_outline,
    language,
)

INPUT_DIR = os.path.join(script_dir, "input")
OUTPUT_DIR = os.path.join(script_dir, "output")
INTERMEDIATES_SUBDIR = "intermediates" 

def _process_and_truncate_title(raw_title: str, processed_blocks: list, filename_base: str, detected_lang: str) -> str:
    """
    Enhanced title processing that extracts meaningful titles from document content
    and truncates appropriately based on language.
    """
    is_cjk = detected_lang in ["zh", "ja", "ko"]
    
    if raw_title == filename_base or len(raw_title) < 5:
        print(f"    Raw title '{raw_title}' seems to be filename/insufficient. Extracting from content...")
        
        early_headings = [b for b in processed_blocks 
                         if b.get("level") and b.get("page", 0) <= 2 and b.get("text", "").strip()]
        
        if early_headings:
            early_headings.sort(key=lambda x: (x.get("page", 0), int(x.get("level", "H4")[1:])))
            
            best_candidate = None
            for heading in early_headings:
                text = heading.get("text", "").strip()
                text = re.sub(r'\.{3,}$', '', text)
                
                if len(text) > 8:
                    best_candidate = text
                    break
            
            if best_candidate:
                raw_title = best_candidate
                print(f"    Extracted title from content: '{raw_title}'")
    
    title = re.sub(r'[\u201c\u201d"\'`""'']+', '', raw_title).strip()
    title = re.sub(r'\s+', ' ', title).strip()
    
    if is_cjk:
        max_chars = 20
        if len(title) > max_chars:
            title = title[:max_chars].rstrip()
            print(f"    Truncated CJK title to {max_chars} characters")
    else:
        words = title.split()
        max_words = 7
        if len(words) > max_words:
            title = ' '.join(words[:max_words])
            print(f"    Truncated title to {max_words} words")
    
    if not title or len(title) < 3 or re.fullmatch(r'[\s\d\W_]+', title):
        print(f"    Title validation failed. Using processed filename.")
        fallback = re.sub(r'[_-]+', ' ', filename_base).strip()
        fallback = ' '.join(word.capitalize() for word in fallback.split())
        title = fallback
    
    return title

def process_pdf_hybrid(pdf_path: str, output_dir: str):
    """
    Processes a single PDF file using a hybrid approach, combining text
    extraction, line-by-line analysis, specific pruning, and outline structuring.
    """
    base_filename = os.path.basename(pdf_path)
    name_without_ext = os.path.splitext(base_filename)[0]
    
    final_output_path = os.path.join(output_dir, f"{name_without_ext}.json")
    intermediate_output_dir = os.path.join(output_dir, INTERMEDIATES_SUBDIR)
    
    intermediate_raw_blocks_path = os.path.join(intermediate_output_dir, f"{name_without_ext}_intermediate_raw_blocks.json")
    intermediate_processed_blocks_path = os.path.join(intermediate_output_dir, f"{name_without_ext}_intermediate_processed_blocks.json")

    print(f"\nStarting hybrid processing for: {base_filename}")
    
    doc = None 
    try:
        doc = fitz.open(pdf_path)
        num_pages_total = doc.page_count

        pages_to_sample_for_meta = min(num_pages_total, 5) 
        max_chars_for_sample = min(int(num_pages_total * 0.15 * 1000), 5000) 
        
        sampled_text_for_title_and_lang = ""
        sampled_raw_blocks_for_title = []

        print("  Stage 1: Sampling initial pages for language and title candidates...")
        for page_num in range(pages_to_sample_for_meta):
            page = doc[page_num]
            
            current_page_text = page.get_text("text")
            if len(sampled_text_for_title_and_lang) < max_chars_for_sample:
                sampled_text_for_title_and_lang += current_page_text + "\n"
            
            page_content = page.get_text("dict")
            for b_dict in page_content['blocks']:
                if b_dict['type'] == 0: # text block
                    for l_dict in b_dict['lines']:
                        for s_dict in l_dict['spans']:
                            x0, y0, x1, y1 = s_dict['bbox']
                            if s_dict['text'].strip() and all(isinstance(val, (int, float)) for val in [x0, y0, x1, y1]):
                                sampled_raw_blocks_for_title.append({
                                    "text": s_dict['text'],
                                    "font_size": s_dict['size'],
                                    "font_name": s_dict['font'],
                                    "x0": x0,
                                    "x1": x1,
                                    "top": y0,
                                    "bottom": y1,
                                    "width": x1 - x0,
                                    "height": y1 - y0,
                                    "line_height": y1 - y0,
                                    "page": page_num
                                })
            
            if len(sampled_text_for_title_and_lang) >= max_chars_for_sample and len(sampled_raw_blocks_for_title) > 50: 
                break 
        
        sampled_raw_blocks_for_title.sort(key=itemgetter("page", "top", "x0"))

        print("  Stage 2: Detecting document language...")
        lang = language.detect_language(sampled_text_for_title_and_lang) 
        nlp_model = language.get_multilingual_nlp(lang)

        print("  Stage 3: Extracting detailed blocks from full document with PyMuPDF (language-aware)...")
        all_raw_spans, page_dimensions = extract_blocks.run(pdf_path, intermediate_raw_blocks_path, detected_lang=lang)
        
        print("  Stage 4: Classifying headings with heuristics and strict pruning (language-aware)...")
        processed_blocks_for_outline = classify_headings.run(
            all_raw_spans, 
            page_dimensions, 
            detected_lang=lang, 
            nlp_model_for_all_nlp_tasks=nlp_model 
        )

        print(f"  Saving intermediate processed blocks to {intermediate_processed_blocks_path}")
        os.makedirs(os.path.dirname(intermediate_processed_blocks_path), exist_ok=True)
        with open(intermediate_processed_blocks_path, 'w', encoding='utf-8') as f:
            json.dump(processed_blocks_for_outline, f, indent=2, ensure_ascii=False)

        print("  Stage 5: Determining document title (language-aware)...")
        raw_title = structure_outline.derive_title_from_sampled_text_and_filename(
            sampled_raw_blocks_for_title, 
            name_without_ext, 
            nlp_model, 
            detected_lang=lang
        )
        
        final_title = _process_and_truncate_title(raw_title, processed_blocks_for_outline, name_without_ext, lang)
        print(f"  Final title: \"{final_title}\"")

        print("  Stage 6: Structuring and pruning the outline (language-aware)...")
        structured_outline_result = structure_outline.run(
            processed_blocks_for_outline, 
            num_pages_total, 
            name_without_ext,
            detected_lang=lang
        )
        
        print("  Stage 7: Combining results and saving to final JSON output.")
        final_output = {
            "title": final_title,
            "outline": structured_outline_result.get("outline", []) 
        }

        with open(final_output_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)

        print(f"Successfully processed {base_filename} to {final_output_path}")
        
        print("  Stage 8: Cleaning up intermediate files...")
        try:
            if os.path.exists(intermediate_raw_blocks_path):
                os.remove(intermediate_raw_blocks_path)
                print(f"    Removed: {intermediate_raw_blocks_path}")
            
            if os.path.exists(intermediate_processed_blocks_path):
                os.remove(intermediate_processed_blocks_path)
                print(f"    Removed: {intermediate_processed_blocks_path}")
            
            if os.path.exists(intermediate_output_dir) and not os.listdir(intermediate_output_dir):
                os.rmdir(intermediate_output_dir)
                print(f"    Removed empty intermediates directory: {intermediate_output_dir}")
                
        except Exception as cleanup_error:
            print(f"    Warning: Failed to cleanup some intermediate files: {cleanup_error}")

    except Exception as e:
        print(f"ERROR: Failed to process {base_filename}. Reason: {e}")
    finally:
        if doc:
            doc.close()

if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    intermediates_full_path = os.path.join(OUTPUT_DIR, INTERMEDIATES_SUBDIR)
    os.makedirs(intermediates_full_path, exist_ok=True)

    if not os.path.exists(INPUT_DIR):
        print(f"Input directory '{INPUT_DIR}' not found. Please create it and place your PDF files inside.")
    else:
        pdf_files = [f for f in os.listdir(INPUT_DIR) if f.lower().endswith(".pdf")]
        if not pdf_files:
            print(f"No PDF files found in '{INPUT_DIR}'.")
        else:
            for filename in tqdm(pdf_files, desc="Processing PDFs"):
                pdf_path = os.path.join(INPUT_DIR, filename)
                process_pdf_hybrid(pdf_path, OUTPUT_DIR)
            
            intermediates_full_path = os.path.join(OUTPUT_DIR, INTERMEDIATES_SUBDIR)
            try:
                if os.path.exists(intermediates_full_path):
                    if not os.listdir(intermediates_full_path):
                        os.rmdir(intermediates_full_path)
                        print(f"\nFinal cleanup: Removed empty intermediates directory: {intermediates_full_path}")
                    else:
                        print(f"\nNote: Intermediates directory still contains files: {intermediates_full_path}")
            except Exception as final_cleanup_error:
                print(f"\nWarning: Final cleanup failed: {final_cleanup_error}")
            
            print(f"\nCompleted processing {len(pdf_files)} PDF files.")
