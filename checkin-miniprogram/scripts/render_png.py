"""
把 SVG / HTML 渲染成 PNG（用 Playwright + Chromium），本地化字体以保证截图一致。

    python3 scripts/render_png.py docs/er/er-concept.svg docs/er/er-concept.png [--scale 2]
"""
import sys
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SMILEY = ROOT / "scripts" / "fonts" / "SmileySans-Oblique.ttf"


def font_css():
    if not SMILEY.exists():
        return ""
    b64 = base64.b64encode(SMILEY.read_bytes()).decode()
    return f"@font-face{{font-family:'Smiley Sans';src:url(data:font/ttf;base64,{b64}) format('truetype');}}"


def render(src: Path, dst: Path, scale: float = 2.0):
    svg = src.read_text(encoding="utf-8")
    html = f"<!doctype html><meta charset=utf-8><style>{font_css()}html,body{{margin:0}}svg{{display:block}}</style>{svg}"
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(device_scale_factor=scale)
        page.set_content(html)
        page.wait_for_timeout(300)
        el = page.query_selector("svg")
        el.screenshot(path=str(dst))
        b.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    scale = 2.0
    if "--scale" in args:
        i = args.index("--scale")
        scale = float(args[i + 1])
        del args[i : i + 2]
    render(Path(args[0]), Path(args[1]), scale)
    print("rendered", args[1])
