import type {
  Absurditaet,
  Einstellungen,
  PublicCase,
  Reifegrad,
  Vorgaben,
} from "./types";

/**
 * Eine Saga ist eine Reihe von Fällen mit einem gemeinsamen Überthema, das
 * sich Kapitel für Kapitel enthüllt. Am Ende steht ein Finalfall, in dem der
 * Drahtzieher hinter allem gefunden werden muss.
 *
 * Der Drahtzieher und die Wahrheit hinter der Saga stehen nie im Klartext im
 * Browser: Sie liegen im "bogenSiegel" - verschlüsselt wie ein einzelner Fall
 * (siehe lib/seal.ts).
 *
 * Alles hier ist zusätzlich zu den bestehenden Kampagnen. Einzelne Fälle
 * funktionieren unverändert weiter.
 */

/** Ein gesprochener Zwischenteil: Text und - sobald hinterlegt - eine Datei. */
export type Erzaehlerteil = {
  text: string;
  /** Pfad in /public/audio, z.B. "/audio/saga-auftakt.mp3". Leer = nur Text. */
  audio: string;
};

export const LEERER_ERZAEHLER: Erzaehlerteil = { text: "", audio: "" };

/** Was im Admin-Menü für eine ganze Saga eingestellt wird. */
export type SagaVorgaben = {
  name: string;
  /** Das Überthema, das sich durch alle Kapitel zieht. */
  thema: string;
  /** Wie viele Fälle vor dem Finale. */
  kapitelAnzahl: number;
  /** Freitext je Kapitel - leer heißt: das Modell entscheidet. */
  kapitelWuensche: string[];
  /**
   * Täter je Kapitel als Charakter-Id, leer heißt: das Modell entscheidet.
   * Der Drahtzieher ist hier nie zulässig - er ist erst im Finale schuldig.
   */
  kapitelTaeter: string[];
  /**
   * Stadt je Kapitel: Stadt-Id, "zufall" oder leer für die allgemeine
   * Einstellung darunter. Das Finale steht an letzter Stelle.
   */
  kapitelStaedte: string[];
  /** Stadt-Id oder "zufall". */
  stadt: string;
  /** true: Jedes Kapitel darf in einer anderen Stadt spielen. */
  staedteWechseln: boolean;
  /** Charakter-Ids, die vorkommen sollen (leer = alle). */
  charaktere: string[];
  /** Item-Ids, die als Spuren auftauchen sollen. */
  items: string[];
  /** Wer hinter allem steckt - leer heißt: zufällig. */
  drahtzieherId: string;
  /**
   * Twist: Der Drahtzieher tritt in den Kapiteln überhaupt nicht auf - man
   * begegnet ihm nie, spricht nie mit ihm. Die Spuren führen trotzdem zu
   * ihm, nur eben über Eigenschaften statt über einen Namen. Erst im Finale
   * betritt er die Bühne, und der Erzählertext davor inszeniert genau das.
   */
  twist: boolean;
  /**
   * Wer wann dazustößt: Charakter-Id -> Kapitelnummer, ab der das Tier
   * mitspielt. 1 (oder gar kein Eintrag) heißt "von Anfang an", ein Wert
   * über der Kapitelanzahl heißt "erst im Finale". Wer einmal da ist,
   * bleibt bis zum Ende.
   */
  neuzugaenge: Record<string, number>;
  schwierigkeit: Vorgaben["schwierigkeit"];
  reifegrad: Reifegrad;
  absurditaet: Absurditaet;
  ton: Einstellungen["ton"];
  /** Schauplätze je Fall. */
  ortsAnzahl: number;
  /** Beschuldigungen je Fall. */
  beschuldigungen: number;
};

export const STANDARD_SAGA_VORGABEN: SagaVorgaben = {
  name: "",
  thema: "",
  kapitelAnzahl: 3,
  kapitelWuensche: [],
  kapitelTaeter: [],
  kapitelStaedte: [],
  stadt: "zufall",
  staedteWechseln: true,
  charaktere: [],
  items: [],
  drahtzieherId: "",
  twist: false,
  neuzugaenge: {},
  schwierigkeit: "mittel",
  reifegrad: "kindgerecht",
  absurditaet: "verspielt",
  ton: "kindgerecht",
  ortsAnzahl: 5,
  beschuldigungen: 2,
};

/** Ein Kapitel der Saga: ein Erzählerteil und danach ein Fall. */
export type SagaKapitel = {
  nummer: number;
  name: string;
  /** Anriss für die Übersicht - verrät nichts über den Drahtzieher. */
  teaser: string;
  erzaehler: Erzaehlerteil;
  /** Erst nach dem Erzeugen gefüllt. */
  fall: PublicCase | null;
  siegel: string | null;
};

/** Der Abschluss: Wer steckte hinter allem? */
export type SagaFinale = {
  erzaehler: Erzaehlerteil;
  /** Die Frage, die im Finale beantwortet werden muss. */
  frage: string;
  /** Wird nach dem Sieg eingeblendet. */
  epilog: Erzaehlerteil;
  fall: PublicCase | null;
  siegel: string | null;
};

export type Saga = {
  id: string;
  name: string;
  thema: string;
  /** Beschreibung in der Auswahlliste. */
  klappentext: string;
  vorgaben: SagaVorgaben;
  /** Einzelne Wörter, die im Vorspann aufblitzen. */
  schlagworte?: string[];
  auftakt: Erzaehlerteil;
  kapitel: SagaKapitel[];
  finale: SagaFinale;
  /** Der verschlüsselte Bogen: Drahtzieher, Wahrheit, Enthüllung je Kapitel. */
  bogenSiegel: string;
  erstelltAm: number;
};

