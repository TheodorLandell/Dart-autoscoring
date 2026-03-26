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

export default function App() {
  const [page, setPage] = useState("lobby")
  const [user, setUser] = useState(null)
  const [matchConfig, setMatchConfig] = useState(null)

  const navigate = (p, data) => {
    if (data) setMatchConfig(data)
    setPage(p)
  }

  if (page === "login") return <LoginPage navigate={navigate} user={user} setUser={setUser} />
  if (page === "profile") return <ProfilePage navigate={navigate} user={user} setUser={setUser} />
  if (page === "heatmap") return <HeatmapPage navigate={navigate} />
  if (page === "calibrate") return <CalibrationPage navigate={navigate} />
  if (page === "match") return <MatchSetup navigate={navigate} user={user} />
  if (page === "match-game" && matchConfig) return <MatchGame navigate={navigate} matchConfig={matchConfig} />
  if (page === "121") return <Game121 navigate={navigate} />
  if (page === "around-the-clock") return <AroundTheClock navigate={navigate} />
  return <DartLobby navigate={navigate} user={user} />
}