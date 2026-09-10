import type { FinaleArt } from "./sagaFinale";

/**
 * Die Anhörung: der Gerichtssaal als Gespräch zu dritt.
 *
 * Bisher legte Wimpy stumm Beweisstücke auf den Tisch und bekam pro Stück
 * einen Satz zurück. Jetzt wird verhandelt: Wimpy fragt, der Angeklagte
 * antwortet, Öhö sitzt dabei, fragt selbst nach und urteilt, sobald er
 * überzeugt ist. Beweismittel sind darin keine Automaten mehr, sondern
 * Argumente - man legt sie im richtigen Moment vor und redet darüber.
 *
 * Zwei Werte tragen die Szene:
 *
 *   Überzeugung - wie weit das Gericht ist. Bei 100 ist es entschieden.
 *   Geduld      - wie lange Öhö das noch mitmacht. Bei 0 schließt er die Akte.
 *
 * Beide bewegen sich nur über die Antwort des Servers, und der klammert
 * jeden Wert erst ein (siehe `geklammert`): Ein Ausrutscher des Modells darf
 * eine Verhandlung nicht in einem einzigen Zug entscheiden.
 */

/** Wer im Saal spricht. */
export type AnhoerungRolle = "wimpy" | "angeklagter" | "richter";

export type AnhoerungZug = {
  rolle: AnhoerungRolle;
  text: string;
  /** Nur bei Wimpy: das Beweismittel, das er zu diesem Satz vorgelegt hat. */
  mittelId?: string;
};

/** Wie überzeugt das Gericht sein muss. */
export const UEBERZEUGT = 100;

/** Wie viele fruchtlose Züge Öhö mitmacht. */
export const GEDULD = 6;

/**
 * Wie weit ein einzelner Zug tragen kann.
 *
 * Mit einem vorgelegten Beweismittel weit, durch bloßes Fragen nur ein
 * Stück: Reden allein soll eine Verhandlung nicht gewinnen, sonst wäre die
 * Tasche Zierde. Ganz ohne Beweise bleibt sie trotzdem zu schaffen - es
 * braucht dann eben sieben gute Fragen statt drei starker Stücke.
 */
export const MIT_BEWEIS_MAX = 45;
export const OHNE_BEWEIS_MAX = 15;
/** So weit kann ein Zug nach hinten losgehen. */
export const RUECKSCHLAG_MAX = 15;

export type AnhoerungStand = {
  verlauf: AnhoerungZug[];
  /** 0 bis 100. */
  ueberzeugung: number;
  /** Was von Öhös Geduld übrig ist. */
  geduld: number;
  /** Welche Beweismittel schon auf dem Tisch liegen. */
  vorgelegt: string[];
  /** Hat der Angeklagte gestanden? */
  gestaendnis: boolean;
};

export const LEERE_ANHOERUNG: AnhoerungStand = {
  verlauf: [],
  ueberzeugung: 0,
  geduld: GEDULD,
  vorgelegt: [],
  gestaendnis: false,
};

/** Was der Server zu einem Zug zurückgibt - schon eingeklammert. */
export type AnhoerungAntwort = {
  /** Was der Angeklagte sagt - leer heißt: er schweigt. */
  angeklagter: string;
  /** Was Öhö sagt - leer heißt: er schweigt. */
  richter: string;
  /** Wie viel weiter das Gericht ist. */
  plus: number;
  /** Wie viel Geduld dieser Zug gekostet hat. */
  geduldMinus: number;
  /** Der Angeklagte bricht ein - gilt nur, wenn das Maß damit auch voll ist. */
  gestaendnis: boolean;
};

