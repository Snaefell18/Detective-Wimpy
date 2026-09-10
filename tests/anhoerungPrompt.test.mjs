/**
 * Der Prompt der Anhörung.
 *
 * Er ist die einzige Stelle, an der die Wahrheit über ein Beweismittel
 * auftaucht - und gleichzeitig die Stelle, an der ein Fehler den ganzen
 * Abend verdirbt. Geprüft wird deshalb beides: dass alles drinsteht, was der
 * Saal braucht, und dass die Regeln dagegen stehen, dass jemand zu früh
 * gesteht oder das Urteil vorwegnimmt.
 */
import { buildAnhoerungPrompt } from "../lib/anhoerungPrompt.ts";
import { FINALE_ARTEN } from "../lib/sagaFinale.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5,
  stats: { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 5,
    schelmischkeit: 5, kriminalitaetslevel: 5, intelligenz: 5 },
  beschreibung: "kurz", bild: "", istDetektiv: false, ...extra,
});

const wimpy = tier("wimpy", "Wimpy", { istDetektiv: true });
const oeho = tier("oeho", "Öhö", { alter: 70 });
const hut = tier("hut", "Herr Hut", { sprachstil: "spricht in Rätseln" });
const besetzung = [wimpy, oeho, hut];

const bogen = {
  id: "s1",
  name: "Die Sache mit den Glocken",
  thema: "Jemand stellt die Uhren der Stadt",
  klappentext: "",
  vorgaben: { ...STANDARD_SAGA_VORGABEN, finaleArt: "gericht" },
  besetzung,
  drahtzieherId: "hut",
  drahtzieherName: "Herr Hut",
  wahrheit: "Der Hut wollte den Glockenturm für sich",
  drahtzieherMotiv: "Ein alter Streit um den Turm",
  auftaktText: "",
  schlagworte: [],
  kapitel: [],
  finale: {
    frage: "Wer hat die Glocken angehalten?",
    auftrag: "",
    erzaehlerText: "",
    epilogText: "",
    stadt: "venedig",
    wahrheit: {
      beweise: [],
      urteilSchuldig: "Vier Tage Schrankhaft.",
      urteilFrei: "Die Akte wird geschlossen.",
      angeklagterId: "hut",
    },
  },
  erstelltAm: 0,
};

const mittel = (id, name, extra = {}) => ({
  kern: {
    id, name,
    beobachtung: `Beobachtung zu ${name}`,
    bedeutung: `Bedeutung von ${name}`,
    zeigtAufCharakterId: "hut",
    fuehrtInDieIrre: false,
    herkunft: "Kapitel 2 · Hafen",
  },
  gelegt: false,
  jetzt: false,
  ...extra,
});

const bauen = (extra = {}) =>
  buildAnhoerungPrompt({
    bogen,
    art: "gericht",
    angeklagter: hut,
    richter: oeho,
    detektiv: wimpy,
    mittel: [mittel("lupe", "Lupe", { jetzt: true }), mittel("schluessel", "Schlüssel")],
    verlauf: [],
    nachricht: "Wo waren Sie um Mitternacht?",
    ueberzeugung: 20,
    geduld: 5,
    ...extra,
  });

console.log("\n1. Der Saal ist vollständig besetzt");
{
  const p = bauen();
  pruefe("der Vorsitz steht drin", p.includes("Öhö"));
  pruefe("der Angeklagte steht drin", p.includes("Herr Hut"));
  pruefe("der Fragende steht drin", p.includes("Wimpy"));
  pruefe("der Sprachstil des Angeklagten zählt", p.includes("spricht in Rätseln"));
  pruefe("die Frage des Finales steht drin", p.includes("Wer hat die Glocken angehalten?"));
  pruefe("die Wahrheit ist bekannt", p.includes("Der Hut wollte den Glockenturm"));
  pruefe("das Motiv ist bekannt", p.includes("Ein alter Streit um den Turm"));
  pruefe("Wimpys Satz steht am Ende", p.trimEnd().endsWith('"Wo waren Sie um Mitternacht?"'));
}

console.log("\n2. Die Beweismittel - außen die Karte, innen die Wahrheit");
{
  const p = bauen();
  pruefe("beide Stücke stehen drin", p.includes("Lupe") && p.includes("Schlüssel"));
  pruefe("die Bedeutung steht drin", p.includes("Bedeutung von Lupe"));
  pruefe("die Beobachtung steht drin", p.includes("Beobachtung zu Lupe"));
  pruefe("die Herkunft steht drin", p.includes("Kapitel 2 · Hafen"));
  pruefe("das vorgelegte Stück ist markiert", p.includes("LEGT WIMPY GERADE VOR"));
  pruefe("und der Angeklagte muss darauf eingehen", p.includes('ich lege') === false && p.includes('"Lupe" vor'));

  const gelegt = bauen({
    mittel: [mittel("lupe", "Lupe", { gelegt: true })],
  });
  pruefe("was liegt, ist als liegend markiert", gelegt.includes("liegt schon auf dem Tisch"));
  pruefe("ohne Vorlage steht das auch da", gelegt.includes("legt in diesem Zug nichts vor"));

  const irre = bauen({
    mittel: [
      { ...mittel("falle", "Falsche Fährte", { jetzt: true }),
        kern: { ...mittel("falle", "Falsche Fährte").kern, fuehrtInDieIrre: true } },
    ],
  });
  pruefe("ein Irrweg wird als solcher benannt", irre.includes("führt in die Irre"));

  const leer = bauen({ mittel: [] });
  pruefe("leere Tasche wird gesagt", leer.includes("Wimpy hat nichts dabei"));
}

