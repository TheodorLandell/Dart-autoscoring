# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projektöversikt

**DartVision** är ett realtids-pilscoringsystem som använder datorseende (YOLO) och kamerabaserad homografikalibering för att automatiskt detektera och poängsätta pilkast. React-frontend kommunicerar med FastAPI-backend via WebSocket (live scoring) och REST (kalibrering, auth, konfiguration).

---

## Kommandon

**Frontend** (kör från `dart-app/`):
```bash
npm install        # installera beroenden (krävs vid första körning)
npm run dev        # Vite dev-server → http://localhost:5173
npm run build      # produktionsbygge → dist/
npm run lint       # ESLint-kontroll
npm run preview    # förhandsgranska produktionsbygge
```

**Backend** (kör från `dart-app/backend/`):
```bash
python main.py --camera 0 --model best.pt
# --camera2 2                          andra kamera (valfri)
# --calib_left calib_left.json         kalibreringsfil vänster
# --calib_right calib_right.json       kalibreringsfil höger
# --conf 0.10                          YOLO confidence-tröskel
# --tip_offset 0.3                     pilspets-offset i bbox
# --port 8000                          serverport (default: 8000)
```

Kalibreringsfiler (`calib_left.json` / `calib_right.json`) och YOLO-modellen (`best.pt`) ska ligga i `backend/`. SQLite-databasen (`dartvision.db`) skapas automatiskt i `backend/` vid första start. Inga tester finns i projektet.

---

## Tech Stack

| Lager | Teknologi |
|-------|-----------|
| Frontend UI | React 19.2.4 + Vite 8 |
| Styling | Tailwind CSS v4 (ingen config-fil) |
| Backend web | FastAPI + Uvicorn |
| Datorseende | OpenCV + Ultralytics YOLO |
| Matematik | NumPy |
| Databas | SQLite (inbyggd Python) |
| Teckensnitt | Rajdhani (Google Fonts) |

---

## Filstruktur

```
dart-app/
├── src/
│   ├── main.jsx                # React-entry, monterar <App> på #root
│   ├── index.css               # Enbart: @import "tailwindcss"
│   ├── App.jsx                 # Huvud-nav, all app-state, session-restore
│   ├── useDartVision.js        # WebSocket-hook: livscykel, reconnect, resetBackend
│   ├── dartBot.js              # Bot-logik: generateBotThrow, generateBotBullThrow, botDartToSvg
│   ├── DartLobby.jsx           # Huvudmeny med spellägesval
│   ├── MatchSetup.jsx          # Konfigurera 501/301-match (spelare, legs, format, bot-slider)
│   ├── ThrowForBull.jsx        # Kamera-baserad kastordning; bot auto-kastar
│   ├── MatchGame.jsx           # Spellogik 501/301, ScoreEditor-modal, bot-animering
│   ├── Game121.jsx             # 121 checkout-träning med undo-stack
│   ├── AroundTheClock.jsx      # 1→20→Bull träning, single/double/treble-varianter
│   ├── TournamentSetup.jsx     # Konfigurera single-elimination bracket
│   ├── TournamentBracket.jsx   # Visualisera bracket, BracketConnectors SVG, WinnerScreen
│   ├── LiveScoring.jsx         # Realtidsövervakning + LiveBoard SVG-export
│   ├── CalibrationPage.jsx     # 41-punkts homografikalibering med ZoomLens
│   ├── HeatmapPage.jsx         # Sida som visar HeatmapBoard
│   ├── HeatmapBoard.jsx        # Canvas heatmap: radial gradients → färgkarta → SVG-board
│   ├── LoginPage.jsx           # Registrering och inloggning
│   └── ProfilePage.jsx         # Användarstatistik och historik
│
└── backend/
    ├── main.py                 # FastAPI-app, CLI-args, uvicorn-start
    ├── config.py               # Boardgeometri-konstanter (mm) och server-defaults
    ├── state.py                # Trådsäker SharedState-singleton (threading.Lock)
    ├── pipeline_thread.py      # Bakgrundstråd: kamera → YOLO → state + event_queue
    ├── dartvision_score.py     # Kärnalgoritm: DartTrack, DartTracker, DartVisionPipeline, score_from_mm
    ├── dart_calibration.py     # Fristående kalibreringsverktyg med OpenCV GUI
    └── routes/
        ├── __init__.py         # register_routes(app) samlar alla routers
        ├── streams.py          # MJPEG-endpoints: camera, board, left, right
        ├── scoring.py          # WebSocket /ws/scoring + POST /api/reset
        ├── calibration.py      # GET/POST kalibrering och referenspunkter
        ├── auth.py             # Registrering, login, token-validering (SQLite)
        ├── stats.py            # Kast- och matchstatistik per användare
        └── status.py           # GET /api/status (kamerastatus, FPS, kalib)
```

