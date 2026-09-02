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
  auftrittVon,
  type Erzaehlerteil,
  type Saga,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import type { CaseFile, PublicCase } from "@/lib/types";
import { FallEditor } from "./FallEditor";
import type { BereichProps } from "./typen";

const SCHWIERIGKEITEN: { id: SagaVorgaben["schwierigkeit"]; label: string }[] = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "knifflig", label: "Knifflig" },
];

const REIFEGRADE: { id: SagaVorgaben["reifegrad"]; label: string; hinweis: string }[] = [
  { id: "kindgerecht", label: "Kindgerecht", hinweis: "Streiche, Diebstähle" },
  { id: "jugendlich", label: "Jugendlich", hinweis: "Drohungen, Rauferei" },
  { id: "erwachsen", label: "Erwachsen", hinweis: "Gewalt, Tote nur Menschen" },
];

const ABSURDITAETEN: { id: SagaVorgaben["absurditaet"]; label: string; hinweis: string }[] = [
  { id: "bodenstaendig", label: "Bodenständig", hinweis: "könnte so passiert sein" },
  { id: "verspielt", label: "Verspielt", hinweis: "schrullig, leicht überzogen" },
  { id: "absurd", label: "Absurd", hinweis: "Logik wie im Traum" },
];

const TOENE: { id: SagaVorgaben["ton"]; label: string }[] = [
  { id: "kindgerecht", label: "Warmherzig" },
  { id: "spannend", label: "Spannend" },
  { id: "albern", label: "Albern" },
];

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
  const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);
  // Nur wer in dieser Saga vorkommt - leere Auswahl heißt: alle.
  const mitspieler =
    vorgaben.charaktere.length >= 2
      ? verdaechtige.filter((c) => vorgaben.charaktere.includes(c.id))
      : verdaechtige;

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

  const umschalten = (feld: "charaktere" | "items", id: string) =>
    setVorgaben((alt) => ({
      ...alt,
      [feld]: alt[feld].includes(id)
        ? alt[feld].filter((x) => x !== id)
        : [...alt[feld], id],
    }));

  /** Täter für Kapitel i (0-basiert) - leerer Wert heißt: freie Wahl. */
  const kapitelTaeterSetzen = (i: number, id: string) =>
    setVorgaben((alt) => {
      const liste = [...(alt.kapitelTaeter ?? [])];
      liste[i] = id;
      return { ...alt, kapitelTaeter: liste };
    });

  const wunschSetzen = (i: number, text: string) =>
    setVorgaben((alt) => {
      const wuensche = [...alt.kapitelWuensche];
      wuensche[i] = text;
      return { ...alt, kapitelWuensche: wuensche };
    });

  /** Stadt je Kapitel; der letzte Eintrag gehört zum Finale. */
  const stadtSetzen = (i: number, stadt: string) =>
    setVorgaben((alt) => {
      const staedteListe = [...alt.kapitelStaedte];
      staedteListe[i] = stadt;
      return { ...alt, kapitelStaedte: staedteListe };
    });

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
        vorgaben,
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

  const kapitelNummern = Array.from({ length: vorgaben.kapitelAnzahl }, (_, i) => i);

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

      <label className="feld">
        <span className="leise">Name (leer = das Modell erfindet einen)</span>
        <input
          value={vorgaben.name}
          onChange={(e) => setzen({ name: e.target.value })}
          placeholder="z.B. Die Spur der sieben Glocken"
          maxLength={120}
        />
      </label>

      <label className="feld">
        <span className="leise">Überthema · was sich langsam enthüllt</span>
        <textarea
          rows={3}
          value={vorgaben.thema}
          onChange={(e) => setzen({ thema: e.target.value })}
          placeholder="z.B. Jemand sammelt heimlich die Glocken aller Stadttiere ein"
          maxLength={2000}
        />
      </label>

      <h3 className="unter-abschnitt">Kapitel</h3>
      <div className="wahl-reihe">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.kapitelAnzahl === n}
            onClick={() => setzen({ kapitelAnzahl: n })}
          >
            <strong>{n}</strong>
            <span className="leise">+ Finale</span>
          </button>
        ))}
      </div>

      {[...kapitelNummern, vorgaben.kapitelAnzahl].map((i) => {
        const istFinale = i === vorgaben.kapitelAnzahl;
        return (
          <div className="kapitel-block" key={i}>
            <h4 className="unter-abschnitt">
              {istFinale ? "Finale" : `Kapitel ${i + 1}`}
            </h4>

            {!istFinale && (
              <label className="feld">
                <span className="leise">Wunsch (frei lassen = freie Hand)</span>
                <input
                  value={vorgaben.kapitelWuensche[i] ?? ""}
                  onChange={(e) => wunschSetzen(i, e.target.value)}
                  placeholder="z.B. Spielt auf dem Nachtmarkt, ein Fahrrad verschwindet"
                  maxLength={400}
                />
              </label>
            )}

            {!istFinale && (
              <>
                <span className="leise klein">Täter dieses Kapitels</span>
                <div className="marken-reihe">
                  <button
                    className="marke-knopf"
                    data-aktiv={!(vorgaben.kapitelTaeter?.[i] ?? "")}
                    onClick={() => kapitelTaeterSetzen(i, "")}
                  >
                    Zufällig
                  </button>
                  {mitspieler
                    // Der Drahtzieher ist erst im Finale schuldig, und wer im
                    // Kapitel noch gar nicht auftritt, kann es nicht gewesen sein.
                    .filter((c) => c.id !== vorgaben.drahtzieherId)
                    .filter(
                      (c) =>
                        auftrittVon({
                          charakterId: c.id,
                          vorgaben,
                          drahtzieherId: vorgaben.drahtzieherId,
                        }) <=
                        i + 1,
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className="marke-knopf"
                        data-aktiv={vorgaben.kapitelTaeter?.[i] === c.id}
                        onClick={() => kapitelTaeterSetzen(i, c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </>
            )}

            {istFinale && (
              <p className="leise klein">
                Im Finale ist der Drahtzieher der Täter - das steht oben.
              </p>
            )}

            <span className="leise klein">Stadt</span>
            <div className="marken-reihe">
              <button
                className="marke-knopf"
                data-aktiv={!vorgaben.kapitelStaedte[i]}
                onClick={() => stadtSetzen(i, "")}
              >
                Wie eingestellt
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelStaedte[i] === "zufall"}
                onClick={() => stadtSetzen(i, "zufall")}
              >
                Zufall
              </button>
              {staedte.map((stadt) => (
                <button
                  key={stadt.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.kapitelStaedte[i] === stadt.id}
                  onClick={() => stadtSetzen(i, stadt.id)}
                >
                  {stadt.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">
        Stadt <span className="leise">· gilt, wo oben „Wie eingestellt“ steht</span>
      </h3>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.staedteWechseln}
          onClick={() => setzen({ staedteWechseln: true })}
        >
          <strong>Wechselnd</strong>
          <span className="leise">jedes Mal woanders</span>
        </button>
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="wahl-chip"
            data-aktiv={!vorgaben.staedteWechseln && vorgaben.stadt === stadt.id}
            onClick={() => setzen({ staedteWechseln: false, stadt: stadt.id })}
          >
            <strong>{stadt.name}</strong>
            <span className="leise">{stadt.orte.length} Orte</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Tiere <span className="leise">· keins gewählt = alle</span>
      </h3>
      <div className="marken-reihe">
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.charaktere.includes(c.id)}
            onClick={() => umschalten("charaktere", c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Dinge <span className="leise">· müssen vorkommen</span>
      </h3>
      <div className="marken-reihe">
        {stammdaten.items.map((i) => (
          <button
            key={i.id}
            className="marke-knopf"
            data-aktiv={vorgaben.items.includes(i.id)}
            onClick={() => umschalten("items", i.id)}
          >
            {i.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Drahtzieher <span className="leise">· wer hinter allem steckt</span>
      </h3>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={vorgaben.drahtzieherId === ""}
          onClick={() => setzen({ drahtzieherId: "" })}
        >
          Zufällig
        </button>
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.drahtzieherId === c.id}
            onClick={() => setzen({ drahtzieherId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Twist <span className="leise">· der Drahtzieher bleibt bis zum Finale unsichtbar</span>
      </h3>
      <div className="wahl-reihe">
        <button
          className="wahl-chip"
          data-aktiv={!vorgaben.twist}
          onClick={() => setzen({ twist: false })}
        >
          <strong>Normal</strong>
          <span className="leise">Er läuft in den Kapiteln beiläufig mit</span>
        </button>
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.twist}
          onClick={() => setzen({ twist: true })}
        >
          <strong>Twist</strong>
          <span className="leise">Man begegnet ihm erst im Finale</span>
        </button>
      </div>
      <p className="leise klein">
        Mit Twist kommt der Drahtzieher in keinem Kapitel vor - man sieht ihn
        nicht und kann ihn nicht befragen. Die Hinweise auf ihn gibt es
        trotzdem von Anfang an, nur über Eigenschaften statt über seinen
        Namen: eine Handschrift, ein Geruch, ein Siegel. Der Erzählertext vor
        dem Finale inszeniert dann seinen Auftritt.
      </p>

      <h3 className="unter-abschnitt">
        Auftritte <span className="leise">· wer wann dazustößt</span>
      </h3>
      <p className="leise klein">
        Standard ist „Von Anfang an“. Wer später einsteigt, taucht in dem
        Kapitel zum ersten Mal auf und bleibt dann bis zum Ende dabei; der
        Erzählertext davor erklärt seine Ankunft. „Erst im Finale“ heißt: In
        keinem Kapitel zu sehen. Das darf auch der Drahtzieher sein - mit der
        Twist-Wahl oben steht er ohnehin schon auf „Erst im Finale“.
      </p>
      {mitspieler.map((c) => {
        const finale = vorgaben.kapitelAnzahl + 1;
        const gesperrt = vorgaben.twist && c.id === vorgaben.drahtzieherId;
        const jetzt = gesperrt ? finale : (vorgaben.neuzugaenge?.[c.id] ?? 1);
        return (
          <div key={c.id} className="auftritt-zeile">
            <span className="leise klein">
              {c.name}
              {c.id === vorgaben.drahtzieherId ? " · Drahtzieher" : ""}
            </span>
            <div className="marken-reihe">
              {Array.from({ length: finale }, (_, i) => i + 1).map((ab) => (
                <button
                  key={ab}
                  className="marke-knopf"
                  disabled={gesperrt}
                  data-aktiv={jetzt === ab}
                  onClick={() =>
                    setzen({
                      neuzugaenge: { ...(vorgaben.neuzugaenge ?? {}), [c.id]: ab },
                    })
                  }
                >
                  {ab === 1 ? "Von Anfang an" : ab === finale ? "Erst im Finale" : `Ab Kapitel ${ab}`}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">Publikum</h3>
      <div className="wahl-reihe">
        {REIFEGRADE.map((r) => (
          <button
            key={r.id}
            className="wahl-chip"
            data-aktiv={vorgaben.reifegrad === r.id}
            onClick={() => setzen({ reifegrad: r.id })}
          >
            <strong>{r.label}</strong>
            <span className="leise">{r.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Absurdität</h3>
      <div className="wahl-reihe">
        {ABSURDITAETEN.map((a) => (
          <button
            key={a.id}
            className="wahl-chip"
            data-aktiv={vorgaben.absurditaet === a.id}
            onClick={() => setzen({ absurditaet: a.id })}
          >
            <strong>{a.label}</strong>
            <span className="leise">{a.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Erzählton</h3>
      <div className="wahl-reihe">
        {TOENE.map((t) => (
          <button
            key={t.id}
            className="wahl-chip"
            data-aktiv={vorgaben.ton === t.id}
            onClick={() => setzen({ ton: t.id })}
          >
            <strong>{t.label}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schwierigkeit</h3>
      <div className="wahl-reihe">
        {SCHWIERIGKEITEN.map((s) => (
          <button
            key={s.id}
            className="wahl-chip"
            data-aktiv={vorgaben.schwierigkeit === s.id}
            onClick={() => setzen({ schwierigkeit: s.id })}
          >
            <strong>{s.label}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schauplätze je Fall</h3>
      <div className="wahl-reihe">
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.ortsAnzahl === n}
            onClick={() => setzen({ ortsAnzahl: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Beschuldigungen je Fall</h3>
      <div className="wahl-reihe">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.beschuldigungen === n}
            onClick={() => setzen({ beschuldigungen: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>

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

/** Text und Tondatei eines Erzählerteils bearbeiten. */
function ErzaehlerFeld({
  titel,
  hinweis,
  teil,
  onAendern,
}: {
  titel: string;
  hinweis?: string;
  teil: Erzaehlerteil;
  onAendern: (teil: Partial<Erzaehlerteil>) => void;
}) {
  return (
    <div className="erzaehler-feld">
      <h4 className="unter-abschnitt">
        {titel} {hinweis && <span className="leise">· {hinweis}</span>}
      </h4>
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
          placeholder="/audio/saga-kapitel-1.mp3"
          maxLength={200}
        />
      </label>
    </div>
  );
}
