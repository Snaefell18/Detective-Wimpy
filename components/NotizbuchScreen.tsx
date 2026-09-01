"use client";

import type { Character, NotebookEntry } from "@/lib/types";

export function NotizbuchScreen({
  notizen,
  besetzung,
}: {
  notizen: NotebookEntry[];
  besetzung: Character[];
}) {
  const nameVon = (quelle: string) =>
    besetzung.find((c) => c.id === quelle)?.name ?? quelle;

  return (
    <div className="inhalt einblenden">
      <h3 className="abschnitt">Notizen</h3>
      {notizen.length === 0 ? (
        <p className="leise">Das Notizbuch ist noch jungfräulich.</p>
      ) : (
        <ul className="notizen">
          {[...notizen].reverse().map((n) => (
            <li key={n.id} data-fund={n.quelle === "Fund"}>
              <span className="notiz-quelle">{nameVon(n.quelle)}</span>
              <p style={{ margin: "4px 0 0" }}>{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
