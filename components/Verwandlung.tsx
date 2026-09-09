"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { tonQuelle } from "@/lib/stimme";
import type { Character } from "@/lib/types";

/**
 * Die Verwandlung: Aus einem Tier, das man die ganze Saga über kannte, bricht
 * die Dämonengestalt hervor.
 *
 * Der Bildschirm läuft über die volle Länge des gewählten Stücks und in vier
 * Schlägen:
 *
 *   1. Unruhe  - der Wirt steht da, aber etwas flackert. Man weiß nicht, was.
 *                Und es steht auch nirgends: Kommentiert wird die Verwandlung
 *                nicht, sie läuft einfach ab.
 *   2. Riss    - er verzerrt, zerfällt, das Bild bricht auf.
 *   3. Bruch   - Schwarz. Nur ein Auge, ein Herzschlag, Stille im Bild.
 *   4. Dämon   - der Einschlag: Schockwelle, und die neue Gestalt steht da.
 *
 * Der Name fällt erst ganz am Ende. Bis dahin soll niemand wissen, wer da
 * herauskommt - das ist der ganze Sinn der Sache.
 */

/** Ohne Ton dauert die Verwandlung diese Zeit. */
const OHNE_TON = 7000;
/** Notbremse, falls ein Stück nie endet. */
const HOECHSTENS = 60_000;
/** Wie lange die neue Gestalt danach stehen bleibt. */
const NACHHALL = 2600;

/** Die vier Schläge, jeweils bis zu diesem Anteil des Stücks. */
const UNRUHE = 0.34;
const RISS = 0.62;
const BRUCH = 0.76;

/** Was durch das Bild treibt, solange es reißt. */
const ZEICHEN = ["✦", "◈", "✧", "⛧", "◆", "✷", "☾", "✦", "◈", "✧", "◆", "✷"];

