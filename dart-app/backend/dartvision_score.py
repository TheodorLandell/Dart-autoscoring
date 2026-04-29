"""
DartVision – YOLO + Homography Scoring Pipeline v3 (Optimerad)
================================================================
Förbättringar över v2:
  1. DartTracker – temporal smoothing av positioner (EMA) + min_hits
     innan en detektion räknas som stabil → eliminerar flicker-scoring
  2. Debounce / frame-stabil kast-registrering – kräver N stabila frames
     innan ett nytt kast registreras, förhindrar dubbelregistreringar
  3. Adaptiv tip-lokalisering – tar hänsyn till bbox aspect ratio för
     att bättre uppskatta spetspositionen på vinklade pilar
  4. Homografi-validering – kasserar transformationer som hamnar utanför
     tavlan (r > DOUBLE_OUTER + marginal)
  5. Confidence-gating – separerar visningströskel från scoring-tröskel
  6. Kamera-medveten dedup: samma kamera 8mm, kors-kamera 20mm
  7. Ny runda kräver 0-darts i flera frames (undviker falskt reset)

Användning:
    python dartvision_score_v3.py --video dart.avi --model best.pt
    python dartvision_score_v3.py --camera 0 --model best.pt
    python dartvision_score_v3.py --camera 0 --model best.pt --save output.mp4

Tangenter:
    q=avsluta  +/-=conf  w/s=tip  r=reset  p=paus  d=debug  t=tracker-info
"""

from ultralytics import YOLO
import cv2
import numpy as np
import json
import math
import time
import argparse
from pathlib import Path
from collections import deque

# ============================================================
# DARTTAVLA GEOMETRI (mm)
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

# ============================================================
# TUNING-PARAMETRAR (v3)
# ============================================================
DEDUP_SAME_CAM_MM = 8.0        # samma kamera: max avstånd för att merga två bbox till samma pil
DEDUP_CROSS_CAM_MM = 30.0      # kors-kamera: max avstånd för att merga L- och R-detektion av samma pil
BOARD_RADIUS_MAX_MM = 500.0    # homografi-validering: max avstånd från centrum (utökad för foam-träffar)

# Tracker
TRACK_MATCH_MM = 18.0          # max avstånd för att matcha detektion → oscorad track
SCORED_MATCH_MM = 5.0          # max avstånd för att matcha detektion → redan scorad track
SCORED_DEDUP_MM = 35.0         # blockera ny track inom denna radie direkt efter ett kast
SCORED_DEDUP_SECS = 3.0        # hur länge dedupen håller (sekunder, fps-oberoende)
TRACK_MIN_HITS = 3             # frames en pil måste synas innan den räknas
TRACK_MAX_AGE = 8              # frames utan detektion innan track dör
TRACK_SMOOTH_ALPHA = 0.4       # EMA-faktor (lägre = mer smoothing)

# Debounce
STABLE_FRAMES_REQUIRED = 2    # antal frames med samma dart-antal innan scoring
ZERO_FRAMES_REQUIRED = 5      # antal frames med 0 darts innan "ny runda"

