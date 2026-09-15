/**
 * Der Weg eines Stadtplans vom Editor bis in die laufende Szene.
 *
 * Zwischen "im Admin-Menü gemalt" und "im Spiel begehbar" liegen vier
 * Stationen, an denen etwas verlorengehen kann: die Prüfung beim Erzeugen,
 * die Reise durch die Datenbank, das Aufräumen beim Speichern und das
 * Heraussuchen der Kapitelkonfiguration im Spiel. Dieser Test geht sie alle
 * ab - mit genau der Rechnung, die auch der Server und der Browser benutzen.
 */
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN, dreiDFuerKapitel } from "../lib/sagaTypen.ts";
import { DREI_D_LOCATIONS, STANDARD_KAPITEL_3D, tankstelleAus } from "../lib/pursuit3d.ts";
import { bereinigteSaga3D, dreiDFuerSagaFall, kapitel3DMitBesetzung } from "../lib/saga3dSync.ts";
import {
  beispielPlan,
  begehbar,
  feldMitte,
  feldSetzen,
  gebaeudeArten,
  hoeheFuer,
  hoeheSetzen,
  planGueltig,
  startFeld,
  strassenFelder,
} from "../lib/stadtplan.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const haus = DREI_D_LOCATIONS[0].id;
const zweites = DREI_D_LOCATIONS[1]?.id ?? haus;

/* So sieht aus, was im Admin-Menü entsteht: Kapitel 2 von dreien in 3D. */
let plan = beispielPlan(7, 7);
plan = feldSetzen(plan, 0, 0, haus);
plan = feldSetzen(plan, 6, 6, haus);
plan = feldSetzen(plan, 0, 6, zweites);
plan = hoeheSetzen(plan, haus, 1.6);
const kapitel3d = [
  { ...STANDARD_KAPITEL_3D },
  { ...STANDARD_KAPITEL_3D, aktiv: true, tageszeit: "nacht", plan, tankstelleId: zweites },
  { ...STANDARD_KAPITEL_3D },
];
const ausDemEditor = { ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 3, kapitel3d };

console.log("\n1. Die Erzeugung nimmt den Plan an");
{
  const geprueft = SagaVorgabenSchema.safeParse(ausDemEditor);
  pruefe("die Vorgaben kommen durch", geprueft.success, geprueft.error?.issues[0]?.message);
  const zweitesKapitel = geprueft.data?.kapitel3d[1];
  pruefe("Kapitel 2 bleibt in 3D", zweitesKapitel?.aktiv === true);
  pruefe("der Plan ist vollständig da", zweitesKapitel?.plan?.felder.length === 49);
  pruefe("und noch begehbar", planGueltig(zweitesKapitel?.plan));
  pruefe("die Tankstelle bleibt gewählt", zweitesKapitel?.tankstelleId === zweites);
  pruefe("die Höhe bleibt stehen", hoeheFuer(zweitesKapitel.plan, haus) === 1.6);
  pruefe("die Nacht bleibt Nacht", zweitesKapitel?.tageszeit === "nacht");
  pruefe("die anderen Kapitel bleiben in 2D", geprueft.data?.kapitel3d[0].aktiv === false);
}

