import React, { useState, useEffect, useCallback } from "react";
import { Home, CheckSquare, Music2, User, Search, Bell, Play, LogOut,
  ChevronLeft, Star, Mail, Lock, Eye, EyeOff, Clock, MapPin, AlertCircle, UserPlus } from "lucide-react";
import logoImg from "./assets/logo.jpg";
import photoImg from "./assets/chorale-photo.jpg";
import { supabase } from "./supabaseClient";

/* ---------- Design tokens: red / purple / lilac interface ---------- */
const C = {
  garnet: "#7A1F3D",
  garnetDark: "#3E1020",
  plum: "#5B2A6B",
  lilac: "#C9AED8",
  lilacSoft: "#F3ECF6",
  lilacLine: "#E4D3EC",
  ink: "#251A2C",
  inkSoft: "#726A79",
  card: "#FFFFFF",
  parchment: "#FBF8FC",
  sage: "#4F7A5C",
  sageBg: "#E7F1E9",
  roseDeep: "#9C3B55",
  roseBg: "#FBEAEF",
  amberBg: "#F6EFD8",
  amberText: "#8A6C24",
};

const GRADIENT = `linear-gradient(135deg, ${C.garnet} 0%, ${C.plum} 62%, #8C5FA0 100%)`;
const VOICE_PARTS = ["Soprano I", "Soprano II", "Alto I", "Alto II", "Tenor I", "Tenor II", "Bass I", "Bass II"];

/* ---------- Clock-in window: Sundays 2:00 PM - 3:30 PM, Africa/Lagos time (UTC+1, no DST) ---------- */
function isClockInWindowOpen() {
  const now = new Date();
  const watMillis = now.getTime() + now.getTimezoneOffset() * 60000 + 60 * 60000;
  const wat = new Date(watMillis);
  const day = wat.getDay(); // 0 = Sunday
  const totalMinutes = wat.getHours() * 60 + wat.getMinutes();
  return day === 0 && totalMinutes >= 14 * 60 && totalMinutes <= 15 * 60 + 30;
}

function formatClockTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  } catch (e) {
    return null;
  }
}

/* ---------- Local persistence (favorites only — this device) ---------- */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable */ }
  },
};

const seedLibrary = [
  { id: 1, title: "Ave Verum Corpus", composer: "W. A. Mozart", tag: "SATB", part: "All" },
  { id: 2, title: "Ubi Caritas", composer: "Maurice Duruflé", tag: "SATB", part: "All" },
  { id: 3, title: "Betelehemu", composer: "Wendell Whalum, arr.", tag: "Divisi", part: "All" },
  { id: 4, title: "The Lord Bless You and Keep You", composer: "John Rutter", tag: "SATB", part: "All" },
  { id: 5, title: "Zikr", composer: "Trad., arr. Nwosu", tag: "SSA", part: "Soprano" },
  { id: 6, title: "Set Me as a Seal", composer: "René Clausen", tag: "SATB", part: "All" },
  { id: 7, title: "Total Praise", composer: "Richard Smallwood", tag: "SATB", part: "All" },
  { id: 8, title: "Danny Boy", composer: "Trad., arr. Tenor Sect.", tag: "TTBB", part: "Tenor" },
];

const announcements = [
  { id: 1, title: "Sectional rehearsal added for Altos", time: "Posted 2 hours ago" },
  { id: 2, title: 'New score: "Ave Verum Corpus" uploaded', time: "Posted yesterday" },
  { id: 3, title: "Uniform fitting this Saturday, 10 AM", time: "Posted 2 days ago" },
];

/* ---------- Small building blocks ---------- */
function Badge() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
      border: `2px solid ${C.lilac}`, boxShadow: "0 4px 14px rgba(90,30,60,0.25)",
      flexShrink: 0, background: "#fff",
    }}>
      <img src={logoImg} alt="De Voci Belli Chorale" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function Staff({ light }) {
  const fade = "linear-gradient(to right, transparent, black 12%, black 88%, transparent)";
  return (
    <div style={{
      height: 18,
      backgroundImage: `repeating-linear-gradient(to bottom, ${light ? C.lilac : C.garnet} 0px, ${light ? C.lilac : C.garnet} 1px, transparent 1px, transparent 4.2px)`,
      opacity: light ? 0.9 : 0.55,
      WebkitMaskImage: fade, maskImage: fade,
    }} />
  );
}

