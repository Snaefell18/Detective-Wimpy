"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { kapitelPosition } from "@/lib/saga3dLayout";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { modellFuerTier, spielerModell } from "@/lib/tiermodelle";
import {
  STILLSTAND,
  angeeckt,
  angezeigtesTempo,
  fahrSchritt,
  fahrwerte,
  type FahrWerte,
  type Fahrzustand,
} from "@/lib/autofahrt";
import { AUTO_MODELLE, START_AUTO_ID, type Auto } from "@/lib/autos";
import { useAutos } from "@/lib/useAutos";
import { postJson } from "@/lib/api";
import { herkunftsZeile, type Beweismittel } from "@/lib/beweismittel";
import { laufAnimation } from "@/lib/pursuit";
import { DREI_D_LOCATIONS, locationsFuer3D, tankstelleAus } from "@/lib/pursuit3d";
import {
  FELD_GROESSE,
  STADT_HOEHE,
  hoeheFuer,
  begehbar,
  feldAn,
  feldMitte,
  gebaeudeFelder,
  istStrasse,
  planAusmass,
  planGueltig,
  startFeld,
  strassenFelder,
  verteilen,
  type Stadtplan,
} from "@/lib/stadtplan";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "@/lib/pursuit3d";
import type { Character, PublicCase } from "@/lib/types";
import type { Fund } from "@/lib/useGame";
import { FundMoment } from "./FundMoment";

type Richtung = { x: number; z: number };
const LEERE_SPUREN: SpurVorschau[] = [];
const STANDARD_GROESSEN: Record<string, number> = {};
const KEIN_BESITZ: Record<string, number> = {};
type SpurVorschau = { itemId: string; ortId: string; name: string; bild: string | null };
type Naehe =
  | { art: "tier"; id: string; name: string }
  | { art: "spur"; id: string; ortId: string; name: string }
  | { art: "tankstelle"; id: string; name: string }
  | { art: "wagen"; id: string; name: string };

/**
 * Was die Szene über Wimpys Auto wissen muss.
 *
 * Das läuft absichtlich über ein Ref und nicht über Eigenschaften: Die Stadt
 * wird beim Aufbau einmal zusammengesetzt, und ein Wagenwechsel darf sie
 * nicht neu bauen lassen. Die Szene sieht in jedem Bild nach, was hier steht.
 */
export type FahrzeugBefehl = {
  /** Der Wagen, den Wimpy gerade fährt - null heißt: zu Fuß. */
  faehrt: {
    id: string;
    name: string;
    modell: string;
    drehung: number;
    /** Aus dem Autokatalog: bestimmt Tempo, Schub und Lenkung. */
    speed: number;
    beschleunigung: number;
  } | null;
  /**
   * Beim Aussteigen: Bleibt der Wagen stehen (abstellen) oder wird er an der
   * Tankstelle abgegeben und verschwindet?
   */
  abgeben: boolean;
  /** Handbremse - solange sie gezogen ist, bricht der Wagen aus. */
  handbremse?: boolean;
};

export const LEERER_FAHRZEUGBEFEHL: FahrzeugBefehl = { faehrt: null, abgeben: false };


function TouchJoystick({ setzen }: { setzen: (x: number, z: number) => void }) {
  const knauf = useRef<HTMLSpanElement>(null);
  const finger = useRef<number | null>(null);
  const aktuell = useRef(setzen);
  aktuell.current = setzen;
  const stoppen = () => {
    finger.current = null;
    aktuell.current(0, 0);
    if (knauf.current) knauf.current.style.transform = "translate(0, 0)";
  };
  useEffect(() => {
    window.addEventListener("blur", stoppen);
    document.addEventListener("visibilitychange", stoppen);
    return () => {
      window.removeEventListener("blur", stoppen);
      document.removeEventListener("visibilitychange", stoppen);
      aktuell.current(0, 0);
    };
  }, []);
  const bewegen = (e: React.PointerEvent<HTMLDivElement>) => {
    if (finger.current !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    const radius = box.width * 0.3;
    const dx = e.clientX - box.left - box.width / 2;
    const dz = e.clientY - box.top - box.height / 2;
    const distanz = Math.hypot(dx, dz);
    const faktor = Math.min(1, radius / Math.max(1, distanz));
    if (knauf.current) knauf.current.style.transform = `translate(${dx * faktor}px, ${dz * faktor}px)`;
    const staerke = Math.max(0, (Math.min(1, distanz / radius) - 0.12) / 0.88);
    const x = dx / Math.max(1, distanz) * staerke;
    const z = dz / Math.max(1, distanz) * staerke;
    // Die Stickrichtung folgt dem Bildschirm trotz schräger Kamera.
    const kameraLaenge = Math.hypot(13.8, 9.5);
    aktuell.current((x * 13.8 - z * 9.5) / kameraLaenge, (x * 9.5 + z * 13.8) / kameraLaenge);
  };
  return <div className="saga3d-joystick" role="group" aria-label="Wimpy steuern: Joystick in die gewünschte Richtung ziehen"
    onPointerDown={(e) => { if (finger.current !== null) return; finger.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); bewegen(e); }}
    onPointerMove={bewegen}
    onPointerUp={(e) => { if (finger.current === e.pointerId) stoppen(); }}
    onPointerCancel={stoppen} onLostPointerCapture={stoppen}>
    <span className="saga3d-joystick-knauf" ref={knauf} aria-hidden="true" />
  </div>;
}

