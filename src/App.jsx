import AgoraRTC from "agora-rtc-sdk-ng";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, CheckSquare, Music2, User, Search, Bell, Play, Pause, LogOut,
  ChevronLeft, Star, Mail, Lock, Eye, EyeOff, Clock, MapPin, AlertCircle, UserPlus, Camera, Users, ListMusic, FileText,
  Repeat, RotateCcw, RotateCw, X, Plus, Minus, Gauge, Download, WifiOff, MessageCircle, Phone, Trash2, Mic, Square,
  PhoneOff, Video, VideoOff, MicOff } from "lucide-react";
import logoImg from "./assets/logo.jpg";
import photoImg from "./assets/chorale-photo.jpg";
import photoImg2 from "./assets/chorale-photo-2.jpg";
import photoImg3 from "./assets/chorale-photo-3.jpg";
import { supabase } from "./supabaseClient";import StaffRenderer from "./components/StaffRenderer";import NotationFlashcards from "./components/NotationFlashcards";import RhythmGame from "./components/RhythmGame";
import { generateICS, downloadICS } from './utils/dvbc-ics-export.js';
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ---------- Design tokens: "Sunday Performance" warm concert-hall palette ---------- */
/* Actual values live in LIGHT_THEME/DARK_THEME below; this is just the initial shape. */
const C = {
  garnet: "#8A2332",
  garnetDark: "#5C1420",
  plum: "#C99A3E",
  accent: "#8A2332",
  lilac: "#D9B98A",
  lilacSoft: "#F5E9D3",
  lilacLine: "#EAD9B8",
  ink: "#2B2119",
  inkSoft: "#7A6952",
  card: "#FFFFFF",
  parchment: "#FBF6EC",
  sage: "#4F7A5C",
  sageBg: "#E7F1E9",
  roseDeep: "#B23368",
  roseBg: "#FBEAF1",
  amberBg: "#F6EFD8",
  amberText: "#8A6C24",
};

// A function (not a fixed string) so it always reflects the *current* theme's
// colors — previously this was computed once at module load using light-mode
// values only, so dark mode never actually changed any gradient anywhere.
function gradient() {
  return `linear-gradient(135deg, ${C.garnetDark} 0%, ${C.garnet} 45%, ${C.plum} 100%)`;
}
const VOICE_PARTS = ["Soprano I", "Soprano II", "Alto I", "Alto II", "Tenor I", "Tenor II", "Bass I", "Bass II"];
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/625qw7lnZ6C7tYDOs7ioC3?s=sh&p=a&mlu=4";
const HERO_PHOTOS = [photoImg, photoImg2, photoImg3];
const VAPID_PUBLIC_KEY = "BDzWf6BxsVtZVzYvLjyGQhjDhelmBo80UzyOW_MWrIyft90hWzOK_uq7e8C9aCtdLxWURx4KkBv0v_THjrJxu2s";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/* ---------- Theming: "Sunday Performance" (light) / "Evening Concert" (dark) ---------- */
const LIGHT_THEME = {
  garnet: "#8A2332",
  garnetDark: "#5C1420",
  plum: "#C99A3E",
  accent: "#8A2332",
  lilac: "#D9B98A",
  lilacSoft: "#F5E9D3",
  lilacLine: "#EAD9B8",
  ink: "#2B2119",
  inkSoft: "#7A6952",
  card: "#FFFFFF",
  parchment: "#FBF6EC",
  sage: "#4F7A5C",
  sageBg: "#E7F1E9",
  roseDeep: "#B23368",
  roseBg: "#FBEAF1",
  amberBg: "#F6EFD8",
  amberText: "#8A6C24",
};
const DARK_THEME = {
  garnet: "#2A1750",
  garnetDark: "#140B26",
  plum: "#E24B9C",
  accent: "#E24B9C",
  lilac: "#4A3C7A",
  lilacSoft: "#241A3D",
  lilacLine: "#3D2A5C",
  ink: "#F3ECE0",
  inkSoft: "#B3A3C9",
  card: "#1E1436",
  parchment: "#0F0820",
  sage: "#5FE0A0",
  sageBg: "#173325",
  roseDeep: "#FF6FA8",
  roseBg: "#3A1B28",
  amberBg: "#3A2E14",
  amberText: "#F2C065",
};
function applyTheme(mode) {
  Object.assign(C, mode === "dark" ? DARK_THEME : LIGHT_THEME);
}
// Apply saved preference immediately at module load, before first render, to avoid a flash.
applyTheme(store_get("dvbc-dark-mode", false) ? "dark" : "light");
function store_get(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}


/* ---------- Small utilities: haptics + per-person avatar color ---------- */
function haptic(pattern = 10) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
}

// Rhythmic haptic for rapid repeated taps (e.g. marking attendance down a roster).
// Consecutive taps within RHYTHM_WINDOW_MS build a short "streak" that shortens and
// sharpens the buzz each time, like a beat picking up tempo. A pause resets it, so a
// single isolated tap always feels like a plain, simple tick.
const RHYTHM_WINDOW_MS = 650;
let _rhythmLastTapAt = 0;
let _rhythmStreak = 0;
function rhythmicHaptic() {
  const now = Date.now();
  _rhythmStreak = (now - _rhythmLastTapAt) < RHYTHM_WINDOW_MS ? _rhythmStreak + 1 : 1;
  _rhythmLastTapAt = now;
  // Streak 1: a plain single tick. As the streak builds, taps get shorter/crisper
  // (like a tempo increasing) up to a steady quick "16th note" pulse at streak 4+.
  if (_rhythmStreak <= 1) haptic(10);
  else if (_rhythmStreak === 2) haptic(9);
  else if (_rhythmStreak === 3) haptic([6, 4, 6]);
  else haptic([5, 3, 5]);
}

/* ---------- Synthesized notification chime (no audio asset needed) ---------- */
let _audioCtx = null;
function playChime() {
  try {
    if (!store.get("dvbc-sound-enabled", true)) return;
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    const now = _audioCtx.currentTime;
    [[880, 0], [1320, 0.09]].forEach(([freq, delay]) => {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.14, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  } catch (e) { /* audio unsupported/blocked */ }
}

const AVATAR_PALETTE = [
  { bg: "#F1EDFC", fg: "#7A56D6" }, { bg: "#E7F1E9", fg: "#3E7A50" }, { bg: "#FBEAF1", fg: "#B23368" },
  { bg: "#F6EFD8", fg: "#8A6C24" }, { bg: "#E3F0FA", fg: "#2E6FA0" }, { bg: "#F4E7DA", fg: "#A05A2E" },
  { bg: "#EAE6FA", fg: "#5B4AA8" }, { bg: "#E9F5EE", fg: "#2E8067" },
];
function avatarColorFor(name) {
  const str = name || "?";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/* ---------- Shared shimmer/skeleton loading block ---------- */
function Skeleton({ height = 14, width = "100%", radius = 8, style = {} }) {
  return (
    <div
      className="dvbc-skeleton"
      style={{ height, width, borderRadius: radius, background: C.lilacSoft, ...style }}
    />
  );
}
function BrandSpinner({ label = "Loading…" }) {
  const bars = [0, 1, 2, 3, 4];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 26 }}>
        {bars.map((i) => (
          <div key={i} className="dvbc-eq-bar" style={{
            width: 4, borderRadius: 2, background: C.plum,
            animationDelay: `${i * 0.11}s`,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.inkSoft }}>{label}</div>
    </div>
  );
}

/* ---------- Circular ring progress (attendance, pieces-ready, etc.) ---------- */
function RingProgress({ value = 0, size = 64, strokeWidth = 7, color, track, children }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || C.lilacLine} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || C.garnet} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Auto-rotating hero photo carousel ---------- */
function HeroCarousel({ photos, height = 190, intervalMs = 4500 }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  useEffect(() => {
    if (photos.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), intervalMs);
    return () => clearInterval(id);
  }, [photos.length, intervalMs]);

  const goTo = (i) => setIndex(((i % photos.length) + photos.length) % photos.length);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 40) goTo(index - 1);
    else if (diff < -40) goTo(index + 1);
    touchStartX.current = null;
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height, overflow: "hidden" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
    >
      {photos.map((src, i) => (
        <img
          key={src}
          src={src} alt="De Voci Belli Chorale members"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block",
            opacity: i === index ? 1 : 0, transition: "opacity 0.6s ease",
          }}
        />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(36,18,70,0.88) 0%, rgba(36,18,70,0.15) 55%, rgba(36,18,70,0) 100%)" }} />
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Our Chorale</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, marginTop: 3 }}>Beautiful voices, one family</div>
      </div>
      {photos.length > 1 && (
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5 }}>
          {photos.map((_, i) => (
            <div
              key={i} onClick={() => goTo(i)}
              style={{
                width: i === index ? 16 : 6, height: 6, borderRadius: 999, cursor: "pointer",
                background: i === index ? "#fff" : "rgba(255,255,255,0.45)", transition: "width 0.25s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Confetti burst (check-in celebration) ---------- */
const CONFETTI_COLORS = ["#7A56D6", "#C6B8F0", "#4C2E9E", "#F6C453", "#57C7A0"];
function ConfettiBurst({ burstKey }) {
  if (!burstKey) return null;
  const pieces = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div key={burstKey} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map((i) => {
        const left = 45 + Math.random() * 10;
        const dx = (Math.random() - 0.5) * 220;
        const delay = Math.random() * 0.15;
        const dur = 0.9 + Math.random() * 0.5;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 6 + Math.random() * 5;
        return (
          <span
            key={i}
            style={{
              position: "absolute", top: "38%", left: `${left}%`, width: size, height: size * 0.5,
              background: color, borderRadius: 2,
              animation: `dvbcConfetti ${dur}s ease-out ${delay}s forwards`,
              "--dx": `${dx}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- First-time onboarding tour ---------- */
const ONBOARDING_SLIDES = [
  { Icon: Home, title: "Welcome to DVBC", body: "Your home for rehearsals, scores, and everything chorale — all in one place." },
  { Icon: CheckSquare, title: "Track Attendance", body: "Check in to rehearsals and events right from your phone the moment check-in opens." },
  { Icon: Music2, title: "Announcements & Library", body: "Catch every update on Home, and pull up scores or recordings anytime in Library." },
];
/* ---------- Lightweight in-app toast (new post/message alerts) ---------- */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div
      onClick={onClose}
      className="dvbc-screen-enter"
      style={{
        position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 16, right: 16, zIndex: 9998,
        background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: "13px 14px",
        boxShadow: "0 10px 28px rgba(36,18,70,0.22)", display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%", background: gradient(), flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={14} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{toast.title}</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toast.body}</div>
      </div>
    </div>
  );
}

function OnboardingTour({ profile }) {
  const key = profile?.id ? `dvbc-onboarded-${profile.id}` : null;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!key || profile?.approval_status !== "approved") return;
    if (!store.get(key, false)) setVisible(true);
  }, [key, profile?.approval_status]);

  if (!visible) return null;
  const dismiss = () => {
    if (key) store.set(key, true);
    setVisible(false);
  };
  const slide = ONBOARDING_SLIDES[step];
  const isLast = step === ONBOARDING_SLIDES.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, background: "rgba(20,12,40,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        width: "100%", maxWidth: 460, background: C.card, borderRadius: "24px 24px 0 0",
        padding: "28px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)", boxSizing: "border-box",
      }} className="dvbc-screen-enter">
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: gradient(),
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <slide.Icon size={24} color="#fff" />
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, color: C.ink }}>{slide.title}</div>
        <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5 }}>{slide.body}</div>

        <div style={{ display: "flex", gap: 6, marginTop: 22 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? C.plum : C.lilacLine }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {!isLast && (
            <button onClick={dismiss} className="dvbc-tap" style={{ flex: 1, background: "transparent", border: `1px solid ${C.lilacLine}`, color: C.inkSoft, fontWeight: 600, fontSize: 13, padding: "12px 0", borderRadius: 12, cursor: "pointer" }}>
              Skip
            </button>
          )}
          <button
            onClick={() => { haptic(8); isLast ? dismiss() : setStep((s) => s + 1); }}
            className="dvbc-tap"
            style={{ flex: 1, background: gradient(), border: "none", color: "#fff", fontWeight: 700, fontSize: 13, padding: "12px 0", borderRadius: 12, cursor: "pointer" }}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

/* ---------- Event-based attendance helpers ---------- */
// Check-in opens 15 minutes before an event's start_time and stays open until end_time.
function isEventCheckInOpen(event) {
  if (!event || !event.track_attendance) return false;
  const now = Date.now();
  const start = new Date(event.start_time).getTime() - 15 * 60000;
  const end = new Date(event.end_time).getTime();
  return now >= start && now <= end;
}

function getEventPhase(event) {
  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "ongoing";
}

// "Today", "Tomorrow", or a short date, for event list headers.
function formatEventDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
}

function formatEventTimeRange(event) {
  const opts = { hour: "numeric", minute: "2-digit", hour12: true };
  const start = new Date(event.start_time).toLocaleTimeString("en-NG", opts);
  const end = new Date(event.end_time).toLocaleTimeString("en-NG", opts);
  return `${formatEventDay(event.start_time)} · ${start} – ${end}`;
}

// <input type="datetime-local"> uses local wall-clock time with no timezone; this
// converts an ISO string to that format for pre-filling edit forms.
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- Offline media (Cache Storage API — sandboxed inside the app/browser;
   nothing is written to the device's own Downloads folder or file system) ---------- */
const OFFLINE_AUDIO_CACHE = "dvbc-audio-v1";
const OFFLINE_SHEETS_CACHE = "dvbc-sheets-v1";
const offlineSupported = () => typeof window !== "undefined" && "caches" in window;

// Sheet PDFs are served via signed URLs that rotate every 5 minutes, so we key
// the offline copy by the stable storage path instead of the URL.
function sheetCacheRequest(path) {
  return new Request(`https://dvbc-offline.local/sheets/${encodeURIComponent(path)}`);
}

async function isAudioDownloaded(url) {
  if (!url || !offlineSupported()) return false;
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  return !!(await cache.match(url));
}

async function downloadAudioOffline(url) {
  if (!offlineSupported()) return { error: "Offline downloads aren't supported on this device." };
  if (!url) return { error: "This track has no audio yet." };
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE);
    await cache.add(url);
    return {};
  } catch {
    return { error: "Could not save for offline use. Please try again." };
  }
}

async function removeAudioOffline(url) {
  if (!url || !offlineSupported()) return;
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  await cache.delete(url);
}

// Prefer a downloaded copy so playback works with no connection at all.
async function getPlayableAudioSrc(url) {
  if (url && offlineSupported()) {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE);
    const cached = await cache.match(url);
    if (cached) return URL.createObjectURL(await cached.blob());
  }
  return url;
}

async function isSheetDownloaded(path) {
  if (!path || !offlineSupported()) return false;
  const cache = await caches.open(OFFLINE_SHEETS_CACHE);
  return !!(await cache.match(sheetCacheRequest(path)));
}

async function downloadSheetOffline(path) {
  if (!offlineSupported()) return { error: "Offline downloads aren't supported on this device." };
  if (!path) return { error: "No sheet attached to this track." };
  try {
    const { data, error: signError } = await supabase.storage.from("practice-sheets").createSignedUrl(path, 300);
    if (signError || !data?.signedUrl) throw new Error("Could not reach the sheet music.");
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("Could not reach the sheet music.");
    const cache = await caches.open(OFFLINE_SHEETS_CACHE);
    await cache.put(sheetCacheRequest(path), response);
    return {};
  } catch (err) {
    return { error: err.message || "Could not save for offline use. Please try again." };
  }
}

async function removeSheetOffline(path) {
  if (!path || !offlineSupported()) return;
  const cache = await caches.open(OFFLINE_SHEETS_CACHE);
  await cache.delete(sheetCacheRequest(path));
}

// Returns an in-memory blob URL for a downloaded sheet, or null if it hasn't
// been saved for offline use — the PDF still only ever lives inside the
// browser's app-sandboxed cache, never the device's shared file system.
async function getSheetOfflineBlobUrl(path) {
  if (!path || !offlineSupported()) return null;
  const cache = await caches.open(OFFLINE_SHEETS_CACHE);
  const cached = await cache.match(sheetCacheRequest(path));
  if (!cached) return null;
  return URL.createObjectURL(await cached.blob());
}

function OfflineToggle({ downloaded, busy, onDownload, onRemove, size = 15 }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (busy) return; downloaded ? onRemove() : onDownload(); }}
      disabled={busy} className="dvbc-tap" title={downloaded ? "Downloaded for offline use — tap to remove" : "Save for offline use"}
      style={{ background: "none", border: "none", cursor: busy ? "default" : "pointer", display: "flex", padding: 0, opacity: busy ? 0.5 : 1 }}
    >
      {downloaded ? <CheckSquare size={size} color={C.sage} /> : <Download size={size} color={C.inkSoft} />}
    </button>
  );
}

function formatClockTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
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

// A member counts as "online" if their heartbeat landed in the last 2 minutes.
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
function isOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}
function presenceLabel(lastSeenAt) {
  if (isOnline(lastSeenAt)) return "Online";
  if (!lastSeenAt) return "Offline";
  return `Last seen ${timeAgo(lastSeenAt)}`;
}
function PresenceDot({ online, size = 10 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: online ? "#3FB27F" : "#C7C1D6", border: "2px solid #fff",
      display: "inline-block",
    }} />
  );
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
        background: active ? gradient() : "#fff",
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
  const [mode, setMode] = useState("signin"); // "signin" | "register" | "forgot"
  const [name, setName] = useState("");
  const [part, setPart] = useState(VOICE_PARTS[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Enter your email to reset your password.");
        return;
      }
      setBusy(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setNotice("Check your email for a password reset link.");
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

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
      <div style={{ background: gradient(), padding: "calc(env(safe-area-inset-top, 0px) + 40px) 32px 30px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <img src={logoImg} alt="logo" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600 }}>
          De Voci Belli <span style={{ fontStyle: "italic", color: C.lilac }}>Chorale</span>
        </div>
        <div style={{ color: C.lilac, fontSize: 11, letterSpacing: 4, fontWeight: 700, marginTop: 3 }}>NIGERIA</div>
        <div style={{ margin: "18px 30px 0" }}><Staff light /></div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, letterSpacing: 2, fontWeight: 600, marginTop: 14 }}>
          MEMBERS PORTAL
        </div>
      </div>

      <div style={{ flex: 1, background: C.parchment, borderRadius: "26px 26px 0 0", marginTop: -18, padding: "30px 26px calc(env(safe-area-inset-bottom, 0px) + 30px)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.ink, marginBottom: 6 }}>
          {mode === "signin" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Join the chorale"}
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {mode === "signin"
            ? "Sign in to view rehearsals, mark attendance, and reach your music library."
            : mode === "forgot"
            ? "Enter the email on your account and we'll send you a link to set a new password."
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

          {mode !== "forgot" && (
            <>
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
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
              className="dvbc-tap"
              style={{ display: "block", marginLeft: "auto", fontSize: 11.5, color: C.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0 2px" }}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 12, margin: "6px 0" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {notice && (
            <div style={{ color: C.sage, fontSize: 12, margin: "6px 0", lineHeight: 1.5 }}>
              {notice}
            </div>
          )}

          <button
            type="submit" disabled={busy} className="dvbc-tap"
            style={{
              width: "100%", background: gradient(), color: "#fff", fontWeight: 600, fontSize: 15,
              padding: 16, borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.8 : 1, marginTop: mode === "signin" ? 20 : 4,
            }}
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "#BBAEC4", margin: "18px 0", letterSpacing: 1 }}>— OR —</div>
        <button
          onClick={() => { setMode(mode === "register" ? "signin" : mode === "forgot" ? "signin" : "register"); setError(""); setNotice(""); }}
          className="dvbc-tap"
          style={{ width: "100%", textAlign: "center", fontSize: 11.5, color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }}
        >
          {mode === "signin"
            ? <>New member? <span style={{ color: C.accent, fontWeight: 700 }}>Register here</span></>
            : mode === "forgot"
            ? <>Remembered it? <span style={{ color: C.accent, fontWeight: 700 }}>Back to sign in</span></>
            : <>Already registered? <span style={{ color: C.accent, fontWeight: 700 }}>Sign in</span></>}
        </button>
      </div>
    </div>
  );
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      onDone();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ background: gradient(), padding: "calc(env(safe-area-inset-top, 0px) + 40px) 32px 30px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <img src={logoImg} alt="logo" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600 }}>
          De Voci Belli <span style={{ fontStyle: "italic", color: C.lilac }}>Chorale</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, letterSpacing: 2, fontWeight: 600, marginTop: 14 }}>
          SET A NEW PASSWORD
        </div>
      </div>

      <div style={{ flex: 1, background: C.parchment, borderRadius: "26px 26px 0 0", marginTop: -18, padding: "30px 26px calc(env(safe-area-inset-bottom, 0px) + 30px)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.ink, marginBottom: 6 }}>
          Choose a new password
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          You're signed in via your reset link — pick a new password to finish.
        </div>

        <form onSubmit={submit}>
          <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>New Password</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "12px 14px", margin: "6px 0 16px" }}>
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

          <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>Confirm Password</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "12px 14px", margin: "6px 0 8px" }}>
            <Lock size={16} color={C.inkSoft} />
            <input
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••" type={showPw ? "text" : "password"}
              style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent", color: C.ink }}
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 12, margin: "6px 0" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit" disabled={busy} className="dvbc-tap"
            style={{
              width: "100%", background: gradient(), color: "#fff", fontWeight: 600, fontSize: 15,
              padding: 16, borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.8 : 1, marginTop: 20,
            }}
          >
            {busy ? "Please wait…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PendingApproval({ profile, onLogout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ background: gradient(), padding: "calc(env(safe-area-inset-top, 0px) + 40px) 32px 30px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <img src={logoImg} alt="logo" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600 }}>
          De Voci Belli <span style={{ fontStyle: "italic", color: C.lilac }}>Chorale</span>
        </div>
        <div style={{ color: C.lilac, fontSize: 11, letterSpacing: 4, fontWeight: 700, marginTop: 3 }}>NIGERIA</div>
      </div>

      <div style={{ flex: 1, background: C.parchment, borderRadius: "26px 26px 0 0", marginTop: -18, padding: "40px 26px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Clock size={26} color={C.amberText} />
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 8 }}>
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
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: C.ink }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>{subtitle}</div>}
      <div style={{ marginTop: 14 }}><Staff /></div>
    </div>
  );
}

// Next occurrence of a member's birthday, ignoring year (handles the Dec->Jan wrap).
function daysUntilBirthday(dob) {
  if (!dob) return null;
  const [, m, d] = dob.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next - today) / 86400000);
}
function isBirthdayToday(dob) {
  return daysUntilBirthday(dob) === 0;
}

