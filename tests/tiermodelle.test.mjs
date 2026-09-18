/**
 * Welches 3D-Modell ein Tier bekommt.
 *
 * Die Reihenfolge ist das Ganze: Kapitel schlägt Stammdaten, Stammdaten
 * schlägt Namensraten, und ganz ohne alles bleibt trotzdem niemand
 * unsichtbar. Dazu: Das Feld muss das Versiegeln überstehen, sonst stünde
 * das Tier im fertigen Fall wieder ohne Zuordnung da.
 */
import { ANIMATIONS_MODELLE } from "../lib/animations.generated.ts";
import { laufClipVon, modellFuerTier, ruheAuswahl, spielerModell } from "../lib/tiermodelle.ts";
import { CharacterSchema } from "../lib/schemas.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (extra = {}) => ({
  id: "nala", nummer: 1, name: "Nala", tierart: "Luchs", alter: 7,
  stats: { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 0, schelmischkeit: 5, kriminalitaetslevel: 1, intelligenz: 5 },
  beschreibung: "", bild: "", istDetektiv: false, ...extra,
});

const ids = ANIMATIONS_MODELLE.map((m) => m.id);
const ersteFremde = ids.find((id) => id !== "wimpy");
const zweiteFremde = ids.filter((id) => id !== "wimpy")[1] ?? ersteFremde;

console.log("\n1. Die Reihenfolge");
{
  pruefe(
    "das Kapitel geht vor",
    modellFuerTier(tier({ modell3d: ersteFremde }), 0, zweiteFremde)?.id === zweiteFremde,
  );
  pruefe(
    "sonst gilt, was in den Stammdaten steht",
    modellFuerTier(tier({ modell3d: zweiteFremde }), 0)?.id === zweiteFremde,
  );
  pruefe(
    "ohne Zuordnung wird geraten",
    Boolean(modellFuerTier(tier(), 0)),
  );
  // Ein Tier, das genauso heißt wie ein Modell, bekommt es weiterhin.
  pruefe(
    "der Name trifft wie bisher",
    modellFuerTier(tier({ id: ersteFremde, name: ersteFremde }), 3)?.id === ersteFremde,
  );
  pruefe(
    "eine unbekannte Zuordnung wirft niemanden aus der Stadt",
    Boolean(modellFuerTier(tier({ modell3d: "gibtsnicht" }), 1)),
  );
  pruefe(
    "und ein unbekanntes Kapitelmodell fällt auf die Stammdaten zurück",
    modellFuerTier(tier({ modell3d: zweiteFremde }), 0, "gibtsnicht")?.id === zweiteFremde,
  );
}

console.log("\n2. Wer aus dem Fluchtwagen steigt");
{
  /*
   * Am Ende der Verfolgungsjagd hält der Wagen, und der Flüchtige steigt
   * aus - das ist die Enthüllung. Vor dem Showdown muss dabei derselbe
   * dastehen, der gleich in der Arena kämpft: Dort ist oft ein eigenes
   * Modell gewählt, und zwei verschiedene Gestalten wären zwei Personen.
   */
  pruefe(
    "vor dem Showdown gilt das Modell des Kampfes",
    modellFuerTier(tier({ modell3d: ersteFremde }), 0, zweiteFremde)?.id === zweiteFremde,
  );
  pruefe(
    "zwischen zwei Kapiteln bleibt es das Modell aus den Stammdaten",
    modellFuerTier(tier({ modell3d: ersteFremde }), 0, undefined)?.id === ersteFremde,
  );
  pruefe(
    "und ohne alles steigt trotzdem jemand aus",
    Boolean(modellFuerTier(tier({ id: "fremdling", name: "Fremdling", tierart: "Unbekannt" }), 0)),
  );
}

console.log("\n3. Die Spielfigur");
{
  pruefe("ohne Zuordnung bleibt es Wimpy", spielerModell(tier({ istDetektiv: true }))?.id === "wimpy");
  pruefe(
    "mit Zuordnung läuft er als dieses Modell",
    spielerModell(tier({ istDetektiv: true, modell3d: ersteFremde }))?.id === ersteFremde,
  );
  pruefe("ganz ohne Detektiv gibt es trotzdem eine Figur", Boolean(spielerModell(undefined)));
  pruefe("eine unbekannte Zuordnung fällt auf Wimpy zurück",
    spielerModell(tier({ istDetektiv: true, modell3d: "gibtsnicht" }))?.id === "wimpy");
}

