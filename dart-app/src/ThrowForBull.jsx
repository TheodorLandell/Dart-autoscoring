import { useState, useRef } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  THROW FOR BULL — Delad komponent                          │
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

const playerColors = ["#EF4444", "#10B981", "#8B5CF6", "#F59E0B", "#60A5FA", "#EC4899", "#14B8A6", "#F97316"];

/* ============ DARTBOARD SVG ============ */
function Dartboard({ darts, onClickBoard }) {
  const svgRef = useRef(null);
  const boardRadius = 170;
  const bullRadius = 12.7;
  const outerBullRadius = 31.8;
  const cx = 200;
  const cy = 200;

  const handleClick = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= boardRadius) {
      onClickBoard(x, y, dist);
    }
  };

  const numbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const segAngle = 360 / 20;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 400"
      className="w-full max-w-md cursor-crosshair"
      onClick={handleClick}
      style={{ filter: "drop-shadow(0 0 40px rgba(0,0,0,0.5))" }}
    >
      <circle cx={cx} cy={cy} r={boardRadius} fill="#1a1a1a" stroke="#333" strokeWidth="2" />

      {numbers.map((num, i) => {
        const startAngle = (i * segAngle - 99) * (Math.PI / 180);
        const endAngle = ((i + 1) * segAngle - 99) * (Math.PI / 180);
        const isEven = i % 2 === 0;

        const rings = [
          { inner: 99, outer: boardRadius, fill: isEven ? "#1a1a1a" : "#f0e6d3" },
          { inner: 95, outer: 99, fill: isEven ? "#e8373e" : "#1b8a42" },
          { inner: 57, outer: 95, fill: isEven ? "#1a1a1a" : "#f0e6d3" },
          { inner: 53, outer: 57, fill: isEven ? "#e8373e" : "#1b8a42" },
        ];

        return rings.map((ring, ri) => {
          const x1 = cx + ring.inner * Math.cos(startAngle);
          const y1 = cy + ring.inner * Math.sin(startAngle);
          const x2 = cx + ring.outer * Math.cos(startAngle);
          const y2 = cy + ring.outer * Math.sin(startAngle);
          const x3 = cx + ring.outer * Math.cos(endAngle);
          const y3 = cy + ring.outer * Math.sin(endAngle);
          const x4 = cx + ring.inner * Math.cos(endAngle);
          const y4 = cy + ring.inner * Math.sin(endAngle);

          return (
            <path
              key={`${i}-${ri}`}
              d={`M${x1} ${y1} L${x2} ${y2} A${ring.outer} ${ring.outer} 0 0 1 ${x3} ${y3} L${x4} ${y4} A${ring.inner} ${ring.inner} 0 0 0 ${x1} ${y1}Z`}
              fill={ring.fill}
              stroke="#333"
              strokeWidth="0.5"
            />
          );
        });
      })}

      <circle cx={cx} cy={cy} r={outerBullRadius} fill="#1b8a42" stroke="#333" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={bullRadius} fill="#e8373e" stroke="#333" strokeWidth="0.5" />

      {numbers.map((num, i) => {
        const angle = (i * segAngle - 90) * (Math.PI / 180);
        const tx = cx + (boardRadius + 18) * Math.cos(angle);
        const ty = cy + (boardRadius + 18) * Math.sin(angle);
        return (
          <text
            key={`num-${num}`}
            x={tx} y={ty}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.7)"
            fontSize="14"
            fontWeight="600"
            fontFamily="'Rajdhani', sans-serif"
          >
            {num}
          </text>
        );
      })}

      {darts.map((dart, i) => (
        <g key={i}>
          <circle cx={dart.x + 2} cy={dart.y + 2} r="6" fill="rgba(0,0,0,0.3)" />
          <circle cx={dart.x} cy={dart.y} r="5" fill={dart.color} stroke="#fff" strokeWidth="1.5" />
          <text
            x={dart.x} y={dart.y + 0.5}
            textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize="7" fontWeight="700"
          >
            {dart.playerIndex + 1}
          </text>
          <line
            x1={cx} y1={cy} x2={dart.x} y2={dart.y}
            stroke={dart.color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4"
          />
        </g>
      ))}

      <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
    </svg>
  );
}

