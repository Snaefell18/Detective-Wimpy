import { strict as assert } from "node:assert";
import { kapitelPosition } from "../lib/saga3dLayout.ts";
import { STANDARD_KAPITEL_3D } from "../lib/pursuit3d.ts";
import { STANDARD_SAGA_VORGABEN, dreiDFuerKapitel } from "../lib/sagaTypen.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { POST } from "../app/api/search/route.ts";
import { seal, unseal } from "../lib/seal.ts";

for (const anzahl of [1, 7, 12, 24, 40]) {
  for (const art of ["tier", "spur"]) {
    for (let i = 0; i < anzahl; i++) {
      const { x, z } = kapitelPosition(i, anzahl, art);
      assert.ok(Math.abs(x) < 4.15 && z >= -33 && z <= 12, `${art} ${i}/${anzahl} ist erreichbar`);
    }
  }
}
const konfiguration = { ...STANDARD_KAPITEL_3D, aktiv: true, locations: ["tokyo1", "stellenbosch"], strassentyp: "sand", wetter: "regen", locationDrehungen: { tokyo1: 180 } };
const vorgaben = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [konfiguration] })));
assert.deepEqual(dreiDFuerKapitel(vorgaben, 0), konfiguration);
assert.equal(dreiDFuerKapitel(vorgaben, 1), null);
assert.equal(SagaVorgabenSchema.parse({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [{ aktiv: true }] }).kapitel3d[0].strassentyp, "asphalt");

const fall = {
  titel: "3D-Testfall", orte: [{ id: "ort-a", name: "Hafen" }, { id: "ort-b", name: "Gasse" }],
  items: [{ id: "beweis-a", name: "Brief" }, { id: "beweis-b", name: "Schlüssel" }],
  spuren: [
    { itemId: "beweis-a", ortId: "ort-a", beobachtung: "Blaue Tinte", bedeutung: "Geheim A" },
    { itemId: "beweis-b", ortId: "ort-b", beobachtung: "Rostiger Bart", bedeutung: "Geheim B" },
  ],
};
const siegel = seal(fall);
const suchen = async (teil) => (await POST(new Request("http://localhost/api/search", {
  method: "POST", body: JSON.stringify({ siegel, ortId: "ort-a", gefundeneSpuren: [], ...teil }),
}))).json();
const vorschau = await suchen({ vorschau: true, gefundeneSpuren: ["beweis-a"] });
assert.equal(vorschau.spuren.length, 2, "Stabile Objektpositionen auch nach einem Fund");
assert.ok(!JSON.stringify(vorschau).includes("Geheim"), "Vorschau verrät keine Beweisbedeutung");
const fund = await suchen({ itemId: "beweis-b", ortId: "ort-b" });
assert.equal(fund.spur.itemId, "beweis-b");
assert.equal(unseal(fund.spur.siegel).bedeutung, "Geheim B", "Fund bleibt vor Gericht verwendbar");
assert.equal((await suchen({ itemId: "beweis-b" })).spur, null, "Falscher Ort darf keinen anderen Gegenstand liefern");
assert.equal((await suchen({ itemId: "beweis-a", gefundeneSpuren: ["beweis-a"] })).spur, null);
assert.equal((await suchen({})).spur.itemId, "beweis-a", "Normale 2D-Suche bleibt erhalten");
console.log("3D-Kapitel: erreichbare Figuren/Beweise, Konfiguration und echte Fund-API erfolgreich geprüft.");
