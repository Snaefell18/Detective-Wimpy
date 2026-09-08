"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ein Video, das bildschirmfüllend vor einem Erzählerteil läuft.
 *
 * Es füllt den ganzen Schirm - beim iPhone 16 Pro also 19,5:9. Was in einem
 * anderen Seitenverhältnis vorliegt, wird beschnitten statt mit Balken
 * versehen ("cover"); Wichtiges gehört deshalb in die Mitte des Bildes.
 *
 * Danach geht es von allein weiter. Wer nicht warten will, tippt auf
 * "Überspringen"; der Knopf erscheint mit kurzer Verzögerung, damit ihn
 * niemand im ersten Moment aus Versehen trifft.
 *
 * Fehlt die Datei oder mag der Browser sie nicht, wird nicht gemeckert -
 * dann geht es sofort weiter, als hätte man nie ein Video hinterlegt.
 */

/** Ab wann man überspringen darf. */
const SKIP_AB = 1500;

/** Kommt bis dahin kein einziges Bild, stimmt etwas nicht - weiter. */
const GEDULD = 8000;

export function VideoSzene({ quelle, onFertig }: { quelle: string; onFertig: () => void }) {
  const [skipDa, setSkipDa] = useState(false);
  const [stumm, setStumm] = useState(false);
  /** Der Browser verweigert den Start - dann muss ein Finger nachhelfen. */
  const [tippen, setTippen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fertigRef = useRef(false);

  // Nur einmal weiterschalten: "ended" und ein Fehler können zusammenfallen.
  const fertig = useCallback(() => {
    if (fertigRef.current) return;
    fertigRef.current = true;
    onFertig();
  }, [onFertig]);

  useEffect(() => {
    const skip = window.setTimeout(() => setSkipDa(true), SKIP_AB);
    return () => window.clearTimeout(skip);
  }, []);

  // Startversuch: erst mit Ton, sonst stumm - Hauptsache, das Bild läuft.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let laeuftNoch = true;

    void video.play().catch(() => {
      if (!laeuftNoch) return;
      video.muted = true;
      setStumm(true);
      void video.play().catch(() => {
        if (laeuftNoch) setTippen(true);
      });
    });

    const notausgang = window.setTimeout(() => {
      if (laeuftNoch && video.currentTime === 0) fertig();
    }, GEDULD);

    return () => {
      laeuftNoch = false;
      window.clearTimeout(notausgang);
      video.pause();
    };
  }, [quelle, fertig]);

  const vonHand = () => {
    const video = videoRef.current;
    if (!video) return;
    setTippen(false);
    video.muted = false;
    setStumm(false);
    void video.play().catch(() => setTippen(true));
  };

  return (
    <div className="video-szene">
      <video
        ref={videoRef}
        className="video-szene-bild"
        src={quelle}
        playsInline
        autoPlay
        preload="auto"
        onEnded={fertig}
        onError={fertig}
      />

      {tippen && (
        <button className="video-szene-start" onClick={vonHand}>
          ▶ Video starten
        </button>
      )}

      {stumm && !tippen && (
        <button className="knopf klein video-szene-ton" onClick={vonHand}>
          🔇 Ton an
        </button>
      )}

      {skipDa && (
        <button className="knopf klein video-szene-skip" onClick={fertig}>
          Überspringen ›
        </button>
      )}
    </div>
  );
}
