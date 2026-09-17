"use client";

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { istHandy } from "@/lib/dreiDLeistung";
import {
  DREI_D_LOCATIONS,
  istBlizzard,
  istDunst,
  istSchneeWetter,
} from "@/lib/pursuit3d";
import type { JagdWelt } from "@/lib/verfolgung";
import {
  LEUCHTEN,
  SAND_LICHT,
  cellShading,
  einpassen,
  fahrbahnMaterial,
  sandDunst,
  texturenVerkleinern,
  wetterFeld,
} from "./stadtBau";

/**
 * Die Straße, an der das Spiel dreimal vorbeikommt.
 *
 * Verfolgungsjagd und Abspann fahren durch dieselbe Welt: derselbe Belag,
 * dieselbe Tageszeit, dasselbe Wetter, dieselben Häuser am Rand. Bis vor
 * Kurzem stand das alles im Code der Jagd - und der Abspann hätte es
 * abschreiben müssen. Zwei Abschriften driften auseinander: Wer die Häuser in
 * der Jagd näher an die Straße rückt, hätte sie im Abspann noch weit draußen.
 *
 * Deshalb liegt hier, was beide brauchen: Himmel, Licht, Nebel, Fahrbahn,
 * Markierung, Landschaft, Wetter - und die Häuserzeilen. Was jede Szene für
 * sich behält, sind ihre Kamera, ihre Figuren und ihre Uhr.
 *
 * Gefahren wird überall in Richtung +z, also auf die Kamera zu; die Welt
 * wandert dafür nach -z (siehe `zieht`).
 */

/** Wo die Fahrbahn aufhört - sie ist 10,2 Meter breit, Mitte bei null. */
export const FAHRBAHN_RAND = 5.1;

/**
 * Wie weit die Hausfront vom Fahrbahnrand wegbleibt - ein Gehweg, mehr nicht.
 *
 * Gemessen wird an der Front, nicht an der Hausmitte: Ein Baustein ist mal
 * zwölf und mal dreißig Meter tief, und wer ihre Mittelpunkte auf eine Linie
 * stellt, bekommt eine ausgefranste Zeile mit einer breiten Lücke davor.
 */
export const GEHWEG = 1.5;

/** Ein Ding, das mit der Straße nach hinten wandert und vorn wiederkommt. */
export type Zieht = (obj: THREE.Object3D, ende: number, sprung: number) => THREE.Object3D;

export type StrassenWelt = {
  /** Was der Renderer als Blende einstellen soll. */
  belichtung: number;
  sichtNah: number;
  sichtFern: number;
  nacht: boolean;
  /** Der Blizzard nimmt zusätzlich Sicht - die Szene fragt ihn im Bild. */
  blizzard: boolean;
  wetterfall: ReturnType<typeof wetterFeld>;
};

/**
 * Himmel, Licht, Boden, Fahrbahn, Markierung, Landschaft und Wetter.
 *
 * Alles, was danach noch dazukommt (Autos, Figuren, Häuser), stellt die Szene
 * selbst hinein. Die Farben kommen aus derselben Palette wie die 3D-Stadt:
 * Wer eine Nacht im Regen einstellt, bekommt dieselbe Nacht und denselben
 * Regen wie im Kapitel davor.
 */
