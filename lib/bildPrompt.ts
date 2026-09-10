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
 * Zwei Handschriften, unter denen ein Bild entstehen kann.
 *
 * "naiv" ist der Stil des Hauses: weich, warm, wie ein Kinderbuch. "erwachsen"
 * ist derselbe Gedanke eine Etage tiefer - gezeichnet bleibt gezeichnet, aber
 * ernster: feinere Linien, gedämpfte Farben, Schatten, die etwas verbergen.
 * Kein Fotorealismus, kein 3D, nichts Grausames; es ist immer noch dieselbe
 * Stadt, nur später am Abend.
 *
 * Gewählt wird beim Erzeugen. Wer nichts wählt, bekommt den Stil des Hauses -
 * ein Spiel, in dem jedes Tier aus einer anderen Welt stammt, sieht
 * zusammengewürfelt aus.
 */
export type BildStil = "naiv" | "erwachsen";

export const BILD_STILE: { id: BildStil; label: string; hinweis: string }[] = [
  { id: "naiv", label: "Naiv", hinweis: "warm, rund, wie ein Kinderbuch" },
  { id: "erwachsen", label: "Erwachsener", hinweis: "gezeichnet, aber ernster" },
];

/** Ist das ein Stil, den es gibt? Für das, was aus dem Speicher zurückkommt. */
export const istBildStil = (wert: unknown): wert is BildStil =>
  BILD_STILE.some((s) => s.id === wert);

const STIL_TEXT: Record<BildStil, string> = {
  naiv:
    "Naiver Comicstil, kindlich-freundliche Buchillustration: weiche runde Formen, " +
    "kräftige klare Konturlinien von gleichmäßiger Stärke, flächige warme Farben mit " +
    "sanften Verläufen, große ausdrucksvolle Augen, freundliche Gesichter, " +
    "leichte Textur wie von Buntstift. Keine Fotorealistik, kein 3D-Rendering, " +
    "keine harten Schlagschatten, keine Schrift, keine Buchstaben, keine Zahlen, " +
    "keine Sprechblasen, keine Rahmen und keine Bildunterschrift.",
  erwachsen:
    "Erwachsene Illustration, von Hand gezeichnet: feine, ungleichmäßige Tuschelinien, " +
    "sparsame Schraffuren, gedämpfte, entsättigte Farben in wenigen Tönen, weiches " +
    "Licht aus einer Richtung und ruhige, tiefe Schatten. Genauer und ernster als ein " +
    "Kinderbuch - erzählerisch wie eine gute Graphic Novel, aber niemals düster, " +
    "blutig oder bedrohlich. Die Figuren bleiben Tiere mit Charakter, keine Fratzen. " +
    "Keine Fotorealistik, kein 3D-Rendering, keine Airbrush-Optik, keine Schrift, " +
    "keine Buchstaben, keine Zahlen, keine Sprechblasen, keine Rahmen und keine " +
    "Bildunterschrift.",
};

/** Der Stil des Hauses - bleibt der Standard überall dort, wo nichts gewählt wird. */
export const STIL = STIL_TEXT.naiv;

/**
 * Dieselbe Ansage noch einmal, kurz, ganz am Schluss.
 *
 * Bildmodelle gewichten das Ende einer Beschreibung stärker. Stünde der Stil
 * nur oben, könnte ein Wunsch wie "fotorealistisch glänzend" ihn unterlaufen -
 * und das Tier fiele aus dem Spiel heraus. Deshalb hat der Stil das letzte
 * Wort, egal was dazwischen steht.
 */
const NACHKLANG_TEXT: Record<BildStil, string> = {
  naiv:
    "Das alles im oben beschriebenen naiven Comicstil: weiche Formen, klare " +
    "Konturen, flächige warme Farben. Der Stil gilt unbedingt und geht allen " +
    "anderen Angaben vor.",
  erwachsen:
    "Das alles in der oben beschriebenen erwachsenen Illustration: feine " +
    "Tuschelinien, gedämpfte Farben, ruhige Schatten - gezeichnet, nicht " +
    "fotografiert. Der Stil gilt unbedingt und geht allen anderen Angaben vor.",
};

export const STIL_NACHKLANG = NACHKLANG_TEXT.naiv;

/** Der Nachsatz für alles, was ohne Hintergrund auskommen muss. */
export const FREISTELL_NACHKLANG =
  "Der Hintergrund bleibt vollständig durchsichtig (Alphakanal, kein Weiß, " +
  "kein Grau, keine Farbfläche): kein Boden, kein Schatten, keine Kulisse, " +
  "keine Vignette - nur das Motiv selbst, sauber freigestellt bis an die " +
  "Kontur.";

/**
 * Wenn aus einem vorhandenen Tier eine andere Fassung wird.
 *
 * Der springende Punkt ist die Wiedererkennbarkeit: Es soll erkennbar
 * dasselbe Tier sein - nur eben verwandelt. Deshalb steht das vor den
 * Wünschen, und die Wünsche sagen dann, was sich ändert.
 */
export const VARIANTE =
  "Vorlage ist die mitgeschickte Figur. Es ist unverkennbar dasselbe Tier: " +
  "gleiche Art, gleicher Körperbau, gleiche Grundfarben, gleiche Statur und " +
  "dieselben Gesichtszüge. Verändert wird ausschließlich, was unter " +
  "„Zusätzliche Wünsche“ steht - alles andere bleibt, wie es ist.";

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
  /** true, wenn ein vorhandenes Bild als Vorlage mitgeschickt wird. */
  variante = false,
  /** Die Handschrift - ohne Angabe der Stil des Hauses. */
  stil: BildStil = "naiv",
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
    STIL_TEXT[stil] ?? STIL_TEXT.naiv,
    RAHMEN[art],
    variante ? VARIANTE : "",
    ...teile.filter(Boolean),
    zeile("Zusätzliche Wünsche", wunsch),
    // Der Stil und die Freistellung stehen bewusst noch einmal ganz unten -
    // das Ende einer Beschreibung wiegt schwerer als ihre Mitte.
    FREIGESTELLT[art] ? FREISTELL_NACHKLANG : "",
    NACHKLANG_TEXT[stil] ?? NACHKLANG_TEXT.naiv,
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
