import React, { useState, useEffect, useCallback } from "react";
import { Home, CheckSquare, Music2, User, Search, Bell, Play, LogOut,
  ChevronLeft, Star, Mail, Lock, Eye, EyeOff, Clock, MapPin, AlertCircle } from "lucide-react";
import logoImg from "./assets/logo.jpg";
import photoImg from "./assets/chorale-photo.jpg";

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

/* ---------- Local persistence (this device only) ---------- */
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
    } catch (e) { /* storage unavailable (private mode, full disk, etc.) */ }
  },
};

/* ---------- Seed data ---------- */
const seedMembers = [
  { id: 1, name: "Chidinma Nwosu", part: "Soprano I", status: "present" },
  { id: 2, name: "Tomiwa Adisa", part: "Alto II", status: "present" },
  { id: 3, name: "Emeka Okoro", part: "Tenor I", status: "absent" },
  { id: 4, name: "Femi Balogun", part: "Bass II", status: "present" },
  { id: 5, name: "Ngozi Kalu", part: "Soprano II", status: "present" },
  { id: 6, name: "Uche Eze", part: "Alto I", status: "excused" },
  { id: 7, name: "Kelechi Obi", part: "Tenor II", status: "present" },
  { id: 8, name: "Ifeanyi Aguocha", part: "Bass I", status: "present" },
  { id: 9, name: "Bisi Adeyemi", part: "Soprano I", status: "absent" },
  { id: 10, name: "Damilola Kuti", part: "Alto II", status: "present" },
];

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
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password to continue.");
      return;
    }
    setError("");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onLogin(email);
    }, 650);
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
        <div style={{ fontFamily: "Lora, serif", fontSize: 22, color: C.ink, marginBottom: 6 }}>Welcome back</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          Sign in to view rehearsals, mark attendance, and reach your music library.
        </div>

        <form onSubmit={submit}>
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

          <div style={{ textAlign: "right", fontSize: 11.5, color: C.plum, fontWeight: 600, margin: "6px 0 20px" }}>Forgot password?</div>

          <button
            type="submit" disabled={busy} className="dvbc-tap"
            style={{
              width: "100%", background: GRADIENT, color: "#fff", fontWeight: 600, fontSize: 15,
              padding: 16, borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.8 : 1,
            }}
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "#BBAEC4", margin: "18px 0", letterSpacing: 1 }}>— OR —</div>
        <div style={{ textAlign: "center", fontSize: 11.5, color: C.inkSoft }}>
          New member? <span style={{ color: C.garnet, fontWeight: 700 }}>Contact your section leader</span>
        </div>
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

function Dashboard({ user, members, onNav }) {
  const total = members.length;
  const present = members.filter((m) => m.status === "present").length;
  const pct = total ? Math.round((present / total) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  const firstName = (user || "Member").split("@")[0].split(/[.\s]/)[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

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
            in 2 days
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Next Rehearsal</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} /> Thursday, 7:30 PM
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={13} /> St. Augustine Hall · Full Chorale
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

function Attendance({ members, setMembers }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];

  const cycle = (id) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const order = ["present", "absent", "excused"];
        const next = order[(order.indexOf(m.status) + 1) % order.length];
        return { ...m, status: next };
      })
    );
  };

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
      <TopHeader title="Attendance" subtitle="Sunday Rehearsal · Tap a member to change status" />

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
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>No members match.</div>
        )}
        {filtered.map((m) => (
          <button
            key={m.id} onClick={() => cycle(m.id)} className="dvbc-row"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", background: "none", border: "none", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer", textAlign: "left" }}
          >
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
            </div>
            <Pill tone={m.status}>{m.status}</Pill>
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 10.5, color: C.inkSoft, opacity: 0.7, padding: "14px 0 0" }}>
        Saved on this device
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

function Profile({ user, members, onLogout }) {
  const present = members.filter((m) => m.status === "present").length;
  const firstName = (user || "Member").split("@")[0].split(/[.\s]/)[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

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
        <div style={{ color: C.lilac, fontSize: 12, marginTop: 2 }}>{user}</div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.garnet }}>{present}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Rehearsals this term</div>
          </div>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.garnet }}>Alto II</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Voice part</div>
          </div>
        </div>

        <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink, margin: "24px 0 10px" }}>Settings</div>
        {["Notifications", "Privacy", "Section leaders", "About De Voci Belli Chorale"].map((label) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink }}>
            {label}
            <ChevronLeft size={16} color={C.inkSoft} style={{ transform: "rotate(180deg)" }} />
          </div>
        ))}

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
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState(() => store.get("dvbc-attendance", seedMembers));
  const [favorites, setFavorites] = useState(() => store.get("dvbc-favorites", []));

  useEffect(() => { store.set("dvbc-attendance", members); }, [members]);
  useEffect(() => { store.set("dvbc-favorites", favorites); }, [favorites]);

  useEffect(() => {
    const savedUser = store.get("dvbc-user", null);
    if (savedUser) { setUser(savedUser); setScreen("dashboard"); }
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleLogin = (email) => {
    setUser(email);
    store.set("dvbc-user", email);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    store.set("dvbc-user", null);
    setScreen("login");
  };

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

      {screen === "login" && <LoginScreen onLogin={handleLogin} />}
      {screen === "dashboard" && <Dashboard user={user} members={members} onNav={setScreen} />}
      {screen === "attendance" && <Attendance members={members} setMembers={setMembers} />}
      {screen === "library" && <Library favorites={favorites} toggleFavorite={toggleFavorite} />}
      {screen === "profile" && <Profile user={user} members={members} onLogout={handleLogout} />}
      {screen !== "login" && <BottomNav screen={screen} onNav={setScreen} />}
    </div>
  );
        }