---

## API-endpoints

```
GET  /api/stream/camera              MJPEG annoterad combined feed
GET  /api/stream/board               MJPEG board overlay
GET  /api/stream/left                MJPEG vänster kamera (ren)
GET  /api/stream/right               MJPEG höger kamera (ren)
GET  /api/snapshot/{cam}             Enstaka JPEG-frame
WS   /ws/scoring                     WebSocket: kast-events + state-sync
POST /api/reset                      Nollställ scores, tracker, event-kö
POST /api/calibrate                  Beräkna homografi, spara JSON
GET  /api/calibration/status         Kalibreringsstatus och felstatistik
GET  /api/calibration/reference-points  41 referenspunkter (px-koordinater)
GET  /api/status                     Kamerastatus, FPS, kalibreringsstatus
POST /api/auth/register              Registrera ny användare
POST /api/auth/login                 Logga in, returnerar token + user
GET  /api/auth/me                    Validera token, returnerar user-objekt
POST /api/user/match                 Spara matchresultat + kast för inloggad användare
GET  /api/user/matches               Senaste matcher för inloggad användare (limit-param)
GET  /api/user/heatmap               Kastpositioner för heatmap (mode=all|501|301|121|atc)
GET  /api/user/stats                 Aggregerad statistik för inloggad användare
```

---

## Arkitektur

### Frontend

**Navigation utan React Router**
All navigation sköts av `navigate(page, data)` i `App.jsx`. `page`-state-variabeln styr vilken komponent som renderas via villkorliga renders. App-state (`user`, `matchConfig`, `tournamentConfig`, `tournamentMatchId`) lever i `App.jsx` och skickas som props. Session auto-återställs från `dart_token` i localStorage med bakgrundsvalidering mot `/api/auth/me`. Lägg till sidor som case i `navigate()` och som villkorlig render i `App.jsx`.

**Live scoring via WebSocket-hook**
`useDartVision.js` hanterar hela WebSocket-livscykeln mot `ws://localhost:8000/ws/scoring`:
- Automatisk återanslutning med exponentiell backoff (max 15 s)
- `"state"`-meddelanden (synk, innehåller `darts[]` och `throws[]`) vs `"throw"` (nytt kast, triggar `onThrow`-callback)
- `readyRef.current` sätts `false` vid reconnect; vid första `"state"` efter anslutning synkas `processedThrowCountRef` till serverns `throws.length` utan att trigga `onThrow` (inga gamla events spelas upp)
- Om kast registrerades medan WS var nere återhämtas de från `state.throws[]` vid nästa state-meddelande
- `enabled`-prop: när `false` kopplas WS inte upp alls (används under botens tur i MatchGame)
- Returnerar `{ connected, darts, resetBackend }`

**Dart-objekt från WebSocket** (format som skickas från `pipeline_thread.py`):
```js
{
  zone: string,    // t.ex. "T20", "D-Bull", "MISS"
  score: number,
  x_mm: number,   // smoothad boardposition
  y_mm: number,
  svg_x: number,  // mappat till 400×400 SVG viewBox
  svg_y: number,
  cam: string,    // "left" | "right" | null
  conf: number,
  scored: boolean,
  is_edge: boolean,
}
```

