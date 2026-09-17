/**
 * Wie lange eine Tafel im Vorspann stehen bleibt.
 *
 * Die Vorspänne liefen bisher in festen Anteilen der Musik: die Schlagworte
 * von 20 bis 42 Prozent, die Verdächtigen bis 68 und so weiter. Das geht gut,
 * solange wenig auf der Bühne steht - bei sechs Schlagworten und fünf
 * Verdächtigen bekommt aber jede Tafel gut eine Sekunde. Eine Sekunde reicht
 * für ein Wort und nicht einmal für einen Namen mit Alter darunter: Der Text
 * blitzt auf, die Einblendung ist noch nicht zu Ende, und schon steht der
 * Nächste da. Vorlesen kann das niemand, und wer selbst liest, kommt nicht
 * mit.
 *
 * Deshalb wird hier anders gerechnet: Jede Tafel sagt, wie lange sie
 * mindestens braucht - gemessen an dem, was auf ihr steht -, und erst danach
 * wird verteilt. Ist der Song länger als nötig, bekommen alle Tafeln
 * gleichmäßig mehr Zeit. Ist er kürzer, läuft der Vorspann eben länger als
 * der Song; kein Kind soll einen Text sehen, den es nicht lesen kann, nur
 * weil die Aufnahme kurz ist.
 */

/**
 * Wie schnell vorgelesen wird - Zeichen je Sekunde.
 *
 * Ein erwachsener Vorleser schafft etwa 15 Zeichen in der Sekunde. Hier steht
 * bewusst weniger: Vorgelesen wird einem Kind, das dabei auf ein Bild schaut.
 */
const ZEICHEN_JE_SEKUNDE = 11;

/**
 * Was jede Tafel bekommt, egal wie kurz ihr Text ist.
 *
 * Darunter ist die Einblendung selbst noch nicht durch (die Animationen im
 * Stylesheet laufen gut eine halbe Sekunde), und das Auge hat die Tafel noch
 * gar nicht erfasst.
 */
export const MINDEST_TAFEL = 2.2;

/** Und was auch die längste Tafel nicht überschreiten soll. */
export const LAENGSTE_TAFEL = 14;

/**
 * Wie lange ein Text zum Vorlesen braucht - in Sekunden.
 *
 * `grund` ist die Zeit, die die Tafel auch ohne Text braucht: das Aufblenden,
 * der Blick hin, das Umschalten. `hoechstens` deckelt das Ergebnis - für eine
 * Bildtafel im Vorspann ist irgendwann Schluss, für einen ganzen Erzählertext
 * dagegen nicht.
 */
export function leseDauer(
  text: string,
  grund = MINDEST_TAFEL,
  hoechstens = LAENGSTE_TAFEL,
): number {
  const zeichen = (text ?? "").trim().length;
  return Math.min(hoechstens, Math.max(grund, grund * 0.45 + zeichen / ZEICHEN_JE_SEKUNDE));
}

/** Eine Tafel, bevor sie ihren Platz auf der Zeitachse hat. */
export type Tafel = { dauer: number };

/** Und dieselbe Tafel danach - `von` und `bis` sind Anteile von 0 bis 1. */
export type TafelZeit<T> = T & { von: number; bis: number };

/**
 * Die Tafeln auf die Spielzeit verteilen.
 *
 * Zurück kommt der Plan in Anteilen (damit die Szenen ihn wie bisher gegen
 * den Fortschritt prüfen können) und die Gesamtdauer in Sekunden - die kann
 * länger sein als der Song.
 *
 * Ist keine Tafel dabei, bleibt es beim Song: Ein leerer Plan soll die Uhr
 * nicht anhalten.
 */
export function tafelnVerteilen<T extends Tafel>(
  tafeln: T[],
  songDauer: number,
): { plan: TafelZeit<T>[]; dauer: number } {
  const noetig = tafeln.reduce((summe, tafel) => summe + Math.max(0.1, tafel.dauer), 0);
  const dauer = Math.max(songDauer > 0 ? songDauer : 0, noetig, 1);
  if (!tafeln.length) return { plan: [], dauer };

  /*
   * Bleibt Zeit übrig, wird sie im Verhältnis verteilt: Eine lange Tafel
   * bekommt mehr davon ab als ein einzelnes Wort. So bleibt der Rhythmus
   * derselbe wie bisher, nur mit einem garantierten Boden darunter.
   */
  const streck = dauer / noetig;
  let laufend = 0;
  const plan = tafeln.map((tafel) => {
    const von = laufend / dauer;
    laufend += Math.max(0.1, tafel.dauer) * streck;
    return { ...tafel, von, bis: Math.min(1, laufend / dauer) };
  });
  // Die letzte Tafel reicht immer bis ans Ende - sonst bliebe bei
  // Rundungsfehlern ein Bildschirm ohne Szene übrig.
  const letzte = plan[plan.length - 1];
  if (letzte) letzte.bis = 1.0001;
  return { plan, dauer };
}

/**
 * Wie viele Tafeln in eine Aufnahme passen, ohne dass es hetzt.
 *
 * Gebraucht für Listen, die beliebig lang werden können - Schlagworte etwa.
 * Der Vorspann darf länger laufen als der Song, aber nicht beliebig: Wer acht
 * Schlagworte einträgt und einen Song von zwanzig Sekunden wählt, bekommt
 * sonst eine halbe Minute Stille hinterher.
 */
export function passendeAnzahl(
  texte: string[],
  platz: number,
  hoechstens = texte.length,
): number {
  let zeit = 0;
  let anzahl = 0;
  for (const text of texte.slice(0, hoechstens)) {
    zeit += leseDauer(text);
    if (anzahl > 0 && zeit > platz) break;
    anzahl++;
  }
  return Math.max(1, anzahl);
}
