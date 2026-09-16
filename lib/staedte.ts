import {
  beispielPlan,
  gebaeudeArten,
  gebaeudeFelder,
  planGueltig,
  planLesen,
  strassenFelder,
  type Stadtplan,
} from "./stadtplan";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "./pursuit3d";

/**
 * Eine fertig geplante Stadt.
 *
 * Bisher wurde jeder Stadtplan dort gelegt, wo er gebraucht wurde - einmal in
 * der Probewelt, einmal je 3D-Kapitel einer Saga. Wer eine Stadt gut fand,
 * musste sie beim nächsten Mal neu malen.
 *
 * Eine Stadt ist deshalb alles, was einen Ort ausmacht: das Raster, die
 * Tankstelle, der Straßenbelag und das Licht, in dem man sie zum ersten Mal
 * sieht. Einmal angelegt, lässt sie sich überall auswählen.
 *
 * Ausgewählt heißt dabei immer: abgeschrieben, nicht verknüpft. Eine Saga
 * trägt ihre Stadt danach selbst - sonst würde ein Spieler mitten im Kapitel
 * in einer anderen Stadt aufwachen, weil jemand im Admin-Menü eine Straße
 * verschoben hat.
 */
export type Stadt = {
  id: string;
  name: string;
  /** Eine Zeile fürs Menü: wofür diese Stadt gedacht ist. */
  beschreibung: string;
  plan: Stadtplan;
  /** Welcher Baustein die Tankstelle ist; leer = am Namen erkennen. */
  tankstelleId: string;
  /** Und welcher die Polizeiwache - dort wird beschuldigt. */
  polizeiId: string;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  erstelltAm: number;
};

/** Was eine Stadt an ein 3D-Kapitel oder an die Probewelt weitergibt. */
export type StadtVorgabe = {
  plan: Stadtplan;
  locations: string[];
  tankstelleId: string;
  polizeiId: string;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
};

export const STRASSENTYPEN: DreiDStrassentyp[] = ["asphalt", "sand", "schnee"];
export const TAGESZEITEN: DreiDTageszeit[] = ["morgen", "tag", "abend", "nacht"];
export const WETTERLAGEN: DreiDWetter[] = [
  "klar",
  "sonne",
  "regen",
  "schnee",
  "schneesturm",
  "sandsturm",
  "nebel",
];

/** Eine neue, noch leere Stadt - mit einer Kreuzung zum Anfangen. */
export const neueStadt = (plan?: Stadtplan | null): Stadt => ({
  id: `stadt-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
  name: "Neue Stadt",
  beschreibung: "",
  // Mit einer Kreuzung zum Anfangen: So ist die Stadt vom ersten Moment an
  // begehbar, und man baut die Häuser daran entlang statt ins Leere.
  plan: planGueltig(plan) ? plan : beispielPlan(7, 7),
  tankstelleId: "",
  polizeiId: "",
  strassentyp: "asphalt",
  tageszeit: "tag",
  wetter: "klar",
  erstelltAm: Date.now(),
});

/**
 * Eine Stadt taugt erst etwas, wenn sie einen Namen hat und man sich auf ihr
 * bewegen kann. Alles Weitere darf fehlen.
 */
export const stadtGueltig = (stadt: Stadt | null | undefined): stadt is Stadt =>
  Boolean(stadt && stadt.id && stadt.name.trim() && planGueltig(stadt.plan));

/**
 * Aus der Datenbank kommt, was irgendwann einmal hineingeschrieben wurde.
 * Hier wird daraus wieder etwas Brauchbares - oder nichts.
 */
export function stadtLesen(roh: unknown): Stadt | null {
  if (!roh || typeof roh !== "object") return null;
  const wert = roh as Partial<Stadt>;
  const plan = planLesen(wert.plan);
  if (!plan || typeof wert.id !== "string" || !wert.id) return null;
  const name = typeof wert.name === "string" ? wert.name.trim().slice(0, 80) : "";
  if (!name) return null;
  const ausWahl = <T extends string>(kandidat: unknown, erlaubt: T[], standard: T): T =>
    erlaubt.includes(kandidat as T) ? (kandidat as T) : standard;
  return {
    id: wert.id,
    name,
    beschreibung: typeof wert.beschreibung === "string" ? wert.beschreibung.slice(0, 400) : "",
    plan,
    tankstelleId: typeof wert.tankstelleId === "string" ? wert.tankstelleId.slice(0, 80) : "",
    polizeiId: typeof wert.polizeiId === "string" ? wert.polizeiId.slice(0, 80) : "",
    strassentyp: ausWahl(wert.strassentyp, STRASSENTYPEN, "asphalt"),
    tageszeit: ausWahl(wert.tageszeit, TAGESZEITEN, "tag"),
    wetter: ausWahl(wert.wetter, WETTERLAGEN, "klar"),
    erstelltAm: Number.isFinite(wert.erstelltAm) ? Number(wert.erstelltAm) : 0,
  };
}

/**
 * Was ein 3D-Kapitel von einer Stadt übernimmt.
 *
 * Die Bausteinliste wird dabei aus dem Plan abgelesen: Sie ist es, die im
 * Editor die Tankstellenauswahl füllt, und sie hält das Kapitel spielbar,
 * falls der Plan später doch einmal verlorengeht.
 */
export const stadtVorgabe = (stadt: Stadt): StadtVorgabe => ({
  plan: stadt.plan,
  locations: gebaeudeArten(stadt.plan),
  tankstelleId: stadt.tankstelleId,
  polizeiId: stadt.polizeiId,
  strassentyp: stadt.strassentyp,
  tageszeit: stadt.tageszeit,
  wetter: stadt.wetter,
});

/** Eine Zeile über die Stadt, wie sie im Menü steht. */
export const stadtZeile = (stadt: Stadt): string => {
  const haeuser = gebaeudeFelder(stadt.plan).length;
  const strassen = strassenFelder(stadt.plan).length;
  const arten = gebaeudeArten(stadt.plan).length;
  return `${stadt.plan.breite}×${stadt.plan.tiefe} · ${strassen} Straßenfeld${strassen === 1 ? "" : "er"}` +
    ` · ${haeuser} Gebäude aus ${arten} Bauart${arten === 1 ? "" : "en"}`;
};

/** Neueste zuerst - so steht die frisch gebaute Stadt oben. */
export const stadtRegal = (staedte: Stadt[]): Stadt[] =>
  [...staedte].sort((a, b) => (b.erstelltAm || 0) - (a.erstelltAm || 0));
