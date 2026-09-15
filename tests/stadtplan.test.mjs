/**
 * Der selbst gelegte Stadtplan.
 *
 * Geprüft wird die Rechnung dahinter: was begehbar ist, wo die Stadt endet,
 * wie aus Feldern Weltkoordinaten werden und dass Tiere sich verteilen statt
 * sich zu stapeln. Der Straßenzug von früher muss daneben unberührt bleiben.
 */
import {
  FELD_GROESSE,
  STRASSE,
  beispielPlan,
  begehbar,
  drehungAn,
  feldAn,
  feldBei,
  feldDrehen,
  feldMitte,
  feldSetzen,
  gebaeudeFelder,
  leererPlan,
  planAusmass,
  planGroesse,
  planGueltig,
  startFeld,
  strassenFelder,
  verteilen,
} from "../lib/stadtplan.ts";
import { DREI_D_LOCATIONS, STANDARD_KAPITEL_3D } from "../lib/pursuit3d.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Ein leerer Plan und die Kreuzung zum Anfangen");
{
  const leer = leererPlan(5, 6);
  pruefe("die Größe stimmt", leer.breite === 5 && leer.tiefe === 6);
  pruefe("und es sind so viele Felder", leer.felder.length === 30);
  pruefe("alle leer", leer.felder.every((f) => f === ""));
  pruefe("ohne Straße ist er unbrauchbar", !planGueltig(leer));

  pruefe("zu klein wird angehoben", leererPlan(1, 1).breite === 3);
  pruefe("zu groß wird gekappt", leererPlan(99, 99).tiefe === 14);

  const kreuz = beispielPlan(7, 7);
  pruefe("die Kreuzung ist begehbar", planGueltig(kreuz));
  pruefe("sie hat eine Mitte", feldAn(kreuz, 3, 3) === STRASSE);
  pruefe("und Arme bis an den Rand", feldAn(kreuz, 0, 3) === STRASSE && feldAn(kreuz, 3, 6) === STRASSE);
  pruefe("die Ecken bleiben frei", feldAn(kreuz, 0, 0) === "");
  pruefe("13 Straßenfelder", strassenFelder(kreuz).length === 13, `${strassenFelder(kreuz).length}`);
}

console.log("\n2. Felder setzen, drehen, vergrößern");
{
  const haus = DREI_D_LOCATIONS[0].id;
  let plan = feldSetzen(beispielPlan(5, 5), 0, 0, haus);
  pruefe("das Gebäude steht", feldAn(plan, 0, 0) === haus);
  pruefe("ungedreht", drehungAn(plan, 0, 0) === 0);
  plan = feldDrehen(plan, 0, 0);
  pruefe("einmal gedreht", drehungAn(plan, 0, 0) === 90);
  plan = feldDrehen(feldDrehen(feldDrehen(plan, 0, 0), 0, 0), 0, 0);
  pruefe("viermal ist wieder geradeaus", drehungAn(plan, 0, 0) === 0);
  pruefe("Straßen lassen sich nicht drehen", drehungAn(feldDrehen(plan, 2, 2), 2, 2) === 0);

  // Dasselbe Haus darf so oft vorkommen, wie man will.
  plan = feldSetzen(feldSetzen(plan, 0, 1, haus), 4, 4, haus);
  pruefe("dasselbe Gebäude mehrfach", gebaeudeFelder(plan).filter((g) => g.id === haus).length === 3);
  pruefe("unbekannte Bausteine werden übergangen", gebaeudeFelder(feldSetzen(plan, 4, 0, "gibtsnicht")).length === 3);

  plan = feldSetzen(plan, 0, 0, "");
  pruefe("gelöscht ist gelöscht", feldAn(plan, 0, 0) === "");
  const gedreht = feldDrehen(feldSetzen(plan, 1, 0, haus), 1, 0);
  pruefe("beim Überschreiben fällt die Drehung weg", drehungAn(feldSetzen(gedreht, 1, 0, STRASSE), 1, 0) === 0);

  const groesser = planGroesse(beispielPlan(5, 5), 8, 8);
  pruefe("vergrößern erhält die Felder", groesser.breite === 8 && feldAn(groesser, 2, 2) === STRASSE);
  const kleiner = planGroesse(beispielPlan(9, 9), 4, 4);
  pruefe("verkleinern schneidet nur ab", kleiner.felder.length === 16);
}

