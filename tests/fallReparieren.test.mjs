/**
 * Prüft den Spielmechanismus: Kommt ein Fall durch, ist der Täter über die
 * Spuren eindeutig zu bestimmen - und keine falsche Fährte kann ihn schlagen.
 *
 * Läuft ohne Modell und ohne Server: `npx tsx tests/fallReparieren.test.mjs`
 */
import { repariereFall, pruefeLoesbarkeit } from "../lib/fallReparieren.ts";

const besetzung = [
  { id: "wimpy", name: "Wimpy", istDetektiv: true },
  { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  { id: "nala", name: "Nala", istDetektiv: false },
  { id: "fanny", name: "Fanny", istDetektiv: false },
];
const ortIds = ["o1", "o2", "o3"];
const itemIds = ["kamera", "schal", "brief", "schluessel", "kerze", "muenze"];
const verdaechtige = [
  { charakterId: "mikkeli", aufenthaltsort: "o1", alibi: "a", geheimnis: "g", alibiIstGelogen: false },
  { charakterId: "nala", aufenthaltsort: "o2", alibi: "a", geheimnis: "g", alibiIstGelogen: false },
  { charakterId: "fanny", aufenthaltsort: "o3", alibi: "a", geheimnis: "g", alibiIstGelogen: false },
];

const spur = (itemId, wer, irre = false, extra = {}) => ({
  itemId, ortId: "o1", beobachtung: `Beobachtung zu ${itemId}.`,
  vermutung: "", bedeutung: `Bedeutung zu ${itemId}.`,
  zeigtAufCharakterId: wer, fuehrtInDieIrre: irre, ...extra,
});

const kur = (spuren, taeterId = "mikkeli") =>
  repariereFall({ spuren, verdaechtige, besetzung, taeterId, ortIds, itemIds });

let gelaufen = 0, fehlgeschlagen = 0;
function pruefe(name, bedingung, zusatz = "") {
  gelaufen++;
  if (bedingung) return;
  fehlgeschlagen++;
  console.log(`  FEHLGESCHLAGEN: ${name}${zusatz ? ` - ${zusatz}` : ""}`);
}

/** Die Zusicherungen, die für jeden ausgelieferten Fall gelten müssen. */
function pruefeVertrag(name, ergebnis, taeterId = "mikkeli") {
  if (ergebnis.fehler) return; // Verworfene Fälle gehen gar nicht erst raus.
  const { spuren } = ergebnis;
  const zaehler = {};
  for (const s of spuren) zaehler[s.zeigtAufCharakterId] = (zaehler[s.zeigtAufCharakterId] ?? 0) + 1;
  const taeterZahl = zaehler[taeterId] ?? 0;
  const rivalen = Object.entries(zaehler).filter(([id]) => id !== taeterId).map(([, n]) => n);
  const groesster = rivalen.length ? Math.max(...rivalen) : 0;

  pruefe(`${name}: mindestens eine Spur`, spuren.length > 0);
  pruefe(`${name}: kein Gegenstand doppelt`,
    new Set(spuren.map((s) => s.itemId)).size === spuren.length);
  pruefe(`${name}: alle Gegenstände gehören zum Fall`,
    spuren.every((s) => itemIds.includes(s.itemId)));
  pruefe(`${name}: alle Orte gültig`, spuren.every((s) => ortIds.includes(s.ortId)));
  pruefe(`${name}: zeigt nie auf den Detektiv`,
    spuren.every((s) => s.zeigtAufCharakterId !== "wimpy"));
  pruefe(`${name}: keine falsche Fährte auf den Täter`,
    spuren.every((s) => !(s.fuehrtInDieIrre && s.zeigtAufCharakterId === taeterId)));
  pruefe(`${name}: Täter trägt den stärksten Verdacht`, taeterZahl > groesster,
    `Täter ${taeterZahl}, stärkster Rivale ${groesster}`);
  pruefe(`${name}: der Täter lügt beim Alibi`,
    ergebnis.verdaechtige.find((v) => v.charakterId === taeterId)?.alibiIstGelogen === true);
  pruefe(`${name}: Nachprüfung findet nichts mehr`,
    pruefeLoesbarkeit({ spuren, besetzung, taeterId }).length === 0,
    pruefeLoesbarkeit({ spuren, besetzung, taeterId }).join(" "));
}

console.log("\n== Einzelfälle ==");

// 1. Sauberer Fall bleibt unangetastet.
{
  const eingabe = [spur("kamera","mikkeli"), spur("schal","mikkeli"), spur("brief","nala",true)];
  const e = kur(eingabe);
  pruefe("sauber: nichts verworfen", e.fehler === null, e.fehler ?? "");
  pruefe("sauber: alle drei Spuren bleiben", e.spuren.length === 3, `${e.spuren.length}`);
  pruefeVertrag("sauber", e);
}

// 2. Zwei Spuren auf demselben Gegenstand - die zweite wäre unauffindbar.
{
  const e = kur([spur("kamera","mikkeli"), spur("kamera","nala",true), spur("schal","mikkeli")]);
  pruefe("doppelt: eine Spur weniger", e.spuren.length === 2, `${e.spuren.length}`);
  pruefeVertrag("doppelt", e);
}

// 3. Falsche Fährte zeigt auf den Täter.
{
  const e = kur([spur("kamera","mikkeli",true), spur("schal","mikkeli"), spur("brief","nala",true)]);
  pruefe("widerspruch: Fährte wurde echt",
    e.spuren.find((s) => s.itemId === "kamera")?.fuehrtInDieIrre === false);
  pruefeVertrag("widerspruch", e);
}

// 4. Spur zeigt auf Wimpy.
{
  const e = kur([spur("kamera","wimpy"), spur("schal","mikkeli"), spur("brief","nala",true)]);
  // Bleibt nur eine Spur übrig, ist der Fall zu dünn und wird verworfen.
  pruefe("detektiv: verworfen oder ohne Wimpy-Spur",
    e.fehler !== null || e.spuren.every((s) => s.zeigtAufCharakterId !== "wimpy"));
  pruefeVertrag("detektiv", e);
}

// 5. Gleichstand: Der Rivale hat genauso viele Spuren wie der Täter.
{
  const e = kur([spur("kamera","mikkeli"), spur("schal","nala",true), spur("brief","nala",true), spur("kerze","mikkeli")]);
  pruefeVertrag("gleichstand", e);
  pruefe("gleichstand: nicht verworfen", e.fehler === null, e.fehler ?? "");
}

// 6. Der Rivale liegt vorn - und alle seine Spuren sind "echt".
{
  const e = kur([spur("kamera","mikkeli"), spur("schal","nala"), spur("brief","nala"), spur("kerze","nala")]);
  pruefeVertrag("rivale vorn", e);
}

// 7. Keine Spur zeigt auf den Täter -> der Entwurf ist verdorben.
{
  const e = kur([spur("kamera","nala",true), spur("schal","fanny",true), spur("brief","fanny",true)]);
  pruefe("täterlos: wird verworfen", e.fehler !== null);
}

// 8. Zu dünn nach der Kur -> lieber neu erzeugen als dünn ausliefern.
{
  const e = kur([spur("kamera","mikkeli"), spur("schal","nala")]);
  pruefe("zu dünn: wird verworfen", e.fehler !== null, JSON.stringify(e.spuren.length));
}

// 9. Ungültige Ids in allen Feldern.
{
  const e = kur([
    spur("gibtsnicht","mikkeli"),
    { ...spur("schal","mikkeli"), ortId: "nirgendwo" },
    spur("brief","erfundenertyp"),
    spur("kerze","mikkeli"),
  ]);
  pruefe("mülleimer: nur Gültiges bleibt", e.spuren.length === 1, `${e.spuren.length}`);
  pruefeVertrag("mülleimer", e);
}

// 10. Gar keine Spuren.
{
  const e = kur([]);
  pruefe("leer: wird verworfen", e.fehler !== null);
}

console.log("\n== Zufallsangriff: 20000 erfundene Modellantworten ==");

let zufall = 12345;
const wuerfel = (n) => {
  // Kleiner deterministischer Generator, damit der Lauf wiederholbar ist.
  zufall = (zufall * 1103515245 + 12345) & 0x7fffffff;
  return zufall % n;
};

let verworfen = 0, durchgelassen = 0;
const vorherFehler = fehlgeschlagen;

for (let lauf = 0; lauf < 20000; lauf++) {
  const taeterId = ["mikkeli","nala","fanny"][wuerfel(3)];
  const andere = ["mikkeli","nala","fanny"].filter((id) => id !== taeterId);

  // Eine plausible Antwort: 4 bis 6 Spuren, gültige Ids, Schwerpunkt beim
  // Täter - so, wie der Prompt es verlangt.
  const anzahl = 4 + wuerfel(3);
  const spuren = [];
  for (let i = 0; i < anzahl; i++) {
    const aufTaeter = wuerfel(3) > 0;
    spuren.push({
      itemId: itemIds[i],
      ortId: ortIds[wuerfel(ortIds.length)],
      beobachtung: "x", vermutung: "", bedeutung: "y",
      zeigtAufCharakterId: aufTaeter ? taeterId : andere[wuerfel(andere.length)],
      fuehrtInDieIrre: !aufTaeter,
    });
  }

  // Und jetzt genau die Ausrutscher, die das Modell wirklich macht.
  const patzer = wuerfel(8);
  if (patzer === 0 && spuren.length > 1) spuren[1].itemId = spuren[0].itemId;      // Gegenstand doppelt
  if (patzer === 1) spuren[0].fuehrtInDieIrre = spuren[0].zeigtAufCharakterId === taeterId;
  if (patzer === 2) spuren[0].zeigtAufCharakterId = "wimpy";                        // zeigt auf den Detektiv
  if (patzer === 3) spuren[0].ortId = "nirgendwo";                                  // Ort erfunden
  if (patzer === 4) spuren[0].itemId = "gibtsnicht";                                // Gegenstand erfunden
  if (patzer === 5) for (const s of spuren) s.zeigtAufCharakterId = andere[0];       // alles am Täter vorbei
  if (patzer === 6) for (const s of spuren) { if (s.zeigtAufCharakterId === taeterId) s.fuehrtInDieIrre = true; }

  const e = repariereFall({ spuren, verdaechtige, besetzung, taeterId, ortIds, itemIds });
  if (e.fehler) { verworfen++; continue; }
  durchgelassen++;
  pruefeVertrag(`zufall#${lauf}`, e, taeterId);
  if (fehlgeschlagen > vorherFehler) {
    console.log("  Eingabe war:", JSON.stringify({ taeterId, spuren }));
    break;
  }
}
console.log(`  ${durchgelassen} durchgelassen, ${verworfen} verworfen (${
  (100 * verworfen / (durchgelassen + verworfen)).toFixed(1)
} %)`);

console.log(`\n${gelaufen} Prüfungen, ${fehlgeschlagen} fehlgeschlagen.`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
