/**
 * Wie die Gestalt spricht, wenn sie selbst auf der Bank sitzt.
 *
 * Bis zur Verwandlung sprach dort ein Tier, das jeder kannte - danach etwas
 * ganz anderes, und das muss man hören. Nicht durch Gebrüll: Was diesen Saal
 * kalt macht, ist die Ruhe von etwas, das viel mehr Zeit hat als alle
 * Anwesenden zusammen.
 *
 * Der eigene Sprachstil aus den Stammdaten steht im Prompt darüber und
 * gewinnt - wer seiner Gestalt eine eigene Stimme gegeben hat, bekommt sie.
 */
export function gestaltRegeln(
  daemon: string,
  wirt: string,
  /** Im Saal sitzt sie auf der Bank - im Gespräch steht sie einfach da. */
  wo: "saal" | "gespraech" = "saal",
): string {
  return `
SO SPRICHT ${daemon.toUpperCase()} (${
    wo === "saal"
      ? "auf der Bank sitzt die Gestalt, nicht mehr das Tier"
      : "das ist keine Bekannte mehr - das ist die Gestalt, die in einem Tier gesteckt hat"
  })
- Sie ist alt und hat Zeit. Kurze, saubere Sätze, langsam, nie hastig, nie laut. Kein Ausrufezeichen, kein Gebrüll, keine Drohung gegen irgendjemanden.
- Von ${wirt || "ihrem Wirt"} spricht sie in der dritten Person und nie beim Kosenamen - "das Tier", "der Kleine", "mein Mantel". Was er tat, war ihre Hand; was er dabei fühlte, ist ihr gleich.
- Sie ist höflich, und ihre Höflichkeit ist unangenehmer als Grobheit: Sie siezt, sie lobt, sie bedankt sich für Fragen, die sie nicht beantwortet.
- Sie antwortet gern mit einer Gegenfrage oder mit einer Bemerkung über den, der fragt ("Sie haben kalte Pfoten, Detektiv."). Sie dreht Worte um, statt sie zu bestreiten.
- Sie lügt selten geradeheraus. Sie weicht aus, wird bei Nebensächlichem sehr genau und schweigt an der Stelle, auf die es ankommt.
- Ihre Bilder kommen aus Zeit, Kälte und Dunkelheit: Winter, Keller, Uhren, Staub, Dinge, die lange stillstanden. Keine Hölle, kein Feuer, keine Beschwörungen.
- Trifft ein Vorhalt, gibt sie das nie zu - sie wird kürzer, genauer und verliert die Belustigung. Genau daran merkt man, dass es saß.
- Zugegeben wird erst ganz am Schluss, wenn nichts mehr zu halten ist: knapp, ohne Reue, fast erleichtert, dass endlich jemand hingesehen hat.
- Unheimlich durch Ruhe, nicht durch Grausamkeit: kein Blut, keine Qual, nichts, was einem Kind den Abend verdirbt.`;
}

/**
 * Die Spur der Besessenheit - dieselben Regeln für Kapitel, Fälle und Finale.
 *
 * Der Sinn ist die Dosis: In jedem Kapitel genau ein Detail, das nicht ins
 * Bild passt und das niemand erklären kann. Zusammengenommen ergibt sich ein
 * Muster, einzeln bleibt jedes für sich harmlos. Erklärt wird nichts, benannt
 * schon gar nichts - sonst wäre die Verwandlung entwertet, bevor sie stattfindet.
 */
export function besessenheitsRegeln(
  wirtName: string,
  daemonName: string,
  /**
   * Wann die Gestalt herausbricht. In einer Saga ist das das Finale; in
   * einem gewöhnlichen Fall der Moment, in dem Wimpy richtig beschuldigt.
   */
  wann: "finale" | "beschuldigung" = "finale",
): string {
  const bis = wann === "finale" ? "vor dem Finale" : "vor der Beschuldigung";
  return `
ETWAS ÜBLES GEHT VOR (streng geheim)
- ${wirtName} ist besessen, weiß es aber nicht. ${daemonName} ist die Gestalt darin und kommt ${bis} nirgends vor - weder als Person noch beim Namen.
- Bau genau EIN kleines Zeichen ein, das nicht ins Bild passt und mit ${wirtName} zu tun hat: eine Stunde, die er nicht erinnert; Erde unter den Krallen, obwohl er zu Hause war; ein Kratzer zu hoch an der Wand; Kälte in einem warmen Raum; ein Satz in einer Sprache, die er nicht spricht; eine Spiegelung, die einen Herzschlag zu spät folgt.
- Niemand erklärt es, niemand nennt Dämon, Fluch oder Magie. Ein Tier wundert sich höchstens kurz und redet weiter.
- Es darf den Fall nicht lösen und nicht in die Irre führen: Der Täter bleibt der, der er ist.
- Und es bleibt bei diesem einen Zeichen. Zwei wären ein Muster, drei eine Ankündigung - dann ist die Verwandlung verbraucht, bevor sie stattfindet.`;
}
