# -*- coding: utf-8 -*-
"""Generate the 6-table ER diagram (SVG + PNG preview).

Run with the bundled Python:
    python tools/generate_er.py
"""

import math
import os
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG_PATH = os.path.join(ROOT, "docs", "er-diagram.svg")
PNG_PATH = os.path.join(ROOT, "docs", "er-diagram-preview.png")

W, H = 1200, 920
HEADER_H = 38
ROW_H = 24

BADGE_COLORS = {
    "PK": "#B03A2E",
    "FK": "#1F618D",
    "UK": "#6C3483",
}

ENTITIES = [
    {
        "key": "courses",
        "title": "课程 courses",
        "x": 60, "y": 80, "w": 280, "h": 200,
        "rows": [
            ("PK", "id"),
            ("UK", "course_code"),
            ("", "course_name"),
            ("", "status"),
        ],
    },
    {
        "key": "course_sections",
        "title": "教学班 course_sections",
        "x": 420, "y": 80, "w": 300, "h": 260,
        "rows": [
            ("PK", "id"),
            ("FK", "course_id"),
            ("UK", "section_code"),
            ("", "section_name"),
            ("FK", "teacher_id"),
            ("FK", "created_by"),
            ("", "status"),
        ],
    },
    {
        "key": "class_sessions",
        "title": "一次课 class_sessions",
        "x": 800, "y": 80, "w": 340, "h": 340,
        "rows": [
            ("PK", "id"),
            ("FK", "section_id"),
            ("", "class_date"),
            ("", "period_start / period_end"),
            ("", "start_time / end_time"),
            ("", "classroom"),
            ("", "latitude / longitude"),
            ("", "distance_limit"),
            ("", "class_status / checkin_status"),
            ("FK", "created_by"),
        ],
    },
    {
        "key": "users",
        "title": "用户 users",
        "x": 60, "y": 400, "w": 300, "h": 320,
        "rows": [
            ("PK", "id"),
            ("", "role 学生/教师/管理员"),
            ("UK", "openid"),
            ("UK", "student_no"),
            ("", "name / class_name"),
            ("", "phone / email"),
            ("", "password_hash"),
            ("", "status"),
        ],
    },
    {
        "key": "student_section_assignments",
        "title": "学生-教学班 assignments",
        "x": 420, "y": 400, "w": 300, "h": 260,
        "rows": [
            ("PK", "id"),
            ("FK", "student_id"),
            ("FK", "course_id"),
            ("FK", "section_id"),
            ("", "status"),
            ("FK", "created_by"),
        ],
    },
    {
        "key": "checkins",
        "title": "签到记录 checkins",
        "x": 800, "y": 540, "w": 340, "h": 300,
        "rows": [
            ("PK", "id"),
            ("FK", "session_id"),
            ("FK", "student_id"),
            ("", "student_no / name 快照"),
            ("", "latitude / longitude"),
            ("", "accuracy / distance"),
            ("", "status / checked_in_at"),
        ],
    },
]

RELATIONS = [
    {
        "a": "courses", "b": "course_sections", "label": "设置",
        "a_pt": (340, 180), "b_pt": (420, 220), "lo": (0, -13),
        "card": ("1", "N"),
    },
    {
        "a": "users", "b": "course_sections", "label": "授课",
        "a_pt": (360, 440), "b_pt": (420, 300), "lo": (0, -12),
        "card": ("1", "N"),
    },
    {
        "a": "course_sections", "b": "class_sessions", "label": "安排",
        "a_pt": (720, 220), "b_pt": (800, 220), "lo": (0, -13),
        "card": ("1", "N"),
    },
    {
        "a": "users", "b": "student_section_assignments", "label": "选修",
        "a_pt": (360, 560), "b_pt": (420, 560), "lo": (0, -12),
        "card": ("1", "N"),
    },
    {
        "a": "course_sections", "b": "student_section_assignments", "label": "分配",
        "a_pt": (570, 340), "b_pt": (570, 400), "lo": (-14, 0),
        "card": ("1", "N"),
    },
    {
        "a": "class_sessions", "b": "checkins", "label": "产生",
        "a_pt": (970, 420), "b_pt": (970, 540), "lo": (14, 0),
        "card": ("1", "N"),
    },
    {
        "a": "users", "b": "checkins", "label": "提交",
        "a_pt": (360, 680), "b_pt": (800, 680), "lo": (0, 15),
        "card": ("1", "N"),
    },
]

