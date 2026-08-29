"use client";

import { useEffect, useRef, useState } from "react";
import { spiele, stand, stoppe } from "@/lib/introAudio";

/**
 * Der gesprochene Vorspann (public/audio/introdark.mp3).
 *
 * Die Zeilen erscheinen im Takt der Aufnahme - eine nach der anderen, ruhig
 * und mit Nachhall. Danach eine kurze Stille, dann übernimmt das Intro.
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
const STUMME_DAUER = 18;

/** Stille zwischen letztem Wort und Titelsong. */
const PAUSE_MS = 700;

export function Prolog({ onFertig }: { onFertig: () => void }) {
  const startRef = useRef(performance.now());
  const fertigRef = useRef(false);
  const [fortschritt, setFortschritt] = useState(0);

  // Die Rückmeldung liegt in einer Ref: Sonst würde jede neue Funktion aus der
  // Elternkomponente den Effekt neu starten - und die Aufnahme liefe von vorn.
  const fertigCb = useRef(onFertig);
  fertigCb.current = onFertig;

  useEffect(() => {
    let laeuftNoch = true;
    let pause: number | undefined;

    void spiele("prolog");

    const beenden = () => {
      if (fertigRef.current) return;
      fertigRef.current = true;
      // Kurz nachhallen lassen, bevor die Musik einsetzt.
      pause = window.setTimeout(() => fertigCb.current(), PAUSE_MS);
    };

    const tick = () => {
      if (!laeuftNoch) return;

      const { zeit, dauer } = stand("prolog");
      const gesamt = dauer ?? STUMME_DAUER;
      const vergangen = zeit > 0 ? zeit : (performance.now() - startRef.current) / 1000;

      setFortschritt(Math.min(1, vergangen / gesamt));

      if (vergangen >= gesamt) {
        beenden();
        return;
      }
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      laeuftNoch = false;
      cancelAnimationFrame(id);
      window.clearTimeout(pause);
      stoppe("prolog");
    };
    // Absichtlich ohne Abhängigkeiten: Der Prolog läuft genau einmal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Die Zeilen verteilen sich über die ganze Aufnahme, mit etwas Vorlauf am
  // Anfang - so hinkt der Text der Stimme nicht hinterher.
  const anteil = Math.max(0, (fortschritt - 0.04) / 0.9);
  const sichtbar = Math.min(
    SPRECHERTEXT.length,
    Math.floor(anteil * SPRECHERTEXT.length) + 1,
  );

  return (
    <div className="prolog">
      <div className="prolog-vignette" />

      <div className="prolog-text">
        {SPRECHERTEXT.slice(0, sichtbar).map((zeile, i) => (
          <p key={zeile} className="prolog-zeile" data-letzte={i === sichtbar - 1}>
            {zeile}
          </p>
        ))}
      </div>

      <button
        className="intro-skip prolog-skip"
        onClick={() => {
          fertigRef.current = true;
          stoppe("prolog");
          onFertig();
        }}
      >
        Überspringen ›
      </button>
    </div>
  );
}
