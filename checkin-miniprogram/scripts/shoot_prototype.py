"""
给交互原型截图：整页、流转图、以及每个界面单独一张，输出到 docs/prototype/screens/。

    python3 scripts/shoot_prototype.py [--page-only]

Google Fonts 在离线环境不可用时，用本地的 Bricolage Grotesque / Noto Sans CJK 顶替，保证截图字体正确。
"""
import base64
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "docs" / "prototype" / "index.html"
OUT = ROOT / "docs" / "prototype" / "screens"
BRICO = ROOT / "scripts" / "fonts" / "bricolage"

NODES = [
    "home", "stuLogin", "ck_out", "ck_in", "ck_hold", "ck_done", "ck_used",
    "admLogin", "admApply", "admPending", "courses", "courseEdit", "admins",
    "students", "importRes", "records", "recEdit", "recAdd", "export",
]


def local_font_css():
    css = ["@font-face{font-family:'Noto Sans SC';src:local('Noto Sans CJK SC'),local('NotoSansCJKsc-Regular');font-weight:400;}",
           "@font-face{font-family:'Noto Sans SC';src:local('Noto Sans CJK SC Medium'),local('NotoSansCJKsc-Medium');font-weight:500;}",
           "@font-face{font-family:'Noto Sans SC';src:local('Noto Sans CJK SC Bold'),local('NotoSansCJKsc-Bold');font-weight:700;}"]
    for w in (400, 500, 600, 700, 800):
        f = BRICO / f"bricolage-grotesque-latin-{w}-normal.woff2"
        if f.exists():
            b64 = base64.b64encode(f.read_bytes()).decode()
            css.append(f"@font-face{{font-family:'Bricolage Grotesque';font-weight:{w};src:url(data:font/woff2;base64,{b64}) format('woff2');}}")
    return "\n".join(css)


def main(page_only=False):
    OUT.mkdir(parents=True, exist_ok=True)
    css = local_font_css()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
        page = ctx.new_page()
        page.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=css))
        page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        page.goto(PAGE.as_uri())
        page.wait_for_timeout(800)
        page.emulate_media(reduced_motion="reduce")
        page.screenshot(path=str(OUT.parent / "page.png"), full_page=False)
        if page_only:
            browser.close()
            return
        page.add_style_tag(content=".wrap{max-width:none!important}.flow-scroll{overflow:visible!important}")
        page.set_viewport_size({"width": 1700, "height": 900})
        page.wait_for_timeout(300)
        page.locator("#flow").screenshot(path=str(OUT.parent / "flow.png"))
        page.set_viewport_size({"width": 1280, "height": 900})
        for n in NODES:
            page.evaluate(f"location.hash = '#{n}'; location.reload()")
            page.wait_for_timeout(500)
            page.locator("#screen").screenshot(path=str(OUT / f"{n}.png"))
        browser.close()
    print("screens written to", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main("--page-only" in sys.argv)
