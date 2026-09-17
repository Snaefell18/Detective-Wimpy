/**
 * Der Endkampf - alles, was im Admin-Menü daran eingestellt wird.
 *
 * Ein Arc lief bisher in einen Text, ein Video oder einen Abspann, eine Saga
 * in einen Finalfall oder in den Gerichtssaal. Das hier ist der andere Weg:
 * Wimpy steht dem Culprit (oder dem Drahtzieher) gegenüber, und zwar
 * wirklich - in einer Arena, die man sich selbst baut, gegen einen Gegner,
 * der läuft, ausholt und zuschlägt. Dieselbe Vorgabe gilt an drei Stellen:
 * im Arc-Finale, im Saga-Finale und im 3D-Labor.
 *
 * Die Arena ist bewusst nichts Neues: Sie ist ein ganz normaler Stadtplan
 * (lib/stadtplan.ts). Dieselben Straßen, dieselben Bausteine, derselbe
 * Editor, dieselbe Leistungsrechnung fürs Handy - nur ohne Fall, ohne Spuren
 * und ohne Tiere, die herumstehen. Wer Häuser um einen freien Platz herum
 * setzt, bekommt eine Arena; wer ein Gassenkreuz malt, bekommt eine
 * Verfolgung durch enge Straßen. Beides funktioniert.
 *
 * Und davor darf, wer mag, noch die Verfolgungsjagd laufen lassen, die es
 * längst gibt (lib/verfolgung.ts): erst die Fahrt, dann der Kampf. Abwählbar
 * ist sie an zwei Stellen - im Editor, indem man sie gar nicht erst
 * einrichtet, und im Spiel, indem man sie überspringt.
 */

import { DREI_D_LOCATIONS } from "./pursuit3d";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "./pursuit3d";
import { KAMPF_STUFEN, type KampfStufe } from "./kampf";
import {
  STRASSE,
  feldSetzen,
  gebaeudeArten,
  leererPlan,
  planGueltig,
  planLesen,
  strassenFelder,
  type Stadtplan,
} from "./stadtplan";
import { mitKampf, type FinaleArt } from "./sagaFinale";
import { STRASSENTYPEN, TAGESZEITEN, WETTERLAGEN } from "./staedte";
import { jagdWelt, type VerfolgungVorgabe } from "./verfolgung";

export type KampfVorgabe = {
  /** Die Arena. Ohne gültigen Plan wird nicht gekämpft - siehe kampfSpielbar. */
  plan: Stadtplan | null;
  /** Welche Bausteine vorkommen; wird aus dem Plan abgelesen. */
  locations: string[];
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  /**
   * Das 3D-Modell des Culprits.
   *
   * Leer heißt: das Modell, das bei ihm in den Stammdaten steht - genau wie
   * in jedem 3D-Kapitel. Hier steht nur, was für diesen Kampf anders sein
   * soll, etwa eine größere, finsterere Gestalt.
   */
  gegnerModell: string;
  /** Größenfaktor des Gegners. 1 ist ein normales Tier, 1,6 ein Ungetüm. */
  gegnerGroesse: number;
  stufe: KampfStufe;
  /** Song während des Kampfes. Leer heißt: die übliche Musik läuft weiter. */
  musik: string;
  /** Was der Culprit sagt, wenn er am Boden liegt. */
  spruch: string;
  /**
   * Die Verfolgungsjagd davor - oder null.
   *
   * Es ist dieselbe Jagd wie zwischen zwei Kapiteln, mit demselben Editor und
   * derselben 3D-Szene. `nachKapitel` spielt hier keine Rolle und steht auf 0.
   */
  jagd: VerfolgungVorgabe | null;
};

/** Der Gegner darf zwischen Zwerg und Ungetüm alles sein. */
export const GROESSE_GRENZEN = { min: 0.6, max: 2.5 };

/**
 * Wie viele Straßenfelder eine Arena mindestens braucht.
 *
 * Auf drei Feldern steht man sich im Weg: Der Gegner ist ständig in
 * Schlagreichweite, ausweichen geht nicht, und aus dem Kampf wird ein
 * Schlagabtausch, den man nur verlieren kann. Neun Felder sind ein Platz,
 * auf dem man sich umeinander herumbewegt.
 */
export const MINDEST_FELDER = 9;

