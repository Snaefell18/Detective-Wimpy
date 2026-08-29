"use client";

import { Bild } from "./Bild";
import { DETECTIVE } from "@/lib/characters";

export function StartScreen({
  onStart,
  laedt,
  fehler,
}: {
  onStart: () => void;
  laedt: boolean;
  fehler: string | null;
}) {
  return (
    <div className="start">
      <div className="start-held">
        <Bild src={DETECTIVE.bild} alt={DETECTIVE.name} platzhalter="Wimpy" />
      </div>

      <h1 className="start-titel">Detective Wimpy</h1>
      <p className="start-unter">
        Ein Bushbaby mit Lupe, sechs Orte, eine Handvoll Verdächtige - und immer
        genau einer, der lügt.
      </p>

      {fehler && <p className="fehler">{fehler}</p>}

      <button className="knopf gold" onClick={onStart} disabled={laedt}>
        {laedt ? "Der Fall wird ausgeheckt …" : "Neuen Fall starten"}
      </button>

      <p className="leise start-hinweis">
        Tipp: Über „Teilen → Zum Home-Bildschirm“ läuft das Spiel wie eine echte App
        im Vollbild.
      </p>
    </div>
  );
}
