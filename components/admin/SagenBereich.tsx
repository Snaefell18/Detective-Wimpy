"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminStore";
import { akteLesen, akteSchreiben, bogenLesen, bogenSchreiben } from "@/lib/akte";
import { leererFall } from "@/lib/leereAkte";
import type { Bogen } from "@/lib/sagaBogen";
import { alsStaedte } from "@/lib/csv";
import { ladeSagas, loescheSaga, speichereSaga } from "@/lib/db";
import { erzeugeSaga } from "@/lib/sagaErzeugen";
import {
  STANDARD_SAGA_VORGABEN,
  type Erzaehlerteil,
  type Saga,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import type { CaseFile, PublicCase } from "@/lib/types";
import { ErzaehlerFeld } from "./ErzaehlerFeld";
import { FallEditor } from "./FallEditor";
import { SagaVorgabenFelder } from "./SagaVorgabenFelder";
import type { BereichProps } from "./typen";





/**
 * Sagas: mehrere Fälle mit gemeinsamem Überthema, danach ein Finale.
 *
 * Das Erzeugen läuft in vielen kleinen Aufrufen (Bogen, dann jedes Kapitel in
 * drei Schritten), damit nichts in das Zeitlimit der Plattform läuft. Danach
 * lassen sich Erzählertexte und Tondateien hier von Hand nachbessern.
 */
export function SagenBereich({ onMeldung, onFehler }: BereichProps) {
  const stammdaten = useStammdaten();
  const { daten: admin } = useAdmin();
  const [sagas, setSagas] = useState<Saga[] | null>(null);
  const [vorgaben, setVorgaben] = useState<SagaVorgaben>(STANDARD_SAGA_VORGABEN);
  const [laeuft, setLaeuft] = useState(false);
  const [schritt, setSchritt] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  /** Geöffneter Kapitelfall: welche Saga, welches Kapitel (-1 = Finale). */
  const [akte, setAkte] = useState<
    { saga: Saga; index: number; fall: CaseFile } | null
  >(null);
  /** Geöffneter Bogen einer Saga - Drahtzieher, Wahrheit, Enthüllungen. */
  const [bogen, setBogen] = useState<{ saga: Saga; bogen: Bogen } | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const staedte = alsStaedte(stammdaten.orte);

  const laden = () =>
    ladeSagas()
      .then(({ daten, ausCache }) => {
        setSagas(daten);
        if (ausCache && daten.length === 0) {
          onFehler("Keine Verbindung zur Datenbank - gespeicherte Sagas fehlen hier.");
        }
      })
      .catch(() => {
        setSagas([]);
        onFehler("Die Sagas konnten nicht geladen werden.");
      });

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setzen = (teil: Partial<SagaVorgaben>) =>
    setVorgaben((alt) => ({ ...alt, ...teil }));

  const erzeugen = async () => {
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
      await laden();
      onMeldung(`Saga „${saga.name}“ gespeichert - ${saga.kapitel.length} Kapitel und Finale.`);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Die Saga konnte nicht erzeugt werden.",
      );
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  /** Erzählertext oder Tondatei einer gespeicherten Saga ändern. */
  const erzaehlerAendern = async (
    saga: Saga,
    stelle: "auftakt" | "finale" | "epilog" | number,
    teil: Partial<Erzaehlerteil>,
  ) => {
    const kopie: Saga = JSON.parse(JSON.stringify(saga));
    if (stelle === "auftakt") kopie.auftakt = { ...kopie.auftakt, ...teil };
    else if (stelle === "finale")
      kopie.finale.erzaehler = { ...kopie.finale.erzaehler, ...teil };
    else if (stelle === "epilog") kopie.finale.epilog = { ...kopie.finale.epilog, ...teil };
    else kopie.kapitel[stelle].erzaehler = { ...kopie.kapitel[stelle].erzaehler, ...teil };

    setSagas((alt) => (alt ?? []).map((s) => (s.id === kopie.id ? kopie : s)));
    try {
      await speichereSaga(kopie);
    } catch {
      onFehler("Die Änderung konnte nicht gespeichert werden.");
    }
  };

  /* --- Akten und Bogen bearbeiten ---------------------------------- */

  const akteOeffnen = async (saga: Saga, index: number) => {
    const quelle = index < 0 ? saga.finale : saga.kapitel[index];
    if (!quelle?.siegel) {
      onFehler("Zu diesem Kapitel gehört kein Fall.");
      return;
    }
    onFehler(null);
    try {
      setAkte({ saga, index, fall: await akteLesen(quelle.siegel) });
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Die Akte ließ sich nicht öffnen.");
    }
  };

  const akteSpeichern = async (fall: CaseFile) => {
    if (!akte) return;
    setSpeichert(true);
    onFehler(null);
    try {
      const versiegelt = await akteSchreiben(fall);
      const kopie: Saga = JSON.parse(JSON.stringify(akte.saga));
      const ziel: { fall: PublicCase | null; siegel: string | null } =
        akte.index < 0 ? kopie.finale : kopie.kapitel[akte.index];
      ziel.fall = versiegelt.fall;
      ziel.siegel = versiegelt.siegel;
      await speichereSaga(kopie);
      await laden();
      setAkte(null);
      onMeldung("Akte gespeichert.");
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Die Akte ließ sich nicht speichern.");
    } finally {
      setSpeichert(false);
    }
  };

  /** Eine ganze Saga ohne Modell anlegen - alles Weitere schreibt man selbst. */
  const sagaVonHand = async (stadt: string) => {
    const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);
    if (verdaechtige.length < 3) {
      onFehler("Eine Saga braucht mindestens drei Verdächtige.");
      return;
    }
    setLaeuft(true);
    onFehler(null);
    try {
      const drahtzieher = verdaechtige[0];
      const andere = verdaechtige.filter((c) => c.id !== drahtzieher.id);
      const anzahl = vorgaben.kapitelAnzahl;

      setSchritt("Bogen wird angelegt …");
      const rohBogen: Bogen = {
        id: crypto.randomUUID(),
        name: vorgaben.name.trim() || "Neue Saga",
        thema: vorgaben.thema || "Noch offen.",
        klappentext: "Hier steht, worum es geht.",
        vorgaben,
        besetzung: stammdaten.charaktere,
        drahtzieherId: drahtzieher.id,
        drahtzieherName: drahtzieher.name,
        wahrheit: "Noch offen.",
        drahtzieherMotiv: "Noch offen.",
        auftaktText: "Es beginnt mit einer Kleinigkeit.",
        schlagworte: ["Schatten", "Verrat", "Wahrheit"],
        kapitel: Array.from({ length: anzahl }, (_, i) => ({
          nummer: i + 1,
          name: `Kapitel ${i + 1}`,
          teaser: "",
          erzaehlerText: "Und dann geschah es wieder.",
          auftrag: "Noch offen.",
          enthuellung: "Noch offen.",
          taeterId:
            andere.find((c) => c.id === vorgaben.kapitelTaeter?.[i])?.id ??
            andere[i % andere.length].id,
          stadt: vorgaben.kapitelStaedte[i] || "zufall",
        })),
        finale: {
          frage: "Wer steckt hinter allem?",
          auftrag: "Noch offen.",
          erzaehlerText: "Alle Fäden laufen zusammen.",
          epilogText: "Und so war es also.",
          stadt: vorgaben.kapitelStaedte[anzahl] || "zufall",
        },
        erstelltAm: Date.now(),
      };
      const bogenSiegel = await bogenSchreiben(rohBogen);

      const leeresKapitel = async (nummer: number) => {
        setSchritt(`Fall ${nummer} von ${anzahl + 1} wird angelegt …`);
        const roh = leererFall({
          charaktere: stammdaten.charaktere,
          orte: stammdaten.orte,
          items: stammdaten.items,
          stadt,
        });
        if (!roh) throw new Error("Für diese Stadt fehlen Schauplätze, Tiere oder Gegenstände.");
        return akteSchreiben(roh);
      };

      const kapitel = [];
      for (let i = 0; i < anzahl; i++) {
        const gebaut = await leeresKapitel(i + 1);
        kapitel.push({
          nummer: i + 1,
          name: rohBogen.kapitel[i].name,
          teaser: "",
          erzaehler: { text: rohBogen.kapitel[i].erzaehlerText, audio: "" },
          fall: gebaut.fall,
          siegel: gebaut.siegel,
        });
      }
      const finale = await leeresKapitel(anzahl + 1);

      await speichereSaga({
        id: rohBogen.id,
        name: rohBogen.name,
        thema: rohBogen.thema,
        klappentext: rohBogen.klappentext,
        // Ohne Drahtzieher und Kapiteltäter: Die Vorgaben liegen offen in der
        // Datenbank, die Lösung steht im versiegelten Bogen.
        vorgaben: { ...vorgaben, drahtzieherId: "", kapitelTaeter: [] },
        schlagworte: rohBogen.schlagworte,
        auftakt: { text: rohBogen.auftaktText, audio: "" },
        kapitel,
        finale: {
          erzaehler: { text: rohBogen.finale.erzaehlerText, audio: "" },
          frage: rohBogen.finale.frage,
          epilog: { text: rohBogen.finale.epilogText, audio: "" },
          fall: finale.fall,
          siegel: finale.siegel,
        },
        bogenSiegel,
        erstelltAm: Date.now(),
      });
      await laden();
      onMeldung(`Leere Saga „${rohBogen.name}“ angelegt - jetzt Bogen und Fälle ausfüllen.`);
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Die Saga ließ sich nicht anlegen.");
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  const bogenOeffnen = async (saga: Saga) => {
    onFehler(null);
    try {
      setBogen({ saga, bogen: await bogenLesen(saga.bogenSiegel) });
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Der Bogen ließ sich nicht öffnen.");
    }
  };

  const bogenSpeichern = async () => {
    if (!bogen) return;
    setSpeichert(true);
    onFehler(null);
    try {
      const siegel = await bogenSchreiben(bogen.bogen);
      const kopie: Saga = JSON.parse(JSON.stringify(bogen.saga));
      kopie.bogenSiegel = siegel;
      kopie.thema = bogen.bogen.thema;
      kopie.klappentext = bogen.bogen.klappentext;
      kopie.schlagworte = bogen.bogen.schlagworte;
      kopie.name = bogen.bogen.name || kopie.name;
      await speichereSaga(kopie);
      await laden();
      setBogen(null);
      onMeldung("Bogen gespeichert.");
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Der Bogen ließ sich nicht speichern.");
    } finally {
      setSpeichert(false);
    }
  };

  if (akte) {
    const titel =
      akte.index < 0
        ? "Finalfall"
        : `Kapitel ${akte.index + 1}: ${akte.saga.kapitel[akte.index].name}`;
    return (
      <>
        <h2 className="abschnitt">
          {akte.saga.name} · {titel}
        </h2>
        <FallEditor
          fall={akte.fall}
          alleCharaktere={stammdaten.charaktere}
          alleOrte={stammdaten.orte}
          alleItems={stammdaten.items}
          laeuft={speichert}
          onSpeichern={(fall) => void akteSpeichern(fall)}
          onAbbrechen={() => setAkte(null)}
        />
      </>
    );
  }

  if (bogen) {
    const b = bogen.bogen;
    const setzeBogen = (teil: Partial<Bogen>) =>
      setBogen({ ...bogen, bogen: { ...b, ...teil } });
    const kapitelSetzen = (i: number, teil: Partial<Bogen["kapitel"][number]>) =>
      setzeBogen({ kapitel: b.kapitel.map((k, j) => (j === i ? { ...k, ...teil } : k)) });
    const verdaechtigeDerSaga = b.besetzung.filter((c) => !c.istDetektiv);

    return (
      <>
        <h2 className="abschnitt">Bogen: {b.name}</h2>
        <p className="leise">
          Das Geheimnis hinter der Saga. Der Drahtzieher darf in keinem Kapitel
          der Täter sein - sonst wird nicht gespeichert.
        </p>

        <label className="feld">
          <span className="leise">Name der Saga</span>
          <input value={b.name} onChange={(e) => setzeBogen({ name: e.target.value })} maxLength={120} />
        </label>

        <label className="feld">
          <span className="leise">Überthema</span>
          <textarea rows={3} value={b.thema} onChange={(e) => setzeBogen({ thema: e.target.value })} maxLength={2000} />
        </label>

        <label className="feld">
          <span className="leise">Klappentext · steht in der Auswahlliste</span>
          <textarea rows={3} value={b.klappentext} onChange={(e) => setzeBogen({ klappentext: e.target.value })} maxLength={2000} />
        </label>

        <label className="feld">
          <span className="leise">
            Vorspann-Schlagworte · je ein Wort pro Bildschirm, mit Komma getrennt
          </span>
          <input
            value={(b.schlagworte ?? []).join(", ")}
            onChange={(e) =>
              setzeBogen({
                schlagworte: e.target.value
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              })
            }
            placeholder="Nebel, Verrat, Gold, Schweigen"
            maxLength={200}
          />
        </label>

        <h3 className="unter-abschnitt">
          Drahtzieher <span className="leise">· sieht der Spieler nie</span>
        </h3>
        <div className="marken-reihe">
          {verdaechtigeDerSaga.map((c) => (
            <button
              key={c.id}
              className="marke-knopf"
              data-aktiv={b.drahtzieherId === c.id}
              onClick={() => setzeBogen({ drahtzieherId: c.id, drahtzieherName: c.name })}
            >
              {c.name}
            </button>
          ))}
        </div>

        <label className="feld">
          <span className="leise">Die Wahrheit hinter allem</span>
          <textarea rows={4} value={b.wahrheit} onChange={(e) => setzeBogen({ wahrheit: e.target.value })} maxLength={4000} />
        </label>

        <label className="feld">
          <span className="leise">Motiv des Drahtziehers</span>
          <textarea rows={3} value={b.drahtzieherMotiv} onChange={(e) => setzeBogen({ drahtzieherMotiv: e.target.value })} maxLength={2000} />
        </label>

        {b.kapitel.map((k, i) => (
          <div className="kapitel-block" key={k.nummer}>
            <h4 className="unter-abschnitt">Kapitel {k.nummer}</h4>
            <label className="feld">
              <span className="leise">Name</span>
              <input value={k.name} onChange={(e) => kapitelSetzen(i, { name: e.target.value })} maxLength={120} />
            </label>
            <label className="feld">
              <span className="leise">Anriss für die Übersicht</span>
              <input value={k.teaser} onChange={(e) => kapitelSetzen(i, { teaser: e.target.value })} maxLength={400} />
            </label>
            <label className="feld">
              <span className="leise">Auftrag · wovon der Fall handelt</span>
              <textarea rows={2} value={k.auftrag} onChange={(e) => kapitelSetzen(i, { auftrag: e.target.value })} maxLength={2000} />
            </label>
            <label className="feld">
              <span className="leise">Enthüllung · was dieses Kapitel preisgibt</span>
              <textarea rows={2} value={k.enthuellung} onChange={(e) => kapitelSetzen(i, { enthuellung: e.target.value })} maxLength={2000} />
            </label>
            <span className="leise klein">Täter dieses Kapitels</span>
            <div className="marken-reihe">
              {verdaechtigeDerSaga
                .filter((c) => c.id !== b.drahtzieherId)
                .map((c) => (
                  <button
                    key={c.id}
                    className="marke-knopf"
                    data-aktiv={k.taeterId === c.id}
                    onClick={() => kapitelSetzen(i, { taeterId: c.id })}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        ))}

        <div className="kapitel-block">
          <h4 className="unter-abschnitt">Finale</h4>
          <label className="feld">
            <span className="leise">Frage · steht groß über dem Finale</span>
            <input
              value={b.finale.frage}
              onChange={(e) => setzeBogen({ finale: { ...b.finale, frage: e.target.value } })}
              maxLength={200}
            />
          </label>
          <label className="feld">
            <span className="leise">Auftrag des Finalfalls</span>
            <textarea
              rows={3}
              value={b.finale.auftrag}
              onChange={(e) => setzeBogen({ finale: { ...b.finale, auftrag: e.target.value } })}
              maxLength={2000}
            />
          </label>
        </div>

        <div className="knopf-reihe" style={{ marginTop: 12 }}>
          <button className="knopf aktion" onClick={() => void bogenSpeichern()} disabled={speichert}>
            {speichert ? "Wird versiegelt …" : "Bogen speichern"}
          </button>
          <button className="knopf" onClick={() => setBogen(null)} disabled={speichert}>
            Abbrechen
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="leise">
        Eine Saga ist eine Reihe von Fällen mit einem gemeinsamen Überthema, das
        sich Kapitel für Kapitel enthüllt. Am Ende steht ein Finale, in dem der
        Drahtzieher hinter allem gefunden werden muss. Zwischen den Kapiteln
        spricht der Erzähler - den Ton dazu legst du danach in /public/audio ab
        und trägst den Pfad hier ein.
      </p>

      <h2 className="abschnitt">Neue Saga vorbereiten</h2>

      <SagaVorgabenFelder vorgaben={vorgaben} onAendern={setzen} />

      <button
        className="knopf aktion"
        style={{ marginTop: 16 }}
        onClick={() => void erzeugen()}
        disabled={laeuft || !admin}
      >
        {laeuft ? "Die Saga entsteht …" : "Saga erzeugen und speichern"}
      </button>

      {laeuft && (
        <p className="leise klein" style={{ marginTop: 8 }}>
          {schritt ?? "Es geht gleich los …"}
          <br />
          Das dauert je nach Länge mehrere Minuten. Bitte den Bildschirm
          anlassen - sperrt sich das Handy, bricht die Verbindung ab.
        </p>
      )}

      <h3 className="unter-abschnitt">
        Oder von Hand <span className="leise">· ohne Modell, alles selbst schreiben</span>
      </h3>
      <div className="marken-reihe">
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="marke-knopf"
            disabled={laeuft}
            onClick={() => void sagaVonHand(stadt.name)}
          >
            Leere Saga in {stadt.name}
          </button>
        ))}
      </div>

      <h2 className="abschnitt">Gespeicherte Sagas ({sagas?.length ?? 0})</h2>

      {sagas === null && <p className="leise">Wird geladen …</p>}

      {sagas?.map((saga) => (
        <div key={saga.id} className="saga-karte">
          <button
            className="saga-kopf"
            onClick={() => setOffen(offen === saga.id ? null : saga.id)}
          >
            <div>
              <strong>{saga.name}</strong>
              <span className="leise klein">
                {saga.kapitel.length} Kapitel · {saga.klappentext}
              </span>
            </div>
            <span className="leise">{offen === saga.id ? "▾" : "▸"}</span>
          </button>

          {offen === saga.id && (
            <div className="saga-inhalt">
              <div className="knopf-reihe">
                <button className="knopf klein" onClick={() => void bogenOeffnen(saga)}>
                  Bogen bearbeiten
                </button>
              </div>

              <ErzaehlerFeld
                titel="Auftakt"
                teil={saga.auftakt}
                onAendern={(t) => void erzaehlerAendern(saga, "auftakt", t)}
              />

              {saga.kapitel.map((k, i) => (
                <div key={k.nummer}>
                  <ErzaehlerFeld
                    titel={`Kapitel ${k.nummer}: ${k.name}`}
                    hinweis={k.fall ? k.fall.titel : "Kein Fall hinterlegt"}
                    teil={k.erzaehler}
                    onAendern={(t) => void erzaehlerAendern(saga, i, t)}
                  />
                  <button className="knopf klein" onClick={() => void akteOeffnen(saga, i)}>
                    Fall dieses Kapitels bearbeiten
                  </button>
                </div>
              ))}

              <ErzaehlerFeld
                titel="Vor dem Finale"
                hinweis={saga.finale.fall?.titel ?? "Kein Finalfall hinterlegt"}
                teil={saga.finale.erzaehler}
                onAendern={(t) => void erzaehlerAendern(saga, "finale", t)}
              />

              <button
                className="knopf klein"
                onClick={() => void akteOeffnen(saga, -1)}
                style={{ marginBottom: 12 }}
              >
                Finalfall bearbeiten
              </button>

              <ErzaehlerFeld
                titel="Epilog"
                teil={saga.finale.epilog}
                onAendern={(t) => void erzaehlerAendern(saga, "epilog", t)}
              />

              <button
                className="knopf klein"
                onClick={async () => {
                  if (!window.confirm(`Saga „${saga.name}“ löschen?`)) return;
                  try {
                    await loescheSaga(saga.id);
                    await laden();
                    onMeldung("Saga gelöscht.");
                  } catch {
                    onFehler("Die Saga konnte nicht gelöscht werden.");
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
