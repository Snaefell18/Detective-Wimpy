import * as THREE from "three";
import {
  FELD_GROESSE,
  STADT_HOEHE,

  feldAn,
  feldBei,
  feldMitte,
  gebaeudeFelder,
  hoeheFuer,
  imPlan,
  istStrasse,
  strassenFelder,
  vorDerTuer,
  type Stadtplan,
} from "@/lib/stadtplan";
import {
  istBlizzard,
  istSchneeWetter,
  type DreiDStrassentyp,
  type DreiDTageszeit,
  type DreiDWetter,
} from "@/lib/pursuit3d";

/**
 * Wie aus einem Stadtplan eine Stadt wird.
 *
 * Das stand lange im 3D-Kapitel, weil es dort zum ersten Mal gebraucht wurde.
 * Inzwischen wird dieselbe Stadt an zwei Stellen gebaut - im Kapitel und in
 * der Kampfarena des Arc-Finales -, und zwei Kopien wären zwei Baustellen:
 * Wer eine Laterne anfasst, müsste sie zweimal anfassen, und irgendwann sähe
 * die Arena anders aus als die Stadt, durch die man vorher gelaufen ist.
 *
 * Deshalb liegt hier alles, was beide brauchen: die gerechneten Texturen, das
 * Einpassen der Bausteine und die beiden Schleifen, die Fahrbahn und Häuser
 * setzen. Was darüber hinausgeht - Tiere, Spuren, Autos, Gegner -, bleibt in
 * der jeweiligen Szene.
 *
 * Nichts davon gehört in lib/: Dort steht nur, was sich ohne Grafikkarte
 * prüfen lässt, und eine Textur ist genau das nicht.
 */

/**
 * Ein gebautes Stück Stadt, wie es die Szene in jedem Bild anfasst.
 *
 * Daraus leben zwei Dinge: das Wegblenden dessen, was der Kamera im Weg
 * steht, und das Weglassen dessen, was ohnehin im Nebel steht.
 */
export type StadtBlock = {
  gruppe: THREE.Object3D;
  mitte: THREE.Vector3;
  /** Nur Häuser: eigene Materialien, um eines allein wegblenden zu können. */
  materialien: THREE.Material[];
  /** Nur Häuser: auf welchem Rasterfeld es steht. */
  feld: { x: number; z: number } | null;
  /** 1 = voll da, 0 = weggeblendet. */
  sicht: number;
};

/** Alles, was die Szene beim Verlassen wieder freigeben muss. */
export type Merken = (wert: { dispose: () => void }) => void;

export function gradientTextur() {
  const textur = new THREE.DataTexture(
    new Uint8Array([65, 155, 255]),
    3,
    1,
    THREE.RedFormat,
  );
  textur.needsUpdate = true;
  textur.magFilter = THREE.NearestFilter;
  textur.minFilter = THREE.NearestFilter;
  return textur;
}

/**
 * Der Belag einer Naturstraße - Sandpiste, Schneefahrbahn oder Graspiste.
 *
 * Bei Schnee ist die Farbe die halbe Miete: Schnee ist nicht weiß, sondern
 * bläulich, und was in ihn hineingedrückt wird, wird nicht grau, sondern
 * kälter. Solange die Spuren einfach nur dunkler waren, sah die Fahrbahn aus
 * wie festgetretener Sand - und mit einem warmen Licht darüber wurde daraus
 * ein gelblicher Streifen, der mit Schnee nichts zu tun hatte.
 *
 * Deshalb drückt die Spur hier je Kanal verschieden tief: Rot verliert am
 * meisten, Blau am wenigsten. Dazu kommt ein feines Glitzern, das man kaum
 * einzeln sieht, das der Fläche aber die Tiefe gibt, die weiße Farbe allein
 * nie hat.
 *
 * Die Graspiste dreht das um: Dort ist die Spur *heller* als der Belag, denn
 * wo die Räder fahren, ist das Gras weg und die blanke Erde kommt durch.
 * Genau daran erkennt man einen Feldweg - zwei erdige Bänder mit einem
 * grünen Streifen dazwischen, auf dem nie ein Rad läuft.
 */

/** Wie eine Naturstraße aussieht - Grundfarbe, Spur und Korn. */
const NATUR_BELAG: Record<
  "sand" | "schnee" | "gras",
  {
    /** Die Grundfarbe der Fläche. */
    basis: [number, number, number];
    /**
     * Was die Radspur je Kanal abzieht. Negative Werte heißen: Dort wird es
     * heller - beim Gras kommt in der Spur die Erde durch.
     */
    spur: [number, number, number];
    /** Wie stark das Korn rauscht. */
    korn: number;
    /** Und was der Rand tut: Schnee wird heller, Sand und Gras dunkler. */
    rand: number;
  }
> = {
  schnee: { basis: [228, 240, 251], spur: [52, 42, 26], korn: 9, rand: 8 },
  sand: { basis: [199, 160, 105], spur: [29, 29, 29], korn: 14, rand: -22 },
  /*
   * Gras: sattes Wiesengrün, in der Spur die trockene Erde darunter
   * (138/116/84). Ein kräftigeres Braun wurde unter der Sonne orange - ein
   * Feldweg ist staubig, kein Backstein.
   */
  gras: { basis: [104, 140, 66], spur: [-34, 24, -18], korn: 13, rand: -16 },
};

export function naturStrassenTextur(art: "sand" | "schnee" | "gras") {
  const breite = 128, laenge = 512;
  const pixel = new Uint8Array(breite * laenge * 4);
  const schnee = art === "schnee";
  const gras = art === "gras";
  const belag = NATUR_BELAG[art] ?? NATUR_BELAG.sand;
  for (let y = 0; y < laenge; y++) {
    for (let x = 0; x < breite; x++) {
      const u = x / (breite - 1);
      const rauschen = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const korn = (rauschen - Math.floor(rauschen) - 0.5) * belag.korn;
      /*
       * Die Radspuren: weiche Bänder, die leicht schlängeln.
       *
       * Auf der Graspiste sind es nur zwei davon, dafür breitere - ein
       * Feldweg hat zwei ausgefahrene Spuren und dazwischen Gras, keinen
       * vierspurigen Acker.
       */
      const mitten = gras ? [0.28, 0.72] : [0.22, 0.38, 0.62, 0.78];
      const breiteSpur = gras ? 0.075 : 0.027;
      const spur = mitten.reduce((summe, mitte) =>
        summe + Math.exp(-(((u - mitte - Math.sin(y * 0.035) * 0.003) / breiteSpur) ** 2)), 0);
      const rand = Math.pow(Math.abs(u - 0.5) * 2, 8);
      const riffeln = Math.sin(y * 0.7 + u * 22) * (schnee ? 2 : 3);
      // Einzelne Kristalle blitzen auf - selten, klein, hell.
      const funkeln = schnee && (rauschen - Math.floor(rauschen)) > 0.985 ? 22 : 0;
      /*
       * Grashalme: ein kurzwelliges Muster quer und längs, damit die Wiese
       * nicht wie ein grüner Teppich aussieht. Nur dort, wo Gras steht - in
       * der ausgefahrenen Spur wächst nichts mehr.
       */
      const halme = gras
        ? Math.sin(x * 1.9) * Math.sin(y * 0.8 + x * 0.3) * 13 * Math.max(0, 1 - spur)
        : 0;
      const farbe = belag.basis.map((v, kanal) => THREE.MathUtils.clamp(
        v + korn + riffeln + funkeln + (kanal === 1 ? halme : halme * 0.35)
          - spur * belag.spur[kanal] + rand * belag.rand,
        0,
        255,
      ));
      pixel.set([...farbe, 255], (y * breite + x) * 4);
    }
  }
  const textur = new THREE.DataTexture(pixel, breite, laenge, THREE.RGBAFormat);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.wrapS = textur.wrapT = THREE.RepeatWrapping;
  textur.repeat.set(1, 6);
  textur.magFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return textur;
}