**Standard spelläges-layout** (MatchGame, Game121, AroundTheClock, ThrowForBull):
- Header med bakknapp + anslutningsstatus-badge
- Övre sektion: MJPEG-kamerafeed (flex-1, höjd 260) + mini LiveBoard SVG (w-56) sida vid sida
- Huvudsektion nedanför: spellägesspecifikt UI
- Bakgrund `linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)` med `opacity-[0.03]` grid-overlay

---

### Spellägen

**MatchGame.jsx** — 501/301
Centrala states: `scores[]`, `legsWon[]`, `cpIdx` (current player), `cDarts[3]` (aktuella rundan), `history[]` (undo-stack), `totThrown`, `rndCount`, `botThrowing`, `botIndicator`, `bust`, `gameOver`.

Viktiga detaljer:
- `CK`-objektet (checkout-tabell) är hårdkodat; mappar kvarstående poäng → föreslagen utcheckning
- `confirmRound()` triggas automatiskt efter tredje pilen (non-bot)
- `ScoreEditor`-modal för att korrigera fel-detekteringar; ⚙ Manuell-knapp för att fylla slot manuellt
- Bot-stöd: se Bot-avsnittet nedan
- `liveBoardDarts = isBot ? cDarts.filter(Boolean) : darts` — byt datakälla för LiveBoard under botens tur

**Game121.jsx**
Träning: börja på 121, checkout på dubbel → level up, bust → level down. Undo-stack med snapshot av poäng + level. Inställningsmodal för startlevel. ⚙ Manuell-knapp öppnar ScoreEditor.

**AroundTheClock.jsx**
Träffa sektorer 1→20→Bull i ordning. Varianter: single (S), double (D), treble (T). Manuella Träff/Miss-knappar för korrigering. Accuracy-tracking per sektor.

**ThrowForBull.jsx** — kastordningsavgörning
Fullt kamera-baserad (inte manuella klick). En kast per spelare i arrayordning. Botspelare (`player.type === "bot"`) kastar automatiskt via `generateBotBullThrow` utan kamera. Spelar in `x_mm`/`y_mm` från `darts`-state, beräknar avstånd till bull, sorterar spelare. Ångra med `undonePos`-guard (ignorerar re-detektering av samma pil). Hoppa över med `SKIP_DIST=9999`. Resultatfas: klickbar lista för att välja startspelare.

**TournamentBracket.jsx**
Single-elimination bracket med auto-byes för icke-2-potens spelantal. `BracketConnectors`-komponent ritar SVG-linjer mellan matcher. `WinnerScreen` visas när bracket är klar. Matcher delegeras till `MatchGame` via `tournament-match`-page och `handleTournamentMatchComplete`-callback i `App.jsx`.

**LiveScoring.jsx** (fristående sida + LiveBoard-export)
Fristående realtidsövervakning av scoring-pipeline. Exporterar `LiveBoard`-komponenten (SVG-dartboard med animerade pilmarkeringar) som används på alla spelsidor. LiveBoard stödjer `d.color` för spelarfärgning och `d.isNew` för pop-in CSS-animation (`dart-pop` keyframe: scale 0→1 på 0.2s).

---

### Bot-systemet (`dartBot.js`)

Spelarobjekt: `{ type: "bot", avgScore: number, name: string, id: string }`.
`avgScore` (15–80) = snitt per runda (3 pilar totalt), 5 nivåer:

| Nivå | avgScore | E per pil |
|------|----------|-----------|
| Nybörjare | 15–25 | ≈5.5 |
| Casual | 26–40 | ≈11 |
| Medel | 41–55 | ≈16.5 |
| Bra | 56–70 | ≈21 |
| Pro | 71–80 | ≈25 |

