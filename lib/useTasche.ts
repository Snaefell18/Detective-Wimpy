"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TASCHE_MAX,
  aufnehmen as aufnehmenIn,
  inTasche,
  taschePlatz,
  wegwerfen as wegwerfenAus,
  type Beweismittel,
} from "./beweismittel";

/**
 * Die Beweismitteltasche - sie liegt auf dem Gerät, nicht in der Datenbank.
 *
 * Sie gehört zu genau einem Durchgang: einer Saga (dann überlebt sie jedes
 * Kapitel) oder einem einzelnen Fall. Beginnt ein anderer Durchgang, ist sie
 * leer - man startet nicht mit den Beweisen von letzter Woche in einen neuen
 * Fall.
 *
 * Geschrieben wird nach demselben Muster wie beim Geldbeutel: Der aktuelle
 * Stand steht in einem Zeiger, geprüft und geschrieben wird in einem Zug.
 * Aktualisierungsfunktionen mit Nebenwirkungen haben hier nichts zu suchen -
 * sie werden von React notfalls zweimal ausgewertet.
 */
const KEY = "detective-wimpy:tasche:v1";

type Gespeichert = {
  /** Zu welchem Durchgang diese Tasche gehört: "saga:<id>" oder "fall:<id>". */
  quelle: string;
  inhalt: Beweismittel[];
};

const LEER: Gespeichert = { quelle: "", inhalt: [] };

/** Nur das durchlassen, was wirklich wie ein Beweismittel aussieht. */
const geprueft = (roh: unknown): Beweismittel[] => {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter(
      (m): m is Beweismittel =>
        Boolean(m) && typeof m === "object" && typeof (m as Beweismittel).id === "string",
    )
    .slice(0, TASCHE_MAX)
    .map((m) => ({
      id: m.id,
      name: String(m.name ?? ""),
      bild: String(m.bild ?? ""),
      beobachtung: String(m.beobachtung ?? ""),
      herkunft: String(m.herkunft ?? ""),
      siegel: String(m.siegel ?? ""),
      seit: Number.isFinite(m.seit) ? m.seit : 0,
    }));
};

export function useTasche() {
  const [tasche, setTasche] = useState<Gespeichert>(LEER);
  const [geladen, setGeladen] = useState(false);
  /**
   * Der Stand in diesem Augenblick.
   *
   * Er wird beim Laden mitgeschrieben, nicht erst beim nächsten Aufbau: Sonst
   * käme `fuer` noch im selben Durchlauf mit einer leeren Tasche daher und
   * würfe weg, was gerade vom Gerät gelesen wurde.
   */
  const jetzt = useRef<Gespeichert>(LEER);
  jetzt.current = tasche;

  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(KEY);
      if (roh) {
        const daten = JSON.parse(roh) as Partial<Gespeichert>;
        const geladeneTasche: Gespeichert = {
          quelle: String(daten.quelle ?? ""),
          inhalt: geprueft(daten.inhalt),
        };
        jetzt.current = geladeneTasche;
        setTasche(geladeneTasche);
      }
    } catch {
      // Kaputter Eintrag - dann eben mit leerer Tasche.
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(tasche));
    } catch {
      // Voller Speicher - gespielt wird trotzdem.
    }
  }, [tasche, geladen]);

  const schreibe = useCallback((neu: Gespeichert) => {
    jetzt.current = neu;
    setTasche(neu);
  }, []);

  /**
   * Die Tasche einem Durchgang zuordnen.
   *
   * Derselbe Durchgang ändert nichts - ein anderer fängt mit leerer Tasche
   * an. Ein leerer Name tut gar nichts: Im Hauptmenü gehört die Tasche
   * niemandem, und weggeworfen wird dort schon gar nichts.
   */
  const fuer = useCallback(
    (quelle: string) => {
      if (!quelle || jetzt.current.quelle === quelle) return;
      schreibe({ quelle, inhalt: [] });
    },
    [schreibe],
  );

  /**
   * Ein Stück aufnehmen - gibt zurück, ob es geklappt hat.
   *
   * Bei voller Tasche geht es nur mit `statt`; ohne bleibt alles, wie es
   * ist, und der Bildschirm fragt nach.
   */
  const aufnehmen = useCallback(
    (mittel: Beweismittel, statt?: string): boolean => {
      const alt = jetzt.current;
      const inhalt = aufnehmenIn(alt.inhalt, mittel, statt);
      if (inhalt === alt.inhalt) return inTasche(alt.inhalt, mittel.id);
      schreibe({ ...alt, inhalt });
      return true;
    },
    [schreibe],
  );

  const wegwerfen = useCallback(
    (id: string) => {
      const alt = jetzt.current;
      const inhalt = wegwerfenAus(alt.inhalt, id);
      if (inhalt.length === alt.inhalt.length) return;
      schreibe({ ...alt, inhalt });
    },
    [schreibe],
  );

  /**
   * Ein neuer Durchgang - immer mit leerer Tasche.
   *
   * Gedacht für "von vorn": Wer dieselbe Saga noch einmal beginnt, fängt
   * auch beim Sammeln von vorn an.
   */
  const neu = useCallback(
    (quelle: string) => schreibe({ quelle, inhalt: [] }),
    [schreibe],
  );

  const leeren = useCallback(() => schreibe(LEER), [schreibe]);

  return {
    inhalt: tasche.inhalt,
    quelle: tasche.quelle,
    geladen,
    platz: taschePlatz(tasche.inhalt),
    voll: taschePlatz(tasche.inhalt) === 0,
    fuer,
    neu,
    aufnehmen,
    wegwerfen,
    leeren,
  };
}
