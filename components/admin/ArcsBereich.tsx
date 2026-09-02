"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminStore";
import {
  besetzungFuerTeil,
  fertigeTeile,
  leererArc,
  mitAnzahl,
  naechsteLuecke,
  sagaAuftrag,
  spielbar,
  type Arc,
  type ArcCulprit,
  type ArcFinaleArt,
} from "@/lib/arcTypen";
import {
  istZugriffVerweigert,
  ladeArcs,
  ladeSagas,
  loescheArc,
  speichereArc,
  speichereSaga,
} from "@/lib/db";
import { erzeugeSaga } from "@/lib/sagaErzeugen";
import {
  STANDARD_SAGA_VORGABEN,
  type Saga,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import { nenntNamen } from "@/lib/namenSchutz";
import { ErzaehlerFeld } from "./ErzaehlerFeld";
import { SagaVorgabenFelder } from "./SagaVorgabenFelder";
import type { BereichProps } from "./typen";

/**
 * Die Vorgaben, mit denen die Saga einer Station startet.
 *
 * Was der Arc bestimmt, steht hier fest: das Überthema samt Culprit-Ansage,
 * die Besetzung (der Culprit bleibt bis zur letzten Station draußen) und im
 * letzten Teil der Drahtzieher samt Twist. Alles andere - Kapitelzahl,
 * Städte, Reifegrad, Ton, Schwierigkeit - wählt man danach im Formular wie
 * bei einer einzelnen Saga.
 */
export function vorgabenFuerTeil(
  arc: Arc,
  index: number,
  verdaechtigenIds: string[],
): SagaVorgaben {
  const letzte = index >= arc.teile.length - 1;
  return {
    ...STANDARD_SAGA_VORGABEN,
    name: `${arc.name} - ${arc.teile[index]?.name ?? `Teil ${index + 1}`}`,
    thema: sagaAuftrag(arc, index),
    charaktere: besetzungFuerTeil(arc, index, verdaechtigenIds),
    drahtzieherId: letzte ? arc.culprit.charakterId : "",
    twist: letzte && Boolean(arc.culprit.charakterId),
  };
}

/** Einer Station ihre Saga zuweisen - oder sie wieder freimachen. */
const mitSaga = (arc: Arc, index: number, sagaId: string): Arc => ({
  ...arc,
  teile: arc.teile.map((t, i) => (i === index ? { ...t, sagaId } : t)),
});

/**
 * Die Sammlung "arcs" ist neu. Wer seine Firestore-Regeln noch nicht neu
 * veröffentlicht hat, bekommt beim Lesen ein "permission-denied" - das sieht
 * aus wie ein Fehler, ist aber nur eine fehlende Zeile in der Regeldatei.
 */
const REGEL_HINWEIS = (fehler: unknown): string =>
  istZugriffVerweigert(fehler)
    ? "Die Datenbank lässt die Sammlung „arcs“ noch nicht zu. Bitte firestore.rules aus dem Projekt in der Firebase-Konsole neu veröffentlichen - danach erscheinen die Arcs."
    : "Die Arcs konnten nicht geladen werden.";

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
  /** Geöffnetes Saga-Formular: welcher Arc, welche Station, welche Vorgaben. */
  const [entwurfSaga, setEntwurfSaga] = useState<
    { arc: Arc; index: number; vorgaben: SagaVorgaben } | null
  >(null);

  const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);

  // Beide Sammlungen einzeln laden: Fehlt eine, soll die andere trotzdem da
  // sein - sonst stünde man vor einer leeren Seite, obwohl nur eine Kleinigkeit
  // klemmt.
  const laden = async () => {
    try {
      const { daten, ausCache } = await ladeArcs();
      setArcs(daten);
      if (ausCache && daten.length === 0) {
        onFehler("Keine Verbindung zur Datenbank - gespeicherte Arcs fehlen hier.");
      }
    } catch (fehler) {
      setArcs([]);
      onFehler(REGEL_HINWEIS(fehler));
    }
    try {
      setSagas((await ladeSagas()).daten);
    } catch {
      // Ohne die Sagenliste lässt sich nur nichts zuordnen - der Rest geht.
    }
  };

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sichern = async (arc: Arc, meldung?: string) => {
    setArcs((alt) => (alt ?? []).map((a) => (a.id === arc.id ? arc : a)));
    try {
      await speichereArc(arc);
      if (meldung) onMeldung(meldung);
    } catch (fehler) {
      onFehler(
        istZugriffVerweigert(fehler)
          ? REGEL_HINWEIS(fehler)
          : "Die Änderung konnte nicht gespeichert werden.",
      );
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
    } catch (fehler) {
      onFehler(
        istZugriffVerweigert(fehler)
          ? REGEL_HINWEIS(fehler)
          : "Der Arc konnte nicht gespeichert werden.",
      );
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
  const sagaErzeugen = async (arc: Arc, index: number, vorgaben: SagaVorgaben) => {
    const teil = arc.teile[index];
    setLaeuft(true);
    onFehler(null);
    try {
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
      setEntwurfSaga(null);
      onMeldung(`Saga „${saga.name}“ steht jetzt in ${teil.name}.`);
    } catch (fehler) {
      onFehler(
        istZugriffVerweigert(fehler)
          ? "Die Datenbank hat das Speichern abgelehnt. Meist fehlt die Sammlung „arcs“ in den veröffentlichten Firestore-Regeln - dann einmal firestore.rules aus dem Projekt neu veröffentlichen."
          : fehler instanceof Error
            ? fehler.message
            : "Die Saga konnte nicht erzeugt werden.",
      );
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  /* --- Entwurf ------------------------------------------------------- */

  const setzen = (teil: Partial<Arc>) => setEntwurf((alt) => ({ ...alt, ...teil }));

  /* --- Eine Saga für eine Station vorbereiten ------------------------ */

  if (entwurfSaga) {
    const { arc, index, vorgaben } = entwurfSaga;
    const teil = arc.teile[index];
    const letzte = index >= arc.teile.length - 1;
    const culprit = verdaechtige.find((c) => c.id === arc.culprit.charakterId);

    return (
      <>
        <h2 className="abschnitt">
          {arc.name} · {teil?.name ?? `Teil ${index + 1}`}
        </h2>
        <p className="leise">
          Dieselben Einstellungen wie bei einer einzelnen Saga - nur, dass der
          Arc schon einiges vorgibt. Was von ihm kommt, ist unten markiert und
          lässt sich trotzdem ändern.
        </p>

        {culprit && (
          <p className="hinweis">
            {letzte
              ? `Letzte Station: ${culprit.name} ist hier der Drahtzieher und tritt erst im Finale auf.`
              : `${culprit.name} bleibt in dieser Saga außen vor - er kommt nur als „${
                  arc.culprit.wort.trim() || "Wort für ihn"
                }“ vor und wird erst in der letzten Station enttarnt.`}
          </p>
        )}

        <SagaVorgabenFelder
          vorgaben={vorgaben}
          onAendern={(teilVorgaben) =>
            setEntwurfSaga((alt) =>
              alt ? { ...alt, vorgaben: { ...alt.vorgaben, ...teilVorgaben } } : alt,
            )
          }
          vomArc={{
            thema: "aus dem Arc",
            charaktere: culprit && !letzte ? "ohne den Culprit" : undefined,
            drahtzieherId: letzte && culprit ? "der Culprit des Arcs" : undefined,
            twist: letzte && culprit ? "der Culprit tritt erst im Finale auf" : undefined,
          }}
        />

        <div className="knopf-reihe" style={{ marginTop: 16 }}>
          <button
            className="knopf aktion"
            disabled={laeuft || !admin}
            onClick={() => void sagaErzeugen(arc, index, vorgaben)}
          >
            {laeuft ? "Die Saga entsteht …" : "Saga erzeugen und speichern"}
          </button>
          <button
            className="knopf klein"
            disabled={laeuft}
            onClick={() => setEntwurfSaga(null)}
          >
            Zurück
          </button>
        </div>

        {laeuft && (
          <p className="leise klein" style={{ marginTop: 8 }}>
            {schritt ?? "Es geht gleich los …"}
            <br />
            Das dauert je nach Länge mehrere Minuten. Bitte den Bildschirm
            anlassen - sperrt sich das Handy, bricht die Verbindung ab.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <h2 className="abschnitt">Neuer Arc</h2>
      <p className="leise">
        Ein Arc fasst mehrere Sagen zu einer Reihe zusammen: eigener Titelsong,
        Erzählertext vor jeder Saga, großes Finale am Ende. Er muss nicht am
        Stück entstehen - eine Saga genügt, damit gespielt werden kann.
      </p>

      <ArcFelder arc={entwurf} verdaechtige={verdaechtige} onAendern={setzen} />

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
              <ArcFelder
                arc={arc}
                verdaechtige={verdaechtige}
                onAendern={(teil) => void sichern({ ...arc, ...teil })}
              />

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
                        onClick={() =>
                          setEntwurfSaga({
                            arc,
                            index: i,
                            vorgaben: vorgabenFuerTeil(
                              arc,
                              i,
                              verdaechtige.map((c) => c.id),
                            ),
                          })
                        }
                      >
                        Saga für diesen Teil vorbereiten
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

/** Wo der Culprit beim Namen genannt wird - das verrät ihn zu früh. */
function verraeterisch(arc: Arc, name: string): string[] {
  const stellen: string[] = [];
  if (nenntNamen(arc.name, [name]).length) stellen.push("Der Name des Arcs");
  if (nenntNamen(arc.klappentext, [name]).length) stellen.push("der Klappentext");
  const teile = arc.teile
    .slice(0, -1)
    .filter((t) => nenntNamen(`${t.name}\n${t.erzaehler.text}`, [name]).length);
  if (teile.length) {
    stellen.push(`${teile.length === 1 ? "Teil" : "die Teile"} ${teile.map((t) => t.nummer).join(", ")}`);
  }
  return stellen;
}

/**
 * Die Angaben, die für den ganzen Arc gelten - beim Anlegen und später beim
 * Bearbeiten dieselben. Alles davon lässt sich jederzeit ändern; nur die Sagen,
 * die schon erzeugt wurden, wissen natürlich nichts von späteren Änderungen.
 */
function ArcFelder({
  arc,
  verdaechtige,
  onAendern,
}: {
  arc: Arc;
  verdaechtige: { id: string; name: string }[];
  onAendern: (teil: Partial<Arc>) => void;
}) {
  const setzeCulprit = (teil: Partial<ArcCulprit>) =>
    onAendern({ culprit: { ...arc.culprit, ...teil } });
  const gewaehlt = verdaechtige.find((c) => c.id === arc.culprit.charakterId);

  return (
    <>
      <label className="feld">
        <span className="leise">Name</span>
        <input
          value={arc.name}
          onChange={(e) => onAendern({ name: e.target.value })}
          placeholder="Die Schatten über Kopenhagen"
          maxLength={120}
        />
      </label>

      <label className="feld">
        <span className="leise">Klappentext · steht in der Auswahlliste</span>
        <textarea
          rows={3}
          value={arc.klappentext}
          onChange={(e) => onAendern({ klappentext: e.target.value })}
          maxLength={2000}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Worauf es hinausläuft · nur fürs Erzeugen, steht nie im Spiel
        </span>
        <textarea
          rows={3}
          value={arc.ziel}
          onChange={(e) => onAendern({ ziel: e.target.value })}
          placeholder="Am Ende stellt sich heraus, dass die halbe Stadt erpresst wurde - und die Spur führt in den Hafen."
          maxLength={2000}
        />
      </label>

      <h3 className="unter-abschnitt">
        Der Culprit hinter allem{" "}
        <span className="leise">· wird erst in der letzten Saga enttarnt</span>
      </h3>
      <div className="wahl-reihe">
        <button
          className="wahl-chip"
          data-aktiv={!arc.culprit.charakterId}
          onClick={() => setzeCulprit({ charakterId: "" })}
        >
          <strong>Offen</strong>
          <span className="leise klein">entscheidet sich später</span>
        </button>
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="wahl-chip"
            data-aktiv={arc.culprit.charakterId === c.id}
            onClick={() => setzeCulprit({ charakterId: c.id })}
          >
            <strong>{c.name}</strong>
          </button>
        ))}
      </div>

      <label className="feld">
        <span className="leise">
          Wort für ihn in den Texten · „Der Schattenkanzler war weiterhin auf der
          Flucht.“
        </span>
        <input
          value={arc.culprit.wort}
          onChange={(e) => setzeCulprit({ wort: e.target.value })}
          placeholder="Der Schattenkanzler"
          maxLength={120}
        />
      </label>

      {gewaehlt && (
        <p className="leise klein">
          Bis zur letzten Saga bleibt {gewaehlt.name} aus der Besetzung heraus und
          kommt nur als „{arc.culprit.wort.trim() || "…"}“ vor. In der letzten Saga
          ist er der Drahtzieher und betritt erst im Finale die Bühne.
        </p>
      )}

      {gewaehlt && verraeterisch(arc, gewaehlt.name).length > 0 && (
        <p className="hinweis">
          Achtung: {verraeterisch(arc, gewaehlt.name).join(" und ")} nennt
          {verraeterisch(arc, gewaehlt.name).length > 1 ? "" : "t"} {gewaehlt.name}
          {" "}beim Namen. Im Vorspann wird das herausgenommen - besser, du
          schreibst dort „{arc.culprit.wort.trim() || "das Wort für ihn"}“.
        </p>
      )}

      <label className="feld">
        <span className="leise">
          Titelsong in /public/audio (leer = der übliche Titelsong)
        </span>
        <input
          value={arc.themeSong}
          onChange={(e) => onAendern({ themeSong: e.target.value })}
          placeholder="/audio/arc-theme.mp3"
          maxLength={200}
        />
      </label>
    </>
  );
}
