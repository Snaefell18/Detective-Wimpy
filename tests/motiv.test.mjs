/**
 * Das Motiv von Hand: Warum der Täter es getan hat, darf im Editor stehen.
 *
 * Es ist die einzige Vorgabe, die wörtlich im fertigen Fall landet - wer den
 * Grund selbst schreibt, will ihn nachher wiederfinden und nicht eine
 * höflichere Fassung davon. Hier steht deshalb dreierlei unter Aufsicht: dass
 * die Zählung stimmt (das Finale hängt hinten an, der Fallbau nennt es 0),
 * dass jeder der drei Prompts die Ansage bekommt - und dass ein leeres Feld
 * alles beim Alten lässt, also weiter ausgedacht wird.
 */
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { buildGeruestPrompt, motivRegeln } from "../lib/prompts.ts";
import { buildKapitelPrompt, buildKernPrompt } from "../lib/sagaPrompts.ts";
import {
  STANDARD_SAGA_VORGABEN,
  motivFuerFall,
  motivFuerKapitel,
} from "../lib/sagaTypen.ts";

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
const besetzung = [wimpy, tier("hut", "Herr Hut"), tier("nala", "Nala"), tier("bo", "Bo")];
const WERFT = "Er will die Werft zurück, die man seiner Familie genommen hat";
const BOOT = "Sie braucht das Geld für die Reparatur ihres Bootes";

console.log("\n1. Welches Motiv zu welchem Kapitel gehört");
{
  // Drei Kapitel: Platz 0 bis 2 sind die Kapitel, Platz 3 ist das Finale.
  const vorgaben = {
    ...STANDARD_SAGA_VORGABEN,
    kapitelAnzahl: 3,
    kapitelMotive: [BOOT, "", "  ", WERFT],
  };
  pruefe("Kapitel 1 bekommt seines", motivFuerKapitel(vorgaben, 0) === BOOT);
  pruefe("Kapitel 2 hat keines", motivFuerKapitel(vorgaben, 1) === "");
  pruefe("Leerzeichen sind kein Motiv", motivFuerKapitel(vorgaben, 2) === "");
  pruefe("das Finale steht hinten", motivFuerKapitel(vorgaben, 3) === WERFT);
  pruefe("und was gar nicht da ist, bleibt leer", motivFuerKapitel(vorgaben, 7) === "");
  pruefe("ohne Vorgaben auch", motivFuerKapitel(undefined, 0) === "");

  // Die andere Zählung: Der Fallbau nennt das Finale 0.
  pruefe("Fall 1 ist Kapitel 1", motivFuerFall(vorgaben, 1) === BOOT);
  pruefe("Fall 2 hat keines", motivFuerFall(vorgaben, 2) === "");
  pruefe("Fall 0 ist das Finale", motivFuerFall(vorgaben, 0) === WERFT);

  pruefe(
    "eine Saga ohne Motive lässt alles offen",
    motivFuerFall({ ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 3 }, 0) === "",
  );
}

console.log("\n2. Die Ansage ans Modell");
{
  pruefe("ohne Motiv keine Ansage", motivRegeln({ taeterName: "Nala", motiv: "" }) === "");
  pruefe("Leerzeichen zählen nicht", motivRegeln({ taeterName: "Nala", motiv: "   " }) === "");

  const fall = motivRegeln({ taeterName: "Nala", motiv: BOOT });
  pruefe("das Motiv steht drin", fall.includes(BOOT));
  pruefe("der Täter wird genannt", fall.includes("warum Nala es getan hat"));
  pruefe("wörtlich, ausdrücklich", fall.includes("wörtlich ins Feld motiv"));
  pruefe("und der Rest richtet sich danach", fall.includes("Tathergang, Alibis und Spuren"));

  const kern = motivRegeln({ taeterName: "Herr Hut", motiv: WERFT, was: "kern" });
  pruefe("im Kern geht es um die Wahrheit", kern.includes("Die Wahrheit hinter der ganzen Saga"));
  pruefe("und um das richtige Feld", kern.includes("drahtzieherMotiv"));

  const kapitel = motivRegeln({ taeterName: "Nala", motiv: BOOT, was: "kapitel" });
  pruefe("im Kapitel geht es um Auftrag und Enthüllung", kapitel.includes("Auftrag und Enthüllung"));
  pruefe("und das Motiv bleibt geheim", kapitel.includes("bleibt geheim"));
}

