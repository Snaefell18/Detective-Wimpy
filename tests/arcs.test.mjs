/**
 * Arcs: Die Stationen dürfen nachwachsen, ohne dass Texte verloren gehen -
 * und gespielt werden darf, sobald die erste Saga steht.
 */
import {
  LEERER_ARC_TEIL,
  besetzungFuerTeil,
  sagaAuftrag,
  fertigeTeile,
  leererArc,
  mitAnzahl,
  naechsteLuecke,
  sagaVon,
  spielbar,
} from "../lib/arcTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Ein frischer Arc");
{
  const arc = leererArc();
  pruefe("drei Stationen", arc.teile.length === 3);
  pruefe("durchnummeriert", arc.teile.every((t, i) => t.nummer === i + 1));
  pruefe("noch nicht spielbar", !spielbar(arc));
  pruefe("keine fertige Saga", fertigeTeile(arc) === 0);
  pruefe("die erste Lücke ist Teil 1", naechsteLuecke(arc)?.nummer === 1);
}

console.log("\n2. Die Anzahl verstellen");
{
  let arc = leererArc();
  arc.teile[0] = { ...arc.teile[0], name: "Der Anfang", sagaId: "s1" };
  arc.teile[1] = { ...arc.teile[1], erzaehler: { text: "Später.", audio: "" } };

  const kurz = mitAnzahl(arc, 1);
  pruefe("auf 1 gekürzt", kurz.teile.length === 1 && kurz.sagenAnzahl === 1);
  pruefe("der erste Teil bleibt vollständig", kurz.teile[0].sagaId === "s1");

  const lang = mitAnzahl(arc, 7);
  pruefe("auf 7 erweitert", lang.teile.length === 7);
  pruefe("alte Texte überleben", lang.teile[1].erzaehler.text === "Später.");
  pruefe("neue Teile sind leer", lang.teile[6].sagaId === "");
  pruefe("weiterhin durchnummeriert", lang.teile.every((t, i) => t.nummer === i + 1));

  // Kürzen und wieder erweitern darf nichts wiederbringen, was weg war.
  const zurueck = mitAnzahl(mitAnzahl(arc, 1), 3);
  pruefe("gekürzt und erweitert: Teil 2 ist leer", zurueck.teile[1].erzaehler.text === "");

  for (const n of [-5, 0, 1, 5, 10, 11, 99]) {
    const a = mitAnzahl(arc, n);
    pruefe(`Anzahl ${n} landet zwischen 1 und 10`, a.teile.length >= 1 && a.teile.length <= 10, String(a.teile.length));
  }
}

console.log("\n3. Spielbar, sobald die erste Saga steht");
{
  const arc = leererArc();
  // Nur ein späterer Teil hat eine Saga - das genügt gerade nicht.
  const spaet = { ...arc, teile: arc.teile.map((t, i) => (i === 2 ? { ...t, sagaId: "s3" } : t)) };
  pruefe("Saga nur hinten: noch nicht spielbar", !spielbar(spaet));
  pruefe("aber eine fertige Station", fertigeTeile(spaet) === 1);
  pruefe("die Lücke ist Teil 1", naechsteLuecke(spaet)?.nummer === 1);

  const frueh = { ...arc, teile: arc.teile.map((t, i) => (i === 0 ? { ...t, sagaId: "s1" } : t)) };
  pruefe("erste Saga da: spielbar", spielbar(frueh));
  pruefe("die Lücke ist jetzt Teil 2", naechsteLuecke(frueh)?.nummer === 2);

  const voll = { ...arc, teile: arc.teile.map((t, i) => ({ ...t, sagaId: `s${i + 1}` })) };
  pruefe("volle Reihe: keine Lücke mehr", naechsteLuecke(voll) === null);
  pruefe("alle drei fertig", fertigeTeile(voll) === 3);
}

console.log("\n4. Die Saga zu einer Station");
{
  const arc = { ...leererArc(), teile: [{ ...LEERER_ARC_TEIL(1), sagaId: "s1" }, LEERER_ARC_TEIL(2)] };
  const sagen = [{ id: "s1", name: "Erste" }];
  pruefe("gefunden", sagaVon(arc, 0, sagen)?.name === "Erste");
  pruefe("leere Station: null", sagaVon(arc, 1, sagen) === null);
  pruefe("Station außerhalb: null", sagaVon(arc, 9, sagen) === null);
  pruefe("Saga fehlt in der Datenbank: null", sagaVon(arc, 0, []) === null);
}

console.log("\n5. Der Culprit hinter allem");
{
  const arc = {
    ...leererArc(),
    name: "Die Schatten",
    klappentext: "Eine Stadt schweigt.",
    ziel: "Am Ende führt alles in den Hafen.",
    culprit: { charakterId: "boss", wort: "Der Schattenkanzler" },
  };
  arc.teile[0].erzaehler.text = "Es beginnt im Regen.";

  const frueh = sagaAuftrag(arc, 0);
  pruefe("Klappentext steckt drin", frueh.includes("Eine Stadt schweigt."));
  pruefe("das Ziel steckt drin", frueh.includes("in den Hafen"));
  pruefe("der Stationstext steckt drin", frueh.includes("Es beginnt im Regen."));
  pruefe("das Wort wird genannt", frueh.includes("Der Schattenkanzler"));
  pruefe("vorher wird er nicht enttarnt", frueh.includes("ungesehen"));

  const spaet = sagaAuftrag(arc, 2);
  pruefe("in der letzten Saga fällt die Maske", spaet.includes("fällt die Maske"));
  pruefe("und nicht mehr „ungesehen“", !spaet.includes("ungesehen"));

  const ohne = sagaAuftrag({ ...arc, culprit: { charakterId: "", wort: "" } }, 0);
  pruefe("ohne Culprit keine Ansage", !ohne.includes("Hinter allem steht"));
  pruefe("leerer Arc fällt auf den Namen zurück", sagaAuftrag({ ...leererArc(), name: "X" }, 0) === "X");

  const alleIds = ["boss", "mikkeli", "nala", "fanny"];
  const frueheBesetzung = besetzungFuerTeil(arc, 0, alleIds);
  pruefe("vorher ist der Culprit draußen", !frueheBesetzung.includes("boss"), frueheBesetzung.join(","));
  pruefe("die anderen bleiben", frueheBesetzung.length === 3);
  pruefe("in der letzten Saga: freie Besetzung", besetzungFuerTeil(arc, 2, alleIds).length === 0);
  pruefe(
    "zu wenige Verdächtige: lieber spielbar als inszeniert",
    besetzungFuerTeil(arc, 0, ["boss", "nala", "fanny"]).length === 0,
  );
  pruefe(
    "ohne gesetzten Culprit bleibt alles offen",
    besetzungFuerTeil({ ...arc, culprit: { charakterId: "", wort: "X" } }, 0, alleIds).length === 0,
  );
}

console.log(
  fehlgeschlagen === 0 ? "\nAlles sauber." : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`,
);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
