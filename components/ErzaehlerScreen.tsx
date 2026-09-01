"use client";

import { useEffect, useRef, useState } from "react";
import { spiele, stoppe, type Stueck } from "@/lib/introAudio";
import type { Erzaehlerteil } from "@/lib/sagaTypen";

/**
 * Ein Erzählerteil zwischen zwei Kapiteln: Text, der zeilenweise erscheint,
 * dazu - sobald eine Datei hinterlegt ist - die gesprochene Fassung.
 *
 * Ohne Tondatei läuft der Text nach einer festen Zeit durch. Weiter geht es
 * immer erst auf Fingertipp, damit niemand etwas verpasst.
 */
const STUMME_DAUER = 16;

export function ErzaehlerScreen({
  teil,
  titel,
  weiterText = "Weiter ›",
  musik,
  onWeiter,
}: {
  teil: Erzaehlerteil;
  titel?: string;
  weiterText?: string;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef(performance.now());

  useEffect(() => {
    let laeuftNoch = true;

    if (teil.audio) {
      const audio = new Audio(teil.audio);
      audioRef.current = audio;
      void audio.play().catch(() => {
        // Blockiert der Browser den Ton, läuft die Szene stumm weiter.
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
  }, [teil.audio, musik]);

  const sichtbar = Math.min(zeilen.length, Math.floor(fortschritt * zeilen.length) + 1);

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
