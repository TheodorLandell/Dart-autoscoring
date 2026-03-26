import { useState } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  DART LOBBY — Appens startskärm                            │
  │                                                             │
  │  Layout:                                                    │
  │  ┌──────────┐                              ┌──────────────┐ │
  │  │  LOGIN/  │    (övre vänstra hörnet)      │ KALIBRERING  │ │
  │  │  PROFIL  │    Ej inloggad → login-sida   │ knapp        │ │
  │  └──────────┘    Inloggad → profilsida      └──────────────┘ │
  │                                                             │
  │                    ┌──────────────┐                          │
  │                    │  APP TITEL   │                          │
  │                    │  + subtitle  │                          │
  │                    └──────────────┘                          │
  │                                                             │
  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
  │  │   MATCH    │  │    121     │  │  AROUND    │            │
  │  │            │  │            │  │  THE CLOCK │            │
  │  │ 501/301/   │  │ Checkout-  │  │ 1→20→Bull  │            │
  │  │ Custom     │  │ utmaning   │  │ i ordning  │            │
  │  └────────────┘  └────────────┘  └────────────┘            │
  │                                                             │
  │  Backend behov:                                             │
  │  - Auth endpoints (login/register/session)                  │
  │  - GET /api/user/profile (för att visa inloggad spelare)   │
  │  - GET/POST /api/calibration (kamerainställningar)         │
  │  - Game state management per spelläge                      │
  └─────────────────────────────────────────────────────────────┘
*/

const GAME_MODES = [
  {
    id: "match",
    title: "Match",
    subtitle: "Klassisk dart",
    description: "501, 301 eller custom poäng. Välj spelare, legs och format. Throw for bull avgör vem som börjar.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <circle cx="24" cy="24" r="3" fill="#EF4444" />
        <line x1="24" y1="2" x2="24" y2="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="38" x2="24" y2="46" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="2" y1="24" x2="10" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="38" y1="24" x2="46" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      </svg>
    ),
    accent: "#EF4444",
    glowColor: "239, 68, 68",
  },
  {
    id: "121",
    title: "121",
    subtitle: "Checkout challenge",
    description: "Börja på 121 och checka ut. Lyckas du? Poängen ökar. Misslyckas? Den sjunker. Hur högt kan du nå?",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M12 36L24 8L36 36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <path d="M16 28H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <circle cx="24" cy="8" r="3" fill="#10B981" />
        <path d="M20 40L24 36L28 40" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 44L24 40L28 44" stroke="#10B981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
    ),
    accent: "#10B981",
    glowColor: "16, 185, 129",
  },
  {
    id: "around-the-clock",
    title: "Around the clock",
    subtitle: "Precision training",
    description: "Träffa 1 till Bull i ordning. Välj single, dubbel, trippel eller valfri. Accuracy% räknas löpande.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 24 + 17 * Math.cos(rad);
          const y1 = 24 + 17 * Math.sin(rad);
          const x2 = 24 + 20 * Math.cos(rad);
          const y2 = 24 + 20 * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" opacity="0.5" />;
        })}
        <path d="M24 4V12" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 24L32 16" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2.5" fill="#8B5CF6" />
      </svg>
    ),
    accent: "#8B5CF6",
    glowColor: "139, 92, 246",
  },
];

