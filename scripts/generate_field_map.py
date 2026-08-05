"""Generate the checked-in coordinate map from the official PDF's vector boxes.

This is a development utility only. The React app reads the generated static JSON
and performs no runtime field detection.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pdfplumber
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "public" / "forms" / "sbi-home-loan-application.pdf"
IMAGE_DIR = ROOT / "tmp" / "pdfs" / "pages"
OUTPUT_PATH = ROOT / "src" / "fieldMap.json"


def dark_ratio(image: Image.Image, rect: dict, page_width: float, page_height: float) -> float:
    scale_x = image.width / page_width
    scale_y = image.height / page_height
    inset = 2
    left = int(rect["x0"] * scale_x) + inset
    right = int(rect["x1"] * scale_x) - inset
    top = int(rect["top"] * scale_y) + inset
    bottom = int(rect["bottom"] * scale_y) - inset
    if right <= left or bottom <= top:
        return 0
    pixels = image.crop((left, top, right, bottom)).convert("L")
    histogram = pixels.histogram()
    dark = sum(histogram[:145])
    return dark / max(1, pixels.width * pixels.height)


def normalized(rect: dict) -> dict:
    return {
        "x": round(rect["x0"], 2),
        "y": round(rect["top"], 2),
        "width": round(rect["x1"] - rect["x0"], 2),
        "height": round(rect["bottom"] - rect["top"], 2),
    }


def contains_children(rect: dict, small_rects: list[dict]) -> bool:
    return any(
        rect["x0"] - .5 <= child["x0"]
        and rect["x1"] + .5 >= child["x1"]
        and rect["top"] - .5 <= child["top"]
        and rect["bottom"] + .5 >= child["bottom"]
        and (rect["width"] > child["width"] + 3 or rect["height"] > child["height"] + 3)
        for child in small_rects
    )


def group_small_boxes(rects: list[dict]) -> tuple[list[list[dict]], list[dict]]:
    rows: dict[int, list[dict]] = defaultdict(list)
    for rect in rects:
        rows[round(rect["top"] * 2)].append(rect)

    groups: list[list[dict]] = []
    singles: list[dict] = []
    for row in rows.values():
        row.sort(key=lambda item: item["x0"])
        current = [row[0]]
        for rect in row[1:]:
            previous = current[-1]
            gap = rect["x0"] - previous["x1"]
            same_height = abs(rect["height"] - previous["height"]) < 1.6
            if -0.8 <= gap <= 1.8 and same_height:
                current.append(rect)
            else:
                (groups if len(current) >= 2 else singles).append(current if len(current) >= 2 else current[0])
                current = [rect]
        (groups if len(current) >= 2 else singles).append(current if len(current) >= 2 else current[0])
    return groups, singles


def curve_controls(page, page_number: int) -> list[dict]:
    if page_number not in {2, 3, 4, 5, 7, 8, 9, 11, 12, 21, 22, 23, 24}:
        return []
    controls = []
    for curve in page.curves:
        width = curve.get("width", 0)
        height = curve.get("height", 0)
        # Corel exports circular Yes/No selectors as compact closed curves.
        if 9.2 <= width <= 9.8 and 8.7 <= height <= 9.3:
            controls.append(curve)
    return controls


def runs(bits: np.ndarray, minimum: int = 8) -> list[tuple[int, int]]:
    padded = np.pad(bits.astype(np.int8), (1, 1))
    changes = np.diff(padded)
    starts = np.where(changes == 1)[0]
    ends = np.where(changes == -1)[0]
    return [(int(start), int(end)) for start, end in zip(starts, ends) if end - start >= minimum]


def image_box_fields(image: Image.Image, page_width: float, page_height: float) -> list[dict]:
    gray = np.asarray(image.convert("L"))
    dark = gray < 225
    horizontal = {y: runs(dark[y], 9) for y in range(dark.shape[0])}
    candidates = []
    for top in range(dark.shape[0] - 10):
        for left, right in horizontal[top]:
            if right - left > dark.shape[1] * .94:
                continue
            for height in range(10, 30):
                bottom = top + height
                if bottom >= dark.shape[0]:
                    break
                matching = next(((a, b) for a, b in horizontal[bottom]
                    if abs(a - left) <= 2 and abs(b - right) <= 2), None)
                if not matching:
                    continue
                x0, x1 = max(left, matching[0]), min(right, matching[1])
                if x1 - x0 < 9:
                    continue
                left_edge = dark[top:bottom + 1, x0:min(x0 + 2, x1)].mean()
                right_edge = dark[top:bottom + 1, max(x1 - 2, x0):x1].mean()
                inside = dark[top + 2:bottom - 1, x0 + 2:x1 - 1]
                if left_edge < .48 or right_edge < .48 or (inside.size and inside.mean() > .055):
                    continue
                candidates.append((x0, top, x1, bottom))
                break

    deduped = []
    for candidate in sorted(candidates, key=lambda item: (item[1], item[0], -(item[2] - item[0]))):
        if any(max(abs(candidate[i] - other[i]) for i in range(4)) <= 3 for other in deduped):
            continue
        deduped.append(candidate)

    fields = []
    sx, sy = page_width / image.width, page_height / image.height
    for left, top, right, bottom in deduped:
        width, height = right - left, bottom - top
        verticals = []
        for x in range(left, right + 1):
            if dark[top:bottom + 1, x:min(x + 2, dark.shape[1])].mean() > .58:
                if not verticals or x - verticals[-1] > 2:
                    verticals.append(x)
        entry = {"x": round(left * sx, 2), "y": round(top * sy, 2),
            "width": round(width * sx, 2), "height": round(height * sy, 2)}
        if entry["height"] <= 14.2 and entry["width"] >= 25:
            entry.update({"type": "character", "maxLength": max(2, round(entry["width"] / 13.2))})
        elif len(verticals) >= 3 and width / height >= 1.8:
            entry.update({"type": "character", "maxLength": len(verticals) - 1})
        elif width / height <= 1.45:
            entry.update({"type": "checkbox"})
        elif height >= 22:
            entry.update({"type": "multiline"})
        else:
            entry.update({"type": "tableCell"})
        fields.append(entry)

    checkbox_rows: dict[int, list[dict]] = defaultdict(list)
    remainder = []
    for field in fields:
        if field["type"] == "checkbox":
            checkbox_rows[round(field["y"] * 2)].append(field)
        else:
            remainder.append(field)
    for row in checkbox_rows.values():
        row.sort(key=lambda item: item["x"])
        current = [row[0]]
        groups = []
        for field in row[1:]:
            previous = current[-1]
            gap = field["x"] - (previous["x"] + previous["width"])
            if -1.5 <= gap <= 2.5 and abs(field["height"] - previous["height"]) < 2:
                current.append(field)
            else:
                groups.append(current)
                current = [field]
        groups.append(current)
        for group in groups:
            if len(group) >= 2:
                remainder.append({"x": group[0]["x"], "y": min(item["y"] for item in group),
                    "width": round(group[-1]["x"] + group[-1]["width"] - group[0]["x"], 2),
                    "height": max(item["height"] for item in group),
                    "type": "character", "maxLength": len(group)})
            else:
                remainder.append(group[0])
    return remainder


def build_page(page, image: Image.Image, page_number: int) -> list[dict]:
    page_width, page_height = page.width, page.height
    boxes = [rect for rect in page.rects if 4 <= rect["width"] <= 560 and 4 <= rect["height"] <= 190]
    small = [rect for rect in boxes if 8 <= rect["width"] <= 14 and 8 <= rect["height"] <= 14]
    groups, singles = group_small_boxes(small) if small else ([], [])
    fields: list[dict] = []

    for group in groups:
        first, last = group[0], group[-1]
        aggregate = {
            "x0": first["x0"], "x1": last["x1"],
            "top": min(item["top"] for item in group),
            "bottom": max(item["bottom"] for item in group),
        }
        entry = normalized(aggregate)
        entry.update({"type": "character", "maxLength": len(group)})
        fields.append(entry)

    for rect in singles:
        if dark_ratio(image, rect, page_width, page_height) < .035:
            entry = normalized(rect)
            entry.update({"type": "checkbox"})
            fields.append(entry)

    for rect in boxes:
        if rect in small or rect["width"] < 17 or contains_children(rect, small):
            continue
        if rect["width"] > 500 and rect["height"] < 22:
            continue
        if dark_ratio(image, rect, page_width, page_height) >= .018:
            continue
        entry = normalized(rect)
        if rect["height"] >= 38:
            field_type = "signature" if rect["height"] < 75 else "multiline"
        elif rect["height"] >= 18:
            field_type = "multiline"
        else:
            field_type = "tableCell" if rect["width"] < 180 else "text"
        entry.update({"type": field_type})
        fields.append(entry)

    for curve in curve_controls(page, page_number):
        if dark_ratio(image, curve, page_width, page_height) < .045:
            entry = normalized(curve)
            entry.update({"type": "radio"})
        fields.append(entry)

    if page_number == 20:
        fields.append({"x": 57.0, "y": 70.0, "width": 500.0, "height": 710.0, "type": "multiline"})

    if page_number in {6, 10, 11, 12, 13, 14, 15, 16, 18, 21, 22, 23, 24}:
        for detected in image_box_fields(image, page_width, page_height):
            overlaps = any(
                abs(detected["x"] - existing["x"]) < 2.5
                and abs(detected["y"] - existing["y"]) < 2.5
                and abs(detected["width"] - existing["width"]) < 4
                for existing in fields
            )
            if not overlaps:
                fields.append(detected)

    deduped: list[dict] = []
    seen = set()
    for field in sorted(fields, key=lambda item: (item["y"], item["x"], item["type"])):
        key = (round(field["x"]), round(field["y"]), round(field["width"]), round(field["height"]), field["type"])
        if key in seen:
            continue
        seen.add(key)
        field["id"] = f"p{page_number}_{len(deduped) + 1:03d}"
        deduped.append(field)
    return deduped


def main() -> None:
    document = pdfplumber.open(PDF_PATH)
    result = {"pageWidth": 612, "pageHeight": 841.89, "pages": {}}
    for index, page in enumerate(document.pages, start=1):
        image_path = IMAGE_DIR / f"page-{index:02d}.jpg"
        image = Image.open(image_path)
        fields = build_page(page, image, index)
        result["pages"][str(index)] = fields
        print(f"page {index:02d}: {len(fields)} fields", flush=True)
    OUTPUT_PATH.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUTPUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
