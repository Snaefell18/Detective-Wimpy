import { characterBrief } from "./characters";
import { nochNichtDa } from "./namenSchutz";
import { besessen, type SagaVorgaben } from "./sagaTypen";
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

/**
 * Die Spur der Besessenheit - dieselben Regeln für Kapitel, Fälle und Finale.
 *
 * Der Sinn ist die Dosis: In jedem Kapitel genau ein Detail, das nicht ins
 * Bild passt und das niemand erklären kann. Zusammengenommen ergibt sich ein
 * Muster, einzeln bleibt jedes für sich harmlos. Erklärt wird nichts, benannt
 * schon gar nichts - sonst wäre die Verwandlung vor dem Finale entwertet.
 */
function besessenheitsRegeln(wirtName: string, daemonName: string): string {
  return `
ETWAS ÜBLES GEHT VOR (streng geheim)
- ${wirtName} ist besessen, weiß es aber nicht. ${daemonName} ist die Gestalt darin und kommt vor dem Finale nirgends vor - weder als Person noch beim Namen.
- Bau genau EIN kleines Zeichen ein, das nicht ins Bild passt und mit ${wirtName} zu tun hat: eine Stunde, die er nicht erinnert; Erde unter den Krallen, obwohl er zu Hause war; ein Kratzer zu hoch an der Wand; Kälte in einem warmen Raum; ein Satz in einer Sprache, die er nicht spricht; eine Spiegelung, die einen Herzschlag zu spät folgt.
- Niemand erklärt es, niemand nennt Dämon, Fluch oder Magie. Ein Tier wundert sich höchstens kurz und redet weiter.
- Es darf den Fall nicht lösen und nicht in die Irre führen: Der Täter dieses Kapitels bleibt der, der es ist.`;
}

/** Schritt 1: Worum es in der ganzen Saga geht. */
export function buildKernPrompt(
  besetzung: Character[],
  staedte: City[],
  drahtzieher: Character,
  vorgaben: SagaVorgaben,
): string {
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);

  // Titel, Klappentext, Auftakt und Schlagworte sind der Vorspann. Wer erst
  // später auftritt, darf dort nicht vorkommen - sonst ist die Überraschung
  // vor dem ersten Satz verbraucht.
  const spaeter = nochNichtDa({
    besetzung,
    drahtzieherId: drahtzieher.id,
    vorgaben,
    kapitel: 0,
  }).map((c) => c.name);

  const wirt = besessen(vorgaben)
    ? besetzung.find((c) => c.id === vorgaben.besessenheit.wirtId)
    : undefined;

  return `Entwirf den Kern einer Saga für Detective Wimpy: ${vorgaben.kapitelAnzahl} Fälle hintereinander, die ein gemeinsames Überthema haben, und danach ein Finale. Die einzelnen Kapitel kommen später - hier geht es nur um den großen Bogen.

DER DRAHTZIEHER STEHT BEREITS FEST: ${drahtzieher.name} [${drahtzieher.id}].
${characterBrief(drahtzieher)}
Er oder sie steckt hinter allem, taucht aber erst im Finale als Schuldiger auf.
NIRGENDS VOR DEM FINALE BENENNEN: In Titel, Überthema, Klappentext und Auftakt darf ${drahtzieher.name} nicht als der Verantwortliche dastehen - kein "dahinter steckt", kein "zieht die Fäden", kein "hinter allem". Andeuten ist ausdrücklich erwünscht: eine Handschrift, ein Geruch, ein Satz, der zweimal fällt. Nur der Schluss gehört dem Spieler.
${vorgaben.twist ? `${TWIST_REGELN}\n` : ""}${
    wirt
      ? `
BESESSENHEIT - DAS GEHEIMNIS DIESER SAGA
- ${drahtzieher.name} ist keine Figur, der man begegnet: Es ist die Dämonengestalt, die in ${wirt.name} steckt. In allen Kapiteln sieht der Spieler nur ${wirt.name} - freundlich, harmlos, mittendrin.
- ${wirt.name} weiß selbst nichts davon. Was durch ihn geschieht, geschieht nachts, in Lücken, in Blackouts.
- Die Wahrheit muss diese Doppelnatur tragen: Sie erklärt am Ende, warum die Spuren zu etwas Uraltem führen und nicht zu einem Tier.
- Nenne weder "${drahtzieher.name}" noch das Wort Dämon vor dem Finale. Erst dort bricht es heraus.
${besessenheitsRegeln(wirt.name, drahtzieher.name)}
`
      : ""
  }

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
- Alles auf Deutsch.${
    spaeter.length
      ? `\n\nNIEMALS NENNEN - diese Tiere treten erst später auf: ${spaeter.join(
          ", ",
        )}. Weder im Titel noch im Klappentext, im Überthema, im Auftakttext oder in den Schlagworten darf einer dieser Namen stehen. Der Vorspann darf sie nicht verraten.`
      : ""
  }`;
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
  /** Von Hand gesetzter Täter dieses Kapitels - leer heißt: freie Wahl. */
  wunschTaeter: string;
  /** Tiere, die erst nach diesem Kapitel dazustoßen. */
  nochNichtDaTiere?: string[];
  /** Wirt und Dämonengestalt, wenn die Saga eine Besessenheit hat. */
  besessenheit?: { wirt: string; daemon: string };
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
    wunschTaeter,
    nochNichtDaTiere = [],
    besessenheit,
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
DER DRAHTZIEHER: ${drahtzieherName} [${drahtzieherId}] - darf in diesem Kapitel auf keinen Fall der Täter sein und in keinem Text dieses Kapitels als der Kopf hinter allem benannt werden (andeuten ja, benennen nein)${
    twist
      ? " und ist hier gar nicht anwesend."
      : " und wirkt höchstens beiläufig harmlos."
  }${twist ? `\n${TWIST_REGELN}` : ""}${
    besessenheit ? besessenheitsRegeln(besessenheit.wirt, besessenheit.daemon) : ""
  }${vorher}