export const STANDARD_KAMPF: KampfVorgabe = {
  plan: null,
  locations: [],
  strassentyp: "asphalt",
  tageszeit: "nacht",
  wetter: "klar",
  gegnerModell: "",
  gegnerGroesse: 1.35,
  stufe: "mittel",
  musik: "",
  spruch: "",
  jagd: null,
};

/**
 * Ein Platz zum Kämpfen: freie Mitte, Häuser ringsum.
 *
 * Das ist der Startpunkt im Editor - danach darf man alles umbauen. Gebaut
 * wird bewusst mit wenigen Bauarten: Jede zusätzliche bringt ihre eigenen
 * Texturen mit, und die sind es, die ein Handy in die Knie zwingen
 * (siehe lib/dreiDLeistung.ts).
 */
export function arenaPlan(breite = 9, tiefe = 9): Stadtplan {
  let plan = leererPlan(breite, tiefe);
  // Zwei Bauarten reichen für eine geschlossene Häuserfront ringsum: eine
  // für die Ecken, eine für die Seiten. So sieht der Platz gebaut aus und
  // bleibt trotzdem leicht.
  const arten = DREI_D_LOCATIONS.map((ort) => ort.id);
  const seite = arten[0] ?? "";
  const ecke = arten[1] ?? seite;
  for (let z = 0; z < plan.tiefe; z++) {
    for (let x = 0; x < plan.breite; x++) {
      const amRand = x === 0 || z === 0 || x === plan.breite - 1 || z === plan.tiefe - 1;
      if (!amRand) {
        plan = feldSetzen(plan, x, z, STRASSE);
        continue;
      }
      const inDerEcke = (x === 0 || x === plan.breite - 1) && (z === 0 || z === plan.tiefe - 1);
      if (seite) plan = feldSetzen(plan, x, z, inDerEcke ? ecke : seite);
    }
  }
  return plan;
}

/**
 * Taugt diese Vorgabe für einen Kampf?
 *
 * Wenn nicht, fällt der Arc auf seinen Abschlusstext zurück, statt in eine
 * leere Szene zu laufen. Ein Finale, das nicht stattfindet, ist schlimmer als
 * eines, das nur vorgelesen wird.
 */
export const kampfSpielbar = (vorgabe: KampfVorgabe | undefined | null): vorgabe is KampfVorgabe =>
  Boolean(vorgabe && planGueltig(vorgabe.plan) && strassenFelder(vorgabe.plan).length >= MINDEST_FELDER);

/** Was im Editor unter der Arena steht. */
export function kampfZeile(vorgabe: KampfVorgabe): string {
  if (!vorgabe.plan) return "Noch keine Arena gebaut - gekämpft wird auf dem Standardplatz.";
  const felder = strassenFelder(vorgabe.plan).length;
  const arten = gebaeudeArten(vorgabe.plan).length;
  const stufe = KAMPF_STUFEN.find((s) => s.id === vorgabe.stufe)?.label ?? vorgabe.stufe;
  return (
    `${vorgabe.plan.breite}×${vorgabe.plan.tiefe} · ${felder} Kampffeld${felder === 1 ? "" : "er"}` +
    ` aus ${arten} Bauart${arten === 1 ? "" : "en"} · Stufe ${stufe}` +
    (vorgabe.jagd ? " · mit Verfolgungsjagd davor" : "")
  );
}

/** Eine frische Jagd vor dem Kampf - im weißen Wagen sitzt der Culprit selbst. */
export const neueKampfJagd = (culpritId: string, name: string): VerfolgungVorgabe => ({
  id: "jagd-vor-dem-finale",
  // Die Jagd hängt am Finale, nicht an einem Kapitel. Die Null sagt genau das.
  nachKapitel: 0,
  name: name.trim() ? `${name.trim()} - die letzte Fahrt` : "Die letzte Fahrt",
  fliehenderId: culpritId,
  fluchtAutoId: "auto-sport",
  verfolger: [
    { charakterId: "wimpy", modell: "schaf" },
    { charakterId: "wimpy", modell: "yeti" },
  ],
  musik: "",
  fluchtgrund: "er wusste, dass Wimpy ihn endlich erkannt hat",
  statement: "",
});

const ausWahl = <T extends string>(kandidat: unknown, erlaubt: readonly T[], standard: T): T =>
  erlaubt.includes(kandidat as T) ? (kandidat as T) : standard;

