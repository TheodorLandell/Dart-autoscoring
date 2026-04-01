import { useState, useRef, useEffect, useCallback } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  KALIBRERING — Live 41-punkts homografi i webbappen        │
  │                                                             │
  │  Flöde:                                                     │
  │  1. Välj kamera (vänster / höger)                          │
  │  2. Klicka 41 punkter på live-feeden:                      │
  │     - Bull (centrum)                                        │
  │     - 20× Double (yttre tråden)                            │
  │     - 20× Triple (inre tråden)                             │
  │  3. Backend beräknar homografi + sparar                    │
  │  4. Visa resultat → kalibrera andra kameran                │
  │                                                             │
  │  Referenstavlan visar vilken punkt som ska klickas         │
  │  Zoom-lins ger precision vid klick                         │
  └─────────────────────────────────────────────────────────────┘
*/

const API = "http://localhost:8000";

const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

function polarToCart(r, angleDeg) {
  const rad = (-(angleDeg - 90)) * Math.PI / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function sectorAngle(num) {
  return SECTORS.indexOf(num) * 18;
}

/* Generate the 41 reference points (same order as Python) */
function generateRefPoints() {
  const pts = [];
  pts.push({ name: "BULL (centrum)", phase: "bull", x_mm: 0, y_mm: 0 });
  for (const s of SECTORS) {
    const [x, y] = polarToCart(170, sectorAngle(s));
    pts.push({ name: `Double ${s}`, phase: "double", x_mm: x, y_mm: y });
  }
  for (const s of SECTORS) {
    const [x, y] = polarToCart(107, sectorAngle(s));
    pts.push({ name: `Triple ${s}`, phase: "triple", x_mm: x, y_mm: y });
  }
  return pts;
}

const REF_POINTS = generateRefPoints();

function mmToSvg(x_mm, y_mm) {
  return [200 + x_mm, 200 - y_mm];
}

const PHASE_COLORS = {
  bull: "#EF4444",
  double: "#F59E0B",
  triple: "#A78BFA",
};


/* ============ REFERENCE BOARD SVG ============ */
function ReferenceBoard({ currentIdx, clicks }) {
  const cx = 200, cy = 200;

  const currentPt = currentIdx < REF_POINTS.length ? REF_POINTS[currentIdx] : null;
  const [tx, ty] = currentPt ? mmToSvg(currentPt.x_mm, currentPt.y_mm) : [cx, cy];
  const color = currentPt ? PHASE_COLORS[currentPt.phase] : "#fff";

  return (
    <svg viewBox="0 0 400 400" className="w-full">
      {/* Board circles (correct mm proportions) */}
      <circle cx={cx} cy={cy} r={170} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={162} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx={cx} cy={cy} r={107} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={99} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx={cx} cy={cy} r={15.9} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={6.35} fill="rgba(239,68,68,0.3)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

      {/* Sector lines */}
      {SECTORS.map((_, i) => {
        const a = (i * 18 - 9) * Math.PI / 180;
        const x1 = cx + 15.9 * Math.sin(a), y1 = cy - 15.9 * Math.cos(a);
        const x2 = cx + 170 * Math.sin(a), y2 = cy - 170 * Math.cos(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />;
      })}

      {/* Numbers */}
      {SECTORS.map((n, i) => {
        const [x, y] = mmToSvg(...polarToCart(185, i * 18));
        return <text key={n} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.35)" fontSize="11" fontWeight="600" fontFamily="'Rajdhani',sans-serif">{n}</text>;
      })}

      {/* Zone labels */}
      <text x={cx} y={15} textAnchor="middle" fill="rgba(245,158,11,0.4)" fontSize="8" fontFamily="'Rajdhani',sans-serif">DOUBLE</text>
      <text x={cx} y={95} textAnchor="middle" fill="rgba(167,139,250,0.4)" fontSize="8" fontFamily="'Rajdhani',sans-serif">TRIPLE</text>

      {/* All upcoming points (dim) */}
      {REF_POINTS.map((pt, i) => {
        if (i <= currentIdx) return null;
        const [px, py] = mmToSvg(pt.x_mm, pt.y_mm);
        return <circle key={`future-${i}`} cx={px} cy={py} r="2" fill={PHASE_COLORS[pt.phase]} opacity="0.15" />;
      })}

      {/* Clicked points (confirmed) */}
      {clicks.map((c, i) => {
        if (!c) return null;
        const pt = REF_POINTS[i];
        const [px, py] = mmToSvg(pt.x_mm, pt.y_mm);
        return (
          <g key={`done-${i}`}>
            <circle cx={px} cy={py} r="3.5" fill={PHASE_COLORS[pt.phase]} opacity="0.7" />
            <circle cx={px} cy={py} r="3.5" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
          </g>
        );
      })}

      {/* Current target — big pulsing dot */}
      {currentPt && (
        <g>
          <circle cx={tx} cy={ty} r="16" fill={color} opacity="0.08">
            <animate attributeName="r" values="12;20;12" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.03;0.12" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={tx} cy={ty} r="6" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6">
            <animate attributeName="r" values="5;8;5" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={tx} cy={ty} r="2.5" fill={color} />
          {/* Crosshair lines */}
          <line x1={tx - 12} y1={ty} x2={tx - 5} y2={ty} stroke={color} strokeWidth="0.8" opacity="0.5" />
          <line x1={tx + 5} y1={ty} x2={tx + 12} y2={ty} stroke={color} strokeWidth="0.8" opacity="0.5" />
          <line x1={tx} y1={ty - 12} x2={tx} y2={ty - 5} stroke={color} strokeWidth="0.8" opacity="0.5" />
          <line x1={tx} y1={ty + 5} x2={tx} y2={ty + 12} stroke={color} strokeWidth="0.8" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}


/* ============ ZOOM LENS ============ */
function ZoomLens({ imgRef, mousePos, visible }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!img.naturalWidth) return;

    const rect = img.getBoundingClientRect();
    const natX = (mousePos.x / rect.width) * img.naturalWidth;
    const natY = (mousePos.y / rect.height) * img.naturalHeight;

    const zoom = 3;
    const srcW = canvas.width / zoom;
    const srcH = canvas.height / zoom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      ctx.drawImage(img,
        natX - srcW / 2, natY - srcH / 2, srcW, srcH,
        0, 0, canvas.width, canvas.height
      );
    } catch (_) { /* cross-origin or no frame yet */ }

    // Crosshair
    const cw = canvas.width / 2, ch = canvas.height / 2;
    ctx.strokeStyle = "rgba(239,68,68,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw - 15, ch); ctx.lineTo(cw - 4, ch);
    ctx.moveTo(cw + 4, ch); ctx.lineTo(cw + 15, ch);
    ctx.moveTo(cw, ch - 15); ctx.lineTo(cw, ch - 4);
    ctx.moveTo(cw, ch + 4); ctx.lineTo(cw, ch + 15);
    ctx.stroke();

    // Circle outline
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cw, ch, cw - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [mousePos, visible, imgRef]);

  if (!visible) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Zoom 3×</span>
      <canvas ref={canvasRef} width={200} height={200}
        className="rounded-full"
        style={{ border: "2px solid rgba(255,255,255,0.1)", background: "#0a0a0f" }}
      />
    </div>
  );
}


