"""
生成提交用的三份文档 PDF（ER 图、数据库表结构、交互原型），外加可点击原型 HTML。

    python3 scripts/build_submission.py <输出目录> <mermaid.min.js 路径>
"""
import re
import shutil
import sys
from pathlib import Path

import markdown
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SMILEY = ROOT / "scripts" / "fonts" / "SmileySans-Oblique.ttf"

CSS = """
@font-face { font-family: 'Smiley'; src: url('%(smiley)s'); }
@page { size: %(size)s; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Noto Sans CJK SC', 'Noto Sans SC', sans-serif; font-size: 10.2pt; line-height: 1.7; color: #13312E; }
.band { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #2F7D6D; padding-bottom: 6px; margin-bottom: 18px; color: #4E6A65; font-size: 9pt; }
.band b { color: #2F7D6D; font-weight: 700; }
h1 { font-family: 'Smiley', sans-serif; font-weight: 400; font-size: 30pt; line-height: 1.1; margin: 0 0 10px; }
h2 { font-family: 'Smiley', sans-serif; font-weight: 400; font-size: 17pt; margin: 26px 0 8px; color: #13312E; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 18px 0 6px; break-after: avoid; }
p, li { max-width: 100%%; }
strong { color: #1F5A4F; }
code { font-family: 'Noto Sans Mono CJK SC', monospace; font-size: 8.8pt; background: #E9EFEC; padding: 0 4px; border-radius: 4px; }
pre { background: #F3F7F5; padding: 10px 12px; border-radius: 8px; font-size: 8.5pt; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%%; margin: 8px 0 14px; font-size: 9pt; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #2F7D6D; color: #fff; text-align: left; font-weight: 700; padding: 6px 8px; }
td { padding: 5px 8px; border-bottom: 1px solid #D5E2DC; vertical-align: top; }
tr:nth-child(even) td { background: #F4F8F6; }
img { max-width: 100%%; display: block; margin: 8px auto; break-inside: avoid; }
.figure { break-inside: avoid; margin: 10px 0 16px; }
.figure img { border-radius: 10px; }
.cap { text-align: center; color: #4E6A65; font-size: 9pt; margin-top: 2px; }
.mermaid { display: flex; justify-content: center; margin: 10px 0; break-inside: avoid; }
.mermaid svg { max-width: 100%%; height: auto; }
.screens { display: flex; flex-wrap: wrap; gap: 14px 10px; margin-top: 10px; }
.screens figure { margin: 0; break-inside: avoid; page-break-inside: avoid; text-align: center; width: calc((100%% - 40px) / 5); display: inline-block; }
.screens img { margin: 0 auto 4px; border-radius: 13px; border: 3px solid #13312E; width: 100%%; }
.screens figcaption { font-size: 8.5pt; font-weight: 700; line-height: 1.3; }
.screens figcaption span { display: block; font-weight: 400; color: #7E958F; }
.pb { break-before: page; }
"""

SCREENS = [
    ("home", "选择身份", "公共"), ("stuLogin", "学生登录", "学生端"), ("ck_out", "签到：不在范围内", "学生端"),
    ("ck_in", "签到：在范围内", "学生端"), ("ck_hold", "按住签到", "学生端"), ("ck_done", "已签到", "学生端"),
    ("ck_used", "本机已签过此课", "学生端"), ("admLogin", "管理员登录", "管理端"), ("admApply", "申请成为管理员", "管理端"),
    ("admPending", "等待审核", "管理端"), ("courses", "课程列表", "管理端"), ("courseEdit", "新增 / 编辑课程", "管理端"),
    ("admins", "管理员与审核", "管理端"), ("students", "学生管理", "管理端"), ("importRes", "导入结果", "管理端"),
    ("records", "签到记录", "管理端"), ("recEdit", "修改 / 删除记录", "管理端"), ("recAdd", "补录签到", "管理端"),
    ("export", "导出 Excel", "管理端"),
]


def md_to_html(text: str) -> str:
    # mermaid 代码块先换成占位 div，交给 mermaid.js 渲染
    blocks = []

    def keep(m):
        blocks.append(m.group(1))
        return f"\n\nMERMAID{len(blocks) - 1}\n\n"

    text = re.sub(r"```mermaid\n(.*?)```", keep, text, flags=re.S)
    html = markdown.markdown(text, extensions=["tables", "fenced_code"])
    for i, b in enumerate(blocks):
        html = html.replace(f"<p>MERMAID{i}</p>", f'<div class="mermaid">{b}</div>')
    return html


def page(title_band: str, body: str, size: str) -> str:
    css = CSS % {"smiley": SMILEY.as_uri(), "size": size}
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>"
            f"<div class='band'><span><b>微信小程序定位签到系统</b>　课堂签到</span><span>{title_band}</span></div>"
            f"{body}</body></html>")


