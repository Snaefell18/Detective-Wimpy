"use client";

import { useState } from "react";
import { DREI_D_LOCATIONS } from "@/lib/pursuit3d";
import {
  PLAN_MASSE,
  STRASSE,
  beispielPlan,
  drehungAn,
  feldAn,
  feldDrehen,
  feldSetzen,
  leererPlan,
  planGroesse,
  planGueltig,
  strassenFelder,
  type Stadtplan,
} from "@/lib/stadtplan";

/**
 * Den Stadtplan mit dem Daumen malen.
 *
 * Oben die Palette - Straße, leer, und jeder 3D-Baustein -, darunter das
 * Raster. Ein Tipp setzt das gewählte Feld; tippt man auf ein Gebäude, das
 * schon dort steht, dreht es sich um 90 Grad. Mehr braucht es nicht: Aus
 * Straßenfeldern werden von selbst Kreuzungen und Sackgassen, und dasselbe
 * Haus darf so oft vorkommen, wie man mag.
 *
 * Ohne Plan bleibt alles wie bisher - der Knopf oben legt erst einen an.
 */
export function StadtplanFeld({
  plan,
  onAendern,
}: {
  plan: Stadtplan | null | undefined;
  onAendern: (plan: Stadtplan | null) => void;
}) {
  const [werkzeug, setWerkzeug] = useState<string>(STRASSE);

  if (!plan) {
    return (
      <div className="stadtplan-leer">
        <p className="leise klein">
          Ohne Stadtplan entsteht die Stadt wie bisher: Die gewählten Bausteine
          werden zu einem Straßenzug aneinandergereiht. Mit Plan legst du
          Straßen und Gebäude selbst - mit Kreuzungen, Sackgassen und
          Wiederholungen.
        </p>
        <button type="button" className="knopf" onClick={() => onAendern(beispielPlan(7, 7))}>
          🗺️ Eigenen Stadtplan anlegen
        </button>
      </div>
    );
  }

  const strassen = strassenFelder(plan).length;
  const setzen = (x: number, z: number) => {
    const jetzt = feldAn(plan, x, z);
    // Noch einmal auf dasselbe Gebäude: drehen statt neu setzen.
    if (jetzt === werkzeug && werkzeug !== STRASSE && werkzeug !== "") {
      onAendern(feldDrehen(plan, x, z));
      return;
    }
    onAendern(feldSetzen(plan, x, z, werkzeug));
  };

  return (
    <div className="stadtplan">
      <div className="marken-reihe">
        <button
          type="button"
          className="marke-knopf"
          data-aktiv={werkzeug === STRASSE}
          onClick={() => setWerkzeug(STRASSE)}
        >
          Straße
        </button>
        <button
          type="button"
          className="marke-knopf"
          data-aktiv={werkzeug === ""}
          onClick={() => setWerkzeug("")}
        >
          Leer
        </button>
        {DREI_D_LOCATIONS.map((ort) => (
          <button
            key={ort.id}
            type="button"
            className="marke-knopf"
            data-aktiv={werkzeug === ort.id}
            onClick={() => setWerkzeug(ort.id)}
          >
            {ort.name}
          </button>
        ))}
      </div>

      <div
        className="stadtplan-raster"
        style={{ gridTemplateColumns: `repeat(${plan.breite}, 1fr)` }}
      >
        {Array.from({ length: plan.tiefe }, (_, z) =>
          Array.from({ length: plan.breite }, (_, x) => {
            const wert = feldAn(plan, x, z);
            const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === wert);
            return (
              <button
                key={`${x},${z}`}
                type="button"
                className="stadtplan-feld"
                data-art={wert === STRASSE ? "strasse" : wert ? "haus" : "leer"}
                title={`${x},${z} · ${ort ? `${ort.name} (${drehungAn(plan, x, z)}°)` : wert === STRASSE ? "Straße" : "leer"}`}
                onClick={() => setzen(x, z)}
              >
                {ort ? (
                  <span style={{ transform: `rotate(${drehungAn(plan, x, z)}deg)` }}>
                    {ort.name.slice(0, 2)}
                  </span>
                ) : wert === STRASSE ? (
                  "·"
                ) : (
                  ""
                )}
              </button>
            );
          }),
        )}
      </div>

      <p className="leise klein">
        {strassen} Straßenfeld{strassen === 1 ? "" : "er"}
        {planGueltig(plan) ? "" : " · mindestens zwei, sonst bleibt es beim Straßenzug"}
        {" · "}Tipp auf ein gesetztes Gebäude dreht es.
      </p>

      <div className="knopf-reihe">
        {(["breite", "tiefe"] as const).map((was) => (
          <label className="feld" key={was}>
            <span className="leise klein">{was === "breite" ? "Breite" : "Tiefe"}</span>
            <select
              value={plan[was]}
              onChange={(e) =>
                onAendern(
                  planGroesse(
                    plan,
                    was === "breite" ? Number(e.target.value) : plan.breite,
                    was === "tiefe" ? Number(e.target.value) : plan.tiefe,
                  ),
                )
              }
            >
              {Array.from({ length: PLAN_MASSE.max - PLAN_MASSE.min + 1 }, (_, i) => i + PLAN_MASSE.min).map((n) => (
                <option key={n} value={n}>{n} Felder</option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="knopf klein" onClick={() => onAendern(beispielPlan(plan.breite, plan.tiefe))}>
          Kreuzung
        </button>
        <button type="button" className="knopf klein" onClick={() => onAendern(leererPlan(plan.breite, plan.tiefe))}>
          Alles leeren
        </button>
        <button type="button" className="knopf klein" onClick={() => onAendern(null)}>
          Plan verwerfen
        </button>
      </div>
    </div>
  );
}
