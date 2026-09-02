"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import type { Character } from "@/lib/types";

/**
 * "Ein neuer Spieler betritt das Feld!"
 *
 * Die kurze Ansage, bevor ein Kapitel beginnt, in dem jemand zum ersten Mal
 * dabei ist. Sie ist absichtlich knapp gehalten - eine Ankündigung, kein
 * zweites Intro: Name, Bild, ein Satz. Weiter geht es von allein oder auf
 * Fingertipp.
 *
 * Stoßen mehrere dazu, kommt einer nach dem anderen.
 */
const DAUER = 3400;

export function NeuerSpieler({
  tiere,
  onFertig,
}: {
  tiere: Character[];
  onFertig: () => void;
}) {
  const [nr, setNr] = useState(0);
  const tier = tiere[nr];

  // Die Rückmeldung liegt in einem Ref: Sonst würde jeder Renderdurchgang der
  // Elternseite den Wecker neu stellen, und die Ansage bliebe stehen.
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  const weiter = () => {
    if (nr + 1 < tiere.length) setNr(nr + 1);
    else fertigRef.current();
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (nr + 1 < tiere.length) setNr(nr + 1);
      else fertigRef.current();
    }, DAUER);
    return () => window.clearTimeout(id);
  }, [nr, tiere.length]);

  // Sollte nie vorkommen - aber ein leerer Bildschirm wäre eine Sackgasse.
  useEffect(() => {
    if (!tier) fertigRef.current();
  }, [tier]);
  if (!tier) return null;

  return (
    <div className="intro neuzugang" onPointerDown={weiter}>
      <div className="intro-buehne">
        <div className="szene-block neuzugang-szene" key={tier.id}>
          <p className="intro-oberzeile einfliegen">
            {tiere.length > 1 && nr === 0
              ? "Neue Spieler betreten das Feld!"
              : "Ein neuer Spieler betritt das Feld!"}
          </p>

          <div className="intro-portraet slam-seite">
            <Bild src={tier.bild} alt={tier.name} platzhalter={tier.name} groesse="260px" sofort />
          </div>

          <h1 className="intro-logo slam">{tier.name}</h1>
          <p className="leise neuzugang-zeile">
            {[tier.beruf, tier.tierart].filter(Boolean).join(" · ")}
          </p>
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
            Weiter ›
          </button>
        </div>
      </div>
    </div>
  );
}
