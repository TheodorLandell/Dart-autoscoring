import { useState } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  TOURNAMENT SETUP                                          │
  │                                                             │
  │  Single Elimination bracket                                │
  │  - Minst 4 spelare (fritt antal, auto-byes)               │
  │  - Random draw (shuffle)                                    │
  │  - Bottar kan delta                                        │
  │  - Match-inställningar: poäng, legs, format                │
  │  - Genererar bracket → navigerar till TournamentBracket    │
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/* Generera single-elimination bracket
   Returnerar: { rounds: [ [match, match, ...], ... ], totalRounds }
   Varje match: { id, round, position, player1, player2, winner, isBye } */
function generateBracket(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOf2(shuffled.length);
  const totalRounds = Math.log2(size);
  const byeCount = size - shuffled.length;

  /* Fyll slots: spelare + null (bye) */
  const slots = [...shuffled];
  for (let i = 0; i < byeCount; i++) slots.push(null);

  /* Fördela byes jämnt — sätt dem i botten av bracketen */
  /* Enkel approach: spelare först, byes sist → de högsta seedsen får bye */
  const round1 = [];
  for (let i = 0; i < size; i += 2) {
    const p1 = slots[i] || null;
    const p2 = slots[i + 1] || null;
    const isBye = !p1 || !p2;
    const winner = isBye ? (p1 || p2) : null;
    round1.push({
      id: `r1-m${i / 2}`,
      round: 0,
      position: i / 2,
      player1: p1,
      player2: p2,
      winner,
      isBye,
      score1: null,
      score2: null,
    });
  }

  const rounds = [round1];

  /* Skapa tomma matcher för efterföljande rundor */
  for (let r = 1; r < totalRounds; r++) {
    const prevRound = rounds[r - 1];
    const roundMatches = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      roundMatches.push({
        id: `r${r + 1}-m${i / 2}`,
        round: r,
        position: i / 2,
        player1: null,
        player2: null,
        winner: null,
        isBye: false,
        score1: null,
        score2: null,
      });
    }
    rounds.push(roundMatches);
  }

  /* Propagera bye-vinnare till nästa runda */
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((match, mi) => {
      if (match.winner) {
        const nextMatch = rounds[r + 1][Math.floor(mi / 2)];
        if (mi % 2 === 0) nextMatch.player1 = match.winner;
        else nextMatch.player2 = match.winner;
      }
    });
  }

  return { rounds, totalRounds };
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
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
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
          onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.15)")}
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

