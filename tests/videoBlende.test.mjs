/**
 * Wann ein Video abblendet.
 *
 * Der Vorhang muss VOR dem letzten Bild kommen, sonst sieht man ihn nicht
 * mehr - und er darf ein kurzes Video nicht halb verschlucken.
 */
import { blendeJetzt } from "../components/VideoSzene.tsx";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Ein Video normaler Länge (12 s)");
pruefe("am Anfang noch nicht", blendeJetzt(0, 12) === null);
pruefe("in der Mitte auch nicht", blendeJetzt(6, 12) === null);
pruefe("eine Sekunde vor Schluss auch nicht", blendeJetzt(11.0, 12) === null);
pruefe("kurz davor schon", blendeJetzt(11.2, 12) === 900, `${blendeJetzt(11.2, 12)}`);
pruefe("und am Ende erst recht", blendeJetzt(12, 12) === 900);

console.log("\n2. Kurze Videos werden nicht verschluckt");
pruefe("ein Zweisekünder blendet kürzer", blendeJetzt(2, 2) === 666.6666666666666);
pruefe("und beginnt erst im letzten Drittel", blendeJetzt(1.2, 2) === null);
pruefe("ein Zehnsekünder bekommt die volle Blende", blendeJetzt(10, 10) === 900);

console.log("\n3. Ohne brauchbare Länge passiert nichts");
pruefe("keine Dauer", blendeJetzt(1, undefined) === null);
pruefe("Dauer null", blendeJetzt(1, 0) === null);
pruefe("unendlich (Livestream)", blendeJetzt(1, Infinity) === null);
pruefe("negativ", blendeJetzt(1, -5) === null);

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
