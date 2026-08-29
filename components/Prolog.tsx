"use client";

import { useEffect, useRef, useState } from "react";
import { prologAudio } from "@/lib/introAudio";

/**
 * Der gesprochene Prolog vor dem Intro (public/audio/introdark.mp3).
 *
 * Die festen Zeilen des Sprechers werden im Takt der Aufnahme eingeblendet,
 * danach folgt der Anriss dieses Falls. Am Ende der Aufnahme geht es direkt
 * ins Intro mit dem Titelsong.
 */
const SPRECHERTEXT = [
  "Es gibt Dinge, die man übersieht.",
  "Eine Tür, die offen steht.",
  "Eine Spur im Staub.",
  "Ein Name, der nicht hätte auftauchen dürfen.",
  "Und manchmal führt eine kleine Spur zu etwas,",
  "das viel größer ist, als man sich je hätte vorstellen können.",
  "Ein Fall für Detektiv Wimpy.",
];

/** Ohne Ton wäre das Warten sonst zäh. */
const STUMME_DAUER = 14;

export function Prolog({
  introText,
  onFertig,
}: {
  /** Der fallspezifische Anriss aus der Datenbank. */
  introText: string;
  onFertig: () => void;
}) {
  const startRef = useRef(performance.now());
  const fertigRef = useRef(false);
  const [fortschritt, setFortschritt] = useState(0);

  const fallZeilen = introText
    .split(/\n|(?<=\.)\s+/)
    .map((zeile) => zeile.trim())
    .filter(Boolean);

  useEffect(() => {
    const audio = prologAudio();
    let laeuft = true;

    audio.currentTime = 0;
    void audio.play().catch(() => {});

    const tick = () => {
      if (!laeuft) return;
      const dauer =
        Number.isFinite(audio.duration) && audio.duration > 1
          ? audio.duration
          : STUMME_DAUER;
      const zeit =
        !audio.paused && audio.currentTime > 0
          ? audio.currentTime
          : (performance.now() - startRef.current) / 1000;

      setFortschritt(Math.min(1, zeit / dauer));

      if (zeit >= dauer) {
        if (!fertigRef.current) {
          fertigRef.current = true;
          onFertig();
        }
        return;
      }
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      laeuft = false;
      cancelAnimationFrame(id);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [onFertig]);

  // Die Sprecherzeilen füllen die ersten drei Viertel, dann kommt der Fall.
  const gesamt = SPRECHERTEXT.length;
  const sichtbar = Math.min(gesamt, Math.floor((fortschritt / 0.78) * gesamt) + 1);
  const fallSichtbar = fortschritt > 0.74;

  return (
    <div className="prolog">
      <div className="prolog-vignette" />

      <div className="prolog-text">
        {SPRECHERTEXT.slice(0, sichtbar).map((zeile, i) => (
          <p key={zeile} className="prolog-zeile" data-letzte={i === sichtbar - 1}>
            {zeile}
          </p>
        ))}

        {fallSichtbar && fallZeilen.length > 0 && (
          <div className="prolog-fall">
            {fallZeilen.map((zeile) => (
              <p key={zeile}>{zeile}</p>
            ))}
          </div>
        )}
      </div>

      <button
        className="intro-skip prolog-skip"
        onClick={() => {
          fertigRef.current = true;
          onFertig();
        }}
      >
        Überspringen ›
      </button>
    </div>
  );
}
