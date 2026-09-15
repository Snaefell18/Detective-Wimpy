"use client";

import { useState } from "react";
import { useStaedte } from "@/lib/useStaedte";
import { stadtVorgabe, stadtZeile, type StadtVorgabe } from "@/lib/staedte";

/**
 * Eine im Reiter „Städte“ geplante Stadt übernehmen.
 *
 * Übernehmen heißt abschreiben: Plan, Tankstelle, Belag und Licht wandern in
 * das Kapitel oder in die Probewelt, und dort lässt sich danach alles weiter
 * verändern, ohne dass die Vorlage sich ändert. Umgekehrt genauso - wer die
 * Stadt später im Admin-Menü umbaut, baut keine laufende Saga um.
 *
 * Gibt es noch keine geplante Stadt, steht hier nichts. Dann malt man seinen
 * Plan wie bisher von Hand darunter.
 */
export function StadtWahl({ onUebernehmen }: { onUebernehmen: (vorgabe: StadtVorgabe) => void }) {
  const { staedte, fehler } = useStaedte();
  const [zuletzt, setZuletzt] = useState("");

  // Ohne Verbindung oder ohne geplante Stadt steht hier gar nichts: Dann malt
  // man seinen Plan wie bisher darunter, und ein Fehlertext in einem
  // Einstellungsfenster wäre nur im Weg. Im Reiter „Städte“ steht er.
  if (fehler || !staedte.length) return null;

  return (
    <label className="feld">
      <span className="leise klein">Geplante Stadt übernehmen · aus dem Reiter „Städte“</span>
      <select
        value=""
        onChange={(e) => {
          const stadt = staedte.find((eintrag) => eintrag.id === e.target.value);
          if (!stadt) return;
          onUebernehmen(stadtVorgabe(stadt));
          setZuletzt(`„${stadt.name}“ übernommen · ${stadtZeile(stadt)}`);
        }}
      >
        <option value="">– eigener Plan –</option>
        {staedte.map((stadt) => (
          <option key={stadt.id} value={stadt.id}>
            {stadt.name}
          </option>
        ))}
      </select>
      {zuletzt && <span className="leise klein">{zuletzt}</span>}
    </label>
  );
}