function UpcomingBirthdays({ members }) {
  const upcoming = (members || [])
    .filter((m) => m.date_of_birth)
    .map((m) => ({ ...m, daysUntil: daysUntilBirthday(m.date_of_birth) }))
    .filter((m) => m.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.5, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", marginBottom: 10 }}>
        🎂 Upcoming Birthdays
      </div>
      {upcoming.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
          <div style={{ fontSize: 13, color: C.ink }}>{m.name}</div>
          <div style={{ fontSize: 11.5, color: m.daysUntil === 0 ? C.garnet : C.inkSoft, fontWeight: m.daysUntil === 0 ? 700 : 400 }}>
            {m.daysUntil === 0 ? "Today 🎉" : m.daysUntil === 1 ? "Tomorrow" : formatBirthday(m.date_of_birth)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ profile, members, events, posts, pieces, isAdmin, onSubmitPost, onNav, unreadCount = 0, onCheckIn, checkingIn, checkInError }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  const displayName = profile?.name ? profile.name.split(" ")[0] : "Member";

  const [refreshTick, setRefreshTick] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const announcementsRef = useRef(null);
  const touchStartY = useRef(null);
  const scrollRef = useRef(null);
  const PULL_THRESHOLD = 64;

  const handleTouchStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) touchStartY.current = e.touches[0].clientY;
    else touchStartY.current = null;
  };
  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setPullY(Math.min(diff * 0.5, 90));
  };
  const handleTouchEnd = () => {
    if (pullY > PULL_THRESHOLD) {
      setRefreshing(true);
      haptic(15);
      setTimeout(() => { setRefreshTick((t) => t + 1); setRefreshing(false); }, 500);
    }
    setPullY(0);
    touchStartY.current = null;
  };

  const [attendancePct, setAttendancePct] = useState(null);
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    supabase.from("attendance_records").select("status").eq("member_id", profile.id).not("event_id", "is", null)
      .then(({ data }) => {
        if (!active) return;
        const rows = data || [];
        setAttendancePct(rows.length ? Math.round((rows.filter((r) => r.status === "present").length / rows.length) * 100) : 0);
      });
    return () => { active = false; };
  }, [profile?.id, refreshTick]);

  // Nearest event that hasn't ended yet (ongoing takes priority over merely upcoming).
  const now = Date.now();
  const upcoming = (events || [])
    .filter((e) => new Date(e.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const nextEvent = upcoming[0] || null;
  const phase = nextEvent ? getEventPhase(nextEvent) : null;
  const checkInOpen = nextEvent ? isEventCheckInOpen(nextEvent) : false;

  const [myEventRecord, setMyEventRecord] = useState(null);
  useEffect(() => {
    if (!profile?.id || !nextEvent?.id) { setMyEventRecord(null); return; }
    let active = true;
    supabase.from("attendance_records").select("status").eq("member_id", profile.id).eq("event_id", nextEvent.id).maybeSingle()
      .then(({ data }) => { if (active) setMyEventRecord(data || null); });
    return () => { active = false; };
  }, [profile?.id, nextEvent?.id, checkingIn, refreshTick]);
  const alreadyCheckedIn = myEventRecord?.status === "present";

  // Celebrate a successful check-in with confetti + a haptic tick.
  const [confettiKey, setConfettiKey] = useState(0);
  const wasCheckedIn = useRef(false);
  useEffect(() => {
    if (alreadyCheckedIn && !wasCheckedIn.current) {
      setConfettiKey((k) => k + 1);
      haptic([10, 40, 10]);
    }
    wasCheckedIn.current = alreadyCheckedIn;
  }, [alreadyCheckedIn]);

  const announcements = (posts || []).slice(0, 3).map((p) => ({
    id: p.id,
    title: p.content.length > 90 ? `${p.content.slice(0, 90)}…` : p.content,
    time: `Posted ${timeAgo(p.created_at)}`,
  }));

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const submitAnnouncement = async () => {
    if (!draft.trim() || !onSubmitPost) return;
    setPosting(true);
    haptic(10);
    await onSubmitPost(draft.trim());
    setPosting(false);
    setDraft("");
    setComposerOpen(false);
  };

  return (
    <div
      ref={scrollRef}
      style={{ paddingBottom: 110, minHeight: "100%", overflowY: "auto" }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <ConfettiBurst burstKey={confettiKey} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", height: pullY > 0 || refreshing ? 44 : 0,
        overflow: "hidden", transition: refreshing ? "none" : "height 0.2s ease",
      }}>
        <div className={refreshing ? "dvbc-spin" : ""} style={{
          width: 22, height: 22, borderRadius: "50%", border: `2.5px solid ${C.lilacLine}`, borderTopColor: C.plum,
          transform: refreshing ? "none" : `rotate(${Math.min(pullY, PULL_THRESHOLD) * 3.6}deg)`,
          opacity: Math.min(pullY / PULL_THRESHOLD, 1),
        }} />
      </div>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>{greeting}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: C.ink, marginTop: 2 }}>{displayName}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => announcementsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="dvbc-tap"
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
          <HeroCarousel photos={HERO_PHOTOS} height={190} />
        </div>

        {nextEvent ? (
          <button onClick={() => onNav("attendance")} className="dvbc-tap" style={{ display: "block", width: "100%", textAlign: "left", background: gradient(), borderRadius: 20, padding: 20, marginTop: 16, color: "#fff", position: "relative", border: "none", cursor: "pointer", overflow: "hidden" }}>
            {/* Faint sheet-music ruling in the background, purely decorative */}
            <div aria-hidden="true" style={{
              position: "absolute", inset: 0, opacity: 0.14, pointerEvents: "none",
              backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 8px, rgba(255,255,255,0.9) 8px, rgba(255,255,255,0.9) 9px)",
            }} />
            <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.16)", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 999 }}>
              {phase === "ongoing" ? "Ongoing" : formatEventDay(nextEvent.start_time)}
            </div>
            <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Next Event</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginTop: 8 }}>{nextEvent.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={13} /> {formatEventTimeRange(nextEvent)}
            </div>
            {nextEvent.location && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={13} /> {nextEvent.location}
              </div>
            )}
            {nextEvent.track_attendance && (
              <div
                onClick={(e) => { e.stopPropagation(); if (checkInOpen && !alreadyCheckedIn && !checkingIn) { haptic(10); onCheckIn(nextEvent.id); } }}
                className="dvbc-tap"
                style={{
                  marginTop: 14, textAlign: "center", fontWeight: 700, fontSize: 12.5, padding: 11, borderRadius: 12,
                  background: alreadyCheckedIn ? "rgba(255,255,255,0.22)" : checkInOpen ? "#fff" : "rgba(255,255,255,0.14)",
                  color: alreadyCheckedIn ? "#fff" : checkInOpen ? C.garnet : "rgba(255,255,255,0.6)",
                }}
              >
                {alreadyCheckedIn ? "You're checked in ✓" : checkInOpen ? (checkingIn ? "Checking in…" : "Check In") : phase === "ongoing" ? "Tap Attendance to check in" : "Check-in opens closer to the event"}
              </div>
            )}
            {checkInError && <div style={{ marginTop: 8, fontSize: 11, color: "#FBEAF1" }}>{checkInError}</div>}
            </div>
          </button>
        ) : (
          <div style={{ background: gradient(), borderRadius: 20, padding: 20, marginTop: 16, color: "#fff" }}>
            <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: C.lilac, textTransform: "uppercase" }}>Next Event</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, marginTop: 8 }}>No upcoming events yet</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={() => onNav("attendance")} className="dvbc-tap" style={{ flex: 1, textAlign: "left", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <RingProgress value={attendancePct ?? 0} size={46} strokeWidth={5} color={C.garnet} track={C.lilacLine}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{attendancePct === null ? "—" : `${attendancePct}%`}</span>
            </RingProgress>
            <div style={{ fontSize: 11, color: C.inkSoft }}>Your<br />Attendance</div>
          </button>
          <button onClick={() => onNav("library")} className="dvbc-tap" style={{ flex: 1, textAlign: "left", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: C.accent }}>
              {(pieces || []).filter((p) => p.is_ready).length}/{(pieces || []).length}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Pieces Ready</div>
          </button><button onClick={() => onNav("notation")} className="dvbc-tap" style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 14, textAlign: "center", cursor: "pointer" }}>
  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: C.garnet }}>♪</div>
  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Notation Trainer</div>
