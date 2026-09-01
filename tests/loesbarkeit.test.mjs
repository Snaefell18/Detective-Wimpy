/**
 * Prüft die Mechanik von der anderen Seite: Kann ein Spieler, der nur die
 * Beobachtungen liest und die Indizien zählt, den Täter finden - und liegt
 * er nie bei einer falschen Fährte richtig?
 */
import { repariereFall } from "../lib/fallReparieren.ts";

const besetzung = [
  { id: "wimpy", name: "Wimpy", istDetektiv: true },
  { id: "mikkeli", name: "Mikkeli", istDetektiv: false },
  { id: "nala", name: "Nala", istDetektiv: false },
  { id: "fanny", name: "Fanny", istDetektiv: false },
  { id: "bruno", name: "Bruno", istDetektiv: false },
];
const ortIds = ["o1","o2","o3","o4","o5"];
const itemIds = ["kamera","schal","brief","schluessel","kerze","muenze","hut","zettel"];
const verdaechtige = besetzung.filter((c) => !c.istDetektiv).map((c, i) => ({
  charakterId: c.id, aufenthaltsort: ortIds[i % ortIds.length],
  alibi: "a", geheimnis: "g", alibiIstGelogen: false,
}));

/** So spielt jemand, der nur zählt: Wer die meisten Indizien hat, war es. */
function wenWuerdeManBeschuldigen(spuren) {
  const zaehler = {};
  for (const s of spuren) zaehler[s.zeigtAufCharakterId] = (zaehler[s.zeigtAufCharakterId] ?? 0) + 1;
  const sortiert = Object.entries(zaehler).sort((a, b) => b[1] - a[1]);
  if (sortiert.length === 0) return null;
  if (sortiert.length > 1 && sortiert[0][1] === sortiert[1][1]) return null; // unentschieden
  return sortiert[0][0];
}

let zufall = 987654321;
const wuerfel = (n) => { zufall = (zufall * 1103515245 + 12345) & 0x7fffffff; return zufall % n; };

let geprueft = 0, danebenGeraten = 0, unentschieden = 0, verworfen = 0;
let auffindbarFehler = 0, faehrteFehler = 0;

for (let lauf = 0; lauf < 30000; lauf++) {
  const verdIds = besetzung.filter((c) => !c.istDetektiv).map((c) => c.id);
  const taeterId = verdIds[wuerfel(verdIds.length)];
  const andere = verdIds.filter((id) => id !== taeterId);

  const anzahl = 4 + wuerfel(3);
  const spuren = Array.from({ length: anzahl }, (_, i) => {
    const aufTaeter = wuerfel(3) > 0;
    return {
      itemId: itemIds[i], ortId: ortIds[wuerfel(ortIds.length)],
      beobachtung: "x", vermutung: "", bedeutung: "y",
      zeigtAufCharakterId: aufTaeter ? taeterId : andere[wuerfel(andere.length)],
      fuehrtInDieIrre: !aufTaeter,
    };
  });
  const patzer = wuerfel(8);
  if (patzer === 0 && spuren.length > 1) spuren[1].itemId = spuren[0].itemId;
  if (patzer === 1) spuren[0].fuehrtInDieIrre = spuren[0].zeigtAufCharakterId === taeterId;
  if (patzer === 2) spuren[0].zeigtAufCharakterId = "wimpy";
  if (patzer === 5) for (const s of spuren) s.zeigtAufCharakterId = andere[0];

  const e = repariereFall({ spuren, verdaechtige, besetzung, taeterId, ortIds, itemIds });
  if (e.fehler) { verworfen++; continue; }
  geprueft++;

  // 1. Wer zählt, kommt auf den Täter.
  const geraten = wenWuerdeManBeschuldigen(e.spuren);
  if (geraten === null) unentschieden++;
  else if (geraten !== taeterId) danebenGeraten++;

  // 2. Jede Spur ist auch wirklich auffindbar: Die Such-Route gibt je
  //    Gegenstand genau eine heraus - also darf keiner doppelt liegen.
  const items = e.spuren.map((s) => s.itemId);
  if (new Set(items).size !== items.length) auffindbarFehler++;

  // 3. Eine falsche Fährte zeigt nie auf den Täter - sonst würde richtiges
  //    Misstrauen bestraft.
  if (e.spuren.some((s) => s.fuehrtInDieIrre && s.zeigtAufCharakterId === taeterId)) faehrteFehler++;
}

console.log(`Ausgelieferte Fälle: ${geprueft}   verworfen: ${verworfen}`);
console.log(`Wer die Indizien zählt, tippt daneben: ${danebenGeraten}`);
console.log(`Unentschieden (nicht entscheidbar):    ${unentschieden}`);
console.log(`Unauffindbare Spur:                    ${auffindbarFehler}`);
console.log(`Falsche Fährte auf den Täter:          ${faehrteFehler}`);

const summe = danebenGeraten + unentschieden + auffindbarFehler + faehrteFehler;
console.log(summe === 0 ? "\nAlles sauber." : "\nPROBLEME GEFUNDEN.");
process.exit(summe === 0 ? 0 : 1);
