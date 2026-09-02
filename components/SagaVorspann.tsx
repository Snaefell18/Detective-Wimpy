"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Szene } from "./Bild";
import { spiele, stand, stoppe } from "@/lib/introAudio";
import { ohneNamen, spaeteNamen, worteOhneNamen } from "@/lib/namenSchutz";
import type { Saga } from "@/lib/sagaTypen";

/**
 * Der Vorspann einer Saga: die Titelsequenz vor dem ersten Erzählerteil.
 *
 * Er läuft zur Intro-Musik und ist bewusst anders geschnitten als das Intro
 * eines einzelnen Falls: Dort wird ein Fall vorgestellt, hier eine ganze
 * Reihe. Die Szenen kommen aus dem, was die Saga ohnehin mitbringt - Titel,
 * Überthema, Schlagworte, Kapitelnamen -, es braucht also keinen zusätzlichen
 * Modellaufruf.
 *
 * Ohne Ton läuft er nach einer festen Zeit durch; weiter geht es jederzeit
 * über "Überspringen".
 */
const STUMME_DAUER = 30;

type Szenenbild =
  | { art: "praesentiert"; von: number; bis: number }
  | { art: "titel"; von: number; bis: number }
  | { art: "wort"; nr: number; wort: string; von: number; bis: number }
  | { art: "thema"; von: number; bis: number }
  | { art: "kapitel"; von: number; bis: number }
  | { art: "einsatz"; von: number; bis: number };

/**
 * Die Saga, wie der Vorspann sie zeigen darf.
 *
 * Namen von Tieren, die erst in einem späteren Kapitel auftreten, haben hier
 * nichts verloren - ein einziges Wort verrät sonst, wer noch kommt. Betroffene
 * Sätze fallen weg, betroffene Kapitelnamen werden zur bloßen Nummer.
 */
function ohneSpaete(saga: Saga): Saga {
  const namen = spaeteNamen({
    besetzung: saga.finale.fall?.besetzung ?? saga.kapitel[0]?.fall?.besetzung ?? [],
    vorgaben: saga.vorgaben,
    kapitel: 0,
  });
  if (namen.length === 0) return saga;

  return {
    ...saga,
    thema: ohneNamen(saga.thema, namen),
    klappentext: ohneNamen(saga.klappentext, namen),
    schlagworte: worteOhneNamen(saga.schlagworte ?? [], namen),
    kapitel: saga.kapitel.map((k) => ({
      ...k,
      name: ohneNamen(k.name, namen) || `Kapitel ${k.nummer}`,
    })),
  };
}

/**
 * Fällt für eine ältere Saga das Schlagwort-Feld weg, werden Wörter aus dem
 * Überthema geborgen - lieber die längsten als gar keine.
 */
function schlagworte(saga: Saga): string[] {
  const eigene = (saga.schlagworte ?? []).map((w) => w.trim()).filter(Boolean);
  if (eigene.length > 0) return eigene.slice(0, 6);

  return [...new Set(saga.thema.split(/[^\p{L}]+/u).filter((w) => w.length > 5))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);
}

/** Der Ablauf, aufgeteilt auf 0…1 der Musik. */
function szenenPlan(worte: string[], kapitelAnzahl: number): Szenenbild[] {
  const plan: Szenenbild[] = [
    { art: "praesentiert", von: 0, bis: 0.1 },
    { art: "titel", von: 0.1, bis: 0.3 },
  ];

  // Die Schlagworte teilen sich das Mittelstück.
  const wortVon = 0.3;
  const wortBis = 0.62;
  const breite = (wortBis - wortVon) / Math.max(1, worte.length);
  worte.forEach((wort, i) => {
    plan.push({
      art: "wort",
      nr: i,
      wort,
      von: wortVon + i * breite,
      bis: wortVon + (i + 1) * breite,
    });
  });

  plan.push({ art: "thema", von: wortBis, bis: 0.78 });
  if (kapitelAnzahl > 0) plan.push({ art: "kapitel", von: 0.78, bis: 0.93 });
  plan.push({ art: "einsatz", von: kapitelAnzahl > 0 ? 0.93 : 0.78, bis: 1.01 });
  return plan;
}

