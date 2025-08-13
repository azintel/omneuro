import os
from datetime import datetime
from pathlib import Path

def _ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def save_as_txt(prompt: str, content: str, subdir: str = "") -> str:
    base = Path("drafts")
    if subdir:
        base = base / subdir
    _ensure_dir(base)

    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    fname = f"draft_{ts}.txt"
    out_path = base / fname

    with out_path.open("w", encoding="utf-8") as f:
        f.write("Prompt:\n")
        f.write(prompt.strip() + "\n\n")
        f.write("Response:\n")
        f.write(content)

    return str(out_path)