/**
 * Wer erst später auftritt, darf vorher nirgends stehen - vor allem nicht im
 * Vorspann. Diese Prüfungen decken die Wortgrenzen ab (ein Name in einem
 * anderen Wort ist kein Verrat) und das satzweise Streichen.
 */
import {
  nenntNamen,
  nochNichtDa,
  ohneNamen,
  spaeteNamen,
  titelOhneNamen,
  worteOhneNamen,
} from "../lib/namenSchutz.ts";

const alle = [
  { id: "wimpy", name: "Wimpy", istDetektiv: true },
  { id: "boss", name: "Boss", istDetektiv: false },
  { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  { id: "nala", name: "Nala", istDetektiv: false },
  { id: "fanny", name: "Fanny", istDetektiv: false },
];
const v = (teil) => ({ twist: false, neuzugaenge: {}, kapitelAnzahl: 3, ...teil });

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Namen erkennen");
pruefe("einfacher Treffer", nenntNamen("Nala war da.", ["Nala"]).length === 1);
pruefe("Groß- und Kleinschreibung egal", nenntNamen("nala war da.", ["Nala"]).length === 1);
pruefe("am Satzanfang", nenntNamen("Nala kam.", ["Nala"]).length === 1);
pruefe("am Textende ohne Punkt", nenntNamen("Dann kam Nala", ["Nala"]).length === 1);
pruefe("in Anführungszeichen", nenntNamen("„Nala!“, rief er.", ["Nala"]).length === 1);
pruefe("mit Genitiv-s bleibt Treffer", nenntNamen("Nalas Schal.", ["Nala"]).length === 1);
pruefe("Teil eines anderen Wortes zählt nicht", nenntNamen("Der Bosswagen fuhr.", ["Boss"]).length === 0);
pruefe("Silbe am Wortanfang zählt nicht", nenntNamen("Die Nalabucht.", ["Nala"]).length === 0);
pruefe("nichts drin", nenntNamen("Es regnete.", ["Nala", "Boss"]).length === 0);
pruefe("leerer Name wird ignoriert", nenntNamen("Es regnete.", [""]).length === 0);
pruefe("leerer Text", nenntNamen("", ["Nala"]).length === 0);

console.log("\n2. Sätze streichen");
{
  const text = "Es regnete. Nala stand am Kai. Niemand sagte etwas.";
  const raus = ohneNamen(text, ["Nala"]);
  pruefe("der Satz ist weg", !raus.includes("Nala"), raus);
  pruefe("der Rest bleibt", raus.includes("Es regnete.") && raus.includes("Niemand sagte etwas."));
  pruefe("Satzzeichen bleiben dran", raus.endsWith("etwas."));
}
{
  const text = "Der Hafen schwieg.\nNala kam nicht.\nDer Regen blieb.";
  const raus = ohneNamen(text, ["Nala"]);
  pruefe("Zeilen bleiben Zeilen", raus.split("\n").length === 2, JSON.stringify(raus));
}
pruefe("ohne Namen bleibt alles", ohneNamen("Es regnete.", []) === "Es regnete.");
pruefe("alles betroffen: leer", ohneNamen("Nala kam.", ["Nala"]) === "");

console.log("\n3. Schlagworte und Titel");
pruefe(
  "verräterisches Schlagwort fliegt",
  worteOhneNamen(["Regen", "Nala", "Verrat"], ["Nala"]).join(",") === "Regen,Verrat",
);
pruefe("sauberer Titel bleibt", titelOhneNamen("Die Spur im Regen", ["Nala"]) === "Die Spur im Regen");
pruefe("verräterischer Titel wird leer", titelOhneNamen("Nalas Rache", ["Nala"]) === "");

console.log("\n4. Wer ist wann noch nicht da");
{
  const namen = (kapitel, vorgaben, drahtzieherId = "boss") =>
    nochNichtDa({ besetzung: alle, drahtzieherId, vorgaben, kapitel })
      .map((c) => c.name)
      .join(",");

  pruefe("ohne Besonderheiten ist von Anfang an jeder da", namen(0, v({})) === "");
  pruefe("Twist: der Drahtzieher fehlt im Vorspann", namen(0, v({ twist: true })) === "Boss");
  pruefe("Twist: auch vor dem letzten Kapitel", namen(3, v({ twist: true })) === "Boss");
  pruefe("Twist: im Finale ist er da", namen(4, v({ twist: true })) === "");
  pruefe(
    "Nachzügler: vor seinem Kapitel",
    namen(1, v({ neuzugaenge: { nala: 3 } })) === "Nala",
  );
  pruefe(
    "Nachzügler: ab seinem Kapitel nicht mehr",
    namen(3, v({ neuzugaenge: { nala: 3 } })) === "",
  );
  pruefe(
    "beides zusammen",
    namen(1, v({ twist: true, neuzugaenge: { nala: 2 } })) === "Boss,Nala",
  );
  pruefe("der Detektiv zählt nie mit", !namen(0, v({ twist: true })).includes("Wimpy"));
}

console.log("\n5. Was der Browser wissen darf");
{
  // Ohne Drahtzieher-Id: Der Twist bleibt Sache des Servers, Nachzügler
  // erkennt auch der Vorspann.
  const nurBrowser = spaeteNamen({
    besetzung: alle,
    vorgaben: v({ twist: true, neuzugaenge: { nala: 2 } }),
    kapitel: 0,
  });
  pruefe("Nachzügler werden erkannt", nurBrowser.includes("Nala"), nurBrowser.join(","));
  pruefe("der Drahtzieher wird nicht verraten", !nurBrowser.includes("Boss"));
}

console.log(
  fehlgeschlagen === 0 ? "\nAlles sauber." : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`,
);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