function Pill({ children, tone = "gold" }) {
  const map = {
    present: { bg: C.sageBg, color: C.sage },
    absent: { bg: C.roseBg, color: C.roseDeep },
    excused: { bg: C.amberBg, color: C.amberText },
    gold: { bg: C.lilacSoft, color: C.plum },
  };
  const s = map[tone] || map.gold;
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      padding: "6px 12px", borderRadius: 999, letterSpacing: 0.3,
      textTransform: "capitalize", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick} className="dvbc-tap"
      style={{
        padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
        border: `1px solid ${active ? C.garnet : C.lilacLine}`,
        background: active ? GRADIENT : "#fff",
        color: active ? "#fff" : C.inkSoft,
        whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Screens ---------- */
function LoginScreen({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [name, setName] = useState("");
  const [part, setPart] = useState(VOICE_PARTS[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) {
      setError("Please fill in every field to continue.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        const userId = data.user?.id;
        if (userId) {
          const { error: insertError } = await supabase
            .from("members")
            .insert({ user_id: userId, name: name.trim(), part, status: "present" });
          if (insertError) throw insertError;
        }
        if (!data.session) {
          setError("Account created — you can sign in now.");
          setMode("signin");
          setBusy(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      onAuthed();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ background: GRADIENT, padding: "calc(env(safe-area-inset-top, 0px) + 40px) 32px 30px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <img src={logoImg} alt="logo" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "Lora, serif", fontSize: 24, fontWeight: 600 }}>
          De Voci Belli <span style={{ fontStyle: "italic", color: C.lilac }}>Chorale</span>
        </div>
        <div style={{ color: C.lilac, fontSize: 11, letterSpacing: 4, fontWeight: 700, marginTop: 3 }}>NIGERIA</div>
        <div style={{ margin: "18px 30px 0" }}><Staff light /></div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, letterSpacing: 2, fontWeight: 600, marginTop: 14 }}>
          MEMBERS PORTAL
        </div>
      </div>

      <div style={{ flex: 1, background: C.parchment, borderRadius: "26px 26px 0 0", marginTop: -18, padding: "30px 26px calc(env(safe-area-inset-bottom, 0px) + 30px)" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 22, color: C.ink, marginBottom: 6 }}>
          {mode === "signin" ? "Welcome back" : "Join the chorale"}
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {mode === "signin"
            ? "Sign in to view rehearsals, mark attendance, and reach your music library."
            : "Register once — your name and voice part will appear on the shared attendance sheet."}
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>Full Name</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "12px 14px", margin: "6px 0 16px" }}>
                <UserPlus size={16} color={C.inkSoft} />
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent", color: C.ink }}
                />
              </div>

              <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>Voice Part</label>
              <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px", margin: "6px 0 16px" }}>
                <select
                  value={part} onChange={(e) => setPart(e.target.value)}
                  style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                >
                  {VOICE_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </>
          )}

          <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>Email</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "12px 14px", margin: "6px 0 16px" }}>
            <Mail size={16} color={C.inkSoft} />
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@devocibelli.org" type="email"
              style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent", color: C.ink }}
            />
          </div>

          <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>Password</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "12px 14px", margin: "6px 0 8px" }}>
            <Lock size={16} color={C.inkSoft} />
            <input
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••" type={showPw ? "text" : "password"}
              style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent", color: C.ink }}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
              {showPw ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
            </button>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 12, margin: "6px 0" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit" disabled={busy} className="dvbc-tap"
            style={{
              width: "100%", background: GRADIENT, color: "#fff", fontWeight: 600, fontSize: 15,
              padding: 16, borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.8 : 1, marginTop: mode === "signin" ? 20 : 4,
            }}
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "#BBAEC4", margin: "18px 0", letterSpacing: 1 }}>— OR —</div>
        <button
          onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setError(""); }}
          className="dvbc-tap"
          style={{ width: "100%", textAlign: "center", fontSize: 11.5, color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }}
        >
          {mode === "signin"
            ? <>New member? <span style={{ color: C.garnet, fontWeight: 700 }}>Register here</span></>
            : <>Already registered? <span style={{ color: C.garnet, fontWeight: 700 }}>Sign in</span></>}
        </button>
      </div>
    </div>
  );
}

