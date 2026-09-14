import { strict as assert } from "node:assert";
import {
  laufAnimation,
  pursuitAuswahlGueltig,
  pursuitStartauswahl,
  zufaelligeIntroAnimation,
} from "../lib/pursuit.ts";

const modelle = ["evilquana", "herr", "yeti"].map((id) => ({
  id, name: id, datei: `/animations/${id}.glb`, animationen: [],
}));

assert.deepEqual(pursuitStartauswahl(modelle), ["evilquana", "herr", "yeti"]);
assert.equal(pursuitAuswahlGueltig(["evilquana", "herr", "yeti"], modelle), true);
assert.equal(pursuitAuswahlGueltig(["yeti", "yeti", "herr"], modelle), false);
assert.equal(laufAnimation(["Cardio_Dance", "Running", "Walking"]), "Running");
assert.equal(laufAnimation(["Armature|Take"]), "Armature|Take");
assert.equal(zufaelligeIntroAnimation(["Running", "Cardio_Dance", "Idle_5"], () => 0), "Cardio_Dance");
assert.equal(zufaelligeIntroAnimation([], () => 0), null);

console.log("Pursuit-Auswahl und Animationen sind sauber.");
