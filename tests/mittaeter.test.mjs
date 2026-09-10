/**
 * Zwei Täter, eine Tat.
 *
 * Das Heikle daran ist die Lösbarkeit: Bisher galt "die meisten Spuren zeigen
 * auf den Täter" - bei zweien muss das Paar zusammen vorn liegen, sonst
 * bestraft der Fall genau das richtige Kombinieren. Und beschuldigen muss man
 * nur einen von beiden.
 */
import { abdrueckeAmTatort } from "../lib/abdruecke.ts";
import { waehleMittaeter } from "../lib/daemonEnthuellung.ts";
import { pruefeLoesbarkeit, repariereFall } from "../lib/fallReparieren.ts";
import { buildAccusePrompt, buildTalkPrompt, mittaeterRegeln } from "../lib/prompts.ts";
import { CaseFileSchema, EinstellungenSchema, SagaVorgabenSchema } from "../lib/schemas.ts";
import {
  STANDARD_SAGA_VORGABEN,
  mittaeterFuerKapitel,
  daemonFuerKapitel,
} from "../lib/sagaTypen.ts";
import { MITTAETER_HAEUFIGKEITEN, STANDARD_EINSTELLUNGEN } from "../lib/types.ts";

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
const nala = tier("nala", "Nala");
const hut = tier("hut", "Herr Hut");
const bo = tier("bo", "Bo");
const schatten = tier("schatten", "Der Schatten", { istDaemon: true });
const besetzung = [wimpy, nala, hut, bo];

const spur = (itemId, zeigtAuf, extra = {}) => ({
  itemId, ortId: "o1", beobachtung: "b", vermutung: "", bedeutung: "x",
  zeigtAufCharakterId: zeigtAuf, fuehrtInDieIrre: false, ...extra,
});
const eintrag = (id) => ({
  charakterId: id, aufenthaltsort: "o1", alibi: "a", geheimnis: "g", alibiIstGelogen: false,
});

console.log("\n1. Der Wurf für einen zweiten Täter");
{
  const immer = () => 0;
  const nie = () => 0.99;
  const verdaechtige = [nala, hut, bo];

  pruefe("bei „aus“ passiert nichts", waehleMittaeter(verdaechtige, "aus", "nala", immer) === null);
  pruefe("bei „immer“ kommt einer", Boolean(waehleMittaeter(verdaechtige, "immer", "nala", immer)));
  pruefe("der Wurf entscheidet", waehleMittaeter(verdaechtige, "selten", "nala", nie) === null);
  pruefe(
    "der Täter selbst nie",
    waehleMittaeter(verdaechtige, "immer", "nala", immer)?.id !== "nala",
  );
  pruefe(
    "eine Dämonenform nie",
    waehleMittaeter([nala, hut, schatten], "immer", "nala", () => 0.99999)?.id !== "schatten",
  );
  pruefe(
    "bei nur zwei Verdächtigen nicht - sonst wären alle schuldig",
    waehleMittaeter([nala, hut], "immer", "nala", immer) === null,
  );
  pruefe("vier Stufen zur Wahl", MITTAETER_HAEUFIGKEITEN.length === 4);
  pruefe("die Voreinstellung ist aus", STANDARD_EINSTELLUNGEN.mittaeter === "aus");
}

