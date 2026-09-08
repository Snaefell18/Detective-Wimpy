"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { tonQuelle } from "@/lib/stimme";
import type { Character } from "@/lib/types";

/**
 * Der Einzug des Gerichts - die Ankündigung vor der Verhandlung.
 *
 * Sie kommt aus dem Nichts: Erst ist der Bildschirm schwarz und still, dann
 * schlägt es dreimal, die Türen fliegen auf, und Öhö flattert herein, um
 * Recht zu sprechen.
 *
 *   1. Stille   - schwarz. Nur ein Lichtspalt zwischen zwei Türen.
 *   2. Klopfen  - drei Schläge, jeder ein Blitz durchs Bild.
 *   3. Türen    - sie fliegen auf, Licht und Federn stürzen herein.
 *   4. Einzug   - er kommt geflogen, schlägt mit den Flügeln, wird größer.
 *   5. Recht    - er steht, und der Saal weiß, wer hier gleich urteilt.
 *
 * Wie bei der Verwandlung bestimmt das gewählte Stück die Länge: Der ganze
 * Ablauf ist ein Anteil davon, nicht eine feste Zeit. Ohne Stück läuft eine
 * kurze Fassung.
 */

/** Ohne Ton dauert der Einzug diese Zeit. */
const OHNE_TON = 6500;
/** Notbremse, falls ein Stück nie endet. */
const HOECHSTENS = 90_000;
/** Wie lange er danach noch steht. */
const NACHHALL = 2200;

/** Die Schläge, jeweils bis zu diesem Anteil des Stücks. */
const STILLE = 0.16;
const KLOPFEN = 0.36;
const TUEREN = 0.55;
const EINZUG = 0.86;

/** Federn, die beim Aufgehen der Türen durchs Bild treiben. */
const FEDERN = Array.from({ length: 14 }, (_, i) => i);

export function Gerichtseinzug({
  richter,
  ton = "",
  onFertig,
}: {
  richter: Character | undefined;
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
    ? "recht"
    : fortschritt < STILLE
      ? "stille"
      : fortschritt < KLOPFEN
        ? "klopfen"
        : fortschritt < TUEREN
          ? "tueren"
          : fortschritt < EINZUG
            ? "einzug"
            : "recht";

  /** Wie weit die Türen offen stehen und wie weit er heran ist (0 … 1). */
  const anteil = (von: number, bis: number) =>
    Math.min(1, Math.max(0, (fortschritt - von) / (bis - von)));
  const oeffnung = anteil(KLOPFEN, TUEREN);
  const flug = anteil(TUEREN, EINZUG);

  /** Ein Tipp bringt den Einzug zu Ende - der nächste geht in den Saal. */
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
      // Spielt nach anderthalb Sekunden nichts, läuft die kurze Fassung.
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

  // Steht er, bleibt er kurz - dann beginnt die Verhandlung.
  useEffect(() => {
    if (!fertig) return;
    const id = window.setTimeout(() => fertigRef.current(), NACHHALL);
    return () => window.clearTimeout(id);
  }, [fertig]);

  useEffect(() => {
    if (!richter) fertigRef.current();
  }, [richter]);
  if (!richter) return null;

  return (
    <div
      className="intro einzug"
      data-schlag={schlag}
      style={{
        ["--einzug" as string]: fortschritt.toFixed(3),
        ["--auf" as string]: oeffnung.toFixed(3),
        ["--flug" as string]: flug.toFixed(3),
      }}
      onPointerDown={antippen}
    >
      {/* Was hinter den Türen liegt: Licht, Staub, der Saal. */}
      <div className="einzug-saal" />
      <div className="einzug-strahl" />

      <div className="einzug-federn" aria-hidden="true">
        {FEDERN.map((i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37 + 5) % 96}%`,
              animationDelay: `${((i * 13) % 40) / 10}s`,
              animationDuration: `${3.2 + ((i * 7) % 8) * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Der Vogel: fliegt von weit oben rechts heran und wird größer. */}
      <div className="einzug-flug">
        <div className="einzug-vogel">
          <span className="einzug-fluegel" data-seite="links" />
          <span className="einzug-fluegel" data-seite="rechts" />
          <div className="einzug-portraet">
            <Bild src={richter.bild} alt="" platzhalter={richter.name} groesse="260px" sofort />
          </div>
        </div>
      </div>

      {/* Die Türen liegen über allem und geben den Blick erst frei. */}
      <div className="einzug-tuer" data-seite="links" />
      <div className="einzug-tuer" data-seite="rechts" />
      <div className="einzug-schlag" />

      <div className="intro-buehne einzug-buehne">
        {schlag === "stille" && <p className="intro-oberzeile einzug-flüstern">…</p>}
        {schlag === "klopfen" && <p className="intro-oberzeile einzug-ruf">Klopf. Klopf. Klopf.</p>}
        {schlag === "tueren" && <p className="intro-oberzeile einzug-ruf">Das Gericht!</p>}
        {(schlag === "einzug" || schlag === "recht") && (
          <div className="einzug-tafel">
            <span className="intro-oberzeile">Das Gericht tagt</span>
            <h1 className="intro-logo slam einzug-name">{richter.name}</h1>
            <p className="leise einzug-zeile">spricht Recht</p>
          </div>
        )}
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
            {fertig ? "In den Saal ›" : "Überspringen ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
