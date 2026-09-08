"use client";

import type { Wetterlage } from "@/lib/types";

/**
 * Wetter und Tageszeit über dem Schauplatz.
 *
 * Alles davon ist reines CSS - kein Bild, kein Video, keine zusätzliche
 * Ladezeit. Es liegt über dem Ortsbild und schluckt keine Berührungen, das
 * Spiel darunter bleibt also genauso bedienbar wie vorher.
 *
 * Jede Lage besteht aus mehreren Schichten in verschiedenen Tempi und
 * Größen - daher kommt die Tiefe: Was nah ist, zieht schnell und scharf
 * vorbei, was fern ist, langsam und blass.
 *
 * "zufall" wird nicht bei jedem Bild neu gewürfelt, sondern aus der Fall-Id
 * abgeleitet: So hat ein Fall sein Wetter, und es wechselt nicht mitten im
 * Herumlaufen.
 */
const ZUFALLSLAGEN: Wetterlage[] = [
  "sonne",
  "wolken",
  "regen",
  "gewitter",
  "schnee",
  "nebel",
  "nacht",
];

export function lageFuer(wunsch: Wetterlage, fallId: string): Wetterlage {
  if (wunsch !== "zufall") return wunsch;
  let summe = 0;
  for (const zeichen of fallId) summe = (summe + zeichen.charCodeAt(0)) % 1000;
  return ZUFALLSLAGEN[summe % ZUFALLSLAGEN.length];
}

/** Lagen, die aus fallenden oder fliegenden Schichten bestehen. */
const MIT_SCHICHTEN: Wetterlage[] = ["regen", "gewitter", "schnee", "schneesturm"];

export function Wetter({ lage }: { lage: Wetterlage }) {
  if (lage === "aus" || lage === "zufall") return null;

  return (
    <div className="wetter" data-lage={lage} aria-hidden="true">
      {MIT_SCHICHTEN.includes(lage) && (
        <>
          <div className="wetter-schicht" data-tiefe="1" />
          <div className="wetter-schicht" data-tiefe="2" />
          <div className="wetter-schicht" data-tiefe="3" />
        </>
      )}

      {/* Das Gewitter: zwei Blitze in ungleichem Takt, damit es nie
          vorhersehbar zuckt - dazu ein kurzes Nachleuchten am Himmel. */}
      {lage === "gewitter" && (
        <>
          <div className="wetter-blitz" data-schlag="1" />
          <div className="wetter-blitz" data-schlag="2" />
          <div className="wetter-guss" />
        </>
      )}

      {/* Sonne: ein wandernder Strahlenfächer, warmer Dunst und Staub, der
          im Licht steht. */}
      {lage === "sonne" && (
        <>
          <div className="wetter-strahlen" />
          <div className="wetter-glanz" />
          <div className="wetter-staub" data-tiefe="1" />
          <div className="wetter-staub" data-tiefe="2" />
        </>
      )}

      {/* Wolken ziehen in drei Bändern, jedes langsamer als das davor. */}
      {lage === "wolken" && (
        <>
          <div className="wetter-wolke" data-tiefe="1" />
          <div className="wetter-wolke" data-tiefe="2" />
          <div className="wetter-wolke" data-tiefe="3" />
        </>
      )}

      {/* Der Sturm bekommt Böen: weiße Schleier, die quer durchs Bild
          fegen und kurz alles schlucken. */}
      {lage === "schneesturm" && (
        <>
          <div className="wetter-boe" data-tiefe="1" />
          <div className="wetter-boe" data-tiefe="2" />
        </>
      )}
    </div>
  );
}
