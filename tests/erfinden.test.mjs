/**
 * Stammdaten erfinden lassen: ein Ding oder eine ganze Stadt.
 *
 * Beides ist ein Vorschlag, kein Eintrag - gespeichert wird erst im Menü.
 * Geprüft wird deshalb vor allem, dass die Bestellung stimmt: keine Waffen,
 * nichts Modernes, keine Wiederholungen, und bei einer Stadt genau so viele
 * Schauplätze, wie bestellt wurden. Dazu die Id-Vergabe, auf die sich jetzt
 * zwei Bildschirme verlassen.
 */
import { buildDingPrompt, buildStadtPrompt } from "../lib/erfindenPrompt.ts";
import { DingSchema, StadtSchema } from "../lib/schemas.ts";
import { slug, vervollstaendigen } from "../lib/stammdatenIds.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Ein Ding bestellen");
{
  const p = buildDingPrompt({ vorhanden: ["Lupe", "Taschenuhr"], wunsch: "" });
  pruefe("die Welt steht drin", p.includes("Detective Wimpy"));
  pruefe("es ist ein Ding", p.includes("Ein Ding, kein Lebewesen"));
  pruefe("es muss handfest sein", p.includes("Etwas Handfestes"));
  pruefe("der Name bleibt kurz", p.includes("ein bis drei Wörter"));
  pruefe("nichts Modernes", p.includes("keine Handys"));
  pruefe("nichts Gefährliches", p.includes("keine Waffen"));
  pruefe("keine Marken", p.includes("keiner Marke"));
  pruefe("es taugt als Fundstück", p.includes("Fundstück"));
  pruefe("und gehört keinem Fall", p.includes("gehört zu keinem bestimmten Fall"));
  pruefe("Vorhandenes wird genannt", p.includes("Lupe, Taschenuhr"));
  pruefe("mit der Bitte um etwas anderes", p.includes("erfinde etwas anderes"));

  const ohne = buildDingPrompt({ vorhanden: [], wunsch: "" });
  pruefe("ohne Bestand keine Liste", !ohne.includes("DAS GIBT ES SCHON"));

  const mitWunsch = buildDingPrompt({ vorhanden: [], wunsch: "etwas aus einer Bäckerei" });
  pruefe("der Wunsch steht drin", mitWunsch.includes("etwas aus einer Bäckerei"));
  pruefe("und gilt unbedingt", mitWunsch.includes("unbedingt einhalten"));

  // Eine sehr lange Liste darf den Prompt nicht sprengen.
  const viele = buildDingPrompt({
    vorhanden: Array.from({ length: 300 }, (_, i) => `Ding ${i}`),
    wunsch: "",
  });
  pruefe("lange Listen werden gekürzt", !viele.includes("Ding 200"));
  pruefe("der Anfang ist dabei", viele.includes("Ding 0"));
}

console.log("\n2. Eine Stadt bestellen");
{
  const p = buildStadtPrompt({ stadt: "Muschelbach", anzahl: 5, vorhanden: ["Venedig"], wunsch: "" });
  pruefe("die Anzahl steht oben", p.includes("und 5 Schauplätze"));
  pruefe("genau so viele", p.includes("Genau 5 Stück"));
  pruefe("der Wunschname gilt", p.includes("Sie heißt: Muschelbach"));
  pruefe("und wird genau so genommen", p.includes("Nimm den Namen genau so"));
  pruefe("vorhandene Städte werden genannt", p.includes("Venedig"));
  pruefe("die Orte sollen verschieden sein", p.includes("nicht fünfmal dasselbe"));
  pruefe("Atmosphäre ist kein Satz", p.includes("Kein ganzer Satz"));
  pruefe("keine Tiere in der Beschreibung", p.includes("ohne Tiere beim Namen"));
  pruefe("nichts Blutiges", p.includes("nichts Blutiges"));
  pruefe("es muss etwas liegen bleiben können", p.includes("etwas liegen bleiben kann"));

  const ohneNamen = buildStadtPrompt({ stadt: "", anzahl: 3, vorhanden: [], wunsch: "" });
  pruefe("ohne Namen denkt es sich einen aus", ohneNamen.includes("Denk dir einen Namen aus"));
  pruefe("kein Witzname", ohneNamen.includes("nicht wie ein Witz"));
  pruefe("die Anzahl zieht durch", ohneNamen.includes("Genau 3 Stück"));
  pruefe("ohne Bestand keine Stadtliste", !ohneNamen.includes("gibt es schon"));

  const mitWunsch = buildStadtPrompt({ stadt: "", anzahl: 5, vorhanden: [], wunsch: "Hafen im Winter" });
  pruefe("der Wunsch steht drin", mitWunsch.includes("Hafen im Winter"));
}

console.log("\n3. Die Schemata");
{
  const ding = DingSchema.safeParse({ name: "Zimtdose", beschreibung: "Eine kleine Blechdose." });
  pruefe("ein Ding kommt durch", ding.success);
  pruefe("ohne Namen nicht", !DingSchema.safeParse({ beschreibung: "x" }).success);

  const stadt = StadtSchema.safeParse({
    stadt: "Muschelbach",
    orte: [{ name: "Hafen", atmosphaere: "salzig, laut", beschreibung: "Kisten, Möwen." }],
  });
  pruefe("eine Stadt kommt durch", stadt.success);
  pruefe("mit ihren Orten", stadt.success && stadt.data.orte.length === 1);
  pruefe(
    "ein Ort ohne Atmosphäre nicht",
    !StadtSchema.safeParse({ stadt: "X", orte: [{ name: "A", beschreibung: "b" }] }).success,
  );
}

console.log("\n4. Aus Namen werden Ids - für beide Bildschirme dieselbe Rechnung");
{
  pruefe("Umlaute werden ausgeschrieben", slug("Öhös Kanzlei") === "oehoes-kanzlei");
  pruefe("Leerzeichen werden Striche", slug("Die Alte Bäckerei") === "die-alte-baeckerei");
  pruefe("Sonderzeichen fliegen raus", slug("Hafenschuppen 3!") === "hafenschuppen-3");

  const ort = vervollstaendigen("orte", {
    id: "",
    stadt: "Muschelbach",
    stadtId: "",
    name: "Die Alte Bäckerei",
    atmosphaere: "warm, mehlig",
    beschreibung: "",
    bild: "",
  });
  pruefe("die Id hängt an Stadt und Name", ort.id === "muschelbach-die-alte-baeckerei");
  pruefe("die Stadt-Id entsteht mit", ort.stadtId === "muschelbach");
  pruefe("der Bildpfad folgt der Id", ort.bild === "/orte/muschelbach-die-alte-baeckerei.png");
  pruefe(
    "eine fehlende Beschreibung wird gefüllt",
    ort.beschreibung === "Die Alte Bäckerei - warm, mehlig.",
  );

  const mitBild = vervollstaendigen("orte", {
    id: "", stadt: "Muschelbach", stadtId: "", name: "Hafen",
    atmosphaere: "", beschreibung: "Kisten.", bild: "bild:abc",
  });
  pruefe("ein erzeugtes Bild bleibt stehen", mitBild.bild === "bild:abc");
  pruefe("eine eigene Beschreibung bleibt", mitBild.beschreibung === "Kisten.");

  const ding = vervollstaendigen("items", { id: "", name: "Zimtdose", beschreibung: "", bild: "" });
  pruefe("ein Ding bekommt seine Id", ding.id === "zimtdose");
  pruefe("und seinen Pfad", ding.bild === "/items/zimtdose.png");
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
