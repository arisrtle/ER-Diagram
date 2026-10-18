"""
生成 ER 图（SVG），供 docs/ 使用。

    python3 scripts/build_er.py

输出：
    docs/er/er-concept.svg   概念 ER 图（Chen 表示法：矩形实体、菱形联系、椭圆属性）
    docs/er/er-physical.svg  物理模型图（鸦脚表示法：集合、字段、主外键与基数）
"""
from pathlib import Path
from html import escape
import math

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "er"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "'Noto Sans SC','Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif"
DISPLAY = "'Smiley Sans','Noto Sans SC','Noto Sans CJK SC','PingFang SC',sans-serif"

C = {
    "bg": "#E9EFEC",
    "paper": "#F7FAF8",
    "ink": "#13312E",
    "ink2": "#48625E",
    "line": "#7FA59A",
    "celadon": "#2F7D6D",
    "deep": "#1F5A4F",
    "gold": "#F2B705",
    "goldsoft": "#FBE7A6",
    "golddeep": "#8A6700",
    "rouge": "#D9415B",
}


# ---------------------------------------------------------------- 概念 ER 图
def concept():
    W, H = 1560, 1090
    entities = {
        "admin": ("管理员", 250, 470),
        "course": ("课程", 800, 250),
        "record": ("签到记录", 800, 700),
        "student": ("学生", 1330, 700),
    }
    rels = {
        "create": ("创建", 525, 360, "admin", "course", "1", "N"),
        "maintain": ("维护", 525, 585, "admin", "record", "1", "N"),
        "contain": ("包含", 800, 475, "course", "record", "1", "N"),
        "submit": ("提交", 1065, 700, "student", "record", "1", "N"),
    }
    # (实体, 文字, x, y, 是否主键)
    attrs = [
        ("admin", "openid", 100, 360, True),
        ("admin", "昵称", 78, 475, False),
        ("admin", "状态", 105, 590, False),
        ("admin", "创建时间", 255, 335, False),
        ("admin", "最近登录", 255, 610, False),
        ("course", "课程ID", 600, 140, True),
        ("course", "课程名称", 735, 70, False),
        ("course", "纬度", 885, 70, False),
        ("course", "经度", 1020, 135, False),
        ("course", "距离阈值", 1065, 240, False),
        ("course", "地点名称", 1045, 345, False),
        ("course", "备注", 575, 245, False),
        ("record", "记录ID", 545, 700, True),
        ("record", "是否删除", 680, 590, False),
        ("record", "设备ID", 585, 870, False),
        ("record", "签到时间", 700, 975, False),
        ("record", "距离", 850, 1002, False),
        ("record", "签到经纬度", 1005, 950, False),
        ("record", "来源", 1092, 835, False),
        ("record", "备注", 1240, 822, False),
        ("student", "学号", 1300, 565, True),
        ("student", "姓名", 1475, 625, False),
        ("student", "班级", 1470, 800, False),
    ]

    parts = []
    # 连线（先画，图形会盖住线头）
    for ent, label, x, y, pk in attrs:
        _, ex, ey = entities[ent]
        parts.append(f'<line x1="{ex}" y1="{ey}" x2="{x}" y2="{y}" stroke="{C["line"]}" stroke-width="1.4"/>')
    for key, (label, rx, ry, a, b, ca, cb) in rels.items():
        for ent, card in ((a, ca), (b, cb)):
            _, ex, ey = entities[ent]
            parts.append(f'<line x1="{ex}" y1="{ey}" x2="{rx}" y2="{ry}" stroke="{C["ink"]}" stroke-width="2.2"/>')
            # 基数标在线段靠近实体的 38% 处，稍微偏离线
            t = 0.42
            mx, my = ex + (rx - ex) * t, ey + (ry - ey) * t
            dx, dy = rx - ex, ry - ey
            n = math.hypot(dx, dy) or 1
            ox, oy = -dy / n * 16, dx / n * 16
            parts.append(
                f'<text x="{mx + ox:.1f}" y="{my + oy + 6:.1f}" text-anchor="middle" font-family="{DISPLAY}" '
                f'font-size="22" fill="{C["rouge"]}">{card}</text>'
            )

    for ent, label, x, y, pk in attrs:
        rx = max(46, 14 * len(label) + 22) if not label.isascii() else max(46, 8 * len(label) + 26)
        stroke = C["celadon"] if pk else C["line"]
        sw = 2.2 if pk else 1.3
        parts.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="23" fill="{C["paper"]}" stroke="{stroke}" stroke-width="{sw}"/>')
        deco = ' text-decoration="underline"' if pk else ""
        weight = "700" if pk else "400"
        parts.append(
            f'<text x="{x}" y="{y + 5.5}" text-anchor="middle" font-family="{FONT}" font-size="15" '
            f'font-weight="{weight}" fill="{C["ink"]}"{deco}>{escape(label)}</text>'
        )
        if pk:  # 下划线兜底（部分渲染器不支持 text-decoration）
            tw = (8.6 if label.isascii() else 15) * len(label)
            parts.append(f'<line x1="{x - tw / 2}" y1="{y + 9}" x2="{x + tw / 2}" y2="{y + 9}" stroke="{C["ink"]}" stroke-width="1.2"/>')

    for key, (label, rx, ry, *_rest) in rels.items():
        w, h = 64, 38
        pts = f"{rx},{ry - h} {rx + w},{ry} {rx},{ry + h} {rx - w},{ry}"
        parts.append(f'<polygon points="{pts}" fill="{C["goldsoft"]}" stroke="{C["golddeep"]}" stroke-width="2"/>')
        parts.append(
            f'<text x="{rx}" y="{ry + 6}" text-anchor="middle" font-family="{FONT}" font-size="17" '
            f'font-weight="700" fill="{C["golddeep"]}">{label}</text>'
        )

    for key, (label, x, y) in entities.items():
        w = 40 + 22 * len(label)
        parts.append(f'<rect x="{x - w / 2}" y="{y - 29}" width="{w}" height="58" rx="6" fill="{C["celadon"]}"/>')
        parts.append(
            f'<text x="{x}" y="{y + 8}" text-anchor="middle" font-family="{FONT}" font-size="21" '
            f'font-weight="700" fill="#FFFFFF">{label}</text>'
        )

    # 标题与图例
    head = (
        f'<text x="40" y="58" font-family="{DISPLAY}" font-size="34" fill="{C["ink"]}">课堂签到 · 概念 ER 图</text>'
        f'<text x="40" y="88" font-family="{FONT}" font-size="15" fill="{C["ink2"]}">Chen 表示法　矩形＝实体　菱形＝联系　椭圆＝属性（加粗下划线为主键）　红字＝基数</text>'
    )
    note = (
        f'<text x="40" y="1060" font-family="{FONT}" font-size="14.5" fill="{C["ink2"]}">'
        "约束：一门课程只有一个签到点位（纬度、经度、距离阈值为课程属性）；同一课程同一设备ID只能有一条签到记录；同一课程同一学号只能有一条签到记录。</text>"
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        f'<rect width="{W}" height="{H}" fill="{C["bg"]}"/>{head}{"".join(parts)}{note}</svg>'
    )
    (OUT / "er-concept.svg").write_text(svg, encoding="utf-8")


