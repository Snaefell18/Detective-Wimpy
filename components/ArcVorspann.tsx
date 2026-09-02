"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spiele, stand, stoppe, type Stueck } from "@/lib/introAudio";
import { nenntNamen, ohneNamen } from "@/lib/namenSchutz";
import { useStammdaten } from "@/lib/stammdaten";
import type { Arc } from "@/lib/arcTypen";

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

  return (
    <div
      className="intro vorspann arc-vorspann"
      onPointerDown={() => {
        if (!tonAn) void spiele(stueck).then(setTonAn);
      }}
    >
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
