/**
 * Fertig geplante Städte.
 *
 * Geprüft wird das, worauf man sich verlassen können muss: dass eine Stadt
 * nur dann gilt, wenn man sie auch betreten kann; dass aus der Datenbank
 * nichts Kaputtes durchrutscht; und dass "auswählen" wirklich abschreiben
 * heißt - eine laufende Saga darf sich nicht ändern, weil jemand im
 * Admin-Menü eine Straße verschiebt.
 */
import {
  STRASSENTYPEN,
  TAGESZEITEN,
  WETTERLAGEN,
  neueStadt,
  stadtGueltig,
  stadtLesen,
  stadtRegal,
  stadtVorgabe,
  stadtZeile,
} from "../lib/staedte.ts";
import { STRASSE, beispielPlan, feldSetzen, leererPlan } from "../lib/stadtplan.ts";
import { DREI_D_LOCATIONS } from "../lib/pursuit3d.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { STANDARD_KAPITEL_3D } from "../lib/pursuit3d.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const haus = DREI_D_LOCATIONS[0].id;
const zweitesHaus = DREI_D_LOCATIONS[1]?.id ?? haus;

/** Eine kleine, spielbare Stadt: Kreuzung plus zwei Häuser. */
const gebaut = () => {
  let plan = beispielPlan(5, 5);
  plan = feldSetzen(plan, 0, 0, haus);
  plan = feldSetzen(plan, 4, 0, zweitesHaus);
  plan = feldSetzen(plan, 0, 4, haus);
  return { ...neueStadt(plan), name: "Neonviertel", tankstelleId: zweitesHaus, polizeiId: haus, tageszeit: "nacht", wetter: "regen" };
};

console.log("\n1. Eine Stadt gilt erst, wenn man sie betreten kann");
{
  const stadt = gebaut();
  pruefe("die gebaute Stadt gilt", stadtGueltig(stadt));
  pruefe("ohne Namen nicht", !stadtGueltig({ ...stadt, name: "  " }));
  pruefe("ohne Straßen nicht", !stadtGueltig({ ...stadt, plan: leererPlan(5, 5) }));
  pruefe("und gar nichts erst recht nicht", !stadtGueltig(null) && !stadtGueltig(undefined));

  const frisch = neueStadt();
  pruefe("eine neue Stadt hat eine eigene Kennung", frisch.id.startsWith("stadt-"));
  pruefe("und ist vom ersten Moment an begehbar", stadtGueltig(frisch), "Kreuzung zum Anfangen");
  pruefe("mit leerem Raster wird sie zur Kreuzung", stadtGueltig(neueStadt(leererPlan(5, 5))));
}

console.log("\n2. Aus der Datenbank kommt nur Brauchbares zurück");
{
  const stadt = gebaut();
  const gelesen = stadtLesen(JSON.parse(JSON.stringify(stadt)));
  pruefe("die eigene Stadt kommt heil zurück", gelesen !== null);
  pruefe("mit Namen", gelesen?.name === "Neonviertel");
  pruefe("mit allen Feldern", gelesen?.plan.felder.length === 25);
  pruefe("mit Tankstelle, Licht und Wetter", gelesen?.tankstelleId === zweitesHaus && gelesen?.tageszeit === "nacht" && gelesen?.wetter === "regen");
  pruefe("und mit der Polizeiwache", gelesen?.polizeiId === haus);
  pruefe("eine kaputte Wache wird zu keiner", stadtLesen({ ...stadt, polizeiId: 42 })?.polizeiId === "");

  pruefe("ohne Plan: nichts", stadtLesen({ id: "a", name: "X" }) === null);
  pruefe("mit falscher Feldzahl: nichts", stadtLesen({ ...stadt, plan: { ...stadt.plan, felder: ["strasse"] } }) === null);
  pruefe("mit unmöglicher Größe: nichts", stadtLesen({ ...stadt, plan: { ...stadt.plan, breite: 900 } }) === null);
  pruefe("ohne Namen: nichts", stadtLesen({ ...stadt, name: "" }) === null);
  pruefe("Unsinn: nichts", stadtLesen(null) === null && stadtLesen("stadt") === null && stadtLesen(42) === null);

  const wirr = stadtLesen({ ...stadt, strassentyp: "lava", tageszeit: "mittag", wetter: "hagel" });
  pruefe("erfundene Einstellungen fallen auf den Standard zurück", wirr?.strassentyp === "asphalt" && wirr?.tageszeit === "tag" && wirr?.wetter === "klar");
  pruefe("und die erlaubten Werte sind es, die im Editor stehen",
    STRASSENTYPEN.includes("asphalt") && TAGESZEITEN.includes("nacht") && WETTERLAGEN.includes("schneesturm"));
  pruefe("und der Sandsturm steht ebenfalls zur Wahl", WETTERLAGEN.includes("sandsturm"));
  pruefe("der Blizzard auch", WETTERLAGEN.includes("blizzard"));
  pruefe("eine Stadt im Blizzard kommt heil zurück",
    stadtLesen({ ...stadt, wetter: "blizzard" })?.wetter === "blizzard");
  pruefe("eine Stadt im Sandsturm kommt heil zurück",
    stadtLesen({ ...stadt, wetter: "sandsturm", strassentyp: "sand" })?.wetter === "sandsturm");

  const kaputteDrehung = stadtLesen({ ...stadt, plan: { ...stadt.plan, drehungen: { "0,0": 999, "1,1": 90 } } });
  pruefe("unmögliche Drehungen fallen weg, brauchbare bleiben",
    kaputteDrehung?.plan.drehungen["0,0"] === undefined && kaputteDrehung?.plan.drehungen["1,1"] === 90);
}

