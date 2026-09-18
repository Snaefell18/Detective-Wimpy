import { ANIMATIONS_MODELLE, type AnimationsModell } from "./animations.generated";
import type { Character } from "./types";

/**
 * Welches 3D-Modell ein Tier bekommt.
 *
 * Die Reihenfolge ist die ganze Regel - und sie steht bewusst hier und nicht
 * in der Szene, damit man sie prüfen kann, ohne eine Grafikkarte zu starten:
 *
 * 1. Was dieses Kapitel ausdrücklich zuordnet. Wer einmal etwas anderes
 *    braucht, soll es sagen dürfen.
 * 2. Was in den Stammdaten beim Tier steht. Das ist der Normalfall: einmal
 *    zugeordnet, tritt das Tier überall so auf.
 * 3. Ein Modell, dessen Name zu Id, Name oder Tierart passt - so wie es
 *    war, bevor es die Zuordnung gab.
 * 4. Irgendeines der Reihe nach, damit niemand unsichtbar bleibt.
 */
const normal = (wert: string) => wert.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

export function modellFuerTier(
  charakter: Character,
  index: number,
  kapitelModellId?: string,
): AnimationsModell | undefined {
  const schluessel = [charakter.id, charakter.name, charakter.tierart].map(normal);
  return (
    ANIMATIONS_MODELLE.find((modell) => modell.id === kapitelModellId) ??
    ANIMATIONS_MODELLE.find((modell) => modell.id === charakter.modell3d) ??
    ANIMATIONS_MODELLE.find((modell) =>
      schluessel.some((wert) => wert && (normal(modell.id).includes(wert) || wert.includes(normal(modell.id)))),
    ) ??
    ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy")[
      index % Math.max(1, ANIMATIONS_MODELLE.length - 1)
    ]
  );
}

/**
 * Die Spielfigur.
 *
 * Auch Wimpy ist ein Tier in den Stammdaten: Ist ihm dort ein Modell
 * zugeordnet, läuft er damit durch die Stadt. Sonst bleibt es beim Modell,
 * das seinen Namen trägt.
 */
export function spielerModell(detektiv?: Character): AnimationsModell | undefined {
  return (
    ANIMATIONS_MODELLE.find((modell) => modell.id === detektiv?.modell3d) ??
    ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy") ??
    ANIMATIONS_MODELLE[0]
  );
}

/**
 * Welcher Clip das Laufen ist.
 *
 * Erst ein Gehen, dann ein Rennen - in dieser Reihenfolge, weil die Figuren
 * im Kapitel spazieren und nicht sprinten. Hat ein Modell beides nicht, läuft
 * eben niemand: Dann steht die Figur und macht das, was `ruheAuswahl` findet.
 */
export function laufClipVon<T extends { name: string }>(clips: T[]): T | undefined {
  return (
    clips.find((clip) => /walk/i.test(clip.name)) ??
    clips.find((clip) => /run|sprint|charge/i.test(clip.name))
  );
}

/**
 * Womit eine Figur herumsteht - die beste Wahl zuerst, und nie leer, solange
 * das Modell überhaupt etwas mitbringt.
 *
 * Der Haken steckt in `restpose`. Neun der Modelle bringen sie mit, und sie
 * ist keine Animation, sondern die Ruhepose des Skeletts: ein einziges Bild.
 * Wer sie spielt, steht wie eingefroren da. Gesucht wurde bisher mit
 * /idle|rest/ - und weil `restpose` darauf passt, landete sie gleichberechtigt
 * neben den echten Leerlauf-Animationen. Eine Figur mit vier schönen Idles
 * stand deshalb in jeder dritten Pause reglos herum.
 *
 * Deshalb in Stufen:
 *
 *   1. Alles, was man im Stehen tut: echte Leerläufe zuerst (`Idle_3`,
 *      `Idle_11` …), dahinter Tänze und Gesten - tanzen, sich strecken,
 *      trinken, sich im Spiegel betrachten. Davon leben die Straßen.
 *   2. Sonst der einzige Clip, den das Modell hat (die aus Unreal
 *      exportierten heißen „baselayer" und sind genau das: ein ruhiges
 *      Atmen).
 *   3. Und erst ganz zuletzt die Ruhepose - besser reglos als auf der Stelle
 *      rennend.
 *
 * Nicht dabei ist, was kein Herumstehen ist: Schläge, Blocks, Sprünge,
 * Rollen, Sprints. Ein Tier, das am Straßenrand Faustschläge übt, war nie
 * gemeint.
 */
export function ruheAuswahl<T extends { name: string }>(
  clips: T[],
  /** Der Laufclip, falls es einen gibt - er gehört nie dazu. */
  lauf?: T | null,
): T[] {
  const uebrig = clips.filter((clip) => clip !== lauf && !/^(walking|running)$/i.test(clip.name));
  const ruhepose = (clip: T) => /rest.?pose|t.?pose|^rest$/i.test(clip.name);
  const leerlauf = (clip: T) => /idle/i.test(clip.name) && !ruhepose(clip);
  const imStehen = (clip: T) =>
    /dance|dancing|groove|shuffle|ymca|salsa|samba|hip.?hop|rumba|twist|drink|mirror|viewing|heart|muscle|wake/i.test(
      clip.name,
    );

  const stehend = uebrig.filter((clip) => leerlauf(clip) || imStehen(clip));
  // Leerläufe zuerst: Wo nur einer gebraucht wird, soll es der ruhige sein
  // und nicht der Breakdance.
  if (stehend.length) {
    return [...stehend].sort(
      (a, b) => Number(leerlauf(b)) - Number(leerlauf(a)),
    );
  }

  const ohnePose = uebrig.filter((clip) => !ruhepose(clip));
  return ohnePose.length ? ohnePose : uebrig;
}