console.log("\n2. Lösbar bleibt lösbar");
{
  // Zwei Spuren auf den einen Täter, zwei auf den anderen, drei auf einen
  // Dritten: Als Einzeltäter läge der Dritte vorn und der Fall wäre nicht zu
  // entscheiden - als Paar liegen die beiden mit vier zu drei vorn.
  const spuren = [
    spur("a", "nala"), spur("b", "nala"), spur("c", "hut"), spur("g", "hut"),
    spur("d", "bo"), spur("e", "bo"), spur("f", "bo"),
  ];

  const alleine = repariereFall({
    spuren, verdaechtige: [eintrag("nala"), eintrag("hut"), eintrag("bo")],
    besetzung, taeterId: "nala", ortIds: ["o1"], itemIds: ["a","b","c","d","e","f","g"],
  });
  pruefe(
    "als Einzeltäter wird gestrichen, bis er vorn liegt",
    alleine.aenderungen.some((a) => a.includes("gestrichen")),
  );

  const zuZweit = repariereFall({
    spuren, verdaechtige: [eintrag("nala"), eintrag("hut"), eintrag("bo")],
    besetzung, taeterId: "nala", mittaeterId: "hut",
    ortIds: ["o1"], itemIds: ["a","b","c","d","e","f","g"],
  });
  pruefe("zu zweit ist der Fall in Ordnung", zuZweit.fehler === null);
  pruefe("und nichts wird gestrichen", zuZweit.spuren.length === 7, String(zuZweit.spuren.length));

  // Eine falsche Fährte auf den Mittäter ist derselbe Widerspruch wie beim Täter.
  const irre = repariereFall({
    spuren: [spur("a", "nala"), spur("b", "hut", { fuehrtInDieIrre: true }), spur("c", "bo")],
    verdaechtige: [eintrag("nala"), eintrag("hut"), eintrag("bo")],
    besetzung, taeterId: "nala", mittaeterId: "hut", ortIds: ["o1"], itemIds: ["a","b","c"],
  });
  pruefe(
    "eine falsche Fährte auf den Mittäter wird echt",
    irre.spuren.find((s) => s.itemId === "b")?.fuehrtInDieIrre === false,
  );

  // Zeigt nur auf den Mittäter etwas, ist der Fall trotzdem lösbar.
  const nurZweiter = repariereFall({
    spuren: [spur("a", "hut"), spur("b", "hut"), spur("c", "bo")],
    verdaechtige: [eintrag("nala"), eintrag("hut"), eintrag("bo")],
    besetzung, taeterId: "nala", mittaeterId: "hut", ortIds: ["o1"], itemIds: ["a","b","c"],
  });
  pruefe("Spuren auf den Zweiten reichen", nurZweiter.fehler === null);

  // Die reine Prüfung sieht es genauso.
  pruefe(
    "die Prüfung meldet bei zweien nichts",
    pruefeLoesbarkeit({ spuren, besetzung, taeterId: "nala", mittaeterId: "hut" }).length === 0,
  );
  pruefe(
    "bei einem Täter dagegen schon",
    pruefeLoesbarkeit({ spuren, besetzung, taeterId: "nala" }).length > 0,
  );
}

console.log("\n3. Das Fingerabdruckset bleibt so viel wert wie vorher");
{
  const fall = {
    taeterId: "nala", mittaeterId: "hut", tatort: "o1",
    verdaechtige: [
      { charakterId: "nala", aufenthaltsort: "o1" },
      { charakterId: "hut", aufenthaltsort: "o1" },
      { charakterId: "bo", aufenthaltsort: "o1" },
    ],
  };
  const ids = abdrueckeAmTatort(fall, () => 0.1);
  pruefe("zwei Namen", ids.length === 2);
  pruefe("nicht beide Täter", !(ids.includes("nala") && ids.includes("hut")));
  pruefe("aber einer davon", ids.includes("nala") || ids.includes("hut"));
  pruefe("und ein Unschuldiger", ids.includes("bo"));

  // Über viele Würfe kommen beide Täter vor.
  const gesehen = new Set();
  for (let i = 0; i < 40; i++) {
    for (const id of abdrueckeAmTatort(fall, Math.random)) gesehen.add(id);
  }
  pruefe("mal der eine, mal der andere", gesehen.has("nala") && gesehen.has("hut"));
}

