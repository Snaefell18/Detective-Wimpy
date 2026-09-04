"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { Wetter } from "./Wetter";
import { tonQuelle } from "@/lib/stimme";
import type { AuftrittsArt } from "@/lib/sagaTypen";
import type { Character } from "@/lib/types";

/**
 * "Ein neuer Spieler betritt das Feld!"
 *
 * Die Ansage, bevor ein Kapitel beginnt, in dem jemand zum ersten Mal dabei
 * ist. Die Figur kommt nicht auf einen Schlag, sondern schält sich über die
 * ganze Länge des Tons aus dem Dunkel: Am Anfang ein Schatten, am Ende steht
 * sie da. Ohne Ton dauert dasselbe eine kurze, feste Zeit.
 *
 * Deshalb hängt der Fortschritt am Abspielkopf und nicht an einem Wecker -
 * ein Lied, das zehn Sekunden läuft, enthüllt zehn Sekunden lang.
 */

/** Wie lange die Enthüllung dauert, wenn kein Ton eingestellt ist. */
const OHNE_TON = 2400;
/** Wie lange die fertige Figur stehen bleibt, bevor es weitergeht. */
const NACH_ENTHUELLUNG = 2200;
/** Notbremse: Ein Ton, der nicht endet, darf das Spiel nicht anhalten. */
const HOECHSTENS = 20_000;
/** Ab hier steht der Name statt des Fragezeichens. */
const NAME_AB = 0.82;

/**
 * Der Geld- und Konfettiregen des Jackpot-Auftritts.
 *
 * Feste Werte statt Zufall: So sieht der Auftritt jedes Mal gleich aus, und
 * React muss die Schicht bei keinem Renderdurchgang neu würfeln.
 */
const SCHAUER = [
  "💰", "🎉", "💸", "✨", "🪙", "🎊", "💵", "⭐", "💎", "🎉",
  "💰", "✨", "💸", "🪙", "🎊", "💵", "⭐", "💰", "✨", "💎",
].map((zeichen, i) => ({
  zeichen,
  links: (i * 37 + 11) % 96,
  zeit: ((i * 13) % 40) / 10,
}));

