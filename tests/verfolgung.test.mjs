import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { pruefeVorgaben } from "../lib/sagaPruefung.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { JAGD_WELT, fluchtStatement, jagdWelt, verfolgungNach } from "../lib/verfolgung.ts";
import { DREI_D_LOCATIONS } from "../lib/pursuit3d.ts";
import {
  AUTO_GROESSE,
  FLUCHT_RUECKSTAND,
  REMPLER,
  STANDARD_AUTOS,
  autoGroesse,
  autoGueltig,
  autoLaenge,
  fluchtTempo,
} from '../lib/autos.ts';

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const jagd = {
  id: "jagd-1",
  nachKapitel: 1,
  name: "Die weiße Spur",
  fliehenderId: "boss",
  verfolger: [
    { charakterId: "nala", modell: "schaf" },
    { charakterId: "hut", modell: "yeti" },
  ],
  musik: "/audio/jagd.mp3",
  fluchtgrund: "ich den Schlüssel im Schnee verstecken musste.",
  statement: "",
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5, stats: {}, beschreibung: "", bild: "",
  istDetektiv: false, ...extra,
});
const charaktere = [
  tier("wimpy", "Wimpy", { istDetektiv: true }),
  tier("boss", "Boss"), tier("nala", "Nala"), tier("hut", "Herr Hut"), tier("oeho", "Öhö"),
];
const orte = ["nord", "sued"].flatMap((stadt) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${stadt}-${i}`, stadt, stadtId: stadt, name: `Ort ${i}`,
    atmosphaere: "", beschreibung: "", bild: "",
  })),
);
const probleme = (teil) => pruefeVorgaben({
  vorgaben: { ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 3, ...teil },
  charaktere,
  orte,
});

console.log("\n1. Die Jagd sitzt genau in einer Kapitellücke");
pruefe("nach Kapitel 1 gefunden", verfolgungNach({ verfolgungsjagden: [jagd] }, 1)?.id === "jagd-1");
pruefe("nach Kapitel 2 ist nichts", verfolgungNach({ verfolgungsjagden: [jagd] }, 2) === null);
pruefe("alte Saga bleibt leer und gültig", SagaVorgabenSchema.safeParse({
  ...STANDARD_SAGA_VORGABEN,
  verfolgungsjagden: undefined,
}).data?.verfolgungsjagden.length === 0);

console.log("\n2. Besetzung und Modelle sind eindeutig");
const gut = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, verfolgungsjagden: [jagd] });
pruefe("vollständige Jagd geht durchs Schema", gut.success, gut.error?.issues[0]?.message);
pruefe("gewählter Jagdsong bleibt erhalten", gut.data?.verfolgungsjagden[0]?.musik === "/audio/jagd.mp3");
pruefe("drei verschiedene Tiere sind spielbar", probleme({ verfolgungsjagden: [jagd] }).length === 0, probleme({ verfolgungsjagden: [jagd] })[0]);
pruefe("alte Verfolgerdaten blockieren Wimpys Jagd nicht", probleme({
  verfolgungsjagden: [{ ...jagd, verfolger: [{ ...jagd.verfolger[0], charakterId: "boss" }, jagd.verfolger[1]] }],
}).length === 0);
pruefe("alte doppelte Modelle sind für die neue Jagd unerheblich", probleme({
  verfolgungsjagden: [{ ...jagd, verfolger: [jagd.verfolger[0], { ...jagd.verfolger[1], modell: "schaf" }] }],
}).length === 0);
const neueJagd = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, verfolgungsjagden: [{ ...jagd, verfolger: undefined, fluchtAutoId: 'auto-sport' }] });
pruefe('Autozuordnung ohne alte Verfolger übersteht Generierung', neueJagd.data?.verfolgungsjagden[0]?.fluchtAutoId === 'auto-sport');
pruefe('Standardautos sind gültig', STANDARD_AUTOS.every(autoGueltig));
pruefe('Negative Preise sind ungültig', !autoGueltig({ ...STANDARD_AUTOS[0], preis: -1 }));
pruefe('Unbekannte Modelle sind ungültig', !autoGueltig({ ...STANDARD_AUTOS[0], modell: 'fehlt' }));
/**
 * Eine Jagd durchrechnen - dieselbe Rechnung wie im Bild, nur ohne Bild.
 * `rempler` sind gleichmäßig verteilte Kollisionen: Tempo weg, Vorsprung dazu.
 */
const jagdDauer = (spieler, flucht, rempler = 0) => {
  let abstand = 180, speed = 0, fluchtSpeed = 0, zeit = 0, gehabt = 0;
  for (; zeit < 180 && abstand > 0 && abstand <= 320; zeit += 0.02) {
    speed = Math.min(spieler.speed, speed + spieler.beschleunigung * 0.02);
    fluchtSpeed = Math.min(
      fluchtTempo(flucht, zeit, spieler.speed / 3.6 * (abstand > 180 ? FLUCHT_RUECKSTAND : 1)),
      fluchtSpeed + flucht.beschleunigung / 3.6 * 0.02,
    );
    abstand += (fluchtSpeed - speed / 3.6) * 0.02;
    if (rempler && gehabt < rempler && 180 - abstand > (180 / (rempler + 1)) * (gehabt + 1)) {
      speed *= REMPLER.tempo; abstand += REMPLER.verlust; gehabt++;
    }
  }
  return { gefangen: abstand <= 0, sekunden: zeit };
};

const start = jagdDauer(STANDARD_AUTOS[0], STANDARD_AUTOS[1]);
pruefe('Der Startwagen holt den Fluchtwagen ein', start.gefangen, `${start.sekunden.toFixed(0)} s`);
pruefe('und die Jagd dauert mehr als 15 Sekunden', start.sekunden > 15, `${start.sekunden.toFixed(0)} s`);
pruefe('bleibt aber unter zwei Minuten', start.sekunden < 120, `${start.sekunden.toFixed(0)} s`);

const mitRemplern = jagdDauer(STANDARD_AUTOS[0], STANDARD_AUTOS[1], 4);
pruefe('Vier Rempler kosten Zeit, aber nicht die Jagd', mitRemplern.gefangen, `${mitRemplern.sekunden.toFixed(0)} s`);
pruefe('und machen sie deutlich länger', mitRemplern.sekunden > start.sekunden + 5);

const schneller = jagdDauer({ ...STANDARD_AUTOS[0], speed: 240, beschleunigung: 40 }, STANDARD_AUTOS[1]);
pruefe('Ein gekaufter schnellerer Wagen holt früher ein', schneller.gefangen && schneller.sekunden < start.sekunden);

// Schlechteste erlaubte Kombination bleibt ohne Kollisionen einholbar.
const schlimmst = jagdDauer({ speed: 60, beschleunigung: 5 }, { ...STANDARD_AUTOS[1], speed: 320, beschleunigung: 100 });
pruefe('Langsamstes Auto kann bei sauberer Fahrt den schnellsten Flüchtigen fangen', schlimmst.gefangen, `${schlimmst.sekunden.toFixed(0)} s`);
pruefe('und das innerhalb des Zeitlimits', schlimmst.sekunden < 180);
pruefe("Versammlung und Jagd teilen sich keine Lücke", probleme({
  verfolgungsjagden: [jagd],
  versammlungen: [{
    id: "rat-1", nachKapitel: 1, name: "Rat", anlass: "Anlass", thema: "Thema",
    vorsitzId: "nala", teilnehmerIds: ["nala", "hut"], beobachterIds: [], undercoverId: "",
  }],
}).some((p) => p.includes("nur ein Zwischenereignis")));

console.log("\n2b. Der Fluchtwagen lässt sich drehen");
{
  const mitDrehung = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    verfolgungsjagden: [{ ...jagd, fluchtDrehung: 180 }],
  });
  pruefe("die Drehung übersteht die Generierung", mitDrehung.data?.verfolgungsjagden[0]?.fluchtDrehung === 180);

  const ohne = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, verfolgungsjagden: [jagd] });
  pruefe("ohne Angabe bleibt der Wagen ungedreht", ohne.data?.verfolgungsjagden[0]?.fluchtDrehung === 0);

  const unsinn = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    verfolgungsjagden: [{ ...jagd, fluchtDrehung: 5000 }],
  });
  pruefe("ein unmöglicher Wert wird zu 0 statt zum Fehler", unsinn.data?.verfolgungsjagden[0]?.fluchtDrehung === 0);
  pruefe("und die Jagd bleibt erhalten", unsinn.data?.verfolgungsjagden.length === 1);

  /*
   * Gefahren wird in Richtung +z. Der Ferrari zeigt dort von Haus aus hin,
   * Lambo und RAV4 liegen quer in ihrer Datei - jeder in seine Richtung.
   * Nachgesehen wurde das im Bild, nicht geraten.
   */
  const nach = (muster) => STANDARD_AUTOS.find((a) => muster.test(a.modell))?.drehung;
  pruefe("der Lambo steht nicht mehr falsch herum", nach(/lambo/i) === 270);
  pruefe("der Ferrari bleibt ungedreht", nach(/ferrari/i) === 0);
  pruefe("und ein vorhandener RAV4 fährt vorwärts", nach(/rav/i) === undefined || nach(/rav/i) === 90);
  pruefe("alle Standardwagen bleiben gültig", STANDARD_AUTOS.every(autoGueltig));
}

console.log("\n2c. Die Strecke: Belag, Licht, Wetter, Häuser");
{
  // Eine Jagd von früher kennt nichts davon - und muss aussehen wie immer.
  const alt = jagdWelt(jagd);
  pruefe("ohne Angabe bleibt es die Schneepiste", alt.strassentyp === "schnee");
  pruefe("in der Nacht", alt.tageszeit === "nacht");
  pruefe("bei klarer Sicht", alt.wetter === "klar");
  pruefe("und ohne Häuser am Rand", alt.locations.length === 0);
  pruefe("das ist genau die Vorgabe", alt.strassentyp === JAGD_WELT.strassentyp);
  pruefe("auch ganz ohne Jagd kommt eine Welt zurück", jagdWelt(null).tageszeit === "nacht");

  const ort = DREI_D_LOCATIONS[0]?.id ?? "";
  const gewaehlt = jagdWelt({
    ...jagd,
    strassentyp: "asphalt",
    tageszeit: "tag",
    wetter: "sandsturm",
    locations: [ort, "gibtsnicht"],
  });
  pruefe("gewählter Belag gilt", gewaehlt.strassentyp === "asphalt");
  pruefe("gewähltes Licht auch", gewaehlt.tageszeit === "tag");
  pruefe("und der Sandsturm steht zur Wahl", gewaehlt.wetter === "sandsturm");
  pruefe("ein Baustein, den es nicht gibt, fliegt raus",
    gewaehlt.locations.length === 1 && gewaehlt.locations[0] === ort);

  const unsinn = jagdWelt({ ...jagd, strassentyp: "lava", tageszeit: "mittag", wetter: "hagel" });
  pruefe("Erfundenes fällt auf die Vorgabe zurück",
    unsinn.strassentyp === "schnee" && unsinn.tageszeit === "nacht" && unsinn.wetter === "klar");

  // Und alles davon muss den Weg durch die Datenbank überstehen.
  const gespeichert = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    verfolgungsjagden: [{
      ...jagd,
      strassentyp: "sand",
      tageszeit: "abend",
      wetter: "schneesturm",
      locations: [ort],
    }],
  });
  pruefe("das Schema nimmt die Strecke an", gespeichert.success,
    gespeichert.error?.issues?.[0]?.message);
  const zurueck = jagdWelt(gespeichert.data?.verfolgungsjagden[0]);
  pruefe("und gibt sie unverändert zurück",
    zurueck.strassentyp === "sand" && zurueck.tageszeit === "abend" && zurueck.wetter === "schneesturm");
  pruefe("samt Bausteinen", zurueck.locations[0] === ort);
}

console.log("\n2d. Wie groß ein Wagen im Spiel ist");
{
  /*
   * Jedes Modell wird auf dieselbe Länge gebracht - und genau das machte aus
   * einer Limousine ein Spielzeugauto. Die Größe im Katalog rückt das
   * gerade; was fehlt oder unsinnig ist, wird stillschweigend zu 1.
   */
  pruefe("ohne Angabe ist ein Wagen normal groß", autoGroesse({}) === 1);
  pruefe("und ohne Wagen erst recht", autoGroesse(undefined) === 1);
  pruefe("eine Limousine darf länger sein", autoGroesse({ groesse: 1.5 }) === 1.5);
  pruefe("zu klein wird auf das Mindestmaß gehoben",
    autoGroesse({ groesse: 0.01 }) === AUTO_GROESSE.min);
  pruefe("zu groß auf das Höchstmaß gestutzt",
    autoGroesse({ groesse: 99 }) === AUTO_GROESSE.max);
  pruefe("Unsinn wird zu 1", autoGroesse({ groesse: Number.NaN }) === 1 && autoGroesse({ groesse: -3 }) === 1);

  pruefe("die Länge folgt der Größe",
    Math.abs(autoLaenge({ groesse: 1.4 }, 3.5) - 4.9) < 0.001);
  pruefe("ein gewöhnlicher Wagen bleibt bei der Grundlänge", autoLaenge({}, 3.5) === 3.5);

  const wagen = { ...STANDARD_AUTOS[0] };
  pruefe("ein Standardwagen ohne Größe bleibt gültig", autoGueltig(wagen));
  pruefe("mit erlaubter Größe auch", autoGueltig({ ...wagen, groesse: 1.6 }));
  pruefe("mit unmöglicher Größe nicht", !autoGueltig({ ...wagen, groesse: 9 }));
}

console.log("\n3. Nach dem Fang gibt es immer ein Statement");
pruefe("eigener Satz gewinnt", fluchtStatement({ ...jagd, statement: "Ich hatte keine Wahl." }) === "Ich hatte keine Wahl.");
pruefe("Fluchtgrund wird zu wörtlicher Rede", fluchtStatement(jagd).includes("Schlüssel im Schnee"));
pruefe("auch ganz leer bleibt es nicht stumm", fluchtStatement({ ...jagd, fluchtgrund: "" }).length > 20);

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
