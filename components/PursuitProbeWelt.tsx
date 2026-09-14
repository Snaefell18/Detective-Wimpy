"use client";

import { useState } from "react";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import {
  DREI_D_LOCATIONS,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
  type DreiDTageszeit,
  type DreiDWetter,
} from "@/lib/pursuit3d";
import { Saga3DProbeSzene } from "./Saga3DKapitel";

export function PursuitProbeWelt({
  onZurueck,
  onSchliessen,
}: {
  onZurueck: () => void;
  onSchliessen: () => void;
}) {
  const [spielt, setSpielt] = useState(false);
  const [locations, setLocations] = useState<string[]>(DREI_D_LOCATIONS.map((ort) => ort.id));
  const [tageszeit, setTageszeit] = useState<DreiDTageszeit>("tag");
  const [wetter, setWetter] = useState<DreiDWetter>("sonne");
  const [modelle, setModelle] = useState<string[]>(
    ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy").map((modell) => modell.id),
  );

  if (spielt) {
    return (
      <Saga3DProbeSzene
        locations={locations}
        tageszeit={tageszeit}
        wetter={wetter}
        modellIds={["wimpy", ...modelle]}
        onZurueck={() => setSpielt(false)}
        onSchliessen={onSchliessen}
      />
    );
  }

  return (
    <div className="jagd pursuit-auswahl pursuit-spiel">
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <section className="pursuit-panel probe-panel">
        <button className="pursuit-zurueck" onClick={onZurueck}>‹ Modi</button>
        <span className="jagd-kicker">MODUS IV · VOR DEM ERNSTFALL</span>
        <h1>3D-PROBEWELT</h1>
        <p>Baue eine Straße zusammen, stelle das Licht ein und prüfe alle eingecheckten Charaktermodelle live.</p>

        <h3>Straßen · Reihenfolge der Auswahl</h3>
        <div className="marken-reihe probe-auswahl">
          {DREI_D_LOCATIONS.map((ort) => {
            const aktiv = locations.includes(ort.id);
            return (
              <button
                key={ort.id}
                className="marke-knopf"
                data-aktiv={aktiv}
                onClick={() =>
                  setLocations((alt) =>
                    aktiv ? (alt.length > 1 ? alt.filter((id) => id !== ort.id) : alt) : [...alt, ort.id],
                  )
                }
              >
                {ort.name}
              </button>
            );
          })}
        </div>

        <h3>Tageszeit</h3>
        <div className="marken-reihe probe-auswahl">
          {DREI_D_TAGESZEITEN.map((zeit) => (
            <button key={zeit.id} className="marke-knopf" data-aktiv={tageszeit === zeit.id} onClick={() => setTageszeit(zeit.id)}>
              {zeit.name}
            </button>
          ))}
        </div>

        <h3>Wetter</h3>
        <div className="marken-reihe probe-auswahl">
          {DREI_D_WETTER.map((lage) => (
            <button key={lage.id} className="marke-knopf" data-aktiv={wetter === lage.id} onClick={() => setWetter(lage.id)}>
              {lage.name}
            </button>
          ))}
        </div>

        <h3>Figuren · Wimpy ist immer dabei</h3>
        <div className="pursuit-modelle probe-modelle">
          {ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy").map((modell) => {
            const aktiv = modelle.includes(modell.id);
            return (
              <button
                key={modell.id}
                data-aktiv={aktiv}
                onClick={() => setModelle((alt) => aktiv ? alt.filter((id) => id !== modell.id) : [...alt, modell.id])}
              >
                <strong>{modell.name}</strong>
                <span>{modell.animationen.length} Animationen</span>
              </button>
            );
          })}
        </div>

        <button className="knopf aktion pursuit-los" onClick={() => setSpielt(true)}>
          PROBEWELT BAUEN ›
        </button>
      </section>
    </div>
  );
}
