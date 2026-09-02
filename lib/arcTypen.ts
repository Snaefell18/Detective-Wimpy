import { LEERER_ERZAEHLER, type Erzaehlerteil, type Saga } from "./sagaTypen";

/**
 * Ein Arc ist die Klammer über mehreren Sagen.
 *
 * Er bringt einen eigenen Titelsong mit und zwischen den Sagen jeweils einen
 * Erzählerteil - Text, auf Wunsch mit Tondatei. Am Ende steht ein großes
 * Finale; die Gerichtsverhandlung dafür kommt später, deshalb hält `finale`
 * die Art schon fest und zeigt bis dahin nur den Text.
 *
 * Wichtig: Ein Arc erzeugt keine eigenen Fälle. Er verweist auf Sagen, die
 * ganz normal in der Datenbank liegen und sich auch einzeln spielen lassen.
 * Deshalb muss ein Arc auch nicht am Stück entstehen - man legt ihn mit dem
 * Titelsong an, erzeugt die erste Saga und kann sofort losspielen. Die
 * übrigen Sagen kommen nach, während gespielt wird.
 */

/** Eine Station im Arc: erst der Erzähler, dann die Saga. */
export type ArcTeil = {
  /** 1-basiert, entspricht der Reihenfolge im Arc. */
  nummer: number;
  /** Überschrift der Station - steht auch da, solange die Saga fehlt. */
  name: string;
  /** Was vor dieser Saga erzählt wird. */
  erzaehler: Erzaehlerteil;
  /** Id der Saga in der Sammlung "sagen". Leer heißt: noch nicht erzeugt. */
  sagaId: string;
};

/** Wie der Arc endet. Gebaut ist bisher nur der Abschlusstext. */
export type ArcFinaleArt = "text" | "gerichtsverhandlung";

/**
 * Der eine, der hinter dem ganzen Arc steht.
 *
 * Er wird gleich am Anfang festgelegt, damit alle Sagen auf ihn zulaufen -
 * aufgedeckt wird er erst im Finale. In den Texten davor kommt er nur unter
 * seinem Wort vor ("Der Schattenkanzler war weiterhin auf der Flucht."), nie
 * unter seinem Namen; deshalb steht das Wort hier und nicht im Fließtext.
 */
export type ArcCulprit = {
  /** Charakter-Id. Leer heißt: steht noch nicht fest. */
  charakterId: string;
  /** Wie ihn die Texte nennen, solange er unerkannt ist. */
  wort: string;
};

export type Arc = {
  id: string;
  name: string;
  /** Beschreibung in der Auswahlliste. */
  klappentext: string;
  /**
   * Worauf der Arc hinausläuft - für die Erzeugung der Sagen. Steht nie im
   * Spiel, nur im Admin-Menü und in den Vorgaben ans Modell.
   */
  ziel: string;
  culprit: ArcCulprit;
  /**
   * Eigener Titelsong: Pfad in /public/audio. Leer heißt: der übliche
   * Titelsong des Spiels.
   */
  themeSong: string;
  /** Wie viele Sagen der Arc am Ende haben soll (1-10). */
  sagenAnzahl: number;
  teile: ArcTeil[];
  finale: {
    art: ArcFinaleArt;
    /** Der Abschluss nach der letzten Saga. */
    erzaehler: Erzaehlerteil;
  };
  erstelltAm: number;
};

/** Wo der Spieler in einem Arc gerade steht (liegt nur auf dem Gerät). */
export type ArcLauf = {
  arcId: string;
  /** 0-basiert: Index in teile[]. */
  teil: number;
  phase: "vorspann" | "erzaehler" | "saga" | "finale";
  /** Id der Saga, die gerade zu diesem Arc läuft. */
  sagaId: string | null;
  /** Nummern der abgeschlossenen Stationen. */
  geschafft: number[];
};

export const LEERER_ARC_TEIL = (nummer: number): ArcTeil => ({
  nummer,
  name: `Teil ${nummer}`,
  erzaehler: { ...LEERER_ERZAEHLER },
  sagaId: "",
});

