export type CharacterStats = {
  charisma: number;
  freundlichkeit: number;
  fitness: number;
  zauberkraft: number;
  schelmischkeit: number;
  kriminalitaetslevel: number;
  intelligenz: number;
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
};

export type Location = {
  id: string;
  name: string;
  beschreibung: string;
  /** Pfad im Ordner /public/orte */
  bild: string;
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

/** Alles, was der Fall vorgibt. Wird beim Start einmal erzeugt. */
export type CaseFile = {
  id: string;
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
  titel: string;
  tatbeschreibung: string;
  tatort: string;
  /** charakterId -> ortId, damit man weiß, wen man wo antrifft. */
  aufenthalt: Record<string, string>;
  erstelltAm: number;
};
