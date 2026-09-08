/**
 * Die Vorabprüfung: Alles, was einen Lauf scheitern lassen würde, muss vorher
 * auffallen - ein Abbruch im letzten Schritt ist bezahlt und trotzdem
 * verloren.
 */
import { pruefeVorgaben } from "../lib/sagaPruefung.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { lohntWiederholung } from "../lib/wiederholen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id,
  nummer: 1,
  name,
  tierart: "Tier",
  alter: 5,
  stats: {},
  beschreibung: "",
  bild: "",
  istDetektiv: false,
  ...extra,
});

const wimpy = tier("wimpy", "Wimpy", { istDetektiv: true });
const charaktere = [wimpy, tier("oeho", "Öhö", { alter: 70 }), tier("nala", "Nala"), tier("hut", "Herr Hut"), tier("boss", "Boss")];
// Zwei Städte mit je fünf Schauplätzen.
const orte = ["venedig", "kopenhagen"].flatMap((stadt) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${stadt}-${i}`,
    stadt: stadt[0].toUpperCase() + stadt.slice(1),
    stadtId: stadt,
    name: `Ort ${i}`,
    atmosphaere: "",
    beschreibung: "",
    bild: "",
  })),
);

const mit = (teil) => ({ ...STANDARD_SAGA_VORGABEN, ...teil });
const probleme = (teil) => pruefeVorgaben({ vorgaben: mit(teil), charaktere, orte });

console.log("\n1. Was in Ordnung ist, geht durch");
pruefe("Standardvorgaben", probleme({}).length === 0, probleme({})[0]);
pruefe(
  "Gerichtsfinale mit vollem Ensemble",
  probleme({ finaleArt: "gericht", drahtzieherId: "hut" }).length === 0,
  probleme({ finaleArt: "gericht", drahtzieherId: "hut" })[0],
);
pruefe(
  "Wimpy-Finale mit Dämonenform",
  probleme({
    finaleArt: "wimpy",
    besessenheit: { wirtId: "wimpy", daemonId: "boss", ton: "" },
  }).length === 0,
);

console.log("\n2. Was vorher auffallen muss");
{
  // Zu wenige AUSGEWÄHLTE Tiere sind kein Fehler: Dann spielt die ganze
  // Besetzung mit (Spielbarkeit vor Inszenierung). Zu wenige Tiere ÜBERHAUPT
  // schon - daraus lässt sich kein Fall bauen.
  pruefe(
    "eine zu knappe Auswahl weitet sich still auf alle",
    pruefeVorgaben({ vorgaben: mit({ charaktere: ["nala", "hut"] }), charaktere, orte })
      .length === 0,
  );
  const zuWenige = pruefeVorgaben({
    vorgaben: mit({}),
    charaktere: [wimpy, tier("nala", "Nala"), tier("hut", "Herr Hut")],
    orte,
  });
  pruefe("zu wenige Tiere überhaupt", zuWenige.some((p) => p.includes("drei Verdächtige")));
}
pruefe(
  "Wimpy-Finale ohne Dämonenform",
  probleme({ finaleArt: "wimpy" }).some((p) => p.includes("Gestalt")),
);
pruefe(
  "Wimpy-Finale ohne Detektiv in den Stammdaten",
  pruefeVorgaben({
    vorgaben: mit({
      finaleArt: "wimpy",
      besessenheit: { wirtId: "wimpy", daemonId: "boss", ton: "" },
    }),
    charaktere: charaktere.filter((c) => !c.istDetektiv),
    orte,
  }).some((p) => p.includes("Detektiv")),
);
pruefe(
  "Verhandlung ohne möglichen Vorsitz",
  pruefeVorgaben({
    vorgaben: mit({ finaleArt: "gericht", drahtzieherId: "nala" }),
    charaktere: [wimpy, tier("nala", "Nala")],
    orte,
  }).some((p) => p.includes("Vorsitz")),
);
pruefe(
  "Gericht und Twist zusammen",
  probleme({ finaleArt: "gericht", drahtzieherId: "hut", twist: true }).some((p) =>
    p.includes("vertragen sich nicht"),
  ),
);
pruefe(
  "halbe Besessenheit",
  probleme({ besessenheit: { wirtId: "nala", daemonId: "", ton: "" } }).some((p) =>
    p.includes("fehlt die Dämonenform"),
  ),
);
pruefe(
  "Drahtzieher spielt gar nicht mit",
  probleme({ charaktere: ["nala", "hut", "oeho"], drahtzieherId: "fremd" }).some((p) =>
    p.includes("spielt aber nicht mit"),
  ),
);
pruefe(
  "zu wenige Schauplätze",
  pruefeVorgaben({ vorgaben: mit({ ortsAnzahl: 8 }), charaktere, orte }).some((p) =>
    p.includes("Schauplätze"),
  ),
);
pruefe(
  "Kapiteltäter ist der Drahtzieher",
  probleme({ drahtzieherId: "hut", kapitelTaeter: ["hut"] }).some((p) =>
    p.includes("Drahtzieher"),
  ),
);

console.log("\n3. Wann sich ein zweiter Versuch lohnt");
pruefe("abgeschnittene Antwort", lohntWiederholung(new Error("Die Antwort wurde abgeschnitten.")));
pruefe("überlasteter Server", lohntWiederholung(new Error("overloaded_error")));
pruefe("Status 503", lohntWiederholung(new Error("Der Server hat unerwartet geantwortet (Status 503).")));
pruefe("Zeitlimit", lohntWiederholung(new Error("Das hat zu lange gedauert.")));
pruefe("fehlender Schlüssel nicht", !lohntWiederholung(new Error("ANTHROPIC_API_KEY ist nicht gesetzt.")));
pruefe("ungültige Vorgaben nicht", !lohntWiederholung(new Error("Die Vorgaben sind unvollständig: kapitelAnzahl")));
pruefe("kein Fehlerobjekt", !lohntWiederholung("kaputt"));

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