console.log("\n3. Die Regeln, die den Abend zusammenhalten");
{
  const p = bauen();
  pruefe("kein Urteil, keine Strafe", p.includes("Schreibe niemals das Urteil"));
  pruefe("kein Geständnis auf Vorrat", p.includes("gestaendnis nur auf true"));
  pruefe("nichts wird zu früh verraten", p.includes("Verschlusssache"));
  pruefe("der Stand steht drin", p.includes("steht bei 20 von 100"));
  pruefe("die Geduld steht drin", p.includes("Geduld steht bei 5"));
  pruefe("dasselbe Stück zweimal bringt nichts", p.includes("zweites Mal"));
  pruefe("keine Namensprefixe", p.includes("Keine Namensprefixe"));
}

console.log("\n4. Klagt Wimpy sich selbst an, spricht nur der Vorsitz");
{
  const p = bauen({ art: "wimpy", angeklagter: wimpy });
  pruefe("der Angeklagte bleibt stumm", p.includes('angeklagter: leer lassen'));
  pruefe("kein Geständnis-Zusatz für ihn", !p.includes("wirklich zugibt, was er getan hat"));
  const normal = bauen();
  pruefe("sonst gibt es den Zusatz", normal.includes("wirklich zugibt, was er getan hat"));
}

console.log("\n4b. Auf der Bank sitzt die Gestalt - dann redet auch sie");
{
  const daemon = tier("schatten", "Der Schatten", { tierart: "Schatten", alter: 400 });
  const p = bauen({
    art: "gericht-daemon",
    angeklagter: daemon,
    alsGestalt: { wirtName: "Herr Hut" },
  });
  pruefe("die eigene Stimme steht drin", p.includes("SO SPRICHT DER SCHATTEN"));
  pruefe("sie hat Zeit", p.includes("Sie ist alt und hat Zeit"));
  pruefe("kein Gebrüll", p.includes("kein Gebrüll"));
  pruefe("der Wirt wird in der dritten Person genannt", p.includes("Von Herr Hut spricht sie in der dritten Person"));
  pruefe("ihre Höflichkeit ist unangenehm", p.includes("Höflichkeit ist unangenehmer"));
  pruefe("sie dreht Worte um", p.includes("dreht Worte um"));
  pruefe("ihre Bilder sind kalt", p.includes("Winter, Keller, Uhren, Staub"));
  pruefe("keine Hölle, kein Feuer", p.includes("Keine Hölle, kein Feuer"));
  pruefe("ein Treffer macht sie kürzer", p.includes("wird kürzer, genauer"));
  pruefe("gestanden wird erst am Ende", p.includes("Zugegeben wird erst ganz am Schluss"));
  pruefe("und es bleibt kindgerecht", p.includes("Unheimlich durch Ruhe"));

  const gewoehnlich = bauen();
  pruefe("ein gewöhnlicher Angeklagter bekommt das nicht", !gewoehnlich.includes("SO SPRICHT"));

  // Klagt Wimpy sich selbst an, spricht der Angeklagte gar nicht - dann
  // hätte eine eigene Stimme auch nichts zu sagen.
  const selbst = bauen({ art: "wimpy", angeklagter: wimpy, alsGestalt: { wirtName: "Wimpy" } });
  pruefe("bei „Wimpy selbst“ bleibt es aus", !selbst.includes("SO SPRICHT"));

  // Der eigene Sprachstil aus den Stammdaten steht davor und gewinnt.
  const mitStil = bauen({
    art: "gericht-daemon",
    angeklagter: { ...daemon, sprachstil: "zischt jedes S" },
    alsGestalt: { wirtName: "Herr Hut" },
  });
  pruefe("ein eigener Sprachstil steht darüber", mitStil.indexOf("zischt jedes S") < mitStil.indexOf("SO SPRICHT"));
  pruefe("und ist wichtiger als alles andere", mitStil.includes("wichtiger als alles andere"));
}

console.log("\n5. Jede Finale-Art bringt ihr eigenes Ziel mit");
{
  for (const art of FINALE_ARTEN) {
    const p = bauen({ art: art.id });
    pruefe(`${art.id} hat ein Ziel`, p.includes("WORUM ES GEHT") && p.length > 800);
  }
  pruefe(
    "bei „kein Täter“ ist niemand schuldig",
    bauen({ art: "ohne-taeter" }).includes("Es gibt keinen Täter"),
  );
}

console.log("\n6. Das Protokoll der letzten Züge");
{
  const p = bauen({
    verlauf: [
      { rolle: "wimpy", text: "Erste Frage" },
      { rolle: "angeklagter", text: "Ausweichende Antwort" },
      { rolle: "richter", text: "Zur Sache, bitte." },
    ],
  });
  pruefe("Wimpys Zug steht drin", p.includes("Wimpy: Erste Frage"));
  pruefe("der Angeklagte mit Namen", p.includes("Herr Hut: Ausweichende Antwort"));
  pruefe("der Vorsitz mit Namen", p.includes("Öhö: Zur Sache, bitte."));
  pruefe("leerer Verlauf wird gesagt", bauen().includes("die Verhandlung beginnt gerade"));
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
