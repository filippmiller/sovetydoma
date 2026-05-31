from __future__ import annotations

import hashlib
import json
import math
import re
import textwrap
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "src" / "content" / "articles"
IMAGES_DIR = ROOT / "public" / "images"
SOURCES_FILE = IMAGES_DIR / ".sources.json"

WIDTH = 1200
HEIGHT = 800

CATEGORY = {
    "kulinaria": {
        "name": "Кулинария",
        "emoji": "🍲",
        "colors": ("#f08a24", "#ffcf70", "#8f3b00"),
    },
    "dom-i-uborka": {
        "name": "Дом и уборка",
        "emoji": "🧹",
        "colors": ("#28a86b", "#b9f0cf", "#0f5f3f"),
    },
    "dacha-i-ogorod": {
        "name": "Дача и огород",
        "emoji": "🌱",
        "colors": ("#14967d", "#bdebd7", "#075849"),
    },
    "layfkhaki": {
        "name": "Лайфхаки",
        "emoji": "💡",
        "colors": ("#8e44ad", "#e6c4f3", "#4b1765"),
    },
    "ekonomiya": {
        "name": "Экономия",
        "emoji": "💰",
        "colors": ("#2878b9", "#bcdaf5", "#123d69"),
    },
    "rybalka": {
        "name": "Рыбалка",
        "emoji": "🎣",
        "colors": ("#2e86ab", "#bde8f6", "#17475c"),
    },
}


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
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            data[key.strip()] = [
                item.strip().strip("\"'")
                for item in value.strip("[]").split(",")
                if item.strip()
            ]
        else:
            data[key.strip()] = value.strip("\"'")
    return data


def load_articles() -> list[dict[str, object]]:
    articles = []
    for file in sorted(ARTICLES_DIR.glob("*.mdx")):
        data = frontmatter(file.read_text(encoding="utf-8"))
        slug = str(data.get("slug") or file.stem)
        articles.append(
            {
                "slug": slug,
                "title": str(data.get("title") or slug.replace("-", " ")),
                "category": str(data.get("category") or ""),
                "tags": data.get("tags") if isinstance(data.get("tags"), list) else [],
            }
        )
    return articles


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def draw_gradient(draw: ImageDraw.ImageDraw, primary: str, secondary: str) -> None:
    a = hex_to_rgb(primary)
    b = hex_to_rgb(secondary)
    for y in range(HEIGHT):
        t = y / HEIGHT
        color = blend(a, b, t)
        draw.line([(0, y), (WIDTH, y)], fill=color)


def seeded(slug: str) -> int:
    return int(hashlib.sha256(slug.encode("utf-8")).hexdigest()[:12], 16)


def draw_pattern(draw: ImageDraw.ImageDraw, slug: str, ink: tuple[int, int, int]) -> None:
    seed = seeded(slug)
    step = 86 + seed % 34
    radius = 22 + seed % 28
    for y in range(-step, HEIGHT + step, step):
        for x in range(-step, WIDTH + step, step):
            wobble = ((x * 17 + y * 31 + seed) % 52) - 26
            bbox = [x + wobble, y - wobble, x + wobble + radius, y - wobble + radius]
            draw.ellipse(bbox, outline=(*ink, 42), width=3)

    for i in range(11):
        x = (seed * (i + 3) * 37) % WIDTH
        y = (seed * (i + 5) * 53) % HEIGHT
        length = 110 + ((seed >> i) % 130)
        angle = ((seed >> (i + 4)) % 628) / 100
        x2 = x + int(math.cos(angle) * length)
        y2 = y + int(math.sin(angle) * length)
        draw.line([(x, y), (x2, y2)], fill=(*ink, 34), width=5)


def draw_text_box(draw: ImageDraw.ImageDraw, article: dict[str, object], info: dict[str, object]) -> None:
    title = str(article["title"])
    tags = [str(tag) for tag in article.get("tags", [])][:3]
    dark = hex_to_rgb(str(info["colors"][2]))
    primary = hex_to_rgb(str(info["colors"][0]))

    box = [86, 116, WIDTH - 86, HEIGHT - 96]
    draw.rounded_rectangle(box, radius=32, fill=(255, 255, 255, 236), outline=(*dark, 55), width=2)

    draw.rounded_rectangle([122, 154, 422, 206], radius=18, fill=(*primary, 235))
    draw.text((146, 163), str(info["name"]).upper(), fill=(255, 255, 255), font=font(24, True))

    draw.rounded_rectangle([WIDTH - 310, 146, WIDTH - 126, 206], radius=18, outline=(*dark, 95), width=3)
    draw.text((WIDTH - 282, 160), "СОВЕТ", fill=dark, font=font(26, True))

    title_font = font(58, True)
    lines = textwrap.wrap(title, width=28)
    if len(lines) > 4:
        title_font = font(50, True)
        lines = textwrap.wrap(title, width=32)[:4]

    y = 254
    for line in lines:
        draw.text((126, y), line, fill=dark, font=title_font)
        y += title_font.size + 11

    draw.line([(126, HEIGHT - 188), (WIDTH - 126, HEIGHT - 188)], fill=(*primary, 115), width=4)
    if tags:
        tag_text = "  ".join(f"#{tag}" for tag in tags)
        draw.text((126, HEIGHT - 154), tag_text, fill=(*dark, 210), font=font(28, False))
    draw.text((126, HEIGHT - 124), "СоветыДома", fill=(*dark, 165), font=font(24, True))


def save_cover(article: dict[str, object]) -> None:
    info = CATEGORY.get(str(article["category"]), CATEGORY["layfkhaki"])
    primary, secondary, dark = info["colors"]

    image = Image.new("RGB", (WIDTH, HEIGHT), "#ffffff")
    draw = ImageDraw.Draw(image, "RGBA")
    draw_gradient(draw, primary, secondary)
    draw_pattern(draw, str(article["slug"]), hex_to_rgb(dark))
    draw_text_box(draw, article, info)

    out = IMAGES_DIR / f"{article['slug']}.jpg"
    image.save(out, "JPEG", quality=88, optimize=True, progressive=True)


def read_sources() -> dict[str, object]:
    if not SOURCES_FILE.exists():
        return {}
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def write_sources(sources: dict[str, object]) -> None:
    SOURCES_FILE.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    sources = read_sources()
    generated = 0
    for article in load_articles():
        slug = str(article["slug"])
        target = IMAGES_DIR / f"{slug}.jpg"
        existing_source = sources.get(slug)
        should_replace = isinstance(existing_source, dict) and existing_source.get("provider") == "generated-card"
        if target.exists() and not should_replace:
            continue
        save_cover(article)
        sources[slug] = {
            "provider": "generated-card",
            "style": "branded-topic-cover",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
        generated += 1
    write_sources(sources)
    print(f"Generated {generated} card images")


if __name__ == "__main__":
    main()
