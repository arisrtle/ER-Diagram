"""
生成小程序字体样式 miniprogram/styles/fonts.wxss。

- Smiley（得意黑 Smiley Sans，SIL OFL 1.1）：标题用。扫描 miniprogram 下所有 .wxml/.js/.json 里的字符，
  只保留界面上实际出现的字，再加常用标点和数字，裁成子集。
- Brico（Bricolage Grotesque，SIL OFL 1.1）：数字与拉丁字母用，只保留 ASCII 和少量符号。
两者以 base64 内联进 WXSS（小程序样式里不能引用本地字体文件）。

改了界面文案后重新运行：
    python3 scripts/build_fonts.py
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MP = ROOT / "miniprogram"
OUT = MP / "styles" / "fonts.wxss"
SMILEY = ROOT / "scripts" / "fonts" / "SmileySans-Oblique.ttf"
BRICO = ROOT / "scripts" / "fonts" / "bricolage"

EXTRA = "0123456789，。、：；！？「」（）—…·+-/ 第周门人条行米课班级号"
ASCII = "".join(chr(c) for c in range(32, 127)) + "±—–·…×"


def collect_chars() -> str:
    chars = set(EXTRA) | set(ASCII)
    for p in MP.rglob("*"):
        if p.suffix in {".wxml", ".js", ".json"} and "styles" not in p.parts:
            text = p.read_text(encoding="utf-8")
            # 只要 CJK 字符和全角标点；英文已在 ASCII 里
            chars |= set(re.findall(r"[　-〿一-鿿＀-￯]", text))
    return "".join(sorted(chars))


def subset(src: Path, text: str, flavor="woff") -> str:
    with tempfile.TemporaryDirectory() as d:
        tf = Path(d) / "t.txt"
        tf.write_text(text, encoding="utf-8")
        out = Path(d) / f"o.{flavor}"
        subprocess.run(
            ["pyftsubset", str(src), f"--text-file={tf}", f"--flavor={flavor}",
             f"--output-file={out}", "--layout-features=kern,liga,calt", "--no-hinting",
             "--desubroutinize"],
            check=True,
        )
        return base64.b64encode(out.read_bytes()).decode()


def face(family, weight, b64):
    return (f"@font-face {{ font-family: \"{family}\"; font-style: normal; font-weight: {weight}; "
            f"src: url(\"data:font/woff;charset=utf-8;base64,{b64}\") format(\"woff\"); }}")


def main():
    chars = collect_chars()
    rules = [
        "/* 本文件由 scripts/build_fonts.py 生成，请勿手改。",
        f"   Smiley 子集 {len(chars)} 字；Brico 为 ASCII 子集。两款字体均为 SIL Open Font License 1.1。 */",
        face("Smiley", 400, subset(SMILEY, chars)),
    ]
    for w in (400, 600, 800):
        rules.append(face("Brico", w, subset(BRICO / f"bricolage-grotesque-latin-{w}-normal.woff2", ASCII)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(rules) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {OUT.stat().st_size // 1024} KB, {len(chars)} chars")


if __name__ == "__main__":
    main()
