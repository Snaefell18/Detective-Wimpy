"use client";

import { useState } from "react";
import { Bild } from "./Bild";
import { mittelAusFund, tascheVoll, TASCHE_MAX, type Beweismittel } from "@/lib/beweismittel";
import type { Fund } from "@/lib/useGame";

/**
 * Der Moment, in dem Wimpy etwas findet - und die Frage, was damit geschieht.
 *
 * Bewusst als Einblendung über dem Ort, nicht als eigener Bildschirm: Der
 * Fund soll einen Schlag bekommen, aber niemanden aus dem Spiel reißen. Er
 * kommt wie eine Tatortaufnahme - Blitz, Gegenstand, ein Satz.
 *
 * Und dann steht die Entscheidung: In die Beweismitteltasche, oder liegen
 * lassen? In die Tasche passen sechs Stücke, sie gilt für die ganze Saga,
 * und vor Gericht zählt nur, was darin liegt. Ist sie voll, muss etwas
 * weichen - das fragt der zweite Schritt, denn still etwas wegzuwerfen wäre
 * das Letzte, was man will.
 *
 * Der Text bleibt danach im Notizbuch stehen, auch wenn man das Stück liegen
 * lässt: Gesehen hat Wimpy es ja.
 */
export function FundMoment({
  fund,
  herkunft,
  inhalt,
  onAufnehmen,
  onFertig,
}: {
  fund: Fund;
  /** Woher das Stück stammt: "Kapitel 2 · Am Hafen". */
  herkunft: string;
  /** Was schon in der Tasche liegt. */
  inhalt: Beweismittel[];
  /** Aufnehmen - `statt` ist das Stück, das dafür weggeworfen wird. */
  onAufnehmen: (mittel: Beweismittel, statt?: string) => void;
  /** Der Moment ist vorbei: liegen gelassen oder aufgenommen. */
  onFertig: () => void;
}) {
  const spur = fund.spur;
  const [zu, setZu] = useState(false);
  /** Zweiter Schritt: Die Tasche ist voll, etwas muss weichen. */
  const [tauschen, setTauschen] = useState(false);

  if (!spur) return null;

  const voll = tascheVoll(inhalt);
  const mittel = mittelAusFund(spur, herkunft);

  const nehmen = (statt?: string) => {
    onAufnehmen(mittel, statt);
    setZu(true);
    onFertig();
  };

  const lassen = () => {
    setZu(true);
    onFertig();
  };

  return (
    <div className="fund-moment" data-zu={zu} data-frage="true">
      <div className="fund-blitz" />

      <div className="fund-karte">
        <div className="fund-bild">
          <Bild src={spur.bild} alt={spur.name} platzhalter={spur.name} groesse="180px" sofort />
        </div>

        <div className="fund-text">
          <span className="intro-oberzeile">Gefunden</span>
          <strong>{spur.name}</strong>
          <p>{spur.beobachtung}</p>
          {spur.vermutung && <p className="fund-murmel">„{spur.vermutung}“</p>}
        </div>

        {/* Erster Schritt: mitnehmen oder liegen lassen. */}
        {!tauschen && (
          <div className="fund-frage">
            <p className="leise klein">
              In die Beweismitteltasche? Nur was darin liegt, kannst du am Ende
              vor Gericht vorlegen. ({inhalt.length}/{TASCHE_MAX})
            </p>
            <div className="fund-knoepfe">
              <button
                className="knopf aktion klein"
                onClick={() => (voll ? setTauschen(true) : nehmen())}
              >
                {voll ? "Platz machen ›" : "Mitnehmen"}
              </button>
              <button className="knopf klein" onClick={lassen}>
                Liegen lassen
              </button>
            </div>
          </div>
        )}

        {/* Zweiter Schritt: Was fliegt dafür raus? */}
        {tauschen && (
          <div className="fund-frage">
            <p className="leise klein">
              Die Tasche ist voll. Was wirfst du weg, um {spur.name} mitzunehmen?
            </p>
            <div className="fund-tausch">
              {inhalt.map((alt) => (
                <button key={alt.id} className="fund-tausch-stueck" onClick={() => nehmen(alt.id)}>
                  <div className="fund-tausch-bild">
                    <Bild src={alt.bild} alt={alt.name} platzhalter={alt.name} />
                  </div>
                  <span className="fund-tausch-text">
                    <strong>{alt.name}</strong>
                    <span className="leise klein">{alt.herkunft}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="fund-knoepfe">
              <button className="knopf klein" onClick={lassen}>
                Nichts tauschen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
