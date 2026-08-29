"use client";

import { Bild } from "./Bild";
import { findeOrt } from "@/lib/locations";
import type { PublicCase } from "@/lib/types";

const STAT_LABELS: Record<string, string> = {
  charisma: "Charisma",
  freundlichkeit: "Freundlich",
  fitness: "Fitness",
  zauberkraft: "Zauber",
  schelmischkeit: "Schelm",
  kriminalitaetslevel: "Kriminell",
  intelligenz: "Klugheit",
};

export function VerdaechtigeScreen({
  fall,
  verdacht,
  onCharakter,
  onBeschuldigen,
  beschuldigungenUebrig,
}: {
  fall: PublicCase;
  verdacht: Record<string, number>;
  onCharakter: (id: string) => void;
  onBeschuldigen: () => void;
  beschuldigungenUebrig: number;
}) {
  const verdaechtige = fall.besetzung.filter((c) => !c.istDetektiv);

  return (
    <div className="inhalt einblenden">
      <p className="fall-text">{fall.tatbeschreibung}</p>

      {verdaechtige.map((c) => {
        const punkte = verdacht[c.id] ?? 0;
        const ort = findeOrt(fall.orte, fall.aufenthalt[c.id] ?? "");
        return (
          <button key={c.id} className="dossier" onClick={() => onCharakter(c.id)}>
            <div className="dossier-bild">
              <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
            </div>

            <div className="dossier-text">
              <div className="dossier-kopf">
                <strong>{c.name}</strong>
                <span className="leise">
                  {c.tierart}, {c.alter} J.
                </span>
              </div>

              <div className="verdacht-balken" aria-label={`Verdacht ${punkte} von 100`}>
                <span style={{ width: `${punkte}%` }} />
              </div>
              <span className="leise klein">
                Verdacht {punkte}% {ort ? `· zuletzt ${ort.name}` : ""}
              </span>

              <p className="dossier-beschreibung">{c.beschreibung}</p>

              <div className="stats">
                {Object.entries(c.stats).map(([key, wert]) => (
                  <div key={key} className="stat">
                    <span className="stat-label">{STAT_LABELS[key] ?? key}</span>
                    <div className="stat-balken">
                      <span style={{ width: `${wert * 10}%` }} />
                    </div>
                    <span className="stat-wert">{wert}</span>
                  </div>
                ))}
              </div>
            </div>
          </button>
        );
      })}

      <button className="knopf rot" onClick={onBeschuldigen}>
        ⚖️ Fall auflösen ({beschuldigungenUebrig} Versuch
        {beschuldigungenUebrig === 1 ? "" : "e"} übrig)
      </button>
    </div>
  );
}
