"""
DartVision — Status endpoint
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from state import state

router = APIRouter(tags=["status"])


@router.get("/status")
async def get_status():
    """Allmän systemstatus: kameror, kalibrering, FPS."""
    with state.lock:
        return JSONResponse({
            "running": state.running,
            "camera_ok": state.camera_ok,
            "two_cameras": state.two_cameras,
            "has_calibration": state.has_calibration,
            "calib_left": state.calib_left_ok,
            "calib_right": state.calib_right_ok,
            "fps": round(state.fps, 1),
            "frame_left_shape": list(state.frame_left_shape),
            "frame_right_shape": list(state.frame_right_shape),
        })
