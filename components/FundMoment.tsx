"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import type { Fund } from "@/lib/useGame";

/**
 * Der kurze Moment, in dem Wimpy etwas findet.
 *
 * Bewusst als Einblendung über dem Ort, nicht als eigener Bildschirm: Der
 * Fund soll einen Schlag bekommen, aber niemanden aus dem Spiel reißen. Er
 * kommt wie eine Tatortaufnahme - Blitz, Gegenstand, ein Satz - und geht nach
 * ein paar Sekunden von allein wieder. Ein Tippen schließt ihn sofort.
 *
 * Der Text bleibt danach im Notizbuch stehen; hier wird nichts gesagt, was
 * dort nicht auch steht.
 */
const DAUER = 4200;

export function FundMoment({ fund, onFertig }: { fund: Fund; onFertig: () => void }) {
  const spur = fund.spur;
  const [zu, setZu] = useState(false);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  useEffect(() => {
    const id = window.setTimeout(() => setZu(true), DAUER);
    return () => window.clearTimeout(id);
  }, []);

  // Erst ausblenden, dann wirklich weg - sonst springt der Bildschirm.
  useEffect(() => {
    if (!zu) return;
    const id = window.setTimeout(() => fertigRef.current(), 260);
    return () => window.clearTimeout(id);
  }, [zu]);

  if (!spur) return null;

  return (
    <div className="fund-moment" data-zu={zu} onPointerDown={() => setZu(true)}>
      <div className="fund-blitz" />

      <div className="fund-karte">
        <div className="fund-bild">
          <Bild src={spur.bild} alt={spur.name} platzhalter={spur.name} groesse="180px" sofort />
        </div>

        <div className="fund-text">
          <span className="intro-oberzeile">Gefunden</span>
          <strong>{spur.name}</strong>
          <p>{spur.beobachtung}</p>
          {spur.vermutung && <p className="fund-murmel">„{spur.vermutung}“</p>}
        </div>
      </div>
    </div>
  );
}
