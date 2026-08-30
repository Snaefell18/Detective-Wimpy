"use client";

import { postJson } from "./api";
import type { Character, Einstellungen, Item, Location, PublicCase, Vorgaben } from "./types";

/**
 * Einen Fall in drei Schritten erzeugen.
 *
 * Der Server baut den Fall nicht mehr in einem Rutsch - das lief regelmäßig in
 * das Zeitlimit der Plattform. Stattdessen holt der Browser nacheinander
 * Gerüst, Verdächtige und Spuren. Zwischen den Schritten wandert der
 * halbfertige Fall verschlüsselt hin und her, lesen kann ihn nur der Server.
 */
export type FallEingaben = {
  charaktere: Character[];
  orte: Location[];
  items: Item[];
  einstellungen: Einstellungen;
  vorgaben?: Vorgaben | null;
  /**
   * Nur für Sagas: der versiegelte Bogen und die Kapitelnummer (0 = Finale).
   * Besetzung, Täter und Vorgaben kommen dann aus dem Bogen, nicht von hier.
   */
  sagaSiegel?: string;
  kapitel?: number;
};

/** Was in der Oberfläche steht, während gebaut wird. */
export const SCHRITT_TEXT = [
  "Wimpy heckt einen Fall aus …",
  "Die Verdächtigen legen sich Alibis zurecht …",
  "Die Spuren werden ausgelegt …",
] as const;

export async function erzeugeFall(
  eingaben: FallEingaben,
  onSchritt?: (text: string, nummer: number) => void,
): Promise<{ fall: PublicCase; siegel: string }> {
  onSchritt?.(SCHRITT_TEXT[0], 1);
  const geruest = await postJson<{ siegel: string }>("/api/case", {
    ...eingaben,
    schritt: "geruest",
  });

  onSchritt?.(SCHRITT_TEXT[1], 2);
  const mitVerdaechtigen = await postJson<{ siegel: string }>("/api/case", {
    schritt: "verdaechtige",
    siegel: geruest.siegel,
  });

  onSchritt?.(SCHRITT_TEXT[2], 3);
  return postJson<{ fall: PublicCase; siegel: string }>("/api/case", {
    schritt: "spuren",
    siegel: mitVerdaechtigen.siegel,
  });
}
