"use client";

import { useCallback, useEffect, useState } from "react";
import type { Saga, SagaLauf } from "./sagaTypen";
import { versammlungNach } from "./versammlung";
import { verfolgungNach } from "./verfolgung";
import { beobachteSaga3D } from "./db";
import { aktualisiereSaga3D } from "./saga3dSync";

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
  const sagaId = stand?.saga.id;

  useEffect(() => {
    if (!geladen || !sagaId) return;
    let abbestellen: (() => void) | undefined;
    try {
      abbestellen = beobachteSaga3D(sagaId, (kapitel3d) => {
        setStand((alt) => aktualisiereSaga3D(alt, sagaId, kapitel3d));
      });
    } catch {
      // Auch ohne konfigurierte Datenbank kann der lokale Durchgang weiterlaufen.
    }
    return () => abbestellen?.();
  }, [geladen, sagaId]);

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

  /**
   * Nur das Finale spielen - für eine Saga, die schon durch ist.
   *
   * Gedacht für den Fall, dass das Finale beim ersten Durchgang ausgefallen
   * ist: Die Kapitel muss dann niemand noch einmal spielen. Es beginnt beim
   * Erzählertext vor dem Finale; alle Kapitel gelten als gelöst, damit
   * nichts mehr auf sie wartet.
   */
  const nurFinale = useCallback((saga: Saga) => {
    setStand({
      saga,
      lauf: {
        sagaId: saga.id,
        kapitel: Math.max(0, saga.kapitel.length - 1),
        phase: "finale-erzaehler",
        fallId: null,
        geloest: saga.kapitel.map((k) => k.nummer),
      },
    });
  }, []);

  /**
   * Gegen wen der Showdown geht - mitgeschrieben, nicht nur gemerkt.
   *
   * Der Kampf ist der längste Abschnitt einer Saga; ein Neuladen mittendrin
   * darf nicht dazu führen, dass plötzlich ein anderes Tier in der Arena
   * steht.
   */
  const setzeShowdownGegner = useCallback((charakterId: string) => {
    setStand((alt) =>
      alt ? { ...alt, lauf: { ...alt.lauf, showdownGegnerId: charakterId } } : alt,
    );
  }, []);

  const setzePhase = useCallback(
    (
      phase: SagaLauf["phase"],
      fallId?: string | null,
      /** Nur beim Sprung in den Epilog: Wurde das Finale gelöst? */
      finaleGeschafft?: boolean,
    ) => {
      setStand((alt) =>
        alt
          ? {
              ...alt,
              lauf: {
                ...alt.lauf,
                phase,
                fallId: fallId === undefined ? alt.lauf.fallId : fallId,
                finaleGeschafft:
                  finaleGeschafft === undefined
                    ? alt.lauf.finaleGeschafft
                    : finaleGeschafft,
              },
            }
          : alt,
      );
    },
    [],
  );

  /** Kapitel gelöst - erst in einen eingerichteten Rat, sonst direkt weiter. */
  const kapitelGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt) return alt;
      const nummer = alt.lauf.kapitel + 1;
      const geloest = alt.lauf.geloest.includes(nummer)
        ? alt.lauf.geloest
        : [...alt.lauf.geloest, nummer];
      const letztes = alt.lauf.kapitel >= alt.saga.kapitel.length - 1;
      const rat = versammlungNach(alt.saga.vorgaben, nummer);
      const jagd = verfolgungNach(alt.saga.vorgaben, nummer);
      return {
        ...alt,
        lauf: letztes
          ? { ...alt.lauf, geloest, phase: "finale-erzaehler", fallId: null }
          : jagd
            ? { ...alt.lauf, geloest, phase: "verfolgung", fallId: null }
          : rat
            ? { ...alt.lauf, geloest, phase: "versammlung", fallId: null }
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

  /** Der Vorsitz oder der Spieler hat die Versammlung beendet. */
  const versammlungGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt || alt.lauf.phase !== "versammlung") return alt;
      const naechstes = alt.lauf.kapitel + 1;
      const letztes = naechstes >= alt.saga.kapitel.length;
      return {
        ...alt,
        lauf: letztes
          ? { ...alt.lauf, phase: "finale-erzaehler", fallId: null }
          : { ...alt.lauf, kapitel: naechstes, phase: "erzaehler", fallId: null },
      };
    });
  }, []);

  /** Nach dem Fang geht es genau wie nach einem geschlossenen Rat weiter. */
  const verfolgungGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt || alt.lauf.phase !== "verfolgung") return alt;
      const naechstes = alt.lauf.kapitel + 1;
      const letztes = naechstes >= alt.saga.kapitel.length;
      return {
        ...alt,
        lauf: letztes
          ? { ...alt.lauf, phase: "finale-erzaehler", fallId: null }
          : { ...alt.lauf, kapitel: naechstes, phase: "erzaehler", fallId: null },
      };
    });
  }, []);

  const beenden = useCallback(() => setStand(null), []);

  return {
    stand,
    geladen,
    starten,
    nurFinale,
    setzePhase,
    setzeShowdownGegner,
    kapitelGeschafft,
    versammlungGeschafft,
    verfolgungGeschafft,
    beenden,
  };
}
