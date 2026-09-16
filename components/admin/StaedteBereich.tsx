"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { loescheStadt, speichereStadt } from "@/lib/db";
import { useStaedte } from "@/lib/useStaedte";
import {
  STRASSENTYPEN,
  TAGESZEITEN,
  WETTERLAGEN,
  neueStadt,
  stadtGueltig,
  stadtZeile,
  type Stadt,
} from "@/lib/staedte";
import {
  DREI_D_LOCATIONS,
  DREI_D_STRASSENTYPEN,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
} from "@/lib/pursuit3d";
import { gebaeudeArten, planGueltig } from "@/lib/stadtplan";
import { StadtplanFeld } from "./StadtplanFeld";
import type { BereichProps } from "./typen";

const ProbeSzene = dynamic(
  () => import("@/components/Saga3DKapitel").then((m) => m.Saga3DProbeSzene),
  { ssr: false },
);

/**
 * Städte im Voraus planen.
 *
 * Eine Stadt ist hier alles, was einen Ort ausmacht: das Raster, die
 * Tankstelle, der Belag und das Licht, in dem man sie zuerst sieht. Wer sie
 * einmal gebaut hat, wählt sie danach in der Probewelt und in jedem
 * 3D-Kapitel einer Saga aus, statt sie neu zu malen.
 *
 * Und man kann hineinlaufen, bevor jemand anders es tut: Der Probelauf
 * öffnet dieselbe Szene, in der später gespielt wird.
 */
