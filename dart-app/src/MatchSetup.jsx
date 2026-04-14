import { useState } from "react";
import ThrowForBull from "./ThrowForBull";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  MATCH SETUP — Allt på en sida + Throw for Bull            │
  │                                                             │
  │  SETUP-SIDAN (scrollbar):                                  │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  1. SPELARVAL                                       │    │
  │  │  - Inloggad spelare visas automatiskt               │    │
  │  │  - Lägg till gäst (skriv namn)                      │    │
  │  │  - Lägg till bot (välj snittnivå via slider)        │    │
  │  │  - Obegränsat antal spelare                         │    │
  │  │  - Drag för att ändra ordning (stretch goal)        │    │
  │  │                                                      │    │
  │  │  Bot-nivå:                                           │    │
  │  │  - Slider 15-80 (snittpoäng per 3 pilar)           │    │
  │  │  - 15-25: Nybörjare                                 │    │
  │  │  - 26-40: Casual                                    │    │
  │  │  - 41-55: Medel                                     │    │
  │  │  - 56-70: Bra                                       │    │
  │  │  - 71-80: Pro                                       │    │
  │  │                                                      │    │
  │  │  Backend:                                            │    │
  │  │  - GET /api/user/profile → hämta inloggad spelare   │    │
  │  │  - Bot-logik hanteras i backend vid gameplay         │    │
  │  │    POST /api/game/bot-throw { avg_score, target }   │    │
  │  ├─────────────────────────────────────────────────────┤    │
  │  │  2. POÄNGVAL                                        │    │
  │  │  - 501 / 301 / Custom (input)                       │    │
  │  │  - Custom: valfritt tal, valideras > 0              │    │
  │  │                                                      │    │
  │  │  Backend: sparas i matchkonfiguration                │    │
  │  ├─────────────────────────────────────────────────────┤    │
  │  │  3. LEGS & FORMAT                                   │    │
  │  │  - Antal legs: 1, 3, 5, 7 eller custom              │    │
  │  │  - Format: "Först till X" eller "Bäst av X"        │    │
  │  │                                                      │    │
  │  │  Backend: matchstate-hantering, legs vunna/spelare  │    │
  │  ├─────────────────────────────────────────────────────┤    │
  │  │  4. STARTA MATCH → Throw for Bull                   │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  THROW FOR BULL (fullskärm):                               │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  Dartboard-grafik (SVG)                             │    │
  │  │  "Spelare X — Kasta din pil!"                       │    │
  │  │  Klicka på tavlan för att placera pil               │    │
  │  │  Bekräfta-knapp → nästa spelare                     │    │
  │  │  När alla kastat → visa resultat + vem som börjar   │    │
  │  │                                                      │    │
  │  │  Systemet mäter avstånd till bull-centrum:          │    │
  │  │  - Pil 1 = Spelare 1, Pil 2 = Spelare 2, osv.     │    │
  │  │  - Närmast bull börjar kasta först i matchen        │    │
  │  │                                                      │    │
  │  │  Backend:                                            │    │
  │  │  POST /api/game/match/create                        │    │
  │  │  Body: { players, starting_score, legs, format,     │    │
  │  │          throw_order (from bull result) }            │    │
  │  │  I produktion: pilpositioner från DartVision         │    │
  │  │  WebSocket: /ws/game/{match_id} för live-uppdatering│    │
  │  └─────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
*/

/* ============ HELPERS ============ */
function getBotLabel(avg) {
  if (avg <= 25) return "Nybörjare";
  if (avg <= 40) return "Casual";
  if (avg <= 55) return "Medel";
  if (avg <= 70) return "Bra";
  return "Pro";
}

function getBotColor(avg) {
  if (avg <= 25) return "#10B981";
  if (avg <= 40) return "#60A5FA";
  if (avg <= 55) return "#F59E0B";
  if (avg <= 70) return "#EF4444";
  return "#8B5CF6";
}

