/**
 * Die Beweismitteltasche.
 *
 * Sechs Stücke für eine ganze Saga, und vor Gericht zählt nur, was darin
 * liegt. Entsprechend darf hier nichts still verschwinden: Eine volle Tasche
 * nimmt ohne ausdrücklichen Tausch gar nichts auf, und dasselbe Stück liegt
 * nie zweimal drin.
 */
import {
  TASCHE_MAX,
  aufnehmen,
  herkunftsZeile,
  inTasche,
  mittelAusFund,
  taschePlatz,
  tascheVoll,
  wegwerfen,
} from "../lib/beweismittel.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const stueck = (id, seit = 1) => ({
  id,
  name: `Stück ${id}`,
  bild: "",
  beobachtung: "liegt da",
  herkunft: "Kapitel 1 · Hafen",
  siegel: `siegel-${id}`,
  seit,
});

const voll = Array.from({ length: TASCHE_MAX }, (_, i) => stueck(`a${i}`, i));

console.log("\n1. Die Tasche fasst genau sechs Stücke");
{
  pruefe("sechs sind das Maß", TASCHE_MAX === 6);
  pruefe("leer heißt sechs Plätze", taschePlatz([]) === TASCHE_MAX);
  pruefe("voll heißt kein Platz", taschePlatz(voll) === 0 && tascheVoll(voll));
  pruefe("fünf sind nicht voll", !tascheVoll(voll.slice(0, 5)));
}

console.log("\n2. Aufnehmen");
{
  const eins = aufnehmen([], stueck("x"));
  pruefe("ein Stück landet drin", eins.length === 1 && inTasche(eins, "x"));

  const nochmal = aufnehmen(eins, stueck("x"));
  pruefe("dasselbe Stück nicht zweimal", nochmal === eins);

  const zweites = aufnehmen(eins, stueck("y"));
  pruefe("das zweite kommt hinten dazu", zweites.length === 2 && zweites[1].id === "y");
  pruefe("die Reihenfolge bleibt", zweites[0].id === "x");
}

console.log("\n3. Volle Tasche");
{
  const ohneTausch = aufnehmen(voll, stueck("neu"));
  pruefe("ohne Tausch passiert nichts", ohneTausch === voll);
  pruefe("und nichts ist verschwunden", ohneTausch.length === TASCHE_MAX);

  const getauscht = aufnehmen(voll, stueck("neu"), "a0");
  pruefe("mit Tausch geht es", getauscht.length === TASCHE_MAX);
  pruefe("das alte ist weg", !inTasche(getauscht, "a0"));
  pruefe("das neue ist drin", inTasche(getauscht, "neu"));
  pruefe("die anderen bleiben", ["a1", "a2", "a3", "a4", "a5"].every((id) => inTasche(getauscht, id)));

  const daneben = aufnehmen(voll, stueck("neu"), "gibt-es-nicht");
  pruefe("ein Tausch ins Leere ändert nichts", daneben === voll);
}

console.log("\n4. Wegwerfen");
{
  const rest = wegwerfen(voll, "a3");
  pruefe("eins weniger", rest.length === TASCHE_MAX - 1);
  pruefe("das richtige ist weg", !inTasche(rest, "a3"));
  pruefe("unbekannt wirft nichts weg", wegwerfen(voll, "?").length === TASCHE_MAX);
  const platz = aufnehmen(rest, stueck("neu"));
  pruefe("danach ist wieder Platz", inTasche(platz, "neu"));
}

console.log("\n5. Woher ein Stück stammt");
{
  pruefe("mit Kapitel", herkunftsZeile("Hafen", 2) === "Kapitel 2 · Hafen");
  pruefe("das Finale heißt Finale", herkunftsZeile("Hafen", 0) === "Finale · Hafen");
  pruefe("ohne Saga nur der Ort", herkunftsZeile("Hafen", null) === "Hafen");
  pruefe("ohne alles bleibt es leer", herkunftsZeile("", null) === "");
  pruefe("ohne Ort bleibt das Kapitel", herkunftsZeile("", 3) === "Kapitel 3");
}

console.log("\n6. Aus einem Fund wird ein Beweismittel");
{
  const mittel = mittelAusFund(
    {
      itemId: "lupe",
      name: "Lupe",
      bild: "/items/lupe.png",
      beobachtung: "Ein Sprung im Glas.",
      herkunft: "Hafen",
      siegel: "abc",
    },
    "Kapitel 2 · Hafen",
    42,
  );
  pruefe("die Item-Id wird die Id", mittel.id === "lupe");
  pruefe("die Beobachtung reist mit", mittel.beobachtung === "Ein Sprung im Glas.");
  pruefe("das Siegel reist mit", mittel.siegel === "abc");
  pruefe("die Herkunft kommt von außen", mittel.herkunft === "Kapitel 2 · Hafen");
  pruefe("die Zeit ist übergebbar", mittel.seit === 42);

  // Ältere Fälle liefern kein Siegel - mitnehmen muss trotzdem gehen.
  const ohne = mittelAusFund(
    { itemId: "hut", name: "Hut", beobachtung: "", bild: null },
    "",
  );
  pruefe("ohne Siegel geht es auch", ohne.id === "hut" && ohne.siegel === "");
  pruefe("ohne Bild bleibt es leer", ohne.bild === "");
  pruefe("nichts wird undefined", ohne.beobachtung === "" && ohne.herkunft === "");
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
