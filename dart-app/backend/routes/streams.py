"""
DartVision — MJPEG streaming endpoints
"""

import time
import cv2
import numpy as np
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from state import state

router = APIRouter(tags=["streams"])


def _generate_mjpeg(source: str):
    """Generator som yieldar MJPEG-frames i en oändlig loop."""
    while True:
        with state.lock:
            frame = {
                "camera": state.frame_camera,
                "board": state.frame_board,
                "left": state.frame_left,
                "right": state.frame_right,
            }.get(source)

        if frame is None:
            # Placeholder-bild medan kameran startar
            ph = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(ph, "Vantar pa kamera...", (120, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (100, 100, 100), 2)
            _, jpg = cv2.imencode('.jpg', ph)
            frame = jpg.tobytes()

        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        time.sleep(0.033)  # ~30 fps


@router.get("/stream/camera")
async def stream_camera():
    return StreamingResponse(
        _generate_mjpeg("camera"),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/stream/board")
async def stream_board():
    return StreamingResponse(
        _generate_mjpeg("board"),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/stream/left")
async def stream_left():
    return StreamingResponse(
        _generate_mjpeg("left"),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/stream/right")
async def stream_right():
    return StreamingResponse(
        _generate_mjpeg("right"),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/snapshot/{camera}")
async def snapshot(camera: str):
    """Enstaka JPEG-frame (för kalibrering etc.)."""
    from fastapi.responses import Response
    with state.lock:
        frame = state.frame_left if camera == "left" else state.frame_right
    if frame is None:
        return Response(status_code=503, content="Ingen frame")
    return Response(
        content=frame,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache, no-store"},
    )
