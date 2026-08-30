"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bild } from "./Bild";
import { spiele, stand, stoppe } from "@/lib/introAudio";
import type { Character, Location, PublicCase } from "@/lib/types";

/** Ohne Musik (blockierter Ton) läuft das Intro deutlich kürzer. */
const STUMME_DAUER = 34;

type Szene =
  | { art: "titel"; von: number; bis: number }
  | { art: "stadt"; von: number; bis: number }
  | { art: "wort"; von: number; bis: number; wort: string; nr: number }
  | { art: "verdaechtig"; von: number; bis: number; charakter: Character; nr: number }
  | { art: "ort"; von: number; bis: number; ort: Location; nr: number }
  | { art: "frage"; von: number; bis: number }
  | { art: "akte"; von: number; bis: number };

/**
 * Der Ablauf in Anteilen der Songlänge (0..1) - so passt das Intro auf jede
 * Aufnahme. Am Ende steht die Fallakte; sie wartet auf einen Fingertipp.
 */
function szenenPlan(fall: PublicCase): Szene[] {
  const verdaechtige = fall.besetzung.filter((c) => !c.istDetektiv);

  // Ältere Fälle (und Kampagnen von vorher) haben noch keine Schlagworte -
  // dann werden welche aus dem Fall selbst gebildet.
  const worte = (fall.schlagworte ?? []).filter(Boolean).slice(0, 6);
  const schlagworte = worte.length
    ? worte
    : [
        fall.stadt,
        fall.orte.find((o) => o.id === fall.tatort)?.name ?? fall.orte[0]?.name ?? "Tatort",
        `${verdaechtige.length} Verdächtige`,
        "Eine Spur zu viel",
      ].filter(Boolean);

  const plan: Szene[] = [
    { art: "titel", von: 0, bis: 0.09 },
    { art: "stadt", von: 0.09, bis: 0.2 },
  ];

  const verteile = <T,>(liste: T[], von: number, bis: number, bauen: (
    posten: T,
    i: number,
    von: number,
    bis: number,
  ) => Szene) => {
    if (liste.length === 0) return;
    const schritt = (bis - von) / liste.length;
    liste.forEach((posten, i) =>
      plan.push(bauen(posten, i, von + i * schritt, von + (i + 1) * schritt)),
    );
  };

  // Schlagworte blitzen einzeln auf.
  verteile(schlagworte, 0.2, 0.42, (wort, i, von, bis) => ({
    art: "wort",
    von,
    bis,
    wort,
    nr: i,
  }));

  verteile(verdaechtige, 0.42, 0.68, (charakter, i, von, bis) => ({
    art: "verdaechtig",
    von,
    bis,
    charakter,
    nr: i + 1,
  }));

  // Jeder Schauplatz bekommt den ganzen Bildschirm - in einen Rahmen gequetscht
  // sahen die hochkanten Bilder immer angeschnitten aus.
  verteile(fall.orte, 0.68, 0.86, (ort, i, von, bis) => ({
    art: "ort",
    von,
    bis,
    ort,
    nr: i + 1,
  }));

  plan.push(
    { art: "frage", von: 0.86, bis: 0.94 },
    { art: "akte", von: 0.94, bis: 1.01 },
  );

  return plan;
}

export function IntroSequenz({
  fall,
  onFertig,
}: {
  fall: PublicCase;
  /** Wird erst aufgerufen, wenn der Spieler die Fallakte antippt. */
  onFertig: () => void;
}) {
  const startRef = useRef(performance.now());
  const [fortschritt, setFortschritt] = useState(0);
  const [tonAn, setTonAn] = useState(true);

  const plan = useMemo(() => szenenPlan(fall), [fall]);

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

      // Bei 1 bleibt es stehen: Die Fallakte wartet auf den Fingertipp.
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
        if (!tonAn) void spiele("intro").then(setTonAn);
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
            <button className="intro-ton" onClick={() => void spiele("intro").then(setTonAn)}>
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
      // Nur Titel und Text - ein Tipp irgendwo darauf startet die Runde.
      return (
        <button className="akte einblenden" onClick={onStarten}>
          <h1 className="akte-titel">{fall.titel}</h1>
          <p className="akte-text">{fall.tatbeschreibung}</p>
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
