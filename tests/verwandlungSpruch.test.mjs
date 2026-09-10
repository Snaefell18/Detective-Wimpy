/**
 * Die ersten Worte der Gestalt.
 *
 * Der Moment, in dem sie aus ihrem Wirt bricht, war bisher stumm. Jetzt sagt
 * sie etwas - und weil dieser Satz seit der Erzeugung feststeht, muss er drei
 * Wege überstehen: bestellt werden, im Siegel liegen und dort erst
 * herauskommen, wo er nichts mehr verrät.
 */
import { FinaleSchema, VerhandlungSaalSchema } from "../lib/sagaSchemas.ts";
import {
  buildFinalePrompt,
  buildVerhandlungPrompt,
  verwandlungsRegeln,
} from "../lib/sagaPrompts.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const felder = (schema) => Object.keys(schema.shape);

console.log("\n1. Beide Finale-Schemata kennen den Spruch");
{
  pruefe("der Gerichtssaal", felder(VerhandlungSaalSchema).includes("verwandlungSpruch"));
  pruefe("und das klassische Finale", felder(FinaleSchema).includes("verwandlungSpruch"));
}

console.log("\n2. Was bestellt wird");
{
  const r = verwandlungsRegeln("Bella", "Der Schatten");
  pruefe("Wirt und Gestalt stehen drin", r.includes("Bella") && r.includes("Der Schatten"));
  pruefe("es ist wörtliche Rede", r.includes("wörtliche Rede"));
  pruefe("zwei bis vier Sätze", r.includes("Zwei bis vier Sätze"));
  pruefe("kein Namensprefix", r.includes("ohne Namensprefix"));
  pruefe("nichts Blutiges", r.includes("nichts Blutiges"));
  pruefe("kein Gebrüll", r.includes("kein Gebrüll"));
  pruefe("sie gesteht nichts", r.includes("gesteht nichts"));
  pruefe("und verrät nichts", r.includes("niemals verraten"));
}

console.log("\n3. Der Saal bestellt sie nur bei einer Besessenheit");
{
  const basis = {
    art: "gericht-daemon",
    thema: "T", wahrheit: "W", angeklagter: "Herr Hut", richter: "Öhö",
    detektivName: "Wimpy", motiv: "M",
    kapitel: [{ name: "K1", enthuellung: "E" }],
  };

  const mit = buildVerhandlungPrompt({
    ...basis,
    besessenheit: { wirt: "Herr Hut", daemon: "Der Schatten" },
  });
  pruefe("mit Besessenheit steht die Ansage drin", mit.includes("DIE ERSTEN WORTE DER GESTALT"));
  pruefe("mit dem Namen der Gestalt", mit.includes("Der Schatten ist eben aus Herr Hut"));

  const ohne = buildVerhandlungPrompt({ ...basis, art: "gericht" });
  pruefe("ohne Besessenheit nicht", !ohne.includes("DIE ERSTEN WORTE DER GESTALT"));
  pruefe("und das Feld bleibt ausdrücklich leer", ohne.includes("verwandlungSpruch bleibt leer"));
}

console.log("\n4. Das klassische Finale ebenso");
{
  const mit = buildFinalePrompt({
    thema: "T", wahrheit: "W", drahtzieherName: "Der Schatten", motiv: "M",
    bisher: [{ name: "K1", enthuellung: "E" }], twist: false, neueTiere: [],
    besessenheit: { wirt: "Bella", daemon: "Der Schatten" },
  });
  pruefe("mit Besessenheit steht sie drin", mit.includes("DIE ERSTEN WORTE DER GESTALT"));

  const ohne = buildFinalePrompt({
    thema: "T", wahrheit: "W", drahtzieherName: "Hut", motiv: "M",
    bisher: [], twist: false, neueTiere: [],
  });
  pruefe("ohne nicht", !ohne.includes("DIE ERSTEN WORTE DER GESTALT"));
}

console.log("\n5. Ein Spruch überlebt das Schema");
{
  const antwort = {
    frage: "f", erzaehlerText: "e", epilogText: "p", anklage: "a",
    anklageRichtig: "r", anklageFalsch: "x", urteilSchuldig: "u",
    strafeWort: "w", strafeAuflage: "au", strafeFreiWort: "", strafeFreiAuflage: "",
    urteilFrei: "uf",
    verwandlungSpruch: "Wie lange ich gewartet habe. Und wie wenig sie davon wusste.",
  };
  const gelesen = VerhandlungSaalSchema.safeParse(antwort);
  pruefe("die Antwort kommt durch", gelesen.success);
  pruefe(
    "mit ihrem Spruch",
    gelesen.success && gelesen.data.verwandlungSpruch.startsWith("Wie lange"),
  );
  pruefe(
    "ein leerer Spruch ist auch in Ordnung",
    VerhandlungSaalSchema.safeParse({ ...antwort, verwandlungSpruch: "" }).success,
  );
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
