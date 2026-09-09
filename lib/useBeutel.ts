"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOHN_FALL, LOHN_SAGA, type Zubehoer } from "./zubehoer";

/**
 * Wimpys Geldbeutel und sein Zubehör.
 *
 * Beides liegt auf dem Gerät, nicht in der Datenbank: Es ist der Fortschritt
 * eines Spielers und nichts, was jemand anderes sehen müsste. Wer den Speicher
 * leert, fängt bei null an - dasselbe gilt ja auch für angefangene Sagas.
 *
 * `bezahlt` merkt sich, wofür schon Lohn geflossen ist. Ohne diese Liste
 * bekäme man für denselben Fall zweimal Geld, sobald ein Bildschirm neu
 * gezeichnet wird - und Wimpy wäre in einer Stunde reicher als die ganze
 * Stadt.
 */
const KEY = "detective-wimpy:beutel:v1";

export type Beutel = {
  yen: number;
  /** Gekaufte Gegenstände: Zubehör-Id -> Anzahl. */
  vorrat: Record<string, number>;
  /** Wofür schon gezahlt wurde: Fall-Ids und Saga-Ids. */
  bezahlt: string[];
};

const LEER: Beutel = { yen: 0, vorrat: {}, bezahlt: [] };

/** Wie viel eine gerade eingelöste Belohnung wert war - für die Anzeige. */
export type Lohn = { betrag: number; grund: string };

/** Ein Gegenstand, den Wimpy geschenkt bekommen hat - für die Übergabe. */
export type Geschenk = { stueck: Zubehoer; grund: string };

export function useBeutel() {
  const [beutel, setBeutel] = useState<Beutel>(LEER);
  /**
   * Der Beutel, wie er in diesem Augenblick ist.
   *
   * Er steht hier, damit die Buchungen unten ohne Umweg über eine
   * Aktualisierungsfunktion auskommen: Wer in einer solchen Funktion noch
   * etwas anderes anstößt, baut sich eine Endlosschleife, sobald sie zweimal
   * ausgewertet wird. Der Zeiger wird gleich mitgeschrieben, damit zwei
   * Buchungen im selben Wimpernschlag einander sehen.
   */
  const jetzt = useRef<Beutel>(LEER);
  jetzt.current = beutel;
  const [geladen, setGeladen] = useState(false);
  /** Die letzte Belohnung - die Anzeige holt sie sich ab und räumt sie weg. */
  const [lohn, setLohn] = useState<Lohn | null>(null);
  /** Dasselbe für ein Geschenk: Es wartet, bis es übergeben wurde. */
  const [geschenk, setGeschenk] = useState<Geschenk | null>(null);

  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(KEY);
      if (roh) {
        const daten = JSON.parse(roh) as Partial<Beutel>;
        setBeutel({
          yen: Number.isFinite(daten.yen) ? Number(daten.yen) : 0,
          vorrat: daten.vorrat ?? {},
          bezahlt: daten.bezahlt ?? [],
        });
      }
    } catch {
      // Kaputter Eintrag - dann eben von vorn.
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(beutel));
    } catch {
      // Voller Speicher - das Spiel läuft trotzdem weiter.
    }
  }, [beutel, geladen]);

  /**
   * Lohn für etwas Gelöstes. `was` ist die Id, unter der es verbucht wird -
   * derselbe Fall zahlt nur einmal.
   */
  const verdienen = useCallback((was: string, betrag: number, grund: string) => {
    if (!was) return;
    const alt = jetzt.current;
    if (alt.bezahlt.includes(was)) return;
    const neu = { ...alt, yen: alt.yen + betrag, bezahlt: [...alt.bezahlt, was] };
    jetzt.current = neu;
    setBeutel(neu);
    setLohn({ betrag, grund });
  }, []);

  /** Ein gelöster Fall. */
  const fallGeloest = useCallback(
    (fallId: string) => verdienen(`fall:${fallId}`, LOHN_FALL, "Fall gelöst"),
    [verdienen],
  );

  /** Eine ganze Saga - der große Batzen. */
  const sagaGeschafft = useCallback(
    (sagaId: string) => verdienen(`saga:${sagaId}`, LOHN_SAGA, "Saga abgeschlossen"),
    [verdienen],
  );

  /**
   * Ein Geschenk: ein Gegenstand, für den nichts bezahlt wird.
   *
   * `was` ist die Id, unter der es verbucht wird - dasselbe Geschenk gibt es
   * nie zweimal, auch wenn ein Kapitel erneut gespielt wird. Ohne Gegenstand
   * passiert nichts; das ist der Normalfall, wenn nichts eingetragen wurde.
   */
  const geschenkErhalten = useCallback(
    (was: string, stueck: Zubehoer | null | undefined, grund: string) => {
      if (!was || !stueck?.id) return;
      const alt = jetzt.current;
      if (alt.bezahlt.includes(was)) return;
      const neu = {
        ...alt,
        bezahlt: [...alt.bezahlt, was],
        vorrat: { ...alt.vorrat, [stueck.id]: (alt.vorrat[stueck.id] ?? 0) + 1 },
      };
      jetzt.current = neu;
      setBeutel(neu);
      setGeschenk({ stueck, grund });
    },
    [],
  );

  /** Kaufen. Gibt zurück, ob es geklappt hat. */
  const kaufen = useCallback((id: string, preis: number): boolean => {
    const alt = jetzt.current;
    if (alt.yen < preis) return false;
    const neu = {
      ...alt,
      yen: alt.yen - preis,
      vorrat: { ...alt.vorrat, [id]: (alt.vorrat[id] ?? 0) + 1 },
    };
    jetzt.current = neu;
    setBeutel(neu);
    return true;
  }, []);

  /** Einsetzen - und damit verbrauchen. */
  const verbrauchen = useCallback((id: string) => {
    const alt = jetzt.current;
    const uebrig = (alt.vorrat[id] ?? 0) - 1;
    const vorrat = { ...alt.vorrat };
    if (uebrig > 0) vorrat[id] = uebrig;
    else delete vorrat[id];
    const neu = { ...alt, vorrat };
    jetzt.current = neu;
    setBeutel(neu);
  }, []);

  const lohnAbholen = useCallback(() => setLohn(null), []);
  const geschenkAbholen = useCallback(() => setGeschenk(null), []);

  return {
    beutel,
    geladen,
    lohn,
    lohnAbholen,
    geschenk,
    geschenkAbholen,
    geschenkErhalten,
    fallGeloest,
    sagaGeschafft,
    kaufen,
    verbrauchen,
  };
}
