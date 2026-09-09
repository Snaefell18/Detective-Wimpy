"use client";

import { useEffect, useState } from "react";
import { Bild } from "@/components/Bild";
import { ladeZubehoer, loescheZubehoer, speichereZubehoer } from "@/lib/db";
import {
  LEERES_ZUBEHOER,
  VERITASERUM,
  WIRKUNGEN,
  wirkungVon,
  yen,
  type Wirkung,
  type Zubehoer,
} from "@/lib/zubehoer";
import type { BereichProps } from "./typen";

/**
 * Der Detektiv-Laden im Admin-Menü.
 *
 * Name, Beschreibung, Preis und Bild tippt man frei ein; die Wirkung wählt man
 * aus einer Liste. Diese Trennung ist Absicht: Ein Effekt muss im Spiel
 * wirklich etwas tun, und dafür braucht es Code. Alles, was in der Liste
 * steht, funktioniert garantiert - beliebig viele Gegenstände lassen sich
 * damit bauen, und für eine neue Idee kommt eine neue Wirkung dazu
 * (lib/zubehoer.ts).
 */
export function ZubehoerBereich({ onMeldung, onFehler }: BereichProps) {
  const [regal, setRegal] = useState<Zubehoer[] | null>(null);
  const [entwurf, setEntwurf] = useState<Zubehoer | null>(null);

  const laden = () =>
    ladeZubehoer()
      .then(({ daten }) => setRegal(daten.sort((a, b) => a.preis - b.preis)))
      .catch(() => {
        setRegal([]);
        onFehler("Der Laden konnte nicht geladen werden.");
      });

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aendern = (teil: Partial<Zubehoer>) =>
    setEntwurf((alt) => (alt ? { ...alt, ...teil } : alt));

  const sichern = async () => {
    if (!entwurf) return;
    const name = entwurf.name.trim();
    if (!name) {
      onFehler("Ohne Namen geht es nicht.");
      return;
    }
    onFehler(null);
    try {
      const id = entwurf.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      await speichereZubehoer({ ...entwurf, id, name, preis: Math.max(0, entwurf.preis) });
      setEntwurf(null);
      await laden();
      onMeldung(`„${name}“ steht jetzt im Laden.`);
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Das Speichern ging schief.");
    }
  };

  const loeschen = async (stueck: Zubehoer) => {
    if (!window.confirm(`„${stueck.name}“ wirklich aus dem Laden nehmen?`)) return;
    try {
      await loescheZubehoer(stueck.id);
      await laden();
      onMeldung(`„${stueck.name}“ ist weg.`);
    } catch {
      onFehler("Das Löschen ging schief.");
    }
  };

  return (
    <>
      <h2 className="abschnitt">Detektiv-Zubehör</h2>
      <p className="leise klein">
        Was hier steht, kann Wimpy im Laden kaufen - bezahlt wird mit dem, was
        er verdient: {yen(100)} für einen gelösten Fall, {yen(500)} für eine
        ganze Saga. Die Wirkung kommt aus einer festen Liste; jede davon tut im
        Spiel wirklich etwas.
      </p>

      {regal === null && <p className="leise">Wird geladen …</p>}

      {regal?.length === 0 && (
        <p className="leise">
          Noch nichts angelegt. Im Spiel steht trotzdem das Veritaserum im
          Regal - lege es hier an, wenn du Preis oder Text ändern willst.
        </p>
      )}

      {regal?.map((stueck) => (
        <div key={stueck.id} className="laden-stueck">
          <div className="laden-bild">
            <Bild src={stueck.bild} alt={stueck.name} platzhalter={stueck.name} />
          </div>
          <div className="laden-text">
            <div className="laden-kopf">
              <strong>{stueck.name}</strong>
              <span className="laden-preis">{yen(stueck.preis)}</span>
            </div>
            <p className="leise klein">
              {wirkungVon(stueck.wirkung)?.label ?? stueck.wirkung}
              {stueck.versteckt ? " · nicht im Laden" : ""}
            </p>
            <div className="knopf-reihe">
              <button className="knopf klein" onClick={() => setEntwurf(stueck)}>
                Bearbeiten
              </button>
              <button className="knopf klein rot" onClick={() => void loeschen(stueck)}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="knopf-reihe">
        <button className="knopf aktion" onClick={() => setEntwurf(LEERES_ZUBEHOER())}>
          Neues Zubehör
        </button>
        {!regal?.some((s) => s.id === VERITASERUM.id) && (
          <button
            className="knopf"
            onClick={() => setEntwurf({ ...VERITASERUM, erstelltAm: Date.now() })}
          >
            Veritaserum übernehmen
          </button>
        )}
      </div>

      {entwurf && (
        <div className="entwurf">
          <h3 className="unter-abschnitt">
            {entwurf.id ? `„${entwurf.name}“ bearbeiten` : "Neues Zubehör"}
          </h3>

          <label className="feld">
            <span className="leise">Name</span>
            <input
              value={entwurf.name}
              onChange={(e) => aendern({ name: e.target.value })}
              placeholder="z.B. Veritaserum"
              maxLength={80}
            />
          </label>

          <label className="feld">
            <span className="leise">Beschreibung · steht im Regal</span>
            <textarea
              rows={3}
              value={entwurf.beschreibung}
              onChange={(e) => aendern({ beschreibung: e.target.value })}
              maxLength={600}
            />
          </label>

          <label className="feld">
            <span className="leise">Preis in Yen</span>
            <input
              type="number"
              min={0}
              max={99999}
              value={entwurf.preis}
              onChange={(e) => aendern({ preis: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="feld">
            <span className="leise">Wirkung · was es im Spiel tut</span>
            <select
              value={entwurf.wirkung}
              onChange={(e) => aendern({ wirkung: e.target.value as Wirkung })}
            >
              {WIRKUNGEN.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} · {w.hinweis}
                </option>
              ))}
            </select>
          </label>
          <p className="leise klein">
            Einsetzbar {wirkungVon(entwurf.wirkung)?.wo === "gespraech"
              ? "im Gespräch mit einem Tier"
              : "am Schauplatz"}
            .
          </p>

          <label className="feld">
            <span className="leise">Bild · Pfad in /public/items</span>
            <input
              value={entwurf.bild}
              onChange={(e) => aendern({ bild: e.target.value })}
              placeholder="/items/veritaserum.png"
              maxLength={300}
            />
          </label>

          <label className="feld reihe">
            <input
              type="checkbox"
              checked={entwurf.versteckt ?? false}
              onChange={(e) => aendern({ versteckt: e.target.checked })}
            />
            <span>Vorerst nicht im Laden zeigen</span>
          </label>

          <div className="knopf-reihe">
            <button className="knopf aktion" onClick={() => void sichern()}>
              Speichern
            </button>
            <button className="knopf" onClick={() => setEntwurf(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
