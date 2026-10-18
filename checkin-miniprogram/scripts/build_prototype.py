"""
构建交互原型：把 app.js 和「得意黑」字体子集内联进 HTML，得到单文件 docs/prototype/index.html。

    python3 scripts/build_prototype.py

得意黑（Smiley Sans，SIL OFL 1.1）不在 Google Fonts 上，只按页面里实际用到的字裁出子集再内联。
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "prototype" / "source.html"
JS = ROOT / "docs" / "prototype" / "app.js"
OUT = ROOT / "docs" / "prototype" / "index.html"
FONT = ROOT / "scripts" / "fonts" / "SmileySans-Oblique.ttf"


def subset_font(text: str) -> str:
    chars = set(text) | set("0123456789:：，。、（）—")
    chars = "".join(sorted(c for c in chars if ord(c) > 31))
    with tempfile.TemporaryDirectory() as d:
        tf = Path(d) / "chars.txt"
        tf.write_text(chars, encoding="utf-8")
        out = Path(d) / "s.woff2"
        subprocess.run(
            ["pyftsubset", str(FONT), f"--text-file={tf}", "--flavor=woff2",
             f"--output-file={out}", "--layout-features=*", "--no-hinting"],
            check=True,
        )
        data = base64.b64encode(out.read_bytes()).decode()
    return (
        "@font-face{font-family:'Smiley Sans';font-style:normal;font-weight:400;font-display:block;"
        f"src:url(data:font/woff2;base64,{data}) format('woff2');}}"
    )


def main():
    html = SRC.read_text(encoding="utf-8")
    js = JS.read_text(encoding="utf-8")
    font = subset_font(html + js)
    html = html.replace("/*SMILEY_FONT*/", font).replace("/*APP_SCRIPT*/", js)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
