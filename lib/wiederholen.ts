/**
 * Noch einmal versuchen - aber nur da, wo es sich lohnt.
 *
 * Eine Saga entsteht aus zwanzig und mehr Modellaufrufen nacheinander. Ging
 * bisher einer davon daneben - eine abgeschnittene Antwort, ein überlasteter
 * Server, ein Zeitlimit -, war der ganze Lauf verloren, samt allem, was schon
 * bezahlt war. Ein einzelner Aufruf noch einmal kostet einen Bruchteil davon.
 *
 * Wiederholt wird deshalb nur, was von allein wieder gut werden kann. Ein
 * fehlender API-Schlüssel, ungültige Vorgaben oder eine abgelehnte Anfrage
 * werden beim zweiten Mal genauso scheitern - die fliegen sofort durch.
 */

/** Fehler, bei denen ein zweiter Versuch Aussicht auf Erfolg hat. */
const VERGEHT_WIEDER =
  /abgeschnitten|nicht lesbar|zu lange|überlastet|overload|rate.?limit|Status 5\d\d|nicht erreichbar|Verbindung|timeout|ECONNRESET|fetch failed/i;

export const lohntWiederholung = (fehler: unknown): boolean =>
  fehler instanceof Error && VERGEHT_WIEDER.test(fehler.message);

/** Zwischen zwei Versuchen kurz durchatmen - ein überlasteter Dienst dankt es. */
const PAUSE = 1500;

/**
 * Einen Schritt ausführen und bei einem vorübergehenden Fehler wiederholen.
 *
 * `was` beschreibt den Schritt ("Kapitel 2 von 5") und steht am Ende in der
 * Fehlermeldung: Ein nackter Text aus dem dritten Kapitel sieht sonst aus wie
 * ein Fehler des ganzen Vorgangs.
 */
export async function mitWiederholung<T>(
  was: string,
  arbeit: () => Promise<T>,
  /** Wie oft nach dem ersten Versuch noch einmal. */
  versuche = 1,
  /** Wird vor jedem weiteren Versuch gemeldet - für die Fortschrittszeile. */
  onErneut?: (versuch: number) => void,
): Promise<T> {
  let letzter: unknown = null;

  for (let versuch = 0; versuch <= versuche; versuch++) {
    if (versuch > 0) {
      onErneut?.(versuch);
      await new Promise((fertig) => setTimeout(fertig, PAUSE * versuch));
    }
    try {
      return await arbeit();
    } catch (fehler) {
      letzter = fehler;
      if (!lohntWiederholung(fehler)) break;
    }
  }

  const text = letzter instanceof Error ? letzter.message : String(letzter);
  throw new Error(`${was}: ${text}`);
}