export function leererArc(): Arc {
  return {
    id: "",
    name: "",
    klappentext: "",
    ziel: "",
    culprit: { charakterId: "", wort: "" },
    themeSong: "",
    sagenAnzahl: 3,
    teile: [LEERER_ARC_TEIL(1), LEERER_ARC_TEIL(2), LEERER_ARC_TEIL(3)],
    finale: { art: "text", erzaehler: { ...LEERER_ERZAEHLER } },
    erstelltAm: Date.now(),
  };
}

/**
 * Bringt die Teile auf die gewünschte Anzahl. Vorhandene bleiben erhalten -
 * niemand soll durch das Verstellen einer Zahl seine Texte verlieren.
 */
export function mitAnzahl(arc: Arc, anzahl: number): Arc {
  const ziel = Math.min(10, Math.max(1, Math.round(anzahl)));
  const teile = Array.from({ length: ziel }, (_, i) =>
    arc.teile[i] ? { ...arc.teile[i], nummer: i + 1 } : LEERER_ARC_TEIL(i + 1),
  );
  return { ...arc, sagenAnzahl: ziel, teile };
}

/** Die erste Station, deren Saga noch fehlt - dort geht das Erzeugen weiter. */
export const naechsteLuecke = (arc: Arc): ArcTeil | null =>
  arc.teile.find((t) => !t.sagaId) ?? null;

/** Wie viele Sagen schon stehen. */
export const fertigeTeile = (arc: Arc): number =>
  arc.teile.filter((t) => t.sagaId).length;

/**
 * Kann man den Arc schon spielen? Ja, sobald die erste Saga steht - der Rest
 * darf nachwachsen, während gespielt wird.
 */
export const spielbar = (arc: Arc): boolean => Boolean(arc.teile[0]?.sagaId);

/**
 * Die Saga zu einer Station, sofern sie schon in der Datenbank liegt.
 * Fehlt sie, ist der Arc an dieser Stelle (noch) zu Ende.
 */
export const sagaVon = (arc: Arc, teil: number, sagen: Saga[]): Saga | null => {
  const id = arc.teile[teil]?.sagaId;
  return id ? (sagen.find((s) => s.id === id) ?? null) : null;
};

/**
 * Das Überthema für die Saga einer Station.
 *
 * Es hält die Reihe zusammen, ohne dass man alles doppelt eintippen muss:
 * Klappentext des Arcs, wohin es läuft, der Text dieser Station - und die
 * Ansage zum Culprit. Die ist der eigentliche Trick: In allen Stationen außer
 * der letzten darf er nur unter seinem Wort vorkommen, im Finale fällt die
 * Maske.
 */
export function sagaAuftrag(arc: Arc, index: number): string {
  const letzte = index >= arc.teile.length - 1;
  const wort = arc.culprit.wort.trim();

  const stuecke = [
    arc.klappentext.trim(),
    arc.ziel.trim() && `Worauf alles hinausläuft: ${arc.ziel.trim()}`,
    arc.teile[index]?.erzaehler.text.trim(),
    wort &&
      (letzte
        ? `In dieser letzten Saga fällt die Maske: ${wort} steht am Ende selbst da.`
        : `Hinter allem steht ${wort}. In dieser Saga bleibt er ungesehen - er wird nur so genannt, nie enttarnt, und die Spuren führen bloß bis zu seinem Schatten.`),
  ];

  return stuecke.filter(Boolean).join("\n\n") || arc.name;
}

/**
 * Wer in der Saga einer Station mitspielen darf.
 *
 * Vor der letzten Station bleibt der Culprit draußen - sonst könnte man ihn
 * dort schon stellen, und das Finale wäre entwertet. Nur wenn ohne ihn zu
 * wenige Verdächtige übrig blieben, bleibt er drin: ein spielbarer Fall geht
 * vor der Inszenierung.
 */
export function besetzungFuerTeil(
  arc: Arc,
  index: number,
  verdaechtigenIds: string[],
): string[] {
  const letzte = index >= arc.teile.length - 1;
  if (letzte || !arc.culprit.charakterId) return [];

  const ohne = verdaechtigenIds.filter((id) => id !== arc.culprit.charakterId);
  return ohne.length >= 3 && ohne.length < verdaechtigenIds.length ? ohne : [];
}
