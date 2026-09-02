"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminStore";
import {
  fertigeTeile,
  leererArc,
  mitAnzahl,
  naechsteLuecke,
  spielbar,
  type Arc,
  type ArcFinaleArt,
} from "@/lib/arcTypen";
import { ladeArcs, ladeSagas, loescheArc, speichereArc, speichereSaga } from "@/lib/db";
import { erzeugeSaga } from "@/lib/sagaErzeugen";
import {
  STANDARD_SAGA_VORGABEN,
  type Erzaehlerteil,
  type Saga,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import type { BereichProps } from "./typen";

/** Einer Station ihre Saga zuweisen - oder sie wieder freimachen. */
const mitSaga = (arc: Arc, index: number, sagaId: string): Arc => ({
  ...arc,
  teile: arc.teile.map((t, i) => (i === index ? { ...t, sagaId } : t)),
});

const ANZAHLEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const FINALE_ARTEN: { id: ArcFinaleArt; label: string; hinweis: string }[] = [
  { id: "text", label: "Abschlusstext", hinweis: "Erzähler, wie zwischen den Sagen" },
  {
    id: "gerichtsverhandlung",
    label: "Gerichtsverhandlung",
    hinweis: "noch nicht gebaut - läuft vorerst als Text",
  },
];

/**
 * Arcs: die Klammer über mehreren Sagen.
 *
 * Bewusst so gebaut, dass nichts am Stück entstehen muss. Man legt den Arc mit
 * Namen, Titelsong und der geplanten Zahl an Sagen an, erzeugt die erste Saga
 * - und kann sofort losspielen. Die übrigen Stationen füllt man später, auch
 * während schon jemand spielt: Der Spielstand liegt auf dem Gerät und liest
 * den Arc bei jedem Start neu.
 *
 * Eine Station kann ihre Saga auf zwei Wegen bekommen: frisch erzeugen (das
 * dauert Minuten) oder eine bereits gespeicherte Saga zuordnen.
 */
export function ArcsBereich({ onMeldung, onFehler }: BereichProps) {
  const stammdaten = useStammdaten();
  const { daten: admin } = useAdmin();
  const [arcs, setArcs] = useState<Arc[] | null>(null);
  const [sagas, setSagas] = useState<Saga[]>([]);
  const [entwurf, setEntwurf] = useState<Arc>(leererArc);
  const [offen, setOffen] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [schritt, setSchritt] = useState<string | null>(null);

  const laden = () =>
    Promise.all([ladeArcs(), ladeSagas()])
      .then(([a, s]) => {
        setArcs(a.daten);
        setSagas(s.daten);
        if (a.ausCache && a.daten.length === 0) {
          onFehler("Keine Verbindung zur Datenbank - gespeicherte Arcs fehlen hier.");
        }
      })
      .catch(() => {
        setArcs([]);
        onFehler("Die Arcs konnten nicht geladen werden.");
      });

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sichern = async (arc: Arc, meldung?: string) => {
    setArcs((alt) => (alt ?? []).map((a) => (a.id === arc.id ? arc : a)));
    try {
      await speichereArc(arc);
      if (meldung) onMeldung(meldung);
    } catch {
      onFehler("Die Änderung konnte nicht gespeichert werden.");
    }
  };

  const anlegen = async () => {
    const name = entwurf.name.trim();
    if (!name) {
      onFehler("Der Arc braucht einen Namen.");
      return;
    }
    const arc: Arc = { ...entwurf, id: crypto.randomUUID(), name, erstelltAm: Date.now() };
    try {
      await speichereArc(arc);
      setEntwurf(leererArc());
      await laden();
      setOffen(arc.id);
      onMeldung(`Arc „${arc.name}“ angelegt - jetzt die erste Saga erzeugen.`);
    } catch {
      onFehler("Der Arc konnte nicht gespeichert werden.");
    }
  };

  /**
   * Eine Saga für eine Station erzeugen.
   *
   * Sie entsteht ganz normal und liegt danach auch einzeln in der Sagenliste -
   * ein Arc verweist nur darauf. Als Überthema dient der Erzählertext der
   * Station, sonst der Klappentext des Arcs: So bleibt die Reihe zusammen,
   * ohne dass man alles doppelt eintippen muss.
   */
  const sagaErzeugen = async (arc: Arc, index: number) => {
    const teil = arc.teile[index];
    setLaeuft(true);
    onFehler(null);
    try {
      const vorgaben: SagaVorgaben = {
        ...STANDARD_SAGA_VORGABEN,
        name: `${arc.name} - ${teil.name}`,
        thema:
          [arc.klappentext.trim(), teil.erzaehler.text.trim()].filter(Boolean).join("\n\n") ||
          arc.name,
      };
      const saga = await erzeugeSaga(
        {
          charaktere: stammdaten.charaktere,
          orte: stammdaten.orte,
          items: stammdaten.items,
          vorgaben,
        },
        setSchritt,
      );
      await speichereSaga(saga);
      await speichereArc(mitSaga(arc, index, saga.id));
      await laden();
      onMeldung(`Saga „${saga.name}“ steht jetzt in ${teil.name}.`);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Die Saga konnte nicht erzeugt werden.",
      );
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  /* --- Entwurf ------------------------------------------------------- */

  const setzen = (teil: Partial<Arc>) => setEntwurf((alt) => ({ ...alt, ...teil }));

  return (
    <>
      <h2 className="abschnitt">Neuer Arc</h2>
      <p className="leise">
        Ein Arc fasst mehrere Sagen zu einer Reihe zusammen: eigener Titelsong,
        Erzählertext vor jeder Saga, großes Finale am Ende. Er muss nicht am
        Stück entstehen - eine Saga genügt, damit gespielt werden kann.
      </p>

      <label className="feld">
        <span className="leise">Name</span>
        <input
          value={entwurf.name}
          onChange={(e) => setzen({ name: e.target.value })}
          placeholder="Die Schatten über Kopenhagen"
          maxLength={120}
        />
      </label>

      <label className="feld">
        <span className="leise">Klappentext · steht in der Auswahlliste</span>
        <textarea
          rows={3}
          value={entwurf.klappentext}
          onChange={(e) => setzen({ klappentext: e.target.value })}
          maxLength={2000}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Titelsong in /public/audio (leer = der übliche Titelsong)
        </span>
        <input
          value={entwurf.themeSong}
          onChange={(e) => setzen({ themeSong: e.target.value })}
          placeholder="/audio/arc-theme.mp3"
          maxLength={200}
        />
      </label>

      <h3 className="unter-abschnitt">
        Wie viele Sagen <span className="leise">· später änderbar</span>
      </h3>
      <div className="wahl-reihe">
        {ANZAHLEN.map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={entwurf.sagenAnzahl === n}
            onClick={() => setEntwurf((alt) => mitAnzahl(alt, n))}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>

      <button
        className="knopf aktion"
        style={{ marginTop: 16 }}
        onClick={() => void anlegen()}
        disabled={laeuft || !admin}
      >
        Arc anlegen
      </button>

      <h2 className="abschnitt">Gespeicherte Arcs ({arcs?.length ?? 0})</h2>

      {arcs === null && <p className="leise">Wird geladen …</p>}

      {arcs?.length === 0 && <p className="leise">Noch kein Arc angelegt.</p>}

      {arcs?.map((arc) => (
        <div key={arc.id} className="saga-karte">
          <button
            className="saga-kopf"
            onClick={() => setOffen(offen === arc.id ? null : arc.id)}
          >
            <div>
              <strong>{arc.name}</strong>
              <span className="leise klein">
                {fertigeTeile(arc)} von {arc.teile.length} Sagen
                {spielbar(arc) ? " · spielbar" : " · noch nicht spielbar"}
              </span>
            </div>
            <span className="leise">{offen === arc.id ? "▾" : "▸"}</span>
          </button>

          {offen === arc.id && (
            <div className="saga-inhalt">
              <label className="feld">
                <span className="leise">Klappentext</span>
                <textarea
                  rows={3}
                  value={arc.klappentext}
                  onChange={(e) => void sichern({ ...arc, klappentext: e.target.value })}
                  maxLength={2000}
                />
              </label>

              <label className="feld">
                <span className="leise">Titelsong in /public/audio</span>
                <input
                  value={arc.themeSong}
                  onChange={(e) => void sichern({ ...arc, themeSong: e.target.value })}
                  placeholder="/audio/arc-theme.mp3"
                  maxLength={200}
                />
              </label>

              <h4 className="unter-abschnitt">
                Sagen im Arc <span className="leise">· 1 bis 10</span>
              </h4>
              <div className="wahl-reihe">
                {ANZAHLEN.map((n) => (
                  <button
                    key={n}
                    className="wahl-chip"
                    data-aktiv={arc.teile.length === n}
                    onClick={() => void sichern(mitAnzahl(arc, n))}
                  >
                    <strong>{n}</strong>
                  </button>
                ))}
              </div>

              {arc.teile.map((teil, i) => {
                const saga = sagas.find((s) => s.id === teil.sagaId);
                return (
                  <div key={teil.nummer} className="erzaehler-feld">
                    <h4 className="unter-abschnitt">
                      Teil {teil.nummer}{" "}
                      <span className="leise">
                        · {saga ? saga.name : "noch keine Saga"}
                      </span>
                    </h4>

                    <label className="feld">
                      <span className="leise">Überschrift der Station</span>
                      <input
                        value={teil.name}
                        onChange={(e) =>
                          void sichern({
                            ...arc,
                            teile: arc.teile.map((t, j) =>
                              j === i ? { ...t, name: e.target.value } : t,
                            ),
                          })
                        }
                        maxLength={120}
                      />
                    </label>

                    <ErzaehlerFeld
                      teil={teil.erzaehler}
                      onAendern={(neu) =>
                        void sichern({
                          ...arc,
                          teile: arc.teile.map((t, j) =>
                            j === i ? { ...t, erzaehler: { ...t.erzaehler, ...neu } } : t,
                          ),
                        })
                      }
                    />

                    <span className="leise">Saga dieser Station</span>
                    <div className="wahl-reihe">
                      <button
                        className="wahl-chip"
                        data-aktiv={!teil.sagaId}
                        onClick={() => void sichern(mitSaga(arc, i, ""))}
                      >
                        <strong>Keine</strong>
                      </button>
                      {sagas.map((s) => (
                        <button
                          key={s.id}
                          className="wahl-chip"
                          data-aktiv={teil.sagaId === s.id}
                          onClick={() => void sichern(mitSaga(arc, i, s.id))}
                        >
                          <strong>{s.name}</strong>
                          <span className="leise klein">{s.kapitel.length} Kapitel</span>
                        </button>
                      ))}
                    </div>

                    {!teil.sagaId && (
                      <button
                        className="knopf klein"
                        disabled={laeuft || !admin}
                        onClick={() => void sagaErzeugen(arc, i)}
                      >
                        Saga für diesen Teil erzeugen
                      </button>
                    )}
                  </div>
                );
              })}

              <h4 className="unter-abschnitt">Finale</h4>
              <div className="wahl-reihe">
                {FINALE_ARTEN.map((a) => (
                  <button
                    key={a.id}
                    className="wahl-chip"
                    data-aktiv={arc.finale.art === a.id}
                    onClick={() =>
                      void sichern({ ...arc, finale: { ...arc.finale, art: a.id } })
                    }
                  >
                    <strong>{a.label}</strong>
                    <span className="leise klein">{a.hinweis}</span>
                  </button>
                ))}
              </div>

              <ErzaehlerFeld
                teil={arc.finale.erzaehler}
                onAendern={(neu) =>
                  void sichern({
                    ...arc,
                    finale: {
                      ...arc.finale,
                      erzaehler: { ...arc.finale.erzaehler, ...neu },
                    },
                  })
                }
              />

              {laeuft && (
                <p className="leise klein">
                  {schritt ?? "Es geht gleich los …"}
                  <br />
                  Das dauert mehrere Minuten. Bitte den Bildschirm anlassen.
                </p>
              )}

              {!laeuft && naechsteLuecke(arc) && (
                <p className="leise klein">
                  Nächste Lücke: {naechsteLuecke(arc)?.name}. Gespielt werden kann
                  trotzdem schon, sobald der erste Teil eine Saga hat.
                </p>
              )}

              <button
                className="knopf klein"
                onClick={async () => {
                  if (!window.confirm(`Arc „${arc.name}“ löschen?`)) return;
                  try {
                    await loescheArc(arc.id);
                    await laden();
                    onMeldung("Arc gelöscht. Die Sagen darin bleiben erhalten.");
                  } catch {
                    onFehler("Der Arc konnte nicht gelöscht werden.");
                  }
                }}
              >
                Löschen
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/** Text und Tondatei eines Erzählerteils - wie bei den Sagen. */
function ErzaehlerFeld({
  teil,
  onAendern,
}: {
  teil: Erzaehlerteil;
  onAendern: (teil: Partial<Erzaehlerteil>) => void;
}) {
  return (
    <>
      <label className="feld">
        <span className="leise">Erzählertext</span>
        <textarea
          rows={4}
          value={teil.text}
          onChange={(e) => onAendern({ text: e.target.value })}
          maxLength={2000}
        />
      </label>
      <label className="feld">
        <span className="leise">Tondatei in /public/audio (leer = nur Text)</span>
        <input
          value={teil.audio}
          onChange={(e) => onAendern({ audio: e.target.value })}
          placeholder="/audio/arc-teil-1.mp3"
          maxLength={200}
        />
      </label>
    </>
  );
}
