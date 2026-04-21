# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**DartVision** is a real-time automated dart scoring system. Computer vision (Ultralytics YOLO) detects darts in camera frames; a homography matrix maps pixel coordinates to dartboard millimeters; a scoring function converts mm coordinates to zones (e.g. `"T20"`, `"D-Bull"`). A React frontend communicates with a FastAPI backend via WebSocket for live scoring and REST for calibration, auth, and configuration.

---

## Commands

**Frontend** (run from `dart-app/`):
```bash
npm install        # install dependencies (required before first run)
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # production build → dist/
npm run lint       # ESLint check
npm run preview    # preview production build
```

**Backend** (run from `dart-app/backend/`):
```bash
python main.py --camera 0 --model best.pt

# Additional flags:
# --camera2 2                    second camera (optional)
# --calib_left calib_left.json   left calibration file
# --calib_right calib_right.json right calibration file
# --conf 0.10                    YOLO confidence threshold
# --tip_offset 0.3               dart tip offset in bbox
# --port 8000                    server port (default: 8000)
```

Calibration files (`calib_left.json` / `calib_right.json`) auto-load from `backend/` if present. There are no tests in this project.

---

## Architecture

### Frontend — `dart-app/src/`

**Navigation**: No React Router. `App.jsx` holds all app-level state (`user`, `matchConfig`, `tournamentConfig`) and renders the active page via a `navigate(page, data)` switch. Session is auto-restored from JWT token in localStorage on mount. To add a page, add a case to the switch and a conditional render in `App.jsx`.

**Live scoring**: `useDartVision.js` manages the WebSocket lifecycle against `ws://localhost:8000/ws/scoring`. It handles auto-reconnect with exponential backoff (max 15 s), distinguishes `"state"` (sync, contains `darts[]`) vs `"throw"` (new dart event, fires `onThrow` callback), and exposes `{ connected, darts, resetBackend }`. The `enabled` prop disables the WebSocket entirely when false (used during bot turns). Backend port 8000 is hardcoded here and in `CalibrationPage.jsx` and `LiveScoring.jsx` — change in all three if you change the port.

**Standard gameplay layout** (used in MatchGame, Game121, AroundTheClock, ThrowForBull):
- Header with back button + connection status badge
- Top section: camera MJPEG feed (flex-1, height 260) + mini LiveBoard SVG (w-56) side by side
- Main section below: game-specific scoring UI
- Dark background `linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)` with `opacity-[0.03]` grid overlay

**Game modes**:
- `MatchGame.jsx` — 501/301 with bust detection, checkout table (`CK` object), `ScoreEditor` modal for correcting misdetections, and **⚙ Manuell** button for manually adding a dart to the next empty slot. Supports bot players: when `cp.type === "bot"`, the WebSocket is disabled and the bot effect auto-generates and confirms the round. Uses `cDartsRef` (a `useRef` synced to `cDarts` state) inside `applyDart` to prevent stale-closure race conditions when multiple throw events arrive simultaneously. `confirmRound` is triggered automatically after the 3rd dart.
- `Game121.jsx` — 121 checkout training, level up/down logic, undo snapshot stack, settings modal, **⚙ Manuell** button opens ScoreEditor.
- `AroundTheClock.jsx` — 1→20→Bull precision training with single/double/treble variants, accuracy tracking, manual Träff/Miss correction buttons.
- `TournamentBracket.jsx` — single-elimination with auto-byes, BracketConnectors SVG, WinnerScreen.
- `ThrowForBull.jsx` — **fully automatic via camera/YOLO** (not manual SVG clicks). One throw per player in array order, records `x_mm`/`y_mm` from `darts` state, calculates distance to bull, sorts players by closest. Bot players are detected by `player.type === "bot"` and auto-throw using `generateBotBullThrow` without waiting for camera. Has Ångra (undo with `undonePos` guard to ignore re-detection of same dart) and Hoppa över (skip with `SKIP_DIST=9999`). Results phase shows clickable list to override starting player.

**Bot players** (`dartBot.js`):
- Player objects with `type: "bot"` and `avgScore` (15–80, snitt per RUNDA/3 darts)
- `generateBotThrow(avgPerRound, currentScore)` — returns a dart object for a single throw. Uses a calibrated 5-level probability distribution (Nybörjare/Casual/Medel/Bra/Pro) with checkout logic when `currentScore ≤ 170`.
- `generateBotBullThrow(avgScore)` — returns `{ x_mm, y_mm, dist }` for ThrowForBull. Higher avg → closer to bull center.
- Bot avg scale: 15–25 Nybörjare (E≈5.5/dart), 26–40 Casual (E≈11/dart), 41–55 Medel (E≈16.5/dart), 56–70 Bra (E≈21/dart), 71–80 Pro (E≈25/dart).

**Calibration UI** (`CalibrationPage.jsx`): 41 ordered clicks (Bull → 20 Doubles → 20 Triples) on a live camera feed with a 3× `ZoomLens`. Posts pixel coordinates to `/api/calibrate`; backend computes and saves homography. Hot-reloads without server restart.

