import React, { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from "vexflow";

/**
 * StaffRenderer
 * Draws a single staff with one or more notes. Foundation piece for the
 * Notation Trainer module — flashcards, rhythm drills, and interval quizzes
 * all render through this.
 *
 * Props:
 *  - clef: "treble" | "bass" (default "treble")
 *  - notes: array of note specs, e.g.
 *      [{ keys: ["c/4"], duration: "q" }, { keys: ["e/4"], duration: "q" }]
 *    `keys` uses VexFlow pitch notation: "c/4" = middle C, "f#/4" = F#4, etc.
 *    `duration`: "w" whole, "h" half, "q" quarter, "8" eighth, "16" sixteenth.
 *  - width, height: canvas size (defaults tuned for a single measure)
 *  - highlightIndex: optional index of a note to color (e.g. for feedback)
 *  - highlightColor: color used when highlightIndex is set
 */
export default function StaffRenderer({
  clef = "treble",
  notes = [{ keys: ["c/4"], duration: "q" }],
  width = 260,
  height = 140,
  highlightIndex = null,
  highlightColor = "#8A2332",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = ""; // clear previous render on re-draw

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const stave = new Stave(10, 10, width - 20);
    stave.addClef(clef);
    stave.setContext(context).draw();

    if (!notes || notes.length === 0) return;

    const staveNotes = notes.map((n, i) => {
      const sn = new StaveNote({
        clef,
        keys: n.keys,
        duration: n.duration || "q",
      });
      // Auto-add accidentals for any key containing # or b
      n.keys.forEach((k, ki) => {
        if (k.includes("#")) sn.addModifier(new Accidental("#"), ki);
        else if (k.includes("b")) sn.addModifier(new Accidental("b"), ki);
      });
      if (highlightIndex === i) {
        sn.setStyle({ fillStyle: highlightColor, strokeStyle: highlightColor });
      }
      return sn;
    });

    // Voice time signature is derived loosely from duration count; for single
    // isolated notes/chords (flashcard use case) we just size the voice to fit.
    const totalBeats = staveNotes.length; // good enough for quarter-note-based drills
    const voice = new Voice({ numBeats: Math.max(totalBeats, 1), beatValue: 4 });
    voice.setStrict(false); // allow partial measures (single flashcard notes)
    voice.addTickables(staveNotes);

    new Formatter().joinVoices([voice]).format([voice], width - 60);
    voice.draw(context, stave);
  }, [clef, JSON.stringify(notes), width, height, highlightIndex, highlightColor]);

  return <div ref={containerRef} style={{ display: "inline-block" }} />;
}

/**
 * Simple pitch-name helper for flashcard answer-checking.
 * Converts a VexFlow key like "f#/4" -> { letter: "F", accidental: "#", octave: 4 }
 */
export function parseVexKey(key) {
  const [pitch, octave] = key.split("/");
  const letter = pitch[0].toUpperCase();
  const accidental = pitch.slice(1) || "";
  return { letter, accidental, octave: parseInt(octave, 10) };
}
