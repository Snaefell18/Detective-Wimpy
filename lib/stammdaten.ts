"use client";

import { useCallback, useEffect, useState } from "react";
import { CHARACTERS } from "./characters";
import { ladeCharaktere, ladeItems, ladeOrte } from "./db";
import { ITEMS } from "./items";
import { LOCATIONS } from "./locations";
import type { Character, Item, Location } from "./types";

/**
 * Tiere, Schauplätze und Gegenstände kommen aus Firestore. Ist die Datenbank
 * noch leer (oder nicht erreichbar), gelten die Listen aus dem Projekt -
 * so lässt sich das Spiel jederzeit auch ohne Firebase spielen.
 */
export type Stammdaten = {
  charaktere: Character[];
  orte: Location[];
  items: Item[];
  /** Woher die jeweilige Liste stammt - fürs Admin-Menü. */
  quelle: Record<"charaktere" | "orte" | "items", "datenbank" | "projekt">;
  geladen: boolean;
  fehler: string | null;
};

const AUS_DEM_PROJEKT: Stammdaten = {
  charaktere: CHARACTERS,
  orte: LOCATIONS,
  items: ITEMS,
  quelle: { charaktere: "projekt", orte: "projekt", items: "projekt" },
  geladen: false,
  fehler: null,
};

const EVENT = "detective-wimpy:stammdaten-geaendert";

let cache: Stammdaten | null = null;
let laufend: Promise<Stammdaten> | null = null;

const nachNummer = (a: Character, b: Character) =>
  a.nummer - b.nummer || a.name.localeCompare(b.name, "de");
const nachOrt = (a: Location, b: Location) =>
  a.stadt.localeCompare(b.stadt, "de") || a.name.localeCompare(b.name, "de");
const nachName = (a: Item, b: Item) => a.name.localeCompare(b.name, "de");

/** Lädt die Stammdaten (einmalig gecacht). */
export function ladeStammdaten(neu = false): Promise<Stammdaten> {
  if (!neu && cache) return Promise.resolve(cache);
  if (!neu && laufend) return laufend;

  laufend = (async () => {
    try {
      const [charaktere, orte, items] = await Promise.all([
        ladeCharaktere(),
        ladeOrte(),
        ladeItems(),
      ]);

      const offline = [charaktere, orte, items].every(
        (a) => a.ausCache && a.daten.length === 0,
      );

      const daten: Stammdaten = {
        charaktere: charaktere.daten.length
          ? [...charaktere.daten].sort(nachNummer)
          : CHARACTERS,
        orte: orte.daten.length ? [...orte.daten].sort(nachOrt) : LOCATIONS,
        items: items.daten.length ? [...items.daten].sort(nachName) : ITEMS,
        quelle: {
          charaktere: charaktere.daten.length ? "datenbank" : "projekt",
          orte: orte.daten.length ? "datenbank" : "projekt",
          items: items.daten.length ? "datenbank" : "projekt",
        },
        geladen: true,
        fehler: offline
          ? "Keine Verbindung zur Datenbank - es gelten die Listen aus dem Projekt."
          : null,
      };
      cache = daten;
      return daten;
    } catch (fehler) {
      // Ohne Datenbank läuft das Spiel mit den Projektdaten weiter.
      console.warn("[stammdaten] Datenbank nicht erreichbar:", fehler);
      cache = {
        ...AUS_DEM_PROJEKT,
        geladen: true,
        fehler:
          "Die Datenbank ist gerade nicht erreichbar - es gelten die Listen aus dem Projekt.",
      };
      return cache;
    } finally {
      laufend = null;
    }
  })();

  return laufend;
}

/** Nach Änderungen im Admin: neu laden und alle Ansichten benachrichtigen. */
export async function stammdatenAktualisieren(): Promise<void> {
  await ladeStammdaten(true);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useStammdaten(): Stammdaten & { neuLaden: () => Promise<void> } {
  const [daten, setDaten] = useState<Stammdaten>(cache ?? AUS_DEM_PROJEKT);

  useEffect(() => {
    let aktiv = true;
    void ladeStammdaten().then((geladen) => {
      if (aktiv) setDaten(geladen);
    });

    const aktualisieren = () => setDaten(cache ?? AUS_DEM_PROJEKT);
    window.addEventListener(EVENT, aktualisieren);
    return () => {
      aktiv = false;
      window.removeEventListener(EVENT, aktualisieren);
    };
  }, []);

  const neuLaden = useCallback(() => stammdatenAktualisieren(), []);

  return { ...daten, neuLaden };
}
