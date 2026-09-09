/**
 * Die Verhandlung entsteht in zwei Aufrufen.
 *
 * Der Anlass: Beides zusammen - ein Dutzend Sprechtexte UND acht
 * Beweisstücke mit Reaktionen - lief regelmäßig länger, als eine
 * Serverfunktion darf. Weil das Finale ganz am Ende steht, war dann alles
 * davor bezahlt und verloren. Geteilt ist jeder Aufruf gut halb so groß.
 */
import { BeweiseSchema, VerhandlungSaalSchema } from "../lib/sagaSchemas.ts";
import { buildBeweisePrompt, buildVerhandlungPrompt } from "../lib/sagaPrompts.ts";
import { mitVerhandlung } from "../lib/sagaFinale.ts";
import { sagaMitVerhandlung } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const felder = (schema) => Object.keys(schema.shape);

console.log("\n1. Die beiden Schemata teilen die Arbeit sauber auf");
{
  const saal = felder(VerhandlungSaalSchema);
  const beweise = felder(BeweiseSchema);
  pruefe("der Saal kennt keine Beweise", !saal.includes("beweise"));
  pruefe("die Beweise sind ein eigener Aufruf", beweise.length === 1 && beweise[0] === "beweise");
  for (const feld of [
    "frage", "erzaehlerText", "epilogText", "anklage", "anklageRichtig",
    "anklageFalsch", "urteilSchuldig", "urteilFrei", "strafeWort", "strafeAuflage",
  ]) {
    pruefe(`der Saal enthält „${feld}“`, saal.includes(feld));
  }
}

console.log("\n2. Beide Aufrufe kennen denselben Fall");
{
  const args = {
    art: "gericht-daemon",
    thema: "Die Sache mit dem Leuchtturm",
    wahrheit: "Der Schatten steckte in Herrn Hut.",
    angeklagter: "Herr Hut",
    richter: "Öhö",
    detektivName: "Wimpy",
    motiv: "Rache am Hafenmeister",
    kapitel: [
      { name: "Die Nacht am Hafen", enthuellung: "Ein Schlüssel fehlt." },
      { name: "Der zweite Schlüssel", enthuellung: "Er war nie weg." },
    ],
  };
  const saal = buildVerhandlungPrompt(args);
  const beweise = buildBeweisePrompt(args);

  for (const [name, text] of [["Saal", saal], ["Beweise", beweise]]) {
    pruefe(`${name}: das Überthema steht drin`, text.includes("Leuchtturm"));
    pruefe(`${name}: die Wahrheit steht drin`, text.includes("Der Schatten steckte"));
    pruefe(`${name}: das Motiv steht drin`, text.includes("Rache am Hafenmeister"));
    pruefe(`${name}: beide Kapitel stehen drin`,
      text.includes("Die Nacht am Hafen") && text.includes("Der zweite Schlüssel"));
    pruefe(`${name}: der Angeklagte wird genannt`, text.includes("Herr Hut"));
  }
}

console.log("\n3. Jeder Aufruf bestellt nur seinen Teil");
{
  const args = {
    art: "gericht", thema: "T", wahrheit: "W", angeklagter: "A", richter: "R",
    detektivName: "Wimpy", motiv: "M", kapitel: [{ name: "K", enthuellung: "E" }],
  };
  const saal = buildVerhandlungPrompt(args);
  const beweise = buildBeweisePrompt(args);

  pruefe("der Saal sagt, dass die Beweise später kommen", /zweiten Schritt/.test(saal));
  pruefe("und listet sie nicht auf", !/DIE BEWEISSTÜCKE/.test(saal));
  pruefe("die Beweise bestellen genau sechs", /Genau sechs Stück/.test(beweise));
  pruefe("davon drei tragende", /Drei davon tragen/.test(beweise));
  pruefe("die Beweise reden nicht vom Urteil", !/urteilSchuldig/.test(beweise));
  pruefe("der Saal aber schon", /Urteil/.test(saal));
}

console.log("\n4. Bei „Gericht & Dämon“ steht die Verwandlung in beiden");
{
  const args = {
    art: "gericht-daemon", thema: "T", wahrheit: "W", angeklagter: "Hut", richter: "Öhö",
    detektivName: "Wimpy", motiv: "M", kapitel: [{ name: "K", enthuellung: "E" }],
  };
  for (const [name, text] of [
    ["Saal", buildVerhandlungPrompt(args)],
    ["Beweise", buildBeweisePrompt(args)],
  ]) {
    pruefe(`${name}: was in ihm steckt, kommt erst später heraus`,
      /Was in ihm steckt, kommt erst heraus/.test(text));
  }
}

console.log("\n5. Eine Verhandlung ohne Beweise gilt als keine");
{
  /*
   * Der Fall, der einen ganzen Spielabend gekostet hat: Die Saga wurde mit
   * leerer Beweisliste gespeichert. Beim Spielen sprang es vom Erzählertext
   * direkt in den Epilog - kein Saal, keine Anklage, kein Urteil.
   */
  const saga = (beweise) => ({
    finale: { verhandlung: { art: "gericht-daemon", beweise } },
    vorgaben: { finaleArt: "gericht-daemon" },
  });

  pruefe("ohne Beweise: kein Saal", sagaMitVerhandlung(saga([])) === null);
  pruefe("ohne verhandlung: kein Saal", sagaMitVerhandlung({ finale: {} }) === null);
  pruefe("mit Beweisen: Saal", sagaMitVerhandlung(saga([{ id: "b1" }])) !== null);

  // Und genau dann muss das Spiel stehen bleiben statt weiterzublättern:
  // dieselbe Bedingung wie in app/page.tsx.
  const bliebeStehen = (s) => !sagaMitVerhandlung(s) && mitVerhandlung(s.vorgaben.finaleArt);
  pruefe("bei leerer Liste bleibt das Spiel stehen", bliebeStehen(saga([])));
  pruefe("bei voller Liste läuft es weiter", !bliebeStehen(saga([{ id: "b1" }])));
  pruefe(
    "ein klassisches Finale ist davon unberührt",
    !bliebeStehen({ finale: {}, vorgaben: { finaleArt: "klassisch" } }),
  );
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
