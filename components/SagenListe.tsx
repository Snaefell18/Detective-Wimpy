"use client";

import { useEffect, useState } from "react";
import { Bild } from "./Bild";
import { ladeSagas } from "@/lib/db";
import type { Saga } from "@/lib/sagaTypen";

/** Auswahl der vorbereiteten Sagas aus der Datenbank. */
export function SagenListe({
  onStarten,
  onSchliessen,
  laufend,
}: {
  onStarten: (saga: Saga, vonVorn: boolean) => void;
  onSchliessen: () => void;
  /** Id einer angefangenen Saga und wie weit sie ist. */
  laufend?: { sagaId: string; kapitel: number } | null;
}) {
  const [sagas, setSagas] = useState<Saga[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void ladeSagas()
      .then(({ daten, ausCache }) => {
        setSagas(daten);
        if (ausCache && daten.length === 0) {
          setFehler("Keine Verbindung zur Datenbank - Sagas sind gerade nicht abrufbar.");
        }
      })
      .catch(() => {
        setFehler("Die Sagas konnten nicht geladen werden.");
        setSagas([]);
      });
  }, []);

  return (
    <div className="overlay einblenden">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div>
          <h1>Sagas</h1>
          <p className="unterzeile">Mehrere Fälle, ein großes Geheimnis</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {fehler && <p className="fehler">{fehler}</p>}

          {sagas === null && <p className="leise">Wird geladen …</p>}

          {sagas?.length === 0 && !fehler && (
            <p className="leise">
              Noch keine Sagas vorhanden. Im Admin-Menü unter „Sagas“ lassen
              sich welche vorbereiten.
            </p>
          )}

          {sagas?.map((saga) => {
            const weiter = laufend?.sagaId === saga.id ? laufend.kapitel : null;
            return (
              <div key={saga.id} className="kampagne saga-eintrag">
                <div className="kampagne-bild">
                  <Bild
                    src={saga.kapitel[0]?.fall?.orte[0]?.bild}
                    alt={saga.name}
                    platzhalter={saga.name}
                  />
                </div>
                <div className="kampagne-text">
                  <strong>{saga.name}</strong>
                  <span className="leise klein">
                    {saga.kapitel.length} Kapitel · Finale
                    {weiter !== null ? ` · angefangen bei Kapitel ${weiter + 1}` : ""}
                  </span>
                  <p className="kampagne-anriss">{saga.klappentext}</p>

                  <div className="saga-knoepfe">
                    {weiter !== null && (
                      <button
                        className="knopf klein aktion"
                        onClick={() => onStarten(saga, false)}
                      >
                        ▶ Weiterspielen
                      </button>
                    )}
                    <button
                      className="knopf klein glas"
                      onClick={() => onStarten(saga, true)}
                    >
                      {weiter !== null ? "Von vorn" : "Saga beginnen"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
