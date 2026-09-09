"use client";

import { useEffect, useState } from "react";
import { adminToken } from "./akte";
import { postJson } from "./api";
import { ladeBilddatei, speichereBilddatei } from "./db";
import { verkleinereDataUrl } from "./bildUpload";
import { FORMAT, FREIGESTELLT, bildAuftrag, type BildArt, type BildEintrag } from "./bildPrompt";

/**
 * Erzeugte Bilder - derselbe Weg wie bei den gesprochenen Texten.
 *
 * 1. Im Admin-Menü wird ein Bild EINMAL erzeugt (kostet einmal Geld) und in
 *    der Datenbank abgelegt. Der Eintrag merkt sich nur "bild:<id>".
 * 2. Im Spiel wird nichts erzeugt, nur geladen. Kein Schlüssel im Browser,
 *    keine Kosten pro Runde.
 *
 * Eine von Hand abgelegte Datei ("/charaktere/…") funktioniert unverändert
 * weiter - beide Wege stehen nebeneinander.
 */

const PRAEFIX = "bild:";

export const istGespeichertesBild = (wert?: string | null): boolean =>
  Boolean(wert?.startsWith(PRAEFIX));

/** Einmal geholt, bleibt im Speicher - dasselbe Tier taucht oft mehrfach auf. */
const gemerkt = new Map<string, string>();
/** Läuft schon eine Abfrage, warten alle darauf statt eine zweite zu stellen. */
const unterwegs = new Map<string, Promise<string>>();

export function bildAusSpeicher(wert: string): Promise<string> {
  const id = wert.slice(PRAEFIX.length);
  const bekannt = gemerkt.get(id);
  if (bekannt) return Promise.resolve(bekannt);

  const laufend = unterwegs.get(id);
  if (laufend) return laufend;

  const abfrage = ladeBilddatei(id)
    .then((bild) => {
      const daten = bild?.daten ?? "";
      if (daten) gemerkt.set(id, daten);
      return daten;
    })
    .catch(() => "")
    .finally(() => unterwegs.delete(id));

  unterwegs.set(id, abfrage);
  return abfrage;
}

/**
 * Ein gespeichertes Bild auflösen. Alles andere (Pfade, data:-URLs) kommt
 * unverändert zurück - und zwar sofort, ohne einen Umweg über den Zustand.
 */
export function useBildQuelle(wert?: string | null): string | null {
  const id = istGespeichertesBild(wert) ? (wert as string) : "";
  const [geladen, setGeladen] = useState<string>(() =>
    id ? (gemerkt.get(id.slice(PRAEFIX.length)) ?? "") : "",
  );

  useEffect(() => {
    if (!id) return;
    const schon = gemerkt.get(id.slice(PRAEFIX.length));
    if (schon) {
      setGeladen(schon);
      return;
    }
    let sichtbar = true;
    void bildAusSpeicher(id).then((daten) => {
      if (sichtbar) setGeladen(daten);
    });
    return () => {
      sichtbar = false;
    };
  }, [id]);

  if (!id) return wert ?? null;
  // Solange nichts da ist: null - dann steht der Platzhalter, kein kaputtes Bild.
  return geladen || null;
}

/**
 * Ein Bild erzeugen lassen und ablegen. Zurück kommt der Wert fürs Feld
 * "bild" - nur im Admin-Menü aufzurufen.
 */
export async function bildErzeugen(
  art: BildArt,
  eintrag: BildEintrag,
  wunsch: string,
): Promise<{ wert: string; daten: string }> {
  const antwort = await postJson<{ bild: string }>(
    "/api/bild",
    {
      auftrag: bildAuftrag(art, eintrag, wunsch),
      format: FORMAT[art],
      freigestellt: FREIGESTELLT[art],
    },
    // Ein Bild braucht seine Zeit - deutlich mehr als ein Gespräch.
    90,
    { "x-admin-token": adminToken() },
  );

  // Klein genug für die Datenbank machen, bevor irgendetwas geschrieben wird.
  const verkleinert = await verkleinereDataUrl(antwort.bild, {
    transparenz: FREIGESTELLT[art],
  });

  const id = crypto.randomUUID();
  await speichereBilddatei({
    id,
    daten: verkleinert,
    zweck: `${art}: ${eintrag.name ?? ""}`.trim(),
    erstelltAm: Date.now(),
  });
  gemerkt.set(id, verkleinert);
  return { wert: `${PRAEFIX}${id}`, daten: verkleinert };
}
