"""
DartVision – YOLO + Homography Scoring Pipeline v2
====================================================
Komplett system med board-space deduplication.

Båda kamerorna detekterar → transformerar till tavlkoordinater (mm) →
pilar inom 15mm från varandra = samma pil → behåll högst confidence.

    python dartvision_score.py --video dart_20260323_104950.avi --model best.pt
    python dartvision_score.py --camera 0 --model best.pt
    python dartvision_score.py --video dart_20260323_104950.avi --model best.pt --save output.mp4
"""

from ultralytics import YOLO
import cv2
import numpy as np
import json
import math
import argparse
from pathlib import Path

# ============================================================
# DARTTAVLA GEOMETRI
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

WIRE_TOLERANCE_MM = 2.0

# Dedup
DEDUP_DISTANCE_MM = 15.0  # inom 15mm = samma pil

# Färger
COL_GREEN = (0, 255, 0)
COL_YELLOW = (0, 255, 255)
COL_RED = (0, 0, 255)
COL_CYAN = (255, 255, 0)
COL_WHITE = (255, 255, 255)
COL_ORANGE = (0, 165, 255)
COL_GRAY = (150, 150, 150)
COL_BG = (30, 30, 30)
COL_DIM_GREEN = (0, 80, 0)


# ============================================================
# SCORING MATH
# ============================================================
def score_from_mm(x_mm, y_mm):
    r = math.sqrt(x_mm**2 + y_mm**2)
    angle = math.degrees(math.atan2(x_mm, y_mm))
    if angle < 0:
        angle += 360

    sector_idx = int((angle + SECTOR_ANGLE / 2) % 360 / SECTOR_ANGLE)
    sector = SECTORS[sector_idx]

    boundaries = [BULL_RADIUS, OUTER_BULL_RADIUS, TRIPLE_INNER,
                  TRIPLE_OUTER, DOUBLE_INNER, DOUBLE_OUTER]
    is_edge = any(abs(r - b) < WIRE_TOLERANCE_MM for b in boundaries)
    norm_angle = angle % SECTOR_ANGLE
    if norm_angle < 1.0 or (SECTOR_ANGLE - norm_angle) < 1.0:
        is_edge = True

    if r <= BULL_RADIUS:
        return ("D-BULL", 50, 2, 25, r, angle, is_edge)
    elif r <= OUTER_BULL_RADIUS:
        return ("S-BULL", 25, 1, 25, r, angle, is_edge)
    elif r <= TRIPLE_INNER:
        return (f"S{sector}", sector, 1, sector, r, angle, is_edge)
    elif r <= TRIPLE_OUTER:
        return (f"T{sector}", sector * 3, 3, sector, r, angle, is_edge)
    elif r <= DOUBLE_INNER:
        return (f"S{sector}", sector, 1, sector, r, angle, is_edge)
    elif r <= DOUBLE_OUTER:
        return (f"D{sector}", sector * 2, 2, sector, r, angle, is_edge)
    else:
        return ("MISS", 0, 0, 0, r, angle, False)


def pixel_to_mm(px, py):
    x_mm = (px - BOARD_CENTER) / BOARD_SCALE
    y_mm = -(py - BOARD_CENTER) / BOARD_SCALE
    return x_mm, y_mm


def board_point_to_pixel(x_mm, y_mm):
    px = BOARD_CENTER + x_mm * BOARD_SCALE
    py = BOARD_CENTER - y_mm * BOARD_SCALE
    return (int(px), int(py))


def polar_to_cart(radius_mm, angle_deg):
    rad = math.radians(-(angle_deg - 90))
    return (radius_mm * math.cos(rad), radius_mm * math.sin(rad))


def dist_mm(a, b):
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)


