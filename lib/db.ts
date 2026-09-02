"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { anmelden, getDb } from "./firebase";
import type { Saga } from "./sagaTypen";
import type { Arc } from "./arcTypen";
import type { Character, Item, Kampagne, Location } from "./types";

/**
 * Alle Daten des Spiels liegen in Firestore:
 *
 *   charaktere/{id}  - die Tiere
 *   orte/{id}        - die Schauplätze (mit Stadt)
 *   items/{id}       - Gegenstände und Spuren
 *   faelle/{id}      - vorgenerierte Fälle ("Kampagnen")
 *   sagen/{id}       - Sagas: mehrere Fälle mit gemeinsamem Überthema
 *   arcs/{id}        - Arcs: mehrere Sagas unter einem Bogen
 *
 * Die Lösung eines Falls steht nie im Klartext in der Datenbank - sie steckt
 * verschlüsselt im Feld "siegel" (siehe lib/seal.ts).
 */

const sauber = <T extends object>(daten: T): T =>
  // undefined mag Firestore nicht.
  JSON.parse(JSON.stringify(daten));

/**
 * Die Sicherheitsregeln begrenzen die Länge einiger Felder. Wird eine Grenze
 * gerissen, lehnt Firestore das Schreiben ab - und zwar mit
 * "Missing or insufficient permissions", was nach einem Rechteproblem
 * aussieht, aber keines ist. Deshalb wird hier gekürzt, bevor es dazu kommt.
 */
const kuerze = (text: unknown, laenge: number): string =>
  typeof text === "string" && text.length > laenge ? text.slice(0, laenge) : String(text ?? "");

/**
 * Firestore liefert ohne Verbindung stillschweigend leere Ergebnisse aus dem
 * lokalen Zwischenspeicher. Deshalb wird immer mitgegeben, ob die Antwort aus
 * dem Cache kam - so lässt sich "noch nichts angelegt" von "keine Verbindung"
 * unterscheiden.
 */
export type Abfrage<T> = { daten: T[]; ausCache: boolean };

/**
 * Firestore antwortet mit "permission-denied", wenn eine Sammlung in den
 * Regeln gar nicht vorkommt. Das sieht aus wie ein Fehler, ist aber meistens
 * nur eine noch nicht veröffentlichte Regeldatei - und dafür braucht es einen
 * anderen Hinweis als für "kaputt".
 */
export const istZugriffVerweigert = (fehler: unknown): boolean =>
  (fehler as { code?: string })?.code === "permission-denied";

async function alle<T>(sammlung: string): Promise<Abfrage<T>> {
  const schnappschuss = await getDocs(collection(getDb(), sammlung));
  return {
    daten: schnappschuss.docs.map((d) => ({ ...(d.data() as T), id: d.id })),
    ausCache: schnappschuss.metadata.fromCache,
  };
}

/* --- Stammdaten ---------------------------------------------------- */

export const ladeCharaktere = () => alle<Character>("charaktere");
export const ladeOrte = () => alle<Location>("orte");
export const ladeItems = () => alle<Item>("items");

export async function speichereCharakter(charakter: Character): Promise<void> {
  await anmelden();
  await setDoc(doc(getDb(), "charaktere", charakter.id), sauber(charakter));
}

export async function speichereOrt(ort: Location): Promise<void> {
  await anmelden();
  await setDoc(doc(getDb(), "orte", ort.id), sauber(ort));
}

export async function speichereItem(item: Item): Promise<void> {
  await anmelden();
  await setDoc(doc(getDb(), "items", item.id), sauber(item));
}

export async function loesche(sammlung: string, id: string): Promise<void> {
  await anmelden();
  await deleteDoc(doc(getDb(), sammlung, id));
}

/** Schreibt eine ganze Liste auf einmal - für den Import aus einer CSV. */
export async function speichereListe(
  sammlung: "charaktere" | "orte" | "items",
  eintraege: { id: string }[],
): Promise<void> {
  await anmelden();
  const db = getDb();

  // Firestore erlaubt 500 Schreibvorgänge pro Stapel.
  for (let i = 0; i < eintraege.length; i += 400) {
    const stapel = writeBatch(db);
    for (const eintrag of eintraege.slice(i, i + 400)) {
      stapel.set(doc(db, sammlung, eintrag.id), sauber(eintrag));
    }
    await stapel.commit();
  }
}

/* --- Kampagnen (vorgenerierte Fälle) -------------------------------- */

export async function ladeKampagnen(): Promise<Abfrage<Kampagne>> {
  const schnappschuss = await getDocs(
    query(collection(getDb(), "faelle"), orderBy("erstelltAm", "desc")),
  );
  return {
    daten: schnappschuss.docs.map((d) => ({ ...(d.data() as Kampagne), id: d.id })),
    ausCache: schnappschuss.metadata.fromCache,
  };
}

export async function speichereKampagne(kampagne: Kampagne): Promise<void> {
  await anmelden();
  await setDoc(doc(getDb(), "faelle", kampagne.id), sauber(kampagne));
}

export const loescheKampagne = (id: string) => loesche("faelle", id);

/* --- Sagas --------------------------------------------------------- */

export const ladeSagas = () => alle<Saga>("sagen");

export async function speichereSaga(saga: Saga): Promise<void> {
  await anmelden();
  await setDoc(
    doc(getDb(), "sagen", saga.id),
    sauber({
      ...saga,
      name: kuerze(saga.name, 120),
      thema: kuerze(saga.thema, 2000),
      klappentext: kuerze(saga.klappentext, 2000),
    }),
  );
}

export const loescheSaga = (id: string) => loesche("sagen", id);

/* --- Arcs: mehrere Sagen unter einem Dach -------------------------- */

export const ladeArcs = () => alle<Arc>("arcs");

export async function speichereArc(arc: Arc): Promise<void> {
  await anmelden();
  await setDoc(
    doc(getDb(), "arcs", arc.id),
    sauber({
      ...arc,
      name: kuerze(arc.name, 120),
      klappentext: kuerze(arc.klappentext, 2000),
      ziel: kuerze(arc.ziel, 2000),
      themeSong: kuerze(arc.themeSong, 200),
    }),
  );
}

export const loescheArc = (id: string) => loesche("arcs", id);


/* --- Gesprochene Erzählertexte ------------------------------------- */

/**
 * Eine Aufnahme aus der Sprachausgabe - als data:-URL in einem eigenen
 * Dokument.
 *
 * Warum nicht im Erzählerteil selbst: Ein Firestore-Dokument darf 1 MB groß
 * sein, und eine Saga mit einem Dutzend Aufnahmen wäre schnell darüber. So
 * liegt jede für sich, wird nur geladen, wenn sie gebraucht wird, und der
 * Erzählerteil merkt sich bloß "stimme:<id>".
 */
export type Stimme = { id: string; audio: string; text: string; erstelltAm: number };

export async function speichereStimme(stimme: Stimme): Promise<void> {
  await anmelden();
  await setDoc(doc(getDb(), "stimmen", stimme.id), sauber(stimme));
}

export async function ladeStimme(id: string): Promise<Stimme | null> {
  const schnappschuss = await getDoc(doc(getDb(), "stimmen", id));
  return schnappschuss.exists() ? ({ ...(schnappschuss.data() as Stimme), id }) : null;
}

export const loescheStimme = (id: string) => loesche("stimmen", id);
