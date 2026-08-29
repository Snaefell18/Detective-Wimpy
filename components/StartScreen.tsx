"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Szene } from "./Bild";
import { alsStaedte } from "@/lib/csv";
import { useStammdaten } from "@/lib/stammdaten";

/** Der Startbildschirm ist das Titelbild - die Knöpfe liegen im Himmel darüber. */
export function StartScreen({
  onStart,
  onKampagnen,
  laedt,
  fehler,
}: {
  onStart: () => void;
  onKampagnen: () => void;
  laedt: boolean;
  fehler: string | null;
}) {
  const { charaktere, orte } = useStammdaten();
  const held = charaktere.find((c) => c.istDetektiv) ?? charaktere[0];
  const staedte = alsStaedte(orte);
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

        <button className="knopf glas" onClick={onKampagnen}>
          🗂 Kampagnen
        </button>

        <div className="start-zeile">
          <Link href="/admin" className="knopf klein glas" aria-label="Admin-Menü">
            ⚙︎ Admin
          </Link>
          <span className="start-info">
            {charaktere.length - 1} Verdächtige · {staedte.length} Städte
          </span>
        </div>

        {laedt && (
          <p className="start-laden">
            Wimpy sortiert die Akten … gleich geht es los.
          </p>
        )}

        {fehler && <p className="fehler">{fehler}</p>}
      </div>

      <p className="start-fuss">
        {held?.name}, {held?.tierart} · „Teilen → Zum Home-Bildschirm“ startet das
        Spiel im Vollbild.
      </p>
    </div>
  );
}
