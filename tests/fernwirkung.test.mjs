/**
 * Was ein Kapitel für das Finale hinterlässt.
 *
 * Seit die Beweismitteltasche über eine ganze Saga gilt, hängt die
 * Verhandlung daran: Wimpy kann dort nur vorlegen, was er unterwegs
 * eingesammelt hat. Ein Kapitel, das nur sich selbst löst, schickt ihn mit
 * leeren Händen in den Saal - deshalb wird die Fernwirkung ausdrücklich
 * bestellt und danach geprüft.
 */
import { buildSpurenPrompt } from "../lib/prompts.ts";
import { fernwirkungPruefen } from "../lib/fallReparieren.ts";
import { makeSpurenSchema } from "../lib/schemas.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5,
  stats: { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 5,
    schelmischkeit: 5, kriminalitaetslevel: 5, intelligenz: 5 },
  beschreibung: "", bild: "", istDetektiv: false, ...extra,
});

const besetzung = [
  tier("wimpy", "Wimpy", { istDetektiv: true }),
  tier("nala", "Nala"),
  tier("hut", "Herr Hut"),
];
const verdaechtige = [
  { charakterId: "nala", aufenthaltsort: "o1", alibi: "war zu Hause" },
  { charakterId: "hut", aufenthaltsort: "o2", alibi: "war im Turm" },
];
const items = [{ id: "lupe", name: "Lupe" }, { id: "zettel", name: "Zettel" }];

const bauen = (saga, nachfassen = false) =>
  buildSpurenPrompt(
    besetzung, "nala", "Der Fall", "So war es", verdaechtige, null, items,
    saga, nachfassen,
  );

const sagaVorgabe = {
  drahtzieherName: "Herr Hut",
  drahtzieherId: "hut",
  enthuellung: "Jemand hat einen Schlüssel nachmachen lassen",
  vorGericht: true,
};

console.log("\n1. Ein einzelner Fall bleibt, wie er war");
{
  const p = bauen(null);
  pruefe("vier bis sechs Spuren", p.includes("4 bis 6 Spuren"));
  pruefe("keine Fernwirkung bestellt", !p.includes("FERNWIRKUNG"));
  pruefe("zwei auf den Täter, eine in die Irre", p.includes("Mindestens zwei Spuren zeigen auf den Täter"));
}

console.log("\n2. Ein Kapitel einer Saga bestellt mehr");
{
  const p = bauen(sagaVorgabe);
  pruefe("fünf bis sieben Spuren", p.includes("5 bis 7 Spuren"));
  pruefe("die Fernwirkung ist Pflicht", p.includes("STÜCKE MIT FERNWIRKUNG (PFLICHT"));
  pruefe("ein bis zwei Stücke", p.includes("Ein bis zwei der Spuren lösen diesen Fall NICHT"));
  pruefe("sie zeigen auf den Drahtzieher", p.includes("auf Herr Hut, den Kopf hinter der ganzen Serie"));
  pruefe("sie zählen nicht zu den Täterspuren", p.includes("zählen nicht zu den Spuren auf den Täter dieses Falls"));
  pruefe("es müssen Gegenstände sein", p.includes("einstecken und Wochen später auf einen Tisch legen"));
  pruefe("kein Gerücht", p.includes("Kein Gerücht, keine Bemerkung, kein Gefühl"));
  pruefe("der Name bleibt aus der Beobachtung", p.includes("nicht beim Namen"));
  pruefe("die Bedeutung nennt ihn", p.includes("Ihre Bedeutung sagt dagegen klar und mit Namen"));
  pruefe("das Häkchen wird verlangt", p.includes("fernwirkung auf true"));
  pruefe("die Enthüllung hängt daran", p.includes("Jemand hat einen Schlüssel nachmachen lassen"));
  pruefe("der Kapitelfall bleibt ohne sie lösbar", p.includes("bleibt trotzdem ohne sie lösbar"));
  pruefe("Wimpy stutzt hörbar", p.includes("leiser Wink"));
  pruefe("das Gericht wird benannt", p.includes("höchstens sechs Stücke"));
}

