"""
给 build.js 生成的预览 HTML 截图。
    node scripts/preview/build.js out/  &&  python3 scripts/preview/shoot.py out/ docs/screens/
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def main(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for f in sorted(src.glob("*.html")):
            h = 667 if f.stem.endswith("-se") else 812
            page = b.new_page(viewport={"width": 375, "height": h}, device_scale_factor=2)
            page.goto(f.as_uri())
            page.wait_for_timeout(250)
            page.screenshot(path=str(dst / f"{f.stem}.png"))
            page.close()
        b.close()
    print("shot", len(list(src.glob('*.html'))), "->", dst)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
