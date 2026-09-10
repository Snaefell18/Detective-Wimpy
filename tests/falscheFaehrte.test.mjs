/**
 * Die falsche Fährte, die durch die ganze Saga läuft.
 *
 * Sie ist etwas anderes als der Fehlgriff eines einzelnen Falls: Ein Verdacht,
 * der über Kapitel hinweg mitwächst - und trotzdem ins Leere führt. Damit das
 * kein Ärgernis wird, muss zweierlei stimmen: Jede Station muss dasselbe Tier
 * streifen, und dieses Tier darf auf keinen Fall doch schuldig sein.
 *
 * Zusätzlich wird hier bewacht, was beim Speichern einer Akte durchgereicht
 * wird. Fehlte ein Feld im Schema, warf zod es beim Speichern weg - und
 * genau so ging einmal die Beobachtung verloren, der einzige Text, den der
 * Spieler beim Fund zu lesen bekommt.
 */
import { CaseFileSchema, SagaVorgabenSchema } from "../lib/schemas.ts";
import { falscheFaehrteRegeln } from "../lib/sagaPrompts.ts";
import { pruefeVorgaben } from "../lib/sagaPruefung.ts";
import { STANDARD_SAGA_VORGABEN, falscheFaehrteVon } from "../lib/sagaTypen.ts";

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
const besetzung = [wimpy, tier("oeho", "Öhö", { alter: 70 }), tier("hut", "Herr Hut"), tier("nala", "Nala"), tier("bo", "Bo")];
const orte = ["venedig"].flatMap((stadt) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${stadt}-${i}`, stadt, stadtId: stadt, name: `Ort ${i}`,
    atmosphaere: "", beschreibung: "", bild: "",
  })),
);

console.log("\n1. Wann eine Fährte überhaupt gilt");
{
  const mit = { ...STANDARD_SAGA_VORGABEN, drahtzieherId: "hut", falscheFaehrte: { charakterId: "nala", was: "immer am Hafen" } };
  const gefunden = falscheFaehrteVon(mit, besetzung);
  pruefe("das Tier wird gefunden", gefunden?.charakter.id === "nala");
  pruefe("der Grund reist mit", gefunden?.was === "immer am Hafen");

  pruefe("ohne Eintrag keine Fährte", falscheFaehrteVon(STANDARD_SAGA_VORGABEN, besetzung) === null);
  pruefe(
    "der Drahtzieher ist keine Fährte",
    falscheFaehrteVon({ ...mit, falscheFaehrte: { charakterId: "hut", was: "" } }, besetzung) === null,
  );
  pruefe(
    "der Detektiv auch nicht",
    falscheFaehrteVon({ ...mit, falscheFaehrte: { charakterId: "wimpy", was: "" } }, besetzung) === null,
  );
  pruefe(
    "wer nicht mitspielt, zählt nicht",
    falscheFaehrteVon({ ...mit, falscheFaehrte: { charakterId: "fremd", was: "" } }, besetzung) === null,
  );
}

console.log("\n2. Die Ansage ans Modell");
{
  const p = falscheFaehrteRegeln({ name: "Nala", was: "ist jede Nacht am Hafen" });
  pruefe("das Tier steht drin", p.includes("Nala"));
  pruefe("unschuldig, ausdrücklich", p.includes("ist unschuldig"));
  pruefe("in jedem Kapitel", p.includes("JEDEM Kapitel"));
  pruefe("der eigene Grund wird benutzt", p.includes("ist jede Nacht am Hafen"));
  pruefe("es bleibt eine falsche Fährte", p.includes("fuehrtInDieIrre true, fernwirkung false"));
  pruefe("und trägt vor Gericht nicht", p.includes("trägt vor Gericht nicht"));
  pruefe("sie erklärt sich schlecht", p.includes("erklärt sich schlecht"));
  pruefe("niemand entlastet sie", p.includes("niemand entlastet ihn"));

  const ohne = falscheFaehrteRegeln({ name: "Nala", was: "" });
  pruefe("ohne Grund erfindet das Modell einen", ohne.includes("eine Angewohnheit"));

  const lang = falscheFaehrteRegeln({ name: "Nala", was: "", ausfuehrlich: true });
  pruefe("im Kern kommt der Vorspann dazu", lang.includes("im Auftakt kommt er nicht als Verdächtiger vor"));
  pruefe("und die Auflösung", lang.includes("löst sich die Sache auf"));

  pruefe("ohne Namen keine Ansage", falscheFaehrteRegeln({ name: "", was: "x" }) === "");
}

console.log("\n3. Die Prüfung fängt Unsinn ab");
{
  const basis = {
    ...STANDARD_SAGA_VORGABEN,
    kapitelAnzahl: 2,
    charaktere: besetzung.map((c) => c.id),
    drahtzieherId: "hut",
  };
  const probleme = (falscheFaehrte, extra = {}) =>
    pruefeVorgaben({
      vorgaben: { ...basis, falscheFaehrte, ...extra },
      charaktere: besetzung,
      orte,
    }).filter((p) => /Fährte|Detektiv/.test(p));

  pruefe("eine saubere Fährte macht keinen Ärger", probleme({ charakterId: "nala", was: "" }).length === 0);
  pruefe(
    "Drahtzieher als Fährte wird gemeldet",
    probleme({ charakterId: "hut", was: "" }).some((p) => p.includes("zugleich Drahtzieher")),
  );
  pruefe(
    "der Detektiv wird gemeldet",
    probleme({ charakterId: "wimpy", was: "" }).some((p) => p.includes("Detektiv")),
  );
  pruefe(
    "wer nicht mitspielt, wird gemeldet",
    probleme({ charakterId: "fremd", was: "" }).some((p) => p.includes("spielt aber nicht mit")),
  );
  pruefe(
    "Kapiteltäter als Fährte wird gemeldet",
    probleme({ charakterId: "nala", was: "" }, { kapitelTaeter: ["nala", ""] }).some((p) =>
      p.includes("Täter von Kapitel 1"),
    ),
  );
  pruefe(
    "der Wirt einer Besessenheit wird gemeldet",
    probleme({ charakterId: "nala", was: "" }, {
      besessenheit: { wirtId: "nala", daemonId: "bo", ton: "" },
    }).some((p) => p.includes("Wirt der Besessenheit")),
  );
}

console.log("\n4. Die Vorgaben überstehen das Schema");
{
  const gelesen = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    falscheFaehrte: { charakterId: "nala", was: "immer am Hafen" },
  });
  pruefe("die Fährte kommt durch", gelesen.success && gelesen.data.falscheFaehrte.charakterId === "nala");
  pruefe("mit ihrem Grund", gelesen.success && gelesen.data.falscheFaehrte.was === "immer am Hafen");

  const alt = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, falscheFaehrte: undefined });
  pruefe("ältere Sagas ohne Feld bleiben gültig", alt.success);
  pruefe("und bekommen eine leere Fährte", alt.success && alt.data.falscheFaehrte.charakterId === "");
}

console.log("\n5. Beim Speichern einer Akte geht keine Spur verloren");
{
  const fall = {
    id: "f1",
    besetzung,
    items: [{ id: "lupe", name: "Lupe", beschreibung: "", bild: "" }],
    ton: "kindgerecht",
    stadt: "venedig",
    orte,
    introText: "",
    schlagworte: [],
    titel: "Der Fall",
    tatbeschreibung: "Etwas ist weg",
    tatort: "venedig-0",
    taeterId: "nala",
    motiv: "Neid",
    tathergang: "So war es",
    verdaechtige: [
      { charakterId: "nala", aufenthaltsort: "venedig-0", alibi: "a", geheimnis: "g", alibiIstGelogen: true },
    ],
    spuren: [
      {
        itemId: "lupe",
        ortId: "venedig-0",
        beobachtung: "Ein Sprung im Glas, 22:41.",
        vermutung: "Das gehört hier nicht her.",
        bedeutung: "Gehört Herrn Hut",
        zeigtAufCharakterId: "hut",
        fuehrtInDieIrre: false,
        fernwirkung: true,
      },
    ],
    erstelltAm: 1,
  };

  const gelesen = CaseFileSchema.safeParse(fall);
  pruefe("die Akte kommt durch", gelesen.success, gelesen.success ? "" : gelesen.error?.issues?.[0]?.message);
  const spur = gelesen.success ? gelesen.data.spuren[0] : {};
  pruefe("die Beobachtung überlebt", spur.beobachtung === "Ein Sprung im Glas, 22:41.");
  pruefe("die Vermutung überlebt", spur.vermutung === "Das gehört hier nicht her.");
  pruefe("die Fernwirkung überlebt", spur.fernwirkung === true);
  pruefe("die Bedeutung überlebt", spur.bedeutung === "Gehört Herrn Hut");
  pruefe("und die falsche Fährte", spur.fuehrtInDieIrre === false);

  // Ältere Akten kennen die neuen Felder nicht - sie müssen trotzdem durch.
  const ohne = CaseFileSchema.safeParse({
    ...fall,
    spuren: [{ itemId: "lupe", ortId: "venedig-0", bedeutung: "x", zeigtAufCharakterId: "hut", fuehrtInDieIrre: false }],
  });
  pruefe("ältere Akten bleiben gültig", ohne.success);
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
