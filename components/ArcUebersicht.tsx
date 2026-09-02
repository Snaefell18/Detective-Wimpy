"use client";

import { useEffect, useState } from "react";
import { Bild } from "./Bild";
import {
  finaleOffen,
  naechsterTeil,
  teilStand,
  type Arc,
  type ArcLauf,
} from "@/lib/arcTypen";
import { ladeSagas } from "@/lib/db";
import type { Saga } from "@/lib/sagaTypen";

/**
 * Die Drehscheibe eines Arcs: alle Sagen untereinander.
 *
 * Man sieht auf einen Blick, was geschafft ist, was als Nächstes ansteht und
 * was noch kommt. Starten lässt sich immer nur die nächste offene Station -
 * die Reihenfolge ist die Geschichte, und ein Arc, den man von hinten
 * aufrollt, erzählt sie kaputt. Was noch nicht erzeugt wurde, steht als
 * "wird noch vorbereitet" da; der Arc darf schließlich weiterwachsen, während
 * gespielt wird.
 *
 * Hierher kommt man nach jeder Saga zurück - und auch aus einer pausierten:
 * Dann heißt der Knopf "Weiterspielen".
 */
export function ArcUebersicht({
  arc,
  lauf,
  pausiert,
  onStarten,
  onFinale,
  onSchliessen,
}: {
  arc: Arc;
  lauf: ArcLauf;
  /** Nummer der Station, deren Fall gerade pausiert herumliegt. */
  pausiert: number | null;
  onStarten: (index: number) => void;
  onFinale: () => void;
  onSchliessen: () => void;
}) {
  const [sagas, setSagas] = useState<Saga[]>([]);

  useEffect(() => {
    void ladeSagas()
      .then(({ daten }) => setSagas(daten))
      .catch(() => setSagas([]));
  }, []);

  const dran = naechsterTeil(arc, lauf.geschafft);
  const finale = finaleOffen(arc, lauf.geschafft);

  return (
    <div className="overlay einblenden arc-uebersicht">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{arc.name}</h1>
          <p className="unterzeile">
            {lauf.geschafft.length} von {arc.teile.length} Sagen ·{" "}
            {finale ? "Finale" : "Fortsetzung folgt"}
          </p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {arc.teile.map((teil, i) => {
            const stand = teilStand(arc, lauf.geschafft, i);
            const saga = sagas.find((s) => s.id === teil.sagaId);
            const wartetAufFortsetzung = pausiert === teil.nummer;

            return (
              <div key={teil.nummer} className="arc-station" data-stand={stand}>
                <div className="arc-station-marke">
                  <span className="arc-station-nummer">{teil.nummer}</span>
                  <span className="arc-station-haken">
                    {stand === "geschafft" ? "✓" : stand === "gesperrt" ? "·" : "▸"}
                  </span>
                </div>

                <div className="arc-station-bild">
                  <Bild
                    src={stand === "gesperrt" ? undefined : saga?.kapitel[0]?.fall?.orte[0]?.bild}
                    alt={teil.name}
                    platzhalter={String(teil.nummer)}
                  />
                </div>

                <div className="arc-station-text">
                  <strong>{teil.name}</strong>
                  <span className="leise klein">
                    {stand === "geschafft"
                      ? `Abgeschlossen${saga ? ` · ${saga.name}` : ""}`
                      : stand === "dran"
                        ? saga
                          ? `${saga.kapitel.length} Kapitel · Finale`
                          : "Bereit"
                        : stand === "wartet"
                          ? "Wird noch vorbereitet"
                          : "Später"}
                  </span>

                  {stand === "dran" && (
                    <button className="knopf klein aktion" onClick={() => onStarten(i)}>
                      {wartetAufFortsetzung ? "▶ Weiterspielen" : "Saga beginnen"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Das Finale steht unter allem - erreichbar, wenn jede Saga durch ist. */}
          <div className="arc-station arc-station-finale" data-stand={finale ? "dran" : "gesperrt"}>
            <div className="arc-station-marke">
              <span className="arc-station-nummer">★</span>
              <span className="arc-station-haken">{finale ? "▸" : "·"}</span>
            </div>
            <div className="arc-station-text">
              <strong>Finale</strong>
              <span className="leise klein">
                {finale ? "Alles läuft zusammen" : "Erst, wenn alle Sagen durch sind"}
              </span>
              {finale && (
                <button className="knopf klein aktion" onClick={onFinale}>
                  Zum Finale
                </button>
              )}
            </div>
          </div>

          {dran !== null && !arc.teile[dran].sagaId && (
            <p className="leise klein">
              Der nächste Teil wird noch geschrieben. Schau später wieder rein -
              dein Fortschritt bleibt.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
