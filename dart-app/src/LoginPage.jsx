import { useState } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  LOGIN / REGISTER — Separat sida (bara autentisering)      │
  │                                                             │
  │  Nås via login-knappen i lobbyn NÄR EJ INLOGGAD.          │
  │  Efter lyckad login/register → navigera till profilsidan.  │
  │                                                             │
  │  LOGIN:  POST /api/auth/login  { username, password }      │
  │  REGISTER: POST /api/auth/register { username, password }  │
  │  Response: { token, user: { id, username, created_at } }   │
  │                                                             │
  │  Validering:                                                │
  │  - Användarnamn: 3-20 tecken, unikt                        │
  │  - Lösenord: minst 6 tecken                                │
  │  - Bekräfta lösenord måste matcha (register)               │
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

function InputField({ label, type = "text", value, onChange, placeholder, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          caretColor: "#EF4444",
        }}
        onFocus={(e) => {
          if (!error) e.target.style.borderColor = "rgba(239,68,68,0.4)";
          e.target.style.background = "rgba(255,255,255,0.06)";
        }}
        onBlur={(e) => {
          if (!error) e.target.style.borderColor = "rgba(255,255,255,0.08)";
          e.target.style.background = "rgba(255,255,255,0.04)";
        }}
      />
      {error && <span className="text-xs" style={{ color: "#EF4444" }}>{error}</span>}
    </div>
  );
}

export default function LoginPage({ navigate, user: _user, setUser }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const validate = () => {
    const errs = {};
    if (!username.trim()) errs.username = "Ange ett användarnamn";
    else if (username.length < 3) errs.username = "Minst 3 tecken";
    else if (username.length > 20) errs.username = "Max 20 tecken";
    if (!password) errs.password = "Ange ett lösenord";
    else if (password.length < 6) errs.password = "Minst 6 tecken";
    if (mode === "register") {
      if (!confirmPassword) errs.confirm = "Bekräfta lösenordet";
      else if (password !== confirmPassword) errs.confirm = "Lösenorden matchar inte";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(`http://localhost:8000/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      let data;
      try {
        data = await res.json();
      } catch (_e) {
        setErrors({ general: "Servern returnerade ett ogiltigt svar" });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrors({ general: data.error || "Något gick fel" });
        setLoading(false);
        return;
      }

      localStorage.setItem("dart_token", data.token);
      setUser(data.user);
      setLoading(false);
      navigate("profile");
    } catch (err) {
      setErrors({ general: "Kan inte ansluta till servern" });
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
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
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(239,68,68,0.04) 0%, transparent 70%)" }}
      />

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

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DartIcon className="text-red-500 opacity-50" size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.25)" }}>
              DartVision
            </span>
            <DartIcon className="text-red-500 opacity-50" size={18} />
          </div>
          <h1 className="text-3xl font-extrabold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {isLogin ? "Välkommen tillbaka" : "Skapa konto"}
          </h1>
        </div>

        {/* Form */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: "rgba(15,15,22,0.8)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Mode toggle */}
          <div className="flex mb-6 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); setConfirmPassword(""); }}
                className="flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200"
                style={{
                  color: mode === m ? "#fff" : "rgba(255,255,255,0.25)",
                  background: mode === m ? "rgba(239,68,68,0.15)" : "transparent",
                  borderBottom: mode === m ? "2px solid #EF4444" : "2px solid transparent",
                }}
              >
                {m === "login" ? "Logga in" : "Skapa konto"}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-4">
            <InputField label="Användarnamn" value={username} onChange={setUsername} placeholder="Ditt användarnamn" error={errors.username} />
            <InputField label="Lösenord" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={errors.password} />
            {!isLogin && (
              <InputField label="Bekräfta lösenord" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" error={errors.confirm} />
            )}
          </div>

          {/* General error */}
          {errors.general && (
            <div className="mt-4 px-4 py-3 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <span className="text-xs font-semibold" style={{ color: "#EF4444" }}>{errors.general}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-6 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: loading ? "rgba(239,68,68,0.3)" : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
              color: "#fff",
              boxShadow: loading ? "none" : "0 4px 20px rgba(239,68,68,0.25)",
              cursor: loading ? "wait" : "pointer",
            }}
            onMouseEnter={(e) => { if (!loading) { e.target.style.boxShadow = "0 4px 30px rgba(239,68,68,0.4)"; e.target.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={(e) => { if (!loading) { e.target.style.boxShadow = "0 4px 20px rgba(239,68,68,0.25)"; e.target.style.transform = "translateY(0)"; }}}
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "spin 0.7s linear infinite" }} />
            ) : (
              isLogin ? "Logga in" : "Skapa konto"
            )}
          </button>

          {/* Switch mode */}
          <p className="text-center mt-5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {isLogin ? "Har du inget konto?" : "Har du redan ett konto?"}{" "}
            <button onClick={() => { setMode(isLogin ? "register" : "login"); setErrors({}); setConfirmPassword(""); }}
              className="font-semibold transition-colors duration-200" style={{ color: "#EF4444" }}
              onMouseEnter={(e) => e.target.style.color = "#F87171"}
              onMouseLeave={(e) => e.target.style.color = "#EF4444"}
            >
              {isLogin ? "Skapa konto" : "Logga in"}
            </button>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}