/**
 * Yen und Zubehör: Der Lohn muss stimmen, und ein Fall darf nur einmal zahlen.
 * Geprüft wird die reine Rechnerei - der Beutel selbst hängt am Browser.
 */
import {
  LOHN_FALL,
  LOHN_SAGA,
  VERITASERUM,
  WIRKUNGEN,
  wirkungVon,
  yen,
} from "../lib/zubehoer.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

console.log("\n1. Der Lohn");
pruefe("ein Fall bringt 100", LOHN_FALL === 100);
pruefe("eine Saga bringt 500", LOHN_SAGA === 500);
pruefe("Yen mit Symbol", yen(100) === "100 ¥");
pruefe("mit Tausenderpunkt", yen(1250) === "1.250 ¥");
pruefe("und bei null", yen(0) === "0 ¥");

console.log("\n2. Wirkungen");
pruefe("jede Wirkung hat einen Ort", WIRKUNGEN.every((w) => w.wo === "gespraech" || w.wo === "fall"));
pruefe("jede hat einen Bestätigungssatz", WIRKUNGEN.every((w) => w.bestaetigung.length > 5));
pruefe("Ids sind eindeutig", new Set(WIRKUNGEN.map((w) => w.id)).size === WIRKUNGEN.length);
pruefe("das Serum wirkt im Gespräch", wirkungVon(VERITASERUM.wirkung)?.wo === "gespraech");
pruefe("unbekannte Wirkung gibt null", wirkungVon("zauberstab") === null);
pruefe("gar keine Wirkung ebenso", wirkungVon(undefined) === null);

console.log("\n3. Das Veritaserum steht immer im Regal");
pruefe("es hat einen Preis", VERITASERUM.preis > 0);
pruefe("und eine Beschreibung", VERITASERUM.beschreibung.length > 20);

console.log("\n4. Der Beutel rechnet nach");
{
  // Dieselbe Rechnung wie in lib/useBeutel.ts - hier ohne Browser.
  const beutel = { yen: 0, vorrat: {}, bezahlt: [] };
  const verdienen = (was, betrag) => {
    if (beutel.bezahlt.includes(was)) return false;
    beutel.yen += betrag;
    beutel.bezahlt.push(was);
    return true;
  };
  pruefe("erster Fall zahlt", verdienen("fall:a", LOHN_FALL) && beutel.yen === 100);
  pruefe("derselbe Fall zahlt nicht noch einmal", !verdienen("fall:a", LOHN_FALL) && beutel.yen === 100);
  pruefe("ein zweiter Fall schon", verdienen("fall:b", LOHN_FALL) && beutel.yen === 200);
  pruefe("die Saga bringt den Batzen", verdienen("saga:x", LOHN_SAGA) && beutel.yen === 700);
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
