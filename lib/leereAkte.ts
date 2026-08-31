"use client";

import type { CaseFile, Character, Item, Location } from "./types";

/**
 * Ein leerer, aber bereits spielbarer Fall zum Ausfüllen von Hand.
 *
 * Alle Pflichtstellen sind mit Platzhaltern belegt, damit sich der Fall vom
 * ersten Moment an speichern lässt (siehe lib/aktePruefen.ts). Den Rest
 * schreibt man im Editor.
 */
export function leererFall(args: {
  charaktere: Character[];
  orte: Location[];
  items: Item[];
  stadt: string;
}): CaseFile | null {
  const { charaktere, items, stadt } = args;
  const orte = args.orte.filter((o) => o.stadt === stadt);
  const verdaechtige = charaktere.filter((c) => !c.istDetektiv);

  if (orte.length < 2 || verdaechtige.length < 2 || items.length < 1) return null;

  const taeter = verdaechtige[0];

  return {
    id: crypto.randomUUID(),
    besetzung: charaktere,
    items: items.slice(0, 8),
    ton: "kindgerecht",
    reifegrad: "kindgerecht",
    absurditaet: "verspielt",
    stadt,
    orte,
    titel: "Neuer Fall",
    tatbeschreibung: "Hier steht, was passiert ist.",
    introText: "Eine Spur im Staub.\nEin Name, der nicht hätte fallen dürfen.",
    schlagworte: [stadt, "Eine Spur zu viel"],
    tatort: orte[0].id,
    taeterId: taeter.id,
    motiv: "Noch offen.",
    tathergang: "Noch offen.",
    verdaechtige: verdaechtige.map((c, i) => ({
      charakterId: c.id,
      aufenthaltsort: orte[i % orte.length].id,
      alibi: "War angeblich allein unterwegs.",
      geheimnis: "Verheimlicht eine Kleinigkeit.",
      alibiIstGelogen: c.id === taeter.id,
    })),
    spuren: [
      {
        itemId: items[0].id,
        ortId: orte[0].id,
        bedeutung: "Hier steht, was der Fund verrät.",
        zeigtAufCharakterId: taeter.id,
        fuehrtInDieIrre: false,
      },
    ],
    erstelltAm: Date.now(),
  };
}
