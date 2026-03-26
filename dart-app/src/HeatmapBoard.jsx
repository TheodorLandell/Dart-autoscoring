import { useRef, useEffect, useMemo } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  HEATMAP BOARD — Återanvändbar dartboard med heatmap       │
  │                                                             │
  │  Två användningsområden:                                    │
  │  1. Live under gameplay — toggle on/off                    │
  │  2. Sammanställd på profilsidan — alla kast                │
  │                                                             │
  │  Teknik:                                                    │
  │  - SVG dartboard som bakgrund                              │
  │  - Canvas overlay med gaussiska radiella gradienter        │
  │  - Varje kast = en mjuk cirkel med alpha                   │
  │  - Där cirklar överlappar → högre intensitet               │
  │  - Colormap: transparent → grön → gul → röd               │
  │                                                             │
  │  Props:                                                     │
  │  - darts: [{x, y}] — positioner i 0-400 koordinatsystem   │
  │  - width: bredd i px (default 400)                         │
  │  - showBoard: visa dartboard-bakgrund (default true)       │
  │  - radius: spridningsradie per punkt (default 25)          │
  │  - intensity: styrka per punkt (default 0.15)              │
  │  - label: text att visa (t.ex. "Touches 57")              │
  │                                                             │
  │  Backend:                                                   │
  │  - GET /api/user/heatmap?mode=all|match|121|atc            │
  │    Response: { darts: [{x, y, mode, match_id, timestamp}] }│
  │  - Kast-positioner sparas vid varje throw i alla modes     │
  └─────────────────────────────────────────────────────────────┘
*/

const BN = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

/* Dartboard SVG som bakgrund */
function BoardSVG() {
  const cx=200,cy=200,R=170;
  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
      <circle cx={cx} cy={cy} r={R} fill="#1a1a1a" stroke="#333" strokeWidth="2"/>
      {BN.map((num,i) => {
        const sa=(i*18-99)*(Math.PI/180), ea=((i+1)*18-99)*(Math.PI/180);
        const ev=i%2===0;
        return [{i:99,o:R,f:ev?"#1a1a1a":"#f0e6d3"},{i:95,o:99,f:ev?"#e8373e":"#1b8a42"},{i:57,o:95,f:ev?"#1a1a1a":"#f0e6d3"},{i:53,o:57,f:ev?"#e8373e":"#1b8a42"}].map((r,ri) => {
          const x1=cx+r.i*Math.cos(sa),y1=cy+r.i*Math.sin(sa),x2=cx+r.o*Math.cos(sa),y2=cy+r.o*Math.sin(sa);
          const x3=cx+r.o*Math.cos(ea),y3=cy+r.o*Math.sin(ea),x4=cx+r.i*Math.cos(ea),y4=cy+r.i*Math.sin(ea);
          return <path key={`${i}-${ri}`} d={`M${x1} ${y1}L${x2} ${y2}A${r.o} ${r.o} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${r.i} ${r.i} 0 0 0 ${x1} ${y1}Z`} fill={r.f} stroke="#333" strokeWidth="0.5" opacity="0.4"/>;
        });
      })}
      <circle cx={cx} cy={cy} r={31.8} fill="#1b8a42" stroke="#333" strokeWidth="0.5" opacity="0.4"/>
      <circle cx={cx} cy={cy} r={12.7} fill="#e8373e" stroke="#333" strokeWidth="0.5" opacity="0.4"/>
      {BN.map((n,i) => {
        const a=(i*18-90)*(Math.PI/180);
        return <text key={n} x={cx+(R+18)*Math.cos(a)} y={cy+(R+18)*Math.sin(a)} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.4)" fontSize="13" fontWeight="600" fontFamily="'Rajdhani',sans-serif">{n}</text>;
      })}
    </svg>
  );
}

/* Gaussian heatmap renderer */
function renderHeatmap(canvas, darts, radius, intensity) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const scale = w / 400; // darts are in 0-400 space

  ctx.clearRect(0, 0, w, h);

  if (!darts.length) return;

  /* Pass 1: Draw alpha blobs on offscreen canvas */
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = w;
  alphaCanvas.height = h;
  const alphaCtx = alphaCanvas.getContext("2d");

  darts.forEach(d => {
    const x = d.x * scale;
    const y = d.y * scale;
    const r = radius * scale;

    const gradient = alphaCtx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(0,0,0,${intensity})`);
    gradient.addColorStop(0.5, `rgba(0,0,0,${intensity * 0.5})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    alphaCtx.fillStyle = gradient;
    alphaCtx.fillRect(x - r, y - r, r * 2, r * 2);
  });

  /* Pass 2: Read alpha values and map to color gradient */
  const alphaData = alphaCtx.getImageData(0, 0, w, h);
  const imageData = ctx.createImageData(w, h);
  const pixels = imageData.data;
  const src = alphaData.data;

  /* Find max alpha for normalization */
  let maxAlpha = 0;
  for (let i = 3; i < src.length; i += 4) {
    if (src[i] > maxAlpha) maxAlpha = src[i];
  }
  if (maxAlpha === 0) return;

  for (let i = 0; i < src.length; i += 4) {
    const alpha = src[i + 3]; // alpha channel holds density
    if (alpha < 2) continue; // skip near-zero

    const t = alpha / maxAlpha; // normalize 0-1

    let r, g, b, a;

    /* Colormap: transparent → green → yellow → red */
    if (t < 0.25) {
      /* Transparent → green */
      const p = t / 0.25;
      r = 0;
      g = Math.round(180 * p);
      b = 0;
      a = Math.round(80 * p);
    } else if (t < 0.5) {
      /* Green → brighter green */
      const p = (t - 0.25) / 0.25;
      r = Math.round(50 * p);
      g = 180 + Math.round(40 * p);
      b = 0;
      a = 80 + Math.round(60 * p);
    } else if (t < 0.75) {
      /* Green → yellow */
      const p = (t - 0.5) / 0.25;
      r = 50 + Math.round(205 * p);
      g = 220 - Math.round(20 * p);
      b = 0;
      a = 140 + Math.round(40 * p);
    } else {
      /* Yellow → red */
      const p = (t - 0.75) / 0.25;
      r = 255;
      g = 200 - Math.round(200 * p);
      b = 0;
      a = 180 + Math.round(55 * p);
    }

    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }

  ctx.putImageData(imageData, 0, 0);

  /* Pass 3: Slight blur for smoother look */
  ctx.filter = "blur(3px)";
  ctx.globalAlpha = 1;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";
}

export default function HeatmapBoard({
  darts = [],
  width = 400,
  showBoard = true,
  radius = 28,
  intensity = 0.18,
  label = null,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderHeatmap(canvasRef.current, darts, radius, intensity);
    }
  }, [darts, radius, intensity, width]);

  return (
    <div className="relative" style={{ width: "100%", maxWidth: width, aspectRatio: "1/1" }}>
      {/* Dartboard background */}
      {showBoard && <BoardSVG />}

      {/* Heatmap canvas overlay */}
      <canvas
        ref={canvasRef}
        width={width}
        height={width}
        className="absolute inset-0 w-full h-full"
        style={{ borderRadius: "50%", pointerEvents: "none" }}
      />

      {/* Label */}
      {label && (
        <div className="absolute top-2 right-3 px-2 py-1 rounded-md text-xs font-bold" style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.6)" }}>
          {label}
        </div>
      )}
    </div>
  );
}
