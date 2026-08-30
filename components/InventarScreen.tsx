"use client";

import { useState } from "react";
import { Bild } from "./Bild";
import { useStammdaten } from "@/lib/stammdaten";
import type { Item, NotebookEntry } from "@/lib/types";

/**
 * Inventar: ausschließlich die Dinge, die Wimpy unterwegs wirklich
 * eingesammelt hat, mit dem, was er dazu notiert hat. Antippen zeigt die
 * Einzelheiten.
 */
export function InventarScreen({
  gefundeneSpuren,
  notizen,
}: {
  gefundeneSpuren: string[];
  notizen: NotebookEntry[];
}) {
  const { items } = useStammdaten();
  const [offen, setOffen] = useState<string | null>(null);

  const gefunden: Item[] = gefundeneSpuren
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));

  /** Die Fundnotiz zu einem Gegenstand (dort steht seine Bedeutung im Fall). */
  const fundNotiz = (item: Item) =>
    notizen.find((n) => n.quelle === "Fund" && n.text.startsWith(item.name))?.text ??
    item.beschreibung;

  return (
    <div className="inhalt einblenden">
      <h3 className="abschnitt">Beweisstücke ({gefunden.length})</h3>

      {gefunden.length === 0 ? (
        <p className="leise">
          Die Taschen sind leer. Wimpy sollte sich an den Orten umsehen.
        </p>
      ) : (
        <div className="inventar">
          {gefunden.map((item) => (
            <button
              key={item.id}
              className="beweis"
              data-offen={offen === item.id}
              onClick={() => setOffen(offen === item.id ? null : item.id)}
            >
              <div className="beweis-bild">
                <Bild src={item.bild} alt={item.name} platzhalter={item.name} />
              </div>
              <strong>{item.name}</strong>
              {offen === item.id && (
                <p className="beweis-text einblenden">{fundNotiz(item)}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
