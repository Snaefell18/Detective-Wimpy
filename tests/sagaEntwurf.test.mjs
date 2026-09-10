/**
 * Der Zwischenstand einer Saga-Erzeugung.
 *
 * Eine Saga kostet zwanzig und mehr Aufrufe. Bricht der letzte ab, war bisher
 * alles davor umsonst bezahlt. Der Stand auf dem Gerät ist das Netz darunter -
 * und er muss zwei Dinge sicher können: sich merken, was fertig ist, und
 * merken, wenn er zu einer ganz anderen Bestellung gehört.
 */
import {
  entwurfKennung,
  entwurfStand,
  ladeEntwurf,
  leererEntwurf,
  speichereEntwurf,
  verwirfEntwurf,
} from "../lib/sagaEntwurf.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

// Ein Gerätespeicher, wie ihn der Browser hätte.
const speicher = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
    setItem: (k, v) => speicher.set(k, String(v)),
    removeItem: (k) => speicher.delete(k),
  },
};

const eingaben = {
  vorgaben: { ...STANDARD_SAGA_VORGABEN, name: "Glocken", kapitelAnzahl: 3 },
  charaktere: [{ id: "wimpy" }, { id: "hut" }, { id: "nala" }],
  orte: [{ id: "o1" }, { id: "o2" }],
  items: [{ id: "lupe" }],
};

console.log("\n1. Der Fingerabdruck einer Bestellung");
{
  const a = entwurfKennung(eingaben);
  pruefe("gleiche Eingaben, gleicher Abdruck", a === entwurfKennung(eingaben));
  pruefe("er ist kurz", a.length > 0 && a.length < 16, a);

  pruefe(
    "andere Vorgaben, anderer Abdruck",
    a !== entwurfKennung({ ...eingaben, vorgaben: { ...eingaben.vorgaben, kapitelAnzahl: 4 } }),
  );
  pruefe(
    "ein Tier mehr, anderer Abdruck",
    a !== entwurfKennung({ ...eingaben, charaktere: [...eingaben.charaktere, { id: "bo" }] }),
  );
  pruefe(
    "andere Reihenfolge ändert nichts",
    a === entwurfKennung({ ...eingaben, charaktere: [...eingaben.charaktere].reverse() }),
  );
  pruefe(
    "eine andere falsche Fährte zählt",
    a !==
      entwurfKennung({
        ...eingaben,
        vorgaben: { ...eingaben.vorgaben, falscheFaehrte: { charakterId: "nala", was: "" } },
      }),
  );
}

console.log("\n2. Festhalten und wiederfinden");
{
  speicher.clear();
  pruefe("leerer Speicher gibt nichts her", ladeEntwurf() === null);

  const kennung = entwurfKennung(eingaben);
  const frisch = leererEntwurf(kennung, eingaben.vorgaben);
  pruefe("ein frischer Stand hat nichts fertig", entwurfStand(frisch).fertig === 0);
  pruefe("und sagt das auch", entwurfStand(frisch).text === "noch nichts");

  speichereEntwurf({ ...frisch, siegel: "siegel-1", name: "Die Glocken" });
  const gelesen = ladeEntwurf();
  pruefe("er kommt zurück", gelesen?.siegel === "siegel-1");
  pruefe("mit seinem Namen", gelesen?.name === "Die Glocken");
  pruefe("und seiner Kennung", gelesen?.kennung === kennung);
  pruefe("die Vorgaben reisen mit", gelesen?.vorgaben.kapitelAnzahl === 3);
  pruefe("die Zeit wird mitgeschrieben", (gelesen?.zuletzt ?? 0) > 0);

  verwirfEntwurf();
  pruefe("verworfen ist verworfen", ladeEntwurf() === null);
}

console.log("\n3. Kaputtes wird nicht angefasst");
{
  speicher.clear();
  speicher.set("detective-wimpy:saga-entwurf:v1", "{kein json");
  pruefe("Unlesbares gibt null", ladeEntwurf() === null);

  speicher.set("detective-wimpy:saga-entwurf:v1", JSON.stringify({ version: 99, kennung: "x", vorgaben: {} }));
  pruefe("eine andere Version zählt nicht", ladeEntwurf() === null);

  speicher.set("detective-wimpy:saga-entwurf:v1", JSON.stringify({ version: 1, kennung: "", vorgaben: {} }));
  pruefe("ohne Kennung zählt nicht", ladeEntwurf() === null);

  speicher.set(
    "detective-wimpy:saga-entwurf:v1",
    JSON.stringify({ version: 1, kennung: "x", vorgaben: STANDARD_SAGA_VORGABEN, kapitel: "kaputt" }),
  );
  pruefe("eine kaputte Kapitelliste wird geheilt", Array.isArray(ladeEntwurf()?.kapitel));
  pruefe("fehlende Fälle werden leer", typeof ladeEntwurf()?.faelle === "object");
}

console.log("\n4. Was schon steht");
{
  const kennung = entwurfKennung(eingaben);
  const kapitel = (n) => ({ nummer: n, name: `K${n}`, teaser: "", erzaehlerText: "" });
  const stand = {
    ...leererEntwurf(kennung, eingaben.vorgaben),
    kern: { bogenSiegel: "b", id: "s", name: "N", thema: "", klappentext: "", auftaktText: "", schlagworte: [], kapitelAnzahl: 3 },
    kapitel: [kapitel(1), kapitel(2)],
    finale: { frage: "", erzaehlerText: "", epilogText: "" },
    faelle: { 1: { fall: {}, siegel: "s1" } },
  };
  const s = entwurfStand(stand);
  pruefe("das Überthema zählt", s.text.includes("Überthema"));
  pruefe("die Kapitel zählen", s.text.includes("2 von 3 Kapiteln"));
  pruefe("das Finale zählt", s.text.includes("Finale"));
  pruefe("die fertigen Fälle zählen", s.text.includes("1 von 3 Fällen"));
  pruefe("zusammen fünf Schritte", s.fertig === 5, String(s.fertig));
  pruefe("von neun", s.gesamt === 9, String(s.gesamt));

  const fertig = entwurfStand({
    ...stand,
    kapitel: [kapitel(1), kapitel(2), kapitel(3)],
    faelle: { 1: {}, 2: {}, 3: {} },
    finaleFall: { fall: null, siegel: null },
  });
  pruefe("ganz durch sind es neun", fertig.fertig === fertig.gesamt, `${fertig.fertig}/${fertig.gesamt}`);
}

console.log("\n5. Ein Stand gehört nur zu seiner Bestellung");
{
  speicher.clear();
  const kennung = entwurfKennung(eingaben);
  speichereEntwurf(leererEntwurf(kennung, eingaben.vorgaben));
  const andere = entwurfKennung({
    ...eingaben,
    vorgaben: { ...eingaben.vorgaben, kapitelAnzahl: 5 },
  });
  pruefe("dieselbe Bestellung passt", ladeEntwurf()?.kennung === kennung);
  pruefe("eine andere passt nicht", ladeEntwurf()?.kennung !== andere);
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
