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
  onSagas,
  onFortsetzen,
  laufenderFall,
  laedt,
  schritt,
  fehler,
}: {
  onStart: () => void;
  onKampagnen: () => void;
  onSagas: () => void;
  /** Nur gesetzt, wenn ein pausierter Fall wartet. */
  onFortsetzen?: () => void;
  laufenderFall?: string;
  laedt: boolean;
  /** Woran gerade gebaut wird - der Fall entsteht in drei Schritten. */
  schritt?: string | null;
  fehler: string | null;
}) {
  const { charaktere, orte } = useStammdaten();
  const staedte = alsStaedte(orte);
  const [ohneBild, setOhneBild] = useState(false);
  const merken = useCallback((leer: boolean) => setOhneBild(leer), []);

  return (
    <div className="start">
      <Szene
        src="/start_neu.png"
        alt="Detektiv Wimpy"
        platzhalter=""
        variante="titel"
        onLeer={merken}
      />

      {/* Im Noir trägt der Schriftzug den Screen immer; im Klassisch nur,
          solange kein Titelbild hinterlegt ist (per CSS gesteuert). */}
      <span className="start-marke">{laufenderFall ? "Fall pausiert" : "Ein Fall wartet"}</span>

      <h1 className="start-logo" data-ohne-bild={ohneBild}>
        Detektiv
        <span>Wimpy</span>
      </h1>

      {/* Schmale Knöpfe: Das Titelbild soll so weit wie möglich frei bleiben. */}
      <div className="start-himmel" data-ohne-bild={ohneBild}>
        <button className="knopf aktion schmal" onClick={onStart} disabled={laedt}>
          <span className="zeilen-text">{laedt ? "Wird ausgeheckt …" : "Neuer Fall"}</span>
          <span className="zeilen-meta">{laedt ? (schritt ?? "…") : "Start"}</span>
        </button>

        {onFortsetzen && (
          <button className="knopf glas schmal" onClick={onFortsetzen}>
            <span className="symbol">▶</span>
            <span className="zeilen-text">Fortsetzen</span>
            <span className="zeilen-meta">{laufenderFall ?? ""}</span>
          </button>
        )}

        <button className="knopf glas schmal" onClick={onKampagnen}>
          <span className="symbol">🗂</span>
          <span className="zeilen-text">Kampagnen</span>
        </button>

        <button className="knopf glas schmal" onClick={onSagas}>
          <span className="symbol">📖</span>
          <span className="zeilen-text">Sagas</span>
        </button>

        <span className="start-info">
          {laufenderFall
            ? `Pausiert: ${laufenderFall}`
            : `${charaktere.length - 1} Verdächtige · ${staedte.length} Städte`}
        </span>

        {laedt && (
          <p className="start-laden">{schritt ?? "Wimpy sortiert die Akten …"}</p>
        )}

        {fehler && <p className="fehler">{fehler}</p>}
      </div>

      <div className="start-fuss">
        <Link href="/admin" className="knopf klein glas" aria-label="Admin-Menü">
            <span className="symbol">⚙︎</span>
            <span className="zeilen-text">Admin</span>
          </Link>
      </div>
    </div>
  );
}
