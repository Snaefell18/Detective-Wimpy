"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "./adminStore";
import { useStammdaten } from "./stammdaten";
import type {
  ChatTurn,
  Kampagne,
  NotebookEntry,
  PublicCase,
  TalkMode,
  TalkResult,
} from "./types";

export const SPEICHER_KEY = "detective-wimpy:v1";

export type Ergebnis = {
  richtig: boolean;
  aufloesung: string;
  reaktion: string;
  taeterId: string;
  beschuldigtId: string;
};

export type Spielstand = {
  fall: PublicCase | null;
  siegel: string | null;
  ortId: string;
  gefundeneSpuren: string[];
  notizen: NotebookEntry[];
  besuchteOrte: string[];
  verlauf: Record<string, ChatTurn[]>;
  verdacht: Record<string, number>;
  beschuldigungenUebrig: number;
  status: "kein-fall" | "laeuft" | "beendet";
  ergebnis: Ergebnis | null;
};

const LEER: Spielstand = {
  fall: null,
  siegel: null,
  ortId: "",
  gefundeneSpuren: [],
  notizen: [],
  besuchteOrte: [],
  verlauf: {},
  verdacht: {},
  beschuldigungenUebrig: 2,
  status: "kein-fall",
  ergebnis: null,
};

async function post<T>(pfad: string, body: unknown): Promise<T> {
  const antwort = await fetch(pfad, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const daten = await antwort.json().catch(() => ({}));
  if (!antwort.ok) {
    throw new Error(daten?.fehler ?? `Serverfehler (${antwort.status})`);
  }
  return daten as T;
}

const notiz = (text: string, quelle: string): NotebookEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text,
  quelle,
  zeitpunkt: Date.now(),
});

