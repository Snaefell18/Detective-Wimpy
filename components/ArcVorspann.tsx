"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spiele, stand, stoppe, type Stueck } from "@/lib/introAudio";
import { nenntNamen, ohneNamen } from "@/lib/namenSchutz";
import { useStammdaten } from "@/lib/stammdaten";
import type { Arc, ArcVorspannArt } from "@/lib/arcTypen";

/**
 * Der Vorspann eines Arcs: die Titelsequenz zum eigenen Titelsong.
 *
 * Bewusst schlichter geschnitten als der Saga-Vorspann - hier wird keine
 * Geschichte angerissen, sondern eine ganze Reihe eröffnet: Titel, Klappentext,
 * die Stationen, dann los. Ohne Tondatei läuft er nach fester Zeit durch.
 */
const STUMME_DAUER = 24;

/** Der Titelsong des Arcs, sonst der übliche. */
export const themeVon = (arc: Arc): Stueck =>
  arc.themeSong.startsWith("/") ? (arc.themeSong as Stueck) : "intro";

type Szenenbild = "praesentiert" | "titel" | "klappentext" | "stationen" | "einsatz";

export function ArcVorspann({ arc, onFertig }: { arc: Arc; onFertig: () => void }) {
  const startRef = useRef(performance.now());
  const [fortschritt, setFortschritt] = useState(0);
  const [tonAn, setTonAn] = useState(true);
  const stueck = useMemo(() => themeVon(arc), [arc]);

  // Der Culprit steht erst in der letzten Saga auf der Bühne - im Vorspann
  // darf sein Name nirgends auftauchen.
  const { charaktere } = useStammdaten();
  const gezeigt = useMemo(() => {
    const name = charaktere.find((c) => c.id === arc.culprit.charakterId)?.name;
    if (!name) return arc;
    return {
      ...arc,
      klappentext: ohneNamen(arc.klappentext, [name]),
      teile: arc.teile.map((t) => ({
        ...t,
        name: nenntNamen(t.name, [name]).length ? `Teil ${t.nummer}` : t.name,
      })),
    };
  }, [arc, charaktere]);

  useEffect(() => {
    let laeuftNoch = true;

    void spiele(stueck).then((geklappt) => {
      if (laeuftNoch) setTonAn(geklappt);
    });

    const tick = () => {
      if (!laeuftNoch) return;
      const { zeit, dauer } = stand(stueck);
      const gesamt = dauer ?? STUMME_DAUER;
      const vergangen = zeit > 0 ? zeit : (performance.now() - startRef.current) / 1000;
      setFortschritt(Math.min(1, vergangen / gesamt));
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      laeuftNoch = false;
      cancelAnimationFrame(id);
      stoppe(stueck);
    };
  }, [stueck]);

  useEffect(() => {
    if (fortschritt >= 1) onFertig();
  }, [fortschritt, onFertig]);

  const szene: Szenenbild =
    fortschritt < 0.12
      ? "praesentiert"
      : fortschritt < 0.4
        ? "titel"
        : fortschritt < 0.66
          ? "klappentext"
          : fortschritt < 0.9
            ? "stationen"
            : "einsatz";

  const art: ArcVorspannArt = arc.vorspannArt ?? "klassisch";

  return (
    <div
      className="intro vorspann arc-vorspann"
      data-art={art}
      // Manches wächst über den ganzen Vorspann mit: der Schnee, der liegen
      // bleibt, das Grün, das kommt, das Licht, das kippt.
      style={{ ["--vorspann" as string]: fortschritt.toFixed(3) }}
      onPointerDown={() => {
        if (!tonAn) void spiele(stueck).then(setTonAn);
      }}
    >
      <Jahreszeit art={art} />

      <div className="intro-buehne">
        <ArcSzene szene={szene} arc={gezeigt} key={szene} />
      </div>

      <div className="intro-leiste">
        <div className="intro-fortschritt">
          <span style={{ width: `${fortschritt * 100}%` }} />
        </div>
        <div className="intro-knoepfe">
          {!tonAn && (
            <button className="intro-ton" onClick={() => void spiele(stueck).then(setTonAn)}>
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

/**
 * Die Jahreszeit über dem Vorspann.
 *
 * Jede Art ist aus mehreren Schichten gebaut, die verschieden schnell ziehen -
 * daher die Tiefe. Alles ist gemalt: kein Bild, kein Video, keine Ladezeit.
 * Was fällt, fällt in festen Bahnen, damit es bei jedem Durchlauf gleich
 * aussieht.
 */
const BAHNEN = Array.from({ length: 16 }, (_, i) => i);

function Treiben({ klasse, zeichen }: { klasse: string; zeichen?: string[] }) {
  return (
    <div className={klasse} aria-hidden="true">
      {BAHNEN.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 31 + 7) % 97}%`,
            animationDelay: `${((i * 17) % 60) / 10}s`,
            animationDuration: `${6 + ((i * 7) % 7)}s`,
          }}
        >
          {zeichen ? zeichen[i % zeichen.length] : null}
        </span>
      ))}
    </div>
  );
}

const BLUETEN = ["🌸", "🌼", "🌺", "🌷", "🌻", "💮"];
const BLAETTER = ["🍂", "🍁", "🍃", "🍂", "🍁", "🌾"];
const KNOSPEN = ["🌱", "🌿", "☘️", "🌸", "🐝", "🦋"];

function Jahreszeit({ art }: { art: ArcVorspannArt }) {
  if (art === "klassisch") return null;

  return (
    <div className="jahreszeit" data-art={art} aria-hidden="true">
      <div className="jahreszeit-licht" />
      <div className="jahreszeit-dunst" />

      {art === "blumen" && (
        <>
          <Treiben klasse="jahreszeit-treiben gross" zeichen={BLUETEN} />
          <Treiben klasse="jahreszeit-treiben fern" zeichen={BLUETEN} />
          <div className="jahreszeit-wiese">
            <span />
            <span />
            <span />
          </div>
        </>
      )}

      {art === "herbst" && (
        <>
          <Treiben klasse="jahreszeit-treiben gross" zeichen={BLAETTER} />
          <Treiben klasse="jahreszeit-treiben fern" zeichen={BLAETTER} />
          <div className="jahreszeit-baeume">
            <span />
            <span />
            <span />
            <span />
          </div>
        </>
      )}

      {art === "schnee" && (
        <>
          <div className="jahreszeit-flocken" data-tiefe="1" />
          <div className="jahreszeit-flocken" data-tiefe="2" />
          <div className="jahreszeit-flocken" data-tiefe="3" />
          {/* Der Schnee bleibt liegen: Die Wehe wächst mit dem Vorspann. */}
          <div className="jahreszeit-wehe" />
        </>
      )}

      {art === "fruehling" && (
        <>
          <div className="jahreszeit-tropfen" data-tiefe="1" />
          <div className="jahreszeit-tropfen" data-tiefe="2" />
          <Treiben klasse="jahreszeit-treiben gross" zeichen={KNOSPEN} />
          {/* Das Grün kommt erst im Lauf des Vorspanns. */}
          <div className="jahreszeit-gruen">
            <span />
            <span />
            <span />
            <span />
          </div>
        </>
      )}
    </div>
  );
}

function ArcSzene({ szene, arc }: { szene: Szenenbild; arc: Arc }) {
  if (szene === "praesentiert") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="intro-oberzeile">Detective Wimpy in</p>
      </div>
    );
  }

  if (szene === "titel") {
    return (
      <div className="vorspann-mitte">
        <p className="intro-oberzeile einfliegen">
          Ein Arc in {arc.teile.length} {arc.teile.length === 1 ? "Saga" : "Sagen"}
        </p>
        <h1 className="intro-logo slam">{arc.name}</h1>
      </div>
    );
  }

  if (szene === "klappentext") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="vorspann-thema">{arc.klappentext}</p>
      </div>
    );
  }

  if (szene === "stationen") {
    return (
      <div className="vorspann-mitte einfliegen">
        <p className="intro-oberzeile">Die Stationen</p>
        <ol className="vorspann-kapitel">
          {arc.teile.map((t) => (
            <li key={t.nummer}>{t.name}</li>
          ))}
          <li data-finale="true">Finale</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="vorspann-mitte">
      <h2 className="intro-stadt slam">{arc.name}</h2>
      <p className="vorspann-thema">Es beginnt.</p>
    </div>
  );
}
