"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import {
  GROESSE_GRENZEN,
  MINDEST_FELDER,
  arenaPlan,
  kampfSpielbar,
  kampfSpruch,
  kampfZeile,
  neueKampfJagd,
  type KampfVorgabe,
} from "@/lib/endkampf";
import { KAMPF_STUFEN } from "@/lib/kampf";
import {
  DREI_D_STRASSENTYPEN,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
} from "@/lib/pursuit3d";
import { gebaeudeArten, strassenFelder } from "@/lib/stadtplan";
import { useStammdaten } from "@/lib/stammdaten";
import { useAutos } from "@/lib/useAutos";
import { JagdWeltFeld } from "./JagdWeltFeld";
import { SongWahl } from "./SongFeld";
import { StadtplanFeld } from "./StadtplanFeld";
import { StadtWahl } from "./StadtWahl";

const Showdown = dynamic(() => import("../Showdown").then((modul) => modul.Showdown), {
  ssr: false,
});

/**
 * Der Showdown, überall dort, wo man ihn einstellt.
 *
 * Dieselben Felder braucht man an drei Stellen: im Finale eines Arcs, im
 * Finale einer Saga und im 3D-Labor. Drei Kopien wären drei Baustellen -
 * deshalb liegen sie hier, und nur der Gegner wird hereingereicht: im Arc der
 * Culprit, in der Saga der Drahtzieher, im Labor niemand (dort zählt allein
 * das gewählte Modell).
 *
 * Wichtig ist der Knopf ganz unten: „Showdown proben“ spielt den Kampf
 * genauso, wie er später laufen wird - samt Verfolgungsjagd davor, wenn eine
 * eingerichtet ist. Ein Kampf lässt sich nicht ausdenken, man muss ihn
 * spielen: ob die Arena zu eng ist, ob der Gegner zu groß geraten ist und ob
 * die Stufe passt, merkt man in zehn Sekunden.
 */
