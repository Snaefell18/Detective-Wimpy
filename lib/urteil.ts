/**
 * Was Öhö am Ende einer Verhandlung verhängt.
 *
 * Dies ist eine Stadt voller im Grunde netter Tiere. Wer hier etwas angestellt
 * hat, wird nicht weggesperrt, sondern muss es wiedergutmachen - und Öhö denkt
 * sich dafür etwas aus, das zur Tat passt: wer Glocken gestohlen hat, putzt
 * ein Jahr lang den Kirchturm; wer den Markt bestohlen hat, backt für ihn.
 *
 * Schrankhaft - ein paar Tage im Schrank - gibt es weiterhin, aber als eine
 * Möglichkeit unter vielen und nie als Drohung: Der Schrank bekommt ein
 * Kissen, jemand liest vor, und danach ist die Sache erledigt.
 *
 * Wichtig: Ein Urteil gibt es nur am Ende einer Verhandlung, nicht nach jedem
 * einzelnen Fall. Ein gelöster Fall ist ein gelöster Fall.
 */

/** Ein Urteilsspruch: das Strafmaß in Worten und was wiedergutzumachen ist. */
export type Strafe = {
  /** Das Maß in wenigen Worten: „Vier Tage Schrankhaft“, „Ein Sommer am Ofen“. */
  wort: string;
  /** Die Auflage: was zu tun ist, damit die Sache aus der Welt ist. */
  auflage: string;
};

export const LEERE_STRAFE: Strafe = { wort: "", auflage: "" };

/** Ist überhaupt eine Strafe ausgesprochen worden? */
export const hatStrafe = (strafe: Strafe | undefined): boolean =>
  Boolean(strafe?.wort?.trim() || strafe?.auflage?.trim());

/** Räumt eine Strafe aus der Modellantwort auf. */
export const strafeAus = (wort: unknown, auflage: unknown): Strafe => ({
  wort: String(wort ?? "").trim().slice(0, 120),
  auflage: String(auflage ?? "").trim().slice(0, 600),
});

/**
 * Die Ansage ans Modell - überall dieselbe, damit die Urteile im ganzen Spiel
 * denselben Ton treffen.
 */
export const URTEILS_REGEL = `WIE IN DIESER STADT GEURTEILT WIRD
- Die Tiere hier sind im Grunde nett. Auch wer etwas angestellt hat, bleibt jemand, dem man morgen wieder auf dem Markt begegnet. Das Urteil ist entsprechend: freundlich im Ton, bestimmt in der Sache, nie hart und nie beschämend.
- Es gibt kein Gefängnis. Im Mittelpunkt steht die Wiedergutmachung, und sie hängt am Fall: Wer die Glocken genommen hat, putzt ein Jahr lang den Turm; wer den Markt bestohlen hat, backt jeden Freitag für ihn; wer eine Uhr verstellt hat, zieht sie fortan jeden Morgen auf.
- Öhö denkt sich das aus, und er darf schrullig sein: Vorlesestunden im Altersheim der Igel, Laternendienst am Hafen, ein Sommer als Fährmann.
- „Schrankhaft“ - ein paar Tage im Schrank - ist eine Möglichkeit unter vielen und nie eine Drohung: mit Kissen, mit Decke, mit jemandem, der vorliest. Wenn sie verhängt wird, dann mit einer Zahl ("Vier Tage Schrankhaft") und nie länger als ein paar Wochen.
- Zwei Felder: strafeWort ist das Maß in wenigen Worten, strafeAuflage der Satz, was zu tun ist, damit die Sache aus der Welt ist. Beides gehört zusammen.`;
