import os
import json
import pathlib
import sys
from typing import Callable
import re

BASE_DIR = "data/Harry AI"
TARGET_SENDER = "Luke Davis"
# Raw extraction output (deduplicated + encoding-fixed)
OUTPUT_FILE = "luke_davis_messages_clean.txt"

# Try to import ftfy for robust text fixing; if unavailable, fall back
try:
    from ftfy import fix_text as ftfy_fix
except ImportError:  # pragma: no cover
    def ftfy_fix(text: str) -> str:  # type: ignore
        return text

# Unicode replacement char
REPLACEMENT_CHAR = "\uFFFD"
BAD_PATTERNS = ("ðŸ", "Ã", "Â", REPLACEMENT_CHAR)

def main() -> None:
    """Walk through BASE_DIR and extract messages authored by TARGET_SENDER."""
    def fix_encoding(text: str) -> str:
        """Attempt to repair common mojibake issues from double-encoded UTF-8 strings.

        Repeatedly encodes the string as latin-1 then decodes as UTF-8 until no
        tell-tale artifacts (â, Ã, ð) remain or the transformation no longer
        changes the string.
        """
        prev = text
        for _ in range(3):  # Up to 3 passes is usually enough
            if any(ch in prev for ch in ("â", "Ã", "ð")):
                try:
                    candidate = prev.encode("latin1").decode("utf-8")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    break
                if candidate == prev:
                    break
                prev = candidate
            else:
                break
        # Final pass through ftfy for any remaining issues (will repair garbled emoji)
        return ftfy_fix(prev)

    seen: set[str] = set()
    count = 0
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out_f:
        for root, _, files in os.walk(BASE_DIR):
            for fname in files:
                if not (fname.startswith("message_") and fname.endswith(".json")):
                    continue
                fpath = pathlib.Path(root) / fname
                try:
                    with open(fpath, "r", encoding="utf-8") as fp:
                        convo = json.load(fp)
                except Exception as e:
                    print(f"Skipped {fpath} due to error: {e}", file=sys.stderr)
                    continue

                for msg in convo.get("messages", []):
                    if msg.get("sender_name") == TARGET_SENDER and "content" in msg:
                        raw_content = msg["content"].replace("\n", " ").strip()
                        if not raw_content:
                            continue

                        content = fix_encoding(raw_content)

                        # Deduplicate while preserving original order (first occurrence kept)
                        if content not in seen:
                            # Skip if we detect residual mojibake (e.g., still contains 'ðŸ', 'Ã', replacement char )
                            if any(bad in content for bad in BAD_PATTERNS):
                                continue

                            seen.add(content)
                            out_f.write(content + "\n")
                            count += 1

    print(f"Wrote {count} unique messages to {OUTPUT_FILE}")


if __name__ == "__main__":
    main() 