const text = (roh: unknown, laenge: number): string =>
  typeof roh === "string" ? roh.slice(0, laenge) : "";

/**
 * Eine Kampfvorgabe aus der Datenbank lesen.
 *
 * Arcs liegen seit Langem in Firestore, und dieses Feld kam später dazu.
 * Deshalb wird hier nichts vorausgesetzt: Was fehlt, bekommt seinen
 * Standardwert, was nicht stimmt, fliegt heraus - und wenn gar nichts
 * Brauchbares dasteht, kommt null zurück und der Arc endet wie früher.
 */
export function kampfLesen(roh: unknown): KampfVorgabe | null {
  if (!roh || typeof roh !== "object") return null;
  const wert = roh as Partial<KampfVorgabe>;
  const plan = planLesen(wert.plan);
  const groesse = Number(wert.gegnerGroesse);
  return {
    plan,
    // Die Bausteinliste steht im Plan; sie noch einmal zu speichern wäre eine
    // zweite Wahrheit. Gelesen wird deshalb der Plan.
    locations: plan ? gebaeudeArten(plan) : [],
    strassentyp: ausWahl(wert.strassentyp, STRASSENTYPEN, STANDARD_KAMPF.strassentyp),
    tageszeit: ausWahl(wert.tageszeit, TAGESZEITEN, STANDARD_KAMPF.tageszeit),
    wetter: ausWahl(wert.wetter, WETTERLAGEN, STANDARD_KAMPF.wetter),
    gegnerModell: text(wert.gegnerModell, 80),
    gegnerGroesse: Number.isFinite(groesse)
      ? Math.min(GROESSE_GRENZEN.max, Math.max(GROESSE_GRENZEN.min, Math.round(groesse * 20) / 20))
      : STANDARD_KAMPF.gegnerGroesse,
    stufe: ausWahl(wert.stufe, KAMPF_STUFEN.map((s) => s.id), STANDARD_KAMPF.stufe),
    musik: text(wert.musik, 200),
    spruch: text(wert.spruch, 1200),
    jagd: jagdLesen(wert.jagd),
  };
}

/** Die Jagd davor - wieder so, dass eine halb ausgefüllte niemandem schadet. */
function jagdLesen(roh: unknown): VerfolgungVorgabe | null {
  if (!roh || typeof roh !== "object") return null;
  const wert = roh as Partial<VerfolgungVorgabe>;
  const fliehenderId = text(wert.fliehenderId, 80);
  if (!fliehenderId) return null;
  const drehung = Number(wert.fluchtDrehung);
  return {
    id: text(wert.id, 80) || "jagd-vor-dem-finale",
    nachKapitel: 0,
    name: text(wert.name, 160) || "Die letzte Fahrt",
    fliehenderId,
    fluchtAutoId: text(wert.fluchtAutoId, 80) || "auto-sport",
    fluchtDrehung: Number.isFinite(drehung) ? ((Math.round(drehung / 90) * 90) % 360 + 360) % 360 : 0,
    verfolger: [
      { charakterId: "wimpy", modell: "schaf" },
      { charakterId: "wimpy", modell: "yeti" },
    ],
    // Belag, Licht, Wetter und Bausteine der Strecke - fehlt etwas, gilt die
    // alte Schneelandschaft (siehe lib/verfolgung.ts).
    ...jagdWelt(wert as Partial<VerfolgungVorgabe>),
    musik: text(wert.musik, 200),
    fluchtgrund: text(wert.fluchtgrund, 800),
    statement: text(wert.statement, 1200),
  };
}

/**
 * Was der Culprit sagt, wenn er liegt.
 *
 * Leer lassen darf man das Feld: Dann steht hier ein Satz, der zu jedem Arc
 * passt, in dem jemand über Jahre im Verborgenen die Fäden gezogen hat.
 */
export const kampfSpruch = (vorgabe: KampfVorgabe, name: string): string =>
  vorgabe.spruch.trim() ||
  `Du hast gewonnen, kleiner Detektiv. Aber vergiss nicht: Jahrelang hat niemand ${name} gesehen - auch du nicht.`;

