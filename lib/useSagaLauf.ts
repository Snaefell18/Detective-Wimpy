"use client";

import { useCallback, useEffect, useState } from "react";
import type { Saga, SagaLauf } from "./sagaTypen";

/**
 * Der Fortschritt in einer Saga - liegt nur auf dem Gerät.
 *
 * Die Saga selbst wird mitgespeichert, damit ein angefangener Durchgang auch
 * ohne Netz weiterläuft. Einzelne Fälle und Kampagnen sind davon unberührt.
 */
const KEY = "detective-wimpy:saga:v1";

export type SagaStand = { saga: Saga; lauf: SagaLauf } | null;

export function useSagaLauf() {
  const [stand, setStand] = useState<SagaStand>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(KEY);
      if (roh) {
        const daten = JSON.parse(roh) as SagaStand;
        if (daten?.saga?.kapitel?.length) setStand(daten);
      }
    } catch {
      // Kaputter Eintrag - dann eben ohne.
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return;
    try {
      if (stand) window.localStorage.setItem(KEY, JSON.stringify(stand));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Voller Speicher - der Durchgang läuft trotzdem weiter.
    }
  }, [stand, geladen]);

  const starten = useCallback((saga: Saga, vonVorn: boolean) => {
    setStand((alt) => {
      if (!vonVorn && alt?.saga.id === saga.id) {
        // Weiterspielen: die Saga frisch aus der Datenbank, Fortschritt behalten.
        return { saga, lauf: alt.lauf };
      }
      return {
        saga,
        // Ganz von vorn: erst der Vorspann, dann der Auftakt des Erzählers.
        lauf: { sagaId: saga.id, kapitel: 0, phase: "vorspann", fallId: null, geloest: [] },
      };
    });
  }, []);

  const setzePhase = useCallback((phase: SagaLauf["phase"], fallId?: string | null) => {
    setStand((alt) =>
      alt
        ? {
            ...alt,
            lauf: {
              ...alt.lauf,
              phase,
              fallId: fallId === undefined ? alt.lauf.fallId : fallId,
            },
          }
        : alt,
    );
  }, []);

  /** Kapitel gelöst - weiter zum nächsten Erzählerteil oder zum Finale. */
  const kapitelGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt) return alt;
      const nummer = alt.lauf.kapitel + 1;
      const geloest = alt.lauf.geloest.includes(nummer)
        ? alt.lauf.geloest
        : [...alt.lauf.geloest, nummer];
      const letztes = alt.lauf.kapitel >= alt.saga.kapitel.length - 1;
      return {
        ...alt,
        lauf: letztes
          ? { ...alt.lauf, geloest, phase: "finale-erzaehler", fallId: null }
          : {
              ...alt.lauf,
              geloest,
              kapitel: alt.lauf.kapitel + 1,
              phase: "erzaehler",
              fallId: null,
            },
      };
    });
  }, []);

  const beenden = useCallback(() => setStand(null), []);

  return { stand, geladen, starten, setzePhase, kapitelGeschafft, beenden };
}
