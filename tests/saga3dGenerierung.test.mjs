import { strict as assert } from "node:assert";
import { erzeugeSaga } from "../lib/sagaErzeugen.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { STANDARD_KAPITEL_3D } from "../lib/pursuit3d.ts";
import { dreiDFuerSagaFall } from "../lib/saga3dSync.ts";

// Echter Erzeugungsablauf vom leeren Entwurf bis zur spielbaren Saga;
// ausschließlich die kostenpflichtigen API-Antworten sind lokale Testdaten.
const speicher = new Map();
const vorherWindow = globalThis.window;
const vorherFetch = globalThis.fetch;
globalThis.window = { localStorage: { setItem: (k,v) => speicher.set(k,v), getItem: k => speicher.get(k) ?? null } };
const aufrufe = [];
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  aufrufe.push({ url, body });
  let antwort;
  if (url === "/api/saga") {
    if (!body.schritt) antwort = { id: "frische-saga", name: "Kochduell-Test", thema: "Test", klappentext: "Test", auftaktText: "Los", bogenSiegel: "bogen", kapitelAnzahl: 2 };
    else if (body.schritt === "kapitel") antwort = { bogenSiegel: "bogen", kapitel: { nummer: body.nummer, name: `Kapitel ${body.nummer}`, teaser: "Test", erzaehlerText: "Los" } };
    else if (body.schritt === "finale") antwort = { bogenSiegel: "bogen", finale: { frage: "Wer?", erzaehlerText: "Finale", epilogText: "Ende" } };
  } else if (url === "/api/case") {
    if (body.schritt === "geruest") antwort = { siegel: `fall-${body.kapitel}` };
    else if (body.schritt === "verdaechtige") antwort = { siegel: body.siegel };
    else if (body.schritt === "spuren") antwort = { siegel: body.siegel, fall: { id: body.siegel, besetzung: [{ id: "affin", istDetektiv: false }], orte: [], aufenthalt: {}, titel: "Test" } };
  }
  assert.ok(antwort, `Unerwarteter Schritt ${url}: ${body.schritt}`);
  return new Response(JSON.stringify(antwort), { status: 200 });
};
try {
  const saga = await erzeugeSaga({ charaktere: [], orte: [], items: [], vorgaben: {
    ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 2, finaleArt: "klassisch",
    kapitel3d: [{ ...STANDARD_KAPITEL_3D }, { ...STANDARD_KAPITEL_3D, aktiv: true,
      wetter: "regen", tageszeit: "nacht", locations: ["tokyo1"],
      charakterModelle: { affin: "affin", bock: "bock" }, charakterGroessen: { affin: 1.8, bock: 2 },
    }],
  } });
  assert.equal(aufrufe[0].body.vorgaben.kapitel3d[1].aktiv, true);
  const gespeichert = JSON.parse(JSON.stringify(saga));
  assert.equal(dreiDFuerSagaFall(gespeichert, "fall-1"), null);
  const kapitelZwei = dreiDFuerSagaFall(gespeichert, "fall-2");
  assert.equal(kapitelZwei.aktiv, true);
  assert.equal(kapitelZwei.tageszeit, "nacht");
  assert.equal(kapitelZwei.wetter, "regen");
  assert.deepEqual(kapitelZwei.charakterModelle, { affin: "affin" });
  assert.deepEqual(kapitelZwei.charakterGroessen, { affin: 1.8 });
  assert.equal(aufrufe.length, 13);
  console.log("Erstgenerierung bestanden: Kapitel 1 in 2D, Kapitel 2 in 3D, echte Besetzung und Größen bleiben erhalten.");
} finally {
  globalThis.fetch = vorherFetch;
  if (vorherWindow === undefined) delete globalThis.window;
  else globalThis.window = vorherWindow;
}
