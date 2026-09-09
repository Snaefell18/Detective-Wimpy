"use client";

import { useEffect, useRef, useState } from "react";
import { spiele } from "@/lib/introAudio";
import { yen } from "@/lib/zubehoer";

/**
 * Die Auszahlung: Wimpy bekommt seinen Lohn.
 *
 * Der Betrag zählt sich hoch, während Münzen ins Bild fallen und der Beutel
 * kurz aufgeht - der Moment, auf den ein gelöster Fall zuläuft. Bewusst kurz
 * und ohne harte Lichtwechsel: Es soll gut tun, nicht blenden.
 */
const DAUER = 1600;
const NACHHALL = 1400;

/** Feste Bahnen für die Münzen - dann sieht es jedes Mal gleich gut aus. */
const MUENZEN = Array.from({ length: 14 }, (_, i) => i);

export function LohnSchau({
  betrag,
  grund,
  /** Was im Beutel ist, nachdem alles gezählt wurde. */
  gesamt,
  onFertig,
}: {
  betrag: number;
  grund: string;
  gesamt: number;
  onFertig: () => void;
}) {
  const [gezaehlt, setGezaehlt] = useState(0);
  const [fertig, setFertig] = useState(false);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  useEffect(() => {
    void spiele("jubel");
    const start = performance.now();
    let bild = 0;

    const takt = () => {
      const anteil = Math.min(1, (performance.now() - start) / DAUER);
      // Am Anfang schnell, am Ende langsam - das fühlt sich nach Ankommen an.
      const weich = 1 - Math.pow(1 - anteil, 3);
      setGezaehlt(Math.round(betrag * weich));
      if (anteil < 1) bild = requestAnimationFrame(takt);
      else setFertig(true);
    };
    bild = requestAnimationFrame(takt);

    const weiter = window.setTimeout(() => fertigRef.current(), DAUER + NACHHALL);
    return () => {
      cancelAnimationFrame(bild);
      window.clearTimeout(weiter);
    };
  }, [betrag]);

  return (
    <div className="lohn" onPointerDown={() => fertigRef.current()}>
      <div className="lohn-strahlen" aria-hidden="true" />

      <div className="lohn-muenzen" aria-hidden="true">
        {MUENZEN.map((i) => (
          <span
            key={i}
            style={{
              left: `${(i * 29 + 9) % 92}%`,
              animationDelay: `${((i * 11) % 30) / 30}s`,
              animationDuration: `${1.1 + ((i * 7) % 5) * 0.18}s`,
            }}
          >
            ¥
          </span>
        ))}
      </div>

      <div className="lohn-mitte">
        <span className="intro-oberzeile">{grund}</span>
        <strong className="lohn-betrag" data-fertig={fertig}>
          + {yen(gezaehlt)}
        </strong>
        <span className="lohn-beutel">Im Beutel: {yen(gesamt)}</span>
        <span className="lohn-hinweis">Tippen zum Weitermachen</span>
      </div>
    </div>
  );
}
