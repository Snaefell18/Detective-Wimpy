"use client";

import { useEffect, useMemo, useState } from "react";
import { type Stueck } from "@/lib/introAudio";
import { leseDauer, tafelnVerteilen } from "@/lib/introTiming";
import { useIntroUhr } from "@/lib/introUhr";
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

/**
 * Wie lange jede Tafel steht.
 *
 * Vorher waren es feste Anteile des Titelsongs - der Klappentext bekam ein
 * Viertel davon. Bei einem kurzen Song blitzte er nur auf: Ein Absatz, den
 * jemand vorlesen soll, braucht seine Zeit, und die hängt an seiner Länge,
 * nicht an der Aufnahme.
 */
function tafelnFuer(arc: Arc): { art: Szenenbild; dauer: number }[] {
  const stationen = arc.teile.map((t) => t.name).join(", ");
  return [
    { art: "praesentiert", dauer: leseDauer("Detective Wimpy in") },
    {
      art: "titel",
      dauer: leseDauer(`Ein Arc in ${arc.teile.length} Sagen ${arc.name}`, 3),
    },
    { art: "klappentext", dauer: leseDauer(arc.klappentext, 3) },
    { art: "stationen", dauer: leseDauer(`Die Stationen ${stationen} Finale`, 3) },
    { art: "einsatz", dauer: leseDauer(`${arc.name} Es beginnt.`, 3) },
  ];
}

export function ArcVorspann({ arc, onFertig }: { arc: Arc; onFertig: () => void }) {
  const [songDauer, setSongDauer] = useState<number | null>(null);
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

  const { plan, dauer } = useMemo(
    () => tafelnVerteilen(tafelnFuer(gezeigt), songDauer ?? STUMME_DAUER),
    [gezeigt, songDauer],
  );
  const { fortschritt, tonAn, anschalten } = useIntroUhr(stueck, dauer, setSongDauer);

  useEffect(() => {
    if (fortschritt >= 1) onFertig();
  }, [fortschritt, onFertig]);

  const szene: Szenenbild =
    (plan.find((tafel) => fortschritt >= tafel.von && fortschritt < tafel.bis) ?? plan[0]).art;

  const art: ArcVorspannArt = arc.vorspannArt ?? "klassisch";

  return (
    <div
      className="intro vorspann arc-vorspann"
      data-art={art}
      // Manches wächst über den ganzen Vorspann mit: der Schnee, der liegen
      // bleibt, das Grün, das kommt, das Licht, das kippt.
      style={{ ["--vorspann" as string]: fortschritt.toFixed(3) }}
      onPointerDown={() => {
        if (!tonAn) anschalten();
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
