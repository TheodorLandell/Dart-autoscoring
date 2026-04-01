"""
DartVision — Kalibrerings-endpoints
"""

import json
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from state import state
from config import BOARD_SIZE, BOARD_SCALE, BOARD_CENTER
from utils.geometry import (
    generate_reference_points,
    board_mm_to_pixel,
    mm_to_svg,
)

router = APIRouter(tags=["calibration"])


@router.get("/calibration/status")
async def calibration_status():
    """Returnera aktuell kalibreringsstatus för båda kamerorna."""
    with state.lock:
        return JSONResponse({
            "left": {
                "exists": Path("calib_left.json").exists(),
                "loaded": state.calib_left_ok,
            },
            "right": {
                "exists": Path("calib_right.json").exists(),
                "loaded": state.calib_right_ok,
            },
            "has_calibration": state.has_calibration,
        })


@router.get("/calibration/reference-points")
async def get_reference_points():
    """Returnera alla 41 referenspunkter med SVG-koordinater."""
    pts = generate_reference_points()
    result = []
    for p in pts:
        sx, sy = mm_to_svg(p["x_mm"], p["y_mm"])
        result.append({
            "name": p["name"],
            "phase": p["phase"],
            "x_mm": round(p["x_mm"], 2),
            "y_mm": round(p["y_mm"], 2),
            "svg_x": sx,
            "svg_y": sy,
        })
    return JSONResponse({"points": result, "total": len(result)})


@router.post("/calibrate")
async def calibrate(request: Request):
    """Ta emot 41 klickpunkter, beräkna homografi, spara till JSON.

    Body: { "camera": "left"|"right", "points": [{x, y} | null, ...] }

    Returnerar inliers, medelfel, filnamn etc.
    """
    body = await request.json()
    camera = body.get("camera")
    points = body.get("points", [])

    # Validering
    if camera not in ("left", "right"):
        return JSONResponse(
            {"error": "camera måste vara 'left' eller 'right'"},
            status_code=400,
        )

    ref_points = generate_reference_points()
    if len(points) != len(ref_points):
        return JSONResponse(
            {"error": f"Förväntar {len(ref_points)} punkter, fick {len(points)}"},
            status_code=400,
        )

    # Bygg src (kamera-pixlar) och dst (board-pixlar) arrays
    src_pts, dst_pts, skipped = [], [], 0
    for i, pt in enumerate(points):
        if pt is None:
            skipped += 1
            continue
        ref = ref_points[i]
        bx, by = board_mm_to_pixel(ref["x_mm"], ref["y_mm"])
        src_pts.append([pt["x"], pt["y"]])
        dst_pts.append([bx, by])

    if len(src_pts) < 8:
        return JSONResponse(
            {"error": f"Minst 8 punkter krävs ({len(src_pts)} klickade)"},
            status_code=400,
        )

    # Beräkna homografi med RANSAC
    src = np.array(src_pts, dtype=np.float64)
    dst = np.array(dst_pts, dtype=np.float64)
    H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)

    if H is None:
        return JSONResponse({"error": "Homografi misslyckades"}, status_code=400)

    # Beräkna kvalitetsmått
    inliers = int(mask.ravel().sum())
    src_h = np.hstack([src, np.ones((len(src), 1))])
    projected = (H @ src_h.T).T
    projected = projected[:, :2] / projected[:, 2:3]
    errors = np.sqrt(np.sum((projected - dst) ** 2, axis=1))
    mean_err = float(np.mean(errors))
    max_err = float(np.max(errors))

    # Spara till JSON
    filename = f"calib_{camera}.json"
    with state.lock:
        fshape = state.frame_left_shape if camera == "left" else state.frame_right_shape

    data = {
        "camera": camera,
        "homography": H.tolist(),
        "src_points": src.tolist(),
        "dst_points": dst.tolist(),
        "image_shape": list(fshape),
        "board_size": int(BOARD_SIZE),
        "board_scale": float(BOARD_SCALE),
        "board_center": float(BOARD_CENTER),
    }
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)

    print(f"✅ Kalibrering sparad: {filename} "
          f"({inliers}/{len(src_pts)} inliers, err={mean_err:.1f}px)")

    # Hot-reload kalibrering i pipelinen (utan omstart)
    _reload_calibration(camera, filename)

    return JSONResponse({
        "status": "ok",
        "camera": camera,
        "filename": filename,
        "inliers": inliers,
        "total_points": len(src_pts),
        "skipped": skipped,
        "mean_error_px": round(mean_err, 2),
        "max_error_px": round(max_err, 2),
    })


def _reload_calibration(camera: str, filename: str):
    """Ladda om kalibrering i den körande pipelinen."""
    from dartvision_score import CameraCalibration

    with state.lock:
        if state.pipeline:
            try:
                if camera == "left":
                    state.pipeline.calib_left = CameraCalibration(filename)
                    state.calib_left_ok = True
                else:
                    state.pipeline.calib_right = CameraCalibration(filename)
                    state.calib_right_ok = True
                state.has_calibration = True
            except Exception as e:
                print(f"  ⚠️ Reload failed: {e}")
