/**
 * Wie viele Spuren ein Fall bekommt - und wo sie liegen.
 *
 * Zu wenige, und nach dem zweiten Ort ist nichts mehr zu holen; zu viele,
 * und das Umsehen zieht sich, während in die Beweismitteltasche ohnehin nur
 * sechs Stücke passen. Und liegt alles an einem Ort, laufen die anderen
 * Schauplätze leer.
 *
 * Die Spanne steht deshalb an drei Stellen: im Prompt, im Antwortschema und
 * in der Prüfung danach. Hier wird das Letzte davon abgeklopft.
 */
import {
  ZIEL_EINZELFALL,
  ZIEL_KAPITEL,
  spurenKappen,
  verteilungMangel,
} from "../lib/fallReparieren.ts";
import { makeSpurenSchema } from "../lib/schemas.ts";
import { buildSpurenPrompt } from "../lib/prompts.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const spur = (itemId, extra = {}) => ({
  itemId, ortId: "o1", beobachtung: "b", vermutung: "", bedeutung: "x",
  zeigtAufCharakterId: "taeter", fuehrtInDieIrre: false, ...extra,
});

console.log("\n1. Die Spanne");
{
  pruefe("ein Einzelfall: vier bis sechs", ZIEL_EINZELFALL.min === 4 && ZIEL_EINZELFALL.max === 6);
  pruefe("ein Kapitel: fünf bis sieben", ZIEL_KAPITEL.min === 5 && ZIEL_KAPITEL.max === 7);
  pruefe(
    "ein Kapitel darf mehr - die Fernwirkung kommt dazu",
    ZIEL_KAPITEL.max > ZIEL_EINZELFALL.max,
  );
}

console.log("\n2. Das Schema hält die Anzahl ein");
{
  const schema = (ziel) =>
    makeSpurenSchema(
      [{ id: "taeter", name: "T", istDetektiv: false }],
      [{ id: "o1", name: "O" }],
      [{ id: "i1", name: "I" }],
      ziel,
    );
  const eine = {
    itemId: "i1", ortId: "o1", beobachtung: "b", vermutung: "",
    bedeutung: "x", zeigtAufCharakterId: "taeter", fuehrtInDieIrre: false, fernwirkung: false,
  };
  const wieViele = (n, ziel) => schema(ziel).safeParse({ spuren: Array(n).fill(eine) }).success;

  pruefe("drei sind zu wenig", !wieViele(3, ZIEL_EINZELFALL));
  pruefe("vier gehen", wieViele(4, ZIEL_EINZELFALL));
  pruefe("sechs gehen", wieViele(6, ZIEL_EINZELFALL));
  pruefe("sieben sind zu viel", !wieViele(7, ZIEL_EINZELFALL));
  pruefe("im Kapitel gehen sieben", wieViele(7, ZIEL_KAPITEL));
  pruefe("acht auch dort nicht", !wieViele(8, ZIEL_KAPITEL));
}

console.log("\n3. Überzähliges wird gestrichen - in der richtigen Reihenfolge");
{
  const viele = [
    spur("a"),
    spur("b"),
    spur("c", { zeigtAufCharakterId: "andere", fuehrtInDieIrre: true }),
    spur("d", { zeigtAufCharakterId: "andere", fuehrtInDieIrre: true }),
    spur("e", { zeigtAufCharakterId: "andere" }),
    spur("f", { zeigtAufCharakterId: "andere" }),
    spur("g", { fernwirkung: true, zeigtAufCharakterId: "drahtzieher" }),
  ];

  const gekappt = spurenKappen(viele, 5, "taeter");
  pruefe("auf das Maß gekürzt", gekappt.spuren.length === 5);
  pruefe("die Fernwirkung bleibt", gekappt.spuren.some((s) => s.fernwirkung));
  pruefe(
    "zwei Spuren auf den Täter bleiben",
    gekappt.spuren.filter((s) => s.zeigtAufCharakterId === "taeter").length >= 2,
  );
  pruefe(
    "eine falsche Fährte bleibt",
    gekappt.spuren.filter((s) => s.fuehrtInDieIrre).length >= 1,
  );
  pruefe("und es steht in den Änderungen", gekappt.aenderungen.length === 2);

  pruefe("wer im Maß liegt, bleibt unangetastet", spurenKappen(viele, 7, "taeter").spuren.length === 7);
  pruefe("und ohne Änderungen", spurenKappen(viele, 7, "taeter").aenderungen.length === 0);

  // Alles Fernwirkung: Dann wird lieber nicht gekappt als das Falsche.
  const nurFern = [1, 2, 3].map((n) => spur(`f${n}`, { fernwirkung: true }));
  pruefe("Fernwirkung wird nie geopfert", spurenKappen(nurFern, 1, "taeter").spuren.length === 3);
}

console.log("\n4. Die Verteilung über die Orte");
{
  const orte = ["o1", "o2", "o3", "o4", "o5"];
  const an = (...ids) => ids.map((id, i) => spur(`i${i}`, { ortId: id }));

  pruefe(
    "gut verteilt gibt keine Meldung",
    verteilungMangel(an("o1", "o2", "o3", "o4"), orte) === null,
  );
  pruefe(
    "alles an einem Ort wird gemeldet",
    Boolean(verteilungMangel(an("o1", "o1", "o1", "o1"), orte)),
  );
  pruefe(
    "zwei Orte sind zu wenig",
    Boolean(verteilungMangel(an("o1", "o1", "o2", "o2"), orte)),
  );
  pruefe(
    "ein Haufen an einem Ort wird gemeldet",
    (verteilungMangel(an("o1", "o1", "o1", "o2", "o3"), orte) ?? "").includes("auf einem Haufen"),
  );
  pruefe(
    "zwei am selben Ort sind in Ordnung",
    verteilungMangel(an("o1", "o1", "o2", "o3"), orte) === null,
  );
  pruefe("bei einem Ort gibt es nichts zu verteilen", verteilungMangel(an("o1", "o1"), ["o1"]) === null);
  pruefe("eine einzelne Spur auch nicht", verteilungMangel(an("o1"), orte) === null);
}

console.log("\n5. Im Prompt steht dieselbe Zahl");
{
  const bauen = (ziel, saga = null) =>
    buildSpurenPrompt(
      [{ id: "taeter", name: "T", istDetektiv: false }],
      "taeter", "Fall", "Hergang",
      [{ charakterId: "taeter", aufenthaltsort: "o1", alibi: "a" }],
      null, [{ id: "i1", name: "I" }], saga, false, ziel,
    );

  const einzeln = bauen(ZIEL_EINZELFALL);
  pruefe("die Spanne steht drin", einzeln.includes("4 bis 6 Spuren"));
  pruefe("und ist verbindlich", einzeln.includes("Nicht mehr und nicht weniger"));
  pruefe("die Verteilung steht drin", einzeln.includes("höchstens zwei"));
  pruefe("mit mindestens drei Orten", einzeln.includes("mindestens drei verschiedene Orte"));

  const kapitel = bauen(ZIEL_KAPITEL, {
    drahtzieherName: "Hut", drahtzieherId: "hut", enthuellung: "e", vorGericht: true,
  });
  pruefe("im Kapitel steht die größere Spanne", kapitel.includes("5 bis 7 Spuren"));
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
