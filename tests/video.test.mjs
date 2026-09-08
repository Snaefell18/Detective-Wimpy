/**
 * Videos vor einem Erzählerteil: Sie sind immer optional. Ohne Eintrag darf
 * nirgends ein Video herauskommen - auch nicht bei alten Sagas, deren
 * Vorgaben das Feld noch gar nicht kennen.
 */
import {
  LEERER_ERZAEHLER,
  STANDARD_SAGA_VORGABEN,
  videoFuerKapitel,
  videoVon,
} from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Ohne Eintrag kein Video");
pruefe("leerer Erzählerteil", videoVon(LEERER_ERZAEHLER) === "");
pruefe("Teil ganz ohne Feld", videoVon({ text: "Hallo", audio: "" }) === "");
pruefe("gar kein Teil", videoVon(undefined) === "");
pruefe("nur Leerzeichen zählt nicht", videoVon({ text: "", audio: "", video: "   " }) === "");
pruefe("Standardvorgaben sind leer", STANDARD_SAGA_VORGABEN.kapitelVideos.length === 0);
pruefe("alte Vorgaben ohne Feld", videoFuerKapitel({}, 0) === "");
pruefe("gar keine Vorgaben", videoFuerKapitel(undefined, 2) === "");

console.log("\n2. Mit Eintrag");
{
  const vorgaben = { kapitelAnzahl: 2, kapitelVideos: ["/video/eins.mp4", "", "/video/finale.mp4"] };
  pruefe("Kapitel 1", videoFuerKapitel(vorgaben, 0) === "/video/eins.mp4");
  pruefe("Kapitel 2 bleibt ohne", videoFuerKapitel(vorgaben, 1) === "");
  pruefe(
    "das Finale steht an letzter Stelle",
    videoFuerKapitel(vorgaben, vorgaben.kapitelAnzahl) === "/video/finale.mp4",
  );
  pruefe("hinter dem Finale nichts mehr", videoFuerKapitel(vorgaben, 9) === "");
  pruefe(
    "Leerzeichen um den Pfad stören nicht",
    videoFuerKapitel({ kapitelVideos: ["  /video/a.mp4 "] }, 0) === "/video/a.mp4",
  );
  pruefe("und im Erzählerteil auch nicht", videoVon({ text: "", audio: "", video: " /video/a.mp4 " }) === "/video/a.mp4");
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
