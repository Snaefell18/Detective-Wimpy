/**
 * Was der Bildgenerator zu hören bekommt.
 *
 * Reine Textbastelei und deshalb für sich prüfbar: Der Stil steht fest, alles
 * andere kommt aus dem Eintrag, den man im Admin-Menü ausgefüllt hat, plus
 * einem freien Feld für Wünsche ans Aussehen. So sehen alle Bilder wie aus
 * einem Guss aus, ohne dass man den Stil jedes Mal neu eintippen muss.
 */

export type BildArt = "charaktere" | "orte" | "items";

/**
 * Der Stil, der über allem steht - naiv, comichaft, warm.
 *
 * Er wird bewusst nicht aus dem Formular gefüttert: Ein Spiel, in dem jedes
 * Tier aus einer anderen Welt stammt, sieht zusammengewürfelt aus.
 */
export const STIL =
  "Naiver Comicstil, kindlich-freundliche Buchillustration: weiche runde Formen, " +
  "kräftige klare Konturlinien von gleichmäßiger Stärke, flächige warme Farben mit " +
  "sanften Verläufen, große ausdrucksvolle Augen, freundliche Gesichter, " +
  "leichte Textur wie von Buntstift. Keine Fotorealistik, kein 3D-Rendering, " +
  "keine harten Schlagschatten, keine Schrift, keine Buchstaben, keine Zahlen, " +
  "keine Sprechblasen, keine Rahmen und keine Bildunterschrift.";

/** Was je Art zusätzlich gilt - Bildausschnitt, Hintergrund, Haltung. */
const RAHMEN: Record<BildArt, string> = {
  charaktere:
    "Eine einzelne Figur, ganzer Körper von Kopf bis Fuß, aufrecht stehend, " +
    "zur Betrachterin gewandt, mittig im Bild, mit etwas Luft nach oben und unten. " +
    "Vollständig freigestellt vor durchsichtigem Hintergrund - kein Boden, " +
    "kein Schatten, keine Kulisse, nur die Figur.",
  orte:
    "Ein Schauplatz ohne Figuren: menschenleer, tierleer, niemand ist zu sehen. " +
    "Hochformat, als Blick in die Szene hinein, mit Tiefe und Vordergrund; " +
    "die untere Bildhälfte bleibt ruhig, damit später Text darüber lesbar ist.",
  items:
    "Ein einzelner Gegenstand, groß und mittig, leicht schräg von vorne, " +
    "vollständig im Bild. Freigestellt vor durchsichtigem Hintergrund - " +
    "kein Tisch, kein Boden, kein Schatten, nichts daneben.",
};

/** Das Bildformat je Art - so, wie das Spiel die Bilder zeigt. */
export const FORMAT: Record<BildArt, "1024x1536" | "1024x1024" | "1536x1024"> = {
  // Tiere und Schauplätze füllen im Spiel den hochkant gehaltenen Bildschirm.
  charaktere: "1024x1536",
  orte: "1024x1536",
  // Gegenstände stehen in quadratischen Kacheln - im Laden, in der Tasche,
  // im Fund-Moment.
  items: "1024x1024",
};

/** Vor durchsichtigem Hintergrund oder in einer vollen Kulisse? */
export const FREIGESTELLT: Record<BildArt, boolean> = {
  charaktere: true,
  orte: false,
  items: true,
};

/** Was aus dem Formular ins Bild einfließt - je Art andere Felder. */
export type BildEintrag = {
  name?: string;
  beschreibung?: string;
  /** Tiere. */
  tierart?: string;
  alter?: number;
  beruf?: string;
  /** Orte. */
  stadt?: string;
  atmosphaere?: string;
};

/** Eine Zeile "Was: Inhalt", aber nur, wenn Inhalt da ist. */
const zeile = (was: string, inhalt?: string | number): string =>
  inhalt === undefined || inhalt === null || String(inhalt).trim() === ""
    ? ""
    : `${was}: ${String(inhalt).trim()}`;

/**
 * Der fertige Auftrag ans Bildmodell.
 *
 * `wunsch` ist das freie Feld aus dem Formular und steht bewusst zuletzt: Was
 * dort steht, soll die Oberhand haben - außer über den Stil.
 */
export function bildAuftrag(
  art: BildArt,
  eintrag: BildEintrag,
  wunsch = "",
): string {
  const teile =
    art === "charaktere"
      ? [
          zeile("Figur", eintrag.name),
          zeile("Tierart", eintrag.tierart),
          zeile("Alter", eintrag.alter ? `${eintrag.alter} Jahre` : ""),
          zeile("Beruf", eintrag.beruf),
          zeile("Wesen und Aussehen", eintrag.beschreibung),
        ]
      : art === "orte"
        ? [
            zeile("Schauplatz", eintrag.name),
            zeile("Stadt", eintrag.stadt),
            zeile("Stimmung", eintrag.atmosphaere),
            zeile("Beschreibung", eintrag.beschreibung),
          ]
        : [zeile("Gegenstand", eintrag.name), zeile("Beschreibung", eintrag.beschreibung)];

  return [
    STIL,
    RAHMEN[art],
    ...teile.filter(Boolean),
    zeile("Zusätzliche Wünsche", wunsch),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fehlt alles, wüsste das Modell nicht, was es malen soll. */
export const auftragReicht = (art: BildArt, eintrag: BildEintrag, wunsch = ""): boolean =>
  Boolean(
    (eintrag.name ?? "").trim() ||
      (eintrag.beschreibung ?? "").trim() ||
      wunsch.trim(),
  );
