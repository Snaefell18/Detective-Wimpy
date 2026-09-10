/**
 * Die Beweismitteltasche.
 *
 * Bisher landete jeder Fund automatisch im Inventar und war am Ende einfach
 * da. Jetzt ist jeder Fund eine Entscheidung: Nimmt Wimpy das Stück mit oder
 * lässt er es liegen? In die Tasche passen sechs Stücke, und sie gilt für
 * eine ganze Saga - was in Kapitel eins hineinwandert, liegt im Finale noch
 * darin. Wer später etwas Besseres findet, muss dafür etwas wegwerfen.
 *
 * Vor Gericht zählt ausschließlich, was in der Tasche liegt. Alles, was man
 * liegen gelassen hat, steht nur noch im Notizbuch - man weiß dann davon,
 * kann es aber nicht mehr vorlegen.
 *
 * Was ein Stück wirklich beweist, steht nie im Browser: Es reist als Siegel
 * mit, das nur der Server öffnen kann.
 */

/** Wie viele Beweismittel in die Tasche passen. */
export const TASCHE_MAX = 6;

/** Ein Beweismittel, wie es der Spieler sieht. */
export type Beweismittel = {
  /** Die Item-Id der Spur - innerhalb einer Saga eindeutig. */
  id: string;
  name: string;
  /** Pfad zum Bild - leer heißt: Platzhalter. */
  bild: string;
  /** Was Wimpy gesehen hat. Nie, was es beweist. */
  beobachtung: string;
  /** Woher es stammt: "Kapitel 2 · Am Hafen". */
  herkunft: string;
  /**
   * Der versiegelte Kern - Bedeutung, Richtung, Irrweg. Nur der Server liest
   * ihn, und nur er entscheidet damit, ob ein Stück vor Gericht trägt.
   *
   * Leer heißt: Das Stück stammt aus einem älteren Fall, der noch keine
   * Siegel mitgab. Es lässt sich vorlegen, aber das Gericht kann nur nach
   * dem urteilen, was draufsteht.
   */
  siegel: string;
  /** Wann es aufgenommen wurde - hält die Reihenfolge stabil. */
  seit: number;
};

/**
 * Der versiegelte Kern eines Beweismittels.
 *
 * Er wird beim Fund erzeugt und nie wieder angefasst. Dass er die Bedeutung
 * schon beim Fund enthält, kostet nichts: Sie steht ohnehin im Fall - hier
 * wird sie nur so verpackt, dass die Verhandlung sie später ohne den ganzen
 * Fall lesen kann.
 */
export type BeweismittelKern = {
  id: string;
  name: string;
  beobachtung: string;
  /** Was der Fund wirklich beweist. */
  bedeutung: string;
  /** Auf wen er zeigt - kann in die Irre führen. */
  zeigtAufCharakterId: string;
  fuehrtInDieIrre: boolean;
  /** Ort und Fall, aus dem er stammt. */
  herkunft: string;
};

/** Liegt dieses Stück schon in der Tasche? */
export const inTasche = (inhalt: Beweismittel[], id: string): boolean =>
  inhalt.some((m) => m.id === id);

/** Wie viel Platz noch ist. */
export const taschePlatz = (inhalt: Beweismittel[]): number =>
  Math.max(0, TASCHE_MAX - inhalt.length);

/** Ist die Tasche voll? */
export const tascheVoll = (inhalt: Beweismittel[]): boolean => taschePlatz(inhalt) === 0;

/**
 * Ein Stück aufnehmen.
 *
 * Gibt die neue Tasche zurück - oder dieselbe, wenn es nicht geht. Genau drei
 * Fälle:
 *
 *   - Das Stück liegt schon darin: nichts passiert.
 *   - Es ist Platz: es kommt hinten dazu.
 *   - Die Tasche ist voll: nur mit `statt` - dann fliegt jenes Stück heraus.
 *
 * Ohne `statt` bei voller Tasche bleibt alles, wie es war. Der Bildschirm
 * fragt in diesem Fall vorher, was weichen soll; still etwas wegzuwerfen
 * wäre das Letzte, was man will.
 */
export function aufnehmen(
  inhalt: Beweismittel[],
  mittel: Beweismittel,
  statt?: string,
): Beweismittel[] {
  if (!mittel?.id) return inhalt;
  if (inTasche(inhalt, mittel.id)) return inhalt;

  const ohne = statt ? inhalt.filter((m) => m.id !== statt) : inhalt;
  // Hat `statt` nichts getroffen und ist die Tasche voll, wird nichts getauscht.
  if (ohne.length >= TASCHE_MAX) return inhalt;
  return [...ohne, mittel];
}

/** Ein Stück wegwerfen. */
export const wegwerfen = (inhalt: Beweismittel[], id: string): Beweismittel[] =>
  inhalt.filter((m) => m.id !== id);

/**
 * Die Herkunftszeile eines Fundes.
 *
 * Innerhalb einer Saga zählt das Kapitel mit - im Gerichtssaal liegen Stücke
 * aus fünf Kapiteln nebeneinander, und wo etwas herkam, ist dort die halbe
 * Erinnerung. `kapitel` ist die Nummer (1-basiert), 0 heißt Finale, und
 * ohne Saga bleibt es beim Ort.
 */
export function herkunftsZeile(ort: string, kapitel?: number | null): string {
  const wo = ort.trim();
  if (kapitel === undefined || kapitel === null) return wo;
  const teil = kapitel > 0 ? `Kapitel ${kapitel}` : "Finale";
  return wo ? `${teil} · ${wo}` : teil;
}

/**
 * Aus einem Fund ein Beweismittel machen.
 *
 * Die Zeit kommt von außen, damit sich das Ganze testen lässt und zwei
 * Aufnahmen in derselben Millisekunde nicht dieselbe Reihenfolge bekommen.
 */
export function mittelAusFund(
  spur: {
    itemId: string;
    name: string;
    bild?: string | null;
    beobachtung: string;
    herkunft?: string | null;
    siegel?: string | null;
  },
  herkunft: string,
  seit = Date.now(),
): Beweismittel {
  return {
    id: spur.itemId,
    name: spur.name,
    bild: spur.bild ?? "",
    beobachtung: spur.beobachtung ?? "",
    herkunft: herkunft || (spur.herkunft ?? ""),
    siegel: spur.siegel ?? "",
    seit,
  };
}
