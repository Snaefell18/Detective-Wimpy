"use client";

import { useEffect, useRef, useState } from "react";
import { audioVon, spiele, stand, stoppe, type Stueck } from "./introAudio";

/**
 * Die Uhr hinter jedem Vorspann.
 *
 * Drei Bildschirme des Spiels laufen nach demselben Muster ab - das Intro
 * eines Falls, der Vorspann einer Saga und der eines Arcs: Musik an, und
 * während sie läuft, ziehen Bildtafeln vorbei. Bisher hatte jeder seine eigene
 * Fassung derselben Schleife, und alle drei hatten dieselben drei Macken:
 *
 * 1. **Der Text sprang.** Gerechnet wurde mit der Spielzeit der Aufnahme,
 *    solange sie schon lief, und sonst mit der Wanduhr ab dem Aufbau des
 *    Bildschirms. Beginnt die Musik erst eine Sekunde später (sie muss ja
 *    erst geladen werden), sprang der Fortschritt zurück - man sah eine
 *    Tafel, dann wieder die davor.
 * 2. **Am Ende der Aufnahme blieb alles stehen.** Ist der Song kürzer als
 *    das, was gezeigt werden soll, blieb die letzte Tafel hängen.
 * 3. **Ohne Ton lief es zu schnell.** Die feste Ersatzdauer hatte mit dem,
 *    was auf dem Bildschirm steht, nichts zu tun.
 *
 * Hier läuft die Uhr deshalb vorwärts und nur vorwärts: Sie beginnt, wenn die
 * Musik wirklich spielt (oder feststeht, dass sie es nicht tut), und zählt
 * danach mit der Wanduhr weiter - die Spielzeit der Aufnahme darf sie
 * höchstens noch nach vorn ziehen. Und wenn der Vorspann länger dauert als
 * sein Song, wiederholt sich der Song, statt das Bild in Stille laufen zu
 * lassen.
 *
 * `gesamt` ist die gewünschte Laufzeit in Sekunden - sie kommt aus
 * `tafelnVerteilen()` und darf sich ändern, sobald die Länge der Aufnahme
 * bekannt ist. Genau dafür ist `onSongDauer` da.
 */
export function useIntroUhr(
  stueck: Stueck,
  gesamt: number,
  onSongDauer?: (dauer: number) => void,
): { fortschritt: number; tonAn: boolean; anschalten: () => void } {
  const [fortschritt, setFortschritt] = useState(0);
  const [tonAn, setTonAn] = useState(true);
  const gesamtRef = useRef(gesamt);
  gesamtRef.current = Number.isFinite(gesamt) && gesamt > 1 ? gesamt : 1;
  const meldeRef = useRef(onSongDauer);
  meldeRef.current = onSongDauer;

  useEffect(() => {
    let aktiv = true;
    let bild = 0;
    /** Wann die Uhr losgelaufen ist. 0 heißt: Sie wartet noch auf den Ton. */
    let start = 0;
    let gemeldet = 0;

    const losgehen = (geklappt: boolean) => {
      if (!aktiv) return;
      setTonAn(geklappt);
      if (!start) start = performance.now();
    };

    void spiele(stueck).then(losgehen, () => losgehen(false));
    /*
     * Die Notbremse: Auf iOS kann ein play()-Versprechen liegen bleiben, wenn
     * die App genau dabei in den Hintergrund geht. Ohne sie stünde der
     * Vorspann für immer auf der ersten Tafel.
     */
    const notbremse = window.setTimeout(() => losgehen(false), 2500);

    const tick = () => {
      if (!aktiv) return;
      const { zeit, dauer } = stand(stueck);
      if (dauer && dauer !== gemeldet) {
        gemeldet = dauer;
        meldeRef.current?.(dauer);
      }
      if (start) {
        // Nur vorwärts: Die Wanduhr führt, die Aufnahme darf höchstens
        // nachhelfen (etwa nachdem der Browser den Tab schlafen gelegt hat).
        const vergangen = Math.max((performance.now() - start) / 1000, zeit);
        setFortschritt(Math.min(1, vergangen / gesamtRef.current));
        /*
         * Dauert der Vorspann länger als sein Song, läuft der Song noch
         * einmal - aber nur, solange noch etwas zu zeigen ist. Danach darf er
         * ausgehen, auch wenn die letzte Tafel auf einen Fingertipp wartet.
         */
        audioVon(stueck).loop =
          vergangen < gesamtRef.current && gesamtRef.current > (dauer ?? 0) + 0.5;
      }
      bild = requestAnimationFrame(tick);
    };
    bild = requestAnimationFrame(tick);

    return () => {
      aktiv = false;
      cancelAnimationFrame(bild);
      window.clearTimeout(notbremse);
      // Die Wiederholung gilt nur für diesen Vorspann - sonst liefe dasselbe
      // Stück später an ganz anderer Stelle in Schleife.
      audioVon(stueck).loop = false;
      stoppe(stueck);
    };
  }, [stueck]);

  /** Für den „Ton an"-Knopf, wenn der Browser die Musik blockiert hat. */
  const anschalten = () => {
    void spiele(stueck).then((geklappt) => setTonAn(geklappt));
  };

  return { fortschritt, tonAn, anschalten };
}
