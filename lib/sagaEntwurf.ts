"use client";

import type { Verhandlung } from "./sagaFinale";
import type { SagaVorgaben } from "./sagaTypen";
import type { PublicCase } from "./types";

/**
 * Der Zwischenstand einer laufenden Saga-Erzeugung.
 *
 * Eine Saga entsteht in zwanzig und mehr Aufrufen hintereinander, und jeder
 * kostet Geld. Bisher war ein Aussetzer im letzten Schritt gleichbedeutend
 * mit "alles noch einmal": Der halbfertige Bogen lag nur im Arbeitsspeicher
 * des Bildschirms und war mit ihm weg.
 *
 * Jetzt wandert nach jedem Schritt der Stand aufs Gerät. Bricht etwas ab -
 * Zeitlimit, Netz, zugeklappter Deckel -, setzt der nächste Anlauf dort an,
 * wo es aufgehört hat. Bezahlt wird nur, was noch fehlt.
 *
 * Es gibt genau einen Platz dafür: Zwei Sagas gleichzeitig erzeugt niemand,
 * und ein zweiter Anlauf mit anderen Vorgaben soll den alten Stand ablösen
 * statt sich danebenzulegen.
 */
const KEY = "detective-wimpy:saga-entwurf:v1";
const VERSION = 1;

/** Die Texte eines Kapitels, wie sie aus dem Bogen kommen. */
export type EntwurfKapitel = {
  nummer: number;
  name: string;
  teaser: string;
  erzaehlerText: string;
};

export type EntwurfFinale = {
  frage: string;
  erzaehlerText: string;
  epilogText: string;
};

export type SagaEntwurf = {
  version: number;
  /**
   * Fingerabdruck der Eingaben. Passt er nicht mehr zu dem, was gerade im
   * Menü steht, gehört der Stand zu einer anderen Bestellung - dann wird
   * nichts vermischt.
   */
  kennung: string;
  /** Die Vorgaben, mit denen begonnen wurde - für "Weitermachen". */
  vorgaben: SagaVorgaben;
  /** Wie die Saga heißen wird, sobald der Kern steht. */
  name: string;
  /** Der Bogen, wie er zuletzt stand. Ohne ihn geht kein Schritt weiter. */
  siegel: string;
  kern: {
    bogenSiegel: string;
    id: string;
    name: string;
    thema: string;
    klappentext: string;
    auftaktText: string;
    schlagworte: string[];
    kapitelAnzahl: number;
  } | null;
  kapitel: EntwurfKapitel[];
  finale: EntwurfFinale | null;
  /** Null heißt: noch nicht geholt. Bei einem klassischen Finale bleibt es null. */
  verhandlung: Verhandlung | null;
  /** Ob die Verhandlung vollständig ist - sonst fehlen noch die Beweisstücke. */
  beweiseFertig: boolean;
  /** Fertige Kapitelfälle, nach Kapitelnummer. */
  faelle: Record<string, { fall: PublicCase; siegel: string }>;
  /** Der Finalfall - bei einer Verhandlung leer, aber gesetzt. */
  finaleFall: { fall: PublicCase | null; siegel: string | null } | null;
  begonnen: number;
  zuletzt: number;
};

/**
 * Der Fingerabdruck einer Bestellung.
 *
 * Er muss sich ändern, sobald sich an den Vorgaben oder an den Stammdaten
 * etwas Wesentliches ändert - sonst würde ein alter Stand auf eine neue
 * Besetzung aufgesetzt. Gerechnet wird über die Vorgaben und die Ids der
 * beteiligten Tiere, Orte und Gegenstände; Beschreibungen und Bilder dürfen
 * sich ändern, ohne dass der Stand verfällt.
 */
