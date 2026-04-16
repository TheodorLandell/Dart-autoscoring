import { useState, useEffect, useRef, useCallback } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  LIVE SCORING — Realtidsvy från kameror + YOLO-pipeline    │
  │                                                             │
  │  Ansluter till FastAPI-backend via:                         │
  │  - MJPEG stream:  /api/stream/camera                       │
  │  - MJPEG stream:  /api/stream/board                        │
  │  - WebSocket:     /ws/scoring (dart events + state)        │
  │  - REST:          /api/reset, /api/status                  │
  │                                                             │
  │  Visar:                                                     │
  │  - Kamerabild med YOLO bounding boxes                      │
  │  - Dartboard med live-positioner                           │
  │  - Scorelista med senaste kast                             │
  │  - FPS, anslutningsstatus, kalibreringsinfo                │
  └─────────────────────────────────────────────────────────────┘
*/

const API_BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/scoring";

const BN = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

/* ============ DARTBOARD SVG ============ */
export function LiveBoard({ darts = [] }) {
  const cx = 200, cy = 200, R = 170;

  return (
    <svg viewBox="0 0 400 400" className="w-full" style={{ filter: "drop-shadow(0 0 30px rgba(0,0,0,0.5))" }}>
      <circle cx={cx} cy={cy} r={R} fill="#1a1a1a" stroke="#333" strokeWidth="2" />
      {BN.map((num, i) => {
        const sa = (i * 18 - 99) * (Math.PI / 180);
        const ea = ((i + 1) * 18 - 99) * (Math.PI / 180);
        const ev = i % 2 === 0;
        return [
          { i: 99, o: R, f: ev ? "#1a1a1a" : "#f0e6d3" },
          { i: 95, o: 99, f: ev ? "#e8373e" : "#1b8a42" },
          { i: 57, o: 95, f: ev ? "#1a1a1a" : "#f0e6d3" },
          { i: 53, o: 57, f: ev ? "#e8373e" : "#1b8a42" },
        ].map((r, ri) => {
          const x1 = cx + r.i * Math.cos(sa), y1 = cy + r.i * Math.sin(sa);
          const x2 = cx + r.o * Math.cos(sa), y2 = cy + r.o * Math.sin(sa);
          const x3 = cx + r.o * Math.cos(ea), y3 = cy + r.o * Math.sin(ea);
          const x4 = cx + r.i * Math.cos(ea), y4 = cy + r.i * Math.sin(ea);
          return (
            <path key={`${i}-${ri}`}
              d={`M${x1} ${y1}L${x2} ${y2}A${r.o} ${r.o} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${r.i} ${r.i} 0 0 0 ${x1} ${y1}Z`}
              fill={r.f} stroke="#333" strokeWidth="0.5" opacity="0.6"
            />
          );
        });
      })}
      <circle cx={cx} cy={cy} r={31.8} fill="#1b8a42" stroke="#333" strokeWidth="0.5" opacity="0.6" />
      <circle cx={cx} cy={cy} r={12.7} fill="#e8373e" stroke="#333" strokeWidth="0.5" opacity="0.6" />

      {/* Siffror */}
      {BN.map((n, i) => {
        const a = (i * 18 - 90) * (Math.PI / 180);
        return (
          <text key={n}
            x={cx + (R + 18) * Math.cos(a)} y={cy + (R + 18) * Math.sin(a)}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.5)" fontSize="13" fontWeight="600"
            fontFamily="'Rajdhani',sans-serif"
          >{n}</text>
        );
      })}

      {/* Live dart-positioner */}
      {darts.map((d, i) => {
        const isScored = d.scored;
        const color = d.score >= 40 ? "#F59E0B" : d.score === 0 ? "#EF4444" : "#10B981";
        return (
          <g key={i}>
            {/* Pulsande glow */}
            <circle cx={d.svg_x} cy={d.svg_y} r="12" fill={color} opacity="0.15">
              <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0.05;0.2" dur="1.5s" repeatCount="indefinite" />
            </circle>
            {/* Skugga */}
            <circle cx={d.svg_x + 1.5} cy={d.svg_y + 1.5} r="5" fill="rgba(0,0,0,0.4)" />
            {/* Pil */}
            <circle cx={d.svg_x} cy={d.svg_y} r="5" fill={color}
              stroke={isScored ? "#fff" : color} strokeWidth={isScored ? "2" : "1"} />
            {/* Label */}
            <text x={d.svg_x} y={d.svg_y - 10} textAnchor="middle"
              fill={color} fontSize="9" fontWeight="700"
              fontFamily="'Rajdhani',sans-serif"
            >{d.zone}</text>
            {/* Confidence-ring */}
            <circle cx={d.svg_x} cy={d.svg_y} r="8" fill="none"
              stroke={color} strokeWidth="0.5" opacity={d.conf}
              strokeDasharray={`${d.conf * 50} 50`}
            />
          </g>
        );
      })}

      {/* Crosshair i centrum */}
      <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
    </svg>
  );
}

