"use client";

import { useEffect, useState } from "react";
import { akteLesen } from "@/lib/akte";
import { falscheFaehrteVon } from "@/lib/sagaTypen";
import type { Saga } from "@/lib/sagaTypen";
import type { CaseClue, CaseFile } from "@/lib/types";

/**
 * Alle Beweise einer Saga auf einen Blick.
 *
 * Sie liegen sonst verstreut in den Akten der einzelnen Kapitel, jede hinter
 * ihrem eigenen Siegel - und seit die Beweismitteltasche über die ganze Saga
 * gilt, ist genau das die Frage, die man beantworten will: Was findet der
 * Spieler unterwegs, worauf zeigt es, und bleibt am Ende genug übrig, um vor
 * Gericht etwas zu beweisen?
 *
 * Hier steht das nebeneinander, mit Rolle und Wortlaut, und ändern lässt sich
 * beides. Gespeichert wird kapitelweise: Jede Akte wandert einzeln wieder ins
 * Siegel zurück.
 */
type Rolle = "taeter" | "irre" | "fern" | "beiwerk";

const ROLLEN: Record<Rolle, { wort: string; hinweis: string }> = {
  taeter: { wort: "Täter", hinweis: "zeigt auf den Täter dieses Kapitels" },
  irre: { wort: "Falsche Fährte", hinweis: "sieht belastend aus, beweist nichts" },
  fern: { wort: "Fernwirkung", hinweis: "zeigt über das Kapitel hinaus - zählt vor Gericht" },
  beiwerk: { wort: "Beiwerk", hinweis: "belegt eine Einzelheit, mehr nicht" },
};

const rolleVon = (spur: CaseClue, taeterId: string): Rolle => {
  if (spur.fernwirkung) return "fern";
  if (spur.fuehrtInDieIrre) return "irre";
  if (spur.zeigtAufCharakterId === taeterId) return "taeter";
  return "beiwerk";
};

/** Eine geöffnete Akte samt ihrer Stelle in der Saga. */
type Blatt = {
  /** Kapitelindex, -1 fürs Finale. */
  index: number;
  titel: string;
  fall: CaseFile;
  /** Ungespeicherte Änderungen? */
  geaendert: boolean;
};

