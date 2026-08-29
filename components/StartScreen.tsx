"use client";

import Link from "next/link";
import { Bild } from "./Bild";
import { aktuelleCharaktere, useAdmin } from "@/lib/adminStore";

export function StartScreen({
  onStart,
  laedt,
  fehler,
}: {
  onStart: () => void;
  laedt: boolean;
  fehler: string | null;
}) {
  const { daten } = useAdmin();
  const besetzung = aktuelleCharaktere(daten);
  const held = besetzung.find((c) => c.istDetektiv) ?? besetzung[0];
  const verdaechtige = besetzung.length - 1;

  return (
    <div className="start">
      <Link href="/admin" className="admin-knopf" aria-label="Admin-Menü">
        ⚙︎
      </Link>

      <div className="start-held">
        <Bild src={held.bild} alt={held.name} platzhalter={held.name} />
      </div>

      <h1 className="start-titel">Detective {held.name}</h1>
      <p className="start-unter">
        Ein {held.tierart} mit Lupe, sechs Orte, {verdaechtige} Verdächtige - und
        immer genau einer, der lügt.
      </p>

      {fehler && <p className="fehler">{fehler}</p>}

      <button className="knopf aktion" onClick={onStart} disabled={laedt}>
        {laedt ? "Der Fall wird ausgeheckt …" : "Neuen Fall starten"}
      </button>

      <p className="leise start-hinweis">
        Tipp: Über „Teilen → Zum Home-Bildschirm“ läuft das Spiel wie eine echte App
        im Vollbild.
      </p>
    </div>
  );
}