function PendingApproval({ profile, onLogout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ background: GRADIENT, padding: "calc(env(safe-area-inset-top, 0px) + 40px) 32px 30px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <img src={logoImg} alt="logo" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "Lora, serif", fontSize: 24, fontWeight: 600 }}>
          De Voci Belli <span style={{ fontStyle: "italic", color: C.lilac }}>Chorale</span>
        </div>
        <div style={{ color: C.lilac, fontSize: 11, letterSpacing: 4, fontWeight: 700, marginTop: 3 }}>NIGERIA</div>
      </div>

      <div style={{ flex: 1, background: C.parchment, borderRadius: "26px 26px 0 0", marginTop: -18, padding: "40px 26px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Clock size={26} color={C.amberText} />
        </div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.ink, marginBottom: 8 }}>
          Awaiting Approval
        </div>
        <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, maxWidth: 280 }}>
          Hi {profile?.name ? profile.name.split(" ")[0] : "there"}! Your registration has been received.
          A section leader needs to approve your account before you can access the members portal.
        </div>
        <button
          onClick={onLogout} className="dvbc-tap"
          style={{
            marginTop: 32, background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 13.5,
            padding: "13px 28px", borderRadius: 14, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
}

function TopHeader({ title, subtitle }) {
  return (
    <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0" }}>
      <div style={{ fontFamily: "Lora, serif", fontSize: 23, color: C.ink }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>{subtitle}</div>}
      <div style={{ marginTop: 14 }}><Staff /></div>
    </div>
  );
}

function Dashboard({ profile, members, onNav }) {
  const total = members.length;
  const present = members.filter((m) => m.status === "present").length;
  const pct = total ? Math.round((present / total) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  const displayName = profile?.name ? profile.name.split(" ")[0] : "Member";

  const now = new Date();
  let daysUntilRehearsal = (7 - now.getDay()) % 7;
  if (daysUntilRehearsal === 0) {
    const rehearsalTime = new Date(now);
    rehearsalTime.setHours(14, 30, 0, 0);
    if (now > rehearsalTime) daysUntilRehearsal = 7;
  }
  const rehearsalLabel =
    daysUntilRehearsal === 0 ? "Today" :
    daysUntilRehearsal === 1 ? "Tomorrow" :
    `in ${daysUntilRehearsal} days`;

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>{greeting}</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 23, color: C.ink, marginTop: 2 }}>{displayName}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.lilacSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={16} color={C.plum} />
          </div>
          <Badge />
        </div>
      </div>
      <div style={{ padding: "14px 24px 0" }}><Staff /></div>

      <div style={{ padding: "18px 24px" }}>
        <div style={{ borderRadius: 20, overflow: "hidden", position: "relative", boxShadow: "0 10px 26px rgba(90,30,60,0.18)" }}>
          <img src={photoImg} alt="De Voci Belli Chorale members" style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(62,16,32,0.88) 0%, rgba(62,16,32,0.15) 55%, rgba(62,16,32,0) 100%)" }} />
          <div style={{ position: "absolute", left: 18, right: 18, bottom: 16, color: "#fff" }}>
            <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Our Chorale</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, marginTop: 3 }}>Beautiful voices, one family</div>
          </div>
        </div>

        <div style={{ background: GRADIENT, borderRadius: 20, padding: 20, marginTop: 16, color: "#fff", position: "relative" }}>
          <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.16)", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 999 }}>
            {rehearsalLabel}
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Next Rehearsal</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} /> Sunday, 2:30 PM
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={13} /> St. Peter's Anglican Church, Ikenegbu, Owerri
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={() => onNav("attendance")} className="dvbc-tap" style={{ flex: 1, textAlign: "left", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 21, color: C.garnet }}>{pct}%</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Attendance</div>
          </button>
          <button onClick={() => onNav("library")} className="dvbc-tap" style={{ flex: 1, textAlign: "left", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 21, color: C.garnet }}>6/8</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Pieces Ready</div>
          </button>
        </div>

        <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink, margin: "22px 0 10px" }}>Announcements</div>
        {announcements.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.lilacLine}`, alignItems: "flex-start" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.plum, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{a.title}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Attendance({ members, loading, onCycle, isAdmin, profile, onClockIn, clockingIn, clockInError }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];
  const [windowOpen, setWindowOpen] = useState(isClockInWindowOpen());

  useEffect(() => {
    const id = setInterval(() => setWindowOpen(isClockInWindowOpen()), 30000);
    return () => clearInterval(id);
  }, []);

  const myMember = members.find((m) => m.user_id === profile?.user_id);
  const alreadyClockedIn = !!myMember?.clocked_in_at && myMember?.status === "present";

  const present = members.filter((m) => m.status === "present").length;
  const absent = members.filter((m) => m.status === "absent").length;
  const excused = members.filter((m) => m.status === "excused").length;

  const filtered = members.filter((m) => {
    const matchesPart = filter === "All" || m.part.startsWith(filter);
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchesPart && matchesSearch;
  });

  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader
        title="Attendance"
        subtitle={isAdmin ? "Shared live sheet · Tap a member to change status" : "Shared live sheet · Updated by section leaders"}
      />

      {!isAdmin && (
        <div style={{ margin: "18px 24px 0", background: alreadyClockedIn ? C.sageBg : C.card, border: `1.4px solid ${alreadyClockedIn ? C.sage : C.lilacLine}`, borderRadius: 18, padding: 18 }}>
          {alreadyClockedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckSquare size={17} color={C.sage} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.sage }}>You're clocked in</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>Arrived at {formatClockTime(myMember.clocked_in_at)}</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Rehearsal Clock-In</div>
              <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
                {windowOpen
                  ? "Tap below to mark your arrival for today's rehearsal."
                  : "Opens Sundays 2:00 PM – 3:30 PM, around rehearsal time."}
              </div>
              {clockInError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 10 }}>
                  <AlertCircle size={13} /> {clockInError}
                </div>
              )}
              <button
                onClick={onClockIn} disabled={!windowOpen || clockingIn} className="dvbc-tap"
                style={{
                  width: "100%", background: windowOpen ? GRADIENT : C.lilacSoft, color: windowOpen ? "#fff" : "#B8ADC0",
                  fontWeight: 700, fontSize: 13.5, padding: 13, borderRadius: 12, border: "none",
                  cursor: windowOpen && !clockingIn ? "pointer" : "default",
                }}
              >
                {clockingIn ? "Clocking in…" : "Clock In"}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, padding: "16px 24px 0" }}>
        <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.sage }}>{present}</div>
          <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Present</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.roseDeep }}>{absent}</div>
          <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Absent</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.amberText }}>{excused}</div>
          <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Excused</div>
        </div>
      </div>

      <div style={{ margin: "16px 24px 0", display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 12, padding: "11px 14px" }}>
        <Search size={15} color={C.inkSoft} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
          style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: C.ink }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 24px 4px", overflowX: "auto" }}>
        {parts.map((p) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Chip>
        ))}
      </div>

      <div style={{ padding: "6px 24px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>Loading members…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>No members match.</div>
        )}
        {filtered.map((m) => {
          const row = (
            <>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Lora, serif", fontWeight: 600, fontSize: 13,
              }}>
                {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{m.part}</div>
                {m.clocked_in_at && (
                  <div style={{ fontSize: 10, color: C.sage, marginTop: 2 }}>Clocked in {formatClockTime(m.clocked_in_at)}</div>
                )}
              </div>
              <Pill tone={m.status}>{m.status}</Pill>
            </>
          );

          if (isAdmin) {
            return (
              <button
                key={m.id} onClick={() => onCycle(m)} className="dvbc-row"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", background: "none", border: "none", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer", textAlign: "left" }}
              >
                {row}
              </button>
            );
          }

          return (
            <div
              key={m.id}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}
            >
              {row}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", fontSize: 10.5, color: C.inkSoft, opacity: 0.7, padding: "14px 0 0" }}>
        {isAdmin ? "Shared with every chorister, live" : "Only section leaders can update attendance"}
      </div>
    </div>
  );
}

function Library({ favorites, toggleFavorite }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];

  const filtered = seedLibrary.filter((p) => {
    const matchesPart = filter === "All" || p.part === "All" || p.part === filter;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.composer.toLowerCase().includes(search.toLowerCase());
    return matchesPart && matchesSearch;
  });

  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader title="Music Library" subtitle={`${seedLibrary.length} pieces · 3 concerts`} />

      <div style={{ margin: "16px 24px 0", display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 12, padding: "11px 14px" }}>
        <Search size={15} color={C.inkSoft} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or composer…"
          style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: C.ink }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 24px 4px", overflowX: "auto" }}>
        {parts.map((p) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Chip>
        ))}
      </div>

      <div style={{ padding: "8px 24px 0" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>No pieces match.</div>
        )}
        {filtered.map((p) => {
          const fav = favorites.includes(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
              <button onClick={() => toggleFavorite(p.id)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, display: "flex" }}>
                <Star size={18} color={fav ? C.garnet : C.lilacLine} fill={fav ? C.garnet : "none"} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{p.composer}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Pill>{p.tag}</Pill>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={12} color="#fff" fill="#fff" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Profile({ profile, members, onLogout, isAdmin, onApprove }) {
  const present = members.filter((m) => m.status === "present").length;
  const displayName = profile?.name || "Member";
  const pending = members.filter((m) => !m.approved);

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ background: GRADIENT, padding: "calc(env(safe-area-inset-top, 0px) + 26px) 24px 34px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", background: "#fff", margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Lora, serif", fontStyle: "italic", fontWeight: 600, fontSize: 24, color: C.garnet,
            border: `3px solid ${C.lilac}`,
          }}>
            {displayName.charAt(0)}
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "Lora, serif", fontSize: 20 }}>{displayName}</div>
        <div style={{ color: C.lilac, fontSize: 12, marginTop: 2 }}>
          {profile?.part || ""}{profile?.is_admin ? " · Admin" : ""}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.garnet }}>{members.length}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Registered members</div>
          </div>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.garnet }}>{present}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Present today</div>
          </div>
        </div>

        <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink, margin: "24px 0 10px" }}>Settings</div>
        {["Notifications", "Privacy", "Section leaders", "About De Voci Belli Chorale"].map((label) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink }}>
            {label}
            <ChevronLeft size={16} color={C.inkSoft} style={{ transform: "rotate(180deg)" }} />
          </div>
        ))}

        {isAdmin && (
          <>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink, margin: "24px 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
              Pending Approvals
              {pending.length > 0 && (
                <span style={{ background: C.roseBg, color: C.roseDeep, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{pending.length}</span>
              )}
            </div>
            {pending.length === 0 && (
              <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "6px 0 4px" }}>No members waiting for approval.</div>
            )}
            {pending.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Lora, serif", fontWeight: 600, fontSize: 12,
                }}>
                  {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{m.name}</div>
                  <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 }}>{m.part}</div>
                </div>
                <button
                  onClick={() => onApprove(m.id)} className="dvbc-tap"
                  style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0 }}
                >
                  Approve
                </button>
              </div>
            ))}
          </>
        )}

        <button
          onClick={onLogout} className="dvbc-tap"
          style={{
            marginTop: 26, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 13.5,
            padding: 14, borderRadius: 14, border: "none", cursor: "pointer",
          }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
}

function BottomNav({ screen, onNav }) {
  const items = [
    { key: "dashboard", label: "Home", icon: Home },
    { key: "attendance", label: "Attendance", icon: CheckSquare },
    { key: "library", label: "Library", icon: Music2 },
    { key: "profile", label: "Profile", icon: User },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      paddingTop: 10, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
    }}>
      {items.map(({ key, label, icon: Icon }) => {
        const active = screen === key;
        return (
          <button
            key={key} onClick={() => onNav(key)} className="dvbc-tap"
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: active ? GRADIENT : "transparent",
            }}>
              <Icon size={16} color={active ? "#fff" : "#B8ADC0"} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: active ? C.garnet : "#B8ADC0" }}>{label}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Root app ---------- */
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [profile, setProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [favorites, setFavorites] = useState(() => store.get("dvbc-favorites", []));
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInError, setClockInError] = useState("");

  useEffect(() => { store.set("dvbc-favorites", favorites); }, [favorites]);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setScreen("dashboard");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load this user's own member profile once signed in
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase
      .from("members")
      .select("*")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

  // Load + live-subscribe to the shared members list
  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingMembers(true);
    supabase.from("members").select("*").order("name").then(({ data }) => {
      if (active) { setMembers(data || []); setLoadingMembers(false); }
    });

    const channel = supabase
      .channel("members-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, (payload) => {
        setMembers((prev) => {
          if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name));
          if (payload.eventType === "UPDATE") return prev.map((m) => (m.id === payload.new.id ? payload.new : m));
          if (payload.eventType === "DELETE") return prev.filter((m) => m.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [session]);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const isAdmin = !!profile?.is_admin;

  const cycleStatus = useCallback(async (member) => {
    if (!isAdmin) return; // guard: only admins may change status
    const order = ["present", "absent", "excused"];
    const next = order[(order.indexOf(member.status) + 1) % order.length];
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
    const { error } = await supabase.from("members").update({ status: next }).eq("id", member.id);
    if (error) {
      // revert on failure (e.g. RLS/trigger rejected it)
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: member.status } : m)));
    }
  }, [isAdmin]);

  const handleClockIn = useCallback(async () => {
    setClockInError("");
    setClockingIn(true);
    const { error } = await supabase.rpc("clock_in");
    if (error) setClockInError(error.message || "Could not clock in. Please try again.");
    setClockingIn(false);
  }, []);

  const approveMember = useCallback(async (memberId) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, approved: true } : m)));
    const { error } = await supabase.from("members").update({ approved: true }).eq("id", memberId);
    if (error) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, approved: false } : m)));
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100dvh", background: C.parchment, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.inkSoft, fontFamily: "Poppins, sans-serif", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: C.parchment, fontFamily: "Poppins, sans-serif", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500;1,600&family=Poppins:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body, #root { min-height: 100%; background: ${C.parchment}; }
        input::placeholder { color: #BBAEC4; }
        button { user-select: none; }
        .dvbc-tap { transition: transform .12s ease, opacity .12s ease, background .15s ease; }
        .dvbc-tap:active { transform: scale(0.96); opacity: 0.88; }
        .dvbc-row:active { background: rgba(122,31,61,0.05); }
      `}</style>

      {!session && <LoginScreen onAuthed={() => setScreen("dashboard")} />}
      {session && profile && !profile.approved && !isAdmin && (
        <PendingApproval profile={profile} onLogout={handleLogout} />
      )}
      {session && profile && (profile.approved || isAdmin) && screen === "dashboard" && (
        <Dashboard profile={profile} members={members} onNav={setScreen} />
      )}
      {session && profile && (profile.approved || isAdmin) && screen === "attendance" && (
        <Attendance
          members={members} loading={loadingMembers} onCycle={cycleStatus} isAdmin={isAdmin}
          profile={profile} onClockIn={handleClockIn} clockingIn={clockingIn} clockInError={clockInError}
        />
      )}
      {session && profile && (profile.approved || isAdmin) && screen === "library" && (
        <Library favorites={favorites} toggleFavorite={toggleFavorite} />
      )}
      {session && profile && (profile.approved || isAdmin) && screen === "profile" && (
        <Profile profile={profile} members={members} onLogout={handleLogout} isAdmin={isAdmin} onApprove={approveMember} />
      )}
      {session && profile && (profile.approved || isAdmin) && <BottomNav screen={screen} onNav={setScreen} />}
    </div>
  );
}