export function strasseBauen({
  scene,
  welt,
  gradient,
  merken,
  zieht,
  freiHalten,
}: {
  scene: THREE.Scene;
  welt: JagdWelt;
  gradient: THREE.Texture;
  merken: (wert: { dispose: () => void }) => void;
  zieht: Zieht;
  /**
   * Wo nichts stehen darf, weil dort die Szene spielt - etwa da, wo die
   * Figuren auf ihren Wagen warten. Gilt nur für die gerechnete Landschaft.
   */
  freiHalten?: (x: number, z: number) => boolean;
}): StrassenWelt {
  const { strassentyp, tageszeit, wetter, locations } = welt;
  const nacht = tageszeit === "nacht";
  const schneeWetter = istSchneeWetter(wetter);
  const sandSturm = wetter === "sandsturm";
  /** Der Blizzard: Man sieht den Wagen - und sonst fast nichts. */
  const blizzard = istBlizzard(wetter);
  const dunst = istDunst(wetter);

  const himmel = {
    morgen: 0xf3a979,
    tag: wetter === "sonne" ? 0x62c8ff : 0x91b8d2,
    abend: 0xa84567,
    nacht: 0x070a16,
  }[tageszeit];
  const dunstFarbe = sandSturm
    ? sandDunst(tageszeit)
    : blizzard
      ? (nacht ? 0x36485f : 0xe6eef6)
      : dunst || schneeWetter
        ? (nacht ? 0x253749 : 0xb7cbd6)
        : wetter === "regen" ? 0x536777 : himmel;
  scene.background = new THREE.Color(dunst || schneeWetter ? dunstFarbe : himmel);
  /*
   * Weiter als in der Stadt: Hier fährt man auf das hin, was am Horizont
   * steht, statt zwischen Häusern zu laufen. Im Blizzard dagegen endet die
   * Welt kurz hinter dem Wagen - er bleibt gerade noch zu sehen, und die Böen
   * nehmen einem auch den für Augenblicke.
   */
  const sichtNah = blizzard ? 9 : dunst ? 16 : 28;
  const sichtFern = blizzard ? 34 : dunst ? 62 : 95;
  scene.fog = new THREE.Fog(dunstFarbe, sichtNah, sichtFern);

  scene.add(new THREE.HemisphereLight(
    nacht ? 0x7aa1ff : tageszeit === "abend" ? 0xffad87 : 0xc2e9ff,
    // Schnee wirft kaltes Licht zurück, Asphalt fast keines.
    strassentyp === "schnee" ? (nacht ? 0x24405e : 0xd3e6f4) : nacht ? 0x161d2e : 0x3c4a44,
    nacht ? 2.4 : 3,
  ));
  const licht = new THREE.DirectionalLight(
    wetter === "sonne" ? 0xfff1b8 : sandSturm ? SAND_LICHT : nacht ? 0x9fc4ff : 0xffe2b6,
    wetter === "sonne" ? 4.4 : sandSturm ? 1.6 : dunst ? 1.1 : wetter === "regen" || schneeWetter ? 1.8 : 3,
  );
  licht.position.set(-8, 14, 10);
  scene.add(licht);

  const mesh = (geo: THREE.BufferGeometry, farbe: number, x: number, y: number, z: number) => {
    const material = new THREE.MeshToonMaterial({ color: farbe });
    merken(geo);
    merken(material);
    const obj = new THREE.Mesh(geo, material);
    obj.position.set(x, y, z);
    scene.add(obj);
    return obj;
  };

  /* --- Der Untergrund ---------------------------------------------- */
  /** Das Land neben der Piste: Schnee, Sand oder Grün. */
  const landFarbe = sandSturm
    ? (nacht ? 0x3b2f1f : 0xa98a5c)
    : strassentyp === "schnee"
      ? (nacht ? 0x8fa9c4 : 0xf1f8ff)
      : strassentyp === "sand"
        ? (nacht ? 0x5a4a33 : 0xc6a678)
        // Asphalt liegt in derselben Umgebung wie in der Stadt: kein Grün,
        // sondern der blaugraue Grund, den auch das 3D-Kapitel zeigt.
        : nacht ? 0x293448 : 0x4b5868;
  /*
   * Der Grund reicht so weit, wie Häuser stehen können.
   *
   * Mit Bausteinen stehen zwei Zeilen rechts und eine links, und die hintere
   * darf tief hinausragen - ein schmaler Streifen darunter hörte mitten in der
   * Stadt auf, und dahinter klaffte der Himmel bis zum Boden. Der Nebel nimmt
   * einem den Rand lange vorher ab; die paar Dreiecke mehr kosten nichts.
   */
  mesh(new THREE.BoxGeometry(locations.length ? 200 : 34, 0.2, 130), landFarbe, 0, -0.22, 24);

  /*
   * Die Fahrbahn ist dieselbe wie in der Stadt: derselbe Belag, dieselben
   * Spuren, dieselbe Rechnung (components/stadtBau.ts). So fährt man über die
   * Straße, durch die man vorher gelaufen ist.
   */
  const belag = fahrbahnMaterial({
    gradient,
    strassentyp,
    tageszeit,
    wetter,
    imRaster: false,
    merken,
  });
  // Die Naturtextur ist für ein kurzes Stück gedacht; über 130 Meter muss sie
  // sich öfter wiederholen, sonst zieht sie sich zu langen Schlieren.
  belag.map?.repeat.set(1, 26);
  const fahrbahn = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.1, 130), belag);
  fahrbahn.position.set(0, -0.05, 24);
  scene.add(fahrbahn);
  merken(fahrbahn.geometry);

  if (strassentyp === "asphalt") {
    // Mittelstreifen wie bisher: zwei Reihen leuchtender Striche.
    const strichGeometrie = new THREE.BoxGeometry(0.08, 0.02, 2);
    merken(strichGeometrie);
    const strichMaterial = new THREE.MeshToonMaterial({ color: nacht ? 0x7cdaee : 0xe8e2b8 });
    merken(strichMaterial);
    for (const x of [-1.7, 1.7]) {
      for (let i = 0; i < 25; i++) {
        const strich = new THREE.Mesh(strichGeometrie, strichMaterial);
        strich.position.set(x, 0.02, i * 4 - 20);
        scene.add(strich);
        zieht(strich, -22, 100);
      }
    }
  } else {
    /*
     * Wo kein Asphalt ist, steht am Rand, was den Weg zeigt: rote
     * Schneestangen in der Arktis, helle Pfosten in der Wüste - dieselben wie
     * im 3D-Kapitel.
     */
    const pfostenGeometrie = new THREE.CylinderGeometry(
      0.05, 0.06, strassentyp === "schnee" ? 1.6 : 0.7, 5,
    );
    merken(pfostenGeometrie);
    const pfostenMaterial = new THREE.MeshToonMaterial({
      color: strassentyp === "schnee" ? 0xd65a47 : 0xd2bb8b,
      gradientMap: gradient,
    });
    merken(pfostenMaterial);
    for (const seite of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const pfosten = new THREE.Mesh(pfostenGeometrie, pfostenMaterial);
        pfosten.position.set(seite * 5.4, strassentyp === "schnee" ? 0.8 : 0.35, i * 8 - 20);
        scene.add(pfosten);
        zieht(pfosten, -24, 112);
      }
    }
  }

  /**
   * Die Landschaft dahinter.
   *
   * Ohne gewählte Bausteine ist sie gerechnet: Tannen im Schnee, Dünen im
   * Sand, Häuserblöcke am Asphalt. Sind Bausteine gewählt, kommen stattdessen
   * die Häuserzeilen - sonst stünde die gerechnete Landschaft vor ihnen und
   * verdeckte genau das, was man sehen will.
   */
  const landGeometrie = strassentyp === "sand"
    ? new THREE.IcosahedronGeometry(2.4, 0)
    : strassentyp === "schnee"
      ? new THREE.ConeGeometry(1.4, 4, 5)
      : new THREE.BoxGeometry(4.5, 9, 4.5);
  merken(landGeometrie);
  const landMaterialien = (strassentyp === "schnee"
    ? [0x3f7f78, 0xe8f4fb]
    : strassentyp === "sand"
      ? [0xd9b782, 0xc09a63]
      : nacht ? [0x2b3a4d, 0x1d2836] : [0x6d7b8c, 0x55637a]
  ).map((farbe) => {
    const material = new THREE.MeshToonMaterial({ color: farbe, gradientMap: gradient });
    merken(material);
    return material;
  });
  for (let i = 0; !locations.length && i < 28; i++) {
    const x = (i % 2 ? -1 : 1) * (strassentyp === "asphalt" ? 10 + (i % 3) * 1.5 : 7 + (i % 3));
    const z = i * 4 - 25;
    const imWeg = freiHalten?.(x, z) ?? false;
    const stueck = new THREE.Mesh(landGeometrie, landMaterialien[i % landMaterialien.length]);
    stueck.position.set(
      x,
      strassentyp === "sand" ? -0.9 : strassentyp === "schnee" ? 2 : 4.4,
      imWeg ? z + 56 : z,
    );
    if (strassentyp === "sand") stueck.scale.set(1 + (i % 3) * 0.3, 0.32, 1.4);
    scene.add(stueck);
    zieht(stueck, -30, 112);
  }

  /*
   * Und das Wetter darüber - dieselbe Rechnung wie in Stadt und Arena.
   *
   * Der Ausschnitt ist so lang wie die sichtbare Strecke: Was vorn in der Luft
   * steht, zieht während der Fahrt nach hinten durch und kommt vorn wieder
   * herein.
   */
  const wetterfall = wetterFeld({
    wetter,
    scene,
    merken,
    weite: 34,
    tiefe: 110,
    versatzZ: 16,
    hoehe: 16,
    anzahl: blizzard ? 3000 : undefined,
    /*
     * Größere Flocken als in der Stadt: Dort läuft man mitten durch den
     * Schneefall, hier schaut man aus zwanzig Metern auf die Straße.
     */
    groesse: 2,
  });

  return {
    belichtung: nacht
      ? 0.9
      : wetter === "sonne"
        ? (strassentyp === "schnee" ? 0.96 : 1.16)
        : strassentyp === "schnee" ? 0.92 : 1,
    sichtNah,
    sichtFern,
    nacht,
    blizzard,
    wetterfall,
  };
}

