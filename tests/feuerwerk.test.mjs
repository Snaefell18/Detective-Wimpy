/**
 * Das Feuerwerk über der Stadt.
 *
 * Es ist die eine Wetterlage, bei der nichts fällt, sondern etwas aufsteigt -
 * und die einzige, die von Bild zu Bild etwas anlegt und wieder einsammelt.
 * Genau dort kann es klemmen: Ein Vorrat, der sich nicht mehr freigibt, hört
 * nach zehn Sekunden auf zu leuchten; eine Rechnung, die durchdreht, schiebt
 * NaN in die Geometrie, und dann ist das ganze Punktefeld weg.
 *
 * Gerechnet wird hier ohne Bildschirm: three.js braucht für Geometrie und
 * Zahlen kein WebGL.
 */
import * as THREE from "three";
import { wetterFeld } from "../components/stadtBau.ts";
import { DREI_D_WETTER, istFeuerwerk } from "../lib/pursuit3d.ts";
import { WETTERLAGEN } from "../lib/staedte.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const feldBauen = (extra = {}) =>
  wetterFeld({
    wetter: "feuerwerk",
    scene: new THREE.Scene(),
    merken: () => {},
    weite: 28,
    tiefe: 70,
    hoehe: 15,
    versatzZ: -13,
    ...extra,
  });

/** Ein paar Sekunden vergehen lassen - in Schritten wie im Spiel. */
const laufen = (feld, sekunden, zugZ = 0) => {
  let jetzt = 0;
  for (let i = 0; i < Math.round(sekunden / 0.05); i++) {
    jetzt += 50;
    feld.bewegen(0.05, jetzt, zugZ);
  }
  return jetzt;
};

const zaehlen = (feld) => {
  const geometrie = feld.gruppe.children[0].geometry;
  const farbe = geometrie.getAttribute("color");
  const pos = geometrie.getAttribute("position");
  let leuchtend = 0;
  let hoechster = 0;
  let kaputt = 0;
  for (let i = 0; i < farbe.count; i++) {
    if (farbe.getX(i) + farbe.getY(i) + farbe.getZ(i) > 0.05) leuchtend++;
    hoechster = Math.max(hoechster, pos.getY(i));
    if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(farbe.getX(i))) kaputt++;
  }
  return { leuchtend, hoechster, kaputt, anzahl: farbe.count };
};

console.log("\n1. Es gibt die Lage überhaupt");
{
  pruefe("„feuerwerk“ steht in der Auswahl", DREI_D_WETTER.some((l) => l.id === "feuerwerk"));
  pruefe("und in der Liste fürs Schema", WETTERLAGEN.includes("feuerwerk"));
  pruefe("die Frage stimmt", istFeuerwerk("feuerwerk") && !istFeuerwerk("regen"));
}

console.log("\n2. Es steigt auf und leuchtet");
{
  const feld = feldBauen();
  pruefe("ein Wetterfeld kommt zurück", Boolean(feld));
  laufen(feld, 4);
  const nach4 = zaehlen(feld);
  pruefe("nach vier Sekunden leuchtet etwas", nach4.leuchtend > 0, `${nach4.leuchtend} Funken`);
  pruefe("und es ist über den Häusern", nach4.hoechster > 11, `${nach4.hoechster.toFixed(1)} m`);
  pruefe("nichts ist kaputtgerechnet", nach4.kaputt === 0);

  // Der lange Lauf: Wird der Vorrat wieder frei, brennt es auch nach einer
  // Minute noch. Sammelt er sich nicht ein, ist hier Schluss.
  laufen(feld, 60);
  const spaet = zaehlen(feld);
  pruefe("nach einer Minute brennt es weiter", spaet.leuchtend > 0, `${spaet.leuchtend} Funken`);
  pruefe("und nichts ist kaputt", spaet.kaputt === 0);
  pruefe(
    "der Vorrat läuft nicht über",
    spaet.leuchtend < spaet.anzahl,
    `${spaet.leuchtend} von ${spaet.anzahl}`,
  );
}

console.log("\n3. Es nimmt keine Sicht und verträgt die Verfolgungsjagd");
{
  const feld = feldBauen();
  pruefe("die Sicht bleibt voll", feld.sicht(0) === 1 && feld.sicht(9999) === 1);

  // In der Jagd zieht die Welt unter dem Wetter weg.
  const jagd = feldBauen({ weite: 34, tiefe: 110, versatzZ: 16, hoehe: 16, groesse: 2 });
  laufen(jagd, 12, 0.4);
  const stand = zaehlen(jagd);
  pruefe("auch mit Zug brennt es", stand.leuchtend > 0, `${stand.leuchtend} Funken`);
  pruefe("und nichts ist kaputt", stand.kaputt === 0);
}

console.log("\n4. Ein stehengebliebenes Bild macht nichts kaputt");
{
  const feld = feldBauen();
  laufen(feld, 3);
  // Der Tab lag im Hintergrund: ein Schritt über zwei Sekunden.
  feld.bewegen(2.4, 5000);
  const stand = zaehlen(feld);
  pruefe("es brennt weiter", stand.leuchtend > 0, `${stand.leuchtend} Funken`);
  pruefe("und nichts ist kaputt", stand.kaputt === 0);
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
