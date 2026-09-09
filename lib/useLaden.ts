"use client";

import { useEffect, useState } from "react";
import { ladeZubehoer } from "./db";
import { GRUNDREGAL, type Zubehoer } from "./zubehoer";

/**
 * Was im Laden steht - für alle, die es nur nachschlagen wollen.
 *
 * Bis die Datenbank antwortet (und falls sie es nie tut) gilt das Grundregal.
 * So ist die Liste nie leer und nie `null`: Niemand muss einen Ladezustand
 * behandeln, und ein fehlendes Netz führt nirgends zu einem Fehler.
 *
 * Der Laden selbst (components/ShopScreen.tsx) hat seine eigene Fassung - er
 * muss zeigen, dass gerade aufgeschlossen wird.
 */
export function useLaden(): Zubehoer[] {
  const [laden, setLaden] = useState<Zubehoer[]>(GRUNDREGAL);

  useEffect(() => {
    let sichtbar = true;
    void ladeZubehoer()
      .then(({ daten }) => {
        if (!sichtbar) return;
        const eigene = daten.filter((z) => !z.versteckt);
        // Was unter derselben Id angelegt wurde, gewinnt; der Rest des
        // Grundregals kommt dazu.
        const fehlend = GRUNDREGAL.filter((g) => !eigene.some((z) => z.id === g.id));
        setLaden([...fehlend, ...eigene]);
      })
      .catch(() => {
        // Ohne Verbindung bleibt es beim Grundregal.
      });
    return () => {
      sichtbar = false;
    };
  }, []);

  return laden;
}
