import { characterBrief } from "./characters";
import type { SagaVorgaben } from "./sagaTypen";
import type { Character, City } from "./types";

/**
 * Prompts für Sagas. Die Regeln zu Publikum und Absurdität kommen aus dem
 * Weltprompt (lib/prompts.ts) - hier steht nur, was über einen einzelnen Fall
 * hinausgeht.
 */

/**
 * Der Twist: Der Drahtzieher kommt in den Kapiteln gar nicht vor. Man
 * begegnet ihm nie, kann ihn nie befragen - trotzdem führen die Spuren zu
 * ihm, nur eben über Eigenschaften statt über einen Namen.
 */
const TWIST_REGELN = `
DER TWIST - DAS WICHTIGSTE AN DIESER SAGA
- Der Drahtzieher tritt in den Kapiteln überhaupt nicht auf. Er gehört dort nicht zur Besetzung, der Spieler sieht ihn nicht und kann ihn nicht befragen.
- Die Hinweise auf ihn gibt es trotzdem, ganz normal und von Anfang an - aber immer über Eigenschaften statt über einen Namen: eine Handschrift, ein Geruch, eine Fellfarbe an der falschen Stelle, ein Siegel, ein wiederkehrender Satz, ein Fahrzeug, ein bezahlter Auftrag.
- Andere Tiere dürfen von ihm erzählen, ohne ihn zu kennen: "der mit dem Hut", "der immer nachts kommt", "der, den keiner je gesehen hat".
- Nenne seinen Namen in keinem Kapiteltext. Erst im Finale steht er da.`;

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
${vorgaben.twist ? `${TWIST_REGELN}\n` : ""}

${vorgaben.thema ? `ÜBERTHEMA (unbedingt aufgreifen): ${vorgaben.thema}\n` : ""}
DIE TIERE
${verdaechtige.map((c) => `- [${c.id}] ${characterBrief(c)}`).join("\n")}

DIE STÄDTE
${staedte.map((s) => `- ${s.name}`).join("\n")}

Anforderungen:
- Die Wahrheit muss groß genug für ${vorgaben.kapitelAnzahl} Fälle sein, aber in einem Satz erzählbar.
- Der Klappentext verrät den Drahtzieher nicht.
- Der Auftakttext klingt wie eine Krimi-Ansage: kurze Zeilen, Atmosphäre, keine Anrede.
- Die Schlagworte sind der Vorspann: einzelne, harte Wörter, die zusammen die Stimmung der ganzen Saga aufspannen.${
    vorgaben.twist
      ? "\n- Die Wahrheit muss ohne die Anwesenheit des Drahtziehers erzählbar sein: Er wirkt aus dem Hintergrund, über Handlanger, Aufträge und Spuren."
      : ""
  }
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
  twist: boolean;
  /** Tiere, die in genau diesem Kapitel zum ersten Mal auftauchen. */
  neueTiere: string[];
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
    twist,
    neueTiere,
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
DER DRAHTZIEHER: ${drahtzieherName} [${drahtzieherId}] - darf in diesem Kapitel auf keinen Fall der Täter sein${
    twist
      ? " und ist hier gar nicht anwesend."
      : " und wirkt höchstens beiläufig harmlos."
  }${twist ? `\n${TWIST_REGELN}` : ""}${vorher}

MÖGLICHE TÄTER FÜR DIESES KAPITEL
${moeglicheTaeter.map((c) => `- ${c.name} [${c.id}]`).join("\n")}

Anforderungen:
- Das Kapitel spielt in ${stadt}.
- Der Fall ist für sich abgeschlossen und lösbar, ohne die anderen Kapitel zu kennen.
- Die Enthüllung geht einen Schritt weiter als die bisherigen${letztes ? " und ist die deutlichste von allen - danach fehlt nur noch der letzte Beweis" : ""}.
- Der Täter dieses Kapitels hängt mit dem Drahtzieher zusammen: erpresst, bezahlt, hereingelegt oder ahnungslos benutzt.${
    twist
      ? "\n- Die Enthüllung beschreibt den Drahtzieher über eine Eigenschaft oder eine Spur, niemals über seinen Namen - der Spieler soll ihn sich zusammensetzen können, bevor er ihn je gesehen hat."
      : ""
  }