/**
 * Asphalt fürs Stadtraster.
 *
 * Eine glatte Farbfläche verrät sofort, dass hier nichts weiter ist als ein
 * Rechteck. Ein wenig Korn, ein paar Flicken und Risse kosten nichts - sie
 * werden hier gerechnet, nicht geladen - und geben der Straße eine Oberfläche,
 * auf der das Licht etwas zu tun hat.
 */
export function asphaltTextur(nacht: boolean) {
  const kante = 256;
  const pixel = new Uint8Array(kante * kante * 4);
  const zufall = (x: number, y: number) => {
    const wert = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return wert - Math.floor(wert);
  };
  const basis = nacht ? [34, 42, 56] : [78, 86, 94];
  for (let y = 0; y < kante; y++) {
    for (let x = 0; x < kante; x++) {
      /*
       * Nur Korn und grobe Flecken - keine Wellen, keine Sinuslinien.
       * Alles Regelmäßige legt sich über ein gekacheltes Feld sofort als
       * Muster, und dann sieht die Straße aus wie ein Teppich.
       */
      const korn = (zufall(x, y) - 0.5) * 16;
      const flicken = (zufall(Math.floor(x / 32), Math.floor(y / 32)) - 0.5) * 9;
      const feiner = (zufall(Math.floor(x / 7), Math.floor(y / 7)) - 0.5) * 5;
      const farbe = basis.map((wert) =>
        THREE.MathUtils.clamp(wert + korn + flicken + feiner, 0, 255),
      );
      pixel.set([...farbe, 255], (y * kante + x) * 4);
    }
  }
  const textur = new THREE.DataTexture(pixel, kante, kante, THREE.RGBAFormat);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.wrapS = textur.wrapT = THREE.RepeatWrapping;
  textur.repeat.set(1.7, 1.7);
  textur.magFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return textur;
}

export function schneeflockenTextur() {
  const pixel = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const radius = Math.hypot(x - 15.5, y - 15.5) / 15.5;
    pixel.set([255, 255, 255, Math.round(Math.max(0, 1 - radius) ** 0.6 * 255)], (y * 32 + x) * 4);
  }
  const textur = new THREE.DataTexture(pixel, 32, 32, THREE.RGBAFormat);
  textur.magFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return textur;
}

/* --- Wetter: Tropfen, Flocken, Sandkörner ---------------------------- */

/** Ein Wetterfeld, das die Szene in jedem Bild ein Stück weiterschiebt. */
export type WetterFeld = {
  /** Alles, was fällt - der Blizzard bringt zwei Schichten mit. */
  gruppe: THREE.Group;
  /**
   * Ein Bild weiter.
   *
   * `dt` sind Sekunden, `jetzt` Millisekunden (für den Wind), `zugZ` Meter,
   * die die Welt in diesem Bild unter dem Wetter weggezogen ist - das braucht
   * nur die Verfolgungsjagd, bei der nicht die Kamera fährt, sondern die
   * Straße.
   */
  bewegen: (dt: number, jetzt: number, zugZ?: number) => void;
  /**
   * Wie weit man gerade sehen kann: 1 ist die eingestellte Sichtweite,
   * weniger eine Böe, die sie zuzieht. Außerhalb des Blizzards immer 1.
   */
  sicht: (jetzt: number) => number;
};

/**
 * Was vom Himmel kommt - einmal für die ganze Welt.
 *
 * Stadt, Arena und Verfolgungsjagd hatten davon je eine eigene Fassung; die
 * dritte hätte niemand mehr mit den beiden anderen abgeglichen. Hier steht
 * nun eine, die alle drei können: Regen fällt, Schnee schwebt, der
 * Schneesturm weht ihn quer, und der Sandsturm fliegt fast waagerecht.
 *
 * Null kommt zurück, wenn es nichts zu zeichnen gibt (klar, Sonne, Nebel) -
 * dann hat die Szene auch nichts zu tun.
 */
export function wetterFeld(args: {
  wetter: DreiDWetter;
  scene: THREE.Scene;
  merken: Merken;
  /** Der Ausschnitt, in dem es fällt - Kantenlängen in Metern. */
  weite: number;
  tiefe: number;
  /** Wie hoch hinauf; darüber fängt jede Flocke wieder an. */
  hoehe?: number;
  /** Wo der Ausschnitt liegt. */
  versatzZ?: number;
  /** Wie viele Stücke - ohne Angabe je nach Lage. */
  anzahl?: number;
  /**
   * Wie groß eine Flocke gezeichnet wird - 1 ist das Maß der Stadt.
   *
   * Es hängt daran, wie weit die Kamera weg steht: In der Stadt läuft man
   * mitten durch den Schneefall, in der Verfolgungsjagd schaut man aus
   * zwanzig Metern auf die Straße. Dieselbe Flockengröße ist dort ein Punkt,
   * den niemand sieht.
   */
  groesse?: number;
}): WetterFeld | null {
  const { wetter, scene, merken, weite, tiefe, hoehe = 15, versatzZ = 0, groesse = 1 } = args;
  const schneeWetter = istSchneeWetter(wetter);
  const blizzard = istBlizzard(wetter);
  const sandSturm = wetter === "sandsturm";
  if (wetter !== "regen" && !schneeWetter && !sandSturm) return null;

  const anzahl =
    args.anzahl ??
    (blizzard
      ? 3200
      : sandSturm
        ? 1500
        : wetter === "schneesturm" ? 1200 : wetter === "schnee" ? 800 : 700);

  /** Eine Schicht Flocken - der Blizzard bekommt zwei davon. */
  const schicht = (menge: number, punktGroesse: number, deckkraft: number) => {
    const positionen = sandSturm
      ? sandKoerner(menge, weite, tiefe, versatzZ)
      : new Float32Array(menge * 3);
    if (!sandSturm) {
      for (let i = 0; i < menge; i++) {
        positionen[i * 3] = Math.random() * weite - weite / 2;
        positionen[i * 3 + 1] = Math.random() * hoehe;
        positionen[i * 3 + 2] = Math.random() * tiefe - tiefe / 2 + versatzZ;
      }
    }
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute("position", new THREE.BufferAttribute(positionen, 3));
    merken(geometrie);
    const material = new THREE.PointsMaterial({
      map: bild,
      color: sandSturm ? SAND_KORN.farbe : schneeWetter ? 0xf3faff : 0xc6edff,
      size: punktGroesse * groesse,
      transparent: true,
      opacity: deckkraft,
      depthWrite: false,
    });
    merken(material);
    const punkte = new THREE.Points(geometrie, material);
    gruppe.add(punkte);
    return geometrie;
  };

  const gruppe = new THREE.Group();
  // Das runde Korn der Flocke taugt auch als Sandkorn - nur kleiner und in
  // einem anderen Ton. Regen bleibt ein Strich ohne Bild.
  const bild = schneeWetter || sandSturm ? schneeflockenTextur() : null;
  if (bild) merken(bild);

  const schichten = blizzard
    ? [
        // Fein und dicht - die Wand, durch die man fährt.
        { geometrie: schicht(anzahl, 0.16, 0.95), tempo: 1 },
        // Und grobe Brocken davor, die spürbar schneller durchs Bild gehen.
        { geometrie: schicht(Math.round(anzahl / 3), 0.4, 0.85), tempo: 1.45 },
      ]
    : [
        {
          geometrie: schicht(
            anzahl,
            sandSturm ? SAND_KORN.groesse : schneeWetter ? 0.18 : 0.075,
            sandSturm ? SAND_KORN.deckkraft : 0.85,
          ),
          tempo: 1,
        },
      ];
  scene.add(gruppe);

  const halbeWeite = weite / 2;
  const vorne = versatzZ + tiefe / 2;
  const hinten = versatzZ - tiefe / 2;

  /**
   * Wie heftig die Böe gerade ist: 0 ist eine Atempause, 1 der Augenblick,
   * in dem man nichts mehr sieht. Zwei ungleich lange Wellen übereinander,
   * damit sich nichts wiederholt.
   */
  const boe = (jetzt: number) =>
    blizzard
      ? THREE.MathUtils.clamp(
          Math.sin(jetzt * 0.00042) * 0.6 + Math.sin(jetzt * 0.00097 + 1.3) * 0.5,
          0,
          1,
        )
      : 0;

  const bewegen = (dt: number, jetzt: number, zugZ = 0) => {
    const staerke = boe(jetzt);

    for (const { geometrie, tempo } of schichten) {
      const feld = geometrie.getAttribute("position") as THREE.BufferAttribute;
      if (sandSturm) {
        sandTreiben(feld, dt, jetzt, weite);
        if (zugZ) zugAnwenden(feld, zugZ, hinten, vorne);
        continue;
      }
      const fallen =
        (blizzard ? 6.5 : wetter === "schneesturm" ? 4.5 : schneeWetter ? 1.5 : 13) * tempo;
      for (let i = 0; i < feld.count; i++) {
        const y = feld.getY(i) - dt * fallen;
        feld.setY(i, y < 0 ? hoehe : y);
        if (!schneeWetter) continue;
        // Schnee fällt nicht senkrecht: Er wird getragen, im Sturm quer -
        // und im Blizzard fliegt er fast waagerecht vorbei.
        const wind =
          (blizzard
            ? 26 + staerke * 14 + Math.sin(jetzt * 0.0021 + i * 0.03) * 5
            : wetter === "schneesturm"
              ? 7 + Math.sin(jetzt * 0.0014) * 3
              : Math.sin(jetzt * 0.0006 + i) * 0.65) * tempo;
        const px = feld.getX(i) + wind * dt;
        feld.setX(i, px > halbeWeite ? -halbeWeite : px < -halbeWeite ? halbeWeite : px);
        const pz =
          feld.getZ(i) + dt * (blizzard ? 5 : wetter === "schneesturm" ? 2.2 : 0.2) * tempo;
        feld.setZ(i, pz > vorne ? hinten : pz);
      }
      if (zugZ) zugAnwenden(feld, zugZ, hinten, vorne);
      feld.needsUpdate = true;
    }
  };

  /*
   * Im Blizzard zieht die Sicht mit der Böe zu.
   *
   * Das ist der Unterschied zum Schneesturm: Dort schneit es quer, hier
   * verschwindet die Welt für Augenblicke ganz. Gerechnet wird hier nur der
   * Faktor - den Nebel setzt jede Szene selbst, denn sie regelt ihn ohnehin
   * schon nach dem, was das Gerät hergibt.
   */
  const sicht = (jetzt: number) => 1 - boe(jetzt) * 0.42;

  return { gruppe, bewegen, sicht };
}

