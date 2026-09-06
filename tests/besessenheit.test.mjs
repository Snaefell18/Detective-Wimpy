/**
 * Die Besessenheit muss in jedem Prompt ankommen, nicht nur im Kern - sonst
 * geschieht in den Kapiteln nichts Unheimliches, und die Verwandlung vor dem
 * Finale käme aus dem Nichts.
 */
import {
  buildKapitelPrompt,
  buildFinalePrompt,
  buildSagaBriefing,
} from "../lib/sagaPrompts.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok) => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}`);
  if (!ok) fehlgeschlagen++;
};
const bes = { wirt: "Nala", daemon: "Der Schattenfürst" };
const gemeinsam = {
  nummer: 2, anzahl: 3, thema: "x", wahrheit: "y", drahtzieherName: "Der Schattenfürst",
  drahtzieherId: "schatten", moeglicheTaeter: [{ id: "mikkeli", name: "Mikkeli" }],
  bisher: [], wunsch: "", stadt: "Kopenhagen", twist: false, neueTiere: [], wunschTaeter: "",
};
const mit = buildKapitelPrompt({ ...gemeinsam, besessenheit: bes });
const ohne = buildKapitelPrompt(gemeinsam);
console.log("\n1. Die Kapitel");
pruefe("mit Besessenheit stehen die Regeln drin", mit.includes("ETWAS ÜBLES GEHT VOR"));
pruefe("ohne bleibt alles wie bisher", !ohne.includes("ETWAS ÜBLES"));
pruefe("der Wirt wird genannt", mit.includes("Nala"));
pruefe("die Dämonengestalt bleibt draußen", mit.includes("kommt vor dem Finale nirgends vor"));

const finale = buildFinalePrompt({
  thema: "x", wahrheit: "y", drahtzieherName: "Der Schattenfürst", motiv: "m",
  bisher: [{ name: "Eins", enthuellung: "e" }], twist: false, neueTiere: [], besessenheit: bes,
});
console.log("\n2. Das Finale");
pruefe("der Erzählertext bereitet die Verwandlung vor", finale.includes("etwas nicht stimmt"));
pruefe("der Epilog erklärt alles", finale.includes("seit wann"));

const fall = buildSagaBriefing({
  thema: "x", wahrheit: "y", drahtzieherName: "Der Schattenfürst", kapitelNummer: 2,
  kapitelAnzahl: 3, auftrag: "a", enthuellung: "e", vorherigeEnthuellungen: [],
  istFinale: false, twist: false, besessenheit: bes,
});
console.log("\n3. Die Fälle");
pruefe("jeder Fall trägt die Zeichen", fall.includes("ETWAS ÜBLES GEHT VOR"));
const finalFall = buildSagaBriefing({
  thema: "x", wahrheit: "y", drahtzieherName: "Der Schattenfürst", kapitelNummer: 0,
  kapitelAnzahl: 3, auftrag: "a", enthuellung: "", vorherigeEnthuellungen: [],
  istFinale: true, twist: false, besessenheit: bes,
});
pruefe("der Finalfall löst es auf", finalFall.includes("bis eben in Nala steckte"));

console.log(
  fehlgeschlagen === 0 ? "\nAlles sauber." : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`,
);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
