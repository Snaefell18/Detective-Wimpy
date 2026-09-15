import { DREI_D_LOCATIONS } from "./pursuit3d";

/**
 * Ein selbst gelegter Stadtplan für ein 3D-Kapitel.
 *
 * Bisher entsteht die 3D-Stadt als Straßenzug: Bausteine werden hintereinander
 * gereiht, und Wimpy läuft den Korridor auf und ab. Das bleibt so. Wer mehr
 * will, legt stattdessen hier ein Raster aus: Jedes Feld ist entweder leer,
 * eine Straße oder ein Gebäude - und aus Straßenfeldern werden von selbst
 * Kreuzungen, Ecken und Sackgassen, je nachdem, was danebenliegt.
 *
 * Absichtlich klein gehalten: ein Raster, eine Zeichenkette je Feld. Das lässt
 * sich im Admin-Menü mit dem Daumen malen, versiegeln und ohne Umweg wieder
 * einlesen - und jede Regel darüber (was begehbar ist, wo Tiere stehen) ist
 * eine reine Rechnung, die man prüfen kann.
 */

/** Kantenlänge eines Rasterfeldes in Weltmetern - eine Straßenbreite. */
export const FELD_GROESSE = 9;

/** Was auf einem Feld steht, wenn es eine Straße ist. */
export const STRASSE = "strasse";

export type Stadtplan = {
  /** Felder in x-Richtung. */
  breite: number;
  /** Felder in z-Richtung. */
  tiefe: number;
  /**
   * Je Feld: "" für nichts, "strasse" für begehbare Straße, sonst die Id
   * eines 3D-Bausteins, der dort als Gebäude steht. Zeilenweise von vorn
   * (kleines z) nach hinten, in jeder Zeile von links nach rechts.
   */
  felder: string[];
  /** Zusätzliche Drehung einzelner Gebäude in Grad, Schlüssel "x,z". */
  drehungen: Record<string, number>;
};

export const PLAN_MASSE = { min: 3, max: 14 };

/** Ein leerer Plan in der gewünschten Größe. */
export const leererPlan = (breite = 7, tiefe = 7): Stadtplan => ({
  breite: grenzen(breite),
  tiefe: grenzen(tiefe),
  felder: Array.from({ length: grenzen(breite) * grenzen(tiefe) }, () => ""),
  drehungen: {},
});

const grenzen = (wert: number) =>
  Math.max(PLAN_MASSE.min, Math.min(PLAN_MASSE.max, Math.round(Number(wert) || 0)));

/** Ein Plan mit einer Kreuzung in der Mitte - der Anfang für alles Weitere. */
export function beispielPlan(breite = 7, tiefe = 7): Stadtplan {
  const plan = leererPlan(breite, tiefe);
  const mitteX = Math.floor(plan.breite / 2);
  const mitteZ = Math.floor(plan.tiefe / 2);
  for (let x = 0; x < plan.breite; x++) plan.felder[mitteZ * plan.breite + x] = STRASSE;
  for (let z = 0; z < plan.tiefe; z++) plan.felder[z * plan.breite + mitteX] = STRASSE;
  return plan;
}

const index = (plan: Stadtplan, x: number, z: number) => z * plan.breite + x;

export const imPlan = (plan: Stadtplan, x: number, z: number) =>
  x >= 0 && z >= 0 && x < plan.breite && z < plan.tiefe;

/** Was auf einem Feld steht - außerhalb des Plans ist nichts. */
export const feldAn = (plan: Stadtplan, x: number, z: number): string =>
  imPlan(plan, x, z) ? (plan.felder[index(plan, x, z)] ?? "") : "";

export const istStrasse = (plan: Stadtplan, x: number, z: number) =>
  feldAn(plan, x, z) === STRASSE;

/** Ein Feld setzen - gibt einen neuen Plan zurück, der alte bleibt. */
export function feldSetzen(plan: Stadtplan, x: number, z: number, wert: string): Stadtplan {
  if (!imPlan(plan, x, z)) return plan;
  const felder = [...plan.felder];
  felder[index(plan, x, z)] = wert;
  const drehungen = { ...plan.drehungen };
  // Leere und Straßen tragen keine Drehung mit sich herum.
  if (wert === "" || wert === STRASSE) delete drehungen[`${x},${z}`];
  return { ...plan, felder, drehungen };
}

/** Ein Gebäude um 90 Grad weiterdrehen. */
export function feldDrehen(plan: Stadtplan, x: number, z: number): Stadtplan {
  const wert = feldAn(plan, x, z);
  if (!wert || wert === STRASSE) return plan;
  const schluessel = `${x},${z}`;
  return {
    ...plan,
    drehungen: { ...plan.drehungen, [schluessel]: ((plan.drehungen[schluessel] ?? 0) + 90) % 360 },
  };
}

export const drehungAn = (plan: Stadtplan, x: number, z: number) =>
  plan.drehungen[`${x},${z}`] ?? 0;

/** Den Plan vergrößern oder verkleinern; vorhandene Felder bleiben liegen. */
export function planGroesse(plan: Stadtplan, breite: number, tiefe: number): Stadtplan {
  const neu = leererPlan(breite, tiefe);
  for (let z = 0; z < neu.tiefe; z++) {
    for (let x = 0; x < neu.breite; x++) {
      neu.felder[z * neu.breite + x] = feldAn(plan, x, z);
      const grad = plan.drehungen[`${x},${z}`];
      if (grad) neu.drehungen[`${x},${z}`] = grad;
    }
  }
  return neu;
}