</button>
        </div>

        <UpcomingBirthdays members={members} />

        <a
          href={WHATSAPP_GROUP_LINK} target="_blank" rel="noopener noreferrer"
          className="dvbc-tap"
          style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 12, textDecoration: "none",
            background: "#25D366", color: "#fff", borderRadius: 16, padding: "14px 16px",
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <MessageCircle size={17} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Join our WhatsApp Group</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>Chat with the chorale outside the app</div>
          </div>
        </a>

        <div ref={announcementsRef} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink }}>Announcements</div>
          {isAdmin && (
            <button
              onClick={() => setComposerOpen((v) => !v)}
              className="dvbc-tap"
              style={{
                display: "flex", alignItems: "center", gap: 4, background: composerOpen ? C.lilacSoft : "transparent",
                border: `1px solid ${C.lilacLine}`, borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, color: C.plum,
              }}
            >
              <Plus size={13} /> {composerOpen ? "Cancel" : "New"}
            </button>
          )}
        </div>
        {isAdmin && composerOpen && (
          <div style={{ background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write an announcement for the chorale…"
              rows={3}
              style={{
                width: "100%", border: "none", outline: "none", resize: "none", fontFamily: "'Outfit', system-ui, sans-serif",
                fontSize: 13.5, color: C.ink, background: "transparent", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button
                onClick={submitAnnouncement}
                disabled={!draft.trim() || posting}
                className="dvbc-tap"
                style={{
                  background: draft.trim() ? gradient() : C.lilacLine, color: "#fff", border: "none", borderRadius: 999,
                  padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: draft.trim() ? "pointer" : "default",
                }}
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}
        {announcements.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "22px 0 14px", color: C.inkSoft }}>
            <Bell size={22} color={C.lilac} />
            <div style={{ fontSize: 12.5 }}>No announcements yet.</div>
          </div>
        )}
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

function EventFormPanel({ initial, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [startTime, setStartTime] = useState(initial ? toDatetimeLocalValue(initial.start_time) : "");
  const [endTime, setEndTime] = useState(initial ? toDatetimeLocalValue(initial.end_time) : "");
  const [trackAttendance, setTrackAttendance] = useState(initial ? initial.track_attendance : true);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !startTime || !endTime) {
      setError("Title, start time, and end time are required.");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (initial) {
        const { error: err } = await onSave.update(initial.id, {
          title: title.trim(), description: description.trim() || null, location: location.trim() || null,
          start_time: start.toISOString(), end_time: end.toISOString(), track_attendance: trackAttendance,
        });
        if (err) throw new Error(err);
      } else {
        const weeks = Math.max(1, Math.min(12, Number(repeatWeeks) || 1));
        for (let i = 0; i < weeks; i++) {
          const s = new Date(start); s.setDate(s.getDate() + i * 7);
          const e = new Date(end); e.setDate(e.getDate() + i * 7);
          const { error: err } = await onSave.create({
            title: title.trim(), description: description.trim() || null, location: location.trim() || null,
            start_time: s.toISOString(), end_time: e.toISOString(), track_attendance: trackAttendance,
          });
          if (err) throw new Error(err);
        }
      }
      onCancel();
    } catch (err) {
      setError(err.message || "Could not save event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", border: `1.4px solid ${C.lilacLine}`, borderRadius: 10, padding: "10px 12px",
    fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5, display: "block" };

  return (
    <div style={{ margin: "18px 24px 0", background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 14 }}>{initial ? "Edit Event" : "New Event"}</div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Title</label>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Rehearsal" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Location</label>
        <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="St. Peter's Anglican Church, Owerri" />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Starts</label>
          <input type="datetime-local" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Ends</label>
          <input type="datetime-local" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Description (optional)</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ink, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={trackAttendance} onChange={(e) => setTrackAttendance(e.target.checked)} />
        Enable attendance tracking (check-in + register) for this event
      </label>
      {!initial && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Repeat weekly</label>
          <select style={inputStyle} value={repeatWeeks} onChange={(e) => setRepeatWeeks(e.target.value)}>
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <option key={n} value={n}>{n === 1 ? "Just this once" : `${n} weeks`}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 12 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel} className="dvbc-tap"
          style={{ flex: 1, background: "#fff", color: C.inkSoft, fontWeight: 700, fontSize: 12.5, padding: 12, borderRadius: 12, border: `1.4px solid ${C.lilacLine}`, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={submit} disabled={saving} className="dvbc-tap"
          style={{ flex: 2, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: 12, borderRadius: 12, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.8 : 1 }}
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Create Event"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Cumulative attendance register, rolled up across every event ---------- */
const REGISTER_RANGES = [
  { key: "all", label: "All time", n: null },
  { key: "4", label: "Last 4", n: 4 },
  { key: "8", label: "Last 8", n: 8 },
  { key: "12", label: "Last 12", n: 12 },
];

function CumulativeRegister({ members, loadingMembers }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.from("attendance_records").select("member_id, status, rehearsal_date");
    if (err) { setError(err.message || "Could not load the register."); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("cumulative-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  // Distinct rehearsal dates present in the data, most recent first.
  const allDates = [...new Set(rows.map((r) => r.rehearsal_date).filter(Boolean))].sort((a, b) => new Date(b) - new Date(a));
  const activeRange = REGISTER_RANGES.find((r) => r.key === range) || REGISTER_RANGES[0];
  const includedDates = activeRange.n ? new Set(allDates.slice(0, activeRange.n)) : null;
  const filteredRows = includedDates ? rows.filter((r) => r.rehearsal_date && includedDates.has(r.rehearsal_date)) : rows;
  const rangeRehearsalCount = includedDates ? includedDates.size : allDates.length;

  const byMember = {};
  filteredRows.forEach((r) => {
    if (!byMember[r.member_id]) byMember[r.member_id] = { present: 0, absent: 0, excused: 0, total: 0 };
    byMember[r.member_id].total += 1;
    if (r.status === "present") byMember[r.member_id].present += 1;
    else if (r.status === "absent") byMember[r.member_id].absent += 1;
    else if (r.status === "excused") byMember[r.member_id].excused += 1;
  });

  const sectionOrder = ["Soprano", "Alto", "Tenor", "Bass"];
  const groupedSections = sectionOrder
    .map((section) => ({
      section,
      label: section === "Bass" ? "Basses" : `${section}s`,
      rows: members
        .filter((m) => m.part.startsWith(section))
        .map((m) => ({ member: m, stats: byMember[m.id] || { present: 0, absent: 0, excused: 0, total: 0 } }))
        .sort((a, b) => a.member.name.localeCompare(b.member.name)),
    }))
    .filter((g) => g.rows.length > 0);

  const busy = loading || loadingMembers;
  const allFlatRows = groupedSections.flatMap((g) => g.rows.map((r) => ({ ...r, section: g.label })));

  const exportCSV = () => {
    const header = ["Name", "Voice Part", "Present", "Absent", "Excused", "Rehearsals Tracked", "Rate"];
    const lines = [header.join(",")];
    allFlatRows.forEach(({ member: m, stats }) => {
      const rate = stats.total ? `${Math.round((stats.present / stats.total) * 100)}%` : "";
      lines.push([`"${m.name.replace(/"/g, '""')}"`, m.part, stats.present, stats.absent, stats.excused, stats.total, rate].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dvbc-attendance-register-${activeRange.key}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printRegister = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const tableRows = allFlatRows.map(({ member: m, stats, section }) => {
      const rate = stats.total ? `${Math.round((stats.present / stats.total) * 100)}%` : "—";
      return `<tr><td>${section}</td><td>${m.name}</td><td>${m.part}</td><td>${stats.present}</td><td>${stats.absent}</td><td>${stats.excused}</td><td>${stats.total}</td><td>${rate}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>DVBC Attendance Register</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#231A3B;}
        h1{font-size:18px;margin-bottom:2px;}
        p{font-size:12px;color:#666;margin-top:0;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left;}
        th{background:#f1edfc;}
      </style></head><body>
      <h1>DVBC Cumulative Attendance Register</h1>
      <p>Range: ${activeRange.label} · ${rangeRehearsalCount} rehearsal${rangeRehearsalCount === 1 ? "" : "s"} · Generated ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>Section</th><th>Name</th><th>Part</th><th>Present</th><th>Absent</th><th>Excused</th><th>Total</th><th>Rate</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div style={{ padding: "6px 24px 0" }}>
      <div style={{ margin: "10px 0 0", background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, marginBottom: 4 }}>Cumulative Register</div>
        <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
          Present, absent, and excused counts across recorded rehearsals, with each member's overall attendance rate.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 0 0", overflowX: "auto" }}>
        {REGISTER_RANGES.map((r) => (
          <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>{r.label}</Chip>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 0 0" }}>
        <button
          onClick={exportCSV} disabled={busy || allFlatRows.length === 0} className="dvbc-tap"
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: C.card, border: `1.4px solid ${C.lilacLine}`, color: C.ink, fontWeight: 700, fontSize: 12,
            padding: "10px 0", borderRadius: 12, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          <Download size={13} /> CSV
        </button>
        <button
          onClick={printRegister} disabled={busy || allFlatRows.length === 0} className="dvbc-tap"
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: C.card, border: `1.4px solid ${C.lilacLine}`, color: C.ink, fontWeight: 700, fontSize: 12,
            padding: "10px 0", borderRadius: 12, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          <FileText size={13} /> Print
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, margin: "12px 0 0" }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {busy && (
        <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>Loading register…</div>
      )}

      {!busy && groupedSections.map((g, i) => (
        <div key={g.section} style={{ marginTop: i === 0 ? 20 : 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink }}>{g.label}</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>({g.rows.length})</div>
          </div>
          {g.rows.map(({ member: m, stats }) => {
            const avColor = avatarColorFor(m.name);
            const rate = stats.total ? Math.round((stats.present / stats.total) * 100) : null;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                  background: avColor.bg, color: avColor.fg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 13,
                }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>
                    {m.part} · {stats.total} rehearsal{stats.total === 1 ? "" : "s"} tracked
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <Pill tone="present">{stats.present}P</Pill>
                  <Pill tone="absent">{stats.absent}A</Pill>
                  <Pill tone="excused">{stats.excused}E</Pill>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: rate === null ? C.inkSoft : C.garnet, minWidth: 36, textAlign: "right", flexShrink: 0 }}>
                  {rate === null ? "—" : `${rate}%`}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {!busy && groupedSections.length === 0 && (
        <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>No attendance recorded yet.</div>
      )}
    </div>
  );
}

function Attendance({ members, loading, onCycle, onSetStatus, onMarkUnmarkedPresent, isAdmin, profile, events, loadingEvents, onCheckIn, checkingIn, checkInError, onCreateEvent, onUpdateEvent, onExportCalendar }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("event"); // "event" | "register"
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];

  const sortedEvents = [...events].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const [selectedEventId, setSelectedEventId] = useState(null);
  useEffect(() => {
    if (selectedEventId || sortedEvents.length === 0) return;
    const now = Date.now();
    const next = sortedEvents.find((e) => new Date(e.end_time).getTime() >= now) || sortedEvents[sortedEvents.length - 1];
    setSelectedEventId(next.id);
  }, [sortedEvents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const checkInOpen = selectedEvent ? isEventCheckInOpen(selectedEvent) : false;
  const phase = selectedEvent ? getEventPhase(selectedEvent) : null;

  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  /* -------- interest voting, scoped to the selected event -------- */
  const [interest, setInterest] = useState([]);
  const [loadingInterest, setLoadingInterest] = useState(true);
  const [votingBusy, setVotingBusy] = useState(false);
  const [votingError, setVotingError] = useState("");
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [rosterError, setRosterError] = useState("");
  const [bulkFillBusy, setBulkFillBusy] = useState(false);

  const loadInterest = useCallback(async () => {
    if (!selectedEventId) { setInterest([]); setLoadingInterest(false); return; }
    setLoadingInterest(true);
    const { data } = await supabase.from("event_interest").select("*").eq("event_id", selectedEventId);
    setInterest(data || []);
    setLoadingInterest(false);
  }, [selectedEventId]);

  useEffect(() => {
    loadInterest();
    if (!selectedEventId) return;
    const channel = supabase
      .channel(`interest-${selectedEventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_interest", filter: `event_id=eq.${selectedEventId}` }, () => loadInterest())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedEventId, loadInterest]);

  const myVote = interest.find((v) => v.member_id === profile?.id)?.vote || null;
  const votesByMember = Object.fromEntries(interest.map((v) => [v.member_id, v.vote]));
  const memberNameById = Object.fromEntries((members || []).map((m) => [m.id, m.name || m.full_name || "Member"]));
  const excusedNotes = interest.filter((v) => v.vote === "excused" && v.note);
  const availableCount = interest.filter((v) => v.vote === "available").length;
  const excusedCount = interest.filter((v) => v.vote === "excused").length;

  const [excusedNoteDraft, setExcusedNoteDraft] = useState("");
  const [showExcusedInput, setShowExcusedInput] = useState(false);

  const castVote = async (vote, note) => {
    if (!profile || votingBusy || !selectedEventId) return;
    setVotingBusy(true);
    setVotingError("");
    const { error } = await supabase
      .from("event_interest")
      .upsert(
        { event_id: selectedEventId, member_id: profile.id, vote, note: note || null, voted_at: new Date().toISOString() },
        { onConflict: "event_id,member_id" }
      );
    if (error) setVotingError(error.message || "Could not save your vote. Please try again.");
    else if (vote === "excused") setExcusedNoteDraft("");
    setVotingBusy(false);
  };

  /* -------- attendance records, scoped to the selected event -------- */
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!selectedEventId) { setRecords([]); setLoadingRecords(false); return; }
    setLoadingRecords(true);
    const { data } = await supabase.from("attendance_records").select("*").eq("event_id", selectedEventId);
    setRecords(data || []);
    setLoadingRecords(false);
  }, [selectedEventId]);

  useEffect(() => {
    loadRecords();
    if (!selectedEventId) return;
    const channel = supabase
      .channel(`attendance-${selectedEventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records", filter: `event_id=eq.${selectedEventId}` }, () => loadRecords())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedEventId, loadRecords]);

  const statusByMember = Object.fromEntries(records.map((r) => [r.member_id, r.status]));
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const excused = records.filter((r) => r.status === "excused").length;

  const myStatus = statusByMember[profile?.id] || null;
  const alreadyCheckedIn = myStatus === "present";

  const prefillRegisterFromPoll = async () => {
    if (!isAdmin || prefillBusy || !selectedEventId) return;
    if (!window.confirm("Set every member's status from this event's poll votes? You can still adjust individual members afterward.")) return;
    setPrefillBusy(true);
    setPrefillError("");
    const voteToStatus = { available: "present", excused: "excused" };
    try {
      const rows = members
        .filter((m) => votesByMember[m.id])
        .map((m) => ({ member_id: m.id, event_id: selectedEventId, status: voteToStatus[votesByMember[m.id]] }));
      if (rows.length) {
        const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "member_id,event_id" });
        if (error) throw error;
      }
    } catch (err) {
      setPrefillError(err.message || "Could not update everyone. Please try again.");
    } finally {
      setPrefillBusy(false);
    }
  };

  const filtered = members.filter((m) => {
    const matchesPart = filter === "All" || m.part.startsWith(filter);
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchesPart && matchesSearch;
  });

  const sectionOrder = ["Soprano", "Alto", "Tenor", "Bass"];
  const groupedSections = sectionOrder
    .map((section) => ({
      section,
      label: section === "Bass" ? "Basses" : `${section}s`,
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
    const status = statusByMember[m.id] || null;
    const record = records.find((r) => r.member_id === m.id);
    const avColor = avatarColorFor(m.name);

    const identity = (
      <>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
          background: avColor.bg, color: avColor.fg, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 13,
        }}>
          {m.avatar_url
            ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
          <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{m.part}</div>
          {status === "present" && record?.created_at && (
            <div style={{ fontSize: 10, color: C.sage, marginTop: 2 }}>Checked in {formatClockTime(record.created_at)}</div>
          )}
        </div>
      </>
    );

    if (isAdmin) {
      // Spreadsheet-style: three direct tap cells (P / A / E) instead of a blind cycle.
      // Tapping the currently-active cell clears the mark back to "not marked".
      const CELLS = [
        { key: "present", label: "P", activeBg: C.sage, activeFg: "#fff" },
        { key: "absent", label: "A", activeBg: C.roseDeep, activeFg: "#fff" },
        { key: "excused", label: "E", activeBg: C.amberText, activeFg: "#fff" },
      ];
      return (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
          {identity}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {CELLS.map((cell) => (
              <button
                key={cell.key}
                onClick={async () => {
                  setRosterError("");
                  const { error } = (await onSetStatus(m, selectedEventId, status, cell.key)) || {};
                  if (error) setRosterError(error);
                }}
                className="dvbc-tap"
                style={{
                  width: 30, height: 30, borderRadius: 9, border: `1px solid ${status === cell.key ? "transparent" : C.lilacLine}`,
                  background: status === cell.key ? cell.activeBg : "transparent",
                  color: status === cell.key ? cell.activeFg : C.inkSoft,
                  fontWeight: 700, fontSize: 11.5, cursor: "pointer",
                }}
              >
                {cell.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={m.id}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}
      >
        {identity}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Pill tone={status || "gold"}>{status || "not marked"}</Pill>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader
        title="Attendance"
        subtitle={isAdmin ? "Tap P / A / E next to a member to mark their status" : "Vote, check in, and view the register per event"}
      />

      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
        <Chip active={view === "event"} onClick={() => setView("event")}>This Event</Chip>
        <Chip active={view === "register"} onClick={() => setView("register")}>Cumulative Register</Chip>
      </div>

      {view === "register" && <CumulativeRegister members={members} loadingMembers={loading} />}

      {view === "event" && (
      <>
      <div style={{ padding: "12px 24px 0", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onExportCalendar}
          className="dvbc-tap"
          title="Download rehearsals to your phone calendar"
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1.4px solid ${C.lilacLine}`, color: C.plum, fontWeight: 700, fontSize: 12.5, padding: "10px 16px", borderRadius: 12, cursor: "pointer" }}
        >
          <Download size={14} /> Export to Calendar
        </button>
      </div>

      {isAdmin && (
        <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="dvbc-tap"
            style={{ display: "flex", alignItems: "center", gap: 6, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> New Event
          </button>
        </div>
      )}

      {showEventForm && (
        <EventFormPanel
          initial={editingEvent}
          onCancel={() => { setShowEventForm(false); setEditingEvent(null); }}
          onSave={{ create: onCreateEvent, update: onUpdateEvent }}
        />
      )}

      {/* Event picker */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0", overflowX: "auto" }}>
        {loadingEvents && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton height={54} radius={14} />
            <Skeleton height={54} radius={14} />
          </div>
        )}
        {!loadingEvents && sortedEvents.length === 0 && (
          <div style={{ fontSize: 12, color: C.inkSoft }}>No events yet{isAdmin ? " — create one above." : "."}</div>
        )}
        {sortedEvents.map((e, i) => {
          const active = e.id === selectedEventId;
          const evPhase = getEventPhase(e);
          return (
            <button
              key={e.id} onClick={() => { setSelectedEventId(e.id); setVotingError(""); setRosterError(""); setPrefillError(""); }} className="dvbc-tap dvbc-stagger"
              style={{
                flexShrink: 0, textAlign: "left", padding: "10px 14px", borderRadius: 14,
                border: `1.4px solid ${active ? C.garnet : C.lilacLine}`,
                background: active ? gradient() : "#fff", cursor: "pointer", minWidth: 150,
                animationDelay: `${Math.min(i, 8) * 45}ms`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? "#fff" : C.ink }}>{e.title}</div>
              <div style={{ fontSize: 10.5, color: active ? "rgba(255,255,255,0.85)" : C.inkSoft, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                {evPhase === "ongoing" && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : C.sage, display: "inline-block" }} />
                )}
                {formatEventDay(e.start_time)}
              </div>
            </button>
          );
        })}
      </div>

      {selectedEvent && (
        <>
          <div style={{ margin: "16px 24px 0", background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 18, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink }}>{selectedEvent.title}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={12} /> {formatEventTimeRange(selectedEvent)}
                </div>
                {selectedEvent.location && (
                  <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={12} /> {selectedEvent.location}
                  </div>
                )}
                {selectedEvent.description && (
                  <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{selectedEvent.description}</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                {phase === "ongoing" && <Pill tone="present">Ongoing</Pill>}
                {phase === "past" && <Pill tone="gold">Past</Pill>}
                {isAdmin && (
                  <button
                    onClick={() => { setEditingEvent(selectedEvent); setShowEventForm(true); }} className="dvbc-tap"
                    style={{ fontSize: 11, fontWeight: 700, color: C.plum, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {!selectedEvent.track_attendance ? (
            <div style={{ margin: "16px 24px 0", fontSize: 11.5, color: C.inkSoft, textAlign: "center" }}>
              Attendance tracking is off for this event.
            </div>
          ) : (
            <>
              <div style={{ margin: "16px 24px 0", background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 18, padding: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Will you be there?</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
                  Voting is visible to everyone and helps section leaders plan the register.
                </div>

                {!isAdmin && phase !== "past" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: showExcusedInput ? 10 : 16 }}>
                    {[
                      { key: "available", label: "Available", tone: "present" },
                      { key: "excused", label: "Excused", tone: "excused" },
                    ].map((opt) => {
                      const active = myVote === opt.key;
                      const toneColor = opt.tone === "present" ? C.sage : opt.tone === "absent" ? C.roseDeep : C.amberText;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            if (opt.key === "excused") { setShowExcusedInput(true); return; }
                            setShowExcusedInput(false);
                            castVote(opt.key);
                          }}
                          disabled={votingBusy} className="dvbc-tap"
                          style={{
                            flex: 1, padding: "10px 6px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                            border: `1.4px solid ${active ? toneColor : C.lilacLine}`,
                            background: active ? toneColor : "#fff", color: active ? "#fff" : C.inkSoft,
                            cursor: votingBusy ? "default" : "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!isAdmin && phase !== "past" && showExcusedInput && (
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="text" value={excusedNoteDraft} onChange={(e) => setExcusedNoteDraft(e.target.value)}
                      placeholder="Reason (optional)" maxLength={140}
                      style={{
                        width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
                        border: `1.4px solid ${C.lilacLine}`, marginBottom: 8, boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { castVote("excused", excusedNoteDraft); setShowExcusedInput(false); }}
                        disabled={votingBusy} className="dvbc-tap"
                        style={{
                          flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                          border: `1.4px solid ${C.amberText}`, background: C.amberText, color: "#fff",
                          cursor: votingBusy ? "default" : "pointer",
                        }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => { setShowExcusedInput(false); setExcusedNoteDraft(""); }}
                        className="dvbc-tap"
                        style={{
                          flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                          border: `1.4px solid ${C.lilacLine}`, background: "#fff", color: C.inkSoft, cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {votingError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 12 }}>
                    <AlertCircle size={13} /> {votingError}
                  </div>
                )}

                {loadingInterest ? (
                  <div style={{ fontSize: 12, color: C.inkSoft }}>Loading votes…</div>
                ) : (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, textAlign: "center", background: C.sageBg, borderRadius: 12, padding: "8px 4px" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.sage }}>{availableCount}</div>
                      <div style={{ fontSize: 9.5, color: C.sage, textTransform: "uppercase", letterSpacing: 0.4 }}>Available</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", background: C.amberBg, borderRadius: 12, padding: "8px 4px" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.amberText }}>{excusedCount}</div>
                      <div style={{ fontSize: 9.5, color: C.amberText, textTransform: "uppercase", letterSpacing: 0.4 }}>Excused</div>
                    </div>
                  </div>
                )}

                {isAdmin && excusedNotes.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lilacLine}` }}>
                    <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                      Excused reasons
                    </div>
                    {excusedNotes.map((v) => (
                      <div key={v.member_id} style={{ fontSize: 11.5, color: C.ink, marginBottom: 6, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{memberNameById[v.member_id] || "Member"}:</span>{" "}
                        <span style={{ color: C.inkSoft }}>{v.note}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <>
                    {prefillError && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 12 }}>
                        <AlertCircle size={13} /> {prefillError}
                      </div>
                    )}
                    <button
                      onClick={prefillRegisterFromPoll} disabled={prefillBusy} className="dvbc-tap"
                      style={{
                        width: "100%", marginTop: 14, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5,
                        padding: 12, borderRadius: 12, border: "none", cursor: prefillBusy ? "default" : "pointer", opacity: prefillBusy ? 0.8 : 1,
                      }}
                    >
                      {prefillBusy ? "Setting register…" : "Set Register From Poll"}
                    </button>
                    <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 6, textAlign: "center" }}>
                      Sets each member's status below from their vote — you can still adjust individuals after.
                    </div>
                  </>
                )}
              </div>

              {!isAdmin && (
                <div style={{ margin: "18px 24px 0", background: alreadyCheckedIn ? C.sageBg : C.card, border: `1.4px solid ${alreadyCheckedIn ? C.sage : C.lilacLine}`, borderRadius: 18, padding: 18 }}>
                  {alreadyCheckedIn ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CheckSquare size={17} color={C.sage} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.sage }}>You're checked in</div>
                        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>Marked present for {selectedEvent.title}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Check-In</div>
                      <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
                        {phase === "past"
                          ? "This event has ended."
                          : checkInOpen
                          ? "Tap below to mark your arrival."
                          : `Opens 15 minutes before start, on ${formatEventTimeRange(selectedEvent)}.`}
                      </div>
                      {checkInError && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 10 }}>
                          <AlertCircle size={13} /> {checkInError}
                        </div>
                      )}
                      <button
                        onClick={() => onCheckIn(selectedEventId)} disabled={!checkInOpen || checkingIn} className="dvbc-tap"
                        style={{
                          width: "100%", background: checkInOpen ? gradient() : C.lilacSoft, color: checkInOpen ? "#fff" : "#B8ADC0",
                          fontWeight: 700, fontSize: 13.5, padding: 13, borderRadius: 12, border: "none",
                          cursor: checkInOpen && !checkingIn ? "pointer" : "default",
                        }}
                      >
                        {checkingIn ? "Checking in…" : "Check In"}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, padding: "16px 24px 0" }}>
                <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.sage }}>{present}</div>
                  <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Present</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.roseDeep }}>{absent}</div>
                  <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Absent</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 14, padding: "12px 6px" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.amberText }}>{excused}</div>
                  <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Excused</div>
                </div>
              </div>

              {isAdmin && rosterError && (
                <div style={{ margin: "16px 24px 0", display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5 }}>
                  <AlertCircle size={13} /> {rosterError}
                </div>
              )}

              {isAdmin && selectedEventId && (() => {
                const unmarkedCount = members.filter((m) => !statusByMember[m.id]).length;
                return unmarkedCount > 0 ? (
                  <div style={{ margin: "16px 24px 0" }}>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Mark all ${unmarkedCount} unmarked member(s) as Present? You can still flip individual people afterward.`)) return;
                        setBulkFillBusy(true);
                        setRosterError("");
                        const unmarkedIds = members.filter((m) => !statusByMember[m.id]).map((m) => m.id);
                        const { error } = (await onMarkUnmarkedPresent(selectedEventId, unmarkedIds)) || {};
                        if (error) setRosterError(error);
                        setBulkFillBusy(false);
                      }}
                      disabled={bulkFillBusy}
                      className="dvbc-tap"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                        background: C.sageBg, color: C.sage, fontWeight: 700, fontSize: 12.5, padding: "12px 0",
                        borderRadius: 12, border: "none", cursor: bulkFillBusy ? "default" : "pointer",
                      }}
                    >
                      <CheckSquare size={14} />
                      {bulkFillBusy ? "Marking…" : `Mark ${unmarkedCount} unmarked as Present`}
                    </button>
                  </div>
                ) : null;
              })()}

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
                {(loading || loadingRecords) && (
                  <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>Loading register…</div>
                )}
                {!loading && !loadingRecords && filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>No members match.</div>
                )}
                {!loading && !loadingRecords && groupedSections.map((g, i) => (
                  <div key={g.section} style={{ marginTop: i === 0 ? 0 : 22 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink }}>{g.label}</div>
                      <div style={{ fontSize: 12, color: C.inkSoft }}>({g.rows.length})</div>
                    </div>
                    {g.rows.map((m) => renderMemberRow(m))}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: 10.5, color: C.inkSoft, opacity: 0.7, padding: "14px 0 0" }}>
                {isAdmin ? "Shared with every chorister, live" : "Only section leaders can update attendance"}
              </div>
            </>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}

function LibraryFormPanel({ initial, onCancel, onSave, onUploadAudio }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [composer, setComposer] = useState(initial?.composer || "");
  const [tag, setTag] = useState(initial?.tag || "SATB");
  const [part, setPart] = useState(initial?.part || "All");
  const [existingAudioUrl, setExistingAudioUrl] = useState(initial?.audio_url || "");
  const [audioFile, setAudioFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tagOptions = ["SATB", "SSA", "TTBB", "SAB", "Divisi", "Unison"];
  const partOptions = ["All", "Soprano", "Alto", "Tenor", "Bass"];

  const submit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let audio_url = existingAudioUrl || null;
      if (audioFile) {
        const { url, error: uploadErr } = await onUploadAudio(audioFile);
        if (uploadErr) throw new Error(uploadErr);
        audio_url = url;
      }
      const payload = { title: title.trim(), composer: composer.trim() || null, tag, part, audio_url };
      const { error: saveErr } = initial ? await onSave.update(initial.id, payload) : await onSave.create(payload);
      if (saveErr) throw new Error(saveErr);
      onCancel();
    } catch (err) {
      setError(err.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", border: `1.4px solid ${C.lilacLine}`, borderRadius: 10, padding: "10px 12px",
    fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5, display: "block" };

  return (
    <div style={{ margin: "18px 24px 0", background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 14 }}>{initial ? "Edit Song" : "Add Song"}</div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Title</label>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ave Verum Corpus" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Composer</label>
        <input style={inputStyle} value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="W. A. Mozart" />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Voicing</label>
          <select style={inputStyle} value={tag} onChange={(e) => setTag(e.target.value)}>
            {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Section</label>
          <select style={inputStyle} value={part} onChange={(e) => setPart(e.target.value)}>
            {partOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Audio (MP3, WAV, M4A — up to 25MB)</label>
        <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5, color: C.inkSoft }} />
        {existingAudioUrl && !audioFile && (
          <div style={{ fontSize: 11, color: C.sage, marginTop: 6 }}>Audio already attached — choose a file above to replace it.</div>
        )}
      </div>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 12 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel} className="dvbc-tap"
          style={{ flex: 1, background: "#fff", color: C.inkSoft, fontWeight: 700, fontSize: 12.5, padding: 12, borderRadius: 12, border: `1.4px solid ${C.lilacLine}`, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={submit} disabled={saving} className="dvbc-tap"
          style={{ flex: 2, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: 12, borderRadius: 12, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.8 : 1 }}
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Song"}
        </button>
      </div>
    </div>
  );
}

function Library({ favorites, toggleFavorite, isAdmin, pieces, loading, onCreate, onUpdate, onDelete, onUploadAudio }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];
  const [showForm, setShowForm] = useState(false);
  const [editingPiece, setEditingPiece] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [rowError, setRowError] = useState("");
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  const [downloadBusyId, setDownloadBusyId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all(pieces.map(async (p) => [p.id, await isAudioDownloaded(p.audio_url)]))
      .then((entries) => { if (active) setDownloadedIds(new Set(entries.filter(([, ok]) => ok).map(([id]) => id))); });
    return () => { active = false; };
  }, [pieces]);

  const handleDownload = async (piece) => {
    setDownloadBusyId(piece.id);
    setRowError("");
    const { error } = await downloadAudioOffline(piece.audio_url);
    if (error) setRowError(error);
    else setDownloadedIds((prev) => new Set(prev).add(piece.id));
    setDownloadBusyId(null);
  };

  const handleRemoveDownload = async (piece) => {
    setDownloadBusyId(piece.id);
    await removeAudioOffline(piece.audio_url);
    setDownloadedIds((prev) => { const next = new Set(prev); next.delete(piece.id); return next; });
    setDownloadBusyId(null);
  };

  const togglePlay = async (piece) => {
    if (!piece.audio_url) return;
    if (playingId === piece.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const src = await getPlayableAudioSrc(piece.audio_url);
    const audio = new Audio(src);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(piece.id);
  };

  const filtered = pieces.filter((p) => {
    const matchesPart = filter === "All" || p.part === "All" || p.part === filter;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.composer || "").toLowerCase().includes(search.toLowerCase());
    return matchesPart && matchesSearch;
  });

  const handleDelete = async (piece) => {
    if (!window.confirm(`Remove "${piece.title}" from the library?`)) return;
    setDeleteBusyId(piece.id);
    setRowError("");
    if (playingId === piece.id) { audioRef.current?.pause(); setPlayingId(null); }
    const { error } = await onDelete(piece.id);
    if (error) setRowError(error);
    setDeleteBusyId(null);
  };

  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader title="Music Library" subtitle={`${pieces.length} piece${pieces.length === 1 ? "" : "s"}`} />

      {isAdmin && (
        <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => { setEditingPiece(null); setShowForm(true); }} className="dvbc-tap"
            style={{ display: "flex", alignItems: "center", gap: 6, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add Song
          </button>
        </div>
      )}

      {showForm && (
        <LibraryFormPanel
          initial={editingPiece}
          onCancel={() => { setShowForm(false); setEditingPiece(null); }}
          onSave={{ create: onCreate, update: onUpdate }}
          onUploadAudio={onUploadAudio}
        />
      )}

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

      {rowError && (
        <div style={{ margin: "12px 24px 0", display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5 }}>
          <AlertCircle size={13} /> {rowError}
        </div>
      )}

      <div style={{ padding: "8px 24px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>Loading library…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: "30px 0" }}>
            {pieces.length === 0 && isAdmin ? "No songs yet — tap Add Song to get started." : "No pieces match."}
          </div>
        )}
        {!loading && filtered.map((p) => {
          const fav = favorites.includes(p.id);
          const isPlaying = playingId === p.id;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
              <button onClick={() => toggleFavorite(p.id)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, display: "flex" }}>
                <Star size={18} color={fav ? C.garnet : C.lilacLine} fill={fav ? C.garnet : "none"} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{p.composer || "Traditional"}</div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <button onClick={() => { setEditingPiece(p); setShowForm(true); }} className="dvbc-tap" style={{ fontSize: 10.5, fontWeight: 700, color: C.plum, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>
                    <button onClick={() => handleDelete(p)} disabled={deleteBusyId === p.id} className="dvbc-tap" style={{ fontSize: 10.5, fontWeight: 700, color: C.roseDeep, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {deleteBusyId === p.id ? "Removing…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Pill>{p.tag}</Pill>
                {isAdmin ? (
                  <button
                    onClick={() => { haptic(8); onUpdate(p.id, { is_ready: !p.is_ready }); }}
                    className="dvbc-tap"
                    style={{
                      display: "flex", alignItems: "center", gap: 4, border: "none", cursor: "pointer",
                      background: p.is_ready ? C.sageBg : C.lilacSoft, color: p.is_ready ? C.sage : C.inkSoft,
                      fontSize: 10.5, fontWeight: 700, padding: "6px 10px", borderRadius: 999,
                    }}
                  >
                    <CheckSquare size={11} /> {p.is_ready ? "Ready" : "Mark Ready"}
                  </button>
                ) : p.is_ready ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.sage, fontSize: 10.5, fontWeight: 700 }}>
                    <CheckSquare size={11} /> Ready
                  </div>
                ) : null}
                {p.audio_url && (
                  <OfflineToggle
                    downloaded={downloadedIds.has(p.id)} busy={downloadBusyId === p.id}
                    onDownload={() => handleDownload(p)} onRemove={() => handleRemoveDownload(p)}
                  />
                )}
                <button
                  onClick={() => togglePlay(p)} disabled={!p.audio_url} className="dvbc-tap"
                  style={{
                    width: 30, height: 30, borderRadius: "50%", border: "none", cursor: p.audio_url ? "pointer" : "default",
                    background: p.audio_url ? gradient() : C.lilacSoft, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  title={p.audio_url ? (isPlaying ? "Pause" : "Play") : "No audio uploaded yet"}
                >
                  {isPlaying
                    ? <Pause size={12} color="#fff" fill="#fff" />
                    : <Play size={12} color={p.audio_url ? "#fff" : "#B8ADC0"} fill={p.audio_url ? "#fff" : "#B8ADC0"} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostSeenBy({ post, viewerId }) {
  const [expanded, setExpanded] = useState(false);
  const reads = (post.reads || []).filter((r) => r.member_id !== (post.author_id));
  if (reads.length === 0) return null;
  const names = reads.map((r) => r.member?.name).filter(Boolean);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setExpanded((v) => !v)} className="dvbc-tap"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.inkSoft, padding: 0 }}
      >
        Seen by {reads.length} {reads.length === 1 ? "member" : "members"}
      </button>
      {expanded && (
        <div style={{ fontSize: 11.5, color: C.ink, marginTop: 6, lineHeight: 1.6 }}>{names.join(", ")}</div>
      )}
    </div>
  );
}

/* ---------- Voice note playback bubble ---------- */
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}
function VoiceNoteBubble({ src, duration, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrent(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrent(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("ended", onEnd); };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); haptic(6); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 170 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle} className="dvbc-tap"
        style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: mine ? "rgba(255,255,255,0.25)" : C.lilac, color: mine ? "#fff" : C.garnetDark,
        }}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 3, borderRadius: 2, background: mine ? "rgba(255,255,255,0.3)" : C.lilacLine, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: mine ? "#fff" : C.garnet, transition: "width 0.1s linear" }} />
        </div>
        <div style={{ fontSize: 10, marginTop: 4, color: mine ? "rgba(255,255,255,0.85)" : C.inkSoft }}>
          {formatDuration(playing || current > 0 ? current : duration)}
        </div>
      </div>
    </div>
  );
}

function Messages({
  posts, loading, isAdmin, profile, onBack, onSubmitPost, onSubmitComment, seenMap, onMarkSeen,
  members, conversations, loadingConversations, activeConversationId, onOpenConversation, onCloseConversation,
  onCreateConversation, onActivateSectionChat, onSendChatMessage, onMarkConversationRead, onDeletePost, onSendVoiceNote, onStartCall, onEditChatMessage, onDeleteChatMessage,
  openMemberPosting, onToggleOpenPosting, restrictCommenting,
}) {
  const [tab, setTab] = useState("overview");
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
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [typingUsers, setTypingUsers] = useState({}); // { memberId: name }
  const [seenByOpen, setSeenByOpen] = useState(false);
  const [activatingSection, setActivatingSection] = useState(null);

  const chatChannelRef = useRef(null);
  const typingStopTimer = useRef(null);

  // Voice note recording state
  const [recState, setRecState] = useState("idle"); // idle | recording | preview | sending
  const [recSeconds, setRecSeconds] = useState(0);
  const [recBlob, setRecBlob] = useState(null);
  const [recError, setRecError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const recStreamRef = useRef(null);
  const recTimerRef = useRef(null);

  const stopRecTimer = () => { clearInterval(recTimerRef.current); recTimerRef.current = null; };
  const stopRecStream = () => { recStreamRef.current?.getTracks().forEach((t) => t.stop()); recStreamRef.current = null; };

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecBlob(blob);
        setRecState("preview");
        stopRecStream();
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecSeconds(0);
      setRecState("recording");
      haptic(10);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e) {
      setRecError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    stopRecTimer();
    mediaRecorderRef.current?.stop();
  };

  const discardRecording = () => {
    stopRecTimer();
    stopRecStream();
    mediaRecorderRef.current = null;
    recChunksRef.current = [];
    setRecBlob(null);
    setRecSeconds(0);
    setRecState("idle");
  };

  const sendRecording = async () => {
    if (!recBlob || !activeConversationId || recState === "sending") return;
    setRecState("sending");
    try {
      await onSendVoiceNote(activeConversationId, recBlob, recSeconds);
    } finally {
      setRecBlob(null);
      setRecSeconds(0);
      setRecState("idle");
    }
  };

  useEffect(() => () => { stopRecTimer(); stopRecStream(); }, []);

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
    return () => { supabase.removeChannel(channel); chatChannelRef.current = null; setTypingUsers({}); setSeenByOpen(false); };
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
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.ink, flex: 1 }}>Post</div>
          {isAdmin && (
            <button
              onClick={() => {
                if (window.confirm("Delete this announcement? This can't be undone.")) {
                  onDeletePost(openPostData.id);
                  setOpenPostId(null);
                }
              }}
              className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
            >
              <Trash2 size={18} color={C.roseDeep} />
            </button>
          )}
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: avatarColorFor(openPostData.author?.name).bg, color: avatarColorFor(openPostData.author?.name).fg, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14,
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
          <PostSeenBy post={openPostData} viewerId={profile?.id} />
        </div>

        <div style={{ margin: "20px 24px 0" }}><Staff /></div>

        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
            {(openPostData.comments || []).length} {(openPostData.comments || []).length === 1 ? "Comment" : "Comments"}
          </div>
          {(openPostData.comments || []).length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "6px 0" }}>No comments yet — be the first to reply.</div>          )}
          {(openPostData.comments || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                background: avatarColorFor(c.author?.name).bg, color: avatarColorFor(c.author?.name).fg, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 11,
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

        {(isAdmin || !restrictCommenting) ? (
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
                background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: "11px 18px", borderRadius: 999,
                border: "none", cursor: commentDraft.trim() ? "pointer" : "default", opacity: commentDraft.trim() ? 1 : 0.5, flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        ) : (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
            padding: "14px 24px calc(env(safe-area-inset-bottom, 0px) + 14px)", fontSize: 12, color: C.inkSoft, textAlign: "center",
          }}>
            Only admins can comment on posts right now.
          </div>
        )}
      </div>
    );
  }

  if (tab === "chats" && activeConversation) {
    const msgs = activeConversation.messages || [];
    const title = conversationTitle(activeConversation);
    const typingNames = Object.values(typingUsers);
    const lastMine = [...msgs].reverse().find((m) => m.sender_id === profile?.id);
    const seenBy = lastMine ? seenByOthers(activeConversation, lastMine) : [];

    const otherMember = !activeConversation.is_group ? otherParticipants(activeConversation)[0]?.member : null;

    return (
      <div style={{ paddingBottom: 90, display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onCloseConversation} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={20} color={C.ink} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.ink }}>{title}</div>
            {otherMember && (
              <div style={{ fontSize: 10.5, color: isOnline(otherMember.last_seen_at) ? "#3FB27F" : C.inkSoft, fontWeight: 600, marginTop: -1 }}>
                {presenceLabel(otherMember.last_seen_at)}
              </div>
            )}
          </div>
          {otherMember && (
            <button
              onClick={() => onStartCall(activeConversation.id, otherMember.id, false)} className="dvbc-tap"
              style={{
                width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer",
                background: C.lilacSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <Phone size={17} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.length === 0 && <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 12.5, padding: "20px 0" }}>Say hello 👋</div>}
          {msgs.map((m) => {
            const mine = m.sender?.id === profile?.id;
            const isEditing = editingMessageId === m.id;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}>
                {!mine && activeConversation.is_group && (
                  <div style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 2, marginLeft: 4 }}>{m.sender?.name}</div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: mine ? "row-reverse" : "row" }}>
                  <div style={{
                    maxWidth: "78%", padding: m.message_type === "voice_note" ? "10px 12px" : "10px 14px",
                    borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: mine ? gradient() : C.lilacSoft, color: mine ? "#fff" : C.ink, fontSize: 13.5, lineHeight: 1.5,
                  }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        style={{ width: "100%", border: "none", background: "rgba(255,255,255,0.2)", color: "inherit", borderRadius: 4, padding: "4px 8px", outline: "none", fontFamily: "inherit" }}
                      />
                    ) : m.message_type === "voice_note"
                      ? <VoiceNoteBubble src={m.audio_url} duration={m.duration_seconds} mine={mine} />
                      : m.content}
                  </div>
                  {mine && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              if (editingContent.trim()) onEditChatMessage(m.id, editingContent.trim());
                              setEditingMessageId(null);
                              setEditingContent("");
                            }}
                            className="dvbc-tap"
                            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "4px 8px", fontSize: 12, color: C.accent, fontWeight: 600 }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingMessageId(null); setEditingContent(""); }}
                            className="dvbc-tap"
                            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "4px 8px", fontSize: 12, color: C.inkSoft }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingMessageId(m.id); setEditingContent(m.content || ""); }}
                            className="dvbc-tap"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.6, fontSize: 11, color: C.inkSoft }}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => onDeleteChatMessage(m.id)}
                            className="dvbc-tap"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.6, fontSize: 11, color: C.roseDeep }}
                            title="Delete"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9.5, color: C.inkSoft, marginTop: 2, marginLeft: mine ? 0 : 4, marginRight: mine ? 4 : 0 }}>{timeAgo(m.created_at)}</div>
              </div>
            );
          })}
          {lastMine && seenBy.length > 0 && (
            <div
              onClick={() => activeConversation.is_group && setSeenByOpen((v) => !v)}
              className={activeConversation.is_group ? "dvbc-tap" : ""}
              style={{ textAlign: "right", fontSize: 9.5, color: C.inkSoft, marginTop: -4, cursor: activeConversation.is_group ? "pointer" : "default" }}
            >
              {activeConversation.is_group ? `Seen by ${seenBy.length} of ${otherParticipants(activeConversation).length}` : "Seen"}
            </div>
          )}
          {seenByOpen && activeConversation.is_group && seenBy.length > 0 && (
            <div style={{ textAlign: "right", fontSize: 10.5, color: C.ink, marginTop: -2 }}>
              {seenBy.map((p) => p.member?.name).filter(Boolean).join(", ")}
            </div>
          )}
          {typingNames.length > 0 && (
            <div style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: "italic" }}>{typingNames.join(", ")} typing…</div>
          )}
        </div>

        <div style={{
          position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
          padding: "12px 24px calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}>
          {recError && (
            <div style={{ fontSize: 11.5, color: C.roseDeep, marginBottom: 8 }}>{recError}</div>
          )}

          {recState === "recording" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.roseDeep, flexShrink: 0, animation: "dvbcPulse 1s ease-in-out infinite" }} />
              <div style={{ flex: 1, fontSize: 13.5, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{formatDuration(recSeconds)} recording…</div>
              <button onClick={discardRecording} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 6 }}>
                <X size={18} color={C.inkSoft} />
              </button>
              <button
                onClick={stopRecording} className="dvbc-tap"
                style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", background: C.roseDeep, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Square size={16} fill="currentColor" />
              </button>
            </div>
          )}

          {recState === "preview" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <VoiceNoteBubble src={recBlob ? URL.createObjectURL(recBlob) : null} duration={recSeconds} mine={false} />
              </div>
              <button onClick={discardRecording} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 6 }}>
                <Trash2 size={17} color={C.roseDeep} />
              </button>
              <button
                onClick={sendRecording} disabled={recState === "sending"} className="dvbc-tap"
                style={{
                  background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 999,
                  border: "none", cursor: "pointer", flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>
          )}

          {(recState === "idle" || recState === "sending") && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={chatDraft} onChange={(e) => handleChatInputChange(e.target.value)} placeholder="Message…"
                disabled={recState === "sending"}
                style={{ flex: 1, border: `1.4px solid ${C.lilacLine}`, background: C.parchment, borderRadius: 999, padding: "11px 16px", fontSize: 13, outline: "none", color: C.ink }}
                onKeyDown={(e) => { if (e.key === "Enter") submitChatMessage(); }}
              />
              {chatDraft.trim() ? (
                <button
                  onClick={submitChatMessage} disabled={sendingChat} className="dvbc-tap"
                  style={{
                    background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: "11px 18px", borderRadius: 999,
                    border: "none", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  Send
                </button>
              ) : (
                <button
                  onClick={startRecording} disabled={recState === "sending"} className="dvbc-tap"
                  style={{
                    width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: C.lilacSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <Mic size={17} />
                </button>
              )}
            </div>
          )}
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
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink }}>Messages</div>
      </div>
      <div style={{ margin: "14px 24px 0" }}><Staff /></div>

      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
        <Chip active={tab === "overview"} onClick={() => setTab("overview")}>Overview</Chip>
        <Chip active={tab === "posts"} onClick={() => setTab("posts")}>Member posts</Chip>
        <Chip active={tab === "chats"} onClick={() => setTab("chats")}>Chats</Chip>
      </div>

      {tab === "overview" && (
        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, marginBottom: 10 }}>Recent chats</div>
          {loadingConversations && <BrandSpinner />}
          {!loadingConversations && (
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
              {[...conversations]
                .sort((a, b) => new Date(lastMessageOf(b)?.created_at || b.created_at || 0) - new Date(lastMessageOf(a)?.created_at || a.created_at || 0))
                .slice(0, 4)
                .map((conv) => {
                  const unread = unreadCountFor(conv);
                  const title = conversationTitle(conv);
                  const avatarUrl = conversationAvatarUrl(conv);
                  return (
                    <button
                      key={conv.id} onClick={() => { setTab("chats"); onOpenConversation(conv.id); }} className="dvbc-tap"
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", flexShrink: 0, width: 66 }}
                    >
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: 54, height: 54, borderRadius: "50%", overflow: "hidden",
                          background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 15, border: `1.5px solid ${C.lilacLine}`,
                        }}>
                          {avatarUrl
                            ? <img src={avatarUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : conv.is_group ? <Users size={20} color={C.plum} /> : title.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        {unread > 0 && (
                          <div style={{
                            position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 999, background: C.roseDeep,
                            color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${C.parchment}`,
                          }}>
                            {unread > 9 ? "9+" : unread}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: C.ink, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                        {title.split(",")[0]}
                      </div>
                    </button>
                  );
                })}
              <button
                onClick={() => setTab("chats")} className="dvbc-tap"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", flexShrink: 0, width: 66 }}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: "50%", background: gradient(), color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, textAlign: "center",
                }}>
                  See all
                </div>
              </button>
            </div>
          )}

          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, margin: "22px 0 10px" }}>Highlighted content</div>
          {loading && <BrandSpinner />}
          {!loading && posts.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No posts yet.</div>
          )}
          {posts.slice(0, 2).map((post) => {
            const commentCount = (post.comments || []).length;
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
                  fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14,
                }}>
                  {post.author?.avatar_url
                    ? <img src={post.author.avatar_url} alt={post.author.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (post.author?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{timeAgo(post.created_at)}</div>
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

      {tab === "posts" && (
        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, marginBottom: 10 }}>
            {openMemberPosting ? "Member posts" : "Leadership posts"}
          </div>

          {loading && <BrandSpinner />}
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
                  fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14,
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink }}>Chats</div>
            <button
              onClick={() => setNewChatOpen(true)} className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 10, border: "none", cursor: "pointer" }}
            >
              + New
            </button>
          </div>

          {loadingConversations && <BrandSpinner />}
          {!loadingConversations && conversations.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No chats yet — start one above.</div>
          )}

          <button
            onClick={() => onStartCall(null, null, true)} className="dvbc-tap"
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 14,
              background: C.lilacSoft, border: "none", borderRadius: 14, cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: gradient(), color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Video size={17} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Start Rehearsal Call</div>
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>Join the group video room</div>
            </div>
          </button>

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
                  fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14,
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

      {tab === "posts" && (isAdmin || openMemberPosting) && (
        <button
          onClick={() => setComposerOpen(true)} className="dvbc-tap"
          style={{
            position: "fixed", bottom: 96, right: 24, width: 52, height: 52, borderRadius: "50%",
            background: gradient(), border: "none", color: "#fff", fontSize: 26, fontWeight: 600,
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink, marginBottom: 12 }}>{isAdmin ? "New leadership post" : "New post"}</div>
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
                style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.6 }}
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink, marginBottom: 12 }}>New chat</div>

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
                      fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 12,
                    }}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: C.ink }}>{m.name}</div>
                    {isGroupMode ? (
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.6px solid ${selected ? C.garnet : C.lilacLine}`, background: selected ? gradient() : "transparent" }} />
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
                style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 12, border: "none", cursor: selectedMemberIds.length ? "pointer" : "default", opacity: selectedMemberIds.length ? 1 : 0.6 }}
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
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink }}>Executives</div>
          {isAdmin && (
            <button
              onClick={() => { setEditingExec(null); setExecForm({ name: "", role: "", bio: "", contact: "" }); setShowExecForm(true); }}
              className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
            >
              + Add
            </button>
          )}
        </div>

        {loading && <BrandSpinner />}
        {!loading && executives.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No executives added yet.</div>
        )}

        {executives.map((exec) => (
          <div key={exec.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: C.lilacSoft, color: C.plum, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, border: `2px solid ${C.lilac}`,
            }}>
              {exec.photo_url
                ? <img src={exec.photo_url} alt={exec.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : exec.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{exec.name}</div>
              <div style={{ fontSize: 11.5, color: C.accent, fontWeight: 600, marginTop: 1 }}>{exec.role}</div>
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
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
              <button onClick={saveExec} disabled={savingExec} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingExec ? "default" : "pointer", opacity: savingExec ? 0.8 : 1 }}>
                {savingExec ? "Saving…" : "Save"}
              </button>
              <button onClick={resetExecForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 0 4px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink }}>Voice Part Leaders</div>
          {isAdmin && (
            <button
              onClick={() => { setEditingLeader(null); setLeaderForm({ name: "", voice_part: VOICE_PARTS[0] }); setShowLeaderForm(true); }}
              className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
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
              fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 13,
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
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
              <button onClick={saveLeader} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
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
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink }}>{title}</div>
      </div>
      <div style={{ margin: "14px 24px 0" }}><Staff /></div>
      <div style={{ padding: "20px 24px 0", fontSize: 13, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-line" }}>
        {content}
      </div>
    </div>
  );
}

function formatBirthday(dob) {
  if (!dob) return null;
  const d = new Date(dob + "T00:00:00");
  return d.toLocaleDateString("en-NG", { month: "long", day: "numeric" });
}

function MemberProfileModal({ member, onClose }) {
  const [attendancePct, setAttendancePct] = useState(null);
  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    supabase.from("attendance_records").select("status").eq("member_id", member.id).not("event_id", "is", null)
      .then(({ data }) => {
        if (!active) return;
        const rows = data || [];
        setAttendancePct(rows.length ? Math.round((rows.filter((r) => r.status === "present").length / rows.length) * 100) : 0);
      });
    return () => { active = false; };
  }, [member?.id]);

  if (!member) return null;
  const online = isOnline(member.last_seen_at);
  const birthday = formatBirthday(member.date_of_birth);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(30,20,40,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)", width: "100%", maxWidth: 480, maxHeight: "82vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} color={C.inkSoft} />
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: -8 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 76, height: 76, borderRadius: "50%", margin: "0 auto 10px", overflow: "hidden",
              background: avatarColorFor(member.name).bg, color: avatarColorFor(member.name).fg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 26,
            }}>
              {member.avatar_url ? <img src={member.avatar_url} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : member.name.charAt(0)}
            </div>
            <div style={{ position: "absolute", bottom: 8, right: 0 }}><PresenceDot online={online} size={14} /></div>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, color: C.ink }}>{member.name}</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{member.part}{member.is_admin ? " Â· Admin" : ""}</div>
          <div style={{ fontSize: 11.5, color: online ? "#3FB27F" : C.inkSoft, fontWeight: 600, marginTop: 4 }}>{presenceLabel(member.last_seen_at)}</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <div style={{ flex: 1, background: C.lilacSoft, borderRadius: 14, padding: 14, textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.accent }}>{attendancePct === null ? "—" : `${attendancePct}%`}</div>
            <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>Attendance</div>
          </div>
          {birthday && (
            <div style={{ flex: 1, background: C.lilacSoft, borderRadius: 14, padding: 14, textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.accent }}>{birthday}</div>
              <div style={{ fontSize: 9.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>Birthday</div>
            </div>
          )}
        </div>

        {(member.phone || member.address) && (
          <div style={{ marginTop: 16, background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 14, padding: 14 }}>
            {member.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <Phone size={15} color={C.plum} />
                <a href={`tel:${member.phone}`} style={{ fontSize: 13, color: C.ink, textDecoration: "none" }}>{member.phone}</a>
              </div>
            )}
            {member.address && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
                <MapPin size={15} color={C.plum} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>{member.address}</div>
              </div>
            )}
          </div>
        )}
        {!member.phone && !member.address && (
          <div style={{ marginTop: 16, fontSize: 12, color: C.inkSoft, textAlign: "center" }}>No contact details added yet.</div>
        )}
      </div>
    </div>
  );
}

