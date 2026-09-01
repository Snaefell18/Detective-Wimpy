export type CharacterStats = {
  charisma: number;
  freundlichkeit: number;
  fitness: number;
  zauberkraft: number;
  schelmischkeit: number;
  kriminalitaetslevel: number;
  intelligenz: number;
};

/**
 * Wer mit wem kann. Die Listen enthalten Charakter-Ids und wirken sich im
 * Spiel aus: Beste Freunde werden gedeckt, Erzfeinde angeschwärzt.
 */
export type Beziehungen = {
  besteFreunde: string[];
  freunde: string[];
  feinde: string[];
  erzfeinde: string[];
};

export const LEERE_BEZIEHUNGEN: Beziehungen = {
  besteFreunde: [],
  freunde: [],
  feinde: [],
  erzfeinde: [],
};

export type Character = {
  id: string;
  nummer: number;
  name: string;
  tierart: string;
  alter: number;
  stats: CharacterStats;
  beschreibung: string;
  /** Pfad im Ordner /public/charaktere */
  bild: string;
  istDetektiv: boolean;
  /**
   * Was dieses Tier beruflich macht - freier Text ("Bäckerin", "Nachtwächter
   * am Hafen"). Färbt Alibis, Spuren und Gesprächsthemen. Leer heißt: das
   * Modell denkt sich etwas Passendes aus.
   */
  beruf?: string;
  /**
   * Wie dieses Tier redet und sich benimmt - freier Text, der im Gespräch
   * wörtlich befolgt wird ("spricht in kurzen Sätzen und nennt Wimpy immer
   * 'Chef'"). Leer heißt: nur die Werte und die Beschreibung zählen.
   */
  sprachstil?: string;
  /** Freundschaften und Feindschaften - optional, ältere Daten haben sie nicht. */
  beziehungen?: Beziehungen;
};

export type Location = {
  id: string;
  /** Stadt, in der dieser Ort liegt (z.B. "Venedig"). */
  stadt: string;
  stadtId: string;
  name: string;
  /** Die Atmosphäre aus der Tabelle - sie färbt Beschreibungen und Dialoge. */
  atmosphaere: string;
  beschreibung: string;
  /** Pfad im Ordner /public/orte */
  bild: string;
};

/** Eine Stadt mit ihren Schauplätzen. */
export type City = {
  id: string;
  name: string;
  orte: Location[];
};

export type Item = {
  id: string;
  name: string;
  beschreibung: string;
  /** Pfad im Ordner /public/items */
  bild: string;
};

/** Der Modus, in dem Wimpy einen Charakter anspricht. */
export type TalkMode = "reden" | "befragen" | "beschuldigen";

export type ChatTurn = {
  role: "wimpy" | "character";
  text: string;
  mode?: TalkMode;
};

/** Im Admin-Menü einstellbar. */
export type Einstellungen = {
  /** Wie viele Beschuldigungen der Spieler pro Fall hat. */
  beschuldigungen: number;
  /** Verdachtswert, mit dem jeder Verdächtige startet. */
  startverdacht: number;
  /** Erzählton, den Claude anschlägt. */
  ton: "kindgerecht" | "spannend" | "albern";
  /** Stadt, in der gespielt wird - "zufall" würfelt bei jedem Fall neu. */
  stadt: string;
  /** Wie viele Schauplätze ein Fall hat. */
  ortsAnzahl: number;
  /** Intro mit Titelmusik vor jeder Runde. */
  intro: boolean;
};

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  beschuldigungen: 2,
  startverdacht: 20,
  ton: "kindgerecht",
  stadt: "zufall",
  ortsAnzahl: 5,
  intro: true,
};

/** Für wen der Fall gedacht ist - steuert, wie hart er erzählt werden darf. */
export type Reifegrad = "kindgerecht" | "jugendlich" | "erwachsen";

/** Wie weit sich der Fall von der Wirklichkeit entfernen darf. */
export type Absurditaet = "bodenstaendig" | "verspielt" | "absurd";

/** Alles, was der Fall vorgibt. Wird beim Start einmal erzeugt. */
export type CaseFile = {
  id: string;
  /** Die Charaktere, mit denen dieser Fall gespielt wird (inkl. Admin-Änderungen). */
  besetzung: Character[];
  /** Die Gegenstände, aus denen die Spuren dieses Falls stammen. */
  items: Item[];
  /** Erzählton für diesen Fall. */
  ton: Einstellungen["ton"];
  /** Für welches Publikum dieser Fall erzählt wird. */
  reifegrad: Reifegrad;
  /** Wie schräg dieser Fall sein darf. */
  absurditaet: Absurditaet;
  /** Die Stadt, in der dieser Fall spielt. */
  stadt: string;
  /** Die Schauplätze dieses Falls (Standard: fünf). */
  orte: Location[];
  /** Kurzer Prolog-Text, der vor dem Intro eingeblendet wird. */
  introText: string;
  /** Schlagworte, die im Intro einzeln aufblitzen. */
  schlagworte: string[];
  titel: string;
  tatbeschreibung: string;
  tatort: string; // Location-Id
  /** Wird zufällig gezogen - der Spieler darf das nie zu sehen bekommen. */
  taeterId: string;
  motiv: string;
  tathergang: string;
  /** Pro Verdächtigem: Alibi, Geheimnis und wo er/sie gerade ist. */
  verdaechtige: SuspectBrief[];
  /** Gegenstände, die im Spiel gefunden werden können. */
  spuren: CaseClue[];
  erstelltAm: number;
};

