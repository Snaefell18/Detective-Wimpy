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

      {/* Schmale Knöpfe: Das Titelbild soll so weit wie möglich frei bleiben. */}
      <div className="start-himmel" data-ohne-bild={ohneBild}>
        <button className="knopf aktion schmal" onClick={onStart} disabled={laedt}>
          {laedt ? "Wird ausgeheckt …" : "Neuer Fall"}
        </button>

        <button className="knopf glas schmal" onClick={onKampagnen}>
          🗂 Kampagnen
        </button>

        <span className="start-info">
          {charaktere.length - 1} Verdächtige · {staedte.length} Städte
        </span>

        {laedt && (
          <p className="start-laden">
            Wimpy sortiert die Akten … gleich geht es los.
          </p>
        )}

        {fehler && <p className="fehler">{fehler}</p>}
      </div>

      <div className="start-fuss">
        <Link href="/admin" className="knopf klein glas" aria-label="Admin-Menü">
          ⚙︎ Admin
        </Link>
      </div>
    </div>
  );
}
