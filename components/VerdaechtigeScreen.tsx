"use client";

import { Bild } from "./Bild";
import { SUSPECTS } from "@/lib/characters";
import { getLocation } from "@/lib/locations";
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
  return (
    <div className="inhalt einblenden">
      <div className="karte">
        <h2>{fall.titel}</h2>
        <p className="leise" style={{ margin: 0 }}>
          {fall.tatbeschreibung}
        </p>
      </div>

      {SUSPECTS.map((c) => {
        const punkte = verdacht[c.id] ?? 0;
        const ort = getLocation(fall.aufenthalt[c.id] ?? "");
        return (
          <div key={c.id} className="karte verdaechtig">
            <button className="verdaechtig-kopf" onClick={() => onCharakter(c.id)}>
              <div className="charakter-bild gross">
                <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
              </div>
              <div className="verdaechtig-info">
                <strong>
                  {c.name} <span className="leise">· {c.tierart}, {c.alter} J.</span>
                </strong>
                <span className="leise">{ort ? `zuletzt: ${ort.name}` : ""}</span>
                <div className="verdacht-balken" aria-label={`Verdacht ${punkte} von 100`}>
                  <span style={{ width: `${punkte}%` }} />
                </div>
                <span className="leise" style={{ fontSize: 12 }}>
                  Verdacht {punkte}%
                </span>
              </div>
            </button>

            <p className="leise" style={{ marginBottom: 10 }}>
              {c.beschreibung}
            </p>

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
        );
      })}

      <button className="knopf rot" onClick={onBeschuldigen}>
        ⚖️ Fall auflösen ({beschuldigungenUebrig} Versuch
        {beschuldigungenUebrig === 1 ? "" : "e"} übrig)
      </button>
    </div>
  );
}
