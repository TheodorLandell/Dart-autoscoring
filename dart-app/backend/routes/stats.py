"""DartVision — Statistik (sparade kast och matcher)"""

import sqlite3
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from .auth import get_current_user, DB_PATH

router = APIRouter(tags=["stats"])


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS throws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            zone TEXT NOT NULL,
            score INTEGER NOT NULL,
            x_mm REAL NOT NULL DEFAULT 0,
            y_mm REAL NOT NULL DEFAULT 0,
            mode TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mode TEXT NOT NULL,
            result_str TEXT NOT NULL,
            won INTEGER NOT NULL DEFAULT 0,
            checkout INTEGER NOT NULL DEFAULT 0,
            darts_in_leg INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    db.commit()
    return db


def _update_user_stats(db, user_id: int):
    """Räkna om och uppdatera användarens statistik från DB."""
    row = db.execute(
        "SELECT COUNT(*) as cnt, SUM(won) as wins FROM matches WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    matches_played = row["cnt"] or 0
    matches_won = int(row["wins"] or 0)

    row2 = db.execute(
        "SELECT AVG(score) as avg FROM throws WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    avg_score = round(row2["avg"] or 0.0, 1)

    row3 = db.execute(
        "SELECT MAX(checkout) as max_co FROM matches WHERE user_id = ? AND checkout > 0",
        (user_id,)
    ).fetchone()
    highest_checkout = int(row3["max_co"] or 0)

    row4 = db.execute(
        "SELECT MIN(darts_in_leg) as min_dil FROM matches WHERE user_id = ? AND darts_in_leg > 0 AND won = 1",
        (user_id,)
    ).fetchone()
    best_leg = int(row4["min_dil"] or 0)

    row5 = db.execute(
        "SELECT mode, COUNT(*) as cnt FROM matches WHERE user_id = ? GROUP BY mode ORDER BY cnt DESC LIMIT 1",
        (user_id,)
    ).fetchone()
    favorite_mode = row5["mode"] if row5 else None

    db.execute("""
        UPDATE users SET
            matches_played = ?,
            matches_won = ?,
            avg_score = ?,
            highest_checkout = ?,
            best_leg = ?,
            favorite_mode = ?
        WHERE id = ?
    """, (matches_played, matches_won, avg_score, highest_checkout, best_leg, favorite_mode, user_id))
    db.commit()


@router.post("/user/match")
async def save_match(request: Request, authorization: str | None = Header(None)):
    """Spara matchresultat och kast för inloggad spelare."""
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    user_id = payload["user_id"]
    body = await request.json()

    mode = str(body.get("mode", ""))
    won = bool(body.get("won", False))
    result_str = str(body.get("result_str", ""))
    checkout = int(body.get("checkout", 0))
    darts_in_leg = int(body.get("darts_in_leg", 0))
    throws = body.get("throws", [])

    db = get_db()
    try:
        db.execute(
            "INSERT INTO matches (user_id, mode, result_str, won, checkout, darts_in_leg) VALUES (?,?,?,?,?,?)",
            (user_id, mode, result_str, 1 if won else 0, checkout, darts_in_leg)
        )
        for t in throws:
            db.execute(
                "INSERT INTO throws (user_id, zone, score, x_mm, y_mm, mode) VALUES (?,?,?,?,?,?)",
                (user_id, str(t.get("zone", "")), int(t.get("score", 0)),
                 float(t.get("x_mm", 0)), float(t.get("y_mm", 0)), mode)
            )
        db.commit()
        _update_user_stats(db, user_id)
        return JSONResponse({"status": "ok"})
    finally:
        db.close()


@router.post("/user/throws")
async def save_throws(request: Request, authorization: str | None = Header(None)):
    """Spara enbart kast utan matchresultat (t.ex. vid avbruten match)."""
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    user_id = payload["user_id"]
    body = await request.json()
    mode = str(body.get("mode", ""))
    throws = body.get("throws", [])

    db = get_db()
    try:
        for t in throws:
            db.execute(
                "INSERT INTO throws (user_id, zone, score, x_mm, y_mm, mode) VALUES (?,?,?,?,?,?)",
                (user_id, str(t.get("zone", "")), int(t.get("score", 0)),
                 float(t.get("x_mm", 0)), float(t.get("y_mm", 0)), mode)
            )
        db.commit()
        return JSONResponse({"status": "ok"})
    finally:
        db.close()


@router.get("/user/matches")
async def get_matches(limit: int = 10, authorization: str | None = Header(None)):
    """Hämta senaste matcher för inloggad spelare."""
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    db = get_db()
    try:
        rows = db.execute(
            "SELECT mode, result_str, won, created_at FROM matches WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (payload["user_id"], limit)
        ).fetchall()
        matches = [
            {
                "id": i,
                "mode": r["mode"],
                "result": "Vinst" if r["won"] else "Förlust",
                "score": r["result_str"],
                "date": r["created_at"][:10],
            }
            for i, r in enumerate(rows)
        ]
        return JSONResponse({"matches": matches})
    finally:
        db.close()


@router.get("/user/heatmap")
async def get_heatmap(mode: str = "all", authorization: str | None = Header(None)):
    """Hämta kastpositioner för heatmap (mode=all|501|301|121|atc)."""
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    db = get_db()
    try:
        if mode == "all":
            rows = db.execute(
                "SELECT x_mm, y_mm, zone FROM throws WHERE user_id = ?",
                (payload["user_id"],)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT x_mm, y_mm, zone FROM throws WHERE user_id = ? AND mode = ?",
                (payload["user_id"], mode)
            ).fetchall()
        darts = [{"x_mm": r["x_mm"], "y_mm": r["y_mm"], "zone": r["zone"]} for r in rows]
        return JSONResponse({"darts": darts})
    finally:
        db.close()


@router.get("/user/stats")
async def get_stats(authorization: str | None = Header(None)):
    """Hämta uppdaterad statistik för inloggad spelare."""
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    from .auth import get_db as auth_get_db, _user_to_dict
    db = auth_get_db()
    try:
        user = db.execute("SELECT * FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
        if not user:
            return JSONResponse({"error": "Användaren finns inte"}, status_code=404)
        return JSONResponse({"user": _user_to_dict(user)})
    finally:
        db.close()