export function SagaVorspann({ saga, onFertig }: { saga: Saga; onFertig: () => void }) {
  const startRef = useRef(performance.now());
  const [fortschritt, setFortschritt] = useState(0);
  const [tonAn, setTonAn] = useState(true);

  // Das letzte Gitter: Wer erst später dazustößt, kommt hier nicht vor. Der
  // Server hält seine Texte schon davon frei; das hier greift auch bei von
  // Hand geschriebenen Sagas und bei allem, was später bearbeitet wurde.
  const gezeigt = useMemo(() => ohneSpaete(saga), [saga]);

  const worte = useMemo(() => schlagworte(gezeigt), [gezeigt]);
  const plan = useMemo(
    () => szenenPlan(worte, gezeigt.kapitel.length),
    [worte, gezeigt.kapitel.length],
  );

  useEffect(() => {
    let laeuftNoch = true;

    void spiele("intro").then((geklappt) => {
      if (laeuftNoch) setTonAn(geklappt);
    });

    const tick = () => {
      if (!laeuftNoch) return;
      const { zeit, dauer } = stand("intro");
      const gesamt = dauer ?? STUMME_DAUER;
      const vergangen = zeit > 0 ? zeit : (performance.now() - startRef.current) / 1000;
      setFortschritt(Math.min(1, vergangen / gesamt));
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      laeuftNoch = false;
      cancelAnimationFrame(id);
      stoppe("intro");
    };
  }, []);

  // Ist die Musik durch, geht es von allein weiter zum Auftakt.
  useEffect(() => {
    if (fortschritt >= 1) onFertig();
  }, [fortschritt, onFertig]);

  const szene = plan.find((s) => fortschritt >= s.von && fortschritt < s.bis) ?? plan[0];

  // Hinter allem ein Schauplatz aus der Saga - er wechselt mit den Kapiteln.
  const hintergrund =
    saga.kapitel[Math.min(saga.kapitel.length - 1, Math.floor(fortschritt * saga.kapitel.length))]
      ?.fall?.orte[0]?.bild ?? saga.finale.fall?.orte[0]?.bild;

  return (
    <div
      className="intro vorspann"
      onPointerDown={() => {
        if (!tonAn) void spiele("intro").then(setTonAn);
      }}
    >
      <div className="intro-hintergrund">
        <Szene src={hintergrund} alt="" platzhalter="" variante="titel" />
      </div>

      <div className="intro-buehne">
        <VorspannSzene szene={szene} saga={gezeigt} key={`${szene.art}-${"nr" in szene ? szene.nr : 0}`} />
      </div>

      <div className="intro-leiste">
        <div className="intro-fortschritt">
          <span style={{ width: `${fortschritt * 100}%` }} />
        </div>
        <div className="intro-knoepfe">
          {!tonAn && (
            <button className="intro-ton" onClick={() => void spiele("intro").then(setTonAn)}>
              🔈 Ton an
            </button>
          )}
          <button className="intro-skip" onClick={onFertig}>
            Überspringen ›
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VorspannSzene({ szene, saga }: { szene: Szenenbild; saga: Saga }) {
  if (szene.art === "praesentiert") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="intro-oberzeile">Detective Wimpy in</p>
      </div>
    );
  }

  if (szene.art === "titel") {
    return (
      <div className="vorspann-mitte">
        <p className="intro-oberzeile einfliegen">
          Eine Saga in {saga.kapitel.length} Fällen
        </p>
        <h1 className="intro-logo slam">{saga.name}</h1>
      </div>
    );
  }

  if (szene.art === "wort") {
    return (
      <div className="vorspann-mitte">
        <p className="schlagwort" data-nr={szene.nr}>
          {szene.wort}
        </p>
      </div>
    );
  }

  if (szene.art === "thema") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="vorspann-thema">{saga.thema}</p>
      </div>
    );
  }

  if (szene.art === "kapitel") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="intro-oberzeile">Die Kapitel</p>
        <ol className="vorspann-kapitel">
          {saga.kapitel.map((k) => (
            <li key={k.nummer}>{k.name}</li>
          ))}
          <li data-finale="true">Finale</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="vorspann-mitte">
      <h2 className="intro-stadt slam">{saga.name}</h2>
      <p className="vorspann-thema">{saga.klappentext}</p>
    </div>
  );
}
