from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


IMAGES_DIR = Path(__file__).resolve().parents[1] / "public" / "images"
MAX_SIZE = (1200, 800)
QUALITY = 84


def normalize(path: Path) -> bool:
    with Image.open(path) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        before = path.stat().st_size
        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        image.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        return path.stat().st_size != before


def main() -> None:
    changed = 0
    for path in sorted(IMAGES_DIR.glob("*.jpg")):
        if normalize(path):
            changed += 1
    print(f"Normalized {changed} article images")


if __name__ == "__main__":
    main()