FONT_CANDIDATES = [
    (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc"),
    (r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simhei.ttf"),
    (r"C:\Windows\Fonts\simsun.ttc", r"C:\Windows\Fonts\simsun.ttc"),
]


def load_fonts():
    for regular, bold in FONT_CANDIDATES:
        if os.path.exists(regular):
            if not os.path.exists(bold):
                bold = regular
            return regular, bold
    raise SystemExit("No Chinese font found.")


def unit(p, q):
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy) or 1.0
    return dx / length, dy / length


def crow_foot(p, q, size=13, spread=6):
    ux, uy = unit(p, q)
    px, py = -uy, ux
    base = (p[0] - ux * size, p[1] - uy * size)
    return [
        (base[0], base[1], p[0], p[1]),
        (base[0], base[1], p[0] + px * spread, p[1] + py * spread),
        (base[0], base[1], p[0] - px * spread, p[1] - py * spread),
    ]


def tick(p, q, back=9, length=11):
    ux, uy = unit(p, q)
    px, py = -uy, ux
    cx, cy = p[0] - ux * back, p[1] - uy * back
    return (cx - px * length, cy - py * length, cx + px * length, cy + py * length)


def point_at(p, q, dist):
    ux, uy = unit(p, q)
    return p[0] + ux * dist, p[1] + uy * dist


def svg_entity(e):
    x, y, w, h = e["x"], e["y"], e["w"], e["h"]
    out = [f'<g id="entity-{e["key"]}">']
    out.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
        f'fill="#FFFFFF" stroke="#344454" stroke-width="1.6"/>'
    )
    out.append(
        f'<path d="M {x + 8} {y} H {x + w - 8} Q {x + w} {y} {x + w} {y + 8} '
        f'V {y + HEADER_H} H {x} V {y + 8} Q {x} {y} {x + 8} {y} Z" '
        f'fill="#EAF2FA" stroke="#344454" stroke-width="1.6"/>'
    )
    out.append(
        f'<text x="{x + w / 2}" y="{y + 25}" text-anchor="middle" '
        f'font-size="15" font-weight="bold" fill="#17324D">{escape(e["title"])}</text>'
    )
    ry = y + HEADER_H + 20
    for badge, text in e["rows"]:
        if badge:
            out.append(
                f'<text x="{x + 12}" y="{ry}" font-size="10" font-weight="bold" '
                f'fill="{BADGE_COLORS[badge]}">{badge}</text>'
            )
        out.append(
            f'<text x="{x + 48}" y="{ry}" font-size="12" fill="#273746">{escape(text)}</text>'
        )
        ry += ROW_H
    out.append("</g>")
    return "\n".join(out)


def svg_relation(r):
    ax, ay = r["a_pt"]
    bx, by = r["b_pt"]
    out = ['<g class="relation">']
    out.append(
        f'<line x1="{ax}" y1="{ay}" x2="{bx}" y2="{by}" '
        f'stroke="#657587" stroke-width="1.6"/>'
    )

    x1, y1, x2, y2 = tick((ax, ay), (bx, by))
    out.append(
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="#657587" stroke-width="1.6"/>'
    )
    if r["card"][1] == "N":
        for x1, y1, x2, y2 in crow_foot((bx, by), (ax, ay)):
            out.append(
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                f'stroke="#657587" stroke-width="1.6"/>'
            )
    else:
        x1, y1, x2, y2 = tick((bx, by), (ax, ay))
        out.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="#657587" stroke-width="1.6"/>'
        )

    ca = point_at((ax, ay), (bx, by), 20)
    cb = point_at((bx, by), (ax, ay), 20)
    out.append(
        f'<text x="{ca[0]}" y="{ca[1]}" text-anchor="middle" '
        f'font-size="12" font-weight="bold" fill="#1C3045" '
        f'paint-order="stroke" stroke="#FFFFFF" stroke-width="4">{r["card"][0]}</text>'
    )
    out.append(
        f'<text x="{cb[0]}" y="{cb[1]}" text-anchor="middle" '
        f'font-size="12" font-weight="bold" fill="#1C3045" '
        f'paint-order="stroke" stroke="#FFFFFF" stroke-width="4">{r["card"][1]}</text>'
    )

    mx = (ax + bx) / 2 + r["lo"][0]
    my = (ay + by) / 2 + r["lo"][1]
    out.append(
        f'<text x="{mx}" y="{my}" text-anchor="middle" font-size="12" '
        f'fill="#1C3045" paint-order="stroke" stroke="#FFFFFF" '
        f'stroke-width="4" stroke-linejoin="round">{escape(r["label"])}</text>'
    )
    out.append("</g>")
    return "\n".join(out)


def build_svg():
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#FFFFFF"/>',
        '<g id="title" font-family="Microsoft YaHei, Segoe UI, sans-serif">',
        f'<text x="60" y="40" font-size="26" font-weight="bold" fill="#17324D">'
        f'微信定位签到系统 ER 图（6 表版）</text>',
        f'<text x="60" y="64" font-size="14" fill="#4A5B6B">'
        f'课程 → 教学班 → 一次课 → 签到记录；学生与教学班用中间表关联</text>',
        "</g>",
        '<g id="relations" font-family="Microsoft YaHei, Segoe UI, sans-serif">',
    ]
    for r in RELATIONS:
        parts.append(svg_relation(r))
    parts.append("</g>")
    parts.append('<g id="entities" font-family="Microsoft YaHei, Segoe UI, sans-serif">')
    for e in ENTITIES:
        parts.append(svg_entity(e))
    parts.append("</g>")
    parts.append(
        '<g id="legend" font-family="Microsoft YaHei, Segoe UI, sans-serif">'
        f'<text x="60" y="860" font-size="11" fill="#4A5B6B">'
        f'PK 主键    FK 外键    UK 唯一键    1 : N 一对多</text>'
        f'<text x="60" y="878" font-size="11" fill="#4A5B6B">'
        f'主表：users、courses、course_sections、class_sessions、checkins；'
        f'中间表：student_section_assignments</text>'
        f'<text x="60" y="896" font-size="11" fill="#7A6A55">'
        f'注：created_by 字段均引用 users(id)，图中从略；'
        f'checkin_status 由教师手动开启/关闭。</text>'
        "</g>"
    )
    parts.append("</svg>")
    return "\n".join(parts)


