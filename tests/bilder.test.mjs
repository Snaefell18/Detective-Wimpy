/**
 * Bilder ohne Eintrag: Was frei ist, muss wirklich frei sein - sonst legt
 * jemand ein Tier doppelt an, weil dasselbe Bild zweimal auftaucht.
 */
import {
  bildSchluessel,
  freieBilder,
  nameAusPfad,
  ordnerVon,
  ORDNER_ZU_ART,
} from "../lib/freieBilder.ts";
import { ALLE_BILDER, BILD_DATEIEN } from "../lib/bilder.generated.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Pfade auf einen Nenner");
pruefe("Großschreibung zählt nicht", bildSchluessel("/Orte/Hafen.PNG") === "/orte/hafen.png");
pruefe("fehlender Schrägstrich wird ergänzt", bildSchluessel("orte/hafen.png") === "/orte/hafen.png");
pruefe("Anhängsel fallen weg", bildSchluessel("/orte/hafen.png?v=2") === "/orte/hafen.png");
pruefe("Leerzeichen stören nicht", bildSchluessel("  /orte/hafen.png  ") === "/orte/hafen.png");
pruefe("leer bleibt leer", bildSchluessel("") === "");

console.log("\n2. Was frei ist");
{
  const alle = ["/charaktere/a.png", "/charaktere/b.png", "/orte/c.png"];
  pruefe("ohne Belegung ist alles frei", freieBilder([], alle).length === 3);
  pruefe("Belegtes fällt raus", JSON.stringify(freieBilder(["/charaktere/a.png"], alle)) ===
    JSON.stringify(["/charaktere/b.png", "/orte/c.png"]));
  pruefe("auch in anderer Schreibweise", freieBilder(["/Charaktere/A.PNG"], alle).length === 2);
  pruefe("leere Einträge belegen nichts", freieBilder(["", undefined], alle).length === 3);
  pruefe("Unbekanntes stört nicht", freieBilder(["/gibtsnicht.png"], alle).length === 3);
  pruefe("Reihenfolge bleibt", freieBilder([], alle)[0] === "/charaktere/a.png");
}

console.log("\n3. Ordner und Art");
pruefe("Ordner erkannt", ordnerVon("/orte/hafen.png") === "orte");
pruefe("oben liegt sonstiges", ordnerVon("/start.png") === "sonstige");
pruefe("Ordner führt zur Art", ORDNER_ZU_ART[ordnerVon("/charaktere/x.png")] === "charaktere");
pruefe("Video gehört zu keiner Art", ORDNER_ZU_ART[ordnerVon("/video/x.png")] === undefined);

console.log("\n4. Namensvorschlag");
pruefe("aus dem Dateinamen", nameAusPfad("/orte/alter_hafen.png") === "Alter Hafen");
pruefe("Bindestriche zählen auch", nameAusPfad("/orte/alter-hafen.png") === "Alter Hafen");
pruefe("Zahl wird abgetrennt", nameAusPfad("/charaktere/kopf_1.png") === "Kopf 1");
pruefe("einfacher Name", nameAusPfad("/charaktere/wimpy.png") === "Wimpy");
pruefe("ohne Endung geht auch", nameAusPfad("/charaktere/wimpy") === "Wimpy");
pruefe("nie leer bei leerem Pfad", nameAusPfad("") === "");

console.log("\n5. Die erzeugte Liste");
pruefe("es gibt Bilder", ALLE_BILDER.length > 0, `${ALLE_BILDER.length}`);
pruefe("alle beginnen mit /", ALLE_BILDER.every((p) => p.startsWith("/")));
pruefe("keine Dopplungen", new Set(ALLE_BILDER).size === ALLE_BILDER.length);
pruefe("jeder Ordner ist eine Liste", Object.values(BILD_DATEIEN).every(Array.isArray));
pruefe("die Summe stimmt", Object.values(BILD_DATEIEN).flat().length === ALLE_BILDER.length);

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
