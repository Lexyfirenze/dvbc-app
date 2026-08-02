import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, CheckSquare, Music2, User, Search, Bell, Play, Pause, LogOut,
  ChevronLeft, Star, Mail, Lock, Eye, EyeOff, Clock, MapPin, AlertCircle, UserPlus, Camera, Users, ListMusic, FileText,
  Repeat, RotateCcw, RotateCw, X, Plus, Gauge } from "lucide-react";
import logoImg from "./assets/logo.jpg";
import photoImg from "./assets/chorale-photo.jpg";
import { supabase } from "./supabaseClient";

/* ---------- Design tokens: indigo / violet / lavender interface ---------- */
const C = {
  garnet: "#4C2E9E",
  garnetDark: "#241246",
  plum: "#7A56D6",
  lilac: "#C6B8F0",
  lilacSoft: "#F1EDFC",
  lilacLine: "#E3DAF7",
  ink: "#231A3B",
  inkSoft: "#736C87",
  card: "#FFFFFF",
  parchment: "#F7F5FD",
  sage: "#4F7A5C",
  sageBg: "#E7F1E9",
  roseDeep: "#B23368",
  roseBg: "#FBEAF1",
  amberBg: "#F6EFD8",
  amberText: "#8A6C24",
};

const GRADIENT = `linear-gradient(135deg, ${C.garnetDark} 0%, ${C.garnet} 45%, ${C.plum} 100%)`;
const VOICE_PARTS = ["Soprano I", "Soprano II", "Alto I", "Alto II", "Tenor I", "Tenor II", "Bass I", "Bass II"];

const PRIVACY_POLICY_TEXT = `Effective Date: July 31, 2026

At De Voci Belli Chorale, we value your privacy and are committed to protecting the personal information you provide when using our application. This Privacy Policy explains how we collect, use, store, and safeguard your information.

1. Information We Collect

We may collect the following information:

- Full name
- Email address
- Phone number
- Date of birth
- Residential address
- Profile photograph (where applicable)
- Educational or professional information (if required)
- Device information, such as IP address, browser type, and operating system
- Information about how you use the application

2. How We Use Your Information

We use your information to:

- Create and manage your account.
- Process applications and registrations.
- Communicate important updates and announcements.
- Respond to inquiries and provide support.
- Improve the performance and functionality of the application.
- Maintain the security and integrity of our services.
- Comply with legal obligations where applicable.

3. Data Sharing

We do not sell, rent, or trade your personal information. Your information may be shared only:

- With trusted service providers who help operate the application.
- When required by law or a valid legal process.
- To protect the rights, safety, or property of De Voci Belli Chorale or its users.

4. Data Security

We implement appropriate technical and organizational measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. While we strive to use commercially acceptable means to protect your information, no internet-based service can guarantee absolute security.

5. Data Retention

We retain your information only for as long as necessary to provide our services, fulfill legal obligations, resolve disputes, and enforce our policies. When your information is no longer required, it will be securely deleted or anonymized.

6. Your Rights

Depending on applicable laws, you may have the right to:

- Access your personal information.
- Request correction of inaccurate information.
- Request deletion of your personal data.
- Withdraw consent where applicable.
- Contact us regarding any concerns about your privacy.

7. Children's Privacy

Our application is not intended for children under the age required by applicable law without parental or guardian consent. We do not knowingly collect personal information from children without appropriate authorization.

8. Third-Party Services

Our application may use trusted third-party services for hosting, authentication, analytics, notifications, or payment processing. These providers have their own privacy policies governing how they handle your information.

9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be posted within the application with an updated effective date. Continued use of the application after such updates constitutes acceptance of the revised policy.

10. Contact Us

If you have any questions or concerns regarding this Privacy Policy or the handling of your personal information, please contact us through the official communication channels provided by De Voci Belli Chorale.

By using this application, you acknowledge that you have read, understood, and agreed to this Privacy Policy.`;

const ABOUT_TEXT = `De Voci Belli Chorale is a vibrant community of passionate young musicians united by a shared commitment to showcasing the beauty, power, and excellence of choral music. Founded on the belief that music is a universal language capable of inspiring hearts and transforming lives, the chorale serves as a platform where talent is nurtured, creativity flourishes, and lasting friendships are built.

Our repertoire spans classical, sacred, gospel, African art music, folk, and contemporary choral works, reflecting both our rich cultural heritage and the timeless traditions of choral excellence. Every performance is approached with artistic integrity, disciplined musicianship, and a deep desire to create meaningful musical experiences for our audiences.

Beyond the stage, De Voci Belli Chorale is committed to developing young singers through musical education, vocal training, mentorship, and collaborative learning. We believe that every rehearsal is an opportunity for growth, every concert is an opportunity to inspire, and every voice contributes to a greater harmony.

As ambassadors of choral music, we strive to promote excellence, preserve musical heritage, foster unity through song, and positively impact our communities. Through our music, we seek not only to entertain but also to uplift, educate, and leave a lasting impression wherever our voices are heard.

Our Vision: To be a leading choral ensemble recognized for artistic excellence, innovation, and meaningful musical impact.

Our Mission: To inspire lives and celebrate the beauty of music through exceptional choral performances, continuous musical development, and service to our community.`;

/* ---------- Avatar upload constraints (match the `avatars` storage bucket config) ---------- */
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8MB

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

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Local persistence (favorites + read state — this device) ---------- */
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
      border: `2px solid ${C.lilac}`, boxShadow: "0 4px 14px rgba(76,46,158,0.22)",
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