**`generateBotThrow(avgPerRound, currentScore)`** — returnerar ett dart-objekt. I checkout-läge (≤170) används `CK`-tabellen med träffchans proportionell mot avg. Annars kalibrerad sannolikhetsfördelning.

**`generateBotBullThrow(avgScore)`** — returnerar `{ x_mm, y_mm, dist }` för ThrowForBull. Hög avg → nära centrum.

**`botDartToSvg(zone)`** — konverterar zonstring till SVG-koordinater för LiveBoard-visning under botens tur. Använder `SECTORS.indexOf(num)` och vinkelformeln `(idx*18-90)°` (sektor 20 överst, matchar LiveBoard). Radier: D=166 mm, T=103 mm, S=35–95 mm. Lägger till ±8° vinkeljitter och ±3 mm radiusjitter per kast.

**Bot-animering i MatchGame** (states `botThrowing`, `botIndicator`):
1. `isBot` → `setBotThrowing(true)`, `setBotIndicator(true)`
2. Pre-generera alla 3 pilar med `botDartToSvg`-koordinater, spelarfärg (`PC[cpIdx%PC.length]`) och `isNew: true`
3. Avslöja en pil per sekund via `setTimeout`-array (`timers[]`) — rensas i effect-cleanup
4. Efter sista pilen: `setBotIndicator(false)`, visa bust-meddelande om bust
5. Efter `dartsCount * 1000 + 3000` ms: committa rundan, `setBotThrowing(false)`, `setCpIdx(nästa)`
6. Under `botThrowing`: WS inaktiverad (`enabled={!botThrowing}`), alla knappar låsta, `handleUndo` blockerad

---

### Kalibrering

41 klick i ordning (Bull → 20 Doubles → 20 Triples) på live-kamerafeed i `CalibrationPage.jsx`. `ZoomLens`-komponent (3× förstoring runt muspekaren) för precision. Klienten skickar punkterna till `POST /api/calibrate`; backend kör `cv2.findHomography(..., cv2.RANSAC, 5.0)`, beräknar inliers/medelfel/maxfel och sparar homografimatrisen som JSON. Pipeline hot-reloadar utan omstart.

---

### Backend

**Tråddelad state** (`state.py`)
`SharedState`-singleton med `threading.Lock()`. Pipeline-tråden skriver; HTTP/WS-routes läser. Attribut: `frames` (JPEG-bytes per kamera), `darts` (live-positioner), `throws` (poängsatta kast), `event_queue` (deque max 200), FPS, kalibreringsstatus.

**Pipeline-tråden** (`pipeline_thread.py`)
Oändlig loop:
1. Kamera-capture (en eller två kameror)
2. JPEG-koda enskilda frames
3. `pipeline.process_frame()` → annoterat display + board-overlay
4. Jämför tracker-längd med `prev_throw_count` för att detektera nya kast
5. Uppdatera `state` med lock
6. Pusha throw-events till `event_queue`

**Kärnalgoritm** (`dartvision_score.py`)
- `DartTrack`: EMA-smoothing alpha=0.4, `scored`-flagga, `hits`/`age`-räknare
- `DartTracker`: greedy nearest-neighbour matching, tröskel 18 mm, `MIN_HITS=3`, `MAX_AGE=8`
- `DartVisionPipeline`: YOLO-inferens → tracker-uppdatering → homografi-transform → `score_from_mm()` → debounce
- `score_from_mm(x_mm, y_mm)`: mm-koordinater → zon, poäng, multiplikator, sektor, radien, vinkel, `is_edge`
- `BOARD_RADIUS_MAX_MM = 500`: homografi-valideringsgräns (förhöjd från 200 för att acceptera miss-kast utanför boardet)