/**
 * Eine Arena, wenn keine gebaut wurde.
 *
 * Wer als Finale den Showdown oder „Gericht & Flucht“ wählt, hat sich für ein
 * Ende mit Kampf entschieden - und genau das muss er bekommen. Früher fiel
 * ohne gebaute Arena das ganze Ende still aus: Im Saal stand „Ihm nach“, und
 * danach kam sofort der Epilog. Das ist kein Zurückfallen auf ein einfacheres
 * Ende, das ist ein verlorenes Finale.
 *
 * Deshalb springt hier der Kampfplatz ein, den auch der Knopf „Kampfplatz
 * anlegen“ im Editor legt: freie Mitte, Häuser ringsum. Alles andere - Stufe,
 * Musik, Gegnermodell, Licht - bleibt, wie es eingestellt war.
 *
 * Und war überhaupt nichts eingerichtet, gehört zu „Gericht & Flucht“ auch
 * die Jagd: Das Ende heißt Urteil, Jagd, Kampf. Wer dagegen eine Arena gebaut
 * und die Jagd bewusst abgewählt hat, behält sie abgewählt.
 */
function ersatzArena(
  art: FinaleArt | undefined,
  vorhanden: KampfVorgabe | undefined,
  gegnerId: string,
  name: string,
): KampfVorgabe {
  const plan = arenaPlan(9, 9);
  const grund = vorhanden ?? STANDARD_KAMPF;
  return {
    ...grund,
    plan,
    locations: gebaeudeArten(plan),
    jagd:
      vorhanden?.jagd ??
      (!vorhanden && art === "gericht-kampf" ? neueKampfJagd(gegnerId, name) : null),
  };
}

/**
 * Die Arena einer Saga - oder nichts.
 *
 * Dasselbe wie arcKampf() für den Arc, nur eine Ebene tiefer: Steht die
 * Finale-Art auf „Showdown“ oder „Gericht & Flucht“, wird gekämpft. Ist keine
 * brauchbare Arena gebaut, springt die Standardarena ein (siehe
 * ersatzArena) - das Ende fällt nicht mehr aus, nur weil im Editor ein Knopf
 * ungedrückt geblieben ist. Bei jeder anderen Finale-Art kommt nichts.
 */
export const sagaKampf = (
  vorgaben:
    | { finaleArt?: string; kampf?: KampfVorgabe; drahtzieherId?: string; name?: string }
    | undefined,
): KampfVorgabe | null => {
  // Zwei Arten enden im Kampf: der Showdown nach dem Finalfall und das
  // Gerichtsfinale, aus dem der Verurteilte davonläuft.
  const art = vorgaben?.finaleArt as FinaleArt | undefined;
  if (!mitKampf(art)) return null;
  if (kampfSpielbar(vorgaben?.kampf)) return vorgaben.kampf;
  return ersatzArena(art, vorgaben?.kampf, vorgaben?.drahtzieherId ?? "", vorgaben?.name ?? "");
};

/**
 * Die Arena einer ganzen Saga - sie fragt auch den Gerichtssaal.
 *
 * Normalerweise entscheiden die Vorgaben, was am Ende passiert. Eine schon
 * erzeugte Saga trägt die Art aber ein zweites Mal bei sich: im Saal, für den
 * ihre Texte geschrieben wurden („er hat vorgesorgt - ein Wagen, der immer
 * fahrbereit dasteht"). Gehen die beiden auseinander - weil im Editor später
 * eine andere Art angetippt wurde -, zählt der Saal: Der Spieler sitzt gerade
 * darin, und ihm wurde eine Flucht versprochen.
 */
export const sagaKampfFuer = (
  saga:
    | {
        vorgaben?: { finaleArt?: string; kampf?: KampfVorgabe; drahtzieherId?: string; name?: string };
        finale?: { verhandlung?: { art?: string } | null } | null;
      }
    | undefined,
): KampfVorgabe | null => {
  const ausVorgaben = sagaKampf(saga?.vorgaben);
  if (ausVorgaben) return ausVorgaben;
  if (saga?.finale?.verhandlung?.art !== "gericht-kampf") return null;
  return sagaKampf({ ...saga?.vorgaben, finaleArt: "gericht-kampf" });
};

/**
 * Und dasselbe für einen Arc: Steht sein Finale auf „Showdown“, wird
 * gekämpft - notfalls auf der Standardarena.
 */
export const arcErsatzArena = (
  vorhanden: KampfVorgabe | undefined,
  culpritId: string,
  wort: string,
): KampfVorgabe => ersatzArena("kampf", vorhanden, culpritId, wort);
