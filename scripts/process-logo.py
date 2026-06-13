"""Remove near-black background from Valorant CN logo PNG."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def key_background_to_alpha(img: Image.Image, dark: int = 45, light: int = 245) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            # 黑底 / 白底 → 透明
            if max_c <= dark:
                px[x, y] = (r, g, b, 0)
            elif min_c >= light:
                px[x, y] = (r, g, b, 0)
            elif max_c <= dark + 40:
                fade = int(255 * (max_c - dark) / 40)
                px[x, y] = (r, g, b, min(a, fade))
            elif min_c >= light - 40:
                fade = int(255 * (light - min_c) / 40)
                px[x, y] = (r, g, b, min(a, fade))
    return rgba


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "public" / "brand" / "valorant-cn-logo.png"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "public" / "brand" / "valorant-cn-logo.png"

    img = Image.open(src)
    result = key_background_to_alpha(img)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.save(out, "PNG")
    print(f"saved transparent logo: {out} ({result.size[0]}x{result.size[1]})")


if __name__ == "__main__":
    main()
