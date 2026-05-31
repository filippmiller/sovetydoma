from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "src" / "content" / "articles"
IMAGES_DIR = ROOT / "public" / "images"
SOURCES_FILE = IMAGES_DIR / ".sources.json"

WIDTH = 1200
HEIGHT = 800

CATEGORY = {
    "kulinaria": {
        "colors": ("#c99052", "#ead9bf", "#70451f"),
        "kind": "kitchen",
    },
    "dom-i-uborka": {
        "colors": ("#6f9b87", "#d7e3da", "#315748"),
        "kind": "home",
    },
    "dacha-i-ogorod": {
        "colors": ("#759764", "#dbe4cf", "#3d5734"),
        "kind": "garden",
    },
    "layfkhaki": {
        "colors": ("#8d8072", "#e4ded4", "#50483f"),
        "kind": "lifehack",
    },
    "ekonomiya": {
        "colors": ("#6689a3", "#d9e2e7", "#304b60"),
        "kind": "savings",
    },
    "rybalka": {
        "colors": ("#5f8fa2", "#d3e4e8", "#315867"),
        "kind": "fishing",
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
                "category": str(data.get("category") or ""),
            }
        )
    return articles


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def seeded(slug: str) -> int:
    return int(hashlib.sha256(slug.encode("utf-8")).hexdigest()[:12], 16)


def random_unit(seed: int, index: int) -> float:
    value = hashlib.sha256(f"{seed}:{index}".encode("utf-8")).hexdigest()[:8]
    return int(value, 16) / 0xFFFFFFFF


def draw_gradient(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], secondary: tuple[int, int, int]) -> None:
    for y in range(HEIGHT):
        t = y / HEIGHT
        draw.line([(0, y), (WIDTH, y)], fill=blend(secondary, primary, t * 0.35))


def draw_background_texture(layer: Image.Image, slug: str, palette: tuple[tuple[int, int, int], ...]) -> None:
    draw = ImageDraw.Draw(layer, "RGBA")
    seed = seeded(slug)

    for i in range(22):
        x = int(random_unit(seed, i * 5) * WIDTH)
        y = int(random_unit(seed, i * 5 + 1) * HEIGHT)
        w = int(140 + random_unit(seed, i * 5 + 2) * 420)
        h = int(90 + random_unit(seed, i * 5 + 3) * 260)
        color = palette[i % len(palette)]
        alpha = int(18 + random_unit(seed, i * 5 + 4) * 38)
        draw.ellipse([x - w // 2, y - h // 2, x + w // 2, y + h // 2], fill=(*color, alpha))

    for i in range(9):
        x = (seed * (i + 3) * 37) % WIDTH
        y = (seed * (i + 5) * 53) % HEIGHT
        length = 110 + ((seed >> i) % 130)
        angle = ((seed >> (i + 4)) % 628) / 100
        x2 = x + int(math.cos(angle) * length)
        y2 = y + int(math.sin(angle) * length)
        draw.line([(x, y), (x2, y2)], fill=(*palette[-1], 22), width=5)


def draw_kitchen(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    draw.rounded_rectangle([190, 430, 970, 555], radius=48, fill=(*primary, 120))
    draw.ellipse([300, 220, 900, 650], fill=(255, 255, 255, 112), outline=(*dark, 55), width=10)
    for x in (445, 545, 645):
        draw.ellipse([x, 325, x + 115, 440], fill=(*dark, 86))
        draw.ellipse([x + 18, 342, x + 97, 420], fill=(245, 238, 225, 150))


def draw_home(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    draw.rounded_rectangle([245, 300, 900, 590], radius=42, fill=(255, 255, 255, 118))
    for i, x in enumerate((310, 470, 630, 790)):
        draw.rounded_rectangle([x, 235, x + 92, 585], radius=42, fill=(*primary, 108 - i * 10))
    draw.line([(235, 600), (930, 600)], fill=(*dark, 66), width=14)


def draw_garden(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    draw.rounded_rectangle([130, 515, 1065, 680], radius=52, fill=(*dark, 58))
    for x in range(210, 1000, 115):
        draw.line([(x, 560), (x + 28, 330)], fill=(*dark, 100), width=12)
        draw.ellipse([x - 70, 295, x + 45, 410], fill=(*primary, 112))
        draw.ellipse([x + 5, 270, x + 130, 400], fill=(*primary, 82))


def draw_lifehack(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    draw.rounded_rectangle([245, 360, 945, 520], radius=58, fill=(255, 255, 255, 112))
    for i, x in enumerate((335, 455, 575, 695)):
        draw.rounded_rectangle([x, 250 + i * 16, x + 260, 330 + i * 16], radius=38, fill=(*primary, 96 - i * 9))
    draw.ellipse([500, 275, 760, 535], outline=(*dark, 86), width=18)


def draw_savings(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    draw.rounded_rectangle([285, 265, 895, 560], radius=50, fill=(255, 255, 255, 116))
    for i, x in enumerate((370, 500, 630, 760)):
        h = 120 + i * 55
        draw.rounded_rectangle([x, 610 - h, x + 76, 610], radius=30, fill=(*primary, 105))
    draw.arc([300, 225, 920, 725], start=205, end=330, fill=(*dark, 80), width=18)


def draw_fishing(draw: ImageDraw.ImageDraw, primary: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    for y in (410, 485, 560):
        draw.arc([120, y - 80, 1080, y + 95], start=8, end=172, fill=(*primary, 82), width=16)
    draw.ellipse([435, 300, 785, 500], fill=(255, 255, 255, 110), outline=(*dark, 62), width=9)
    draw.polygon([(785, 400), (920, 310), (920, 490)], fill=(*dark, 76))


def draw_topic_image(image: Image.Image, article: dict[str, object], info: dict[str, object]) -> None:
    primary = hex_to_rgb(str(info["colors"][0]))
    secondary = hex_to_rgb(str(info["colors"][1]))
    dark = hex_to_rgb(str(info["colors"][2]))

    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_background_texture(layer, str(article["slug"]), (primary, secondary, dark))
    draw = ImageDraw.Draw(layer, "RGBA")

    kind = str(info["kind"])
    if kind == "kitchen":
        draw_kitchen(draw, primary, dark)
    elif kind == "home":
        draw_home(draw, primary, dark)
    elif kind == "garden":
        draw_garden(draw, primary, dark)
    elif kind == "savings":
        draw_savings(draw, primary, dark)
    elif kind == "fishing":
        draw_fishing(draw, primary, dark)
    else:
        draw_lifehack(draw, primary, dark)

    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius=1.2)))


def save_cover(article: dict[str, object]) -> None:
    info = CATEGORY.get(str(article["category"]), CATEGORY["layfkhaki"])
    primary = hex_to_rgb(str(info["colors"][0]))
    secondary = hex_to_rgb(str(info["colors"][1]))

    image = Image.new("RGBA", (WIDTH, HEIGHT), (*secondary, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    draw_gradient(draw, primary, secondary)
    draw_topic_image(image, article, info)

    out = IMAGES_DIR / f"{article['slug']}.jpg"
    image.convert("RGB").save(out, "JPEG", quality=86, optimize=True, progressive=True)


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
            "style": "muted-topic-thumbnail",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
        generated += 1
    write_sources(sources)
    print(f"Generated {generated} card images")


if __name__ == "__main__":
    main()
