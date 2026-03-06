from pathlib import Path
import re
import string

# Mantém "_" como underscore.
# O "." PODE ser substituído no nome, porque a extensão já vem separada em path.suffix
PUNCTUATION = string.punctuation.replace("_", "")

def sanitize_filename(path: Path) -> str:
    stem = path.stem
    suffix = path.suffix  # ex.: ".jpg"

    # espaços viram "_"
    stem = re.sub(r"\s+", "_", stem)

    # qualquer pontuação no nome vira "-"
    stem = re.sub(f"[{re.escape(PUNCTUATION)}]+", "-", stem)

    # limpa repetições
    stem = re.sub(r"_+", "_", stem)
    stem = re.sub(r"-+", "-", stem)
    stem = stem.strip("_-")

    return f"{stem}{suffix}"

def get_unique_path(target: Path) -> Path:
    if not target.exists():
        return target

    counter = 1
    while True:
        candidate = target.with_name(f"{target.stem}_{counter}{target.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1

def main():
    base = Path.cwd()

    for item in base.iterdir():
        if not item.is_file():
            continue

        new_name = sanitize_filename(item)
        if new_name == item.name:
            continue

        target = get_unique_path(item.with_name(new_name))
        print(f'"{item.name}" -> "{target.name}"')
        item.rename(target)

if __name__ == "__main__":
    main()