/** Die Welt zieht unter dem Wetter weg - nur in der Verfolgungsjagd. */
function zugAnwenden(
  feld: THREE.BufferAttribute,
  zugZ: number,
  hinten: number,
  vorne: number,
): void {
  for (let i = 0; i < feld.count; i++) {
    const z = feld.getZ(i) - zugZ;
    feld.setZ(i, z < hinten ? vorne : z > vorne ? hinten : z);
  }
  feld.needsUpdate = true;
}

/* --- Das Schneeland -------------------------------------------------- */

/**
 * Was aus einer weißen Fläche eine Schneelandschaft macht.
 *
 * Die Schneestraße war lange nur eine helle Fahrbahn auf einem hellen Boden:
 * zwei Farbflächen, in denen das Auge nichts findet. Erst was darauf steht,
 * macht daraus ein Land - Wehen, in denen sich das Licht bricht, und
 * verschneite Tannen, an denen man sieht, wie weit es noch ist.
 *
 * Gebaut wird mit drei Geometrien und drei Materialien für alles zusammen:
 * Jede Wehe und jede Tanne ist nur ein weiteres Objekt auf denselben Daten,
 * und davon verträgt auch ein Handy einige Dutzend.
 */
const halbeTiefeVon = (ausmass: { tiefe: number }) => ausmass.tiefe / 2;

