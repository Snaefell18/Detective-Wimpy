"use client";

import {
  DREI_D_LOCATIONS,
  DREI_D_STRASSENTYPEN,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
} from "@/lib/pursuit3d";
import { jagdWelt, type VerfolgungVorgabe } from "@/lib/verfolgung";

/**
 * Die Strecke einer Verfolgungsjagd: Belag, Licht, Wetter und Bausteine.
 *
 * Die Jagd war lange eine einzige Landschaft - eine Schneepiste in der Nacht,
 * ein paar Tannen, fertig. Jetzt ist sie eine Welt wie jede andere im Spiel,
 * und eingestellt wird sie mit denselben Worten wie eine Stadt oder eine
 * Kampfarena. Dasselbe Feld steht deshalb an beiden Stellen, an denen eine
 * Jagd eingerichtet wird: zwischen zwei Kapiteln und vor dem Showdown.
 *
 * Alles hier ist freiwillig. Wer nichts anfasst, fährt durch die
 * Schneelandschaft, die es immer gab.
 */
export function JagdWeltFeld({
  jagd,
  onAendern,
}: {
  jagd: VerfolgungVorgabe;
  onAendern: (teil: Partial<VerfolgungVorgabe>) => void;
}) {
  const welt = jagdWelt(jagd);
  /** Höchstens drei Bauarten - jede bringt ihre eigenen Texturen mit. */
  const umschalten = (id: string) =>
    onAendern({
      locations: welt.locations.includes(id)
        ? welt.locations.filter((eintrag) => eintrag !== id)
        : [...welt.locations, id].slice(-3),
    });

  return (
    <>
      <span className="leise klein">Die Strecke · wie überall im Spiel</span>

      <label className="feld">
        <span className="leise">Straßenbelag</span>
        <select
          value={welt.strassentyp}
          onChange={(e) =>
            onAendern({ strassentyp: e.target.value as VerfolgungVorgabe["strassentyp"] })
          }
        >
          {DREI_D_STRASSENTYPEN.map((typ) => (
            <option key={typ.id} value={typ.id}>
              {typ.name}
            </option>
          ))}
        </select>
      </label>

      <label className="feld">
        <span className="leise">Tageszeit</span>
        <select
          value={welt.tageszeit}
          onChange={(e) =>
            onAendern({ tageszeit: e.target.value as VerfolgungVorgabe["tageszeit"] })
          }
        >
          {DREI_D_TAGESZEITEN.map((zeit) => (
            <option key={zeit.id} value={zeit.id}>
              {zeit.name}
            </option>
          ))}
        </select>
      </label>

      <label className="feld">
        <span className="leise">Wetter</span>
        <select
          value={welt.wetter}
          onChange={(e) => onAendern({ wetter: e.target.value as VerfolgungVorgabe["wetter"] })}
        >
          {DREI_D_WETTER.map((lage) => (
            <option key={lage.id} value={lage.id}>
              {lage.name}
            </option>
          ))}
        </select>
      </label>

      {/* Die Bausteine ziehen am Straßenrand vorbei und wiederholen sich,
          solange die Jagd dauert. Ohne Auswahl bleibt es bei der gerechneten
          Landschaft: Tannen im Schnee, Dünen im Sand, Blöcke am Asphalt. */}
      <span className="leise klein">
        Häuser am Straßenrand · höchstens drei, sie wiederholen sich
      </span>
      <div className="marken-reihe">
        {DREI_D_LOCATIONS.map((ort) => (
          <button
            key={ort.id}
            type="button"
            className="marke-knopf"
            data-aktiv={welt.locations.includes(ort.id)}
            onClick={() => umschalten(ort.id)}
          >
            {ort.name}
          </button>
        ))}
      </div>
      <p className="leise klein">
        {welt.locations.length
          ? "Sie stehen in zwei Zeilen neben der Piste und kommen wieder, sobald sie hinten aus dem Bild gefahren sind."
          : "Nichts gewählt - dann fährt man durch die Landschaft, die zum Belag gehört."}
      </p>
    </>
  );
}
