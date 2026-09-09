"use client";

import { Bild } from "./Bild";
import type { Character } from "@/lib/types";
import type { Abdruecke } from "@/lib/useGame";

/**
 * Was das Fingerabdruckset zutage fördert.
 *
 * Der teuerste Fund im Spiel bekommt seinen eigenen Moment - aber ohne
 * Blitzen und Zucken: Die Folie legt sich auf, die Abdrücke treten hervor,
 * die Namen stehen darunter. Geschlossen wird von Hand, denn das hier will
 * man in Ruhe lesen; im Notizbuch steht es danach trotzdem noch einmal.
 */
export function AbdruckSchau({
  abdruecke,
  besetzung,
  onSchliessen,
}: {
  abdruecke: Abdruecke;
  besetzung: Character[];
  onSchliessen: () => void;
}) {
  const tiere = abdruecke.ids.map(
    (id, i) =>
      besetzung.find((c) => c.id === id) ?? {
        id,
        name: abdruecke.namen[i] ?? "?",
        bild: "",
      },
  );

  return (
    <div className="abdruck-schau einblenden" onPointerDown={onSchliessen}>
      <div className="abdruck-karte" onPointerDown={(e) => e.stopPropagation()}>
        <span className="intro-oberzeile">Fingerabdruckset</span>
        <h2>Am Tatort: {abdruecke.ortName}</h2>

        <div className="abdruck-reihe">
          {tiere.map((tier, i) => (
            <div key={`${tier.id}-${i}`} className="abdruck-tier">
              <div className="abdruck-folie">
                <Bild src={tier.bild} alt={tier.name} platzhalter={tier.name} sofort />
                {/* Die Papillarlinien liegen als Folie über dem Bild - reines
                    CSS, damit kein Bild nachgeladen werden muss. */}
                <i className="abdruck-linien" aria-hidden />
              </div>
              <strong>{tier.name}</strong>
            </div>
          ))}
        </div>

        <p className="fliesstext">
          {tiere.length > 1
            ? "Zwei Abdrücke, sonst nichts. Eines dieser beiden Tiere war es."
            : "Ein einziger Abdruck ist übrig geblieben."}
        </p>

        <button className="knopf aktion" onPointerDown={(e) => e.stopPropagation()} onClick={onSchliessen}>
          Notiert
        </button>
      </div>
    </div>
  );
}
