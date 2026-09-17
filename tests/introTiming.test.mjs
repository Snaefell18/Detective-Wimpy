import {
  LAENGSTE_TAFEL,
  MINDEST_TAFEL,
  leseDauer,
  passendeAnzahl,
  tafelnVerteilen,
} from "../lib/introTiming.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Jede Tafel bekommt so viel Zeit, wie ihr Text braucht");
pruefe("ein einzelnes Wort bekommt die Grundzeit", leseDauer("Schnee") === MINDEST_TAFEL);
pruefe("leerer Text auch", leseDauer("") === MINDEST_TAFEL);
pruefe(
  "ein Satz dauert länger als ein Wort",
  leseDauer("Ein Kratzer, zu hoch für ein Tier dieser Größe.") > leseDauer("Kratzer"),
);
pruefe(
  "ein Absatz wird gedeckelt",
  leseDauer("A".repeat(4000)) === LAENGSTE_TAFEL,
);
pruefe(
  "für den Erzähler gilt der Deckel nicht",
  leseDauer("A".repeat(1000), 9, 400) > 80,
);

console.log("\n2. Verteilt wird auf die ganze Spielzeit");
const tafeln = [{ dauer: 3 }, { dauer: 6 }, { dauer: 3 }];
{
  const { plan, dauer } = tafelnVerteilen(tafeln, 24);
  pruefe("ein langer Song streckt alle Tafeln", dauer === 24);
  pruefe("die erste beginnt bei null", plan[0].von === 0);
  pruefe("die letzte reicht bis ans Ende", plan[2].bis > 1);
  pruefe(
    "die lange Tafel bekommt doppelt so viel wie die kurzen",
    Math.abs((plan[1].bis - plan[1].von) - 2 * (plan[0].bis - plan[0].von)) < 0.001,
  );
  pruefe("keine Lücke dazwischen", plan[0].bis === plan[1].von && plan[1].bis === plan[2].von);
}
{
  const { plan, dauer } = tafelnVerteilen(tafeln, 6);
  pruefe("ein kurzer Song verlängert den Vorspann", dauer === 12);
  pruefe(
    "und niemand bekommt weniger als seine Zeit",
    Math.abs((plan[0].bis - plan[0].von) * dauer - 3) < 0.001,
  );
}
pruefe("ohne Tafeln bleibt es beim Song", tafelnVerteilen([], 30).dauer === 30);

console.log("\n3. Was nicht mehr in die Aufnahme passt, fällt weg");
const worte = ["Schnee", "Ein Schlüssel im Eis", "Nacht", "Der Schattenkanzler", "Spuren"];
pruefe("bei viel Platz alle", passendeAnzahl(worte, 60) === worte.length);
pruefe("bei wenig Platz weniger", passendeAnzahl(worte, 5) < worte.length);
pruefe("aber nie null", passendeAnzahl(worte, 0) === 1);

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