export function schneeLand(args: {
  scene: THREE.Scene;
  gradient: THREE.Texture;
  merken: Merken;
  /** Die Fläche, auf der etwas stehen darf - Kantenlängen in Metern. */
  ausmass: { breite: number; tiefe: number };
  /** Wo die Fläche liegt; der alte Straßenzug ist nach hinten versetzt. */
  mitteZ?: number;
  /** Der gelegte Stadtplan - dort bleiben Straßen und Häuser frei. */
  plan?: Stadtplan | null;
  /** Ohne Plan: Wie weit von der Straßenmitte nichts stehen darf. */
  freieBreite?: number;
  /** Ein Punkt, um den herum nichts steht - dort fängt man an zu laufen. */
  startPunkt?: { x: number; z: number } | null;
  /** Wie viele Stücke höchstens - das Gerät zählt mit. */
  menge?: number;
  /** Nachts ist der Schnee blau, tagsüber fast weiß. */
  tageszeit?: DreiDTageszeit;
}): void {
  const {
    scene, gradient, merken, ausmass, mitteZ = 0, plan = null,
    freieBreite = 5.4, startPunkt = null, menge = 26, tageszeit = "tag",
  } = args;

  const nacht = tageszeit === "nacht";
  const weheGeometrie = new THREE.IcosahedronGeometry(1, 0);
  const tanneGeometrie = new THREE.ConeGeometry(1, 3.4, 7);
  const hutGeometrie = new THREE.ConeGeometry(0.62, 1.5, 7);
  const schneeMaterial = new THREE.MeshToonMaterial({
    color: nacht ? 0xb9cfe4 : 0xf4fbff,
    gradientMap: gradient,
  });
  const tanneMaterial = new THREE.MeshToonMaterial({
    color: nacht ? 0x1d3b42 : 0x2f6a63,
    gradientMap: gradient,
  });
  for (const stueck of [weheGeometrie, tanneGeometrie, hutGeometrie, schneeMaterial, tanneMaterial]) {
    merken(stueck);
  }

  /*
   * Immer dieselbe Landschaft.
   *
   * Ein Zufall, der bei jedem Betreten neu würfelt, lässt die Wehen von
   * Besuch zu Besuch springen - und wer eine Stadt im Editor einrichtet,
   * sieht beim Spielen etwas anderes. Deshalb ein eigener, kleiner Würfel
   * mit festem Anfang.
   */
  let saat = 20260916;
  const zufall = () => {
    saat = (saat * 1664525 + 1013904223) % 4294967296;
    return saat / 4294967296;
  };

  /** Ist hier Platz? Auf Straßen, Häusern und vor den Füßen steht nichts. */
  const frei = (x: number, z: number): boolean => {
    if (startPunkt && Math.hypot(x - startPunkt.x, z - startPunkt.z) < 11) return false;
    if (!plan) return Math.abs(x) > freieBreite;
    const feld = feldBei(plan, x, z);
    return !imPlan(plan, feld.x, feld.z) || feldAn(plan, feld.x, feld.z) === "";
  };

  /*
   * Wie groß etwas sein darf, hängt davon ab, wie nah es an der Straße steht.
   *
   * Direkt am Rand liegt der Schnee, den der Pflug zur Seite geschoben hat:
   * flach und niedrig. Eine Tanne gehört dorthin nicht - sie stünde im Bild
   * und nähme die Sicht auf die Straße, für die die ganze Szene gebaut ist.
   */
  const amRand = (x: number) => !plan && Math.abs(x) < 14;

  /*
   * Der Wall, den der Pflug zur Seite geschoben hat.
   *
   * Es ist das Stück, an dem man eine Schneestraße erkennt: zwei lange,
   * niedrige Wälle rechts und links, in denen die Schneestangen stecken. Im
   * gelegten Stadtraster gibt es ihn nicht - dort liegt die Straße feldweise,
   * und ein durchgehender Wall stünde quer über Kreuzungen.
   */
  if (!plan) {
    /*
     * Nicht als langer Kasten: Eine Kante quer durchs Bild bekommt von der
     * Zeichenschattierung einen harten dunklen Streifen, und der sieht aus
     * wie eine Mauer. Aneinandergereihte Buckel dagegen sind das, was ein
     * Pflug hinterlässt.
     */
    for (const seite of [-1, 1]) {
      for (let z = -halbeTiefeVon(ausmass); z < halbeTiefeVon(ausmass); z += 3.1) {
        const buckel = new THREE.Mesh(weheGeometrie, schneeMaterial);
        const laenge = 1.9 + zufall() * 1.1;
        buckel.scale.set(1.15 + zufall() * 0.5, 0.42 + zufall() * 0.22, laenge);
        buckel.rotation.set(0, zufall() * 0.4, seite * 0.12);
        buckel.position.set(seite * (freieBreite + 0.5 + zufall() * 0.3), 0.02, mitteZ + z + zufall());
        buckel.castShadow = true;
        buckel.receiveShadow = true;
        scene.add(buckel);
      }
    }
  }

  const halbeBreite = ausmass.breite / 2;
  const halbeTiefe = halbeTiefeVon(ausmass);
  let gesetzt = 0;
  // Mehr Versuche als Stücke: Wer auf einer Straße landet, tritt zurück.
  for (let versuch = 0; versuch < menge * 4 && gesetzt < menge; versuch++) {
    const x = (zufall() - 0.5) * 2 * halbeBreite;
    const z = mitteZ + (zufall() - 0.5) * 2 * halbeTiefe;
    if (!frei(x, z)) continue;
    gesetzt++;

    if (amRand(x) || zufall() < 0.62) {
      // Eine Wehe: flach, breit, unregelmäßig gedreht.
      const wehe = new THREE.Mesh(weheGeometrie, schneeMaterial);
      const groesse = (amRand(x) ? 0.8 + zufall() * 0.9 : 1.1 + zufall() * 2.4);
      wehe.scale.set(groesse, groesse * (0.28 + zufall() * 0.2), groesse * (0.8 + zufall() * 0.5));
      wehe.rotation.set(zufall() * 0.3, zufall() * Math.PI, zufall() * 0.3);
      // Sie liegt im Boden, nicht darauf - sonst schwebt eine Kugel im Feld.
      wehe.position.set(x, -groesse * 0.06, z);
      // Erst der Schatten macht aus einer weißen Beule eine Wehe: Weiß auf
      // Weiß sieht man sonst nicht.
      wehe.castShadow = true;
      wehe.receiveShadow = true;
      scene.add(wehe);
      continue;
    }

    // Oder eine Tanne mit Schnee auf den Zweigen.
    const hoehe = 0.6 + zufall() * 0.55;
    const tanne = new THREE.Mesh(tanneGeometrie, tanneMaterial);
    tanne.scale.setScalar(hoehe);
    tanne.position.set(x, 3.4 * hoehe * 0.5, z);
    tanne.castShadow = true;
    const hut = new THREE.Mesh(hutGeometrie, schneeMaterial);
    hut.scale.setScalar(hoehe);
    hut.position.set(x, 3.4 * hoehe * 0.86, z);
    scene.add(tanne, hut);
  }
}

/* --- Das Grasland ---------------------------------------------------- */

/**
 * Was aus einer grünen Fläche eine Wiese macht.
 *
 * Dasselbe Problem wie beim Schnee, nur in Grün: Eine Farbfläche ist keine
 * Landschaft. Erst was darauf steht, macht sie zu einer - Büsche, Bäume mit
 * einem Stamm, an dem man die Entfernung ablesen kann, Grasbüschel am
 * Wegrand und ein paar Blumen dazwischen, die man einzeln kaum sieht und
 * ohne die es doch nach Rasen aussieht.
 *
 * Gebaut wird wie das Schneeland: wenige Geometrien und Materialien für
 * alles zusammen, jedes Stück nur ein weiteres Objekt auf denselben Daten.
 * Davon verträgt auch ein Handy einige Dutzend.
 */
