import { useState } from "react"
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
  if (page === "heatmap") return <HeatmapPage navigate={navigate} />
  if (page === "calibrate") return <CalibrationPage navigate={navigate} />
  if (page === "live") return <LiveScoring navigate={navigate} />
  if (page === "match") return <MatchSetup navigate={navigate} user={user} />
  if (page === "match-game" && matchConfig) return <MatchGame navigate={navigate} matchConfig={matchConfig} />

  if (page === "tournament-match" && matchConfig) {
    return (
      <MatchGame
        navigate={navigate}
        matchConfig={matchConfig}
        isTournament={true}
        onTournamentMatchComplete={handleTournamentMatchComplete}
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

  if (page === "121") return <Game121 navigate={navigate} />
  if (page === "around-the-clock") return <AroundTheClock navigate={navigate} />
  return <DartLobby navigate={navigate} user={user} />
}
