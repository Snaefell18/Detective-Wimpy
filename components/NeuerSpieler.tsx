"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { tonQuelle } from "@/lib/stimme";
import type { Character } from "@/lib/types";

/**
 * "Ein neuer Spieler betritt das Feld!"
 *
 * Die Ansage, bevor ein Kapitel beginnt, in dem jemand zum ersten Mal dabei
 * ist. Sie läuft in zwei Schlägen:
 *
 * 1. Spannung: die Zeile, darunter nur ein Schatten. Dazu - wenn eingestellt -
 *    ein Effekt oder der Sprecher.
 * 2. Enthüllung: Erst wenn der Ton zu Ende ist, kommt die Figur ans Licht.
 *    Genau daher kommt die Wirkung; ein Bild, das schon während des Tons
 *    dasteht, nimmt ihm alles.
 *
 * Ohne Ton bleibt der erste Schlag kurz - stehen bleibt er nie.
 */

/** Spannungspause, wenn kein Ton eingestellt ist. */
const OHNE_TON = 1400;
/** Wie lange die enthüllte Figur stehen bleibt. */
const NACH_ENTHUELLUNG = 2800;
/** Notbremse: Ein Ton, der nicht endet, darf das Spiel nicht anhalten. */
const HOECHSTENS = 12_000;

export function NeuerSpieler({
  tiere,
  ton = "",
  onFertig,
}: {
  tiere: Character[];
  /** Pfad oder "stimme:<id>" - leer heißt: ohne Ton. */
  ton?: string;
  onFertig: () => void;
}) {
  const [nr, setNr] = useState(0);
  const [enthuellt, setEnthuellt] = useState(false);
  const tier = tiere[nr];

  // Die Rückmeldung liegt in einem Ref: Sonst würde jeder Renderdurchgang der
  // Elternseite den Wecker neu stellen, und die Ansage bliebe stehen.
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Erst enthüllen, dann weiter - ein Tippen macht immer den nächsten Schritt. */
  const weiter = () => {
    if (!enthuellt) {
      audioRef.current?.pause();
      setEnthuellt(true);
      return;
    }
    if (nr + 1 < tiere.length) setNr(nr + 1);
    else fertigRef.current();
  };

  // Erster Schlag: der Ton läuft, die Figur bleibt im Dunkeln.
  useEffect(() => {
    let aktiv = true;
    let wecker = 0;
    setEnthuellt(false);

    const enthuellen = () => {
      if (aktiv) setEnthuellt(true);
    };

    if (!ton) {
      wecker = window.setTimeout(enthuellen, OHNE_TON);
      return () => {
        aktiv = false;
        window.clearTimeout(wecker);
      };
    }

    void tonQuelle(ton).then((quelle) => {
      if (!aktiv) return;
      if (!quelle) {
        wecker = window.setTimeout(enthuellen, OHNE_TON);
        return;
      }

      const audio = new Audio(quelle);
      audioRef.current = audio;
      audio.addEventListener("ended", enthuellen);
      // Kennt der Browser die Länge, hängt die Notbremse daran; sonst greift
      // sie nach der Höchstzeit.
      audio.addEventListener("loadedmetadata", () => {
        if (!aktiv || !Number.isFinite(audio.duration)) return;
        window.clearTimeout(wecker);
        wecker = window.setTimeout(enthuellen, audio.duration * 1000 + 400);
      });
      wecker = window.setTimeout(enthuellen, HOECHSTENS);

      void audio.play().catch(() => {
        // Verweigert der Browser den Ton, wird trotzdem enthüllt - nur eben
        // nach der kurzen Pause statt nach dem Effekt.
        window.clearTimeout(wecker);
        wecker = window.setTimeout(enthuellen, OHNE_TON);
      });
    });

    return () => {
      aktiv = false;
      window.clearTimeout(wecker);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [nr, ton]);

  // Zweiter Schlag: Nach der Enthüllung geht es von allein weiter.
  useEffect(() => {
    if (!enthuellt) return;
    const id = window.setTimeout(() => {
      if (nr + 1 < tiere.length) setNr(nr + 1);
      else fertigRef.current();
    }, NACH_ENTHUELLUNG);
    return () => window.clearTimeout(id);
  }, [enthuellt, nr, tiere.length]);

  // Sollte nie vorkommen - aber ein leerer Bildschirm wäre eine Sackgasse.
  useEffect(() => {
    if (!tier) fertigRef.current();
  }, [tier]);
  if (!tier) return null;

  return (
    <div className="intro neuzugang" data-enthuellt={enthuellt} onPointerDown={weiter}>
      {/* Ein Lichtblitz im Moment der Enthüllung. */}
      {enthuellt && <div className="neuzugang-blitz" key={`blitz-${nr}`} />}

      <div className="intro-buehne">
        <div className="szene-block neuzugang-szene" key={tier.id}>
          <p className="intro-oberzeile einfliegen">
            {tiere.length > 1 && nr === 0
              ? "Neue Spieler betreten das Feld!"
              : "Ein neuer Spieler betritt das Feld!"}
          </p>

          <div className="intro-portraet neuzugang-portraet">
            <Bild src={tier.bild} alt={tier.name} platzhalter={tier.name} groesse="260px" sofort />
          </div>

          {enthuellt ? (
            <>
              <h1 className="intro-logo slam">{tier.name}</h1>
              <p className="leise neuzugang-zeile">
                {[tier.beruf, tier.tierart].filter(Boolean).join(" · ")}
              </p>
            </>
          ) : (
            <>
              <h1 className="intro-logo neuzugang-raetsel">?</h1>
              <p className="leise neuzugang-zeile">Wer ist das?</p>
            </>
          )}
        </div>
      </div>

      <div className="intro-leiste">
        <div className="intro-knoepfe">
          {tiere.length > 1 && (
            <span className="intro-nummer">
              {nr + 1} / {tiere.length}
            </span>
          )}
          <button
            className="intro-skip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={weiter}
          >
            {enthuellt ? "Weiter ›" : "Zeigen ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
