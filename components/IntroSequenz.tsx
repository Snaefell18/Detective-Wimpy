"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bild } from "./Bild";
import { spiele, stand, stoppe } from "@/lib/introAudio";
import type { Character, PublicCase } from "@/lib/types";

/** Ohne Musik (blockierter Ton) läuft das Intro deutlich kürzer. */
const STUMME_DAUER = 34;

type Szene =
  | { art: "titel"; von: number; bis: number }
  | { art: "stadt"; von: number; bis: number }
  | { art: "wort"; von: number; bis: number; wort: string; nr: number }
  | { art: "verdaechtig"; von: number; bis: number; charakter: Character; nr: number }
  | { art: "orte"; von: number; bis: number }
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

  verteile(verdaechtige, 0.42, 0.72, (charakter, i, von, bis) => ({
    art: "verdaechtig",
    von,
    bis,
    charakter,
    nr: i + 1,
  }));

  plan.push(
    { art: "orte", von: 0.72, bis: 0.85 },
    { art: "frage", von: 0.85, bis: 0.94 },
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

const szeneSchluessel = (szene: Szene) =>
  szene.art === "verdaechtig"
    ? `v-${szene.charakter.id}`
    : szene.art === "wort"
      ? `w-${szene.nr}`
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
          <div className="intro-streifen">
            {fall.orte.slice(0, 5).map((ort, i) => (
              <div
                key={ort.id}
                className="intro-streifen-bild wischen"
                style={{ animationDelay: `${i * 0.09}s` }}
              >
                <Bild src={ort.bild} alt={ort.name} platzhalter="" groesse="120px" />
              </div>
            ))}
          </div>
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

    case "orte":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Schauplätze</p>
          <div className="intro-orte">
            {fall.orte.map((ort, i) => (
              <div
                key={ort.id}
                className="intro-ort aufpoppen"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="intro-ort-bild">
                  <Bild src={ort.bild} alt={ort.name} platzhalter={ort.name} groesse="180px" />
                </div>
                <strong>{ort.name}</strong>
              </div>
            ))}
          </div>
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
      // Die vollständige Fallakte - ein Tipp darauf startet die Runde.
      return (
        <button className="akte einblenden" onClick={onStarten}>
          <span className="akte-marke">Fallakte · {fall.stadt}</span>
          <h1 className="akte-titel">{fall.titel}</h1>
          <p className="akte-text">{fall.tatbeschreibung}</p>

          <div className="akte-zahlen">
            <span>
              <strong>{fall.besetzung.length - 1}</strong> Verdächtige
            </span>
            <span>
              <strong>{fall.orte.length}</strong> Schauplätze
            </span>
          </div>

          <span className="akte-knopf">Fall übernehmen ›</span>
        </button>
      );
  }
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
