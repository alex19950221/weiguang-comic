"""Render a four-page original comic for the website and reviewer demo."""
from pathlib import Path
from tempfile import TemporaryDirectory
import math
import subprocess
import zipfile

ART = Path(__file__).resolve().parent
# 输出到 art/out/（已忽略），不改动 Cloudflare 上传目录 public/。
OUT = ART / "out"

# Sunset, crossing, lantern, and arrival. The scene is drawn from original shapes.
SCENES = (
    ("#fae6b6", "#f28f52", "#899ed0", "#415b91", 493, 190, 278, 648, 0),
    ("#c7caeb", "#ffe2a2", "#8098c8", "#314d84", 240, 180, 520, 560, 45),
    ("#242c5e", "#eee3b3", "#6a80b4", "#263662", 515, 159, 315, 673, -82),
    ("#efb59c", "#fff2b7", "#a4add5", "#4c6197", 468, 205, 520, 476, -40),
)


def scene(config):
    sky, sun, wave, ocean, sun_x, sun_y, boat_x, boat_y, island_offset = config
    water_lines = []
    for row in range(13):
        y = 450 + row * 25
        for column in range(5):
            x = 20 + column * 139 + (row * 17 % 42)
            run = 36 + (row * 23 + column * 13) % 70
            rise = round(math.sin(row + column) * 5)
            water_lines.append(
                f'<path d="M{x} {y}q{run / 2:g} {rise} {run} 0" />'
            )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="840" viewBox="0 0 640 840">
  <rect width="640" height="840" fill="#182246"/>
  <rect x="14" y="14" width="612" height="510" fill="{sky}"/>
  <circle cx="{sun_x}" cy="{sun_y}" r="99" fill="{sun}"/>
  <path fill="#eee8e9" opacity=".56" d="M14 232Q131 197 277 229T626 223v14Q498 257 322 248T14 250Z"/>
  <path fill="{wave}" d="M14 401q90-60 161-51t143 20q113 1 308-43v197H14Z"/>
  <path fill="{ocean}" d="M14 421Q128 395 290 415t336-25v135H14Z"/>
  <g transform="translate({island_offset} 0)">
    <path fill="#202c58" d="M383 425q46-25 70-41l53-8 43 13 59-11 40 20v26l-73 17-116 4Z"/>
    <path fill="#fff5d4" d="M494 390l9-89h26l10 89-22 9Z"/>
    <path fill="#d46b51" d="M498 341l35 2 2 16-39-2Z"/>
    <path fill="#292749" d="M500 301l16-16 17 16v12h-33Z"/>
    <rect x="508" y="305" width="16" height="8" fill="#ffd87b"/>
    <path fill="#ffe5a0" opacity=".52" d="M509 309 238 256l41 65 230-7Z"/>
  </g>
  <rect x="14" y="538" width="612" height="288" fill="{ocean}"/>
  <g fill="none" stroke="{wave}" stroke-width="3" opacity=".7">{''.join(water_lines)}</g>
  <rect x="14" y="524" width="612" height="14" fill="#182246"/>
  <g transform="translate({boat_x} {boat_y})">
    <path fill="#202953" opacity=".7" d="M-84 44q92-22 178-5L40 61Z"/>
    <path fill="#fbf1d8" stroke="#222b54" stroke-width="3" d="M-79 12 66 4 31 43-39 44Z"/>
    <path fill="#e6ab79" stroke="#222b54" stroke-width="3" d="M-79 12-12-46 66 4 17 26Z"/>
    <path fill="#fff5dc" d="M-12-41-38 22l53 4Z"/>
  </g>
  <path fill="none" stroke="#f9f3df" stroke-width="4" opacity=".88" d="M32 781q66-10 113 0m320 16q71-12 125-5"/>
</svg>
"""


with TemporaryDirectory(prefix="lumicomic-art-") as temporary:
    temp = Path(temporary)
    sources = []
    for index, config in enumerate(SCENES, start=1):
        path = temp / f"page-{index:02}.svg"
        path.write_text(scene(config), encoding="utf-8")
        sources.append(path)
    subprocess.run(
        ["swift", "-module-cache-path", str(temp / "modules"), str(ART / "render.swift"), *map(str, sources)],
        check=True,
    )
    pages = [source.with_suffix(".png") for source in sources]
    OUT.mkdir(exist_ok=True)
    (OUT / "fog-island.png").write_bytes(pages[0].read_bytes())
    comic_info = '<?xml version="1.0" encoding="utf-8"?><ComicInfo><Title>雾岛来信</Title><Series>雾岛来信</Series><Number>1</Number><PageCount>4</PageCount></ComicInfo>'
    with zipfile.ZipFile(OUT / "fog-island.cbz", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("ComicInfo.xml", comic_info)
        for page in pages:
            archive.write(page, page.name)
