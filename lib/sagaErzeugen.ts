"use client";

import { postJson } from "./api";
import { erzeugeFall } from "./fallErzeugen";
import { LEERER_ERZAEHLER, type Saga, type SagaVorgaben } from "./sagaTypen";
import type { Character, Item, Location, PublicCase } from "./types";

/**
 * Eine ganze Saga bauen - in lauter kleinen Aufrufen.
 *
 * Erst der Kern, dann jedes Kapitel des Bogens einzeln, dann das Finale -
 * und erst danach die eigentlichen Fälle, jeder wiederum in drei Schritten.
 * Bei drei Kapiteln sind das 5 + 12 kleine Anfragen statt einer großen; keine
 * kommt dem Zeitlimit der Plattform nahe, egal wie lang die Saga wird.
 */
type KernAntwort = {
  bogenSiegel: string;
  id: string;
  name: string;
  thema: string;
  klappentext: string;
  auftaktText: string;
  kapitelAnzahl: number;
};

type KapitelAntwort = {
  bogenSiegel: string;
  kapitel: { nummer: number; name: string; teaser: string; erzaehlerText: string };
};

type FinaleAntwort = {
  bogenSiegel: string;
  finale: { frage: string; erzaehlerText: string; epilogText: string };
};

export type SagaEingaben = {
  charaktere: Character[];
  orte: Location[];
  items: Item[];
  vorgaben: SagaVorgaben;
};

export async function erzeugeSaga(
  eingaben: SagaEingaben,
  onSchritt?: (text: string) => void,
): Promise<Saga> {
  const anzahl = eingaben.vorgaben.kapitelAnzahl;

  // 1. Der Kern: worum es überhaupt geht.
  onSchritt?.("Das Überthema entsteht …");
  const kern = await postJson<KernAntwort>("/api/saga", {
    charaktere: eingaben.charaktere,
    orte: eingaben.orte,
    vorgaben: eingaben.vorgaben,
  });

  // 2. Die Kapitel - eines nach dem anderen, jedes kennt die vorherigen.
  let siegel = kern.bogenSiegel;
  const entwuerfe: KapitelAntwort["kapitel"][] = [];
  for (let nummer = 1; nummer <= anzahl; nummer++) {
    onSchritt?.(`Kapitel ${nummer} von ${anzahl} wird ersonnen …`);
    const antwort = await postJson<KapitelAntwort>("/api/saga", {
      schritt: "kapitel",
      bogenSiegel: siegel,
      orte: eingaben.orte,
      nummer,
    });
    siegel = antwort.bogenSiegel;
    entwuerfe.push(antwort.kapitel);
  }

  // 3. Das Finale.
  onSchritt?.("Das Finale wird geschmiedet …");
  const finaleBogen = await postJson<FinaleAntwort>("/api/saga", {
    schritt: "finale",
    bogenSiegel: siegel,
    orte: eingaben.orte,
  });
  siegel = finaleBogen.bogenSiegel;

  // 4. Jetzt die eigentlichen Fälle - jeder wieder in drei Schritten.
  const einstellungen = {
    beschuldigungen: eingaben.vorgaben.beschuldigungen,
    startverdacht: 20,
    ton: eingaben.vorgaben.ton,
    stadt: eingaben.vorgaben.stadt,
    ortsAnzahl: eingaben.vorgaben.ortsAnzahl,
    intro: true,
  };

  const fallFuer = (kapitel: number, was: string) =>
    erzeugeFall(
      {
        charaktere: eingaben.charaktere,
        orte: eingaben.orte,
        items: eingaben.items,
        einstellungen,
        sagaSiegel: siegel,
        kapitel,
      },
      (text) => onSchritt?.(`${was}: ${text}`),
    );

  const kapitel = [];
  for (const k of entwuerfe) {
    const gebaut: { fall: PublicCase; siegel: string } = await fallFuer(
      k.nummer,
      `Fall ${k.nummer} von ${anzahl}`,
    );
    kapitel.push({
      nummer: k.nummer,
      name: k.name,
      teaser: k.teaser,
      erzaehler: { text: k.erzaehlerText, audio: "" },
      fall: gebaut.fall,
      siegel: gebaut.siegel,
    });
  }

  onSchritt?.("Der Finalfall wird gebaut …");
  const finale = await fallFuer(0, "Finalfall");

  return {
    id: kern.id,
    name: kern.name,
    thema: kern.thema,
    klappentext: kern.klappentext,
    vorgaben: eingaben.vorgaben,
    auftakt: { text: kern.auftaktText, audio: "" },
    kapitel,
    finale: {
      erzaehler: { text: finaleBogen.finale.erzaehlerText, audio: "" },
      frage: finaleBogen.finale.frage,
      epilog: { text: finaleBogen.finale.epilogText, audio: "" },
      fall: finale.fall,
      siegel: finale.siegel,
    },
    bogenSiegel: siegel,
    erstelltAm: Date.now(),
  };
}

/** Ein leerer Erzählerteil, falls in der Datenbank etwas fehlt. */
export const erzaehlerOder = (teil: { text: string; audio: string } | undefined) =>
  teil ?? LEERER_ERZAEHLER;
