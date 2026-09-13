import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { pruefeVorgaben } from "../lib/sagaPruefung.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { fluchtStatement, verfolgungNach } from "../lib/verfolgung.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const jagd = {
  id: "jagd-1",
  nachKapitel: 1,
  name: "Die weiße Spur",
  fliehenderId: "boss",
  verfolger: [
    { charakterId: "nala", modell: "schaf" },
    { charakterId: "hut", modell: "yeti" },
  ],
  musik: "/audio/jagd.mp3",
  fluchtgrund: "ich den Schlüssel im Schnee verstecken musste.",
  statement: "",
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5, stats: {}, beschreibung: "", bild: "",
  istDetektiv: false, ...extra,
});
const charaktere = [
  tier("wimpy", "Wimpy", { istDetektiv: true }),
  tier("boss", "Boss"), tier("nala", "Nala"), tier("hut", "Herr Hut"), tier("oeho", "Öhö"),
];
const orte = ["nord", "sued"].flatMap((stadt) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${stadt}-${i}`, stadt, stadtId: stadt, name: `Ort ${i}`,
    atmosphaere: "", beschreibung: "", bild: "",
  })),
);
const probleme = (teil) => pruefeVorgaben({
  vorgaben: { ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 3, ...teil },
  charaktere,
  orte,
});

console.log("\n1. Die Jagd sitzt genau in einer Kapitellücke");
pruefe("nach Kapitel 1 gefunden", verfolgungNach({ verfolgungsjagden: [jagd] }, 1)?.id === "jagd-1");
pruefe("nach Kapitel 2 ist nichts", verfolgungNach({ verfolgungsjagden: [jagd] }, 2) === null);
pruefe("alte Saga bleibt leer und gültig", SagaVorgabenSchema.safeParse({
  ...STANDARD_SAGA_VORGABEN,
  verfolgungsjagden: undefined,
}).data?.verfolgungsjagden.length === 0);

console.log("\n2. Besetzung und Modelle sind eindeutig");
const gut = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, verfolgungsjagden: [jagd] });
pruefe("vollständige Jagd geht durchs Schema", gut.success, gut.error?.issues[0]?.message);
pruefe("gewählter Jagdsong bleibt erhalten", gut.data?.verfolgungsjagden[0]?.musik === "/audio/jagd.mp3");
pruefe("drei verschiedene Tiere sind spielbar", probleme({ verfolgungsjagden: [jagd] }).length === 0, probleme({ verfolgungsjagden: [jagd] })[0]);
pruefe("derselbe Flüchtende und Verfolger fällt auf", probleme({
  verfolgungsjagden: [{ ...jagd, verfolger: [{ ...jagd.verfolger[0], charakterId: "boss" }, jagd.verfolger[1]] }],
}).some((p) => p.includes("drei verschiedene Tiere")));
pruefe("zweimal dasselbe Modell fällt auf", probleme({
  verfolgungsjagden: [{ ...jagd, verfolger: [jagd.verfolger[0], { ...jagd.verfolger[1], modell: "schaf" }] }],
}).some((p) => p.includes("verschiedene 3D-Modelle")));
pruefe("Versammlung und Jagd teilen sich keine Lücke", probleme({
  verfolgungsjagden: [jagd],
  versammlungen: [{
    id: "rat-1", nachKapitel: 1, name: "Rat", anlass: "Anlass", thema: "Thema",
    vorsitzId: "nala", teilnehmerIds: ["nala", "hut"], beobachterIds: [], undercoverId: "",
  }],
}).some((p) => p.includes("nur ein Zwischenereignis")));

console.log("\n3. Nach dem Fang gibt es immer ein Statement");
pruefe("eigener Satz gewinnt", fluchtStatement({ ...jagd, statement: "Ich hatte keine Wahl." }) === "Ich hatte keine Wahl.");
pruefe("Fluchtgrund wird zu wörtlicher Rede", fluchtStatement(jagd).includes("Schlüssel im Schnee"));
pruefe("auch ganz leer bleibt es nicht stumm", fluchtStatement({ ...jagd, fluchtgrund: "" }).length > 20);

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
