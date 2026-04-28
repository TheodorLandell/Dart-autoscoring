"""
DartVision — Server Entry Point
=================================
Modulär FastAPI-backend: YOLO-pipeline + kalibrering + live scoring.

Starta:
    cd backend
    python main.py --camera 0 --camera2 2 --model best.pt

Endpoints:
    GET  /api/stream/camera     → MJPEG (annoterad combined feed)
    GET  /api/stream/board      → MJPEG (board overlay)
    GET  /api/stream/left       → MJPEG (vänster kamera, ren)
    GET  /api/stream/right      → MJPEG (höger kamera, ren)
    GET  /api/snapshot/{cam}    → Enstaka JPEG
    WS   /ws/scoring            → WebSocket (kast-events + state)
    POST /api/reset             → Nollställ scores
    POST /api/calibrate         → Beräkna homografi + spara
    GET  /api/calibration/status→ Kalibreringsstatus
    GET  /api/calibration/reference-points → 41 referenspunkter
    GET  /api/status            → Allmän status
"""

import argparse
import threading
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import DEFAULT_PORT, DEFAULT_CONF, DEFAULT_TIP_OFFSET, DEFAULT_MODEL, DEFAULT_CAMERA, DEFAULT_CAMERA2
from state import state
from routes import register_routes
from pipeline_thread import run_pipeline


def create_app() -> FastAPI:
    """Skapa och konfigurera FastAPI-appen."""
    app = FastAPI(title="DartVision Server", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)

    @app.on_event("shutdown")
    async def shutdown():
        state.running = False

    return app


app = create_app()


def _camera_arg(value: str):
    """Tolka kameraargument: heltal för USB-kamera, sträng för IP/URL-kamera."""
    try:
        return int(value)
    except ValueError:
        return value


def main():
    parser = argparse.ArgumentParser(description="DartVision Server")
    parser.add_argument("--camera", type=_camera_arg, default=DEFAULT_CAMERA,
                        help="Primär kamera: index (0) eller URL (http://...)")
    parser.add_argument("--camera2", type=_camera_arg, default=DEFAULT_CAMERA2,
                        help="Sekundär kamera: index eller URL (None = inaktiverad)")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL,
                        help="Sökväg till YOLO-modell (default: best.pt)")
    parser.add_argument("--calib_left", type=str, default=None,
                        help="Kalibreringsfil vänster kamera")
    parser.add_argument("--calib_right", type=str, default=None,
                        help="Kalibreringsfil höger kamera")
    parser.add_argument("--conf", type=float, default=DEFAULT_CONF,
                        help="YOLO confidence threshold")
    parser.add_argument("--tip_offset", type=float, default=DEFAULT_TIP_OFFSET,
                        help="Pilspets-offset i bounding box")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help="Server-port (default: 8000)")
    args = parser.parse_args()

    # Auto-detect kalibreringsffiler
    if args.calib_left is None and Path("calib_left.json").exists():
        args.calib_left = "calib_left.json"
    if args.calib_right is None and Path("calib_right.json").exists():
        args.calib_right = "calib_right.json"

    # Kolla att modellen finns
    if not Path(args.model).exists():
        print(f"❌ Modell saknas: {args.model}")
        print(f"   Kopiera din YOLO-modell hit: {Path(args.model).resolve()}")
        return

    # Starta pipeline i bakgrundstråd
    threading.Thread(
        target=run_pipeline,
        args=(
            args.camera, args.camera2, args.model,
            args.calib_left, args.calib_right,
            args.tip_offset, args.conf,
        ),
        daemon=True,
    ).start()

    print(f"\n  🌐 http://localhost:{args.port}")
    print(f"  📡 ws://localhost:{args.port}/ws/scoring\n")

    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
