# -*- coding: utf-8 -*-
"""Generate a QR poster for a public demo URL.

Usage:
    python tools/generate_qr.py <url> <output.png> [--title 扫码签到] [--subtitle ...]
"""

import argparse
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc"),
    (r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simhei.ttf"),
    (r"C:\Windows\Fonts\simsun.ttc", r"C:\Windows\Fonts\simsun.ttc"),
]


def load_fonts():
    for regular, bold in FONT_CANDIDATES:
        if Path(regular).exists():
            if not Path(bold).exists():
                bold = regular
            return regular, bold
    raise SystemExit("No Chinese font found.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output")
    parser.add_argument("--title", default="扫码签到")
    parser.add_argument("--subtitle", default="微信 / 浏览器扫码进入学生端")
    args = parser.parse_args()

    regular, bold = load_fonts()
    font_title = ImageFont.truetype(bold, 40)
    font_sub = ImageFont.truetype(regular, 22)
    font_url = ImageFont.truetype(regular, 14)
    font_footer = ImageFont.truetype(regular, 18)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(args.url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#14213a", back_color="white").convert("RGB")

    width, height = 640, 790
    poster = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(poster)

    # 顶部浅蓝背景
    draw.rectangle((0, 0, width, 96), fill="#f2f7ff")
    draw.text((width / 2, 48), args.title, font=font_title, fill="#14213a", anchor="mm")

    qr_size = 460
    qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.NEAREST)
    qr_x = (width - qr_size) // 2
    qr_y = 128
    poster.paste(qr_img, (qr_x, qr_y))

    draw.text(
        (width / 2, qr_y + qr_size + 34),
        args.subtitle,
        font=font_sub,
        fill="#4b5a70",
        anchor="mm",
    )
    draw.text(
        (width / 2, qr_y + qr_size + 74),
        args.url,
        font=font_url,
        fill="#8d99ad",
        anchor="mm",
    )
    draw.text(
        (width / 2, height - 34),
        "定位签到系统",
        font=font_footer,
        fill="#1f66e0",
        anchor="mm",
    )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    poster.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