/* ============ PROGRESS BAR ============ */
function ProgressBar({ current, total, clicks }) {
  const pct = (current / total) * 100;

  // Count per phase
  const bullDone = clicks[0] ? 1 : 0;
  const doubleDone = clicks.slice(1, 21).filter(Boolean).length;
  const tripleDone = clicks.slice(21, 41).filter(Boolean).length;

  return (
    <div className="w-full">
      {/* Bar */}
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all duration-300" style={{
          width: `${pct}%`,
          background: current <= 1 ? "#EF4444" : current <= 21 ? "#F59E0B" : "#A78BFA",
        }} />
      </div>

      {/* Phase counters */}
      <div className="flex items-center gap-4">
        <PhaseCount label="Bull" done={bullDone} total={1} color="#EF4444" active={current === 0} />
        <PhaseCount label="Double" done={doubleDone} total={20} color="#F59E0B" active={current >= 1 && current <= 20} />
        <PhaseCount label="Triple" done={tripleDone} total={20} color="#A78BFA" active={current >= 21 && current <= 40} />
      </div>
    </div>
  );
}

function PhaseCount({ label, done, total, color, active }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{
        background: color, opacity: active ? 1 : 0.3,
        boxShadow: active ? `0 0 6px ${color}` : "none",
      }} />
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{
        color: active ? color : "rgba(255,255,255,0.2)",
      }}>
        {label} {done}/{total}
      </span>
    </div>
  );
}


