import { useState } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  PROFILSIDA — Spelarens statistik och profil               │
  │                                                             │
  │  Nås genom att klicka på sitt namn i lobbyn (inloggad).    │
  │  Visas även direkt efter lyckad login/register.            │
  │                                                             │
  │  INNEHÅLL:                                                  │
  │  - Avatar (initial-bokstav) + användarnamn                 │
  │  - Medlem sedan (datum)                                     │
  │  - Statistik-rutor:                                        │
  │    • Matcher spelade (matches_played)                      │
  │    • Vinst% (win_pct)                                      │
  │    • Högsta checkout (highest_checkout)                     │
  │    • Snittpoäng per runda (avg_score)                      │
  │    • Bästa leg i antal pilar (best_leg)                    │
  │    • Favoritläge (favorite_mode)                           │
  │  - Senaste matcher (placeholder för match history)         │
  │  - Knapp: "Till lobbyn"                                    │
  │  - Knapp: "Logga ut"                                       │
  │                                                             │
  │  Backend:                                                   │
  │  - GET /api/user/profile                                   │
  │    Response: { username, created_at, stats: {              │
  │      matches_played, matches_won, win_pct, avg_score,      │
  │      favorite_mode, highest_checkout, best_leg             │
  │    }}                                                       │
  │  - GET /api/user/matches?limit=5                           │
  │    Response: { matches: [{ id, mode, result, score, date }]│
  │  - POST /api/auth/logout                                   │
  │    Invaliderar JWT-token                                    │
  └─────────────────────────────────────────────────────────────┘
*/

function DartIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="22" y1="2" x2="13" y2="11" />
      <path d="M16 2L22 2L22 8" />
      <circle cx="10" cy="14" r="9" opacity="0.3" />
      <circle cx="10" cy="14" r="5" opacity="0.5" />
      <circle cx="10" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function StatCard({ label, value, accent, icon }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center gap-2 p-5 rounded-xl transition-all duration-300"
      style={{
        background: hovered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? accent + "30" : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered ? `0 0 20px ${accent}15` : "none",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
      <span className="text-3xl font-bold" style={{ color: accent }}>{value}</span>
      {icon && <div style={{ color: accent, opacity: 0.4 }}>{icon}</div>}
    </div>
  );
}

function MatchHistoryRow({ match, index }) {
  const resultColor = match.result === "Vinst" ? "#10B981" : match.result === "Förlust" ? "#EF4444" : "#F59E0B";

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full" style={{ background: resultColor }} />
        <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{match.mode}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold" style={{ color: resultColor }}>{match.result}</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{match.score}</span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>{match.date}</span>
      </div>
    </div>
  );
}

/* Mock match history — i produktion: GET /api/user/matches?limit=5 */
const MOCK_MATCHES = [
  { id: 1, mode: "Match 501", result: "Vinst", score: "3-1", date: "2026-03-25" },
  { id: 2, mode: "Match 501", result: "Förlust", score: "1-3", date: "2026-03-24" },
  { id: 3, mode: "121", result: "Vinst", score: "Nådde 142", date: "2026-03-24" },
  { id: 4, mode: "Match 301", result: "Vinst", score: "3-2", date: "2026-03-23" },
  { id: 5, mode: "Around the Clock", result: "Klar", score: "87% accuracy", date: "2026-03-22" },
];

export default function ProfilePage({ navigate, user, setUser }) {
  if (!user) {
    navigate("login");
    return null;
  }

  const isNewUser = !user.stats || user.stats.matches_played === 0;

  const handleLogout = () => {
    localStorage.removeItem("dart_token");
    setUser(null);
    navigate("lobby");
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Back button */}
      <button
        onClick={() => navigate("lobby")}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
        style={{ color: "rgba(255,255,255,0.3)" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L4 8l6 6" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
      </button>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-16 pb-16">
        {/* DartVision branding */}
        <div className="flex items-center gap-2 mb-8">
          <DartIcon className="text-red-500 opacity-50" size={16} />
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.2)" }}>
            DartVision
          </span>
          <DartIcon className="text-red-500 opacity-50" size={16} />
        </div>

        {/* ============ PROFILE HEADER ============ */}
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)",
            boxShadow: "0 8px 40px rgba(239,68,68,0.3)",
          }}
        >
          <span className="text-4xl font-bold text-white">{user.username[0].toUpperCase()}</span>
        </div>

        <h1 className="text-3xl font-extrabold" style={{ color: "rgba(255,255,255,0.9)" }}>
          {user.username}
        </h1>
        <span className="text-xs mt-1 mb-10" style={{ color: "rgba(255,255,255,0.25)" }}>
          Medlem sedan {user.created_at}
        </span>

        {/* ============ STATS GRID ============ */}
        <div className="w-full max-w-2xl">
          {isNewUser ? (
            <div
              className="p-8 rounded-2xl text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 opacity-20">
                <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="3" fill="white" />
              </svg>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                Välkommen! Spela din första match för att börja bygga statistik.
              </p>
            </div>
          ) : (
            <>
              {/* Stats header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Statistik
                </span>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                <StatCard label="Matcher" value={user.stats.matches_played} accent="#EF4444" />
                <StatCard label="Vinst%" value={`${user.stats.win_pct}%`} accent="#10B981" />
                <StatCard label="Högsta checkout" value={user.stats.highest_checkout} accent="#8B5CF6" />
                <StatCard label="Snitt/runda" value={user.stats.avg_score} accent="#F59E0B" />
                <StatCard label="Bästa leg" value={user.stats.best_leg ? `${user.stats.best_leg} pilar` : "–"} accent="#60A5FA" />
                <StatCard label="Favoritläge" value={user.stats.favorite_mode || "–"} accent="#EC4899" />
              </div>

              {/* ============ MATCH HISTORY ============ */}
              {/* Backend: GET /api/user/matches?limit=5
                  Response: { matches: [{ id, mode, result, score, date }] } */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Senaste matcher
                </span>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
              </div>

              <div className="flex flex-col gap-2">
                {MOCK_MATCHES.map((match, i) => (
                  <MatchHistoryRow key={match.id} match={match} index={i} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ============ BUTTONS ============ */}
        <div className="flex flex-col items-center gap-3 mt-10 w-full max-w-xs">
          <button
            onClick={() => navigate("heatmap")}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
            style={{
              background: "rgba(139,92,246,0.12)",
              color: "#A78BFA",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
            onMouseEnter={(e) => { e.target.style.background = "rgba(139,92,246,0.2)"; e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.target.style.background = "rgba(139,92,246,0.12)"; e.target.style.transform = "translateY(0)"; }}
          >
            Se heatmap
          </button>

          <button
            onClick={() => navigate("lobby")}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(239,68,68,0.25)",
            }}
            onMouseEnter={(e) => { e.target.style.boxShadow = "0 4px 30px rgba(239,68,68,0.4)"; e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.target.style.boxShadow = "0 4px 20px rgba(239,68,68,0.25)"; e.target.style.transform = "translateY(0)"; }}
          >
            Till lobbyn
          </button>

          <button
            onClick={handleLogout}
            className="py-2 text-xs font-semibold uppercase tracking-widest transition-colors duration-200"
            style={{ color: "rgba(255,255,255,0.2)" }}
            onMouseEnter={(e) => e.target.style.color = "rgba(239,68,68,0.6)"}
            onMouseLeave={(e) => e.target.style.color = "rgba(255,255,255,0.2)"}
          >
            Logga ut
          </button>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}