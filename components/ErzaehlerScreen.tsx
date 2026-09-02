"use client";

import { useEffect, useRef, useState } from "react";
import { Szene } from "./Bild";
import { spiele, stoppe, type Stueck } from "@/lib/introAudio";
import { tonQuelle } from "@/lib/stimme";
import type { Erzaehlerteil } from "@/lib/sagaTypen";

/**
 * Ein Erzählerteil zwischen zwei Kapiteln: Text, der zeilenweise erscheint,
 * dazu - sobald eine Datei hinterlegt ist - die gesprochene Fassung.
 *
 * Ohne Tondatei läuft der Text nach einer festen Zeit durch. Weiter geht es
 * immer erst auf Fingertipp, damit niemand etwas verpasst.
 */
const STUMME_DAUER = 16;

/** Die Titelkarte vor einem Kapitel - wie in einer Serie. */
export type Kapitelkarte = { marke: string; name: string; bild?: string | null };

/** I, II, III … - für die Titelkarte, nicht für Rechnungen. */
export function roemisch(zahl: number): string {
  const tafel: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.max(0, Math.round(zahl));
  let wort = "";
  for (const [wert, zeichen] of tafel) {
    while (rest >= wert) {
      wort += zeichen;
      rest -= wert;
    }
  }
  return wort || String(zahl);
}

/** Wie lange die Titelkarte steht, bevor der Erzähler anfängt. */
const KARTE_DAUER = 2300;

export function ErzaehlerScreen({
  teil,
  titel,
  weiterText = "Weiter ›",
  musik,
  karte,
  onWeiter,
}: {
  teil: Erzaehlerteil;
  titel?: string;
  weiterText?: string;
  /**
   * Titelkarte davor. Solange sie steht, beginnt der Erzähler nicht - sonst
   * liefe der Text unter einer Karte weiter, die ihn verdeckt.
   */
  karte?: Kapitelkarte;
  /**
   * Musik unter dem Text - für gewonnene Abschnitte einer Saga. Eine eigene
   * Sprecherdatei hat immer Vorrang, die soll die Musik nicht übertönen.
   */
  musik?: Stueck;
  onWeiter: () => void;
}) {
  const zeilen = teil.text
    .split(/\n+/)
    .map((z) => z.trim())
    .filter(Boolean);
  const [fortschritt, setFortschritt] = useState(0);
  const [karteLaeuft, setKarteLaeuft] = useState(Boolean(karte));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef(performance.now());

  // Absichtlich an den Texten der Karte statt am Objekt: Der Aufrufer baut es
  // bei jedem Renderdurchgang neu, und ein Wecker, der ständig neu gestellt
  // wird, klingelt nie.
  const karteMarke = karte?.marke;
  const karteName = karte?.name;
  useEffect(() => {
    if (!karteMarke && !karteName) return;
    const id = window.setTimeout(() => setKarteLaeuft(false), KARTE_DAUER);
    return () => window.clearTimeout(id);
  }, [karteMarke, karteName]);

  useEffect(() => {
    if (karteLaeuft) return;
    let laeuftNoch = true;
    startRef.current = performance.now();

    if (teil.audio) {
      // Eine gesprochene Fassung kann in der Datenbank liegen ("stimme:…").
      // Das Nachschlagen dauert einen Moment; bis dahin läuft der Text schon.
      void tonQuelle(teil.audio).then((quelle) => {
        if (!laeuftNoch || !quelle) return;
        const audio = new Audio(quelle);
        audioRef.current = audio;
        void audio.play().catch(() => {
          // Blockiert der Browser den Ton, läuft die Szene stumm weiter.
        });
      });
    } else if (musik) {
      void spiele(musik);
    }

    const tick = () => {
      if (!laeuftNoch) return;
      const audio = audioRef.current;
      const dauer =
        audio && Number.isFinite(audio.duration) && audio.duration > 1
          ? audio.duration
          : STUMME_DAUER;
      const zeit =
        audio && audio.currentTime > 0
          ? audio.currentTime
          : (performance.now() - startRef.current) / 1000;
      setFortschritt(Math.min(1, zeit / dauer));
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);

    return () => {
      laeuftNoch = false;
      cancelAnimationFrame(id);
      audioRef.current?.pause();
      audioRef.current = null;
      if (musik) stoppe(musik);
    };
  }, [teil.audio, musik, karteLaeuft]);

  const sichtbar = Math.min(zeilen.length, Math.floor(fortschritt * zeilen.length) + 1);

  if (karteLaeuft && karte) {
    return (
      <div className="kapitel-karte" onPointerDown={() => setKarteLaeuft(false)}>
        {karte.bild && (
          <div className="kapitel-karte-bild">
            <Szene src={karte.bild} alt="" platzhalter="" variante="titel" />
          </div>
        )}
        <div className="kapitel-karte-text">
          <span className="intro-oberzeile">{karte.marke}</span>
          <h1 className="intro-logo slam">{karte.name}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="prolog erzaehler" onPointerDown={onWeiter}>
      <div className="prolog-vignette" />

      <div className="prolog-text">
        {titel && <p className="erzaehler-titel">{titel}</p>}

        {zeilen.slice(0, sichtbar).map((zeile, i) => (
          <p
            key={i}
            className="prolog-zeile"
            data-letzte={i === sichtbar - 1 ? "true" : undefined}
          >
            {zeile}
          </p>
        ))}
      </div>

      {/* Tippen geht überall - der Knopf darf den Tipp nicht doppelt zählen. */}
      <button
        className="erzaehler-weiter pochen"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onWeiter}
      >
        {weiterText}
      </button>
    </div>
  );
}
