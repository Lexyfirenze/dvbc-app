import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, Volume2 } from "lucide-react";
import StaffRenderer from "./StaffRenderer";

/* ---------- Note pools ---------- */
// Natural notes only for now (Phase 1-2 core). Sharps/flats can be added later
// as a difficulty toggle once the basics are solid.
const TREBLE_NOTES = [
  "c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4",
  "c/5", "d/5", "e/5", "f/5",
];
const BASS_NOTES = [
  "e/2", "f/2", "g/2", "a/2", "b/2",
  "c/3", "d/3", "e/3", "f/3", "g/3", "a/3",
];
const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

function randomNote(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Simple pitch frequency lookup for playback (equal temperament, A4 = 440Hz)
const NOTE_FREQS = {
  c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2,
};
function freqForKey(key) {
  const [pitch, octave] = key.split("/");
  const letter = pitch[0];
  const semitoneOffset = NOTE_FREQS[letter] + (parseInt(octave, 10) - 4) * 12;
  return 440 * Math.pow(2, semitoneOffset / 12);
}

let _audioCtx = null;
function playPitch(key, duration = 0.9) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    const freq = freqForKey(key);
    const now = _audioCtx.currentTime;
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(_audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch (e) { /* audio unsupported/blocked */ }
}

/**
 * NotationFlashcards
 * Note-identification drill: a random note appears on the staff, the member
 * picks its letter name from seven buttons, gets instant feedback, and can
 * tap the staff to hear the pitch. Tracks a simple session streak/score
 * (in-memory only for now — persistence comes once this flow is confirmed).
 */
export default function NotationFlashcards({ onBack, colors = {} }) {
  const C = {
    garnet: "#8A2332",
    sage: "#4F7A5C",
    sageBg: "#E7F1E9",
    roseDeep: "#B23368",
    roseBg: "#FBEAF1",
    ink: "#2B2119",
    inkSoft: "#7A6952",
    card: "#FFFFFF",
    parchment: "#FBF6EC",
    lilacLine: "#EAD9B8",
    ...colors,
  };

  const [clef, setClef] = useState("treble");
  const [currentKey, setCurrentKey] = useState(() => randomNote(TREBLE_NOTES));
  const [selected, setSelected] = useState(null); // last letter tapped
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const advanceTimer = useRef(null);

  const correctLetter = currentKey[0].toUpperCase();

  const nextCard = useCallback((nextClef = clef) => {
    const pool = nextClef === "bass" ? BASS_NOTES : TREBLE_NOTES;
    setCurrentKey(randomNote(pool));
    setSelected(null);
    setFeedback(null);
  }, [clef]);

  const handleSwitchClef = (newClef) => {
    setClef(newClef);
    nextCard(newClef);
  };

  const handleAnswer = (letter) => {
    if (feedback) return; // ignore taps while feedback is showing
    setSelected(letter);
    const isCorrect = letter === correctLetter;
    setFeedback(isCorrect ? "correct" : "wrong");
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setStreak((s) => (isCorrect ? s + 1 : 0));
    if (isCorrect) playPitch(currentKey, 0.5);
    advanceTimer.current = setTimeout(() => nextCard(), isCorrect ? 700 : 1100);
  };

  const handleHearPitch = () => playPitch(currentKey, 0.9);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : null;

  return (
    <div style={{ minHeight: "100vh", background: C.parchment, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={20} color={C.ink} />
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink }}>Note Flashcards</div>
      </div>

      {/* Clef switcher */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
        {["treble", "bass"].map((cl) => (
          <button
            key={cl}
            onClick={() => handleSwitchClef(cl)}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              border: `1.5px solid ${clef === cl ? C.garnet : C.lilacLine}`,
              background: clef === cl ? C.garnet : "transparent",
              color: clef === cl ? "#fff" : C.inkSoft,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "capitalize",
              cursor: "pointer",
            }}
          >
            {cl}
          </button>
        ))}
      </div>

      {/* Score row */}
      <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "18px 24px 0", fontSize: 13, color: C.inkSoft }}>
        <span>Score: <strong style={{ color: C.ink }}>{score.correct}/{score.total}</strong></span>
        {accuracy !== null && <span>Accuracy: <strong style={{ color: C.ink }}>{accuracy}%</strong></span>}
        <span>Streak: <strong style={{ color: streak >= 3 ? C.sage : C.ink }}>{streak}</strong></span>
      </div>

      {/* Staff card */}
      <div style={{ margin: "24px 24px 0", background: C.card, borderRadius: 20, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <StaffRenderer
          clef={clef}
          notes={[{ keys: [currentKey], duration: "q" }]}
          width={200}
          height={150}
        />
        <button
          onClick={handleHearPitch}
          style={{
            marginTop: 8, display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", color: C.garnet, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Volume2 size={16} /> Hear pitch
        </button>
      </div>

      {/* Feedback banner */}
      <div style={{ height: 28, textAlign: "center", marginTop: 10, fontSize: 14, fontWeight: 600, color: feedback === "correct" ? C.sage : feedback === "wrong" ? C.roseDeep : "transparent" }}>
        {feedback === "correct" && "Correct!"}
        {feedback === "wrong" && `Not quite — that was ${correctLetter}`}
      </div>

      {/* Answer buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "10px 24px 0" }}>
        {LETTERS.map((letter) => {
          const isSelected = selected === letter;
          const isRight = feedback && letter === correctLetter;
          const isPickedWrong = feedback === "wrong" && isSelected;
          let bg = C.card, border = C.lilacLine, color = C.ink;
          if (isRight) { bg = C.sageBg; border = C.sage; color = C.sage; }
          else if (isPickedWrong) { bg = C.roseBg; border = C.roseDeep; color = C.roseDeep; }
          return (
            <button
              key={letter}
              onClick={() => handleAnswer(letter)}
              disabled={!!feedback}
              style={{
                padding: "16px 0", borderRadius: 14, border: `1.5px solid ${border}`,
                background: bg, color, fontSize: 18, fontWeight: 700,
                cursor: feedback ? "default" : "pointer",
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