console.log("\n4. Die Zuordnung übersteht das Versiegeln");
{
  const geprueft = CharacterSchema.safeParse(tier({ modell3d: ersteFremde }));
  pruefe("ein Tier mit Modell kommt durch", geprueft.success, geprueft.error?.issues[0]?.message);
  pruefe("und behält es", geprueft.data?.modell3d === ersteFremde);
  const ohne = CharacterSchema.safeParse(tier());
  pruefe("ältere Tiere ohne Feld bleiben gültig", ohne.success && ohne.data?.modell3d === undefined);
}

console.log("\nWomit eine Figur herumsteht");
{
  const clips = (namen) => namen.map((name) => ({ name }));
  const namen = (liste) => liste.map((c) => c.name);

  // Der eigentliche Anlass: „restpose" ist keine Animation, sondern ein
  // einziges Bild. Wer sie mitlost, steht in jeder dritten Pause still.
  const wimpyArtig = clips(["Running", "Walking", "Idle_11", "Idle_3", "Shake_It_Off_Dance", "restpose"]);
  const lauf = laufClipVon(wimpyArtig);
  const ruhe = ruheAuswahl(wimpyArtig, lauf);
  pruefe("gelaufen wird mit Walking", lauf?.name === "Walking");
  pruefe("die Ruhepose bleibt draußen", !namen(ruhe).includes("restpose"), namen(ruhe).join(", "));
  pruefe("der Leerlauf steht vorn", ruhe[0]?.name.startsWith("Idle"), namen(ruhe).join(", "));
  pruefe("der Tanz ist dabei", namen(ruhe).includes("Shake_It_Off_Dance"));
  pruefe("gelaufen wird nicht im Stehen", !namen(ruhe).some((n) => /^(Walking|Running)$/.test(n)));

  // Modelle mit einem einzigen Clip: Der ist ihr Leerlauf, auch wenn er
  // nirgends "idle" heißt.
  const ausUnreal = clips(["Armature|Unreal Take|baselayer"]);
  pruefe(
    "ein einzelner Clip zählt als Leerlauf",
    namen(ruheAuswahl(ausUnreal, laufClipVon(ausUnreal))).join() === "Armature|Unreal Take|baselayer",
  );

  // Und wer wirklich nichts anderes hat, bekommt die Ruhepose - besser
  // reglos als auf der Stelle rennend.
  const nurLaufen = clips(["Running", "Walking", "restpose"]);
  pruefe(
    "sonst bleibt die Ruhepose",
    namen(ruheAuswahl(nurLaufen, laufClipVon(nurLaufen))).join() === "restpose",
  );
  pruefe("gar keine Clips: gar keine Wahl", ruheAuswahl([], undefined).length === 0);

  // Keine Faustschläge am Straßenrand.
  const kaempfer = clips(["Walking", "Attack", "Punch_Combo_1", "Knock_Down", "Idle_3"]);
  pruefe(
    "Kampfbewegungen sind kein Herumstehen",
    namen(ruheAuswahl(kaempfer, laufClipVon(kaempfer))).join() === "Idle_3",
  );

  /*
   * Und dasselbe für alle Modelle, die wirklich im Projekt liegen: Wer
   * überhaupt etwas mitbringt, darf nicht ohne Wahl dastehen.
   */
  for (const modell of ANIMATIONS_MODELLE) {
    if (!modell.animationen.length) continue;
    const eigene = clips(modell.animationen);
    const auswahl = ruheAuswahl(eigene, laufClipVon(eigene));
    pruefe(`${modell.id} hat eine Ruhe`, auswahl.length > 0);
    const echteLeerlaeufe = modell.animationen.filter((n) => /idle/i.test(n));
    if (echteLeerlaeufe.length) {
      pruefe(
        `${modell.id} steht nicht in der Ruhepose`,
        !namen(auswahl).includes("restpose"),
      );
      pruefe(`${modell.id} fängt mit einem Leerlauf an`, /idle/i.test(auswahl[0].name), auswahl[0].name);
    }
  }
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
