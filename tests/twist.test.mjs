/**
 * Der Twist: Der Drahtzieher darf in keinem Kapitel auftauchen - und im
 * Finale muss er da sein. Ohne Twist ändert sich nichts.
 */
import {
  besetzungFuerKapitel,
  besetzungFuerSaga,
  kapitelTaeterFuer,
  neuInKapitel,
} from "../lib/sagaTypen.ts";
import { repariereFall } from "../lib/fallReparieren.ts";

const alle = [
  { id: "wimpy", name: "Wimpy", istDetektiv: true },
  { id: "boss", name: "Boss", istDetektiv: false },
  { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  { id: "nala", name: "Nala", istDetektiv: false },
  { id: "fanny", name: "Fanny", istDetektiv: false },
];

/** Kurzform für die Vorgaben, die diese Funktionen brauchen. */
const v = (teil) => ({ twist: false, neuzugaenge: {}, kapitelAnzahl: 3, ...teil });

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};
const ids = (liste) => liste.map((c) => c.id).join(",");

console.log("\n1. Mit Twist");
for (const kapitel of [1, 2, 3]) {
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel, vorgaben: v({ twist: true }) });
  pruefe(`Kapitel ${kapitel}: der Drahtzieher fehlt`, !b.some((c) => c.id === "boss"), ids(b));
  pruefe(`Kapitel ${kapitel}: Wimpy ist dabei`, b.some((c) => c.istDetektiv));
  pruefe(`Kapitel ${kapitel}: genug Verdächtige`, b.filter((c) => !c.istDetektiv).length >= 2);
}
{
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 0, vorgaben: v({ twist: true }) });
  pruefe("Finale: der Drahtzieher ist da", b.some((c) => c.id === "boss"), ids(b));
}

console.log("\n2. Ohne Twist bleibt alles wie bisher");
for (const kapitel of [0, 1, 2]) {
  const b = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel, vorgaben: v({}) });
  pruefe(`Kapitel ${kapitel}: vollständige Besetzung`, b.length === alle.length, ids(b));
}

console.log("\n3. Spielbarkeit hat Vorrang: zu kleine Besetzung");
{
  const klein = [
    { id: "wimpy", name: "Wimpy", istDetektiv: true },
    { id: "boss", name: "Boss", istDetektiv: false },
    { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  ];
  const b = besetzungFuerKapitel({ besetzung: klein, drahtzieherId: "boss", kapitel: 1, vorgaben: v({ twist: true }) });
  pruefe("bleibt vollständig, statt unspielbar zu werden", b.length === 3, ids(b));
}

console.log("\n4. Ein Kapitelfall bleibt lösbar, obwohl der Drahtzieher fehlt");
{
  const besetzung = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 1, vorgaben: v({ twist: true }) });
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

console.log("\n5. Auftritte: wer später dazustößt, bleibt bis zum Ende");
{
  const vorgaben = v({ neuzugaenge: { fanny: 3 } });
  const dabei = (k) => besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: k, vorgaben });
  pruefe("Kapitel 1: Fanny fehlt", !dabei(1).some((c) => c.id === "fanny"), ids(dabei(1)));
  pruefe("Kapitel 2: Fanny fehlt", !dabei(2).some((c) => c.id === "fanny"), ids(dabei(2)));
  pruefe("Kapitel 3: Fanny ist da", dabei(3).some((c) => c.id === "fanny"), ids(dabei(3)));
  pruefe("Finale: Fanny ist da", dabei(0).some((c) => c.id === "fanny"), ids(dabei(0)));
  const neu = neuInKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 3, vorgaben });
  pruefe("Kapitel 3 meldet Fanny als neu", ids(neu) === "fanny", ids(neu));
}

console.log("\n6. Auch der Schuldige kann später einsteigen");
{
  const vorgaben = v({ neuzugaenge: { boss: 2 } });
  const dabei = (k) => besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: k, vorgaben });
  pruefe("Kapitel 1: der Drahtzieher fehlt", !dabei(1).some((c) => c.id === "boss"), ids(dabei(1)));
  pruefe("Kapitel 2: der Drahtzieher ist da", dabei(2).some((c) => c.id === "boss"), ids(dabei(2)));
  pruefe("und bleibt in Kapitel 3", dabei(3).some((c) => c.id === "boss"));
}

console.log("\n7. Nur der Schuldige stößt im Finale dazu");
{
  const vorgaben = v({ twist: true });
  const neu = neuInKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 0, vorgaben });
  pruefe("genau einer ist neu", ids(neu) === "boss", ids(neu));
}