export function grasLand(args: {
  scene: THREE.Scene;
  gradient: THREE.Texture;
  merken: Merken;
  /** Die Fläche, auf der etwas stehen darf - Kantenlängen in Metern. */
  ausmass: { breite: number; tiefe: number };
  /** Wo die Fläche liegt; der alte Straßenzug ist nach hinten versetzt. */
  mitteZ?: number;
  /** Der gelegte Stadtplan - dort bleiben Straßen und Häuser frei. */
  plan?: Stadtplan | null;
  /** Ohne Plan: Wie weit von der Straßenmitte nichts stehen darf. */
  freieBreite?: number;
  /** Ein Punkt, um den herum nichts steht - dort fängt man an zu laufen. */
  startPunkt?: { x: number; z: number } | null;
  /** Wie viele Stücke höchstens - das Gerät zählt mit. */
  menge?: number;
  /** Abends und nachts steht die Wiese in einem anderen Grün. */
  tageszeit?: DreiDTageszeit;
}): void {
  const {
    scene, gradient, merken, ausmass, mitteZ = 0, plan = null,
    freieBreite = 5.4, startPunkt = null, menge = 26, tageszeit = "tag",
  } = args;

  const nacht = tageszeit === "nacht";
  const abend = tageszeit === "abend";
  /*
   * Drei Geometrien für alles: eine Kugel (Busch und Baumkrone), ein Kegel
   * (Grasbüschel) und ein Zylinder (Stamm). Die Blumen sind dieselbe Kugel,
   * nur klein und bunt.
   */
  const kugelGeometrie = new THREE.IcosahedronGeometry(1, 0);
  const buschelGeometrie = new THREE.ConeGeometry(0.34, 0.9, 5);
  const stammGeometrie = new THREE.CylinderGeometry(0.12, 0.17, 1.6, 6);
  const gruen = (farbe: number) =>
    new THREE.MeshToonMaterial({ color: farbe, gradientMap: gradient });
  /** Zwei Grüntöne, damit nicht jeder Busch derselbe ist. */
  const laub = [
    gruen(nacht ? 0x1f3a2a : abend ? 0x4a6b3c : 0x3f7a44),
    gruen(nacht ? 0x27452f : abend ? 0x5d7a44 : 0x58913f),
  ];
  const halmMaterial = gruen(nacht ? 0x2c4a33 : abend ? 0x6c8348 : 0x7aa64c);
  const stammMaterial = gruen(nacht ? 0x2a2119 : 0x6b4f33);
  /** Die Blumen: Weiß, Gelb und Rot - nachts bleiben sie aus. */
  const blumen = [0xf6f2e2, 0xffd75e, 0xe8615c].map(
    (farbe) => new THREE.MeshBasicMaterial({ color: farbe }),
  );
  for (const stueck of [
    kugelGeometrie, buschelGeometrie, stammGeometrie,
    ...laub, halmMaterial, stammMaterial, ...blumen,
  ]) {
    merken(stueck);
  }

  /*
   * Immer dieselbe Wiese - derselbe Grund wie beim Schneeland: Wer eine
   * Stadt im Editor einrichtet, soll sie beim Spielen wiedererkennen.
   */
  let saat = 20260917;
  const zufall = () => {
    saat = (saat * 1664525 + 1013904223) % 4294967296;
    return saat / 4294967296;
  };

  /** Ist hier Platz? Auf Straßen, Häusern und vor den Füßen steht nichts. */
  const frei = (x: number, z: number): boolean => {
    if (startPunkt && Math.hypot(x - startPunkt.x, z - startPunkt.z) < 11) return false;
    if (!plan) return Math.abs(x) > freieBreite;
    const feld = feldBei(plan, x, z);
    return !imPlan(plan, feld.x, feld.z) || feldAn(plan, feld.x, feld.z) === "";
  };

  /** Dicht am Weg wächst nur Gras - ein Baum dort nähme die Sicht. */
  const amRand = (x: number) => !plan && Math.abs(x) < 14;

  /** Ein Grasbüschel - drei schiefe Halme aus einem Kegel. */
  const buschel = (x: number, z: number, groesse: number) => {
    for (let i = 0; i < 3; i++) {
      const halm = new THREE.Mesh(buschelGeometrie, halmMaterial);
      halm.scale.set(groesse, groesse * (0.8 + zufall() * 0.7), groesse);
      halm.rotation.set((zufall() - 0.5) * 0.5, zufall() * Math.PI, (zufall() - 0.5) * 0.5);
      halm.position.set(x + (zufall() - 0.5) * 0.5, 0.35 * groesse, z + (zufall() - 0.5) * 0.5);
      halm.castShadow = true;
      scene.add(halm);
    }
  };

  /*
   * Der Saum am Wegrand.
   *
   * Beim Schnee ist es der Wall des Pflugs, hier das hohe Gras, das
   * stehenbleibt, wo keine Räder fahren. Im Stadtraster gibt es ihn nicht -
   * dort liegt die Straße feldweise, und ein durchgehender Saum stünde quer
   * über jeder Kreuzung.
   */
  if (!plan) {
    for (const seite of [-1, 1]) {
      for (let z = -ausmass.tiefe / 2; z < ausmass.tiefe / 2; z += 2.6) {
        buschel(
          seite * (freieBreite + 0.3 + zufall() * 0.5),
          mitteZ + z + zufall(),
          0.7 + zufall() * 0.5,
        );
      }
    }
  }

  const halbeBreite = ausmass.breite / 2;
  const halbeTiefe = ausmass.tiefe / 2;
  let gesetzt = 0;
  // Mehr Versuche als Stücke: Wer auf einer Straße landet, tritt zurück.
  for (let versuch = 0; versuch < menge * 4 && gesetzt < menge; versuch++) {
    const x = (zufall() - 0.5) * 2 * halbeBreite;
    const z = mitteZ + (zufall() - 0.5) * 2 * halbeTiefe;
    if (!frei(x, z)) continue;
    gesetzt++;
    const wuerfel = zufall();

    // Nah am Weg: Gras und Blumen, nichts, was die Sicht nimmt.
    if (amRand(x) || wuerfel < 0.3) {
      buschel(x, z, 0.8 + zufall() * 0.6);
      if (!nacht && zufall() < 0.55) {
        const blume = new THREE.Mesh(kugelGeometrie, blumen[Math.floor(zufall() * blumen.length)]);
        const gross = 0.07 + zufall() * 0.05;
        blume.scale.setScalar(gross);
        blume.position.set(x + (zufall() - 0.5) * 1.2, 0.5 + zufall() * 0.2, z + (zufall() - 0.5) * 1.2);
        scene.add(blume);
      }
      continue;
    }

    // Ein Busch: flach, breit, in einem der beiden Grüntöne.
    if (wuerfel < 0.68) {
      const busch = new THREE.Mesh(kugelGeometrie, laub[Math.floor(zufall() * laub.length)]);
      const groesse = 0.7 + zufall() * 1.1;
      busch.scale.set(groesse, groesse * (0.55 + zufall() * 0.35), groesse * (0.85 + zufall() * 0.4));
      busch.rotation.set(zufall() * 0.3, zufall() * Math.PI, zufall() * 0.3);
      busch.position.set(x, groesse * 0.35, z);
      busch.castShadow = true;
      busch.receiveShadow = true;
      scene.add(busch);
      continue;
    }

    // Oder ein Baum: Stamm und eine Krone aus zwei versetzten Kugeln.
    const hoehe = 0.9 + zufall() * 0.8;
    const stamm = new THREE.Mesh(stammGeometrie, stammMaterial);
    stamm.scale.set(hoehe, hoehe, hoehe);
    stamm.position.set(x, 0.8 * hoehe, z);
    stamm.castShadow = true;
    scene.add(stamm);
    const ton = laub[Math.floor(zufall() * laub.length)];
    for (const versatz of [0, 1]) {
      const krone = new THREE.Mesh(kugelGeometrie, ton);
      const weite = (1.05 + zufall() * 0.5) * hoehe * (versatz ? 0.72 : 1);
      krone.scale.set(weite, weite * 0.85, weite);
      krone.position.set(
        x + (versatz ? (zufall() - 0.5) * 0.9 * hoehe : 0),
        (versatz ? 2.35 : 1.95) * hoehe,
        z + (versatz ? (zufall() - 0.5) * 0.9 * hoehe : 0),
      );
      krone.castShadow = true;
      scene.add(krone);
    }
  }
}

/* --- Der Sandsturm -------------------------------------------------- */

/**
 * Der Sandsturm ist die einzige Lage, die der ganzen Szene ihre Farbe nimmt.
 *
 * Schnee und Nebel legen sich weiß-blau über die Stadt; Sand färbt sie ocker,
 * schluckt das Licht und fliegt waagerecht. Damit die Straße im Kapitel und
 * der Platz im Kampf im selben Sturm stehen, rechnen beide mit denselben
 * Zahlen von hier - sonst wäre es zweimal ein anderes Wetter.
 */

/** Bis hierher steht der Sand in der Luft; darüber ist die Böe durch. */
export const SAND_HOEHE = 9;

/** Die Farbe von Dunst und Himmel - tagsüber ocker, nachts fast erloschen. */
export const sandDunst = (tageszeit: DreiDTageszeit): number =>
  tageszeit === "nacht" ? 0x2a2015 : tageszeit === "abend" ? 0x8a5330 : 0xc6a066;

/** Die Sonne steht als warmer Fleck dahinter, statt zu scheinen. */
export const SAND_LICHT = 0xffd49a;

/** Wie die Körner selbst aussehen - feiner als Flocken und satter im Ton. */
export const SAND_KORN = { farbe: 0xd8b273, groesse: 0.1, deckkraft: 0.72 };

/**
 * Ein Feld Sandkörner, gleichmäßig über der Fläche verteilt.
 *
 * `weite` und `tiefe` sind die Kanten des Ausschnitts, in dem der Sturm
 * steht; `versatzZ` schiebt ihn dorthin, wo die Kamera hinsieht (im Kapitel
 * liegt die Straße vor einem, in der Arena steht man mittendrin).
 */
export function sandKoerner(
  anzahl: number,
  weite: number,
  tiefe: number,
  versatzZ = 0,
): Float32Array {
  const positionen = new Float32Array(anzahl * 3);
  for (let i = 0; i < anzahl; i++) {
    positionen[i * 3] = Math.random() * weite - weite / 2;
    // Unten dichter als oben: Das meiste, was ein Sturm trägt, trägt er knapp
    // über dem Boden.
    positionen[i * 3 + 1] = Math.random() ** 1.7 * SAND_HOEHE;
    positionen[i * 3 + 2] = Math.random() * tiefe - tiefe / 2 + versatzZ;
  }
  return positionen;
}

/**
 * Den Sand weitertreiben: quer durchs Bild, böig, kaum fallend.
 *
 * Wer hinten hinausfliegt, kommt vorne wieder herein - so bleibt der Sturm
 * gleich dicht, ohne dass ständig neue Körner entstehen müssten.
 */
