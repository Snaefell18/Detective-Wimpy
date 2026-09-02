"use client";

import type { Wetterlage } from "@/lib/types";

/**
 * Wetter und Tageszeit über dem Schauplatz.
 *
 * Alles davon ist reines CSS - kein Bild, kein Video, keine zusätzliche
 * Ladezeit. Es liegt über dem Ortsbild und schluckt keine Berührungen, das
 * Spiel darunter bleibt also genauso bedienbar wie vorher.
 *
 * "zufall" wird nicht bei jedem Bild neu gewürfelt, sondern aus der Fall-Id
 * abgeleitet: So hat ein Fall sein Wetter, und es wechselt nicht mitten im
 * Herumlaufen.
 */
const ZUFALLSLAGEN: Wetterlage[] = ["regen", "nebel", "schnee", "nacht"];

export function lageFuer(wunsch: Wetterlage, fallId: string): Wetterlage {
  if (wunsch !== "zufall") return wunsch;
  let summe = 0;
  for (const zeichen of fallId) summe = (summe + zeichen.charCodeAt(0)) % 1000;
  return ZUFALLSLAGEN[summe % ZUFALLSLAGEN.length];
}

export function Wetter({ lage }: { lage: Wetterlage }) {
  if (lage === "aus" || lage === "zufall") return null;

  return (
    <div className="wetter" data-lage={lage} aria-hidden="true">
      {(lage === "regen" || lage === "schnee") && (
        <>
          <div className="wetter-schicht" data-tiefe="1" />
          <div className="wetter-schicht" data-tiefe="2" />
          <div className="wetter-schicht" data-tiefe="3" />
        </>
      )}
    </div>
  );
}
