"use client";

import { Bild } from "./Bild";
import { getCharacter } from "@/lib/characters";
import { ITEMS, getItem } from "@/lib/items";
import type { NotebookEntry } from "@/lib/types";

export function NotizbuchScreen({
  gefundeneSpuren,
  notizen,
}: {
  gefundeneSpuren: string[];
  notizen: NotebookEntry[];
}) {
  return (
    <div className="inhalt einblenden">
      <h3 className="abschnitt">
        Spuren ({gefundeneSpuren.length}/{ITEMS.length})
      </h3>

      {gefundeneSpuren.length === 0 ? (
        <p className="leise">
          Noch nichts gefunden. Wimpy sollte sich an den Orten umsehen.
        </p>
      ) : (
        <div className="item-gitter">
          {gefundeneSpuren.map((id) => {
            const item = getItem(id);
            return (
              <div key={id} className="item-kachel">
                <div className="item-bild">
                  <Bild src={item?.bild} alt={item?.name ?? id} platzhalter={item?.name} />
                </div>
                <strong>{item?.name ?? id}</strong>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="abschnitt">Notizen</h3>
      {notizen.length === 0 ? (
        <p className="leise">Das Notizbuch ist noch jungfräulich.</p>
      ) : (
        <ul className="notizen">
          {[...notizen].reverse().map((n) => (
            <li key={n.id} className="karte">
              <span className="notiz-quelle">
                {getCharacter(n.quelle)?.name ?? n.quelle}
              </span>
              <p style={{ margin: "4px 0 0" }}>{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
