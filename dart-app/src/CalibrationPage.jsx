import { useState, useRef, useCallback, useEffect } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  KALIBRERING — Kameravy med polygonritning                 │
  │                                                             │
  │  Nås via kalibreringsknappen i lobbyns övre högra hörn.    │
  │  Två kameror sida vid sida, polygonritning direkt på bild. │
  │                                                             │
  │  Backend endpoints:                                         │
  │  - GET  /api/calibration → hämta sparade polygoner         │
  │  - POST /api/calibration → spara polygoner                 │
  │  - POST /api/calibration/snapshot → ta stillbild           │
  │  - GET  /api/calibration/frame/{camera_id} → hämta bild   │
  └─────────────────────────────────────────────────────────────┘
*/

const ZONE_GROUPS = [
  {
    label: "Bull",
    zones: [
      { name: "Bull", color: "#10B981" },
      { name: "D-Bull", color: "#EF4444" },
    ],
  },
  ...Array.from({ length: 20 }, (_, i) => ({
    label: `${i + 1}`,
    zones: [
      { name: `S${i + 1}`, color: "#60A5FA" },
      { name: `D${i + 1}`, color: "#F59E0B" },
      { name: `T${i + 1}`, color: "#A78BFA" },
    ],
  })),
];

const ALL_ZONES = ZONE_GROUPS.flatMap((g) => g.zones);

function getZoneColor(zoneName) {
  return ALL_ZONES.find((z) => z.name === zoneName)?.color || "#888";
}

const MOCK_SAVED = {
  left: [
    { id: "l1", name: "S20", points: [[0.15, 0.2],[0.35, 0.15],[0.4, 0.35],[0.2, 0.4]] },
    { id: "l2", name: "D20", points: [[0.1, 0.15],[0.15, 0.2],[0.2, 0.4],[0.12, 0.42],[0.05, 0.2]] },
  ],
  right: [
    { id: "r1", name: "S6", points: [[0.55, 0.25],[0.75, 0.2],[0.8, 0.45],[0.6, 0.5]] },
  ],
};