console.log("\n3. Der Fall bekommt es zu lesen");
{
  const mit = buildGeruestPrompt(besetzung, "Venedig", "nala", null, "", BOOT);
  pruefe("das Motiv steht im Prompt", mit.includes(BOOT));
  pruefe("das Feld verweist darauf", mit.includes("- motiv: der Satz von oben, Wort für Wort."));

  const ohne = buildGeruestPrompt(besetzung, "Venedig", "nala", null, "");
  pruefe("ohne Vorgabe denkt sich das Modell eins aus", ohne.includes("- motiv: warum Nala es getan hat"));
  pruefe("und nichts steht fest", !ohne.includes("DAS MOTIV STEHT FEST"));

  // Zwei Täter, ein Motiv: Die Ansage darf die Mittäterregeln nicht verdrängen.
  const zuZweit = buildGeruestPrompt(besetzung, "Venedig", "nala", null, "bo", BOOT);
  pruefe("mit zweitem Täter bleibt beides stehen", zuZweit.includes(BOOT) && zuZweit.includes("ZWEI TÄTER"));
}

console.log("\n4. Kern und Kapitel bekommen es auch");
{
  const staedte = [{ id: "venedig", name: "Venedig", orte: [] }];
  const drahtzieher = besetzung.find((c) => c.id === "hut");
  const vorgaben = {
    ...STANDARD_SAGA_VORGABEN,
    kapitelAnzahl: 3,
    drahtzieherId: "hut",
    kapitelMotive: ["", "", "", WERFT],
  };
  const kern = buildKernPrompt(besetzung, staedte, drahtzieher, vorgaben);
  pruefe("der Kern kennt das Motiv des Drahtziehers", kern.includes(WERFT));
  pruefe("und nennt ihn beim Namen", kern.includes("warum Herr Hut es getan hat"));

  const ohne = buildKernPrompt(besetzung, staedte, drahtzieher, {
    ...vorgaben,
    kapitelMotive: [],
  });
  pruefe("ohne Eintrag bleibt der Kern, wie er war", !ohne.includes("DAS MOTIV STEHT FEST"));

  const gemeinsam = {
    nummer: 1, anzahl: 3, thema: "x", wahrheit: "y", drahtzieherName: "Herr Hut",
    drahtzieherId: "hut", moeglicheTaeter: [{ id: "nala", name: "Nala" }],
    bisher: [], wunsch: "", stadt: "Venedig", twist: false, neueTiere: [],
    wunschTaeter: "Nala",
  };
  const kapitel = buildKapitelPrompt({ ...gemeinsam, wunschMotiv: BOOT });
  pruefe("das Kapitel kennt das Motiv", kapitel.includes(BOOT));
  pruefe("der Täter steht weiter fest", kapitel.includes("DER TÄTER DIESES KAPITELS STEHT FEST"));
  pruefe(
    "ohne Motiv ändert sich am Kapitel nichts",
    !buildKapitelPrompt(gemeinsam).includes("DAS MOTIV STEHT FEST"),
  );
}

console.log("\n5. Die Vorgaben überstehen das Schema");
{
  const gelesen = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitelMotive: [BOOT, "", WERFT],
  });
  pruefe("die Motive kommen durch", gelesen.success && gelesen.data.kapitelMotive[0] === BOOT);
  pruefe("auch das des Finales", gelesen.success && gelesen.data.kapitelMotive[2] === WERFT);

  const alt = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, kapitelMotive: undefined });
  pruefe("ältere Sagas ohne Feld bleiben gültig", alt.success);
  pruefe("und haben schlicht keine", alt.success && alt.data.kapitelMotive.length === 0);

  // Lücken in der Mitte werden auf dem Weg zum Server zu null - das hat schon
  // einmal eine ganze Bestellung scheitern lassen.
  const mitLuecken = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitelMotive: [null, BOOT],
  });
  pruefe("Löcher werden zu leeren Feldern", mitLuecken.success && mitLuecken.data.kapitelMotive[0] === "");
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