export function entwurfKennung(eingaben: {
  vorgaben: SagaVorgaben;
  charaktere: { id: string }[];
  orte: { id: string }[];
  items: { id: string }[];
}): string {
  const ids = (liste: { id: string }[]) =>
    liste
      .map((e) => e.id)
      .sort()
      .join(",");
  const roh = JSON.stringify({
    vorgaben: eingaben.vorgaben,
    charaktere: ids(eingaben.charaktere),
    orte: ids(eingaben.orte),
    items: ids(eingaben.items),
  });

  // FNV-1a: kurz, stabil, und für einen Fingerabdruck auf dem Gerät genug.
  let hash = 0x811c9dc5;
  for (let i = 0; i < roh.length; i++) {
    hash ^= roh.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function leererEntwurf(kennung: string, vorgaben: SagaVorgaben): SagaEntwurf {
  return {
    version: VERSION,
    kennung,
    vorgaben,
    name: vorgaben.name?.trim() || "Neue Saga",
    siegel: "",
    kern: null,
    kapitel: [],
    finale: null,
    verhandlung: null,
    beweiseFertig: false,
    faelle: {},
    finaleFall: null,
    begonnen: Date.now(),
    zuletzt: Date.now(),
  };
}

/** Der Stand vom Gerät - oder null, wenn es keinen brauchbaren gibt. */
export function ladeEntwurf(): SagaEntwurf | null {
  try {
    const roh = window.localStorage.getItem(KEY);
    if (!roh) return null;
    const daten = JSON.parse(roh) as SagaEntwurf;
    if (daten?.version !== VERSION || !daten.kennung || !daten.vorgaben) return null;
    return {
      ...daten,
      kapitel: Array.isArray(daten.kapitel) ? daten.kapitel : [],
      faelle: daten.faelle ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Den Stand festhalten.
 *
 * Schlägt das fehl - voller Speicher, geschlossener privater Modus -, läuft
 * die Erzeugung trotzdem weiter: Verloren ist dann nur das Netz darunter,
 * nicht die Saga.
 */
export function speichereEntwurf(entwurf: SagaEntwurf): SagaEntwurf {
  const frisch = { ...entwurf, zuletzt: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(frisch));
  } catch {
    // Kein Platz - dann eben ohne Netz.
  }
  return frisch;
}

export function verwirfEntwurf(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Dann bleibt er eben liegen; der nächste Anlauf überschreibt ihn.
  }
}

/**
 * Was von einer Bestellung schon steht - in Zahlen und in einem Satz.
 *
 * Der Satz steht im Menü über dem Knopf "Weitermachen", damit man sieht,
 * wofür man nicht noch einmal zahlt.
 */
export function entwurfStand(entwurf: SagaEntwurf): {
  fertig: number;
  gesamt: number;
  text: string;
} {
  const anzahl = entwurf.kern?.kapitelAnzahl ?? entwurf.vorgaben.kapitelAnzahl;
  const faelle = Object.keys(entwurf.faelle).length;
  const teile: string[] = [];

  if (entwurf.kern) teile.push("Überthema");
  if (entwurf.kapitel.length) teile.push(`${entwurf.kapitel.length} von ${anzahl} Kapiteln`);
  if (entwurf.finale) teile.push("Finale");
  if (faelle) teile.push(`${faelle} von ${anzahl} Fällen`);
  if (entwurf.finaleFall) teile.push("Finalfall");

  /*
   * Gezählt wird, was Geld gekostet hat: der Kern, jedes Kapitel des Bogens,
   * das Finale und jeder gebaute Fall. Das ist keine Rechnung auf den Cent,
   * sondern ein ehrlicher Anhaltspunkt.
   */
  const fertig =
    (entwurf.kern ? 1 : 0) +
    entwurf.kapitel.length +
    (entwurf.finale ? 1 : 0) +
    faelle +
    (entwurf.finaleFall ? 1 : 0);
  const gesamt = 1 + anzahl + 1 + anzahl + 1;

  return {
    fertig,
    gesamt,
    text: teile.length ? teile.join(" · ") : "noch nichts",
  };
}
