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
│   ├── dartBot.js              # Bot-logik: generateBotThrow + generateBotBullThrow
│   ├── DartLobby.jsx           # Huvudmeny, spellägesval
│   ├── MatchSetup.jsx          # Konfigurera 501/301-match (spelare, legs, format, bot-slider)
│   ├── ThrowForBull.jsx        # Kamera-baserad kastordning; bot auto-kastar via dartBot.js
│   ├── MatchGame.jsx           # Spellogik 501/301 + ScoreEditor-modal + bot-stöd
│   ├── Game121.jsx             # Spelläge 121 checkout-träning
│   ├── AroundTheClock.jsx      # Spelläge 1→20→Bull träning
│   ├── TournamentSetup.jsx     # Konfigurera single-elimination bracket
│   ├── TournamentBracket.jsx   # Visualisera och spela turnering
│   ├── LiveScoring.jsx         # Realtidsövervakning av scoring-pipeline + LiveBoard-export
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
    ├── dart_calibration.py     # Fristående kalibreringsverktyg (OpenCV GUI)
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
- `enabled`-prop: när `false` kopplas WS inte upp alls (används under botens tur)
- Returnerar `{ connected, darts, resetBackend }`

**Spellägen**
- **MatchGame**: 501/301 med checkout-tabell (`CK`-objekt), bust-kontroll, ScoreEditor-modal och ⚙ Manuell-knapp. Stödjer **bot-spelare**: när `cp.type === "bot"` är WebSocket inaktiverad och bot-effekten genererar och bekräftar rundan automatiskt. Använder `cDartsRef` (useRef synkad till `cDarts`) för att undvika stale-closure-race vid snabba WS-events.
- **Game121**: Starta på 121, checkout på dubbel → level up, bust → level down. Undo-stack, inställningsmodal, ⚙ Manuell-knapp.
- **AroundTheClock**: Träffa 1→20→Bull i ordning; varianter för single/double/treble.
- **TournamentBracket**: Single-elimination bracket, auto-byes för icke-2-potens spelantal.
- **ThrowForBull**: Kamera-baserad kastordning. Bot-spelare (`player.type === "bot"`) kastas automatiskt via `generateBotBullThrow` utan att vänta på kamera. Ångra-funktion med `undonePos`-guard, Hoppa över med `SKIP_DIST=9999`. Resultatfas visar klickbar lista för att välja startspelare.

**Bot-spelare (`dartBot.js`)**
Spelaren representeras av `{ type: "bot", avgScore: number, name: string, id: string }`.
- `avgScore` (15–80) = snitt per RUNDA (3 pilar totalt), kalibrerat i 5 nivåer:
  - 15–25 Nybörjare (E ≈ 5.5/pil)
  - 26–40 Casual (E ≈ 11/pil)
  - 41–55 Medel (E ≈ 16.5/pil)
  - 56–70 Bra (E ≈ 21/pil)
  - 71–80 Pro (E ≈ 25/pil)
- `generateBotThrow(avgPerRound, currentScore)` — returnerar ett dart-objekt. I checkout-läge (≤170) används `CK`-tabellen med träffchans proportionell mot avg. Annars väljs zon ur kalibrerad sannolikhetsfördelning.
- `generateBotBullThrow(avgScore)` — returnerar `{ x_mm, y_mm, dist }` för ThrowForBull. Hög avg → nära centrum.
- Bot-avgörningen i MatchSetup: slider 15–80 + etiketter (Nybörjare/Casual/Medel/Bra/Pro).

**Kalibreringssida**
41 klick i ordning (Bull → 20 Doubles → 20 Triples) på live-kamerafeed. ZoomLens-komponent (3× förstoring) för precision. Skickar punkter till `/calibrate` → backend beräknar homografi → sparar JSON.

**Heatmap**
`HeatmapBoard.jsx` ritar radial gradients per kast på offscreen canvas, läser alpha och applicerar färgkarta (transparent→grön→gul→röd). Composite på SVG-dartboard.

**Checkout-tabell**
`CK`-objektet i `MatchGame.jsx`, `Game121.jsx` och `dartBot.js` är hårdkodat och mappar kvarstående poäng till föreslagna utcheckar (t.ex. `170: ["T20","T20","D-Bull"]`).

**LiveBoard** (exporteras från `LiveScoring.jsx`)
SVG-dartboard med animerade pilmarkeringar. Används på alla spelsidor. Tar `darts`-array från `useDartVision`. Boardgeometri matchar Winmau Blade 6 (R=170 mm, 1 SVG-enhet = 1 mm): Dubbel 162–170, Yttre singel 107–162, Tredubbel 99–107, Inre singel 15.9–99, Outer bull r=15.9, Bull r=6.35.

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
- **Färgtema**: Mörk bakgrund `#0a0a10`, röd accent `#EF4444`; per-spelläge: grön `#10B981` (MatchGame/121), lila `#8B5CF6` (ATC), orange `#F59E0B` (Tournament)
- **Tailwind v4**: Enbart `@import "tailwindcss"` i `index.css` — ingen `tailwind.config.js`. Styling sker mestadels via `style={{}}`.
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
- **Bot-timeout-mönster**: `botTimeoutRef = useRef(null)` håller pekare till botens pågående `setTimeout`. `handleUndo` avbryter alltid timeoutet först. `botTrigger` (useState-räknare) ökas för att tvinga om bot-effekten när `cpIdx` inte ändras (t.ex. vid avbruten mitt-i-kast). Bot-effekten har guard: `if(cDartsRef.current.some(Boolean)) return` för att inte kasta om när pilar redan visas efter ångra.
