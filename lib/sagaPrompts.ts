import { characterBrief } from "./characters";
import type { FinaleArt } from "./sagaFinale";
import { nochNichtDa } from "./namenSchutz";
import { HAFT_REGEL } from "./schrankhaft";
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


/**
 * Was die gewählte Finale-Art für die ganze Saga bedeutet.
 *
 * Der Block steht im Kern, in jedem Kapitel und in jedem Fallbriefing - denn
 * ein Columbo-Finale will von Anfang an anders erzählt werden als ein Fall,
 * dessen Schuldiger erst am Ende dasteht.
 *
 * `wimpy` ist der Detektiv, `taeter` die Figur, die im Bogen als Drahtzieher
 * geführt wird - bei "ohne-taeter" ist das der zu Unrecht Verdächtigte.
 */
export function finaleArtRegeln(args: {
  art: FinaleArt;
  taeterName: string;
  detektivName: string;
  /** Nur bei "wimpy": das Wesen, das in ihm steckt. */
  daemonName?: string;
  /** Im Kern ist die Ansage länger als in einem einzelnen Kapitel. */
  ausfuehrlich?: boolean;
  /**
   * Ab welchem Kapitel der Drahtzieher überhaupt auftritt. 1 heißt "von
   * Anfang an"; alles darüber ändert das Katz-und-Maus-Spiel: Vorher gibt es
   * ihn nur als Gerücht.
   */
  abKapitel?: number;
}): string {
  const { art, taeterName, detektivName, daemonName, ausfuehrlich, abKapitel = 1 } = args;

  if (art === "gericht") {
    return `
DAS FINALE DIESER SAGA IST EIN GERICHTSVERFAHREN (Columbo-Regel)
- Man weiß früh, wer es war: ${taeterName} ${
      abKapitel > 1
        ? `taucht erst ab Kapitel ${abKapitel} auf - davor ist er nur ein Name, den jemand fallen lässt. Ab dann aber ist er ständig da,`
        : "tritt in jedem Kapitel auf,"
    } ist freundlich, hilfsbereit, immer zur Stelle - und spielt mit ${detektivName}.
- Er weiß, dass ${detektivName} es weiß. Er sagt es nie, aber jede Begegnung hat einen doppelten Boden: eine Bemerkung zu viel, ein Wissen, das er nicht haben dürfte, ein freundlicher Rat, der eine Warnung ist.
- Was fehlt, ist nicht der Verdacht, sondern der Beweis. Jedes Kapitel lässt genau EIN hartes, benennbares Stück zurück, das später vor Gericht etwas wert ist: ein Zettel, eine Uhrzeit, ein Abdruck, eine Quittung, eine Zeugin, ein Geruch an der falschen Stelle.
- ${taeterName} ist in den Kapiteln trotzdem nie der Täter des jeweiligen Falls. Er steht daneben, hilft mit, und geht als Erster wieder.${
      ausfuehrlich
        ? `
- Der Klappentext darf das Katz-und-Maus-Spiel andeuten, ohne ${taeterName} zu benennen.
- Die Wahrheit muss vor Gericht beweisbar sein: keine Ahnung, kein Gefühl, sondern Dinge, die man auf den Tisch legen kann.`
        : ""
    }`;
  }

  if (art === "ohne-taeter") {
    return `
DIESE SAGA HAT KEINEN SCHULDIGEN (streng geheim)
- Es gibt keinen Drahtzieher. Was wie eine Serie von Taten aussieht, ist etwas anderes: eine alte Maschine, eine Strömung, ein Fehler im Fahrplan, ein Tier, das nicht weiß, was es tut, eine Kette von Zufällen, die sich zu einem Muster fügt.
- ${taeterName} ist der, den alle verdächtigen - und er ist unschuldig. Jedes Kapitel schiebt ihn tiefer hinein: falsche Zeit, falscher Ort, ein Alibi, das zerfällt, ein Gerücht, das haften bleibt.
- Der Fall jedes Kapitels hat einen ganz normalen Täter. Nur die große Serie darüber hat keinen.
- Bau in jedes Kapitel genau EIN Detail ein, das kein Tier verursacht haben kann: die Uhrzeit stimmt für niemanden, die Spur ist zu hoch, zu kalt, zu regelmäßig, sie wiederholt sich auf die Minute genau.
- Sag nirgends, dass es keinen Täter gibt. Das ist der Schluss, den der Spieler selbst zieht.${
      ausfuehrlich
        ? `
- Die Wahrheit im Bogen benennt die wirkliche Ursache klar und in einem Satz - sie muss am Ende belegbar sein.
- Der Klappentext klingt wie eine ganz normale Jagd nach einem Schuldigen.`
        : ""
    }`;
  }

  if (art === "wimpy") {
    return `
DER DETEKTIV IST DER SCHULDIGE (streng geheim, das größte Geheimnis dieser Saga)
- ${detektivName} war die ganze Zeit besessen${daemonName ? ` - von ${daemonName}` : ""}. Was er nachts tut, weiß er am Morgen nicht mehr. Er ermittelt gegen sich selbst, ohne es zu ahnen.
- ${daemonName ? `${daemonName} tritt vor dem Finale nirgends auf und wird nie genannt.` : "Das Wesen in ihm tritt vor dem Finale nirgends auf."}
- Bau in jedes Kapitel genau EIN Zeichen ein, das an ${detektivName} selbst hängt: eine Stunde, die er nicht erinnert; sein eigener Abdruck an einem Ort, an dem er nie war; Schlamm an seinen Schuhen nach einer Nacht im Bett; ein Zeuge, der ihn gesehen haben will, und der Zeuge irrt sich nicht.
- Niemand spricht es aus. Die Tiere wundern sich, wechseln das Thema, schauen weg. ${detektivName} selbst erklärt es sich weg.
- Der Täter des jeweiligen Kapitels bleibt trotzdem der, der er ist - die Zeichen lösen keinen einzigen Fall.${
      ausfuehrlich
        ? `
- Die Wahrheit im Bogen sagt klar: ${detektivName} hat es getan, und was in ihm steckte.
- Weder im Titel noch im Klappentext, Überthema oder Auftakt darf auch nur angedeutet werden, dass der Detektiv selbst gemeint ist. Der Vorspann gehört dem gewöhnlichen Verdacht.`
        : ""
    }`;
  }

  return "";
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

  const detektiv = besetzung.find((c) => c.istDetektiv);
  // Worauf die Saga zuläuft, gehört schon in den ersten Aufruf: Ein
  // Columbo-Bogen wird anders erfunden als einer, dessen Schuldiger sich
  // versteckt.
  const artRegeln = finaleArtRegeln({
    art: vorgaben.finaleArt ?? "klassisch",
    taeterName: drahtzieher.name,
    detektivName: detektiv?.name ?? "Wimpy",
    daemonName: drahtzieher.name,
    ausfuehrlich: true,
  });

  return `Entwirf den Kern einer Saga für Detective Wimpy: ${vorgaben.kapitelAnzahl} Fälle hintereinander, die ein gemeinsames Überthema haben, und danach ein Finale. Die einzelnen Kapitel kommen später - hier geht es nur um den großen Bogen.

DER DRAHTZIEHER STEHT BEREITS FEST: ${drahtzieher.name} [${drahtzieher.id}].
${characterBrief(drahtzieher)}
Er oder sie steckt hinter allem, taucht aber erst im Finale als Schuldiger auf.
NIRGENDS VOR DEM FINALE BENENNEN: In Titel, Überthema, Klappentext und Auftakt darf ${drahtzieher.name} nicht als der Verantwortliche dastehen - kein "dahinter steckt", kein "zieht die Fäden", kein "hinter allem". Andeuten ist ausdrücklich erwünscht: eine Handschrift, ein Geruch, ein Satz, der zweimal fällt. Nur der Schluss gehört dem Spieler.
${artRegeln ? `${artRegeln}\n` : ""}${vorgaben.twist ? `${TWIST_REGELN}\n` : ""}${
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
  /** Worauf die Saga zuläuft - schon hier, nicht erst im Finale. */
  finaleRegeln?: string;
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
    finaleRegeln = "",
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
  }${twist ? `\n${TWIST_REGELN}` : ""}${finaleRegeln}${
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
 * Schritt 3b: die Verhandlung statt eines Finalfalls.
 *
 * Sie muss aus dem bestehen, was der Spieler in den Kapiteln erlebt hat -
 * deshalb bekommt das Modell hier jede Enthüllung noch einmal vorgelegt. Die
 * Fehlschlüsse sind genauso wichtig wie die tragenden Stücke: Ohne sie wäre
 * das Vorlegen keine Entscheidung, sondern Abarbeiten.
 */
export function buildVerhandlungPrompt(args: {
  art: FinaleArt;
  thema: string;
  wahrheit: string;
  /** Wer auf der Anklagebank sitzt. */
  angeklagter: string;
  /** Wer die Verhandlung leitet. */
  richter: string;
  detektivName: string;
  motiv: string;
  kapitel: { name: string; enthuellung: string }[];
}): string {
  const { art, thema, wahrheit, angeklagter, richter, detektivName, motiv, kapitel } = args;

  const ziel =
    art === "ohne-taeter"
      ? `${angeklagter} sitzt auf der Anklagebank, obwohl er nichts getan hat. ${detektivName} muss belegen, dass hinter der ganzen Serie überhaupt kein Tier steckt - und was stattdessen. Am Ende steht ein Freispruch.`
      : art === "wimpy"
        ? `Auf der Anklagebank sitzt ${detektivName} selbst. Er hat es getan, ohne es zu wissen, und legt jetzt die Beweise gegen sich selbst vor. Der Saal begreift es langsamer als er.`
        : `${angeklagter} sitzt auf der Anklagebank. Alle ahnen seit Langem, dass er es war; was fehlte, war der Beweis. Jetzt legt ${detektivName} vor, was er über die ganze Saga gesammelt hat.`;

  return `Entwirf die Schlussverhandlung dieser Saga. Es gibt keinen Finalfall mehr - dieser Gerichtssaal IST das Finale.

ÜBERTHEMA: ${thema}
DIE WAHRHEIT: ${wahrheit}
DAS MOTIV: ${motiv}
DIE VERHANDLUNG: ${ziel}
${richter} führt den Vorsitz und spricht das Urteil.

WAS DIE KAPITEL PREISGEGEBEN HABEN
${kapitel.map((k, i) => `- Kapitel ${i + 1} „${k.name}“: ${k.enthuellung}`).join("\n")}

DIE BEWEISSTÜCKE - darauf kommt es an
- Sechs bis acht Stück, jedes eindeutig aus einem der Kapitel oben. Schreib die Herkunft dazu ("Kapitel 2 - Die Nacht am Hafen").
- Drei oder vier davon tragen (traegt = true): Sie sind hart, überprüfbar und hängen unmittelbar mit der Wahrheit zusammen.
- Der Rest trägt nicht (traegt = false), sieht aber überzeugend aus: ein Gefühl statt eines Fundes, eine Aussage vom Hörensagen, ein Gegenstand ohne Verbindung, ein Widerspruch, der sich harmlos erklären lässt.
- Von außen darf man den Stücken nicht ansehen, welche tragen. Name und Text klingen bei allen gleich sicher.
- Die Reaktion ist der Kern des Abends: Trägt es, gerät ${art === "wimpy" ? "der Saal ins Wanken und " + detektivName + " erkennt ein Stück mehr von sich selbst" : angeklagter + " ins Rutschen - erst freundlich, dann dünner, dann still"}. Trägt es nicht, dreht ${art === "ohne-taeter" ? "die Anklage" : art === "wimpy" ? "der Saal" : angeklagter} es um und lässt ${detektivName} klein dastehen.

WEITERES
- Die Frage steht groß über dem Saal (z.B. "Reicht das, was du hast?").
- Der Erzählertext davor führt in den Saal: kurze Zeilen, Atmosphäre, keine Anrede. Er verrät nicht, wie es ausgeht.
- Die Eröffnung spricht ${richter} - streng, trocken, kein Wort zu viel.
- Das Urteil bei Erfolg spricht ${richter} ebenfalls${
    art === "ohne-taeter"
      ? " - es endet mit einem Freispruch und benennt die wirkliche Ursache."
      : art === "wimpy"
        ? ` - es spricht ${detektivName} schuldig, und der Saal weiß nicht, wohin mit sich.`
        : ` - es spricht ${angeklagter} schuldig.`
  }
- Das Urteil beim Scheitern lässt ${art === "ohne-taeter" ? "den Falschen verurteilt zurück" : art === "wimpy" ? "die Sache ungeklärt und " + detektivName + " mit seinem Wissen allein" : angeklagter + " gehen - freundlich, mit einem letzten Satz, der wehtut"}.
- Der Epilog kommt nach dem Urteil und darf alles aussprechen.
- Alles auf Deutsch.

${HAFT_REGEL}
- tageSchuldig: ${
    art === "ohne-taeter"
      ? "0 - bei tragender Beweisführung gibt es einen Freispruch, und niemand muss in den Schrank."
      : `die Tage, die ${art === "wimpy" ? detektivName : angeklagter} bekommt. Sie passen zu einer ganzen Saga, nicht zu einem einzelnen Streich.`
  }
- tageFrei: ${
    art === "ohne-taeter"
      ? `die Tage, die ${angeklagter} zu Unrecht bekommt, wenn die Beweisführung scheitert.`
      : "0 - wer nicht überführt wird, geht nach Hause."
  }
- Das Urteil, das jemanden in den Schrank schickt, nennt die Zahl im letzten Satz.`;
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
  /** Worauf die Saga zuläuft - damit auch die Spuren dazu passen. */
  finaleRegeln?: string;
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
    finaleRegeln = "",
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
- Der Drahtzieher wird höchstens beiläufig gestreift und wirkt dabei harmlos.${finaleRegeln}${
    besessenheit ? besessenheitsRegeln(besessenheit.wirt, besessenheit.daemon) : ""
  }${
    twist
      ? `\n- ${drahtzieherName} ist in diesem Fall NICHT anwesend und gehört nicht zur Besetzung. Was auf ihn deutet, taucht als Gegenstand, Geruch, Handschrift oder Aussage Dritter auf - nie als Person und nie unter seinem Namen.`
      : ""
  }`;
}
