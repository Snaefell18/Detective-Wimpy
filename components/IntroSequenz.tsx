"use client";

import { useMemo, useState } from "react";
import { Bild } from "./Bild";
import { leseDauer, passendeAnzahl, tafelnVerteilen } from "@/lib/introTiming";
import { useIntroUhr } from "@/lib/introUhr";
import type { Character, Location, PublicCase } from "@/lib/types";

/** Ohne Musik (blockierter Ton) wird mit dieser Songlänge gerechnet. */
const STUMME_DAUER = 34;

type Tafel =
  | { art: "titel"; dauer: number }
  | { art: "stadt"; dauer: number }
  | { art: "wort"; dauer: number; wort: string; nr: number }
  | { art: "verdaechtig"; dauer: number; charakter: Character; nr: number }
  | { art: "ort"; dauer: number; ort: Location; nr: number }
  | { art: "frage"; dauer: number }
  | { art: "akte"; dauer: number };

type Szene = Tafel & { von: number; bis: number };

/**
 * Was das Intro zeigt - und wie lange jede Tafel dafür braucht.
 *
 * Die Zeiten stehen nicht mehr in Anteilen der Aufnahme, sondern in Sekunden:
 * Ein Steckbrief mit Namen, Tierart und drei Balken braucht länger als ein
 * einzelnes Schlagwort, und der Schauplatz mit seiner Atmosphäre noch länger.
 * Verteilt wird erst danach (lib/introTiming.ts) - dauert das Intro damit
 * länger als sein Song, läuft der Song eben zweimal.
 */
function tafelnFuer(fall: PublicCase, songDauer: number): Tafel[] {
  const verdaechtige = fall.besetzung.filter((c) => !c.istDetektiv);

  // Ältere Fälle (und Kampagnen von vorher) haben noch keine Schlagworte -
  // dann werden welche aus dem Fall selbst gebildet.
  const worte = (fall.schlagworte ?? []).filter(Boolean).slice(0, 6);
  const alle = worte.length
    ? worte
    : [
        fall.stadt,
        fall.orte.find((o) => o.id === fall.tatort)?.name ?? fall.orte[0]?.name ?? "Tatort",
        `${verdaechtige.length} Verdächtige`,
        "Eine Spur zu viel",
      ].filter(Boolean);
  /*
   * Die Schlagworte sind Schmuck, die Verdächtigen und Schauplätze sind der
   * Fall. Deshalb dürfen die Worte weichen, wenn der Song knapp ist: Sie
   * bekommen ein Drittel davon und nicht mehr.
   */
  const schlagworte = alle.slice(0, passendeAnzahl(alle, songDauer * 0.34));

  return [
    { art: "titel", dauer: leseDauer("Ein neuer Fall für Detektiv Wimpy") },
    { art: "stadt", dauer: leseDauer(`Tatort ${fall.stadt}`) },
    ...schlagworte.map((wort, i) => ({ art: "wort" as const, wort, nr: i, dauer: leseDauer(wort) })),
    ...verdaechtige.map((charakter, i) => ({
      art: "verdaechtig" as const,
      charakter,
      nr: i + 1,
      // Zum Lesen kommt, was sich bewegt: Die drei Wertebalken wachsen erst.
      dauer: leseDauer(
        `Verdächtige ${charakter.name} ${charakter.tierart} ${charakter.alter} Jahre`,
        3.2,
      ),
    })),
    ...fall.orte.map((ort, i) => ({
      art: "ort" as const,
      ort,
      nr: i + 1,
      dauer: leseDauer(`${ort.name} ${ort.atmosphaere ?? ""}`, 2.8),
    })),
    { art: "frage", dauer: leseDauer("Wer war es?", 2.6) },
    // Die Fallakte wartet ohnehin auf einen Fingertipp.
    { art: "akte", dauer: leseDauer(fall.titel, 3) },
  ];
}