console.log("\n4. Was das Modell erfährt");
{
  const r = mittaeterRegeln("Nala", "Herr Hut");
  pruefe("es ist eine Tat", r.includes("Es ist EINE Tat"));
  pruefe("kein Täter und kein Helfer", r.includes("kein Täter und kein Helfer"));
  pruefe("beide lügen", r.includes("Beide lügen"));
  pruefe("die Alibis stützen sich", r.includes("stützen sich gegenseitig"));
  pruefe("jeder deckt zuerst den anderen", r.includes("deckt jeder zuerst den anderen"));
  pruefe("die Spuren zeigen auf beide", r.includes("zeigen auf beide"));

  const fall = {
    id: "f", besetzung, items: [{ id: "a", name: "A", beschreibung: "", bild: "" }],
    ton: "kindgerecht", reifegrad: "kindgerecht", absurditaet: "verspielt",
    stadt: "V", orte: [{ id: "o1", stadt: "V", stadtId: "v", name: "O", atmosphaere: "", beschreibung: "", bild: "" }],
    introText: "", schlagworte: [], titel: "T", tatbeschreibung: "t", tatort: "o1",
    taeterId: "nala", mittaeterId: "hut", motiv: "m", tathergang: "h",
    verdaechtige: [eintrag("nala"), eintrag("hut"), eintrag("bo")],
    spuren: [], erstelltAm: 1,
  };

  // Im Gespräch: Beide sind Täter, beide decken den anderen.
  const alsTaeter = buildTalkPrompt({
    fall, charakterId: "hut", ortId: "o1", modus: "befragen",
    nachricht: "Wo waren Sie?", verlauf: [], gefundeneSpuren: [],
  });
  pruefe("auch der Zweite weiß, dass er es war", alsTaeter.includes("DU BIST DER TÄTER"));
  pruefe("und dass er zu zweit war", alsTaeter.includes("IHR WART ZU ZWEIT"));
  pruefe("mit dem Namen des anderen", alsTaeter.includes("Nala war dabei"));

  const unschuldig = buildTalkPrompt({
    fall, charakterId: "bo", ortId: "o1", modus: "reden",
    nachricht: "Hallo", verlauf: [], gefundeneSpuren: [],
  });
  pruefe("ein Unschuldiger erfährt nichts davon", !unschuldig.includes("IHR WART ZU ZWEIT"));

  // Bei der Beschuldigung zählt jeder von beiden.
  const ersten = buildAccusePrompt({ fall, charakterId: "nala", begruendung: "", gefundeneSpuren: [] });
  const zweiten = buildAccusePrompt({ fall, charakterId: "hut", begruendung: "", gefundeneSpuren: [] });
  pruefe("den Ersten zu benennen ist richtig", ersten.includes("damit RICHTIG"));
  pruefe("den Zweiten auch", zweiten.includes("damit RICHTIG"));
  pruefe("beide stehen in der Akte", ersten.includes("Herr Hut [hut] war dabei"));
  pruefe("die Auflösung nennt beide", ersten.includes("ZWEI TÄTER: Die Auflösung nennt beide"));

  const falsch = buildAccusePrompt({ fall, charakterId: "bo", begruendung: "", gefundeneSpuren: [] });
  pruefe("ein Dritter bleibt falsch", falsch.includes("damit FALSCH"));
}

console.log("\n5. Vorgaben und Schemata");
{
  const vorgaben = {
    ...STANDARD_SAGA_VORGABEN,
    kapitelMittaeter: ["hut", "", "bo"],
    kapitelDaemon: ["", "schatten", ""],
  };
  pruefe("der Mittäter je Kapitel", mittaeterFuerKapitel(vorgaben, 1) === "hut");
  pruefe("Lücken bleiben leer", mittaeterFuerKapitel(vorgaben, 2) === "");
  pruefe("auch spätere Kapitel", mittaeterFuerKapitel(vorgaben, 3) === "bo");
  pruefe("die Gestalt je Kapitel", daemonFuerKapitel(vorgaben, 2) === "schatten");
  pruefe("das Finale hat keine", daemonFuerKapitel(vorgaben, 0) === "");
  pruefe("ohne Eintrag nichts", daemonFuerKapitel(STANDARD_SAGA_VORGABEN, 1) === "");

  const gelesen = SagaVorgabenSchema.safeParse(vorgaben);
  pruefe("die Vorgaben kommen durch", gelesen.success);
  pruefe(
    "mit beiden Reihen",
    gelesen.success &&
      gelesen.data.kapitelMittaeter[0] === "hut" &&
      gelesen.data.kapitelDaemon[1] === "schatten",
  );
  pruefe(
    "ältere Sagas ohne die Felder bleiben gültig",
    SagaVorgabenSchema.safeParse({
      ...STANDARD_SAGA_VORGABEN,
      kapitelMittaeter: undefined,
      kapitelDaemon: undefined,
    }).success,
  );

  const e = EinstellungenSchema.safeParse({ ...STANDARD_EINSTELLUNGEN, mittaeter: "manchmal" });
  pruefe("die Einstellung kommt durch", e.success && e.data.mittaeter === "manchmal");

  const akte = CaseFileSchema.safeParse({
    id: "f", besetzung, items: [{ id: "a", name: "A", beschreibung: "", bild: "" }],
    ton: "kindgerecht", stadt: "V",
    orte: [
      { id: "o1", stadt: "V", stadtId: "v", name: "O", atmosphaere: "", beschreibung: "", bild: "" },
      { id: "o2", stadt: "V", stadtId: "v", name: "P", atmosphaere: "", beschreibung: "", bild: "" },
    ],
    introText: "", schlagworte: [], titel: "T", tatbeschreibung: "t", tatort: "o1",
    taeterId: "nala", mittaeterId: "hut", motiv: "m", tathergang: "h",
    verdaechtige: [eintrag("nala")], spuren: [], erstelltAm: 1,
  });
  pruefe("der zweite Täter überlebt das Speichern", akte.success && akte.data.mittaeterId === "hut");
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
