import { useState, useMemo, useEffect } from "react";
import HeatmapBoard from "./HeatmapBoard";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  HEATMAP-SIDA — Nås från profilsidan                      │
  │                                                             │
  │  Visar sammanställd heatmap av alla kast.                  │
  │  Filter: Alla / Match / 121 / Around the Clock             │
  │                                                             │
  │  Stats:                                                     │
  │  - Totalt antal kast                                       │
  │  - Mest träffade segment                                   │
  │  - Mest träffade nummer                                    │
  │                                                             │
  │  Backend:                                                   │
  │  - GET /api/user/heatmap?mode=all|match|121|atc            │
  │    Response: { darts: [{x, y, mode, zone, timestamp}] }    │
  └─────────────────────────────────────────────────────────────┘
*/

const MODES = ["all", "match", "121", "atc"];
const EMPTY = { all: [], match: [], "121": [], atc: [] };

function Opt({ label, count, selected, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2.5 px-3 rounded-xl text-center transition-all duration-200"
      style={{
        background: selected ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
        border: selected ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
        color: selected ? "#A78BFA" : "rgba(255,255,255,0.4)",
      }}>
      <span className="text-sm font-semibold block">{label}</span>
      <span className="text-[10px]" style={{ color: selected ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.15)" }}>{count} kast</span>
    </button>
  );
}

export default function HeatmapPage({ navigate, user }) {
  const [mode, setMode] = useState("all");
  const [heatmapData, setHeatmapData] = useState(EMPTY);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("dart_token");
    if (!token) return;
    MODES.forEach(m => {
      fetch(`http://localhost:8000/api/user/heatmap?mode=${m}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          const pts = (data.darts || []).map(d => ({
            x: 200 + d.x_mm,
            y: 200 - d.y_mm,
          }));
          setHeatmapData(prev => ({ ...prev, [m]: pts }));
        })
        .catch(() => {});
    });
  }, [user?.id]);

  const darts = heatmapData[mode] || [];

  /* Mest träffade segment (mock) */
  const topSegments = useMemo(() => {
    const counts = {};
    darts.forEach(d => {
      /* Enkel segment-beräkning */
      const cx = 200, cy = 200;
      const angle = ((Math.atan2(d.y - cy, d.x - cx) * 180) / Math.PI + 360 + 99) % 360;
      const si = Math.floor(angle / 18);
      const BN = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
      const n = BN[si] || 20;
      counts[n] = (counts[n] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [darts]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)", fontFamily: "'Rajdhani','Segoe UI',sans-serif" }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-3">
        <button onClick={() => navigate("profile")} className="flex items-center gap-2 w-20 transition-colors duration-200" style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6" /></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-xl font-extrabold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.8)" }}>Heatmap</span>
        </div>
        <div className="w-20" />
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pb-12">

        {/* Mode filter */}
        <div className="flex gap-2 w-full max-w-md mb-6">
          <Opt label="Alla" count={heatmapData.all.length} selected={mode === "all"} onClick={() => setMode("all")} />
          <Opt label="Match" count={heatmapData.match.length} selected={mode === "match"} onClick={() => setMode("match")} />
          <Opt label="121" count={heatmapData["121"].length} selected={mode === "121"} onClick={() => setMode("121")} />
          <Opt label="ATC" count={heatmapData.atc.length} selected={mode === "atc"} onClick={() => setMode("atc")} />
        </div>

        {/* Heatmap */}
        <div className="w-full max-w-sm mb-6">
          <HeatmapBoard
            darts={darts}
            width={400}
            showBoard={true}
            radius={28}
            intensity={0.18}
            label={`${darts.length} kast`}
          />
        </div>

        {/* Stats */}
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.2)" }}>Mest träffade</span>
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
          </div>

          <div className="flex flex-col gap-2">
            {topSegments.map(([num, count], i) => {
              const pct = darts.length ? Math.round((count / darts.length) * 100) : 0;
              const colors = ["#EF4444", "#F59E0B", "#10B981", "#8B5CF6", "#60A5FA"];
              return (
                <div key={num} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-sm font-bold w-6" style={{ color: colors[i] }}>{i + 1}.</span>
                  <span className="text-lg font-extrabold" style={{ color: "rgba(255,255,255,0.8)" }}>{num}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[i] }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>{count}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