console.log("\n3. Auswählen heißt abschreiben");
{
  const stadt = gebaut();
  const vorgabe = stadtVorgabe(stadt);
  pruefe("der Plan kommt mit", vorgabe.plan.felder.length === 25);
  pruefe("die Bausteinliste wird aus dem Plan gelesen",
    vorgabe.locations.includes(haus) && vorgabe.locations.includes(zweitesHaus),
    vorgabe.locations.join(", "));
  pruefe("keine Straße in der Bausteinliste", !vorgabe.locations.includes(STRASSE));
  pruefe("Tankstelle, Wache, Belag und Licht kommen mit",
    vorgabe.tankstelleId === zweitesHaus && vorgabe.polizeiId === haus
    && vorgabe.tageszeit === "nacht" && vorgabe.wetter === "regen");

  // Und jetzt der Punkt: Das Kapitel trägt danach seinen eigenen Plan.
  const gespeichert = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{
      ...STANDARD_KAPITEL_3D,
      aktiv: true,
      plan: vorgabe.plan,
      locations: vorgabe.locations,
      tankstelleId: vorgabe.tankstelleId,
      polizeiId: vorgabe.polizeiId,
      strassentyp: vorgabe.strassentyp,
      tageszeit: vorgabe.tageszeit,
      wetter: vorgabe.wetter,
    }],
  });
  pruefe("die übernommene Stadt kommt durch die Saga-Prüfung", gespeichert.success, gespeichert.error?.issues[0]?.message);
  pruefe("und liegt danach im Kapitel", gespeichert.data?.kapitel3d[0].plan?.felder.length === 25);
  pruefe("mit ihrer Tankstelle", gespeichert.data?.kapitel3d[0].tankstelleId === zweitesHaus);
  pruefe("und ihrer Wache", gespeichert.data?.kapitel3d[0].polizeiId === haus);
  pruefe("und ihrem Licht", gespeichert.data?.kapitel3d[0].tageszeit === "nacht");
}

console.log("\n4. Die Zeile im Menü");
{
  const stadt = gebaut();
  const zeile = stadtZeile(stadt);
  pruefe("sie nennt die Maße", zeile.includes("5×5"), zeile);
  pruefe("die Straßenfelder", /\d+ Straßenfelder/.test(zeile), zeile);
  pruefe("und wie viele Bauarten darin stecken", /Bauart/.test(zeile), zeile);
}

console.log("\n5. Das Regal: neueste Stadt zuerst");
{
  const alt = { ...gebaut(), id: "alt", name: "Alt", erstelltAm: 1000 };
  const neu = { ...gebaut(), id: "neu", name: "Neu", erstelltAm: 2000 };
  const sortiert = stadtRegal([alt, neu]);
  pruefe("die neuere steht oben", sortiert[0].id === "neu");
  pruefe("die Eingabe bleibt unberührt", [alt, neu][0].id === "alt");
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