export type SuspectBrief = {
  charakterId: string;
  aufenthaltsort: string; // Location-Id
  alibi: string;
  geheimnis: string;
  /** true, wenn das Alibi gelogen ist. */
  alibiIstGelogen: boolean;
};

export type CaseClue = {
  itemId: string;
  ortId: string;
  /** Was der Fund über den Fall verrät. */
  bedeutung: string;
  /** Auf wen der Hinweis zeigt (kann in die Irre führen). */
  zeigtAufCharakterId: string;
  fuehrtInDieIrre: boolean;
};

export type Notebook = {
  gefundeneSpuren: string[]; // itemIds
  notizen: NotebookEntry[];
  besuchteOrte: string[];
  befragteCharaktere: string[];
};

export type NotebookEntry = {
  id: string;
  text: string;
  quelle: string;
  zeitpunkt: number;
};

export type GameState = {
  version: number;
  fall: CaseFile | null;
  ortId: string;
  notizbuch: Notebook;
  verlauf: Record<string, ChatTurn[]>; // charakterId -> Chat
  verdachtspunkte: Record<string, number>; // charakterId -> 0..100
  beschuldigungenUebrig: number;
  status: "laeuft" | "gewonnen" | "verloren";
  ergebnis: string | null;
};

/** Antwort der Claude-API auf ein Gespräch. */
export type TalkResult = {
  antwort: string;
  stimmung: "freundlich" | "nervös" | "genervt" | "ausweichend" | "panisch" | "amüsiert";
  neueNotiz: string | null;
  gefundeneSpurItemId: string | null;
  verdachtsaenderung: number;
  luegt: boolean;
};

export type AccuseResult = {
  richtig: boolean;
  aufloesung: string;
  reaktion: string;
};

/** Der Teil des Falls, den der Browser sehen darf (ohne Täter, Motiv, Alibis). */
export type PublicCase = {
  id: string;
  /** Die Besetzung dieses Falls - der Browser braucht sie für die Anzeige. */
  besetzung: Character[];
  /** Stadt und Schauplätze dieses Falls. */
  stadt: string;
  orte: Location[];
  /** Kurzer Prolog-Text, der vor dem Intro eingeblendet wird. */
  introText: string;
  /** Schlagworte, die im Intro einzeln aufblitzen. */
  schlagworte: string[];
  titel: string;
  tatbeschreibung: string;
  tatort: string;
  /** charakterId -> ortId, damit man weiß, wen man wo antrifft. */
  aufenthalt: Record<string, string>;
  erstelltAm: number;
};

/**
 * Ein vorgenerierter Fall in der Datenbank ("Kampagne").
 *
 * Enthält alles, was der Browser zeigen darf, plus das Siegel - den
 * verschlüsselten Fall, den nur der Server lesen kann.
 */
export type Kampagne = {
  id: string;
  /** Anzeigename in der Kampagnen-Liste. */
  name: string;
  fall: PublicCase;
  siegel: string;
  /** Womit dieser Fall erzeugt wurde (Thema, Stadt, Tiere ...). */
  vorgaben: Vorgaben | null;
  erstelltAm: number;
};

/** Wünsche an einen neuen Fall, die im Admin eingegeben werden. */
export type Vorgaben = {
  /** Freitext: worum soll es gehen? */
  thema: string;
  /** Stadt-Id oder "zufall". */
  stadt: string;
  /** Charakter-Ids, die vorkommen sollen (leer = alle). */
  charaktere: string[];
  /** Item-Ids, die als Spuren auftauchen sollen (leer = freie Wahl). */
  items: string[];
  /** Wer der Täter sein soll - leer heißt: zufällig. */
  taeterId: string;
  /** Wie knifflig der Fall sein soll. */
  schwierigkeit: "leicht" | "mittel" | "knifflig";
  /** Für welches Publikum erzählt wird. */
  reifegrad: Reifegrad;
  /** Wie schräg der Fall sein darf. */
  absurditaet: Absurditaet;
};

export const STANDARD_VORGABEN: Vorgaben = {
  thema: "",
  stadt: "zufall",
  charaktere: [],
  items: [],
  taeterId: "",
  schwierigkeit: "mittel",
  reifegrad: "kindgerecht",
  absurditaet: "verspielt",
};
