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
  kapitelStaedte: [],
  stadt: "zufall",
  staedteWechseln: true,
  charaktere: [],
  items: [],
  drahtzieherId: "",
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
};
