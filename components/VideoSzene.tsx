"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ein Video, das bildschirmfüllend vor einem Erzählerteil läuft.
 *
 * Es füllt den ganzen Schirm - beim iPhone 16 Pro also 19,5:9. Was in einem
 * anderen Seitenverhältnis vorliegt, wird beschnitten statt mit Balken
 * versehen ("cover"); Wichtiges gehört deshalb in die Mitte des Bildes.
 *
 * Es beginnt und endet in Schwarz: Am Anfang blendet es auf, zum Schluss
 * blendet es ab - Bild und Ton zusammen. Ohne das würde ein Video mitten in
 * der Bewegung abgeschnitten und der nächste Bildschirm spränge einen an;
 * gerade am Anfang einer Saga oder vor einem Fall soll es weich übergehen.
 *
 * Danach geht es von allein weiter. Wer nicht warten will, tippt auf
 * "Überspringen"; auch dann wird abgeblendet, nur kürzer.
 *
 * Fehlt die Datei oder mag der Browser sie nicht, wird nicht gemeckert -
 * dann geht es sofort weiter, als hätte man nie ein Video hinterlegt.
 */

/** Ab wann man überspringen darf. */
const SKIP_AB = 1500;

/** Wie lange das Auf- und Abblenden dauert. */
const BLENDE = 900;
/** Beim Überspringen darf es schneller gehen - man will ja weiter. */
const BLENDE_KURZ = 320;

/** Kommt bis dahin kein einziges Bild, stimmt etwas nicht - weiter. */
const GEDULD = 8000;

/**
 * Wann und wie lange abgeblendet wird - als reine Rechnung, damit sie sich
 * prüfen lässt (tests/video.test.mjs).
 *
 * Gibt die Dauer der Blende zurück, sobald es Zeit ist, und sonst null. Bei
 * kurzen Videos wird die Blende gestutzt: Ein Zweisekünder soll nicht fast
 * eine Sekunde lang schwarz werden.
 */
export function blendeJetzt(
  zeit: number,
  dauer: number | undefined,
  voll = BLENDE,
): number | null {
  if (!Number.isFinite(dauer) || !dauer || dauer <= 0) return null;
  const blende = Math.min(voll, (dauer * 1000) / 3);
  return (dauer - zeit) * 1000 <= blende ? blende : null;
}

export function VideoSzene({ quelle, onFertig }: { quelle: string; onFertig: () => void }) {
  const [skipDa, setSkipDa] = useState(false);
  const [stumm, setStumm] = useState(false);
  /** Der Browser verweigert den Start - dann muss ein Finger nachhelfen. */
  const [tippen, setTippen] = useState(false);
  /** Der schwarze Vorhang: liegt am Anfang davor und kommt am Ende zurück. */
  const [vorhang, setVorhang] = useState(true);
  const [blendeDauer, setBlendeDauer] = useState(BLENDE);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fertigRef = useRef(false);
  const abblendRef = useRef(false);

  // Nur einmal weiterschalten: "ended" und ein Fehler können zusammenfallen.
  const fertig = useCallback(() => {
    if (fertigRef.current) return;
    fertigRef.current = true;
    onFertig();
  }, [onFertig]);

  /**
   * Abblenden und danach weiter.
   *
   * Der Ton geht mit: Ein Video, das stumm wird, während das Bild noch steht,
   * klingt nach Abbruch. Ist die Blende durch, wird weitergeschaltet - auch
   * wenn das Video noch ein paar Bilder übrig hätte.
   */
  const abblenden = useCallback(
    (dauer: number) => {
      if (abblendRef.current || fertigRef.current) return;
      abblendRef.current = true;
      setBlendeDauer(dauer);
      setVorhang(true);

      const video = videoRef.current;
      if (video) {
        const start = video.volume;
        const beginn = performance.now();
        const leiser = window.setInterval(() => {
          const anteil = Math.min(1, (performance.now() - beginn) / dauer);
          video.volume = Math.max(0, start * (1 - anteil));
          if (anteil >= 1) window.clearInterval(leiser);
        }, 40);
      }

      window.setTimeout(fertig, dauer);
    },
    [fertig],
  );

  useEffect(() => {
    const skip = window.setTimeout(() => setSkipDa(true), SKIP_AB);
    // Aus Schwarz aufblenden, sobald das Bild steht.
    const auf = window.setTimeout(() => setVorhang(false), 60);
    return () => {
      window.clearTimeout(skip);
      window.clearTimeout(auf);
    };
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

    /*
     * Das Abblenden beginnt, bevor das Video zu Ende ist - sonst käme der
     * Vorhang erst, wenn schon nichts mehr zu sehen ist. Bei sehr kurzen
     * Videos wird die Blende entsprechend gestutzt.
     */
    const beobachten = () => {
      if (!laeuftNoch) return;
      const blende = blendeJetzt(video.currentTime, video.duration);
      if (blende !== null) abblenden(blende);
    };
    video.addEventListener("timeupdate", beobachten);

    return () => {
      laeuftNoch = false;
      window.clearTimeout(notausgang);
      video.removeEventListener("timeupdate", beobachten);
      video.pause();
    };
  }, [quelle, fertig, abblenden]);

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
        // Läuft schon eine Blende, schaltet deren Wecker weiter - sonst
        // würde "ended" mitten im Abblenden hart umschalten.
        onEnded={() => {
          if (!abblendRef.current) fertig();
        }}
        onError={fertig}
      />

      {/* Der Vorhang liegt über allem außer den Knöpfen. */}
      <div
        className="video-szene-blende"
        data-zu={vorhang}
        style={{ transitionDuration: `${blendeDauer}ms` }}
        aria-hidden
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
        <button
          className="knopf klein video-szene-skip"
          onClick={() => abblenden(BLENDE_KURZ)}
        >
          Überspringen ›
        </button>
      )}
    </div>
  );
}
