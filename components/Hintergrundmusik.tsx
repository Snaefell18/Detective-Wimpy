"use client";

import { useEffect } from "react";
import { musikPausieren, musikSpielen } from "@/lib/hintergrundMusik";

/**
 * Die Hintergrundmusik als Bauteil: Sie läuft, solange dieses Element im
 * Bild ist.
 *
 * Deshalb steht es genau dort, wo ermittelt wird - am Schauplatz, bei den
 * Verdächtigen, im Inventar, im Notizbuch und im Gespräch. Jede Szene, die
 * ihre eigene Musik mitbringt (Intro, Auftritt, Gerichtseinzug, Auflösung),
 * ist ein anderer Zweig; dort verschwindet dieses Element und die Musik
 * pausiert - und danach läuft sie an derselben Stelle weiter.
 *
 * Ohne Stück passiert nichts.
 */
export function Hintergrundmusik({ stueck }: { stueck: string }) {
  useEffect(() => {
    musikSpielen(stueck);
    return () => musikPausieren();
  }, [stueck]);

  return null;
}
