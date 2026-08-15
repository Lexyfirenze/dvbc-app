import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, Play, RotateCcw } from "lucide-react";

/* ---------- Rhythm pattern definitions ---------- */
// Each pattern is a sequence of beat "cells" within a 4-beat measure.
// value: duration in beats (1 = quarter, 0.5 = eighth, 2 = half)
// A pattern's cells must sum to the measure length (4 beats here).
const PATTERNS = [
  { label: "Quarter notes", cells: [1, 1, 1, 1] },
  { label: "Two halves", cells: [2, 2] },
  { label: "Eighths + quarters", cells: [0.5, 0.5, 1, 1, 1] },
  { label: "Syncopated", cells: [1, 0.5, 0.5, 1, 1] },
  { label: "Running eighths", cells: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
];

const MEASURE_BEATS = 4;
const TEMPO_BPM = 80;
const BEAT_SEC = 60 / TEMPO_BPM;
const HIT_WINDOW_SEC = 0.18; // tolerance for "Perfect"
const OK_WINDOW_SEC = 0.32;  // tolerance for "Early"/"Late" vs "Miss"

let _audioCtx = null;
function getCtx() {
  _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}
function clickSound(time, accent = false) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = accent ? 1400 : 900;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(accent ? 0.22 : 0.14, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}
function tapFeedbackSound(time, good) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = good ? 660 : 300;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.12, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.15);
}

// Convert a pattern's cells into absolute onset times (seconds from pattern start),
// skipping a 4-beat metronome count-in.
function onsetsForPattern(cells) {
  let t = 0;
  const onsets = [];
  for (const dur of cells) {
    onsets.push(t);
    t += dur * BEAT_SEC;
  }
  return onsets;
}

