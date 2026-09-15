/**
 * Welcher Wagen Wimpy gehört, bevor er etwas kauft.
 *
 * Die Liste hängt an den Dateien im Ordner /public/3d_autos. Deshalb wird
 * hier nicht geprüft, was gerade dort liegt, sondern was passiert, wenn
 * etwas dazukommt oder fehlt - damit eine neu eingelegte rav4.glb ohne
 * weiteres Zutun zum Startwagen wird und bis dahin nichts kaputt ist.
 */
import { AUTO_MODELLE, START_AUTO_ID, autoGueltig, autoRegal, standardAutos } from "../lib/autos.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const modell = (name) => ({ id: `3d_autos/${name}.glb`, name });
const start = (liste) => liste.find((auto) => auto.id === START_AUTO_ID);

console.log("\n1. Mit RAV4 im Ordner");
{
  const garage = standardAutos([modell("ferrari"), modell("lambo"), modell("rav4")]);
  pruefe("der Startwagen ist der RAV4", start(garage)?.modell === "3d_autos/rav4.glb");
  pruefe("und heißt auch so", start(garage)?.name === "Wimpys RAV4");
  pruefe("er kostet nichts", start(garage)?.preis === 0);
  pruefe("der Ferrari steht jetzt im Laden",
    garage.some((auto) => auto.name === "Ferrari" && auto.preis > 0));
  pruefe("der Lambo auch", garage.some((auto) => auto.id === "auto-sport" && auto.preis > 0));
  pruefe("es sind drei Wagen", garage.length === 3);
  pruefe("und haben verschiedene Ids", new Set(garage.map((a) => a.id)).size === 3);
  pruefe("jeder hat Namen, Tempo und Preis",
    garage.every((auto) => auto.name && auto.speed >= 60 && auto.preis >= 0));
  /*
   * Gültig ist ein Wagen erst, wenn seine Datei wirklich im Ordner liegt.
   * Das hängt am Ordner und nicht an dieser Liste - deshalb wird es mit
   * einem Modell geprüft, das es garantiert nicht gibt.
   */
  const erfunden = standardAutos([{ id: "3d_autos/gibtsnicht.glb", name: "gibtsnicht" }]);
  pruefe("ein Wagen ohne Datei zählt nicht", !autoGueltig(erfunden[0]));
  pruefe("einer mit Datei schon",
    autoGueltig(standardAutos(AUTO_MODELLE).find((auto) => auto.id === START_AUTO_ID)));

  // Die Schreibweise der Datei darf egal sein.
  for (const name of ["RAV4", "rav-4", "Rav 4", "toyota-rav4"]) {
    pruefe(`„${name}.glb" wird erkannt`,
      start(standardAutos([modell("ferrari"), modell(name)]))?.name === "Wimpys RAV4");
  }
}

console.log("\n2. Solange die Datei noch fehlt");
{
  const garage = standardAutos([modell("ferrari"), modell("lambo")]);
  pruefe("es gibt trotzdem einen Startwagen", Boolean(start(garage)));
  pruefe("er nimmt das erste Modell", start(garage)?.modell === "3d_autos/ferrari.glb");
  pruefe("und behauptet nicht, ein RAV4 zu sein", start(garage)?.name === "Wimpys Ferrari");
  pruefe("dann steht der Ferrari auch nicht doppelt im Laden",
    garage.filter((auto) => auto.modell === "3d_autos/ferrari.glb").length === 1);
  pruefe("alles bleibt gültig", garage.every(autoGueltig));

  // Ganz ohne Modelle gibt es keine Wagen - aber auch keinen Absturz.
  pruefe("ein leerer Ordner ergibt eine leere Garage", standardAutos([]).length === 0);
}

console.log("\n2b. Richtig herum stehen die Wagen auch");
{
  const gedreht = (name, quer) =>
    standardAutos([{ id: `3d_autos/${name}.glb`, name, quer }])[0]?.drehung;
  // Im Bild nachgesehen: Der Ferrari liegt längs, der Lambo und der RAV4
  // quer - aber in entgegengesetzte Richtungen.
  pruefe("der Ferrari bleibt ungedreht", gedreht("ferrari", false) === 0);
  pruefe("der Lambo dreht sich um 270 Grad", gedreht("lambo", true) === 270);
  pruefe("der RAV4 um 90", gedreht("rav4", true) === 90);
  // Ein unbekannter Wagen fängt bei der gemessenen Achse an.
  pruefe("ein quer liegendes Modell wird gedreht", gedreht("jeep", true) === 270);
  pruefe("ein längs liegendes nicht", gedreht("kombi", false) === 0);
  pruefe("und ohne Messung bleibt es bei 0", gedreht("unbekannt", undefined) === 0);
}

console.log("\n3. Was in der Datenbank steht, gilt");
{
  // Hier zählen nur echte Modelle: Was in der Datenbank steht, wird geprüft.
  const garage = standardAutos(AUTO_MODELLE);
  const eigener = { ...start(garage), name: "Der alte Kombi", speed: 120 };
  const regal = autoRegal([eigener]);
  pruefe("ein eigener Startwagen ersetzt den vorgegebenen",
    regal.filter((auto) => auto.id === START_AUTO_ID).length === 1);
  pruefe("und zwar mit seinem Namen",
    regal.find((auto) => auto.id === START_AUTO_ID)?.name === "Der alte Kombi");
  pruefe("die übrigen Vorgaben bleiben daneben stehen", regal.length === garage.length,
    `${regal.length} von ${garage.length}`);
  pruefe("und der Lambo ist weiter zu kaufen", regal.some((auto) => auto.id === "auto-sport"));
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
