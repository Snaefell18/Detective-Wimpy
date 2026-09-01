import { characterBrief } from "./characters";
import type { SagaVorgaben } from "./sagaTypen";
import type { Character, City } from "./types";

/**
 * Prompts für Sagas. Die Regeln zu Publikum und Absurdität kommen aus dem
 * Weltprompt (lib/prompts.ts) - hier steht nur, was über einen einzelnen Fall
 * hinausgeht.
 */

/** Schritt 1: Worum es in der ganzen Saga geht. */
export function buildKernPrompt(
  besetzung: Character[],
  staedte: City[],
  drahtzieher: Character,
  vorgaben: SagaVorgaben,
): string {
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);

  return `Entwirf den Kern einer Saga für Detective Wimpy: ${vorgaben.kapitelAnzahl} Fälle hintereinander, die ein gemeinsames Überthema haben, und danach ein Finale. Die einzelnen Kapitel kommen später - hier geht es nur um den großen Bogen.

DER DRAHTZIEHER STEHT BEREITS FEST: ${drahtzieher.name} [${drahtzieher.id}].
${characterBrief(drahtzieher)}
Er oder sie steckt hinter allem, taucht aber erst im Finale als Schuldiger auf.

${vorgaben.thema ? `ÜBERTHEMA (unbedingt aufgreifen): ${vorgaben.thema}\n` : ""}
DIE TIERE
${verdaechtige.map((c) => `- [${c.id}] ${characterBrief(c)}`).join("\n")}

DIE STÄDTE
${staedte.map((s) => `- ${s.name}`).join("\n")}

Anforderungen:
- Die Wahrheit muss groß genug für ${vorgaben.kapitelAnzahl} Fälle sein, aber in einem Satz erzählbar.
- Der Klappentext verrät den Drahtzieher nicht.
- Der Auftakttext klingt wie eine Krimi-Ansage: kurze Zeilen, Atmosphäre, keine Anrede.
- Die Schlagworte sind der Vorspann: einzelne, harte Wörter, die zusammen die Stimmung der ganzen Saga aufspannen.
- Alles auf Deutsch.`;
}

/** Schritt 2: ein einzelnes Kapitel, das die vorherigen kennt. */
export function buildKapitelPrompt(args: {
  nummer: number;
  anzahl: number;
  thema: string;
  wahrheit: string;
  drahtzieherName: string;
  drahtzieherId: string;
  moeglicheTaeter: Character[];
  bisher: { name: string; enthuellung: string }[];
  wunsch: string;
  stadt: string;
}): string {
  const {
    nummer,
    anzahl,
    thema,
    wahrheit,
    drahtzieherName,
    drahtzieherId,
    moeglicheTaeter,
    bisher,
    wunsch,
    stadt,
  } = args;

  const vorher = bisher.length
    ? `\nWAS BISHER GESCHAH\n${bisher
        .map((k, i) => `- Kapitel ${i + 1} „${k.name}“: ${k.enthuellung}`)
        .join("\n")}`
    : "\nDies ist das erste Kapitel.";

  const letztes = nummer === anzahl;

  return `Entwirf Kapitel ${nummer} von ${anzahl} einer Saga.

ÜBERTHEMA: ${thema}
DIE WAHRHEIT HINTER ALLEM (streng geheim, kommt erst im Finale heraus): ${wahrheit}
DER DRAHTZIEHER: ${drahtzieherName} [${drahtzieherId}] - darf in diesem Kapitel auf keinen Fall der Täter sein und wirkt höchstens beiläufig harmlos.${vorher}

MÖGLICHE TÄTER FÜR DIESES KAPITEL
${moeglicheTaeter.map((c) => `- ${c.name} [${c.id}]`).join("\n")}

Anforderungen:
- Das Kapitel spielt in ${stadt}.
- Der Fall ist für sich abgeschlossen und lösbar, ohne die anderen Kapitel zu kennen.
- Die Enthüllung geht einen Schritt weiter als die bisherigen${letztes ? " und ist die deutlichste von allen - danach fehlt nur noch der letzte Beweis" : ""}.
- Der Täter dieses Kapitels hängt mit dem Drahtzieher zusammen: erpresst, bezahlt, hereingelegt oder ahnungslos benutzt.
- Der Erzählertext klingt wie eine Krimi-Ansage: kurze Zeilen, Atmosphäre, keine Anrede, kein "Kapitel ${nummer}".
- Alles auf Deutsch.${wunsch ? `\n\nWUNSCH FÜR DIESES KAPITEL (unbedingt einhalten): ${wunsch}` : ""}`;
}

