import { strict as assert } from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Nav } from "../components/Nav.tsx";
import { kapitelPosition } from "../lib/saga3dLayout.ts";
import { DREI_D_LOCATIONS, STANDARD_KAPITEL_3D, polizeiAus, tankstelleAus } from "../lib/pursuit3d.ts";
import { STANDARD_SAGA_VORGABEN, dreiDFuerKapitel } from "../lib/sagaTypen.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { POST } from "../app/api/search/route.ts";
import { seal, unseal } from "../lib/seal.ts";
import { aktualisiereSaga3D, dreiDFuerSagaFall, sichere3DTiere, kapitel3DMitBesetzung } from "../lib/saga3dSync.ts";

const navigation = renderToStaticMarkup(React.createElement(Nav, {
  aktiv: "ort", onWechsel: () => {}, spurenAnzahl: 1, spurenMax: 6, onBeschuldigen: () => {},
}));
for (const aktion of ["Orte", "Tiere", "Beweise", "Notizen", "Beschuldigen"]) {
  assert.ok(navigation.includes(`aria-label="${aktion}"`), `${aktion} bleibt im 3D-Spiel erreichbar`);
}

for (const anzahl of [1, 7, 12, 24, 40]) {
  for (const art of ["tier", "spur"]) {
    for (let i = 0; i < anzahl; i++) {
      const { x, z } = kapitelPosition(i, anzahl, art);
      assert.ok(Math.abs(x) < 4.15 && z >= -33 && z <= 12, `${art} ${i}/${anzahl} ist erreichbar`);
    }
  }
}
const konfiguration = { ...STANDARD_KAPITEL_3D, aktiv: true, locations: ["tokyo1", "stellenbosch"], strassentyp: "sand", wetter: "regen", locationDrehungen: { tokyo1: 180 } };
for (const wetter of ["schnee", "schneesturm", "blizzard", "sandsturm", "nebel"]) {
  const winter = { ...konfiguration, wetter, strassentyp: wetter === "sandsturm" ? "sand" : "schnee" };
  const gespeichert = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [winter] })));
  assert.deepEqual(dreiDFuerKapitel(gespeichert, 0), winter, "Neue Straßen/Wetter überstehen Saga-Generierung und Speicherung");
}
const verteilt = Array.from({ length: 8 }, (_, i) => kapitelPosition(i, 8, "tier"));
assert.ok(Math.max(...verteilt.map(p => p.z)) - Math.min(...verteilt.map(p => p.z)) > 35, "Tiere nutzen die gesamte Straße");
const vorgaben = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [konfiguration] })));
assert.deepEqual(dreiDFuerKapitel(vorgaben, 0), konfiguration);
assert.equal(dreiDFuerKapitel(vorgaben, 1), null);
// Regression: Kapitel zwei nachträglich aktivieren, danach einen alten lokalen Durchgang fortsetzen.
const nurZwei = [{ ...STANDARD_KAPITEL_3D }, konfiguration];
const alt = {
  saga: { id: "saga-test", vorgaben: { ...STANDARD_SAGA_VORGABEN, kapitel3d: [] }, kapitel: [{ nummer: 1 }, { nummer: 2 }] },
  lauf: { sagaId: "saga-test", kapitel: 1, phase: "fall", fallId: "fall-zwei", geloest: [1] },
};
const neu = aktualisiereSaga3D(alt, "saga-test", nurZwei);
assert.equal(neu.lauf, alt.lauf, "Fortschritt und laufende Fall-ID bleiben identisch");
assert.equal(neu.saga.kapitel, alt.saga.kapitel, "Gespeicherte Kapitel bleiben identisch");
assert.equal(dreiDFuerKapitel(neu.saga.vorgaben, 0), null, "Kapitel eins bleibt 2D");
assert.deepEqual(dreiDFuerKapitel(neu.saga.vorgaben, neu.lauf.kapitel), konfiguration, "Kapitel zwei wird 3D");
assert.equal(aktualisiereSaga3D(neu, "saga-test", nurZwei), neu, "Gleiche Einstellungen lösen keinen Neuaufbau aus");
assert.equal(aktualisiereSaga3D(neu, "andere-saga", []), neu, "Verspätete Antwort einer anderen Saga wird ignoriert");
assert.equal(dreiDFuerKapitel(aktualisiereSaga3D(neu, "saga-test", []).saga.vorgaben, 1), null, "3D lässt sich wieder abschalten");
const nurZweiVomServer = SagaVorgabenSchema.parse(JSON.parse(JSON.stringify({ ...STANDARD_SAGA_VORGABEN, kapitel3d: nurZwei })));
assert.equal(dreiDFuerKapitel(nurZweiVomServer, 1)?.aktiv, true, "Nur Kapitel zwei übersteht den Generierungsweg");
const sagaMitFaellen = { ...neu.saga, kapitel: [
  { nummer: 1, fall: { id: "fall-eins" } }, { nummer: 2, fall: { id: "fall-zwei" } },
], finale: { fall: { id: "fall-finale" } } };
assert.equal(dreiDFuerSagaFall(sagaMitFaellen, "fall-eins"), null);
assert.equal(dreiDFuerSagaFall(sagaMitFaellen, "fall-zwei")?.aktiv, true, "Erster Start wird anhand des tatsächlichen Falls als 3D erkannt");
assert.equal(dreiDFuerSagaFall(sagaMitFaellen, "fremder-fall"), null);
const tiere = ["affin", "bock", "fauli", "yeti"].map(id => ({ id, istDetektiv: false }));
const besetzungsVorgaben = { ...STANDARD_SAGA_VORGABEN, twist: false, abwesenheiten: { bock: [2] }, neuzugaenge: { yeti: 3 } };
assert.deepEqual(sichere3DTiere(besetzungsVorgaben, tiere, 1).map(c => c.id), ["affin", "fauli"]);
assert.deepEqual(sichere3DTiere({ ...besetzungsVorgaben, twist: true, drahtzieherId: "" }, tiere, 1), []);
const groessen = { ...konfiguration, charakterModelle: { affin: "yeti", bock: "herr" }, charakterGroessen: { affin: 1.8, bock: 2 } };
const bereinigt = kapitel3DMitBesetzung(groessen, [{ id: "affin" }]);
assert.deepEqual(bereinigt.charakterModelle, { affin: "yeti" });
assert.deepEqual(bereinigt.charakterGroessen, { affin: 1.8 });
assert.equal(SagaVorgabenSchema.parse({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [bereinigt] }).kapitel3d[0].charakterGroessen.affin, 1.8);
assert.equal(SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, kapitel3d: [{ ...konfiguration, charakterGroessen: { affin: 100 } }] }).success, false);
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
/* --- Die Tankstelle: Wimpys Garage in der Stadt --------------------- */
{
  const ids = DREI_D_LOCATIONS.map((ort) => ort.id);
  // Ausdrücklich gewählt gilt immer - auch ohne "Tank" im Namen.
  assert.equal(tankstelleAus(ids, ids[0])?.id, ids[0], "Die gewählte Tankstelle wird genommen");
  // Eine Wahl, die gar nicht aufgebaut wird, zählt nicht.
  assert.equal(
    tankstelleAus([ids[1]], ids[0])?.id ?? null,
    null,
    "Ein Baustein, der nicht in der Stadt steht, ist keine Tankstelle",
  );
  // Ohne Wahl entscheidet der Name.
  const nachNamen = tankstelleAus(ids)?.id ?? null;
  const getauft = ids.filter((id) => /tank/i.test(id));
  assert.equal(
    nachNamen,
    getauft[0] ?? null,
    "Ohne Wahl wird die Tankstelle am Namen erkannt - oder es gibt eben keine",
  );
  // Ohne einen so getauften Baustein bleibt es dabei: keine Tankstelle.
  assert.equal(
    tankstelleAus(ids.filter((id) => !/tank|zapf|benzin|sprit|garage|werkstatt/i.test(id)))?.id ?? null,
    null,
    "Ohne passenden Namen gibt es keine Tankstelle",
  );
  // Ein Name allein macht noch keine Tankstelle: Der Baustein muss es geben.
  const ohneTank = ids.filter((id) => !/tank/i.test(id));
  assert.equal(
    tankstelleAus(["tankstelle-die-es-nicht-gibt", ohneTank[0]])?.id ?? "keine",
    "keine",
    "Ein unbekannter Baustein wird nicht einfach erfunden",
  );

  /* --- Und dasselbe für die Polizeiwache --------------------------- */
  const wache = ids.find((id) => /polizei|police|revier|wache/i.test(id));
  assert.equal(
    polizeiAus(ids)?.id ?? null,
    wache ?? null,
    "Ohne Wahl wird die Wache am Namen erkannt - oder es gibt eben keine",
  );
  assert.equal(polizeiAus(ids, ids[0])?.id, ids[0], "Die gewählte Wache wird genommen");
  assert.equal(
    polizeiAus(ids.filter((id) => !/polizei|police|revier|wache|kommissariat|koban/i.test(id)))?.id ?? null,
    null,
    "Ohne passenden Namen gibt es keine Wache",
  );
  // Tankstelle und Wache dürfen nebeneinander stehen, ohne sich zu stören.
  if (wache && getauft[0]) {
    assert.notEqual(
      tankstelleAus(ids)?.id,
      polizeiAus(ids)?.id,
      "Tankstelle und Wache sind nicht dasselbe Haus",
    );
  }

  // Und die Wahl übersteht Speichern und Erzeugung.
  const gespeichert = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{ ...STANDARD_KAPITEL_3D, aktiv: true, tankstelleId: ids[0], polizeiId: ids[1] ?? ids[0] }],
  });
  assert.equal(gespeichert.data?.kapitel3d[0].tankstelleId, ids[0], "Die Tankstelle bleibt gespeichert");
  assert.equal(gespeichert.data?.kapitel3d[0].polizeiId, ids[1] ?? ids[0], "Und die Wache auch");
  const alt3d = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    kapitel3d: [{ ...STANDARD_KAPITEL_3D, aktiv: true, tankstelleId: undefined }],
  });
  assert.equal(alt3d.data?.kapitel3d[0].tankstelleId, "", "Ältere Kapitel bleiben ohne Tankstelle gültig");
}

console.log("3D-Kapitel: erreichbare Figuren/Beweise, Konfiguration und echte Fund-API erfolgreich geprüft.");
