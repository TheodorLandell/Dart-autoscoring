import { useState, useEffect } from "react"
import DartLobby from "./DartLobby"
import LoginPage from "./LoginPage"
import CalibrationPage from "./CalibrationPage"
import ProfilePage from "./ProfilePage"
import MatchSetup from "./MatchSetup"
import MatchGame from "./MatchGame"
import Game121 from "./Game121"
import AroundTheClock from "./AroundTheClock"
import HeatmapPage from "./HeatmapPage"
import TournamentSetup from "./TournamentSetup"
import TournamentBracket from "./TournamentBracket"
import LiveScoring from "./LiveScoring"


export default function App() {
  const [page, setPage] = useState("lobby")
  const [user, setUser] = useState(null)
  const [matchConfig, setMatchConfig] = useState(null)
  const [tournamentConfig, setTournamentConfig] = useState(null)
  const [tournamentMatchId, setTournamentMatchId] = useState(null)

  /* ===== AUTO-RESTORE SESSION ===== */
  useEffect(() => {
    // Visa cachad användare direkt — ingen fördröjning vid laddning
    const cached = localStorage.getItem("dart_user")
    if (cached) {
      try { setUser(JSON.parse(cached)) } catch (_) {}
    }

    const token = localStorage.getItem("dart_token")
    if (!token) return

    // Bakgrundsvalidering mot backend
    fetch("http://localhost:8000/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          // Token ogiltig — logga ut ordentligt
          localStorage.removeItem("dart_token")
          localStorage.removeItem("dart_user")
          setUser(null)
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (data) {
          localStorage.setItem("dart_user", JSON.stringify(data.user))
          setUser(data.user)
        }
      })
      .catch(() => {
        // Nätverksfel — backend nere, behåll cachad inloggning
      })
  }, [])

  const navigate = (p, data) => {
    if (p === "tournament-bracket" && data) {
      setTournamentConfig(data)
    }
    if (p === "tournament-match" && data) {
      setTournamentMatchId(data.matchId)
      setMatchConfig(data)
    }
    if (p === "match-game" && data) {
      setMatchConfig(data)
    }
    if (data && !["tournament-bracket", "tournament-match", "match-game"].includes(p)) {
      setMatchConfig(data)
    }
    setPage(p)
  }

  const handleTournamentMatchComplete = (winner, legsWon) => {
    if (tournamentMatchId) {
      setTournamentConfig((prev) => {
        if (!prev) return prev

        const newRounds = prev.bracket.rounds.map((round) =>
          round.map((m) => {
            if (m.id !== tournamentMatchId) return m
            return {
              ...m,
              winner,
              score1: legsWon[0],
              score2: legsWon[1],
            }
          })
        )

        for (let r = 0; r < newRounds.length - 1; r++) {
          newRounds[r].forEach((match, mi) => {
            if (match.winner) {
              const nextMatch = newRounds[r + 1][Math.floor(mi / 2)]
              if (mi % 2 === 0) nextMatch.player1 = match.winner
              else nextMatch.player2 = match.winner
            }
          })
        }

        return {
          ...prev,
          bracket: { ...prev.bracket, rounds: newRounds },
        }
      })
    }
    setTournamentMatchId(null)
    setPage("tournament-bracket")
  }

  if (page === "login") return <LoginPage navigate={navigate} user={user} setUser={setUser} />
  if (page === "profile") return <ProfilePage navigate={navigate} user={user} setUser={setUser} />
  if (page === "heatmap") return <HeatmapPage navigate={navigate} user={user} />
  if (page === "calibrate") return <CalibrationPage navigate={navigate} />
  if (page === "live-scoring") return <LiveScoring navigate={navigate} />
  if (page === "match") return <MatchSetup navigate={navigate} user={user} />
  if (page === "match-game" && matchConfig) return <MatchGame navigate={navigate} matchConfig={matchConfig} user={user} />

  if (page === "tournament-match" && matchConfig) {
    return (
      <MatchGame
        navigate={navigate}
        matchConfig={matchConfig}
        isTournament={true}
        onTournamentMatchComplete={handleTournamentMatchComplete}
        user={user}
      />
    )
  }

  if (page === "tournament") return <TournamentSetup navigate={navigate} user={user} />
  if (page === "tournament-bracket" && tournamentConfig) {
    return (
      <TournamentBracket
        navigate={navigate}
        tournamentConfig={tournamentConfig}
      />
    )
  }

  if (page === "121") return <Game121 navigate={navigate} user={user} />
  if (page === "around-the-clock") return <AroundTheClock navigate={navigate} user={user} />
  return <DartLobby navigate={navigate} user={user} />
}