/**
 * Die Häuser am Straßenrand.
 *
 * Dieselben Bausteine wie in den 3D-Kapiteln, nur stehen sie hier nicht auf
 * einem Raster, sondern in Zeilen neben der Piste - und weil die Strecke kein
 * Ende hat, wiederholen sie sich: Wer hinten hinausfällt, kommt vorn wieder
 * herein. Ein einziges geladenes Modell reicht dafür für beliebig viele
 * Kopien; geteilt werden Geometrie und Texturen.
 *
 * Sie stehen dicht: die Front einen Gehweg von der Fahrbahn entfernt, die
 * Häuser so hoch, dass sie oben aus dem Bild laufen, und Schulter an Schulter
 * statt in Abständen. Man fährt nicht mehr an einer Stadt vorbei, man fährt
 * durch sie hindurch.
 *
 * Aufgerufen wird das nebenher, nicht vorweg: Ein Baustein ist ein paar
 * Megabyte groß, und die Szene soll losgehen können, bevor Tokio steht.
 */
export async function haeuserZeilen({
  scene,
  welt,
  gradient,
  loader,
  sammeln,
  zieht,
  abgebrochen,
}: {
  scene: THREE.Scene;
  welt: JagdWelt;
  gradient: THREE.Texture;
  loader: GLTFLoader;
  /** Alles, was ein geladenes Modell mitbringt, zum Aufräumen vormerken. */
  sammeln: (wurzel: THREE.Object3D) => void;
  zieht: Zieht;
  /** Ist die Szene inzwischen zu? Dann wird nichts mehr aufgestellt. */
  abgebrochen: () => boolean;
}): Promise<void> {
  const handy = istHandy();
  const gewaehlt = welt.locations
    .map((id) => DREI_D_LOCATIONS.find((ort) => ort.id === id))
    .filter((ort): ort is (typeof DREI_D_LOCATIONS)[number] => Boolean(ort))
    // Mehr als drei Bauarten hält kein Handy aus - jede bringt ihre eigenen
    // Texturen mit; auf dem Handy sind es zwei.
    .slice(0, handy ? 2 : 3);
  if (!gewaehlt.length) return;

  const vorlagen = await Promise.all(
    gewaehlt.map(async (ort) => {
      const gltf = await loader.loadAsync(ort.datei);
      texturenVerkleinern(gltf.scene, handy ? 512 : 768);
      cellShading(gltf.scene, gradient, [], LEUCHTEN[welt.tageszeit]);
      sammeln(gltf.scene);
      return gltf.scene;
    }),
  );
  if (abgebrochen()) return;

  /*
   * Wie groß ein Baustein bei einer bestimmten Höhe wird.
   *
   * Jedes Modell hat andere Maße; gebraucht werden sie schon vor dem
   * Aufstellen, um die Front an die Straße und die Nachbarn nebeneinander zu
   * bekommen. Deshalb einmal je Vorlage das Verhältnis messen - Tiefe und
   * Breite je Meter Höhe - und danach nur noch multiplizieren.
   *
   * Achtung bei den Achsen: Die Häuser stehen quer zur Fahrbahn gedreht, ihre
   * eigene z-Achse zeigt danach nach x. Was im Modell die Tiefe ist, steht in
   * der Welt also neben der Straße, und die Breite liegt an ihr entlang.
   */
  const masse = vorlagen.map((vorlage) => {
    const groesse = new THREE.Box3().setFromObject(vorlage).getSize(new THREE.Vector3());
    const hoch = Math.max(0.001, groesse.y);
    return { tiefe: groesse.z / hoch, breite: groesse.x / hoch };
  });

  /*
   * Die Zeilen. Rechts steht die Stadt, weil man nur dorthin schaut: Das Spiel
   * läuft in einer hochkanten Spalte, und die Kamera schaut von links vorn auf
   * die Straße.
   *
   * `front` ist der Abstand der Hauswand vom Fahrbahnrand. Die hintere Zeile
   * beginnt hinter der tiefsten Vorlage der vorderen - sonst stünden zwei
   * Häuser ineinander.
   */
  const tiefste = (hoehen: number[]) =>
    Math.max(...masse.map((mass) => mass.tiefe * Math.max(...hoehen)));
  const vorneHoehen = handy ? [13, 16] : [13, 17, 15];
  const zeilen: { seite: 1 | -1; front: number; hoehen: number[]; luecke: number }[] = [
    { seite: 1, front: GEHWEG, hoehen: vorneHoehen, luecke: 0 },
    {
      seite: 1,
      front: GEHWEG + tiefste(vorneHoehen) + 4,
      hoehen: handy ? [20] : [22, 26, 19],
      luecke: 0.5,
    },
  ];
  /*
   * Links steht nur etwas, wenn Speicher dafür da ist: Im Hochformat - also
   * auf dem Handy - sieht man diese Zeile ohnehin nie.
   *
   * Und sie muss hinter der Kamera bleiben. Die Anfahrt schaut aus 17,5 Metern
   * links der Fahrbahn zu; eine Front, die näher steht, hat die Kamera im Haus
   * - dann sieht man zu Beginn eine Wand von innen statt der Figuren am Wagen.
   */
  if (!handy) zeilen.push({ seite: -1, front: 15, hoehen: [14, 18, 16], luecke: 0.33 });

  const strecke = handy ? 120 : 170;
  for (const zeile of zeilen) {
    /*
     * Wie weit zwei Nachbarn auseinanderstehen: so breit wie das breiteste
     * Haus dieser Zeile, plus eine Handbreit. Dadurch stehen sie nebeneinander
     * statt in Lücken - eine geschlossene Häuserzeile.
     */
    const abstand = Math.max(
      14,
      Math.max(...masse.map((mass) => mass.breite * Math.max(...zeile.hoehen))) + 1.5,
    );
    const anzahl = Math.ceil(strecke / abstand);
    for (let i = 0; i < anzahl; i++) {
      const vorlage = vorlagen[i % vorlagen.length];
      const hoehe = zeile.hoehen[i % zeile.hoehen.length];
      const haus = vorlage.clone(true);
      einpassen(haus, hoehe);
      const platz = new THREE.Group();
      platz.add(haus);
      // Die Front an die Straße: Die halbe Tiefe steht hinter ihr.
      const tiefe = masse[i % vorlagen.length].tiefe * hoehe;
      platz.position.set(
        zeile.seite * (FAHRBAHN_RAND + zeile.front + tiefe / 2),
        0,
        (i + zeile.luecke) * abstand - 40,
      );
      platz.rotation.y = zeile.seite > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(platz);
      zieht(platz, -40, anzahl * abstand);
    }
  }
}