function OwnContactInfo({ profile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [dob, setDob] = useState(profile?.date_of_birth || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setPhone(profile?.phone || ""); setAddress(profile?.address || ""); setDob(profile?.date_of_birth || "");
    setError(""); setEditing(true);
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      await onSave({ phone: phone.trim() || null, address: address.trim() || null, date_of_birth: dob || null });
      setEditing(false);
    } catch (e) {
      setError(e?.message || "Couldn't save your details.");
    }
    setBusy(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
    border: `1.4px solid ${C.lilacLine}`, boxSizing: "border-box", marginTop: 4, fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 12 };

  return (
    <div style={{ marginTop: 24, background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink }}>Your details</div>
        {!editing && (
          <button onClick={startEdit} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12.5, color: profile?.phone ? C.ink : C.inkSoft, padding: "6px 0" }}>
            {profile?.phone || "No phone number added"}
          </div>
          <div style={{ fontSize: 12.5, color: profile?.address ? C.ink : C.inkSoft, padding: "6px 0" }}>
            {profile?.address || "No address added"}
          </div>
          <div style={{ fontSize: 12.5, color: profile?.date_of_birth ? C.ink : C.inkSoft, padding: "6px 0" }}>
            {formatBirthday(profile?.date_of_birth) || "No birthday added"}
          </div>
          <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 6 }}>Visible to all approved members.</div>
        </div>
      ) : (
        <div>
          {error && <div style={{ fontSize: 11.5, color: C.roseDeep, background: C.roseBg, borderRadius: 8, padding: "7px 10px", marginTop: 10 }}>{error}</div>}
          <div style={labelStyle}>Phone number</div>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" style={inputStyle} />
          <div style={labelStyle}>Address</div>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" style={inputStyle} />
          <div style={labelStyle}>Birthday</div>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={save} disabled={busy} className="dvbc-tap"
              style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "10px 0", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer" }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)} disabled={busy} className="dvbc-tap"
              style={{ flex: 1, background: "#fff", color: C.inkSoft, fontWeight: 700, fontSize: 12.5, padding: "10px 0", borderRadius: 10, border: `1.4px solid ${C.lilacLine}`, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Profile({ profile, members, onLogout, isAdmin, onApprove, onReject, onRemoveMember, onToggleAdmin, onUploadAvatar, avatarUploading, avatarError, onNavSettings, darkMode, onToggleDarkMode, soundEnabled, onToggleSound, pushSubscribed, pushBusy, onEnablePush, onDisablePush, isIOS, isStandalone, onUpdateOwnInfo }) {
  const displayName = profile?.name || "Member";
  const pending = members.filter((m) => m.approval_status === "pending");
  const approvedMembers = members.filter((m) => m.approval_status === "approved");
  const [memberActionError, setMemberActionError] = useState("");
  const [viewingMemberId, setViewingMemberId] = useState(null);
  const viewingMember = members.find((m) => m.id === viewingMemberId) || null;

  const handleRemove = async (m) => {
    if (!window.confirm(`Remove ${m.name} from the chorale roster? This deletes their member record and can't be undone.`)) return;
    setMemberActionError("");
    try {
      await onRemoveMember(m.id);
    } catch (err) {
      setMemberActionError(err?.message || "Couldn't remove this member.");
    }
  };

  const handleToggleAdmin = async (m) => {
    setMemberActionError("");
    try {
      await onToggleAdmin(m.id, !m.is_admin);
    } catch (err) {
      setMemberActionError(err?.message || "Couldn't update admin status.");
    }
  };

  const [attendancePct, setAttendancePct] = useState(null); // null while loading, number once known
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    supabase
      .from("attendance_records")
      .select("status")
      .eq("member_id", profile.id)
      .not("event_id", "is", null)
      .then(({ data }) => {
        if (!active) return;
        const rows = data || [];
        setAttendancePct(rows.length ? Math.round((rows.filter((r) => r.status === "present").length / rows.length) * 100) : 0);
      });
    return () => { active = false; };
  }, [profile?.id]);

  // "Present" count for the nearest event that hasn't ended yet.
  const [presentNow, setPresentNow] = useState(null);
  useEffect(() => {
    let active = true;
    supabase.from("events").select("id").gte("end_time", new Date().toISOString()).order("start_time").limit(1)
      .then(({ data }) => {
        const eventId = data?.[0]?.id;
        if (!eventId) { if (active) setPresentNow(0); return; }
        supabase.from("attendance_records").select("status", { count: "exact" }).eq("event_id", eventId).eq("status", "present")
          .then(({ count }) => { if (active) setPresentNow(count || 0); });
      });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ background: gradient(), padding: "calc(env(safe-area-inset-top, 0px) + 26px) 24px 34px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: "#fff", margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 600, fontSize: 24, color: C.accent,
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
        <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 20 }}>{displayName}</div>
        <div style={{ color: C.lilac, fontSize: 12, marginTop: 2 }}>
          {profile?.part || ""}{profile?.is_admin ? " · Admin" : ""}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.accent }}>{members.length}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Registered members</div>
          </div>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.accent }}>{presentNow === null ? "—" : presentNow}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Present, next event</div>
          </div>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <RingProgress value={attendancePct ?? 0} size={36} strokeWidth={4} color={C.accent} track={C.lilacLine} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: C.accent, marginTop: -4 }}>{attendancePct === null ? "—" : `${attendancePct}%`}</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>My attendance</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, margin: "24px 0 10px" }}>Settings</div>
        <div
          onClick={() => { haptic(8); onToggleDarkMode?.(); }}
          className="dvbc-tap"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink, cursor: "pointer" }}
        >
          Dark Mode
          <div style={{
            width: 42, height: 24, borderRadius: 999, background: darkMode ? gradient() : C.lilacLine,
            position: "relative", transition: "background 0.2s ease", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 2, left: darkMode ? 20 : 2, width: 20, height: 20, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }} />
          </div>
        </div>
        <div
          onClick={() => { haptic(8); onToggleSound?.(); }}
          className="dvbc-tap"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink, cursor: "pointer" }}
        >
          Sound Effects
          <div style={{
            width: 42, height: 24, borderRadius: 999, background: soundEnabled ? gradient() : C.lilacLine,
            position: "relative", transition: "background 0.2s ease", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 2, left: soundEnabled ? 20 : 2, width: 20, height: 20, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }} />
          </div>
        </div>
        {isIOS && !isStandalone ? (
          <div style={{ padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}` }}>
            <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>Push Notifications</div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.5 }}>
              On iPhone, Safari only allows push alerts for apps added to your Home Screen. Tap the Share icon, then
              "Add to Home Screen" — open the app from there afterward and this toggle will work.
            </div>
          </div>
        ) : (
          <div
            onClick={() => { if (pushBusy) return; pushSubscribed ? onDisablePush?.() : onEnablePush?.(); }}
            className="dvbc-tap"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, fontSize: 13.5, color: C.ink, cursor: pushBusy ? "default" : "pointer" }}
          >
            <div>
              Push Notifications
              {pushBusy && <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 1 }}>Updating…</div>}
            </div>
            <div style={{
              width: 42, height: 24, borderRadius: 999, background: pushSubscribed ? gradient() : C.lilacLine,
              position: "relative", transition: "background 0.2s ease", flexShrink: 0, opacity: pushBusy ? 0.6 : 1,
            }}>
              <div style={{
                position: "absolute", top: 2, left: pushSubscribed ? 20 : 2, width: 20, height: 20, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }} />
            </div>
          </div>
        )}
        {[
          { label: "Executives", nav: "executives" },
          ...(isAdmin ? [{ label: "Communication Settings", nav: "communication" }] : []),
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, margin: "24px 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
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
                  background: avatarColorFor(m.name).bg, color: avatarColorFor(m.name).fg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 12,
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
                    style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer" }}
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

        <>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink, margin: "24px 0 10px" }}>Members</div>
          {memberActionError && (
            <div style={{ fontSize: 12, color: C.roseDeep, background: C.roseBg, borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
              {memberActionError}
            </div>
          )}
          {approvedMembers.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "6px 0 4px" }}>No approved members yet.</div>
          )}
          {approvedMembers.map((m) => {
            const isSelf = m.id === profile.id;
            return (
              <div
                key={m.id} onClick={() => setViewingMemberId(m.id)} className="dvbc-tap"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer" }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", overflow: "hidden",
                    background: avatarColorFor(m.name).bg, color: avatarColorFor(m.name).fg, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 12,
                  }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ position: "absolute", bottom: -1, right: -1 }}><PresenceDot online={isOnline(m.last_seen_at)} size={10} /></div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                    {m.name}{isSelf ? " (you)" : ""}{isBirthdayToday(m.date_of_birth) ? " 🎂" : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 }}>
                    {m.part}{m.is_admin ? " · Admin" : ""}
                  </div>
                </div>
                {isAdmin && !isSelf && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleAdmin(m)} className="dvbc-tap"
                      style={{
                        background: m.is_admin ? C.amberBg : C.lilacSoft, color: m.is_admin ? C.amberText : C.plum,
                        fontWeight: 700, fontSize: 11.5, padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                      }}
                    >
                      {m.is_admin ? "Revoke Admin" : "Make Admin"}
                    </button>
                    <button
                      onClick={() => handleRemove(m)} className="dvbc-tap"
                      style={{ background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 11.5, padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>

        <OwnContactInfo profile={profile} onSave={onUpdateOwnInfo} />

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
      {viewingMember && <MemberProfileModal member={viewingMember} onClose={() => setViewingMemberId(null)} />}
    </div>
  );
}

function ToggleRow({ label, hint, on, onClick }) {
  return (
    <div
      onClick={() => { haptic(8); onClick?.(); }} className="dvbc-tap"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.lilacLine}`, cursor: "pointer" }}
    >
      <div style={{ paddingRight: 12 }}>
        <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 999, background: on ? gradient() : C.lilacLine,
        position: "relative", transition: "background 0.2s ease", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: "50%",
          background: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }} />
      </div>
    </div>
  );
}

const VOICE_SECTIONS = ["Soprano", "Alto", "Tenor", "Bass", "Conductor"];

function CommunicationSettings({
  onBack, openMemberPosting, onToggleOpenPosting, restrictCommenting, onToggleRestrictCommenting,
  members, conversations, onActivateSectionChat, onOpenConversation, onCreateConversation, onGoToMessages,
}) {
  const [activatingSection, setActivatingSection] = useState(null);
  const [groupSections, setGroupSections] = useState([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const toggleGroupSection = (section) => {
    haptic(6);
    setGroupSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
  };

  const createMixedGroup = async () => {
    if (groupSections.length === 0 || !groupTitle.trim() || creatingGroup) return;
    setCreatingGroup(true);
    const memberIds = members.filter((m) => groupSections.includes(m.part) && m.approved).map((m) => m.id);
    await onCreateConversation(memberIds, groupTitle.trim(), true);
    setGroupSections([]);
    setGroupTitle("");
    setCreatingGroup(false);
    onGoToMessages?.();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.parchment, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 0px) + 16px) 24px 14px" }}>
        <button onClick={onBack} className="dvbc-tap" style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}>
          <ChevronLeft size={22} color={C.ink} />
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, color: C.ink }}>Communication Settings</div>
      </div>

      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, margin: "10px 0 4px" }}>Posting & comments</div>
        <ToggleRow
          label="Members can create posts"
          hint={openMemberPosting ? "Any approved member can post to Member posts" : "Currently admin-only — toggle on to open it up"}
          on={openMemberPosting}
          onClick={onToggleOpenPosting}
        />
        <ToggleRow
          label="Restrict commenting to admins"
          hint={restrictCommenting ? "Only admins can comment on posts" : "Any approved member can comment"}
          on={restrictCommenting}
          onClick={onToggleRestrictCommenting}
        />

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, margin: "24px 0 8px" }}>Section chats</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {VOICE_SECTIONS.map((section) => {
            const existing = conversations.find((c) => c.section === section);
            const busy = activatingSection === section;
            return existing ? (
              <button
                key={section}
                onClick={() => { onOpenConversation(existing.id); onGoToMessages?.(); }}
                className="dvbc-tap"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999,
                  background: C.sageBg, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: C.sage,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.sage }} />
                {section === "Conductor" ? "Conductors" : `${section}s`} active
              </button>
            ) : (
              <button
                key={section}
                disabled={busy}
                onClick={async () => { setActivatingSection(section); haptic(8); await onActivateSectionChat(section); setActivatingSection(null); }}
                className="dvbc-tap"
                style={{
                  padding: "8px 13px", borderRadius: 999, background: C.lilacSoft, border: `1px solid ${C.lilacLine}`,
                  cursor: busy ? "default" : "pointer", fontSize: 11.5, fontWeight: 600, color: C.ink, opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Activating…" : `Activate ${section === "Conductor" ? "Conductors" : section + "s"}`}
              </button>
            );
          })}
        </div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, margin: "4px 0 4px" }}>Custom group chat</div>
        <div style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 10, lineHeight: 1.4 }}>
          Pick any combination of sections to start a one-off group chat with everyone in them.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {VOICE_SECTIONS.map((section) => {
            const picked = groupSections.includes(section);
            return (
              <button
                key={section} onClick={() => toggleGroupSection(section)} className="dvbc-tap"
                style={{
                  padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
                  background: picked ? gradient() : C.lilacSoft, color: picked ? "#fff" : C.ink,
                  border: `1px solid ${picked ? "transparent" : C.lilacLine}`,
                }}
              >
                {section}
              </button>
            );
          })}
        </div>
        <input
          value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Group name"
          style={{
            width: "100%", border: `1.4px solid ${C.lilacLine}`, borderRadius: 10, padding: "10px 12px",
            fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none", color: C.ink, fontFamily: "inherit",
          }}
        />
        <button
          onClick={createMixedGroup}
          disabled={groupSections.length === 0 || !groupTitle.trim() || creatingGroup}
          className="dvbc-tap"
          style={{
            width: "100%", background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12,
            borderRadius: 12, border: "none",
            cursor: groupSections.length && groupTitle.trim() ? "pointer" : "default",
            opacity: groupSections.length && groupTitle.trim() ? 1 : 0.6,
          }}
        >
          {creatingGroup ? "Creating…" : "Create group chat"}
        </button>
      </div>
    </div>
  );
}

const BASE_RENDER_SCALE = 2; // fixed high-res render for crisp strokes/text regardless of zoom
const ANNOTATION_COLORS = ["#8A2332", "#1F5FA8", "#2B7A4B", "#111111"];

function AnnotatedPdfPage({ pdfDoc, pageNumber, zoomLevel, drawMode, tool, color, strokeWidth, strokes, onStrokeComplete, onNaturalSize }) {
  const renderCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState(null); // { width, height } at zoom=1 (CSS px)
  const drawingRef = useRef(null); // { points: [{x,y} in canvas px] }

  // Render the page once at fixed high resolution.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: BASE_RENDER_SCALE });
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      const size = { width: viewport.width / BASE_RENDER_SCALE, height: viewport.height / BASE_RENDER_SCALE };
      setNaturalSize(size);
      if (onNaturalSize) onNaturalSize(pageNumber, size);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber]);

  const redrawStrokes = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (strokes || []).forEach((s) => {
      if (!s.points || s.points.length < 2) return;
      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.tool === "highlight" ? 0.35 : 1;
      ctx.lineWidth = (s.tool === "highlight" ? 16 : (s.stroke_width || 2.5)) * (canvas.width / 1000) * 3.2;
      s.points.forEach((p, i) => {
        const x = p.x * canvas.width, y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }, [strokes]);

  // Resize overlay canvas to match displayed (CSS) size at the current zoom, then redraw.
  useEffect(() => {
    if (!naturalSize) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const w = Math.round(naturalSize.width * zoomLevel);
    const h = Math.round(naturalSize.height * zoomLevel);
    canvas.width = w;
    canvas.height = h;
    redrawStrokes();
  }, [naturalSize, zoomLevel, redrawStrokes]);

  useEffect(() => { redrawStrokes(); }, [strokes, redrawStrokes]);

  const canvasPointFromEvent = (e) => {
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ratioX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ratioY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x: ratioX, y: ratioY };
  };

  const onPointerDown = (e) => {
    if (!drawMode) return;
    e.target.setPointerCapture?.(e.pointerId);
    const pt = canvasPointFromEvent(e);
    drawingRef.current = { points: [pt] };
  };

  const onPointerMove = (e) => {
    if (!drawMode || !drawingRef.current) return;
    const pt = canvasPointFromEvent(e);
    drawingRef.current.points.push(pt);
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const pts = drawingRef.current.points;
    const prev = pts[pts.length - 2] || pts[0];
    ctx.beginPath();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = tool === "highlight" ? 0.35 : 1;
    ctx.lineWidth = (tool === "highlight" ? 16 : strokeWidth) * (canvas.width / 1000) * 3.2;
    ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
    ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const onPointerUp = () => {
    if (!drawMode || !drawingRef.current) return;
    const points = drawingRef.current.points;
    drawingRef.current = null;
    if (points.length < 2) return;
    onStrokeComplete(pageNumber, { tool, color, stroke_width: strokeWidth, points });
  };

  return (
    <div style={{ position: "relative", margin: "0 auto 14px", width: naturalSize ? naturalSize.width * zoomLevel : "auto" }}>
      <canvas ref={renderCanvasRef} style={{ display: "block", width: naturalSize ? naturalSize.width * zoomLevel : "100%", height: naturalSize ? naturalSize.height * zoomLevel : "auto", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }} />
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          position: "absolute", top: 0, left: 0,
          width: naturalSize ? naturalSize.width * zoomLevel : "100%", height: naturalSize ? naturalSize.height * zoomLevel : "100%",
          touchAction: drawMode ? "none" : "auto", pointerEvents: drawMode ? "auto" : "none",
        }}
      />
    </div>
  );
}