/* ============ SECTION WRAPPER ============ */
function Section({ number, title, description, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
        >
          {number}
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{title}</h2>
          {description && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ============ PLAYER CARD ============ */
function PlayerCard({ player, index, onRemove }) {
  const isBot = player.type === "bot";
  const isUser = player.type === "user";

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold w-6 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          {index + 1}
        </span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{
            background: isBot ? getBotColor(player.avgScore) + "20" : isUser ? "#EF444420" : "rgba(255,255,255,0.06)",
            color: isBot ? getBotColor(player.avgScore) : isUser ? "#EF4444" : "rgba(255,255,255,0.5)",
          }}
        >
          {isBot ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="4" width="10" height="8" rx="2" />
              <circle cx="6" cy="8" r="1" fill="currentColor" />
              <circle cx="10" cy="8" r="1" fill="currentColor" />
              <path d="M8 1v3" />
            </svg>
          ) : (
            player.name[0].toUpperCase()
          )}
        </div>
        <div>
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
            {player.name}
          </span>
          <div className="flex items-center gap-2">
            {isUser && <span className="text-[10px] uppercase tracking-widest" style={{ color: "#EF4444" }}>Du</span>}
            {isBot && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: getBotColor(player.avgScore) }}>
                Bot — {getBotLabel(player.avgScore)} ({player.avgScore} avg)
              </span>
            )}
            {player.type === "guest" && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Gäst</span>
            )}
          </div>
        </div>
      </div>
      {!isUser && (
        <button
          onClick={() => onRemove(player.id)}
          className="p-1.5 rounded-lg transition-colors duration-150"
          style={{ color: "rgba(255,255,255,0.15)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.15)"}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ============ OPTION BUTTON ============ */
function OptionButton({ label, selected, onClick, accent = "#EF4444" }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
      style={{
        background: selected ? accent + "18" : "rgba(255,255,255,0.03)",
        border: selected ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.06)",
        color: selected ? accent : "rgba(255,255,255,0.5)",
        boxShadow: selected ? `0 0 15px ${accent}10` : "none",
      }}
    >
      {label}
    </button>
  );
}

/* Dartboard och ThrowForBull importeras nu från ThrowForBull.jsx */

/* ============ MAIN MATCH SETUP PAGE ============ */
export default function MatchSetup({ navigate, user }) {
  const [players, setPlayers] = useState(() => {
    const initial = [];
    if (user) {
      initial.push({ id: "user", type: "user", name: user.username });
    }
    return initial;
  });

  const [guestName, setGuestName] = useState("");
  const [botAvg, setBotAvg] = useState(45);
  const [startingScore, setStartingScore] = useState(501);
  const [customScore, setCustomScore] = useState("");
  const [scoreMode, setScoreMode] = useState("501");
  const [legs, setLegs] = useState(3);
  const [customLegs, setCustomLegs] = useState("");
  const [legMode, setLegMode] = useState("first-to");
  const [phase, setPhase] = useState("setup"); // "setup" | "throw-for-bull"

  /* Lägg till gäst */
  const addGuest = () => {
    if (!guestName.trim()) return;
    setPlayers((prev) => [...prev, { id: `guest-${Date.now()}`, type: "guest", name: guestName.trim() }]);
    setGuestName("");
  };

  /* Lägg till bot */
  const addBot = () => {
    setPlayers((prev) => [
      ...prev,
      { id: `bot-${Date.now()}`, type: "bot", name: `Bot (${getBotLabel(botAvg)})`, avgScore: botAvg },
    ]);
  };

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleScoreSelect = (mode) => {
    setScoreMode(mode);
    if (mode === "501") setStartingScore(501);
    else if (mode === "301") setStartingScore(301);
  };

  const handleStart = () => {
    if (players.length < 2) return;

    /* Sätt custom score */
    if (scoreMode === "custom" && customScore) {
      setStartingScore(parseInt(customScore));
    }

    setPhase("throw-for-bull");
  };

  const handleThrowComplete = (order) => {
    /* Backend: POST /api/game/match/create
       Body: {
         players: order.map(p => ({ id, type, name, avgScore? })),
         starting_score: startingScore,
         legs: legMode === 'custom' ? parseInt(customLegs) : legs,
         format: legMode,
         throw_order: order.map(p => p.id)
       }
       
       Response: { match_id, ... }
       → Navigera till scoreboard: navigate(`match-game-${match_id}`) */
    const actualLegs = legMode === "custom-legs" ? (parseInt(customLegs) || 1) : legs;
    navigate("match-game", {
      players: order,
      startingScore: scoreMode === "custom" ? (parseInt(customScore) || 501) : startingScore,
      legs: actualLegs,
      format: legMode === "best-of" ? "best-of" : "first-to",
    });
  };

  if (phase === "throw-for-bull") {
    return (
      <ThrowForBull
        players={players}
        onComplete={handleThrowComplete}
        onBack={() => setPhase("setup")}
      />
    );
  }

  const canStart = players.length >= 2;

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
    >
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <button onClick={() => navigate("lobby")} className="flex items-center gap-2 transition-colors duration-200" style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <h1 className="text-lg font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
          Match setup
        </h1>
        <div style={{ width: 80 }} />
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 pb-16">
        {/* ============ 1. SPELARVAL ============ */}
        <Section number="1" title="Spelare" description="Lägg till spelare, gäster eller bottar">
          {/* Player list */}
          <div className="flex flex-col gap-2 mb-4">
            {players.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={i} onRemove={removePlayer} />
            ))}
            {players.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
                {user ? "Du är tillagd automatiskt." : "Logga in för att lägga till dig själv, eller lägg till gäster."}
              </p>
            )}
          </div>

          {/* Add guest */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGuest()}
              placeholder="Gästnamn..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(255,255,255,0.2)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <button
              onClick={addGuest}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              + Gäst
            </button>
          </div>

          {/* Add bot */}
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                Lägg till bot
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: getBotColor(botAvg) }}>
                  {getBotLabel(botAvg)}
                </span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {botAvg} avg
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>15</span>
              <input
                type="range"
                min="15"
                max="80"
                value={botAvg}
                onChange={(e) => setBotAvg(parseInt(e.target.value))}
                className="flex-1"
                style={{ accentColor: getBotColor(botAvg) }}
              />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>80</span>
              <button
                onClick={addBot}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: getBotColor(botAvg) + "15",
                  border: `1px solid ${getBotColor(botAvg)}30`,
                  color: getBotColor(botAvg),
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = getBotColor(botAvg) + "25"}
                onMouseLeave={(e) => e.currentTarget.style.background = getBotColor(botAvg) + "15"}
              >
                + Bot
              </button>
            </div>
            {/* Scale labels */}
            <div className="flex justify-between mt-2 px-6">
              {["Nybörjare", "Casual", "Medel", "Bra", "Pro"].map((l) => (
                <span key={l} className="text-[9px]" style={{ color: "rgba(255,255,255,0.12)" }}>{l}</span>
              ))}
            </div>
          </div>
        </Section>

        {/* ============ 2. POÄNGVAL ============ */}
        <Section number="2" title="Startpoäng" description="Välj poäng att spela ner från">
          <div className="flex gap-2 flex-wrap">
            <OptionButton label="501" selected={scoreMode === "501"} onClick={() => handleScoreSelect("501")} />
            <OptionButton label="301" selected={scoreMode === "301"} onClick={() => handleScoreSelect("301")} />
            <OptionButton label="Custom" selected={scoreMode === "custom"} onClick={() => setScoreMode("custom")} />
          </div>
          {scoreMode === "custom" && (
            <input
              type="number"
              value={customScore}
              onChange={(e) => setCustomScore(e.target.value)}
              placeholder="Ange poäng..."
              className="mt-3 w-40 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "rgba(255,255,255,0.8)",
              }}
            />
          )}
        </Section>

        {/* ============ 3. LEGS & FORMAT ============ */}
        <Section number="3" title="Legs & Format" description="Antal legs och matchformat">
          {/* Leg count */}
          <div className="flex gap-2 flex-wrap mb-4">
            {[1, 3, 5, 7].map((n) => (
              <OptionButton
                key={n}
                label={`${n}`}
                selected={legs === n && legMode !== "custom-legs"}
                onClick={() => { setLegs(n); setLegMode(legMode === "custom-legs" ? "first-to" : legMode); }}
              />
            ))}
            <OptionButton
              label="Custom"
              selected={legMode === "custom-legs"}
              onClick={() => setLegMode("custom-legs")}
            />
          </div>
          {legMode === "custom-legs" && (
            <input
              type="number"
              value={customLegs}
              onChange={(e) => { setCustomLegs(e.target.value); setLegs(parseInt(e.target.value) || 1); }}
              placeholder="Antal legs..."
              className="mb-4 w-40 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "rgba(255,255,255,0.8)",
              }}
            />
          )}

          {/* Format */}
          <div className="flex gap-2">
            <OptionButton
              label={`Först till ${legs}`}
              selected={legMode === "first-to" || legMode === "custom-legs"}
              onClick={() => setLegMode(legMode === "custom-legs" ? "custom-legs" : "first-to")}
              accent="#10B981"
            />
            <OptionButton
              label={`Bäst av ${legs}`}
              selected={legMode === "best-of"}
              onClick={() => setLegMode("best-of")}
              accent="#8B5CF6"
            />
          </div>
        </Section>

        {/* ============ START BUTTON ============ */}
        <div className="flex flex-col items-center gap-3 mt-4">
          {!canStart && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Minst 2 spelare krävs för att starta
            </span>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full max-w-md py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
            style={{
              background: canStart ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" : "rgba(255,255,255,0.03)",
              color: canStart ? "#fff" : "rgba(255,255,255,0.15)",
              boxShadow: canStart ? "0 4px 20px rgba(239,68,68,0.25)" : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canStart) { e.target.style.boxShadow = "0 4px 30px rgba(239,68,68,0.5)"; e.target.style.transform = "translateY(-2px)"; }}}
            onMouseLeave={(e) => { if (canStart) { e.target.style.boxShadow = "0 4px 20px rgba(239,68,68,0.25)"; e.target.style.transform = "translateY(0)"; }}}
          >
            Throw for bull →
          </button>

          {/* Match summary */}
          {canStart && (
            <div className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
              {players.length} spelare · {scoreMode === "custom" ? customScore || "?" : startingScore} poäng ·{" "}
              {legMode === "best-of" ? `Bäst av ${legs}` : `Först till ${legs}`} legs
            </div>
          )}
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}