console.log("\n3. Wo man laufen darf - und wo die Straße endet");
{
  const plan = beispielPlan(5, 5);
  const mitte = feldMitte(plan, 2, 2);
  pruefe("die Mitte liegt im Ursprung", mitte.x === 0 && mitte.z === 0);
  pruefe("ein Feld weiter sind es 9 Meter", feldMitte(plan, 3, 2).x === FELD_GROESSE);
  pruefe("und zurück findet dasselbe Feld", feldBei(plan, FELD_GROESSE, 0).x === 3);

  pruefe("auf der Kreuzung geht es", begehbar(plan, 0, 0));
  // Der Arm nach rechts hört am Rand auf: dahinter ist nichts mehr.
  const rand = feldMitte(plan, 4, 2);
  pruefe("bis zum letzten Feld", begehbar(plan, rand.x, rand.z));
  pruefe("einen Schritt weiter nicht mehr", !begehbar(plan, rand.x + FELD_GROESSE, rand.z));
  pruefe("und quer in die Häuserzeile auch nicht", !begehbar(plan, rand.x, rand.z + FELD_GROESSE));
  // Der Radius hält Abstand zur Wand: Im Arm nach rechts (x = 9) grenzt
  // das Nachbarfeld in z an ein leeres Feld.
  const arm = feldMitte(plan, 3, 2);
  pruefe("mitten im Arm geht es", begehbar(plan, arm.x, arm.z));
  pruefe("dicht an der Kante ist Schluss", !begehbar(plan, arm.x, arm.z + FELD_GROESSE / 2 - 0.3));
  pruefe("mit kleinerem Radius noch knapp", begehbar(plan, arm.x, arm.z + FELD_GROESSE / 2 - 0.3, 0.1));

  const ausmass = planAusmass(plan);
  pruefe("die Stadt ist so groß wie ihr Raster", ausmass.breite === 45 && ausmass.tiefe === 45);
}

console.log("\n4. Tiere verteilen sich, stapeln sich aber nicht");
{
  const plan = beispielPlan(7, 7);
  const start = startFeld(plan);
  pruefe("der Start liegt mittig auf der Straße", start?.x === 3 && start?.z === 3);

  let wert = 0.123;
  const zufall = () => (wert = (wert * 9301 + 49297) % 233280 / 233280);
  const plaetze = verteilen(plan, 8, zufall);
  pruefe("acht Plätze", plaetze.length === 8);
  pruefe("alle begehbar", plaetze.every((p) => begehbar(plan, p.x, p.z, 0.4)), "sonst stünde jemand in der Wand");
  const paare = new Set(plaetze.map((p) => `${Math.round(p.x)},${Math.round(p.z)}`));
  pruefe("keine zwei am selben Fleck", paare.size === 8);
  pruefe("und niemand im Startfeld", plaetze.every((p) => Math.hypot(p.x, p.z) > 1));

  // Mehr Tiere als Felder: Dann rücken sie zusammen, statt zu verschwinden.
  const viele = verteilen(plan, 30, zufall);
  pruefe("mehr Tiere als Felder gehen auch", viele.length === 30);
  pruefe("ohne Straße gibt es keine Plätze", verteilen(leererPlan(4, 4), 5, zufall).length === 0);
}

console.log("\n5. Der Plan übersteht Speichern und Erzeugung");
{
  const plan = feldSetzen(beispielPlan(5, 5), 0, 0, DREI_D_LOCATIONS[0].id);
  const gespeichert = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{ ...STANDARD_KAPITEL_3D, aktiv: true, plan }],
  });
  pruefe("er kommt durch", gespeichert.success, gespeichert.error?.issues[0]?.message);
  pruefe("mit allen Feldern", gespeichert.data?.kapitel3d[0].plan?.felder.length === 25);
  pruefe("und ist danach noch gültig", planGueltig(gespeichert.data?.kapitel3d[0].plan));

  const ohne = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{ ...STANDARD_KAPITEL_3D, aktiv: true }],
  });
  pruefe("ältere Kapitel bleiben ohne Plan gültig", ohne.success && ohne.data?.kapitel3d[0].plan === null);

  const kaputt = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{ ...STANDARD_KAPITEL_3D, aktiv: true, plan: { breite: 900, tiefe: 2, felder: "nein" } }],
  });
  pruefe("ein kaputter Plan wirft das Kapitel nicht weg", kaputt.success);
  pruefe("er wird einfach zu keinem Plan", kaputt.data?.kapitel3d[0].plan === null);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