const zahl = (wert: unknown): number => {
  const n = Number(wert);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const kappen = (wert: number, min: number, max: number) =>
  Math.max(min, Math.min(max, wert));

/**
 * Die Rohantwort des Modells in verlässliche Grenzen bringen.
 *
 * Das ist die einzige Stelle, an der aus einer Modellzahl ein Spielwert
 * wird - und sie ist absichtlich streng: Ohne vorgelegtes Beweismittel geht
 * es nur langsam voran, und ein Zug, der etwas gebracht hat, kostet niemals
 * Geduld.
 */
export function geklammert(
  roh: {
    angeklagter?: unknown;
    richter?: unknown;
    ueberzeugungPlus?: unknown;
    geduldMinus?: unknown;
    gestaendnis?: unknown;
  },
  mitBeweis: boolean,
): AnhoerungAntwort {
  const plus = kappen(
    zahl(roh.ueberzeugungPlus),
    -RUECKSCHLAG_MAX,
    mitBeweis ? MIT_BEWEIS_MAX : OHNE_BEWEIS_MAX,
  );
  return {
    angeklagter: String(roh.angeklagter ?? "").trim(),
    richter: String(roh.richter ?? "").trim(),
    plus,
    // Wer etwas erreicht hat, zehrt nicht an der Geduld.
    geduldMinus: plus > 0 ? 0 : kappen(zahl(roh.geduldMinus), 0, 2),
    gestaendnis: roh.gestaendnis === true,
  };
}

/**
 * Einen Zug verrechnen.
 *
 * `zuege` sind die Sätze, die dieser Zug in den Saal bringt - Wimpys eigener
 * zuerst, dann was Angeklagter und Vorsitz darauf sagen. Ein Geständnis gilt
 * nur, wenn das Gericht damit auch wirklich überzeugt ist: Sonst stünde
 * mitten in der Verhandlung ein "Ich war es" ohne Urteil dahinter.
 */
export function verrechnen(
  stand: AnhoerungStand,
  antwort: AnhoerungAntwort,
  zuege: AnhoerungZug[],
  /** Das Stück, das in diesem Zug vorgelegt wurde. */
  mittelId?: string,
): AnhoerungStand {
  const ueberzeugung = kappen(stand.ueberzeugung + antwort.plus, 0, UEBERZEUGT);
  return {
    verlauf: [...stand.verlauf, ...zuege],
    ueberzeugung,
    geduld: Math.max(0, stand.geduld - antwort.geduldMinus),
    vorgelegt:
      mittelId && !stand.vorgelegt.includes(mittelId)
        ? [...stand.vorgelegt, mittelId]
        : stand.vorgelegt,
    gestaendnis: stand.gestaendnis || (antwort.gestaendnis && ueberzeugung >= UEBERZEUGT),
  };
}

/** Läuft die Anhörung noch - oder ist sie entschieden? */
export function anhoerungsErgebnis(
  stand: AnhoerungStand,
): "laeuft" | "gewonnen" | "verloren" {
  if (stand.ueberzeugung >= UEBERZEUGT) return "gewonnen";
  if (stand.geduld <= 0) return "verloren";
  return "laeuft";
}

/**
 * Die Wörter der Anhörung.
 *
 * Dieselbe Mechanik, aber ein anderer Abend: Bei "kein Täter" arbeitet Wimpy
 * auf einen Freispruch hin, bei "Wimpy selbst" gegen sich.
 */
export function anhoerungsWorte(art: FinaleArt): {
  /** Über dem Balken. */
  maß: string;
  /** Was zu tun ist - steht als Hinweis über der Eingabe. */
  ziel: string;
  /** Der Knopf zum Vorlegen. */
  vorlegen: string;
  /** Wenn das Maß voll ist. */
  entschieden: string;
} {
  if (art === "ohne-taeter") {
    return {
      maß: "Zweifel des Gerichts",
      ziel: "Zeig dem Gericht, dass hier niemand schuldig ist.",
      vorlegen: "Vorlegen",
      entschieden: "Das Gericht ist überzeugt",
    };
  }
  if (art === "wimpy") {
    return {
      maß: "Beweislast",
      ziel: "Leg vor, was gegen dich spricht - und sag, was du getan hast.",
      vorlegen: "Gegen mich vorlegen",
      entschieden: "Das Gericht hat genug gehört",
    };
  }
  return {
    maß: "Überzeugung des Gerichts",
    ziel: "Frag nach, halt ihm vor, was du hast - und bring ihn zum Reden.",
    vorlegen: "Vorlegen",
    entschieden: "Das Gericht ist überzeugt",
  };
}
