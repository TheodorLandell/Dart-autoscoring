import { useState, useRef, useCallback } from "react";
import ThrowForBull from "./ThrowForBull";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  TOURNAMENT BRACKET                                        │
  │                                                             │
  │  Visuell bracket-vy för single elimination                 │
  │  - Horisontellt turneringsträd (vänster → höger)           │
  │  - Klicka på nästa speelbara match → Throw for bull →      │
  │    MatchGame → resultat tillbaka hit                        │
  │  - Vinnare propageras automatiskt                          │
  │  - Responsivt med horisontell scroll för stora brackets    │
  │  - Turneringsvinnare-screen                                │
  └─────────────────────────────────────────────────────────────┘
*/

const PC = ["#EF4444", "#10B981", "#8B5CF6", "#F59E0B", "#60A5FA", "#EC4899", "#14B8A6", "#F97316"];

function getRoundName(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinal";
  if (remaining === 3) return "Kvartsfinal";
  return `Runda ${roundIndex + 1}`;
}

/* ============ MATCH CARD ============ */
function MatchCard({ match, isPlayable, onPlay, roundIndex, totalRounds }) {
  const [hovered, setHovered] = useState(false);
  const hasPlayers = match.player1 && match.player2;
  const isComplete = !!match.winner;
  const isBye = match.isBye;

  if (isBye) {
    const byePlayer = match.player1 || match.player2;
    return (
      <div
        className="rounded-xl px-4 py-3 min-w-[200px]"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
            {byePlayer?.name || "BYE"}
          </span>
          <span className="text-[10px] uppercase tracking-widest ml-auto" style={{ color: "rgba(255,255,255,0.15)" }}>
            bye
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => isPlayable && onPlay(match)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={!isPlayable}
      className="rounded-xl min-w-[220px] overflow-hidden transition-all duration-300 text-left"
      style={{
        background: isPlayable && hovered
          ? "rgba(245,158,11,0.08)"
          : isComplete
            ? "rgba(16,185,129,0.04)"
            : "rgba(255,255,255,0.02)",
        border: isPlayable
          ? hovered
            ? "1px solid rgba(245,158,11,0.4)"
            : "1px solid rgba(245,158,11,0.2)"
          : isComplete
            ? "1px solid rgba(16,185,129,0.15)"
            : "1px solid rgba(255,255,255,0.06)",
        cursor: isPlayable ? "pointer" : "default",
        boxShadow: isPlayable && hovered ? "0 0 20px rgba(245,158,11,0.1)" : "none",
        transform: isPlayable && hovered ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Player 1 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: isComplete && match.winner?.id === match.player1?.id
            ? "rgba(16,185,129,0.08)"
            : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: match.player1
              ? isComplete && match.winner?.id === match.player1?.id ? "#10B981" : "rgba(255,255,255,0.2)"
              : "rgba(255,255,255,0.05)",
          }}
        />
        <span
          className="text-sm font-semibold flex-1 truncate"
          style={{
            color: match.player1
              ? isComplete && match.winner?.id === match.player1?.id ? "#10B981" : "rgba(255,255,255,0.7)"
              : "rgba(255,255,255,0.15)",
          }}
        >
          {match.player1?.name || "—"}
        </span>
        {isComplete && match.score1 !== null && (
          <span className="text-xs font-bold" style={{
            color: match.winner?.id === match.player1?.id ? "#10B981" : "rgba(255,255,255,0.25)"
          }}>
            {match.score1}
          </span>
        )}
      </div>

      {/* Player 2 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: isComplete && match.winner?.id === match.player2?.id
            ? "rgba(16,185,129,0.08)"
            : "transparent",
        }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: match.player2
              ? isComplete && match.winner?.id === match.player2?.id ? "#10B981" : "rgba(255,255,255,0.2)"
              : "rgba(255,255,255,0.05)",
          }}
        />
        <span
          className="text-sm font-semibold flex-1 truncate"
          style={{
            color: match.player2
              ? isComplete && match.winner?.id === match.player2?.id ? "#10B981" : "rgba(255,255,255,0.7)"
              : "rgba(255,255,255,0.15)",
          }}
        >
          {match.player2?.name || "—"}
        </span>
        {isComplete && match.score2 !== null && (
          <span className="text-xs font-bold" style={{
            color: match.winner?.id === match.player2?.id ? "#10B981" : "rgba(255,255,255,0.25)"
          }}>
            {match.score2}
          </span>
        )}
      </div>

      {/* Play indicator */}
      {isPlayable && (
        <div
          className="px-4 py-1.5 text-center transition-all duration-200"
          style={{
            background: hovered ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.06)",
            borderTop: "1px solid rgba(245,158,11,0.15)",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#F59E0B" }}>
            ▶ Spela match
          </span>
        </div>
      )}
    </button>
  );
}

/* ============ BRACKET CONNECTOR LINES (SVG) ============ */
function BracketConnectors({ rounds, matchHeight, matchGap, roundWidth }) {
  if (rounds.length <= 1) return null;

  const lines = [];

  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRound = rounds[r];
    const nextRound = rounds[r + 1];

    for (let m = 0; m < nextRound.length; m++) {
      const topMatchIdx = m * 2;
      const bottomMatchIdx = m * 2 + 1;

      if (topMatchIdx >= currentRound.length) continue;

      /* Beräkna Y-positioner */
      const currentSpacing = matchHeight + matchGap;
      const currentRoundOffset = (Math.pow(2, r) - 1) * currentSpacing / 2;
      const nextRoundOffset = (Math.pow(2, r + 1) - 1) * currentSpacing / 2;

      const y1 = currentRoundOffset + topMatchIdx * currentSpacing * Math.pow(2, r) + matchHeight / 2;
      const y2 = bottomMatchIdx < currentRound.length
        ? currentRoundOffset + bottomMatchIdx * currentSpacing * Math.pow(2, r) + matchHeight / 2
        : y1;
      const yMid = (y1 + y2) / 2;

      const x1 = r * roundWidth + 220; /* Right edge of current match card */
      const x2 = (r + 1) * roundWidth; /* Left edge of next match card */
      const xMid = (x1 + x2) / 2;

      lines.push(
        <g key={`conn-${r}-${m}`} opacity="0.2">
          {/* Top match → mid */}
          <path
            d={`M${x1} ${y1} H${xMid} V${yMid}`}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
          />
          {/* Bottom match → mid */}
          {bottomMatchIdx < currentRound.length && (
            <path
              d={`M${x1} ${y2} H${xMid} V${yMid}`}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
            />
          )}
          {/* Mid → next match */}
          <path
            d={`M${xMid} ${yMid} H${x2}`}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
          />
        </g>
      );
    }
  }

  return <>{lines}</>;
}

/* ============ WINNER SCREEN ============ */
function WinnerScreen({ winner, tournamentName, onBackToLobby }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
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

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
        {/* Trophy */}
        <div className="text-7xl mb-2" style={{ filter: "drop-shadow(0 0 40px rgba(245,158,11,0.4))" }}>🏆</div>

        <span className="text-sm uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.25)" }}>
          {tournamentName}
        </span>

        <h1 className="text-5xl font-extrabold uppercase tracking-tight" style={{ color: "#F59E0B", textShadow: "0 0 60px rgba(245,158,11,0.3)" }}>
          {winner.name}
        </h1>

        <span className="text-lg uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
          Turneringsvinnare!
        </span>

        <button
          onClick={onBackToLobby}
          className="mt-8 px-10 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 4px 30px rgba(239,68,68,0.5)"; }}
          onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 20px rgba(239,68,68,0.3)"; }}
        >
          Till lobbyn
        </button>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ============ MAIN ============ */