export function sandTreiben(
  positionen: THREE.BufferAttribute,
  dt: number,
  jetzt: number,
  weite: number,
): void {
  const halb = weite / 2;
  for (let i = 0; i < positionen.count; i++) {
    // Die Böe wechselt langsam; der Versatz je Korn macht aus einer Wand
    // einzelne Schlieren.
    const boe = 15 + Math.sin(jetzt * 0.0012 + i * 0.017) * 6;
    const x = positionen.getX(i) + boe * dt;
    positionen.setX(i, x > halb ? -halb : x);
    const y = positionen.getY(i) - dt * (0.5 + Math.sin(jetzt * 0.002 + i) * 0.4);
    positionen.setY(i, y < 0 ? SAND_HOEHE : y);
  }
  positionen.needsUpdate = true;
}

/**
 * Wie stark die Kulisse aus sich selbst leuchtet.
 *
 * Die Stadtbausteine bringen kein Leuchten mit - ihre Neonschilder sind nur
 * aufgemalt und bleiben deshalb nachts genauso dunkel wie eine Hauswand.
 * Darum wird die Farbtextur zusätzlich als Leuchttextur gesetzt: Helle
 * Stellen (Schilder, Fenster, Lampen) geben dann Licht ab, dunkle kaum. Das
 * kostet nichts und macht aus einer flachen Nacht eine Stadt.
 */
export const LEUCHTEN: Record<DreiDTageszeit, number> = {
  nacht: 0.62,
  abend: 0.34,
  morgen: 0.12,
  tag: 0,
};

export function cellShading(
  objekt: THREE.Object3D,
  gradient: THREE.Texture,
  clippingPlanes: THREE.Plane[] = [],
  /** 0 = gar nicht, 1 = volle Eigenhelligkeit. Nur für Kulissen. */
  leuchten = 0,
) {
  objekt.traverse((kind) => {
    if (!(kind instanceof THREE.Mesh)) return;
    kind.castShadow = true;
    kind.receiveShadow = true;
    // Animierte Meshy-Skelette überschreiten ihre Bounding-Sphere der Ruhepose.
    if (kind instanceof THREE.SkinnedMesh) kind.frustumCulled = false;
    const mehrfach = Array.isArray(kind.material);
    const materialien: THREE.Material[] = mehrfach ? kind.material : [kind.material];
    const toon = materialien.map((material: THREE.Material) => {
      const quelle = material as THREE.MeshStandardMaterial;
      const materialNeu = new THREE.MeshToonMaterial({
        color: quelle.color?.clone() ?? new THREE.Color(0xffffff),
        map: quelle.map ?? null,
        gradientMap: gradient,
        transparent: quelle.transparent,
        opacity: quelle.opacity,
        alphaTest: quelle.alphaTest,
        side: quelle.side,
        emissive: new THREE.Color(leuchten > 0 ? 0xffffff : 0x000000),
        emissiveMap: leuchten > 0 ? (quelle.emissiveMap ?? quelle.map ?? null) : null,
        emissiveIntensity: leuchten,
      });
      materialNeu.clippingPlanes = clippingPlanes;
      materialNeu.clipShadows = clippingPlanes.length > 0;
      return materialNeu;
    });
    kind.material = mehrfach ? toon : toon[0];
  });
}

export function einpassen(objekt: THREE.Object3D, hoehe: number) {
  objekt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(objekt);
  const groesse = box.getSize(new THREE.Vector3());
  objekt.scale.multiplyScalar(hoehe / Math.max(0.001, groesse.y));
  objekt.updateMatrixWorld(true);
  const neu = new THREE.Box3().setFromObject(objekt);
  const mitte = neu.getCenter(new THREE.Vector3());
  objekt.position.set(-mitte.x, -neu.min.y, -mitte.z);
}

/**
 * Texturen kleinrechnen.
 *
 * Hier steckt der Absturz. Ein Baustein bringt drei Texturen mit, und eine
 * 2048er Textur belegt entpackt 16 Megabyte - einmal auf der Grafikkarte und
 * noch einmal daneben, solange das geladene Bild selbst herumliegt. Fünf
 * Bauarten sind so ein halbes Gigabyte, und dann macht Safari den Tab zu.
 * Verkleinert und das Original geschlossen bleibt davon ein Bruchteil - und
 * auf einem Handybildschirm sieht man den Unterschied nicht.
 */
