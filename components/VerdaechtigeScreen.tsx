"use client";

import { Bild } from "./Bild";
import { findeOrt } from "@/lib/locations";
import type { ChatTurn, NotebookEntry, PublicCase } from "@/lib/types";

const STAT_LABELS: Record<string, string> = {
  charisma: "Charisma",
  freundlichkeit: "Freundlich",
  fitness: "Fitness",
  zauberkraft: "Zauber",
  schelmischkeit: "Schelm",
  kriminalitaetslevel: "Kriminell",
  intelligenz: "Klugheit",
};

/**
 * Die Tierakte: Sie führt nur die Verdächtigen, mit denen Wimpy schon
 * gesprochen hat - wen man noch nie getroffen hat, über den weiß man auch
 * nichts. Gezeigt werden die Werte und die Hinweise, die es zu dieser Person
 * gibt; der Fall selbst steht im Notizbuch.
 */
export function VerdaechtigeScreen({
  fall,
  verdacht,
  verlauf,
  notizen,
  onCharakter,
  onBeschuldigen,
  beschuldigungenUebrig,
}: {
  fall: PublicCase;
  verdacht: Record<string, number>;
  verlauf: Record<string, ChatTurn[]>;
  notizen: NotebookEntry[];
  onCharakter: (id: string) => void;
  onBeschuldigen: () => void;
  beschuldigungenUebrig: number;
}) {
  const bekannt = fall.besetzung.filter(
    (c) => !c.istDetektiv && (verlauf[c.id]?.length ?? 0) > 0,
  );

  return (
    <div className="inhalt einblenden">
      {bekannt.length === 0 && (
        <p className="leise">
          Noch niemand befragt. Wer Wimpy an den Schauplätzen über den Weg läuft
          und mit ihm spricht, landet hier in der Akte.
        </p>
      )}

      {bekannt.map((c) => {
        const punkte = verdacht[c.id] ?? 0;
        const ort = findeOrt(fall.orte, fall.aufenthalt[c.id] ?? "");
        const hinweise = notizen.filter((n) => n.quelle === c.id);
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

              <div
                className="verdacht-balken"
                data-hoch={punkte > 60}
                aria-label={`Verdacht ${punkte} von 100`}
              >
                <span style={{ width: `${punkte}%` }} />
              </div>
              <span className="leise klein">
                Verdacht {punkte}% {ort ? `· zuletzt ${ort.name}` : ""}
              </span>

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

              {hinweise.length > 0 && (
                <ul className="dossier-hinweise">
                  {hinweise.map((n) => (
                    <li key={n.id}>{n.text}</li>
                  ))}
                </ul>
              )}
            </div>
          </button>
        );
      })}

      <button className="knopf aktion" onClick={onBeschuldigen}>
        Fall auflösen ({beschuldigungenUebrig} Versuch
        {beschuldigungenUebrig === 1 ? "" : "e"} übrig)
      </button>
    </div>
  );
}
