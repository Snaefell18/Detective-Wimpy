"use client";

import { useEffect, useState } from "react";
import { Bild } from "./Bild";
import { fertigeTeile, spielbar, type Arc } from "@/lib/arcTypen";
import { istZugriffVerweigert, ladeArcs, ladeSagas } from "@/lib/db";
import type { Saga } from "@/lib/sagaTypen";

/**
 * Auswahl der Arcs - der langen Reihen aus mehreren Sagen.
 *
 * Ein Arc taucht hier auf, sobald seine erste Saga steht. Dass die späteren
 * Teile noch fehlen, ist ausdrücklich erlaubt: Sie dürfen nachwachsen,
 * während schon gespielt wird.
 */
export function ArcsListe({
  onStarten,
  onSchliessen,
  laufend,
}: {
  onStarten: (arc: Arc, vonVorn: boolean) => void;
  onSchliessen: () => void;
  /** Id eines angefangenen Arcs und wie weit er ist. */
  laufend?: { arcId: string; teil: number } | null;
}) {
  const [arcs, setArcs] = useState<Arc[] | null>(null);
  const [sagas, setSagas] = useState<Saga[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([ladeArcs(), ladeSagas()])
      .then(([a, s]) => {
        setArcs(a.daten);
        setSagas(s.daten);
        if (a.ausCache && a.daten.length === 0) {
          setFehler("Keine Verbindung zur Datenbank - Arcs sind gerade nicht abrufbar.");
        }
      })
      .catch((grund) => {
        setFehler(
          istZugriffVerweigert(grund)
            ? "Arcs sind in dieser Datenbank noch nicht freigeschaltet - die Firestore-Regeln aus dem Projekt müssen einmal neu veröffentlicht werden."
            : "Die Arcs konnten nicht geladen werden.",
        );
        setArcs([]);
      });
  }, []);

  return (
    <div className="overlay einblenden">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div>
          <h1>Arcs</h1>
          <p className="unterzeile">Mehrere Sagen, ein großer Bogen</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {fehler && <p className="fehler">{fehler}</p>}

          {arcs === null && <p className="leise">Wird geladen …</p>}

          {arcs?.length === 0 && !fehler && (
            <p className="leise">
              Noch keine Arcs vorhanden. Im Admin-Menü unter „Arcs“ lassen sich
              welche anlegen.
            </p>
          )}

          {arcs?.map((arc) => {
            const weiter = laufend?.arcId === arc.id ? laufend.teil : null;
            const bereit = spielbar(arc);
            const ersteSaga = sagas.find((s) => s.id === arc.teile[0]?.sagaId);
            return (
              <div key={arc.id} className="kampagne saga-eintrag">
                <div className="kampagne-bild">
                  <Bild
                    src={ersteSaga?.kapitel[0]?.fall?.orte[0]?.bild}
                    alt={arc.name}
                    platzhalter={arc.name}
                  />
                </div>
                <div className="kampagne-text">
                  <strong>{arc.name}</strong>
                  <span className="leise klein">
                    {fertigeTeile(arc)} von {arc.teile.length} Sagen
                    {weiter !== null ? ` · angefangen bei Teil ${weiter + 1}` : ""}
                  </span>
                  <p className="kampagne-anriss">{arc.klappentext}</p>

                  {!bereit && (
                    <p className="leise klein">
                      Der erste Teil wird noch vorbereitet.
                    </p>
                  )}

                  {bereit && (
                    <div className="saga-knoepfe">
                      {weiter !== null && (
                        <button
                          className="knopf klein aktion"
                          onClick={() => onStarten(arc, false)}
                        >
                          ▶ Weiterspielen
                        </button>
                      )}
                      <button
                        className="knopf klein glas"
                        onClick={() => onStarten(arc, true)}
                      >
                        {weiter !== null ? "Von vorn" : "Arc beginnen"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
