import { auftrittVon, type SagaVorgaben } from "./sagaTypen";

/**
 * Niemand darf zu früh im Text stehen.
 *
 * Wer erst später auftritt - der Drahtzieher beim Twist, ein Nachzügler, der
 * Culprit eines Arcs -, darf vorher nirgends beim Namen genannt werden. Am
 * schlimmsten wäre es im Vorspann: Dort steht die Saga noch am Anfang, und ein
 * einziges Wort verrät alles.
 *
 * Bisher stand das nur als Bitte im Prompt. Das Modell hält sich fast immer
 * daran - aber "fast immer" reicht hier nicht. Deshalb prüft und säubert diese
 * Datei die Texte, bevor sie ausgeliefert werden, und der Vorspann prüft am
 * Ende noch einmal selbst.
 *
 * Gestrichen wird satzweise, nicht wortweise: Ein Satz, aus dem man einen Namen
 * herausschneidet, wird zu Unsinn ("… traf sich mit im Hafen"). Ein Satz, der
 * ganz fehlt, fällt niemandem auf.
 */

/** Kommt dieser Name im Text vor - als Wort, nicht als Silbe? */
export function nenntNamen(text: string, namen: string[]): string[] {
  if (!text) return [];
  return namen.filter((name) => {
    const sauber = name.trim();
    if (!sauber) return false;
    // Der Genitiv gehört dazu ("Nalas Schal" verrät Nala genauso), ein Name
    // mitten in einem anderen Wort dagegen nicht ("Bosswagen", "Nalabucht").
    const muster = new RegExp(
      `(^|[^\\p{L}])${sauber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:['’]?s)?(?![\\p{L}])`,
      "iu",
    );
    return muster.test(text);
  });
}

/**
 * Der Text ohne die Sätze, die einen dieser Namen nennen. Zeilen bleiben
 * Zeilen - der Erzähler zeigt sie einzeln.
 */
export function ohneNamen(text: string, namen: string[]): string {
  if (!text || namen.length === 0) return text;

  return text
    .split("\n")
    .map((zeile) =>
      // Satzzeichen bleiben am Satz: sonst endet die Zeile ohne Punkt.
      (zeile.match(/[^.!?…]+[.!?…]*\s*/gu) ?? [zeile])
        .filter((satz) => nenntNamen(satz, namen).length === 0)
        .join("")
        .trim(),
    )
    .filter((zeile) => zeile.length > 0)
    .join("\n");
}

/** Einzelne Wörter - Schlagworte des Vorspanns - ohne die verräterischen. */
export const worteOhneNamen = (worte: string[], namen: string[]): string[] =>
  worte.filter((wort) => nenntNamen(wort, namen).length === 0);

/**
 * Eine Überschrift lässt sich nicht satzweise kürzen. Nennt sie jemanden zu
 * früh, ist sie unbrauchbar - dann kommt "" zurück und der Aufrufer nimmt
 * seinen eigenen Titel.
 */
export const titelOhneNamen = (titel: string, namen: string[]): string =>
  nenntNamen(titel, namen).length === 0 ? titel : "";

/**
 * Wendungen, mit denen ein Text jemanden als den Kopf hinter allem ausweist.
 *
 * Sie allein sind harmlos - erst zusammen mit einem Namen wird daraus die
 * Auflösung, und die gehört ins Finale. "Jemand zieht die Fäden" darf also
 * stehen bleiben, "Mikkeli zieht die Fäden" nicht.
 */
const ENTTARNUNG = [
  /hinter allem/i,
  /dahinter\s?steck/i,
  /steckt dahinter/i,
  /drahtzieher/i,
  /strippenzieher/i,
  /hintermann/i,
  /zieht die fäden/i,
  /fäden (in der hand|zusammen)/i,
  /auftraggeber/i,
  /der kopf (der|hinter|des)/i,
  /alles (gesteuert|geplant|eingefädelt)/i,
  /war es die ganze zeit/i,
  /die ganze zeit über/i,
];

/**
 * Der Text ohne die Sätze, die diesen Namen als den Verantwortlichen
 * ausweisen.
 *
 * Anteasern ist erwünscht - das ist die halbe Saga. Aber das Modell schreibt
 * gern "Und dahinter steckte Mikkeli", und dann ist die Reihe vorbei, bevor
 * sie begonnen hat. Gestrichen wird nur, wo Name und Enttarnung im selben
 * Satz stehen; alles andere bleibt, auch der Name für sich.
 */
export function ohneEnttarnung(text: string, name: string): string {
  if (!text || !name.trim()) return text;

  return text
    .split("\n")
    .map((zeile) =>
      (zeile.match(/[^.!?…]+[.!?…]*\s*/gu) ?? [zeile])
        .filter(
          (satz) =>
            nenntNamen(satz, [name]).length === 0 ||
            !ENTTARNUNG.some((muster) => muster.test(satz)),
        )
        .join("")
        .trim(),
    )
    .filter((zeile) => zeile.length > 0)
    .join("\n");
}

/**
 * Wer zu diesem Zeitpunkt noch nicht aufgetreten ist.
 *
 * `kapitel` ist die Nummer des Kapitels, das gleich kommt; 0 steht für alles
 * davor - Vorspann und Auftakt. Der Detektiv zählt nie mit.
 */
export function nochNichtDa<T extends { id: string; name: string; istDetektiv: boolean }>(args: {
  besetzung: T[];
  drahtzieherId: string;
  vorgaben: Pick<SagaVorgaben, "twist" | "neuzugaenge" | "kapitelAnzahl">;
  kapitel: number;
}): T[] {
  const { besetzung, drahtzieherId, vorgaben, kapitel } = args;
  // Vor dem ersten Kapitel (kapitel 0) gilt dieselbe Schwelle wie in Kapitel 1:
  // "später" heißt hier, dass jemand nicht von Anfang an dabei ist.
  const schwelle = Math.max(1, kapitel);
  return besetzung.filter(
    (c) =>
      !c.istDetektiv &&
      auftrittVon({ charakterId: c.id, vorgaben, drahtzieherId }) > schwelle,
  );
}

/** Dieselbe Frage, aber nur mit dem, was der Browser wissen darf. */
export function spaeteNamen<T extends { id: string; name: string; istDetektiv: boolean }>(args: {
  besetzung: T[];
  vorgaben: Pick<SagaVorgaben, "twist" | "neuzugaenge" | "kapitelAnzahl">;
  kapitel: number;
}): string[] {
  // Ohne Drahtzieher-Id: Wer der ist, erfährt der Browser nicht - der Twist
  // wird schon auf dem Server aus den Texten gehalten.
  return nochNichtDa({ ...args, drahtzieherId: "" }).map((c) => c.name);
}
