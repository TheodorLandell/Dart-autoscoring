"""
DartVision — Delat state mellan pipeline-tråd och API-endpoints
"""

import threading
from collections import deque


class SharedState:
    """Thread-safe container för allt som delas mellan pipeline och HTTP/WS."""

    def __init__(self):
        self.lock = threading.Lock()

        # JPEG-encoded frames
        self.frame_camera: bytes | None = None
        self.frame_board: bytes | None = None
        self.frame_left: bytes | None = None
        self.frame_right: bytes | None = None

        # Frame dimensions (for calibration)
        self.frame_left_shape: tuple = (480, 640)
        self.frame_right_shape: tuple = (480, 640)

        # Live dart positions + scoring
        self.darts: list[dict] = []
        self.throws: list[dict] = []
        self.total_score: int = 0

        # Event queue for WebSocket push
        self.event_queue: deque = deque(maxlen=200)

        # Status flags
        self.running: bool = False
        self.has_calibration: bool = False
        self.calib_left_ok: bool = False
        self.calib_right_ok: bool = False
        self.fps: float = 0.0
        self.camera_ok: bool = False
        self.two_cameras: bool = False

        # Reference to pipeline (set by pipeline_thread)
        self.pipeline = None


# Singleton — importeras av alla moduler
state = SharedState()
