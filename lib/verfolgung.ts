import {
  DREI_D_LOCATIONS,
  type DreiDStrassentyp,
  type DreiDTageszeit,
  type DreiDWetter,
} from "./pursuit3d";
import { STRASSENTYPEN, TAGESZEITEN, WETTERLAGEN } from "./staedte";

/** Die beiden prozedural gebauten Fahrerfiguren der Schneejagd. */
export type VerfolgerModell = "schaf" | "yeti";

export type VerfolgerRolle = {
  charakterId: string;
  modell: VerfolgerModell;
};

/** Eine spielbare Verfolgungsjagd in der Lücke zwischen zwei Saga-Kapiteln. */
export type VerfolgungVorgabe = {
  id: string;
  /** Nach welchem Kapitel sie stattfindet (1-basiert). */
  nachKapitel: number;
  name: string;
  /** Dieses Tier sitzt im weißen Wagen, bleibt während der Fahrt aber unsichtbar. */
  fliehenderId: string;
  /** Auto aus dem zentralen Autokatalog. Alte Jagden nutzen den Sportwagen. */
  fluchtAutoId?: string;
  /**
   * Zusätzliche Drehung des Fluchtwagens in Grad.
   *
   * Jedes 3D-Modell steht in seiner eigenen Blickrichtung in der Datei. Der
   * Autokatalog gleicht das mit `drehung` aus - hier kommt dazu, was nur für
   * diese Jagd gilt. 180 dreht den Wagen also um, wenn er verkehrt herum
   * vorausfährt. Fehlt der Wert, bleibt alles wie im Katalog.
   */
  fluchtDrehung?: number;
  /** Legacy-Daten alter Sagas; die neue Jagd wird immer von Wimpy gefahren. */
  verfolger: [VerfolgerRolle, VerfolgerRolle];
  /**
   * Wo gefahren wird - dieselben Begriffe wie in jeder anderen 3D-Welt.
   *
   * Die Jagd war lange eine einzige Landschaft: Schnee, Dämmerung, ein paar
   * Tannen. Jetzt ist sie eine Strecke wie die Stadt auch: ein Belag, ein
   * Licht, ein Wetter - und Bausteine, an denen man vorbeifährt.
   *
   * Alles davon darf fehlen. Ältere Jagden haben keine dieser Angaben, und
   * für sie gilt genau das, was vorher zu sehen war (siehe JAGD_WELT).
   */
  strassentyp?: DreiDStrassentyp;
  tageszeit?: DreiDTageszeit;
  wetter?: DreiDWetter;
  /**
   * Die 3D-Bausteine, die am Straßenrand vorbeiziehen - Ids aus
   * DREI_D_LOCATIONS.
   *
   * Sie wiederholen sich, solange die Jagd dauert: Wer eine Strecke durch
   * Akihabara fährt, fährt an denselben Häusern mehrfach vorbei. Leer heißt:
   * nur die Landschaft, wie es sie immer gab.
   */
  locations?: string[];
  /** Optionaler Song, der nur während der eigentlichen Fahrt läuft. */
  musik: string;
  /** Redaktionshilfe für das Statement und die Einordnung im Editor. */
  fluchtgrund: string;
  /** Wörtliche Rede nach dem Fang. Leer = ein sicherer Standardsatz. */
  statement: string;
};

/** Die Verfolgung direkt nach einem Kapitel, sofern dort eine liegt. */
export function verfolgungNach(
  vorgaben: { verfolgungsjagden?: VerfolgungVorgabe[] } | undefined,
  kapitel: number,
): VerfolgungVorgabe | null {
  if (!Number.isFinite(kapitel) || kapitel < 1) return null;
  return (
    vorgaben?.verfolgungsjagden?.find(
      (v) => v && Math.round(Number(v.nachKapitel)) === Math.round(kapitel),
    ) ?? null
  );
}

/** Das Statement soll auch bei älteren oder knapp angelegten Jagden funktionieren. */
export function fluchtStatement(vorgabe: VerfolgungVorgabe): string {
  const fertig = vorgabe.statement.trim();
  if (fertig) return fertig;
  const grund = vorgabe.fluchtgrund.trim().replace(/^weil\s+/i, "");
  return grund
    ? `Ich bin geflohen, weil ${grund.replace(/[.!?]+$/, "")}. Ich wollte niemanden hineinziehen.`
    : "Ich bin nicht vor euch geflohen. Ich wollte verhindern, dass mir jemand bis zum Versteck folgt.";
}

export const VERFOLGER_MODELLE: {
  id: VerfolgerModell;
  name: string;
  beschreibung: string;
}[] = [
  {
    id: "schaf",
    name: "Schneeschaf",
    beschreibung: "Rund, mutig und mit einem flatternden roten Schal.",
  },
  {
    id: "yeti",
    name: "Zottel-Yeti",
    beschreibung: "Gesichtslos, langhaarig und nach der weißen Plüschgestalt modelliert.",
  },
];

/**
 * Wie eine Jagd aussieht, wenn nichts eingestellt ist.
 *
 * Das ist genau die Landschaft, durch die bisher jede Jagd führte: eine
 * Schneepiste in der Dämmerung. Wer eine alte Saga weiterspielt, soll nicht
 * plötzlich durch Tokio fahren.
 */
export type JagdWelt = {
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  /** Die Bausteine am Straßenrand - leer heißt: nur Landschaft. */
  locations: string[];
};

export const JAGD_WELT: JagdWelt = {
  strassentyp: "schnee",
  // Die Jagd fuhr immer schon durch eine blaue Nacht - das bleibt so, solange
  // niemand etwas anderes einstellt.
  tageszeit: "nacht",
  wetter: "klar",
  locations: [],
};

/**
 * Die Welt dieser Jagd - mit allem, was fehlt, aufgefüllt.
 *
 * Unbekannte Bausteine fliegen dabei heraus: Eine Jagd, die auf eine Datei
 * zeigt, die es nicht mehr gibt, soll ohne sie fahren und nicht abstürzen.
 */
export function jagdWelt(vorgabe: Partial<VerfolgungVorgabe> | null | undefined): JagdWelt {
  const erlaubt = <T extends string>(wert: unknown, liste: readonly T[], standard: T): T =>
    liste.includes(wert as T) ? (wert as T) : standard;
  // Gewählt werden kann genau das, was auch eine Stadt kennt - eine Liste,
  // nicht drei abgeschriebene.
  return {
    strassentyp: erlaubt(vorgabe?.strassentyp, STRASSENTYPEN, JAGD_WELT.strassentyp),
    tageszeit: erlaubt(vorgabe?.tageszeit, TAGESZEITEN, JAGD_WELT.tageszeit),
    wetter: erlaubt(vorgabe?.wetter, WETTERLAGEN, JAGD_WELT.wetter),
    locations: (vorgabe?.locations ?? []).filter((id) =>
      DREI_D_LOCATIONS.some((ort) => ort.id === id),
    ),
  };
}