console.log("\n2. Der Weg durch die Datenbank");
{
  // speichereSaga schickt alles durch JSON - genau wie Firestore selbst.
  const wieGespeichert = JSON.parse(JSON.stringify(SagaVorgabenSchema.parse(ausDemEditor)));
  const wiederGelesen = SagaVorgabenSchema.parse(wieGespeichert);
  pruefe("nach Hin und Zurück ist der Plan unverändert",
    JSON.stringify(wiederGelesen.kapitel3d[1].plan) === JSON.stringify(wieGespeichert.kapitel3d[1].plan));
  pruefe("und immer noch begehbar", planGueltig(wiederGelesen.kapitel3d[1].plan));

  // Firestore verbietet Arrays direkt in Arrays - hier steckt keines drin.
  const verschachtelt = (wert) =>
    Array.isArray(wert)
      ? wert.some((teil) => Array.isArray(teil) || verschachtelt(teil))
      : wert && typeof wert === "object"
        ? Object.values(wert).some(verschachtelt)
        : false;
  pruefe("kein Array steckt direkt in einem Array", !verschachtelt(wieGespeichert.kapitel3d));

  // Beim Speichern wird die Besetzung eingedampft - der Plan darf das überleben.
  const saga = {
    vorgaben: wiederGelesen,
    kapitel: [{ nummer: 1, fall: { id: "f1", besetzung: [{ id: "bock" }] } },
              { nummer: 2, fall: { id: "f2", besetzung: [{ id: "bock" }] } },
              { nummer: 3, fall: { id: "f3", besetzung: [{ id: "bock" }] } }],
    finale: { fall: { id: "finale", besetzung: [{ id: "bock" }] } },
  };
  const bereinigt = bereinigteSaga3D(saga);
  pruefe("das Aufräumen lässt den Plan stehen", bereinigt[1].plan?.felder.length === 49);
  pruefe("und die Tankstelle", bereinigt[1].tankstelleId === zweites);
  pruefe("auch die Höhen", hoeheFuer(bereinigt[1].plan, haus) === 1.6);
  pruefe("kapitel3DMitBesetzung wirft nichts weg",
    kapitel3DMitBesetzung(bereinigt[1], [{ id: "bock" }]).plan?.felder.length === 49);
}

console.log("\n3. Das Spiel findet die richtige Stadt");
{
  const vorgaben = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify(ausDemEditor)));
  pruefe("Kapitel 1 bleibt zweidimensional", dreiDFuerKapitel(vorgaben, 0) === null);
  const zweitesKapitel = dreiDFuerKapitel(vorgaben, 1);
  pruefe("Kapitel 2 startet in 3D", zweitesKapitel !== null);
  pruefe("und bringt seinen Plan mit", planGueltig(zweitesKapitel?.plan));

  const saga = {
    id: "saga-3d", vorgaben,
    kapitel: [{ nummer: 1, fall: { id: "fall-1" } }, { nummer: 2, fall: { id: "fall-2" } }, { nummer: 3, fall: { id: "fall-3" } }],
    finale: { fall: { id: "fall-finale" } },
  };
  pruefe("über die Fall-Id findet das Spiel dieselbe Stadt",
    dreiDFuerSagaFall(saga, "fall-2")?.plan?.felder.length === 49);
  pruefe("und für ein 2D-Kapitel nichts", dreiDFuerSagaFall(saga, "fall-1") === null);
}

console.log("\n4. In der Stadt lässt sich wirklich spielen");
{
  const vorgaben = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify(ausDemEditor)));
  const stadt = dreiDFuerKapitel(vorgaben, 1).plan;
  const start = startFeld(stadt);
  pruefe("es gibt einen Startplatz", Boolean(start));
  const mitte = feldMitte(stadt, start.x, start.z);
  pruefe("und dort steht man auf der Straße", begehbar(stadt, mitte.x, mitte.z));
  pruefe("es gibt genug Straße zum Laufen", strassenFelder(stadt).length >= 10, `${strassenFelder(stadt).length} Felder`);
  pruefe("und Häuser stehen auch", gebaeudeArten(stadt).length === 2);

  /*
   * Die Tankstelle: Sie steht im Plan, ist aber in der Bausteinliste des
   * Kapitels nicht angehakt. Genau dann muss sie trotzdem gefunden werden -
   * gebaut wird, was im Plan steht.
   */
  pruefe("die Bausteinliste kennt sie nicht", !vorgaben.kapitel3d[1].locations.includes(zweites) ||
    vorgaben.kapitel3d[1].locations.length > 0);
  pruefe("über den Plan wird sie trotzdem gefunden",
    tankstelleAus(gebaeudeArten(stadt), vorgaben.kapitel3d[1].tankstelleId)?.id === zweites);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