export function texturenVerkleinern(objekt: THREE.Object3D, grenze: number) {
  const erledigt = new Set<THREE.Texture>();
  objekt.traverse((kind) => {
    if (!(kind instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(kind.material) ? kind.material : [kind.material]) {
      for (const wert of Object.values(material)) {
        if (!(wert instanceof THREE.Texture) || erledigt.has(wert)) continue;
        erledigt.add(wert);
        const bild = wert.image as { width?: number; height?: number } | null;
        const breite = Number(bild?.width) || 0;
        const hoehe = Number(bild?.height) || 0;
        if (!breite || !hoehe || Math.max(breite, hoehe) <= grenze) continue;
        const faktor = grenze / Math.max(breite, hoehe);
        const leinwand = document.createElement("canvas");
        leinwand.width = Math.max(1, Math.round(breite * faktor));
        leinwand.height = Math.max(1, Math.round(hoehe * faktor));
        const stift = leinwand.getContext("2d");
        if (!stift) continue;
        try {
          stift.drawImage(bild as CanvasImageSource, 0, 0, leinwand.width, leinwand.height);
        } catch {
          continue;
        }
        if (typeof ImageBitmap !== "undefined" && bild instanceof ImageBitmap) bild.close();
        wert.image = leinwand;
        wert.needsUpdate = true;
      }
    }
  });
}

/**
 * Einen Baustein als Gebäude auf ein Rasterfeld stellen.
 *
 * Damit aus Feldern eine Straße wird und keine Reihe einzeln stehender
 * Klötze, geschieht dreierlei:
 *
 * 1. Das Haus dreht sich zur Straße. Die Bausteine schauen in ihrer Datei
 *    nach +z; `richtung` ist der Weg zum Nachbarfeld mit Fahrbahn.
 * 2. Es wird so skaliert, dass seine Breite entlang der Straße genau ein
 *    Feld füllt - dann stoßen benachbarte Häuser ohne Lücke aneinander und
 *    ergeben eine geschlossene Häuserzeile.
 * 3. Seine Vorderkante rückt an die Feldgrenze zur Straße. Was es in die
 *    Tiefe braucht, wächst nach hinten, nicht in die Fahrbahn.
 */
export function aufFeldEinpassen(
  objekt: THREE.Object3D,
  richtung: { x: number; z: number } | null,
  drehung: number,
  /** Höhenfaktor aus dem Editor: 1 = Stadthöhe, 2 = doppelt so hoch. */
  hoehe = 1,
) {
  const blick = richtung ? Math.atan2(richtung.x, richtung.z) : 0;
  objekt.rotation.y = blick + THREE.MathUtils.degToRad(drehung);
  objekt.updateMatrixWorld(true);
  const gedreht = new THREE.Box3().setFromObject(objekt);
  const groesse = gedreht.getSize(new THREE.Vector3());
  // Quer zur Blickrichtung liegt die Straßenfront, längs die Bautiefe.
  const laengsX = Math.abs(richtung?.x ?? 0) > Math.abs(richtung?.z ?? 0);
  const front = laengsX ? groesse.z : groesse.x;
  const tiefe = laengsX ? groesse.x : groesse.z;
  objekt.scale.multiplyScalar(
    Math.min(
      FELD_GROESSE / Math.max(0.001, front),
      // Ein sehr tiefer Baustein würde sonst durch die Rückseite des
      // Nachbarfeldes stoßen.
      (FELD_GROESSE * 1.4) / Math.max(0.001, tiefe),
    ),
  );
  objekt.updateMatrixWorld(true);
  /*
   * Und jetzt die Höhe.
   *
   * Passt man einen Baustein nur in die Feldbreite ein, wird aus einem
   * vierstöckigen Haus schnell ein Bungalow: Die Bausteine zeigen ganze
   * Häuserzeilen, und was in der Breite auf neun Meter schrumpft, schrumpft
   * in der Höhe mit. Neben einem Tier von zwei Metern sieht das aus wie eine
   * Spielzeugstadt. Deshalb wird nur die Höhe nachgezogen - die Straßenfront
   * bleibt unangetastet, sonst risse die Häuserzeile auf.
   */
  const jetzt = new THREE.Box3().setFromObject(objekt).getSize(new THREE.Vector3());
  const streckung = THREE.MathUtils.clamp(
    (STADT_HOEHE * hoehe) / Math.max(0.001, jetzt.y),
    // Nach unten darf der Faktor alles, nach oben bleibt die Dehnung im Rahmen:
    // Ein Haus auf das Dreifache zu ziehen, sieht man ihm an.
    hoehe < 1 ? 0.35 : 1,
    2.6,
  );
  objekt.scale.y *= streckung;
  objekt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(objekt);
  const mitte = box.getCenter(new THREE.Vector3());
  objekt.position.y -= box.min.y;
  // Quer zur Straße mittig, zur Straße hin bündig an die Feldkante.
  const kante = FELD_GROESSE / 2 - 0.55;
  if (!richtung) {
    objekt.position.x -= mitte.x;
    objekt.position.z -= mitte.z;
    return;
  }
  if (laengsX) {
    objekt.position.z -= mitte.z;
    objekt.position.x += Math.sign(richtung.x) * kante - (richtung.x > 0 ? box.max.x : box.min.x);
  } else {
    objekt.position.x -= mitte.x;
    objekt.position.z += Math.sign(richtung.z) * kante - (richtung.z > 0 ? box.max.z : box.min.z);
  }
}

/** Der Belag der Fahrbahn - gerechnet, nicht geladen. */
export function fahrbahnMaterial(args: {
  gradient: THREE.Texture;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  /** true für den gelegten Plan, false für den alten Straßenzug. */
  imRaster: boolean;
  merken: Merken;
}): THREE.MeshToonMaterial {
  const { gradient, strassentyp, tageszeit, wetter, imRaster, merken } = args;
  const asphalt = imRaster && strassentyp === "asphalt" ? asphaltTextur(tageszeit === "nacht") : null;
  if (asphalt) merken(asphalt);
  const natur = strassentyp !== "asphalt" ? naturStrassenTextur(strassentyp) : null;
  if (natur) merken(natur);
  const material = new THREE.MeshToonMaterial({
    map: natur ?? asphalt,
    /*
     * Im Sandsturm liegt auf allem eine Schicht Sand - auch auf dem Asphalt.
     * Ohne diesen Ton stünde eine blaugraue Straße in einer ockerfarbenen
     * Luft, und der Sturm wirkte wie ein Filter über einem anderen Bild.
     */
    color: wetter === "sandsturm"
      ? strassentyp === "asphalt" && !imRaster ? 0x6f6047 : 0xc2a878
      /*
       * Regen auf Schnee ist Schneematsch - aber immer noch Schnee. Der
       * erdige Ton, den die Sandpiste im Regen bekommt, machte aus der
       * Schneefahrbahn einen gelblichen Streifen; sie wird jetzt nur kühler
       * und ein wenig dunkler.
       */
      : strassentyp === "schnee"
      // Die geräumte Fahrbahn ist festgefahren und damit eine Spur dunkler
      // und kälter als der Schnee daneben; im Regen wird sie zu Matsch.
      ? wetter === "regen" ? 0xc8d9e8 : 0xe8f1fa
      /*
       * Die Graspiste bringt ihre Farbe in der Textur mit - hier wird sie
       * nur noch von Wetter und Tageszeit angefasst: Regen macht aus den
       * Spurrillen Matsch, und nachts liegt die Wiese im Mondlicht, statt
       * so grün zu leuchten wie am Mittag.
       */
      : strassentyp === "gras"
      ? wetter === "regen" ? 0xa8b596 : tageszeit === "nacht" ? 0x93a892 : 0xffffff
      : strassentyp !== "asphalt"
      ? wetter === "regen" ? 0xb1a18a : 0xffffff
      : wetter === "regen" ? 0x263a4a : imRaster ? 0xffffff : tageszeit === "nacht" ? 0x202b3c : 0x52606c,
    gradientMap: gradient,
  });
  merken(material);
  return material;
}

/**
 * Die Fahrbahn: jedes Straßenfeld eine Fläche.
 *
 * Kreuzungen, Ecken und Sackgassen entstehen dabei von allein - es liegt eben
 * nur dort Fahrbahn, wo im Plan eine steht. Dazu kommt, was aus einer Fläche
 * erst eine Straße macht: eine Laterne an jeder zweiten Ecke und eine
 * Mittellinie, wo es geradeaus weitergeht.
 */
export function strassenBauen(args: {
  scene: THREE.Scene;
  plan: Stadtplan;
  gradient: THREE.Texture;
  belag: THREE.Material;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  merken: Merken;
}): StadtBlock[] {
  const { scene, plan, gradient, belag, strassentyp, tageszeit, merken } = args;
  const bloecke: StadtBlock[] = [];
  const feldGeometrie = new THREE.PlaneGeometry(FELD_GROESSE, FELD_GROESSE);
  merken(feldGeometrie);
  const strichGeometrie = new THREE.PlaneGeometry(0.16, 2.2);
  const strichMaterial = new THREE.MeshBasicMaterial({
    color: strassentyp === "asphalt" ? 0xe8e2b8 : 0xdfe7ea,
    transparent: true,
    // Auf die Graspiste malt niemand eine Mittellinie - dort werden gar
    // keine gesetzt (siehe unten).
    opacity: 0.65,
  });
  merken(strichGeometrie);
  merken(strichMaterial);

  /*
   * Straßenlaternen.
   *
   * Sie tragen die Nacht: ein dunkler Mast, ein leuchtender Kopf und ein
   * weicher Lichtteppich auf dem Asphalt. Echte Lichtquellen wären für ein
   * Handy zu teuer - das hier kostet drei kleine Meshes je Laterne und sieht
   * auf dem Bildschirm genauso aus.
   */
  const nachts = tageszeit === "nacht" || tageszeit === "abend";
  const mastGeometrie = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6);
  const mastMaterial = new THREE.MeshToonMaterial({ color: 0x2b3440, gradientMap: gradient });
  const kopfGeometrie = new THREE.BoxGeometry(0.5, 0.18, 0.32);
  const kopfMaterial = new THREE.MeshBasicMaterial({ color: nachts ? 0xffe6ae : 0xdfe4e8 });
  const scheinGeometrie = new THREE.CircleGeometry(2.6, 18);
  const scheinMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd79a,
    transparent: true,
    opacity: tageszeit === "nacht" ? 0.16 : tageszeit === "abend" ? 0.09 : 0,
    depthWrite: false,
  });
  for (const geo of [mastGeometrie, kopfGeometrie, scheinGeometrie]) merken(geo);
  for (const mat of [mastMaterial, kopfMaterial, scheinMaterial]) merken(mat);
  // x und z sind feldlokal: Laternen hängen an der Gruppe ihres Feldes und
  // verschwinden mit ihr, sobald das Feld zu weit weg ist.
  const laterne = (eltern: THREE.Object3D, x: number, z: number, nach: { x: number; z: number }) => {
    const mast = new THREE.Mesh(mastGeometrie, mastMaterial);
    mast.position.set(x, 1.7, z);
    mast.castShadow = true;
    eltern.add(mast);
    const kopf = new THREE.Mesh(kopfGeometrie, kopfMaterial);
    kopf.position.set(x - nach.x * 0.35, 3.35, z - nach.z * 0.35);
    kopf.rotation.y = Math.atan2(nach.x, nach.z);
    eltern.add(kopf);
    if (scheinMaterial.opacity > 0) {
      const schein = new THREE.Mesh(scheinGeometrie, scheinMaterial);
      schein.rotation.x = -Math.PI / 2;
      schein.position.set(x - nach.x * 1.1, 0.05, z - nach.z * 1.1);
      eltern.add(schein);
    }
  };

  for (const feld of strassenFelder(plan)) {
    const mitte = feldMitte(plan, feld.x, feld.z);
    const flaeche = new THREE.Mesh(feldGeometrie, belag);
    flaeche.rotation.x = -Math.PI / 2;
    // Viertelweise gedreht: Derselbe Belag wiederholt sich dadurch nicht
    // sichtbar von Feld zu Feld.
    flaeche.rotation.z = ((feld.x * 3 + feld.z * 7) % 4) * (Math.PI / 2);
    flaeche.position.set(mitte.x, 0.012, mitte.z);
    flaeche.receiveShadow = true;
    scene.add(flaeche);
    // Laternen und Striche eines Feldes hängen zusammen an einer Gruppe. Die
    // Fahrbahn selbst bleibt liegen - sie kostet zwei Dreiecke und trägt den
    // Boden, auch wenn das Feld im Nebel steht.
    const schmuck = new THREE.Group();
    schmuck.position.set(mitte.x, 0, mitte.z);

    const nachbarn = {
      nord: istStrasse(plan, feld.x, feld.z - 1),
      sued: istStrasse(plan, feld.x, feld.z + 1),
      west: istStrasse(plan, feld.x - 1, feld.z),
      ost: istStrasse(plan, feld.x + 1, feld.z),
    };
    /*
     * Kein Bordstein. Eine umlaufende Steinkante macht aus jeder Straße eine
     * Rennbahn und aus der Stadt ein Modell - die Häuser stehen jetzt ohnehin
     * direkt an der Fahrbahn, und dort, wo eine Straße endet, sieht man das
     * an den Häusern.
     *
     * Was bleibt, ist die Laterne an jeder zweiten Ecke.
     */
    const kante = FELD_GROESSE / 2 - 0.4;
    for (const [seite, offen] of Object.entries(nachbarn)) {
      if (offen || (feld.x + feld.z) % 2 !== 0) continue;
      const nach =
        seite === "nord" ? { x: 0, z: -1 }
          : seite === "sued" ? { x: 0, z: 1 }
            : seite === "ost" ? { x: 1, z: 0 }
              : { x: -1, z: 0 };
      laterne(schmuck, nach.x * kante, nach.z * kante, nach);
    }
    // Mittellinie nur auf der durchgehenden Strecke, nicht auf Kreuzungen -
    // und gar nicht auf der Graspiste (siehe strichMaterial).
    const laengs = nachbarn.nord && nachbarn.sued && !nachbarn.west && !nachbarn.ost;
    const quer = nachbarn.west && nachbarn.ost && !nachbarn.nord && !nachbarn.sued;
    if ((laengs || quer) && strassentyp !== "gras") {
      for (const versatz of [-2.4, 0, 2.4]) {
        const strich = new THREE.Mesh(strichGeometrie, strichMaterial);
        strich.rotation.x = -Math.PI / 2;
        if (laengs) strich.position.set(0, 0.03, versatz);
        else {
          strich.rotation.z = Math.PI / 2;
          strich.position.set(versatz, 0.03, 0);
        }
        schmuck.add(strich);
      }
    }
    if (schmuck.children.length) {
      scene.add(schmuck);
      bloecke.push({
        gruppe: schmuck,
        mitte: new THREE.Vector3(mitte.x, 1.5, mitte.z),
        materialien: [],
        feld: null,
        sicht: 1,
      });
    }
  }
  return bloecke;
}