# ============================================================
# KALIBRERING
# ============================================================
class CameraCalibration:
    def __init__(self, calib_path):
        with open(calib_path) as f:
            data = json.load(f)
        self.H = np.array(data["homography"], dtype=np.float64)
        self.roi = data.get("roi", {})
        self.camera = data.get("camera", "")

    def cam_to_board_mm(self, cam_x, cam_y):
        pt = np.array([[[cam_x, cam_y]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt, self.H)[0][0]
        return pixel_to_mm(warped[0], warped[1])

    def cam_to_warped_px(self, cam_x, cam_y):
        pt = np.array([[[cam_x, cam_y]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt, self.H)[0][0]
        return (int(warped[0]), int(warped[1]))


# ============================================================
# BOARD OVERLAY
# ============================================================
def create_board_overlay():
    board = np.zeros((BOARD_SIZE, BOARD_SIZE, 3), dtype=np.uint8)
    board[:] = COL_BG
    center = (int(BOARD_CENTER), int(BOARD_CENTER))

    for r_mm, color, thick in [
        (DOUBLE_OUTER, (60, 60, 60), 2), (DOUBLE_INNER, (60, 60, 60), 1),
        (TRIPLE_OUTER, (60, 60, 60), 1), (TRIPLE_INNER, (60, 60, 60), 1),
        (OUTER_BULL_RADIUS, (60, 60, 60), 1), (BULL_RADIUS, (60, 60, 60), 1),
    ]:
        cv2.circle(board, center, int(r_mm * BOARD_SCALE), color, thick)

    for i in range(20):
        a = i * SECTOR_ANGLE - SECTOR_ANGLE / 2
        p1 = board_point_to_pixel(*polar_to_cart(OUTER_BULL_RADIUS, a))
        p2 = board_point_to_pixel(*polar_to_cart(DOUBLE_OUTER, a))
        cv2.line(board, p1, p2, (50, 50, 50), 1)

    for i, sector in enumerate(SECTORS):
        a = i * SECTOR_ANGLE
        pos = board_point_to_pixel(*polar_to_cart(DOUBLE_OUTER + 12, a))
        cv2.putText(board, str(sector), (pos[0] - 8, pos[1] + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (120, 120, 120), 1)

    return board


# ============================================================
# SCOREBOARD
# ============================================================
class ScoreBoard:
    def __init__(self):
        self.throws = []
        self.total = 0

    def add_throw(self, zone, score, is_edge, cam=""):
        self.throws.append((zone, score, is_edge, cam))
        self.total += score

    def draw(self, width=350, height=480):
        img = np.zeros((height, width, 3), dtype=np.uint8)
        img[:] = (25, 25, 25)

        cv2.putText(img, "DARTVISION", (15, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, COL_GREEN, 2)
        cv2.line(img, (15, 50), (width - 15, 50), (60, 60, 60), 1)
        cv2.putText(img, f"TOTAL: {self.total}", (15, 85),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, COL_WHITE, 2)

        cv2.putText(img, "Senaste kast:", (15, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, COL_GRAY, 1)

        y = 150
        for i, (zone, score, is_edge, cam) in enumerate(reversed(self.throws[-10:])):
            edge_str = " ~" if is_edge else ""
            color = COL_YELLOW if is_edge else COL_GREEN
            if score == 0:
                color = COL_RED
            elif score >= 40:
                color = COL_ORANGE
            txt = f"{zone} = {score}{edge_str}"
            cv2.putText(img, txt, (25, y + i * 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)
            cam_label = "L" if cam == "left" else "R"
            cv2.putText(img, cam_label, (width - 30, y + i * 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (80, 80, 80), 1)

        return img


# ============================================================
# DEDUPLICATION
# ============================================================
def deduplicate_darts(detections):
    """
    Merge detektioner från båda kamerorna i board-space.
    Pilar inom DEDUP_DISTANCE_MM → samma pil → behåll högst confidence.
    """
    if not detections:
        return []

    sorted_dets = sorted(detections, key=lambda d: d["conf"], reverse=True)

    kept = []
    used = [False] * len(sorted_dets)

    for i, det in enumerate(sorted_dets):
        if used[i]:
            continue
        kept.append(det)
        used[i] = True

        for j in range(i + 1, len(sorted_dets)):
            if used[j]:
                continue
            d = dist_mm(
                (det["board_x_mm"], det["board_y_mm"]),
                (sorted_dets[j]["board_x_mm"], sorted_dets[j]["board_y_mm"]),
            )
            if d < DEDUP_DISTANCE_MM:
                used[j] = True

    return kept


# ============================================================
# DART DETECTOR
# ============================================================
class DartDetector:
    def __init__(self, model_path, conf=0.10, tip_offset=0.3):
        self.model = YOLO(model_path)
        self.conf = conf
        self.tip_offset = tip_offset  # 0.0 = bbox botten, 0.5 = mitten, 1.0 = toppen
        print(f"YOLO: {self.model.names}  tip_offset: {tip_offset}")

    def detect(self, frame):
        results = self.model(frame, conf=self.conf, verbose=False)
        darts = []
        for box in results[0].boxes:
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox_h = y2 - y1
            tip_x = (x1 + x2) / 2
            tip_y = y2 - bbox_h * self.tip_offset  # flytta upp från botten
            darts.append({
                "tip_x": tip_x,
                "tip_y": tip_y,
                "conf": conf,
                "bbox": (int(x1), int(y1), int(x2), int(y2)),
            })
        return darts


# ============================================================
# PIPELINE
# ============================================================
class DartVisionPipeline:
    def __init__(self, model_path, calib_left_path=None, calib_right_path=None, conf=0.10, tip_offset=0.3):
        self.detector = DartDetector(model_path, conf, tip_offset)
        self.calib_left = CameraCalibration(calib_left_path) if calib_left_path else None
        self.calib_right = CameraCalibration(calib_right_path) if calib_right_path else None
        self.scoreboard = ScoreBoard()
        self.board_overlay = create_board_overlay()

        self.prev_dart_count = 0
        self.scored_positions = []

    def process_frame(self, frame):
        h, f_w = frame.shape[:2]
        mid = f_w // 2

        left = frame[:, :mid]
        right = frame[:, mid:]

        raw_left = self.detector.detect(left)
        raw_right = self.detector.detect(right)

        # ---- Transform till board-space ----
        all_detections = []

        for d in raw_left:
            det = {**d, "cam": "left", "x_offset": 0,
                   "tip_cam_x": d["tip_x"], "tip_cam_y": d["tip_y"]}
            if self.calib_left:
                x_mm, y_mm = self.calib_left.cam_to_board_mm(d["tip_x"], d["tip_y"])
                det["board_x_mm"] = x_mm
                det["board_y_mm"] = y_mm
                det["warped_px"] = self.calib_left.cam_to_warped_px(d["tip_x"], d["tip_y"])
            all_detections.append(det)

        for d in raw_right:
            det = {**d, "cam": "right", "x_offset": mid,
                   "tip_cam_x": d["tip_x"], "tip_cam_y": d["tip_y"]}
            if self.calib_right:
                x_mm, y_mm = self.calib_right.cam_to_board_mm(d["tip_x"], d["tip_y"])
                det["board_x_mm"] = x_mm
                det["board_y_mm"] = y_mm
                det["warped_px"] = self.calib_right.cam_to_warped_px(d["tip_x"], d["tip_y"])
            all_detections.append(det)

        # ---- Dedup ----
        has_calib = self.calib_left or self.calib_right
        if has_calib:
            with_board = [d for d in all_detections if "board_x_mm" in d]
            without_board = [d for d in all_detections if "board_x_mm" not in d]
            merged = deduplicate_darts(with_board) + without_board
        else:
            merged = all_detections

        # ---- Annotate ----
        display = frame.copy()
        board = self.board_overlay.copy()

        # Dimmade raw-detektioner (allt YOLO ser)
        for d in all_detections:
            x1, y1, x2, y2 = d["bbox"]
            xo = d["x_offset"]
            cv2.rectangle(display, (x1 + xo - 8, y1 - 8),
                          (x2 + xo + 8, y2 + 8), COL_DIM_GREEN, 1)

        # Starka merged detektioner
        scores_this_frame = []
        for d in merged:
            xo = d["x_offset"]
            tx = int(d["tip_cam_x"]) + xo
            ty = int(d["tip_cam_y"])
            conf = d["conf"]
            x1, y1, x2, y2 = d["bbox"]

            color = COL_GREEN if conf >= 0.20 else COL_YELLOW

            cv2.rectangle(display, (x1 + xo - 12, y1 - 12),
                          (x2 + xo + 12, y2 + 12), color, 2)
            cv2.circle(display, (tx, ty), 5, COL_RED, -1)

            cam_label = "L" if d["cam"] == "left" else "R"

            if "board_x_mm" in d:
                x_mm, y_mm = d["board_x_mm"], d["board_y_mm"]
                zone, score, mult, sector, r_mm, angle, is_edge = score_from_mm(x_mm, y_mm)

                edge_str = "~" if is_edge else ""
                label = f"{zone}={score}{edge_str} [{cam_label}]"
                lbl_color = COL_ORANGE if score >= 40 else COL_GREEN
                if score == 0:
                    lbl_color = COL_RED

                cv2.putText(display, label, (tx + 10, ty - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, lbl_color, 2)

                wp = d["warped_px"]
                cv2.circle(board, wp, 6, COL_RED, -1)
                cv2.circle(board, wp, 8, COL_WHITE, 1)
                cv2.putText(board, f"{score}", (wp[0] + 10, wp[1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, lbl_color, 1)

                scores_this_frame.append({
                    "zone": zone, "score": score, "is_edge": is_edge,
                    "cam": d["cam"], "x_mm": x_mm, "y_mm": y_mm,
                })
            else:
                cv2.putText(display, f"{conf:.0%} [{cam_label}]", (tx + 10, ty - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

        # ---- Throw detection ----
        current_count = len(merged)
        self._check_new_darts(scores_this_frame, current_count)

        # Info
        raw_count = len(all_detections)
        dedup_count = len(merged)
        dedup_txt = f"Raw: {raw_count} -> Dedup: {dedup_count}" if has_calib else f"Darts: {raw_count}"
        cv2.putText(display, dedup_txt, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, COL_GREEN, 2)

        sb = self.scoreboard.draw(height=h)
        return display, board, sb

    def _check_new_darts(self, scores_this_frame, current_count):
        if current_count > self.prev_dart_count and scores_this_frame:
            for s in scores_this_frame:
                pos = (s["x_mm"], s["y_mm"])
                is_new = True
                for prev_pos in self.scored_positions:
                    if dist_mm(pos, prev_pos) < DEDUP_DISTANCE_MM:
                        is_new = False
                        break
                if is_new:
                    self.scoreboard.add_throw(s["zone"], s["score"], s["is_edge"], s["cam"])
                    self.scored_positions.append(pos)
                    print(f"  KAST: {s['zone']} = {s['score']} ({s['cam']})")

        if current_count == 0 and self.prev_dart_count > 0:
            self.scored_positions.clear()
            print("  --- Ny runda ---")

        self.prev_dart_count = current_count


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="DartVision v2 (dedup)")
    parser.add_argument("--video", type=str)
    parser.add_argument("--camera", type=int)
    parser.add_argument("--model", type=str, default="best.pt")
    parser.add_argument("--calib_left", type=str, default=None)
    parser.add_argument("--calib_right", type=str, default=None)
    parser.add_argument("--conf", type=float, default=0.10)
    parser.add_argument("--tip_offset", type=float, default=0.3,
                        help="Spets-offset i bbox (0.0=botten, 0.5=mitten, 1.0=toppen)")
    parser.add_argument("--save", type=str)
    args = parser.parse_args()

    if args.calib_left is None and Path("calib_left.json").exists():
        args.calib_left = "calib_left.json"
        print(f"Auto: {args.calib_left}")
    if args.calib_right is None and Path("calib_right.json").exists():
        args.calib_right = "calib_right.json"
        print(f"Auto: {args.calib_right}")

    if not args.calib_left and not args.calib_right:
        print("OBS: Ingen kalibrering – kor utan scoring/dedup.\n")

    pipeline = DartVisionPipeline(
        model_path=args.model,
        calib_left_path=args.calib_left,
        calib_right_path=args.calib_right,
        conf=args.conf,
        tip_offset=args.tip_offset,
    )

    if args.video:
        cap = cv2.VideoCapture(args.video)
    elif args.camera is not None:
        cap = cv2.VideoCapture(args.camera)
    else:
        print("Ange --video eller --camera")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    f_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    f_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    board_w = f_h
    sb_w = 300
    comp_w = f_w + board_w + sb_w
    comp_h = f_h

    writer = None
    if args.save:
        writer = cv2.VideoWriter(args.save, cv2.VideoWriter_fourcc(*'mp4v'),
                                 fps, (comp_w, comp_h))

    print(f"\nDartVision v2")
    print(f"  Feed: {f_w}x{f_h} @ {fps:.0f}fps")
    print(f"  Conf: {args.conf}  Dedup: {DEDUP_DISTANCE_MM}mm  Tip: {args.tip_offset}")
    print(f"  Kalib: L={'JA' if args.calib_left else 'NEJ'} R={'JA' if args.calib_right else 'NEJ'}")
    print(f"\n  q=avsluta  +/-=conf  w/s=tip upp/ner  r=reset  p=paus\n")

    paused = False

    while True:
        if not paused:
            ret, frame = cap.read()
            if not ret:
                if args.video:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                break

        display, board, sb = pipeline.process_frame(frame)

        board_resized = cv2.resize(board, (board_w, f_h))
        sb_resized = cv2.resize(sb, (sb_w, f_h))

        comp = np.zeros((comp_h, comp_w, 3), dtype=np.uint8)
        comp[:f_h, :f_w] = display
        comp[:f_h, f_w:f_w + board_w] = board_resized
        comp[:f_h, f_w + board_w:f_w + board_w + sb_w] = sb_resized

        cv2.namedWindow("DartVision", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("DartVision", min(comp_w, 1920), min(comp_h, 600))
        cv2.imshow("DartVision", comp)

        if writer and not paused:
            writer.write(comp)

        key = cv2.waitKey(1 if not paused else 30) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('p'):
            paused = not paused
        elif key == ord('+') or key == ord('='):
            pipeline.detector.conf = min(0.95, pipeline.detector.conf + 0.05)
            print(f"  conf = {pipeline.detector.conf:.2f}")
        elif key == ord('-'):
            pipeline.detector.conf = max(0.01, pipeline.detector.conf - 0.05)
            print(f"  conf = {pipeline.detector.conf:.2f}")
        elif key == ord('r'):
            pipeline.scoreboard = ScoreBoard()
            pipeline.scored_positions.clear()
            pipeline.prev_dart_count = 0
            print("  Score reset!")
        elif key == ord('w'):
            pipeline.detector.tip_offset = min(1.0, pipeline.detector.tip_offset + 0.05)
            print(f"  tip_offset = {pipeline.detector.tip_offset:.2f} (spets hogre)")
        elif key == ord('s'):
            pipeline.detector.tip_offset = max(0.0, pipeline.detector.tip_offset - 0.05)
            print(f"  tip_offset = {pipeline.detector.tip_offset:.2f} (spets lagre)")

    cap.release()
    if writer:
        writer.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()