"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { spiele } from "@/lib/introAudio";
import { wirkungVon, type Zubehoer } from "@/lib/zubehoer";

/**
 * Die Übergabe: Wimpy bekommt etwas geschenkt.
 *
 * Der Ablauf ist in drei Schritten erzählt - das Päckchen steht da, das Band
 * springt und der Deckel hebt sich, der Gegenstand steigt heraus und setzt
 * sich. Erst dann steht sein Name da; wer vorher tippt, überspringt.
 *
 * Bewusst ohne harte Lichtwechsel: Es soll ein warmer Moment sein, kein
 * Blitzgewitter. Was leuchtet, schwillt an und wieder ab.
 */
const AUFGEHEN = 900;
const STEHEN = 3600;

/** Feste Bahnen für das Band - so sieht es jedes Mal gleich gut aus. */
const SCHNIPSEL = Array.from({ length: 12 }, (_, i) => i);

export function GeschenkSchau({
  stueck,
  grund,
  onFertig,
}: {
  stueck: Zubehoer;
  /** Wofür es das gibt - steht klein über dem Päckchen. */
  grund: string;
  onFertig: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;
  const wirkung = wirkungVon(stueck.wirkung);

  useEffect(() => {
    void spiele("jubel");
    const auf = window.setTimeout(() => setOffen(true), AUFGEHEN);
    const weiter = window.setTimeout(() => fertigRef.current(), AUFGEHEN + STEHEN);
    return () => {
      window.clearTimeout(auf);
      window.clearTimeout(weiter);
    };
  }, []);

  return (
    <div className="geschenk" data-offen={offen} onPointerDown={() => fertigRef.current()}>
      <div className="geschenk-schein" aria-hidden="true" />

      <div className="geschenk-mitte">
        <span className="intro-oberzeile">{grund}</span>

        <div className="geschenk-buehne">
          {/* Das Päckchen: Boden, Deckel, Band - alles gebaut, kein Bild. */}
          <div className="geschenk-paket" aria-hidden="true">
            <span className="geschenk-deckel" />
            <span className="geschenk-boden" />
            <span className="geschenk-band" />
          </div>

          {/* Das Band zerspringt in Schnipsel, wenn der Deckel geht. */}
          <div className="geschenk-schnipsel" aria-hidden="true">
            {SCHNIPSEL.map((i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 31 + 12) % 88}%`,
                  animationDelay: `${AUFGEHEN / 1000 + ((i * 7) % 6) / 20}s`,
                  animationDuration: `${1.4 + ((i * 5) % 4) * 0.25}s`,
                }}
              />
            ))}
          </div>

          <div className="geschenk-stueck">
            <Bild src={stueck.bild} alt={stueck.name} platzhalter={stueck.name} sofort />
          </div>
        </div>

        <strong className="geschenk-name">{stueck.name}</strong>
        {wirkung && <p className="geschenk-wirkung">{wirkung.hinweis}</p>}
        <span className="lohn-hinweis">Liegt jetzt in deiner Tasche · Tippen zum Weitermachen</span>
      </div>
    </div>
  );
}
