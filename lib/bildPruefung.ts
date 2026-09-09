"use client";

/**
 * Nachsehen, ob ein erzeugtes Bild wirklich freigestellt ist.
 *
 * Die Schnittstelle bekommt "background: transparent" mitgeschickt, und im
 * Auftrag steht es gleich zweimal - trotzdem malt ein Bildmodell hin und
 * wieder eine Fläche hinter die Figur. Zusichern lässt sich das also nicht;
 * nachsehen schon. Wer das Ergebnis kennt, kann es einfach noch einmal
 * versuchen, statt es später im Spiel als graues Rechteck zu entdecken.
 *
 * Geprüft wird der Rand, nicht die Mitte: Ein Tier steht mittig im Bild, der
 * Rand gehört zum Hintergrund.
 */

/** Ab welchem Alphawert ein Bildpunkt als undurchsichtig gilt. */
const DECKEND = 24;
/** Wie viel vom Rand undurchsichtig sein darf, bevor es auffällt. */
const ERLAUBT = 0.12;

export type Freistellung = {
  /** Ist der Rand überwiegend durchsichtig? */
  freigestellt: boolean;
  /** Anteil deckender Randpunkte, 0 bis 1 - für die Meldung. */
  anteil: number;
};

/**
 * Sieht sich den Rand eines Bildes an. Kann der Browser das Bild nicht
 * lesen, gilt es als in Ordnung: Eine Warnung ins Blaue hinein wäre
 * schlimmer als keine.
 */
export async function pruefeFreistellung(dataUrl: string): Promise<Freistellung> {
  try {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const bitmap = await createImageBitmap(blob);
    try {
      // Klein genug, dass das Zählen nichts kostet - für den Rand reicht das.
      const kante = 96;
      const canvas = document.createElement("canvas");
      canvas.width = kante;
      canvas.height = kante;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return { freigestellt: true, anteil: 0 };
      ctx.drawImage(bitmap, 0, 0, kante, kante);
      const { data } = ctx.getImageData(0, 0, kante, kante);

      let rand = 0;
      let deckend = 0;
      for (let y = 0; y < kante; y++) {
        for (let x = 0; x < kante; x++) {
          // Nur der äußere Ring, zwei Bildpunkte breit.
          const amRand = x < 2 || y < 2 || x >= kante - 2 || y >= kante - 2;
          if (!amRand) continue;
          rand++;
          if (data[(y * kante + x) * 4 + 3] > DECKEND) deckend++;
        }
      }

      const anteil = rand === 0 ? 0 : deckend / rand;
      return { freigestellt: anteil <= ERLAUBT, anteil };
    } finally {
      bitmap.close();
    }
  } catch {
    return { freigestellt: true, anteil: 0 };
  }
}