def build_png():
    regular, bold = load_fonts()
    font_title = ImageFont.truetype(bold, 26)
    font_subtitle = ImageFont.truetype(regular, 14)
    font_entity = ImageFont.truetype(bold, 15)
    font_row = ImageFont.truetype(regular, 12)
    font_badge = ImageFont.truetype(bold, 10)
    font_rel = ImageFont.truetype(regular, 12)
    font_card = ImageFont.truetype(bold, 12)
    font_legend = ImageFont.truetype(regular, 11)

    img = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)

    draw.text((60, 18), "微信定位签到系统 ER 图（6 表版）", font=font_title, fill="#17324D")
    draw.text(
        (60, 52),
        "课程 → 教学班 → 一次课 → 签到记录；学生与教学班用中间表关联",
        font=font_subtitle,
        fill="#4A5B6B",
    )

    for r in RELATIONS:
        ax, ay = r["a_pt"]
        bx, by = r["b_pt"]
        draw.line((ax, ay, bx, by), fill="#657587", width=2)
        x1, y1, x2, y2 = tick((ax, ay), (bx, by))
        draw.line((x1, y1, x2, y2), fill="#657587", width=2)
        if r["card"][1] == "N":
            for x1, y1, x2, y2 in crow_foot((bx, by), (ax, ay)):
                draw.line((x1, y1, x2, y2), fill="#657587", width=2)
        else:
            x1, y1, x2, y2 = tick((bx, by), (ax, ay))
            draw.line((x1, y1, x2, y2), fill="#657587", width=2)

        ca = point_at((ax, ay), (bx, by), 20)
        cb = point_at((bx, by), (ax, ay), 20)
        draw.text(ca, r["card"][0], font=font_card, fill="#1C3045", anchor="mm",
                  stroke_width=3, stroke_fill="white")
        draw.text(cb, r["card"][1], font=font_card, fill="#1C3045", anchor="mm",
                  stroke_width=3, stroke_fill="white")

        mx = (ax + bx) / 2 + r["lo"][0]
        my = (ay + by) / 2 + r["lo"][1]
        draw.text((mx, my), r["label"], font=font_rel, fill="#1C3045", anchor="mm",
                  stroke_width=3, stroke_fill="white")

    for e in ENTITIES:
        x, y, w, h = e["x"], e["y"], e["w"], e["h"]
        draw.rounded_rectangle(
            (x, y, x + w, y + h), radius=8, fill="white", outline="#344454", width=2
        )
        draw.rounded_rectangle(
            (x, y, x + w, y + HEADER_H), radius=8, fill="#EAF2FA", outline="#344454",
            width=2, corners=(True, True, False, False)
        )
        draw.line((x, y + HEADER_H, x + w, y + HEADER_H), fill="#344454", width=2)
        draw.text((x + w / 2, y + 19), e["title"], font=font_entity, fill="#17324D",
                  anchor="mm")

        ry = y + HEADER_H + 20
        for badge, text in e["rows"]:
            if badge:
                draw.text((x + 12, ry), badge, font=font_badge,
                          fill=BADGE_COLORS[badge], anchor="lm")
            draw.text((x + 48, ry), text, font=font_row, fill="#273746", anchor="lm")
            width = draw.textlength(text, font=font_row)
            if x + 48 + width > x + w - 8:
                print(f"WARN row too wide: {e['key']} / {text}")
            ry += ROW_H

    draw.text(
        (60, 854),
        "PK 主键    FK 外键    UK 唯一键    1 : N 一对多",
        font=font_legend,
        fill="#4A5B6B",
    )
    draw.text(
        (60, 872),
        "主表：users、courses、course_sections、class_sessions、checkins；"
        "中间表：student_section_assignments",
        font=font_legend,
        fill="#4A5B6B",
    )
    draw.text(
        (60, 890),
        "注：created_by 字段均引用 users(id)，图中从略；checkin_status 由教师手动开启/关闭。",
        font=font_legend,
        fill="#7A6A55",
    )

    img.save(PNG_PATH, "PNG")


def main():
    with open(SVG_PATH, "w", encoding="utf-8") as f:
        f.write(build_svg())
    build_png()
    print("wrote", SVG_PATH)
    print("wrote", PNG_PATH)


if __name__ == "__main__":
    main()
