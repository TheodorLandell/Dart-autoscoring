"""
DartVision — Geometri-hjälpfunktioner för darttavlan
"""

import math
from config import (
    SECTORS, SECTOR_ANGLE, DOUBLE_OUTER, TRIPLE_OUTER,
    BOARD_CENTER, BOARD_SCALE,
)


def polar_to_cart(radius_mm: float, angle_deg: float) -> tuple[float, float]:
    """Konvertera polär (radie mm, vinkel grader) → kartesiska (x_mm, y_mm)."""
    rad = math.radians(-(angle_deg - 90))
    return (radius_mm * math.cos(rad), radius_mm * math.sin(rad))


def sector_angle_deg(sector_number: int) -> float:
    """Hämta sektorns vinkel i grader givet numret (20, 1, 18, ...)."""
    idx = SECTORS.index(sector_number)
    return idx * SECTOR_ANGLE


def board_mm_to_pixel(x_mm: float, y_mm: float) -> tuple[float, float]:
    """Board mm-koordinat → pixel-koordinat i board-bilden (800×800)."""
    px = BOARD_CENTER + x_mm * BOARD_SCALE
    py = BOARD_CENTER - y_mm * BOARD_SCALE
    return (px, py)


def mm_to_svg(x_mm: float, y_mm: float) -> tuple[float, float]:
    """Board mm → SVG-koordinat i 400×400 viewBox (för frontend-rendering)."""
    return round(200.0 + x_mm, 1), round(200.0 - y_mm, 1)


def generate_reference_points() -> list[dict]:
    """Generera 41 referenspunkter: Bull + 20 Double + 20 Triple.
    Samma ordning som Python-kalibreringen förväntar sig."""
    points = []

    # 1. Bull (centrum)
    points.append({
        "name": "BULL (centrum)",
        "x_mm": 0.0, "y_mm": 0.0,
        "phase": "bull",
    })

    # 2–21. Double (yttre tråden) — alla 20 sektorer
    for s in SECTORS:
        a = sector_angle_deg(s)
        x, y = polar_to_cart(DOUBLE_OUTER, a)
        points.append({
            "name": f"Double {s}",
            "x_mm": x, "y_mm": y,
            "phase": "double",
        })

    # 22–41. Triple (inre tråden) — alla 20 sektorer
    for s in SECTORS:
        a = sector_angle_deg(s)
        x, y = polar_to_cart(TRIPLE_OUTER, a)
        points.append({
            "name": f"Triple {s}",
            "x_mm": x, "y_mm": y,
            "phase": "triple",
        })

    return points
