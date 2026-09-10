"use client";

import { adminToken } from "./akte";
import { postJson } from "./api";

/**
 * Neue Stammdaten erfinden lassen.
 *
 * Es kommt nur ein Vorschlag zurück - gespeichert wird nichts. Das Ansehen,
 * Ändern, Bebildern und Ablegen passiert danach im Menü, und wer den
 * Vorschlag nicht mag, wirft ihn weg, ohne dass etwas passiert ist.
 */
export type DingVorschlag = { name: string; beschreibung: string };

export type StadtVorschlag = {
  stadt: string;
  orte: { name: string; atmosphaere: string; beschreibung: string }[];
};

/** Ein einzelner Gegenstand. `vorhanden` verhindert Wiederholungen. */
export const erfindeDing = (vorhanden: string[], wunsch: string) =>
  postJson<DingVorschlag>(
    "/api/erfinden",
    { art: "ding", vorhanden, wunsch },
    60,
    { "x-admin-token": adminToken() },
  );

/** Eine Stadt mit ihren Schauplätzen - in einem Aufruf. */
export const erfindeStadt = (args: {
  stadt: string;
  anzahl: number;
  vorhanden: string[];
  wunsch: string;
}) =>
  postJson<StadtVorschlag>(
    "/api/erfinden",
    { art: "stadt", ...args },
    90,
    { "x-admin-token": adminToken() },
  );
