"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminStore";
import { akteLesen, akteSchreiben, bogenLesen, bogenSchreiben } from "@/lib/akte";
import { leererFall } from "@/lib/leereAkte";
import type { Bogen } from "@/lib/sagaBogen";
import { alsStaedte } from "@/lib/csv";
import { postJson } from "@/lib/api";
import { ladeSagas, loescheSaga, speichereSaga } from "@/lib/db";
import { mitVerhandlung, type Verhandlung } from "@/lib/sagaFinale";
import { erzeugeSaga } from "@/lib/sagaErzeugen";
import { pruefeVorgaben } from "@/lib/sagaPruefung";
import {
  STANDARD_SAGA_VORGABEN,
  videoFuerKapitel,
  type Erzaehlerteil,
  type Saga,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useLaden } from "@/lib/useLaden";
import { useStammdaten } from "@/lib/stammdaten";
import type { CaseFile, PublicCase } from "@/lib/types";
import { ErzaehlerFeld } from "./ErzaehlerFeld";
import { BeweisUebersicht } from "./BeweisUebersicht";
import { FallEditor } from "./FallEditor";
import { SagaVorgabenFelder } from "./SagaVorgabenFelder";
import { TonFeld } from "./TonFeld";
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
  /** Der Ladeninhalt - für die Prüfung der Kapitelgeschenke. */
  const regal = useLaden();
  const { daten: admin } = useAdmin();
  const [sagas, setSagas] = useState<Saga[] | null>(null);
  const [vorgaben, setVorgaben] = useState<SagaVorgaben>(STANDARD_SAGA_VORGABEN);
  const [laeuft, setLaeuft] = useState(false);
  const [schritt, setSchritt] = useState<string | null>(null);
  /** Woran es zuletzt gescheitert ist - steht am Knopf, nicht nur oben. */
  const [abbruch, setAbbruch] = useState<{ text: string; schritt: string | null } | null>(
    null,
  );
  /**
   * Eine fertig erzeugte Saga, die noch nicht in der Datenbank liegt.
   *
   * Das Speichern ist der letzte Schritt und der einzige, bei dem alles schon
   * bezahlt ist. Geht er daneben - keine Verbindung, abgelehnte Regeln -,
   * bleibt die Saga hier liegen und lässt sich noch einmal speichern, ohne
   * einen einzigen Aufruf zu wiederholen.
   */
  const [gerettet, setGerettet] = useState<Saga | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  /** Geöffneter Kapitelfall: welche Saga, welches Kapitel (-1 = Finale). */
  /** Die Beweisübersicht einer Saga - alle Akten nebeneinander. */
  const [beweiseVon, setBeweiseVon] = useState<Saga | null>(null);
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

  /**
   * Was jetzt schon dagegen spricht - kostenlos gerechnet, bevor irgendetwas
   * bezahlt wird. Solange hier etwas steht, bleibt der Knopf gesperrt.
   */
  const probleme = pruefeVorgaben({
    vorgaben,
    charaktere: stammdaten.charaktere,
    orte: stammdaten.orte,
    zubehoerIds: regal.map((z) => z.id),
  });

  const erzeugen = async () => {
    if (probleme.length) return;
    setLaeuft(true);
    setAbbruch(null);
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
      // Ab hier ist alles bezahlt - die Saga wird festgehalten, bevor das
      // Speichern versucht wird.
      setGerettet(saga);
      setSchritt("Wird gespeichert …");
      await speichereSaga(saga);
      setGerettet(null);
      await laden();
      onMeldung(`Saga „${saga.name}“ gespeichert - ${saga.kapitel.length} Kapitel und Finale.`);
    } catch (fehler) {
      // Zweimal, mit Absicht: Die Meldung oben sieht man nur, wenn man dort
      // steht - und beim Erzeugen steht man ganz unten am Knopf. Vorher
      // verschwand hier bloß die Fortschrittszeile, und es sah aus, als
      // hätte das Spiel kommentarlos aufgegeben.
      const text =
        fehler instanceof Error ? fehler.message : "Die Saga konnte nicht erzeugt werden.";
      setAbbruch({ text, schritt });
      onFehler(text);
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  /**
   * Eine Verhandlung nachliefern.
   *
   * Es gab einen Fall, in dem eine Saga mit Gerichtsfinale ohne Beweisstücke
   * gespeichert wurde - beim Spielen sprang es dann vom Erzählertext direkt
   * in den Epilog, das ganze Finale fiel aus. Das lässt sich heilen, ohne
   * alles neu zu erzeugen: Im versiegelten Bogen steht die Verhandlung
   * bereits, es fehlen nur die Stücke. Ein einziger Aufruf holt sie nach.
   */
  const verhandlungNachliefern = async (saga: Saga) => {
    setLaeuft(true);
    setSchritt("Die Beweisstücke werden nachgeholt …");
    onFehler(null);
    try {
      const antwort = await postJson<{
        bogenSiegel: string;
        beweise: Verhandlung["beweise"];
        noetig: number;
      }>("/api/saga", { schritt: "beweise", bogenSiegel: saga.bogenSiegel, orte: stammdaten.orte }, 90);

      const alt = saga.finale.verhandlung;
      if (!alt) {
        onFehler(
          "Zu dieser Saga gehört gar keine Verhandlung - das Finale ist ein gewöhnlicher Fall.",
        );
        return;
      }
      const kopie: Saga = {
        ...saga,
        bogenSiegel: antwort.bogenSiegel,
        finale: {
          ...saga.finale,
          verhandlung: { ...alt, beweise: antwort.beweise, noetig: antwort.noetig },
        },
      };
      await speichereSaga(kopie);
      await laden();
      onMeldung(
        `Die Verhandlung von „${saga.name}“ ist vollständig: ${antwort.beweise.length} Beweisstücke, ${antwort.noetig} müssen tragen.`,
      );
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Die Beweisstücke ließen sich nicht nachholen.",
      );
    } finally {
      setLaeuft(false);
      setSchritt(null);
    }
  };

  /** Eine fertig erzeugte Saga noch einmal speichern - ohne neuen Aufruf. */
  const nochmalSpeichern = async () => {
    if (!gerettet) return;
    try {
      await speichereSaga(gerettet);
      setGerettet(null);
      setAbbruch(null);
      await laden();
      onMeldung(`Saga „${gerettet.name}“ ist jetzt gespeichert.`);
    } catch (fehler) {
      const text =
        fehler instanceof Error ? fehler.message : "Das Speichern ging wieder schief.";
      setAbbruch({ text, schritt: "Beim Speichern" });
      onFehler(text);
    }
  };

  /**
   * Irgendetwas an einer gespeicherten Saga ändern - Text, Name, Anriss, Ton.
   * Die Anzeige geht sofort mit, gespeichert wird im Hintergrund.
   */
  const sagaAendern = async (kopie: Saga) => {
    setSagas((alt) => (alt ?? []).map((s) => (s.id === kopie.id ? kopie : s)));
    try {
      await speichereSaga(kopie);
    } catch {
      onFehler("Die Änderung konnte nicht gespeichert werden.");
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

  /**
   * Eine geänderte Akte zurück in ihre Saga - unabhängig davon, über welchen
   * Bildschirm sie geöffnet wurde. Index unter 0 heißt Finalfall.
   */
  const akteZurueck = async (saga: Saga, index: number, fall: CaseFile) => {
    const versiegelt = await akteSchreiben(fall);
    const kopie: Saga = JSON.parse(JSON.stringify(saga));
    const ziel: { fall: PublicCase | null; siegel: string | null } =
      index < 0 ? kopie.finale : kopie.kapitel[index];
    ziel.fall = versiegelt.fall;
    ziel.siegel = versiegelt.siegel;
    await speichereSaga(kopie);
    await laden();
  };

  const akteSpeichern = async (fall: CaseFile) => {
    if (!akte) return;
    setSpeichert(true);
    onFehler(null);
    try {
      await akteZurueck(akte.saga, akte.index, fall);
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
          erzaehler: {
            text: rohBogen.kapitel[i].erzaehlerText,
            audio: "",
            video: videoFuerKapitel(vorgaben, i),
          },
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
          erzaehler: {
            text: rohBogen.finale.erzaehlerText,
            audio: "",
            video: videoFuerKapitel(vorgaben, vorgaben.kapitelAnzahl),
          },
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

  // Die Beweisübersicht legt sich über alles andere - sie öffnet ihre Akten
  // selbst und gibt sie über akteZurueck wieder ab.
  if (beweiseVon) {
    const frisch = sagas?.find((s) => s.id === beweiseVon.id) ?? beweiseVon;
    return (
      <BeweisUebersicht
        saga={frisch}
        onSpeichern={(index, fall) => akteZurueck(frisch, index, fall)}
        onSchliessen={() => setBeweiseVon(null)}
        onFehler={onFehler}
        onMeldung={onMeldung}
      />
    );
  }

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

      {probleme.length > 0 && (
        <div className="pruefung">
          <strong>So kann die Saga nicht entstehen</strong>
          <ul>
            {probleme.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="leise klein">
            Geprüft wird vorher, damit kein angefangener Lauf bezahlt und dann
            weggeworfen wird.
          </p>
        </div>
      )}

      <button
        className="knopf aktion"
        style={{ marginTop: 16 }}
        onClick={() => void erzeugen()}
        disabled={laeuft || !admin || probleme.length > 0}
      >
        {laeuft ? "Die Saga entsteht …" : "Saga erzeugen und speichern"}
      </button>

      {abbruch && !laeuft && (
        <div className="abbruch">
          <strong>Abgebrochen{abbruch.schritt ? ` bei: ${abbruch.schritt}` : ""}</strong>
          <p>{abbruch.text}</p>
          {gerettet ? (
            <>
              <p>
                Die Saga „{gerettet.name}“ ist fertig erzeugt - nur das Speichern
                ging schief. Sie liegt hier und kostet keinen neuen Aufruf.
              </p>
              <button className="knopf klein" onClick={() => void nochmalSpeichern()}>
                Nochmal speichern
              </button>
            </>
          ) : (
            <p className="leise klein">
              Es ist nichts gespeichert worden - noch einmal auf „Saga erzeugen“
              tippen fängt von vorn an.
            </p>
          )}
        </div>
      )}

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
              <p className="leise klein">
                Hier stehen alle Texte, die der Spieler zu sehen bekommt - so,
                wie sie im Spiel erscheinen. Name, Überthema, Klappentext und
                die Vorspann-Schlagworte liegen im Bogen, die Fälle selbst in
                ihren Akten.
              </p>

              <div className="knopf-reihe">
                <button className="knopf klein" onClick={() => void bogenOeffnen(saga)}>
                  Bogen bearbeiten
                </button>
                {/* Alles, was der Spieler unterwegs finden kann, nebeneinander -
                    samt der Frage, ob am Ende genug für das Gericht übrig
                    bleibt. */}
                <button className="knopf klein" onClick={() => setBeweiseVon(saga)}>
                  Beweise ansehen
                </button>
              </div>

              <h4 className="unter-abschnitt">
                Auftritt eines neuen Tiers{" "}
                <span className="leise">· Ton dieser Saga</span>
              </h4>
              <TonFeld
                wert={saga.vorgaben.neuzugangTon ?? ""}
                onAendern={(neuzugangTon) => {
                  const kopie: Saga = JSON.parse(JSON.stringify(saga));
                  kopie.vorgaben = { ...kopie.vorgaben, neuzugangTon };
                  void sagaAendern(kopie);
                }}
              />

              <ErzaehlerFeld
                titel="Auftakt"
                teil={saga.auftakt}
                onAendern={(t) => void erzaehlerAendern(saga, "auftakt", t)}
              />

              {saga.kapitel.map((k, i) => (
                <div key={k.nummer}>
                  <h4 className="unter-abschnitt">
                    Kapitel {k.nummer}{" "}
                    <span className="leise">
                      · {k.fall ? k.fall.titel : "Kein Fall hinterlegt"}
                    </span>
                  </h4>

                  <label className="feld">
                    <span className="leise">
                      Kapitelname · steht auf der Titelkarte und im Vorspann
                    </span>
                    <input
                      value={k.name}
                      onChange={(e) => {
                        const kopie: Saga = JSON.parse(JSON.stringify(saga));
                        kopie.kapitel[i].name = e.target.value;
                        void sagaAendern(kopie);
                      }}
                      maxLength={120}
                    />
                  </label>

                  {k.fall && (
                    <label className="feld">
                      <span className="leise">
                        Falltitel · steht während des Falls über dem Chat
                      </span>
                      <input
                        value={k.fall.titel}
                        onChange={(e) => {
                          const kopie: Saga = JSON.parse(JSON.stringify(saga));
                          const fall = kopie.kapitel[i].fall;
                          if (fall) fall.titel = e.target.value;
                          void sagaAendern(kopie);
                        }}
                        maxLength={160}
                      />
                    </label>
                  )}

                  <label className="feld">
                    <span className="leise">Anriss · kurze Zeile für die Übersicht</span>
                    <textarea
                      rows={2}
                      value={k.teaser}
                      onChange={(e) => {
                        const kopie: Saga = JSON.parse(JSON.stringify(saga));
                        kopie.kapitel[i].teaser = e.target.value;
                        void sagaAendern(kopie);
                      }}
                      maxLength={400}
                    />
                  </label>

                  <ErzaehlerFeld
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

              {/* Der Titel des Finales ist das Erste, was der Spieler vom
                  Schluss sieht - und verrät erzeugt gern schon, wer dahinter
                  steckt. Deshalb steht er hier zum Nachbessern, und zwar
                  ohne Umweg über die Akte: Bei einer Verhandlung gibt es gar
                  keinen Finalfall, den man öffnen könnte. */}
              <label className="feld">
                <span className="leise">
                  Finalfrage · steht als Überschrift über dem Erzählertext und
                  im Gerichtssaal
                </span>
                <input
                  value={saga.finale.frage}
                  onChange={(e) => {
                    const kopie: Saga = JSON.parse(JSON.stringify(saga));
                    kopie.finale.frage = e.target.value;
                    void sagaAendern(kopie);
                  }}
                  maxLength={160}
                />
              </label>

              {saga.finale.fall && (
                <label className="feld">
                  <span className="leise">
                    Titel des Finalfalls · steht während des Finales über dem Chat
                  </span>
                  <input
                    value={saga.finale.fall.titel}
                    onChange={(e) => {
                      const kopie: Saga = JSON.parse(JSON.stringify(saga));
                      if (kopie.finale.fall) kopie.finale.fall.titel = e.target.value;
                      void sagaAendern(kopie);
                    }}
                    maxLength={160}
                  />
                </label>
              )}

              {saga.finale.fall && saga.finale.siegel && (
                <button
                  className="knopf klein"
                  onClick={() => void akteOeffnen(saga, -1)}
                  style={{ marginBottom: 12 }}
                >
                  Finalfall bearbeiten
                </button>
              )}

              <ErzaehlerFeld
                titel="Epilog"
                teil={saga.finale.epilog}
                onAendern={(t) => void erzaehlerAendern(saga, "epilog", t)}
              />

              {/* Eine Verhandlung ohne Beweisstücke ist keine: Beim Spielen
                  fiele das ganze Finale aus. Hier lässt sie sich mit einem
                  einzigen Aufruf nachholen. */}
              {mitVerhandlung(saga.vorgaben.finaleArt) &&
                !saga.finale.verhandlung?.beweise?.length && (
                  <div className="pruefung">
                    <strong>Dieser Saga fehlt die Verhandlung</strong>
                    <p className="leise klein">
                      Das Finale ist ein Gerichtssaal, aber es sind keine
                      Beweisstücke hinterlegt - gespielt spränge es vom
                      Erzählertext direkt in den Epilog. Ein einziger Aufruf
                      holt sie nach; alles andere bleibt, wie es ist.
                    </p>
                    <button
                      className="knopf aktion klein"
                      disabled={laeuft}
                      onClick={() => void verhandlungNachliefern(saga)}
                    >
                      {laeuft ? "Wird geholt …" : "Verhandlung nachliefern"}
                    </button>
                  </div>
                )}

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
