"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bild } from "./Bild";
import type { Character, PublicCase } from "@/lib/types";

/** Ohne Musik (z.B. wenn der Browser das Abspielen blockiert) wird gekürzt. */
const STUMME_DAUER = 32;

type Szene =
  | { art: "titel"; von: number; bis: number }
  | { art: "stadt"; von: number; bis: number }
  | { art: "fall"; von: number; bis: number }
  | { art: "verdaechtig"; von: number; bis: number; charakter: Character; nr: number }
  | { art: "orte"; von: number; bis: number }
  | { art: "frage"; von: number; bis: number }
  | { art: "los"; von: number; bis: number };

/**
 * Baut den Ablauf als Anteile der Gesamtdauer (0..1). Dadurch passt das Intro
 * automatisch auf jede Songlänge - egal ob 30 Sekunden oder drei Minuten.
 */
function szenenPlan(fall: PublicCase | null): Szene[] {
  const verdaechtige = fall?.besetzung.filter((c) => !c.istDetektiv) ?? [];

  const plan: Szene[] = [
    { art: "titel", von: 0, bis: 0.1 },
    { art: "stadt", von: 0.1, bis: 0.22 },
    { art: "fall", von: 0.22, bis: 0.36 },
  ];

  // Die Verdächtigen teilen sich den Mittelteil.
  const von = 0.36;
  const bis = 0.68;
  const schritt = verdaechtige.length ? (bis - von) / verdaechtige.length : 0;
  verdaechtige.forEach((charakter, i) => {
    plan.push({
      art: "verdaechtig",
      von: von + i * schritt,
      bis: von + (i + 1) * schritt,
      charakter,
      nr: i + 1,
    });
  });

  plan.push(
    { art: "orte", von: 0.68, bis: 0.84 },
    { art: "frage", von: 0.84, bis: 0.94 },
    { art: "los", von: 0.94, bis: 1 },
  );

  return plan;
}