# ---------------------------------------------------------------- 物理模型图
TABLES = {
    "admins": {
        "title": "admins 管理员",
        "pos": (50, 150),
        "fields": [
            ("PK", "_id", "string", "微信 OPENID"),
            ("", "nickname", "string", "昵称"),
            ("", "status", "string", "active / pending"),
            ("", "createdAt", "date", "创建时间"),
            ("", "lastLoginAt", "date", "最近登录"),
            ("", "approvedAt", "date", "审核通过时间"),
        ],
    },
    "courses": {
        "title": "courses 课程（含签到点位）",
        "pos": (650, 120),
        "fields": [
            ("PK", "_id", "string", "课程 ID"),
            ("", "name", "string", "课程名称"),
            ("", "note", "string", "备注"),
            ("", "latitude", "number", "点位纬度 gcj02"),
            ("", "longitude", "number", "点位经度 gcj02"),
            ("", "address", "string", "地点名称"),
            ("", "radius", "number", "距离阈值(米) 默认 50"),
            ("FK", "createdBy", "string", "→ admins._id"),
            ("", "createdAt", "date", "创建时间"),
            ("", "updatedAt", "date", "更新时间"),
        ],
    },
    "checkins": {
        "title": "checkins 签到记录",
        "pos": (650, 540),
        "fields": [
            ("PK", "_id", "string", "课程ID_设备ID"),
            ("FK", "courseId", "string", "→ courses._id"),
            ("FK", "studentNo", "string", "→ students._id"),
            ("", "name", "string", "姓名快照"),
            ("", "className", "string", "班级快照"),
            ("UK", "deviceId", "string", "设备 ID"),
            ("", "openid", "string", "微信指纹(防代签)"),
            ("", "latitude", "number", "签到纬度"),
            ("", "longitude", "number", "签到经度"),
            ("", "accuracy", "number", "定位精度(米)"),
            ("", "distance", "number", "距点位(米)"),
            ("", "radius", "number", "当时的阈值"),
            ("", "checkedAt", "date", "签到时间"),
            ("", "source", "string", "student / admin"),
            ("", "remark", "string", "备注"),
            ("", "deleted", "bool", "软删除标记"),
            ("FK", "updatedBy", "string", "→ admins._id"),
        ],
    },
    "students": {
        "title": "students 学生",
        "pos": (1200, 560),
        "fields": [
            ("PK", "_id", "string", "学号"),
            ("", "name", "string", "姓名"),
            ("", "className", "string", "班级"),
            ("", "updatedAt", "date", "最近导入时间"),
        ],
    },
}
TW, RH, HH = 420, 30, 46  # 表宽、行高、表头高


