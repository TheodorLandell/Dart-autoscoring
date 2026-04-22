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

## API-endpoints

```
GET  /api/stream/camera              MJPEG (annoterad combined feed)
GET  /api/stream/board               MJPEG (board overlay)
GET  /api/stream/left                MJPEG (vänster kamera, ren)
GET  /api/stream/right               MJPEG (höger kamera, ren)
GET  /api/snapshot/{cam}             Enstaka JPEG
WS   /ws/scoring                     WebSocket (kast-events + state)
POST /api/reset                      Nollställ scores + tracker + event-kö
POST /api/calibrate                  Beräkna homografi + spara JSON
GET  /api/calibration/status         Kalibreringsstatus
GET  /api/calibration/reference-points  41 referenspunkter
GET  /api/status                     Allmän status (kameror, FPS, kalib)
POST /api/auth/register              Registrera användare
POST /api/auth/login                 Logga in, returnerar token
GET  /api/auth/me                    Validera token, returnerar user-objekt
```

---

## Arkitektur

### Frontend

**Navigation utan React Router**
All navigation sköts av `navigate(page, data)` i `App.jsx`. `page`-variabeln styr vilken komponent som renderas. App-state (`user`, `matchConfig`, `tournamentConfig`) lever i `App.jsx` och skickas som props. Session auto-återställs via `dart_token` i localStorage (bakgrundsvalidering mot `/api/auth/me`). Lägg till sidor som ett case i `navigate()` och som villkorlig render i `App.jsx`.

**Live scoring via WebSocket-hook**
`useDartVision.js` hanterar hela WebSocket-livscykeln mot `ws://localhost:8000/ws/scoring`:
- Automatisk återanslutning med exponentiell backoff (max 15 s)
- `"state"`-meddelanden (synk, innehåller `darts[]`) vs `"throw"` (nytt kast, triggar `onThrow`-callback)
- `enabled`-prop: när `false` kopplas WS inte upp alls (används under botens tur)
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

**Standard spelläges-layout** (används i MatchGame, Game121, AroundTheClock, ThrowForBull):
- Header med bakknapp + anslutningsstatus-badge
- Övre sektion: MJPEG-kamerafeed (flex-1, höjd 260) + mini LiveBoard SVG (w-56) sida vid sida
- Huvudsektion nedanför: spellägesspecifikt UI
- Mörk bakgrund `linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)` med `opacity-[0.03]` grid-overlay

**Spellägen**
- **MatchGame**: 501/301 med checkout-tabell (`CK`-objekt), bust-kontroll, ScoreEditor-modal och ⚙ Manuell-knapp. Bot-stöd: när `cp.type === "bot"` är WS inaktiverad och bot-effekten genererar och bekräftar rundan automatiskt.
- **Game121**: Starta på 121, checkout på dubbel → level up, bust → level down. Undo-stack, inställningsmodal, ⚙ Manuell-knapp.
- **AroundTheClock**: Träffa 1→20→Bull i ordning; varianter för single/double/treble.
- **TournamentBracket**: Single-elimination bracket, auto-byes, BracketConnectors SVG, WinnerScreen.
- **ThrowForBull**: Kamera-baserad kastordning. Bot-spelare kastas automatiskt via `generateBotBullThrow`. Ångra med `undonePos`-guard (ignorerar re-detektering av samma pil). Hoppa över med `SKIP_DIST=9999`. Resultatfas: klickbar lista för att välja startspelare.

**Bot-spelare (`dartBot.js`)**
Spelarobjekt: `{ type: "bot", avgScore: number, name: string, id: string }`.
`avgScore` (15–80) = snitt per RUNDA (3 pilar), 5 nivåer: Nybörjare 15–25 (E≈5.5/pil), Casual 26–40, Medel 41–55, Bra 56–70, Pro 71–80 (E≈25/pil).
- `generateBotThrow(avgPerRound, currentScore)` — i checkout-läge (≤170) används `CK`-tabellen; annars kalibrerad sannolikhetsfördelning.
- `generateBotBullThrow(avgScore)` — returnerar `{ x_mm, y_mm, dist }`. Hög avg → nära centrum.