# Confidence
CONF_SCORE_MIN = 0.15         # under detta → visas men scoreas inte
CONF_DISPLAY_MIN = 0.10       # under detta → visas inte alls

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
COL_BLUE = (255, 140, 0)


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
# KALIBRERING (med homografi-validering)
# ============================================================
class CameraCalibration:
    def __init__(self, calib_path):
        with open(calib_path) as f:
            data = json.load(f)
        self.H = np.array(data["homography"], dtype=np.float64)
        self.roi = data.get("roi", {})
        self.camera = data.get("camera", "")

    def cam_to_board_mm(self, cam_x, cam_y):
        """Transformera kamera-pixel → board mm. Returnerar (None, None) om utanför tavlan."""
        pt = np.array([[[cam_x, cam_y]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt, self.H)[0][0]
        x_mm, y_mm = pixel_to_mm(warped[0], warped[1])

        # Validering: kassera om transformationen hamnar extremt utanför tavlan (troligen defekt homografi)
        r = math.sqrt(x_mm**2 + y_mm**2)
        if r > BOARD_RADIUS_MAX_MM:
            print(f"  [HOMOGRAFI] Kasserad: r={r:.0f}mm > {BOARD_RADIUS_MAX_MM:.0f}mm — troligen defekt homografi")
            return None, None

        return x_mm, y_mm

    def cam_to_warped_px(self, cam_x, cam_y):
        pt = np.array([[[cam_x, cam_y]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt, self.H)[0][0]
        return (int(warped[0]), int(warped[1]))


# ============================================================
# DART TRACKER – temporal smoothing
# ============================================================
class DartTrack:
    """En enskild pil-track med smoothad position."""
    _next_id = 0

    def __init__(self, x_mm, y_mm, conf, cam, det_data):
        self.id = DartTrack._next_id
        DartTrack._next_id += 1

        self.x_mm = x_mm
        self.y_mm = y_mm
        self.smooth_x = x_mm
        self.smooth_y = y_mm
        self.conf = conf
        self.cam = cam
        self.det_data = det_data  # senaste detektionsdata (för rendering)

        self.hits = 1
        self.age = 0            # frames sedan senaste match
        self.scored = False     # har denna track redan registrerats som kast?

    def update(self, x_mm, y_mm, conf, cam, det_data):
        """Uppdatera med ny detektion → EMA-smoothing."""
        alpha = TRACK_SMOOTH_ALPHA
        self.smooth_x = alpha * x_mm + (1 - alpha) * self.smooth_x
        self.smooth_y = alpha * y_mm + (1 - alpha) * self.smooth_y
        self.x_mm = x_mm
        self.y_mm = y_mm
        self.conf = max(self.conf, conf)  # behåll bästa confidence
        self.cam = cam
        self.det_data = det_data
        self.hits += 1
        self.age = 0

    @property
    def is_confirmed(self):
        """Track anses stabil efter TRACK_MIN_HITS detektioner."""
        return self.hits >= TRACK_MIN_HITS

    @property
    def is_dead(self):
        # Scorade tracks lever tills pilar dras ut (explicit reset) — förhindrar re-detektion som nytt kast
        return self.age > TRACK_MAX_AGE and not self.scored


class DartTracker:
    """
    Hanterar alla aktiva dart-tracks.
    Varje frame: matcha nya detektioner → existerande tracks,
    skapa nya tracks för omatchade, åldra/döda gamla.
    """
    def __init__(self):
        self.tracks: list[DartTrack] = []

    def update(self, detections):
        """
        Tar lista av merged-detektioner (med board_x_mm/board_y_mm).
        Returnerar lista av bekräftade (stabila) tracks.
        """
        # Matcha detektioner → tracks (greedy nearest-neighbor)
        matched_tracks = set()
        matched_dets = set()

        # Bygg kostnadsmatris — scorade tracks matchas inom SCORED_MATCH_MM (liten radie)
        # så att en ny pil > 5 mm ifrån en scorad skapar en ny track istället för att slås ihop
        costs = []
        for di, det in enumerate(detections):
            if "board_x_mm" not in det or det["board_x_mm"] is None:
                continue
            for ti, track in enumerate(self.tracks):
                threshold = SCORED_MATCH_MM if track.scored else TRACK_MATCH_MM
                d = dist_mm(
                    (det["board_x_mm"], det["board_y_mm"]),
                    (track.smooth_x, track.smooth_y)
                )
                if d < threshold:
                    costs.append((d, di, ti))

        # Sortera på avstånd, greedy match
        costs.sort(key=lambda x: x[0])
        for _, di, ti in costs:
            if di in matched_dets or ti in matched_tracks:
                continue
            det = detections[di]
            self.tracks[ti].update(
                det["board_x_mm"], det["board_y_mm"],
                det["conf"], det["cam"], det
            )
            matched_tracks.add(ti)
            matched_dets.add(di)

        # Skapa nya tracks för omatchade detektioner
        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            if "board_x_mm" not in det or det["board_x_mm"] is None:
                continue
            if det["conf"] < CONF_DISPLAY_MIN:
                continue
            self.tracks.append(DartTrack(
                det["board_x_mm"], det["board_y_mm"],
                det["conf"], det["cam"], det
            ))

        # Åldra omatchade tracks
        for ti, track in enumerate(self.tracks):
            if ti not in matched_tracks:
                track.age += 1

        # Ta bort döda tracks
        self.tracks = [t for t in self.tracks if not t.is_dead]

        # Returnera bekräftade tracks
        return [t for t in self.tracks if t.is_confirmed]

    def clear(self):
        self.tracks.clear()

    @property
    def confirmed_count(self):
        return sum(1 for t in self.tracks if t.is_confirmed)

    @property
    def all_count(self):
        return len(self.tracks)


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

    def add_throw(self, zone, score, is_edge, cam="", x_mm=0.0, y_mm=0.0):
        self.throws.append((zone, score, is_edge, cam, x_mm, y_mm))
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
        for i, (zone, score, is_edge, cam, x_mm, y_mm) in enumerate(reversed(self.throws[-10:])):
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
# DEDUPLICATION (oförändrad men med ökad radie)
# ============================================================
def deduplicate_darts(detections):
    """
    Merge detektioner i board-space.
    - Samma kamera: DEDUP_SAME_CAM_MM (liten radie — förhindrar dubbla bbox för en pil)
    - Kors-kamera: DEDUP_CROSS_CAM_MM (större radie — hanterar kalibrerings-offset mellan L och R)
    Behåller detektionen med högst confidence vid merge.
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
            same_cam = det["cam"] == sorted_dets[j]["cam"]
            threshold = DEDUP_SAME_CAM_MM if same_cam else DEDUP_CROSS_CAM_MM
            d = dist_mm(
                (det["board_x_mm"], det["board_y_mm"]),
                (sorted_dets[j]["board_x_mm"], sorted_dets[j]["board_y_mm"]),
            )
            if d < threshold:
                used[j] = True

    return kept


# ============================================================
# DART DETECTOR (med adaptiv tip-lokalisering)
# ============================================================
class DartDetector:
    def __init__(self, model_path, conf=0.10, tip_offset=0.3):
        self.model = YOLO(model_path)
        self.conf = conf
        self.tip_offset = tip_offset
        print(f"YOLO: {self.model.names}  tip_offset: {tip_offset}")

    def detect(self, frame):
        results = self.model(frame, conf=self.conf, verbose=False)
        darts = []
        for box in results[0].boxes:
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox_w = x2 - x1
            bbox_h = y2 - y1

            # ---- Adaptiv tip-lokalisering ----
            # Aspect ratio ger info om pilens vinkel i bilden.
            # Hög/smal bbox → vertikal pil → spetsen sitter långt ner (offset ~0.1)
            # Bred/låg bbox → horisontell pil → spetsen nära mitten (offset ~0.4)
            aspect = bbox_w / max(bbox_h, 1.0)
            # Interpolera offset baserat på aspect ratio
            # aspect < 0.4 → vertikal (offset_low), aspect > 1.0 → horisontell (offset_high)
            offset_low = max(0.0, self.tip_offset - 0.15)   # mer mot botten
            offset_high = min(1.0, self.tip_offset + 0.10)   # mer mot mitten
            adaptive_offset = np.interp(aspect, [0.3, 1.0], [offset_low, offset_high])

            tip_x = (x1 + x2) / 2
            tip_y = y2 - bbox_h * adaptive_offset

            darts.append({
                "tip_x": tip_x,
                "tip_y": tip_y,
                "conf": conf,
                "bbox": (int(x1), int(y1), int(x2), int(y2)),
                "aspect": aspect,
                "adaptive_offset": adaptive_offset,
            })
        return darts


# ============================================================
# PIPELINE (v3 med tracker + debounce)
# ============================================================
class DartVisionPipeline:
    def __init__(self, model_path, calib_left_path=None, calib_right_path=None,
                 conf=0.10, tip_offset=0.3):
        self.detector = DartDetector(model_path, conf, tip_offset)
        self.calib_left = CameraCalibration(calib_left_path) if calib_left_path else None
        self.calib_right = CameraCalibration(calib_right_path) if calib_right_path else None
        self.scoreboard = ScoreBoard()
        self.board_overlay = create_board_overlay()
        self.tracker = DartTracker()

        # Debounce state
        self.prev_confirmed_count = 0
        self.stable_count = 0
        self.stable_frames = 0
        self.zero_frames = 0

        self.scored_events = []  # [[x_mm, y_mm, expire_time], ...]

        self.debug_mode = False
        self.frame_num = 0

    def process_frame(self, frame):
        self.frame_num += 1
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
                if x_mm is not None:  # Homografi-validering passerade
                    det["board_x_mm"] = x_mm
                    det["board_y_mm"] = y_mm
                    det["warped_px"] = self.calib_left.cam_to_warped_px(d["tip_x"], d["tip_y"])
                else:
                    det["_invalid_transform"] = True
            all_detections.append(det)

        for d in raw_right:
            det = {**d, "cam": "right", "x_offset": mid,
                   "tip_cam_x": d["tip_x"], "tip_cam_y": d["tip_y"]}
            if self.calib_right:
                x_mm, y_mm = self.calib_right.cam_to_board_mm(d["tip_x"], d["tip_y"])
                if x_mm is not None:
                    det["board_x_mm"] = x_mm
                    det["board_y_mm"] = y_mm
                    det["warped_px"] = self.calib_right.cam_to_warped_px(d["tip_x"], d["tip_y"])
                else:
                    det["_invalid_transform"] = True
            all_detections.append(det)

        # ---- Dedup (cross-camera) ----
        has_calib = self.calib_left or self.calib_right
        if has_calib:
            with_board = [d for d in all_detections
                          if "board_x_mm" in d and not d.get("_invalid_transform")]
            without_board = [d for d in all_detections if "board_x_mm" not in d]
            invalid = [d for d in all_detections if d.get("_invalid_transform")]
            merged = deduplicate_darts(with_board) + without_board
        else:
            merged = all_detections
            invalid = []

        # ---- Tracker update ----
        confirmed_tracks = self.tracker.update(merged)

        # ---- Annotate ----
        display = frame.copy()
        board = self.board_overlay.copy()

        # Dimmade raw-detektioner
        for d in all_detections:
            x1, y1, x2, y2 = d["bbox"]
            xo = d["x_offset"]
            col = COL_RED if d.get("_invalid_transform") else COL_DIM_GREEN
            cv2.rectangle(display, (x1 + xo - 8, y1 - 8),
                          (x2 + xo + 8, y2 + 8), col, 1)

        # Merged detektioner (alla)
        for d in merged:
            xo = d["x_offset"]
            tx = int(d["tip_cam_x"]) + xo
            ty = int(d["tip_cam_y"])
            conf = d["conf"]
            x1, y1, x2, y2 = d["bbox"]

            if conf < CONF_DISPLAY_MIN:
                continue

            color = COL_GREEN if conf >= CONF_SCORE_MIN else COL_YELLOW

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
                if conf < CONF_SCORE_MIN:
                    lbl_color = COL_GRAY  # under scoring-tröskel

                cv2.putText(display, label, (tx + 10, ty - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, lbl_color, 2)

                if self.debug_mode:
                    cv2.putText(display, f"a={d.get('aspect', 0):.2f} o={d.get('adaptive_offset', 0):.2f}",
                                (tx + 10, ty + 15),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.35, COL_CYAN, 1)

                wp = d.get("warped_px")
                if wp:
                    cv2.circle(board, wp, 6, COL_RED, -1)
                    cv2.circle(board, wp, 8, COL_WHITE, 1)
                    cv2.putText(board, f"{score}", (wp[0] + 10, wp[1] - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, lbl_color, 1)
            else:
                cv2.putText(display, f"{conf:.0%} [{cam_label}]", (tx + 10, ty - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

        # Rita bekräftade tracks på board med smoothad position
        for track in confirmed_tracks:
            sp = board_point_to_pixel(track.smooth_x, track.smooth_y)
            cv2.circle(board, sp, 4, COL_CYAN, -1)
            if track.scored:
                cv2.circle(board, sp, 10, COL_GREEN, 1)

        # ---- Debounced throw detection ----
        self._check_new_darts_debounced(confirmed_tracks)

        # ---- Info overlay ----
        raw_count = len(all_detections)
        dedup_count = len(merged)
        conf_count = len(confirmed_tracks)
        inv_count = len(invalid)

        if has_calib:
            info = f"Raw:{raw_count} Dedup:{dedup_count} Conf:{conf_count}"
            if inv_count > 0:
                info += f" Inv:{inv_count}"
        else:
            info = f"Darts: {raw_count}"

        cv2.putText(display, info, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, COL_GREEN, 2)

        if self.debug_mode:
            dbg = f"Stable:{self.stable_frames}/{STABLE_FRAMES_REQUIRED} Zero:{self.zero_frames}"
            cv2.putText(display, dbg, (10, 55),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, COL_CYAN, 1)
            trk = f"Tracks: {self.tracker.all_count} (conf: {self.tracker.confirmed_count})"
            cv2.putText(display, trk, (10, 75),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, COL_CYAN, 1)

        sb = self.scoreboard.draw(height=h)
        return display, board, sb

    def _check_new_darts_debounced(self, confirmed_tracks):
        """
        Debounced kast-registrering:
        1. Räkna bekräftade tracks
        2. Kräv STABLE_FRAMES_REQUIRED med samma antal innan scoring
        3. Registrera bara tracks med conf >= CONF_SCORE_MIN som inte redan scorats
        4. Kräv ZERO_FRAMES_REQUIRED med 0 tracks för ny runda
        """
        now = time.time()
        self.scored_events = [[x, y, t] for x, y, t in self.scored_events if t > now]

        current_count = len(confirmed_tracks)

        # ---- Stabilitetskontroll ----
        if current_count == self.stable_count:
            self.stable_frames += 1
        else:
            self.stable_count = current_count
            self.stable_frames = 0

        # ---- Ny runda: kräv flera frames med 0 darts ----
        if current_count == 0:
            self.zero_frames += 1
            if self.zero_frames >= ZERO_FRAMES_REQUIRED and self.prev_confirmed_count > 0:
                self.scored_events.clear()
                self.tracker.clear()
                self.prev_confirmed_count = 0
                self.stable_count = 0
                self.stable_frames = 0
                print("  --- Ny runda ---")
            return
        else:
            self.zero_frames = 0

        # ---- Vänta tills stabilt ----
        if self.stable_frames < STABLE_FRAMES_REQUIRED:
            return

        # ---- Kolla om nya pilar att registrera ----
        if current_count > self.prev_confirmed_count:
            new_dart_count = current_count - self.prev_confirmed_count
            print(f"\n  [NY PIL] {current_count} tracks bekräftade (var {self.prev_confirmed_count}), "
                  f"förväntar {new_dart_count} ny/nya:")
            for track in confirmed_tracks:
                r_debug = math.sqrt(track.smooth_x**2 + track.smooth_y**2)
                zi_debug = score_from_mm(track.smooth_x, track.smooth_y)
                print(f"    id={track.id} zone={zi_debug[0]} r={r_debug:.0f}mm "
                      f"pos=({track.smooth_x:.1f},{track.smooth_y:.1f})mm "
                      f"conf={track.conf:.2f} cam={track.cam} scored={track.scored}")

            # Steg 1: Samla kandidater — oskorade tracks med god conf
            candidates = []
            for track in confirmed_tracks:
                if track.scored:
                    continue
                if track.conf < CONF_SCORE_MIN:
                    print(f"    → id={track.id} HOPPAS ÖVER (conf={track.conf:.2f} < {CONF_SCORE_MIN})")
                    continue
                # Temporal dedup: blockera kors-kamera-duplikat av TIDIGARE pilar
                pos = (track.smooth_x, track.smooth_y)
                if any(dist_mm(pos, (x, y)) < SCORED_DEDUP_MM
                       for x, y, _ in self.scored_events):
                    print(f"    → id={track.id} TEMP-DEDUP (nära tidigare registrerad position)")
                    track.scored = True
                    continue
                candidates.append(track)

            # Steg 2: Sortera på conf (bäst först); begränsa till new_dart_count.
            # Detta är det primära skyddet mot kors-kamera-duplikat: om count ökar
            # med 1 men BÅDA kamerornas tracks bekräftas denna cykel, scoreas bara
            # den med högst conf — oavsett positionsavstånd.
            candidates.sort(key=lambda t: -t.conf)

            scored_this_cycle = []
            for track in candidates:
                if len(scored_this_cycle) >= new_dart_count:
                    track.scored = True
                    print(f"    → id={track.id} RÄKNAR-DEDUP (max {new_dart_count} ny/cykel, "
                          f"cam={track.cam}, conf={track.conf:.2f})")
                    continue

                zone, score, mult, sector, r_mm, angle, is_edge = \
                    score_from_mm(track.smooth_x, track.smooth_y)

                # MISS-suppression: undertryck om annan kamera scorar giltig träff denna cykel
                if zone == "MISS":
                    other_cams_valid = [
                        score_from_mm(t.smooth_x, t.smooth_y)[0]
                        for t in candidates
                        if t is not track and t.cam != track.cam
                    ]
                    if any(z != "MISS" for z in other_cams_valid):
                        track.scored = True
                        print(f"    → id={track.id} MISS UNDERTRYCKT "
                              f"(annan kamera: {other_cams_valid})")
                        continue

                self.scoreboard.add_throw(zone, score, is_edge, track.cam,
                                          track.smooth_x, track.smooth_y)
                track.scored = True
                scored_this_cycle.append(track)
                self.scored_events.append([track.smooth_x, track.smooth_y,
                                           time.time() + SCORED_DEDUP_SECS])
                print(f"  ✓ KAST: {zone} = {score} (cam={track.cam}) "
                      f"[r={r_mm:.0f}mm, conf={track.conf:.2f}, hits={track.hits}]")

            self.prev_confirmed_count = current_count


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="DartVision v3 (optimerad)")
    parser.add_argument("--video", type=str)
    parser.add_argument("--camera", type=int)
    parser.add_argument("--model", type=str, default="best.pt")
    parser.add_argument("--calib_left", type=str, default=None)
    parser.add_argument("--calib_right", type=str, default=None)
    parser.add_argument("--conf", type=float, default=0.10)
    parser.add_argument("--tip_offset", type=float, default=0.3,
                        help="Spets-offset i bbox (0.0=botten, 0.5=mitten)")
    parser.add_argument("--save", type=str)
    parser.add_argument("--debug", action="store_true", help="Visa debug-info")
    args = parser.parse_args()

    if args.calib_left is None and Path("calib_left.json").exists():
        args.calib_left = "calib_left.json"
        print(f"Auto: {args.calib_left}")
    if args.calib_right is None and Path("calib_right.json").exists():
        args.calib_right = "calib_right.json"
        print(f"Auto: {args.calib_right}")

    if not args.calib_left and not args.calib_right:
        print("OBS: Ingen kalibrering – kör utan scoring/dedup.\n")

    pipeline = DartVisionPipeline(
        model_path=args.model,
        calib_left_path=args.calib_left,
        calib_right_path=args.calib_right,
        conf=args.conf,
        tip_offset=args.tip_offset,
    )
    pipeline.debug_mode = args.debug

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

    print(f"\nDartVision v3 (optimerad)")
    print(f"  Feed:    {f_w}x{f_h} @ {fps:.0f}fps")
    print(f"  Conf:    display>{CONF_DISPLAY_MIN}  score>{CONF_SCORE_MIN}")
    print(f"  Dedup:   same-cam={DEDUP_SAME_CAM_MM}mm  cross-cam={DEDUP_CROSS_CAM_MM}mm  "
          f"temporal={SCORED_DEDUP_MM}mm/{SCORED_DEDUP_SECS}s")
    print(f"  Tracker: match={TRACK_MATCH_MM}mm (scorad:{SCORED_MATCH_MM}mm)  "
          f"min_hits={TRACK_MIN_HITS}  max_age={TRACK_MAX_AGE}  alpha={TRACK_SMOOTH_ALPHA}")
    print(f"  Stabil:  {STABLE_FRAMES_REQUIRED} frames  Zero: {ZERO_FRAMES_REQUIRED} frames")
    print(f"  Tip:     offset={args.tip_offset} (adaptiv)")
    print(f"  Kalib:   L={'JA' if args.calib_left else 'NEJ'} "
          f"R={'JA' if args.calib_right else 'NEJ'}")
    print(f"\n  q=avsluta  +/-=conf  w/s=tip  r=reset  p=paus  d=debug  t=tracker\n")

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
            pipeline.tracker.clear()
            pipeline.prev_confirmed_count = 0
            pipeline.stable_count = 0
            pipeline.stable_frames = 0
            pipeline.zero_frames = 0
            print("  Score reset!")
        elif key == ord('w'):
            pipeline.detector.tip_offset = min(1.0, pipeline.detector.tip_offset + 0.05)
            print(f"  tip_offset = {pipeline.detector.tip_offset:.2f}")
        elif key == ord('s'):
            pipeline.detector.tip_offset = max(0.0, pipeline.detector.tip_offset - 0.05)
            print(f"  tip_offset = {pipeline.detector.tip_offset:.2f}")
        elif key == ord('d'):
            pipeline.debug_mode = not pipeline.debug_mode
            print(f"  Debug: {'ON' if pipeline.debug_mode else 'OFF'}")
        elif key == ord('t'):
            print(f"  Tracker: {pipeline.tracker.all_count} tracks, "
                  f"{pipeline.tracker.confirmed_count} confirmed")
            for t in pipeline.tracker.tracks:
                zone = score_from_mm(t.smooth_x, t.smooth_y)[0]
                print(f"    #{t.id}: {zone} conf={t.conf:.2f} hits={t.hits} "
                      f"age={t.age} scored={t.scored}")

    cap.release()
    if writer:
        writer.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()