/** Wo der Spieler in einer Saga gerade steht (liegt nur auf dem Gerät). */
export type SagaLauf = {
  sagaId: string;
  /** 0-basiert; entspricht dem Index in kapitel[]. */
  kapitel: number;
  phase:
    | "vorspann"
    | "auftakt"
    | "erzaehler"
    | "fall"
    | "finale-erzaehler"
    | "finale"
    | "epilog";
  /**
   * Id des Falls, der gerade zu dieser Saga läuft. Damit lässt sich ein
   * einzelner Fall zwischendurch spielen, ohne dass sein Ende die Saga
   * weiterschaltet.
   */
  fallId: string | null;
  /** Nummern der bereits gelösten Kapitel. */
  geloest: number[];
  /**
   * Wurde das Finale wirklich gelöst? Der Epilog kommt auch nach einer
   * verlorenen Finalrunde - dann aber ohne Siegermusik.
   */
  finaleGeschafft?: boolean;
};

/** Ab welchem Kapitel ein Tier mitspielt. Finale = kapitelAnzahl + 1. */
export function auftrittVon(args: {
  charakterId: string;
  vorgaben: Pick<SagaVorgaben, "twist" | "neuzugaenge" | "kapitelAnzahl">;
  drahtzieherId: string;
}): number {
  const { charakterId, vorgaben, drahtzieherId } = args;
  const finale = vorgaben.kapitelAnzahl + 1;

  // Der Twist ist die stärkere Ansage: Der Drahtzieher kommt erst zum Schluss.
  if (vorgaben.twist && charakterId === drahtzieherId) return finale;

  const gesetzt = vorgaben.neuzugaenge?.[charakterId];
  if (!Number.isFinite(gesetzt)) return 1;
  return Math.min(Math.max(1, Math.round(gesetzt as number)), finale);
}

/**
 * Wer in einem Saga-Fall mitspielt.
 *
 * Im Finale (kapitel 0) sind alle dabei - dort laufen die Fäden zusammen.
 * In den Kapiteln nur, wer schon aufgetreten ist: Wer einmal da war, bleibt
 * bis zum Ende. Bleiben so weniger als zwei Verdächtige übrig, rücken die
 * mit dem frühesten Auftritt nach - Spielbarkeit vor Inszenierung.
 */
export function besetzungFuerKapitel<T extends { id: string; istDetektiv: boolean }>(args: {
  besetzung: T[];
  drahtzieherId: string;
  kapitel: number;
  vorgaben: Pick<SagaVorgaben, "twist" | "neuzugaenge" | "kapitelAnzahl">;
}): T[] {
  const { besetzung, drahtzieherId, kapitel, vorgaben } = args;
  if (kapitel === 0) return besetzung;

  const auftritt = (c: T) =>
    auftrittVon({ charakterId: c.id, vorgaben, drahtzieherId });

  const dabei = besetzung.filter((c) => c.istDetektiv || auftritt(c) <= kapitel);
  const fehlen = 2 - dabei.filter((c) => !c.istDetektiv).length;
  if (fehlen <= 0) return dabei;

  // Wer nachrückt, wird nach dem frühesten Auftritt gewählt - der
  // Twist-Drahtzieher aber erst ganz zuletzt: Dass er in den Kapiteln nicht
  // vorkommt, ist die halbe Saga.
  const zurueckgestellt = (c: T) =>
    vorgaben.twist && c.id === drahtzieherId ? 1 : 0;
  const nachruecker = besetzung
    .filter((c) => !c.istDetektiv && !dabei.includes(c))
    .sort(
      (a, b) => zurueckgestellt(a) - zurueckgestellt(b) || auftritt(a) - auftritt(b),
    )
    .slice(0, fehlen);

  // Reihenfolge der Ausgangsbesetzung beibehalten.
  return besetzung.filter((c) => dabei.includes(c) || nachruecker.includes(c));
}

/** Wer in diesem Kapitel zum ersten Mal auftaucht. */
export function neuInKapitel<T extends { id: string; istDetektiv: boolean }>(args: {
  besetzung: T[];
  drahtzieherId: string;
  kapitel: number;
  vorgaben: Pick<SagaVorgaben, "twist" | "neuzugaenge" | "kapitelAnzahl">;
}): T[] {
  const { besetzung, drahtzieherId, kapitel, vorgaben } = args;
  const jetzt = besetzungFuerKapitel(args);
  if (kapitel === 1) return [];
  const vorher = besetzungFuerKapitel({
    besetzung,
    drahtzieherId,
    vorgaben,
    // Vor dem Finale steht das letzte Kapitel.
    kapitel: kapitel === 0 ? vorgaben.kapitelAnzahl : kapitel - 1,
  });
  return jetzt.filter((c) => !c.istDetektiv && !vorher.includes(c));
}

/**
 * Wer den Fall eines Kapitels begangen hat.
 *
 * Reihenfolge: Ein von Hand gesetzter Täter gewinnt - aber nur, wenn er in
 * diesem Kapitel überhaupt auftritt und nicht der Drahtzieher ist. Sonst der
 * Vorschlag des Modells, sonst reihum, damit nicht immer dasselbe Tier dran
 * ist. Zurück kommt immer jemand aus `moeglich`.
 */
export function kapitelTaeterFuer<T extends { id: string }>(args: {
  moeglich: T[];
  wunsch: string;
  vorschlag: string;
  nummer: number;
}): string {
  const { moeglich, wunsch, vorschlag, nummer } = args;
  return (
    moeglich.find((c) => c.id === wunsch)?.id ??
    moeglich.find((c) => c.id === vorschlag)?.id ??
    moeglich[(nummer - 1) % moeglich.length].id
  );
}