export default function RhythmGame({ onBack, colors = {} }) {
  const C = {
    garnet: "#8A2332",
    sage: "#4F7A5C",
    sageBg: "#E7F1E9",
    roseDeep: "#B23368",
    roseBg: "#FBEAF1",
    amberText: "#8A6C24",
    amberBg: "#F6EFD8",
    ink: "#2B2119",
    inkSoft: "#7A6952",
    card: "#FFFFFF",
    parchment: "#FBF6EC",
    lilacLine: "#EAD9B8",
    ...colors,
  };

  const [patternIdx, setPatternIdx] = useState(0);
  const pattern = PATTERNS[patternIdx];
  const onsets = useRef(onsetsForPattern(pattern.cells));
  useEffect(() => { onsets.current = onsetsForPattern(pattern.cells); }, [patternIdx]);

  const [phase, setPhase] = useState("idle"); // idle | countIn | playing | results
  const [activeCell, setActiveCell] = useState(-1);
  const [results, setResults] = useState([]); // per-onset: "perfect" | "early" | "late" | "miss" | null
  const startTimeRef = useRef(0);
  const timers = useRef([]);
  const resultsRef = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const startRound = useCallback(() => {
    clearTimers();
    const ctx = getCtx();
    setPhase("countIn");
    setActiveCell(-1);
    const currentOnsets = onsets.current;
    resultsRef.current = currentOnsets.map(() => null);
    setResults(resultsRef.current);

    const now = ctx.currentTime + 0.1;
    // 4-beat count-in click track
    for (let i = 0; i < MEASURE_BEATS; i++) {
      clickSound(now + i * BEAT_SEC, i === 0);
    }
    const patternStart = now + MEASURE_BEATS * BEAT_SEC;
    startTimeRef.current = patternStart;

    timers.current.push(setTimeout(() => setPhase("playing"), (MEASURE_BEATS * BEAT_SEC) * 1000));

    // Schedule click + visual highlight for each onset, then mark misses if no tap landed
    currentOnsets.forEach((onset, i) => {
      const t = patternStart + onset;
      clickSound(t, false);
      const delayMs = (t - ctx.currentTime) * 1000;
      timers.current.push(setTimeout(() => setActiveCell(i), Math.max(0, delayMs)));
      timers.current.push(setTimeout(() => {
        if (resultsRef.current[i] == null) {
          resultsRef.current[i] = "miss";
          setResults([...resultsRef.current]);
        }
      }, Math.max(0, delayMs + OK_WINDOW_SEC * 1000)));
    });

    const lastOnset = currentOnsets[currentOnsets.length - 1] || 0;
    const lastCellDur = (pattern.cells[pattern.cells.length - 1] || 1) * BEAT_SEC;
    const totalMs = (patternStart + lastOnset + lastCellDur - ctx.currentTime) * 1000;
    timers.current.push(setTimeout(() => {
      setActiveCell(-1);
      setPhase("results");
    }, totalMs + 150));
  }, [pattern]);

  const handleTap = () => {
    if (phase !== "playing") return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const elapsed = now - startTimeRef.current;
    const currentOnsets = onsets.current;

    // Find nearest unclaimed onset
    let bestIdx = -1, bestDiff = Infinity;
    currentOnsets.forEach((onset, i) => {
      if (resultsRef.current[i] != null) return; // already scored
      const diff = Math.abs(elapsed - onset);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    if (bestIdx === -1 || bestDiff > OK_WINDOW_SEC) {
      tapFeedbackSound(now, false);
      return; // stray tap, no onset close enough — ignore rather than penalize
    }
    const signedDiff = elapsed - currentOnsets[bestIdx];
    let verdict;
    if (Math.abs(signedDiff) <= HIT_WINDOW_SEC) verdict = "perfect";
    else verdict = signedDiff < 0 ? "early" : "late";
    resultsRef.current[bestIdx] = verdict;
    setResults([...resultsRef.current]);
    tapFeedbackSound(now, verdict === "perfect");
  };

  const summary = results.reduce(
    (acc, r) => { if (r) acc[r] = (acc[r] || 0) + 1; return acc; },
    {}
  );
  const totalCells = pattern.cells.length;
  const scored = results.filter(Boolean).length;
  const scorePct = scored > 0 ? Math.round(((summary.perfect || 0) / totalCells) * 100) : 0;

  const verdictColor = (v) => {
    if (v === "perfect") return C.sage;
    if (v === "early" || v === "late") return C.amberText;
    if (v === "miss") return C.roseDeep;
    return C.lilacLine;
  };
  const verdictBg = (v) => {
    if (v === "perfect") return C.sageBg;
    if (v === "early" || v === "late") return C.amberBg;
    if (v === "miss") return C.roseBg;
    return C.card;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.parchment, paddingBottom: 40 }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={20} color={C.ink} />
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink }}>Rhythm Tapping</div>
      </div>

      {/* Pattern picker */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0", overflowX: "auto" }}>
        {PATTERNS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => { if (phase === "idle" || phase === "results") { setPatternIdx(i); setPhase("idle"); setResults([]); } }}
            disabled={phase === "countIn" || phase === "playing"}
            style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 999,
              border: `1.5px solid ${patternIdx === i ? C.garnet : C.lilacLine}`,
              background: patternIdx === i ? C.garnet : "transparent",
              color: patternIdx === i ? "#fff" : C.inkSoft,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Beat visualizer */}
      <div style={{ margin: "24px 24px 0", background: C.card, borderRadius: 20, padding: "28px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {pattern.cells.map((dur, i) => {
            const isActive = activeCell === i;
            const verdict = results[i];
            const size = 22 + dur * 16; // bigger circle for longer notes
            return (
              <div
                key={i}
                style={{
                  width: size, height: size, borderRadius: "50%",
                  border: `2.5px solid ${verdict ? verdictColor(verdict) : (isActive ? C.garnet : C.lilacLine)}`,
                  background: verdict ? verdictBg(verdict) : (isActive ? C.roseBg : "transparent"),
                  transition: "transform 0.1s ease",
                  transform: isActive ? "scale(1.15)" : "scale(1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: C.inkSoft, fontWeight: 700,
                }}
              >
                {dur === 0.5 ? "♪" : dur === 2 ? "𝅗𝅥" : "♩"}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: C.inkSoft }}>
          {phase === "idle" && "Tap Start, listen to the 4-beat count-in, then tap along."}
          {phase === "countIn" && "Get ready…"}
          {phase === "playing" && "Tap now!"}
          {phase === "results" && "Round complete"}
        </div>
      </div>

      {/* Tap zone */}
      {phase === "playing" && (
        <button
          onClick={handleTap}
          className="dvbc-tap"
          style={{
            display: "block", margin: "24px auto 0", width: 160, height: 160, borderRadius: "50%",
            background: C.garnet, color: "#fff", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
            boxShadow: "0 6px 20px rgba(138,35,50,0.35)",
          }}
        >
          TAP
        </button>
      )}

      {/* Results summary */}
      {phase === "results" && (
        <div style={{ margin: "24px 24px 0", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: C.ink, marginBottom: 10 }}>
            <strong style={{ color: C.sage }}>{summary.perfect || 0}</strong> perfect · {" "}
            <strong style={{ color: C.amberText }}>{(summary.early || 0) + (summary.late || 0)}</strong> off-beat · {" "}
            <strong style={{ color: C.roseDeep }}>{summary.miss || 0}</strong> missed
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>Score: {scorePct}%</div>
        </div>
      )}

      {/* Start / Retry button */}
      {(phase === "idle" || phase === "results") && (
        <button
          onClick={startRound}
          className="dvbc-tap"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            margin: "24px 24px 0", width: "calc(100% - 48px)", padding: 16, borderRadius: 16,
            background: C.garnet, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer",
          }}
        >
          {phase === "results" ? <RotateCcw size={18} /> : <Play size={18} />}
          {phase === "results" ? "Try again" : "Start"}
        </button>
      )}
    </div>
  );
}
