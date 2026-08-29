"use client";

import { useEffect, useState } from "react";
import { Bild } from "./Bild";
import { ladeKampagnen } from "@/lib/db";
import type { Kampagne } from "@/lib/types";

/** Auswahl der vorgenerierten Fälle aus der Datenbank. */
export function KampagnenListe({
  onStarten,
  onSchliessen,
}: {
  onStarten: (kampagne: Kampagne) => void;
  onSchliessen: () => void;
}) {
  const [kampagnen, setKampagnen] = useState<Kampagne[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void ladeKampagnen()
      .then(({ daten, ausCache }) => {
        setKampagnen(daten);
        if (ausCache && daten.length === 0) {
          setFehler("Keine Verbindung zur Datenbank - Kampagnen sind gerade nicht abrufbar.");
        }
      })
      .catch(() => {
        setFehler("Die Kampagnen konnten nicht geladen werden.");
        setKampagnen([]);
      });
  }, []);

  return (
    <div className="overlay einblenden">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div>
          <h1>Kampagnen</h1>
          <p className="unterzeile">Vorbereitete Fälle - starten sofort</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {fehler && <p className="fehler">{fehler}</p>}

          {kampagnen === null && <p className="leise">Wird geladen …</p>}

          {kampagnen?.length === 0 && !fehler && (
            <p className="leise">
              Noch keine Kampagnen vorhanden. Im Admin-Menü unter „Kampagnen“
              lassen sich Fälle vorbereiten - sie starten dann ohne Wartezeit.
            </p>
          )}

          {kampagnen?.map((k) => (
            <button key={k.id} className="kampagne" onClick={() => onStarten(k)}>
              <div className="kampagne-bild">
                <Bild
                  src={k.fall.orte[0]?.bild}
                  alt={k.fall.stadt}
                  platzhalter={k.fall.stadt}
                />
              </div>
              <div className="kampagne-text">
                <strong>{k.name || k.fall.titel}</strong>
                <span className="leise klein">
                  {k.fall.stadt} · {k.fall.besetzung.length - 1} Verdächtige ·{" "}
                  {k.fall.orte.length} Orte
                </span>
                <p className="kampagne-anriss">{k.fall.tatbeschreibung}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