**Heatmap** (`HeatmapBoard.jsx`): Radial gradients per throw on an offscreen canvas, alpha-mapped to a green→yellow→red colormap, composited over an SVG dartboard.

**LiveBoard** (exported from `LiveScoring.jsx`): SVG dartboard with animated dart markers. Used in all gameplay pages. Takes `darts` array from `useDartVision` — each dart has `svg_x`, `svg_y`, `zone`, `score`, `scored`, `conf`. Board geometry matches Winmau Blade 6 (R=170 mm): Double 162–170, Outer single 107–162, Triple 99–107, Inner single 15.9–99, Outer bull r=15.9, Bull r=6.35.

### Backend — `dart-app/backend/`

**Threading model**: `pipeline_thread.py` runs a background loop (camera capture → YOLO inference → tracking → state update → event push). API routes in `routes/` read from shared state. `state.py` holds a `SharedState` singleton guarded by `threading.Lock()` with frames (JPEG bytes), live dart positions, scored throws, `event_queue` (deque max 200), FPS, and calibration status.

**Core algorithm** (`dartvision_score.py`):
- `DartTrack`: single-dart track with EMA smoothing (alpha=0.4) and `scored` flag
- `DartTracker`: multi-object tracking via greedy nearest-neighbour matching (threshold 18 mm), `MIN_HITS=3`, `MAX_AGE=8`
- `DartVisionPipeline`: YOLO inference → tracker update → homography transform → `score_from_mm()` → debounce
- `score_from_mm(x_mm, y_mm)`: converts mm coordinates to zone string, score value, multiplier, sector, radius, angle, is_edge; board geometry constants in `config.py`
- `BOARD_RADIUS_MAX_MM = 500` — homography validation threshold (increased from 200 to accept foam/miss hits outside physical board)

**Dart dict sent over WebSocket** (from `pipeline_thread.py`):
```python
{
  "zone": str,        # e.g. "T20", "D-Bull", "MISS"
  "score": int,
  "x_mm": float,      # smoothed board position
  "y_mm": float,
  "svg_x": float,     # mapped to 400×400 SVG viewBox
  "svg_y": float,
  "cam": str,         # "left" | "right" | None
  "conf": float,
  "scored": bool,
  "is_edge": bool,
}
```

**Calibration** (`routes/calibration.py`): receives 41 pixel coordinates, runs `cv2.findHomography(..., cv2.RANSAC, 5.0)`, reports inliers/mean-error/max-error, saves matrix to JSON. Pipeline hot-reloads calibration without restart.

**Auth** (`routes/auth.py`): SQLite database (`dartvision.db`). Passwords hashed with PBKDF2-HMAC-SHA256 (16-byte salt, 100k iterations). Tokens are custom HMAC-based with 30-day expiry — no external JWT library.

**MJPEG streaming** (`routes/streams.py`): four endpoints (`/api/stream/camera`, `/api/stream/board`, `/api/stream/left`, `/api/stream/right`) serving annotated or raw JPEG frames via generator functions.

**Reset**: `POST /api/reset` clears scoreboard, tracker, and event queue without restarting the server. Frontend calls this on component mount via `resetBackend()` from `useDartVision`.

**Geometry** (`utils/geometry.py`): `mm_to_svg(x_mm, y_mm)` maps board mm → 400×400 SVG coordinates; `generate_reference_points()` produces the 41 calibration reference points.

---

## Code Conventions

- **Language**: UI text and code comments are written in Swedish.
- **Color theme**: dark background `#0a0a10`, red accent `#EF4444`; per-mode: green `#10B981` (MatchGame/121), purple `#8B5CF6` (ATC), orange `#F59E0B` (Tournament).
- **Tailwind v4**: Only `@import "tailwindcss"` in `index.css` — there is no `tailwind.config.js`. Styling is mostly inline `style={{}}` objects.
- **React 19**: Functional components and hooks only; no class components. No ref mutations during render — all updates in effects or event callbacks.
- **Scoring is camera-only**: `ScoreEditor` and **⚙ Manuell** exist only for correcting/supplementing misdetections, not as primary input.
- **Stale closure pattern**: When a callback receives rapid-fire external events (WebSocket throws) and reads React state, use a `useRef` that is updated synchronously inside the callback. See `cDartsRef` in `MatchGame.jsx` as the canonical example.
- **Bot timeout pattern**: Bot turns use `botTimeoutRef = useRef(null)` to hold the pending `setTimeout` ID. `handleUndo` cancels it first before doing anything else. `botTrigger` (a `useState` counter) is incremented to force the bot effect to re-run when `cpIdx` hasn't changed (e.g. after a mid-throw cancel). The bot effect guards with `if(cDartsRef.current.some(Boolean)) return` to avoid re-throwing when darts are already showing after an undo.
- **Port hardcoding**: Backend port 8000 is hardcoded in `useDartVision.js`, `CalibrationPage.jsx`, and `LiveScoring.jsx`.
