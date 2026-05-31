from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "src" / "content" / "articles"
IMAGES_DIR = ROOT / "public" / "images"
SOURCES_FILE = IMAGES_DIR / ".sources.json"
WIDTH = 768
HEIGHT = 512


PALETTES = {
    "kulinaria": [(91, 51, 30), (185, 96, 42), (231, 185, 126), (72, 110, 65)],
    "dom-i-uborka": [(78, 88, 83), (178, 174, 159), (226, 221, 207), (105, 132, 122)],
    "dacha-i-ogorod": [(49, 79, 39), (99, 139, 72), (137, 93, 49), (213, 193, 137)],
    "ekonomiya": [(56, 76, 88), (117, 143, 155), (216, 205, 170), (96, 111, 89)],
    "rybalka": [(42, 76, 89), (83, 133, 151), (203, 190, 156), (54, 68, 57)],
    "layfkhaki": [(77, 70, 63), (158, 145, 126), (220, 211, 194), (97, 113, 103)],
}


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    data: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip("\"'")
    return data


def load_articles() -> list[dict[str, str]]:
    articles = []
    for file in sorted(ARTICLES_DIR.glob("*.mdx")):
        data = frontmatter(file.read_text(encoding="utf-8"))
        articles.append({
            "slug": data.get("slug") or file.stem,
            "category": data.get("category") or "layfkhaki",
        })
    return articles


def read_sources() -> dict[str, object]:
    if not SOURCES_FILE.exists():
        return {}
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def write_sources(sources: dict[str, object]) -> None:
    SOURCES_FILE.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def seed(slug: str) -> int:
    return int(hashlib.sha256(slug.encode("utf-8")).hexdigest()[:12], 16)


def jitter(color: tuple[int, int, int], rng: random.Random, amount: int = 18) -> tuple[int, int, int]:
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in color)


def background(palette: list[tuple[int, int, int]], rng: random.Random) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), palette[2])
    px = image.load()
    top = jitter(palette[2], rng, 12)
    bottom = jitter(palette[1], rng, 18)
    for y in range(HEIGHT):
        t = y / HEIGHT
        for x in range(WIDTH):
            grain = rng.randint(-5, 5)
            px[x, y] = tuple(max(0, min(255, round(top[i] * (1 - t) + bottom[i] * t) + grain)) for i in range(3))
    return image.filter(ImageFilter.GaussianBlur(0.35))


def draw_depth(draw: ImageDraw.ImageDraw, palette: list[tuple[int, int, int]], rng: random.Random) -> None:
    for _ in range(12):
        x = rng.randint(-120, WIDTH)
        y = rng.randint(-80, HEIGHT)
        w = rng.randint(130, 360)
        h = rng.randint(80, 260)
        color = jitter(rng.choice(palette), rng, 20)
        draw.ellipse([x, y, x + w, y + h], fill=(*color, rng.randint(24, 55)))


def draw_food(draw: ImageDraw.ImageDraw, palette, rng) -> None:
    draw.rounded_rectangle([120, 300, 650, 435], radius=55, fill=(*jitter(palette[0], rng), 95))
    draw.ellipse([175, 120, 590, 410], fill=(235, 220, 190, 210), outline=(*palette[0], 110), width=7)
    for _ in range(18):
        x, y = rng.randint(245, 500), rng.randint(185, 330)
        r = rng.randint(18, 48)
        draw.ellipse([x, y, x + r * 2, y + r], fill=(*jitter(rng.choice(palette), rng, 25), rng.randint(120, 210)))


def draw_home(draw: ImageDraw.ImageDraw, palette, rng) -> None:
    draw.rounded_rectangle([80, 120, 700, 430], radius=28, fill=(235, 231, 220, 160))
    for x in range(130, 670, 120):
        draw.rounded_rectangle([x, 175 + rng.randint(-25, 25), x + 70, 405], radius=24, fill=(*jitter(palette[1], rng), 125))
    draw.rectangle([70, 405, 710, 450], fill=(*jitter(palette[0], rng), 90))


def draw_garden(draw: ImageDraw.ImageDraw, palette, rng) -> None:
    draw.rectangle([0, 345, WIDTH, HEIGHT], fill=(*jitter(palette[2], rng), 155))
    for x in range(80, 760, 75):
        draw.line([x, 430, x + rng.randint(-25, 35), 180], fill=(*jitter(palette[0], rng), 150), width=8)
        draw.ellipse([x - 55, 160, x + 55, 260], fill=(*jitter(palette[1], rng), 155))
        draw.ellipse([x + 10, 175, x + 115, 280], fill=(*jitter(palette[1], rng), 115))


def draw_money(draw: ImageDraw.ImageDraw, palette, rng) -> None:
    for i in range(5):
        x = 150 + i * 82
        h = 100 + i * 42
        draw.rounded_rectangle([x, 390 - h, x + 58, 390], radius=18, fill=(*jitter(palette[1], rng), 155))
    draw.rounded_rectangle([130, 275, 620, 420], radius=42, fill=(240, 232, 205, 145))


def draw_fishing(draw: ImageDraw.ImageDraw, palette, rng) -> None:
    for y in (300, 350, 400):
        draw.arc([50, y - 70, 720, y + 70], 0, 180, fill=(*jitter(palette[1], rng), 120), width=12)
    draw.ellipse([260, 205, 510, 330], fill=(230, 226, 205, 150), outline=(*palette[0], 90), width=6)
    draw.polygon([(510, 265), (610, 210), (610, 320)], fill=(*jitter(palette[0], rng), 120))


def render(article: dict[str, str]) -> Image.Image:
    rng = random.Random(seed(article["slug"]))
    palette = PALETTES.get(article["category"], PALETTES["layfkhaki"])
    image = background(palette, rng).convert("RGBA")
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    draw_depth(draw, palette, rng)
    if article["category"] == "kulinaria":
        draw_food(draw, palette, rng)
    elif article["category"] == "dacha-i-ogorod":
        draw_garden(draw, palette, rng)
    elif article["category"] == "ekonomiya":
        draw_money(draw, palette, rng)
    elif article["category"] == "rybalka":
        draw_fishing(draw, palette, rng)
    else:
        draw_home(draw, palette, rng)
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1.0)))
    return image.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.4, percent=80, threshold=5))


def main() -> None:
    sources = read_sources()
    count = 0
    for article in load_articles():
        if sources.get(article["slug"], {}).get("provider") != "generated-card":
            continue
        out = IMAGES_DIR / f"{article['slug']}.jpg"
        render(article).save(out, "JPEG", quality=84, optimize=True, progressive=True)
        sources[article["slug"]] = {
            "provider": "procedural-photo-like",
            "style": "muted-realistic-raster",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
        count += 1
    write_sources(sources)
    print(f"Generated {count} procedural photo-like images")


if __name__ == "__main__":
    main()
