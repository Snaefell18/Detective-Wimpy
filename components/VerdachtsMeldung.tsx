"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import type { Character } from "@/lib/types";

/**
 * Die kurze Einblendung, wenn ein Verdacht sich bewegt.
 *
 * Sie fährt von rechts herein, bleibt zwei Sekunden und geht wieder - ohne
 * Knopf, ohne Bestätigung, und vor allem ohne Berührungen zu schlucken
 * (pointer-events: none): Wer gerade tippt, merkt nichts davon außer der
 * Meldung selbst.
 */
const DAUER = 2400;

export type Verdachtsmeldung = {
  /** Eigener Schlüssel je Meldung - sonst spielt die Animation nicht neu. */
  id: number;
  charakter: Character;
  richtung: "hoch" | "runter";
  wert: number;
};

export function VerdachtsMeldung({
  meldung,
  onFertig,
}: {
  meldung: Verdachtsmeldung;
  onFertig: () => void;
}) {
  const [zu, setZu] = useState(false);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  useEffect(() => {
    setZu(false);
    const raus = window.setTimeout(() => setZu(true), DAUER);
    const weg = window.setTimeout(() => fertigRef.current(), DAUER + 400);
    return () => {
      window.clearTimeout(raus);
      window.clearTimeout(weg);
    };
  }, [meldung.id]);

  return (
    <div className="verdacht-meldung" data-zu={zu} data-richtung={meldung.richtung}>
      <div className="verdacht-meldung-bild">
        <Bild
          src={meldung.charakter.bild}
          alt={meldung.charakter.name}
          platzhalter={meldung.charakter.name}
          groesse="64px"
        />
      </div>
      <div className="verdacht-meldung-text">
        <strong>{meldung.charakter.name}</strong>
        <span>
          Verdacht {meldung.richtung === "hoch" ? "↑" : "↓"} {meldung.wert}
        </span>
      </div>
    </div>
  );
}
