import { AUTO_MODELLE } from "./autos";
import { DREI_D_LOCATIONS, dateienFuer3D, type Kapitel3DVorgabe } from "./pursuit3d";
import { gebaeudeArten, planGueltig } from "./stadtplan";
import { modellFuerTier, spielerModell } from "./tiermodelle";
import type { Character } from "./types";

/**
 * Die großen 3D-Dateien holen, bevor jemand darauf wartet.
 *
 * Eine Stadt besteht aus Bausteinen von acht bis siebenundzwanzig Megabyte.
 * Wer sie erst lädt, wenn das Kapitel beginnt, schaut auf "Die Stadt wird
 * aufgebaut …" - und zwar genau in dem Moment, in dem es losgehen soll.
 * Dabei sitzt der Spieler davor oft schon eine Minute vor dem Vorspann und
 * den Erzählertexten. Genau diese Zeit wird hier benutzt.
 *
 * Geladen wird in den Zwischenspeicher von Three.js: Dieselbe Datei wird
 * später nicht noch einmal geholt, sondern nur noch ausgepackt. Die Rohdaten
 * gibt die Szene wieder frei, sobald sie ausgepackt sind - sonst lägen
 * hundert Megabyte im Speicher herum, die niemand mehr braucht.
 */

/** Was schon angefragt wurde - damit nichts zweimal durch die Leitung geht. */
const angefragt = new Set<string>();

/**
 * Nacheinander, nicht alles auf einmal.
 *
 * Sechs Dateien gleichzeitig blockieren auf dem Handy die Leitung für alles
 * andere - auch für die Anfrage, die den nächsten Fall erzeugt. Eine nach
 * der anderen ist im Zweifel später fertig, stört aber nichts.
 */
export async function vorladen(dateien: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  const offen = dateien.filter((datei) => datei && !angefragt.has(datei));
  if (!offen.length) return;
  for (const datei of offen) angefragt.add(datei);

  // Three.js wird hier erst geholt: So bleibt es aus dem Startpaket der Seite
  // heraus - und ist trotzdem schon da, wenn die Szene es braucht.
  const THREE = await import("three");
  THREE.Cache.enabled = true;
  for (const datei of offen) {
    if (THREE.Cache.get(datei)) continue;
    await new Promise<void>((fertig) => {
      new THREE.FileLoader()
        .setResponseType("arraybuffer")
        .load(datei, () => fertig(), undefined, () => {
          // Ein Fehlschlag ist kein Drama: Die Szene versucht es selbst noch
          // einmal. Nur gemerkt wird er nicht, damit sie es auch darf.
          angefragt.delete(datei);
          fertig();
        });
    });
  }
}

/** Nach dem Auspacken sind die Rohdaten nur noch Ballast. */
export async function vergessen(datei: string): Promise<void> {
  if (typeof window === "undefined") return;
  const THREE = await import("three");
  THREE.Cache.remove(datei);
  angefragt.delete(datei);
}

/**
 * Welche Dateien ein 3D-Kapitel braucht - Stadt und Figuren.
 *
 * Die Reihenfolge ist die, in der man sie sieht: erst die Stadt, dann Wimpy,
 * dann die anderen Tiere. Bricht das Vorladen ab, fehlt hinten etwas
 * Verschmerzbares.
 */
export function dreiDDateien(
  konfiguration: Kapitel3DVorgabe,
  besetzung: Character[] = [],
): string[] {
  const stadt = planGueltig(konfiguration.plan)
    ? gebaeudeArten(konfiguration.plan).flatMap((id) => {
        const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
        return ort ? [ort.datei] : [];
      })
    : dateienFuer3D(konfiguration.locations);

  const detektiv = besetzung.find((c) => c.istDetektiv);
  const figuren = [
    spielerModell(detektiv)?.datei,
    ...besetzung
      .filter((c) => !c.istDetektiv)
      .map((c, index) => modellFuerTier(c, index, konfiguration.charakterModelle?.[c.id])?.datei),
  ];
  return [...new Set([...stadt, ...figuren].filter((datei): datei is string => Boolean(datei)))];
}

/** Und was eine Verfolgungsjagd braucht: zwei Wagen und Wimpy am Straßenrand. */
export function jagdDateien(
  autos: { modell: string }[],
  detektiv?: Character,
): string[] {
  const wagen = autos.flatMap((auto) => {
    const modell = AUTO_MODELLE.find((m) => m.id === auto.modell);
    return modell ? [modell.datei] : [];
  });
  const figur = spielerModell(detektiv)?.datei;
  return [...new Set([...wagen, ...(figur ? [figur] : [])])];
}

/** Nur fürs Prüfen: Wurde diese Datei schon angefragt? */
export const schonAngefragt = (datei: string) => angefragt.has(datei);

/** Nur für Tests: alles vergessen. */
export const vorladenZuruecksetzen = () => angefragt.clear();
