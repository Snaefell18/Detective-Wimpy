/**
 * Das Strafmaß: Jedes Urteil läuft auf Tage im Schrank hinaus. Die Zahl kommt
 * vom Modell - verlassen kann man sich darauf nicht, also fängt sie der Server.
 */
import {
  HAFT_REGEL,
  KUERZESTE_HAFT,
  LAENGSTE_HAFT,
  haftSatz,
  haftTage,
} from "../lib/schrankhaft.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Was das Modell schickt, wird eingefangen");
pruefe("eine normale Zahl bleibt", haftTage(14) === 14);
pruefe("Kommastellen werden gerundet", haftTage(6.6) === 7);
pruefe("Text mit Zahl geht auch", haftTage("12") === 12);
pruefe("zu lang wird gekappt", haftTage(5000) === LAENGSTE_HAFT);
pruefe("negativ heißt: niemand in den Schrank", haftTage(-3) === 0);
pruefe("null bleibt null", haftTage(0) === 0);
pruefe("Unsinn fällt auf den Vorgabewert", haftTage("bald", 7) === 7);
pruefe("gar nichts ebenso", haftTage(undefined, 21) === 21);
pruefe("kürzeste Strafe ist ein Tag", haftTage(0.4) === 0 && KUERZESTE_HAFT === 1);

console.log("\n2. Wie es dasteht");
pruefe("Mehrzahl", haftSatz(14) === "14 Tage Schrankhaft");
pruefe("Einzahl", haftSatz(1) === "1 Tag Schrankhaft");

console.log("\n3. Die Ansage ans Modell");
pruefe("nennt den Schrank", HAFT_REGEL.includes("Schrankhaft"));
pruefe("verbietet das Gefängnis", HAFT_REGEL.includes("Gefängnis gibt es hier nicht"));

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