export function Verwandlung({
  wirt,
  daemon,
  ton = "",
  onFertig,
}: {
  wirt: Character | undefined;
  daemon: Character | undefined;
  /** Pfad oder "stimme:<id>" - leer heißt: feste Dauer. */
  ton?: string;
  onFertig: () => void;
}) {
  const [fortschritt, setFortschritt] = useState(0);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sperreBis = useRef(0);

  const fertig = fortschritt >= 1;
  const schlag = fertig
    ? "daemon"
    : fortschritt < UNRUHE
      ? "unruhe"
      : fortschritt < RISS
        ? "riss"
        : fortschritt < BRUCH
          ? "bruch"
          : "daemon";

  /** Ein Tipp bringt die Verwandlung zu Ende - der nächste geht weiter. */
  const antippen = () => {
    if (performance.now() < sperreBis.current) return;
    if (!fertig) {
      audioRef.current?.pause();
      sperreBis.current = performance.now() + 600;
      setFortschritt(1);
      return;
    }
    fertigRef.current();
  };

  useEffect(() => {
    let aktiv = true;
    let bild = 0;
    let umschalter = 0;
    const uhr = { start: performance.now(), dauer: ton ? HOECHSTENS : OHNE_TON };
    const stelleUhr = (dauer: number) => {
      if (!aktiv || uhr.dauer === dauer) return;
      uhr.start = performance.now();
      uhr.dauer = dauer;
    };

    const takt = () => {
      if (!aktiv) return;
      const audio = audioRef.current;
      const laeuft =
        audio && Number.isFinite(audio.duration) && audio.duration > 0.5 && !audio.paused;
      setFortschritt((alt) => {
        if (alt >= 1) return 1;
        const jetzt = laeuft
          ? Math.min(1, audio.currentTime / audio.duration)
          : Math.min(1, (performance.now() - uhr.start) / uhr.dauer);
        return Math.max(alt, jetzt);
      });
      bild = requestAnimationFrame(takt);
    };

    if (ton) {
      void tonQuelle(ton).then((quelle) => {
        if (!aktiv) return;
        if (!quelle) {
          stelleUhr(OHNE_TON);
          return;
        }
        const audio = new Audio(quelle);
        audioRef.current = audio;
        audio.addEventListener("ended", () => {
          if (aktiv) setFortschritt(1);
        });
        void audio.play().catch(() => {
          audioRef.current = null;
          stelleUhr(OHNE_TON);
        });
      });
      umschalter = window.setTimeout(() => {
        const audio = audioRef.current;
        if (!audio || audio.paused || !Number.isFinite(audio.duration)) stelleUhr(OHNE_TON);
      }, 1500);
    }

    bild = requestAnimationFrame(takt);
    return () => {
      aktiv = false;
      cancelAnimationFrame(bild);
      window.clearTimeout(umschalter);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [ton]);

  // Steht die Gestalt, bleibt sie kurz - dann geht es ins Finale.
  useEffect(() => {
    if (!fertig) return;
    const id = window.setTimeout(() => fertigRef.current(), NACHHALL);
    return () => window.clearTimeout(id);
  }, [fertig]);

  useEffect(() => {
    if (!wirt || !daemon) fertigRef.current();
  }, [wirt, daemon]);
  if (!wirt || !daemon) return null;

  return (
    <div
      className="intro verwandlung"
      data-schlag={schlag}
      style={{ ["--verwandlung" as string]: fortschritt.toFixed(3) }}
      onPointerDown={antippen}
    >
      <div className="verwandlung-grund" />
      {/* Sprünge im Bild - sie bleiben, wenn die Gestalt dasteht. */}
      <div className="verwandlung-sprunge" aria-hidden="true" />
      <div className="verwandlung-ringe">
        <span />
        <span />
        <span />
      </div>

      <div className="verwandlung-zeichen" aria-hidden="true">
        {ZEICHEN.map((z, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 41 + 7) % 94}%`,
              animationDelay: `${((i * 17) % 50) / 10}s`,
              animationDuration: `${2.6 + ((i * 5) % 6) * 0.5}s`,
            }}
          >
            {z}
          </span>
        ))}
      </div>

      <div className="intro-buehne">
        <div className="szene-block verwandlung-szene">
          <div className="verwandlung-portraet">
            {/* Beide Bilder liegen übereinander; der Schlag entscheidet, was
                man sieht - so gibt es keinen Ladehänger im Umschlag. */}
            <div className="verwandlung-wirt">
              <Bild src={wirt.bild} alt="" platzhalter={wirt.name} groesse="260px" sofort />
            </div>
            <div className="verwandlung-daemon">
              <Bild src={daemon.bild} alt="" platzhalter="" groesse="260px" sofort />
            </div>
            <span className="verwandlung-auge" />
          </div>

          {/* Kommentiert wird hier nichts. Was gerade geschieht, sieht man -
              es dazuzuschreiben nähme der Sache das Unheimliche und verriete
              obendrein zu früh, worauf es hinausläuft. Bis zum Schluss steht
              hier nur ein Name, dann ein Fragezeichen. */}
          {schlag === "daemon" ? (
            <>
              <h1 className="intro-logo slam verwandlung-name">{daemon.name}</h1>
              {[daemon.beruf, daemon.tierart].filter(Boolean).length > 0 && (
                <p className="leise verwandlung-zeile">
                  {[daemon.beruf, daemon.tierart].filter(Boolean).join(" · ")}
                </p>
              )}
            </>
          ) : (
            <h1 className="intro-logo verwandlung-fragen">
              {schlag === "unruhe" ? wirt.name : "?"}
            </h1>
          )}
        </div>
      </div>

      <div className="intro-leiste">
        <div className="intro-fortschritt">
          <span style={{ width: `${fortschritt * 100}%` }} />
        </div>
        <div className="intro-knoepfe">
          <button
            className="intro-skip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={antippen}
          >
            {fertig ? "Ins Finale ›" : "Überspringen ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
