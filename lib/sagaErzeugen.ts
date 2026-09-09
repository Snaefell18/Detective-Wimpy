"use client";

import { postJson } from "./api";
import { erzeugeFall } from "./fallErzeugen";
import { mitVerhandlung, type Verhandlung } from "./sagaFinale";
import { mitWiederholung } from "./wiederholen";
import {
  LEERER_ERZAEHLER,
  videoFuerKapitel,
  type Saga,
  type SagaVorgaben,
} from "./sagaTypen";
import type { Character, Einstellungen, Item, Location, PublicCase } from "./types";

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
  schlagworte: string[];
  kapitelAnzahl: number;
};

type KapitelAntwort = {
  bogenSiegel: string;
  kapitel: { nummer: number; name: string; teaser: string; erzaehlerText: string };
};

type FinaleAntwort = {
  bogenSiegel: string;
  finale: { frage: string; erzaehlerText: string; epilogText: string };
  /** Nur bei einem Verhandlungsfinale - dann gibt es keinen Finalfall. */
  verhandlung?: Verhandlung;
};

export type SagaEingaben = {
  charaktere: Character[];
  orte: Location[];
  items: Item[];
  vorgaben: SagaVorgaben;
};

/**
 * Ein Schritt der Erzeugung - mit Stellenangabe und einem zweiten Versuch.
 *
 * Der zweite Versuch ist hier bares Geld: Eine Saga besteht aus zwanzig und
 * mehr Aufrufen hintereinander, und ohne ihn kostete ein einzelner Aussetzer
 * alles, was schon gebaut war.
 */
const bei = <T>(was: string, arbeit: () => Promise<T>, onErneut?: () => void) =>
  mitWiederholung(was, arbeit, 1, onErneut);

export async function erzeugeSaga(
  eingaben: SagaEingaben,
  onSchritt?: (text: string) => void,
): Promise<Saga> {
  const anzahl = eingaben.vorgaben.kapitelAnzahl;

  // 1. Der Kern: worum es überhaupt geht.
  onSchritt?.("Das Überthema entsteht …");
  const kern = await bei(
    "Beim Überthema",
    () =>
      postJson<KernAntwort>("/api/saga", {
        charaktere: eingaben.charaktere,
        orte: eingaben.orte,
        vorgaben: eingaben.vorgaben,
      }),
    () => onSchritt?.("Das Überthema entsteht … (noch einmal)"),
  );

  // 2. Die Kapitel - eines nach dem anderen, jedes kennt die vorherigen.
  let siegel = kern.bogenSiegel;
  const entwuerfe: KapitelAntwort["kapitel"][] = [];
  for (let nummer = 1; nummer <= anzahl; nummer++) {
    onSchritt?.(`Kapitel ${nummer} von ${anzahl} wird ersonnen …`);
    const antwort = await bei(
      `Bei Kapitel ${nummer} von ${anzahl}`,
      () =>
        postJson<KapitelAntwort>("/api/saga", {
          schritt: "kapitel",
          bogenSiegel: siegel,
          orte: eingaben.orte,
          nummer,
        }),
      () => onSchritt?.(`Kapitel ${nummer} von ${anzahl} … (noch einmal)`),
    );
    siegel = antwort.bogenSiegel;
    entwuerfe.push(antwort.kapitel);
  }

  // 3. Das Finale.
  onSchritt?.("Das Finale wird geschmiedet …");
  const finaleBogen = await bei(
    "Beim Finale",
    () =>
      postJson<FinaleAntwort>("/api/saga", {
        schritt: "finale",
        bogenSiegel: siegel,
        orte: eingaben.orte,
      }),
    () => onSchritt?.("Das Finale wird geschmiedet … (noch einmal)"),
  );
  siegel = finaleBogen.bogenSiegel;

  // 4. Jetzt die eigentlichen Fälle - jeder wieder in drei Schritten.
  const einstellungen: Einstellungen = {
    beschuldigungen: eingaben.vorgaben.beschuldigungen,
    startverdacht: 20,
    ton: eingaben.vorgaben.ton,
    stadt: eingaben.vorgaben.stadt,
    ortsAnzahl: eingaben.vorgaben.ortsAnzahl,
    intro: true,
    // Auftrittston, Wetter und Musik hängen am Gerät, nicht am Fall.
    neuzugangTon: "",
    musik: "",
    wetter: "aus",
  };

  const fallFuer = (kapitel: number, was: string) =>
    bei(was, () =>
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
      ),
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
      erzaehler: {
        text: k.erzaehlerText,
        audio: "",
        // Was im Editor als Video für dieses Kapitel steht, wandert hier
        // hinein - danach lässt es sich am Kapitel selbst ändern.
        video: videoFuerKapitel(eingaben.vorgaben, k.nummer - 1),
      },
      fall: gebaut.fall,
      siegel: gebaut.siegel,
    });
  }

  // Läuft die Saga in eine Verhandlung, gibt es keinen Finalfall mehr: Der
  // Gerichtssaal ist das Finale.
  const saalStattFall = mitVerhandlung(eingaben.vorgaben.finaleArt);
  if (!saalStattFall) onSchritt?.("Der Finalfall wird gebaut …");
  const finale = saalStattFall
    ? { fall: null, siegel: null }
    : await fallFuer(0, "Finalfall");

  return {
    id: kern.id,
    name: kern.name,
    thema: kern.thema,
    klappentext: kern.klappentext,
    // Die Vorgaben liegen offen in der Datenbank - deshalb ohne die beiden
    // Felder, die die Lösung verraten würden. Im versiegelten Bogen stehen
    // sie vollständig, dort kommt niemand heran.
    vorgaben: { ...eingaben.vorgaben, drahtzieherId: "", kapitelTaeter: [] },
    schlagworte: kern.schlagworte ?? [],
    auftakt: { text: kern.auftaktText, audio: "" },
    kapitel,
    finale: {
      erzaehler: {
        text: finaleBogen.finale.erzaehlerText,
        audio: "",
        video: videoFuerKapitel(eingaben.vorgaben, eingaben.vorgaben.kapitelAnzahl),
      },
      frage: finaleBogen.finale.frage,
      epilog: { text: finaleBogen.finale.epilogText, audio: "" },
      fall: finale.fall,
      siegel: finale.siegel,
      verhandlung: finaleBogen.verhandlung ?? null,
    },
    bogenSiegel: siegel,
    erstelltAm: Date.now(),
  };
}

/** Ein leerer Erzählerteil, falls in der Datenbank etwas fehlt. */
export const erzaehlerOder = (teil: { text: string; audio: string } | undefined) =>
  teil ?? LEERER_ERZAEHLER;
