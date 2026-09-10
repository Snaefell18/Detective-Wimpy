/**
 * Der Auftrag ans Bildmodell: Der Stil muss immer dabei sein, die Eingaben
 * müssen ankommen, und leere Felder dürfen keine leeren Zeilen hinterlassen.
 */
import {
  BILD_STILE,
  FORMAT,
  FREIGESTELLT,
  STIL,
  auftragReicht,
  bildAuftrag,
  istBildStil,
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
  pruefe(
    "der Wunsch steht hinter den Angaben",
    auftrag.indexOf("Wesen und Aussehen") < auftrag.indexOf("Zusätzliche Wünsche: rote Latzhose"),
  );
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

console.log("\n6. Der Stil und die Freistellung haben das letzte Wort");
{
  // Ein Wunsch, der den Stil unterlaufen würde: Danach muss der Stil noch
  // einmal kommen, sonst gewinnt das Ende der Beschreibung.
  const frech = bildAuftrag("charaktere", { name: "X" }, "fotorealistisch, 3D, glänzend");
  const zeilen = frech.trimEnd().split("\n");
  pruefe("der Stil steht auch ganz unten", /naiven Comicstil/.test(zeilen[zeilen.length - 1]));
  pruefe("und nach dem Wunsch", frech.indexOf("Zusätzliche Wünsche") < frech.lastIndexOf("naiven Comicstil"));
  pruefe("die Freistellung ebenfalls", /Alphakanal/.test(frech));
  pruefe("und steht nach dem Wunsch",
    frech.indexOf("Zusätzliche Wünsche") < frech.indexOf("Alphakanal"));

  const ort = bildAuftrag("orte", { name: "Hafen" }, "");
  pruefe("Orte bekommen keine Freistellung", !/Alphakanal/.test(ort));
  pruefe("aber den Stil zum Schluss", /naiven Comicstil/.test(ort.trimEnd().split("\n").pop()));
}

console.log("\n7. Eine Version desselben Tiers");
{
  const ohne = bildAuftrag("charaktere", { name: "Mikkeli" }, "als Dämon", false);
  const mit = bildAuftrag("charaktere", { name: "Mikkeli" }, "als Dämon", true);
  pruefe("ohne Vorlage kein Vorlagensatz", !/Vorlage ist die mitgeschickte Figur/.test(ohne));
  pruefe("mit Vorlage schon", /Vorlage ist die mitgeschickte Figur/.test(mit));
  pruefe("und die Wiedererkennbarkeit steht drin", /unverkennbar dasselbe Tier/.test(mit));
  pruefe("der Wunsch bleibt trotzdem stehen", mit.includes("Zusätzliche Wünsche: als Dämon"));
  pruefe("der Vorlagensatz kommt vor dem Wunsch",
    mit.indexOf("Vorlage ist die mitgeschickte") < mit.indexOf("Zusätzliche Wünsche"));
}

console.log("\n8. Die zweite Handschrift");
{
  pruefe("es gibt beide zur Auswahl", BILD_STILE.map((s) => s.id).join(",") === "naiv,erwachsen");
  pruefe("jede hat einen Namen", BILD_STILE.every((s) => s.label && s.hinweis));
  pruefe("bekannte Stile werden erkannt", istBildStil("erwachsen") && istBildStil("naiv"));
  pruefe("erfundene nicht", !istBildStil("fotorealistisch") && !istBildStil(null));

  const naiv = bildAuftrag("charaktere", { name: "Mikkeli" }, "", false, "naiv");
  const erwachsen = bildAuftrag("charaktere", { name: "Mikkeli" }, "", false, "erwachsen");
  pruefe("ohne Angabe bleibt es der Stil des Hauses",
    bildAuftrag("charaktere", { name: "Mikkeli" }) === naiv);
  pruefe("naiv ist der alte Stil", naiv.startsWith(STIL));
  pruefe("erwachsen ist ein anderer", !erwachsen.startsWith(STIL));
  pruefe("und steht ganz oben", erwachsen.startsWith("Erwachsene Illustration"));

  // Der Sinn der Sache: ernster, aber weiterhin gezeichnet und nicht düster.
  pruefe("von Hand gezeichnet", /von Hand gezeichnet/.test(erwachsen));
  pruefe("kein Foto", /Keine Fotorealistik/.test(erwachsen));
  pruefe("kein 3D", /kein 3D-Rendering/.test(erwachsen));
  pruefe("nicht düster oder blutig", /niemals düster/.test(erwachsen));
  pruefe("und keine Schrift", /keine Schrift/i.test(erwachsen));

  // Der Nachklang gehört zum Stil - sonst zöge der Wunsch am Ende dagegen.
  pruefe("der Nachklang passt zum Stil", erwachsen.trimEnd().endsWith("geht allen anderen Angaben vor."));
  pruefe("und nennt die erwachsene Handschrift", /erwachsenen Illustration/.test(erwachsen));
  pruefe("der naive Nachklang taucht dort nicht auf", !/naiven Comicstil/.test(erwachsen));

  // Alles andere bleibt, wie es war.
  const ort = bildAuftrag("orte", { name: "Hafen", stadt: "Muschelbach" }, "Regen", false, "erwachsen");
  pruefe("der Rahmen bleibt", /Ein Schauplatz ohne Figuren/.test(ort));
  pruefe("die Felder bleiben", ort.includes("Stadt: Muschelbach"));
  pruefe("der Wunsch bleibt", ort.includes("Zusätzliche Wünsche: Regen"));
  const ding = bildAuftrag("items", { name: "Zimtdose" }, "", false, "erwachsen");
  pruefe("Freistellung gilt weiter", /vollständig durchsichtig/.test(ding));
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
