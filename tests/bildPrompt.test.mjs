/**
 * Der Auftrag ans Bildmodell: Der Stil muss immer dabei sein, die Eingaben
 * müssen ankommen, und leere Felder dürfen keine leeren Zeilen hinterlassen.
 */
import {
  FORMAT,
  FREIGESTELLT,
  STIL,
  auftragReicht,
  bildAuftrag,
} from "../lib/bildPrompt.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Der Stil steht immer drin");
for (const art of ["charaktere", "orte", "items"]) {
  pruefe(`${art}`, bildAuftrag(art, { name: "Test" }).startsWith(STIL));
}
pruefe("und verbietet Schrift", /keine Schrift/i.test(STIL));
pruefe("und Fotorealistik", /Keine Fotorealistik/i.test(STIL));

console.log("\n2. Format und Freistellung");
pruefe("Tiere hochkant", FORMAT.charaktere === "1024x1536");
pruefe("Orte hochkant", FORMAT.orte === "1024x1536");
pruefe("Dinge quadratisch", FORMAT.items === "1024x1024");
pruefe("Tiere freigestellt", FREIGESTELLT.charaktere === true);
pruefe("Dinge auch", FREIGESTELLT.items === true);
pruefe("Orte nicht", FREIGESTELLT.orte === false);

console.log("\n3. Die Eingaben kommen an");
{
  const auftrag = bildAuftrag(
    "charaktere",
    { name: "Mikkeli", tierart: "Fuchs", alter: 9, beruf: "Bäcker", beschreibung: "schlau" },
    "rote Latzhose",
  );
  pruefe("Name", auftrag.includes("Figur: Mikkeli"));
  pruefe("Tierart", auftrag.includes("Tierart: Fuchs"));
  pruefe("Alter mit Einheit", auftrag.includes("Alter: 9 Jahre"));
  pruefe("Beruf", auftrag.includes("Beruf: Bäcker"));
  pruefe("Beschreibung", auftrag.includes("Wesen und Aussehen: schlau"));
  pruefe("und der Wunsch zuletzt", auftrag.trimEnd().endsWith("Zusätzliche Wünsche: rote Latzhose"));
}
{
  const auftrag = bildAuftrag("orte", {
    name: "Nachtmarkt",
    stadt: "Hanoi",
    atmosphaere: "eng und laut",
  });
  pruefe("Schauplatz", auftrag.includes("Schauplatz: Nachtmarkt"));
  pruefe("Stadt", auftrag.includes("Stadt: Hanoi"));
  pruefe("Stimmung", auftrag.includes("Stimmung: eng und laut"));
  pruefe("Orte bleiben menschenleer", /menschenleer/i.test(auftrag));
}

console.log("\n4. Leere Felder hinterlassen nichts");
{
  const auftrag = bildAuftrag("items", { name: "Lupe", beschreibung: "" }, "");
  pruefe("keine leeren Zeilen", !auftrag.split("\n").some((z) => z.trim() === ""));
  pruefe("kein Wunsch-Anhang", !auftrag.includes("Zusätzliche Wünsche"));
  pruefe("keine offenen Doppelpunkte", !/:\s*$/m.test(auftrag));
  pruefe("ganz ohne Angaben geht auch", bildAuftrag("items", {}).startsWith(STIL));
  pruefe("Alter 0 wird nicht erfunden", !bildAuftrag("charaktere", { alter: 0 }).includes("Alter"));
}

console.log("\n5. Wann es überhaupt losgehen darf");
pruefe("mit Namen", auftragReicht("items", { name: "Lupe" }));
pruefe("mit Beschreibung", auftragReicht("items", { beschreibung: "rund" }));
pruefe("mit bloßem Wunsch", auftragReicht("items", {}, "eine Lupe"));
pruefe("ohne alles nicht", !auftragReicht("items", {}));
pruefe("Leerzeichen zählen nicht", !auftragReicht("items", { name: "  " }, " "));

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
