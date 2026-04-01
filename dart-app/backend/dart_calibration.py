"""
DartVision – Homography Calibration Tool v2
=============================================
Kalibrerar BÅDA kamerorna i en session direkt på dual-feed-bilden (1280x480).
41 referenspunkter per kamera: Bull + 20 Double + 20 Triple

Användning:
    python dart_calibration.py --image both_20260323_105103.png
    python dart_calibration.py --image both_20260323_105103.png --output_left calib_left.json --output_right calib_right.json

Test:
    python dart_calibration.py --test calib_left.json --image both_20260323_105103.png
"""

import cv2
import numpy as np
import json
import argparse
import math
from pathlib import Path

# ============================================================
# DARTTAVLANS GEOMETRI (mm)
# ============================================================
BULL_RADIUS = 6.35
OUTER_BULL_RADIUS = 15.9
TRIPLE_INNER = 99.0
TRIPLE_OUTER = 107.0
DOUBLE_INNER = 162.0
DOUBLE_OUTER = 170.0

SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
SECTOR_ANGLE = 18.0

BOARD_SIZE = 800
BOARD_CENTER = BOARD_SIZE / 2
BOARD_SCALE = (BOARD_SIZE / 2 - 30) / DOUBLE_OUTER


def board_point_to_pixel(x_mm, y_mm):
    px = BOARD_CENTER + x_mm * BOARD_SCALE
    py = BOARD_CENTER - y_mm * BOARD_SCALE
    return (px, py)


def sector_angle_deg(sector_number):
    idx = SECTORS.index(sector_number)
    return idx * SECTOR_ANGLE


def polar_to_cart(radius_mm, angle_deg):
    rad = math.radians(-(angle_deg - 90))
    x = radius_mm * math.cos(rad)
    y = radius_mm * math.sin(rad)
    return (x, y)


# ============================================================
# REFERENSPUNKTER – ALLA 41
# ============================================================
def generate_reference_points():
    points = []
    points.append(("BULL (centrum)", 0.0, 0.0))
    for s in SECTORS:
        angle = sector_angle_deg(s)
        x, y = polar_to_cart(DOUBLE_OUTER, angle)
        points.append((f"Double {s}", x, y))
    for s in SECTORS:
        angle = sector_angle_deg(s)
        x, y = polar_to_cart(TRIPLE_OUTER, angle)
        points.append((f"Triple {s}", x, y))
    return points


# ============================================================
# FÄRGER
# ============================================================
COLOR_BULL = (0, 255, 255)
COLOR_DOUBLE = (0, 200, 0)
COLOR_TRIPLE = (255, 100, 0)


def get_point_color(idx):
    if idx == 0:
        return COLOR_BULL
    elif idx <= 20:
        return COLOR_DOUBLE
    else:
        return COLOR_TRIPLE


def get_phase_name(idx):
    if idx == 0:
        return "BULL"
    elif idx <= 20:
        return f"DOUBLE ({idx}/20)"
    else:
        return f"TRIPLE ({idx - 20}/20)"


