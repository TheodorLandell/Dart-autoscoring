import { useState, useEffect, useRef } from "react";
import useDartVision from "./useDartVision";
import { LiveBoard } from "./LiveScoring";
import { generateBotBullThrow } from "./dartBot";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  THROW FOR BULL — Automatisk via kamera/YOLO               │
  │                                                             │
  │  Används av:                                               │
  │  - MatchSetup (vanlig match)                               │
  │  - TournamentBracket (innan varje turneringsmatch)         │
  │                                                             │
  │  Props:                                                     │
  │  - players: array av spelarobjekt                          │
  │  - onComplete(orderedPlayers): callback med sorterad lista │
  │  - onBack(): callback för avbryt/tillbaka                  │
  │  - title?: valfri rubrik (default "Throw for bull")        │
  │  - subtitle?: valfri underrubrik                           │
  └─────────────────────────────────────────────────────────────┘
*/

const playerColors = ["#EF4444","#10B981","#8B5CF6","#F59E0B","#60A5FA","#EC4899","#14B8A6","#F97316"];
const SKIP_DIST = 9999;

export default function ThrowForBull({
  players,
  onComplete,
  onBack,
  title = "Throw for bull",
  subtitle = "Närmast bull börjar matchen",
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [throws, setThrows]             = useState([]); // [{playerIndex, x_mm, y_mm, dist, zone}]
  const [phase, setPhase]               = useState("throwing"); // "throwing" | "results"
  const [selectedStarterIdx, setSelectedStarterIdx] = useState(0);

  // Refs for stale-closure safety inside effects/callbacks
  const throwsRef    = useRef([]);
  const recordedKeys = useRef(new Set()); // "x.x_y.y" keys of already-recorded scored darts
  const undonePos    = useRef(null);      // {x_mm, y_mm} position to ignore after undo

  useEffect(() => { throwsRef.current = throws; }, [throws]);

  const isThrowingPhase = phase === "throwing";

  const { connected, darts, resetBackend } = useDartVision({
    enabled: isThrowingPhase,
  });

  // Reset backend once on mount so prior throws don't interfere
  useEffect(() => { resetBackend(); }, [resetBackend]);

  // ── BOT AUTO-THROW ────────────────────────────────────────
  // Triggas varje gång currentIndex ändras. Om spelaren är en bot →
  // generera kastposition direkt och hoppa vidare.
  useEffect(() => {
    if (!isThrowingPhase) return;
    const player = players[currentIndex];
    if (!player || player.type !== "bot") return;

    const result = generateBotBullThrow(player.avgScore ?? 40);
    const playerIdx = throwsRef.current.length;

    const newThrows = [
      ...throwsRef.current,
      { playerIndex: playerIdx, x_mm: result.x_mm, y_mm: result.y_mm, dist: result.dist, zone: "BOT", isBot: true },
    ];
    throwsRef.current = newThrows;
    setThrows(newThrows);

    if (newThrows.length >= players.length) {
      setPhase("results");
      setSelectedStarterIdx(0);
    } else {
      setCurrentIndex(newThrows.length);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isThrowingPhase]);

  // ── MAIN DETECTION EFFECT ──────────────────────────────────
  // Watch darts state (updated ~30fps from WS) for newly scored darts.
  useEffect(() => {
    if (!isThrowingPhase) return;
    // Bot-spelare hanteras i eget effect — skippa kamera-detection
    if (players[currentIndex]?.type === "bot") return;

    for (const dart of darts) {
      if (!dart.scored) continue;

      const key = `${dart.x_mm?.toFixed(1)}_${dart.y_mm?.toFixed(1)}`;
      if (recordedKeys.current.has(key)) continue;

      // If we just undid a throw, ignore the old dart if still on the board
      if (undonePos.current) {
        const dx = (dart.x_mm ?? 0) - undonePos.current.x_mm;
        const dy = (dart.y_mm ?? 0) - undonePos.current.y_mm;
        if (Math.sqrt(dx * dx + dy * dy) < 25) continue;
      }

      // ── New throw detected ──
      recordedKeys.current.add(key);
      undonePos.current = null;

      const x_mm = dart.x_mm ?? 0;
      const y_mm = dart.y_mm ?? 0;
      const dist = Math.sqrt(x_mm * x_mm + y_mm * y_mm);
      const playerIdx = throwsRef.current.length; // player order is sequential

      const newThrows = [
        ...throwsRef.current,
        { playerIndex: playerIdx, x_mm, y_mm, dist, zone: dart.zone ?? "MISS" },
      ];
      throwsRef.current = newThrows;
      setThrows(newThrows);

      if (newThrows.length >= players.length) {
        setPhase("results");
        setSelectedStarterIdx(0);
      } else {
        setCurrentIndex(newThrows.length);
      }
      break; // handle at most one new dart per effect run
    }
  }, [darts, isThrowingPhase, players.length]);

  // ── UNDO ──────────────────────────────────────────────────
  const handleUndo = () => {
    const cur = throwsRef.current;
    if (cur.length === 0) return;
    const last = cur[cur.length - 1];

    // Remove the key so the dart can be re-detected (but track its position
    // so we ignore an immediate re-detection if the dart is still on the board)
    if (last.dist < SKIP_DIST) {
      const key = `${last.x_mm?.toFixed(1)}_${last.y_mm?.toFixed(1)}`;
      recordedKeys.current.delete(key);
      undonePos.current = { x_mm: last.x_mm, y_mm: last.y_mm };
    }

    const newThrows = cur.slice(0, -1);
    throwsRef.current = newThrows;
    setThrows(newThrows);
    setPhase("throwing");
    setCurrentIndex(last.playerIndex);
    resetBackend(); // clear backend so it doesn't immediately re-score the undone dart
  };

  // ── SKIP ──────────────────────────────────────────────────
  const handleSkip = () => {
    if (!isThrowingPhase) return;
    const playerIdx = throwsRef.current.length;
    const newThrows = [
      ...throwsRef.current,
      { playerIndex: playerIdx, x_mm: 0, y_mm: 0, dist: SKIP_DIST, zone: "MISS" },
    ];
    throwsRef.current = newThrows;
    setThrows(newThrows);
    if (newThrows.length >= players.length) {
      setPhase("results");
      setSelectedStarterIdx(0);
    } else {
      setCurrentIndex(newThrows.length);
    }
  };

  // ── START MATCH ───────────────────────────────────────────
  const handleStart = () => {
    const sorted = [...throws].sort((a, b) => a.dist - b.dist);
    const starter = sorted[selectedStarterIdx];
    const rest    = sorted.filter((_, i) => i !== selectedStarterIdx);
    onComplete([players[starter.playerIndex], ...rest.map(t => players[t.playerIndex])]);
  };

  // ── DERIVED ───────────────────────────────────────────────
  const sortedResults  = [...throws].sort((a, b) => a.dist - b.dist);
  const currentPlayer  = players[currentIndex];
  const accentColor    = playerColors[currentIndex % playerColors.length];

  const formatDist = (d) => {
    if (d >= SKIP_DIST) return "Hoppades över";
    if (d < 1)          return "<1 mm";
    return `${Math.round(d)} mm`;
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden" style={{
      background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
      fontFamily: "'Rajdhani','Segoe UI',sans-serif",
    }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }}/>

      {/* ── HEADER ── */}
      <header className="relative z-10 flex items-center px-6 py-3" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <button onClick={onBack}
          className="flex items-center gap-2 w-24 transition-colors duration-200"
          style={{color:"rgba(255,255,255,0.3)"}}
          onMouseEnter={(e) => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
          onMouseLeave={(e) => e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Avbryt</span>
        </button>

        <div className="flex-1 text-center">
          <span className="text-xl font-extrabold uppercase tracking-wider" style={{color:"rgba(255,255,255,0.9)"}}>
            {title}
          </span>
          <span className="block text-[10px] uppercase tracking-widest mt-0.5" style={{color:"rgba(255,255,255,0.2)"}}>
            {subtitle}
          </span>
        </div>

        <div className="w-24 flex justify-end">
          {isThrowingPhase && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{
              background: connected ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              border:     connected ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(239,68,68,0.35)",
            }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: connected ? "#10B981" : "#EF4444",
                animation:  connected ? "none" : "pulse 1.5s ease-in-out infinite",
              }}/>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{color: connected ? "#10B981" : "#EF4444"}}>
                {connected ? "Live" : "..."}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── TOP: CAMERA + BOARD ── */}
      <div className="relative z-10 flex gap-3 px-4 pt-4 pb-3">
        {/* Camera */}
        <div className="relative flex-1 rounded-xl overflow-hidden" style={{height:260, background:"#0a0a0f", border:"1px solid rgba(255,255,255,0.06)"}}>
          <img src="http://localhost:8000/api/stream/camera" className="w-full h-full" style={{objectFit:"contain"}} alt=""/>
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
            style={{background:"rgba(0,0,0,0.6)", color:"rgba(255,255,255,0.3)"}}>
            Kamera + YOLO
          </div>
          {/* Player overlay */}
          {isThrowingPhase && currentPlayer && (
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <div className="px-4 py-1.5 rounded-lg" style={{background:"rgba(0,0,0,0.72)", border:`1px solid ${accentColor}40`}}>
                <span className="text-sm font-bold" style={{color:accentColor}}>
                  {currentPlayer.name} — Kasta mot bull!
                </span>
              </div>
            </div>
          )}
          {phase === "results" && (
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <div className="px-4 py-1.5 rounded-lg" style={{background:"rgba(0,0,0,0.72)", border:"1px solid rgba(16,185,129,0.3)"}}>
                <span className="text-sm font-bold" style={{color:"#10B981"}}>Alla har kastat — välj startspelare</span>
              </div>
            </div>
          )}
        </div>

        {/* Mini board — inkl. bot-kast som syntetiska pilar */}
        <div className="w-56 rounded-xl p-3 flex flex-col" style={{background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)"}}>
          <span className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{color:"rgba(255,255,255,0.25)"}}>
            Live board
          </span>
          <LiveBoard darts={[
            ...darts,
            ...throws.filter(t=>t.isBot).map(t=>({
              svg_x: 200 + t.x_mm * (170/170),
              svg_y: 200 + t.y_mm * (170/170),
              zone:"BOT", score:0, scored:true, conf:1,
            })),
          ]}/>
        </div>
      </div>

      {/* ── MAIN ── */}
      <main className="relative z-10 px-4 pb-12">

        {/* ── THROWING PHASE ── */}
        {isThrowingPhase && (
          <>
            {/* Current player card */}
            <div className="w-full max-w-md mx-auto mb-4 p-4 rounded-xl text-center" style={{
              background: `${accentColor}0f`,
              border: `1px solid ${accentColor}25`,
            }}>
              <span className="text-[10px] uppercase tracking-widest block mb-1" style={{color:"rgba(255,255,255,0.3)"}}>
                Pil {currentIndex + 1} av {players.length}
              </span>
              <span className="text-xl font-extrabold block" style={{color:accentColor}}>
                {currentPlayer?.type==="bot"?"🤖 ":""}{currentPlayer?.name}
              </span>
              <span className="text-sm mt-0.5 block" style={{color:"rgba(255,255,255,0.35)"}}>
                {currentPlayer?.type==="bot" ? "Boten kastar automatiskt..." : "Kasta din pil mot bull!"}
              </span>
            </div>

            {/* Waiting — döljs för bot-spelare */}
            {currentPlayer?.type !== "bot" && (
              <div className="mb-4 p-4 rounded-xl w-full max-w-md mx-auto text-center"
                style={{background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)"}}>
                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-2" style={{
                  background: connected ? "#10B981" : "#EF4444",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}/>
                <span className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>
                  {connected ? "Väntar på kast..." : "Ansluter till kamera..."}
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 justify-center mb-5">
              <button onClick={handleUndo} disabled={throws.length === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{
                  background: throws.length ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                  color:      throws.length ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
                  border:     throws.length ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) => { if (throws.length) e.currentTarget.style.color="#EF4444"; }}
                onMouseLeave={(e) => { if (throws.length) e.currentTarget.style.color="rgba(255,255,255,0.5)"; }}>
                ↩ Ångra
              </button>
              <button onClick={handleSkip}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.35)", border:"1px solid rgba(255,255,255,0.08)"}}
                onMouseEnter={(e) => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
                onMouseLeave={(e) => e.currentTarget.style.color="rgba(255,255,255,0.35)"}>
                Hoppa över →
              </button>
            </div>
          </>
        )}

        {/* ── RESULTS PHASE ── */}
        {phase === "results" && (
          <>
            <div className="w-full max-w-md mx-auto mb-5 p-5 rounded-xl"
              style={{background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.18)"}}>
              <span className="text-xs font-bold uppercase tracking-widest block mb-3" style={{color:"rgba(255,255,255,0.3)"}}>
                Resultat — Klicka för att välja startspelare
              </span>
              <div className="flex flex-col gap-2">
                {sortedResults.map((t, i) => {
                  const p        = players[t.playerIndex];
                  const pColor   = playerColors[t.playerIndex % playerColors.length];
                  const isSel    = i === selectedStarterIdx;
                  return (
                    <button key={i} onClick={() => setSelectedStarterIdx(i)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 w-full text-left"
                      style={{
                        background: isSel ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                        border:     isSel ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      }}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold w-5 text-center"
                          style={{color: isSel ? "#10B981" : "rgba(255,255,255,0.25)"}}>
                          {i + 1}.
                        </span>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:pColor}}/>
                        <span className="text-sm font-bold" style={{color: isSel ? "#10B981" : "rgba(255,255,255,0.7)"}}>
                          {p?.type==="bot"?"🤖 ":""}{p?.name}
                        </span>
                        {isSel && (
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:"#10B981"}}>
                            Börjar!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{color:"rgba(255,255,255,0.3)"}}>
                          {formatDist(t.dist)}
                        </span>
                        {isSel && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{background:"rgba(16,185,129,0.2)", border:"1px solid rgba(16,185,129,0.4)"}}>
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={handleUndo}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.1)"}}
                onMouseEnter={(e) => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
                onMouseLeave={(e) => e.currentTarget.style.color="rgba(255,255,255,0.4)"}>
                ↩ Kasta om sista
              </button>
              <button onClick={handleStart}
                className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
                style={{background:"linear-gradient(135deg, #EF4444 0%, #DC2626 100%)", color:"#fff", boxShadow:"0 4px 20px rgba(239,68,68,0.3)"}}
                onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 4px 30px rgba(239,68,68,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 4px 20px rgba(239,68,68,0.3)"; }}>
                Starta match!
              </button>
            </div>
          </>
        )}

        {/* ── PLAYER PROGRESS PILLS ── */}
        <div className="flex gap-2 flex-wrap justify-center mt-5">
          {players.map((p, i) => {
            const thrown   = throws.some(t => t.playerIndex === i);
            const isCurrent = i === currentIndex && isThrowingPhase;
            const pColor   = playerColors[i % playerColors.length];
            return (
              <div key={p.id ?? i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: isCurrent ? `${pColor}15` : "rgba(255,255,255,0.02)",
                  border:     isCurrent ? `1px solid ${pColor}40` : "1px solid rgba(255,255,255,0.06)",
                  color:      isCurrent ? pColor : "rgba(255,255,255,0.3)",
                }}>
                <div className="w-2 h-2 rounded-full" style={{background:pColor, opacity: thrown ? 0.4 : 1}}/>
                {p.type==="bot"?"🤖 ":""}{p.name}
                {thrown && <span style={{color:"rgba(255,255,255,0.2)"}}>✓</span>}
              </div>
            );
          })}
        </div>
      </main>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}