/** Schritt 3: das Finale. */
export function buildFinalePrompt(args: {
  thema: string;
  wahrheit: string;
  drahtzieherName: string;
  motiv: string;
  bisher: { name: string; enthuellung: string }[];
}): string {
  const { thema, wahrheit, drahtzieherName, motiv, bisher } = args;

  return `Entwirf das Finale der Saga.

ÜBERTHEMA: ${thema}
DIE WAHRHEIT: ${wahrheit}
DER DRAHTZIEHER: ${drahtzieherName} - hier ist er der Täter, und hier fliegt alles auf.
SEIN MOTIV: ${motiv}

WAS DIE KAPITEL PREISGEGEBEN HABEN
${bisher.map((k, i) => `- Kapitel ${i + 1} „${k.name}“: ${k.enthuellung}`).join("\n")}

Anforderungen:
- Die Frage ist kurz und steht groß über dem Finale (z.B. "Wer sammelt die Glocken?").
- Der Auftrag führt die Fäden aller Kapitel zusammen.
- Der Erzählertext vor dem Finale zieht die Schlinge zu, verrät den Drahtzieher aber noch nicht.
- Der Epilog kommt nach dem gelösten Fall und darf alles aussprechen.
- Erzählertexte in kurzen Zeilen, keine Anrede. Alles auf Deutsch.`;
}

/**
 * Was die Fallerzeugung über die Saga wissen muss.
 *
 * Steht nur im Prompt auf dem Server - im Browser taucht davon nichts auf,
 * sonst könnte man den Drahtzieher vorab nachlesen.
 */
export function buildSagaBriefing(args: {
  thema: string;
  wahrheit: string;
  drahtzieherName: string;
  kapitelNummer: number;
  kapitelAnzahl: number;
  auftrag: string;
  enthuellung: string;
  vorherigeEnthuellungen: string[];
  istFinale: boolean;
}): string {
  const {
    thema,
    wahrheit,
    drahtzieherName,
    kapitelNummer,
    kapitelAnzahl,
    auftrag,
    enthuellung,
    vorherigeEnthuellungen,
    istFinale,
  } = args;

  const bisher = vorherigeEnthuellungen.length
    ? `\nWAS DER SPIELER SCHON WEISS\n${vorherigeEnthuellungen.map((e) => `- ${e}`).join("\n")}`
    : "";

  if (istFinale) {
    return `DIESER FALL IST DAS FINALE EINER SAGA.

ÜBERTHEMA: ${thema}
DIE WAHRHEIT: ${wahrheit}
DER DRAHTZIEHER: ${drahtzieherName} - in diesem Fall ist er der Täter, und hier fliegt alles auf.${bisher}

AUFTRAG FÜR DIESEN FALL: ${auftrag}

Zusätzlich:
- Der Fall führt die Fäden der ${kapitelAnzahl} Kapitel zusammen. Greif auf, was der Spieler schon weiß.
- Die Spuren müssen den Drahtzieher überführen, nicht die Handlanger aus den Kapiteln.
- Die Tatbeschreibung darf ruhig groß klingen - es ist der Schlusspunkt.`;
  }

  return `DIESER FALL IST KAPITEL ${kapitelNummer} VON ${kapitelAnzahl} EINER SAGA.

ÜBERTHEMA: ${thema}
DIE WAHRHEIT HINTER ALLEM (streng geheim, kommt erst im Finale heraus): ${wahrheit}
DER DRAHTZIEHER (darf hier auf keinen Fall als Schuldiger dastehen): ${drahtzieherName}${bisher}

AUFTRAG FÜR DIESEN FALL: ${auftrag}
WAS DIESES KAPITEL PREISGIBT: ${enthuellung}

Zusätzlich:
- Der Fall ist für sich abgeschlossen und lösbar, ohne die anderen Kapitel zu kennen.
- Genau die oben genannte Enthüllung muss sich aus dem Fall ergeben - als Randnotiz, gefundener Gegenstand oder Bemerkung eines Tieres. Nicht mehr.
- Der Drahtzieher wird höchstens beiläufig gestreift und wirkt dabei harmlos.`;
}
