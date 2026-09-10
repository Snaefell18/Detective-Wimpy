"use client";

import { postJson } from "./api";
import {
  entwurfKennung,
  leererEntwurf,
  speichereEntwurf,
  type SagaEntwurf,
} from "./sagaEntwurf";
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
  /** "beweise": Die Verhandlung ist noch nicht vollständig. */
  weiter?: "beweise";
};

/** Der Nachschlag zur Verhandlung: die Beweisstücke. */
type BeweiseAntwort = {
  bogenSiegel: string;
  beweise: Verhandlung["beweise"];
  noetig: number;
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
const bei = <T>(
  was: string,
  arbeit: () => Promise<T>,
  onErneut?: () => void,
  /**
   * Wie oft nachgefasst wird. Einmal reicht fast überall - am Schluss steht
   * aber die ganze bezahlte Saga auf dem Spiel, deshalb gibt es dort einen
   * Versuch mehr.
   */
  versuche = 1,
) => mitWiederholung(was, arbeit, versuche, onErneut);

export async function erzeugeSaga(
  eingaben: SagaEingaben,
  onSchritt?: (text: string) => void,
  /**
   * Ein angefangener Stand vom letzten Anlauf. Passt sein Fingerabdruck zu
   * dieser Bestellung, wird dort weitergemacht, wo es aufgehört hat.
   */
  weiter?: SagaEntwurf | null,
): Promise<Saga> {
  const anzahl = eingaben.vorgaben.kapitelAnzahl;
  const kennung = entwurfKennung(eingaben);

  /*
   * Der Zwischenstand.
   *
   * Nach jedem bezahlten Schritt wandert er aufs Gerät. Bricht etwas ab,
   * setzt der nächste Anlauf hier an - und was schon fertig war, wird nicht
   * noch einmal bestellt.
   */
  let entwurf: SagaEntwurf =
    weiter && weiter.kennung === kennung
      ? weiter
      : leererEntwurf(kennung, eingaben.vorgaben);
  const halte = (teil: Partial<SagaEntwurf>) => {
    entwurf = speichereEntwurf({ ...entwurf, ...teil });
  };

  // 1. Der Kern: worum es überhaupt geht.
  let kern = entwurf.kern;
  if (!kern) {
    onSchritt?.("Das Überthema entsteht …");
    kern = await bei(
      "Beim Überthema",
      () =>
        postJson<KernAntwort>("/api/saga", {
          charaktere: eingaben.charaktere,
          orte: eingaben.orte,
          vorgaben: eingaben.vorgaben,
        }),
      () => onSchritt?.("Das Überthema entsteht … (noch einmal)"),
    );
    halte({ kern, name: kern.name, siegel: kern.bogenSiegel });
  }

  // 2. Die Kapitel - eines nach dem anderen, jedes kennt die vorherigen.
  let siegel = entwurf.siegel || kern.bogenSiegel;
  const entwuerfe: KapitelAntwort["kapitel"][] = [...entwurf.kapitel];
  for (let nummer = entwuerfe.length + 1; nummer <= anzahl; nummer++) {
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
    halte({ siegel, kapitel: [...entwuerfe] });
  }

  // 3. Das Finale.
  let finaleTexte = entwurf.finale;
  let verhandlung = entwurf.verhandlung;
  let beweiseFehlen = !entwurf.beweiseFertig;
  if (!finaleTexte) {
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
      2,
    );
    siegel = finaleBogen.bogenSiegel;
    finaleTexte = finaleBogen.finale;
    verhandlung = finaleBogen.verhandlung ?? null;
    beweiseFehlen = finaleBogen.weiter === "beweise";
    halte({
      siegel,
      finale: finaleTexte,
      verhandlung,
      beweiseFertig: !beweiseFehlen,
    });
  }

  /*
   * Die Verhandlung kommt in zwei Teilen: erst der Saal, dann die
   * Beweisstücke. Zusammen war es ein Aufruf, der regelmäßig länger lief,
   * als eine Serverfunktion darf - und ein Abbruch an dieser Stelle wirft
   * alles weg, was vorher schon bezahlt wurde.
   */
  if (beweiseFehlen) {
    onSchritt?.("Die Beweisstücke werden zusammengetragen …");
    const beweisBogen = await bei(
      "Bei den Beweisstücken",
      () =>
        postJson<BeweiseAntwort>("/api/saga", {
          schritt: "beweise",
          bogenSiegel: siegel,
          orte: eingaben.orte,
        }),
      () => onSchritt?.("Die Beweisstücke werden zusammengetragen … (noch einmal)"),
      2,
    );
    siegel = beweisBogen.bogenSiegel;
    if (verhandlung) {
      verhandlung = {
        ...verhandlung,
        beweise: beweisBogen.beweise,
        noetig: beweisBogen.noetig,
      };
    }
    halte({ siegel, verhandlung, beweiseFertig: true });
  }

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
    // In einer Saga steht beides im Bogen - gewürfelt wird hier nichts.
    daemonEnthuellung: "aus",
    mittaeter: "aus",
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
    /*
     * Ein Fall, der beim letzten Anlauf schon gebaut wurde, wird nicht noch
     * einmal bestellt. Er steht mit seinem Siegel im Zwischenstand und ist
     * genau derselbe, den es damals gab.
     */
    const gebaut: { fall: PublicCase; siegel: string } =
      entwurf.faelle[String(k.nummer)] ??
      (await fallFuer(k.nummer, `Fall ${k.nummer} von ${anzahl}`));
    halte({ faelle: { ...entwurf.faelle, [String(k.nummer)]: gebaut } });
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

  /*
   * Und dann ist der Saal auch das Einzige, was am Ende steht - fehlt er,
   * fehlt das ganze Finale.
   *
   * Genau das ist einmal passiert: Der Server lieferte die Beweisstücke in
   * einem zweiten Schritt, ein Browser mit älterem Stand holte ihn nicht ab,
   * und die Saga wurde ohne Beweise gespeichert. Beim Spielen sprang es vom
   * Erzählertext direkt in den Epilog - ohne Verhandlung, ohne Anklage, ohne
   * Urteil. Lieber hier abbrechen, solange nichts gespeichert ist.
   */
  if (saalStattFall && (verhandlung?.beweise?.length ?? 0) < 2) {
    throw new Error(
      "Die Verhandlung ist unvollständig zurückgekommen (keine Beweisstücke). Bitte noch einmal erzeugen - gespeichert wurde nichts.",
    );
  }
  if (!saalStattFall && !entwurf.finaleFall) onSchritt?.("Der Finalfall wird gebaut …");
  const finale =
    entwurf.finaleFall ??
    (saalStattFall ? { fall: null, siegel: null } : await fallFuer(0, "Finalfall"));
  halte({ finaleFall: finale });

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
        text: finaleTexte.erzaehlerText,
        audio: "",
        video: videoFuerKapitel(eingaben.vorgaben, eingaben.vorgaben.kapitelAnzahl),
      },
      frage: finaleTexte.frage,
      epilog: { text: finaleTexte.epilogText, audio: "" },
      fall: finale.fall,
      siegel: finale.siegel,
      verhandlung,
    },
    bogenSiegel: siegel,
    erstelltAm: Date.now(),
  };
}

/** Ein leerer Erzählerteil, falls in der Datenbank etwas fehlt. */
export const erzaehlerOder = (teil: { text: string; audio: string } | undefined) =>
  teil ?? LEERER_ERZAEHLER;
