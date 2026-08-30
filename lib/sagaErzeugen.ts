"use client";

import { postJson } from "./api";
import { erzeugeFall } from "./fallErzeugen";
import { LEERER_ERZAEHLER, type Saga, type SagaVorgaben } from "./sagaTypen";
import type { Character, Item, Location, PublicCase } from "./types";

/**
 * Eine ganze Saga bauen - in vielen kleinen Aufrufen.
 *
 * Erst der Bogen (ein Aufruf), dann jedes Kapitel als eigener Fall (je drei
 * Aufrufe), zuletzt das Finale (noch einmal drei). Keine einzelne Anfrage
 * läuft damit in das Zeitlimit der Plattform, egal wie lang die Saga wird.
 */
type BogenAntwort = {
  bogenSiegel: string;
  id: string;
  name: string;
  thema: string;
  klappentext: string;
  auftaktText: string;
  kapitel: { nummer: number; name: string; teaser: string; erzaehlerText: string }[];
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
  onSchritt?.("Der Bogen der Saga entsteht …");
  const bogen = await postJson<BogenAntwort>("/api/saga", {
    charaktere: eingaben.charaktere,
    orte: eingaben.orte,
    vorgaben: eingaben.vorgaben,
  });

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
        sagaSiegel: bogen.bogenSiegel,
        kapitel,
      },
      (text) => onSchritt?.(`${was}: ${text}`),
    );

  const kapitel = [];
  for (const k of bogen.kapitel) {
    const gebaut: { fall: PublicCase; siegel: string } = await fallFuer(
      k.nummer,
      `Kapitel ${k.nummer} von ${bogen.kapitel.length}`,
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

  const finale = await fallFuer(0, "Finale");

  return {
    id: bogen.id,
    name: bogen.name,
    thema: bogen.thema,
    klappentext: bogen.klappentext,
    vorgaben: eingaben.vorgaben,
    auftakt: { text: bogen.auftaktText, audio: "" },
    kapitel,
    finale: {
      erzaehler: { text: bogen.finale.erzaehlerText, audio: "" },
      frage: bogen.finale.frage,
      epilog: { text: bogen.finale.epilogText, audio: "" },
      fall: finale.fall,
      siegel: finale.siegel,
    },
    bogenSiegel: bogen.bogenSiegel,
    erstelltAm: Date.now(),
  };
}

/** Ein leerer Erzählerteil, falls in der Datenbank etwas fehlt. */
export const erzaehlerOder = (teil: { text: string; audio: string } | undefined) =>
  teil ?? LEERER_ERZAEHLER;