/* ============ CAMERA SELECTOR ============ */
function CameraSelector({ onSelect }) {
  const [hoveredL, setHoveredL] = useState(false);
  const [hoveredR, setHoveredR] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-extrabold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.9)" }}>
          Välj kamera att kalibrera
        </h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
          Klicka på en kamera för att börja — 41 referenspunkter
        </p>
      </div>

      <div className="flex gap-4 w-full">
        {[["left", "Vänster kamera", hoveredL, setHoveredL],
          ["right", "Höger kamera", hoveredR, setHoveredR]].map(([id, label, hov, setHov]) => (
          <button key={id} onClick={() => onSelect(id)}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            className="flex-1 flex flex-col gap-3 rounded-xl p-4 transition-all duration-300"
            style={{
              background: hov ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
              border: hov ? "2px solid rgba(239,68,68,0.3)" : "2px solid rgba(255,255,255,0.06)",
              transform: hov ? "translateY(-2px)" : "none",
            }}>
            <div className="w-full rounded-lg overflow-hidden" style={{ aspectRatio: "4/3", background: "#0a0a0f" }}>
              <img src={`${API}/api/stream/${id}`} alt={label} className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest" style={{
              color: hov ? "#EF4444" : "rgba(255,255,255,0.5)",
            }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


/* ============ RESULT DISPLAY ============ */
function CalibrationResult({ result, camera, onOtherCamera, onBack }) {
  const isGood = result.inliers >= result.total_points * 0.8 && result.mean_error_px < 15;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto text-center">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{
        background: isGood ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
        border: `2px solid ${isGood ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
      }}>
        {isGood ? (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 20l7 7 13-13" />
          </svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 12v10M20 26v2" />
          </svg>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-extrabold" style={{ color: isGood ? "#10B981" : "#F59E0B" }}>
          {isGood ? "Kalibrering klar!" : "Kalibrering sparad (varning)"}
        </h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          {camera === "left" ? "Vänster" : "Höger"} kamera — {result.filename}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {[
          ["Inliers", `${result.inliers}/${result.total_points}`, result.inliers >= result.total_points * 0.8 ? "#10B981" : "#F59E0B"],
          ["Medelfel", `${result.mean_error_px}px`, result.mean_error_px < 10 ? "#10B981" : result.mean_error_px < 20 ? "#F59E0B" : "#EF4444"],
          ["Hoppade", `${result.skipped}`, result.skipped < 5 ? "#10B981" : "#F59E0B"],
        ].map(([label, value, color]) => (
          <div key={label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest block" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</span>
            <span className="text-xl font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {!isGood && (
        <p className="text-xs px-4" style={{ color: "rgba(245,158,11,0.6)" }}>
          Högt medelfel kan tyda på felplacerade punkter. Överväg att kalibrera om.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button onClick={onOtherCamera}
          className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
          style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.12)"}>
          Kalibrera {camera === "left" ? "höger" : "vänster"}
        </button>
        <button onClick={onBack}
          className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
          style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(16,185,129,0.2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(16,185,129,0.12)"}>
          Klar — tillbaka
        </button>
      </div>
    </div>
  );
}


/* ============ MAIN COMPONENT ============ */
export default function CalibrationPage({ navigate }) {
  const [phase, setPhase] = useState("select");  // select | calibrating | computing | done | error
  const [camera, setCamera] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [clicks, setClicks] = useState(Array(41).fill(null));
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showZoom, setShowZoom] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const imgRef = useRef(null);

  /* Start calibration for a camera */
  const startCalibration = (cam) => {
    setCamera(cam);
    setCurrentIdx(0);
    setClicks(Array(41).fill(null));
    setPhase("calibrating");
    setResult(null);
    setError(null);
  };

  /* Handle click on camera image */
  const handleImageClick = useCallback((e) => {
    if (currentIdx >= 41 || phase !== "calibrating") return;

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const frameX = (e.clientX - rect.left) * scaleX;
    const frameY = (e.clientY - rect.top) * scaleY;

    const newClicks = [...clicks];
    newClicks[currentIdx] = { x: frameX, y: frameY };
    setClicks(newClicks);

    // Advance to next
    if (currentIdx + 1 >= 41) {
      setCurrentIdx(41);
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  }, [currentIdx, clicks, phase]);

  /* Mouse tracking for zoom */
  const handleMouseMove = useCallback((e) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  /* Undo last click */
  const handleUndo = () => {
    if (currentIdx <= 0) return;
    const prevIdx = currentIdx >= 41 ? 40 : currentIdx - 1;
    // Find last non-null click at or before prevIdx
    let target = prevIdx;
    while (target >= 0 && clicks[target] === null) target--;
    if (target < 0) return;

    const newClicks = [...clicks];
    newClicks[target] = null;
    setClicks(newClicks);
    setCurrentIdx(target);
  };

  /* Skip current point */
  const handleSkip = () => {
    if (currentIdx >= 41) return;
    // Leave null — already null
    if (currentIdx + 1 >= 41) {
      setCurrentIdx(41);
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  };

  /* Submit calibration */
  const handleSubmit = async () => {
    setPhase("computing");
    try {
      const res = await fetch(`${API}/api/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera, points: clicks }),
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setResult(data);
        setPhase("done");
      } else {
        setError(data.error || "Okänt fel");
        setPhase("error");
      }
    } catch (err) {
      setError(`Nätverksfel: ${err.message}`);
      setPhase("error");
    }
  };

  const clickedCount = clicks.filter(Boolean).length;
  const currentPt = currentIdx < 41 ? REF_POINTS[currentIdx] : null;
  const nextPts = REF_POINTS.slice(currentIdx + 1, currentIdx + 4);
  const allDone = currentIdx >= 41;

  return (
    <div className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani','Segoe UI',sans-serif",
      }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* ===== HEADER ===== */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3">
        <button onClick={() => navigate("lobby")}
          className="flex items-center gap-2 transition-colors duration-200"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <span className="text-lg font-extrabold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.8)" }}>
          Kalibrering
        </span>
        <div className="w-20" />
      </header>

      <main className="relative z-10 px-4 pb-8">

        {/* ===== CAMERA SELECTION ===== */}
        {phase === "select" && <CameraSelector onSelect={startCalibration} />}

        {/* ===== CALIBRATION ===== */}
        {phase === "calibrating" && (
          <div className="flex flex-col lg:flex-row gap-4 max-w-6xl mx-auto">

            {/* Left: Reference board */}
            <div className="lg:w-80 flex flex-col gap-3">
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Referens — klicka motsvarande punkt på kameran
                  </span>
                </div>
                <ReferenceBoard currentIdx={currentIdx} clicks={clicks} />
              </div>

              {/* Zoom lens */}
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ZoomLens imgRef={imgRef} mousePos={mousePos} visible={showZoom} />
                {!showZoom && (
                  <div className="flex items-center justify-center py-6">
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                      Hovra över kamerabilden för zoom
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Camera feed */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Current point info */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{
                background: currentPt ? PHASE_COLORS[currentPt.phase] + "10" : "rgba(16,185,129,0.1)",
                border: `1px solid ${currentPt ? PHASE_COLORS[currentPt.phase] + "30" : "rgba(16,185,129,0.3)"}`,
              }}>
                {currentPt ? (
                  <>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest block" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Punkt {currentIdx + 1} av 41
                      </span>
                      <span className="text-xl font-bold" style={{ color: PHASE_COLORS[currentPt.phase] }}>
                        {currentPt.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] block" style={{ color: "rgba(255,255,255,0.2)" }}>Nästa:</span>
                      {nextPts.map((p, i) => (
                        <span key={i} className="text-[10px] block" style={{ color: "rgba(255,255,255,0.25)" }}>{p.name}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <span className="text-xl font-bold" style={{ color: "#10B981" }}>
                      Alla 41 punkter klickade!
                    </span>
                    <span className="text-xs block mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {clickedCount} klickade, {41 - clickedCount} hoppade
                    </span>
                  </div>
                )}
              </div>

              {/* Camera image */}
              <div className="relative rounded-xl overflow-hidden cursor-crosshair"
                style={{ border: "2px solid rgba(239,68,68,0.2)", background: "#0a0a0f" }}
                onClick={handleImageClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setShowZoom(true)}
                onMouseLeave={() => setShowZoom(false)}>
                <img
                  ref={imgRef}
                  src={`${API}/api/stream/${camera}`}
                  alt="Camera feed"
                  className="w-full"
                  crossOrigin="anonymous"
                  style={{ display: "block" }}
                />
                {/* Camera label */}
                <div className="absolute top-2 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.5)" }}>
                  {camera === "left" ? "Vänster" : "Höger"} kamera
                </div>
                {/* Click markers on camera image */}
                {clicks.map((c, i) => {
                  if (!c || !imgRef.current) return null;
                  const img = imgRef.current;
                  const rect = img.getBoundingClientRect();
                  const dispX = (c.x / (img.naturalWidth || 1)) * rect.width;
                  const dispY = (c.y / (img.naturalHeight || 1)) * rect.height;
                  const pt = REF_POINTS[i];
                  const col = PHASE_COLORS[pt.phase];
                  return (
                    <div key={i} className="absolute pointer-events-none" style={{
                      left: `${(c.x / (img.naturalWidth || 1)) * 100}%`,
                      top: `${(c.y / (img.naturalHeight || 1)) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}>
                      <div className="w-3 h-3 rounded-full border" style={{
                        background: col, borderColor: "#fff", opacity: 0.8,
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Progress */}
              <ProgressBar current={clickedCount} total={41} clicks={clicks} />

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button onClick={handleUndo} disabled={clickedCount === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200"
                  style={{
                    background: clickedCount > 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)",
                    color: clickedCount > 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)",
                    border: clickedCount > 0 ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.03)",
                  }}>
                  ↩ Ångra
                </button>

                {!allDone && (
                  <button onClick={handleSkip}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200"
                    style={{ background: "rgba(245,158,11,0.08)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>
                    Hoppa över →
                  </button>
                )}

                {allDone && (
                  <button onClick={handleSubmit}
                    className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: "#fff", boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                    Beräkna kalibrering ({clickedCount} punkter)
                  </button>
                )}

                <div className="flex-1" />

                <button onClick={() => setPhase("select")}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.2)" }}>
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== COMPUTING ===== */}
        {phase === "computing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-emerald-500"
              style={{ animation: "spin 0.7s linear infinite" }} />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Beräknar homografi...</span>
          </div>
        )}

        {/* ===== DONE ===== */}
        {phase === "done" && result && (
          <div className="py-8">
            <CalibrationResult
              result={result}
              camera={camera}
              onOtherCamera={() => startCalibration(camera === "left" ? "right" : "left")}
              onBack={() => navigate("lobby")}
            />
          </div>
        )}

        {/* ===== ERROR ===== */}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-16 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <path d="M10 10l12 12M22 10L10 22" />
              </svg>
            </div>
            <h2 className="text-xl font-bold" style={{ color: "#EF4444" }}>Kalibrering misslyckades</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{error}</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => startCalibration(camera)}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                Försök igen
              </button>
              <button onClick={() => setPhase("select")}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                Byt kamera
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
