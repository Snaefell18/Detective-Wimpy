"use client";

import { useEffect } from "react";
import { Szene } from "./Bild";
import { spiele, stoppe } from "@/lib/introAudio";
import type { Character } from "@/lib/types";
import type { Ergebnis } from "@/lib/useGame";

export function ErgebnisScreen({
  ergebnis,
  besetzung,
  onNeuerFall,
  onHauptmenue,
  laedt,
}: {
  ergebnis: Ergebnis;
  besetzung: Character[];
  onNeuerFall: () => void;
  /** Zurück zum Startbildschirm, ohne gleich einen neuen Fall zu starten. */
  onHauptmenue: () => void;
  laedt: boolean;
}) {
  const taeter = besetzung.find((c) => c.id === ergebnis.taeterId);
  const beschuldigt = besetzung.find((c) => c.id === ergebnis.beschuldigtId);

  // Gelöster Fall: Siegermusik. Sie hört auf, wenn der Bildschirm verschwindet.
  useEffect(() => {
    if (ergebnis.richtig) void spiele("jubel");
    return () => stoppe();
  }, [ergebnis.richtig]);

  return (
    <div className="ergebnis">
      <Szene
        src={taeter?.bild}
        alt={taeter?.name ?? ""}
        platzhalter={taeter?.name}
        variante="portraet"
      />

      <div className="scroll">
        <div className="inhalt ergebnis-inhalt einblenden">
          <h1 className="ergebnis-titel" data-richtig={ergebnis.richtig}>
            {ergebnis.richtig ? "Fall gelöst!" : "Daneben!"}
          </h1>

          <p className="ergebnis-name">
            Der Täter war <strong>{taeter?.name}</strong> ({taeter?.tierart})
          </p>

          <h2 className="abschnitt">Die Auflösung</h2>
          <p className="fliesstext">{ergebnis.aufloesung}</p>

          <h2 className="abschnitt">{beschuldigt?.name} sagt</h2>
          <p className="fliesstext zitat">„{ergebnis.reaktion}“</p>

          <button className="knopf aktion" onClick={onNeuerFall} disabled={laedt}>
            {laedt ? "Neuer Fall wird ausgeheckt …" : "Nächster Fall"}
          </button>

          <button
            className="knopf dezent"
            style={{ marginTop: 10 }}
            onClick={onHauptmenue}
            disabled={laedt}
          >
            Zum Hauptmenü
          </button>
        </div>
      </div>
    </div>
  );
}
