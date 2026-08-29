"use client";

import { useState } from "react";
import { Bild } from "./Bild";
import type { Character } from "@/lib/types";

export function BeschuldigenOverlay({
  besetzung,
  verdacht,
  onBestaetigen,
  onSchliessen,
  laedt,
  fehler,
  versucheUebrig,
}: {
  besetzung: Character[];
  verdacht: Record<string, number>;
  onBestaetigen: (charakterId: string, begruendung: string) => void;
  onSchliessen: () => void;
  laedt: boolean;
  fehler: string | null;
  versucheUebrig: number;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [begruendung, setBegruendung] = useState("");

  return (
    <div className="overlay einblenden">
      <div className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ✕
        </button>
        <div>
          <h1>Wer war es?</h1>
          <p className="unterzeile">
            {versucheUebrig} Versuch{versucheUebrig === 1 ? "" : "e"} übrig
          </p>
        </div>
      </div>

      <div className="scroll">
        <div className="inhalt">
          <div className="wahl-gitter">
            {besetzung
              .filter((c) => !c.istDetektiv)
              .map((c) => (
                <button
                  key={c.id}
                  className="wahl-kachel"
                  data-aktiv={gewaehlt === c.id}
                  onClick={() => setGewaehlt(c.id)}
                >
                  <div className="wahl-bild">
                    <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
                  </div>
                  <strong>{c.name}</strong>
                  <span className="leise klein">Verdacht {verdacht[c.id] ?? 0}%</span>
                </button>
              ))}
          </div>

          <label className="feld">
            <span className="leise">Wimpys Begründung (optional)</span>
            <textarea
              value={begruendung}
              onChange={(e) => setBegruendung(e.target.value)}
              placeholder="Der Fußabdruck war viel zu groß für …"
              rows={3}
              maxLength={300}
            />
          </label>

          {fehler && <p className="fehler">{fehler}</p>}

          <button
            className="knopf rot"
            disabled={!gewaehlt || laedt}
            onClick={() => gewaehlt && onBestaetigen(gewaehlt, begruendung)}
          >
            {laedt ? "Wimpy holt tief Luft …" : "Beschuldigung aussprechen"}
          </button>
        </div>
      </div>
    </div>
  );
}
