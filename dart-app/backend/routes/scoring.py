"""
DartVision — WebSocket scoring + reset
"""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from state import state
from dartvision_score import ScoreBoard

router = APIRouter(tags=["scoring"])


@router.websocket("/ws/scoring")
async def websocket_scoring(ws: WebSocket):
    """Pushbaserad scoring-data: dart-positioner, kast-events, state.

    Skickar ~10 ggr/sekund:
    - type "state": darts[], throws[], total, fps, kalibreringsinfo
    - type "throw": enstaka kast-event (för animation/ljud)
    """
    await ws.accept()
    last_idx = 0

    try:
        while True:
            with state.lock:
                msg = {
                    "type": "state",
                    "darts": state.darts,
                    "throws": state.throws[-20:],
                    "total": state.total_score,
                    "fps": round(state.fps, 1),
                    "has_calibration": state.has_calibration,
                    "running": state.running,
                    "calib_left": state.calib_left_ok,
                    "calib_right": state.calib_right_ok,
                }
                evts = list(state.event_queue)
                new = evts[last_idx:]
                last_idx = len(evts)

            await ws.send_json(msg)

            # Skicka nya throw-events separat (för frontend-animationer)
            for e in new:
                await ws.send_json(e)

            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"❌ WS /ws/scoring fel: {type(e).__name__}: {e}")


@router.post("/api/reset")
async def reset_scores():
    """Nollställ all scoring-data och tracker-state."""
    with state.lock:
        if state.pipeline:
            state.pipeline.scoreboard = ScoreBoard()
            state.pipeline.scored_positions.clear()
            state.pipeline.tracker.clear()
            state.pipeline.prev_confirmed_count = 0
            state.pipeline.stable_count = 0
            state.pipeline.stable_frames = 0
            state.pipeline.zero_frames = 0
        state.throws = []
        state.total_score = 0
        state.darts = []
        state.event_queue.clear()

    return JSONResponse({"status": "ok"})