def table_box(key):
    x, y = TABLES[key]["pos"]
    h = HH + RH * len(TABLES[key]["fields"]) + 8
    return x, y, TW, h


def field_y(key, name):
    x, y = TABLES[key]["pos"]
    for i, f in enumerate(TABLES[key]["fields"]):
        if f[1] == name:
            return y + HH + RH * i + RH / 2 + 4
    raise KeyError(name)


def one_mark(x, y, d):
    """「一」端：两道短竖线。d=+1 表示线从右侧进入。"""
    return "".join(
        f'<line x1="{x + d * o}" y1="{y - 9}" x2="{x + d * o}" y2="{y + 9}" stroke="{C["ink"]}" stroke-width="2"/>'
        for o in (10, 16)
    )


def many_mark(x, y, d):
    """「多」端：鸦脚 + 圆圈（0..N）。d=+1 表示线从右侧进入。"""
    tip = x + d * 18
    s = (
        f'<line x1="{tip}" y1="{y}" x2="{x}" y2="{y - 10}" stroke="{C["ink"]}" stroke-width="2"/>'
        f'<line x1="{tip}" y1="{y}" x2="{x}" y2="{y + 10}" stroke="{C["ink"]}" stroke-width="2"/>'
        f'<line x1="{tip}" y1="{y}" x2="{x}" y2="{y}" stroke="{C["ink"]}" stroke-width="2"/>'
        f'<circle cx="{x + d * 26}" cy="{y}" r="6" fill="{C["bg"]}" stroke="{C["ink"]}" stroke-width="2"/>'
    )
    return s