export function BeweisUebersicht({
  saga,
  onSpeichern,
  onSchliessen,
  onFehler,
  onMeldung,
}: {
  saga: Saga;
  /** Eine geänderte Akte zurück ins Siegel - kapitelweise. */
  onSpeichern: (index: number, fall: CaseFile) => Promise<void>;
  onSchliessen: () => void;
  onFehler: (text: string | null) => void;
  onMeldung: (text: string) => void;
}) {
  const [blaetter, setBlaetter] = useState<Blatt[] | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState<number | null>(null);

  useEffect(() => {
    let aktiv = true;
    const stellen: { index: number; titel: string; siegel: string }[] = [
      ...saga.kapitel.map((k, i) => ({
        index: i,
        titel: `Kapitel ${k.nummer}${k.name ? ` · ${k.name}` : ""}`,
        siegel: k.siegel ?? "",
      })),
      ...(saga.finale.siegel
        ? [{ index: -1, titel: "Finalfall", siegel: saga.finale.siegel }]
        : []),
    ].filter((s) => s.siegel);

    void (async () => {
      const geladen: Blatt[] = [];
      for (const stelle of stellen) {
        try {
          const fall = await akteLesen(stelle.siegel);
          geladen.push({ index: stelle.index, titel: stelle.titel, fall, geaendert: false });
        } catch {
          // Eine Akte, die sich nicht öffnen lässt, fehlt eben - der Rest
          // soll trotzdem zu sehen sein.
        }
      }
      if (aktiv) setBlaetter(geladen);
    })();

    return () => {
      aktiv = false;
    };
  }, [saga]);

  const faehrte = falscheFaehrteVon(saga.vorgaben, saga.kapitel[0]?.fall?.besetzung ?? []);

  const spurAendern = (index: number, i: number, teil: Partial<CaseClue>) => {
    setBlaetter((alt) =>
      (alt ?? []).map((b) =>
        b.index === index
          ? {
              ...b,
              geaendert: true,
              fall: {
                ...b.fall,
                spuren: b.fall.spuren.map((s, j) => (j === i ? { ...s, ...teil } : s)),
              },
            }
          : b,
      ),
    );
  };

  const speichern = async (blatt: Blatt) => {
    setSpeichert(blatt.index);
    onFehler(null);
    try {
      await onSpeichern(blatt.index, blatt.fall);
      setBlaetter((alt) =>
        (alt ?? []).map((b) => (b.index === blatt.index ? { ...b, geaendert: false } : b)),
      );
      onMeldung(`${blatt.titel}: gespeichert.`);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Die Akte ließ sich nicht speichern.",
      );
    } finally {
      setSpeichert(null);
    }
  };

  /** Wie viele Stücke mit Fernwirkung die Saga insgesamt hergibt. */
  const fernGesamt = (blaetter ?? []).reduce(
    (summe, b) => summe + b.fall.spuren.filter((s) => s.fernwirkung).length,
    0,
  );

  return (
    <div className="overlay einblenden">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Beweise dieser Saga</h1>
          <p className="unterzeile">{saga.name}</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {blaetter === null && <p className="leise">Die Akten werden geöffnet …</p>}

          {blaetter && blaetter.length === 0 && (
            <p className="leise">
              Zu dieser Saga sind keine Akten hinterlegt - erst nach dem
              Erzeugen gibt es hier etwas zu sehen.
            </p>
          )}

          {blaetter && blaetter.length > 0 && (
            <>
              <p className="leise klein">
                Der Spieler kann über die ganze Saga hinweg sechs Stücke
                mitnehmen. Vor Gericht zählen nur die mit Fernwirkung - alles
                andere belegt bloß das Kapitel, in dem es liegt.
              </p>

              <div className={fernGesamt > 0 ? "pruefung" : "akte-probleme"}>
                <strong>
                  {fernGesamt} Stück{fernGesamt === 1 ? "" : "e"} mit Fernwirkung in{" "}
                  {blaetter.length} Akte{blaetter.length === 1 ? "" : "n"}
                </strong>
                {fernGesamt === 0 && (
                  <p className="leise klein">
                    Kein einziges Stück zeigt über sein Kapitel hinaus. Vor
                    Gericht hätte Wimpy nichts vorzulegen - hier lässt sich das
                    von Hand nachtragen: Häkchen bei „Fernwirkung“, und die
                    Bedeutung sagt, was es über den Drahtzieher beweist.
                  </p>
                )}
                {faehrte && (
                  <p className="leise klein">
                    Falsche Fährte der Saga: {faehrte.charakter.name}. Was auf
                    ihn zeigt, sollte „Führt in die Irre“ tragen.
                  </p>
                )}
              </div>
            </>
          )}

          {(blaetter ?? []).map((blatt) => {
            const taeterId = blatt.fall.taeterId;
            const namen = new Map(blatt.fall.besetzung.map((c) => [c.id, c.name]));
            const fern = blatt.fall.spuren.filter((s) => s.fernwirkung).length;

            return (
              <div key={blatt.index} className="saga-karte">
                <div className="saga-inhalt">
                  <h4 className="unter-abschnitt">
                    {blatt.titel}{" "}
                    <span className="leise">
                      · {blatt.fall.spuren.length} Spuren · Täter:{" "}
                      {namen.get(taeterId) ?? taeterId}
                    </span>
                  </h4>

                  {fern === 0 && blatt.index >= 0 && (
                    <p className="leise klein">
                      Dieses Kapitel hinterlässt nichts für das Finale.
                    </p>
                  )}

                  {blatt.fall.spuren.map((spur, i) => {
                    const rolle = rolleVon(spur, taeterId);
                    const id = `${blatt.index}-${i}`;
                    const name =
                      blatt.fall.items.find((it) => it.id === spur.itemId)?.name ??
                      spur.itemId;

                    return (
                      <div key={id} className="kapitel-block">
                        <button
                          className="saga-kopf"
                          onClick={() => setOffen(offen === id ? null : id)}
                        >
                          <div>
                            <strong>{name}</strong>
                            <span className="leise klein">
                              {ROLLEN[rolle].wort} · zeigt auf{" "}
                              {namen.get(spur.zeigtAufCharakterId) ??
                                spur.zeigtAufCharakterId}
                            </span>
                          </div>
                          <span className="leise">{offen === id ? "▾" : "▸"}</span>
                        </button>

                        {offen === id && (
                          <>
                            <p className="leise klein">{ROLLEN[rolle].hinweis}</p>

                            <label className="feld">
                              <span className="leise">
                                Beobachtung · das Einzige, was der Spieler liest
                              </span>
                              <textarea
                                rows={2}
                                value={spur.beobachtung ?? ""}
                                onChange={(e) =>
                                  spurAendern(blatt.index, i, {
                                    beobachtung: e.target.value,
                                  })
                                }
                                maxLength={1000}
                              />
                            </label>

                            <label className="feld">
                              <span className="leise">
                                Wimpys Vermutung · darf danebenliegen
                              </span>
                              <input
                                value={spur.vermutung ?? ""}
                                onChange={(e) =>
                                  spurAendern(blatt.index, i, { vermutung: e.target.value })
                                }
                                maxLength={300}
                              />
                            </label>

                            <label className="feld">
                              <span className="leise">
                                Bedeutung · sieht nur der Server, damit arbeitet das
                                Gericht
                              </span>
                              <textarea
                                rows={2}
                                value={spur.bedeutung}
                                onChange={(e) =>
                                  spurAendern(blatt.index, i, { bedeutung: e.target.value })
                                }
                                maxLength={1000}
                              />
                            </label>

                            <span className="leise klein">Zeigt auf</span>
                            <div className="marken-reihe">
                              {blatt.fall.besetzung
                                .filter((c) => !c.istDetektiv)
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    className="marke-knopf"
                                    data-aktiv={spur.zeigtAufCharakterId === c.id}
                                    onClick={() =>
                                      spurAendern(blatt.index, i, {
                                        zeigtAufCharakterId: c.id,
                                      })
                                    }
                                  >
                                    {c.name}
                                  </button>
                                ))}
                            </div>

                            <label className="schalter">
                              <input
                                type="checkbox"
                                checked={spur.fuehrtInDieIrre}
                                onChange={(e) =>
                                  spurAendern(blatt.index, i, {
                                    fuehrtInDieIrre: e.target.checked,
                                  })
                                }
                              />
                              <span>Führt in die Irre</span>
                            </label>

                            <label className="schalter">
                              <input
                                type="checkbox"
                                checked={spur.fernwirkung === true}
                                onChange={(e) =>
                                  spurAendern(blatt.index, i, {
                                    fernwirkung: e.target.checked,
                                  })
                                }
                              />
                              <span>Fernwirkung · zählt vor Gericht</span>
                            </label>
                          </>
                        )}
                      </div>
                    );
                  })}

                  <button
                    className="knopf klein aktion"
                    disabled={!blatt.geaendert || speichert !== null}
                    onClick={() => void speichern(blatt)}
                  >
                    {speichert === blatt.index
                      ? "Wird gespeichert …"
                      : blatt.geaendert
                        ? "Änderungen dieser Akte speichern"
                        : "Nichts geändert"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
