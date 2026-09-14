import {
  repariereFall,
  verteilungMangel,
  ZIEL_EINZELFALL,
  ZIEL_KAPITEL,
} from "../lib/fallReparieren.ts";
import { sichereSpuren } from "../lib/spurenRettung.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, istDetektiv = false) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 6, stats: {}, beschreibung: "",
  bild: "", istDetektiv,
});
const besetzung = [
  tier("wimpy", "Wimpy", true),
  tier("boss", "Boss"),
  tier("nala", "Nala"),
  tier("hut", "Herr Hut"),
];
const orte = Array.from({ length: 5 }, (_, i) => ({
  id: `ort-${i + 1}`, name: `Ort ${i + 1}`, stadt: "Nord", stadtId: "nord",
  atmosphaere: "kalt", beschreibung: "", bild: "",
}));
const items = [
  { id: "eigen", name: "Eigenes Stück", beschreibung: "", bild: "" },
];

const pruefeRettung = (rettung, ziel, mittaeterId) =>
  rettung && repariereFall({
    spuren: rettung.spuren,
    verdaechtige: besetzung.filter((c) => !c.istDetektiv).map((c, i) => ({
      charakterId: c.id,
      aufenthaltsort: orte[i].id,
      alibi: "Alibi",
      geheimnis: "Geheimnis",
      alibiIstGelogen: c.id === "boss",
    })),
    besetzung,
    taeterId: "boss",
    mittaeterId,
    ortIds: orte.map((o) => o.id),
    itemIds: rettung.items.map((i) => i.id),
  });

console.log("\n1. Ein normaler Fall wird ohne zweiten Modellaufruf gerettet");
const normal = sichereSpuren({
  items, orte, besetzung, taeterId: "boss", ziel: ZIEL_EINZELFALL,
});
const normalGeprueft = pruefeRettung(normal, ZIEL_EINZELFALL);
pruefe("genügend Spuren", normal?.spuren.length >= ZIEL_EINZELFALL.min);
pruefe("fehlende Projektstücke werden ergänzt", (normal?.items.length ?? 0) >= ZIEL_EINZELFALL.min);
pruefe("der eigene Gegenstand bleibt vorn", normal?.items[0].id === "eigen");
pruefe("jede Spur hat einen anderen Gegenstand", new Set(normal?.spuren.map((s) => s.itemId)).size === normal?.spuren.length);
pruefe("der Fall bleibt eindeutig lösbar", normalGeprueft?.fehler === null, normalGeprueft?.fehler ?? "");
pruefe("die Orte sind brauchbar verteilt", verteilungMangel(normal?.spuren ?? [], orte.map((o) => o.id)) === null);

console.log("\n2. Eine Saga bekommt garantiert ihr Beweisstück für später");
const saga = sichereSpuren({
  items,
  orte,
  besetzung,
  taeterId: "boss",
  ziel: ZIEL_KAPITEL,
  sagaSpur: {
    drahtzieherId: "unsichtbar",
    drahtzieherName: "Der Schatten",
    enthuellung: "Die gleiche Uhrzeit taucht wieder auf.",
    vorGericht: true,
    falscheFaehrteName: "",
  },
});
const sagaGeprueft = pruefeRettung(saga, ZIEL_KAPITEL);
pruefe("Kapitelmenge stimmt", saga?.spuren.length >= ZIEL_KAPITEL.min);
pruefe("genau eine Fernwirkung", saga?.spuren.filter((s) => s.fernwirkung).length === 1);
pruefe("der spätere Zusammenhang steht nur in der Bedeutung", saga?.spuren.some((s) => s.bedeutung.includes("Schatten")));
pruefe("auch das Kapitel bleibt lösbar", sagaGeprueft?.fehler === null, sagaGeprueft?.fehler ?? "");

console.log("\n3. Auch zwei Täter und kaputte Grunddaten sind beherrscht");
const zuZweit = sichereSpuren({
  items, orte, besetzung, taeterId: "boss", mittaeterId: "nala", ziel: ZIEL_EINZELFALL,
});
const zuZweitGeprueft = pruefeRettung(zuZweit, ZIEL_EINZELFALL, "nala");
pruefe("beide Täter bekommen eine echte Spur", ["boss", "nala"].every((id) => zuZweit?.spuren.some((s) => s.zeigtAufCharakterId === id && !s.fuehrtInDieIrre)));
pruefe("der gemeinsame Fall ist lösbar", zuZweitGeprueft?.fehler === null, zuZweitGeprueft?.fehler ?? "");
pruefe("ohne Orte wird sauber abgelehnt", sichereSpuren({ items, orte: [], besetzung, taeterId: "boss", ziel: ZIEL_EINZELFALL }) === null);
pruefe("ohne bekannten Täter ebenso", sichereSpuren({ items, orte, besetzung, taeterId: "niemand", ziel: ZIEL_EINZELFALL }) === null);

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