/** Der komplette Spielzustand samt Server-Aufrufen. */
export function useGame() {
  const { daten: admin } = useAdmin();
  const stammdaten = useStammdaten();
  const [stand, setStand] = useState<Spielstand>(LEER);
  const [geladen, setGeladen] = useState(false);
  const [laedt, setLaedt] = useState<null | "fall" | "gespraech" | "suche" | "urteil">(
    null,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const standRef = useRef(stand);
  standRef.current = stand;

  // Spielstand beim Start aus dem Gerät laden.
  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(SPEICHER_KEY);
      if (roh) {
        const gespeichert = { ...LEER, ...(JSON.parse(roh) as Spielstand) };
        // Ein Fall aus einer älteren Version kennt seine Besetzung noch nicht -
        // der wäre nicht mehr spielbar, also fangen wir frisch an.
        const brauchbar =
          !gespeichert.fall || Array.isArray(gespeichert.fall.besetzung);
        setStand(brauchbar ? gespeichert : LEER);
      }
    } catch {
      // Kaputter Speicher soll das Spiel nicht blockieren.
    }
    setGeladen(true);
  }, []);

  // ... und nach jeder Änderung wieder sichern.
  useEffect(() => {
    if (!geladen) return;
    try {
      window.localStorage.setItem(SPEICHER_KEY, JSON.stringify(stand));
    } catch {
      // z.B. privater Modus mit vollem Speicher - nicht schlimm.
    }
  }, [stand, geladen]);

  const neuerFall = useCallback(async (): Promise<boolean> => {
    setFehler(null);
    setLaedt("fall");
    try {
      // Besetzung und Einstellungen aus dem Admin-Menü gelten für diesen Fall.
      const daten = await post<{ fall: PublicCase; siegel: string }>("/api/case", {
        charaktere: stammdaten.charaktere,
        orte: stammdaten.orte,
        einstellungen: admin.einstellungen,
      });
      const startOrt = daten.fall.orte[0]?.id ?? "";
      setStand({
        ...LEER,
        fall: daten.fall,
        siegel: daten.siegel,
        ortId: startOrt,
        besuchteOrte: startOrt ? [startOrt] : [],
        status: "laeuft",
        beschuldigungenUebrig: admin.einstellungen.beschuldigungen,
        verdacht: Object.fromEntries(
          Object.keys(daten.fall.aufenthalt).map((id) => [
            id,
            admin.einstellungen.startverdacht,
          ]),
        ),
        notizen: [notiz(daten.fall.tatbeschreibung, "Fallakte")],
      });
      return true;
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Unbekannter Fehler");
      return false;
    } finally {
      setLaedt(null);
    }
  }, [admin, stammdaten.charaktere, stammdaten.orte]);

  /**
   * Startet einen vorgenerierten Fall aus der Datenbank - ohne Modellaufruf,
   * also sofort und ohne Kosten.
   */
  const kampagneStarten = useCallback(
    (kampagne: Kampagne) => {
      setFehler(null);
      const startOrt = kampagne.fall.orte[0]?.id ?? "";
      setStand({
        ...LEER,
        fall: kampagne.fall,
        siegel: kampagne.siegel,
        ortId: startOrt,
        besuchteOrte: startOrt ? [startOrt] : [],
        status: "laeuft",
        beschuldigungenUebrig: admin.einstellungen.beschuldigungen,
        verdacht: Object.fromEntries(
          Object.keys(kampagne.fall.aufenthalt).map((id) => [
            id,
            admin.einstellungen.startverdacht,
          ]),
        ),
        notizen: [notiz(kampagne.fall.tatbeschreibung, "Fallakte")],
      });
    },
    [admin.einstellungen],
  );

  const gehZuOrt = useCallback((ortId: string) => {
    setStand((alt) => ({
      ...alt,
      ortId,
      besuchteOrte: alt.besuchteOrte.includes(ortId)
        ? alt.besuchteOrte
        : [...alt.besuchteOrte, ortId],
    }));
  }, []);

  const umsehen = useCallback(async (): Promise<string | null> => {
    const jetzt = standRef.current;
    if (!jetzt.siegel) return null;
    setFehler(null);
    setLaedt("suche");
    try {
      const daten = await post<{
        spur: { itemId: string; name: string; bedeutung: string } | null;
        text: string;
      }>("/api/search", {
        siegel: jetzt.siegel,
        ortId: jetzt.ortId,
        gefundeneSpuren: jetzt.gefundeneSpuren,
      });

      if (daten.spur) {
        setStand((alt) => ({
          ...alt,
          gefundeneSpuren: [...alt.gefundeneSpuren, daten.spur!.itemId],
          notizen: [
            ...alt.notizen,
            notiz(`${daten.spur!.name}: ${daten.spur!.bedeutung}`, "Fund"),
          ],
        }));
      }
      return daten.text;
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Unbekannter Fehler");
      return null;
    } finally {
      setLaedt(null);
    }
  }, []);

  const sprich = useCallback(
    async (charakterId: string, modus: TalkMode, nachricht: string) => {
      const jetzt = standRef.current;
      if (!jetzt.siegel) return;
      setFehler(null);
      setLaedt("gespraech");

      const eigenerZug: ChatTurn = { role: "wimpy", text: nachricht, mode: modus };
      setStand((alt) => ({
        ...alt,
        verlauf: {
          ...alt.verlauf,
          [charakterId]: [...(alt.verlauf[charakterId] ?? []), eigenerZug],
        },
      }));

      try {
        const daten = await post<TalkResult>("/api/talk", {
          siegel: jetzt.siegel,
          charakterId,
          ortId: jetzt.ortId,
          modus,
          nachricht,
          verlauf: jetzt.verlauf[charakterId] ?? [],
          gefundeneSpuren: jetzt.gefundeneSpuren,
        });

        setStand((alt) => {
          const neueSpuren =
            daten.gefundeneSpurItemId &&
            !alt.gefundeneSpuren.includes(daten.gefundeneSpurItemId)
              ? [...alt.gefundeneSpuren, daten.gefundeneSpurItemId]
              : alt.gefundeneSpuren;

          const neueNotizen = daten.neueNotiz
            ? [...alt.notizen, notiz(daten.neueNotiz, charakterId)]
            : alt.notizen;

          return {
            ...alt,
            gefundeneSpuren: neueSpuren,
            notizen: neueNotizen,
            verdacht: {
              ...alt.verdacht,
              [charakterId]: Math.max(
                0,
                Math.min(
                  100,
                  (alt.verdacht[charakterId] ?? 0) +
                    daten.verdachtsaenderung,
                ),
              ),
            },
            verlauf: {
              ...alt.verlauf,
              [charakterId]: [
                ...(alt.verlauf[charakterId] ?? []),
                { role: "character", text: daten.antwort } satisfies ChatTurn,
              ],
            },
          };
        });
      } catch (error) {
        setFehler(error instanceof Error ? error.message : "Unbekannter Fehler");
        // Die eigene Frage zurücknehmen, damit man sie erneut stellen kann.
        setStand((alt) => ({
          ...alt,
          verlauf: {
            ...alt.verlauf,
            [charakterId]: (alt.verlauf[charakterId] ?? []).slice(0, -1),
          },
        }));
      } finally {
        setLaedt(null);
      }
    },
    [],
  );

  const beschuldige = useCallback(
    async (charakterId: string, begruendung: string) => {
      const jetzt = standRef.current;
      if (!jetzt.siegel) return;
      setFehler(null);
      setLaedt("urteil");
      try {
        const daten = await post<Ergebnis>("/api/accuse", {
          siegel: jetzt.siegel,
          charakterId,
          begruendung,
          gefundeneSpuren: jetzt.gefundeneSpuren,
        });

        setStand((alt) => {
          const uebrig = alt.beschuldigungenUebrig - 1;
          const vorbei = daten.richtig || uebrig <= 0;
          return {
            ...alt,
            beschuldigungenUebrig: uebrig,
            status: vorbei ? "beendet" : alt.status,
            ergebnis: vorbei ? { ...daten, beschuldigtId: charakterId } : alt.ergebnis,
            notizen: vorbei
              ? alt.notizen
              : [
                  ...alt.notizen,
                  notiz(
                    `Beschuldigung daneben. ${daten.reaktion}`,
                    charakterId,
                  ),
                ],
          };
        });

        return daten;
      } catch (error) {
        setFehler(error instanceof Error ? error.message : "Unbekannter Fehler");
        return null;
      } finally {
        setLaedt(null);
      }
    },
    [],
  );

  const aufgeben = useCallback(() => {
    setStand(LEER);
  }, []);

  return {
    stand,
    geladen,
    laedt,
    fehler,
    setFehler,
    neuerFall,
    kampagneStarten,
    gehZuOrt,
    umsehen,
    sprich,
    beschuldige,
    aufgeben,
  };
}
