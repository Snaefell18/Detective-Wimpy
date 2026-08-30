import { characterBrief } from "./characters";
import type { SagaVorgaben } from "./sagaTypen";
import type { Character, City } from "./types";

/**
 * Prompts für Sagas. Die Regeln zu Publikum und Absurdität kommen aus dem
 * Weltprompt (lib/prompts.ts) - hier steht nur, was über einen einzelnen Fall
 * hinausgeht.
 */

/** Der eine Aufruf, der den ganzen Bogen entwirft. */
export function buildBogenPrompt(
  besetzung: Character[],
  staedte: City[],
  drahtzieher: Character,
  vorgaben: SagaVorgaben,
): string {
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);

  const wuensche = vorgaben.kapitelWuensche
    .map((w, i) => (w.trim() ? `- Kapitel ${i + 1}: ${w.trim()}` : ""))
    .filter(Boolean)
    .join("\n");

  return `Entwirf den Bogen einer Saga für Detective Wimpy: ${vorgaben.kapitelAnzahl} Fälle hintereinander, die ein gemeinsames Überthema haben, und danach ein Finale.

DER DRAHTZIEHER STEHT BEREITS FEST: ${drahtzieher.name} [${drahtzieher.id}].
${characterBrief(drahtzieher)}
Er oder sie steckt hinter allem, taucht aber erst im Finale als Schuldiger auf. In den einzelnen Kapiteln bleibt das verborgen.

${vorgaben.thema ? `ÜBERTHEMA (unbedingt aufgreifen): ${vorgaben.thema}\n` : ""}
DIE TIERE
${verdaechtige.map((c) => `- [${c.id}] ${characterBrief(c)}`).join("\n")}

DIE STÄDTE
${staedte.map((s) => `- [${s.id}] ${s.name} (${s.orte.length} Schauplätze)`).join("\n")}

Anforderungen:
- Genau ${vorgaben.kapitelAnzahl} Kapitel, dann das Finale.
- Jedes Kapitel ist ein eigener, für sich lösbarer Fall - mit eigenem Täter aus der Liste. Der Drahtzieher darf in den Kapiteln NICHT der Täter sein.
- Die Kapiteltäter hängen mit dem Drahtzieher zusammen: erpresst, bezahlt, hereingelegt oder ahnungslos benutzt.
- Jedes Kapitel gibt genau ein Stück der Wahrheit preis (enthuellung). Zusammen ergeben sie das Bild, das im Finale den Drahtzieher überführt.
- Die Enthüllungen steigern sich: erst eine Kleinigkeit, am Ende etwas, das kaum noch anders zu deuten ist.
- Die Erzählertexte klingen wie eine Krimi-Ansage: kurze Zeilen, Atmosphäre, keine Anrede, kein "Kapitel 1".
- Der Klappentext verrät den Drahtzieher nicht.
- Alles auf Deutsch.
${wuensche ? `\nWÜNSCHE ZU EINZELNEN KAPITELN (unbedingt einhalten)\n${wuensche}` : ""}`;
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
