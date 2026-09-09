/**
 * Was passiert, wenn ein einzelner Eintrag aus der Datenbank nicht durch die
 * Prüfung geht?
 *
 * Der Anlass war bitter: Eine zu lange Beschreibung ließ die GANZE Tierliste
 * durchfallen. Der Server nahm dann stillschweigend die sechs Tiere aus dem
 * Projekt - und meldete für jedes ausgewählte Tier „spielt aber nicht mit",
 * obwohl im Formular alles angehakt war. Ein Fehler, der nach einem Fehler
 * des Nutzers aussah.
 */
import { CharacterSchema, LocationSchema, einzelnGeprueft } from "../lib/schemas.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Bär", alter: 5,
  stats: { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 0,
    schelmischkeit: 5, kriminalitaetslevel: 3, intelligenz: 5 },
  beschreibung: "Ein Bär.", bild: "/charaktere/x.png", istDetektiv: false, ...extra,
});

console.log("\n1. Heile Listen gehen unverändert durch");
{
  const { gut, verworfen } = einzelnGeprueft(CharacterSchema, [
    tier("menschenbaer", "Menschenbär"),
    tier("bella", "Bella"),
    tier("hut", "Herr Hut"),
  ]);
  pruefe("alle drei bleiben", gut.length === 3);
  pruefe("nichts verworfen", verworfen.length === 0);
  pruefe("die Ids stimmen", gut.map((c) => c.id).join(",") === "menschenbaer,bella,hut");
}

console.log("\n2. Ein kaputter Eintrag reißt die anderen nicht mit");
{
  const { gut, verworfen } = einzelnGeprueft(CharacterSchema, [
    tier("menschenbaer", "Menschenbär"),
    tier("bella", "Bella", { alter: "sieben" }),
    tier("hut", "Herr Hut"),
  ]);
  pruefe("die heilen bleiben", gut.length === 2, gut.map((c) => c.id).join(","));
  pruefe("der kaputte fällt einzeln auf", verworfen.length === 1);
  pruefe("mit Namen", /Bella/.test(verworfen[0]), verworfen[0]);
  pruefe("und mit Feld", /alter/.test(verworfen[0]), verworfen[0]);
}

console.log("\n3. Die Grenzen passen zu dem, was sich speichern lässt");
{
  // firestore.rules erlaubt 1000 Zeichen Beschreibung für Tiere.
  const lang = einzelnGeprueft(CharacterSchema, [
    tier("baer", "Bär", { beschreibung: "x".repeat(1000) }),
  ]);
  pruefe("1000 Zeichen Beschreibung gehen durch", lang.gut.length === 1, lang.verworfen[0]);
  const zuLang = einzelnGeprueft(CharacterSchema, [
    tier("baer", "Bär", { beschreibung: "x".repeat(1001) }),
  ]);
  pruefe("1001 nicht mehr", zuLang.gut.length === 0);

  // Und für Orte 500.
  const ort = (extra) => ({
    id: "venedig-hafen", stadt: "Venedig", stadtId: "venedig", name: "Hafen",
    atmosphaere: "eng", beschreibung: "Ein Hafen.", bild: "/orte/x.png", ...extra,
  });
  pruefe("Orte: 500 Zeichen gehen durch",
    einzelnGeprueft(LocationSchema, [ort({ beschreibung: "x".repeat(500) })]).gut.length === 1);
  pruefe("Orte: 501 nicht mehr",
    einzelnGeprueft(LocationSchema, [ort({ beschreibung: "x".repeat(501) })]).gut.length === 0);
}

console.log("\n4. Viele Tiere sind kein Problem mehr");
{
  const viele = Array.from({ length: 60 }, (_, i) => tier(`t${i}`, `Tier ${i}`));
  const { gut, verworfen } = einzelnGeprueft(CharacterSchema, viele);
  pruefe("60 Tiere kommen durch", gut.length === 60);
  pruefe("nichts verworfen", verworfen.length === 0);
}

console.log("\n5. Unsinn stürzt nicht ab");
{
  pruefe("kein Array", einzelnGeprueft(CharacterSchema, null).gut.length === 0);
  pruefe("leeres Array", einzelnGeprueft(CharacterSchema, []).verworfen.length === 0);
  const kaputt = einzelnGeprueft(CharacterSchema, [null, 42, "nein"]);
  pruefe("drei Fehleinträge", kaputt.verworfen.length === 3);
  pruefe("ohne Namen heißt es „ein Eintrag“", /ein Eintrag/.test(kaputt.verworfen[0]));
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