/* ============ THROW ROW ============ */
function ThrowRow({ t, index, isNew }) {
  const color = t.score >= 40 ? "#F59E0B" : t.score === 0 ? "#EF4444" : "#10B981";

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-300"
      style={{
        background: isNew ? `${color}10` : "rgba(255,255,255,0.02)",
        border: `1px solid ${isNew ? color + "30" : "rgba(255,255,255,0.04)"}`,
        animation: isNew ? "slideIn 0.3s ease-out" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono w-5 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          {index + 1}
        </span>
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-sm font-bold" style={{ color }}>
          {t.zone}
        </span>
        {t.is_edge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
            EDGE
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-extrabold" style={{ color: "rgba(255,255,255,0.8)" }}>
          {t.score}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>
          {t.cam === "left" ? "L" : "R"}
        </span>
      </div>
    </div>
  );
}

/* ============ STATUS BADGE ============ */
function StatusBadge({ connected, fps, hasCalibration }) {
  return (
    <div className="flex items-center gap-4">
      {/* Connection */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{
          background: connected ? "#10B981" : "#EF4444",
          boxShadow: connected ? "0 0 8px rgba(16,185,129,0.5)" : "0 0 8px rgba(239,68,68,0.5)",
          animation: connected ? "none" : "pulse 1s infinite",
        }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: connected ? "#10B981" : "#EF4444" }}>
          {connected ? "Live" : "Offline"}
        </span>
      </div>

      {/* FPS */}
      {connected && fps > 0 && (
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
          {fps} fps
        </span>
      )}

      {/* Calibration */}
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={hasCalibration ? "#10B981" : "#F59E0B"} strokeWidth="1.5">
          <circle cx="6" cy="6" r="4" />
          <line x1="6" y1="1" x2="6" y2="3" />
          <line x1="6" y1="9" x2="6" y2="11" />
          <line x1="1" y1="6" x2="3" y2="6" />
          <line x1="9" y1="6" x2="11" y2="6" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: hasCalibration ? "rgba(255,255,255,0.25)" : "#F59E0B" }}>
          {hasCalibration ? "Kalibrerad" : "Ej kalibrerad"}
        </span>
      </div>
    </div>
  );
}

