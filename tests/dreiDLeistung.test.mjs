/**
 * Was ein Gerät verträgt - und was die Kamera nicht mehr sieht.
 *
 * Auf dem iPhone ist die selbst gelegte Stadt abgestürzt: erst Geruckel,
 * dann war der Tab weg. Dagegen stehen drei Rechnungen, und die sind hier
 * geprüft: das Profil (wie viel Sicht, Schatten, Auflösung und Textur ein
 * Gerät bekommt), die Regelung (was passiert, wenn es trotzdem klemmt) und
 * die Sichtlinie (welche Häuser zwischen Kamera und Wimpy stehen).
 */
import {
  ARTEN_EMPFEHLUNG,
  REGEL_BODEN,
  REGEL_START,
  artenWarnung,
  leistungsProfil,
  nachregeln,
} from "../lib/dreiDLeistung.ts";
import {
  FELD_GROESSE,
  STRASSE,
  beispielPlan,
  feldMitte,
  feldSetzen,
  leererPlan,
  sichtFelder,
} from "../lib/stadtplan.ts";
import { DREI_D_LOCATIONS } from "../lib/pursuit3d.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const haus = DREI_D_LOCATIONS[0].id;

/** Eine Stadt mit Straßenkreuz und Häusern in allen übrigen Feldern. */
const vollGebaut = (kante) => {
  let plan = beispielPlan(kante, kante);
  for (let z = 0; z < plan.tiefe; z++) {
    for (let x = 0; x < plan.breite; x++) {
      if (plan.felder[z * plan.breite + x] !== STRASSE) plan = feldSetzen(plan, x, z, haus);
    }
  }
  return plan;
};

console.log("\n1. Das Profil richtet sich nach Gerät und Stadt");
{
  const klein = leistungsProfil(beispielPlan(5, 5), false);
  const grosseStadt = vollGebaut(12);
  const gross = leistungsProfil(grosseStadt, false);
  const handy = leistungsProfil(grosseStadt, true);

  pruefe("am Schreibtisch gibt es Schatten", klein.schatten && gross.schatten);
  pruefe("auf dem Handy nicht", !handy.schatten, "genau der zweite Durchgang, der zu viel war");
  pruefe("und auch keine Kantenglättung", !handy.kantenglaettung && klein.kantenglaettung);
  pruefe("die große Stadt sieht weniger weit als die kleine", gross.sichtweite < klein.sichtweite);
  pruefe("das Handy noch weniger", handy.sichtweite < gross.sichtweite);
  pruefe(
    "aber immer noch mehrere Felder weit",
    handy.sichtweite >= FELD_GROESSE * 4,
    `${handy.sichtweite} m`,
  );
  pruefe("Texturen werden auf dem Handy kleingerechnet", handy.texturGrenze <= 512);
  pruefe("am Schreibtisch bleiben sie groß", klein.texturGrenze >= 2048);
  pruefe("die Auflösung wird auf dem Handy gedeckelt", handy.pixelGrenze < klein.pixelGrenze);
  pruefe("und der Grund steht dabei", handy.grund === "handy" && gross.grund === "groß" && klein.grund === "klein");

  const ohne = leistungsProfil(null, false);
  pruefe("ohne Plan bleibt alles wie bisher", ohne.grund === "klein" && ohne.schatten);

  // Der Straßenzug von früher lief auf dem iPhone immer schon - der soll
  // aussehen wie bisher. Gespart wird dort nur, wo man es nicht sieht.
  const strassenzug = leistungsProfil(null, true);
  pruefe("auf dem Handy behält der Straßenzug seine Schatten", strassenzug.schatten);
  pruefe("und seine Kantenglättung", strassenzug.kantenglaettung);
  pruefe("aber kleinere Texturen", strassenzug.texturGrenze < klein.texturGrenze);
}

