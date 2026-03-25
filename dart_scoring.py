"""
DartVision – Matematisk scoring (r, θ)
========================================
Importera och använd med homography-kalibrering.

Exempel:
    from dart_scoring import DartScorer

    scorer = DartScorer("calibration.json")
    
    # Från kamerapixel → poäng
    result = scorer.score_from_camera_pixel(x, y)
    print(result)  # {'zone': 'Triple 20', 'score': 60, 'sector': 20, ...}
    
    # Eller direkt från tavlkoordinater (mm)
    result = scorer.score_from_mm(x_mm, y_mm)
"""

import math
import json
import numpy as np
import cv2
from dataclasses import dataclass
from typing import Optional

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
SECTOR_ANGLE = 18.0  # grader


@dataclass
class DartResult:
    zone: str           # "Triple 20", "Double Bull", "Miss", etc.
    score: int          # Totalpoäng för kastet
    sector: int         # Sektornummer (1-20, 25 för bull)
    multiplier: int     # 1=single, 2=double, 3=triple
    r_mm: float         # Avstånd från centrum (mm)
    angle_deg: float    # Vinkel (grader, 0=upp, medurs)
    board_x_mm: float   # X i tavlkoordinater
    board_y_mm: float   # Y i tavlkoordinater
    confidence: str     # "solid", "edge_case" (nära linjerna)

    def __str__(self):
        return f"{self.zone} = {self.score}"

    def to_dict(self):
        return {
            "zone": self.zone,
            "score": self.score,
            "sector": self.sector,
            "multiplier": self.multiplier,
            "r_mm": round(self.r_mm, 1),
            "angle_deg": round(self.angle_deg, 1),
            "confidence": self.confidence,
        }


# ============================================================
# WIRE-TOLERANS
# ============================================================
# Darttavlans trådar (wires) har en bredd.
# Om pilen landar nära en trådgräns → markera som "edge_case"
WIRE_TOLERANCE_MM = 2.0  # ±2mm från valfri gräns


def _near_boundary(r_mm, angle_deg):
    """Kolla om positionen är nära en linje/gräns."""
    # Radiella gränser
    boundaries = [BULL_RADIUS, OUTER_BULL_RADIUS, TRIPLE_INNER,
                  TRIPLE_OUTER, DOUBLE_INNER, DOUBLE_OUTER]
    for b in boundaries:
        if abs(r_mm - b) < WIRE_TOLERANCE_MM:
            return True

    # Sektorgränser (var 18:e grad, offsettade 9° från sektormitten)
    normalized = angle_deg % SECTOR_ANGLE
    if normalized < WIRE_TOLERANCE_MM / 2 or (SECTOR_ANGLE - normalized) < WIRE_TOLERANCE_MM / 2:
        return True

    return False


# ============================================================
# SCORER
# ============================================================

class DartScorer:
    def __init__(self, calibration_path: Optional[str] = None):
        """
        Args:
            calibration_path: Sökväg till calibration.json (från dart_calibration.py)
                              Om None → kan bara använda score_from_mm()
        """
        self.H = None
        self.board_size = 800
        self.board_center = 400.0
        self.board_scale = 1.0

        if calibration_path:
            self._load_calibration(calibration_path)

    def _load_calibration(self, path):
        with open(path) as f:
            data = json.load(f)
        self.H = np.array(data["homography"], dtype=np.float64)
        self.board_size = data.get("board_size", 800)
        self.board_center = data.get("board_center", 400.0)
        self.board_scale = data.get("board_scale", 1.0)

    def score_from_camera_pixel(self, cam_x, cam_y) -> DartResult:
        """
        Beräkna poäng från en pixel i kamerabilden.
        Kräver att kalibrering är laddad.
        """
        if self.H is None:
            raise RuntimeError("Ingen kalibrering laddad!")

        # Transformera genom homography
        pt = np.array([[[cam_x, cam_y]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt, self.H)[0][0]

        # Warped pixel → tavlkoordinater (mm)
        x_mm = (warped[0] - self.board_center) / self.board_scale
        y_mm = -(warped[1] - self.board_center) / self.board_scale

        return self.score_from_mm(x_mm, y_mm)

    def score_from_mm(self, x_mm, y_mm) -> DartResult:
        """Beräkna poäng från tavlkoordinater (mm, 0,0 = centrum)."""

        r = math.sqrt(x_mm**2 + y_mm**2)

        # Vinkel: 0° = upp (20), medurs
        angle = math.degrees(math.atan2(x_mm, y_mm))
        if angle < 0:
            angle += 360

        # Sektor
        sector_idx = int((angle + SECTOR_ANGLE / 2) % 360 / SECTOR_ANGLE)
        sector = SECTORS[sector_idx]

        # Confidence
        confidence = "edge_case" if _near_boundary(r, angle) else "solid"

        # Ring → poäng
        if r <= BULL_RADIUS:
            return DartResult("Double Bull", 50, 25, 2, r, angle,
                              x_mm, y_mm, confidence)
        elif r <= OUTER_BULL_RADIUS:
            return DartResult("Single Bull", 25, 25, 1, r, angle,
                              x_mm, y_mm, confidence)
        elif r <= TRIPLE_INNER:
            return DartResult(f"Single {sector}", sector, sector, 1, r, angle,
                              x_mm, y_mm, confidence)
        elif r <= TRIPLE_OUTER:
            return DartResult(f"Triple {sector}", sector * 3, sector, 3, r, angle,
                              x_mm, y_mm, confidence)
        elif r <= DOUBLE_INNER:
            return DartResult(f"Single {sector}", sector, sector, 1, r, angle,
                              x_mm, y_mm, confidence)
        elif r <= DOUBLE_OUTER:
            return DartResult(f"Double {sector}", sector * 2, sector, 2, r, angle,
                              x_mm, y_mm, confidence)
        else:
            return DartResult("Miss", 0, 0, 0, r, angle,
                              x_mm, y_mm, "solid")

    def score_batch(self, points_mm):
        """Beräkna poäng för flera punkter. Input: list of (x_mm, y_mm)."""
        return [self.score_from_mm(x, y) for x, y in points_mm]


# ============================================================
# SNABB-TEST
# ============================================================

if __name__ == "__main__":
    scorer = DartScorer()

    # Testa kända positioner
    tests = [
        (0, 0, "Double Bull (50)"),
        (0, 10, "Single Bull (25)"),
        (0, 103, "Triple 20 (60)"),
        (0, 50, "Single 20 inner"),
        (0, 140, "Single 20 outer"),
        (0, 166, "Double 20 (40)"),
        (103, 0, "Triple 6 (18)"),
        (0, -103, "Triple 3 (9)"),
        (-103, 0, "Triple 10 (30)"),
        (0, 200, "Miss"),
    ]

    print("=== Scoring Test ===\n")
    for x, y, expected in tests:
        result = scorer.score_from_mm(x, y)
        status = "✓" if result.confidence == "solid" else "⚠ edge"
        print(f"  ({x:>4}, {y:>4}) → {result.zone:<20} = {result.score:>3}  "
              f"[{status}]  (förväntat: {expected})")
