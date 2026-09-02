"use client";

import { postJson } from "./api";
import type { Bogen } from "./sagaBogen";
import type { CaseFile, PublicCase } from "./types";

/**
 * Zugang zu den Akten - dem Klartext hinter dem Siegel.
 *
 * Das Passwort (ADMIN_TOKEN auf dem Server) wird einmal eingegeben und bleibt
 * auf dem Gerät. Ohne gesetztes Passwort ist der Zugang in der Produktion
 * gesperrt, damit niemand die Lösung einer Kampagne abrufen kann.
 */
const KEY = "detective-wimpy:admin-token";

export const adminToken = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export function setzeAdminToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Privater Modus - dann gilt das Passwort nur für diese Sitzung.
  }
}

const senden = <T,>(body: unknown) =>
  postJson<T>("/api/akte", body, 60, { "x-admin-token": adminToken() });

/**
 * Stimmt dieses Passwort? Fragt den Server - nur der kennt das ADMIN_TOKEN.
 *
 * `ohnePasswort` heißt: Auf dem Server ist gar keins gesetzt. Dann steht der
 * Admin-Bereich jedem offen, der die Adresse kennt; das Schloss sagt das auch
 * so und lässt einen trotzdem hinein.
 */
export const pruefeZugang = (token: string) =>
  postJson<{ ok: boolean; ohnePasswort: boolean }>(
    "/api/akte",
    { aktion: "zugang" },
    20,
    { "x-admin-token": token },
  );

export const akteLesen = (siegel: string) =>
  senden<{ fall: CaseFile }>({ aktion: "fall-lesen", siegel }).then((a) => a.fall);

export const akteSchreiben = (fall: CaseFile) =>
  senden<{ fall: PublicCase; siegel: string }>({ aktion: "fall-schreiben", fall });

export const bogenLesen = (bogenSiegel: string) =>
  senden<{ bogen: Bogen }>({ aktion: "bogen-lesen", bogenSiegel }).then((a) => a.bogen);

export const bogenSchreiben = (bogen: Bogen) =>
  senden<{ bogenSiegel: string }>({ aktion: "bogen-schreiben", bogen }).then(
    (a) => a.bogenSiegel,
  );