/* ============ MAIN ============ */
export default function TournamentSetup({ navigate, user }) {
  const [players, setPlayers] = useState(() => {
    const initial = [];
    if (user) initial.push({ id: "user", type: "user", name: user.username });
    return initial;
  });

  const [guestName, setGuestName] = useState("");
  const [botAvg, setBotAvg] = useState(45);
  const [scoreMode, setScoreMode] = useState("501");
  const [customScore, setCustomScore] = useState("");
  const [startingScore, setStartingScore] = useState(501);
  const [legs, setLegs] = useState(3);
  const [customLegs, setCustomLegs] = useState("");
  const [legMode, setLegMode] = useState("first-to");
  const [tournamentName, setTournamentName] = useState("");

  const addGuest = () => {
    if (!guestName.trim()) return;
    setPlayers((prev) => [...prev, { id: `guest-${Date.now()}`, type: "guest", name: guestName.trim() }]);
    setGuestName("");
  };

  const addBot = () => {
    setPlayers((prev) => [
      ...prev,
      { id: `bot-${Date.now()}`, type: "bot", name: `Bot (${getBotLabel(botAvg)})`, avgScore: botAvg },
    ]);
  };

  const removePlayer = (id) => setPlayers((prev) => prev.filter((p) => p.id !== id));

  const handleScoreSelect = (mode) => {
    setScoreMode(mode);
    if (mode === "501") setStartingScore(501);
    else if (mode === "301") setStartingScore(301);
  };

  const handleStart = () => {
    if (players.length < 4) return;

    const actualScore = scoreMode === "custom" ? (parseInt(customScore) || 501) : startingScore;
    const actualLegs = legMode === "custom-legs" ? (parseInt(customLegs) || 1) : legs;
    const actualFormat = legMode === "best-of" ? "best-of" : "first-to";

    const bracket = generateBracket(players);

    navigate("tournament-bracket", {
      tournamentName: tournamentName.trim() || "DartVision Cup",
      bracket,
      matchSettings: {
        startingScore: actualScore,
        legs: actualLegs,
        format: actualFormat,
      },
      players,
    });
  };

  const canStart = players.length >= 4;
  const bracketSize = nextPowerOf2(players.length);
  const byeCount = players.length >= 4 ? bracketSize - players.length : 0;

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
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Accent glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.04) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate("lobby")}
          className="flex items-center gap-2 transition-colors duration-200"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L4 8l6 6" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7" />
            <path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0012 0V2z" />
          </svg>
          <h1 className="text-lg font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
            Tournament Setup
          </h1>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 pb-16">
        {/* ===== TOURNAMENT NAME ===== */}
        <Section number="🏆" title="Turneringsnamn" description="Ge din turnering ett namn">
          <input
            type="text"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            placeholder="DartVision Cup..."
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </Section>

        {/* ===== 1. SPELARE ===== */}
        <Section number="1" title="Spelare" description="Minst 4 spelare krävs. Byes läggs till automatiskt.">
          <div className="flex flex-col gap-2 mb-4">
            {players.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={i} onRemove={removePlayer} />
            ))}
            {players.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
                Lägg till spelare, gäster eller bottar.
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
              onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.2)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
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
          <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                Lägg till bot
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: getBotColor(botAvg) }}>{getBotLabel(botAvg)}</span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{botAvg} avg</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>15</span>
              <input
                type="range" min="15" max="80" value={botAvg}
                onChange={(e) => setBotAvg(parseInt(e.target.value))}
                className="flex-1" style={{ accentColor: getBotColor(botAvg) }}
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
                onMouseEnter={(e) => (e.currentTarget.style.background = getBotColor(botAvg) + "25")}
                onMouseLeave={(e) => (e.currentTarget.style.background = getBotColor(botAvg) + "15")}
              >
                + Bot
              </button>
            </div>
            <div className="flex justify-between mt-2 px-6">
              {["Nybörjare", "Casual", "Medel", "Bra", "Pro"].map((l) => (
                <span key={l} className="text-[9px]" style={{ color: "rgba(255,255,255,0.12)" }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Bracket preview info */}
          {players.length >= 4 && (
            <div className="mt-4 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3M8 10.5v.5" />
              </svg>
              <span className="text-xs" style={{ color: "rgba(245,158,11,0.7)" }}>
                {players.length} spelare → {bracketSize}-bracket
                {byeCount > 0 && ` (${byeCount} bye${byeCount > 1 ? "s" : ""})`}
                {" · "}{Math.log2(bracketSize)} rundor
              </span>
            </div>
          )}
        </Section>

        {/* ===== 2. POÄNGVAL ===== */}
        <Section number="2" title="Matchpoäng" description="Gäller alla matcher i turneringen">
          <div className="flex gap-2 flex-wrap">
            <OptionButton label="501" selected={scoreMode === "501"} onClick={() => handleScoreSelect("501")} />
            <OptionButton label="301" selected={scoreMode === "301"} onClick={() => handleScoreSelect("301")} />
            <OptionButton label="Custom" selected={scoreMode === "custom"} onClick={() => setScoreMode("custom")} />
          </div>
          {scoreMode === "custom" && (
            <input
              type="number" value={customScore} onChange={(e) => setCustomScore(e.target.value)}
              placeholder="Ange poäng..."
              className="mt-3 w-40 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.8)" }}
            />
          )}
        </Section>

        {/* ===== 3. LEGS & FORMAT ===== */}
        <Section number="3" title="Legs & Format" description="Gäller alla matcher">
          <div className="flex gap-2 flex-wrap mb-4">
            {[1, 3, 5, 7].map((n) => (
              <OptionButton
                key={n} label={`${n}`}
                selected={legs === n && legMode !== "custom-legs"}
                onClick={() => { setLegs(n); if (legMode === "custom-legs") setLegMode("first-to"); }}
              />
            ))}
            <OptionButton label="Custom" selected={legMode === "custom-legs"} onClick={() => setLegMode("custom-legs")} />
          </div>
          {legMode === "custom-legs" && (
            <input
              type="number" value={customLegs}
              onChange={(e) => { setCustomLegs(e.target.value); setLegs(parseInt(e.target.value) || 1); }}
              placeholder="Antal legs..."
              className="mb-4 w-40 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.8)" }}
            />
          )}
          <div className="flex gap-2">
            <OptionButton
              label={`Först till ${legs}`}
              selected={legMode === "first-to" || legMode === "custom-legs"}
              onClick={() => { if (legMode !== "custom-legs") setLegMode("first-to"); }}
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

        {/* ===== START ===== */}
        <div className="flex flex-col items-center gap-3 mt-4">
          {!canStart && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Minst 4 spelare krävs för turnering
              {players.length > 0 && ` (${players.length}/${4})`}
            </span>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full max-w-md py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
            style={{
              background: canStart ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "rgba(255,255,255,0.03)",
              color: canStart ? "#fff" : "rgba(255,255,255,0.15)",
              boxShadow: canStart ? "0 4px 20px rgba(245,158,11,0.25)" : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canStart) { e.target.style.boxShadow = "0 4px 30px rgba(245,158,11,0.5)"; e.target.style.transform = "translateY(-2px)"; } }}
            onMouseLeave={(e) => { if (canStart) { e.target.style.boxShadow = "0 4px 20px rgba(245,158,11,0.25)"; e.target.style.transform = "translateY(0)"; } }}
          >
            🏆 Generera bracket & starta
          </button>

          {canStart && (
            <div className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
              {players.length} spelare · {scoreMode === "custom" ? customScore || "?" : startingScore} poäng ·{" "}
              {legMode === "best-of" ? `Bäst av ${legs}` : `Först till ${legs}`} legs · Single elimination
            </div>
          )}
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
