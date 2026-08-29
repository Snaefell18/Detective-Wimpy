"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Szene } from "./Bild";
import { aktuelleCharaktere, useAdmin } from "@/lib/adminStore";
import { aktuelleOrte } from "@/lib/adminStore";
import { alsStaedte } from "@/lib/csv";

/** Der Startbildschirm ist das Titelbild - die Knöpfe liegen im Himmel darüber. */
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
  const staedte = alsStaedte(aktuelleOrte(daten));
  const [ohneBild, setOhneBild] = useState(false);
  const merken = useCallback((leer: boolean) => setOhneBild(leer), []);

  return (
    <div className="start">
      <Szene
        src="/start.png"
        alt="Detektiv Wimpy"
        platzhalter=""
        variante="titel"
        onLeer={merken}
      />

      {/* Solange kein Titelbild hinterlegt ist, trägt der Schriftzug den Screen. */}
      {ohneBild && (
        <h1 className="start-logo">
          Detektiv
          <span>Wimpy</span>
        </h1>
      )}

      <div className="start-himmel" data-ohne-bild={ohneBild}>
        <button className="knopf aktion" onClick={onStart} disabled={laedt}>
          {laedt ? "Der Fall wird ausgeheckt …" : "Neuen Fall starten"}
        </button>

        <div className="start-zeile">
          <Link href="/admin" className="knopf klein glas" aria-label="Admin-Menü">
            ⚙︎ Admin
          </Link>
          <span className="start-info">
            {besetzung.length - 1} Verdächtige · {staedte.length} Städte
          </span>
        </div>

        {fehler && <p className="fehler">{fehler}</p>}
      </div>

      <p className="start-fuss">
        {held.name}, {held.tierart} · „Teilen → Zum Home-Bildschirm“ startet das Spiel im
        Vollbild.
      </p>
    </div>
  );
}