- Der Erzählertext klingt wie eine Krimi-Ansage: kurze Zeilen, Atmosphäre, keine Anrede, kein "Kapitel ${nummer}".${
    neueTiere.length
      ? `\n- NEU IN DER STADT: ${neueTiere.join(", ")} - ${
          neueTiere.length === 1 ? "taucht" : "tauchen"
        } hier zum ersten Mal auf. Der Erzählertext erklärt beiläufig, warum: zugezogen, zurückgekehrt, angereist, aus dem Urlaub zurück. Danach ${
          neueTiere.length === 1 ? "bleibt" : "bleiben"
        } ${neueTiere.length === 1 ? "es" : "sie"} bis zum Ende dabei.`
      : ""
  }
- Alles auf Deutsch.${wunsch ? `\n\nWUNSCH FÜR DIESES KAPITEL (unbedingt einhalten): ${wunsch}` : ""}`;
}

/** Schritt 3: das Finale. */
export function buildFinalePrompt(args: {
  thema: string;
  wahrheit: string;
  drahtzieherName: string;
  motiv: string;
  bisher: { name: string; enthuellung: string }[];
  twist: boolean;
  /** Tiere, die erst im Finale dazustoßen. */
  neueTiere: string[];
}): string {
  const { thema, wahrheit, drahtzieherName, motiv, bisher, twist, neueTiere } = args;

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
- Der Erzählertext vor dem Finale zieht die Schlinge zu, verrät den Drahtzieher aber noch nicht.${
    twist
      ? `
- WICHTIG: In den Kapiteln ist ${drahtzieherName} nie aufgetreten - der Spieler kennt ihn nur als Schatten, als Handschrift, als Gerücht. Der Erzählertext vor dem Finale muss genau das erzählen: dass jetzt jemand die Bühne betritt, den man die ganze Zeit nur an seinen Spuren erkannt hat. Beschreibe seinen Auftritt, ohne den Namen zu nennen - der Spieler soll ihn in der Besetzung wiedererkennen.
- Der Auftrag des Finalfalls sagt ausdrücklich, dass der Gesuchte zum ersten Mal greifbar ist.`
      : ""
  }
- Der Epilog kommt nach dem gelösten Fall und darf alles aussprechen.${
    neueTiere.length
      ? `\n- ZUM FINALE STOSSEN DAZU: ${neueTiere.join(", ")}. Sie waren in keinem Kapitel dabei. Der Erzählertext vor dem Finale bringt sie in die Stadt, ohne zu verraten, wer von ihnen der Gesuchte ist - eine Ankunft, eine Einladung, eine Zusammenkunft, zu der plötzlich alle da sind.`
      : ""
  }
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
  twist: boolean;
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
    twist,
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
- Die Spuren müssen den Drahtzieher überführen, nicht die Handlanger aus den Kapiteln.${
      twist
        ? `\n- ${drahtzieherName} kommt hier zum ersten Mal überhaupt vor. Bau seinen Auftritt in die Tatbeschreibung ein: Er war die ganze Zeit da, nur nie zu sehen.`
        : ""
    }
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
- Der Drahtzieher wird höchstens beiläufig gestreift und wirkt dabei harmlos.${
    twist
      ? `\n- ${drahtzieherName} ist in diesem Fall NICHT anwesend und gehört nicht zur Besetzung. Was auf ihn deutet, taucht als Gegenstand, Geruch, Handschrift oder Aussage Dritter auf - nie als Person und nie unter seinem Namen.`
      : ""
  }`;
}