**Auth** (`routes/auth.py`)
SQLite (`dartvision.db`). PBKDF2-HMAC-SHA256, 16-byte salt, 100k iterationer. Custom HMAC-tokens, 30 dagars giltighetstid — ingen extern JWT-lib. `users`-tabellen innehåller aggregerade stat-kolumner (`matches_played`, `matches_won`, `highest_checkout`, `avg_score`, `best_leg`, `favorite_mode`) som uppdateras av `_update_user_stats()` efter varje sparad match.

**Stats** (`routes/stats.py`)
Två tabeller: `throws` (per pil: zone, score, x_mm, y_mm, mode) och `matches` (per match: mode, result_str, won, checkout, darts_in_leg). Anropas från MatchGame, Game121 och AroundTheClock via `POST /api/user/match` vid matchslut. Bara mänskliga spelarens kast sparas — bot-kast exkluderas. `GET /api/user/heatmap` returnerar kastpositioner filtrerade på mode för heatmap-canvas.

---

## Kodkonventioner

- **Språk**: UI-text och kodkommentarer på svenska
- **Färgtema**: `#0a0a10` bakgrund, `#EF4444` röd accent; per-läge: `#10B981` grön (MatchGame/121), `#8B5CF6` lila (ATC), `#F59E0B` orange (Tournament)
- **Tailwind v4**: Enbart `@import "tailwindcss"` i `index.css` — ingen `tailwind.config.js`. Styling mestadels via `style={{}}`.
- **React 19**: Enbart funktionella komponenter och hooks. Inga ref-mutationer under render — all state-uppdatering i WS-callbacks eller event handlers.
- **All scoring via kamera**: `ScoreEditor` och ⚙ Manuell finns enbart för att korrigera fel-detekteringar.
- **`CK`-tabell synkronisering**: Checkout-tabellen är hårdkodad i `MatchGame.jsx`, `Game121.jsx` och `dartBot.js` — uppdatera på alla tre ställen vid ändring.

---

## Viktiga mönster

**Stale-closure-mönster** (`cDartsRef` i MatchGame): När en callback tar emot snabba externa events (WS-throws) och läser React-state, använd `useRef` som uppdateras synkront i varje callback. `cDartsRef.current` är alltid aktuell; `cDarts` kan vara inaktuell fram till nästa render. Samma mönster krävs i alla komponenter med WS + rapid state reads.

**Bot timeout-mönster**: Alla `setTimeout`-IDs samlas i en `timers[]`-array i bot-effekten och clearas i cleanup-funktionen. `botThrowing`-state guard blockar undo och knappar under hela botens tur. `botDartToSvg`-koordinater pre-genereras vid effektstart — inte vid varje timer-callback — för stabila positioner.

**Undo med bot-hoppning** (`handleUndo` i MatchGame): Loop baklänges i history, hoppa över bot-rundor (applicera undo som sidoeffekt), stanna vid första human-runda, sätt `setCpIdx(humanIndex)`. Återställ `cDarts = lr.darts` (inte `[null,null,null]`) för att möjliggöra pil-för-pil-undo av senaste rundan.

**WS reconnect-recovery** (`processedThrowCountRef` i `useDartVision.js`): Räknare som spårar hur många kast frontend bearbetat. Vid reconnect synkas till `state.throws.length` utan att trigga `onThrow`. Kast som registrerades medan WS var nere återhämtas från `state.throws[]` vid nästa state-meddelande. `resetBackend()` nollställer räknaren.

**Stats-sparning**: Alla spellägen anropar `POST /api/user/match` vid sessionens slut — men bara om `user`-prop är satt (inloggad). Bara mänskliga spelarens kast inkluderas (bot-kast exkluderas). `saveMatchStats(winnerPlayer, finalLegsArr, finalNd, finalCpIdx)` i MatchGame kallas vid match-vinst oavsett om human eller bot vann.

**Port-hårdkodning**: Port 8000 finns på tre ställen: `useDartVision.js`, `CalibrationPage.jsx`, `LiveScoring.jsx`. Ändra på alla tre vid portbyte.