function SheetMusicViewer({ path, title, onClose, userId }) {
  const [sourceUrl, setSourceUrl] = useState(null);
  const [isOfflineCopy, setIsOfflineCopy] = useState(false);
  const [error, setError] = useState("");
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const blobUrlRef = useRef(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState("pen"); // 'pen' | 'highlight'
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const strokeWidth = 2.5;
  const scrollContainerRef = useRef(null);
  const [page1NaturalWidth, setPage1NaturalWidth] = useState(null);

  const fitToWidth = () => {
    const container = scrollContainerRef.current;
    if (!container || !page1NaturalWidth) return;
    const available = container.clientWidth - 32; // account for the container's own left/right padding
    setZoomLevel(Math.max(0.15, Math.min(3, +(available / page1NaturalWidth).toFixed(2))));
  };

  useEffect(() => {
    if (page1NaturalWidth) fitToWidth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page1NaturalWidth]);

  const [strokesByPage, setStrokesByPage] = useState({}); // { [pageNumber]: [{id, tool, color, stroke_width, points}] }
  const [recentStrokeIds, setRecentStrokeIds] = useState([]); // for Undo, most recent last

  // Resolve a playable source: prefer offline copy, else a signed URL.
  useEffect(() => {
    let active = true;
    setSourceUrl(null);
    setIsOfflineCopy(false);
    setError("");
    setPdfDoc(null);
    setNumPages(0);

    (async () => {
      const offlineBlobUrl = await getSheetOfflineBlobUrl(path);
      if (!active) return;
      if (offlineBlobUrl) {
        blobUrlRef.current = offlineBlobUrl;
        setSourceUrl(offlineBlobUrl);
        setIsOfflineCopy(true);
        return;
      }
      const { data, error: signError } = await supabase.storage.from("practice-sheets").createSignedUrl(path, 300);
      if (!active) return;
      if (signError || !data?.signedUrl) {
        setError("Couldn't load the sheet music. Please try again.");
        return;
      }
      setSourceUrl(data.signedUrl);
    })();

    return () => {
      active = false;
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [path]);

  // Load the PDF document via pdf.js once we have a source URL.
  useEffect(() => {
    if (!sourceUrl) return;
    if (typeof sourceUrl !== "string" || sourceUrl.trim() === "") {
      setError(`Internal error: sourceUrl was not a valid string (got ${typeof sourceUrl}: ${JSON.stringify(sourceUrl)})`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        console.log("[SheetMusicViewer] loading PDF, sourceUrl:", sourceUrl, "workerSrc:", pdfjsLib.GlobalWorkerOptions.workerSrc);
        const doc = await pdfjsLib.getDocument({ url: sourceUrl }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPage1NaturalWidth(null); // triggers auto-fit again once page 1 reports its size below
      } catch (err) {
        console.error("[SheetMusicViewer] getDocument failed. sourceUrl was:", JSON.stringify(sourceUrl), "error:", err);
        if (!cancelled) setError(`Couldn't render this PDF — ${err?.message || err?.name || "unknown error"} (url: ${String(sourceUrl).slice(0, 60)})`);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceUrl]);

  // Load this member's existing annotations for this sheet.
  useEffect(() => {
    if (!path || !userId) return;
    let active = true;
    supabase.from("sheet_annotations").select("*").eq("sheet_path", path).eq("user_id", userId).then(({ data }) => {
      if (!active || !data) return;
      const grouped = {};
      data.forEach((row) => {
        if (!grouped[row.page_number]) grouped[row.page_number] = [];
        grouped[row.page_number].push(row);
      });
      setStrokesByPage(grouped);
    });
    return () => { active = false; };
  }, [path, userId]);

  const handleStrokeComplete = async (pageNumber, stroke) => {
    if (!userId) return;
    const { data, error: insertError } = await supabase
      .from("sheet_annotations")
      .insert({ sheet_path: path, user_id: userId, page_number: pageNumber, tool: stroke.tool, color: stroke.color, stroke_width: stroke.stroke_width, points: stroke.points })
      .select()
      .single();
    if (insertError || !data) return;
    setStrokesByPage((prev) => ({ ...prev, [pageNumber]: [...(prev[pageNumber] || []), data] }));
    setRecentStrokeIds((prev) => [...prev, { id: data.id, page: pageNumber }]);
  };

  const undoLastStroke = async () => {
    const last = recentStrokeIds[recentStrokeIds.length - 1];
    if (!last) return;
    setRecentStrokeIds((prev) => prev.slice(0, -1));
    setStrokesByPage((prev) => ({ ...prev, [last.page]: (prev[last.page] || []).filter((s) => s.id !== last.id) }));
    await supabase.from("sheet_annotations").delete().eq("id", last.id);
  };

  const clearAllAnnotations = async () => {
    if (!window.confirm("Clear all your markups on this sheet? This can't be undone.")) return;
    setStrokesByPage({});
    setRecentStrokeIds([]);
    await supabase.from("sheet_annotations").delete().eq("sheet_path", path).eq("user_id", userId);
  };

  const hasAnyStrokes = Object.values(strokesByPage).some((arr) => arr && arr.length > 0);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: C.garnetDark, display: "flex", flexDirection: "column" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {isOfflineCopy && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, marginTop: 2 }}>Viewing saved offline copy</div>}
        </div>
        <button onClick={onClose} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0, marginLeft: 12 }}>
          <X size={20} color="#fff" />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 10px", flexWrap: "wrap" }}>
        <button
          onClick={() => setDrawMode((d) => !d)} className="dvbc-tap"
          style={{ display: "flex", alignItems: "center", gap: 5, background: drawMode ? "#fff" : "rgba(255,255,255,0.14)", color: drawMode ? C.garnet : "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
        >
          {drawMode ? "Drawing" : "Draw"}
        </button>
        {drawMode && (
          <>
            <button
              onClick={() => setTool("pen")} className="dvbc-tap"
              style={{ background: tool === "pen" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
            >
              Pen
            </button>
            <button
              onClick={() => setTool("highlight")} className="dvbc-tap"
              style={{ background: tool === "highlight" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
            >
              Highlight
            </button>
            <div style={{ display: "flex", gap: 5 }}>
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c} onClick={() => setColor(c)} className="dvbc-tap"
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", padding: 0 }}
                />
              ))}
            </div>
            <button onClick={undoLastStroke} disabled={!recentStrokeIds.length} className="dvbc-tap" style={{ background: "none", border: "none", color: recentStrokeIds.length ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 11.5, fontWeight: 700, cursor: recentStrokeIds.length ? "pointer" : "default" }}>
              Undo
            </button>
            {hasAnyStrokes && (
              <button onClick={clearAllAnnotations} className="dvbc-tap" style={{ background: "none", border: "none", color: "#F3B4C4", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                Clear
              </button>
            )}
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <button onClick={fitToWidth} className="dvbc-tap" style={{ background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", marginRight: 2 }}>
            Fit
          </button>
          <button onClick={() => setZoomLevel((z) => Math.max(0.15, +(z - 0.15).toFixed(2)))} className="dvbc-tap" style={{ background: "rgba(255,255,255,0.14)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Minus size={13} color="#fff" />
          </button>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700, width: 34, textAlign: "center" }}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.15).toFixed(2)))} className="dvbc-tap" style={{ background: "rgba(255,255,255,0.14)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Plus size={13} color="#fff" />
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, position: "relative", overflow: "auto", padding: "0 16px 24px" }}>
        {!pdfDoc && !error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#F3B4C4", fontSize: 13, padding: 24, textAlign: "center" }}>
            {error}
          </div>
        )}
        {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
          <AnnotatedPdfPage
            key={pageNumber}
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            zoomLevel={zoomLevel}
            drawMode={drawMode}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            strokes={strokesByPage[pageNumber] || []}
            onStrokeComplete={handleStrokeComplete}
            onNaturalSize={pageNumber === 1 ? (num, size) => setPage1NaturalWidth(size.width) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function PracticeLists({ isAdmin, profile, members = [] }) {
  const myUserId = profile?.user_id;
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openListId, setOpenListId] = useState(null);
  const [filter, setFilter] = useState("All");
  const parts = ["All", "Soprano", "Alto", "Tenor", "Bass"];
  const [view, setView] = useState("lists"); // "lists" | "assignments"

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
  const [viewingSheet, setViewingSheet] = useState(null); // { path, title } | null

  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [repeatIds, setRepeatIds] = useState(() => new Set());
  const audioRef = useRef(null);
  const RATES = [1, 1.25, 1.5, 0.75];
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const TRACK_PART_NAMES = ["Full Mix", "Accompaniment", "Soprano 1", "Soprano 2", "Alto 1", "Alto 2", "Tenor 1", "Tenor 2", "Bass 1", "Bass 2"];
  const [activePart, setActivePart] = useState("Full Mix");
  const [trackPartFiles, setTrackPartFiles] = useState({}); // { "Soprano": File, ... }
  const pendingSeekRef = useRef(null);
  const switchPart = (part) => {
    if (part === activePart) return;
    const audio = audioRef.current;
    pendingSeekRef.current = audio ? audio.currentTime : 0;
    setActivePart(part);
  };

  /* ---------- Assignments ---------- */
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [completions, setCompletions] = useState([]); // [{ assignment_id, member_id }]
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const emptyAssignmentForm = { title: "", notes: "", practice_track_id: "", part: "All", assigned_member_id: "", due_date: "" };
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [completingId, setCompletingId] = useState(null);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    const [assignmentsRes, completionsRes] = await Promise.all([
      supabase.from("assignments").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("assignment_completions").select("assignment_id, member_id"),
    ]);
    setAssignments(assignmentsRes.data || []);
    setCompletions(completionsRes.data || []);
    setLoadingAssignments(false);
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  /* ---------- Solfège ---------- */
  const solfegeCtxRef = useRef(null);
  const [patterns, setPatterns] = useState([]);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [showPatternForm, setShowPatternForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState(null);
  const emptyPatternForm = { title: "", startMidi: 60, syllablesText: "Do Re Mi Fa Sol La Ti Do'", notes: "" };
  const [patternForm, setPatternForm] = useState(emptyPatternForm);
  const [savingPattern, setSavingPattern] = useState(false);
  const [patternError, setPatternError] = useState("");
  const [playingPatternId, setPlayingPatternId] = useState(null);

  const START_NOTES = [
    { label: "C4 (Middle C)", midi: 60 }, { label: "D4", midi: 62 }, { label: "E4", midi: 64 },
    { label: "F4", midi: 65 }, { label: "G4", midi: 67 }, { label: "A4", midi: 69 },
    { label: "Bb3", midi: 58 }, { label: "C3", midi: 48 },
  ];
  const SOLFEGE_SEMITONES = {
    do: 0, di: 1, re: 2, ri: 3, me: 3, mi: 4, fa: 5, fi: 6, sol: 7, so: 7, si: 8,
    la: 9, li: 10, te: 10, ti: 11, "do'": 12, do8: 12, "do+": 12, do2: 12,
  };
  const parseSolfege = (text) => (text || "").trim().split(/\s+/).filter(Boolean).map((tok) => {
    const key = tok.toLowerCase().replace(/[,.]/g, "");
    return { label: tok, semitone: SOLFEGE_SEMITONES[key] };
  });

  const getSolfegeCtx = () => {
    if (!solfegeCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      solfegeCtxRef.current = new AC();
    }
    if (solfegeCtxRef.current.state === "suspended") solfegeCtxRef.current.resume();
    return solfegeCtxRef.current;
  };

  const playSolfegeTone = (startMidi, semitone, duration = 0.55) => {
    if (semitone === undefined) return;
    const ctx = getSolfegeCtx();
    const freq = 440 * Math.pow(2, (startMidi + semitone - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  };

  const playSolfegePattern = (pattern) => {
    haptic(10);
    setPlayingPatternId(pattern.id);
    const notes = parseSolfege((pattern.syllables || []).join(" "));
    notes.forEach((n, i) => {
      setTimeout(() => playSolfegeTone(pattern.start_midi, n.semitone), i * 600);
    });
    setTimeout(() => setPlayingPatternId(null), notes.length * 600);
  };

  const loadPatterns = useCallback(async () => {
    setLoadingPatterns(true);
    const { data } = await supabase.from("solfege_patterns").select("*").order("created_at", { ascending: false });
    setPatterns(data || []);
    setLoadingPatterns(false);
  }, []);

  useEffect(() => { loadPatterns(); }, [loadPatterns]);

  const resetPatternForm = () => {
    setPatternForm(emptyPatternForm);
    setEditingPattern(null);
    setShowPatternForm(false);
    setPatternError("");
  };

  const startEditPattern = (p) => {
    setEditingPattern(p);
    setPatternForm({ title: p.title || "", startMidi: p.start_midi || 60, syllablesText: (p.syllables || []).join(" "), notes: p.notes || "" });
    setShowPatternForm(true);
  };

  const savePattern = async () => {
    if (!patternForm.title.trim()) { setPatternError("Title is required."); return; }
    const parsed = parseSolfege(patternForm.syllablesText);
    if (parsed.length === 0) { setPatternError("Enter at least one syllable, e.g. Do Re Mi."); return; }
    const bad = parsed.filter((n) => n.semitone === undefined);
    if (bad.length > 0) {
      setPatternError(`Didn't recognize: ${bad.map((n) => n.label).join(", ")}. Use Do Re Mi Fa Sol La Ti, and Do' for the octave up.`);
      return;
    }
    setSavingPattern(true);
    setPatternError("");
    try {
      const payload = {
        title: patternForm.title.trim(),
        start_midi: patternForm.startMidi,
        syllables: parsed.map((n) => n.label),
        notes: patternForm.notes.trim() || null,
      };
      if (editingPattern) {
        const { error } = await supabase.from("solfege_patterns").update(payload).eq("id", editingPattern.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("solfege_patterns").insert({ ...payload, created_by: profile.id });
        if (error) throw error;
      }
      resetPatternForm();
      loadPatterns();
    } catch (err) {
      setPatternError(err.message || "Could not save. Please try again.");
    } finally {
      setSavingPattern(false);
    }
  };

  const deletePattern = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    await supabase.from("solfege_patterns").delete().eq("id", p.id);
    if (editingPattern?.id === p.id) resetPatternForm();
    loadPatterns();
  };

  const loadLists = useCallback(async () => {
    setLoading(true);
    const [listsRes, tracksRes, partsRes] = await Promise.all([
      supabase.from("practice_lists").select("*").order("display_order", { ascending: true }),
      supabase.from("practice_tracks").select("*").order("display_order", { ascending: true }),
      supabase.from("practice_track_parts").select("*"),
    ]);
    const partsByTrack = {};
    (partsRes.data || []).forEach((p) => {
      if (!partsByTrack[p.track_id]) partsByTrack[p.track_id] = [];
      partsByTrack[p.track_id].push(p);
    });
    const tracksByList = {};
    (tracksRes.data || []).forEach((t) => {
      const track = { ...t, parts: partsByTrack[t.id] || [] };
      if (!tracksByList[t.practice_list_id]) tracksByList[t.practice_list_id] = [];
      tracksByList[t.practice_list_id].push(track);
    });
    setLists((listsRes.data || []).map((l) => ({ ...l, tracks: tracksByList[l.id] || [] })));
    setLoading(false);
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setProgress(audio.currentTime);
      if (loopStart != null && loopEnd != null && audio.currentTime >= loopEnd) {
        audio.currentTime = loopStart;
      }
    };
    const onLoaded = () => {
      setDuration(audio.duration || 0);
      if (pendingSeekRef.current != null) {
        audio.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (isPlaying) audio.play();
      }
    };
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
  }, [currentTrackId, repeatIds, loopStart, loopEnd]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, currentTrackId]);

  const openList = lists.find((l) => l.id === openListId);
  const groupLists = lists.filter((l) => !l.owner_user_id);
  const personalLists = lists.filter((l) => l.owner_user_id && l.owner_user_id === myUserId);
  const filteredGroupLists = groupLists.filter((l) => filter === "All" || l.voice_part === "All" || l.voice_part.startsWith(filter));

  const canManage = (list) => isAdmin || (list && list.owner_user_id === myUserId);

  /* ---------- Assignment helpers ---------- */
  const allTracksFlat = lists.flatMap((l) => l.tracks.map((t) => ({ ...t, listId: l.id, listTitle: l.title })));
  const trackById = Object.fromEntries(allTracksFlat.map((t) => [t.id, t]));

  const isAssignedToMe = (a) => a.part === "All" || a.part === profile?.part || a.assigned_member_id === profile?.id;
  const myAssignments = assignments
    .filter(isAssignedToMe)
    .slice()
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const myCompletedIds = new Set(completions.filter((c) => c.member_id === profile?.id).map((c) => c.assignment_id));

  const targetCountFor = (a) => {
    if (a.assigned_member_id) return 1;
    if (a.part === "All") return members.length || 0;
    return members.filter((m) => m.part === a.part).length;
  };
  const completedCountFor = (a) => completions.filter((c) => c.assignment_id === a.id).length;

  const isOverdue = (a) => a.due_date && a.due_date < new Date().toISOString().slice(0, 10) && !myCompletedIds.has(a.id);

  const resetAssignmentForm = () => {
    setAssignmentForm(emptyAssignmentForm);
    setEditingAssignment(null);
    setShowAssignmentForm(false);
    setAssignmentError("");
  };

  const startEditAssignment = (a) => {
    setEditingAssignment(a);
    setAssignmentForm({
      title: a.title || "", notes: a.notes || "", practice_track_id: a.practice_track_id || "",
      part: a.assigned_member_id ? "Individual" : (a.part || "All"),
      assigned_member_id: a.assigned_member_id || "", due_date: a.due_date || "",
    });
    setShowAssignmentForm(true);
  };

  const saveAssignment = async () => {
    if (!assignmentForm.title.trim()) { setAssignmentError("Title is required."); return; }
    if (assignmentForm.part === "Individual" && !assignmentForm.assigned_member_id) {
      setAssignmentError("Please choose a member.");
      return;
    }
    setSavingAssignment(true);
    setAssignmentError("");
    try {
      const track = trackById[assignmentForm.practice_track_id];
      const payload = {
        title: assignmentForm.title.trim(),
        notes: assignmentForm.notes.trim() || null,
        practice_track_id: assignmentForm.practice_track_id || null,
        practice_list_id: track ? track.listId : null,
        part: assignmentForm.part === "Individual" ? "Individual" : assignmentForm.part,
        assigned_member_id: assignmentForm.part === "Individual" ? assignmentForm.assigned_member_id : null,
        due_date: assignmentForm.due_date || null,
      };
      if (editingAssignment) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", editingAssignment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assignments").insert({ ...payload, created_by: profile.id });
        if (error) throw error;
      }
      resetAssignmentForm();
      loadAssignments();
    } catch (err) {
      setAssignmentError(err.message || "Could not save. Please try again.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const deleteAssignment = async (a) => {
    if (!window.confirm(`Delete assignment "${a.title}"?`)) return;
    await supabase.from("assignment_completions").delete().eq("assignment_id", a.id);
    await supabase.from("assignments").delete().eq("id", a.id);
    if (editingAssignment?.id === a.id) resetAssignmentForm();
    loadAssignments();
  };

  const toggleAssignmentComplete = async (a) => {
    haptic(10);
    setCompletingId(a.id);
    const alreadyDone = myCompletedIds.has(a.id);
    if (alreadyDone) {
      await supabase.from("assignment_completions").delete().eq("assignment_id", a.id).eq("member_id", profile.id);
      setCompletions((prev) => prev.filter((c) => !(c.assignment_id === a.id && c.member_id === profile.id)));
    } else {
      await supabase.from("assignment_completions").insert({ assignment_id: a.id, member_id: profile.id });
      setCompletions((prev) => [...prev, { assignment_id: a.id, member_id: profile.id }]);
    }
    setCompletingId(null);
  };

  const openAssignmentTrack = (a) => {
    const track = trackById[a.practice_track_id];
    if (!track) return;
    setOpenListId(track.listId);
    setCurrentTrackId(track.id);
    setProgress(0);
    setIsPlaying(true);
    setPlayerExpanded(true);
    setLoopStart(null);
    setLoopEnd(null);
    setActivePart("Full Mix");
    setTimeout(() => { if (audioRef.current) { audioRef.current.playbackRate = playbackRate; audioRef.current.play(); } }, 0);
  };

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
    setLoopStart(null);
    setLoopEnd(null);
    setActivePart("Full Mix");
    setTimeout(() => { if (audioRef.current) { audioRef.current.playbackRate = playbackRate; audioRef.current.play(); } }, 0);
  };

  const setLoopPoint = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    if (loopStart == null) {
      setLoopStart(t);
    } else if (loopEnd == null) {
      if (t <= loopStart) { setLoopStart(t); return; } // treat as re-setting A
      setLoopEnd(t);
    } else {
      // both already set — start a fresh loop from here
      setLoopStart(t);
      setLoopEnd(null);
    }
  };

  const clearLoop = () => { setLoopStart(null); setLoopEnd(null); };

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
  const trackHasParts = (currentTrack?.parts || []).length > 0;
  const activeAudioUrl = trackHasParts
    ? (currentTrack.parts.find((p) => p.part_name === activePart)?.audio_url || currentTrack.audio_url)
    : currentTrack?.audio_url;

  const [playableSrc, setPlayableSrc] = useState(null);
  useEffect(() => {
    let active = true;
    if (!activeAudioUrl) { setPlayableSrc(null); return; }
    getPlayableAudioSrc(activeAudioUrl).then((src) => { if (active) setPlayableSrc(src); });
    return () => { active = false; };
  }, [currentTrack?.id, activeAudioUrl]);

  const [downloadedAudio, setDownloadedAudio] = useState(new Set()); // Set of audio_url strings
  const [downloadedSheets, setDownloadedSheets] = useState(new Set());
  const [offlineBusyId, setOfflineBusyId] = useState(null);
  const [offlineError, setOfflineError] = useState("");

  useEffect(() => {
    let active = true;
    const allTracks = lists.flatMap((l) => l.tracks);
    const allAudioUrls = [];
    allTracks.forEach((t) => {
      if (t.audio_url) allAudioUrls.push(t.audio_url);
      (t.parts || []).forEach((p) => { if (p.audio_url) allAudioUrls.push(p.audio_url); });
    });
    Promise.all(allAudioUrls.map(async (url) => [url, await isAudioDownloaded(url)])).then((entries) => {
      if (active) setDownloadedAudio(new Set(entries.filter(([, ok]) => ok).map(([url]) => url)));
    });
    Promise.all(allTracks.filter((t) => t.sheet_pdf_url).map(async (t) => [t.id, await isSheetDownloaded(t.sheet_pdf_url)])).then((entries) => {
      if (active) setDownloadedSheets(new Set(entries.filter(([, ok]) => ok).map(([id]) => id)));
    });
    return () => { active = false; };
  }, [lists]);

  // busyKey/url let this work for a track's Full Mix audio or any of its per-part files.
  const downloadAudioUrl = async (busyKey, url) => {
    setOfflineBusyId(`audio-${busyKey}`);
    setOfflineError("");
    const { error } = await downloadAudioOffline(url);
    if (error) setOfflineError(error);
    else setDownloadedAudio((prev) => new Set(prev).add(url));
    setOfflineBusyId(null);
  };

  const removeAudioUrl = async (busyKey, url) => {
    setOfflineBusyId(`audio-${busyKey}`);
    await removeAudioOffline(url);
    setDownloadedAudio((prev) => { const next = new Set(prev); next.delete(url); return next; });
    setOfflineBusyId(null);
  };

  const downloadTrackAudio = (track) => downloadAudioUrl(track.id, track.audio_url);
  const removeTrackAudio = (track) => removeAudioUrl(track.id, track.audio_url);

  const downloadTrackSheet = async (track) => {
    setOfflineBusyId(`sheet-${track.id}`);
    setOfflineError("");
    const { error } = await downloadSheetOffline(track.sheet_pdf_url);
    if (error) setOfflineError(error);
    else setDownloadedSheets((prev) => new Set(prev).add(track.id));
    setOfflineBusyId(null);
  };

  const removeTrackSheet = async (track) => {
    setOfflineBusyId(`sheet-${track.id}`);
    await removeSheetOffline(track.sheet_pdf_url);
    setDownloadedSheets((prev) => { const next = new Set(prev); next.delete(track.id); return next; });
    setOfflineBusyId(null);
  };

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
        const { data } = supabase.storage.from("practice-covers").getPublicUrl(path);        cover_url = data.publicUrl;
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
    setTrackPartFiles({});
    setEditingTrack(null);
    setShowTrackForm(false);
    setTrackError("");
  };

  const startEditTrack = (track) => {
    setEditingTrack(track);
    setTrackForm({ title: track.title || "", composer: track.composer || "" });
    setTrackAudioFile(null);
    setTrackPdfFile(null);
    setTrackPartFiles({});
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
    for (const [partName, file] of Object.entries(trackPartFiles)) {
      if (file && !file.type.startsWith("audio/")) {
        setTrackError(`"${file.name}" for ${partName} doesn't look like an audio file.`);
        return;
      }
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
        // practice-sheets is a private bucket — store the path and sign a URL on demand, not a public URL.
        sheet_pdf_url = pdfPath;
      }
      const payload = { title: trackForm.title.trim(), composer: trackForm.composer.trim(), audio_url, sheet_pdf_url, practice_list_id: openListId };
      let trackId = editingTrack?.id;
      if (editingTrack) {
        const { error } = await supabase.from("practice_tracks").update(payload).eq("id", editingTrack.id);
        if (error) throw error;
      } else {
        const maxOrder = (openList?.tracks || []).reduce((m, t) => Math.max(m, t.display_order || 0), 0);
        const { data, error } = await supabase.from("practice_tracks").insert({ ...payload, display_order: maxOrder + 1 }).select().single();
        if (error) throw error;
        trackId = data.id;
      }

      const partEntries = Object.entries(trackPartFiles).filter(([, file]) => file);
      for (const [partName, file] of partEntries) {
        const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
        const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: partUploadError } = await supabase.storage.from("practice-audio").upload(path, file);
        if (partUploadError) throw partUploadError;
        const { data: partData } = supabase.storage.from("practice-audio").getPublicUrl(path);
        const { error: partRowError } = await supabase
          .from("practice_track_parts")
          .upsert({ track_id: trackId, part_name: partName, audio_url: partData.publicUrl }, { onConflict: "track_id,part_name" });
        if (partRowError) throw partRowError;
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
        <audio ref={audioRef} src={playableSrc || activeAudioUrl} autoPlay />
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, width: 44 }}>
            {currentTrack.sheet_pdf_url && (
              <button
                onClick={() => setViewingSheet({ path: currentTrack.sheet_pdf_url, title: currentTrack.title })}
                className="dvbc-tap" style={{ background: "none", border: "none", color: "#fff", display: "flex", cursor: "pointer", padding: 0 }}
              >
                <FileText size={18} color="#fff" />
              </button>
            )}
            {activeAudioUrl && (
              <button
                onClick={() => (downloadedAudio.has(activeAudioUrl) ? removeAudioUrl(`${currentTrack.id}-${activePart}`, activeAudioUrl) : downloadAudioUrl(`${currentTrack.id}-${activePart}`, activeAudioUrl))}
                disabled={offlineBusyId === `audio-${currentTrack.id}-${activePart}`} className="dvbc-tap"
                style={{ background: "none", border: "none", display: "flex", cursor: "pointer", padding: 0, opacity: offlineBusyId === `audio-${currentTrack.id}-${activePart}` ? 0.5 : 1 }}
                title={downloadedAudio.has(activeAudioUrl) ? `${activePart} downloaded for offline use — tap to remove` : `Save ${activePart} for offline use`}
              >
                {downloadedAudio.has(activeAudioUrl) ? <CheckSquare size={18} color="#fff" /> : <Download size={18} color="rgba(255,255,255,0.8)" />}
              </button>
            )}
          </div>
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
          <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: 19, marginBottom: 2 }}>{currentTrack.title}</div>
          {currentTrack.composer && <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginBottom: 18 }}>{currentTrack.composer}</div>}

          {trackHasParts && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {TRACK_PART_NAMES.filter((p) => p === "Full Mix" || currentTrack.parts.some((cp) => cp.part_name === p)).map((p) => {
                const partUrl = p === "Full Mix" ? currentTrack.audio_url : currentTrack.parts.find((cp) => cp.part_name === p)?.audio_url;
                const partDownloaded = partUrl && downloadedAudio.has(partUrl);
                const partBusyKey = `${currentTrack.id}-${p}`;
                return (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 3, background: activePart === p ? "#fff" : "rgba(255,255,255,0.14)", borderRadius: 999, padding: "3px 3px 3px 13px" }}>
                    <button
                      onClick={() => switchPart(p)} className="dvbc-tap"
                      style={{ background: "none", border: "none", color: activePart === p ? C.garnet : "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "3px 4px 3px 0" }}
                    >
                      {p}
                    </button>
                    {partUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); partDownloaded ? removeAudioUrl(partBusyKey, partUrl) : downloadAudioUrl(partBusyKey, partUrl); }}
                        disabled={offlineBusyId === `audio-${partBusyKey}`} className="dvbc-tap"
                        title={partDownloaded ? `${p} saved offline — tap to remove` : `Save ${p} for offline use`}
                        style={{ background: "none", border: "none", display: "flex", cursor: "pointer", padding: 4, opacity: offlineBusyId === `audio-${partBusyKey}` ? 0.5 : 1 }}
                      >
                        {partDownloaded
                          ? <CheckSquare size={12} color={activePart === p ? C.sage : "#fff"} />
                          : <Download size={12} color={activePart === p ? C.inkSoft : "rgba(255,255,255,0.6)"} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div onClick={seekTo} style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.22)", cursor: "pointer", position: "relative", marginTop: currentTrack.composer || trackHasParts ? 0 : 18 }}>
            <div style={{ height: "100%", borderRadius: 999, background: "#fff", width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            {duration > 0 && loopStart != null && (
              <div style={{ position: "absolute", top: -4, left: `${(loopStart / duration) * 100}%`, width: 2, height: 13, background: C.roseDeep || "#e0507a", borderRadius: 1 }} />
            )}
            {duration > 0 && loopEnd != null && (
              <div style={{ position: "absolute", top: -4, left: `${(loopEnd / duration) * 100}%`, width: 2, height: 13, background: C.roseDeep || "#e0507a", borderRadius: 1 }} />
            )}
            {duration > 0 && loopStart != null && loopEnd != null && (
              <div style={{ position: "absolute", top: 0, left: `${(loopStart / duration) * 100}%`, width: `${((loopEnd - loopStart) / duration) * 100}%`, height: "100%", background: "rgba(255,255,255,0.35)", borderRadius: 999 }} />
            )}
          </div>
          {(loopStart != null || loopEnd != null) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: 0.5 }}>
                LOOP {formatDuration(loopStart || 0)}{loopEnd != null ? ` – ${formatDuration(loopEnd)}` : " – set B"}
              </span>
              <button onClick={clearLoop} className="dvbc-tap" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Clear
              </button>
            </div>
          )}
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
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <button
              onClick={setLoopPoint} className="dvbc-tap"
              style={{
                background: loopStart != null ? "rgba(255,255,255,0.18)" : "none", border: `1px solid ${loopStart != null ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.3)"}`,
                borderRadius: 999, padding: "6px 16px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              }}
            >
              {loopStart == null ? "Set Loop A" : loopEnd == null ? "Set Loop B" : "Restart Loop"}
            </button>
          </div>
        </div>
        {viewingSheet && (
          <SheetMusicViewer path={viewingSheet.path} title={viewingSheet.title} onClose={() => setViewingSheet(null)} userId={myUserId} />
        )}
      </div>
    );
  }
  if (openList) {
    return (
      <div style={{ paddingBottom: currentTrack ? 190 : 110 }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setOpenListId(null)} className="dvbc-tap" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={20} color={C.ink} />
          </button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.ink }}>{openList.title}</div>
        </div>
        <div style={{ padding: "6px 24px 0" }}>
          <Pill>{openList.owner_user_id ? "Personal" : openList.voice_part}</Pill>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          {canManage(openList) && (
            <button
              onClick={() => { setEditingTrack(null); setTrackForm({ title: "", composer: "" }); setShowTrackForm(true); }}
              className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
            >
              + Add Track
            </button>
          )}

          {offlineError && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginBottom: 10 }}>
              <AlertCircle size={13} /> {offlineError}
            </div>
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
                <button onClick={(e) => { e.stopPropagation(); playTrack(t); }} className="dvbc-tap" style={{ width: 34, height: 34, borderRadius: "50%", background: gradient(), border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  {playing ? <Pause size={13} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  {t.composer && <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{t.composer}</div>}
                </div>
                {t.audio_url && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <OfflineToggle
                      downloaded={downloadedAudio.has(t.audio_url)} busy={offlineBusyId === `audio-${t.id}`}
                      onDownload={() => downloadTrackAudio(t)} onRemove={() => removeTrackAudio(t)}
                    />
                  </div>
                )}
                {t.sheet_pdf_url && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingSheet({ path: t.sheet_pdf_url, title: t.title }); }}
                      className="dvbc-tap"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: C.lilacSoft, border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.plum, cursor: "pointer" }}
                      title="View sheet music"
                    >
                      <FileText size={14} color={C.plum} />
                    </button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <OfflineToggle
                        downloaded={downloadedSheets.has(t.id)} busy={offlineBusyId === `sheet-${t.id}`}
                        onDownload={() => downloadTrackSheet(t)} onRemove={() => removeTrackSheet(t)}
                      />
                    </div>
                  </>
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
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
                {editingTrack ? "Edit Track" : "Add Track"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={inputStyle} placeholder="Track title" value={trackForm.title} onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} />
                <input style={inputStyle} placeholder="Composer (optional)" value={trackForm.composer} onChange={(e) => setTrackForm({ ...trackForm, composer: e.target.value })} />
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Audio (Full Mix)</label>
                  <input type="file" accept="*/*" onChange={(e) => setTrackAudioFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
                  {editingTrack && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>Leave empty to keep the existing audio.</div>}
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Voice part tracks (optional)</label>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 6 }}>Upload a separate recording per part so members can switch between them while practising.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {["Accompaniment", "Soprano 1", "Soprano 2", "Alto 1", "Alto 2", "Tenor 1", "Tenor 2", "Bass 1", "Bass 2"].map((partName) => {
                      const existingPart = editingTrack?.parts?.find((p) => p.part_name === partName);
                      return (
                        <div key={partName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.plum, width: 82, flexShrink: 0 }}>{partName}</span>
                          <input
                            type="file" accept="*/*"
                            onChange={(e) => setTrackPartFiles((prev) => ({ ...prev, [partName]: e.target.files?.[0] || null }))}
                            style={{ fontSize: 11.5, flex: 1, minWidth: 0 }}
                          />
                          {existingPart && <CheckSquare size={14} color={C.plum} />}
                        </div>
                      );
                    })}
                  </div>
                  {editingTrack && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>Leave a part empty to keep its existing recording (checkmark shown where one exists).</div>}
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
                <button onClick={saveTrack} disabled={savingTrack} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingTrack ? "default" : "pointer", opacity: savingTrack ? 0.8 : 1 }}>
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
            <audio ref={audioRef} src={playableSrc || activeAudioUrl} autoPlay />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentTrack.title}</div>
            <div onClick={(e) => { e.stopPropagation(); seekTo(e); }} style={{ height: 6, borderRadius: 999, background: C.lilacSoft, cursor: "pointer", position: "relative" }}>
              <div style={{ height: "100%", borderRadius: 999, background: gradient(), width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>{formatDuration(progress)} / {formatDuration(duration)}</div>
              <button onClick={(e) => { e.stopPropagation(); playTrack(currentTrack); }} className="dvbc-tap" style={{ width: 30, height: 30, borderRadius: "50%", background: gradient(), border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {isPlaying ? <Pause size={13} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
              </button>
            </div>
          </div>
        )}
        {viewingSheet && (
          <SheetMusicViewer path={viewingSheet.path} title={viewingSheet.title} onClose={() => setViewingSheet(null)} userId={myUserId} />
        )}
      </div>
    );
  }

  /* ---------- Top-level: personal lists + group lists ---------- */
  return (
    <div style={{ paddingBottom: 110 }}>
      <TopHeader title="Practice Lists" subtitle="Personal & group playlists" />

      <div style={{ padding: "16px 24px 0", display: "flex", gap: 8 }}>
        {[["lists", "Lists"], ["assignments", "Assignments"], ["solfege", "Solfège"], ["rhythm", "Rhythm"], ["tools", "Keyboard"]].map(([key, label]) => (
          <button
            key={key} onClick={() => setView(key)} className="dvbc-tap"
            style={{
              flex: 1, border: "none", cursor: "pointer", borderRadius: 12, padding: "10px 0",
              fontSize: 12.5, fontWeight: 700, position: "relative",
              background: view === key ? gradient() : C.lilacSoft,
              color: view === key ? "#fff" : C.inkSoft,
            }}
          >
            {label}
            {key === "assignments" && myAssignments.filter((a) => !myCompletedIds.has(a.id)).length > 0 && (
              <span style={{
                position: "absolute", top: -4, right: 10, minWidth: 16, height: 16, borderRadius: 8,
                background: view === key ? "rgba(255,255,255,0.9)" : C.roseDeep,
                color: view === key ? C.garnet : "#fff", fontSize: 9.5, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>
                {myAssignments.filter((a) => !myCompletedIds.has(a.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "lists" && (
      <>
      <div style={{ padding: "18px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink }}>Your Practice Lists</div>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {personalLists.map((list) => (
            <button
              key={list.id} onClick={() => setOpenListId(list.id)} className="dvbc-tap"
              style={{
                width: 108, height: 108, borderRadius: 16, flexShrink: 0, border: "none", cursor: "pointer",
                background: list.cover_url ? `url(${list.cover_url}) center/cover` : gradient(),
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
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.ink }}>Group Practice Lists</div>
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
            style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
          >
            + Add Group List
          </button>
        )}

        {loading && <BrandSpinner />}
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
                background: list.cover_url ? `url(${list.cover_url}) center/cover` : gradient(),
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
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
              <button onClick={saveList} disabled={savingList} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingList ? "default" : "pointer", opacity: savingList ? 0.8 : 1 }}>
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
      </>
      )}

      {view === "assignments" && (
        <div style={{ padding: "18px 24px 0" }}>
          {isAdmin && (
            <button
              onClick={() => { resetAssignmentForm(); setShowAssignmentForm(true); }}
              className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
            >
              + New Assignment
            </button>
          )}

          {showAssignmentForm && (
            <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
                {editingAssignment ? "Edit Assignment" : "New Assignment"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={inputStyle} placeholder="Assignment title" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} />
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Notes (optional) — e.g. measures to focus on"
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                />
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Link a track (optional)</label>
                  <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px" }}>
                    <select
                      value={assignmentForm.practice_track_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, practice_track_id: e.target.value })}
                      style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                    >
                      <option value="">No track</option>
                      {lists.map((l) => (
                        <optgroup key={l.id} label={l.title}>
                          {l.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Assign to</label>
                  <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px" }}>
                    <select
                      value={assignmentForm.part}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, part: e.target.value, assigned_member_id: "" })}
                      style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                    >
                      <option value="All">Everyone</option>
                      {VOICE_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                      <option value="Individual">Specific member…</option>
                    </select>
                  </div>
                  {assignmentForm.part === "Individual" && (
                    <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px", marginTop: 8 }}>
                      <select
                        value={assignmentForm.assigned_member_id}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, assigned_member_id: e.target.value })}
                        style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                      >
                        <option value="">Choose a member</option>
                        {members.slice().sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Due date (optional)</label>
                  <input
                    type="date" style={inputStyle} value={assignmentForm.due_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                  />
                </div>
              </div>
              {assignmentError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 10 }}>
                  <AlertCircle size={13} /> {assignmentError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={saveAssignment} disabled={savingAssignment} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingAssignment ? "default" : "pointer", opacity: savingAssignment ? 0.8 : 1 }}>
                  {savingAssignment ? "Saving…" : "Save"}
                </button>
                <button onClick={resetAssignmentForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
                {editingAssignment && (
                  <button onClick={() => deleteAssignment(editingAssignment)} className="dvbc-tap" style={{ background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 13, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingAssignments && <BrandSpinner />}
          {!loadingAssignments && myAssignments.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No assignments yet.</div>
          )}

          {!loadingAssignments && myAssignments.map((a) => {
            const done = myCompletedIds.has(a.id);
            const overdue = isOverdue(a);
            const track = trackById[a.practice_track_id];
            return (
              <div
                key={a.id}
                style={{
                  background: C.card, border: `1.4px solid ${overdue ? C.roseDeep : C.lilacLine}`, borderRadius: 14,
                  padding: 14, marginBottom: 10, opacity: done ? 0.72 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <button
                    onClick={() => toggleAssignmentComplete(a)} disabled={completingId === a.id} className="dvbc-tap"
                    style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1, cursor: "pointer",
                      border: `2px solid ${done ? C.sage : C.lilacLine}`, background: done ? C.sage : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title={done ? "Mark as not done" : "Mark as done"}
                  >
                    {done && <CheckSquare size={13} color="#fff" />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, textDecoration: done ? "line-through" : "none" }}>{a.title}</div>
                    {a.notes && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.4 }}>{a.notes}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {a.due_date && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: overdue ? C.roseDeep : C.inkSoft }}>
                          {overdue ? "Overdue · " : "Due "}{new Date(a.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <Pill tone={a.assigned_member_id ? "gold" : "gold"}>{a.assigned_member_id ? "Just for you" : a.part}</Pill>
                      {isAdmin && (
                        <span style={{ fontSize: 10.5, color: C.inkSoft }}>{completedCountFor(a)}/{targetCountFor(a)} done</span>
                      )}
                    </div>
                    {track && (
                      <button
                        onClick={() => openAssignmentTrack(a)} className="dvbc-tap"
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 10, color: C.plum, fontSize: 11.5, fontWeight: 700 }}
                      >
                        <Play size={12} color={C.plum} fill={C.plum} /> {track.title}
                      </button>
                    )}
                  </div>
                  {isAdmin && (
                    <button onClick={() => startEditAssignment(a)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, flexShrink: 0 }}>Edit</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "solfege" && (
        <div style={{ padding: "18px 24px 0" }}>
          {isAdmin && (
            <button
              onClick={() => { resetPatternForm(); setShowPatternForm(true); }}
              className="dvbc-tap"
              style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 14 }}
            >
              + New Pattern
            </button>
          )}

          {showPatternForm && (
            <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink, marginBottom: 10 }}>
                {editingPattern ? "Edit Pattern" : "New Solfège Pattern"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={inputStyle} placeholder="Pattern title" value={patternForm.title} onChange={(e) => setPatternForm({ ...patternForm, title: e.target.value })} />
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Starting note</label>
                  <div style={{ border: `1.4px solid ${C.lilacLine}`, background: "#fff", borderRadius: 12, padding: "4px 10px" }}>
                    <select
                      value={patternForm.startMidi}
                      onChange={(e) => setPatternForm({ ...patternForm, startMidi: Number(e.target.value) })}
                      style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: C.ink, padding: "10px 4px" }}
                    >
                      {START_NOTES.map((n) => <option key={n.midi} value={n.midi}>{n.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Syllables</label>
                  <input
                    style={inputStyle} placeholder="Do Re Mi Fa Sol La Ti Do'"
                    value={patternForm.syllablesText}
                    onChange={(e) => setPatternForm({ ...patternForm, syllablesText: e.target.value })}
                  />
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Space-separated: Do Re Mi Fa Sol La Ti — use Do' for the octave up.</div>
                </div>
                <textarea
                  style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Notes (optional)"
                  value={patternForm.notes}
                  onChange={(e) => setPatternForm({ ...patternForm, notes: e.target.value })}
                />
              </div>
              {patternError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 11.5, marginTop: 10 }}>
                  <AlertCircle size={13} /> {patternError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={savePattern} disabled={savingPattern} className="dvbc-tap" style={{ flex: 1, background: gradient(), color: "#fff", fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: savingPattern ? "default" : "pointer", opacity: savingPattern ? 0.8 : 1 }}>
                  {savingPattern ? "Saving…" : "Save"}
                </button>
                <button onClick={resetPatternForm} className="dvbc-tap" style={{ flex: 1, background: C.lilacSoft, color: C.plum, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
                {editingPattern && (
                  <button onClick={() => deletePattern(editingPattern)} className="dvbc-tap" style={{ background: C.roseBg, color: C.roseDeep, fontWeight: 700, fontSize: 13, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingPatterns && <BrandSpinner />}
          {!loadingPatterns && patterns.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "10px 0" }}>No solfège patterns yet.</div>
          )}

          {!loadingPatterns && patterns.map((p) => {
            const notes = parseSolfege((p.syllables || []).join(" "));
            return (
              <div key={p.id} style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => playSolfegePattern(p)} className="dvbc-tap"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: gradient(), border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      title="Play full pattern"
                    >
                      {playingPatternId === p.id ? <Pause size={13} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
                    </button>
                    {isAdmin && (
                      <button onClick={() => startEditPattern(p)} className="dvbc-tap" style={{ background: "none", border: "none", color: C.plum, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Edit</button>
                    )}
                  </div>
                </div>
                {p.notes && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10, lineHeight: 1.4 }}>{p.notes}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {notes.map((n, i) => (
                    <button
                      key={i} onClick={() => { haptic(6); playSolfegeTone(p.start_midi, n.semitone); }} className="dvbc-tap"
                      style={{
                        minWidth: 44, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                        background: C.lilacSoft, color: C.plum, fontSize: 13, fontWeight: 700, textAlign: "center",
                      }}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "rhythm" && <RhythmGame onBack={() => setView("lists")} />}

      {view === "tools" && <PracticeTools />}
    </div>
  );
}

/* ============================================================
   Keyboard / Organ + Vocal Pitch Monitor
   ============================================================ */

const KB_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function kbMidiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function kbMidiToName(midi) {
  const name = KB_NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, label: `${name}${octave}`, isSharp: name.includes("#") };
}
function kbFreqToMidi(freq) {
  return 12 * Math.log2(freq / 440) + 69;
}

// Note names used for the transpose readout, sharps preferred (matches how most
// choir/hymnal keys are conventionally written, e.g. Bb hymns aside).
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const KB_TIMBRES = [
  { key: "piano", label: "Piano" },
  { key: "organ", label: "Organ" },
  { key: "superorgan", label: "Super Organ" },
  { key: "choir", label: "Choir" },
  { key: "strings", label: "Strings" },
  { key: "superstrings", label: "Super Strings" },
  { key: "synth", label: "Synth" },
];

// Reuses the app's shared AudioContext singleton (see playChime above) so the keyboard,
// pitch monitor, and notification chime never spin up multiple concurrent contexts.
function getSharedAudioCtx() {
  _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

// Generates a synthetic reverb impulse response (shaped noise burst) so we get a
// convincing hall/room tail without shipping or downloading an actual IR audio file.
function makeSyntheticImpulseResponse(ctx, durationSec = 2.4, decay = 2.2) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // White noise shaped by an exponential decay envelope, with a touch of
      // channel-to-channel randomness for stereo width.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

let _keyboardBus = null;
// Shared master bus for every keyboard voice: a "vocal pocket" EQ notch around
// 400Hz (where alto/tenor voices sit) so the keyboard doesn't mask live singers,
// followed by a reverb send (dry + convolved wet, mixed at a fixed 0.35 ratio)
// for a sense of room/hall space. Built once per AudioContext and reused.
function getKeyboardBus(ctx) {
  if (_keyboardBus && _keyboardBus.ctx === ctx) return _keyboardBus;

  const vocalPocketEQ = ctx.createBiquadFilter();
  vocalPocketEQ.type = "peaking";
  vocalPocketEQ.frequency.value = 400;
  vocalPocketEQ.Q.value = 1.0;
  vocalPocketEQ.gain.value = -3.5;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.65;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.35;

  const convolver = ctx.createConvolver();
  convolver.buffer = makeSyntheticImpulseResponse(ctx);

  vocalPocketEQ.connect(dryGain);
  dryGain.connect(ctx.destination);
  vocalPocketEQ.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(ctx.destination);

  _keyboardBus = { ctx, input: vocalPocketEQ };
  return _keyboardBus;
}

function kbPlayVoice(ctx, freq, timbre, gainScale = 1) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0;
  const outputScale = ctx.createGain();
  outputScale.gain.value = gainScale;
  master.connect(outputScale);
  outputScale.connect(getKeyboardBus(ctx).input);
  const nodes = [];

  if (timbre === "organ") {
    // Drawbar-style organ: fundamental + octave + fifth + second octave, sustained while held.
    const partials = [
      { ratio: 1, gain: 0.5 }, { ratio: 2, gain: 0.28 }, { ratio: 3, gain: 0.12 }, { ratio: 4, gain: 0.16 },
    ];
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * p.ratio;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      nodes.push(osc);
    });
    master.gain.linearRampToValueAtTime(0.5, now + 0.02);
  } else if (timbre === "superorgan") {
    // Full cathedral drawbar stack: sub-octave (16'), fundamental (8'), octave (4'),
    // twelfth (2 2/3'), super-octave (2'), and a mixture partial — each doubled with
    // a slightly detuned twin for that big, chorused pipe-organ character.
    const partials = [
      { ratio: 0.5, gain: 0.24 },  // 16' sub
      { ratio: 1, gain: 0.42 },    // 8' fundamental
      { ratio: 2, gain: 0.26 },    // 4' octave
      { ratio: 3, gain: 0.16 },    // 2 2/3' twelfth
      { ratio: 4, gain: 0.18 },    // 2' super-octave
      { ratio: 6, gain: 0.09 },    // mixture
      { ratio: 8, gain: 0.06 },    // mixture (higher)
    ];
    partials.forEach((p) => {
      [0.998, 1.002].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq * p.ratio * detune;
        const g = ctx.createGain();
        g.gain.value = p.gain * 0.5;
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        nodes.push(osc);
      });
    });
    master.gain.linearRampToValueAtTime(0.62, now + 0.035);
  } else if (timbre === "superstrings") {
    // Large ensemble strings: six detuned sawtooths spread wide, plus a sub-octave
    // layer for weight, gentle vibrato, and a slower bowed swell than the base Strings voice.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 4.5;
    filter.Q.value = 0.5;
    filter.connect(master);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.6;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = freq * 0.004;
    vibrato.start(now);
    nodes.push(vibrato);
    [0.985, 0.992, 0.998, 1.004, 1.01, 1.017].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq * detune;
      vibratoGain.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.19;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      nodes.push(osc);
    });
    vibrato.connect(vibratoGain);
    // Sub-octave layer for extra body underneath the ensemble.
    const subOsc = ctx.createOscillator();
    subOsc.type = "sawtooth";
    subOsc.frequency.value = freq * 0.5;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.12;
    subOsc.connect(subGain);
    subGain.connect(filter);
    subOsc.start(now);
    nodes.push(subOsc);
    master.gain.linearRampToValueAtTime(0.5, now + 0.28);
  } else if (timbre === "choir") {
    // Soft sustained "ooh": sawtooth through a lowpass filter, slow attack, gentle vibrato.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 3.2;
    filter.Q.value = 0.7;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.2;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = freq * 0.006;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(master);
    osc.start(now);
    vibrato.start(now);
    nodes.push(osc, vibrato);
    master.gain.linearRampToValueAtTime(0.45, now + 0.35);
  } else if (timbre === "strings") {
    // Ensemble strings: three detuned sawtooths through a lowpass filter, slow bowed attack.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 4;
    filter.Q.value = 0.4;
    filter.connect(master);
    [0.994, 1, 1.006].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq * detune;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      nodes.push(osc);
    });
    master.gain.linearRampToValueAtTime(0.42, now + 0.18);
  } else if (timbre === "synth") {
    // Punchy lead synth: square wave, fast attack, flat sustain.
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 6;
    filter.Q.value = 1;
    osc.connect(filter);
    filter.connect(master);
    osc.start(now);
    nodes.push(osc);
    master.gain.linearRampToValueAtTime(0.35, now + 0.01);
  } else {
    // Piano: bright quick attack, exponential decay toward a lower sustain, two detuned oscillators.
    [1, 1.003].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq * detune;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      nodes.push(osc);
    });
    master.gain.linearRampToValueAtTime(0.55, now + 0.008);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.4);
  }

  return {
    stop() {
      const t = ctx.currentTime;
      const release = timbre === "choir" ? 0.35 : timbre === "strings" ? 0.3 : timbre === "superstrings" ? 0.4
        : timbre === "organ" ? 0.12 : timbre === "superorgan" ? 0.18 : timbre === "synth" ? 0.08 : 0.25;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + release);
      nodes.forEach((n) => n.stop(t + release + 0.02));
    },
  };
}

function Keyboard() {
  const [timbre, setTimbre] = useState("piano");
  const [layerTimbre, setLayerTimbre] = useState("none"); // secondary voice layered on top, "none" = off
  const [layerGain, setLayerGain] = useState(0.65); // secondary layer kept quieter than the primary by default
  const [transpose, setTranspose] = useState(0); // semitone shift applied to sounding pitch, key layout stays put
  const [baseKeyIndex, setBaseKeyIndex] = useState(0); // original/written key of the piece, tap to cycle — default C
  const [sustain, setSustain] = useState(false);
  const [activeNotes, setActiveNotes] = useState({});
  const voicesRef = useRef({});
  const keysDownRef = useRef(new Set()); // midi notes physically held right now (finger still down)
  const scrollRef = useRef(null);
  const containerRef = useRef(null);

  const [fullscreenActive, setFullscreenActive] = useState(false);
  const getIsPortrait = () => (typeof window !== "undefined" ? window.innerHeight > window.innerWidth : true);
  const [isPortrait, setIsPortrait] = useState(getIsPortrait());
  const [dims, setDims] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 360, h: typeof window !== "undefined" ? window.innerHeight : 640 });

  useEffect(() => {
    const onResize = () => {
      setIsPortrait(getIsPortrait());
      setDims({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreenActive(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const enterLandscape = async () => {
    try { await containerRef.current?.requestFullscreen?.(); } catch (e) {}
    try { await window.screen?.orientation?.lock?.("landscape"); } catch (e) {}
    setDims({ w: window.innerWidth, h: window.innerHeight });
    setIsPortrait(getIsPortrait());
    setFullscreenActive(true);
  };

  const exitLandscape = () => {
    try { window.screen?.orientation?.unlock?.(); } catch (e) {}
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    setFullscreenActive(false);
  };

  const LOW_MIDI = 21;  // A0
  const HIGH_MIDI = 108; // C8 -> full 88-key piano range

  const midiRange = [];
  for (let m = LOW_MIDI; m <= HIGH_MIDI; m++) midiRange.push(m);
  const whiteKeys = midiRange.filter((m) => !kbMidiToName(m).isSharp);
  const octaveMarkers = midiRange.filter((m) => m % 12 === 0); // every C

  const scrollToMidi = (midi, whiteW) => {
    if (!scrollRef.current) return;
    const idx = whiteKeys.indexOf(midi);
    if (idx < 0) return;
    scrollRef.current.scrollTo({ left: Math.max(0, idx * whiteW - 16), behavior: "smooth" });
  };
  const scrollByOctave = (dir, whiteW) => {
    scrollRef.current?.scrollBy({ left: dir * whiteW * 7, behavior: "smooth" });
  };

  const startNote = useCallback((midi) => {
    const ctx = getSharedAudioCtx();
    keysDownRef.current.add(midi);
    // With sustain on, a new key press releases any previous notes that are only
    // still ringing because of the pedal (finger already lifted) — chords stay
    // intact since notes you're still physically holding are left alone.
    if (sustain) {
      Object.keys(voicesRef.current).forEach((k) => {
        const heldMidi = Number(k);
        if (heldMidi === midi) return;
        if (keysDownRef.current.has(heldMidi)) return; // still physically held — leave it playing
        voicesRef.current[heldMidi].stop();
        delete voicesRef.current[heldMidi];
        setActiveNotes((prev) => { const next = { ...prev }; delete next[heldMidi]; return next; });
      });
    }
    if (voicesRef.current[midi]) {
      // Already sounding (e.g. a stuck note from a missed release) — retrigger cleanly.
      voicesRef.current[midi].stop();
    }
    const freq = kbMidiToFreq(midi + transpose);
    const primaryVoice = kbPlayVoice(ctx, freq, timbre);
    const layerVoice = (layerTimbre !== "none" && layerTimbre !== timbre)
      ? kbPlayVoice(ctx, freq, layerTimbre, layerGain)
      : null;
    voicesRef.current[midi] = {
      stop() {
        primaryVoice.stop();
        if (layerVoice) layerVoice.stop();
      },
    };
    setActiveNotes((prev) => ({ ...prev, [midi]: true }));
  }, [timbre, sustain, layerTimbre, layerGain, transpose]);

  // Safety-net panic button: force-clears every voice and tracked key state,
  // in case a note ever gets stuck from a missed touch/mouse release event.
  const stopAllNotes = useCallback(() => {
    Object.values(voicesRef.current).forEach((v) => v.stop());
    voicesRef.current = {};
    keysDownRef.current.clear();
    setActiveNotes({});
  }, []);

  const stopNote = useCallback((midi) => {
    keysDownRef.current.delete(midi);
    if (sustain) return; // pedal down: let the note keep ringing until the pedal lifts
    const v = voicesRef.current[midi];
    if (v) { v.stop(); delete voicesRef.current[midi]; }
    setActiveNotes((prev) => { const next = { ...prev }; delete next[midi]; return next; });
  }, [sustain]);

  // Releases only the notes that are ringing solely because the pedal was down —
  // keys the player still has a finger on keep sounding uninterrupted.
  const releaseAllSustained = useCallback(() => {
    Object.keys(voicesRef.current).forEach((k) => {
      const midi = Number(k);
      if (keysDownRef.current.has(midi)) return; // still physically held — leave it playing
      voicesRef.current[midi].stop();
      delete voicesRef.current[midi];
    });
    setActiveNotes((prev) => {
      const next = {};
      keysDownRef.current.forEach((midi) => { if (prev[midi]) next[midi] = true; });
      return next;
    });
  }, []);

  useEffect(() => () => releaseAllSustained(), []);

  const timbreRow = (compact) => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
      {KB_TIMBRES.map((t) => (
        <button
          key={t.key} onClick={() => setTimbre(t.key)} className="dvbc-tap"
          style={{
            flexShrink: 0, whiteSpace: "nowrap",
            border: `1.4px solid ${timbre === t.key ? C.garnet : (compact ? "rgba(255,255,255,0.3)" : C.lilacLine)}`,
            background: timbre === t.key ? gradient() : (compact ? "rgba(255,255,255,0.08)" : "#fff"),
            color: timbre === t.key ? "#fff" : (compact ? "rgba(255,255,255,0.75)" : C.inkSoft),
            fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 20, cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // Layer voice picker: adds a second voice on top of the primary, e.g. Piano + Strings.
  // "No Layer" (first chip) turns layering off and plays only the primary voice.
  const layerRow = (compact) => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
      {[{ key: "none", label: "No Layer" }, ...KB_TIMBRES].map((t) => (
        <button
          key={t.key} onClick={() => setLayerTimbre(t.key)} className="dvbc-tap"
          style={{
            flexShrink: 0, whiteSpace: "nowrap",
            border: `1.4px solid ${layerTimbre === t.key ? C.sage : (compact ? "rgba(255,255,255,0.3)" : C.lilacLine)}`,
            background: layerTimbre === t.key ? C.sage : (compact ? "rgba(255,255,255,0.08)" : "#fff"),
            color: layerTimbre === t.key ? "#fff" : (compact ? "rgba(255,255,255,0.75)" : C.inkSoft),
            fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 20, cursor: "pointer",
          }}
        >
          {t.key === "none" ? t.label : `+ ${t.label}`}
        </button>
      ))}
    </div>
  );

  // Quick 3-step balance for the layer voice's volume relative to the primary,
  // shown only once a layer is actually selected.
  const LAYER_BALANCE_STEPS = [
    { value: 0.4, label: "Layer Soft" },
    { value: 0.65, label: "Layer Even" },
    { value: 0.9, label: "Layer Strong" },
  ];
  const layerGainRow = (compact) => (
    layerTimbre === "none" ? null : (
      <div style={{ display: "flex", gap: 6 }}>
        {LAYER_BALANCE_STEPS.map((s) => (
          <button
            key={s.label} onClick={() => setLayerGain(s.value)} className="dvbc-tap"
            style={{
              flexShrink: 0, whiteSpace: "nowrap",
              border: `1.4px solid ${layerGain === s.value ? C.garnet : (compact ? "rgba(255,255,255,0.3)" : C.lilacLine)}`,
              background: layerGain === s.value ? gradient() : (compact ? "rgba(255,255,255,0.08)" : "#fff"),
              color: layerGain === s.value ? "#fff" : (compact ? "rgba(255,255,255,0.75)" : C.inkSoft),
              fontSize: 11, fontWeight: 600, padding: "5px 9px", borderRadius: 20, cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    )
  );

  // Transpose stepper: shifts the sounding pitch up/down by semitones without moving
  // the key layout — lets an accompanist keep familiar fingering while matching the
  // choir's comfortable range. The "Key" chip sets the piece's original/written key;
  // the readout then shows the resulting key once transpose is applied.
  const TRANSPOSE_MIN = -12, TRANSPOSE_MAX = 12;
  const resultKeyIndex = ((baseKeyIndex + transpose) % 12 + 12) % 12;
  const resultKeyName = KEY_NAMES[resultKeyIndex];
  const baseKeyName = KEY_NAMES[baseKeyIndex];
  const transposeStepper = (compact) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 2, flexShrink: 0,
      border: `1.4px solid ${transpose !== 0 ? C.garnet : (compact ? "rgba(255,255,255,0.3)" : C.lilacLine)}`,
      borderRadius: 20, padding: "2px 4px",
      background: transpose !== 0 ? (compact ? "rgba(178,35,50,0.18)" : C.roseBg) : (compact ? "rgba(255,255,255,0.08)" : "#fff"),
    }}>
      <button
        onClick={() => setBaseKeyIndex((k) => (k + 1) % 12)}
        title="Tap to set the piece's original key"
        style={{
          border: "none", background: "transparent", cursor: "pointer",
          fontSize: 10.5, fontWeight: 700, padding: "0 4px",
          color: compact ? "rgba(255,255,255,0.6)" : C.inkSoft, opacity: 0.85,
        }}
      >
        Key: {baseKeyName}
      </button>
      <button
        onClick={() => setTranspose((t) => Math.max(TRANSPOSE_MIN, t - 1))}
        className="dvbc-tap"
        style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <Minus size={12} color={compact ? "rgba(255,255,255,0.85)" : C.inkSoft} />
      </button>
      <button
        onClick={() => setTranspose(0)}
        title="Tap to reset to the original key"
        style={{
          minWidth: 62, textAlign: "center", border: "none", background: "transparent", cursor: "pointer",
          fontSize: 11.5, fontWeight: 700,
          color: transpose !== 0 ? (compact ? "#fff" : C.garnet) : (compact ? "rgba(255,255,255,0.75)" : C.inkSoft),
        }}
      >
        {transpose === 0 ? baseKeyName : `${resultKeyName} (${transpose > 0 ? "+" : ""}${transpose})`}
      </button>
      <button
        onClick={() => setTranspose((t) => Math.min(TRANSPOSE_MAX, t + 1))}
        className="dvbc-tap"
        style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <Plus size={12} color={compact ? "rgba(255,255,255,0.85)" : C.inkSoft} />
      </button>
    </div>
  );

  const sustainButton = (compact) => (
    <button
      onClick={() => { const next = !sustain; setSustain(next); if (!next) releaseAllSustained(); }}
      className="dvbc-tap"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        border: `1.4px solid ${sustain ? C.garnet : (compact ? "rgba(255,255,255,0.3)" : C.lilacLine)}`,
        background: sustain ? C.roseBg : (compact ? "rgba(255,255,255,0.08)" : "#fff"),
        color: sustain ? C.roseDeep : (compact ? "rgba(255,255,255,0.75)" : C.inkSoft),
        fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
      }}
    >
      <Repeat size={13} /> Sustain {sustain ? "On" : "Off"}
    </button>
  );

  // Safety-net button: force-stops any note stuck on from a missed touch/mouse
  // release event (e.g. a finger sliding off a key during a scroll gesture).
  const stopAllButton = (compact) => (
    <button
      onClick={stopAllNotes}
      className="dvbc-tap"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        border: `1.4px solid ${compact ? "rgba(255,255,255,0.3)" : C.lilacLine}`,
        background: compact ? "rgba(255,255,255,0.08)" : "#fff",
        color: compact ? "rgba(255,255,255,0.75)" : C.inkSoft,
        fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
      }}
    >
      <Square size={13} /> Stop all
    </button>
  );

  // Scroll arrows + tap-to-jump octave chips — dragging across the keys themselves doesn't
  // scroll (each key captures the touch to play its note), so this is the actual way to navigate.
  const scrollControls = (whiteW, compact) => {
    const arrowStyle = {
      flexShrink: 0, width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700,
      background: compact ? "rgba(255,255,255,0.1)" : gradient(),
      color: "#fff",
    };
    const chipStyle = (active) => ({
      flexShrink: 0, border: "none", cursor: "pointer", borderRadius: 8, padding: "5px 9px",
      fontSize: 10.5, fontWeight: 700,
      background: active ? C.garnet : (compact ? "rgba(255,255,255,0.1)" : C.lilacSoft),
      color: active ? "#fff" : (compact ? "rgba(255,255,255,0.75)" : C.plum),
    });
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <button onClick={() => scrollByOctave(-1, whiteW)} className="dvbc-tap" style={arrowStyle} aria-label="Scroll left">‹</button>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
          {octaveMarkers.map((m) => (
            <button key={m} onClick={() => scrollToMidi(m, whiteW)} className="dvbc-tap" style={chipStyle(false)}>
              {kbMidiToName(m).label}
            </button>
          ))}
        </div>
        <button onClick={() => scrollByOctave(1, whiteW)} className="dvbc-tap" style={arrowStyle} aria-label="Scroll right">›</button>
      </div>
    );
  };

  // Renders the white+black key grid at a given size. Used both for the inline card and the fullscreen landscape view.
  const renderKeys = (whiteW, whiteH, blackW, blackH, scrollable) => {
    const blackOffset = (midi) => {
      const precedingWhiteCount = whiteKeys.filter((w) => w < midi).length;
      return precedingWhiteCount * whiteW - blackW / 2;
    };
    const content = (
      <div style={{ position: "relative", height: whiteH, width: whiteKeys.length * whiteW, touchAction: "none" }}>
        {whiteKeys.map((midi, i) => {
          const active = !!activeNotes[midi];
          const isC = kbMidiToName(midi).name === "C";
          return (
            <div
              key={midi}
              onMouseDown={() => startNote(midi)}
              onMouseUp={() => stopNote(midi)}
              onMouseLeave={() => stopNote(midi)}
              onTouchStart={(e) => { e.preventDefault(); startNote(midi); }}
              onTouchEnd={(e) => { e.preventDefault(); stopNote(midi); }}
              onTouchCancel={(e) => { e.preventDefault(); stopNote(midi); }}
              style={{
                position: "absolute", left: i * whiteW, top: 0, width: whiteW - 2, height: whiteH,
                background: active ? C.lilacSoft : "#fff",
                border: `1px solid ${C.lilacLine}`, borderRadius: "0 0 6px 6px",
                display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8,
                boxShadow: active ? "inset 0 4px 10px rgba(138,35,50,0.18)" : "0 2px 4px rgba(0,0,0,0.06)",
                cursor: "pointer", userSelect: "none",
              }}
            >
              {isC && <span style={{ fontSize: 9.5, color: C.inkSoft, fontWeight: 700 }}>{kbMidiToName(midi).label}</span>}
            </div>
          );
        })}
        {midiRange.filter((m) => kbMidiToName(m).isSharp).map((midi) => {
          const active = !!activeNotes[midi];
          return (
            <div
              key={midi}
              onMouseDown={() => startNote(midi)}
              onMouseUp={() => stopNote(midi)}
              onMouseLeave={() => stopNote(midi)}
              onTouchStart={(e) => { e.preventDefault(); startNote(midi); }}
              onTouchEnd={(e) => { e.preventDefault(); stopNote(midi); }}
              onTouchCancel={(e) => { e.preventDefault(); stopNote(midi); }}
              style={{
                position: "absolute", left: blackOffset(midi), top: 0, width: blackW, height: blackH, zIndex: 2,
                background: active ? C.garnet : "#231A1D",
                borderRadius: "0 0 4px 4px", cursor: "pointer", userSelect: "none",
                boxShadow: active ? "inset 0 3px 8px rgba(0,0,0,0.4)" : "0 3px 6px rgba(0,0,0,0.35)",
              }}
            />
          );
        })}
      </div>
    );
    if (!scrollable) return content;
    return (
      <div ref={scrollRef} style={{ overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
        {content}
      </div>
    );
  };

  // ---------- Fullscreen landscape view ----------
  if (fullscreenActive) {
    if (isPortrait) {
      return (
        <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#1A1219", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(90deg)" }}>
            <RotateCw size={30} color="#fff" />
          </div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, textAlign: "center" }}>Rotate your device</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, textAlign: "center", maxWidth: 260 }}>Turn your phone sideways to play the full-width keyboard.</div>
          <button onClick={exitLandscape} className="dvbc-tap" style={{ marginTop: 8, border: "1.4px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 20, cursor: "pointer" }}>
            Exit
          </button>
        </div>
      );
    }
    const availW = dims.w - 24;
    const whiteW = Math.max(30, Math.min(56, availW / whiteKeys.length));
    const whiteH = Math.min(dims.h - 96, 240);
    const blackW = whiteW * 0.6;
    const blackH = whiteH * 0.62;
    const boardWidth = whiteKeys.length * whiteW;
    const needsScroll = boardWidth > availW;
    return (
      <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#1A1219", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {timbreRow(true)}
            <button onClick={exitLandscape} className="dvbc-tap" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "1.4px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} color="#fff" />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {layerRow(true)}
            {layerGainRow(true)}
            {transposeStepper(true)}
            {sustainButton(true)}
            {stopAllButton(true)}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 12px", minHeight: 0 }}>
          {scrollControls(whiteW, true)}
          <div ref={scrollRef} style={{ overflowX: needsScroll ? "auto" : "hidden", WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", justifyContent: needsScroll ? "flex-start" : "center" }}>
              {renderKeys(whiteW, whiteH, blackW, blackH, false)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink }}>Keyboard</div>
        {timbreRow(false)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {layerRow(false)}
        {layerGainRow(false)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {transposeStepper(false)}
        {sustainButton(false)}
        {stopAllButton(false)}
        <button
          onClick={enterLandscape}
          className="dvbc-tap"
          style={{
            display: "flex", alignItems: "center", gap: 6, border: "1.4px solid transparent",
            background: gradient(), color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
          }}
        >
          <RotateCw size={13} /> Landscape
        </button>
        <div style={{ fontSize: 10.5, color: C.inkSoft }}>A0 – C8 · full 88 keys, scroll to reach them all</div>
      </div>

      {scrollControls(42, false)}
      {renderKeys(42, 168, 26, 104, true)}
    </div>
  );
}

// Standard autocorrelation pitch detector (ACF2+), returns frequency in Hz or -1 if no clear pitch.
function kbDetectPitch(buf, sampleRate) {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i++) { if (Math.abs(buf[i]) < threshold) { r1 = i; break; } }
  for (let i = 1; i < size / 2; i++) { if (Math.abs(buf[size - i]) < threshold) { r2 = size - i; break; } }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;

  const c = new Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) c[lag] += trimmed[i] * trimmed[i + lag];
  }
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < n; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
  let T0 = maxPos;
  if (T0 <= 0) return -1;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

function PitchMonitor() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const bufRef = useRef(null);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    analyserRef.current = null;
    setListening(false);
    setReading(null);
  }, []);

  useEffect(() => () => stopListening(), []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    const buf = bufRef.current;
    analyser.getFloatTimeDomainData(buf);
    const freq = kbDetectPitch(buf, ctx.sampleRate);
    if (freq !== -1 && freq > 60 && freq < 1500) {
      const midiFloat = kbFreqToMidi(freq);
      const midi = Math.round(midiFloat);
      const cents = Math.round((midiFloat - midi) * 100);
      const { label } = kbMidiToName(midi);
      setReading({ label, cents, freq: Math.round(freq * 10) / 10 });
    } else {
      setReading(null);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startListening = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streamRef.current = stream;
      const ctx = getSharedAudioCtx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      bufRef.current = new Float32Array(analyser.fftSize);
      source.connect(analyser);
      analyserRef.current = analyser;
      setListening(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError("Microphone access denied or unavailable.");
    }
  }, [tick]);

  const cents = reading?.cents ?? 0;
  const inTune = reading && Math.abs(cents) <= 6;
  const needlePct = Math.max(-50, Math.min(50, cents));

  return (
    <div style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, borderRadius: 16, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: C.ink }}>Vocal Pitch Monitor</div>
        <button
          onClick={() => (listening ? stopListening() : startListening())}
          className="dvbc-tap"
          style={{
            display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
            background: listening ? C.roseBg : gradient(), color: listening ? C.roseDeep : "#fff",
            fontSize: 11.5, fontWeight: 700, padding: "8px 14px", borderRadius: 20,
          }}
        >
          {listening ? <><Square size={12} /> Stop</> : <><Mic size={13} /> Start</>}
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.roseDeep, fontSize: 12, marginBottom: 10 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {!listening && !error && (
        <div style={{ fontSize: 12.5, color: C.inkSoft }}>Tap Start and sing or hum a note to check your pitch.</div>
      )}

      {listening && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 700, color: reading ? (inTune ? C.sage : C.garnet) : C.lilacLine }}>
              {reading ? reading.label : "—"}
            </div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>
              {reading ? `${reading.freq} Hz · ${cents > 0 ? "+" : ""}${cents} cents` : "listening…"}
            </div>
          </div>

          <div style={{ position: "relative", height: 34, background: C.lilacSoft, borderRadius: 17, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: C.lilacLine }} />
            <div style={{ position: "absolute", left: "35%", right: "35%", top: 0, bottom: 0, background: "rgba(79,122,92,0.15)" }} />
            {reading && (
              <div
                style={{
                  position: "absolute", top: 4, bottom: 4, width: 6, borderRadius: 3,
                  left: `calc(${50 + needlePct}% - 3px)`,
                  background: inTune ? C.sage : C.garnet,
                  transition: "left 0.08s linear",
                }}
              />
            )}
            <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.inkSoft }}>flat</div>
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.inkSoft }}>sharp</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeTools() {
  return (
    <div style={{ padding: "18px 24px 0" }}>
      <Keyboard />
      <PitchMonitor />
    </div>
  );
}

function BottomNav({ screen, onNav }) {
  const items = [
    { key: "dashboard", label: "Home", icon: Home },
    { key: "attendance", label: "Attendance", icon: CheckSquare },
    { key: "practice", label: "Practice", icon: ListMusic },
    { key: "messages", label: "Messages", icon: MessageCircle },
    { key: "library", label: "Library", icon: Music2 },
    { key: "profile", label: "Profile", icon: User },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      background: "#fff", borderTop: `1px solid ${C.lilacLine}`,
      boxShadow: "0 -8px 24px rgba(76, 46, 158, 0.08)",
      display: "flex", alignItems: "flex-end", justifyContent: "space-around",
      paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
    }}>
      {items.map(({ key, label, icon: Icon }) => {
        const active = screen === key;
        return (
          <button
            key={key} onClick={() => onNav(key)} className="dvbc-tap"
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "4px 6px 0", flex: 1, position: "relative",
              transition: "transform 0.18s ease",
              transform: active ? "translateY(-2px)" : "translateY(0)",
            }}
          >
            <div style={{
              width: active ? 52 : 34, height: 30, borderRadius: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: active ? gradient() : "transparent",
              boxShadow: active ? "0 6px 14px rgba(76, 46, 158, 0.35)" : "none",
              transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <Icon size={16} color={active ? "#fff" : "#B8ADC0"} strokeWidth={active ? 2.4 : 2} />
            </div>
            <div style={{
              fontSize: 10, fontWeight: active ? 700 : 600,
              color: active ? C.garnet : "#B8ADC0",
              transition: "color 0.18s ease",
            }}>{label}</div>
            {active && (
              <div style={{
                position: "absolute", top: -8, width: 4, height: 4, borderRadius: "50%",
                background: C.plum,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Root app ---------- */
/* ---------- Error boundary: catches a crash in one screen without blanking the whole app ---------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("DVBC screen crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "40px 24px", textAlign: "center",
        }}>
          <AlertCircle size={30} color={C.roseDeep} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: C.ink, marginTop: 14 }}>Something went wrong</div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>
            This screen ran into a problem. You can try again, or head back to the dashboard — nothing else in the app is affected.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={() => this.setState({ hasError: false })} className="dvbc-tap"
              style={{ background: C.card, border: `1.4px solid ${C.lilacLine}`, color: C.ink, fontWeight: 700, fontSize: 12.5, padding: "10px 18px", borderRadius: 12, cursor: "pointer" }}
            >
              Try Again
            </button>
            {this.props.onGoHome && (
              <button
                onClick={() => { this.setState({ hasError: false }); this.props.onGoHome(); }} className="dvbc-tap"
                style={{ background: gradient(), color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer" }}
              >
                Go to Home
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Voice/video calling (Agora) ---------- */
function IncomingCallBanner({ call, onAccept, onDecline }) {
  if (!call) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(20,10,20,0.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: 24,
    }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", background: C.lilacSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {call.callerAvatar
          ? <img src={call.callerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <User size={40} color={C.garnet} />}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#fff" }}>{call.callerName || "Someone"}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Incoming call…</div>
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 16 }}>
        <button onClick={onDecline} className="dvbc-tap" style={{
          width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.roseDeep, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <PhoneOff size={24} />
        </button>
        <button onClick={onAccept} className="dvbc-tap" style={{
          width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "#3fae5a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Phone size={24} />
        </button>
      </div>
    </div>
  );
}

function CallScreen({ call, profile, onLeave }) {
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState("connecting"); // connecting | live | error
  const [errorMsg, setErrorMsg] = useState(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video") setRemoteUsers((prev) => prev.some((u) => u.uid === user.uid) ? prev.map((u) => u.uid === user.uid ? user : u) : [...prev, user]);
      if (mediaType === "audio") user.audioTrack?.play();
    });
    client.on("user-unpublished", (user) => {
      setRemoteUsers((prev) => prev.map((u) => u.uid === user.uid ? user : u));
    });
    client.on("user-left", (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    });

    (async () => {
      try {
        const res = await fetch("/api/agora-token", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: call.channel_name, uid: 0 }),
        });
        if (!res.ok) throw new Error("Token request failed");
        const { appId, token, uid } = await res.json();
        if (cancelled) return;

        await client.join(appId, call.channel_name, token, uid || null);
        let audioTrack, videoTrack;
        try {
          [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        } catch (e) {
          // Camera unavailable/denied — fall back to audio-only
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          videoTrack = null;
          setCamOn(false);
        }
        if (cancelled) { audioTrack?.close(); videoTrack?.close(); return; }
        localTracksRef.current = { audio: audioTrack, video: videoTrack };
        if (videoTrack && localVideoRef.current) videoTrack.play(localVideoRef.current);
        const toPublish = [audioTrack, videoTrack].filter(Boolean);
        await client.publish(toPublish);
        setStatus("live");
      } catch (e) {
        setErrorMsg("Couldn't connect to the call. Check your connection and try again.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      localTracksRef.current.audio?.close();
      localTracksRef.current.video?.close();
      client.removeAllListeners();
      client.leave().catch(() => {});
    };
  }, [call.channel_name]);

  useEffect(() => {
    remoteUsers.forEach((u) => {
      if (u.videoTrack) {
        const el = document.getElementById(`dvbc-remote-${u.uid}`);
        if (el) u.videoTrack.play(el);
      }
    });
  }, [remoteUsers]);

  const toggleMic = () => {
    const t = localTracksRef.current.audio;
    if (!t) return;
    t.setEnabled(!micOn);
    setMicOn(!micOn);
    haptic(6);
  };
  const toggleCam = () => {
    const t = localTracksRef.current.video;
    if (!t) return;
    t.setEnabled(!camOn);
    setCamOn(!camOn);
    haptic(6);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#1a0f16", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {status === "connecting" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>
            Connecting…
          </div>
        )}
        {status === "error" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, padding: 24, textAlign: "center" }}>
            {errorMsg}
          </div>
        )}
        <div style={{
          display: "grid", gap: 4, height: "100%",
          gridTemplateColumns: remoteUsers.length > 1 ? "1fr 1fr" : "1fr",
        }}>
          {remoteUsers.length === 0 && status === "live" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: 13.5 }}>
              Waiting for others to join…
            </div>
          )}
          {remoteUsers.map((u) => (
            <div key={u.uid} id={`dvbc-remote-${u.uid}`} style={{ background: "#000", position: "relative", minHeight: 120 }} />
          ))}
        </div>
        {camOn && (
          <div ref={localVideoRef} style={{
            position: "absolute", bottom: 100, right: 16, width: 96, height: 128, borderRadius: 12,
            overflow: "hidden", background: "#000", border: "2px solid rgba(255,255,255,0.25)",
          }} />
        )}
      </div>

      <div style={{
        display: "flex", justifyContent: "center", gap: 20, alignItems: "center",
        padding: "18px 24px calc(env(safe-area-inset-bottom, 0px) + 18px)",
      }}>
        <button onClick={toggleMic} className="dvbc-tap" style={{
          width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
          background: micOn ? "rgba(255,255,255,0.15)" : "#fff", color: micOn ? "#fff" : "#1a0f16",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button onClick={toggleCam} className="dvbc-tap" style={{
          width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
          background: camOn ? "rgba(255,255,255,0.15)" : "#fff", color: camOn ? "#fff" : "#1a0f16",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button onClick={onLeave} className="dvbc-tap" style={{
          width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.roseDeep, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreenRaw] = useState("dashboard");

  // Keep browser/Android history in sync with in-app screen state so the
  // hardware/gesture back button navigates screens instead of exiting the PWA.
  const setScreen = (newScreen) => {
    setScreenRaw(newScreen);
    window.history.pushState({ screen: newScreen }, "", "");
  };

  useEffect(() => {
    // Establish an initial history entry for the starting screen so the very
    // first back-press has something to land on rather than leaving the app.
    window.history.replaceState({ screen: "dashboard" }, "", "");

    const onPopState = (event) => {
      const target = event.state?.screen || "dashboard";
      setScreenRaw(target);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState(null);
  const [darkMode, setDarkMode] = useState(() => store.get("dvbc-dark-mode", false));
  const [, forceThemeRerender] = useState(0);
  useEffect(() => {
    applyTheme(darkMode ? "dark" : "light");
    store.set("dvbc-dark-mode", darkMode);
    // C is mutated in place (not React state), so components that already rendered
    // this pass are still holding stale color values. Force one more render now
    // that C reflects the new theme, so the switch applies instantly.
    forceThemeRerender((n) => n + 1);
  }, [darkMode]);
  const [soundEnabled, setSoundEnabled] = useState(() => store.get("dvbc-sound-enabled", true));
  useEffect(() => { store.set("dvbc-sound-enabled", soundEnabled); }, [soundEnabled]);

  // Presence heartbeat: while the app is open and foregrounded, ping last_seen_at
  // every 45s so other members see this device as "Online" (2-minute threshold).
  useEffect(() => {
    if (!profile?.id) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("members").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id).then(() => {});
    };
    beat();
    const interval = setInterval(beat, 45000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", beat); };
  }, [profile?.id]);

  // iOS Safari only supports Web Push for a PWA that's been "Added to Home Screen" — not
  // in a regular browser tab. We detect both so the UI can guide iOS users correctly.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

  // iOS also refuses to play any audio (including Web Audio API tones) until it's been
  // "unlocked" by a real user gesture. Prime it silently on the very first tap anywhere.
  useEffect(() => {
    const unlock = () => {
      try {
        _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (_audioCtx.state === "suspended") _audioCtx.resume();
      } catch (e) { /* unsupported */ }
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("touchend", unlock, { once: true });
    window.addEventListener("click", unlock, { once: true });
    return () => { window.removeEventListener("touchend", unlock); window.removeEventListener("click", unlock); };
  }, []);

  const [toast, setToast] = useState(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    }).catch(() => {});
  }, []);
  const enablePush = useCallback(async () => {
    if (!profile?.id || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushBusy(false); return; }
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/push-sw.js" });
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      await supabase.from("push_subscriptions").upsert({
        member_id: profile.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
      }, { onConflict: "endpoint" });
      setPushSubscribed(true);
      haptic(10);
    } catch (e) { /* permission denied or unsupported */ }
    setPushBusy(false);
  }, [profile?.id]);
  const disablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      haptic(10);
    } catch (e) { /* ignore */ }
    setPushBusy(false);
  }, []);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [favorites, setFavorites] = useState(() => store.get("dvbc-favorites", []));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [openMemberPosting, setOpenMemberPosting] = useState(false);
  const [restrictCommenting, setRestrictCommenting] = useState(false);
  const [postSeenAt, setPostSeenAt] = useState(() => store.get("dvbc-post-seen", {}));
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [libraryPieces, setLibraryPieces] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  useEffect(() => { store.set("dvbc-favorites", favorites); }, [favorites]);
  useEffect(() => { store.set("dvbc-post-seen", postSeenAt); }, [postSeenAt]);

  // Ask the browser not to evict this origin's Cache Storage under storage
  // pressure — protects members' downloaded offline audio/sheet music.
  // Best-effort: browsers may still say no in a plain (non-installed) tab,
  // but installed + engaged origins are far more likely to be granted this.
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
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

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingEvents(true);
    supabase.from("events").select("*").order("start_time").then(({ data }) => {
      if (active) { setEvents(data || []); setLoadingEvents(false); }
    });

    const channel = supabase
      .channel("events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload) => {
        setEvents((prev) => {
          if (payload.eventType === "INSERT") {
            return [...prev, payload.new].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
          }
          if (payload.eventType === "UPDATE") return prev.map((e) => (e.id === payload.new.id ? payload.new : e));
          if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingLibrary(true);
    supabase.from("library_pieces").select("*").order("display_order").order("title").then(({ data }) => {
      if (active) { setLibraryPieces(data || []); setLoadingLibrary(false); }
    });

    const channel = supabase
      .channel("library-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "library_pieces" }, (payload) => {
        setLibraryPieces((prev) => {
          if (payload.eventType === "INSERT") return [...prev, payload.new];
          if (payload.eventType === "UPDATE") return prev.map((p) => (p.id === payload.new.id ? payload.new : p));
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== payload.old.id);
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
      .select("*, author:members!posts_author_id_fkey(id,name,avatar_url), comments:post_comments(*, author:members!post_comments_author_id_fkey(id,name,avatar_url)), reads:post_reads(member_id, read_at, member:members(id,name,avatar_url))")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      (data || []).forEach((row) => {
        if (row.key === "open_member_posting") setOpenMemberPosting(!!row.value);
        if (row.key === "restrict_commenting") setRestrictCommenting(!!row.value);
      });
    });

    const settingsChannel = supabase
      .channel("app-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload) => {
        if (payload.new?.key === "open_member_posting") setOpenMemberPosting(!!payload.new.value);
        if (payload.new?.key === "restrict_commenting") setRestrictCommenting(!!payload.new.value);
      })
      .subscribe();

    return () => supabase.removeChannel(settingsChannel);
  }, [session]);

  const toggleOpenMemberPosting = useCallback(async () => {
    const next = !openMemberPosting;
    setOpenMemberPosting(next);
    await supabase.from("app_settings").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "open_member_posting");
  }, [openMemberPosting]);

  const toggleRestrictCommenting = useCallback(async () => {
    const next = !restrictCommenting;
    setRestrictCommenting(next);
    await supabase.from("app_settings").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "restrict_commenting");
  }, [restrictCommenting]);

  useEffect(() => {
    if (!session) return;
    loadPosts();

    const channel = supabase
      .channel("posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reads" }, () => loadPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        if (payload.new?.author_id === profile?.id) return; // don't toast your own post
        const body = String(payload.new?.content || "").slice(0, 100);
        setToast({ title: "New Announcement", body });
        playChime();
        haptic(12);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, loadPosts, profile?.id]);

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
    if (profile?.id) {
      supabase.from("post_reads").upsert(
        { post_id: postId, member_id: profile.id, read_at: new Date().toISOString() },
        { onConflict: "post_id,member_id" }
      ).then(() => {});
    }
  }, [profile?.id]);

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
        participants:conversation_participants(member_id, last_read_at, member:members(id,name,avatar_url,last_seen_at)),
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        if (payload.new?.sender_id === profile?.id) return; // don't toast your own message
        setToast({ title: "New Message", body: String(payload.new?.content || "").slice(0, 100) });
        playChime();
        haptic(12);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, profile, loadConversations]);

  // Voice/video calling: incoming call ringing + active call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (!profile) return;
    const callChannel = supabase
      .channel("call-invites")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_invites" }, (payload) => {
        const row = payload.new;
        if (row.callee_id === profile.id && row.status === "ringing") {
          const caller = members.find((m) => m.id === row.caller_id);
          setIncomingCall({ ...row, callerName: caller?.name, callerAvatar: caller?.avatar_url });
          playChime();
          haptic(20);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_invites" }, (payload) => {
        const row = payload.new;
        if (row.status === "declined" && activeCall?.inviteId === row.id) {
          setToast({ title: "Call declined", body: "" });
          setActiveCall(null);
        }
        if (row.status === "ended" && incomingCall?.id === row.id) {
          setIncomingCall(null);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(callChannel);
  }, [profile, members, activeCall, incomingCall]);

  const startCall = useCallback(async (conversationId, calleeId, isGroup) => {
    if (!profile) return;
    const channel_name = isGroup ? "dvbc-rehearsal" : `dvbc-conv-${conversationId}`;
    const { data, error } = await supabase
      .from("call_invites")
      .insert({
        conversation_id: conversationId || null,
        channel_name,
        caller_id: profile.id,
        callee_id: isGroup ? null : calleeId,
        is_group: !!isGroup,
        status: isGroup ? "accepted" : "ringing",
      })
      .select()
      .single();
    if (error || !data) { setToast({ title: "Couldn't start call", body: "" }); return; }
    setActiveCall({ inviteId: data.id, channel_name, is_group: !!isGroup });
  }, [profile]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    await supabase.from("call_invites").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setActiveCall({ inviteId: incomingCall.id, channel_name: incomingCall.channel_name, is_group: false });
    setIncomingCall(null);
  }, [incomingCall]);

  const declineIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    await supabase.from("call_invites").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setIncomingCall(null);
  }, [incomingCall]);

  const endActiveCall = useCallback(async () => {
    if (activeCall?.inviteId) {
      await supabase.from("call_invites").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", activeCall.inviteId);
    }
    setActiveCall(null);
  }, [activeCall]);

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
  }, [profile, conversations, loadConversations]);

  const activateSectionChat = useCallback(async (section) => {
    const { data, error } = await supabase.rpc("activate_section_chat", { p_section: section });
    if (error) { console.error(error); return; }
    await loadConversations();
    return data;
  }, [loadConversations]);

  const sendChatMessage = useCallback(async (conversationId, content) => {
    if (!profile) return;
    await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: profile.id, content });
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("member_id", profile.id);
  }, [profile]);

  const editChatMessage = useCallback(async (messageId, newContent) => {
    await supabase.from("chat_messages").update({ content: newContent }).eq("id", messageId);
  }, []);

  const deleteChatMessage = useCallback(async (messageId) => {
    await supabase.from("chat_messages").delete().eq("id", messageId);
  }, []);

  const sendVoiceNote = useCallback(async (conversationId, blob, durationSeconds) => {
    if (!profile) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${conversationId}/${profile.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("voice-notes").upload(path, blob, {
      contentType: blob.type || "audio/webm",
    });
    if (uploadError) return;
    const { data: pub } = supabase.storage.from("voice-notes").getPublicUrl(path);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      content: "",
      message_type: "voice_note",
      audio_url: pub?.publicUrl,
      duration_seconds: Math.round(durationSeconds || 0),
    });
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

  // Cycle a member's recorded status (present -> absent -> excused -> unmarked) for one event.
  const cycleEventAttendance = useCallback(async (member, eventId, currentStatus) => {
    rhythmicHaptic();
    const order = ["present", "absent", "excused"];
    const currentIndex = order.indexOf(currentStatus);
    if (currentIndex === order.length - 1) {
      // Cycling past "excused" clears the record (back to "not marked").
      const { error } = await supabase.from("attendance_records").delete().eq("member_id", member.id).eq("event_id", eventId);
      return { error: error?.message };
    }
    const next = order[currentIndex + 1];
    const { error } = await supabase
      .from("attendance_records")
      .upsert({ member_id: member.id, event_id: eventId, status: next }, { onConflict: "member_id,event_id" });
    return { error: error?.message };
  }, []);

  // Direct set (spreadsheet-style): tap the exact status cell for a member. Tapping the
  // already-active status clears the record back to "not marked".
  const setEventAttendance = useCallback(async (member, eventId, currentStatus, targetStatus) => {
    rhythmicHaptic();
    if (currentStatus === targetStatus) {
      const { error } = await supabase.from("attendance_records").delete().eq("member_id", member.id).eq("event_id", eventId);
      return { error: error?.message };
    }
    const { error } = await supabase
      .from("attendance_records")
      .upsert({ member_id: member.id, event_id: eventId, status: targetStatus }, { onConflict: "member_id,event_id" });
    return { error: error?.message };
  }, []);

  // Bulk-fill: set every member who has no record yet for this event to "present" in one go —
  // the common "default everyone in, then flip the few absentees" workflow.
  const markUnmarkedPresent = useCallback(async (eventId, memberIds) => {
    if (!memberIds.length) return { error: null };
    haptic([10, 30, 10]);
    const rows = memberIds.map((id) => ({ member_id: id, event_id: eventId, status: "present" }));
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "member_id,event_id" });
    return { error: error?.message };
  }, []);

  const checkInToEvent = useCallback(async (eventId) => {
    if (!profile) return;
    setCheckingIn(true);
    setCheckInError("");
    const { error } = await supabase
      .from("attendance_records")
      .upsert({ member_id: profile.id, event_id: eventId, status: "present" }, { onConflict: "member_id,event_id" });
    if (error) setCheckInError(error.message || "Could not check in. Please try again.");
    setCheckingIn(false);
  }, [profile]);

  const createEvent = useCallback(async (payload) => {
    if (!profile) return { error: "Not signed in" };
    const { error } = await supabase.from("events").insert({ ...payload, created_by: profile.id });
    return { error: error?.message };
  }, [profile]);

  const updateEvent = useCallback(async (eventId, payload) => {
    const { error } = await supabase.from("events").update(payload).eq("id", eventId);
    return { error: error?.message };
  }, []);

  const uploadLibraryAudio = useCallback(async (file) => {
    if (!profile) return { error: "Not signed in" };
    const ALLOWED = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/x-m4a"];
    if (!ALLOWED.includes(file.type)) return { error: "Please choose an MP3, WAV, M4A, AAC, or OGG file." };
    if (file.size > 25 * 1024 * 1024) return { error: "Audio file must be under 25MB." };
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("library-audio").upload(path, file);
    if (uploadError) return { error: uploadError.message };
    const { data } = supabase.storage.from("library-audio").getPublicUrl(path);
    return { url: data.publicUrl };
  }, [profile]);

  const createLibraryPiece = useCallback(async (payload) => {
    if (!profile) return { error: "Not signed in" };
    const { error } = await supabase.from("library_pieces").insert({ ...payload, created_by: profile.id });
    return { error: error?.message };
  }, [profile]);

  const updateLibraryPiece = useCallback(async (pieceId, payload) => {
    const { error } = await supabase.from("library_pieces").update(payload).eq("id", pieceId);
    return { error: error?.message };
  }, []);

  const deleteLibraryPiece = useCallback(async (pieceId) => {
    const { error } = await supabase.from("library_pieces").delete().eq("id", pieceId);
    return { error: error?.message };
  }, []);

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

  const updateOwnInfo = useCallback(async ({ phone, address, date_of_birth }) => {
    if (!profile) return;
    const { error } = await supabase
      .from("members")
      .update({ phone, address, date_of_birth })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, phone, address, date_of_birth } : prev));
  }, [profile]);

  const deletePost = useCallback(async (postId) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) { console.error(error); return; }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const approveMember = useCallback(async (memberId) => {
    haptic(10);
    await supabase.from("members").update({ approval_status: "approved" }).eq("id", memberId);
  }, []);

  const rejectMember = useCallback(async (memberId) => {
    haptic(10);
    await supabase.from("members").update({ approval_status: "rejected" }).eq("id", memberId);
  }, []);

  const exportCalendar = useCallback(() => {
  if (!events || events.length === 0) {
    setToast({ title: "No events", body: "No rehearsals to export yet." });
    return;
  }
  const upcomingEvents = events.filter((e) => new Date(e.end_time) >= new Date());
  if (upcomingEvents.length === 0) {
    setToast({ title: "No upcoming events", body: "All rehearsals are in the past." });
    return;
  }
  haptic(10);
  const icsContent = generateICS(upcomingEvents, "De Voci Belli Chorale Rehearsals");
  const filename = `dvbc-rehearsals-${new Date().toISOString().slice(0, 10)}.ics`;
  downloadICS(icsContent, filename);
  setToast({ title: "Calendar exported", body: `${upcomingEvents.length} rehearsal(s) ready to import.` });
}, [events]);
  
  const removeMember = useCallback(async (memberId) => {
    if (memberId === profile?.id) return; // can't remove yourself
    haptic([10, 30, 10]);
    await supabase.from("members").delete().eq("id", memberId);
  }, [profile?.id]);

  const toggleMemberAdmin = useCallback(async (memberId, makeAdmin) => {
    if (memberId === profile?.id) return; // can't change your own admin status
    haptic(10);
    await supabase.from("members").update({ is_admin: makeAdmin }).eq("id", memberId);
  }, [profile?.id]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }, []);

  const TAP_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Outfit:wght@400;500;600;700&display=swap');
    body, html { font-family: 'Outfit', system-ui, sans-serif; }
    .dvbc-tap { transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.1s ease; }
    .dvbc-tap:active { opacity: 0.75; transform: scale(0.93); transition: transform 0.05s ease, opacity 0.05s ease; }
    .dvbc-row:active { background: ${C.lilacSoft}; }
    .dvbc-skeleton { position: relative; overflow: hidden; background: ${C.lilacSoft}; }
    .dvbc-skeleton::after {
      content: ""; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, ${C.lilacLine}, transparent);
      animation: dvbcShimmer 1.4s infinite;
    }
    @keyframes dvbcShimmer { 100% { transform: translateX(100%); } }
    .dvbc-spin { animation: dvbcSpin 0.8s linear infinite; }
    @keyframes dvbcSpin { to { transform: rotate(360deg); } }
    @keyframes dvbcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes dvbcConfetti {
      0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      100% { opacity: 0; transform: translate(var(--dx), 240px) rotate(540deg); }
    }
    .dvbc-screen-enter { animation: dvbcFadeIn 0.2s ease; }
    @keyframes dvbcFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dvbc-eq-bar { animation: dvbcEqualize 0.9s ease-in-out infinite; }
    @keyframes dvbcEqualize {
      0%, 100% { height: 6px; }
      50% { height: 26px; }
    }
    /* Staggered entrance for list items: use with an inline animationDelay per index
       so cards rise into place one after another, like an ascending musical scale. */
    .dvbc-stagger { animation: dvbcStaggerUp 0.4s cubic-bezier(0.2, 0.8, 0.3, 1) backwards; }
    @keyframes dvbcStaggerUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.parchment }}>
        <BrandSpinner />
      </div>
    );
  }

  if (passwordRecovery && session) {
    return (
      <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <style>{TAP_STYLES}</style>
        <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <style>{TAP_STYLES}</style>
        <LoginScreen onAuthed={() => {}} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.parchment }}>
        <BrandSpinner label="Loading your profile…" />
      </div>
    );
  }

  if (profile.approval_status === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <style>{TAP_STYLES}</style>
        <PendingApproval profile={profile} onLogout={logout} />
      </div>
    );
  }

  const isAdmin = !!profile.is_admin;
  let content;
  if (screen === "dashboard") content = (
    <Dashboard profile={profile} members={members} events={events} posts={posts} pieces={libraryPieces} isAdmin={isAdmin} onSubmitPost={submitPost} onNav={setScreen}
      unreadCount={unreadPostCount} onCheckIn={checkInToEvent}
      checkingIn={checkingIn} checkInError={checkInError} />
  );
  else if (screen === "attendance") content = (
    <Attendance members={members} loading={loadingMembers} isAdmin={isAdmin} profile={profile}
      events={events} loadingEvents={loadingEvents} onCycle={cycleEventAttendance}
      onSetStatus={setEventAttendance} onMarkUnmarkedPresent={markUnmarkedPresent}
      onCheckIn={checkInToEvent} checkingIn={checkingIn} checkInError={checkInError}
      onCreateEvent={createEvent} onUpdateEvent={updateEvent} onExportCalendar={exportCalendar}/>
  );
  else if (screen === "library") content = (
    <Library
      favorites={favorites} toggleFavorite={toggleFavorite} isAdmin={isAdmin}
      pieces={libraryPieces} loading={loadingLibrary}
      onCreate={createLibraryPiece} onUpdate={updateLibraryPiece} onDelete={deleteLibraryPiece}
      onUploadAudio={uploadLibraryAudio}
    />
  );
  else if (screen === "messages") content = (
    <Messages posts={posts} loading={loadingPosts} isAdmin={isAdmin} profile={profile}
      openMemberPosting={openMemberPosting} onToggleOpenPosting={toggleOpenMemberPosting} restrictCommenting={restrictCommenting}
      onBack={() => setScreen("dashboard")} onSubmitPost={submitPost} onSubmitComment={submitComment}
      seenMap={postSeenAt} onMarkSeen={markPostSeen} members={members} conversations={conversations}
      loadingConversations={loadingConversations} activeConversationId={activeConversationId}
      onOpenConversation={openConversation} onCloseConversation={closeConversation}
      onCreateConversation={createConversation} onActivateSectionChat={activateSectionChat} onSendChatMessage={sendChatMessage}
      onMarkConversationRead={markConversationRead} onDeletePost={deletePost} onSendVoiceNote={sendVoiceNote}
      onStartCall={startCall} onEditChatMessage={editChatMessage} onDeleteChatMessage={deleteChatMessage} />
  );
  else if (screen === "executives") content = <Executives isAdmin={isAdmin} />;
  else if (screen === "communication") content = (
    <CommunicationSettings
      onBack={() => setScreen("profile")}
      openMemberPosting={openMemberPosting} onToggleOpenPosting={toggleOpenMemberPosting}
      restrictCommenting={restrictCommenting} onToggleRestrictCommenting={toggleRestrictCommenting}
      members={members} conversations={conversations}
      onActivateSectionChat={activateSectionChat} onOpenConversation={openConversation}
      onCreateConversation={createConversation} onGoToMessages={() => setScreen("messages")}
    />
  );
  else if (screen === "practice") content = <PracticeLists isAdmin={isAdmin} profile={profile} members={members} />;