def physical():
    W, H = 1680, 1160
    parts = []

    # 关系连线（正交折线）
    def connect(pk_tab, pk_field, fk_tab, fk_field, label, dashed=False, via_x=None, label_at=None, anchor="start"):
        px, py, pw, ph = table_box(pk_tab)
        fx, fy, fw, fh = table_box(fk_tab)
        y1 = field_y(pk_tab, pk_field)
        y2 = field_y(fk_tab, fk_field)
        # 从父表右侧/左侧出，到子表左/右侧
        if px + pw <= fx:  # 父在左
            x1, x2, d1, d2 = px + pw, fx, 1, -1
        else:  # 父在右
            x1, x2, d1, d2 = px, fx + fw, -1, 1
        mid = via_x if via_x is not None else (x1 + x2) / 2
        dash = ' stroke-dasharray="7 6"' if dashed else ""
        parts.append(
            f'<polyline points="{x1},{y1} {mid},{y1} {mid},{y2} {x2},{y2}" fill="none" '
            f'stroke="{C["ink"]}" stroke-width="2"{dash}/>'
        )
        # 「一」在父端：标记画在线段内侧（朝向连线方向）
        parts.append(one_mark(x1, y1, d1))
        parts.append(many_mark(x2, y2, d2))
        lx, ly = label_at if label_at else (mid + 10, (y1 + y2) / 2)
        parts.append(
            f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" font-family="{FONT}" font-size="14" fill="{C["golddeep"]}" '
            f'font-weight="700">{label}</text>'
        )

    connect("admins", "_id", "courses", "createdBy", "创建 1:N", via_x=600, label_at=(590, 360), anchor="end")
    connect("admins", "_id", "checkins", "updatedBy", "维护 1:N", dashed=True, via_x=540, label_at=(530, 900), anchor="end")
    connect("students", "_id", "checkins", "studentNo", "提交 1:N", via_x=1150, label_at=(1150, 560), anchor="middle")

    # 课程 → 签到：纵向，从 courses 底部到 checkins 顶部（只有一个表头间距，单独画）
    cx, cy, cw, ch = table_box("courses")
    kx, ky, kw, kh = table_box("checkins")
    xr = cx + cw + 36
    y1 = field_y("courses", "_id")
    y2 = field_y("checkins", "courseId")
    parts.append(
        f'<polyline points="{cx + cw},{y1} {xr},{y1} {xr},{y2} {kx + kw},{y2}" fill="none" stroke="{C["ink"]}" stroke-width="2"/>'
    )
    parts.append(one_mark(cx + cw, y1, 1))
    parts.append(many_mark(kx + kw, y2, 1))
    parts.append(
        f'<text x="{xr + 10}" y="{(y1 + y2) / 2}" font-family="{FONT}" font-size="14" fill="{C["golddeep"]}" font-weight="700">包含 1:N</text>'
    )

    for key, t in TABLES.items():
        x, y, w, h = table_box(key)
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{C["paper"]}" stroke="{C["line"]}" stroke-width="1.4"/>')
        parts.append(f'<path d="M{x} {y + 14} a14 14 0 0 1 14 -14 h{w - 28} a14 14 0 0 1 14 14 v{HH - 14} h-{w} z" fill="{C["celadon"]}"/>')
        parts.append(
            f'<text x="{x + 18}" y="{y + 30}" font-family="{FONT}" font-size="18" font-weight="700" fill="#fff">{escape(t["title"])}</text>'
        )
        for i, (flag, name, typ, desc) in enumerate(t["fields"]):
            ry = y + HH + RH * i
            if i % 2 == 1:
                parts.append(f'<rect x="{x + 1}" y="{ry}" width="{w - 2}" height="{RH}" fill="#EEF4F1"/>')
            ty = ry + RH / 2 + 5
            if flag:
                col = {"PK": C["golddeep"], "FK": C["celadon"], "UK": C["rouge"]}[flag]
                parts.append(
                    f'<text x="{x + 16}" y="{ty}" font-family="{FONT}" font-size="12.5" font-weight="700" fill="{col}">{flag}</text>'
                )
            weight = "700" if flag == "PK" else "500"
            parts.append(
                f'<text x="{x + 50}" y="{ty}" font-family="{FONT}" font-size="15" font-weight="{weight}" fill="{C["ink"]}">{name}</text>'
            )
            parts.append(
                f'<text x="{x + 182}" y="{ty}" font-family="{FONT}" font-size="13" fill="{C["ink2"]}">{typ}</text>'
            )
            parts.append(
                f'<text x="{x + 250}" y="{ty}" font-family="{FONT}" font-size="13.5" fill="{C["ink2"]}">{escape(desc)}</text>'
            )

    head = (
        f'<text x="50" y="62" font-family="{DISPLAY}" font-size="34" fill="{C["ink"]}">课堂签到 · 数据库物理模型</text>'
        f'<text x="50" y="94" font-family="{FONT}" font-size="15" fill="{C["ink2"]}">微信云开发数据库（文档型）4 个集合　鸦脚表示法：‖ 为「一」，○＜ 为「零或多」　虚线＝弱关联（审计字段）</text>'
    )
    # 约束说明（放在左下空白处）
    notes = [
        ["checkins._id ＝ 课程ID_设备ID", "同一课程同一设备只能写入一条，由主键保证，并发安全"],
        ["checkins (courseId, studentNo) 唯一索引", "同一课程同一学号只能有一条记录"],
        ["students._id ＝ 学号", "重复导入即覆盖更新，学号天然唯一"],
        ["admins._id ＝ 微信 OPENID", "由云函数上下文提供，前端无法伪造"],
        ["checkins.deleted 软删除", "删除后仍然占位，防止删除后再次签到"],
    ]
    nx, ny = 50, 500
    parts.append(f'<text x="{nx}" y="{ny}" font-family="{DISPLAY}" font-size="24" fill="{C["ink"]}">唯一性与一致性约束</text>')
    for i, (k, d) in enumerate(notes):
        y = ny + 44 + i * 62
        parts.append(f'<circle cx="{nx + 5}" cy="{y - 5}" r="4" fill="{C["gold"]}"/>')
        parts.append(f'<text x="{nx + 18}" y="{y}" font-family="{FONT}" font-size="15" font-weight="700" fill="{C["ink"]}">{escape(k)}</text>')
        parts.append(f'<text x="{nx + 18}" y="{y + 24}" font-family="{FONT}" font-size="14" fill="{C["ink2"]}">{escape(d)}</text>')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        f'<rect width="{W}" height="{H}" fill="{C["bg"]}"/>{head}{"".join(parts)}</svg>'
    )
    (OUT / "er-physical.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    concept()
    physical()
    print("written:", *(p.name for p in OUT.glob("*.svg")))
