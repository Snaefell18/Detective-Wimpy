"use client";

import { useCallback, useEffect, useState } from "react";
import { istZugriffVerweigert, ladeStaedte } from "./db";
import { stadtRegal, type Stadt } from "./staedte";

/**
 * Die geplanten Städte, überall dort, wo man eine auswählen kann.
 *
 * Ohne Verbindung bleibt die Liste leer - dann fehlt eben die Auswahl, und
 * man legt seinen Plan wie bisher von Hand. Ein Fehler, der einen Editor
 * blockiert, wäre hier das größere Übel.
 */
export function useStaedte() {
  const [staedte, setStaedte] = useState<Stadt[]>([]);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const ergebnis = await ladeStaedte();
      setStaedte(stadtRegal(ergebnis.daten));
      setFehler("");
    } catch (grund) {
      // Steht die Sammlung noch nicht in den Regeln, sieht das aus wie ein
      // Rechteproblem - ist aber nur eine unveröffentlichte Regeldatei.
      setFehler(
        istZugriffVerweigert(grund)
          ? "Die Sammlung „staedte“ fehlt noch in den Firestore-Regeln. firestore.rules veröffentlichen, dann geht es."
          : "Die geplanten Städte konnten nicht geladen werden.",
      );
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return { staedte, laden, fehler, laedt };
}
