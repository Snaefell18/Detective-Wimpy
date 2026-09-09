/**
 * Detektiv-Zubehör: was Wimpy sich von seinem Lohn kauft.
 *
 * Ein Gegenstand besteht aus zwei Teilen: dem, was man im Admin-Menü frei
 * eintippt (Name, Beschreibung, Bild, Preis), und einer WIRKUNG aus einer
 * festen Liste. Das ist Absicht: Ein Effekt muss im Spiel wirklich etwas tun,
 * und dafür braucht es Code. Über das Admin-Menü lassen sich beliebig viele
 * Gegenstände anlegen - aber jeder greift auf eine Wirkung zurück, die es hier
 * gibt. Kommt eine neue Idee dazu, kommt sie hier hinein und steht sofort in
 * der Auswahlliste.
 *
 * Alles Gekaufte liegt auf dem Gerät, nicht in der Datenbank: Es ist der
 * Fortschritt eines Spielers, kein Inhalt des Spiels.
 */

/** Was ein Gegenstand bewirkt. */
export type Wirkung = "wahrheit" | "spuersinn" | "beschuldigung" | "hinweis";

export const WIRKUNGEN: {
  id: Wirkung;
  label: string;
  /** Wie es im Laden steht. */
  hinweis: string;
  /** Wo man es einsetzt - das entscheidet, wo der Gegenstand auftaucht. */
  wo: "gespraech" | "fall";
  /** Was beim Einsetzen im Spiel erscheint. */
  bestaetigung: string;
}[] = [
  {
    id: "wahrheit",
    label: "Wahrheit erzwingen",
    hinweis:
      "Beim nächsten Mal, wenn dieses Tier antwortet, kann es nicht lügen - es muss sagen, was wirklich war.",
    wo: "gespraech",
    bestaetigung: "Die nächste Antwort wird die Wahrheit sein.",
  },
  {
    id: "spuersinn",
    label: "Spürsinn schärfen",
    hinweis: "Das nächste Umsehen an einem Schauplatz findet garantiert etwas, wenn dort etwas liegt.",
    wo: "fall",
    bestaetigung: "Beim nächsten Umsehen entgeht dir nichts.",
  },
  {
    id: "beschuldigung",
    label: "Eine Beschuldigung mehr",
    hinweis: "Gibt dir in diesem Fall einen zusätzlichen Versuch, den Täter zu benennen.",
    wo: "fall",
    bestaetigung: "Du hast einen Versuch mehr.",
  },
  {
    id: "hinweis",
    label: "Ein Wort vom Wirt",
    hinweis:
      "Das Tier lässt im nächsten Satz etwas fallen, das weiterhilft - ohne den Fall zu lösen.",
    wo: "gespraech",
    bestaetigung: "Achte auf den nächsten Satz.",
  },
];

export const wirkungVon = (id: string | undefined) =>
  WIRKUNGEN.find((w) => w.id === id) ?? null;

/** Ein Gegenstand, wie er im Laden steht - kommt aus der Datenbank. */
export type Zubehoer = {
  id: string;
  name: string;
  beschreibung: string;
  /** Preis in Yen. */
  preis: number;
  /** Pfad in /public/items oder ein hinterlegtes Bild. */
  bild: string;
  wirkung: Wirkung;
  /** Aus dem Laden genommen, ohne es zu löschen. */
  versteckt?: boolean;
  erstelltAm: number;
};

export const LEERES_ZUBEHOER = (): Zubehoer => ({
  id: "",
  name: "",
  beschreibung: "",
  preis: 100,
  bild: "",
  wirkung: "wahrheit",
  versteckt: false,
  erstelltAm: Date.now(),
});

/**
 * Das Veritaserum steht immer im Laden - auch bevor jemand im Admin-Menü
 * etwas angelegt hat. So ist der Laden nie leer und die Wirkung sofort
 * erlebbar.
 */
export const VERITASERUM: Zubehoer = {
  id: "veritaserum",
  name: "Veritaserum",
  beschreibung:
    "Drei Tropfen in den Tee, und die nächste Antwort ist die Wahrheit - ob das Tier will oder nicht. Danach ist das Fläschchen leer.",
  preis: 300,
  bild: "/items/veritaserum.png",
  wirkung: "wahrheit",
  erstelltAm: 0,
};

/* --- Der Lohn ------------------------------------------------------- */

/** Was ein gelöster Einzelfall einbringt. */
export const LOHN_FALL = 100;
/** Was eine ganze Saga einbringt - obendrauf. */
export const LOHN_SAGA = 500;

/** „1.250 ¥“ - mit Punkt als Tausendertrennung, wie im Deutschen üblich. */
export const yen = (betrag: number): string => `${betrag.toLocaleString("de-DE")} ¥`;
