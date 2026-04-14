# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projektöversikt

**DartVision** är ett realtids-pilscoringsystem som använder datorseende (YOLO) och kamerabaserad homografikalibering för att automatiskt detektera och poängsätta pilkast. Projektet är uppdelat i ett React-frontend och ett FastAPI-backend som kommunicerar via WebSocket och REST.

---

## Kommandon

**Frontend** (kör från `dart-app/`):
```bash
npm install        # installera beroenden
npm run dev        # Vite dev-server → http://localhost:5173
npm run build      # produktionsbygge → dist/
npm run lint       # ESLint-kontroll
npm run preview    # förhandsgranska produktionsbygge
```

**Backend** (kör från `dart-app/backend/`):
```bash
python main.py --camera 0 --model best.pt
# Fler flaggor:
# --camera2 2                          andra kamera (valfri)
# --calib_left calib_left.json         kalibreringsfil vänster
# --calib_right calib_right.json       kalibreringsfil höger
# --conf 0.10                          YOLO confidence-tröskel
# --tip_offset 0.3                     pilspets-offset i bbox
# --port 8000                          serverport
```
Kalibreringsfiler (`calib_left.json` / `calib_right.json`) laddas automatiskt om de finns i `backend/`.

---

## Tech Stack

| Lager | Teknologi | Version |
|-------|-----------|---------|
| Frontend UI | React + Vite | 19.2.4 / 8 |
| Styling | Tailwind CSS v4 | 4.x |
| Backend web | FastAPI + Uvicorn | ≥0.110 / ≥0.27 |
| Datorseende | OpenCV + Ultralytics YOLO | ≥4.9 / ≥8.1 |
| Matematik | NumPy | ≥1.26 |
| Databas | SQLite (inbyggd i Python) | — |
| Teckensnitt | Rajdhani (Google Fonts) | — |

---

## Filstruktur

```
dart-app/
├── src/                        # React-frontend
│   ├── main.jsx                # React-entry, renderar <App>
│   ├── index.css               # Enbart: @import "tailwindcss"
│   ├── App.jsx                 # Huvud-nav, all app-state, sessionhantering
│   ├── useDartVision.js        # WebSocket-hook för live scoring
│   ├── DartLobby.jsx           # Huvudmeny, spellägesval
│   ├── MatchSetup.jsx          # Konfigurera 501/301-match (spelare, legs, format)
│   ├── ThrowForBull.jsx        # SVG-dartboard för att avgöra kastningstordning
│   ├── MatchGame.jsx           # Spellogik 501/301 + ScoreEditor-modal
│   ├── Game121.jsx             # Spelläge 121 checkout-träning
│   ├── AroundTheClock.jsx      # Spelläge 1→20→Bull träning
│   ├── TournamentSetup.jsx     # Konfigurera single-elimination bracket
│   ├── TournamentBracket.jsx   # Visualisera och spela turnering
│   ├── LiveScoring.jsx         # Realtidsövervakning av scoring-pipeline
│   ├── CalibrationPage.jsx     # 41-punkts homografikalibering
│   ├── HeatmapPage.jsx         # Visualisering av kastfördelning
│   ├── HeatmapBoard.jsx        # Återanvändbar heatmap-komponent (canvas)
│   ├── LoginPage.jsx           # Registrering och inloggning
│   └── ProfilePage.jsx         # Användarstatistik och historik
│
└── backend/
    ├── main.py                 # FastAPI-app, CLI-args, uvicorn-start
    ├── config.py               # Boardgeometri-konstanter (mm), serverdefaults
    ├── state.py                # Trådsäker SharedState-singleton
    ├── pipeline_thread.py      # Bakgrundstråd: kamera → YOLO → state
    ├── dartvision_score.py     # Kärn-algoritm: tracking, homografi, poängsättning
    ├── dart_calibration.py     # Fristående kalibreringverktyg (OpenCV GUI)
    └── routes/
        ├── __init__.py         # register_routes(app) samlar alla routers
        ├── streams.py          # MJPEG-endpoints för kamerafeed och board-overlay
        ├── scoring.py          # WebSocket /ws/scoring + POST /api/reset
        ├── calibration.py      # GET/POST kalibrering, referenspunkter
        ├── auth.py             # Registrering, login, token-validering (SQLite)
        └── status.py           # GET /api/status (kamerastatus, FPS, kalib)
```

---

## Arkitektur

### Frontend

**Navigation utan React Router**
All navigation sköts av `navigate(page, data)` i `App.jsx`. Sidan renderas beroende på state-variabeln `page`. Data som matchkonfiguration, turneringsdata och inloggad användare lever i `App.jsx` och skickas som props nedåt.

**Live scoring via WebSocket-hook**
`useDartVision.js` hanterar hela WebSocket-livscykeln mot `ws://localhost:8000/ws/scoring`:
- Automatisk återanslutning med exponentiell backoff (max 15 s)
- Meddelanden av typen `"state"` (synk) och `"throw"` (nytt kast)
- `parseThrow()` konverterar zonstrings (t.ex. `"T20"`) till objekt med `multiplier` och `value`
- Returnerar `{ connected, darts, resetBackend }`

