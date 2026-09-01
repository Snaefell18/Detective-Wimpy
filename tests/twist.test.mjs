/**
 * Der Twist: Der Drahtzieher darf in keinem Kapitel auftauchen - und im
 * Finale muss er da sein. Ohne Twist ändert sich nichts.
 */
import { besetzungFuerKapitel } from "../lib/sagaTypen.ts";
import { repariereFall } from "../lib/fallReparieren.ts";

const alle = [
  { id: "wimpy", name: "Wimpy", istDetektiv: true },
  { id: "boss", name: "Boss", istDetektiv: false },
  { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  { id: "nala", name: "Nala", istDetektiv: false },
  { id: "fanny", name: "Fanny", istDetektiv: false },
];

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};
const ids = (liste) => liste.map((c) => c.id).join(",");

console.log("\n1. Mit Twist");
for (const kapitel of [1, 2, 3]) {
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel, twist: true });
  pruefe(`Kapitel ${kapitel}: der Drahtzieher fehlt`, !b.some((c) => c.id === "boss"), ids(b));
  pruefe(`Kapitel ${kapitel}: Wimpy ist dabei`, b.some((c) => c.istDetektiv));
  pruefe(`Kapitel ${kapitel}: genug Verdächtige`, b.filter((c) => !c.istDetektiv).length >= 2);
}
{
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 0, twist: true });
  pruefe("Finale: der Drahtzieher ist da", b.some((c) => c.id === "boss"), ids(b));
}

console.log("\n2. Ohne Twist bleibt alles wie bisher");
for (const kapitel of [0, 1, 2]) {
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel, twist: false });
  pruefe(`Kapitel ${kapitel}: vollständige Besetzung`, b.length === alle.length, ids(b));
}

console.log("\n3. Spielbarkeit hat Vorrang: zu kleine Besetzung");
{
  const klein = [
    { id: "wimpy", name: "Wimpy", istDetektiv: true },
    { id: "boss", name: "Boss", istDetektiv: false },
    { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  ];
  const b = besetzungFuerKapitel({ besetzung: klein, drahtzieherId: "boss", kapitel: 1, twist: true });
  pruefe("bleibt vollständig, statt unspielbar zu werden", b.length === 3, ids(b));
}

console.log("\n4. Ein Kapitelfall bleibt lösbar, obwohl der Drahtzieher fehlt");
{
  const besetzung = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 1, twist: true });
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv).map((c, i) => ({
    charakterId: c.id, aufenthaltsort: `o${i + 1}`, alibi: "a", geheimnis: "g", alibiIstGelogen: false,
  }));
  const spur = (itemId, wer, irre = false) => ({
    itemId, ortId: "o1", beobachtung: "x", vermutung: "", bedeutung: "y",
    zeigtAufCharakterId: wer, fuehrtInDieIrre: irre,
  });
  const e = repariereFall({
    // Das Modell darf hier gar nicht mehr auf den Drahtzieher zeigen -
    // täte es das doch, muss die Spur verschwinden.
    spuren: [spur("kamera", "mikkeli"), spur("schal", "mikkeli"), spur("brief", "nala", true), spur("kerze", "boss", true)],
    verdaechtige, besetzung, taeterId: "mikkeli",
    ortIds: ["o1", "o2", "o3"], itemIds: ["kamera", "schal", "brief", "kerze"],
  });
  pruefe("Fall wird ausgeliefert", e.fehler === null, e.fehler ?? "");
  pruefe("keine Spur zeigt auf den abwesenden Drahtzieher",
    e.spuren.every((s) => s.zeigtAufCharakterId !== "boss"));
  pruefe("der Kapiteltäter trägt den stärksten Verdacht",
    e.spuren.filter((s) => s.zeigtAufCharakterId === "mikkeli").length >
      e.spuren.filter((s) => s.zeigtAufCharakterId === "nala").length);
}

console.log(`\n${fehlgeschlagen === 0 ? "Alles sauber." : `${fehlgeschlagen} fehlgeschlagen.`}`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