/**
 * Die Mitte eines Feldes in Weltkoordinaten.
 *
 * Der Plan liegt um den Ursprung herum: So steht Wimpy beim Start mitten in
 * der Stadt und nicht in einer Ecke.
 */
export function feldMitte(plan: Stadtplan, x: number, z: number): { x: number; z: number } {
  return {
    x: (x - (plan.breite - 1) / 2) * FELD_GROESSE,
    z: (z - (plan.tiefe - 1) / 2) * FELD_GROESSE,
  };
}

/** Und zurück: In welchem Feld liegt dieser Punkt? */
export function feldBei(plan: Stadtplan, weltX: number, weltZ: number): { x: number; z: number } {
  return {
    x: Math.round(weltX / FELD_GROESSE + (plan.breite - 1) / 2),
    z: Math.round(weltZ / FELD_GROESSE + (plan.tiefe - 1) / 2),
  };
}

/**
 * Darf Wimpy hier stehen?
 *
 * Geprüft wird nicht nur der Punkt, sondern ein kleiner Kreis darum - sonst
 * stünde er mit der Schulter in der Hauswand. Dadurch entstehen auch die
 * Endpunkte von selbst: Wo die Straße aufhört, ist der nächste Schritt
 * einfach nicht mehr erlaubt.
 */
export function begehbar(plan: Stadtplan, weltX: number, weltZ: number, radius = 0.7): boolean {
  for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    const feld = feldBei(plan, weltX + dx, weltZ + dz);
    if (!istStrasse(plan, feld.x, feld.z)) return false;
  }
  return true;
}

/** Alle begehbaren Felder - in fester Reihenfolge. */
export function strassenFelder(plan: Stadtplan): { x: number; z: number }[] {
  const felder: { x: number; z: number }[] = [];
  for (let z = 0; z < plan.tiefe; z++) {
    for (let x = 0; x < plan.breite; x++) if (istStrasse(plan, x, z)) felder.push({ x, z });
  }
  return felder;
}

/** Alle Gebäude mit ihrer Position - nur bekannte Bausteine. */
export function gebaeudeFelder(plan: Stadtplan): { x: number; z: number; id: string; drehung: number }[] {
  const bekannt = new Set<string>(DREI_D_LOCATIONS.map((ort) => ort.id));
  const felder: { x: number; z: number; id: string; drehung: number }[] = [];
  for (let z = 0; z < plan.tiefe; z++) {
    for (let x = 0; x < plan.breite; x++) {
      const wert = feldAn(plan, x, z);
      if (wert && wert !== STRASSE && bekannt.has(wert)) {
        felder.push({ x, z, id: wert, drehung: drehungAn(plan, x, z) });
      }
    }
  }
  return felder;
}

/** Wo der Spieler anfängt: möglichst mittig auf der Straße. */
export function startFeld(plan: Stadtplan): { x: number; z: number } | null {
  const strassen = strassenFelder(plan);
  if (!strassen.length) return null;
  const mitte = { x: (plan.breite - 1) / 2, z: (plan.tiefe - 1) / 2 };
  return strassen.reduce((beste, feld) =>
    Math.hypot(feld.x - mitte.x, feld.z - mitte.z) < Math.hypot(beste.x - mitte.x, beste.z - mitte.z)
      ? feld
      : beste,
  );
}

/**
 * Tiere und Fundstücke über die Stadt verteilen.
 *
 * Sie stehen weiterhin zufällig herum, aber nie zu zweit auf demselben Fleck
 * und nie im Startfeld - sonst begrüßt einen die halbe Besetzung beim
 * Aufwachen. `zufall` ist hereingereicht, damit die Verteilung prüfbar bleibt.
 */
export function verteilen(
  plan: Stadtplan,
  anzahl: number,
  zufall: () => number = Math.random,
): { x: number; z: number }[] {
  const start = startFeld(plan);
  const frei = strassenFelder(plan).filter((feld) => !start || feld.x !== start.x || feld.z !== start.z);
  if (!frei.length || anzahl <= 0) return [];
  // Gemischte Reihenfolge, dann der Reihe nach - so bleibt niemand doppelt.
  const gemischt = [...frei];
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1)) % (i + 1);
    [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }
  return Array.from({ length: anzahl }, (_, i) => {
    const feld = gemischt[i % gemischt.length];
    const mitte = feldMitte(plan, feld.x, feld.z);
    // Innerhalb des Feldes ein wenig streuen, damit nichts in Reih und Glied steht.
    const runde = Math.floor(i / gemischt.length);
    const streuung = (wert: number) => wert + ((zufall() - 0.5) * FELD_GROESSE * 0.45) + runde * 0.6;
    return { x: streuung(mitte.x), z: streuung(mitte.z) };
  });
}

/** Ein Plan taugt erst etwas, wenn man sich darauf bewegen kann. */
export const planGueltig = (plan: Stadtplan | null | undefined): plan is Stadtplan =>
  Boolean(plan && plan.breite >= PLAN_MASSE.min && plan.tiefe >= PLAN_MASSE.min &&
    plan.felder.length === plan.breite * plan.tiefe && strassenFelder(plan).length >= 2);

/** Wie groß die Stadt in Weltmetern ist - für Boden, Nebel und Kamera. */
export const planAusmass = (plan: Stadtplan) => ({
  breite: plan.breite * FELD_GROESSE,
  tiefe: plan.tiefe * FELD_GROESSE,
});