export function IntroSequenz({
  fall,
  onFertig,
}: {
  fall: PublicCase;
  /** Wird erst aufgerufen, wenn der Spieler die Fallakte antippt. */
  onFertig: () => void;
}) {
  /*
   * Wie lang der Titelsong ist, weiß erst der Browser - und davon hängt ab,
   * wie viel Luft die Tafeln bekommen. Bis dahin wird mit STUMME_DAUER
   * gerechnet; sobald die Länge da ist, rückt sich der Plan von selbst
   * zurecht.
   */
  const [songDauer, setSongDauer] = useState<number | null>(null);
  const { plan, dauer } = useMemo(() => {
    const song = songDauer ?? STUMME_DAUER;
    return tafelnVerteilen(tafelnFuer(fall, song), song);
  }, [fall, songDauer]);
  const { fortschritt, tonAn, anschalten } = useIntroUhr("intro", dauer, setSongDauer);

  const szene =
    plan.find((s) => fortschritt >= s.von && fortschritt < s.bis) ?? plan[plan.length - 1];
  const lokal = Math.min(
    1,
    (fortschritt - szene.von) / Math.max(0.001, szene.bis - szene.von),
  );

  return (
    <div
      className="intro"
      onPointerDown={() => {
        if (!tonAn) anschalten();
      }}
    >
      <IntroHintergrund fall={fall} aktiv={aktiverOrt(szene, fall)} />

      <div className="intro-regen" />
      <div className="intro-strahl" />
      <div className="intro-puls" />

      <div className="intro-buehne">
        <SzenenInhalt
          szene={szene}
          lokal={lokal}
          fall={fall}
          onStarten={onFertig}
          key={szeneSchluessel(szene)}
        />
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
          {szene.art !== "akte" && (
            <button className="intro-skip" onClick={onFertig}>
              Überspringen ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Welcher Schauplatz gerade im Hintergrund steht - sonst bleibt es dunkel. */
const aktiverOrt = (szene: Szene, fall: PublicCase): string | null => {
  if (szene.art === "ort") return szene.ort.id;
  if (szene.art === "stadt") return fall.tatort || fall.orte[0]?.id || null;
  return null;
};

const szeneSchluessel = (szene: Szene) =>
  szene.art === "verdaechtig"
    ? `v-${szene.charakter.id}`
    : szene.art === "wort"
      ? `w-${szene.nr}`
      : szene.art === "ort"
        ? `o-${szene.ort.id}`
        : szene.art;

/* ------------------------------------------------------------------ */

function SzenenInhalt({
  szene,
  lokal,
  fall,
  onStarten,
}: {
  szene: Szene;
  lokal: number;
  fall: PublicCase;
  onStarten: () => void;
}) {
  switch (szene.art) {
    case "titel":
      return (
        <div className="szene-block">
          <div className="blitz" />
          <p className="intro-oberzeile einfliegen">Ein neuer Fall für</p>
          <h1 className="intro-logo slam">
            Detektiv
            <span>Wimpy</span>
          </h1>
        </div>
      );

    case "stadt":
      return (
        <div className="szene-block">
          <div className="blitz" />
          <p className="intro-oberzeile einfliegen">Tatort</p>
          <h1 className="intro-stadt slam">{fall.stadt}</h1>
        </div>
      );

    case "wort":
      return (
        <div className="szene-block">
          <div className="blitz stark" />
          <div className="wort-balken" data-seite={szene.nr % 2 === 0 ? "links" : "rechts"} />
          <h1 className="schlagwort" data-nr={szene.nr}>
            {szene.wort}
          </h1>
        </div>
      );

    case "verdaechtig": {
      const c = szene.charakter;
      return (
        <div className="szene-block verdaechtig-szene">
          <div className="intro-portraet slam-seite">
            <Bild src={c.bild} alt={c.name} platzhalter={c.name} groesse="260px" />
          </div>
          <div className="intro-steckbrief">
            <span className="intro-nummer">Verdächtige·r {szene.nr}</span>
            <h1 className="slam">{c.name}</h1>
            <p className="leise">
              {c.tierart}, {c.alter} Jahre
            </p>
            <div className="intro-werte">
              <IntroWert label="Kriminell" wert={c.stats.kriminalitaetslevel} lokal={lokal} />
              <IntroWert label="Schelm" wert={c.stats.schelmischkeit} lokal={lokal} />
              <IntroWert label="Klugheit" wert={c.stats.intelligenz} lokal={lokal} />
            </div>
          </div>
        </div>
      );
    }

    case "ort":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Schauplatz {szene.nr}</p>
          <h1 className="intro-ortsname slam">{szene.ort.name}</h1>
          {szene.ort.atmosphaere && (
            <p className="intro-atmosphaere einfliegen">{szene.ort.atmosphaere}</p>
          )}
        </div>
      );

    case "frage":
      return (
        <div className="szene-block">
          <h1 className="intro-frage pochen">Wer war es?</h1>
          <div className="intro-gesichter">
            {fall.besetzung
              .filter((c) => !c.istDetektiv)
              .map((c, i) => (
                <div
                  key={c.id}
                  className="intro-gesicht flackern"
                  style={{ animationDelay: `${i * 0.14}s` }}
                >
                  <Bild src={c.bild} alt={c.name} platzhalter={c.name} groesse="120px" />
                </div>
              ))}
          </div>
        </div>
      );

    case "akte":
      /*
       * Nur der Titel - ein Tipp irgendwo darauf startet die Runde.
       *
       * Die Tatbeschreibung stand hier früher in voller Länge. Ein Intro
       * lebt aber von Schlagworten, nicht von Absätzen: Was zu lesen ist,
       * bremst, was aufblitzt, zieht hinein. Verloren geht dabei nichts -
       * derselbe Text steht als erster Eintrag im Notizbuch.
       */
      return (
        <button className="akte einblenden" onClick={onStarten}>
          <span className="intro-oberzeile">Die Akte</span>
          <h1 className="akte-titel">{fall.titel}</h1>
          <span className="akte-start pochen">Fall übernehmen ›</span>
        </button>
      );
  }
}

/**
 * Die Schauplätze als bildschirmfüllender Hintergrund.
 *
 * Alle Bilder hängen von Anfang an im Dokument und werden nur ein- und
 * ausgeblendet. Würde je Szene eines nachgeladen, käme es zu spät - eine
 * Szene dauert nur ein bis zwei Sekunden.
 */
function IntroHintergrund({ fall, aktiv }: { fall: PublicCase; aktiv: string | null }) {
  return (
    <div className="intro-hintergrund" aria-hidden>
      {fall.orte.map((ort) => (
        <div key={ort.id} className="intro-vollbild" data-aktiv={ort.id === aktiv}>
          {/*
            Bewusst ein einfaches <img>: Die Bilder aus /public sind bereits
            klein gerechnet, und das Intro schneidet in Sekundenschritten -
            da darf nichts erst über den Bildoptimierer laufen.
          */}
          <img className="bild" src={ort.bild} alt="" draggable={false} />
        </div>
      ))}
      <div className="intro-vollbild-verlauf" />
    </div>
  );
}

function IntroWert({ label, wert, lokal }: { label: string; wert: number; lokal: number }) {
  const anteil = Math.min(1, lokal * 2.4) * wert * 10;
  return (
    <div className="intro-wert">
      <span>{label}</span>
      <div className="intro-wert-balken">
        <span style={{ width: `${anteil}%` }} />
      </div>
      <strong>{wert}</strong>
    </div>
  );
}
