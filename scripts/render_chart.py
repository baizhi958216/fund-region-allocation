#!/usr/bin/env python3
import argparse
import csv
import html
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont


CATEGORIES = ["美国", "中国", "中国香港", "韩国", "日本", "其他", "现金及其他"]
WIDTH, HEIGHT = 1080, 1440


def font_path():
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]
    return next((path for path in candidates if pathlib.Path(path).exists()), None)


def load_font(size, index=0):
    path = font_path()
    return ImageFont.truetype(path, size=size, index=index) if path else ImageFont.load_default(size=size)


def display_pct(value):
    return f"{int(round(value))}%"


def svg_text(x, y, value, size, color, weight="400", anchor="start"):
    return f'<text x="{x}" y="{y}" font-family="PingFang SC,Noto Sans CJK SC,sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{html.escape(value)}</text>'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--style", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--reference-label", action="store_true", help="display residual as 现金")
    args = parser.parse_args()
    rows = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8"))
    style = json.loads(pathlib.Path(args.style).read_text(encoding="utf-8"))
    rows.sort(key=lambda row: row["allocation"]["美国"], reverse=True)
    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    bg = "#F7F2E7"
    ink = "#153B43"
    muted = "#52666B"
    image = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(image)
    title_font = load_font(45)
    subtitle_font = load_font(22)
    small_font = load_font(17)
    legend_font = load_font(17)
    label_font = load_font(20)
    pct_font = load_font(17)
    rank_font = load_font(17)

    period = rows[0]["period"]
    report_date = rows[0]["report_date"]
    draw.text((55, 42), f"{style['title']} | {period}", font=title_font, fill=ink)
    draw.text((57, 108), style["subtitle"] + "  |  数据来源：基金2026年第2季度报告", font=subtitle_font, fill="#344C52")
    draw.rounded_rectangle((56, 147, 292, 188), radius=8, fill="#E9E5D9")
    draw.text((72, 156), f"数据截止：{report_date}", font=small_font, fill=muted)

    legend_labels = ["现金" if args.reference_label and category == "现金及其他" else category for category in CATEGORIES]
    lx = 57
    for category, label in zip(CATEGORIES, legend_labels):
        draw.rounded_rectangle((lx, 207, lx + 20, 227), radius=3, fill=style["colors"][category])
        draw.text((lx + 27, 205), label, font=legend_font, fill="#344C52")
        lx += 27 + draw.textlength(label, font=legend_font) + 28

    chart_x, chart_w = 320, 700
    row_y, row_gap, bar_h = 260, 66, 42
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">', f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{bg}"/>']
    svg.append(svg_text(55, 82, f"{style['title']} | {period}", 45, ink, "700"))
    svg.append(svg_text(57, 128, style["subtitle"] + "  |  数据来源：基金2026年第2季度报告", 22, "#344C52"))
    svg.append('<rect x="56" y="147" width="236" height="41" rx="8" fill="#E9E5D9"/>')
    svg.append(svg_text(72, 177, f"数据截止：{report_date}", 17, muted))
    lx_svg = 57
    for category, label in zip(CATEGORIES, legend_labels):
        svg.append(f'<rect x="{lx_svg}" y="207" width="20" height="20" rx="3" fill="{style["colors"][category]}"/>')
        svg.append(svg_text(lx_svg + 27, 224, label, 17, "#344C52"))
        lx_svg += 27 + max(34, len(label) * 18) + 28

    for rank, row in enumerate(rows, 1):
        y = row_y + (rank - 1) * row_gap
        draw.rounded_rectangle((56, y + 5, 89, y + 38), radius=7, fill="#0B5667")
        rank_text = str(rank)
        box = draw.textbbox((0, 0), rank_text, font=rank_font)
        draw.text((72.5 - (box[2]-box[0])/2, y + 9), rank_text, font=rank_font, fill="white")
        draw.text((100, y + 8), row["short_name"], font=label_font, fill=ink)
        svg.append(f'<rect x="56" y="{y+5}" width="33" height="33" rx="7" fill="#0B5667"/>')
        svg.append(svg_text(72.5, y + 29, rank_text, 17, "white", "600", "middle"))
        svg.append(svg_text(100, y + 31, row["short_name"], 20, ink, "500"))

        x = chart_x
        for category in CATEGORIES:
            value = row["allocation"][category]
            segment_w = chart_w * value / 100
            x2 = x + segment_w
            draw.rectangle((round(x), y, round(x2), y + bar_h), fill=style["colors"][category])
            svg.append(f'<rect x="{x:.2f}" y="{y}" width="{segment_w:.2f}" height="{bar_h}" fill="{style["colors"][category]}"/>')
            if value >= 3.0:
                label = display_pct(value)
                color = ink if category == "现金及其他" else "white"
                bbox = draw.textbbox((0, 0), label, font=pct_font)
                tx = x + segment_w/2 - (bbox[2]-bbox[0])/2
                draw.text((tx, y + 10), label, font=pct_font, fill=color)
                svg.append(svg_text(x + segment_w/2, y + 28, label, 17, color, "600", "middle"))
            x = x2

    footnote = "注：地域占比取报告‘按国家（地区）分类’表；灰色为100%减去股票地域合计，包含现金及其他非股票项目。"
    draw.text((56, 1368), footnote, font=small_font, fill="#63757A")
    svg.append(svg_text(56, 1390, footnote, 17, "#63757A"))
    svg.append("</svg>")

    png = output_dir / f"fund-region-allocation-{period}.png"
    svg_path = output_dir / f"fund-region-allocation-{period}.svg"
    image.save(png, quality=95)
    svg_path.write_text("\n".join(svg), encoding="utf-8")

    csv_path = output_dir / f"fund-region-allocation-{period}.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["rank", "fund_code", "fund_name", *CATEGORIES, "report_date", "source_page", "pdf_url"])
        for rank, row in enumerate(rows, 1):
            writer.writerow([rank, row["code"], row["short_name"], *[row["allocation"][c] for c in CATEGORIES], row["report_date"], row["source_page"], row["pdf_url"]])

    evidence = output_dir / f"fund-region-allocation-{period}-evidence.json"
    evidence.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(png))


if __name__ == "__main__":
    main()