/**
 * Die Häuser: Feld für Feld ein Baustein.
 *
 * `vorlagen` sind die fertig geladenen und schon eingefärbten Bausteine, je
 * Id einer. Derselbe darf beliebig oft vorkommen - geladen wurde er einmal
 * und wird hier nur noch kopiert; Geometrie und Texturen teilen sich alle
 * Kopien, und genau deshalb kostet Wiederholung nichts.
 *
 * Zurück kommt neben den Blöcken auch, vor welcher Haus-Id man wo steht -
 * daraus macht das Kapitel den Ring vor Tankstelle und Wache.
 */
export function haeuserBauen(args: {
  scene: THREE.Scene;
  plan: Stadtplan;
  vorlagen: Map<string, THREE.Object3D>;
}): {
  bloecke: StadtBlock[];
  /** Auf welchen Feldern tatsächlich ein Haus steht - "x,z". */
  hausFelder: Set<string>;
  /** Der Platz vor dem ersten Haus je Baustein-Id. */
  tuerPlaetze: Map<string, { x: number; z: number }>;
} {
  const { scene, plan, vorlagen } = args;
  const bloecke: StadtBlock[] = [];
  const hausFelder = new Set<string>();
  const tuerPlaetze = new Map<string, { x: number; z: number }>();

  for (const feld of gebaeudeFelder(plan)) {
    const vorlage = vorlagen.get(feld.id);
    if (!vorlage) continue;
    // Zu welcher Straße schaut das Haus? Die erste, die danebenliegt.
    const nachbar = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dz]) => ({ x: dx, z: dz }))
      .find((weg) => istStrasse(plan, feld.x + weg.x, feld.z + weg.z)) ?? null;
    const haus = vorlage.clone(true);
    aufFeldEinpassen(haus, nachbar, feld.drehung, hoeheFuer(plan, feld.id));
    const mitte = feldMitte(plan, feld.x, feld.z);
    const block = new THREE.Group();
    block.add(haus);
    block.position.set(mitte.x, 0, mitte.z);
    scene.add(block);
    /*
     * Jeder Block bekommt eigene Materialien. Geometrie und Texturen teilen
     * sich die Kopien weiterhin - das kostet also so gut wie nichts - aber
     * nur so lässt sich ein einzelnes Haus wegblenden, ohne dass alle
     * gleichen Häuser mitverschwinden.
     *
     * Durchscheinfähig sind sie von Anfang an. Das im Spiel umzuschalten
     * hieße, den Shader neu zu bauen, und zwar genau in dem Moment, in dem
     * die Kamera ohnehin schon in der Wand steht.
     */
    const materialien: THREE.Material[] = [];
    haus.traverse((kind) => {
      if (!(kind instanceof THREE.Mesh)) return;
      const mehrfach = Array.isArray(kind.material);
      const eigen = (mehrfach ? kind.material : [kind.material]).map((material: THREE.Material) => {
        const kopie = material.clone();
        kopie.transparent = true;
        kopie.depthWrite = true;
        return kopie;
      });
      kind.material = mehrfach ? eigen : eigen[0];
      materialien.push(...eigen);
    });
    bloecke.push({
      gruppe: block,
      mitte: new THREE.Vector3(mitte.x, STADT_HOEHE / 2, mitte.z),
      materialien,
      feld: { x: feld.x, z: feld.z },
      sicht: 1,
    });
    hausFelder.add(`${feld.x},${feld.z}`);
    /*
     * Steht hier eine Anlaufstelle, liegt ihr Platz direkt davor - am
     * Bordstein, nicht in der Mitte der Straße dahinter. Weiter als knapp
     * zwei Meter vom Haus weg sucht man den Ring, statt ihn zu sehen; näher
     * heran ginge nicht, dort steht die Wand.
     */
    if (nachbar && !tuerPlaetze.has(feld.id)) {
      tuerPlaetze.set(feld.id, vorDerTuer(plan, feld.x, feld.z, nachbar));
    }
  }
  return { bloecke, hausFelder, tuerPlaetze };
}
