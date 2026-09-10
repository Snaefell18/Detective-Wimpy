/**
 * Die Anhörung: der Gerichtssaal als Gespräch zu dritt.
 *
 * Geprüft wird der Teil, der nicht vom Modell kommt - und genau der muss
 * dicht sein: Ein Ausrutscher in einer Modellzahl darf keine Verhandlung in
 * einem Zug entscheiden, ein Geständnis nie ohne überzeugtes Gericht
 * dastehen, und ein Zug, der etwas gebracht hat, nie an der Geduld zehren.
 */
import {
  GEDULD,
  LEERE_ANHOERUNG,
  MIT_BEWEIS_MAX,
  OHNE_BEWEIS_MAX,
  RUECKSCHLAG_MAX,
  UEBERZEUGT,
  anhoerungsErgebnis,
  anhoerungsWorte,
  geklammert,
  verrechnen,
} from "../lib/anhoerung.ts";
import { FINALE_ARTEN } from "../lib/sagaFinale.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const zug = (text) => ({ rolle: "richter", text });

console.log("\n1. Was das Modell schickt, wird eingeklammert");
{
  const wild = geklammert({ ueberzeugungPlus: 9999, geduldMinus: 9, gestaendnis: true }, true);
  pruefe("nach oben gekappt", wild.plus === MIT_BEWEIS_MAX);
  pruefe("Geduld kostet ein guter Zug nie", wild.geduldMinus === 0);

  const ohne = geklammert({ ueberzeugungPlus: 40 }, false);
  pruefe("ohne Beweis geht es nur langsam", ohne.plus === OHNE_BEWEIS_MAX);

  const rueck = geklammert({ ueberzeugungPlus: -500, geduldMinus: 5 }, true);
  pruefe("nach unten gekappt", rueck.plus === -RUECKSCHLAG_MAX);
  pruefe("Geduld kostet höchstens zwei", rueck.geduldMinus === 2);

  const kaputt = geklammert({ ueberzeugungPlus: "viel", geduldMinus: null }, true);
  pruefe("Unsinn wird null", kaputt.plus === 0 && kaputt.geduldMinus === 0);

  const leer = geklammert({}, false);
  pruefe("fehlende Texte sind leer", leer.angeklagter === "" && leer.richter === "");
  pruefe("kein Geständnis aus Versehen", leer.gestaendnis === false);

  const drei = geklammert({ ueberzeugungPlus: 0, geduldMinus: 1 }, true);
  pruefe("ein fruchtloser Zug kostet Geduld", drei.geduldMinus === 1);
}

console.log("\n2. Ein Zug wird verrechnet");
{
  const eins = verrechnen(LEERE_ANHOERUNG, geklammert({ ueberzeugungPlus: 30 }, true), [zug("So.")], "lupe");
  pruefe("die Überzeugung steigt", eins.ueberzeugung === 30);
  pruefe("der Zug steht im Protokoll", eins.verlauf.length === 1);
  pruefe("das Stück liegt auf dem Tisch", eins.vorgelegt.length === 1 && eins.vorgelegt[0] === "lupe");
  pruefe("die Geduld ist unberührt", eins.geduld === GEDULD);

  const nochmal = verrechnen(eins, geklammert({ ueberzeugungPlus: 0 }, true), [], "lupe");
  pruefe("dasselbe Stück zählt nicht doppelt", nochmal.vorgelegt.length === 1);

  const hoch = verrechnen(eins, geklammert({ ueberzeugungPlus: MIT_BEWEIS_MAX }, true), []);
  const ganz = verrechnen(hoch, geklammert({ ueberzeugungPlus: MIT_BEWEIS_MAX }, true), []);
  pruefe("über 100 geht es nicht", ganz.ueberzeugung === UEBERZEUGT);

  const runter = verrechnen(LEERE_ANHOERUNG, geklammert({ ueberzeugungPlus: -10 }, true), []);
  pruefe("unter 0 geht es auch nicht", runter.ueberzeugung === 0);
}

console.log("\n3. Drei Züge mit einem starken Stück reichen - einer nicht");
{
  let stand = LEERE_ANHOERUNG;
  for (let i = 0; i < 2; i++) {
    stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 99 }, true), [], `s${i}`);
    pruefe(`nach Zug ${i + 1} ist es noch offen`, anhoerungsErgebnis(stand) === "laeuft");
  }
  stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 99 }, true), [], "s2");
  pruefe("nach dem dritten ist es entschieden", anhoerungsErgebnis(stand) === "gewonnen");
}

console.log("\n4. Ein Geständnis nur mit überzeugtem Gericht");
{
  const frueh = verrechnen(
    LEERE_ANHOERUNG,
    geklammert({ ueberzeugungPlus: 20, gestaendnis: true }, true),
    [],
  );
  pruefe("kein Geständnis bei 20", frueh.gestaendnis === false);
  pruefe("und es läuft weiter", anhoerungsErgebnis(frueh) === "laeuft");

  let stand = LEERE_ANHOERUNG;
  stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 45 }, true), []);
  stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 45 }, true), []);
  const ende = verrechnen(
    stand,
    geklammert({ ueberzeugungPlus: 45, gestaendnis: true }, true),
    [],
  );
  pruefe("mit vollem Maß gilt es", ende.gestaendnis === true);
  pruefe("ein Geständnis bleibt stehen", verrechnen(ende, geklammert({}, false), []).gestaendnis);
}

console.log("\n5. Öhös Geduld");
{
  let stand = LEERE_ANHOERUNG;
  for (let i = 0; i < GEDULD - 1; i++) {
    stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 0, geduldMinus: 1 }, false), []);
  }
  pruefe("bis zum letzten Licht läuft es", anhoerungsErgebnis(stand) === "laeuft");
  stand = verrechnen(stand, geklammert({ ueberzeugungPlus: 0, geduldMinus: 1 }, false), []);
  pruefe("dann ist es vorbei", anhoerungsErgebnis(stand) === "verloren");
  pruefe("Geduld wird nicht negativ", stand.geduld === 0);

  // Gewonnen schlägt verloren: Wer im letzten Zug überzeugt, hat gewonnen.
  const knapp = verrechnen(
    { ...LEERE_ANHOERUNG, ueberzeugung: 90, geduld: 1 },
    geklammert({ ueberzeugungPlus: 20 }, true),
    [],
  );
  pruefe("überzeugt ist überzeugt", anhoerungsErgebnis(knapp) === "gewonnen");
}

console.log("\n6. Jede Finale-Art hat ihre Worte");
{
  for (const art of FINALE_ARTEN) {
    const worte = anhoerungsWorte(art.id);
    pruefe(
      `${art.id} ist vollständig`,
      Boolean(worte.maß && worte.ziel && worte.vorlegen && worte.entschieden),
    );
  }
  pruefe(
    "bei „kein Täter“ geht es um Zweifel",
    anhoerungsWorte("ohne-taeter").maß.includes("Zweifel"),
  );
  pruefe(
    "bei „Wimpy selbst“ legt er gegen sich vor",
    anhoerungsWorte("wimpy").vorlegen.includes("mich"),
  );
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
