"use client";

import { useCallback, useEffect, useState } from "react";
import { naechsterTeil, type Arc, type ArcLauf } from "./arcTypen";

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
        // gewachsen sein), der Fortschritt bleibt. Man landet immer in der
        // Übersicht - auch wenn eine Saga noch pausiert herumliegt: Von dort
        // aus geht es sichtbar weiter.
        return {
          arc,
          lauf: {
            ...alt.lauf,
            teil: naechsterTeil(arc, alt.lauf.geschafft) ?? arc.teile.length - 1,
            phase: alt.lauf.phase === "vorspann" ? "vorspann" : "uebersicht",
          },
        };
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

  /** Eine Station auswählen - erst der Erzähler, dann ihre Saga. */
  const waehleTeil = useCallback((index: number) => {
    setStand((alt) =>
      alt ? { ...alt, lauf: { ...alt.lauf, teil: index, phase: "erzaehler", sagaId: null } } : alt,
    );
  }, []);

  /**
   * Eine Station ist durch. Zurück in die Übersicht: Dort sieht man den Haken
   * und was als Nächstes ansteht - auch, wenn die nächste Saga noch fehlt.
   */
  const teilGeschafft = useCallback(() => {
    setStand((alt) => {
      if (!alt) return alt;
      const nummer = alt.arc.teile[alt.lauf.teil]?.nummer ?? alt.lauf.teil + 1;
      const geschafft = alt.lauf.geschafft.includes(nummer)
        ? alt.lauf.geschafft
        : [...alt.lauf.geschafft, nummer];
      return {
        ...alt,
        lauf: {
          ...alt.lauf,
          geschafft,
          teil: naechsterTeil(alt.arc, geschafft) ?? alt.lauf.teil,
          phase: "uebersicht",
          sagaId: null,
        },
      };
    });
  }, []);

  const beenden = useCallback(() => setStand(null), []);

  return { stand, geladen, starten, setzePhase, waehleTeil, teilGeschafft, beenden };
}