export function IntroSequenz({
  fall,
  fehler,
  onFertig,
}: {
  fall: PublicCase | null;
  fehler: string | null;
  onFertig: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const startRef = useRef<number>(performance.now());
  const fertigRef = useRef(false);
  const [fortschritt, setFortschritt] = useState(0);
  const [tonAn, setTonAn] = useState(true);

  const plan = useMemo(() => szenenPlan(fall), [fall]);

  // Der Fortschritt kommt aus dem Song selbst - so bleibt alles synchron.
  useEffect(() => {
    const audio = audioRef.current;
    let laeuft = true;

    void audio?.play().catch(() => {
      // iOS/Safari blockieren Autoplay ohne Geste - dann läuft das Intro stumm.
      setTonAn(false);
    });

    const tick = () => {
      if (!laeuft) return;

      const dauer = audio && Number.isFinite(audio.duration) && audio.duration > 1
        ? audio.duration
        : STUMME_DAUER;
      const zeit =
        audio && !audio.paused && audio.currentTime > 0
          ? audio.currentTime
          : (performance.now() - startRef.current) / 1000;

      const anteil = Math.min(1, zeit / dauer);
      setFortschritt(anteil);

      if (anteil >= 1) {
        if (!fertigRef.current) {
          fertigRef.current = true;
          onFertig();
        }
        return;
      }
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      laeuft = false;
      cancelAnimationFrame(id);
      audio?.pause();
    };
  }, [onFertig]);

  // Ein Fehler beim Erzeugen des Falls beendet das Intro sofort.
  useEffect(() => {
    if (fehler && !fertigRef.current) {
      fertigRef.current = true;
      onFertig();
    }
  }, [fehler, onFertig]);

  const szene = plan.find((s) => fortschritt >= s.von && fortschritt < s.bis) ?? plan[plan.length - 1];
  const lokal = Math.min(1, (fortschritt - szene.von) / Math.max(0.001, szene.bis - szene.von));

  return (
    <div className="intro">
      <audio ref={audioRef} src="/audio/intro.mp3" preload="auto" />

      <div className="intro-regen" />
      <div className="intro-strahl" />

      <div className="intro-buehne">
        <SzenenInhalt szene={szene} lokal={lokal} fall={fall} key={szeneSchluessel(szene)} />
      </div>

      <div className="intro-leiste">
        <div className="intro-fortschritt">
          <span style={{ width: `${fortschritt * 100}%` }} />
        </div>
        <div className="intro-knoepfe">
          {!tonAn && (
            <button
              className="intro-ton"
              onClick={() => {
                void audioRef.current?.play().then(() => setTonAn(true)).catch(() => {});
              }}
            >
              🔈 Ton an
            </button>
          )}
          <button
            className="intro-skip"
            onClick={() => {
              fertigRef.current = true;
              onFertig();
            }}
          >
            Überspringen ›
          </button>
        </div>
      </div>
    </div>
  );
}

const szeneSchluessel = (szene: Szene) =>
  szene.art === "verdaechtig" ? `${szene.art}-${szene.charakter.id}` : szene.art;

/* ------------------------------------------------------------------ */

function SzenenInhalt({
  szene,
  lokal,
  fall,
}: {
  szene: Szene;
  lokal: number;
  fall: PublicCase | null;
}) {
  switch (szene.art) {
    case "titel":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Ein neuer Fall für</p>
          <h1 className="intro-logo knallen">
            Detektiv
            <span>Wimpy</span>
          </h1>
        </div>
      );

    case "stadt":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Tatort</p>
          <h1 className="intro-stadt knallen">{fall?.stadt ?? "…"}</h1>
          <div className="intro-streifen">
            {(fall?.orte ?? []).slice(0, 5).map((ort, i) => (
              <div
                key={ort.id}
                className="intro-streifen-bild"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <Bild src={ort.bild} alt={ort.name} platzhalter={ort.name} />
              </div>
            ))}
          </div>
        </div>
      );

    case "fall":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Der Fall</p>
          <h1 className="intro-falltitel knallen">{fall?.titel ?? "Die Akte wird geöffnet …"}</h1>
          <p className="intro-text">
            {schreibmaschine(fall?.tatbeschreibung ?? "", lokal)}
            <span className="cursor" />
          </p>
        </div>
      );

    case "verdaechtig": {
      const c = szene.charakter;
      return (
        <div className="szene-block verdaechtig-szene">
          <div className="intro-portraet hereinschieben">
            <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
          </div>
          <div className="intro-steckbrief">
            <span className="intro-nummer">Verdächtige·r {szene.nr}</span>
            <h1 className="knallen">{c.name}</h1>
            <p className="leise">
              {c.tierart}, {c.alter} Jahre
            </p>
            <div className="intro-werte">
              <IntroWert label="Kriminell" wert={c.stats.kriminalitaetslevel} lokal={lokal} />
              <IntroWert label="Schelm" wert={c.stats.schelmischkeit} lokal={lokal} />
              <IntroWert label="Klugheit" wert={c.stats.intelligenz} lokal={lokal} />
            </div>
            <p className="intro-zitat">{c.beschreibung}</p>
          </div>
        </div>
      );
    }

    case "orte":
      return (
        <div className="szene-block">
          <p className="intro-oberzeile einfliegen">Schauplätze</p>
          <div className="intro-orte">
            {(fall?.orte ?? []).map((ort, i) => (
              <div
                key={ort.id}
                className="intro-ort aufpoppen"
                style={{ animationDelay: `${i * 0.14}s` }}
              >
                <div className="intro-ort-bild">
                  <Bild src={ort.bild} alt={ort.name} platzhalter={ort.name} />
                </div>
                <strong>{ort.name}</strong>
                <span className="leise klein">{ort.atmosphaere}</span>
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
            {(fall?.besetzung.filter((c) => !c.istDetektiv) ?? []).map((c, i) => (
              <div
                key={c.id}
                className="intro-gesicht flackern"
                style={{ animationDelay: `${i * 0.18}s` }}
              >
                <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
              </div>
            ))}
          </div>
        </div>
      );

    case "los":
      return (
        <div className="szene-block">
          <h1 className="intro-los knallen">Wimpy übernimmt den Fall</h1>
        </div>
      );
  }
}

function IntroWert({ label, wert, lokal }: { label: string; wert: number; lokal: number }) {
  const anteil = Math.min(1, lokal * 2.2) * wert * 10;
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

/** Schreibt den Text im Takt der Szene. */
function schreibmaschine(text: string, lokal: number): string {
  const zeichen = Math.floor(Math.min(1, lokal * 1.8) * text.length);
  return text.slice(0, zeichen);
}
