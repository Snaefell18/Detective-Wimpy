import {
  ABSPANN_ARTEN,
  STANDARD_ABSPANN,
  abspannModelle,
  abspannSpielbar,
  abspannVon,
  abspannWelt,
  abspannZeile,
  neuerAbspann,
} from "../lib/abspann.ts";
import { arcCredits, leererArc } from "../lib/arcTypen.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { ANIMATIONS_MODELLE } from "../lib/animations.generated.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const fahrt = { ...neuerAbspann("strassenfahrt"), song: "/audio/intro.mp3" };

console.log("\n1. Ohne Song läuft kein Abspann - er ist seine Uhr");
pruefe("kein Abspann bleibt kein Abspann", !abspannSpielbar(STANDARD_ABSPANN));
pruefe("gar nichts auch nicht", !abspannSpielbar(null) && !abspannSpielbar(undefined));
pruefe("Straßenfahrt ohne Song nicht", !abspannSpielbar(neuerAbspann("strassenfahrt")));
pruefe("Straßenfahrt mit Song schon", abspannSpielbar(fahrt));
pruefe(
  "Rolle ohne Text nicht",
  !abspannSpielbar({ ...neuerAbspann("rolle"), song: "/audio/intro.mp3" }),
);
pruefe(
  "Rolle mit Text schon",
  abspannSpielbar({ ...neuerAbspann("rolle"), song: "/audio/intro.mp3", text: "Ende" }),
);
pruefe("abspannVon füllt auf", abspannVon({ art: "strassenfahrt", song: "/audio/a.mp3" })?.modelle !== undefined);
pruefe("und gibt bei Unspielbarem nichts", abspannVon({ art: "strassenfahrt", song: "" }) === null);
pruefe("jede Art hat eine Beschreibung", ABSPANN_ARTEN.every((a) => a.label && a.hinweis));

console.log("\n2. Zwei Tiere steigen ein - immer genau zwei");
pruefe("frisch angelegt sind es zwei verschiedene", (() => {
  const [eins, zwei] = neuerAbspann("strassenfahrt").modelle;
  return Boolean(eins) && Boolean(zwei) && eins !== zwei;
})());
pruefe("Unsinn fliegt heraus und wird ersetzt", (() => {
  const modelle = abspannModelle({ ...fahrt, modelle: ["gibtesnicht", ""] });
  return modelle.length === 2 && modelle.every((id) => ANIMATIONS_MODELLE.some((m) => m.id === id));
})());
pruefe("gar keine Angabe ergibt trotzdem zwei", abspannModelle({ ...fahrt, modelle: [] }).length === 2);
pruefe(
  "eine eigene Wahl bleibt vorn",
  abspannModelle({ ...fahrt, modelle: ["yeti", "hut"] })[0] === "yeti",
);

console.log("\n3. Die Strecke ist dieselbe wie bei der Jagd");
{
  const welt = abspannWelt(undefined);
  pruefe("ohne Angabe: Asphalt am Abend", welt.strassentyp === "asphalt" && welt.tageszeit === "abend");
  pruefe("und ohne Häuser", welt.locations.length === 0);
}
{
  const welt = abspannWelt({ ...fahrt, strassentyp: "unsinn", wetter: "schnee", locations: ["akihabara", "gibtesnicht"] });
  pruefe("ein unmöglicher Belag wird geradegerückt", welt.strassentyp === "asphalt");
  pruefe("ein echtes Wetter bleibt", welt.wetter === "schnee");
  pruefe("ein fehlender Baustein fliegt raus", welt.locations.join() === "akihabara");
}
pruefe("die Editorzeile sagt, was passiert", abspannZeile(fahrt).includes("Tiere"));
pruefe("und warnt, wenn der Song fehlt", abspannZeile({ ...fahrt, song: "" }).includes("Uhr"));

console.log("\n4. Der Arc: alte Credits bleiben die Rolle, die sie waren");
{
  const arc = leererArc();
  pruefe("ohne Credits-Finale nichts", arcCredits({ ...arc, finale: { ...arc.finale, art: "text" } }) === null);
  const alt = {
    ...arc,
    finale: {
      art: "credits",
      erzaehler: { text: "Alle Tiere\nund ihre Namen", audio: "" },
      creditsSong: "/audio/intro.mp3",
    },
  };
  const gelesen = arcCredits(alt);
  pruefe("ein alter Arc bekommt seine Textrolle", gelesen?.art === "rolle");
  pruefe("mit seinem Song", gelesen?.song === "/audio/intro.mp3");
  pruefe("und seinem Text", (gelesen?.text ?? "").includes("Alle Tiere"));
  const neu = { ...alt, finale: { ...alt.finale, abspann: fahrt } };
  pruefe("ein eingestellter Abspann gewinnt", arcCredits(neu)?.art === "strassenfahrt");
  const ohne = { ...alt, finale: { ...alt.finale, creditsSong: "", erzaehler: { text: "", audio: "" } } };
  pruefe("ohne alles läuft nichts", arcCredits(ohne) === null);
}

console.log("\n5. Die Saga-Vorgaben nehmen ihn an - und alte kommen ohne aus");
{
  const ohne = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN });
  pruefe("eine Saga von früher bleibt gültig", ohne.success, ohne.success ? "" : JSON.stringify(ohne.error.issues[0]));
  const mit = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, abspann: fahrt });
  pruefe("mit Abspann auch", mit.success, mit.success ? "" : JSON.stringify(mit.error.issues[0]));
  pruefe("und er kommt heil wieder heraus", mit.success && mit.data.abspann?.art === "strassenfahrt");
  const kaputt = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    abspann: { ...fahrt, art: "quatsch", strassentyp: 7, locations: ["gibtesnicht"] },
  });
  pruefe("Unsinn nimmt niemandem die Saga", kaputt.success);
  pruefe("er wird nur still geradegerückt", kaputt.success && kaputt.data.abspann?.art === "keiner");
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