**Spellägen**
- **MatchGame**: 501/301 med checkout-tabell (`CK`-objekt), bust-kontroll och ScoreEditor-modal för manuella korrigeringar
- **Game121**: Starta på 121, checkout på dubbel → level up, bust → level down
- **AroundTheClock**: Träffa 1→20→Bull i ordning; varianter för single/double/treble
- **TournamentBracket**: Single-elimination bracket, auto-byes för icke-2-potens spelantal

**Kalibreringssida**
41 klick i ordning (Bull → 20 Doubles → 20 Triples) på live-kamerafeed. ZoomLens-komponent (3× förstoring) för precision. Skickar punkter till `/calibrate` → backend beräknar homografi → sparar JSON.

**Heatmap**
`HeatmapBoard.jsx` ritar radial gradients per kast på offscreen canvas, läser alpha och applicerar färgkarta (transparent→grön→gul→röd). Composite på SVG-dartboard.

**Checkout-tabell**
`CK`-objektet i `MatchGame.jsx` och `Game121.jsx` är hårdkodat och mappar kvarstående poäng till föreslagna utcheckar (t.ex. `170: ["T20","T20","D-Bull"]`).

---

### Backend

**Tråddelad state**
`state.py` innehåller `SharedState`-singleton med `threading.Lock()`. Pipeline-tråden skriver; API-routes läser. Attribut: frames (JPEG bytes), `darts` (live-positioner), `throws` (poängsatta kast), `event_queue` (deque max 200), FPS, kalibreringsstatus.

**Pipeline-tråden**
`pipeline_thread.py` kör en oändlig loop:
1. Läs frames från en eller två kameror (eller dela ett brett feed)
2. JPEG-koda enskilda frames
3. Anropa `pipeline.process_frame()` → annoterat display + board-overlay
4. Jämför trackers längd med `prev_throw_count` för att detektera nya kast
5. Uppdatera `state` med lock
6. Pusha throw-events till `event_queue`

**Kärnalgoritm (`dartvision_score.py`)**
- **DartTrack**: Enskild spårning med EMA-smoothing (alpha=0.4) och `scored`-flagga
- **DartTracker**: Multi-object tracking med Hungarian matching (tröskel 18 mm), `MIN_HITS=3`, `MAX_AGE=8`
- **DartVisionPipeline**: YOLO-inferens → tracker-uppdatering → homografi → `score_from_mm()` → debounce
- **`score_from_mm(x_mm, y_mm)`**: Konverterar mm-koordinater till zon (t.ex. `"T20"`), poäng, multiplikator

**Kalibrering**
`routes/calibration.py` tar emot 41 pixelkoordinater, kör `cv2.findHomography(..., cv2.RANSAC, 5.0)`, beräknar inliers/medelfel/maxfel och sparar homografimatrisen till JSON. Pipeline hot-reloadar kalibreringsmatrisen utan omstart.

**Auth**
SQLite-databas (`dartvision.db`). Lösenord hashade med PBKDF2-HMAC-SHA256 (16-byte salt, 100k iterationer). Tokens är custom HMAC-baserade med 30 dagars giltighetstid (ingen extern JWT-lib).

**MJPEG-streaming**
`routes/streams.py` använder generator-funktioner som yieldar JPEG-frames från `state`. Fyra endpoints: `camera` (annoterad), `board` (dartboard-overlay), `left`, `right`.

---

## Kodkonventioner

- **Språk i UI och kommentarer**: Svenska
- **Färgtema**: Mörk bakgrund `#0a0a10`, röd accent `#EF4444`; per-spelläge: grön `#10B981`, lila `#8B5CF6`, orange `#F59E0B`
- **Tailwind v4**: Enbart `@import "tailwindcss"` i `index.css` — ingen `tailwind.config.js`
- **React 19**: Inga ref-mutationer under render; all state-uppdatering i WebSocket-callbacks
- **Enbart funktionella komponenter** med hooks — inga klasskomponenter
- **All scoring sker via kamera** — ingen manuell dartboard för poänginmatning; `ScoreEditor` finns bara för att korrigera fel-detekteringar

---

## Viktigt att veta

- **Scoring-reset**: POST `/api/reset` rensar scoreboard, tracker och event-kön utan att starta om servern
- **Dubbla kameror**: `--camera2` möjliggör split-feed; pipeline sys ihop bilderna automatiskt
- **Kalibrering krävs** för korrekt poängsättning. Utan kalibreringsfil körs pipeline men kan inte mappa pixel→poäng
- **Inga tester** finns i projektet (inga test-mappar eller testramverk konfigurerade)
- **Ingen React Router** — lägg till sidor i `App.jsx`:s `navigate()`-switch och som villkorlig render
- **Backend-port 8000** är hårdkodad i frontend (`useDartVision.js`, `CalibrationPage.jsx`, `LiveScoring.jsx`) — ändra på alla ställen vid portbyte
