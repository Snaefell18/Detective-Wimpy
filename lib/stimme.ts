"use client";

import { adminToken } from "./akte";
import { postJson } from "./api";
import { ladeStimme, speichereStimme } from "./db";

/**
 * Gesprochene Erzählertexte.
 *
 * Der Weg ist zweigeteilt, und zwar mit Absicht:
 *
 * 1. Im Admin-Menü wird ein Text EINMAL gesprochen (kostet einmal Geld) und
 *    die Aufnahme in der Datenbank abgelegt. Der Erzählerteil merkt sich nur
 *    "stimme:<id>".
 * 2. Im Spiel wird nichts erzeugt, nur geladen. Kein Schlüssel im Browser,
 *    keine Kosten pro Runde, und ohne Netz spielt der Zwischenspeicher von
 *    Firestore mit.
 *
 * Eine von Hand abgelegte Datei ("/audio/…") funktioniert unverändert weiter.
 */

const PRAEFIX = "stimme:";

export const istStimme = (audio: string): boolean => audio.startsWith(PRAEFIX);

/** Einmal gehört, bleibt im Speicher - dasselbe Kapitel klingt oft mehrfach. */
const gemerkt = new Map<string, string>();

/**
 * Aus dem Feld eines Erzählerteils die Quelle machen, die ein <audio> kennt.
 * Pfade bleiben Pfade; nur "stimme:<id>" wird nachgeschlagen.
 */
export async function tonQuelle(audio: string): Promise<string> {
  if (!audio || !istStimme(audio)) return audio;

  const id = audio.slice(PRAEFIX.length);
  const bekannt = gemerkt.get(id);
  if (bekannt) return bekannt;

  const stimme = await ladeStimme(id);
  if (!stimme?.audio) return "";
  gemerkt.set(id, stimme.audio);
  return stimme.audio;
}

/** Firestore-Dokumente dürfen 1 MB groß sein - base64 bläht auf 4/3 auf. */
const MAX_BYTES = 700_000;

/**
 * Eine eigene Tondatei in die Datenbank legen - für kurze Effekte, die auf
 * jedem Gerät gleich klingen sollen, ohne dass man sie ins Projekt legt.
 */
export async function dateiAlsStimme(datei: File): Promise<string> {
  if (datei.size > MAX_BYTES) {
    throw new Error(
      `Die Datei ist mit ${Math.round(datei.size / 1000)} KB zu groß - höchstens ${
        MAX_BYTES / 1000
      } KB. Ein kurzer Effekt reicht völlig.`,
    );
  }

  const daten = await new Promise<string>((fertig, schiefgelaufen) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.onerror = () => schiefgelaufen(new Error("Die Datei ließ sich nicht lesen."));
    leser.readAsDataURL(datei);
  });

  const id = crypto.randomUUID();
  await speichereStimme({ id, audio: daten, text: datei.name, erstelltAm: Date.now() });
  gemerkt.set(id, daten);
  return `${PRAEFIX}${id}`;
}

/**
 * Einen Text sprechen lassen und die Aufnahme speichern - nur im Admin-Menü.
 * Zurück kommt der Wert fürs Feld "audio".
 */
export async function spracheErzeugen(text: string): Promise<string> {
  const antwort = await postJson<{ audio: string; bytes: number }>(
    "/api/stimme",
    { text },
    75,
    { "x-admin-token": adminToken() },
  );

  const id = crypto.randomUUID();
  await speichereStimme({ id, audio: antwort.audio, text, erstelltAm: Date.now() });
  gemerkt.set(id, antwort.audio);
  return `${PRAEFIX}${id}`;
}