export default function TournamentBracket({ navigate, tournamentConfig }) {
  const { tournamentName, bracket, matchSettings, players } = tournamentConfig;
  const [tournamentWinner, setTournamentWinner] = useState(null);
  const scrollRef = useRef(null);

  /* Throw for bull state */
  const [bullPhaseMatch, setBullPhaseMatch] = useState(null);

  const { rounds, totalRounds } = bracket;

  /* Hitta nästa speelbara match (har 2 spelare, ingen vinnare, ej bye) */
  const findPlayableMatches = useCallback(() => {
    const playable = [];
    for (let r = 0; r < rounds.length; r++) {
      for (const match of rounds[r]) {
        if (match.player1 && match.player2 && !match.winner && !match.isBye) {
          playable.push(match);
        }
      }
    }
    return playable;
  }, [rounds]);

  const playableMatches = findPlayableMatches();

  /* Kolla om finalen är avgjord (vid mount/uppdatering) */
  const finalMatch = rounds[rounds.length - 1]?.[0];
  const isFinalDone = finalMatch?.winner && !tournamentWinner;
  if (isFinalDone) {
    /* Använd setTimeout för att undvika setState under rendering */
    setTimeout(() => setTournamentWinner(finalMatch.winner), 0);
  }

  const handlePlay = (match) => {
    /* Visa throw for bull innan matchen startar */
    setBullPhaseMatch(match);
  };

  /* Callback efter throw for bull — starta matchen med rätt ordning */
  const handleBullComplete = (orderedPlayers) => {
    if (!bullPhaseMatch) return;
    navigate("tournament-match", {
      matchId: bullPhaseMatch.id,
      players: orderedPlayers,
      startingScore: matchSettings.startingScore,
      legs: matchSettings.legs,
      format: matchSettings.format,
    });
    setBullPhaseMatch(null);
  };

  const handleBullBack = () => {
    setBullPhaseMatch(null);
  };

  /* Throw for bull screen */
  if (bullPhaseMatch) {
    return (
      <ThrowForBull
        players={[bullPhaseMatch.player1, bullPhaseMatch.player2]}
        onComplete={handleBullComplete}
        onBack={handleBullBack}
        title="Throw for bull"
        subtitle={`${bullPhaseMatch.player1?.name} vs ${bullPhaseMatch.player2?.name}`}
      />
    );
  }

  /* Winner screen */
  if (tournamentWinner) {
    return (
      <WinnerScreen
        winner={tournamentWinner}
        tournamentName={tournamentName}
        onBackToLobby={() => navigate("lobby")}
      />
    );
  }

  /* Layout constants */
  const matchHeight = 80;
  const matchGap = 16;
  const roundWidth = 280;

  /* Räkna ut total höjd baserat på runda 1 */
  const round1Count = rounds[0]?.length || 0;
  const baseSpacing = matchHeight + matchGap;
  const totalHeight = Math.max(round1Count * baseSpacing + 40, 400);

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
          <span className="text-xs font-semibold uppercase tracking-widest">Avsluta</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div className="text-center">
            <h1 className="text-lg font-extrabold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
              {tournamentName}
            </h1>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
              Single elimination · {players.length} spelare
            </span>
          </div>
        </div>

        {/* Match count */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {playableMatches.length > 0
              ? `${playableMatches.length} match${playableMatches.length > 1 ? "er" : ""} kvar`
              : "Väntar..."
            }
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: playableMatches.length > 0 ? "#F59E0B" : "rgba(255,255,255,0.1)",
              animation: playableMatches.length > 0 ? "pulse 2s infinite" : "none",
            }}
          />
        </div>
      </header>

      {/* Info bar */}
      <div className="relative z-10 px-6 mb-4">
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl max-w-2xl mx-auto" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {matchSettings.startingScore} poäng
          </span>
          <div className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {matchSettings.format === "best-of"
              ? `Bäst av ${matchSettings.legs}`
              : `Först till ${Math.ceil(matchSettings.legs / 2)}`
            } legs
          </span>
          <div className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {totalRounds} rundor
          </span>
        </div>
      </div>

      {/* Bracket area — horizontal scroll */}
      <div
        ref={scrollRef}
        className="relative z-10 overflow-x-auto overflow-y-auto pb-12 px-6"
        style={{ maxHeight: "calc(100vh - 140px)" }}
      >
        <div
          className="relative"
          style={{
            minWidth: totalRounds * roundWidth + 60,
            minHeight: totalHeight,
          }}
        >
          {/* Round headers */}
          <div className="flex mb-6" style={{ gap: roundWidth - 120 + "px", paddingLeft: "8px" }}>
            {rounds.map((_, ri) => (
              <div key={ri} className="min-w-[220px] text-center">
                <span className="text-xs font-bold uppercase tracking-widest" style={{
                  color: ri === rounds.length - 1 ? "#F59E0B" : "rgba(255,255,255,0.2)"
                }}>
                  {getRoundName(ri, totalRounds)}
                </span>
              </div>
            ))}
          </div>

          {/* Matches by round */}
          <div className="flex items-start" style={{ gap: (roundWidth - 220) + "px" }}>
            {rounds.map((round, ri) => {
              /* Vertikalt avstånd ökar för varje runda */
              const verticalGap = baseSpacing * Math.pow(2, ri) - matchHeight;

              return (
                <div
                  key={ri}
                  className="flex flex-col min-w-[220px]"
                  style={{
                    gap: verticalGap + "px",
                    /* Centrera vertikalt mot föregående runda */
                    marginTop: ri === 0 ? 0 : (baseSpacing * (Math.pow(2, ri) - 1)) / 2,
                  }}
                >
                  {round.map((match) => {
                    const isPlayable = playableMatches.some((pm) => pm.id === match.id);
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        isPlayable={isPlayable}
                        onPlay={handlePlay}
                        roundIndex={ri}
                        totalRounds={totalRounds}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating action — nästa match */}
      {playableMatches.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => handlePlay(playableMatches[0])}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff",
              boxShadow: "0 4px 30px rgba(245,158,11,0.35), 0 0 60px rgba(245,158,11,0.15)",
            }}
            onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 4px 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.2)"; }}
            onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 30px rgba(245,158,11,0.35), 0 0 60px rgba(245,158,11,0.15)"; }}
          >
            <span>▶</span>
            <span>
              Nästa: {playableMatches[0].player1?.name} vs {playableMatches[0].player2?.name}
            </span>
          </button>
        </div>
      )}

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}