export function StaedteBereich({ onMeldung, onFehler }: BereichProps) {
  const { staedte, laden, fehler } = useStaedte();
  const [entwurf, setEntwurf] = useState<Stadt | null>(null);
  const [probe, setProbe] = useState<Stadt | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const aendern = (teil: Partial<Stadt>) => setEntwurf((alt) => (alt ? { ...alt, ...teil } : alt));

  const speichern = async () => {
    if (!entwurf) return;
    if (!stadtGueltig(entwurf)) {
      onFehler("Die Stadt braucht einen Namen und einen Plan mit mindestens zwei Straßenfeldern.");
      return;
    }
    setSpeichert(true);
    try {
      await speichereStadt(entwurf);
      await laden();
      setEntwurf(null);
      onMeldung("Stadt gespeichert – ab jetzt in der Probewelt und in jeder Saga wählbar.");
    } catch {
      onFehler("Die Stadt konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  };

  const entfernen = async (stadt: Stadt) => {
    if (!window.confirm(`„${stadt.name}“ löschen? Sagas, die sie schon benutzen, behalten ihren Plan.`)) return;
    try {
      await loescheStadt(stadt.id);
      await laden();
      onMeldung("Stadt gelöscht.");
    } catch {
      onFehler("Die Stadt konnte nicht gelöscht werden.");
    }
  };

  if (probe) {
    return (
      <ProbeSzene
        locations={gebaeudeArten(probe.plan)}
        tageszeit={probe.tageszeit}
        wetter={probe.wetter}
        strassentyp={probe.strassentyp}
        modellIds={["wimpy"]}
        locationDrehungen={{}}
        tankstelleId={probe.tankstelleId}
        polizeiId={probe.polizeiId}
        plan={probe.plan}
        onZurueck={() => setProbe(null)}
        onSchliessen={() => setProbe(null)}
      />
    );
  }

  const bausteine = entwurf && planGueltig(entwurf.plan) ? gebaeudeArten(entwurf.plan) : [];

  return (
    <>
      <h2>Städte</h2>
      <p className="leise">
        Fertige 3D-Städte zum Wiederverwenden. Beim Auswählen wird eine Stadt abgeschrieben,
        nicht verknüpft – eine laufende Saga ändert sich also nicht mehr, wenn du hier später
        eine Straße verschiebst.
      </p>
      {fehler && <p className="fehler">{fehler}</p>}

      {!entwurf && (
        <button className="knopf" onClick={() => setEntwurf(neueStadt())}>
          Stadt anlegen
        </button>
      )}

      {!entwurf && staedte.map((stadt) => (
        <div className="kapitel-block" key={stadt.id}>
          <strong>{stadt.name}</strong>
          <p className="leise klein">{stadtZeile(stadt)}</p>
          {stadt.beschreibung && <p>{stadt.beschreibung}</p>}
          <div className="knopf-reihe">
            <button className="knopf" onClick={() => setEntwurf(stadt)}>Bearbeiten</button>
            <button className="knopf" onClick={() => setProbe(stadt)}>Probelauf</button>
            <button className="knopf" onClick={() => void entfernen(stadt)}>Löschen</button>
          </div>
        </div>
      ))}

      {!entwurf && !staedte.length && (
        <p className="leise">
          Noch keine Stadt geplant. Ohne eine bleibt alles wie bisher: Jedes Kapitel legt
          seinen Plan selbst – oder reiht die Bausteine zu einem Straßenzug.
        </p>
      )}

      {entwurf && (
        <div className="kapitel-block">
          <label className="feld">
            <span className="leise klein">Name</span>
            <input
              maxLength={80}
              value={entwurf.name}
              onChange={(e) => aendern({ name: e.target.value })}
            />
          </label>
          <label className="feld">
            <span className="leise klein">Wofür diese Stadt gedacht ist</span>
            <textarea
              maxLength={400}
              value={entwurf.beschreibung}
              onChange={(e) => aendern({ beschreibung: e.target.value })}
            />
          </label>

          <span className="leise klein">Aufbau der Stadt</span>
          <StadtplanFeld
            plan={entwurf.plan}
            onAendern={(plan) => aendern({ plan: plan ?? entwurf.plan })}
          />

          <label className="feld">
            <span className="leise klein">Tankstelle · hier steigt Wimpy ins Auto</span>
            <select
              value={entwurf.tankstelleId}
              onChange={(e) => aendern({ tankstelleId: e.target.value })}
            >
              <option value="">Automatisch erkennen (Name enthält „Tank“)</option>
              {bausteine.map((id) => (
                <option key={id} value={id}>
                  {DREI_D_LOCATIONS.find((ort) => ort.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>

          <label className="feld">
            <span className="leise klein">Polizeiwache · hier beschuldigt Wimpy</span>
            <select
              value={entwurf.polizeiId}
              onChange={(e) => aendern({ polizeiId: e.target.value })}
            >
              <option value="">Automatisch erkennen (Name enthält „Polizei“)</option>
              {bausteine.map((id) => (
                <option key={id} value={id}>
                  {DREI_D_LOCATIONS.find((ort) => ort.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>

          {/* Belag und Licht gehören zur Stadt: Sie ist damit geplant, nicht
              nur gemalt. Ein Kapitel darf beides hinterher trotzdem noch
              umstellen. */}
          <span className="leise klein">Straßentyp</span>
          <div className="marken-reihe">
            {DREI_D_STRASSENTYPEN.filter((typ) => STRASSENTYPEN.includes(typ.id)).map((typ) => (
              <button
                key={typ.id}
                className="marke-knopf"
                data-aktiv={entwurf.strassentyp === typ.id}
                onClick={() => aendern({ strassentyp: typ.id })}
              >
                {typ.name}
              </button>
            ))}
          </div>

          <span className="leise klein">Tageszeit</span>
          <div className="marken-reihe">
            {DREI_D_TAGESZEITEN.filter((zeit) => TAGESZEITEN.includes(zeit.id)).map((zeit) => (
              <button
                key={zeit.id}
                className="marke-knopf"
                data-aktiv={entwurf.tageszeit === zeit.id}
                onClick={() => aendern({ tageszeit: zeit.id })}
              >
                {zeit.name}
              </button>
            ))}
          </div>

          <span className="leise klein">Wetter</span>
          <div className="marken-reihe">
            {DREI_D_WETTER.filter((lage) => WETTERLAGEN.includes(lage.id)).map((lage) => (
              <button
                key={lage.id}
                className="marke-knopf"
                data-aktiv={entwurf.wetter === lage.id}
                onClick={() => aendern({ wetter: lage.id })}
              >
                {lage.name}
              </button>
            ))}
          </div>

          <p className="leise klein">{stadtZeile(entwurf)}</p>
          <div className="knopf-reihe">
            <button className="knopf aktion" disabled={speichert} onClick={() => void speichern()}>
              Speichern
            </button>
            <button
              className="knopf"
              disabled={!planGueltig(entwurf.plan)}
              onClick={() => setProbe(entwurf)}
            >
              Probelauf
            </button>
            <button className="knopf" onClick={() => setEntwurf(null)}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  );
}