console.log("\n3. Wo der Schuldige das Geheimnis ist, fällt kein Name");
{
  const p = bauen({ ...sagaVorgabe, drahtzieherName: "" });
  pruefe("kein Name im Prompt", !p.includes("Herr Hut, den Kopf"));
  pruefe("stattdessen die Sache dahinter", p.includes("auf die Sache, die hinter der ganzen Serie steckt"));
  pruefe("und niemand wird benannt", p.includes("niemanden beim Namen"));
}

console.log("\n4. Ohne Verhandlung ohne Gerichtssatz");
{
  const p = bauen({ ...sagaVorgabe, vorGericht: false });
  pruefe("die Fernwirkung bleibt Pflicht", p.includes("STÜCKE MIT FERNWIRKUNG (PFLICHT"));
  pruefe("aber ohne Saal", !p.includes("höchstens sechs Stücke"));
}

console.log("\n5. Der zweite Anlauf sagt es noch einmal");
{
  const p = bauen(sagaVorgabe, true);
  pruefe("die Ansage steht oben", p.includes("Im letzten Anlauf fehlte die Spur mit Fernwirkung"));
  pruefe("ohne Saga kein Nachfassen", !bauen(null, true).includes("letzten Anlauf"));
}

console.log("\n6. Das Schema kennt das Häkchen");
{
  const felder = Object.keys(makeSpurenSchema(besetzung, [{ id: "o1" }, { id: "o2" }], items).shape.spuren.element.shape);
  pruefe("fernwirkung ist ein Feld", felder.includes("fernwirkung"));
  for (const feld of ["itemId", "ortId", "beobachtung", "vermutung", "bedeutung", "zeigtAufCharakterId", "fuehrtInDieIrre"]) {
    pruefe(`${feld} ist noch da`, felder.includes(feld));
  }
}

console.log("\n7. Die Prüfung danach");
{
  const spur = (itemId, extra = {}) => ({
    itemId, ortId: "o1", beobachtung: "", vermutung: "", bedeutung: "",
    zeigtAufCharakterId: "nala", fuehrtInDieIrre: false, ...extra,
  });

  const mit = fernwirkungPruefen([spur("lupe"), spur("zettel", { fernwirkung: true })], "hut");
  pruefe("ausgezeichnet reicht", !mit.fehlt && mit.aenderung === null);
  pruefe("und nichts wird angefasst", mit.spuren.length === 2);

  // Vergessenes Häkchen, aber eine ehrliche Spur auf den Drahtzieher.
  const ersatz = fernwirkungPruefen(
    [spur("lupe"), spur("zettel", { zeigtAufCharakterId: "hut" })],
    "hut",
  );
  pruefe("die Spur auf den Drahtzieher gilt", !ersatz.fehlt);
  pruefe("und wird abgehakt", ersatz.spuren.find((s) => s.itemId === "zettel")?.fernwirkung === true);
  pruefe("die andere bleibt unberührt", !ersatz.spuren.find((s) => s.itemId === "lupe")?.fernwirkung);
  pruefe("und es steht in den Änderungen", Boolean(ersatz.aenderung));

  // Eine falsche Fährte auf den Drahtzieher zählt nicht.
  const irre = fernwirkungPruefen(
    [spur("zettel", { zeigtAufCharakterId: "hut", fuehrtInDieIrre: true })],
    "hut",
  );
  pruefe("eine falsche Fährte gilt nicht", irre.fehlt);

  // Gar nichts.
  pruefe("ohne alles fehlt es", fernwirkungPruefen([spur("lupe")], "hut").fehlt);
  // Ohne Drahtzieher-Id gibt es keinen Ersatz - sonst hakt die Prüfung bei
  // "Kein Täter" ausgerechnet eine Spur gegen den Unschuldigen ab.
  pruefe(
    "ohne Id kein Ersatz",
    fernwirkungPruefen([spur("zettel", { zeigtAufCharakterId: "hut" })], "").fehlt,
  );
  pruefe(
    "ausgezeichnet gilt auch ohne Id",
    !fernwirkungPruefen([spur("zettel", { fernwirkung: true })], "").fehlt,
  );
  pruefe("eine leere Liste fehlt", fernwirkungPruefen([], "hut").fehlt);
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