function Dashboard({ profile, members, onNav, unreadCount = 0 }) {
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
          <button
            onClick={() => onNav("messages")} className="dvbc-tap"
            style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", background: C.lilacSoft, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Bell size={16} color={C.plum} />
            {unreadCount > 0 && (
              <div style={{
                position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 999,
                background: C.roseDeep, color: "#fff", fontSize: 9.5, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                border: "2px solid #fff",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>
          <Badge />
        </div>
      </div>
      <div style={{ padding: "14px 24px 0" }}><Staff /></div>

      <div style={{ padding: "18px 24px" }}>
        <div style={{ borderRadius: 20, overflow: "hidden", position: "relative", boxShadow: "0 10px 26px rgba(76,46,158,0.18)" }}>
          <img src={photoImg} alt="De Voci Belli Chorale members" style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(36,18,70,0.88) 0%, rgba(36,18,70,0.15) 55%, rgba(36,18,70,0) 100%)" }} />
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

  const sectionOrder = ["Soprano", "Alto", "Tenor", "Bass"];
  const groupedSections = sectionOrder
    .map((section) => ({
      section,
      label: `${section}s`,
      rows: filtered
        .filter((m) => m.part.startsWith(section))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.rows.length > 0);
  const groupedNames = new Set(groupedSections.flatMap((g) => g.rows.map((m) => m.id)));
  const leftover = filtered.filter((m) => !groupedNames.has(m.id));
  if (leftover.length > 0) {
    groupedSections.push({ section: "Other", label: "Other", rows: leftover.sort((a, b) => a.name.localeCompare(b.name)) });
  }

  const renderMemberRow = (m) => {
    const row = (
      <>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
          background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Lora, serif", fontWeight: 600, fontSize: 13,
        }}>
          {m.avatar_url
            ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{m.name}</div>
          <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{m.part}</div>
          {m.clocked_in_at && (
            <div style={{ fontSize: 10, color: C.sage, marginTop: 2 }}>Clocked in {formatClockTime(m.clocked_in_at)}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Pill tone={m.status}>{m.status}</Pill>
          {m.remark && (
            <span style={{
              background: C.amberBg, color: C.amberText, fontSize: 10, fontWeight: 700,
              padding: "5px 9px", borderRadius: 999, whiteSpace: "nowrap",
            }}>
              Late
            </span>
          )}
        </div>
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
  };

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
        {groupedSections.map((g, i) => (
          <div key={g.section} style={{ marginTop: i === 0 ? 0 : 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink }}>{g.label}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>({g.rows.length})</div>
            </div>
            {g.rows.map((m) => renderMemberRow(m))}
          </div>
        ))}
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

function Messages({
  posts, loading, isAdmin, profile, onBack, onSubmitPost, onSubmitComment, seenMap, onMarkSeen,
  members, conversations, loadingConversations, activeConversationId, onOpenConversation, onCloseConversation,
  onCreateConversation, onSendChatMessage, onMarkConversationRead,
}) {
  const [tab, setTab] = useState("posts");
  const [openPostId, setOpenPostId] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { memberId: name }

  const chatChannelRef = useRef(null);
  const typingStopTimer = useRef(null);

  const openPost = (post) => {
    setOpenPostId(post.id);
    onMarkSeen(post.id);
  };

  const hasNewComments = (post) => {
    const lastSeen = seenMap[post.id];
    if (!lastSeen) return (post.comments || []).length > 0;
    return (post.comments || []).some((c) => new Date(c.created_at) > new Date(lastSeen));
  };

  const submitNewPost = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    await onSubmitPost(draft.trim());
    setDraft("");
    setPosting(false);
    setComposerOpen(false);
  };

  const submitNewComment = async () => {
    if (!commentDraft.trim() || !openPostId || posting) return;
    setPosting(true);
    await onSubmitComment(openPostId, commentDraft.trim());
    setCommentDraft("");
    setPosting(false);
  };

  const openPostData = posts.find((p) => p.id === openPostId);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (!activeConversationId) { chatChannelRef.current = null; return; }
    const channel = supabase.channel(`typing:${activeConversationId}`);
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.member_id === profile?.id) return;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (payload.typing) next[payload.member_id] = payload.name;
          else delete next[payload.member_id];
          return next;
        });
      })
      .subscribe();
    chatChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); chatChannelRef.current = null; setTypingUsers({}); };
  }, [activeConversationId, profile?.id]);

  useEffect(() => {
    if (activeConversationId) onMarkConversationRead(activeConversationId);
  }, [activeConversationId, activeConversation?.messages?.length, onMarkConversationRead]);

  const handleChatInputChange = (val) => {
    setChatDraft(val);
    if (chatChannelRef.current && profile) {
      chatChannelRef.current.send({ type: "broadcast", event: "typing", payload: { member_id: profile.id, name: profile.name?.split(" ")[0], typing: true } });
      clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => {
        chatChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { member_id: profile.id, name: profile.name, typing: false } });
      }, 2000);
    }
  };

  const submitChatMessage = async () => {
    if (!chatDraft.trim() || !activeConversationId || sendingChat) return;
    setSendingChat(true);
    await onSendChatMessage(activeConversationId, chatDraft.trim());
    setChatDraft("");
    clearTimeout(typingStopTimer.current);
    chatChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { member_id: profile.id, name: profile.name, typing: false } });
    setSendingChat(false);
  };

  const otherParticipants = (conv) => (conv.participants || []).filter((p) => p.member_id !== profile?.id);
  const conversationTitle = (conv) => {
    if (conv.is_group) return conv.title || otherParticipants(conv).map((p) => p.member?.name?.split(" ")[0]).join(", ") || "Group";
    return otherParticipants(conv)[0]?.member?.name || "Unknown";
  };
  const conversationAvatarUrl = (conv) => (conv.is_group ? null : otherParticipants(conv)[0]?.member?.avatar_url);
  const lastMessageOf = (conv) => { const msgs = conv.messages || []; return msgs.length ? msgs[msgs.length - 1] : null; };
  const unreadCountFor = (conv) => {
    const mine = (conv.participants || []).find((p) => p.member_id === profile?.id);
    const lastRead = mine?.last_read_at;
    return (conv.messages || []).filter((m) => m.sender_id !== profile?.id && (!lastRead || new Date(m.created_at) > new Date(lastRead))).length;
  };
  const seenByOthers = (conv, message) => otherParticipants(conv).filter((p) => p.last_read_at && new Date(p.last_read_at) >= new Date(message.created_at));

  if (openPostData) {
    return (
      <div style={{ paddingBottom: 110 }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setOpenPostId(null)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={20} color={C.ink} />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.ink }}>Post</div>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Lora, serif", fontWeight: 600, fontSize: 14,
            }}>
              {openPostData.author?.avatar_url
                ? <img src={openPostData.author.avatar_url} alt={openPostData.author.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (openPostData.author?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{openPostData.author?.name || "Unknown"}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>{timeAgo(openPostData.created_at)}</div>
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6, marginTop: 12, whiteSpace: "pre-line" }}>
            {openPostData.content}
          </div>
        </div>

        <div style={{ margin: "20px 24px 0" }}><Staff /></div>

        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
            {(openPostData.comments || []).length} {(openPostData.comments || []).length === 1 ? "Comment" : "Comments"}
          </div>
          {(openPostData.comments || []).length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "6px 0" }}>No comments yet — be the first to reply.</div>
          )}
          {(openPostData.comments || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Lora, serif", fontWeight: 600, fontSize: 11,
              }}>
                {c.author?.avatar_url
                  ? <img src={c.author.avatar_url} alt={c.author.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (c.author?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{c.author?.name || "Unknown"}</div>
                  <div style={{ fontSize: 10.5, color: C.inkSoft }}>{timeAgo(c.created_at)}</div>
                </div>
                <div style={{ fontSize: 12.5, color: C.ink, marginTop: 2, lineHeight: 1.5 }}>{c.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
          padding: "12px 24px calc(env(safe-area-inset-bottom, 0px) + 12px)", display: "flex", gap: 8, alignItems: "center",
        }}>
          <input
            value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Write a comment…"
            style={{ flex: 1, border: `1.4px solid ${C.lilacLine}`, background: C.parchment, borderRadius: 999, padding: "11px 16px", fontSize: 13, outline: "none", color: C.ink }}
            onKeyDown={(e) => { if (e.key === "Enter") submitNewComment(); }}
          />
          <button
            onClick={submitNewComment} disabled={!commentDraft.trim() || posting} className="dvbc-tap"
            style={{
              background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: "11px 18px", borderRadius: 999,
              border: "none", cursor: commentDraft.trim() ? "pointer" : "default", opacity: commentDraft.trim() ? 1 : 0.5, flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  if (tab === "chats" && activeConversation) {
    const msgs = activeConversation.messages || [];
    const title = conversationTitle(activeConversation);
    const typingNames = Object.values(typingUsers);
    const lastMine = [...msgs].reverse().find((m) => m.sender_id === profile?.id);
    const seenBy = lastMine ? seenByOthers(activeConversation, lastMine) : [];

    return (
      <div style={{ paddingBottom: 90, display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onCloseConversation} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={20} color={C.ink} />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.ink }}>{title}</div>
        </div>

        <div style={{ flex: 1, padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.length === 0 && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 12.5, padding: "20px 0" }}>Say hello 👋</div>}
          {msgs.map((m) => {
            const mine = m.sender_id === profile?.id;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                {!mine && activeConversation.is_group && (
                  <div style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 2, marginLeft: 4 }}>{m.sender?.name}</div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: mine ? GRADIENT : C.lilacSoft, color: mine ? "#fff" : C.ink, fontSize: 13.5, lineHeight: 1.5,
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 3, marginLeft: mine ? 0 : 4, marginRight: mine ? 4 : 0 }}>{timeAgo(m.created_at)}</div>
              </div>
            );
          })}
          {lastMine && seenBy.length > 0 && (
            <div style={{ textAlign: "right", fontSize: 9.5, color: C.inkSoft, marginTop: -4 }}>
              {activeConversation.is_group ? `Seen by ${seenBy.length} of ${otherParticipants(activeConversation).length}` : "Seen"}
            </div>
          )}
          {typingNames.length > 0 && (
            <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: "italic" }}>{typingNames.join(", ")} typing…</div>
          )}
        </div>

        <div style={{
          position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
          padding: "12px 24px calc(env(safe-area-inset-bottom, 0px) + 12px)", display: "flex", gap: 8, alignItems: "center",
        }}>
          <input
            value={chatDraft} onChange={(e) => handleChatInputChange(e.target.value)} placeholder="Message…"
            style={{ flex: 1, border: `1.4px solid ${C.lilacLine}`, background: C.parchment, borderRadius: 999, padding: "11px 16px", fontSize: 13, outline: "none", color: C.ink }}
            onKeyDown={(e) => { if (e.key === "Enter") submitChatMessage(); }}
          />
          <button
            onClick={submitChatMessage} disabled={!chatDraft.trim() || sendingChat} className="dvbc-tap"
            style={{
              background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: "11px 18px", borderRadius: 999,
              border: "none", cursor: chatDraft.trim() ? "pointer" : "default", opacity: chatDraft.trim() ? 1 : 0.5, flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={20} color={C.ink} />
        </button>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.ink }}>Messages</div>
      </div>
      <div style={{ margin: "14px 24px 0" }}><Staff /></div>

      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
        <Chip active={tab === "posts"} onClick={() => setTab("posts")}>Posts</Chip>
        <Chip active={tab === "chats"} onClick={() => setTab("chats")}>Chats</Chip>
      </div>

      {tab === "posts" && (
        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink, marginBottom: 10 }}>Leadership posts</div>

          {loading && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "20px 0" }}>Loading…</div>}
          {!loading && posts.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No posts yet.</div>
          )}

          {posts.map((post) => {
            const commentCount = (post.comments || []).length;
            const isNew = hasNewComments(post);
            const authorName = post.author?.id === profile?.id ? "you" : (post.author?.name || "Unknown");
            return (
              <button
                key={post.id} onClick={() => openPost(post)} className="dvbc-tap"
                style={{
                  width: "100%", textAlign: "left", display: "flex", gap: 12, padding: 14,
                  background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, marginBottom: 12, cursor: "pointer",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                  background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Lora, serif", fontWeight: 600, fontSize: 14,
                }}>
                  {post.author?.avatar_url
                    ? <img src={post.author.avatar_url} alt={post.author.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (post.author?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{timeAgo(post.created_at)}</div>
                    {isNew && (
                      <span style={{ background: C.roseBg, color: C.roseDeep, fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        New comments
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.ink, marginTop: 4, lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {post.content}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>Sent by {authorName}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{commentCount} comment{commentCount === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "chats" && (
        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink }}>Chats</div>
            <button
              onClick={() => setNewChatOpen(true)} className="dvbc-tap"
              style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 10, border: "none", cursor: "pointer" }}
            >
              + New
            </button>
          </div>

          {loadingConversations && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "20px 0" }}>Loading…</div>}
          {!loadingConversations && conversations.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No chats yet — start one above.</div>
          )}

          {conversations.map((conv) => {
            const unread = unreadCountFor(conv);
            const last = lastMessageOf(conv);
            const title = conversationTitle(conv);
            const avatarUrl = conversationAvatarUrl(conv);
            return (
              <button
                key={conv.id} onClick={() => onOpenConversation(conv.id)} className="dvbc-tap"
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 0", background: "none", border: "none", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer" }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                  background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Lora, serif", fontWeight: 600, fontSize: 14,
                }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : conv.is_group ? <Users size={18} color={C.plum} /> : title.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{title}</div>
                    {last && <div style={{ fontSize: 10.5, color: C.inkSoft }}>{timeAgo(last.created_at)}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {last ? `${last.sender_id === profile?.id ? "You: " : ""}${last.content}` : "No messages yet"}
                  </div>
                </div>
                {unread > 0 && (
                  <div style={{ minWidth: 20, height: 20, borderRadius: 999, background: C.roseDeep, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                    {unread > 9 ? "9+" : unread}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {tab === "posts" && isAdmin && (
        <button
          onClick={() => setComposerOpen(true)} className="dvbc-tap"
          style={{
            position: "fixed", bottom: 96, right: 24, width: 52, height: 52, borderRadius: "50%",
            background: GRADIENT, border: "none", color: "#fff", fontSize: 26, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 8px 20px rgba(76,46,158,0.35)",
          }}
        >
          +
        </button>
      )}

      {composerOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(35,26,59,0.45)", zIndex: 30,
          display: "flex", alignItems: "flex-end",
        }}>
          <div style={{ background: "#fff", width: "100%", borderRadius: "20px 20px 0 0", padding: "20px 24px calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink, marginBottom: 12 }}>New leadership post</div>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share an update with the chorale…"
              style={{
                width: "100%", minHeight: 110, border: `1.4px solid ${C.lilacLine}`, borderRadius: 12,
                padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.ink, resize: "vertical", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={submitNewPost} disabled={!draft.trim() || posting} className="dvbc-tap"
                style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.6 }}
              >
                {posting ? "Posting…" : "Post"}
              </button>
              <button
                onClick={() => { setComposerOpen(false); setDraft(""); }} className="dvbc-tap"
                style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {newChatOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(35,26,59,0.45)", zIndex: 30,
          display: "flex", alignItems: "flex-end",
        }}>
          <div style={{ background: "#fff", width: "100%", maxHeight: "82vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "20px 24px calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink, marginBottom: 12 }}>New chat</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Chip active={!isGroupMode} onClick={() => { setIsGroupMode(false); setSelectedMemberIds([]); }}>Direct</Chip>
              <Chip active={isGroupMode} onClick={() => setIsGroupMode(true)}>Group</Chip>
            </div>

            {isGroupMode && (
              <input
                value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Group name"
                style={{ width: "100%", border: `1.4px solid ${C.lilacLine}`, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.ink, marginBottom: 12 }}
              />
            )}

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {members.filter((m) => m.id !== profile?.id).map((m) => {
                const selected = selectedMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (isGroupMode) setSelectedMemberIds((prev) => (selected ? prev.filter((id) => id !== m.id) : [...prev, m.id]));
                      else setSelectedMemberIds([m.id]);
                    }}
                    className="dvbc-tap"
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${C.lilacLine}` }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                      background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "Lora, serif", fontWeight: 600, fontSize: 12,
                    }}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: C.ink }}>{m.name}</div>
                    {isGroupMode ? (
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.6px solid ${selected ? C.garnet : C.lilacLine}`, background: selected ? GRADIENT : "transparent" }} />
                    ) : (
                      selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.garnet }} />
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                disabled={selectedMemberIds.length === 0 || (isGroupMode && !groupTitle.trim())}
                onClick={async () => {
                  await onCreateConversation(selectedMemberIds, isGroupMode ? groupTitle.trim() : null, isGroupMode);
                  setNewChatOpen(false); setSelectedMemberIds([]); setGroupTitle(""); setIsGroupMode(false); setTab("chats");
                }}
                className="dvbc-tap"
                style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: selectedMemberIds.length ? "pointer" : "default", opacity: selectedMemberIds.length ? 1 : 0.6 }}
              >
                Start chat
              </button>
              <button
                onClick={() => { setNewChatOpen(false); setSelectedMemberIds([]); setGroupTitle(""); setIsGroupMode(false); }}
                className="dvbc-tap"
                style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Executives({ isAdmin }) {
  const [executives, setExecutives] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showExecForm, setShowExecForm] = useState(false);
  const [editingExec, setEditingExec] = useState(null);
  const [execForm, setExecForm] = useState({ name: "", role: "", bio: "", contact: "" });
  const [execPhotoFile, setExecPhotoFile] = useState(null);
  const [savingExec, setSavingExec] = useState(false);
  const [execError, setExecError] = useState("");

  const [showLeaderForm, setShowLeaderForm] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [leaderForm, setLeaderForm] = useState({ name: "", voice_part: VOICE_PARTS[0] });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [execRes, leaderRes] = await Promise.all([
      supabase.from("executives").select("*").order("display_order", { ascending: true }),
      supabase.from("voice_part_leaders").select("*").order("display_order", { ascending: true }),
    ]);
    setExecutives(execRes.data || []);
    setLeaders(leaderRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetExecForm = () => {
    setExecForm({ name: "", role: "", bio: "", contact: "" });
    setExecPhotoFile(null);
    setEditingExec(null);
    setShowExecForm(false);
    setExecError("");
  };

  const startEditExec = (exec) => {
    setEditingExec(exec);
    setExecForm({ name: exec.name || "", role: exec.role || "", bio: exec.bio || "", contact: exec.contact || "" });
    setExecPhotoFile(null);
    setShowExecForm(true);
  };

  const saveExec = async () => {
    if (!execForm.name.trim() || !execForm.role.trim()) {
      setExecError("Name and role are required.");
      return;
    }
    setSavingExec(true);
    setExecError("");

    let photo_url = editingExec?.photo_url || null;
    try {
      if (execPhotoFile) {
        const ext = (execPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("executive-photos").upload(path, execPhotoFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("executive-photos").getPublicUrl(path);
        photo_url = data.publicUrl;
      }

      const payload = { ...execForm, photo_url };
      if (editingExec) {
        const { error } = await supabase.from("executives").update(payload).eq("id", editingExec.id);
        if (error) throw error;
      } else {
        const maxOrder = executives.reduce((m, e) => Math.max(m, e.display_order || 0), 0);
        const { error } = await supabase.from("executives").insert({ ...payload, display_order: maxOrder + 1 });
        if (error) throw error;
      }
      resetExecForm();
      loadData();
    } catch (err) {
      setExecError(err.message || "Could not save. Please try again.");
    } finally {
      setSavingExec(false);
    }
  };

  const deleteExec = async (exec) => {
    if (!window.confirm(`Remove ${exec.name} from executives?`)) return;
    await supabase.from("executives").delete().eq("id", exec.id);
    loadData();
  };

  const resetLeaderForm = () => {
    setLeaderForm({ name: "", voice_part: VOICE_PARTS[0] });
    setEditingLeader(null);
    setShowLeaderForm(false);
  };

  const startEditLeader = (leader) => {
    setEditingLeader(leader);
    setLeaderForm({ name: leader.name || "", voice_part: leader.voice_part || VOICE_PARTS[0] });
    setShowLeaderForm(true);
  };

  const saveLeader = async () => {
    if (!leaderForm.name.trim()) return;
    if (editingLeader) {
      await supabase.from("voice_part_leaders").update(leaderForm).eq("id", editingLeader.id);
    } else {
      const maxOrder = leaders.reduce((m, l) => Math.max(m, l.display_order || 0), 0);
      await supabase.from("voice_part_leaders").insert({ ...leaderForm, display_order: maxOrder + 1 });
    }
    resetLeaderForm();
    loadData();
  };

  const deleteLeader = async (leader) => {
    if (!window.confirm(`Remove ${leader.name} as ${leader.voice_part} leader?`)) return;
    await supabase.from("voice_part_leaders").delete().eq("id", leader.id);
    loadData();
  };

  const inputStyle = {
    border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12,
    padding: "12px 14px", fontSize: 13.5, width: "100%", outline: "none", color: C.ink,
  };

  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader title="Executives" subtitle="Leadership & voice part leaders" />

      <div style={{ padding: "18px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink }}>Executives</div>
          {isAdmin && (
            <button
              onClick={() => { setEditingExec(null); setExecForm({ name: "", role: "", bio: "", contact: "" }); setShowExecForm(true); }}
              className="dvbc-tap"
              style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
            >
              + Add
            </button>
          )}
        </div>

        {loading && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "20px 0" }}>Loading…</div>}
        {!loading && executives.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No executives added yet.</div>
        )}

        {executives.map((exec) => (
          <div key={exec.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Lora, serif", fontWeight: 600, fontSize: 18, border: `2px solid ${C.lilac}`,
            }}>
              {exec.photo_url
                ? <img src={exec.photo_url} alt={exec.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : exec.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{exec.name}</div>
              <div style={{ fontSize: 11.5, color: C.garnet, fontWeight: 600, marginTop: 1 }}>{exec.role}</div>
              {exec.bio && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5, lineHeight: 1.5 }}>{exec.bio}</div>}
              {exec.contact && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>{exec.contact}</div>}
              {isAdmin && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  <button onClick={() => startEditExec(exec)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>Edit</button>
                  <button onClick={() => deleteExec(exec)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.roseDeep, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {showExecForm && (
          <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
              {editingExec ? "Edit Executive" : "Add Executive"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} placeholder="Full name" value={execForm.name} onChange={(e) => setExecForm({ ...execForm, name: e.target.value })} />
              <input style={inputStyle} placeholder="Role (e.g. President)" value={execForm.role} onChange={(e) => setExecForm({ ...execForm, role: e.target.value })} />
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Short bio" value={execForm.bio} onChange={(e) => setExecForm({ ...execForm, bio: e.target.value })} />
              <input style={inputStyle} placeholder="Contact (email or phone)" value={execForm.contact} onChange={(e) => setExecForm({ ...execForm, contact: e.target.value })} />
              <input type="file" accept="image/*" onChange={(e) => setExecPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
            </div>
            {execError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 10 }}>
                <AlertCircle size={13} /> {execError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={saveExec} disabled={savingExec} className="dvbc-tap" style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingExec ? "default" : "pointer", opacity: savingExec ? 0.8 : 1 }}>
                {savingExec ? "Saving…" : "Save"}
              </button>
              <button onClick={resetExecForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 0 4px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink }}>Voice Part Leaders</div>
          {isAdmin && (
            <button
              onClick={() => { setEditingLeader(null); setLeaderForm({ name: "", voice_part: VOICE_PARTS[0] }); setShowLeaderForm(true); }}
              className="dvbc-tap"
              style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
            >
              + Add
            </button>
          )}
        </div>

        {!loading && leaders.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No voice part leaders added yet.</div>
        )}

        {leaders.map((leader) => (
          <div key={leader.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Lora, serif", fontWeight: 600, fontSize: 13,
            }}>
              {leader.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{leader.name}</div>
            </div>
            <Pill>{leader.voice_part}</Pill>
            {isAdmin && (
              <div style={{ display: "flex", gap: 10, marginLeft: 10 }}>
                <button onClick={() => startEditLeader(leader)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Edit</button>
                <button onClick={() => deleteLeader(leader)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.roseDeep, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Delete</button>
              </div>
            )}
          </div>
        ))}

        {showLeaderForm && (
          <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
              {editingLeader ? "Edit Leader" : "Add Voice Part Leader"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} placeholder="Full name" value={leaderForm.name} onChange={(e) => setLeaderForm({ ...leaderForm, name: e.target.value })} />
              <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px" }}>
                <select
                  value={leaderForm.voice_part}
                  onChange={(e) => setLeaderForm({ ...leaderForm, voice_part: e.target.value })}
                  style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                >
                  {VOICE_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={saveLeader} className="dvbc-tap" style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                Save
              </button>
              <button onClick={resetLeaderForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StaticPage({ title, content, onBack }) {
  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={20} color={C.ink} />
        </button>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, color: C.ink }}>{title}</div>
      </div>
      <div style={{ margin: "14px 24px 0" }}><Staff /></div>
      <div style={{ padding: "20px 24px 0", fontSize: 13, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-line" }}>
        {content}
      </div>
    </div>
  );
}

function Profile({ profile, members, onLogout, isAdmin, onApprove, onReject, onUploadAvatar, avatarUploading, avatarError, onNavSettings }) {
  const present = members.filter((m) => m.status === "present").length;
  const displayName = profile?.name || "Member";
  const pending = members.filter((m) => m.approval_status === "pending");

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ background: GRADIENT, padding: "calc(env(safe-area-inset-top, 0px) + 26px) 24px 34px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: "#fff", margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              fontFamily: "Lora, serif", fontStyle: "italic", fontWeight: 600, fontSize: 24, color: C.garnet,
              border: `3px solid ${C.lilac}`,
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : displayName.charAt(0)}
            </div>
            <label
              htmlFor="dvbc-avatar-input" className="dvbc-tap"
              style={{
                position: "absolute", bottom: 10, right: -2, width: 28, height: 28, borderRadius: "50%",
                background: C.garnet, border: "2.5px solid #fff", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer",
              }}
            >
              <Camera size={13} color="#fff" />
            </label>
            <input
              id="dvbc-avatar-input" type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadAvatar(f); e.target.value = ""; }}
            />
          </div>
        </div>
        {avatarUploading && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: -6, marginBottom: 6 }}>Uploading photo…</div>}
        {avatarError && <div style={{ color: "#FBEAF1", fontSize: 11, marginTop: -6, marginBottom: 6 }}>{avatarError}</div>}
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
        {[
          { label: "Notifications", nav: null },
          { label: "Privacy", nav: "privacy" },
          { label: "About De Voci Belli Chorale", nav: "about" },
        ].map(({ label, nav }) => (
          <div
            key={label}
            onClick={() => nav && onNavSettings?.(nav)}
            className={nav ? "dvbc-tap" : ""}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink, cursor: nav ? "pointer" : "default" }}
          >
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
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => onApprove(m.id)} className="dvbc-tap"
                    style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(m.id)} className="dvbc-tap"
                    style={{ background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 12, padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
                  >
                    Reject
                  </button>
                </div>
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
function PracticeLists({ isAdmin, profile }) {
  const myUserId = profile?.user_id;
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openListId, setOpenListId] = useState(null);
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];

  const [showListForm, setShowListForm] = useState(false);
  const [listContext, setListContext] = useState("group"); // "group" | "personal"
  const [editingList, setEditingList] = useState(null);
  const [listForm, setListForm] = useState({ title: "", voice_part: "All" });
  const [listCoverFile, setListCoverFile] = useState(null);
  const [savingList, setSavingList] = useState(false);
  const [listError, setListError] = useState("");

  const [showTrackForm, setShowTrackForm] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [trackForm, setTrackForm] = useState({ title: "", composer: "" });
  const [trackAudioFile, setTrackAudioFile] = useState(null);
  const [trackPdfFile, setTrackPdfFile] = useState(null);
  const [savingTrack, setSavingTrack] = useState(false);
  const [trackError, setTrackError] = useState("");

  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [repeatIds, setRepeatIds] = useState(() => new Set());
  const audioRef = useRef(null);
  const RATES = [1, 1.25, 1.5, 0.75];

  const loadLists = useCallback(async () => {
    setLoading(true);
    const [listsRes, tracksRes] = await Promise.all([
      supabase.from("practice_lists").select("*").order("display_order", { ascending: true }),
      supabase.from("practice_tracks").select("*").order("display_order", { ascending: true }),
    ]);
    const tracksByList = {};
    (tracksRes.data || []).forEach((t) => {
      if (!tracksByList[t.practice_list_id]) tracksByList[t.practice_list_id] = [];
      tracksByList[t.practice_list_id].push(t);
    });
    setLists((listsRes.data || []).map((l) => ({ ...l, tracks: tracksByList[l.id] || [] })));
    setLoading(false);
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      if (currentTrackId && repeatIds.has(currentTrackId)) {
        audio.currentTime = 0;
        audio.play();
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [currentTrackId, repeatIds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, currentTrackId]);

  const openList = lists.find((l) => l.id === openListId);
  const groupLists = lists.filter((l) => !l.owner_user_id);
  const personalLists = lists.filter((l) => l.owner_user_id && l.owner_user_id === myUserId);
  const filteredGroupLists = groupLists.filter((l) => filter === "All" || l.voice_part === "All" || l.voice_part.startsWith(filter));

  const canManage = (list) => isAdmin || (list && list.owner_user_id === myUserId);

  const formatDuration = (secs) => {
    if (!secs || Number.isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const playTrack = (track) => {
    if (currentTrackId === track.id) {
      if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
      else { audioRef.current?.play(); setIsPlaying(true); }
      return;
    }
    setCurrentTrackId(track.id);
    setProgress(0);
    setIsPlaying(true);
    setTimeout(() => { if (audioRef.current) { audioRef.current.playbackRate = playbackRate; audioRef.current.play(); } }, 0);
  };

  const skip = (secs) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + secs), duration || audio.currentTime + secs);
  };

  const cycleRate = () => {
    const idx = RATES.indexOf(playbackRate);
    setPlaybackRate(RATES[(idx + 1) % RATES.length]);
  };

  const toggleRepeat = (trackId) => {
    setRepeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return next;
    });
  };

  const seekTo = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  };

  const currentTrack = openList?.tracks.find((t) => t.id === currentTrackId);

  const resetListForm = () => {
    setListForm({ title: "", voice_part: "All" });
    setListCoverFile(null);
    setEditingList(null);
    setShowListForm(false);
    setListError("");
  };

  const startEditList = (list) => {
    setEditingList(list);
    setListContext(list.owner_user_id ? "personal" : "group");
    setListForm({ title: list.title || "", voice_part: list.voice_part || "All" });
    setListCoverFile(null);
    setShowListForm(true);
  };

  const saveList = async () => {
    if (!listForm.title.trim()) { setListError("Title is required."); return; }
    setSavingList(true);
    setListError("");
    let cover_url = editingList?.cover_url || null;
    try {
      const bucketFolder = listContext === "personal" ? `${myUserId}/` : "";
      if (listCoverFile) {
        const ext = (listCoverFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${bucketFolder}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("practice-covers").upload(path, listCoverFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("practice-covers").getPublicUrl(path);
        cover_url = data.publicUrl;
      }
      const payload = {
        title: listForm.title.trim(),
        voice_part: listContext === "personal" ? "All" : listForm.voice_part,
        cover_url,
        owner_user_id: listContext === "personal" ? myUserId : null,
      };
      if (editingList) {
        const { error } = await supabase.from("practice_lists").update(payload).eq("id", editingList.id);
        if (error) throw error;
      } else {
        const maxOrder = lists.reduce((m, l) => Math.max(m, l.display_order || 0), 0);
        const { error } = await supabase.from("practice_lists").insert({ ...payload, display_order: maxOrder + 1 });
        if (error) throw error;
      }
      resetListForm();
      loadLists();
    } catch (err) {
      setListError(err.message || "Could not save. Please try again.");
    } finally {
      setSavingList(false);
    }
  };

  const deleteList = async (list) => {
    if (!window.confirm(`Delete "${list.title}" and all its tracks?`)) return;
    await supabase.from("practice_tracks").delete().eq("practice_list_id", list.id);
    await supabase.from("practice_lists").delete().eq("id", list.id);
    if (openListId === list.id) setOpenListId(null);
    loadLists();
  };

  const resetTrackForm = () => {
    setTrackForm({ title: "", composer: "" });
    setTrackAudioFile(null);
    setTrackPdfFile(null);
    setEditingTrack(null);
    setShowTrackForm(false);
    setTrackError("");
  };

  const startEditTrack = (track) => {
    setEditingTrack(track);
    setTrackForm({ title: track.title || "", composer: track.composer || "" });
    setTrackAudioFile(null);
    setTrackPdfFile(null);
    setShowTrackForm(true);
  };

  const saveTrack = async () => {
    if (!trackForm.title.trim()) { setTrackError("Title is required."); return; }
    if (!editingTrack && !trackAudioFile) { setTrackError("Please choose an audio file."); return; }
    if (trackAudioFile && !trackAudioFile.type.startsWith("audio/")) {
      setTrackError(`"${trackAudioFile.name}" doesn't look like an audio file. Please choose an MP3, M4A, WAV, or similar.`);
      return;
    }
    if (trackPdfFile && trackPdfFile.type !== "application/pdf" && !trackPdfFile.name.toLowerCase().endsWith(".pdf")) {
      setTrackError(`"${trackPdfFile.name}" doesn't look like a PDF. Please choose a .pdf file.`);
      return;
    }
    setSavingTrack(true);
    setTrackError("");
    let audio_url = editingTrack?.audio_url || null;
    let sheet_pdf_url = editingTrack?.sheet_pdf_url || null;
    try {
      const isPersonal = !!openList?.owner_user_id;
      const folder = isPersonal ? `${myUserId}/` : "";
      if (trackAudioFile) {
        const ext = (trackAudioFile.name.split(".").pop() || "mp3").toLowerCase();
        const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("practice-audio").upload(path, trackAudioFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("practice-audio").getPublicUrl(path);
        audio_url = data.publicUrl;
      }
      if (trackPdfFile) {
        const pdfPath = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
        const { error: pdfUploadError } = await supabase.storage.from("practice-sheets").upload(pdfPath, trackPdfFile);
        if (pdfUploadError) throw pdfUploadError;
        const { data: pdfData } = supabase.storage.from("practice-sheets").getPublicUrl(pdfPath);
        sheet_pdf_url = pdfData.publicUrl;
      }
      const payload = { title: trackForm.title.trim(), composer: trackForm.composer.trim(), audio_url, sheet_pdf_url, practice_list_id: openListId };
      if (editingTrack) {
        const { error } = await supabase.from("practice_tracks").update(payload).eq("id", editingTrack.id);
        if (error) throw error;
      } else {
        const maxOrder = (openList?.tracks || []).reduce((m, t) => Math.max(m, t.display_order || 0), 0);
        const { error } = await supabase.from("practice_tracks").insert({ ...payload, display_order: maxOrder + 1 });
        if (error) throw error;
      }
      resetTrackForm();
      loadLists();
    } catch (err) {
      setTrackError(err.message || "Could not save. Please try again.");
    } finally {
      setSavingTrack(false);
    }
  };

  const deleteTrack = async (track) => {
    if (!window.confirm(`Delete "${track.title}"?`)) return;
    if (currentTrackId === track.id) { audioRef.current?.pause(); setIsPlaying(false); setCurrentTrackId(null); setPlayerExpanded(false); }
    await supabase.from("practice_tracks").delete().eq("id", track.id);
    loadLists();
  };

  const inputStyle = {
    border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12,
    padding: "12px 14px", fontSize: 13.5, width: "100%", outline: "none", color: C.ink,
  };

  /* ---------- Full-screen player ---------- */
  if (openList && playerExpanded && currentTrack) {
    const isRepeating = repeatIds.has(currentTrack.id);
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, background: `linear-gradient(180deg, ${C.plum} 0%, ${C.garnetDark} 100%)`, display: "flex", flexDirection: "column" }}>
        <audio ref={audioRef} src={currentTrack.audio_url} autoPlay />
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {currentTrack.sheet_pdf_url ? (
            <a href={currentTrack.sheet_pdf_url} target="_blank" rel="noopener noreferrer" className="dvbc-tap" style={{ color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={18} color="#fff" />
            </a>
          ) : <div style={{ width: 18 }} />}
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{openList.title}</div>
          <button onClick={() => setPlayerExpanded(false)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={20} color="#fff" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px 0" }}>
          {openList.tracks.map((t) => {
            const active = t.id === currentTrack.id;
            return (
              <button
                key={t.id} onClick={() => playTrack(t)} className="dvbc-tap"
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  background: active ? "rgba(255,255,255,0.14)" : "transparent", border: "none", borderRadius: 14,
                  padding: "14px 12px", marginBottom: 6, cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  {active && (isPlaying ? <Play size={13} color="#fff" fill="#fff" /> : <Pause size={13} color="rgba(255,255,255,0.6)" />)}
                  <span style={{ color: active ? "#fff" : "rgba(255,255,255,0.75)", fontSize: 14.5, fontWeight: active ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </span>
                </div>
                <span onClick={(e) => { e.stopPropagation(); toggleRepeat(t.id); }} style={{ display: "flex" }}>
                  <Repeat size={16} color={repeatIds.has(t.id) ? "#fff" : "rgba(255,255,255,0.35)"} />
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "10px 26px calc(env(safe-area-inset-bottom, 0px) + 26px)" }}>
          <div style={{ color: "#fff", fontFamily: "Lora, serif", fontSize: 19, marginBottom: 2 }}>{currentTrack.title}</div>
          {currentTrack.composer && <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginBottom: 18 }}>{currentTrack.composer}</div>}

          <div onClick={seekTo} style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.22)", cursor: "pointer", position: "relative", marginTop: currentTrack.composer ? 0 : 18 }}>
            <div style={{ height: "100%", borderRadius: 999, background: "#fff", width: `${duration ? (progress / duration) * 100 : 0}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{formatDuration(progress)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>-{formatDuration(Math.max(0, duration - progress))}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
            <button onClick={cycleRate} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.75)" }}>
              <Gauge size={16} color="rgba(255,255,255,0.75)" /> <span style={{ fontSize: 11.5, fontWeight: 700 }}>{playbackRate}x</span>
            </button>
            <button onClick={() => skip(-10)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
              <RotateCcw size={22} color="#fff" />
            </button>
            <button
              onClick={() => playTrack(currentTrack)} className="dvbc-tap"
              style={{ width: 62, height: 62, borderRadius: "50%", background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {isPlaying ? <Pause size={24} color={C.garnet} fill={C.garnet} /> : <Play size={24} color={C.garnet} fill={C.garnet} style={{ marginLeft: 2 }} />}
            </button>
            <button onClick={() => skip(10)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
              <RotateCw size={22} color="#fff" />
            </button>
            <button onClick={() => toggleRepeat(currentTrack.id)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
              <Repeat size={18} color={isRepeating ? "#fff" : "rgba(255,255,255,0.4)"} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Track list inside an open playlist ---------- */
  if (openList) {
    return (
      <div style={{ paddingBottom: currentTrack ? 190 : 110 }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setOpenListId(null)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={20} color={C.ink} />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, color: C.ink }}>{openList.title}</div>
        </div>
        <div style={{ padding: "6px 24px 0" }}>
          <Pill>{openList.owner_user_id ? "Personal" : openList.voice_part}</Pill>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          {canManage(openList) && (
            <button
              onClick={() => { setEditingTrack(null); setTrackForm({ title: "", composer: "" }); setShowTrackForm(true); }}
              className="dvbc-tap"
              style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
            >
              + Add Track
            </button>
          )}

          {openList.tracks.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No tracks in this list yet.</div>
          )}

          {openList.tracks.map((t) => {
            const playing = currentTrackId === t.id && isPlaying;
            return (
              <div
                key={t.id} onClick={() => { playTrack(t); setPlayerExpanded(true); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer" }}
              >
                <button onClick={(e) => { e.stopPropagation(); playTrack(t); }} className="dvbc-tap" style={{ width: 34, height: 34, borderRadius: "50%", background: GRADIENT, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  {playing ? <Pause size={13} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  {t.composer && <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{t.composer}</div>}
                </div>
                {t.sheet_pdf_url && (
                  <a
                    href={t.sheet_pdf_url} target="_blank" rel="noopener noreferrer" className="dvbc-tap"
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: C.lilacSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.plum }}
                    title="View sheet music"
                  >
                    <FileText size={14} color={C.plum} />
                  </a>
                )}
                {canManage(openList) && (
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startEditTrack(t)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Edit</button>
                    <button onClick={() => deleteTrack(t)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.roseDeep, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}

          {showTrackForm && (
            <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
                {editingTrack ? "Edit Track" : "Add Track"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={inputStyle} placeholder="Track title" value={trackForm.title} onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} />
                <input style={inputStyle} placeholder="Composer (optional)" value={trackForm.composer} onChange={(e) => setTrackForm({ ...trackForm, composer: e.target.value })} />
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Audio</label>
                  <input type="file" accept="*/*" onChange={(e) => setTrackAudioFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
                  {editingTrack && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>Leave empty to keep the existing audio.</div>}
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Sheet music (PDF, optional)</label>
                  <input type="file" accept="*/*" onChange={(e) => setTrackPdfFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
                  {editingTrack?.sheet_pdf_url && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>Leave empty to keep the existing PDF.</div>}
                </div>
              </div>
              {trackError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 10 }}>
                  <AlertCircle size={13} /> {trackError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={saveTrack} disabled={savingTrack} className="dvbc-tap" style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingTrack ? "default" : "pointer", opacity: savingTrack ? 0.8 : 1 }}>
                  {savingTrack ? "Saving…" : "Save"}
                </button>
                <button onClick={resetTrackForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {currentTrack && !playerExpanded && (
          <div
            onClick={() => setPlayerExpanded(true)}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
              padding: "14px 24px calc(env(safe-area-inset-bottom, 0px) + 14px)", cursor: "pointer",
            }}
          >
            <audio ref={audioRef} src={currentTrack.audio_url} autoPlay />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentTrack.title}</div>
            <div onClick={(e) => { e.stopPropagation(); seekTo(e); }} style={{ height: 6, borderRadius: 999, background: C.lilacSoft, cursor: "pointer", position: "relative" }}>
              <div style={{ height: "100%", borderRadius: 999, background: GRADIENT, width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>{formatDuration(progress)} / {formatDuration(duration)}</div>
              <button onClick={(e) => { e.stopPropagation(); playTrack(currentTrack); }} className="dvbc-tap" style={{ width: 30, height: 30, borderRadius: "50%", background: GRADIENT, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {isPlaying ? <Pause size={13} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Top-level: personal lists + group lists ---------- */
  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader title="Practice Lists" subtitle="Personal & group playlists" />

      <div style={{ padding: "18px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink }}>Your Practice Lists</div>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {personalLists.map((list) => (
            <button
              key={list.id} onClick={() => setOpenListId(list.id)} className="dvbc-tap"
              style={{
                width: 108, height: 108, borderRadius: 16, flexShrink: 0, border: "none", cursor: "pointer",
                background: list.cover_url ? `url(${list.cover_url}) center/cover` : GRADIENT,
                display: "flex", alignItems: "flex-end", padding: 10, position: "relative", overflow: "hidden",
              }}
            >
              {!list.cover_url && (
                <ListMusic size={18} color="rgba(255,255,255,0.5)" style={{ position: "absolute", top: 10, right: 10 }} />
              )}
              <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.4)", textAlign: "left" }}>{list.title}</span>
            </button>
          ))}
          <button
            onClick={() => { setEditingList(null); setListContext("personal"); setListForm({ title: "", voice_part: "All" }); setShowListForm(true); }}
            className="dvbc-tap"
            style={{
              width: 108, height: 108, borderRadius: 16, flexShrink: 0, border: `1.6px dashed ${C.lilacLine}`, cursor: "pointer",
              background: C.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Plus size={20} color={C.plum} />
            <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>New List</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "22px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink }}>Group Practice Lists</div>
        <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 10, padding: "2px 6px" }}>
          <select
            value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 12.5, background: "transparent", color: C.ink, padding: "7px 2px" }}
          >
            {parts.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: "14px 24px 0" }}>
        {isAdmin && (
          <button
            onClick={() => { setEditingList(null); setListContext("group"); setListForm({ title: "", voice_part: "All" }); setShowListForm(true); }}
            className="dvbc-tap"
            style={{ background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
          >
            + Add Group List
          </button>
        )}

        {loading && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "20px 0" }}>Loading…</div>}
        {!loading && filteredGroupLists.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No group practice lists yet.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {filteredGroupLists.map((list) => (
            <button
              key={list.id} onClick={() => setOpenListId(list.id)} className="dvbc-tap"
              style={{
                textAlign: "left", border: "none", cursor: "pointer", borderRadius: 16, overflow: "hidden",
                height: 140, position: "relative",
                background: list.cover_url ? `url(${list.cover_url}) center/cover` : GRADIENT,
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(37,26,44,0.75) 0%, rgba(37,26,44,0.05) 55%, transparent 100%)" }} />
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
                <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.title}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10.5, marginTop: 2 }}>{list.voice_part} · {list.tracks.length} track{list.tracks.length === 1 ? "" : "s"}</div>
              </div>
              <div style={{ position: "absolute", right: 10, bottom: 10, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Play size={12} color={C.garnet} fill={C.garnet} />
              </div>
              {isAdmin && (
                <div
                  onClick={(e) => { e.stopPropagation(); startEditList(list); }}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "3px 8px", fontSize: 9.5, fontWeight: 700, color: C.plum }}
                >
                  Edit
                </div>
              )}
            </button>
          ))}
        </div>

        {showListForm && (
          <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 16 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
              {editingList ? "Edit List" : listContext === "personal" ? "New Personal List" : "New Group List"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} placeholder="List title" value={listForm.title} onChange={(e) => setListForm({ ...listForm, title: e.target.value })} />
              {listContext === "group" && (
                <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px" }}>
                  <select
                    value={listForm.voice_part}
                    onChange={(e) => setListForm({ ...listForm, voice_part: e.target.value })}
                    style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                  >
                    <option value="All">All</option>
                    {VOICE_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => setListCoverFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
            </div>
            {listError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 10 }}>
                <AlertCircle size={13} /> {listError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={saveList} disabled={savingList} className="dvbc-tap" style={{ flex: 1, background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingList ? "default" : "pointer", opacity: savingList ? 0.8 : 1 }}>
                {savingList ? "Saving…" : "Save"}
              </button>
              <button onClick={resetListForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                Cancel
              </button>
              {editingList && canManage(editingList) && (
                <button onClick={() => deleteList(editingList)} className="dvbc-tap" style={{ background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 13, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer" }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BottomNav({ screen, onNav }) {
  const items = [
    { key: "dashboard", label: "Home", icon: Home },
    { key: "attendance", label: "Attendance", icon: CheckSquare },
    { key: "practice", label: "Practice", icon: ListMusic },
    { key: "executives", label: "Execs", icon: Users },
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postSeenAt, setPostSeenAt] = useState(() => store.get("dvbc-post-seen", {}));
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);

  useEffect(() => { store.set("dvbc-favorites", favorites); }, [favorites]);
  useEffect(() => { store.set("dvbc-post-seen", postSeenAt); }, [postSeenAt]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setScreen("dashboard");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase
      .from("members")
      .select("*")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

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

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from("posts")
      .select("*, author:members!posts_author_id_fkey(id,name,avatar_url), comments:post_comments(*, author:members!post_comments_author_id_fkey(id,name,avatar_url))")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadPosts();

    const channel = supabase
      .channel("posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => loadPosts())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, loadPosts]);

  const submitPost = useCallback(async (content) => {
    if (!profile) return;
    await supabase.from("posts").insert({ author_id: profile.id, content });
    loadPosts();
  }, [profile, loadPosts]);

  const submitComment = useCallback(async (postId, content) => {
    if (!profile) return;
    await supabase.from("post_comments").insert({ post_id: postId, author_id: profile.id, content });
    loadPosts();
  }, [profile, loadPosts]);

  const markPostSeen = useCallback((postId) => {
    setPostSeenAt((prev) => ({ ...prev, [postId]: new Date().toISOString() }));
  }, []);

  const unreadPostCount = posts.filter((post) => {
    const lastSeen = postSeenAt[post.id];
    if (!lastSeen) return (post.comments || []).length > 0;
    return (post.comments || []).some((c) => new Date(c.created_at) > new Date(lastSeen));
  }).length;

  const unreadChatCount = conversations.reduce((total, conv) => {
    const mine = (conv.participants || []).find((p) => p.member_id === profile?.id);
    const lastRead = mine?.last_read_at;
    const unread = (conv.messages || []).filter((m) => m.sender_id !== profile?.id && (!lastRead || new Date(m.created_at) > new Date(lastRead))).length;
    return total + unread;
  }, 0);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    setLoadingConversations(true);
    const { data } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("member_id", profile.id);
    const ids = (data || []).map((r) => r.conversation_id);
    if (ids.length === 0) { setConversations([]); setLoadingConversations(false); return; }

    const { data: convos } = await supabase
      .from("conversations")
      .select(`
        *,
        participants:conversation_participants(member_id, last_read_at, member:members(id,name,avatar_url)),
        messages:chat_messages(*, sender:members(id,name,avatar_url))
      `)
      .in("id", ids);

    const sorted = (convos || []).map((c) => ({
      ...c,
      messages: (c.messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })).sort((a, b) => {
      const aLast = a.messages.length ? a.messages[a.messages.length - 1].created_at : a.created_at;
      const bLast = b.messages.length ? b.messages[b.messages.length - 1].created_at : b.created_at;
      return new Date(bLast) - new Date(aLast);
    });
    setConversations(sorted);
    setLoadingConversations(false);
  }, [profile]);

  useEffect(() => {
    if (!session || !profile) return;
    loadConversations();

    const channel = supabase
      .channel("chats-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => loadConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, () => loadConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, profile, loadConversations]);

  const createConversation = useCallback(async (memberIds, title, isGroup) => {
    if (!profile) return;

    if (!isGroup && memberIds.length === 1) {
      const existing = conversations.find((c) =>
        !c.is_group &&
        (c.participants || []).some((p) => p.member_id === memberIds[0])
      );
      if (existing) {
        setActiveConversationId(existing.id);
        return;
      }
    }

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ is_group: !!isGroup, title: isGroup ? title : null, created_by: profile.id })
      .select()
      .single();
    if (convError || !conv) return;

    const participantRows = [profile.id, ...memberIds].map((member_id) => ({
      conversation_id: conv.id,
      member_id,
    }));
    await supabase.from("conversation_participants").insert(participantRows);

    await loadConversations();
    setActiveConversationId(conv.id);
  }, [profile, conversations, loadConversations]);  const sendChatMessage = useCallback(async (conversationId, content) => {
    if (!profile) return;
    await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: profile.id, content });
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("member_id", profile.id);
  }, [profile]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!profile) return;
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("member_id", profile.id);
    setConversations((prev) => prev.map((c) => {
      if (c.id !== conversationId) return c;
      return {
        ...c,
        participants: (c.participants || []).map((p) =>
          p.member_id === profile.id ? { ...p, last_read_at: new Date().toISOString() } : p
        ),
      };
    }));
  }, [profile]);

  const openConversation = useCallback((id) => setActiveConversationId(id), []);
  const closeConversation = useCallback(() => setActiveConversationId(null), []);

  const cycleMemberStatus = useCallback(async (member) => {
    const order = ["present", "absent", "excused"];
    const next = order[(order.indexOf(member.status) + 1) % order.length];
    await supabase.from("members").update({ status: next }).eq("id", member.id);
  }, []);

  const clockIn = useCallback(async () => {
    if (!profile) return;
    setClockingIn(true);
    setClockInError("");
    const { error } = await supabase
      .from("members")
      .update({ status: "present", clocked_in_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) setClockInError(error.message || "Could not clock in. Please try again.");
    setClockingIn(false);
  }, [profile]);

  const uploadAvatar = useCallback(async (file) => {
    if (!profile) return;
    setAvatarError("");
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Please choose a JPG, PNG, WEBP, or HEIC photo.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Photo must be under 8MB.");
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("members")
        .update({ avatar_url: data.publicUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      setProfile((prev) => (prev ? { ...prev, avatar_url: data.publicUrl } : prev));
    } catch (err) {
      setAvatarError(err.message || "Could not upload photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }, [profile]);

  const approveMember = useCallback(async (memberId) => {
    await supabase.from("members").update({ approval_status: "approved" }).eq("id", memberId);
  }, []);

  const rejectMember = useCallback(async (memberId) => {
    await supabase.from("members").update({ approval_status: "rejected" }).eq("id", memberId);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }, []);

  const TAP_STYLES = `
    .dvbc-tap { transition: opacity 0.15s ease, transform 0.15s ease; }
    .dvbc-tap:active { opacity: 0.7; transform: scale(0.97); }
    .dvbc-row:active { background: ${C.lilacSoft}; }
  `;

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.parchment }}>
        <div style={{ color: C.inkSoft, fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "Inter, system-ui, sans-serif" }}>
        <style>{TAP_STYLES}</style>
        <LoginScreen onAuthed={() => {}} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.parchment }}>
        <div style={{ color: C.inkSoft, fontSize: 13 }}>Loading your profile…</div>
      </div>
    );
  }

  if (profile.approval_status === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "Inter, system-ui, sans-serif" }}>
        <style>{TAP_STYLES}</style>
        <PendingApproval profile={profile} onLogout={logout} />
      </div>
    );
  }

  const isAdmin = !!profile.is_admin;
  let content;
  if (screen === "dashboard") content = <Dashboard profile={profile} members={members} onNav={setScreen} unreadCount={unreadPostCount + unreadChatCount} />;
  else if (screen === "attendance") content = (
    <Attendance members={members} loading={loadingMembers} onCycle={cycleMemberStatus} isAdmin={isAdmin}
      profile={profile} onClockIn={clockIn} clockingIn={clockingIn} clockInError={clockInError} />
  );
  else if (screen === "library") content = <Library favorites={favorites} toggleFavorite={toggleFavorite} />;
  else if (screen === "messages") content = (
    <Messages posts={posts} loading={loadingPosts} isAdmin={isAdmin} profile={profile}
      onBack={() => setScreen("dashboard")} onSubmitPost={submitPost} onSubmitComment={submitComment}
      seenMap={postSeenAt} onMarkSeen={markPostSeen} members={members} conversations={conversations}
      loadingConversations={loadingConversations} activeConversationId={activeConversationId}
      onOpenConversation={openConversation} onCloseConversation={closeConversation}
      onCreateConversation={createConversation} onSendChatMessage={sendChatMessage}
      onMarkConversationRead={markConversationRead} />
  );
  else if (screen === "executives") content = <Executives isAdmin={isAdmin} />;
  else if (screen === "practice") content = <PracticeLists isAdmin={isAdmin} profile={profile} />;
  else if (screen === "privacy") content = <StaticPage title="Privacy Policy" content={PRIVACY_POLICY_TEXT} onBack={() => setScreen("profile")} />;
  else if (screen === "about") content = <StaticPage title="About Us" content={ABOUT_TEXT} onBack={() => setScreen("profile")} />;
  else if (screen === "profile") content = (
    <Profile profile={profile} members={members} onLogout={logout} isAdmin={isAdmin}
      onApprove={approveMember} onReject={rejectMember} onUploadAvatar={uploadAvatar}
      avatarUploading={avatarUploading} avatarError={avatarError}
      onNavSettings={(nav) => setScreen(nav)} />
  );

  const showBottomNav = ["dashboard", "attendance", "library", "practice", "executives", "profile"].includes(screen);

  return (
    <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{TAP_STYLES}</style>
      {content}
      {showBottomNav && <BottomNav screen={screen} onNav={setScreen} />}
    </div>
  );
                                                                                        }

 
