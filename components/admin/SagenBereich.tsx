"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminStore";
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

  const staedte = alsStaedte(stammdaten.orte);
  const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);

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

  const wunschSetzen = (i: number, text: string) =>
    setVorgaben((alt) => {
      const wuensche = [...alt.kapitelWuensche];
      wuensche[i] = text;
      return { ...alt, kapitelWuensche: wuensche };
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

  const kapitelNummern = Array.from({ length: vorgaben.kapitelAnzahl }, (_, i) => i);

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

      {kapitelNummern.map((i) => (
        <label className="feld" key={i}>
          <span className="leise">Wunsch für Kapitel {i + 1} (frei lassen = freie Hand)</span>
          <input
            value={vorgaben.kapitelWuensche[i] ?? ""}
            onChange={(e) => wunschSetzen(i, e.target.value)}
            placeholder="z.B. Spielt auf dem Nachtmarkt, ein Fahrrad verschwindet"
            maxLength={400}
          />
        </label>
      ))}

      <h3 className="unter-abschnitt">Stadt</h3>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.staedteWechseln}
          onClick={() => setzen({ staedteWechseln: true })}
        >
          <strong>Wechselnd</strong>
          <span className="leise">jedes Kapitel woanders</span>
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
              <ErzaehlerFeld
                titel="Auftakt"
                teil={saga.auftakt}
                onAendern={(t) => void erzaehlerAendern(saga, "auftakt", t)}
              />

              {saga.kapitel.map((k, i) => (
                <ErzaehlerFeld
                  key={k.nummer}
                  titel={`Kapitel ${k.nummer}: ${k.name}`}
                  hinweis={k.fall ? k.fall.titel : "Kein Fall hinterlegt"}
                  teil={k.erzaehler}
                  onAendern={(t) => void erzaehlerAendern(saga, i, t)}
                />
              ))}

              <ErzaehlerFeld
                titel="Vor dem Finale"
                hinweis={saga.finale.fall?.titel ?? "Kein Finalfall hinterlegt"}
                teil={saga.finale.erzaehler}
                onAendern={(t) => void erzaehlerAendern(saga, "finale", t)}
              />

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