${
    wunschTaeter
      ? `DER TÄTER DIESES KAPITELS STEHT FEST: ${wunschTaeter}. Bau den Fall um ihn herum - Motiv, Gelegenheit und Verbindung zum Drahtzieher müssen zu ihm passen.`
      : `MÖGLICHE TÄTER FÜR DIESES KAPITEL
${moeglicheTaeter.map((c) => `- ${c.name} [${c.id}]`).join("\n")}`
  }

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
- Alles auf Deutsch.${
    nochNichtDaTiere.length
      ? `\n- NIEMALS NENNEN - ${nochNichtDaTiere.join(
          ", ",
        )} ${nochNichtDaTiere.length === 1 ? "stößt" : "stoßen"} erst später dazu und ${
          nochNichtDaTiere.length === 1 ? "kommt" : "kommen"
        } in diesem Kapitel überhaupt nicht vor - auch nicht beiläufig, auch nicht im Erzählertext.`
      : ""
  }${wunsch ? `\n\nWUNSCH FÜR DIESES KAPITEL (unbedingt einhalten): ${wunsch}` : ""}`;
}

/** Schritt 3: das Finale. */
export function buildFinalePrompt(args: {
  thema: string;
  wahrheit: string;
  drahtzieherName: string;
  motiv: string;
  bisher: { name: string; enthuellung: string }[];
  twist: boolean;
  /** Wirt und Dämonengestalt, wenn die Saga eine Besessenheit hat. */
  besessenheit?: { wirt: string; daemon: string };
  /** Tiere, die erst im Finale dazustoßen. */
  neueTiere: string[];
}): string {
  const { thema, wahrheit, drahtzieherName, motiv, bisher, twist, neueTiere, besessenheit } =
    args;

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
${
    besessenheit
      ? `
- BESESSENHEIT: ${besessenheit.daemon} ist die Gestalt, die die ganze Zeit in ${besessenheit.wirt} steckte. Der Erzählertext vor dem Finale erzählt, dass mit ${besessenheit.wirt} etwas nicht stimmt - er zittert, er weicht aus, er wirkt wie zwei Wesen in einem -, nennt aber weder Dämon noch ${besessenheit.daemon}.
- Im Finalfall ist ${besessenheit.wirt} nicht mehr dabei: An seiner Stelle steht ${besessenheit.daemon}. Der Auftrag darf das voraussetzen.
- Der Epilog erklärt endlich alles: seit wann, warum ausgerechnet ${besessenheit.wirt}, und was aus ihm wird.`
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
  /** Wirt und Dämonengestalt, wenn die Saga eine Besessenheit hat. */
  besessenheit?: { wirt: string; daemon: string };
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
    besessenheit,
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
- Die Tatbeschreibung darf ruhig groß klingen - es ist der Schlusspunkt.${
      besessenheit
        ? `\n- ${besessenheit.daemon} ist die Gestalt, die bis eben in ${besessenheit.wirt} steckte. ${besessenheit.wirt} gehört nicht mehr zur Besetzung. Die Tatbeschreibung greift auf, was in den Kapiteln unerklärlich blieb - die fehlenden Stunden, die Kälte, die Spuren, die zu niemandem passten -, und löst es auf.`
        : ""
    }`;
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
    besessenheit ? besessenheitsRegeln(besessenheit.wirt, besessenheit.daemon) : ""
  }${
    twist
      ? `\n- ${drahtzieherName} ist in diesem Fall NICHT anwesend und gehört nicht zur Besetzung. Was auf ihn deutet, taucht als Gegenstand, Geruch, Handschrift oder Aussage Dritter auf - nie als Person und nie unter seinem Namen.`
      : ""
  }`;
}