# ============================================================
# KALIBERINGS-UI
# ============================================================
class CalibrationUI:
    def __init__(self, image, camera_name=""):
        self.original = image.copy()
        self.image = image.copy()
        self.clicks = []
        self.current_idx = 0
        self.ref_points = generate_reference_points()
        self.skipped = set()
        self.done = False
        self.camera_name = camera_name
        self.zoom_center = None
        self.zoom_active = True  # zoom on by default

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_MOUSEMOVE:
            self.zoom_center = (x, y)
        if event == cv2.EVENT_LBUTTONDOWN and not self.done:
            self.clicks.append((x, y))
            color = get_point_color(self.current_idx)
            cv2.circle(self.image, (x, y), 4, color, -1)
            cv2.circle(self.image, (x, y), 7, color, 1)
            label = self.ref_points[self.current_idx][0]
            cv2.putText(self.image, label, (x + 10, y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)
            self.current_idx += 1

    def _draw_zoom(self, display):
        if self.zoom_center is None:
            return display
        x, y = self.zoom_center
        h, w = display.shape[:2]
        zf = 3
        src_half = 40
        x1, y1 = max(0, x - src_half), max(0, y - src_half)
        x2, y2 = min(w, x + src_half), min(h, y + src_half)
        crop = display[y1:y2, x1:x2]
        if crop.size == 0:
            return display
        zoomed = cv2.resize(crop, (src_half * 2 * zf, src_half * 2 * zf),
                            interpolation=cv2.INTER_NEAREST)
        zh, zw = zoomed.shape[:2]
        cv2.line(zoomed, (zw//2 - 12, zh//2), (zw//2 + 12, zh//2), (0, 255, 255), 1)
        cv2.line(zoomed, (zw//2, zh//2 - 12), (zw//2, zh//2 + 12), (0, 255, 255), 1)
        cv2.rectangle(zoomed, (0, 0), (zw - 1, zh - 1), (255, 255, 255), 2)
        result = display.copy()
        margin = 10
        zy, zx = margin, w - zw - margin
        if zx > 0 and zy + zh < h:
            result[zy:zy + zh, zx:zx + zw] = zoomed
        return result

    def _draw_progress_bar(self, display):
        h, w = display.shape[:2]
        bar_h = 25
        total = len(self.ref_points)
        done = len(self.clicks) + len(self.skipped)
        cv2.rectangle(display, (0, h - bar_h), (w, h), (40, 40, 40), -1)
        if total > 0:
            prog_w = int((done / total) * w)
            cv2.rectangle(display, (0, h - bar_h), (prog_w, h), (0, 120, 0), -1)
        marks = [(1, "D"), (21, "T")]
        for idx, label in marks:
            mx = int((idx / total) * w)
            cv2.line(display, (mx, h - bar_h), (mx, h), (255, 255, 255), 1)
        phase = get_phase_name(self.current_idx) if self.current_idx < total else "KLAR"
        txt = f"{done}/{total}  |  {phase}"
        cv2.putText(display, txt, (10, h - 7),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        return display

    def run(self):
        win = f"Kalibrering - {self.camera_name}"
        cv2.namedWindow(win, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(win, 1000, 780)
        cv2.setMouseCallback(win, self.mouse_callback)

        total = len(self.ref_points)
        print(f"\n{'='*50}")
        print(f"  KALIBRERING: {self.camera_name}")
        print(f"  {total} punkter: Bull + 20 Double + 20 Triple")
        print(f"{'='*50}")
        print(f"  'u' = angra   'n' = hoppa over   'q' = avbryt")
        print(f"  'z' = zoom on/off   Enter = klar\n")

        while True:
            display = self.image.copy()
            if self.current_idx < total:
                name = self.ref_points[self.current_idx][0]
                phase = get_phase_name(self.current_idx)
                color = get_point_color(self.current_idx)
                cv2.putText(display, f"Klicka: {name}   [{phase}]", (10, 25),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                for peek in range(1, 4):
                    pi = self.current_idx + peek
                    if pi < total:
                        pname = self.ref_points[pi][0]
                        cv2.putText(display, f"  sedan: {pname}", (10, 25 + peek * 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (180, 180, 180), 1)
            else:
                cv2.putText(display, "ALLA PUNKTER KLICKADE! Tryck Enter.",
                            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            display = self._draw_progress_bar(display)
            if self.zoom_active:
                display = self._draw_zoom(display)
            cv2.imshow(win, display)
            key = cv2.waitKey(30) & 0xFF

            if key == ord('q'):
                cv2.destroyAllWindows()
                return None
            elif key == ord('u'):
                if self.clicks and self.current_idx > 0:
                    while self.current_idx - 1 in self.skipped and self.current_idx > 0:
                        self.current_idx -= 1
                    self.clicks.pop()
                    self.current_idx -= 1
                    self.image = self.original.copy()
                    click_i = 0
                    for i in range(self.current_idx):
                        if i in self.skipped:
                            continue
                        if click_i < len(self.clicks):
                            cx, cy = self.clicks[click_i]
                            c = get_point_color(i)
                            cv2.circle(self.image, (cx, cy), 4, c, -1)
                            cv2.circle(self.image, (cx, cy), 7, c, 1)
                            lbl = self.ref_points[i][0]
                            cv2.putText(self.image, lbl, (cx + 10, cy - 5),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, c, 1)
                            click_i += 1
                    print(f"  Angrade -> {self.ref_points[self.current_idx][0]}")
            elif key == ord('n'):
                if self.current_idx < total:
                    name = self.ref_points[self.current_idx][0]
                    self.skipped.add(self.current_idx)
                    self.current_idx += 1
                    print(f"  Hoppade over: {name}")
            elif key == ord('z'):
                self.zoom_active = not self.zoom_active
            elif key == 13:
                if len(self.clicks) >= 4:
                    self.done = True
                    break
                else:
                    print("  Behover minst 4 punkter!")
            if self.current_idx >= total and len(self.clicks) >= 4:
                self.done = True
                break

        cv2.destroyAllWindows()
        return self._build_point_pairs()

    def _build_point_pairs(self):
        src_points, dst_points = [], []
        click_idx = 0
        for i, (name, x_mm, y_mm) in enumerate(self.ref_points):
            if i in self.skipped:
                continue
            if click_idx >= len(self.clicks):
                break
            src_points.append(self.clicks[click_idx])
            dst_points.append(board_point_to_pixel(x_mm, y_mm))
            click_idx += 1
        return np.array(src_points, dtype=np.float32), np.array(dst_points, dtype=np.float32)


# ============================================================
# HOMOGRAPHY
# ============================================================
def compute_homography(src_pts, dst_pts):
    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 3.0)
    inliers = mask.ravel().sum() if mask is not None else 0
    total = len(src_pts)
    print(f"  Homography: {inliers}/{total} inliers")
    if inliers < 4:
        print("  VARNING: For fa inliers!")
        return None, None
    if mask is not None:
        outliers = np.where(mask.ravel() == 0)[0]
        if len(outliers) > 0:
            ref = generate_reference_points()
            print(f"  Outliers (kan vara felklick):")
            for oi in outliers:
                if oi < len(ref):
                    print(f"    - {ref[oi][0]}")
    return H, mask


def draw_board_overlay(warped):
    center = (int(BOARD_CENTER), int(BOARD_CENTER))
    result = warped.copy()
    rings = [
        (BULL_RADIUS, (0, 0, 255), 2),
        (OUTER_BULL_RADIUS, (0, 255, 0), 1),
        (TRIPLE_INNER, (255, 255, 0), 1),
        (TRIPLE_OUTER, (255, 255, 0), 1),
        (DOUBLE_INNER, (0, 255, 255), 1),
        (DOUBLE_OUTER, (0, 255, 255), 2),
    ]
    for r_mm, color, thick in rings:
        r_px = int(r_mm * BOARD_SCALE)
        cv2.circle(result, center, r_px, color, thick)
    for i in range(20):
        a = i * SECTOR_ANGLE - SECTOR_ANGLE / 2
        x1, y1 = polar_to_cart(OUTER_BULL_RADIUS, a)
        x2, y2 = polar_to_cart(DOUBLE_OUTER, a)
        p1 = board_point_to_pixel(x1, y1)
        p2 = board_point_to_pixel(x2, y2)
        cv2.line(result, (int(p1[0]), int(p1[1])),
                 (int(p2[0]), int(p2[1])), (150, 150, 150), 1)
    for i, sector in enumerate(SECTORS):
        a = i * SECTOR_ANGLE
        x, y = polar_to_cart(DOUBLE_OUTER + 12, a)
        pos = board_point_to_pixel(x, y)
        cv2.putText(result, str(sector), (int(pos[0]) - 8, int(pos[1]) + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
    return result


def verify_homography(image, H, camera_name=""):
    warped = cv2.warpPerspective(image, H, (BOARD_SIZE, BOARD_SIZE))
    overlay = draw_board_overlay(warped)
    win = f"Verifiering - {camera_name}"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, 800, 800)
    cv2.imshow(win, overlay)
    print(f"  Stammer linjerna?  'y' = ja   'n' = nej")
    while True:
        key = cv2.waitKey(0) & 0xFF
        if key == ord('y'):
            cv2.destroyAllWindows()
            return True
        elif key == ord('n'):
            cv2.destroyAllWindows()
            return False


# ============================================================
# SCORING
# ============================================================
def score_from_board_coords(x_mm, y_mm):
    r = math.sqrt(x_mm**2 + y_mm**2)
    angle = math.degrees(math.atan2(x_mm, y_mm))
    if angle < 0:
        angle += 360
    sector_idx = int((angle + SECTOR_ANGLE / 2) % 360 / SECTOR_ANGLE)
    sector = SECTORS[sector_idx]
    if r <= BULL_RADIUS:
        return (2, 25, 50, "D-BULL")
    elif r <= OUTER_BULL_RADIUS:
        return (1, 25, 25, "S-BULL")
    elif r <= TRIPLE_INNER:
        return (1, sector, sector, f"S{sector}")
    elif r <= TRIPLE_OUTER:
        return (3, sector, sector * 3, f"T{sector}")
    elif r <= DOUBLE_INNER:
        return (1, sector, sector, f"S{sector}")
    elif r <= DOUBLE_OUTER:
        return (2, sector, sector * 2, f"D{sector}")
    else:
        return (0, 0, 0, "MISS")


def pixel_to_board_mm(px, py):
    x_mm = (px - BOARD_CENTER) / BOARD_SCALE
    y_mm = -(py - BOARD_CENTER) / BOARD_SCALE
    return x_mm, y_mm


# ============================================================
# SPARA / LADDA
# ============================================================
def save_calibration(path, H, src_pts, dst_pts, image_shape, camera_name="", roi=None):
    data = {
        "camera": camera_name,
        "homography": H.tolist(),
        "src_points": src_pts.tolist(),
        "dst_points": dst_pts.tolist(),
        "image_shape": list(image_shape[:2]),
        "board_size": BOARD_SIZE,
        "board_scale": BOARD_SCALE,
        "board_center": BOARD_CENTER,
    }
    if roi:
        data["roi"] = roi
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"  Sparad: {path}")


def load_calibration(path):
    with open(path) as f:
        data = json.load(f)
    H = np.array(data["homography"], dtype=np.float64)
    return H, data


# ============================================================
# INTERAKTIV SCORING-TEST
# ============================================================
def interactive_scoring_test(image, H):
    warped_base = cv2.warpPerspective(image, H, (BOARD_SIZE, BOARD_SIZE))
    overlay_base = draw_board_overlay(warped_base)
    print("\n  SCORING TEST - klicka pilspetsar, 'q' = avsluta")

    def on_click(event, x, y, flags, param):
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        pt = np.array([[[x, y]]], dtype=np.float32)
        warped_pt = cv2.perspectiveTransform(pt, H)[0][0]
        wx, wy = warped_pt
        x_mm, y_mm = pixel_to_board_mm(wx, wy)
        mult, sector, total, zone = score_from_board_coords(x_mm, y_mm)
        print(f"    ({x},{y}) -> {zone} = {total}")
        test_overlay = overlay_base.copy()
        cv2.circle(test_overlay, (int(wx), int(wy)), 6, (0, 0, 255), -1)
        cv2.putText(test_overlay, f"{zone} ({total})", (int(wx)+10, int(wy)-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        cv2.imshow("Warped", test_overlay)
        img_copy = image.copy()
        cv2.circle(img_copy, (x, y), 6, (0, 0, 255), -1)
        cv2.putText(img_copy, f"{zone}={total}", (x+10, y-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        cv2.imshow("Original", img_copy)

    cv2.namedWindow("Original", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Original", 1000, 780)
    cv2.namedWindow("Warped", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Warped", 800, 800)
    cv2.imshow("Original", image)
    cv2.imshow("Warped", overlay_base)
    cv2.setMouseCallback("Original", on_click)
    while True:
        if cv2.waitKey(30) & 0xFF == ord('q'):
            break
    cv2.destroyAllWindows()


# ============================================================
# DUAL-KAMERA KALIBRERING
# ============================================================
def calibrate_dual(image_path, output_left, output_right):
    full = cv2.imread(image_path)
    if full is None:
        print(f"Kunde inte ladda: {image_path}")
        return
    h, w = full.shape[:2]
    mid = w // 2
    print(f"\nDual-feed: {w}x{h} -> vanster {mid}x{h} + hoger {mid}x{h}")

    for side, name, x_start, output in [
        ("left", "VANSTER", 0, output_left),
        ("right", "HOGER", mid, output_right),
    ]:
        print(f"\n{'='*50}")
        print(f"  {name} KAMERA")
        print(f"{'='*50}")
        cam_img = full[:, x_start:x_start + mid]
        ui = CalibrationUI(cam_img, name)
        result = ui.run()
        if result is None:
            print("Avbrutet.")
            return
        src, dst = result
        print(f"  {len(src)} punkter")
        H, mask = compute_homography(src, dst)
        if H is None:
            return
        ok = verify_homography(cam_img, H, name)
        if not ok:
            print(f"  {name} avvisad. Kor om!")
            return
        save_calibration(output, H, src, dst, cam_img.shape,
                         side, {"x_offset": x_start, "width": mid, "full_width": w})

    print(f"\n{'='*50}")
    print(f"  KLAR! {output_left} + {output_right}")
    print(f"{'='*50}")


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="DartVision Calibration v2")
    parser.add_argument("--image", type=str, required=True)
    parser.add_argument("--single", action="store_true")
    parser.add_argument("--output_left", type=str, default="calib_left.json")
    parser.add_argument("--output_right", type=str, default="calib_right.json")
    parser.add_argument("--output", type=str, default="calibration.json")
    parser.add_argument("--test", type=str, help="Ladda kalibrering och testa")
    args = parser.parse_args()

    if args.test:
        H, data = load_calibration(args.test)
        img = cv2.imread(args.image)
        if img is None:
            print("Kunde inte ladda bild!")
            return
        roi = data.get("roi")
        if roi and img.shape[1] > roi["width"] + 100:
            x_off = roi["x_offset"]
            img = img[:, x_off:x_off + roi["width"]]
            print(f"Klippte ut {data.get('camera', '')} ({roi['width']}px)")
        interactive_scoring_test(img, H)
        return

    img = cv2.imread(args.image)
    if img is None:
        print(f"Kunde inte ladda: {args.image}")
        return

    if args.single or img.shape[1] <= 800:
        ui = CalibrationUI(img, "KAMERA")
        result = ui.run()
        if result is None:
            return
        src, dst = result
        H, mask = compute_homography(src, dst)
        if H is None:
            return
        ok = verify_homography(img, H, "KAMERA")
        if not ok:
            return
        save_calibration(args.output, H, src, dst, img.shape)
        interactive_scoring_test(img, H)
    else:
        calibrate_dual(args.image, args.output_left, args.output_right)


if __name__ == "__main__":
    main()