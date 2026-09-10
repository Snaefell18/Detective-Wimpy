"use client";

import { useState } from "react";
import { Bild } from "./Bild";
import { TASCHE_MAX, type Beweismittel } from "@/lib/beweismittel";

/**
 * Die Beweismitteltasche.
 *
 * Hier liegt, was Wimpy wirklich mitgenommen hat - sechs Stücke, und sie
 * gelten für die ganze Saga. Vor Gericht kann er nur damit arbeiten, also
 * ist jedes Stück eine Entscheidung gegen ein anderes.
 *
 * Antippen zeigt, was er dazu notiert hat; wegwerfen geht auch hier, damit
 * man nicht bis zum nächsten Fund warten muss, um Platz zu schaffen.
 */
export function InventarScreen({
  inhalt,
  onWegwerfen,
}: {
  inhalt: Beweismittel[];
  onWegwerfen: (id: string) => void;
}) {
  const [offen, setOffen] = useState<string | null>(null);

  return (
    <div className="inhalt einblenden">
      <h3 className="abschnitt">
        Beweismitteltasche ({inhalt.length}/{TASCHE_MAX})
      </h3>

      {inhalt.length === 0 ? (
        <p className="leise">
          Die Tasche ist leer. Wimpy sollte sich an den Orten umsehen - und
          beim nächsten Fund entscheiden, ob er ihn mitnimmt.
        </p>
      ) : (
        <>
          <p className="leise klein">
            Nur was hier liegt, kannst du am Ende vor Gericht vorlegen. Alles
            andere steht im Notizbuch.
          </p>

          <div className="inventar">
            {inhalt.map((mittel) => (
              <div
                key={mittel.id}
                className="beweis"
                data-offen={offen === mittel.id}
                role="button"
                tabIndex={0}
                onClick={() => setOffen(offen === mittel.id ? null : mittel.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setOffen(offen === mittel.id ? null : mittel.id);
                  }
                }}
              >
                <div className="beweis-bild">
                  <Bild src={mittel.bild} alt={mittel.name} platzhalter={mittel.name} />
                </div>
                <strong>{mittel.name}</strong>
                {mittel.herkunft && (
                  <span className="leise klein">{mittel.herkunft}</span>
                )}
                {offen === mittel.id && (
                  <div className="beweis-text einblenden">
                    <p>{mittel.beobachtung}</p>
                    <button
                      className="knopf klein"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `„${mittel.name}“ wirklich wegwerfen? Vor Gericht fehlt es dann.`,
                          )
                        ) {
                          onWegwerfen(mittel.id);
                          setOffen(null);
                        }
                      }}
                    >
                      Wegwerfen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