export function KampfFeld({
  kampf,
  onAendern,
  gegnerId = "",
  gegnerWort = "",
  ohneGegner = "",
  titel,
  einleitung = "",
  probeText = "⚔️ Showdown proben",
  spielerModellId,
  onSpielerModell,
}: {
  kampf: KampfVorgabe;
  onAendern: (kampf: KampfVorgabe) => void;
  /** Charakter-Id des Gegners. Leer heißt: steht noch nicht fest. */
  gegnerId?: string;
  /** Wie er genannt wird, solange er kein Tier aus den Stammdaten ist. */
  gegnerWort?: string;
  /** Was dasteht, wenn kein Gegner feststeht. Leer = gar nichts (Labor). */
  ohneGegner?: string;
  /** Überschrift für den Titel der Jagd und für die Probe. */
  titel: string;
  /** Ein Satz darüber, was dieser Kampf im Spiel bedeutet. */
  einleitung?: string;
  probeText?: string;
  /** Nur im Labor: Wimpy einmal mit einem anderen Modell ausprobieren. */
  spielerModellId?: string;
  onSpielerModell?: (id: string) => void;
}) {
  const stammdaten = useStammdaten();
  const { autos } = useAutos();
  const [probe, setProbe] = useState(false);

  const setzen = (teil: Partial<KampfVorgabe>) => onAendern({ ...kampf, ...teil });
  const jagdAendern = (teil: Partial<NonNullable<KampfVorgabe["jagd"]>>) => {
    if (!kampf.jagd) return;
    setzen({ jagd: { ...kampf.jagd, ...teil } });
  };

  const gegner = gegnerId ? stammdaten.charaktere.find((c) => c.id === gegnerId) : undefined;
  const name = gegner?.name || gegnerWort.trim() || "der Gegner";
  const felder = kampf.plan ? strassenFelder(kampf.plan).length : 0;

  return (
    <div className="kampf-feld">
      {einleitung && <p className="leise klein">{einleitung}</p>}

      <h4 className="unter-abschnitt">
        Die Arena <span className="leise">· eine 3D-Stadt wie jede andere</span>
      </h4>
      <p className="leise klein">{kampfZeile(kampf)}</p>
      {!kampfSpielbar(kampf) && (
        <p className="hinweis warnung klein">
          Ohne Arena mit mindestens {MINDEST_FELDER} Straßenfeldern findet kein Kampf
          statt - dann geht alles weiter, als hätte man keinen Showdown gewählt.
          {felder > 0 && felder < MINDEST_FELDER ? ` Gerade sind es ${felder}.` : ""}
        </p>
      )}
      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf klein"
          onClick={() => setzen({ plan: arenaPlan(9, 9), locations: gebaeudeArten(arenaPlan(9, 9)) })}
        >
          ⚔️ Kampfplatz anlegen
        </button>
      </div>
      <StadtWahl
        onUebernehmen={(stadt) =>
          setzen({
            plan: stadt.plan,
            locations: stadt.locations,
            strassentyp: stadt.strassentyp,
            tageszeit: stadt.tageszeit,
            wetter: stadt.wetter,
          })
        }
      />
      <StadtplanFeld
        plan={kampf.plan}
        onAendern={(plan) => setzen({ plan, locations: plan ? gebaeudeArten(plan) : [] })}
      />

      <span className="leise klein">Straßenbelag</span>
      <div className="marken-reihe">
        {DREI_D_STRASSENTYPEN.map((typ) => (
          <button
            key={typ.id}
            type="button"
            className="marke-knopf"
            data-aktiv={kampf.strassentyp === typ.id}
            onClick={() => setzen({ strassentyp: typ.id })}
          >
            {typ.name}
          </button>
        ))}
      </div>
      <span className="leise klein">Tageszeit</span>
      <div className="marken-reihe">
        {DREI_D_TAGESZEITEN.map((zeit) => (
          <button
            key={zeit.id}
            type="button"
            className="marke-knopf"
            data-aktiv={kampf.tageszeit === zeit.id}
            onClick={() => setzen({ tageszeit: zeit.id })}
          >
            {zeit.name}
          </button>
        ))}
      </div>
      <span className="leise klein">Wetter</span>
      <div className="marken-reihe">
        {DREI_D_WETTER.map((wetter) => (
          <button
            key={wetter.id}
            type="button"
            className="marke-knopf"
            data-aktiv={kampf.wetter === wetter.id}
            onClick={() => setzen({ wetter: wetter.id })}
          >
            {wetter.name}
          </button>
        ))}
      </div>

      <h4 className="unter-abschnitt">
        Der Gegner <span className="leise">· {name}</span>
      </h4>
      {!gegner && ohneGegner && <p className="hinweis warnung klein">{ohneGegner}</p>}
      <label className="feld">
        <span className="leise klein">
          3D-Modell · leer heißt: das Modell aus den Stammdaten des Tieres
        </span>
        <select
          value={kampf.gegnerModell}
          onChange={(e) => setzen({ gegnerModell: e.target.value })}
        >
          <option value="">Wie in den Stammdaten</option>
          {ANIMATIONS_MODELLE.map((modell) => (
            <option key={modell.id} value={modell.id}>
              {modell.name} · {modell.animationen.length} Animationen
            </option>
          ))}
        </select>
      </label>
      {/* Im Labor gibt es keine Stammdaten, an denen Wimpys Modell hängt -
          dort wird auch er ausgewählt. */}
      {onSpielerModell && (
        <label className="feld">
          <span className="leise klein">Wimpys Modell · nur zum Ausprobieren</span>
          <select value={spielerModellId ?? ""} onChange={(e) => onSpielerModell(e.target.value)}>
            <option value="">Wie in den Stammdaten</option>
            {ANIMATIONS_MODELLE.map((modell) => (
              <option key={modell.id} value={modell.id}>
                {modell.name} · {modell.animationen.length} Animationen
              </option>
            ))}
          </select>
        </label>
      )}
      {/* Ein Endgegner darf größer sein als ein Tier von der Straße - zu groß
          passt er allerdings nicht mehr zwischen die Häuser. */}
      <div className="stadtplan-hoehe">
        <strong>Größe</strong>
        <button
          type="button"
          className="knopf klein"
          aria-label="Kleiner"
          disabled={kampf.gegnerGroesse <= GROESSE_GRENZEN.min}
          onClick={() => setzen({ gegnerGroesse: Math.round((kampf.gegnerGroesse - 0.05) * 20) / 20 })}
        >
          −
        </button>
        <span className="leise klein">
          {kampf.gegnerGroesse.toFixed(2)}× · ~{(1.8 * kampf.gegnerGroesse).toFixed(1)} m
          {kampf.gegnerGroesse > 1.6 ? " · ein Ungetüm" : ""}
        </span>
        <button
          type="button"
          className="knopf klein"
          aria-label="Größer"
          disabled={kampf.gegnerGroesse >= GROESSE_GRENZEN.max}
          onClick={() => setzen({ gegnerGroesse: Math.round((kampf.gegnerGroesse + 0.05) * 20) / 20 })}
        >
          +
        </button>
      </div>

      <span className="leise klein">Wie hart wird gekämpft?</span>
      <div className="wahl-reihe">
        {KAMPF_STUFEN.map((stufe) => (
          <button
            key={stufe.id}
            type="button"
            className="wahl-chip"
            data-aktiv={kampf.stufe === stufe.id}
            onClick={() => setzen({ stufe: stufe.id })}
          >
            <strong>{stufe.label}</strong>
            <span className="leise klein">{stufe.hinweis}</span>
          </button>
        ))}
      </div>

      <SongWahl
        wert={kampf.musik}
        onAendern={(musik) => setzen({ musik })}
        beschriftung="Song während des Kampfes"
        leerText="Ohne eigene Kampfmusik"
      />
      <label className="feld">
        <span className="leise klein">
          Was {name} sagt, wenn er am Boden liegt · leer = ein sicherer Satz
        </span>
        <textarea
          rows={3}
          maxLength={1200}
          value={kampf.spruch}
          onChange={(e) => setzen({ spruch: e.target.value })}
          placeholder={kampfSpruch({ ...kampf, spruch: "" }, name)}
        />
      </label>

      <h4 className="unter-abschnitt">
        Verfolgungsjagd davor <span className="leise">· abwählbar</span>
      </h4>
      <p className="leise klein">
        Erst die Fahrt, dann der Kampf: dieselbe Jagd wie zwischen zwei
        Kapiteln, nur sitzt hier {name} selbst im Fluchtwagen. Ohne sie beginnt
        das Finale direkt in der Arena - und im Spiel darf man sie auch
        überspringen.
      </p>
      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf klein"
          onClick={() =>
            setzen({
              jagd: kampf.jagd ? null : neueKampfJagd(gegnerId, titel),
            })
          }
        >
          {kampf.jagd ? "Jagd entfernen" : "🚗 Jagd einrichten"}
        </button>
      </div>
      {kampf.jagd && (
        <div className="rat-editor-block" data-aktiv>
          <label className="feld">
            <span className="leise">Titel der Verfolgungsjagd</span>
            <input
              value={kampf.jagd.name}
              maxLength={160}
              onChange={(e) => jagdAendern({ name: e.target.value })}
            />
          </label>
          <label className="feld">
            <span className="leise">Wer flieht · in aller Regel der Culprit</span>
            <select
              value={kampf.jagd.fliehenderId}
              onChange={(e) => jagdAendern({ fliehenderId: e.target.value })}
            >
              <option value="">– noch niemand –</option>
              {stammdaten.charaktere.map((charakter) => (
                <option key={charakter.id} value={charakter.id}>
                  {charakter.name}
                </option>
              ))}
            </select>
          </label>
          <label className="feld">
            <span className="leise">Fluchtwagen · Wimpy verfolgt mit seinem eigenen Auto</span>
            <select
              value={kampf.jagd.fluchtAutoId ?? "auto-sport"}
              onChange={(e) => jagdAendern({ fluchtAutoId: e.target.value })}
            >
              {autos.map((auto) => (
                <option key={auto.id} value={auto.id}>
                  {auto.name} · {auto.speed} km/h
                </option>
              ))}
            </select>
          </label>
          <label className="feld">
            <span className="leise">Fluchtwagen drehen · falls er verkehrt herum fährt</span>
            <select
              value={kampf.jagd.fluchtDrehung ?? 0}
              onChange={(e) => jagdAendern({ fluchtDrehung: Number(e.target.value) })}
            >
              {[0, 90, 180, 270].map((grad) => (
                <option key={grad} value={grad}>
                  {grad}° {grad === 180 ? "· umgedreht" : grad === 0 ? "· wie im Katalog" : ""}
                </option>
              ))}
            </select>
          </label>
          <JagdWeltFeld welt={kampf.jagd} onAendern={jagdAendern} />

          <SongWahl
            wert={kampf.jagd.musik}
            onAendern={(musik) => jagdAendern({ musik })}
            beschriftung="Song während der Fahrt"
            leerText="Ohne Jagdmusik"
          />
          <label className="feld">
            <span className="leise">
              Was der Fliehende nach dem Fang sagt · leer = automatisch
            </span>
            <textarea
              rows={2}
              maxLength={1200}
              value={kampf.jagd.statement}
              onChange={(e) => jagdAendern({ statement: e.target.value })}
              placeholder="Du hättest es dabei belassen sollen …"
            />
          </label>
        </div>
      )}

      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf klein"
          disabled={!kampfSpielbar(kampf)}
          onClick={() => setProbe(true)}
        >
          {probeText}
        </button>
      </div>

      {probe && kampfSpielbar(kampf) && (
        <div className="jagd-vorschau">
          {/* Geprobt wird der ganze Ablauf - mit Jagd davor, wenn eine steht. */}
          <Showdown
            vorschau
            kampf={kampf}
            gegnerId={gegnerId}
            name={name}
            titel={`${titel || "Der Showdown"} · Probe`}
            spielerModellId={spielerModellId}
            onFertig={() => setProbe(false)}
          />
          <button
            type="button"
            className="jagd-vorschau-schliessen"
            onClick={() => setProbe(false)}
            aria-label="Probe schließen"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
