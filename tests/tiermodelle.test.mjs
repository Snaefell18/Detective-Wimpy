/**
 * Welches 3D-Modell ein Tier bekommt.
 *
 * Die Reihenfolge ist das Ganze: Kapitel schlägt Stammdaten, Stammdaten
 * schlägt Namensraten, und ganz ohne alles bleibt trotzdem niemand
 * unsichtbar. Dazu: Das Feld muss das Versiegeln überstehen, sonst stünde
 * das Tier im fertigen Fall wieder ohne Zuordnung da.
 */
import { ANIMATIONS_MODELLE } from "../lib/animations.generated.ts";
import { modellFuerTier, spielerModell } from "../lib/tiermodelle.ts";
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

console.log("\n2. Die Spielfigur");
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

console.log("\n3. Die Zuordnung übersteht das Versiegeln");
{
  const geprueft = CharacterSchema.safeParse(tier({ modell3d: ersteFremde }));
  pruefe("ein Tier mit Modell kommt durch", geprueft.success, geprueft.error?.issues[0]?.message);
  pruefe("und behält es", geprueft.data?.modell3d === ersteFremde);
  const ohne = CharacterSchema.safeParse(tier());
  pruefe("ältere Tiere ohne Feld bleiben gültig", ohne.success && ohne.data?.modell3d === undefined);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