console.log("\n8. Mehrere stoßen erst im Finale dazu");
{
  const gross = [
    ...alle,
    { id: "bruno", name: "Bruno", istDetektiv: false },
    { id: "pippa", name: "Pippa", istDetektiv: false },
  ];
  const vorgaben = v({ twist: true, neuzugaenge: { fanny: 4, nala: 4 } });
  const neu = neuInKapitel({ besetzung: gross, drahtzieherId: "boss", kapitel: 0, vorgaben });
  pruefe("drei Neuzugänge im Finale", neu.length === 3, ids(neu));
  const k1 = besetzungFuerKapitel({ besetzung: gross, drahtzieherId: "boss", kapitel: 1, vorgaben });
  pruefe("in den Kapiteln bleiben die anderen", ids(k1) === "wimpy,mikkeli,bruno,pippa", ids(k1));
}

console.log("\n8b. Zu viele auf einmal: die Kapitel bleiben spielbar");
{
  // Vier Verdächtige, drei davon erst im Finale - das geht nicht auf.
  const vorgaben = v({ twist: true, neuzugaenge: { fanny: 4, nala: 4 } });
  const k1 = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 1, vorgaben });
  pruefe("mindestens zwei Verdächtige", k1.filter((c) => !c.istDetektiv).length >= 2, ids(k1));
  pruefe("und der Drahtzieher bleibt trotzdem draußen",
    !k1.some((c) => c.id === "boss"), ids(k1));
}

console.log("\n9. Der Twist sticht die Auftrittswahl");
{
  const vorgaben = v({ twist: true, neuzugaenge: { boss: 1 } });
  const k1 = besetzungFuerKapitel({ besetzung: alle, drahtzieherId: "boss", kapitel: 1, vorgaben });
  pruefe("trotz „von Anfang an“ nicht dabei", !k1.some((c) => c.id === "boss"), ids(k1));
}

console.log("\n10. Der Drahtzieher ist immer in der Besetzung");
{
  const ids = (liste) => liste.map((c) => c.id).join(",");
  // Genau der Fall aus dem Spiel: Drahtzieher gewählt, aber nicht angehakt.
  const ohneIhn = besetzungFuerSaga(alle, {
    charaktere: ["mikkeli", "nala", "fanny"],
    drahtzieherId: "boss",
  });
  pruefe("er rückt nach", ohneIhn.some((c) => c.id === "boss"), ids(ohneIhn));
  pruefe("die gewählten bleiben", ["mikkeli", "nala", "fanny"].every((id) => ohneIhn.some((c) => c.id === id)));
  pruefe("Wimpy ist dabei", ohneIhn.some((c) => c.istDetektiv));

  const mitIhm = besetzungFuerSaga(alle, {
    charaktere: ["boss", "nala"],
    drahtzieherId: "boss",
  });
  pruefe("zu wenige Verdächtige: alle spielen mit", mitIhm.length === alle.length, ids(mitIhm));

  const ohneWahl = besetzungFuerSaga(alle, { charaktere: [], drahtzieherId: "boss" });
  pruefe("keine Wahl: alle spielen mit", ohneWahl.length === alle.length);

  const ohneDrahtzieher = besetzungFuerSaga(alle, {
    charaktere: ["mikkeli", "nala", "fanny"],
    drahtzieherId: "",
  });
  pruefe(
    "ohne gesetzten Drahtzieher bleibt die Auswahl",
    !ohneDrahtzieher.some((c) => c.id === "boss"),
    ids(ohneDrahtzieher),
  );
}

console.log("\n11. Täter je Kapitel");
{
  const moeglich = [{ id: "mikkeli" }, { id: "nala" }, { id: "fanny" }];
  const nimm = (wunsch, vorschlag, nummer = 1) =>
    kapitelTaeterFuer({ moeglich, wunsch, vorschlag, nummer });

  pruefe("gesetzter Täter gewinnt", nimm("fanny", "nala") === "fanny");
  pruefe("ohne Wunsch zählt der Vorschlag", nimm("", "nala") === "nala");
  pruefe("unbekannter Wunsch fällt auf den Vorschlag zurück",
    nimm("gibtsnicht", "nala") === "nala");
  pruefe("gar nichts Gültiges: reihum, aber immer jemand Mögliches",
    moeglich.some((c) => c.id === nimm("", "")), nimm("", ""));
  pruefe("reihum wechselt mit der Kapitelnummer",
    nimm("", "", 1) !== nimm("", "", 2));

  // Ein Tier, das im Kapitel gar nicht auftritt, steht nicht in moeglich -
  // der Wunsch darf den Fall dann nicht kapern.
  pruefe("abwesendes Wunschtier wird ignoriert",
    nimm("boss", "mikkeli") === "mikkeli");
}

console.log(`\n${fehlgeschlagen === 0 ? "Alles sauber." : `${fehlgeschlagen} fehlgeschlagen.`}`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