/* ============ THROW FOR BULL ============ */
export default function ThrowForBull({ players, onComplete, onBack, title = "Throw for bull", subtitle = "Närmast bull börjar matchen" }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [darts, setDarts] = useState([]);
  const [tempDart, setTempDart] = useState(null);
  const [phase, setPhase] = useState("throwing"); // "throwing" | "results"

  const handleBoardClick = (x, y, dist) => {
    if (phase !== "throwing") return;
    setTempDart({ x, y, dist, playerIndex: currentIndex, color: playerColors[currentIndex % playerColors.length] });
  };

  const confirmDart = () => {
    if (!tempDart) return;
    const newDarts = [...darts, tempDart];
    setDarts(newDarts);
    setTempDart(null);

    if (currentIndex + 1 >= players.length) {
      setPhase("results");
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const resetDart = () => {
    setTempDart(null);
  };

  const sortedResults = [...darts].sort((a, b) => a.dist - b.dist);
  const winner = sortedResults.length > 0 ? players[sortedResults[0].playerIndex] : null;

  const handleStart = () => {
    const order = sortedResults.map((d) => players[d.playerIndex]);
    onComplete(order);
  };

  const allDarts = tempDart ? [...darts, tempDart] : darts;
  const currentPlayer = players[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
    >
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-10 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
        style={{ color: "rgba(255,255,255,0.3)" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L4 8l6 6" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-widest">Avbryt</span>
      </button>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg px-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.9)" }}>
            {title}
          </h1>
          <p className="text-xs uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
            {subtitle}
          </p>
        </div>

        {/* Current player indicator */}
        {phase === "throwing" && (
          <div
            className="px-6 py-3 rounded-xl text-center"
            style={{
              background: playerColors[currentIndex % playerColors.length] + "15",
              border: `1px solid ${playerColors[currentIndex % playerColors.length]}30`,
            }}
          >
            <span className="text-xs uppercase tracking-widest block mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              Pil {currentIndex + 1} av {players.length}
            </span>
            <span className="text-xl font-bold" style={{ color: playerColors[currentIndex % playerColors.length] }}>
              {currentPlayer.name} — Kasta din pil!
            </span>
          </div>
        )}

        {/* Results */}
        {phase === "results" && (
          <div
            className="px-6 py-4 rounded-xl text-center w-full"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <span className="text-xs uppercase tracking-widest block mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              Resultat — Spelordning
            </span>
            <div className="flex flex-col gap-2 mt-3">
              {sortedResults.map((dart, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{
                  background: i === 0 ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold w-6" style={{ color: i === 0 ? "#10B981" : "rgba(255,255,255,0.3)" }}>
                      {i + 1}.
                    </span>
                    <div className="w-3 h-3 rounded-full" style={{ background: dart.color }} />
                    <span className="text-sm font-semibold" style={{ color: i === 0 ? "#10B981" : "rgba(255,255,255,0.6)" }}>
                      {players[dart.playerIndex].name}
                    </span>
                    {i === 0 && <span className="text-[10px] uppercase tracking-widest" style={{ color: "#10B981" }}>Börjar!</span>}
                  </div>
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {dart.dist.toFixed(1)}px
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dartboard */}
        <Dartboard
          darts={allDarts}
          onClickBoard={handleBoardClick}
        />

        {/* Action buttons */}
        <div className="flex gap-3">
          {phase === "throwing" && tempDart && (
            <>
              <button
                onClick={resetDart}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Flytta
              </button>
              <button
                onClick={confirmDart}
                className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                }}
                onMouseEnter={(e) => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 4px 30px rgba(16,185,129,0.4)"; }}
                onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 20px rgba(16,185,129,0.3)"; }}
              >
                Bekräfta pil
              </button>
            </>
          )}
          {phase === "throwing" && !tempDart && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Klicka på tavlan för att placera pilen
            </span>
          )}
          {phase === "results" && (
            <button
              onClick={handleStart}
              className="px-10 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
              }}
              onMouseEnter={(e) => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 4px 30px rgba(239,68,68,0.5)"; }}
              onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 20px rgba(239,68,68,0.3)"; }}
            >
              Starta match!
            </button>
          )}
        </div>

        {/* Player pills at bottom */}
        <div className="flex gap-2 flex-wrap justify-center">
          {players.map((p, i) => {
            const thrown = darts.some((d) => d.playerIndex === i);
            const isCurrent = i === currentIndex && phase === "throwing";
            return (
              <div
                key={p.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: isCurrent ? playerColors[i % playerColors.length] + "15" : "rgba(255,255,255,0.02)",
                  border: isCurrent ? `1px solid ${playerColors[i % playerColors.length]}40` : "1px solid rgba(255,255,255,0.06)",
                  color: thrown ? "rgba(255,255,255,0.3)" : playerColors[i % playerColors.length],
                  opacity: thrown && !isCurrent ? 0.5 : 1,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: playerColors[i % playerColors.length] }} />
                {p.name}
                {thrown && <span style={{ color: "rgba(255,255,255,0.2)" }}> ✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
