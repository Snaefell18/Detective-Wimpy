import * as THREE from "three";
import {
  FELD_GROESSE,
  STADT_HOEHE,

  feldMitte,
  gebaeudeFelder,
  hoeheFuer,
  istStrasse,
  strassenFelder,
  vorDerTuer,
  type Stadtplan,
} from "@/lib/stadtplan";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "@/lib/pursuit3d";

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

export function naturStrassenTextur(schnee: boolean) {
  const breite = 128, laenge = 512;
  const pixel = new Uint8Array(breite * laenge * 4);
  for (let y = 0; y < laenge; y++) {
    for (let x = 0; x < breite; x++) {
      const u = x / (breite - 1);
      const rauschen = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const korn = (rauschen - Math.floor(rauschen) - 0.5) * 14;
      const spur = [0.22, 0.38, 0.62, 0.78].reduce((summe, mitte) =>
        summe + Math.exp(-(((u - mitte - Math.sin(y * 0.035) * 0.003) / 0.027) ** 2)), 0);
      const rand = Math.pow(Math.abs(u - 0.5) * 2, 8);
      const riffeln = Math.sin(y * 0.7 + u * 22) * 3;
      const basis = schnee ? [222, 236, 244] : [199, 160, 105];
      const farbe = basis.map((v) => THREE.MathUtils.clamp(v + korn + riffeln - spur * (schnee ? 44 : 29) + rand * (schnee ? 10 : -22), 0, 255));
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
  const natur = strassentyp !== "asphalt" ? naturStrassenTextur(strassentyp === "schnee") : null;
  if (natur) merken(natur);
  const material = new THREE.MeshToonMaterial({
    map: natur ?? asphalt,
    color: strassentyp !== "asphalt"
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
    // Mittellinie nur auf der durchgehenden Strecke, nicht auf Kreuzungen.
    const laengs = nachbarn.nord && nachbarn.sued && !nachbarn.west && !nachbarn.ost;
    const quer = nachbarn.west && nachbarn.ost && !nachbarn.nord && !nachbarn.sued;
    if (laengs || quer) {
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
