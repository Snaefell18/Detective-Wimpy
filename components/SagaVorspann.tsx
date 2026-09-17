"use client";

import { useEffect, useMemo, useState } from "react";
import { Szene } from "./Bild";
import { leseDauer, passendeAnzahl, tafelnVerteilen } from "@/lib/introTiming";
import { useIntroUhr } from "@/lib/introUhr";
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

type Tafel =
  | { art: "praesentiert"; dauer: number }
  | { art: "titel"; dauer: number }
  | { art: "wort"; nr: number; wort: string; dauer: number }
  | { art: "thema"; dauer: number }
  | { art: "kapitel"; dauer: number }
  | { art: "einsatz"; dauer: number };

type Szenenbild = Tafel & { von: number; bis: number };

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

/**
 * Der Ablauf - jede Tafel mit der Zeit, die ihr Text zum Vorlesen braucht.
 *
 * Vorher standen hier feste Anteile: das Überthema bekam sechzehn Prozent der
 * Musik, der Klappentext am Ende acht. Bei einem Titelsong von dreiviertel
 * Minuten sind das sieben und dreieinhalb Sekunden - für einen Absatz, den
 * jemand vorlesen soll, ist das nichts. Jetzt sagt jede Tafel selbst, wie
 * lange sie steht (lib/introTiming.ts).
 */
function tafelnFuer(saga: Saga, worte: string[], songDauer: number): Tafel[] {
  const kapitel = saga.kapitel.map((k) => k.name).join(", ");
  return [
    { art: "praesentiert", dauer: leseDauer("Detective Wimpy in") },
    { art: "titel", dauer: leseDauer(`Eine Saga in ${saga.kapitel.length} Fällen ${saga.name}`, 3) },
    ...worte.map((wort, nr) => ({ art: "wort" as const, nr, wort, dauer: leseDauer(wort) })),
    { art: "thema", dauer: leseDauer(saga.thema, 3) },
    ...(saga.kapitel.length
      ? [{ art: "kapitel" as const, dauer: leseDauer(`Die Kapitel ${kapitel} Finale`, 3) }]
      : []),
    { art: "einsatz", dauer: leseDauer(`${saga.name} ${saga.klappentext}`, 3.5) },
  ];
}

/** Wie viele Schlagworte in den Vorspann passen, ohne dass sie hetzen. */
const passendeWorte = (worte: string[], songDauer: number): string[] =>
  worte.slice(0, passendeAnzahl(worte, songDauer * 0.34));

export function SagaVorspann({ saga, onFertig }: { saga: Saga; onFertig: () => void }) {
  const [songDauer, setSongDauer] = useState<number | null>(null);

  // Das letzte Gitter: Wer erst später dazustößt, kommt hier nicht vor. Der
  // Server hält seine Texte schon davon frei; das hier greift auch bei von
  // Hand geschriebenen Sagas und bei allem, was später bearbeitet wurde.
  const gezeigt = useMemo(() => ohneSpaete(saga), [saga]);

  const worte = useMemo(() => schlagworte(gezeigt), [gezeigt]);
  const { plan, dauer } = useMemo(() => {
    const song = songDauer ?? STUMME_DAUER;
    return tafelnVerteilen(tafelnFuer(gezeigt, passendeWorte(worte, song), song), song);
  }, [gezeigt, worte, songDauer]);
  const { fortschritt, tonAn, anschalten } = useIntroUhr("intro", dauer, setSongDauer);

  // Ist der Vorspann durch, geht es von allein weiter zum Auftakt.
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
        if (!tonAn) anschalten();
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
            <button className="intro-ton" onClick={anschalten}>
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
