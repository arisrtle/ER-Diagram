"""
生成小程序图标组件的样式 miniprogram/components/ic/ic.wxss。

每个图标是一段 24×24 的线条 SVG，写成 data URI 当作遮罩（-webkit-mask），
背景色取 currentColor，所以图标颜色跟随文字颜色。

    python3 scripts/build_icons.py
"""
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "miniprogram" / "components" / "ic" / "ic.wxss"

S = 'stroke="black" stroke-linecap="round" stroke-linejoin="round" fill="none"'
ICONS = {
    "back": f'<path d="M15 5 8 12l7 7" {S} stroke-width="2.2"/>',
    "arrow": f'<path d="M4.5 12h14m-5.5-6 6 6-6 6" {S} stroke-width="2.6"/>',
    "chevron": f'<path d="m9.5 5.5 6.5 6.5-6.5 6.5" {S} stroke-width="2.2"/>',
    "close": f'<path d="M6 6l12 12M18 6 6 18" {S} stroke-width="2.2"/>',
    "pin": f'<path d="M12 21.5s7-6.2 7-11.4a7 7 0 0 0-14 0c0 5.2 7 11.4 7 11.4Z" {S} stroke-width="2"/><circle cx="12" cy="10" r="2.4" fill="black"/>',
    "check": f'<path d="m5 12.5 4.5 4.5L19 7.5" {S} stroke-width="2.8"/>',
    "plus": f'<path d="M12 5v14M5 12h14" {S} stroke-width="2.6"/>',
    "search": f'<circle cx="10.5" cy="10.5" r="6.5" {S} stroke-width="2.2"/><path d="m15.5 15.5 4.5 4.5" {S} stroke-width="2.2"/>',
    "upload": f'<path d="M12 15.5V4m-5 5 5-5 5 5M4 16.5V20h16v-3.5" {S} stroke-width="2.2"/>',
    "download": f'<path d="M12 4v11.5m-5-5 5 5 5-5M4 16.5V20h16v-3.5" {S} stroke-width="2.2"/>',
    "locate": f'<circle cx="12" cy="12" r="5.5" {S} stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" {S} stroke-width="2"/>',
    "book": f'<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4V5Zm16 0h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6V5Z" {S} stroke-width="2"/>',
    "people": f'<circle cx="9" cy="8" r="3.6" {S} stroke-width="2"/><path d="M2.5 20c.8-3.6 3.2-5.4 6.5-5.4s5.7 1.8 6.5 5.4" {S} stroke-width="2"/><path d="M15.5 4.5a3.4 3.4 0 0 1 0 6.6M17.5 14.5c1.9.7 3 2.3 3.4 4.8" {S} stroke-width="2"/>',
    "list": f'<path d="M9 6h11M9 12h11M9 18h11" {S} stroke-width="2.2"/><circle cx="4.5" cy="6" r="1.5" fill="black"/><circle cx="4.5" cy="12" r="1.5" fill="black"/><circle cx="4.5" cy="18" r="1.5" fill="black"/>',
    "chat": f'<path d="M12 3.5c-4.9 0-8.8 3.2-8.8 7.3 0 2.3 1.3 4.4 3.3 5.7l-.7 3.1 3.5-1.8c.9.2 1.8.3 2.7.3 4.9 0 8.8-3.2 8.8-7.3S16.9 3.5 12 3.5Z" {S} stroke-width="2"/><circle cx="8.7" cy="10.8" r="1.25" fill="black"/><circle cx="15.3" cy="10.8" r="1.25" fill="black"/>',
    "warn": f'<circle cx="12" cy="12" r="9" {S} stroke-width="2"/><path d="M12 7v6.2M12 16.6v.4" {S} stroke-width="2.4"/>',
    "trash": f'<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6" {S} stroke-width="2"/>',
    "edit": f'<path d="M4 20h4L19 9l-4-4L4 16v4Z" {S} stroke-width="2"/><path d="m13.5 6.5 4 4" {S} stroke-width="2"/>',
    "map": f'<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5V6.5Z" {S} stroke-width="2"/><path d="M9 4v13.5M15 6.5V20" {S} stroke-width="2"/>',
    "file": f'<path d="M6 3h8l5 5v13H6V3Z" {S} stroke-width="2"/><path d="M14 3v5h5M9 13l2.2 3L9 19M15 13l-2.2 3 2.2 3" {S} stroke-width="2"/>',
    "refresh": f'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.6h-4.6" {S} stroke-width="2.2"/>',
    "logout": f'<path d="M14 4.5H6v15h8M10.5 12H20m-3.5-3.5L20 12l-3.5 3.5" {S} stroke-width="2"/>',
}


def data_uri(body: str) -> str:
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">{body}</svg>'
    return "data:image/svg+xml;charset=utf-8," + quote(svg, safe=" =:/,;-.\"'")


def main():
    lines = [
        "/* 本文件由 scripts/build_icons.py 生成，请勿手改 */",
        ".ic { display: inline-block; flex: none; vertical-align: middle; background-color: currentColor;",
        "  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center;",
        "  -webkit-mask-size: 100% 100%; mask-size: 100% 100%; }",
    ]
    for name, body in ICONS.items():
        uri = data_uri(body).replace('"', "'")
        lines.append(f'.ic-{name} {{ -webkit-mask-image: url("{uri}"); mask-image: url("{uri}"); }}')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(ICONS)} icons)")


if __name__ == "__main__":
    main()