function CameraPanel({ cameraId, label, isActive, polygons, currentPoints, selectedPoly, onCanvasClick, onCanvasMouseMove, onSelectCamera, onSelectPoly, onDeletePoly, cursorPos }) {
  const canvasRef = useRef(null);

  const getRelativePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const handleClick = (e) => {
    onSelectCamera(cameraId);
    const pos = getRelativePos(e);
    onCanvasClick(cameraId, pos);
  };

  const handleMouseMove = (e) => {
    if (!isActive) return;
    const pos = getRelativePos(e);
    onCanvasMouseMove(pos);
  };

  const toPercent = (p) => ({ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` });
  const polyPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * 100} ${p[1] * 100}`).join(" ") + "Z";
  const openPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * 100} ${p[1] * 100}`).join(" ");

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: isActive ? "#10B981" : "rgba(255,255,255,0.15)" }} />
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" }}>
            {label}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
          {polygons.length} zoner
        </span>
      </div>

      <div
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="relative w-full rounded-xl overflow-hidden transition-all duration-200"
        style={{
          aspectRatio: "4/3",
          background: "linear-gradient(135deg, rgba(20,20,30,0.95) 0%, rgba(30,30,45,0.9) 50%, rgba(20,20,30,0.95) 100%)",
          border: isActive ? "2px solid rgba(239,68,68,0.4)" : "2px solid rgba(255,255,255,0.06)",
          boxShadow: isActive ? "0 0 30px rgba(239,68,68,0.1)" : "none",
          cursor: isActive ? "crosshair" : "pointer",
        }}
      >
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity="0.08">
            <circle cx="40" cy="40" r="35" stroke="white" strokeWidth="1" />
            <circle cx="40" cy="40" r="24" stroke="white" strokeWidth="1" />
            <circle cx="40" cy="40" r="13" stroke="white" strokeWidth="1" />
            <circle cx="40" cy="40" r="4" fill="white" />
            <line x1="40" y1="2" x2="40" y2="18" stroke="white" strokeWidth="0.5" />
            <line x1="40" y1="62" x2="40" y2="78" stroke="white" strokeWidth="0.5" />
            <line x1="2" y1="40" x2="18" y2="40" stroke="white" strokeWidth="0.5" />
            <line x1="62" y1="40" x2="78" y2="40" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {polygons.map((poly) => (
            <g key={poly.id}>
              <path
                d={polyPath(poly.points)}
                fill={getZoneColor(poly.name) + "20"}
                stroke={getZoneColor(poly.name)}
                strokeWidth={selectedPoly === poly.id ? "0.8" : "0.4"}
                strokeDasharray={selectedPoly === poly.id ? "none" : "1.5 1"}
                style={{ cursor: "pointer", transition: "all 0.15s" }}
                onClick={(e) => { e.stopPropagation(); onSelectPoly(poly.id); }}
              />
            </g>
          ))}
          {isActive && currentPoints.length > 1 && (
            <path d={openPath(currentPoints)} fill="none" stroke="#EF4444" strokeWidth="0.5" strokeDasharray="1.5 1" />
          )}
          {isActive && currentPoints.length > 0 && cursorPos && (
            <line
              x1={currentPoints[currentPoints.length - 1][0] * 100} y1={currentPoints[currentPoints.length - 1][1] * 100}
              x2={cursorPos.x * 100} y2={cursorPos.y * 100}
              stroke="#EF4444" strokeWidth="0.3" strokeDasharray="1 1" opacity="0.6"
            />
          )}
        </svg>

        {polygons.map((poly) =>
          poly.points.map((p, pi) => (
            <div key={`${poly.id}-${pi}`} className="absolute rounded-full transition-all duration-150" style={{
              ...toPercent(p), width: selectedPoly === poly.id ? 8 : 5, height: selectedPoly === poly.id ? 8 : 5,
              background: getZoneColor(poly.name), transform: "translate(-50%, -50%)",
              boxShadow: selectedPoly === poly.id ? `0 0 8px ${getZoneColor(poly.name)}80` : "none",
            }} />
          ))
        )}

        {polygons.map((poly) => {
          const cx = poly.points.reduce((s, p) => s + p[0], 0) / poly.points.length;
          const cy = poly.points.reduce((s, p) => s + p[1], 0) / poly.points.length;
          return (
            <div key={`label-${poly.id}`} className="absolute px-1.5 py-0.5 rounded text-[10px] font-bold pointer-events-none" style={{
              left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%, -50%)",
              background: getZoneColor(poly.name) + "CC", color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}>
              {poly.name}
            </div>
          );
        })}

        {isActive && currentPoints.map((p, i) => (
          <div key={`cur-${i}`} className="absolute rounded-full" style={{
            ...toPercent(p), width: i === 0 && currentPoints.length > 2 ? 12 : 7, height: i === 0 && currentPoints.length > 2 ? 12 : 7,
            background: i === 0 && currentPoints.length > 2 ? "#EF444480" : "#EF4444",
            border: i === 0 && currentPoints.length > 2 ? "2px solid #EF4444" : "none",
            transform: "translate(-50%, -50%)", cursor: i === 0 && currentPoints.length > 2 ? "pointer" : "default",
          }} />
        ))}

        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold" style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.3)" }}>
          Mock — kamera ej ansluten
        </div>
      </div>
    </div>
  );
}

function ZoneSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = ALL_ZONES.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200" style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "#fff" : "rgba(255,255,255,0.4)",
      }}>
        {value && <div className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(value) }} />}
        {value || "Välj zon..."}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginLeft: 4, opacity: 0.4 }}>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-xl overflow-hidden z-50" style={{
          background: "rgba(20,20,30,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", maxHeight: 280, overflowY: "auto",
        }}>
          <div className="p-2 sticky top-0" style={{ background: "rgba(20,20,30,0.98)" }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök zon..." autoFocus
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none" style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)",
              }} />
          </div>
          <div className="p-1">
            {filtered.map((z) => (
              <button key={z.name} onClick={() => { onChange(z.name); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-100 text-left" style={{ color: "rgba(255,255,255,0.7)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: z.color }} />
                {z.name}
              </button>
            ))}
            {filtered.length === 0 && <span className="block px-3 py-2 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Ingen zon hittad</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PolyListItem({ poly, isSelected, onSelect, onDelete }) {
  return (
    <div onClick={() => onSelect(poly.id)} className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer" style={{
      background: isSelected ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)", border: isSelected ? "1px solid rgba(239,68,68,0.25)" : "1px solid transparent",
    }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(poly.name) }} />
        <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{poly.name}</span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{poly.points.length} pts</span>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(poly.id); }} className="p-1 rounded transition-colors duration-150" style={{ color: "rgba(255,255,255,0.15)" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.15)"}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export default function CalibrationPage({ navigate }) {
  const [activeCamera, setActiveCamera] = useState("left");
  const [selectedZone, setSelectedZone] = useState("S20");
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedPoly, setSelectedPoly] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);
  const [saved, setSaved] = useState(false);
  const [polygons, setPolygons] = useState({ left: [...MOCK_SAVED.left], right: [...MOCK_SAVED.right] });

  const CLOSE_THRESHOLD = 0.03;

  const finishPolygon = useCallback(() => {
    if (currentPoints.length < 3) return;
    const newPoly = { id: `${activeCamera[0]}${Date.now()}`, name: selectedZone, points: [...currentPoints] };
    setPolygons((prev) => ({ ...prev, [activeCamera]: [...prev[activeCamera], newPoly] }));
    setCurrentPoints([]);
    setSaved(false);
  }, [currentPoints, activeCamera, selectedZone]);

  const handleCanvasClick = useCallback((cameraId, pos) => {
    if (cameraId !== activeCamera) return;
    setSelectedPoly(null);
    if (currentPoints.length > 2) {
      const first = currentPoints[0];
      const dist = Math.sqrt((pos.x - first[0]) ** 2 + (pos.y - first[1]) ** 2);
      if (dist < CLOSE_THRESHOLD) { finishPolygon(); return; }
    }
    setCurrentPoints((prev) => [...prev, [pos.x, pos.y]]);
  }, [activeCamera, currentPoints, finishPolygon]);

  const handleDeletePoly = (polyId) => {
    setPolygons((prev) => ({ left: prev.left.filter((p) => p.id !== polyId), right: prev.right.filter((p) => p.id !== polyId) }));
    if (selectedPoly === polyId) setSelectedPoly(null);
    setSaved(false);
  };

  const handleSave = () => {
    console.log("Sparar kalibrering:", JSON.stringify(polygons, null, 2));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalPolygons = polygons.left.length + polygons.right.length;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{
      background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)", fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: "60px 60px",
      }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <button onClick={() => navigate("lobby")} className="flex items-center gap-2 transition-colors duration-200" style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <h1 className="text-lg font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>Kamerakalibrering</h1>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>{totalPolygons} zoner mappade</span>
      </header>

      <main className="relative z-10 px-6 pb-8">
        <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Zon:</span>
            <ZoneSelector value={selectedZone} onChange={setSelectedZone} />
          </div>
          {currentPoints.length > 0 && (
            <div className="flex items-center gap-3 ml-4">
              <span className="text-xs" style={{ color: "#EF4444" }}>Ritar — {currentPoints.length} punkter</span>
              {currentPoints.length >= 3 && (
                <button onClick={finishPolygon} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}>
                  Stäng polygon
                </button>
              )}
              <button onClick={() => setCurrentPoints([])} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                Avbryt
              </button>
            </div>
          )}
          <div className="flex-1" />
          {currentPoints.length === 0 && (
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              Välj zon → klicka på kamerabilden för att rita polygon
            </span>
          )}
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200" style={{
            background: saved ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)", color: saved ? "#10B981" : "#EF4444", border: saved ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.25)",
          }}>
            {saved ? (
              <><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l3 3 5-5" /></svg>Sparat</>
            ) : "Spara kalibrering"}
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex gap-4">
            <CameraPanel cameraId="left" label="Vänster kamera" isActive={activeCamera === "left"} polygons={polygons.left}
              currentPoints={activeCamera === "left" ? currentPoints : []} selectedPoly={selectedPoly} onCanvasClick={handleCanvasClick}
              onCanvasMouseMove={setCursorPos} onSelectCamera={setActiveCamera} onSelectPoly={setSelectedPoly} onDeletePoly={handleDeletePoly}
              cursorPos={activeCamera === "left" ? cursorPos : null} />
            <CameraPanel cameraId="right" label="Höger kamera" isActive={activeCamera === "right"} polygons={polygons.right}
              currentPoints={activeCamera === "right" ? currentPoints : []} selectedPoly={selectedPoly} onCanvasClick={handleCanvasClick}
              onCanvasMouseMove={setCursorPos} onSelectCamera={setActiveCamera} onSelectPoly={setSelectedPoly} onDeletePoly={handleDeletePoly}
              cursorPos={activeCamera === "right" ? cursorPos : null} />
          </div>

          <div className="w-64 flex flex-col gap-4 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: activeCamera === "left" ? "#10B981" : "rgba(255,255,255,0.15)" }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Vänster ({polygons.left.length})</span>
              </div>
              <div className="flex flex-col gap-1">
                {polygons.left.map((poly) => (
                  <PolyListItem key={poly.id} poly={poly} isSelected={selectedPoly === poly.id} onSelect={setSelectedPoly} onDelete={handleDeletePoly} />
                ))}
                {polygons.left.length === 0 && <span className="text-[11px] px-3 py-2" style={{ color: "rgba(255,255,255,0.15)" }}>Inga zoner</span>}
              </div>
            </div>
            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: activeCamera === "right" ? "#10B981" : "rgba(255,255,255,0.15)" }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Höger ({polygons.right.length})</span>
              </div>
              <div className="flex flex-col gap-1">
                {polygons.right.map((poly) => (
                  <PolyListItem key={poly.id} poly={poly} isSelected={selectedPoly === poly.id} onSelect={setSelectedPoly} onDelete={handleDeletePoly} />
                ))}
                {polygons.right.length === 0 && <span className="text-[11px] px-3 py-2" style={{ color: "rgba(255,255,255,0.15)" }}>Inga zoner</span>}
              </div>
            </div>
            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>Tips</span>
              <ul className="flex flex-col gap-1.5">
                {["Klicka på kamerabild för att börja rita", "Stäng polygon via första punkten", "Klicka polygon i listan för att markera", "Normaliserade koordinater (0-1)"].map((tip, i) => (
                  <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    <span style={{ color: "rgba(255,255,255,0.1)" }}>•</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}