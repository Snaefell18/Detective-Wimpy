"use client";

import { useCallback, useEffect, useState } from "react";
import type { Arc, ArcLauf } from "./arcTypen";

/**
 * Der Fortschritt in einem Arc - liegt nur auf dem Gerät.
 *
 * Der Arc selbst wird mitgespeichert, damit ein angefangener Durchgang auch
 * ohne Netz weiterläuft. Die Sagen darin werden dagegen frisch geladen: Ein
 * Arc darf wachsen, während gespielt wird.
 */
const KEY = "detective-wimpy:arc:v1";

export type ArcStand = { arc: Arc; lauf: ArcLauf } | null;

export function useArcLauf() {
  const [stand, setStand] = useState<ArcStand>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(KEY);
      if (roh) {
        const daten = JSON.parse(roh) as ArcStand;
        if (daten?.arc?.teile?.length) setStand(daten);
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

  const starten = useCallback((arc: Arc, vonVorn: boolean) => {
    setStand((alt) => {
      if (!vonVorn && alt?.arc.id === arc.id) {
        // Weiterspielen: der Arc frisch aus der Datenbank (er kann inzwischen
        // gewachsen sein), der Fortschritt bleibt.
        return { arc, lauf: { ...alt.lauf, teil: Math.min(alt.lauf.teil, arc.teile.length - 1) } };
      }
      return {
        arc,
        lauf: { arcId: arc.id, teil: 0, phase: "vorspann", sagaId: null, geschafft: [] },
      };
    });
  }, []);

  const setzePhase = useCallback((phase: ArcLauf["phase"], sagaId?: string | null) => {
    setStand((alt) =>
      alt
        ? {
            ...alt,
            lauf: {
              ...alt.lauf,
              phase,
              sagaId: sagaId === undefined ? alt.lauf.sagaId : sagaId,
            },
          }
        : alt,
    );
  }, []);

  /**
   * Eine Station ist durch - weiter zum nächsten Erzählerteil oder zum Finale.
   *
   * Fehlt die nächste Saga noch, bleibt der Lauf trotzdem stehen: Die Liste
   * zeigt dann, dass es hier vorerst nicht weitergeht.
   */
  const teilGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt) return alt;
      const nummer = alt.lauf.teil + 1;
      const geschafft = alt.lauf.geschafft.includes(nummer)
        ? alt.lauf.geschafft
        : [...alt.lauf.geschafft, nummer];
      const letzte = alt.lauf.teil >= alt.arc.teile.length - 1;
      return {
        ...alt,
        lauf: letzte
          ? { ...alt.lauf, geschafft, phase: "finale", sagaId: null }
          : {
              ...alt.lauf,
              geschafft,
              teil: alt.lauf.teil + 1,
              phase: "erzaehler",
              sagaId: null,
            },
      };
    });
  }, []);

  const beenden = useCallback(() => setStand(null), []);

  return { stand, geladen, starten, setzePhase, teilGeschafft, beenden };
}
