"""
DartVision — Pipeline-tråd (kamera → YOLO → scoring)

Kör i en separat tråd, uppdaterar SharedState med frames, darts och events.
"""

import time

import cv2
import numpy as np

from state import state
from dartvision_score import DartVisionPipeline, score_from_mm
from utils.geometry import mm_to_svg


def run_pipeline(
    cam_index: int,
    cam2_index: int | None,
    model_path: str,
    calib_left: str | None,
    calib_right: str | None,
    tip_offset: float,
    conf: float,
):
    """Huvudloop: läser frames, kör YOLO, uppdaterar state.

    Designad att köras i en daemon-tråd via threading.Thread.
    """
    print(f"\n{'='*50}")
    print(f"  DartVision Pipeline")
    print(f"  Kamera: {cam_index}" + (f" + {cam2_index}" if cam2_index is not None else " (dual-feed)"))
    print(f"  Modell: {model_path}")
    print(f"  Kalib:  L={'JA' if calib_left else 'NEJ'} R={'JA' if calib_right else 'NEJ'}")
    print(f"{'='*50}\n")

    # Öppna kameror
    cap = cv2.VideoCapture(cam_index)
    if not cap.isOpened():
        print(f"❌ Kan inte öppna kamera {cam_index}")
        return

    cap2 = None
    if cam2_index is not None:
        cap2 = cv2.VideoCapture(cam2_index)
        if not cap2.isOpened():
            print(f"❌ Kan inte öppna kamera 2 ({cam2_index})")
            cap.release()
            return

    # Initiera YOLO-pipeline
    pipeline = DartVisionPipeline(
        model_path=model_path,
        calib_left_path=calib_left,
        calib_right_path=calib_right,
        conf=conf,
        tip_offset=tip_offset,
    )

    with state.lock:
        state.running = True
        state.camera_ok = True
        state.two_cameras = cap2 is not None
        state.has_calibration = bool(calib_left or calib_right)
        state.calib_left_ok = bool(calib_left)
        state.calib_right_ok = bool(calib_right)
        state.pipeline = pipeline

    print("✅ Pipeline igång!")
    prev_throw_count = 0
    frame_count = 0
    fps_time = time.time()

    while state.running:
        ret, frame_left_raw = cap.read()
        if not ret:
            time.sleep(0.01)
            continue

        # Hantera två kameror eller dual-feed (en bred bild)
        frame_right_raw = None
        if cap2 is not None:
            ret2, frame_right_raw = cap2.read()
            if not ret2:
                time.sleep(0.01)
                continue
            # Matcha höjd
            h1, w1 = frame_left_raw.shape[:2]
            h2, w2 = frame_right_raw.shape[:2]
            th = max(h1, h2)
            if h1 != th:
                frame_left_raw = cv2.resize(frame_left_raw, (int(w1 * th / h1), th))
            if h2 != th:
                frame_right_raw = cv2.resize(frame_right_raw, (int(w2 * th / h2), th))
            combined = np.hstack([frame_left_raw, frame_right_raw])
        else:
            # En kamera med dual-feed (sida vid sida)
            h, w = frame_left_raw.shape[:2]
            mid = w // 2
            combined = frame_left_raw.copy()
            frame_right_raw = frame_left_raw[:, mid:]
            frame_left_raw = frame_left_raw[:, :mid]

        # Encode individuella kameraframes (för streaming/kalibrering)
        _, left_jpg = cv2.imencode('.jpg', frame_left_raw, [cv2.IMWRITE_JPEG_QUALITY, 85])
        _, right_jpg = cv2.imencode('.jpg', frame_right_raw, [cv2.IMWRITE_JPEG_QUALITY, 85])

        # Kör YOLO-pipeline på kombinerad bild
        display, board, sb = pipeline.process_frame(combined)
        _, cam_jpg = cv2.imencode('.jpg', display, [cv2.IMWRITE_JPEG_QUALITY, 70])
        _, board_jpg = cv2.imencode('.jpg', board, [cv2.IMWRITE_JPEG_QUALITY, 80])

        # Bygg dart-state från tracker
        # OBS: Explicit cast till Python-typer — numpy float64/bool är inte JSON-serialiserbara
        darts = []
        for track in pipeline.tracker.tracks:
            if track.is_confirmed:
                zi = score_from_mm(track.smooth_x, track.smooth_y)
                sx, sy = mm_to_svg(track.smooth_x, track.smooth_y)
                darts.append({
                    "zone": str(zi[0]),
                    "score": int(zi[1]),
                    "x_mm": float(round(float(track.smooth_x), 1)),
                    "y_mm": float(round(float(track.smooth_y), 1)),
                    "svg_x": float(sx),
                    "svg_y": float(sy),
                    "cam": str(track.cam) if track.cam is not None else None,
                    "conf": float(round(float(track.conf), 2)),
                    "scored": bool(track.scored),
                    "is_edge": bool(zi[6]),
                })

        # Nya kast-events (för WebSocket push)
        current_throws = pipeline.scoreboard.throws
        new_events = []
        for zone, score, is_edge, cam, x_mm, y_mm in current_throws[prev_throw_count:]:
            new_events.append({
                "type": "throw",
                "zone": str(zone),
                "score": int(score),
                "is_edge": bool(is_edge),
                "cam": str(cam) if cam is not None else None,
                "x_mm": float(round(float(x_mm), 1)),
                "y_mm": float(round(float(y_mm), 1)),
                "total": int(pipeline.scoreboard.total),
                "timestamp": float(time.time()),
            })
        prev_throw_count = len(current_throws)

        # FPS-beräkning
        frame_count += 1
        elapsed = time.time() - fps_time
        fps = (frame_count / elapsed) if elapsed >= 1.0 else state.fps
        if elapsed >= 1.0:
            frame_count = 0
            fps_time = time.time()

        # Platta kast-listan
        throws_list = [
            {"zone": str(z), "score": int(s), "is_edge": bool(e),
             "cam": str(c) if c is not None else None,
             "x_mm": float(x), "y_mm": float(y)}
            for z, s, e, c, x, y in current_throws
        ]

        # Uppdatera delat state (thread-safe)
        with state.lock:
            state.frame_camera = cam_jpg.tobytes()
            state.frame_board = board_jpg.tobytes()
            state.frame_left = left_jpg.tobytes()
            state.frame_right = right_jpg.tobytes()
            state.frame_left_shape = frame_left_raw.shape[:2]
            state.frame_right_shape = frame_right_raw.shape[:2]
            state.darts = darts
            state.throws = throws_list
            state.total_score = pipeline.scoreboard.total
            state.fps = fps
            for evt in new_events:
                state.event_queue.append(evt)

        time.sleep(0.005)

    # Cleanup
    cap.release()
    if cap2:
        cap2.release()