export function NeuerSpieler({
  tiere,
  ton = "",
  art = "klassisch",
  onFertig,
}: {
  tiere: Character[];
  /**
   * Der Ton je Tier - schon aufgelöst: Was hier steht, wird gespielt. Leer
   * heißt: ohne Ton, dann läuft die Enthüllung über die kurze feste Zeit.
   */
  ton?: string | ((charakterId: string) => string);
  /** Wie der Auftritt aussieht - je Tier verschieden. */
  art?: AuftrittsArt | ((charakterId: string) => AuftrittsArt);
  onFertig: () => void;
}) {
  const [nr, setNr] = useState(0);
  const [fortschritt, setFortschritt] = useState(0);
  const tier = tiere[nr];
  // Jedes Tier darf sein eigenes Stück mitbringen.
  const stueck = (typeof ton === "function" ? (tier ? ton(tier.id) : "") : ton) || "";
  const auftritt: AuftrittsArt =
    (typeof art === "function" ? (tier ? art(tier.id) : "klassisch") : art) || "klassisch";
  const enthuellt = fortschritt >= 1;

  // Die Rückmeldung liegt in einem Ref: Sonst würde jeder Renderdurchgang der
  // Elternseite die Wecker neu stellen, und die Ansage bliebe stehen.
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /**
   * Kurze Sperre nach dem Aufdecken. Ein Fingertipp kann auf dem Handy als
   * mehrere Ereignisse ankommen; ohne sie hätte derselbe Tipp erst enthüllt
   * und gleich darauf weitergeschaltet - und man sähe das Bild nie.
   */
  const sperreBis = useRef(0);

  const weiterschalten = () => {
    if (nr + 1 < tiere.length) {
      setNr(nr + 1);
      setFortschritt(0);
    } else fertigRef.current();
  };

  /** Ein Tipp deckt erst ganz auf - und erst der nächste geht weiter. */
  const antippen = () => {
    if (performance.now() < sperreBis.current) return;
    if (!enthuellt) {
      audioRef.current?.pause();
      sperreBis.current = performance.now() + 600;
      setFortschritt(1);
      return;
    }
    weiterschalten();
  };

  // Die Enthüllung: Sie läuft mit dem Ton mit, sonst über eine feste Zeit.
  useEffect(() => {
    let aktiv = true;
    let bild = 0;
    let umschalter = 0;
    setFortschritt(0);

    /**
     * Die Ersatzuhr für alles, was ohne Ton läuft. Sie wird neu gestellt,
     * sobald feststeht, dass kein Ton kommt - sonst stünde man die volle
     * Notbremsenzeit im Dunkeln, nur weil der Browser nicht abspielen wollte.
     */
    const uhr = { start: performance.now(), dauer: stueck ? HOECHSTENS : OHNE_TON };
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
        // Ein Tipp hat schon aufgedeckt - dabei bleibt es.
        if (alt >= 1) return 1;
        const jetzt = laeuft
          ? Math.min(1, audio.currentTime / audio.duration)
          : Math.min(1, (performance.now() - uhr.start) / uhr.dauer);
        // Nur vorwärts: Ein kurzer Aussetzer soll die Figur nicht zurück ins
        // Dunkel schieben.
        return Math.max(alt, jetzt);
      });

      bild = requestAnimationFrame(takt);
    };

    if (stueck) {
      void tonQuelle(stueck).then((quelle) => {
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
          // Verweigert der Browser den Ton, läuft die Enthüllung trotzdem -
          // dann eben über die kurze feste Zeit.
          audioRef.current = null;
          stelleUhr(OHNE_TON);
        });
      });

      // Und falls gar nichts passiert - kein Fehler, aber auch kein Ton:
      // Nach einem Augenblick zählt ebenfalls die Uhr.
      umschalter = window.setTimeout(() => {
        const audio = audioRef.current;
        if (!audio || audio.paused || !Number.isFinite(audio.duration)) stelleUhr(OHNE_TON);
      }, 1200);
    }

    bild = requestAnimationFrame(takt);
    return () => {
      aktiv = false;
      cancelAnimationFrame(bild);
      window.clearTimeout(umschalter);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [nr, stueck]);

  // Steht die Figur ganz im Licht, bleibt sie kurz - dann geht es weiter.
  useEffect(() => {
    if (!enthuellt) return;
    const id = window.setTimeout(() => {
      if (nr + 1 < tiere.length) {
        setNr(nr + 1);
        setFortschritt(0);
      } else fertigRef.current();
    }, NACH_ENTHUELLUNG);
    return () => window.clearTimeout(id);
  }, [enthuellt, nr, tiere.length]);

  // Sollte nie vorkommen - aber ein leerer Bildschirm wäre eine Sackgasse.
  useEffect(() => {
    if (!tier) fertigRef.current();
  }, [tier]);
  if (!tier) return null;

  return (
    <div
      className="intro neuzugang"
      data-enthuellt={enthuellt}
      data-art={auftritt}
      style={{ ["--enthuellung" as string]: fortschritt.toFixed(3) }}
      onPointerDown={antippen}
    >
      {/* Die Kulisse liegt hinter der Bühne: Im Gewitter zeichnet sich die
          verhüllte Figur als Silhouette gegen den aufblitzenden Himmel ab. */}
      {auftritt === "gewitter" && (
        <>
          <Wetter lage="regen" />
          <div className="gewitter-blitz" />
        </>
      )}

      {auftritt === "jackpot" && (
        <>
          <div className="jackpot-strahlen" />
          <div className="jackpot-schauer" aria-hidden="true">
            {SCHAUER.map((s, i) => (
              <span key={i} style={{ left: `${s.links}%`, animationDelay: `${s.zeit}s` }}>
                {s.zeichen}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Ein Lichtblitz im Moment, in dem sie ganz da ist. */}
      {enthuellt && <div className="neuzugang-blitz" key={`blitz-${nr}`} />}

      <div className="intro-buehne">
        <div className="szene-block neuzugang-szene" key={tier.id}>
          <p className="intro-oberzeile einfliegen">
            {tiere.length > 1 && nr === 0
              ? "Neue Spieler betreten das Feld!"
              : "Ein neuer Spieler betritt das Feld!"}
          </p>

          <div className="intro-portraet neuzugang-portraet">
            <Bild src={tier.bild} alt={tier.name} platzhalter={tier.name} groesse="260px" sofort />
            {/* Der Schleier liegt über der Figur und weicht mit dem Ton. Er
                deckt zuverlässig ab - anders als ein Filter auf dem Bild, den
                die Themes für Intro-Porträts überschreiben. */}
            <span className="neuzugang-schleier" aria-hidden="true" />
          </div>

          {fortschritt >= NAME_AB ? (
            <>
              <h1 className="intro-logo slam">{tier.name}</h1>
              <p className="leise neuzugang-zeile">
                {[tier.beruf, tier.tierart].filter(Boolean).join(" · ")}
              </p>
            </>
          ) : (
            <>
              <h1 className="intro-logo neuzugang-raetsel">?</h1>
              <p className="leise neuzugang-zeile">Wer ist das?</p>
            </>
          )}
        </div>
      </div>

      <div className="intro-leiste">
        {/* Der Balken zeigt, wie weit die Enthüllung ist. */}
        <div className="intro-fortschritt">
          <span style={{ width: `${fortschritt * 100}%` }} />
        </div>
        <div className="intro-knoepfe">
          {tiere.length > 1 && (
            <span className="intro-nummer">
              {nr + 1} / {tiere.length}
            </span>
          )}
          <button
            className="intro-skip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={antippen}
          >
            {enthuellt ? "Weiter ›" : "Sofort zeigen ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
