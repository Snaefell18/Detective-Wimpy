"use client";

import { useCallback, useEffect, useState } from "react";
import { CHARACTERS } from "./characters";
import { STANDARD_EINSTELLUNGEN, type Character, type Einstellungen } from "./types";

const KEY = "detective-wimpy:admin:v1";

export type AdminDaten = {
  /** Aus dem Admin-Menü eingelesene Charaktere. Null = die aus dem Repository. */
  charaktere: Character[] | null;
  /** Bildpfad (z.B. "/charaktere/chat.png") -> Data-URL, nur auf diesem Gerät. */
  bilder: Record<string, string>;
  einstellungen: Einstellungen;
};

export const LEERE_ADMIN_DATEN: AdminDaten = {
  charaktere: null,
  bilder: {},
  einstellungen: STANDARD_EINSTELLUNGEN,
};

/** Damit alle Komponenten auf dem gleichen Stand sind, ohne Context-Gerüst. */
const EVENT = "detective-wimpy:admin-geaendert";

export function ladeAdminDaten(): AdminDaten {
  if (typeof window === "undefined") return LEERE_ADMIN_DATEN;
  try {
    const roh = window.localStorage.getItem(KEY);
    if (!roh) return LEERE_ADMIN_DATEN;
    const daten = JSON.parse(roh) as Partial<AdminDaten>;
    return {
      charaktere: daten.charaktere ?? null,
      bilder: daten.bilder ?? {},
      einstellungen: { ...STANDARD_EINSTELLUNGEN, ...(daten.einstellungen ?? {}) },
    };
  } catch {
    return LEERE_ADMIN_DATEN;
  }
}

export function speichereAdminDaten(daten: AdminDaten): { fehler?: string } {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(daten));
    window.dispatchEvent(new CustomEvent(EVENT));
    return {};
  } catch {
    // Passiert vor allem, wenn zu viele/zu große Bilder hinterlegt wurden.
    return {
      fehler:
        "Der Speicher des Browsers ist voll. Lösche einzelne Bilder oder lege sie stattdessen im Ordner public/ ab.",
    };
  }
}

/** Admin-Daten lesen und schreiben, synchron über alle Komponenten hinweg. */
export function useAdmin() {
  const [daten, setDaten] = useState<AdminDaten>(LEERE_ADMIN_DATEN);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    setDaten(ladeAdminDaten());
    setGeladen(true);

    const aktualisieren = () => setDaten(ladeAdminDaten());
    window.addEventListener(EVENT, aktualisieren);
    window.addEventListener("storage", aktualisieren);
    return () => {
      window.removeEventListener(EVENT, aktualisieren);
      window.removeEventListener("storage", aktualisieren);
    };
  }, []);

  const aendern = useCallback(
    (teil: Partial<AdminDaten>): { fehler?: string } => {
      const neu = { ...ladeAdminDaten(), ...teil };
      const ergebnis = speichereAdminDaten(neu);
      if (!ergebnis.fehler) setDaten(neu);
      return ergebnis;
    },
    [],
  );

  return { daten, geladen, aendern };
}

/** Die aktuell gültige Besetzung: aus dem Admin-Menü oder aus dem Repository. */
export function aktuelleCharaktere(daten: AdminDaten): Character[] {
  return daten.charaktere ?? CHARACTERS;
}

/** Löst einen Bildpfad auf - ein im Admin hinterlegtes Bild gewinnt. */
export function bildQuelle(daten: AdminDaten, pfad?: string | null): string | null {
  if (!pfad) return null;
  return daten.bilder[pfad] ?? pfad;
}
