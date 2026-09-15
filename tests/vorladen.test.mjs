/**
 * Was vorgeladen wird - und was nicht.
 *
 * Die Dateiliste entscheidet, ob beim Kapitelstart noch etwas durch die
 * Leitung muss. Sie darf nichts vergessen (dann wartet man doch) und nichts
 * doppelt anfordern (dann wartet man länger als nötig).
 */
import { dreiDDateien, jagdDateien } from "../lib/vorladen.ts";
import { DREI_D_LOCATIONS, STANDARD_KAPITEL_3D } from "../lib/pursuit3d.ts";
import { AUTO_MODELLE } from "../lib/autos.ts";
import { ANIMATIONS_MODELLE } from "../lib/animations.generated.ts";
import { beispielPlan, feldSetzen } from "../lib/stadtplan.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const stats = { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 0, schelmischkeit: 5, kriminalitaetslevel: 1, intelligenz: 5 };
const tier = (id, extra = {}) => ({
  id, nummer: 1, name: id, tierart: "Tier", alter: 5, stats,
  beschreibung: "", bild: "", istDetektiv: false, ...extra,
});
const haus = DREI_D_LOCATIONS[0];
const zweites = DREI_D_LOCATIONS[1] ?? haus;

console.log("\n1. Ein Kapitel auf dem Stadtplan");
{
  let plan = beispielPlan(5, 5);
  plan = feldSetzen(plan, 0, 0, haus.id);
  plan = feldSetzen(plan, 4, 4, haus.id);
  plan = feldSetzen(plan, 0, 4, zweites.id);
  const besetzung = [tier("wimpy", { istDetektiv: true }), tier("bock"), tier("fauli")];
  const dateien = dreiDDateien({ ...STANDARD_KAPITEL_3D, aktiv: true, plan }, besetzung);

  pruefe("die gesetzten Häuser sind dabei", dateien.includes(haus.datei) && dateien.includes(zweites.datei));
  pruefe("und zwar nur einmal", dateien.filter((d) => d === haus.datei).length === 1);
  pruefe("Wimpys Modell ist dabei", dateien.some((d) => /wimpy/i.test(d)));
  pruefe("die anderen Tiere auch", dateien.length >= 4, `${dateien.length} Dateien`);
  pruefe("nichts doppelt", new Set(dateien).size === dateien.length);
  pruefe("und alles sind echte Pfade", dateien.every((d) => d.startsWith("/") && d.endsWith(".glb")));

  // Was nicht im Plan steht, wird auch nicht geholt.
  const ungenutzt = DREI_D_LOCATIONS.filter((ort) => ort.id !== haus.id && ort.id !== zweites.id);
  pruefe("ungenutzte Bausteine bleiben liegen", ungenutzt.every((ort) => !dateien.includes(ort.datei)),
    `${ungenutzt.length} nicht geladen`);
}

console.log("\n2. Ein Kapitel als Straßenzug");
{
  const dateien = dreiDDateien(
    { ...STANDARD_KAPITEL_3D, aktiv: true, locations: [haus.id], plan: null },
    [tier("wimpy", { istDetektiv: true })],
  );
  pruefe("der gewählte Baustein ist dabei", dateien.includes(haus.datei));
  pruefe("und sonst keiner", dateien.filter((d) => d.includes("3d_locations")).length === 1);
}

console.log("\n3. Ohne Besetzung und ohne alles");
{
  const leer = dreiDDateien({ ...STANDARD_KAPITEL_3D, aktiv: true, plan: null, locations: [] }, []);
  pruefe("ohne Besetzung kommt wenigstens die Stadt", leer.length > 0);
  pruefe("und eine Spielfigur", leer.some((d) => d.includes("/animations/")));

  const zugeordnet = dreiDDateien(
    { ...STANDARD_KAPITEL_3D, aktiv: true, plan: null, locations: [haus.id] },
    [tier("wimpy", { istDetektiv: true, modell3d: "yeti" })],
  );
  pruefe("ein zugeordnetes Modell wird geholt, nicht das erratene",
    zugeordnet.some((d) => /yeti/i.test(d)) && !zugeordnet.some((d) => /wimpy/i.test(d)));
}

console.log("\n4. Die Verfolgungsjagd");
{
  const dateien = jagdDateien(
    [{ modell: AUTO_MODELLE[0].id }, { modell: AUTO_MODELLE[1]?.id ?? AUTO_MODELLE[0].id }],
    tier("wimpy", { istDetektiv: true }),
  );
  pruefe("beide Wagen sind dabei", dateien.filter((d) => d.includes("3d_autos")).length >= 1);
  pruefe("Wimpy steht am Straßenrand", dateien.some((d) => /wimpy/i.test(d)));
  pruefe("nichts doppelt", new Set(dateien).size === dateien.length);
  pruefe("ein unbekanntes Modell wird übergangen", jagdDateien([{ modell: "gibtsnicht" }]).every((d) => d.includes("/animations/")));
  pruefe("und alle Dateien gibt es wirklich",
    dateien.every((d) => AUTO_MODELLE.some((m) => m.datei === d) || ANIMATIONS_MODELLE.some((m) => m.datei === d)));
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
