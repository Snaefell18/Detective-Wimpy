"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import {
  ABSPANN_ARTEN,
  abspannModelle,
  abspannSpielbar,
  abspannZeile,
  neuerAbspann,
  type AbspannArt,
  type AbspannVorgabe,
} from "@/lib/abspann";
import { useAutos } from "@/lib/useAutos";
import { JagdWeltFeld } from "./JagdWeltFeld";
import { SongWahl } from "./SongFeld";

/*
 * Die Probe lädt Three.js - und das ist das größte Paket des Spiels. Wer im
 * Admin-Menü nur einen Text ändert, soll es nicht mitladen müssen.
 */
const StrassenCredits = dynamic(
  () => import("../StrassenCredits").then((modul) => modul.StrassenCredits),
  { ssr: false },
);
const ArcCredits = dynamic(() => import("../ArcCredits").then((modul) => modul.ArcCredits), {
  ssr: false,
});

/**
 * Der Abspann, überall dort, wo man ihn einstellt.
 *
 * Dieselben Felder braucht man an zwei Stellen: am Ende einer Saga und am Ende
 * eines Arcs. Zwei Kopien wären zwei Baustellen - deshalb liegen sie hier.
 *
 * Wichtig ist der Knopf ganz unten: „Abspann proben" spielt ihn genau so, wie
 * er später laufen wird, ohne dass dafür etwas gespeichert werden muss. Ein
 * Abspann lässt sich nicht ausdenken; ob der Wagen passt, ob die Häuser die
 * richtigen sind und ob der Song zu kurz ist, sieht man in zehn Sekunden.
 */
export function AbspannFeld({
  abspann,
  onAendern,
  titel,
  einleitung = "",
}: {
  abspann: AbspannVorgabe | undefined;
  onAendern: (abspann: AbspannVorgabe | undefined) => void;
  /** Überschrift für die Probe. */
  titel: string;
  /** Ein Satz darüber, was dieser Abspann im Spiel bedeutet. */
  einleitung?: string;
}) {
  const { autos } = useAutos();
  const [probe, setProbe] = useState(false);

  const wert: AbspannVorgabe = abspann ?? neuerAbspann("keiner");
  const setzen = (teil: Partial<AbspannVorgabe>) => onAendern({ ...wert, ...teil });
  const modelle = abspannModelle(wert);

  const artWaehlen = (art: AbspannArt) => {
    // Beim ersten Anwählen kommt ein fertiger Abspann - mit Wimpy, einem
    // Begleiter und dem Startwagen. Wer schon etwas eingestellt hat, behält es.
    if (art !== "keiner" && !abspann) {
      onAendern(neuerAbspann(art));
      return;
    }
    setzen({ art });
  };

  return (
    <div className="kampf-feld">
      {einleitung && <p className="leise klein">{einleitung}</p>}

      <div className="wahl-reihe">
        {ABSPANN_ARTEN.map((art) => (
          <button
            key={art.id}
            type="button"
            className="wahl-chip"
            data-aktiv={wert.art === art.id}
            onClick={() => artWaehlen(art.id)}
          >
            <strong>{art.label}</strong>
            <span className="leise klein">{art.hinweis}</span>
          </button>
        ))}
      </div>

      {wert.art !== "keiner" && (
        <>
          <p className="leise klein">{abspannZeile(wert)}</p>

          {/* Der Song ist die Uhr des Abspanns: Er endet mit dem letzten Ton. */}
          <SongWahl
            wert={wert.song}
            onAendern={(song) => setzen({ song })}
            beschriftung="Song · er bestimmt die Länge"
            leerText="Noch kein Song - ohne ihn läuft kein Abspann"
          />

          {wert.art === "strassenfahrt" && (
            <>
              <h4 className="unter-abschnitt">
                Wer fährt <span className="leise">· zwei Tiere steigen ein</span>
              </h4>
              {[0, 1].map((nr) => (
                <label className="feld" key={nr}>
                  <span className="leise klein">
                    {nr === 0 ? "Am Steuer" : "Auf dem Beifahrersitz"}
                  </span>
                  <select
                    value={modelle[nr] ?? ""}
                    onChange={(e) => {
                      const neu = [...modelle];
                      neu[nr] = e.target.value;
                      setzen({ modelle: neu });
                    }}
                  >
                    {ANIMATIONS_MODELLE.map((modell) => (
                      <option key={modell.id} value={modell.id}>
                        {modell.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="feld">
                <span className="leise klein">Der Wagen · aus dem Autokatalog</span>
                <select value={wert.autoId} onChange={(e) => setzen({ autoId: e.target.value })}>
                  {autos.map((auto) => (
                    <option key={auto.id} value={auto.id}>
                      {auto.name}
                    </option>
                  ))}
                </select>
              </label>

              <JagdWeltFeld
                welt={wert}
                onAendern={(teil) => setzen(teil)}
                titel="Die Straße · dieselbe wie in der Verfolgungsjagd"
                hinweisLeer="Nichts gewählt - dann fahren sie durch die Landschaft, die zum Belag gehört."
              />
            </>
          )}

          {wert.art === "rolle" && (
            <label className="feld">
              <span className="leise">
                Der Text, der hochläuft · eine Zeile je Eintrag
              </span>
              <textarea
                rows={5}
                maxLength={4000}
                value={wert.text}
                onChange={(e) => setzen({ text: e.target.value })}
                placeholder={"Nach einer wahren Begebenheit\nBuch und Regie: Wimpy\nTiere: alle, die mitgespielt haben"}
              />
            </label>
          )}

          <div className="knopf-reihe">
            <button
              type="button"
              className="knopf klein"
              disabled={!abspannSpielbar(wert)}
              onClick={() => setProbe(true)}
            >
              🎬 Abspann proben
            </button>
            <button type="button" className="knopf klein" onClick={() => onAendern(undefined)}>
              Abspann entfernen
            </button>
          </div>
        </>
      )}

      {probe && abspannSpielbar(wert) && (
        <div className="jagd-vorschau">
          {wert.art === "strassenfahrt" ? (
            <StrassenCredits
              vorgabe={wert}
              titel={`${titel} · Probe`}
              weiterText="Probe schließen"
              onFertig={() => setProbe(false)}
            />
          ) : (
            <ArcCredits
              titel={`${titel} · Probe`}
              text={wert.text}
              song={wert.song}
              onFertig={() => setProbe(false)}
            />
          )}
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