console.log("\n2. Die Regelung nimmt zurück und gibt zurück");
{
  let stand = REGEL_START;
  pruefe("sie fängt bei voller Sicht an", stand.faktor === 1);

  // Zwei Sekunden mit 20 Bildern je Sekunde.
  for (let i = 0; i < 40; i++) stand = nachregeln(stand, 1 / 20);
  pruefe("Ruckeln kostet Sichtweite", stand.faktor < 1, `${stand.faktor}`);

  // Und wenn es weiter ruckelt, immer weiter - aber nicht ins Bodenlose.
  for (let i = 0; i < 2000; i++) stand = nachregeln(stand, 1 / 12);
  pruefe("sie hat einen Boden", stand.faktor === REGEL_BODEN, `${stand.faktor}`);

  // Jetzt läuft es wieder rund: 60 Bilder je Sekunde, zehn Sekunden lang.
  for (let i = 0; i < 600; i++) stand = nachregeln(stand, 1 / 60);
  pruefe("Ruhe gibt Sichtweite zurück", stand.faktor > REGEL_BODEN, `${stand.faktor}`);
  for (let i = 0; i < 4000; i++) stand = nachregeln(stand, 1 / 60);
  pruefe("bis wieder alles da ist", stand.faktor === 1);
  pruefe("und nicht darüber hinaus", nachregeln(stand, 1 / 60).faktor === 1);

  let kurz = REGEL_START;
  for (let i = 0; i < 20; i++) kurz = nachregeln(kurz, 1 / 20);
  pruefe("ein kurzer Hänger allein regelt noch nichts herunter", kurz.faktor === 1);
}

console.log("\n3. Die Sichtlinie findet, was der Kamera im Weg steht");
{
  const plan = beispielPlan(7, 7);
  const mitte = feldMitte(plan, 3, 3);

  const selbst = sichtFelder(plan, mitte.x, mitte.z, mitte.x, mitte.z);
  pruefe("ohne Strecke ist es das eigene Feld", selbst.length === 1 && selbst[0].x === 3 && selbst[0].z === 3);

  // Die Kamera steht neun Meter weiter hinten - ein Feld.
  const gerade = sichtFelder(plan, mitte.x, mitte.z, mitte.x, mitte.z + FELD_GROESSE);
  pruefe("gerade nach hinten sind es zwei Felder", gerade.length === 2, `${gerade.length}`);
  pruefe("das eigene zuerst", gerade[0].x === 3 && gerade[0].z === 3);
  pruefe("dann das dahinter", gerade[1].x === 3 && gerade[1].z === 4);

  // Und jetzt die echte Kamera: 9,5 Meter zur Seite, 13,8 nach hinten.
  const schraeg = sichtFelder(plan, mitte.x, mitte.z, mitte.x - 9.5, mitte.z + 13.8);
  pruefe("schräg dahinter liegen mehrere Felder", schraeg.length >= 3, `${schraeg.length}`);
  pruefe(
    "darunter das Eckfeld, in dem die Kamera landet",
    schraeg.some((feld) => feld.x === 2 && feld.z === 5),
    JSON.stringify(schraeg),
  );
  pruefe(
    "kein Feld doppelt",
    new Set(schraeg.map((feld) => `${feld.x},${feld.z}`)).size === schraeg.length,
  );
  pruefe(
    "nichts wird übersprungen - jedes Feld grenzt ans vorige",
    schraeg.every((feld, i) =>
      i === 0 || Math.abs(feld.x - schraeg[i - 1].x) + Math.abs(feld.z - schraeg[i - 1].z) <= 2),
    JSON.stringify(schraeg),
  );

  // Genau das ist der Fall, über den der Spieler gestolpert ist: Wimpy steht
  // auf der Straße, die Kamera hinter einem Haus.
  const stadt = vollGebaut(7);
  const imWeg = sichtFelder(stadt, mitte.x, mitte.z, mitte.x - 9.5, mitte.z + 13.8)
    .filter((feld) => stadt.felder[feld.z * stadt.breite + feld.x] === haus);
  pruefe("in der gebauten Stadt steht wirklich etwas dazwischen", imWeg.length > 0, `${imWeg.length} Häuser`);
}

console.log("\n4. Die Warnung im Editor");
{
  pruefe("bis zur Empfehlung schweigt sie", artenWarnung(ARTEN_EMPFEHLUNG) === "");
  const warnung = artenWarnung(ARTEN_EMPFEHLUNG + 3);
  pruefe("darüber sagt sie, worum es geht", warnung.includes("Texturen") && warnung.includes("Handy"));
  pruefe("und dass Wiederholung nichts kostet", warnung.includes("mehrfach"));
}

console.log("\n5. Der leere Plan bringt nichts durcheinander");
{
  const leer = leererPlan(4, 4);
  const profil = leistungsProfil(leer, true);
  pruefe("auch ohne Straße gibt es ein Profil", profil.sichtweite > 0 && !profil.schatten);
  pruefe("und die Sichtlinie bleibt eine Liste", Array.isArray(sichtFelder(leer, 0, 0, 30, 30)));
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