def doc1() -> str:
    t = (DOCS / "01-ER图.md").read_text(encoding="utf-8")
    intro = t.split("## 概念 ER 图")[0].replace("# 01 · ER 图", "").strip()
    rel = t.split("## 概念 ER 图")[1].split("## 物理模型")[0]
    rel = rel.replace("![概念 ER 图](er/er-concept.png)", "")
    img = lambda f, cap, h: (f'<div class="figure"><img src="{(DOCS / "er" / f).as_uri()}" style="max-height:{h}mm">'
                             f'<div class="cap">{cap}</div></div>')
    body = (
        "<h1>ER 图</h1>" + md_to_html(intro)
        + img("er-concept.png", "图 1　概念 ER 图（Chen 表示法：矩形＝实体，菱形＝联系，椭圆＝属性，带下划线为主键）", 112)
        + '<h2 class="pb">物理模型（鸦脚表示法）</h2>'
        + img("er-physical.png", "图 2　数据库物理模型：4 个集合的字段、主键 PK、外键 FK、唯一键 UK 与基数", 136)
        + '<h2 class="pb">实体与联系说明</h2>' + md_to_html(rel)
        + md_to_html("""| 实体 | 主键 | 主要属性 |
| --- | --- | --- |
| 管理员 | openid（微信身份） | 昵称、状态（已启用 / 待审核）、创建时间、最近登录 |
| 课程 | 课程 ID | 课程名称、备注、纬度、经度、地点名称、距离阈值（默认 50 米） |
| 学生 | 学号 | 姓名、班级 |
| 签到记录 | 记录 ID（课程 ID + 设备 ID） | 设备 ID、签到时间、签到经纬度、距离、来源、备注、是否删除 |

**唯一性约束：** 同一课程同一设备 ID 只能有一条签到记录；同一课程同一学号只能有一条签到记录；学号在学生表中唯一。""")
    )
    return page("文档一　ER 图", body, "A4 landscape")


def doc2() -> str:
    t = (DOCS / "02-数据库设计.md").read_text(encoding="utf-8")
    t = t.replace("# 02 · 数据库设计", "# 数据库表结构")
    t = t.replace("根据 [ER 图](01-ER图.md) 建 4 个集合。", "根据 ER 图建 4 个集合（表）。")
    return page("文档二　数据库表结构", md_to_html(t), "A4")


def doc3() -> str:
    t = (DOCS / "03-交互原型.md").read_text(encoding="utf-8")
    t = t.split("## 小程序实际界面")[0]
    t = t.replace("# 03 · 交互原型", "# 交互原型")
    t = re.sub(r"\*\*可点击原型：\*\*.*?\n", "**可点击原型：** 用浏览器打开随附的「03-交互原型（可点击）.html」（单文件，离线可用）。左边的手机可以直接操作；签到页右侧的「模拟定位」滑块可以改变与签到点的距离，看签到按钮从灰色变成黄色。\n", t, flags=re.S)
    t = t.replace("flowchart LR", "flowchart TB")
    html = md_to_html(t)
    html = html.replace('<p><img alt="界面流转图" src="prototype/flow.png" /></p>',
                        f'<div class="figure"><img src="{(DOCS / "prototype/flow.png").as_uri()}" style="max-height:192mm"><div class="cap">图 1　全部界面与跳转流转</div></div>')
    html = html.replace("<h2>页面结构与跳转逻辑</h2>", '<h2 class="pb">页面结构与跳转逻辑</h2>')
    fig = lambda k, t1, t2: (f'<figure><img src="{(DOCS / "prototype/screens" / f"{k}.png").as_uri()}">'
                             f'<figcaption>{t1}<span>{t2}</span></figcaption></figure>')
    first = "".join(fig(*x) for x in SCREENS[:10])
    rest = "".join(fig(*x) for x in SCREENS[10:])
    html += (f'<h2 class="pb">全部界面</h2><p>共 19 个界面。学生端 7 个，管理端 11 个，首页公共。</p>'
             f'<div class="screens">{first}</div><div class="screens pb">{rest}</div>')
    return page("文档三　交互原型", html, "A4")


def main(out: Path, mermaid_js: Path):
    out.mkdir(parents=True, exist_ok=True)
    jobs = [("01-ER图.pdf", doc1()), ("02-数据库表结构.pdf", doc2()), ("03-交互原型.pdf", doc3())]
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, html in jobs:
            tmp = out / f".{name}.html"
            tmp.write_text(html, encoding="utf-8")
            pg = b.new_page()
            pg.goto(tmp.as_uri())
            if "class=\"mermaid\"" in html:
                pg.add_script_tag(path=str(mermaid_js))
                pg.evaluate("""async () => {
                    mermaid.initialize({ startOnLoad: false, theme: 'base', flowchart: { useMaxWidth: true, htmlLabels: true },
                      themeVariables: { primaryColor: '#E9EFEC', primaryBorderColor: '#2F7D6D', primaryTextColor: '#13312E',
                        lineColor: '#2F7D6D', fontFamily: 'Noto Sans CJK SC', fontSize: '13px', clusterBkg: '#F4F8F6', clusterBorder: '#C9D8D2' } });
                    await mermaid.run({ querySelector: '.mermaid' });
                }""")
            pg.wait_for_timeout(600)
            pg.pdf(path=str(out / name), print_background=True, prefer_css_page_size=True,
                   display_header_footer=True, header_template="<span></span>",
                   footer_template="<div style='width:100%;text-align:center;font-size:8px;color:#7E958F'><span class='pageNumber'></span> / <span class='totalPages'></span></div>")
            pg.close()
            tmp.unlink()
        b.close()
    shutil.copy(DOCS / "prototype" / "index.html", out / "03-交互原型（可点击）.html")
    for f in sorted(out.iterdir()):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