function gradientTextur() {
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

function naturStrassenTextur(schnee: boolean) {
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
function asphaltTextur(nacht: boolean) {
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

function schneeflockenTextur() {
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
const LEUCHTEN: Record<DreiDTageszeit, number> = {
  nacht: 0.62,
  abend: 0.34,
  morgen: 0.12,
  tag: 0,
};

function cellShading(
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

function einpassen(objekt: THREE.Object3D, hoehe: number) {
  objekt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(objekt);
  const groesse = box.getSize(new THREE.Vector3());
  objekt.scale.multiplyScalar(hoehe / Math.max(0.001, groesse.y));
  objekt.updateMatrixWorld(true);
  const neu = new THREE.Box3().setFromObject(objekt);
  const mitte = neu.getCenter(new THREE.Vector3());
  objekt.position.set(-mitte.x, -neu.min.y, -mitte.z);
}

const STRASSENRAND_X = 4.6;

/**
 * Macht aus beliebig exportierten Meshy-Szenen einen Straßenrand-Baustein.
 * Niedrige, breite Szenen werden nicht mehr anhand ihrer geringen Höhe riesig
 * aufgeblasen. Nach der Drehung liegt ihre komplette Bounding-Box rechts der
 * Fahrbahnkante und ist in Laufrichtung zentriert.
 */
function kulisseEinpassen(objekt: THREE.Object3D, zusaetzlicheDrehung: number) {
  objekt.updateMatrixWorld(true);
  const roh = new THREE.Box3().setFromObject(objekt);
  const groesse = roh.getSize(new THREE.Vector3());
  const skala = Math.min(
    10.66 / Math.max(0.001, groesse.y),
    14 / Math.max(0.001, groesse.x, groesse.z),
  );
  objekt.scale.multiplyScalar(skala);
  objekt.rotation.y = -Math.PI / 2 + THREE.MathUtils.degToRad(zusaetzlicheDrehung);
  objekt.updateMatrixWorld(true);
  const gedreht = new THREE.Box3().setFromObject(objekt);
  const mitte = gedreht.getCenter(new THREE.Vector3());
  objekt.position.x += STRASSENRAND_X - gedreht.min.x;
  objekt.position.y -= gedreht.min.y;
  objekt.position.z -= mitte.z;
  objekt.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(objekt).getSize(new THREE.Vector3());
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
function aufFeldEinpassen(
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

function KapitelCanvas({
  steuerung,
  fall,
  locations,
  spuren,
  gefundeneSpuren,
  tageszeit,
  wetter,
  strassentyp,
  charakterModelle,
  charakterGroessen = STANDARD_GROESSEN,
  locationDrehungen,
  tankstelleId,
  plan,
  fahrzeug,
  onNaehe,
  onBereit,
  onTempo,
  pausiert = false,
}: {
  steuerung: MutableRefObject<Richtung>;
  fall: PublicCase;
  locations: string[];
  spuren: SpurVorschau[];
  gefundeneSpuren: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  strassentyp: DreiDStrassentyp;
  charakterModelle: Record<string, string>;
  charakterGroessen?: Record<string, number>;
  locationDrehungen: Record<string, number>;
  /** Welcher Baustein die Tankstelle ist; leer = am Namen erkennen. */
  tankstelleId?: string;
  /** Selbst gelegter Stadtplan; ohne ihn entsteht der Straßenzug wie bisher. */
  plan?: Stadtplan | null;
  /** Wimpys Auto - siehe FahrzeugBefehl. */
  fahrzeug?: MutableRefObject<FahrzeugBefehl>;
  onNaehe: (wert: Naehe | null) => void;
  onBereit: () => void;
  /** Der Tacho fürs HUD, in km/h - nur am Steuer. */
  onTempo?: (kmh: number) => void;
  pausiert?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onNaehe, onBereit, onTempo, pausiert, gefunden: new Set(gefundeneSpuren) });
  callbacks.current = { onNaehe, onBereit, onTempo, pausiert, gefunden: new Set(gefundeneSpuren) };
  const [ladeFehler, setLadeFehler] = useState("");
  const [versuch, setVersuch] = useState(0);
  const position = useRef(new THREE.Vector3());
  // Wertgleiche Props (insbesondere [] in der Probe) dürfen keine Szene neu laden.
  const bauplanText = JSON.stringify({ besetzung: fall.besetzung, locations, spuren, charakterModelle, charakterGroessen, locationDrehungen, tankstelleId: tankstelleId ?? "", plan: plan ?? null });
  const bauplan = useMemo(() => JSON.parse(bauplanText) as {
    besetzung: Character[]; locations: string[]; spuren: SpurVorschau[];
    charakterModelle: Record<string, string>; locationDrehungen: Record<string, number>;
    charakterGroessen: Record<string, number>; tankstelleId: string; plan: Stadtplan | null;
  }, [bauplanText]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    setLadeFehler("");
    callbacks.current.onNaehe(null);
    const { besetzung, locations, spuren, charakterModelle, charakterGroessen, locationDrehungen } = bauplan;
    const groessenFaktor = (id: string) => {
      const wert = charakterGroessen[id];
      return Number.isFinite(wert) ? THREE.MathUtils.clamp(wert, 0.5, 2.5) : 1;
    };
    const ressourcen = new Set<{ dispose: () => void }>();
    const registrieren = (objekt: THREE.Object3D) => objekt.traverse((kind) => {
      if (!(kind instanceof THREE.Mesh)) return;
      ressourcen.add(kind.geometry);
      for (const material of Array.isArray(kind.material) ? kind.material : [kind.material]) {
        ressourcen.add(material);
        for (const wert of Object.values(material)) if (wert instanceof THREE.Texture) ressourcen.add(wert);
      }
      if (kind instanceof THREE.SkinnedMesh) ressourcen.add(kind.skeleton);
    });
    const freigeben = () => { ressourcen.forEach((r) => r.dispose()); ressourcen.clear(); };
    const scene = new THREE.Scene();
    const himmel = {
      morgen: 0xf3a979,
      tag: wetter === "sonne" ? 0x62c8ff : 0x91b8d2,
      abend: 0xa84567,
      nacht: 0x070a16,
    }[tageszeit];
    const schneeWetter = wetter === "schnee" || wetter === "schneesturm";
    const dunst = wetter === "nebel" || wetter === "schneesturm";
    const nebel = dunst || schneeWetter ? (tageszeit === "nacht" ? 0x253749 : 0xb7cbd6) : wetter === "regen" ? 0x536777 : himmel;
    scene.background = new THREE.Color(dunst || schneeWetter ? nebel : himmel);
    // Nahbereich bleibt selbst im Whiteout lesbar (Kamera sitzt ~17 m entfernt).
    scene.fog = new THREE.Fog(nebel, dunst ? 17 : wetter === "regen" ? 13 : 20, dunst ? 36 : wetter === "regen" ? 48 : 68);
    const gradient = gradientTextur();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(-9.5, 5.1, 13.8);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setLadeFehler("3D konnte nicht gestartet werden. Bitte erneut versuchen.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = tageszeit === "nacht" ? 0.82 : wetter === "sonne" ? 1.18 : 0.98;
    element.appendChild(renderer.domElement);
    const kontextVerloren = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setLadeFehler("Die Grafik wurde unterbrochen. Hier die Welt an gleicher Stelle wieder öffnen.");
    };
    renderer.domElement.addEventListener("webglcontextlost", kontextVerloren);

    const oben = tageszeit === "nacht" ? 0x7aa1ff : tageszeit === "abend" ? 0xffad87 : 0xe8f8ff;
    scene.add(new THREE.HemisphereLight(oben, tageszeit === "nacht" ? 0x160d2e : 0x455348, tageszeit === "nacht" ? 2.15 : 2.8));
    const licht = new THREE.DirectionalLight(
      wetter === "sonne" ? 0xfff1b8 : tageszeit === "abend" ? 0xff9c72 : 0xb9ddff,
      wetter === "sonne" ? 5.2 : dunst ? 0.9 : wetter === "regen" || schneeWetter ? 1.5 : 2.8,
    );
    licht.position.set(-8, 14, 9);
    licht.castShadow = true;
    licht.shadow.mapSize.set(1024, 1024);
    scene.add(licht);
    /*
     * Zwei Bauweisen, dieselbe Stadt.
     *
     * Ohne Plan bleibt alles wie gehabt: ein Straßenzug, 9 Meter breit, an
     * dem die Bausteine aufgereiht sind. Mit Plan wird Feld für Feld gelegt.
     */
    const stadtplan = planGueltig(bauplan.plan) ? bauplan.plan : null;
    // Der Straßenzug behält seinen gewohnten Boden; der Stadtplan bekommt
    // genau seine Rasterfläche plus einen Rand, damit nichts abbricht.
    const ausmass = stadtplan
      ? { breite: planAusmass(stadtplan).breite + 24, tiefe: planAusmass(stadtplan).tiefe + 24 }
      : { breite: 40, tiefe: 90 };
    /*
     * Im Straßenzug ist der Untergrund nur schmaler Rand neben der Fahrbahn.
     * Auf dem Stadtplan ist er die Fläche zwischen allen Straßen - und muss
     * sich deshalb deutlich von ihnen absetzen, sonst sieht die Stadt aus
     * wie eine leere Ebene.
     */
    const bodenFarbe = stadtplan
      ? strassentyp === "schnee"
        ? 0xe4eef5
        : strassentyp === "sand"
          ? 0xb59468
          : tageszeit === "nacht"
            ? 0x1d2732
            : tageszeit === "abend"
              ? 0x5a4a55
              : wetter === "regen"
                ? 0x3f4c52
                : 0x6b7166
      : strassentyp === "schnee" ? 0xc9dce8 : strassentyp === "sand" ? 0x897052 : wetter === "regen" ? 0x263647 : tageszeit === "tag" ? 0x4b5868 : 0x293448;
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(ausmass.breite, ausmass.tiefe),
      new THREE.MeshToonMaterial({ color: bodenFarbe, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = stadtplan ? 0 : -8;
    boden.receiveShadow = true;
    scene.add(boden);
    const asphalt =
      stadtplan && strassentyp === "asphalt" ? asphaltTextur(tageszeit === "nacht") : null;
    if (asphalt) ressourcen.add(asphalt);
    const fahrbahnMaterial = new THREE.MeshToonMaterial({
      map: strassentyp !== "asphalt" ? naturStrassenTextur(strassentyp === "schnee") : asphalt,
      color: strassentyp !== "asphalt"
        ? wetter === "regen" ? 0xb1a18a : 0xffffff
        : wetter === "regen" ? 0x263a4a : stadtplan ? 0xffffff : tageszeit === "nacht" ? 0x202b3c : 0x52606c,
      gradientMap: gradient,
    });
    if (stadtplan) {
      // Jedes Straßenfeld bekommt seine eigene Fläche. Kreuzungen, Ecken und
      // Sackgassen entstehen dabei von allein - es liegt eben nur dort
      // Fahrbahn, wo im Plan eine steht.
      const feldGeometrie = new THREE.PlaneGeometry(FELD_GROESSE, FELD_GROESSE);
      ressourcen.add(feldGeometrie);
      /*
       * Was aus einer Fläche eine Straße macht: ein Bordstein dort, wo die
       * Fahrbahn aufhört, und eine Mittellinie, wo sie geradeaus weiterläuft.
       * Beides kostet fast nichts und trägt fast alles - ohne sie sieht das
       * Raster aus wie ein Parkplatz.
       */
      const strichGeometrie = new THREE.PlaneGeometry(0.16, 2.2);
      const strichMaterial = new THREE.MeshBasicMaterial({
        color: strassentyp === "asphalt" ? 0xe8e2b8 : 0xdfe7ea,
        transparent: true,
        opacity: 0.65,
      });
      ressourcen.add(strichGeometrie);
      ressourcen.add(strichMaterial);

      /*
       * Straßenlaternen.
       *
       * Sie tragen die Nacht: ein dunkler Mast, ein leuchtender Kopf und ein
       * weicher Lichtteppich auf dem Asphalt. Echte Lichtquellen wären für
       * ein Handy zu teuer - das hier kostet drei kleine Meshes je Laterne
       * und sieht auf dem Bildschirm genauso aus.
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
      for (const geo of [mastGeometrie, kopfGeometrie, scheinGeometrie]) ressourcen.add(geo);
      for (const mat of [mastMaterial, kopfMaterial, scheinMaterial]) ressourcen.add(mat);
      const laterne = (x: number, z: number, nach: { x: number; z: number }) => {
        const mast = new THREE.Mesh(mastGeometrie, mastMaterial);
        mast.position.set(x, 1.7, z);
        mast.castShadow = true;
        scene.add(mast);
        const kopf = new THREE.Mesh(kopfGeometrie, kopfMaterial);
        kopf.position.set(x - nach.x * 0.35, 3.35, z - nach.z * 0.35);
        kopf.rotation.y = Math.atan2(nach.x, nach.z);
        scene.add(kopf);
        if (scheinMaterial.opacity > 0) {
          const schein = new THREE.Mesh(scheinGeometrie, scheinMaterial);
          schein.rotation.x = -Math.PI / 2;
          schein.position.set(x - nach.x * 1.1, 0.05, z - nach.z * 1.1);
          scene.add(schein);
        }
      };

      for (const feld of strassenFelder(stadtplan)) {
        const mitte = feldMitte(stadtplan, feld.x, feld.z);
        const flaeche = new THREE.Mesh(feldGeometrie, fahrbahnMaterial);
        flaeche.rotation.x = -Math.PI / 2;
        // Viertelweise gedreht: Derselbe Belag wiederholt sich dadurch nicht
        // sichtbar von Feld zu Feld.
        flaeche.rotation.z = ((feld.x * 3 + feld.z * 7) % 4) * (Math.PI / 2);
        flaeche.position.set(mitte.x, 0.012, mitte.z);
        flaeche.receiveShadow = true;
        scene.add(flaeche);

        const nachbarn = {
          nord: istStrasse(stadtplan, feld.x, feld.z - 1),
          sued: istStrasse(stadtplan, feld.x, feld.z + 1),
          west: istStrasse(stadtplan, feld.x - 1, feld.z),
          ost: istStrasse(stadtplan, feld.x + 1, feld.z),
        };
        /*
         * Kein Bordstein. Eine umlaufende Steinkante macht aus jeder Straße
         * eine Rennbahn und aus der Stadt ein Modell - die Häuser stehen
         * jetzt ohnehin direkt an der Fahrbahn, und dort, wo eine Straße
         * endet, sieht man das an den Häusern.
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
          laterne(mitte.x + nach.x * kante, mitte.z + nach.z * kante, nach);
        }
        // Mittellinie nur auf der durchgehenden Strecke, nicht auf Kreuzungen.
        const laengs = nachbarn.nord && nachbarn.sued && !nachbarn.west && !nachbarn.ost;
        const quer = nachbarn.west && nachbarn.ost && !nachbarn.nord && !nachbarn.sued;
        if (laengs || quer) {
          for (const versatz of [-2.4, 0, 2.4]) {
            const strich = new THREE.Mesh(strichGeometrie, strichMaterial);
            strich.rotation.x = -Math.PI / 2;
            if (laengs) strich.position.set(mitte.x, 0.03, mitte.z + versatz);
            else {
              strich.rotation.z = Math.PI / 2;
              strich.position.set(mitte.x + versatz, 0.03, mitte.z);
            }
            scene.add(strich);
          }
        }
      }
    } else {
      const fahrbahn = new THREE.Mesh(
        new THREE.PlaneGeometry(9.2, 90),
        fahrbahnMaterial,
      );
      fahrbahn.rotation.x = -Math.PI / 2;
      fahrbahn.position.set(0, 0.012, -8);
      fahrbahn.receiveShadow = true;
      scene.add(fahrbahn);
    }
    let regen: THREE.Points | null = null;
    if (wetter === "regen" || schneeWetter) {
      const anzahl = wetter === "schneesturm" ? 1800 : 900;
      const positionen = new Float32Array(anzahl * 3);
      for (let i = 0; i < anzahl; i++) {
        positionen[i * 3] = Math.random() * 28 - 14;
        positionen[i * 3 + 1] = Math.random() * 15;
        positionen[i * 3 + 2] = Math.random() * 70 - 48;
      }
      const geometrie = new THREE.BufferGeometry();
      geometrie.setAttribute("position", new THREE.BufferAttribute(positionen, 3));
      const flocken = schneeWetter ? schneeflockenTextur() : null;
      if (flocken) ressourcen.add(flocken);
      regen = new THREE.Points(
        geometrie,
        new THREE.PointsMaterial({ map: flocken, color: schneeWetter ? 0xf3faff : 0xc6edff, size: schneeWetter ? 0.18 : 0.075, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      scene.add(regen);
      ressourcen.add(geometrie);
      ressourcen.add(regen.material as THREE.Material);
    }
    if (wetter === "sonne") {
      const sonne = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff3a1 }),
      );
      sonne.position.set(-17, 18, -35);
      scene.add(sonne);
    }
    for (let i = 0; !stadtplan && strassentyp === "asphalt" && i < 18; i++) {
      const strich = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.025, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x74eaff }),
      );
      strich.position.set(0, 0.03, i * 4.2 - 38);
      scene.add(strich);
    }
    if (!stadtplan && strassentyp !== "asphalt") {
      // Flache Schultern statt Bordstein; schmale rote Schneestangen wie in der Arktis.
      for (const seite of [-1, 1]) {
        for (let i = 0; i < 15; i++) {
          const pfosten = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.045, strassentyp === "schnee" ? 1.25 : 0.5, 5),
            new THREE.MeshToonMaterial({ color: strassentyp === "schnee" ? 0xd65a47 : 0xd2bb8b, gradientMap: gradient }),
          );
          pfosten.position.set(seite * 4.48, strassentyp === "schnee" ? 0.625 : 0.25, 18 - i * 4.8);
          scene.add(pfosten);
        }
      }
    }

    /* --- Tankstelle, Auto und alles, was daran hängt ------------------ */
    const tankstelle = tankstelleAus(bauplan.locations, bauplan.tankstelleId);
    /** Wo der Wagen steht und wo Wimpy einsteigt - erst beim Aufbau bekannt. */
    let tankPlatz: THREE.Vector3 | null = null;
    /** Der Wagen, der gerade gefahren wird, und der, der irgendwo parkt. */
    let amSteuer: { id: string; name: string; gruppe: THREE.Group; werte: FahrWerte } | null = null;
    /** Wie schnell der Wagen gerade fährt und wie schräg er dabei steht. */
    let fahrt: Fahrzustand = { ...STILLSTAND };
    /** Zuletzt gemeldetes Tempo - die Anzeige soll nicht jedes Bild neu rendern. */
    let letzterTacho = -1;
    let geparkt: { id: string; name: string; gruppe: THREE.Group } | null = null;
    let laedtWagen = "";
    let wimpyFigur: THREE.Object3D | null = null;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const spieler = new THREE.Group();
    spieler.position.copy(position.current);
    if (stadtplan && !begehbar(stadtplan, spieler.position.x, spieler.position.z)) {
      // Beim ersten Betreten (oder nach einem geänderten Plan) steht Wimpy
      // mitten in der Stadt auf der Straße, nicht im Nichts.
      const start = startFeld(stadtplan);
      if (start) {
        const mitte = feldMitte(stadtplan, start.x, start.z);
        spieler.position.set(mitte.x, 0, mitte.z);
        position.current.copy(spieler.position);
      }
    }
    scene.add(spieler);
    const mixers: THREE.AnimationMixer[] = [];
    const npcGruppen: {
      gruppe: THREE.Group; info: Naehe; basisZ: number; zielZ: number; pause: number; radius: number;
      lauf?: THREE.AnimationAction; ruhe?: THREE.AnimationAction; aktiv?: THREE.AnimationAction;
      ruheAktionen: THREE.AnimationAction[]; strecke: number;
    }[] = [];
    const spurGruppen: { gruppe: THREE.Group; info: Naehe }[] = [];
    let spielerMixer: THREE.AnimationMixer | null = null;
    let laufAktion: THREE.AnimationAction | null = null;
    let ruheAktion: THREE.AnimationAction | null = null;
    let aktiveAktion: THREE.AnimationAction | null = null;
    let letzteNaehe = "";

    const modelle = new Map<string, ReturnType<typeof loader.loadAsync>>();
    const laden = (datei: string) => {
      let ladung = modelle.get(datei);
      if (!ladung) {
        ladung = loader.loadAsync(datei).then((gltf) => {
          registrieren(gltf.scene);
          if (beendet) freigeben();
          return gltf;
        });
        modelle.set(datei, ladung);
      }
      return ladung;
    };
    const figurLaden = async (modell: AnimationsModell, hoehe: number) => {
      const gltf = await laden(modell.datei);
      if (beendet) throw new Error("Szene geschlossen");
      const figur = cloneSkeleton(gltf.scene);
      cellShading(figur, gradient);
      einpassen(figur, hoehe);
      registrieren(figur);
      return { figur, animationen: gltf.animations };
    };

    const aufbauen = async () => {
      /** Hat sich ein Baustein nicht laden lassen? Gilt für beide Bauweisen. */
      let kulissenFehler = false;
      /*
       * Auf dem Stadtplan stehen Tiere und Fundstücke weiterhin zufällig
       * verteilt - nur eben über die ganze Stadt statt entlang einer Straße.
       * Beides kommt aus einem Topf, damit niemand auf einem Beweisstück steht.
       */
      const plaetze = stadtplan
        ? verteilen(stadtplan, besetzung.filter((c) => !c.istDetektiv).length + spuren.length)
        : [];
      const platzFuer = (art: "tier" | "spur", index: number, fallback: { x: number; z: number }) => {
        if (!stadtplan) return fallback;
        const versatz = art === "tier" ? 0 : besetzung.filter((c) => !c.istDetektiv).length;
        return plaetze[versatz + index] ?? fallback;
      };
      if (stadtplan) {
        /*
         * Der gelegte Stadtplan: Jedes Gebäudefeld holt sich seinen Baustein.
         * Derselbe Baustein darf beliebig oft vorkommen - geladen wird er
         * trotzdem nur einmal und danach nur noch kopiert.
         */
        const felder = gebaeudeFelder(stadtplan);
        const gebraucht = [...new Set(felder.map((feld) => feld.id))];
        const geladen = new Map<string, THREE.Object3D>();
        const ergebnisse = await Promise.allSettled(
          gebraucht.map(async (id) => {
            const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
            if (!ort) throw new Error("Baustein fehlt");
            const gltf = await laden(ort.datei);
            return { id, szene: gltf.scene };
          }),
        );
        if (beendet) return;
        kulissenFehler = ergebnisse.some((ergebnis) => ergebnis.status === "rejected");
        for (const ergebnis of ergebnisse) {
          if (ergebnis.status !== "fulfilled") continue;
          cellShading(ergebnis.value.szene, gradient, [], LEUCHTEN[tageszeit] ?? 0);
          registrieren(ergebnis.value.szene);
          geladen.set(ergebnis.value.id, ergebnis.value.szene);
        }
        for (const feld of felder) {
          const vorlage = geladen.get(feld.id);
          if (!vorlage) continue;
          // Zu welcher Straße schaut das Haus? Die erste, die danebenliegt.
          const nachbar = [[0, 1], [0, -1], [1, 0], [-1, 0]]
            .map(([dx, dz]) => ({ x: dx, z: dz }))
            .find((weg) => istStrasse(stadtplan, feld.x + weg.x, feld.z + weg.z)) ?? null;
          const haus = vorlage.clone(true);
          aufFeldEinpassen(haus, nachbar, feld.drehung, hoeheFuer(stadtplan, feld.id));
          const mitte = feldMitte(stadtplan, feld.x, feld.z);
          const block = new THREE.Group();
          block.add(haus);
          block.position.set(mitte.x, 0, mitte.z);
          scene.add(block);
          // Steht hier die Tankstelle, liegt ihr Stellplatz auf der Straße davor.
          if (tankstelle && feld.id === tankstelle.id && tankPlatz === null && nachbar) {
            const platz = feldMitte(stadtplan, feld.x + nachbar.x, feld.z + nachbar.z);
            tankPlatz = new THREE.Vector3(platz.x, 0, platz.z);
          }
        }
      } else {

      const locationEintraege = locationsFuer3D(locations);
      const kulissen = await Promise.allSettled(locationEintraege.map((ort) => laden(ort.datei)));
      if (beendet) return;
      kulissenFehler = kulissen.some((ergebnis) => ergebnis.status === "rejected");
      const vorlagen = kulissen.flatMap((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return [];
        const vorlage = ergebnis.value.scene;
        cellShading(vorlage, gradient, [], LEUCHTEN[tageszeit] ?? 0);
        registrieren(vorlage);
        const ort = locationEintraege[index];
        const ausmass = kulisseEinpassen(vorlage, locationDrehungen[ort.id] ?? 0);
        return [{ id: ort.id, vorlage, laenge: Math.max(5, ausmass.z) }];
      });
      let cursorZ = 19;
      let i = 0;
      while (cursorZ > -51 && vorlagen.length && i < 24) {
        const eintrag = vorlagen[i % vorlagen.length];
        const block = new THREE.Group();
        block.add(eintrag.vorlage.clone(true));
        block.position.z = cursorZ - eintrag.laenge / 2;
        scene.add(block);
        // Die erste aufgebaute Tankstelle ist Wimpys Garage.
        if (tankstelle && eintrag.id === tankstelle.id && tankPlatz === null) {
          tankPlatz = new THREE.Vector3(2.7, 0, block.position.z);
        }
        cursorZ -= eintrag.laenge + 1.1;
        i++;
      }
      }
      if (tankPlatz) {
        /*
         * Ein ruhiger Ring auf dem Boden zeigt, wo Wimpy einsteigen kann.
         * Er leuchtet nicht und blinkt nicht - er liegt einfach da, wie ein
         * aufgemalter Stellplatz.
         */
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.75, 1.15, 28),
          new THREE.MeshBasicMaterial({ color: 0xf6c667, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(tankPlatz.x, 0.04, tankPlatz.z);
        scene.add(ring);
        registrieren(ring);
      }

      // Auch die Spielfigur nimmt, was in den Stammdaten bei ihr steht.
      const detektiv = besetzung.find((c) => c.istDetektiv);
      const wimpy = spielerModell(detektiv);
      if (wimpy) {
        const geladen = await figurLaden(wimpy, 2.05 * groessenFaktor(detektiv?.id ?? "wimpy"));
        if (beendet) return;
        spieler.add(geladen.figur);
        wimpyFigur = geladen.figur;
        spielerMixer = new THREE.AnimationMixer(geladen.figur);
        const laufClip = geladen.animationen.find((clip) => clip.name === laufAnimation(geladen.animationen.map((c) => c.name))) ?? geladen.animationen[0];
        const idleClip = geladen.animationen.find((clip) => /idle|rest/i.test(clip.name));
        if (laufClip) laufAktion = spielerMixer.clipAction(laufClip);
        if (idleClip) ruheAktion = spielerMixer.clipAction(idleClip);
        aktiveAktion = ruheAktion ?? laufAktion;
        aktiveAktion?.play();
      }

      const tiere = besetzung.filter((charakter) => !charakter.istDetektiv);
      const npcLadungen = await Promise.allSettled(
        tiere.map((charakter, index) => {
          const modell = modellFuerTier(charakter, index, charakterModelle[charakter.id]);
          return modell ? figurLaden(modell, 1.8 * groessenFaktor(charakter.id)) : Promise.reject(new Error("Kein Modell"));
        }),
      );
      if (beendet) return;
      npcLadungen.forEach((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return;
        const charakter = tiere[index];
        const gruppe = new THREE.Group();
        gruppe.add(ergebnis.value.figur);
        const roh = platzFuer("tier", index, kapitelPosition(index, tiere.length, "tier"));
        const radius = 0.5 * groessenFaktor(charakter.id);
        // Im Straßenzug bleibt die alte Einschnürung auf die Fahrbahnbreite.
        const x = stadtplan ? roh.x : Math.sign(roh.x) * Math.min(Math.abs(roh.x), 4.5 - radius);
        const z = roh.z;
        gruppe.position.set(x, 0, z);
        scene.add(gruppe);
        const mixer = new THREE.AnimationMixer(ergebnis.value.figur);
        const clips = ergebnis.value.animationen;
        const laufClip = clips.find((c) => /walk/i.test(c.name)) ?? clips.find((c) => /run|sprint|charge/i.test(c.name));
        const ruheClips = clips.filter((c) => /idle|rest|dance|shuffle|ymca|salsa|samba|hip.?hop|rumba|twist/i.test(c.name) && c !== laufClip);
        if (!ruheClips.length && !laufClip && clips[0]) ruheClips.push(clips[0]);
        const lauf = laufClip ? mixer.clipAction(laufClip) : undefined;
        const ruheAktionen = ruheClips.map((clip) => mixer.clipAction(clip));
        const ruhe = ruheAktionen[index % Math.max(1, ruheAktionen.length)];
        const strecke = Math.min(5, 32 / Math.max(1, tiere.length));
        npcGruppen.push({ gruppe, info: { art: "tier", id: charakter.id, name: charakter.name },
          basisZ: z, zielZ: THREE.MathUtils.clamp(z + (index % 2 ? -strecke : strecke), -34, 13),
          pause: ruhe ? index % 3 * 2 : 0, radius, lauf, ruhe, ruheAktionen, strecke });
        mixers.push(mixer);
      });

      await Promise.all(
        spuren.map(async (spur, index) => {
          const gruppe = new THREE.Group();
          const rahmen = new THREE.Mesh(
            new THREE.BoxGeometry(1.18, 1.18, 0.11),
            new THREE.MeshToonMaterial({ color: 0xf7e7a7, gradientMap: gradient }),
          );
          rahmen.position.y = 0.72;
          gruppe.add(rahmen);
          registrieren(gruppe);
          if (spur.bild) {
            try {
              const textur = await new THREE.TextureLoader().loadAsync(spur.bild);
              if (beendet) { textur.dispose(); return; }
              ressourcen.add(textur);
              textur.colorSpace = THREE.SRGBColorSpace;
              const bild = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ map: textur, transparent: true, side: THREE.DoubleSide }),
              );
              bild.position.set(0, 0.72, 0.061);
              gruppe.add(bild);
            } catch {
              // Der goldene Rahmen bleibt als klare, untersuchbare Requisite stehen.
            }
          }
          if (beendet) return;
          const { x, z } = platzFuer("spur", index, kapitelPosition(index, spuren.length, "spur"));
          gruppe.position.set(x, 0, z);
          gruppe.rotation.y = -0.6;
          scene.add(gruppe);
          spurGruppen.push({
            gruppe,
            info: { art: "spur", id: spur.itemId, ortId: spur.ortId, name: spur.name },
          });
        }),
      );
      if (!beendet) {
        registrieren(scene);
        if (kulissenFehler || npcLadungen.some((r) => r.status === "rejected")) {
          setLadeFehler("Einige Straßen oder Figuren konnten nicht geladen werden. Welt erneut laden.");
        }
        callbacks.current.onBereit();
      }
    };
    void aufbauen().catch(() => {
      if (!beendet) setLadeFehler("Die 3D-Welt konnte nicht vollständig geladen werden. Erneut versuchen.");
    });

    const tasten = new Set<string>();
    const runter = (event: KeyboardEvent) => {
      if (callbacks.current.pausiert || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) return;
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(event.key.toLowerCase())) event.preventDefault();
      tasten.add(event.key.toLowerCase());
    };
    const hoch = (event: KeyboardEvent) => tasten.delete(event.key.toLowerCase());
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);
    const stoppen = () => { tasten.clear(); steuerung.current = { x: 0, z: 0 }; };
    window.addEventListener("blur", stoppen);
    document.addEventListener("visibilitychange", stoppen);

    /* --- Ein- und Aussteigen ------------------------------------------ */
    /** Ein Auto aus dem Katalog als fahrbereite Gruppe. */
    const wagenBauen = async (wunsch: { modell: string; drehung: number }) => {
      const modell = AUTO_MODELLE.find((m) => m.id === wunsch.modell);
      if (!modell) return null;
      const gltf = await laden(modell.datei);
      if (beendet) return null;
      const körper = gltf.scene.clone(true);
      cellShading(körper, gradient);
      // Jedes Modell liegt anders in seiner Datei; die Drehung aus dem
      // Autokatalog stellt es gerade - genau wie in der Verfolgungsjagd.
      körper.rotation.y = THREE.MathUtils.degToRad(wunsch.drehung);
      körper.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(körper);
      const groesse = box.getSize(new THREE.Vector3());
      körper.scale.multiplyScalar(3 / Math.max(groesse.x, groesse.z, 0.001));
      körper.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(körper);
      const mitte = box.getCenter(new THREE.Vector3());
      körper.position.set(-mitte.x, -box.min.y, -mitte.z);
      registrieren(körper);
      const gruppe = new THREE.Group();
      gruppe.add(körper);
      return gruppe;
    };

    /** Wimpy verschwindet im Wagen, der Wagen übernimmt seinen Platz. */
    const einsteigen = (
      gruppe: THREE.Group,
      id: string,
      name: string,
      werte: FahrWerte,
    ) => {
      scene.remove(gruppe);
      gruppe.position.set(0, 0, 0);
      gruppe.rotation.set(0, 0, 0);
      spieler.add(gruppe);
      if (wimpyFigur) wimpyFigur.visible = false;
      if (geparkt?.id === id) geparkt = null;
      amSteuer = { id, name, gruppe, werte };
      // Er startet aus dem Stand, blickt aber dorthin, wo Wimpy stand.
      fahrt = { winkel: spieler.rotation.y, tempo: 0, drift: 0 };
    };

    /**
     * Aussteigen. Abgestellt bleibt der Wagen stehen, wo er steht - an der
     * Tankstelle abgegeben ist er wieder weg.
     */
    const aussteigen = (abgeben: boolean) => {
      if (!amSteuer) return;
      const { gruppe, id, name } = amSteuer;
      spieler.remove(gruppe);
      amSteuer = null;
      fahrt = { ...STILLSTAND };
      spieler.rotation.z = 0;
      if (wimpyFigur) wimpyFigur.visible = true;
      if (abgeben) return;
      gruppe.position.copy(spieler.position);
      gruppe.rotation.y = spieler.rotation.y;
      scene.add(gruppe);
      geparkt = { id, name, gruppe };
      // Einen Schritt zur Seite, sonst steht Wimpy in seinem eigenen Wagen.
      spieler.position.x = THREE.MathUtils.clamp(spieler.position.x + 1.6, -4.15, 4.15);
    };

    let letzter = performance.now();
    const zielKamera = new THREE.Vector3();
    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      if (!element.clientWidth || !element.clientHeight || document.hidden) {
        stoppen();
        frame = requestAnimationFrame(zeichnen);
        return;
      }
      if (callbacks.current.pausiert) stoppen();

      /*
       * Wagenwechsel: Die Oberfläche legt ihren Wunsch im Ref ab, die Szene
       * führt ihn im nächsten Bild aus. Ein Modell wird nur einmal geladen -
       * wer denselben Wagen wieder besteigt, steigt sofort ein.
       */
      const befehl = fahrzeug?.current ?? LEERER_FAHRZEUGBEFEHL;
      const gewuenschterWagen = befehl.faehrt?.id ?? "";
      if (gewuenschterWagen !== (amSteuer?.id ?? "")) {
        if (!gewuenschterWagen) {
          aussteigen(befehl.abgeben);
        } else if (geparkt?.id === gewuenschterWagen && befehl.faehrt) {
          einsteigen(geparkt.gruppe, gewuenschterWagen, geparkt.name, fahrwerte(befehl.faehrt));
        } else if (laedtWagen !== gewuenschterWagen) {
          // Nur das Laden braucht eine Sperre - sonst bestellte jedes Bild
          // dasselbe Modell noch einmal.
          laedtWagen = gewuenschterWagen;
          const wunsch = befehl.faehrt;
          if (wunsch) {
            void wagenBauen(wunsch)
              .then((gruppe) => {
                if (beendet || !gruppe) return;
                // Inzwischen umentschieden? Dann bleibt der Wagen stehen.
                if ((fahrzeug?.current.faehrt?.id ?? "") !== wunsch.id) {
                  gruppe.position.copy(spieler.position);
                  scene.add(gruppe);
                  geparkt = { id: wunsch.id, name: wunsch.name, gruppe };
                  return;
                }
                if (amSteuer) aussteigen(true);
                einsteigen(gruppe, wunsch.id, wunsch.name, fahrwerte(wunsch));
              })
              .catch(() => undefined)
              .finally(() => { laedtWagen = ""; });
          }
        }
      }

      const tx = (tasten.has("d") || tasten.has("arrowright") ? 1 : 0) - (tasten.has("a") || tasten.has("arrowleft") ? 1 : 0);
      const tz = (tasten.has("s") || tasten.has("arrowdown") ? 1 : 0) - (tasten.has("w") || tasten.has("arrowup") ? 1 : 0);
      const x = THREE.MathUtils.clamp(tx || steuerung.current.x, -1, 1);
      const z = THREE.MathUtils.clamp(tz || steuerung.current.z, -1, 1);
      let bewegt = false;
      const staerke = Math.min(1, Math.hypot(x, z));
      const vorherX = spieler.position.x;
      const vorherZ = spieler.position.z;

      /** Wohin der Wagen darf - an der Wand entlang, aber nicht hindurch. */
      const versetzen = (zielX: number, zielZ: number, platz: number) => {
        let neuX = zielX;
        let neuZ = zielZ;
        let angestossen = false;
        if (stadtplan) {
          if (!begehbar(stadtplan, neuX, neuZ, platz)) {
            angestossen = true;
            if (begehbar(stadtplan, neuX, vorherZ, platz)) neuZ = vorherZ;
            else if (begehbar(stadtplan, vorherX, neuZ, platz)) neuX = vorherX;
            else { neuX = vorherX; neuZ = vorherZ; }
          }
        } else {
          neuX = THREE.MathUtils.clamp(neuX, -4.15, 4.15);
          neuZ = THREE.MathUtils.clamp(neuZ, -36, 15);
        }
        const imWeg = npcGruppen.some((npc) => {
          const dx = npc.gruppe.position.x - neuX;
          const dz = npc.gruppe.position.z - neuZ;
          return dx * dx + dz * dz < (npc.radius + platz) ** 2;
        });
        if (imWeg) return { x: vorherX, z: vorherZ, angestossen: true };
        return { x: neuX, z: neuZ, angestossen };
      };

      if (amSteuer) {
        /*
         * Am Steuer wird nicht geschoben, sondern gefahren: Der Stick sagt,
         * wohin es gehen soll, und der Wagen zieht an, trägt, rutscht in die
         * Kurve und braucht einen Moment zum Stehen. Die Rechnung dazu steht
         * in lib/autofahrt.ts.
         */
        const schritt = fahrSchritt(
          fahrt,
          { x, z, handbremse: befehl.handbremse === true },
          dt,
          amSteuer.werte,
        );
        fahrt = schritt.zustand;
        const ziel = versetzen(vorherX + schritt.bewegung.x, vorherZ + schritt.bewegung.z, 1.2);
        spieler.position.set(ziel.x, 0, ziel.z);
        if (ziel.angestossen) fahrt = angeeckt(fahrt);
        bewegt = Math.hypot(ziel.x - vorherX, ziel.z - vorherZ) > 0.0001;
        spieler.rotation.y = fahrt.winkel;
        // Die Karosserie legt sich in die Kurve - so sieht man den Drift.
        const schraeg = THREE.MathUtils.clamp(-fahrt.drift * 0.05, -0.26, 0.26);
        spieler.rotation.z = THREE.MathUtils.damp(spieler.rotation.z, schraeg, 8, dt);
        const tacho = angezeigtesTempo(fahrt, amSteuer.werte, { speed: befehl.faehrt?.speed ?? 120 });
        if (tacho !== letzterTacho) {
          letzterTacho = tacho;
          callbacks.current.onTempo?.(tacho);
        }
      } else if (staerke > 0.05) {
        const laenge = Math.hypot(x, z) || 1;
        const ziel = versetzen(
          vorherX + (x / laenge) * staerke * dt * 4.1,
          vorherZ + (z / laenge) * staerke * dt * 4.1,
          0.7,
        );
        spieler.position.set(ziel.x, 0, ziel.z);
        bewegt = Math.hypot(ziel.x - vorherX, ziel.z - vorherZ) > 0.0001;
        spieler.rotation.y = Math.atan2(x, z);
      }
      const gewuenscht = amSteuer ? ruheAktion : bewegt ? laufAktion : (ruheAktion ?? laufAktion);
      if (gewuenscht && gewuenscht !== aktiveAktion) {
        aktiveAktion?.fadeOut(0.14);
        gewuenscht.reset().fadeIn(0.14).play();
        aktiveAktion = gewuenscht;
      }
      if (aktiveAktion) aktiveAktion.paused = !bewegt && !ruheAktion;
      if (laufAktion) laufAktion.setEffectiveTimeScale(Math.max(0.25, staerke));
      spielerMixer?.update(dt);
      position.current.copy(spieler.position);
      if (regen) {
        const positionen = regen.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positionen.count; i++) {
          const y = positionen.getY(i) - dt * (wetter === "schneesturm" ? 4.5 : schneeWetter ? 1.5 : 13);
          positionen.setY(i, y < 0 ? 15 : y);
          if (schneeWetter) {
            const wind = wetter === "schneesturm" ? 7 + Math.sin(jetzt * 0.0014) * 3 : Math.sin(jetzt * 0.0006 + i) * 0.65;
            const px = positionen.getX(i) + wind * dt;
            positionen.setX(i, px > 14 ? -14 : px < -14 ? 14 : px);
            const pz = positionen.getZ(i) + dt * (wetter === "schneesturm" ? 2.2 : 0.2);
            positionen.setZ(i, pz > 22 ? -48 : pz);
          }
        }
        positionen.needsUpdate = true;
      }
      npcGruppen.forEach((npc) => {
        let laeuft = false;
        const ansprechbar = npc.gruppe.position.distanceToSquared(spieler.position) < 2.35 ** 2;
        if (!callbacks.current.pausiert && !ansprechbar) {
          if (npc.pause > 0) npc.pause -= dt;
          else if (npc.lauf) {
            const differenz = npc.zielZ - npc.gruppe.position.z;
            const schritt = Math.sign(differenz) * Math.min(Math.abs(differenz), dt * 0.9);
            // Auf dem Stadtplan endet der Spaziergang an der Hauswand: Wer
            // nicht weiterkann, dreht um, statt durch die Fassade zu laufen.
            if (stadtplan && !begehbar(stadtplan, npc.gruppe.position.x, npc.gruppe.position.z + schritt, 0.4)) {
              npc.zielZ = npc.basisZ - (npc.zielZ - npc.basisZ);
              npc.pause = 1.5 + Math.random() * 3;
            } else {
              npc.gruppe.position.z += schritt;
            }
            laeuft = Math.abs(schritt) > 0.0001 && npc.pause <= 0;
            if (laeuft) npc.gruppe.rotation.y = schritt > 0 ? 0 : Math.PI;
            if (Math.abs(differenz) < 0.03) {
              npc.zielZ = THREE.MathUtils.clamp(npc.basisZ + (npc.zielZ > npc.basisZ ? -npc.strecke : npc.strecke), -34, 13);
              npc.ruhe = npc.ruheAktionen[Math.floor(Math.random() * npc.ruheAktionen.length)];
              // Reine Laufmodelle wenden direkt. Andere legen wechselnde Tanz-/Idle-Pausen ein.
              npc.pause = npc.ruhe ? 3 + Math.random() * 5 : 0;
            }
          } else if (npc.ruheAktionen.length) {
            npc.ruhe = npc.ruheAktionen[Math.floor(Math.random() * npc.ruheAktionen.length)];
            npc.pause = 4 + Math.random() * 5;
          }
        }
        const aktion = laeuft ? npc.lauf : (npc.ruhe ?? npc.lauf);
        if (aktion && aktion !== npc.aktiv) {
          npc.aktiv?.fadeOut(0.18);
          aktion.reset().fadeIn(0.18).play();
          npc.aktiv = aktion;
        }
        // Ohne Idle-Clip wird die Pose angehalten, statt auf der Stelle zu rennen.
        if (npc.aktiv) npc.aktiv.paused = !laeuft && !npc.ruhe;
      });
      mixers.forEach((mixer) => mixer.update(dt));

      let nah: { gruppe: THREE.Group; info: Naehe } | null = null;
      let abstand = 2.35;
      spurGruppen.forEach((ziel) => {
        ziel.gruppe.visible = !callbacks.current.gefunden.has(ziel.info.id);
      });
      // Aus dem Auto heraus spricht Wimpy niemanden an und hebt nichts auf -
      // dafür muss er aussteigen. Die Tankstelle sieht er trotzdem.
      if (!amSteuer) {
        [...npcGruppen, ...spurGruppen.filter((ziel) => ziel.gruppe.visible)].forEach((ziel) => {
          const distanz = ziel.gruppe.position.distanceTo(spieler.position);
          if (distanz < abstand) {
            abstand = distanz;
            nah = ziel;
          }
        });
        if (geparkt && geparkt.gruppe.position.distanceTo(spieler.position) < Math.min(abstand, 2.8)) {
          abstand = geparkt.gruppe.position.distanceTo(spieler.position);
          nah = { gruppe: geparkt.gruppe, info: { art: "wagen", id: geparkt.id, name: geparkt.name } };
        }
      }
      if (tankPlatz && tankstelle) {
        const distanz = tankPlatz.distanceTo(spieler.position);
        // Im Auto zählt nur die Tankstelle, zu Fuß gewinnt das nächste Ziel.
        if (distanz < 3.2 && (amSteuer || distanz < abstand)) {
          abstand = distanz;
          nah = { gruppe: spieler, info: { art: "tankstelle", id: tankstelle.id, name: tankstelle.name } };
        }
      }
      const nahesZiel = nah as { gruppe: THREE.Group; info: Naehe } | null;
      const schluessel = nahesZiel ? `${nahesZiel.info.art}:${nahesZiel.info.id}` : "";
      if (schluessel !== letzteNaehe) {
        letzteNaehe = schluessel;
        callbacks.current.onNaehe(nahesZiel?.info ?? null);
      }
      /*
       * Die Kamera fährt mit: Am Steuer rückt sie ab, und je schneller es
       * geht, desto weiter - und desto weiter schaut sie voraus. Nichts
       * verkauft Tempo so gut wie eine Kamera, die Mühe hat mitzuhalten.
       */
      const flott = amSteuer ? Math.min(1, Math.abs(fahrt.tempo) / amSteuer.werte.hoechst) : 0;
      const weite = amSteuer ? 1.22 + flott * 0.5 : 1;
      zielKamera.set(spieler.position.x - 9.5 * weite, 5.1 * weite, spieler.position.z + 13.8 * weite);
      camera.position.lerp(zielKamera, 1 - Math.exp(-(amSteuer ? 3.4 : 5) * dt));
      const voraus = flott * 5.5;
      camera.lookAt(
        spieler.position.x + Math.sin(fahrt.winkel) * voraus,
        1.05,
        spieler.position.z + 0.7 + Math.cos(fahrt.winkel) * voraus,
      );
      renderer.render(scene, camera);
      frame = requestAnimationFrame(zeichnen);
    };
    frame = requestAnimationFrame(zeichnen);

    const groesse = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(element.clientWidth, element.clientHeight);
    };
    groesse();
    const beobachter = new ResizeObserver(groesse);
    beobachter.observe(element);
    window.addEventListener("resize", groesse);
    return () => {
      beendet = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("resize", groesse);
      window.removeEventListener("blur", stoppen);
      document.removeEventListener("visibilitychange", stoppen);
      beobachter.disconnect();
      stoppen();
      mixers.forEach((mixer) => mixer.stopAllAction());
      spielerMixer?.stopAllAction();
      registrieren(scene);
      freigeben();
      renderer.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", kontextVerloren);
      renderer.domElement.remove();
      gradient.dispose();
    };
  }, [bauplan, versuch, strassentyp, steuerung, tageszeit, wetter]);

  return <>
    <div className="saga3d-canvas" ref={host} aria-label="Spielbares 3D-Kapitel" />
    {ladeFehler && <button className="saga3d-meldung" onClick={() => setVersuch((v) => v + 1)}>{ladeFehler}</button>}
  </>;
}

/** Die Auswahl der eigenen Wagen an der Tankstelle. */
function GaragenWahl({
  autos,
  onWaehlen,
  onSchliessen,
}: {
  autos: Auto[];
  onWaehlen: (auto: Auto) => void;
  onSchliessen: () => void;
}) {
  return (
    <div className="saga3d-garage" role="dialog" aria-label="Wimpys Garage">
      <article>
        <span className="jagd-kicker">WIMPYS GARAGE</span>
        <h2>Womit fährst du los?</h2>
        {autos.length === 0 && (
          <p className="leise">In der Garage steht noch kein Wagen. Im Laden gibt es welche.</p>
        )}
        {autos.map((auto) => (
          <button key={auto.id} className="saga3d-wagenwahl" onClick={() => onWaehlen(auto)}>
            <strong>{auto.name}</strong>
            <span className="leise klein">{auto.speed} km/h · Beschleunigung {auto.beschleunigung}</span>
          </button>
        ))}
        <button className="knopf" onClick={onSchliessen}>Doch zu Fuß</button>
      </article>
    </div>
  );
}

export function Saga3DKapitel({
  pausiert = false,
  fall,
  siegel,
  locations,
  tageszeit,
  wetter,
  strassentyp,
  charakterModelle,
  charakterGroessen = STANDARD_GROESSEN,
  locationDrehungen,
  tankstelleId,
  plan,
  gefundeneSpuren,
  kapitel,
  tasche,
  suchtGerade,
  besitz = KEIN_BESITZ,
  onCharakter,
  onSpur,
  onAufnehmen,
  onAutoWaehlen,
}: {
  pausiert?: boolean;
  fall: PublicCase;
  siegel: string;
  locations: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  strassentyp: DreiDStrassentyp;
  charakterModelle: Record<string, string>;
  charakterGroessen?: Record<string, number>;
  locationDrehungen: Record<string, number>;
  /** Welcher Baustein die Tankstelle ist; leer = am Namen erkennen. */
  tankstelleId?: string;
  /** Selbst gelegter Stadtplan; ohne ihn entsteht der Straßenzug wie bisher. */
  plan?: Stadtplan | null;
  gefundeneSpuren: string[];
  kapitel: number | null;
  tasche: Beweismittel[];
  suchtGerade: boolean;
  /** Was Wimpy im Laden gekauft hat - nur damit darf er losfahren. */
  besitz?: Record<string, number>;
  onCharakter: (id: string) => void;
  onSpur: (ortId: string, itemId: string) => Promise<Fund | null>;
  onAufnehmen: (mittel: Beweismittel, statt?: string) => void;
  /** Welcher Wagen zuletzt gefahren wurde - der fährt auch in der Jagd. */
  onAutoWaehlen?: (id: string) => void;
}) {
  const steuerung = useRef<Richtung>({ x: 0, z: 0 });
  const [nah, setNah] = useState<Naehe | null>(null);
  const [bereit, setBereit] = useState(false);
  const [spuren, setSpuren] = useState<SpurVorschau[]>([]);
  const [fund, setFund] = useState<Fund | null>(null);
  const [meldung, setMeldung] = useState("");
  const [spurenGeladen, setSpurenGeladen] = useState(false);
  const [spurenFehler, setSpurenFehler] = useState("");
  const [spurenVersuch, setSpurenVersuch] = useState(0);
  const untersucht = useRef(false);
  /*
   * Wimpys Wagen in der Stadt.
   *
   * Der Wunsch liegt im Ref, damit die Szene beim Ein- und Aussteigen nicht
   * neu aufgebaut wird; `amSteuer` ist nur die Anzeige dazu.
   */
  const fahrzeug = useRef<FahrzeugBefehl>({ ...LEERER_FAHRZEUGBEFEHL });
  const [amSteuer, setAmSteuer] = useState<{ id: string; name: string } | null>(null);
  const [garageOffen, setGarageOffen] = useState(false);
  /** Was der Tacho zeigt - kommt aus der Szene. */
  const [tempo, setTempo] = useState(0);
  const { autos } = useAutos();
  // Gefahren wird nur, was Wimpy besitzt - der Startwagen gehört ihm immer.
  const meineAutos = autos.filter((auto) => auto.id === START_AUTO_ID || besitz[auto.id]);

  const einsteigen = (auto: Auto) => {
    fahrzeug.current = {
      faehrt: {
        id: auto.id,
        name: auto.name,
        modell: auto.modell,
        drehung: auto.drehung,
        speed: auto.speed,
        beschleunigung: auto.beschleunigung,
      },
      abgeben: false,
    };
    setAmSteuer({ id: auto.id, name: auto.name });
    setTempo(0);
    setGarageOffen(false);
    onAutoWaehlen?.(auto.id);
  };
  const aussteigen = (abgeben: boolean) => {
    fahrzeug.current = { faehrt: null, abgeben, handbremse: false };
    setAmSteuer(null);
    setTempo(0);
  };
  /** Die Handbremse liegt im Ref: Die Szene liest sie in jedem Bild. */
  const handbremse = (gezogen: boolean) => {
    fahrzeug.current = { ...fahrzeug.current, handbremse: gezogen };
  };

  useEffect(() => {
    let aktiv = true;
    setSpurenFehler("");
    void postJson<{ spuren: SpurVorschau[] }>("/api/search", {
      siegel,
      ortId: fall.orte[0]?.id ?? "",
      gefundeneSpuren,
      vorschau: true,
    })
      .then((antwort) => {
        if (aktiv) {
          setSpuren(antwort.spuren ?? []);
          setSpurenGeladen(true);
        }
      })
      .catch(() => {
        if (aktiv) setSpurenFehler("Die Beweise konnten nicht geladen werden. Hier erneut versuchen.");
      });
    return () => {
      aktiv = false;
    };
    // Für denselben versiegelten Fall bleibt die Vorschau stehen; gefundene
    // Requisiten blendet die laufende Szene ohne teures Neuladen selbst aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siegel, spurenVersuch]);

  const setzen = (x: number, z: number) => {
    steuerung.current = { x, z };
  };
  const stoppen = () => setzen(0, 0);

  const interagieren = async () => {
    if (!nah || untersucht.current || suchtGerade) return;
    stoppen();
    if (nah.art === "tankstelle") {
      // An der Tankstelle entscheidet der eigene Knopf, nicht dieser hier.
      setGarageOffen(true);
      return;
    }
    if (nah.art === "wagen") {
      const auto = meineAutos.find((a) => a.id === nah.id);
      if (auto) einsteigen(auto);
      return;
    }
    if (nah.art === "tier") {
      onCharakter(nah.id);
      return;
    }
    setMeldung("");
    untersucht.current = true;
    try {
      const ergebnis = await onSpur(nah.ortId, nah.id);
      if (ergebnis?.spur) setFund(ergebnis);
      else setMeldung(ergebnis?.text ?? "Der Beweis konnte nicht untersucht werden. Bitte erneut versuchen.");
    } catch {
      setMeldung("Die Verbindung ist abgebrochen. Der Beweis kann erneut untersucht werden.");
    } finally {
      untersucht.current = false;
    }
  };

  return (
    <div className="saga3d">
      {spurenGeladen && <KapitelCanvas
        pausiert={pausiert || Boolean(fund) || suchtGerade || garageOffen}
        steuerung={steuerung}
        fall={fall}
        locations={locations}
        tageszeit={tageszeit}
        wetter={wetter}
        strassentyp={strassentyp}
        charakterModelle={charakterModelle}
        charakterGroessen={charakterGroessen}
        locationDrehungen={locationDrehungen}
        tankstelleId={tankstelleId}
        plan={plan}
        fahrzeug={fahrzeug}
        spuren={spuren}
        gefundeneSpuren={gefundeneSpuren}
        onNaehe={setNah}
        onTempo={setTempo}
        onBereit={() => setBereit(true)}
      />}
      {spurenFehler && <button className="saga3d-meldung" onClick={() => setSpurenVersuch((v) => v + 1)}>{spurenFehler}</button>}
      <div className="saga3d-hud">
        <span className="jagd-kicker">{kapitel === 0 ? "3D-FINALE" : `KAPITEL ${kapitel ?? ""} · 3D`}</span>
        <strong>{fall.stadt}</strong>
        <small>{bereit
          ? `${spuren.filter((spur) => gefundeneSpuren.includes(spur.itemId)).length}/${spuren.length} Beweise untersucht · Sprich mit den Tieren.`
          : "Die Stadt wird aufgebaut …"}</small>
      </div>
      <TouchJoystick setzen={setzen} />
      {(nah?.art === "tier" || nah?.art === "spur") && (
        <button className="experiment-ansprechen saga3d-interaktion" onClick={() => void interagieren()} disabled={suchtGerade}>
          <small>{nah.art === "tier" ? "IN DER NÄHE" : "SPUR ENTDECKT"}</small>
          <strong>{suchtGerade ? "WIMPY UNTERSUCHT …" : `${nah.name} ${nah.art === "tier" ? "ANSPRECHEN" : "ANSEHEN"}`}</strong>
        </button>
      )}
      {nah?.art === "tankstelle" && !amSteuer && (
        <button className="experiment-ansprechen saga3d-interaktion" onClick={() => { stoppen(); setGarageOffen(true); }}>
          <small>{nah.name.toUpperCase()}</small>
          <strong>⛽ INS AUTO STEIGEN</strong>
        </button>
      )}
      {nah?.art === "tankstelle" && amSteuer && (
        <button className="experiment-ansprechen saga3d-interaktion" onClick={() => { stoppen(); aussteigen(true); }}>
          <small>{nah.name.toUpperCase()}</small>
          <strong>⛽ WAGEN ABGEBEN</strong>
        </button>
      )}
      {nah?.art === "wagen" && !amSteuer && (
        <button className="experiment-ansprechen saga3d-interaktion" onClick={() => void interagieren()}>
          <small>DEIN WAGEN</small>
          <strong>🚗 {nah.name.toUpperCase()} EINSTEIGEN</strong>
        </button>
      )}
      {amSteuer && <>
        <div className="saga3d-tacho" role="status">
          <strong>{tempo}</strong>
          <span>km/h · {amSteuer.name}</span>
        </div>
        {/* Gedrückt halten: Der Hinterwagen bricht aus und man kommt um
            die Ecke, ohne vom Gas zu gehen. */}
        <button
          className="saga3d-drift"
          aria-label="Handbremse ziehen"
          onPointerDown={() => handbremse(true)}
          onPointerUp={() => handbremse(false)}
          onPointerLeave={() => handbremse(false)}
          onPointerCancel={() => handbremse(false)}
        >
          DRIFT
        </button>
        <button className="saga3d-aussteigen" onClick={() => { stoppen(); handbremse(false); aussteigen(false); }}>
          <small>{amSteuer.name.toUpperCase()}</small>
          <strong>Hier abstellen und aussteigen</strong>
        </button>
      </>}
      {garageOffen && (
        <GaragenWahl autos={meineAutos} onWaehlen={einsteigen} onSchliessen={() => setGarageOffen(false)} />
      )}
      {meldung && <button className="saga3d-meldung" onClick={() => setMeldung("")}>{meldung}</button>}
      {fund && (
        <FundMoment
          fund={fund}
          herkunft={herkunftsZeile(fund.spur?.herkunft ?? "", kapitel)}
          inhalt={tasche}
          onAufnehmen={onAufnehmen}
          onFertig={() => setFund(null)}
        />
      )}
    </div>
  );
}

/** Dieselbe Stadttechnik ohne Fall-API – für Modus IV unter Pursuit. */
export function Saga3DProbeSzene({
  locations,
  tageszeit,
  wetter,
  strassentyp,
  modellIds,
  locationDrehungen,
  tankstelleId,
  plan,
  onZurueck,
  onSchliessen,
}: {
  locations: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  strassentyp: DreiDStrassentyp;
  modellIds: string[];
  locationDrehungen: Record<string, number>;
  /** Welcher Baustein die Tankstelle ist; leer = am Namen erkennen. */
  tankstelleId?: string;
  /** Selbst gelegter Stadtplan; ohne ihn entsteht der Straßenzug wie bisher. */
  plan?: Stadtplan | null;
  onZurueck: () => void;
  onSchliessen: () => void;
}) {
  const steuerung = useRef<Richtung>({ x: 0, z: 0 });
  const [nah, setNah] = useState<Naehe | null>(null);
  const [bereit, setBereit] = useState(false);
  const [meldung, setMeldung] = useState("");
  const modellZuordnung = useMemo(
    () => Object.fromEntries(modellIds.map((id) => [id, id])),
    [modellIds],
  );
  const fall = useMemo<PublicCase>(() => {
    const stats = {
      charisma: 50,
      freundlichkeit: 50,
      fitness: 50,
      zauberkraft: 0,
      schelmischkeit: 50,
      kriminalitaetslevel: 0,
      intelligenz: 50,
    };
    const besetzung = modellIds
      .map((id, index) => ANIMATIONS_MODELLE.find((modell) => modell.id === id) && ({
        id,
        nummer: index + 1,
        name: ANIMATIONS_MODELLE.find((modell) => modell.id === id)!.name,
        tierart: ANIMATIONS_MODELLE.find((modell) => modell.id === id)!.name,
        alter: 20,
        stats,
        beschreibung: "3D-Testfigur",
        bild: "",
        istDetektiv: id === "wimpy",
      }))
      .filter((wert): wert is Character => Boolean(wert));
    return {
      id: "pursuit-3d-probe",
      besetzung,
      stadt: "3D-Probewelt",
      orte: [],
      introText: "",
      schlagworte: [],
      titel: "3D-Probewelt",
      tatbeschreibung: "",
      tatort: "",
      aufenthalt: {},
      erstelltAm: 0,
    };
  }, [modellIds]);
  const setzen = (x: number, z: number) => {
    steuerung.current = { x, z };
  };
  // In der Probewelt darf alles gefahren werden, was im Katalog steht -
  // hier wird geprüft, nicht gespielt.
  const { autos } = useAutos();
  const fahrzeug = useRef<FahrzeugBefehl>({ ...LEERER_FAHRZEUGBEFEHL });
  const [amSteuer, setAmSteuer] = useState<{ id: string; name: string } | null>(null);
  const [garageOffen, setGarageOffen] = useState(false);
  const [tempo, setTempo] = useState(0);
  const handbremse = (gezogen: boolean) => {
    fahrzeug.current = { ...fahrzeug.current, handbremse: gezogen };
  };
  const einsteigen = (auto: Auto) => {
    fahrzeug.current = {
      faehrt: {
        id: auto.id,
        name: auto.name,
        modell: auto.modell,
        drehung: auto.drehung,
        speed: auto.speed,
        beschleunigung: auto.beschleunigung,
      },
      abgeben: false,
    };
    setAmSteuer({ id: auto.id, name: auto.name });
    setTempo(0);
    setGarageOffen(false);
  };
  const aussteigen = (abgeben: boolean) => {
    fahrzeug.current = { faehrt: null, abgeben, handbremse: false };
    setAmSteuer(null);
    setTempo(0);
  };
  return (
    <div className="jagd pursuit-spiel saga3d-probe">
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <KapitelCanvas
        steuerung={steuerung}
        fall={fall}
        locations={locations}
        tageszeit={tageszeit}
        wetter={wetter}
        strassentyp={strassentyp}
        charakterModelle={modellZuordnung}
        locationDrehungen={locationDrehungen}
        tankstelleId={tankstelleId}
        plan={plan}
        fahrzeug={fahrzeug}
        onTempo={setTempo}
        pausiert={garageOffen}
        spuren={LEERE_SPUREN}
        gefundeneSpuren={[]}
        onNaehe={setNah}
        onBereit={() => setBereit(true)}
      />
      <header className="experiment-hud">
        <span className="jagd-kicker">MODUS IV · 3D-WELT-PROBE</span>
        <strong>{tageszeit.toUpperCase()} · {wetter === "sonne" ? "SONNENSCHEIN" : wetter.toUpperCase()} · {strassentyp.toUpperCase()}</strong>
        <small>{bereit ? `${modellIds.length} Modelle in der Testwelt.` : "Straßen und Tiere werden geladen …"}</small>
      </header>
      <button className="pursuit-zurueck experiment-zurueck" onClick={onZurueck}>‹ Einstellungen</button>
      <TouchJoystick setzen={setzen} />
      {nah?.art === "tier" && (
        <button className="experiment-ansprechen" onClick={() => setMeldung(`${nah.name} ist da, animiert und ansprechbar.`)}>
          <small>MODELL IN DER NÄHE</small>
          <strong>{nah.name} PRÜFEN</strong>
        </button>
      )}
      {nah?.art === "tankstelle" && (
        <button
          className="experiment-ansprechen"
          onClick={() => { setzen(0, 0); if (amSteuer) aussteigen(true); else setGarageOffen(true); }}
        >
          <small>{nah.name.toUpperCase()}</small>
          <strong>{amSteuer ? "⛽ WAGEN ABGEBEN" : "⛽ INS AUTO STEIGEN"}</strong>
        </button>
      )}
      {nah?.art === "wagen" && !amSteuer && (
        <button
          className="experiment-ansprechen"
          onClick={() => { const auto = autos.find((a) => a.id === nah.id); if (auto) einsteigen(auto); }}
        >
          <small>ABGESTELLTER WAGEN</small>
          <strong>🚗 {nah.name.toUpperCase()} EINSTEIGEN</strong>
        </button>
      )}
      {amSteuer && <>
        <div className="saga3d-tacho" role="status">
          <strong>{tempo}</strong>
          <span>km/h · {amSteuer.name}</span>
        </div>
        <button
          className="saga3d-drift"
          aria-label="Handbremse ziehen"
          onPointerDown={() => handbremse(true)}
          onPointerUp={() => handbremse(false)}
          onPointerLeave={() => handbremse(false)}
          onPointerCancel={() => handbremse(false)}
        >
          DRIFT
        </button>
        <button className="saga3d-aussteigen" onClick={() => { setzen(0, 0); handbremse(false); aussteigen(false); }}>
          <small>{amSteuer.name.toUpperCase()}</small>
          <strong>Hier abstellen und aussteigen</strong>
        </button>
      </>}
      {garageOffen && (
        <GaragenWahl autos={autos} onWaehlen={einsteigen} onSchliessen={() => setGarageOffen(false)} />
      )}
      {meldung && <button className="saga3d-meldung" onClick={() => setMeldung("")}>{meldung}</button>}
    </div>
  );
}
