from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "src" / "content" / "articles"
IMAGES_DIR = ROOT / "public" / "images"
PREVIEWS_DIR = IMAGES_DIR / "previews"
SOURCES_FILE = IMAGES_DIR / ".sources.json"

SIZE = 240
QUALITY = 72


def frontmatter(text: str) -> dict[str, object]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    raw = text[3:end]
    data: dict[str, object] = {}
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip("\"'")
    return data


def source_candidates(article: dict[str, object]) -> list[str]:
    slug = str(article["slug"])
    image = str(article.get("image") or "")
    if image.startswith("/images/") and not image.endswith("/placeholder.jpg"):
        return [image.rsplit("/", 1)[-1], f"{slug}.jpg"]
    return [f"{slug}.jpg"]


def load_articles() -> list[dict[str, object]]:
    articles = []
    for file in sorted(ARTICLES_DIR.glob("*.mdx")):
        data = frontmatter(file.read_text(encoding="utf-8"))
        articles.append(
            {
                "slug": str(data.get("slug") or file.stem),
                "image": str(data.get("image") or ""),
            }
        )
    return articles


def read_sources() -> dict[str, object]:
    if not SOURCES_FILE.exists():
        return {}
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def write_sources(sources: dict[str, object]) -> None:
    SOURCES_FILE.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def make_preview(source: Path, target: Path) -> bool:
    if not source.exists():
        return False

    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        image = ImageOps.fit(image, (SIZE, SIZE), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return True


def main() -> None:
    sources = read_sources()
    generated = 0
    missing = []

    for article in load_articles():
        slug = str(article["slug"])
        source = next((IMAGES_DIR / name for name in source_candidates(article) if (IMAGES_DIR / name).exists()), None)
        target = PREVIEWS_DIR / f"{slug}.jpg"
        if source and make_preview(source, target):
            sources[f"previews/{slug}"] = {
                "provider": "local-preview",
                "source": source.name,
                "width": SIZE,
                "height": SIZE,
                "quality": QUALITY,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
            generated += 1
        else:
            missing.append(slug)

    write_sources(sources)
    print(f"Generated {generated} preview images")
    if missing:
        print(f"Missing source images: {', '.join(missing)}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