function DartIcon({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="22" y1="2" x2="13" y2="11" />
      <path d="M16 2L22 2L22 8" />
      <circle cx="10" cy="14" r="9" opacity="0.3" />
      <circle cx="10" cy="14" r="5" opacity="0.5" />
      <circle cx="10" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function GameCard({ mode, index, onSelect }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(mode.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col items-start text-left rounded-2xl border transition-all duration-300 p-6 w-full"
      style={{
        background: hovered
          ? `linear-gradient(145deg, rgba(${mode.glowColor}, 0.08) 0%, rgba(15, 15, 20, 0.95) 60%)`
          : "rgba(20, 20, 28, 0.8)",
        borderColor: hovered ? mode.accent + "40" : "rgba(255,255,255,0.06)",
        boxShadow: hovered
          ? `0 0 40px rgba(${mode.glowColor}, 0.12), 0 8px 32px rgba(0,0,0,0.4)`
          : "0 2px 12px rgba(0,0,0,0.3)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div
        className="absolute top-0 left-6 right-6 h-px transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${mode.accent}60, transparent)`,
          opacity: hovered ? 1 : 0,
        }}
      />
      <div
        className="mb-4 transition-all duration-300"
        style={{
          color: hovered ? mode.accent : "rgba(255,255,255,0.5)",
          filter: hovered ? `drop-shadow(0 0 12px rgba(${mode.glowColor}, 0.4))` : "none",
        }}
      >
        {mode.icon}
      </div>
      <h3
        className="text-xl font-bold tracking-tight transition-colors duration-300"
        style={{ color: hovered ? mode.accent : "rgba(255,255,255,0.9)" }}
      >
        {mode.title}
      </h3>
      <span className="text-xs uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
        {mode.subtitle}
      </span>
      <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
        {mode.description}
      </p>
      <div
        className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-all duration-300"
        style={{
          color: hovered ? mode.accent : "rgba(255,255,255,0.2)",
          transform: hovered ? "translateX(4px)" : "translateX(0)",
        }}
      >
        <span>Starta</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7h10M8 3l4 4-4 4" />
        </svg>
      </div>
    </button>
  );
}

/* ============ HEADER BUTTON — Återanvändbar med hover-effekter ============ */
function HeaderButton({ onClick, children }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-300"
      style={{
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        borderColor: hovered ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)",
        boxShadow: hovered ? "0 0 20px rgba(239,68,68,0.08), 0 4px 12px rgba(0,0,0,0.3)" : "none",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {children}
    </button>
  );
}

export default function DartLobby({ navigate, user }) {
  const handleGameSelect = (id) => {
    navigate(id);
  };

  /* Om inloggad → klicka går till profilsida
     Om ej inloggad → klicka går till login */
  const handleUserClick = () => {
    if (user) {
      navigate("profile");
    } else {
      navigate("login");
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(239,68,68,0.03) 0%, transparent 70%)" }}
      />

      {/* ============ TOP BAR ============ */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        {/* LOGIN / PROFIL — Övre vänstra hörnet
            Ej inloggad: visar "Logga in" → navigerar till login-sida
            Inloggad: visar spelarnamn + avatar → navigerar till profilsida
            Backend: GET /api/user/profile */}
        <HeaderButton onClick={handleUserClick}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
            style={{
              background: user ? "#EF4444" : "rgba(255,255,255,0.06)",
              boxShadow: user ? "0 0 12px rgba(239,68,68,0.3)" : "none",
            }}
          >
            {user ? (
              <span className="text-white text-sm font-bold">{user.username[0].toUpperCase()}</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="5.5" r="3" />
                <path d="M2.5 14.5C2.5 11.5 5 9.5 8 9.5s5.5 2 5.5 5" />
              </svg>
            )}
          </div>
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
            {user ? user.username : "Logga in"}
          </span>
          {user && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 5l3 3 3-3" />
            </svg>
          )}
        </HeaderButton>

        {/* KAMERAKALIBRERING — Övre högra hörnet
            Backend: GET/POST /api/calibration */}
        <HeaderButton onClick={() => navigate("calibrate")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 2v2M8 12v2M2 8h2M12 8h2" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
            Kalibrering
          </span>
        </HeaderButton>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-8 pb-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <DartIcon className="text-red-500 opacity-60" />
            <h1
              className="text-4xl font-extrabold tracking-tight uppercase"
              style={{
                color: "rgba(255,255,255,0.9)",
                textShadow: "0 0 40px rgba(239,68,68,0.15)",
              }}
            >
              DartVision
            </h1>
            <DartIcon className="text-red-500 opacity-60" />
          </div>
          <p className="text-sm tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
            Auto scoring system
          </p>
        </div>

        {/* ============ GAME MODES ============ */}
        <div className="w-full max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
            <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.2)" }}>
              Välj spelläge
            </span>
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GAME_MODES.map((mode, i) => (
              <GameCard key={mode.id} mode={mode} index={i} onSelect={handleGameSelect} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            System redo — väntar på kameror
          </span>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}