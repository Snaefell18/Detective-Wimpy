"use client";

import { useEffect, useState } from "react";
import { adminToken } from "./akte";
import { postJson } from "./api";
import { istZugriffVerweigert, ladeBilddatei, speichereBilddatei } from "./db";
import { groesse, verkleinereDataUrl } from "./bildUpload";
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
 * Eine Vorlage auf ein Maß bringen, das durch die Leitung passt.
 *
 * Sie geht als data:-URL an den Server und von dort als Datei weiter; in
 * voller Größe wäre das unnötig viel. Transparenz bleibt erhalten, sonst
 * käme die Dämonenfassung mit weißem Kasten zurück.
 */
async function vorlageVorbereiten(quelle: string): Promise<string> {
  const roh = quelle.startsWith("data:")
    ? quelle
    : await fetch(quelle)
        .then((r) => r.blob())
        .then(
          (blob) =>
            new Promise<string>((fertig, schief) => {
              const leser = new FileReader();
              leser.onload = () => fertig(String(leser.result));
              leser.onerror = () => schief(new Error("Die Vorlage ließ sich nicht laden."));
              leser.readAsDataURL(blob);
            }),
        );
  // Die Vorlage geht nur durch die Leitung, nicht in die Datenbank - hier
  // darf es also großzügiger sein als beim Speichern.
  return verkleinereDataUrl(roh, { transparenz: true, maxZeichen: 1_800_000 });
}

/**
 * Ein Bild erzeugen lassen und ablegen. Zurück kommt der Wert fürs Feld
 * "bild" - nur im Admin-Menü aufzurufen.
 *
 * Mit `vorlage` wird aus dem Malen ein Umzeichnen: Dieselbe Figur, neu
 * eingekleidet. Das ursprüngliche Bild wird dabei nur gelesen; gespeichert
 * wird ein neues unter einer neuen Id.
 */
export async function bildErzeugen(
  art: BildArt,
  eintrag: BildEintrag,
  wunsch: string,
  /** Pfad oder data:-URL des Bildes, das als Vorlage dient. */
  vorlage?: string,
): Promise<{ wert: string; daten: string }> {
  const mitVorlage = vorlage ? await vorlageVorbereiten(vorlage) : "";

  const antwort = await postJson<{ bild: string }>(
    "/api/bild",
    {
      auftrag: bildAuftrag(art, eintrag, wunsch, Boolean(mitVorlage)),
      format: FORMAT[art],
      freigestellt: FREIGESTELLT[art],
      vorlage: mitVorlage,
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
  try {
    await speichereBilddatei({
      id,
      daten: verkleinert,
      zweck: `${art}: ${eintrag.name ?? ""}`.trim(),
      erstelltAm: Date.now(),
    });
  } catch (fehler) {
    /*
     * Firestore lehnt zu große Dokumente mit demselben Wort ab wie fehlende
     * Rechte: "Missing or insufficient permissions". Das führt in die Irre -
     * also wird hier gesagt, was wirklich in Frage kommt.
     */
    if (istZugriffVerweigert(fehler)) {
      throw new Error(
        "Die Datenbank hat das Bild abgelehnt. Meist fehlt die Sammlung „bilder“ in den veröffentlichten Firestore-Regeln - dann einmal firestore.rules aus dem Projekt in der Firebase-Konsole neu veröffentlichen. (Das Bild selbst ist mit " +
          groesse(verkleinert) +
          " klein genug.)",
      );
    }
    throw fehler;
  }
  gemerkt.set(id, verkleinert);
  return { wert: `${PRAEFIX}${id}`, daten: verkleinert };
}