else if (screen === "notation") content = <NotationFlashcards onBack={() => setScreen("dashboard")} />;
  else if (screen === "privacy") content = <StaticPage title="Privacy Policy" content={PRIVACY_POLICY_TEXT} onBack={() => setScreen("profile")} />;
  else if (screen === "about") content = <StaticPage title="About Us" content={ABOUT_TEXT} onBack={() => setScreen("profile")} />;
  else if (screen === "profile") content = (
    <Profile profile={profile} members={members} onLogout={logout} isAdmin={isAdmin}
      onApprove={approveMember} onReject={rejectMember} onUploadAvatar={uploadAvatar}
      onRemoveMember={removeMember} onToggleAdmin={toggleMemberAdmin}
      avatarUploading={avatarUploading} avatarError={avatarError}
      darkMode={darkMode} onToggleDarkMode={() => setDarkMode((v) => !v)}
      soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled((v) => !v)}
      pushSubscribed={pushSubscribed} pushBusy={pushBusy} onEnablePush={enablePush} onDisablePush={disablePush}
      isIOS={isIOS} isStandalone={isStandalone} onUpdateOwnInfo={updateOwnInfo}
      onNavSettings={(nav) => setScreen(nav)} />
  );

  const showBottomNav = ["dashboard", "attendance", "library", "practice", "executives", "profile"].includes(screen);

  return (
    <div style={{ minHeight: "100vh", background: C.parchment, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{TAP_STYLES}</style>
      <ErrorBoundary key={screen} onGoHome={() => setScreen("dashboard")}>
        <div key={screen} className="dvbc-screen-enter">{content}</div>
      </ErrorBoundary>
      {showBottomNav && <BottomNav screen={screen} onNav={setScreen} />}
      <OnboardingTour profile={profile} />
      <Toast toast={toast} onClose={() => setToast(null)} />
      <IncomingCallBanner call={incomingCall} onAccept={acceptIncomingCall} onDecline={declineIncomingCall} />
      {activeCall && <CallScreen call={activeCall} profile={profile} onLeave={endActiveCall} />}
    </div>
  );
                                                                                        }

 