/* ============ VIEW TOGGLE ============ */
function ViewToggle({ view, setView }) {
  const opts = [
    { id: "camera", label: "Kamera" },
    { id: "board", label: "Board" },
    { id: "split", label: "Delad" },
  ];

  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => setView(o.id)}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-150"
          style={{
            background: view === o.id ? "rgba(239,68,68,0.15)" : "transparent",
            color: view === o.id ? "#EF4444" : "rgba(255,255,255,0.3)",
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}


/* ============ MAIN COMPONENT ============ */
export default function LiveScoring({ navigate }) {
  const [connected, setConnected] = useState(false);
  const [darts, setDarts] = useState([]);
  const [throws, setThrows] = useState([]);
  const [total, setTotal] = useState(0);
  const [fps, setFps] = useState(0);
  const [hasCalibration, setHasCalibration] = useState(false);
  const [view, setView] = useState("split");
  const [newThrowIdx, setNewThrowIdx] = useState(-1);

  const wsRef = useRef(null);
  const throwCountRef = useRef(0);
  const reconnectRef = useRef(null);

  /* ── WebSocket ── */
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      console.log("✅ WebSocket ansluten");
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("❌ WebSocket frånkopplad, försöker igen om 2s...");
      reconnectRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "state") {
          setDarts(data.darts || []);
          setFps(data.fps || 0);
          setHasCalibration(data.has_calibration || false);

          const newThrows = data.throws || [];
          if (newThrows.length > throwCountRef.current) {
            setNewThrowIdx(newThrows.length - 1);
            setTimeout(() => setNewThrowIdx(-1), 1500);
          }
          throwCountRef.current = newThrows.length;
          setThrows(newThrows);
          setTotal(data.total || 0);
        }

        if (data.type === "throw") {
          /* Flash-effekt vid nytt kast hanteras via state ovan */
        }

        if (data.type === "reset") {
          setThrows([]);
          setTotal(0);
          setDarts([]);
          throwCountRef.current = 0;
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  /* ── Reset ── */
  const handleReset = async () => {
    try {
      await fetch(`${API_BASE}/api/reset`, { method: "POST" });
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  /* ── Runda-stats ── */
  const roundDarts = throws.length % 3 === 0 && throws.length > 0
    ? throws.slice(-3) : throws.slice(-(throws.length % 3 || 3));
  const roundTotal = roundDarts.reduce((s, t) => s + t.score, 0);

  return (
    <div className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}>

      {/* Grid bakgrund */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* ========= HEADER ========= */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3">
        <button onClick={() => navigate("lobby")}
          className="flex items-center gap-2 transition-colors duration-200"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Lobby</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.8)" }}>
            Live Scoring
          </span>
          <div className="w-2 h-2 rounded-full"
            style={{
              background: connected ? "#10B981" : "#EF4444",
              animation: connected ? "none" : "pulse 1.5s ease-in-out infinite",
            }} />
        </div>

        <ViewToggle view={view} setView={setView} />
      </header>

      {/* ========= STATUS BAR ========= */}
      <div className="relative z-10 flex items-center justify-between px-6 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <StatusBadge connected={connected} fps={fps} hasCalibration={hasCalibration} />
        <div className="flex items-center gap-3">
          <button onClick={handleReset}
            className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}>
            Reset
          </button>
        </div>
      </div>

      {/* ========= MAIN CONTENT ========= */}
      <main className="relative z-10 flex flex-col lg:flex-row gap-4 px-4 py-4" style={{ height: "calc(100vh - 100px)" }}>

        {/* ── Video feeds ── */}
        <div className={`flex flex-col gap-3 ${view === "split" ? "lg:flex-1" : "flex-1"}`}>

          {/* Camera feed */}
          {(view === "camera" || view === "split") && (
            <div className="relative rounded-xl overflow-hidden flex-1"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0f", minHeight: 200 }}>
              <img
                src={`${API_BASE}/api/stream/camera`}
                alt="Camera feed"
                className="w-full h-full object-contain"
                style={{ background: "#000" }}
              />
              <div className="absolute top-2 left-3 flex items-center gap-2">
                <div className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.5)" }}>
                  Kamera + YOLO
                </div>
              </div>
            </div>
          )}

          {/* Board feed (från backend) */}
          {view === "board" && (
            <div className="relative rounded-xl overflow-hidden flex-1"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0f", minHeight: 200 }}>
              <img
                src={`${API_BASE}/api/stream/board`}
                alt="Board overlay"
                className="w-full h-full object-contain"
                style={{ background: "#000" }}
              />
              <div className="absolute top-2 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.5)" }}>
                Homografi Board
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: Board + Scores ── */}
        <div className="flex flex-col gap-4 lg:w-96">

          {/* SVG Dartboard med live-positioner */}
          <div className="rounded-xl p-3" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                Live Board
              </span>
              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                {darts.length} pil{darts.length !== 1 ? "ar" : ""}
              </span>
            </div>
            <LiveBoard darts={darts} />
          </div>

          {/* Total score */}
          <div className="rounded-xl p-4 text-center" style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
          }}>
            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1"
              style={{ color: "rgba(255,255,255,0.3)" }}>
              Total
            </span>
            <span className="text-5xl font-extrabold" style={{ color: "#EF4444" }}>
              {total}
            </span>
            {throws.length > 0 && (
              <div className="flex items-center justify-center gap-4 mt-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {throws.length} kast
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Snitt: <strong style={{ color: "rgba(255,255,255,0.5)" }}>
                    {(total / Math.ceil(throws.length / 3)).toFixed(1)}
                  </strong>
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Runda: <strong style={{ color: "rgba(255,255,255,0.5)" }}>
                    {roundTotal}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Throw list */}
          <div className="flex-1 overflow-y-auto rounded-xl" style={{
            background: "rgba(255,255,255,0.01)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div className="sticky top-0 z-10 px-4 py-2" style={{
              background: "rgba(10,10,16,0.95)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(10px)",
            }}>
              <span className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.2)" }}>
                Kast-historik
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {throws.length === 0 && (
                <div className="py-8 text-center">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto mb-3 opacity-10">
                    <circle cx="20" cy="20" r="16" stroke="white" strokeWidth="1.5" />
                    <circle cx="20" cy="20" r="3" fill="white" />
                  </svg>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                    Väntar på pilar...
                  </p>
                </div>
              )}
              {[...throws].reverse().map((t, i) => {
                const realIdx = throws.length - 1 - i;
                return (
                  <ThrowRow key={realIdx} t={t} index={realIdx} isNew={realIdx === newThrowIdx} />
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ========= NOT CONNECTED OVERLAY ========= */}
      {!connected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="text-center px-8 py-10 rounded-2xl" style={{
            background: "rgba(15,15,22,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <div className="w-3 h-3 rounded-full" style={{
                background: "#EF4444",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>
              Ansluter till backend...
            </h2>
            <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
              Starta servern med: <code className="px-2 py-1 rounded text-[10px]"
                style={{ background: "rgba(255,255,255,0.05)", color: "#F59E0B" }}>
                python server.py
              </code>
            </p>
            <div className="flex flex-col gap-2 text-left" style={{ color: "rgba(255,255,255,0.2)" }}>
              <span className="text-[10px] font-mono">WebSocket: {WS_URL}</span>
              <span className="text-[10px] font-mono">MJPEG: {API_BASE}/api/stream/camera</span>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideIn {
          from { transform: translateX(-10px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
