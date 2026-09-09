/**
 * Yen und Zubehör: Der Lohn muss stimmen, und ein Fall darf nur einmal zahlen.
 * Geprüft wird die reine Rechnerei - der Beutel selbst hängt am Browser.
 */
import {
  FINGERABDRUCKSET,
  GRUNDREGAL,
  LOHN_FALL,
  LOHN_SAGA,
  VERITASERUM,
  WIRKUNGEN,
  wirkungVon,
  yen,
} from "../lib/zubehoer.ts";
import { abdrueckeAmTatort } from "../lib/abdruecke.ts";
import {
  STANDARD_SAGA_VORGABEN,
  geschenkFuerKapitel,
  musikFuerKapitel,
} from "../lib/sagaTypen.ts";

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

console.log("\n5. Das Fingerabdruckset");
pruefe("es kostet 500", FINGERABDRUCKSET.preis === 500);
pruefe("und wirkt am Schauplatz", wirkungVon(FINGERABDRUCKSET.wirkung)?.wo === "fall");
pruefe("beides steht im Grundregal", GRUNDREGAL.length === 2 &&
  GRUNDREGAL.some((z) => z.id === VERITASERUM.id) &&
  GRUNDREGAL.some((z) => z.id === FINGERABDRUCKSET.id));
pruefe("Grundregal-Ids sind eindeutig", new Set(GRUNDREGAL.map((z) => z.id)).size === GRUNDREGAL.length);
pruefe("jedes Grundstück hat eine bekannte Wirkung", GRUNDREGAL.every((z) => wirkungVon(z.wirkung)));

{
  const fall = {
    taeterId: "t",
    tatort: "hafen",
    verdaechtige: [
      { charakterId: "t", aufenthaltsort: "markt" },
      { charakterId: "a", aufenthaltsort: "hafen" },
      { charakterId: "b", aufenthaltsort: "hafen" },
      { charakterId: "c", aufenthaltsort: "park" },
    ],
  };

  // Über viele Ziehungen: nie mehr als zwei, immer mit Täter, nie jemand,
  // der gar nicht am Tatort war, solange dort jemand war.
  let hoechstens2 = true;
  let immerTaeter = true;
  let nurVomTatort = true;
  let taeterMalVorn = false;
  let taeterMalHinten = false;
  let beideZweiten = new Set();
  for (let i = 0; i < 400; i++) {
    const ids = abdrueckeAmTatort(fall);
    if (ids.length > 2) hoechstens2 = false;
    if (!ids.includes("t")) immerTaeter = false;
    for (const id of ids) if (id !== "t" && id !== "a" && id !== "b") nurVomTatort = false;
    if (ids[0] === "t") taeterMalVorn = true;
    else taeterMalHinten = true;
    beideZweiten.add(ids.find((id) => id !== "t"));
  }
  pruefe("höchstens zwei Abdrücke", hoechstens2);
  pruefe("der Täter ist immer dabei", immerTaeter);
  pruefe("der zweite war wirklich am Tatort", nurVomTatort);
  pruefe("der Täter steht mal vorn, mal hinten", taeterMalVorn && taeterMalHinten);
  pruefe("beide Anwesenden kommen dran", beideZweiten.size === 2);

  // Ist am Tatort sonst niemand, tut es ein anderer Verdächtiger.
  const allein = {
    taeterId: "t",
    tatort: "hafen",
    verdaechtige: [
      { charakterId: "t", aufenthaltsort: "hafen" },
      { charakterId: "c", aufenthaltsort: "park" },
    ],
  };
  const zwei = abdrueckeAmTatort(allein, () => 0.1);
  pruefe("sonst hilft ein anderer Verdächtiger aus", zwei.length === 2 && zwei.includes("c"));

  // Gibt es überhaupt nur den Täter, bleibt ein Name übrig.
  const nurTaeter = {
    taeterId: "t",
    tatort: "hafen",
    verdaechtige: [{ charakterId: "t", aufenthaltsort: "hafen" }],
  };
  pruefe("mit nur einem Verdächtigen bleibt ein Name", 
    JSON.stringify(abdrueckeAmTatort(nurTaeter)) === JSON.stringify(["t"]));

  // Der Würfel darf nie danebengreifen, auch am Rand nicht.
  const rand = abdrueckeAmTatort(fall, () => 0.999999);
  pruefe("auch bei 0,999… ein gültiges Paar", rand.length === 2 && rand.includes("t") &&
    rand.every((id) => ["t", "a", "b"].includes(id)));
}

console.log("\n6. Das Geschenk nach einem Kapitel");
{
  const leer = STANDARD_SAGA_VORGABEN;
  pruefe("ohne Eintrag gibt es nichts", geschenkFuerKapitel(leer, 0) === "");
  pruefe("auch ohne Vorgaben nicht", geschenkFuerKapitel(undefined, 0) === "");
  pruefe("und weit hinter dem Ende nicht", geschenkFuerKapitel(leer, 99) === "");

  // Nur für Kapitel 3 (Index 2) eingetragen - davor stehen leere Plätze.
  const nurDrittes = { kapitelGeschenke: ["", "", "veritaserum"] };
  pruefe("Kapitel 1 bekommt nichts", geschenkFuerKapitel(nurDrittes, 0) === "");
  pruefe("Kapitel 3 bekommt das Serum", geschenkFuerKapitel(nurDrittes, 2) === "veritaserum");
  pruefe("Kapitel 4 wieder nichts", geschenkFuerKapitel(nurDrittes, 3) === "");

  // Löcher, wie sie über JSON ankommen können.
  const mitLoch = { kapitelGeschenke: [null, undefined, "fingerabdruckset"] };
  pruefe("ein null-Loch gibt nichts", geschenkFuerKapitel(mitLoch, 0) === "");
  pruefe("dahinter wird trotzdem gefunden",
    geschenkFuerKapitel(mitLoch, 2) === "fingerabdruckset");
  pruefe("Leerzeichen zählen nicht als Eintrag",
    geschenkFuerKapitel({ kapitelGeschenke: ["   "] }, 0) === "");
}

console.log("\n7. Hintergrundmusik je Kapitel");
{
  const allgemein = "/audio/intro.mp3";
  pruefe("ohne Eintrag gilt die Einstellung",
    musikFuerKapitel({ kapitelMusik: [] }, 0, allgemein) === allgemein);
  pruefe("ohne Vorgaben ebenso", musikFuerKapitel(undefined, 0, allgemein) === allgemein);
  pruefe("ohne alles bleibt es still", musikFuerKapitel(undefined, 0, "") === "");
  pruefe("ein Eintrag gewinnt",
    musikFuerKapitel({ kapitelMusik: ["/audio/hutsong.mp3"] }, 0, allgemein) === "/audio/hutsong.mp3");
  pruefe("Löcher davor stören nicht",
    musikFuerKapitel({ kapitelMusik: [null, undefined, "/audio/geckerl.mp3"] }, 2, allgemein) ===
      "/audio/geckerl.mp3");
  pruefe("und ein Loch nimmt die Einstellung",
    musikFuerKapitel({ kapitelMusik: [null, "", "/audio/geckerl.mp3"] }, 1, allgemein) === allgemein);
  pruefe("Leerzeichen zählen als nichts",
    musikFuerKapitel({ kapitelMusik: ["   "] }, 0, allgemein) === allgemein);
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
