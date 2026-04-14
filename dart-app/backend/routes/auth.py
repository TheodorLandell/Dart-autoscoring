"""
DartVision — Autentisering (register + login + session)

SQLite-databas, bcrypt-hashade lösenord, JWT-tokens.
Databasen sparas lokalt som 'dartvision.db'.
"""

import os
import sqlite3
import hashlib
import hmac
import json
import time
import secrets
from pathlib import Path

from fastapi import APIRouter, Request, Header
from fastapi.responses import JSONResponse

router = APIRouter(tags=["auth"])

DB_PATH = "dartvision.db"

# JWT-liknande token (enkel HMAC-baserad, ingen extern dependency)
# Generera en persistent secret vid första körningen
SECRET_FILE = ".dartvision_secret"
if Path(SECRET_FILE).exists():
    with open(SECRET_FILE) as f:
        SECRET_KEY = f.read().strip()
else:
    SECRET_KEY = secrets.token_hex(32)
    with open(SECRET_FILE, "w") as f:
        f.write(SECRET_KEY)

TOKEN_EXPIRY = 60 * 60 * 24 * 30  # 30 dagar


# ============================================================
# DATABAS
# ============================================================
def get_db():
    """Hämta en SQLite-anslutning (skapar tabeller vid behov)."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            matches_played INTEGER DEFAULT 0,
            matches_won INTEGER DEFAULT 0,
            highest_checkout INTEGER DEFAULT 0,
            avg_score REAL DEFAULT 0,
            best_leg INTEGER DEFAULT 0,
            favorite_mode TEXT DEFAULT NULL
        )
    """)
    db.commit()
    return db


# ============================================================
# LÖSENORD (bcrypt-liknande med hashlib — inga extra deps)
# ============================================================
def hash_password(password: str) -> str:
    """Hasha lösenord med salt + SHA-256 (PBKDF2)."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, stored: str) -> bool:
    """Verifiera lösenord mot hashat värde."""
    try:
        salt_hex, key_hex = stored.split(":")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(key_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


# ============================================================
# TOKEN
# ============================================================
def create_token(user_id: int, username: str) -> str:
    """Skapa en signerad token (JSON payload + HMAC)."""
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRY,
    }
    payload_json = json.dumps(payload, separators=(",", ":"))
    import base64
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def verify_token(token: str) -> dict | None:
    """Verifiera och dekoda token. Returnerar payload eller None."""
    try:
        import base64
        payload_b64, signature = token.split(".")
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        payload_json = base64.urlsafe_b64decode(payload_b64).decode()
        payload = json.loads(payload_json)
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def get_current_user(authorization: str | None) -> dict | None:
    """Extrahera user från Authorization-header."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    return verify_token(token)


# ============================================================
# ROUTES
# ============================================================
@router.post("/auth/register")
async def register(request: Request):
    """Registrera ny användare.
    Body: { "username": "...", "password": "..." }
    """
    body = await request.json()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    # Validering
    if len(username) < 3:
        return JSONResponse({"error": "Användarnamn måste vara minst 3 tecken"}, status_code=400)
    if len(username) > 20:
        return JSONResponse({"error": "Användarnamn max 20 tecken"}, status_code=400)
    if len(password) < 6:
        return JSONResponse({"error": "Lösenord måste vara minst 6 tecken"}, status_code=400)

    db = get_db()
    try:
        # Kolla om användarnamn redan finns
        existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            return JSONResponse({"error": "Användarnamnet är redan taget"}, status_code=409)

        # Skapa användare
        pw_hash = hash_password(password)
        cursor = db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, pw_hash),
        )
        db.commit()
        user_id = cursor.lastrowid

        # Hämta skapad användare
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        token = create_token(user_id, username)

        return JSONResponse({
            "token": token,
            "user": _user_to_dict(user),
        })
    finally:
        db.close()


@router.post("/auth/login")
async def login(request: Request):
    """Logga in befintlig användare.
    Body: { "username": "...", "password": "..." }
    """
    body = await request.json()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return JSONResponse({"error": "Fyll i användarnamn och lösenord"}, status_code=400)

    db = get_db()
    try:
        user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            return JSONResponse({"error": "Felaktigt användarnamn eller lösenord"}, status_code=401)

        if not verify_password(password, user["password_hash"]):
            return JSONResponse({"error": "Felaktigt användarnamn eller lösenord"}, status_code=401)

        token = create_token(user["id"], user["username"])

        return JSONResponse({
            "token": token,
            "user": _user_to_dict(user),
        })
    finally:
        db.close()


@router.get("/auth/me")
async def get_me(authorization: str | None = Header(None)):
    """Hämta inloggad användare via token.
    Header: Authorization: Bearer <token>
    """
    payload = get_current_user(authorization)
    if not payload:
        return JSONResponse({"error": "Ej inloggad"}, status_code=401)

    db = get_db()
    try:
        user = db.execute("SELECT * FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
        if not user:
            return JSONResponse({"error": "Användaren finns inte"}, status_code=404)

        return JSONResponse({"user": _user_to_dict(user)})
    finally:
        db.close()


@router.post("/auth/logout")
async def logout():
    """Logout — klienten tar bort sin token. Inget server-state att rensa."""
    return JSONResponse({"status": "ok"})


# ============================================================
# HELPERS
# ============================================================
def _user_to_dict(row) -> dict:
    """Konvertera SQLite Row → dict för JSON-response."""
    matches_played = row["matches_played"] or 0
    matches_won = row["matches_won"] or 0
    win_pct = round((matches_won / matches_played) * 100) if matches_played > 0 else 0

    return {
        "id": row["id"],
        "username": row["username"],
        "created_at": row["created_at"],
        "stats": {
            "matches_played": matches_played,
            "win_pct": win_pct,
            "highest_checkout": row["highest_checkout"] or 0,
            "avg_score": round(row["avg_score"] or 0, 1),
            "best_leg": row["best_leg"] or 0,
            "favorite_mode": row["favorite_mode"],
        },
    }
