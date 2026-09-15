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
