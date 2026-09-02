"use client";

import { useEffect, useRef, useState } from "react";
import { Szene } from "./Bild";
import type { Character } from "@/lib/types";

/**
 * Der Moment zwischen Beschuldigung und Urteil.
 *
 * Früher stand sofort "Fall gelöst!" oder "Daneben!" da - der Schlag war
 * vorbei, ehe er kam. Jetzt sieht man erst den Beschuldigten und hört, was er
 * dazu sagt. Erst danach fällt das Urteil, und mit ihm die Musik: Die soll
 * nicht zu einem Satz laufen, der noch nichts entschieden hat.
 *
 * Kurz gehalten und jederzeit übertippbar - Spannung ja, Wartezeit nein.
 */
const DAUER = 4000;

export function ReaktionScreen({
  charakter,
  text,
  onFertig,
}: {
  charakter: Character | undefined;
  text: string;
  onFertig: () => void;
}) {
  const [zeigen, setZeigen] = useState(false);
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  useEffect(() => {
    // Erst ein Wimpernschlag Schwarz, dann kommt das Gesicht.
    const auf = window.setTimeout(() => setZeigen(true), 260);
    const zu = window.setTimeout(() => fertigRef.current(), DAUER);
    return () => {
      window.clearTimeout(auf);
      window.clearTimeout(zu);
    };
  }, []);

  return (
    <div className="reaktion" onPointerDown={() => fertigRef.current()}>
      <Szene
        src={charakter?.bild}
        alt={charakter?.name ?? ""}
        platzhalter={charakter?.name}
        variante="portraet"
      />

      <div className="reaktion-inhalt" data-zeigen={zeigen}>
        <span className="intro-oberzeile">Die Beschuldigung steht im Raum</span>
        <h1 className="intro-stadt slam">{charakter?.name ?? "…"}</h1>
        <p className="reaktion-satz">„{text}“</p>
        <span className="reaktion-hinweis">Das Urteil folgt …</span>
      </div>
    </div>
  );
}
