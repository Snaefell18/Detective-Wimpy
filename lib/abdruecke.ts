/**
 * Das Fingerabdruckset: wer am Tatort Abdrücke hinterlassen hat.
 *
 * Steht hier und nicht in der Route, damit die Auswahl für sich prüfbar
 * bleibt - sie ist die eine Regel, auf die sich der Spieler für 500 Yen
 * verlassen können muss: höchstens zwei Namen, und der Täter ist dabei.
 */
export type AbdruckFall = {
  taeterId: string;
  /** Ein zweiter Täter derselben Tat - dann ist einer von beiden dabei. */
  mittaeterId?: string;
  tatort: string;
  verdaechtige: { charakterId: string; aufenthaltsort: string }[];
};

/**
 * Gibt die Ids zurück, deren Abdrücke am Tatort kleben - höchstens zwei.
 *
 * Der zweite stammt bevorzugt von jemandem, der wirklich dort war; gibt es
 * dort sonst niemanden, tut es ein anderer Verdächtiger. Ist der Täter der
 * einzige Verdächtige, bleibt es bei einem Namen.
 *
 * `wuerfel` gibt eine Zahl aus [0,1) - im Spiel Math.random, im Test etwas
 * Vorhersagbares.
 */
export function abdrueckeAmTatort(
  fall: AbdruckFall,
  wuerfel: () => number = Math.random,
): string[] {
  /*
   * Bei zwei Tätern kommt einer von beiden aufs Blatt - gewürfelt, welcher.
   *
   * Beide zu nennen wäre die Lösung: Wer sie liest, hätte den Fall gelöst,
   * ohne etwas kombiniert zu haben. So bleibt das Set genau so viel wert
   * wie bei einem Täter - zwei Namen, einer davon schuldig.
   */
  const taeterAuswahl = [
    fall.taeterId,
    ...(fall.mittaeterId && fall.mittaeterId !== fall.taeterId ? [fall.mittaeterId] : []),
  ];
  const taeterId =
    taeterAuswahl[Math.min(taeterAuswahl.length - 1, Math.floor(wuerfel() * taeterAuswahl.length))];

  const andere = fall.verdaechtige
    .map((v) => v.charakterId)
    .filter((id) => !taeterAuswahl.includes(id));

  const amTatort = andere.filter(
    (id) =>
      fall.verdaechtige.find((v) => v.charakterId === id)?.aufenthaltsort === fall.tatort,
  );
  const auswahl = amTatort.length > 0 ? amTatort : andere;
  if (auswahl.length === 0) return [taeterId];

  const zweiter = auswahl[Math.min(auswahl.length - 1, Math.floor(wuerfel() * auswahl.length))];

  // Gemischt, sonst stünde der Täter immer vorne - und wäre damit verraten.
  return wuerfel() < 0.5 ? [taeterId, zweiter] : [zweiter, taeterId];
}
