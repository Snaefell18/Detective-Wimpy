import type { Absurditaet, Reifegrad } from "./types";

/**
 * Neue Stammdaten erfinden lassen: ein Ding oder eine ganze Stadt.
 *
 * Beides ist Handwerk fürs Admin-Menü, nicht fürs Spiel: Es entsteht ein
 * Vorschlag, den man ansieht, ändert und erst dann speichert. Deshalb steht
 * hier auch kein Fall und keine Saga - nur die Welt, in der beides brauchbar
 * sein muss.
 */
const WELT = `Die Welt von "Detective Wimpy": eine Stadt, in der Tiere wie Menschen leben - sie wohnen, arbeiten, backen, streiten und lösen Fälle. Der Ton ist warmherzig und ein bisschen altmodisch, wie ein gutes Kinderhörspiel; nichts ist grausam, aber es darf spannend sein.`;

export function buildDingPrompt(args: {
  /** Was schon in der Datenbank steht - damit nichts doppelt kommt. */
  vorhanden: string[];
  /** Freier Wunsch aus dem Menü - leer heißt: völlig frei. */
  wunsch?: string;
  reifegrad?: Reifegrad;
  absurditaet?: Absurditaet;
}): string {
  const { vorhanden, wunsch } = args;

  return `Erfinde einen einzelnen Gegenstand für ein Detektivspiel.

${WELT}

WOFÜR
Der Gegenstand wird im Spiel als Fundstück ausgelegt: Wimpy findet ihn an einem Schauplatz, sieht ihn sich an und zieht daraus Schlüsse. Er muss also etwas sein, das herumliegen, jemandem gehören und etwas verraten kann.

ANFORDERUNGEN
- Ein Ding, kein Lebewesen, kein Ort, kein Ereignis.
- Etwas Handfestes, das in eine Tasche passt oder an einem Ort steht: ein Notizbuch, eine Taschenuhr, ein Schneebesen, eine Fahrkarte, ein Schlüsselbund, ein Regenschirm mit Monogramm.
- Der Name ist kurz und konkret (ein bis drei Wörter), so wie man es im Alltag nennen würde. Kein Artikel davor, keine Erklärung im Namen.
- Die Beschreibung sind ein bis zwei Sätze: was es ist, wie es aussieht, wozu es dient. Sie erzählt keine Geschichte und gehört zu keinem bestimmten Fall - dasselbe Ding muss in vielen Fällen brauchbar sein.
- Nichts Modernes, das aus der Zeit fällt (keine Handys, keine Computer), und nichts Gefährliches: keine Waffen, kein Blut, nichts Verletzendes.
- Kein Name eines Tieres, keiner Marke, keiner echten Person.
${
  vorhanden.length
    ? `\nDAS GIBT ES SCHON - erfinde etwas anderes:\n${vorhanden.slice(0, 120).join(", ")}`
    : ""
}${wunsch?.trim() ? `\n\nWUNSCH (unbedingt einhalten): ${wunsch.trim()}` : ""}

Antworte auf Deutsch.`;
}

export function buildStadtPrompt(args: {
  /** Wunschname der Stadt - leer heißt: denk dir einen aus. */
  stadt: string;
  /** Wie viele Schauplätze gebraucht werden. */
  anzahl: number;
  /** Städte, die es schon gibt. */
  vorhanden: string[];
  wunsch?: string;
}): string {
  const { stadt, anzahl, vorhanden, wunsch } = args;

  return `Erfinde eine Stadt für ein Detektivspiel und ${anzahl} Schauplätze darin.

${WELT}

DIE STADT
${
    stadt.trim()
      ? `Sie heißt: ${stadt.trim()}. Nimm den Namen genau so.`
      : "Denk dir einen Namen aus: ein Wort oder zwei, klingt wie eine echte Stadt, nicht wie ein Witz."
  }
${
    vorhanden.length
      ? `Diese Städte gibt es schon, sie soll anders sein als jede davon: ${vorhanden.slice(0, 40).join(", ")}.`
      : ""
  }

DIE SCHAUPLÄTZE
- Genau ${anzahl} Stück, alle in dieser einen Stadt.
- Sie sollen verschieden sein: nicht fünfmal dasselbe in anderer Farbe. Ein Ort zum Arbeiten, einer zum Wohnen, einer für Wasser oder Verkehr, einer, an dem man sich trifft, und einer, der ein bisschen unheimlich ist - so ungefähr.
- Jeder ist ein Ort, an dem etwas passieren und etwas liegen bleiben kann: eine Bäckerei, ein Fährhaus, ein Uhrenturm, ein Wintergarten, ein Trödelmarkt, ein Heizungskeller.
- name: kurz und konkret, wie man den Ort nennt ("Die Alte Bäckerei", "Hafenschuppen 3").
- atmosphaere: drei bis sechs Wörter, die die Stimmung treffen ("warm, mehlig, immer zu voll"). Kein ganzer Satz.
- beschreibung: ein bis zwei Sätze, was man dort sieht und riecht. Nüchtern, ohne Handlung, ohne Tiere beim Namen - der Ort muss in jedem Fall taugen.
- Keine Namen von Tieren, keine Verbrechen, keine Leichen, nichts Blutiges.${
    wunsch?.trim() ? `\n\nWUNSCH (unbedingt einhalten): ${wunsch.trim()}` : ""
  }

Antworte auf Deutsch.`;
}
