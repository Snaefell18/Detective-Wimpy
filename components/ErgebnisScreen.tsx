"use client";

import { Bild } from "./Bild";
import { getCharacter } from "@/lib/characters";
import type { Ergebnis } from "@/lib/useGame";

export function ErgebnisScreen({
  ergebnis,
  onNeuerFall,
  laedt,
}: {
  ergebnis: Ergebnis;
  onNeuerFall: () => void;
  laedt: boolean;
}) {
  const taeter = getCharacter(ergebnis.taeterId);

  return (
    <div className="scroll">
      <div className="inhalt einblenden" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="ergebnis-titel" data-richtig={ergebnis.richtig}>
          {ergebnis.richtig ? "Fall gelöst!" : "Daneben!"}
        </h1>

        <div className="taeter-bild">
          <Bild src={taeter?.bild} alt={taeter?.name ?? ""} platzhalter={taeter?.name} />
        </div>

        <p className="ergebnis-name">
          Der Täter war <strong>{taeter?.name}</strong> ({taeter?.tierart})
        </p>

        <div className="karte">
          <h2>Die Auflösung</h2>
          <p style={{ margin: 0 }}>{ergebnis.aufloesung}</p>
        </div>

        <div className="karte">
          <h2>{getCharacter(ergebnis.beschuldigtId)?.name} sagt</h2>
          <p style={{ margin: 0, fontStyle: "italic" }}>„{ergebnis.reaktion}“</p>
        </div>

        <button className="knopf aktion" onClick={onNeuerFall} disabled={laedt}>
          {laedt ? "Neuer Fall wird ausgeheckt …" : "Nächster Fall"}
        </button>
      </div>
    </div>
  );
}