**LiveBoard** (exporteras från `LiveScoring.jsx`)
SVG-dartboard med animerade pilmarkeringar. Tar `darts`-array från `useDartVision`. Boardgeometri Winmau Blade 6 (R=170 mm): Dubbel 162–170, Yttre singel 107–162, Tredubbel 99–107, Inre singel 15.9–99, Outer bull r=15.9, Bull r=6.35.

**Checkout-tabell**
`CK`-objektet är hårdkodat i `MatchGame.jsx`, `Game121.jsx` och `dartBot.js` — alla tre måste uppdateras om tabellen ändras.

---

### Backend

**Tråddelad state**
`state.py`: `SharedState`-singleton med `threading.Lock()`. Pipeline-tråden skriver; API-routes läser. Attribut: `frames` (JPEG bytes), `darts` (live-positioner), `throws` (poängsatta kast), `event_queue` (deque max 200), FPS, kalibreringsstatus.

**Pipeline-tråden** (`pipeline_thread.py`)
Oändlig loop: kamera-capture → YOLO-inferens → tracking → homografi → `score_from_mm()` → state-uppdatering med lock → push throw-events till `event_queue`.

**Kärnalgoritm** (`dartvision_score.py`)
- `DartTrack`: EMA-smoothing alpha=0.4, `scored`-flagga
- `DartTracker`: greedy nearest-neighbour matching, tröskel 18 mm, `MIN_HITS=3`, `MAX_AGE=8`
- `score_from_mm(x_mm, y_mm)`: mm-koordinater → zon, poäng, multiplikator, sektor, radien, vinkel, is_edge
- `BOARD_RADIUS_MAX_MM = 500`: homografi-valideringsgräns (förhöjd från 200 för att acceptera miss-kast utanför boardet)

**Kalibrering** (`routes/calibration.py`)
Tar 41 pixelkoordinater, kör `cv2.findHomography(..., cv2.RANSAC, 5.0)`, sparar JSON. Pipeline hot-reloadar utan omstart. Referensordning: Bull → 20 Doubles → 20 Triples.

**Auth** (`routes/auth.py`)
SQLite (`dartvision.db`). PBKDF2-HMAC-SHA256, 16-byte salt, 100k iterationer. Custom HMAC-tokens, 30 dagars giltighetstid — ingen extern JWT-lib.

---

## Kodkonventioner

- **Språk**: UI-text och kodkommentarer på svenska
- **Färgtema**: `#0a0a10` bakgrund, `#EF4444` röd accent; per-läge: `#10B981` grön (MatchGame/121), `#8B5CF6` lila (ATC), `#F59E0B` orange (Tournament)
- **Tailwind v4**: Enbart `@import "tailwindcss"` i `index.css` — ingen `tailwind.config.js`. Styling mestadels via `style={{}}`.
- **React 19**: Enbart funktionella komponenter och hooks. Inga ref-mutationer under render.
- **All scoring via kamera**: `ScoreEditor` och ⚙ Manuell finns enbart för att korrigera fel-detekteringar, inte som primär inmatning.

---

## Viktiga mönster

**Stale-closure-mönster för snabba WS-events**: När en callback tar emot snabba externa events och läser React-state, använd en `useRef` som synkroniseras i varje render. Se `cDartsRef` i `MatchGame.jsx` som kanoniskt exempel — utan det kan parallella `"throw"`-events se ett inaktuellt `cDarts`.

**Bot-timeout-mönster**: `botTimeoutRef = useRef(null)` håller pekare till botens `setTimeout`. `handleUndo` avbryter alltid timeoutet först. `botTrigger` (useState-räknare) ökas för att tvinga om bot-effekten när `cpIdx` inte ändras (t.ex. vid avbruten mitt-i-kast). Bot-effekten har guard: `if(cDartsRef.current.some(Boolean)) return` för att inte kasta om när pilar redan visas efter ångra.

**Port-hårdkodning**: Port 8000 är hårdkodad på tre ställen: `useDartVision.js`, `CalibrationPage.jsx`, `LiveScoring.jsx`. Ändra på alla tre vid portbyte.
