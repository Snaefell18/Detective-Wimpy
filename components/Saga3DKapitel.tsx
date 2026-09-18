"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { kapitelPosition } from "@/lib/saga3dLayout";
import { TouchJoystick } from "./TouchJoystick";
import {
  LEUCHTEN,
  SAND_LICHT,
  cellShading,
  einpassen,
  fahrbahnMaterial,
  grasLand,
  wiesenTextur,
  gradientTextur,
  haeuserBauen,
  sandDunst,
  schneeLand,
  strassenBauen,
  texturenVerkleinern,
  wetterFeld,
  type StadtBlock,
} from "./stadtBau";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { modellFuerTier, spielerModell } from "@/lib/tiermodelle";
import { vergessen } from "@/lib/vorladen";
import {
  STILLSTAND,
  angeeckt,
  angezeigtesTempo,
  fahrSchritt,
  fahrwerte,
  type FahrWerte,
  type Fahrzustand,
} from "@/lib/autofahrt";
import { AUTO_MODELLE, START_AUTO_ID, autoLaenge, type Auto } from "@/lib/autos";
import { useAutos } from "@/lib/useAutos";
import { postJson } from "@/lib/api";
import { herkunftsZeile, type Beweismittel } from "@/lib/beweismittel";
import { laufAnimation } from "@/lib/pursuit";
import {
  DREI_D_LOCATIONS,
  istBlizzard,
  istDunst,
  istSchneeWetter,
  locationsFuer3D,
  polizeiAus,
  tankstelleAus,
} from "@/lib/pursuit3d";
import {
  begehbar,
  feldMitte,
  gebaeudeArten,
  gebaeudeFelder,
  planAusmass,
  planGueltig,
  sichtFelder,
  startFeld,
  verteilen,
  type Stadtplan,
} from "@/lib/stadtplan";
import { REGEL_START, leistungsProfil, nachregeln } from "@/lib/dreiDLeistung";
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
  | { art: "polizei"; id: string; name: string }
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
  polizeiId,
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
  /** Welcher die Polizeiwache ist; leer = am Namen erkennen. */
  polizeiId?: string;
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
  const bauplanText = JSON.stringify({ besetzung: fall.besetzung, locations, spuren, charakterModelle, charakterGroessen, locationDrehungen, tankstelleId: tankstelleId ?? "", polizeiId: polizeiId ?? "", plan: plan ?? null });
  const bauplan = useMemo(() => JSON.parse(bauplanText) as {
    besetzung: Character[]; locations: string[]; spuren: SpurVorschau[];
    charakterModelle: Record<string, string>; locationDrehungen: Record<string, number>;
    charakterGroessen: Record<string, number>; tankstelleId: string; polizeiId: string; plan: Stadtplan | null;
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
    /*
     * Zwei Bauweisen, dieselbe Stadt.
     *
     * Ohne Plan bleibt alles wie gehabt: ein Straßenzug, 9 Meter breit, an
     * dem die Bausteine aufgereiht sind. Mit Plan wird Feld für Feld gelegt.
     */
    const stadtplan = planGueltig(bauplan.plan) ? bauplan.plan : null;
    /*
     * Und noch bevor das erste Haus steht: Was verträgt dieses Gerät? Eine
     * selbst gelegte Stadt aus vierzig Bausteinen ist auf dem MacBook ein
     * Spiel und auf dem iPhone ein Absturz - also entscheidet lib/dreiDLeistung
     * vorab über Sichtweite, Schatten, Auflösung und Texturgröße.
     */
    const profil = leistungsProfil(stadtplan);
    /*
     * Was auf dem Stadtplan feldweise gebaut wird, bleibt auch feldweise
     * ansprechbar: ein Eintrag je Haus und je Straßenschmuck. Daraus lebt
     * beides - das Wegblenden dessen, was der Kamera im Weg steht, und das
     * Weglassen dessen, was ohnehin im Nebel steht.
     */
    const stadtBloecke: StadtBlock[] = [];
    /** Auf welchen Feldern tatsächlich ein Haus steht - "x,z". */
    const hausFelder = new Set<string>();
    const scene = new THREE.Scene();
    const himmel = {
      morgen: 0xf3a979,
      tag: wetter === "sonne" ? 0x62c8ff : 0x91b8d2,
      abend: 0xa84567,
      nacht: 0x070a16,
    }[tageszeit];
    const schneeWetter = istSchneeWetter(wetter);
    /** Liegt hier Schnee? Dann gelten andere Farben, anderes Licht - und Wehen. */
    const schneeLand3D = strassentyp === "schnee";
    /** Oder Wiese? Dann steht statt der Wehen Grün auf der Fläche. */
    const grasLand3D = strassentyp === "gras";
    // Der Sandsturm nimmt die Sicht wie ein Schneesturm - nur in Ocker.
    const sandSturm = wetter === "sandsturm";
    /** Der Blizzard: Sicht auf wenige Meter, und die Böen nehmen auch die. */
    const blizzard = istBlizzard(wetter);
    const dunst = istDunst(wetter);
    const nebel = sandSturm
      ? sandDunst(tageszeit)
      // Der Blizzard ist heller als jeder Schneesturm: ein Weiß, in dem
      // Himmel und Boden nicht mehr zu unterscheiden sind.
      : blizzard
        ? (tageszeit === "nacht" ? 0x36485f : 0xe6eef6)
        : dunst || schneeWetter ? (tageszeit === "nacht" ? 0x253749 : 0xb7cbd6) : wetter === "regen" ? 0x536777 : himmel;
    scene.background = new THREE.Color(dunst || schneeWetter ? nebel : himmel);
    /*
     * Nahbereich bleibt selbst im Whiteout lesbar (Kamera sitzt ~17 m
     * entfernt). Im Blizzard gilt das nicht mehr: Dort ist die Welt hinter
     * der nächsten Kreuzung weg, und genau das ist der Sinn der Sache. Weil
     * die Kamera hinter Wimpy steht, bleibt er selbst sichtbar.
     */
    const nebelNah = blizzard ? 12 : dunst ? 17 : wetter === "regen" ? 13 : 20;
    const nebelFern = blizzard ? 38 : dunst ? 36 : wetter === "regen" ? 48 : 68;
    /*
     * Auf dem Stadtplan endet der Nebel spätestens dort, wo das Gerät
     * aufhört zu zeichnen. Dann verschwindet ein Haus im Dunst, statt vor
     * den Augen wegzuspringen - und der Nebel steht ohnehin gut in einer
     * Stadt, in der die Laternen an sind.
     */
    const nebelGrenze = stadtplan ? Math.min(nebelFern, profil.sichtweite) : nebelFern;
    scene.fog = new THREE.Fog(nebel, Math.min(nebelNah, nebelGrenze * 0.45), nebelGrenze);
    const gradient = gradientTextur();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, Math.min(120, nebelGrenze + 35));
    camera.position.set(-9.5, 5.1, 13.8);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: profil.kantenglaettung, alpha: false });
    } catch {
      setLadeFehler("3D konnte nicht gestartet werden. Bitte erneut versuchen.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, profil.pixelGrenze));
    // Schatten sind ein zweiter Durchgang durch die halbe Stadt. Auf dem
    // Handy ist das genau der Durchgang, der zu viel ist.
    renderer.shadowMap.enabled = profil.schatten;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /*
     * Schnee ist die hellste Fläche, die es hier gibt. Wird sie auch noch
     * überbelichtet, kippt sie im Filmlook ins Cremefarbene - dann sieht die
     * Piste aus wie Sand. Deshalb steht die Blende im Schneeland enger.
     */
    renderer.toneMappingExposure = tageszeit === "nacht"
      ? 0.82
      : wetter === "sonne" ? (schneeLand3D ? 0.94 : 1.18) : schneeLand3D ? 0.9 : 0.98;
    element.appendChild(renderer.domElement);
    const kontextVerloren = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setLadeFehler("Die Grafik wurde unterbrochen. Hier die Welt an gleicher Stelle wieder öffnen.");
    };
    renderer.domElement.addEventListener("webglcontextlost", kontextVerloren);

    const oben = tageszeit === "nacht" ? 0x7aa1ff : tageszeit === "abend" ? 0xffad87 : 0xe8f8ff;
    /*
     * Was von unten zurückkommt, ist der Boden - und Schnee wirft kaltes
     * Licht zurück, kein olivgrünes. Ohne diesen Unterschied bekam die
     * Schneestraße von unten einen erdigen Schimmer.
     */
    const unten = schneeLand3D
      ? (tageszeit === "nacht" ? 0x24405e : 0xd3e6f4)
      // Und eine Wiese wirft Grün zurück - das ist der halbe Sommer.
      : grasLand3D
        ? (tageszeit === "nacht" ? 0x1d3326 : 0x5c8a4a)
        : tageszeit === "nacht" ? 0x160d2e : 0x455348;
    scene.add(new THREE.HemisphereLight(oben, unten, tageszeit === "nacht" ? 2.15 : 2.8));
    const licht = new THREE.DirectionalLight(
      wetter === "sonne"
        ? 0xfff1b8
        : sandSturm
          ? SAND_LICHT
          : tageszeit === "abend" ? 0xff9c72 : 0xb9ddff,
      // Im Sandsturm steht die Sonne als warmer Fleck dahinter: heller als
      // im Nebel, aber ohne harte Kanten.
      wetter === "sonne" ? 5.2 : sandSturm ? 1.4 : dunst ? 0.9 : wetter === "regen" || schneeWetter ? 1.5 : 2.8,
    );
    licht.position.set(-8, 14, 9);
    licht.castShadow = profil.schatten;
    licht.shadow.mapSize.set(1024, 1024);
    /*
     * Wohin der Schatten überhaupt fällt.
     *
     * Ohne diese Zeilen steht die Schattenkamera auf ihrem Standardmaß: ein
     * Kasten von zehn Metern Kantenlänge um den Nullpunkt. Alles, was weiter
     * weg steht, warf keinen Schatten - und was genau an der Grenze stand,
     * einen abgeschnittenen. Im Schnee fällt das am meisten auf: Weiß auf
     * Weiß ist nur dort zu erkennen, wo etwas einen Schatten wirft.
     */
    licht.shadow.camera.left = -26;
    licht.shadow.camera.right = 26;
    licht.shadow.camera.top = 26;
    licht.shadow.camera.bottom = -26;
    licht.shadow.camera.far = 70;
    licht.shadow.bias = -0.0015;
    licht.shadow.camera.updateProjectionMatrix();
    scene.add(licht);
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
    const bodenFarbe = sandSturm
      ? tageszeit === "nacht" ? 0x3b2f1f : 0xa98a5c
      : stadtplan
      ? strassentyp === "schnee"
        ? (tageszeit === "nacht" ? 0x8fa9c4 : 0xf1f8ff)
        : strassentyp === "sand"
          ? 0xb59468
          /*
           * Die Wiese zwischen den Häusern: satt genug, dass sie sich vom
           * Weg absetzt, und dunkel genug, dass die Büsche darauf noch zu
           * sehen sind. Im Regen wird sie tiefer, abends wärmer.
           */
          : strassentyp === "gras"
            ? tageszeit === "nacht"
              ? 0x24382a
              : tageszeit === "abend"
                ? 0x5a6b3e
                : wetter === "regen"
                  ? 0x455c3c
                  : 0x63914a
          : tageszeit === "nacht"
            ? 0x1d2732
            : tageszeit === "abend"
              ? 0x5a4a55
              : wetter === "regen"
                ? 0x3f4c52
                : 0x6b7166
      /*
       * Der unberührte Schnee neben der Straße ist heller als die Fahrbahn,
       * nicht dunkler. Andersherum - und genau so war es - sieht die Straße
       * aus wie eine helle Rampe, die durch graues Land führt.
       */
      : strassentyp === "schnee"
        ? (tageszeit === "nacht" ? 0x8fa9c4 : 0xf1f8ff)
        : strassentyp === "sand"
          ? 0x897052
          : strassentyp === "gras"
            ? (tageszeit === "nacht" ? 0x223425 : tageszeit === "tag" ? 0x5b8a45 : 0x4a6438)
            : wetter === "regen" ? 0x263647 : tageszeit === "tag" ? 0x4b5868 : 0x293448;
    /*
     * Auf der Wiese liegt ein Muster, sonst nur Farbe.
     *
     * Eine einzige grüne Fläche sieht auch nach genau dem aus. Das Muster ist
     * fast weiß und dunkelt die Bodenfarbe nur stellenweise ab - so bleibt
     * jede Tageszeit und jedes Wetter, wie es war, und die Wiese bekommt ihr
     * Kleinzeug. Etwa eine Kachel je sechs Meter: groß genug, dass man die
     * Wiederholung nicht liest, klein genug, dass man die Flecken sieht.
     */
    const wiese = grasLand3D ? wiesenTextur() : null;
    if (wiese) {
      wiese.repeat.set(
        Math.max(2, Math.round(ausmass.breite / 6)),
        Math.max(2, Math.round(ausmass.tiefe / 6)),
      );
      ressourcen.add(wiese);
    }
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(ausmass.breite, ausmass.tiefe),
      new THREE.MeshToonMaterial({
        color: bodenFarbe,
        map: wiese,
        gradientMap: gradient,
      }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = stadtplan ? 0 : -8;
    boden.receiveShadow = true;
    scene.add(boden);
    /*
     * Und wo Schnee liegt, liegt er auch neben der Straße: Wehen und
     * verschneite Tannen, damit aus der weißen Fläche eine Landschaft wird.
     * Auf dem Handy stehen weniger davon - jede ist ein eigenes Objekt.
     */
    if (schneeLand3D) {
      schneeLand({
        scene,
        gradient,
        merken: (wert) => ressourcen.add(wert),
        ausmass,
        mitteZ: stadtplan ? 0 : -8,
        plan: stadtplan,
        // Im Straßenzug steht der Schnee neben der Fahrbahn, auf dem
        // Stadtplan auf den freien Feldern - beides ohne die Stelle, an der
        // man selbst losläuft.
        startPunkt: { x: 0, z: 0 },
        menge: profil.schatten ? 30 : 16,
        tageszeit,
      });
    }
    /*
     * Und wo Wiese ist, steht auch etwas darauf: Büsche, Bäume, Grasbüschel
     * und ein paar Blumen - dieselbe Rechnung wie beim Schneeland, nur in
     * Grün (components/stadtBau.ts).
     */
    if (grasLand3D) {
      grasLand({
        scene,
        gradient,
        merken: (wert) => ressourcen.add(wert),
        ausmass,
        mitteZ: stadtplan ? 0 : -8,
        plan: stadtplan,
        startPunkt: { x: 0, z: 0 },
        // Mehr Kleinzeug als im Schnee: Die Wiese ist die einzige
        // Landschaft, in der außer dem Weg nichts steht - da darf ruhig
        // etwas los sein.
        menge: profil.schatten ? 58 : 28,
        tageszeit,
      });
    }
    const belag = fahrbahnMaterial({
      gradient,
      strassentyp,
      tageszeit,
      wetter,
      imRaster: Boolean(stadtplan),
      // Der durchgehende Straßenzug ist eine flache Fläche - nur dort darf
      // die Graspiste am Rand in die Wiese auslaufen.
      weicherRand: !stadtplan,
      merken: (wert) => ressourcen.add(wert),
    });
    if (stadtplan) {
      stadtBloecke.push(...strassenBauen({
        scene,
        plan: stadtplan,
        gradient,
        belag,
        strassentyp,
        tageszeit,
        merken: (wert) => ressourcen.add(wert),
      }));
    } else {
      const fahrbahn = new THREE.Mesh(
        new THREE.PlaneGeometry(9.2, 90),
        belag,
      );
      fahrbahn.rotation.x = -Math.PI / 2;
      fahrbahn.position.set(0, 0.012, -8);
      fahrbahn.receiveShadow = true;
      scene.add(fahrbahn);
    }
    /*
     * Was vom Himmel kommt, rechnet components/stadtBau.ts - dieselbe
     * Rechnung wie in der Arena und in der Verfolgungsjagd.
     */
    const wetterfall = wetterFeld({
      wetter,
      scene,
      merken: (wert) => ressourcen.add(wert),
      weite: 28,
      tiefe: 70,
      versatzZ: -13,
      anzahl: blizzard ? 3200 : wetter === "schneesturm" ? 1800 : sandSturm ? 2000 : 900,
    });
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
      /*
       * Flache Schultern statt Bordstein: rote Schneestangen in der Arktis,
       * helle Pfosten in der Wüste - und am Feldweg hölzerne Zaunpfähle, die
       * etwas höher stehen und warm gefärbt sind.
       */
      const hoehe = strassentyp === "schnee" ? 1.25 : strassentyp === "gras" ? 1 : 0.5;
      const farbe =
        strassentyp === "schnee" ? 0xd65a47 : strassentyp === "gras" ? 0x8a6a45 : 0xd2bb8b;
      for (const seite of [-1, 1]) {
        for (let i = 0; i < 15; i++) {
          const pfosten = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.045, hoehe, 5),
            new THREE.MeshToonMaterial({ color: farbe, gradientMap: gradient }),
          );
          pfosten.position.set(seite * 4.48, hoehe / 2, 18 - i * 4.8);
          scene.add(pfosten);
        }
      }
    }

    /* --- Tankstelle, Auto und alles, was daran hängt ------------------ */
    /*
     * Im Stadtplan zählt, was wirklich gebaut ist.
     *
     * Die Liste der Bausteine gilt für den Straßenzug; auf dem Plan wird
     * gesetzt, was man malt. Wer eine Tankstelle ins Raster malt, sie oben
     * in der Bausteinliste aber nicht angehakt hat, soll trotzdem einsteigen
     * können - sonst sucht man den Stellplatz vergeblich.
     */
    const gebaut = stadtplan ? gebaeudeArten(stadtplan) : bauplan.locations;
    const tankstelle = tankstelleAus(gebaut, bauplan.tankstelleId);
    const polizei = polizeiAus(gebaut, bauplan.polizeiId);
    /**
     * Die beiden Häuser, an denen etwas passiert: An der Tankstelle steigt
     * Wimpy ins Auto, auf der Wache spricht er die Beschuldigung aus. Wo
     * genau man dafür stehen muss, steht erst fest, wenn die Stadt gebaut
     * ist - deshalb erst hier, und erst dann der Ring dazu.
     */
    let tankPlatz: THREE.Vector3 | null = null;
    let polizeiPlatz: THREE.Vector3 | null = null;
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

    /*
     * Der Zwischenspeicher von Three.js.
     *
     * Wurde eine Datei schon während des Vorspanns geholt (lib/vorladen.ts),
     * liegt sie hier und geht nicht ein zweites Mal durch die Leitung.
     * Ausgepackt wird sie trotzdem frisch - nur so darf die Szene beim
     * Verlassen alles wieder freigeben, ohne einem späteren Aufbau die
     * Geometrie unter den Füßen wegzuziehen.
     */
    THREE.Cache.enabled = true;
    const modelle = new Map<string, ReturnType<typeof loader.loadAsync>>();
    const laden = (datei: string) => {
      let ladung = modelle.get(datei);
      if (!ladung) {
        ladung = loader.loadAsync(datei).then((gltf) => {
          registrieren(gltf.scene);
          // Die Rohdaten haben ihren Dienst getan; behalten würde nur Speicher
          // kosten, den ein Handy woanders braucht.
          void vergessen(datei);
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
        const gebraucht = [...new Set(gebaeudeFelder(stadtplan).map((feld) => feld.id))];
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
          texturenVerkleinern(ergebnis.value.szene, profil.texturGrenze);
          cellShading(ergebnis.value.szene, gradient, [], LEUCHTEN[tageszeit] ?? 0);
          registrieren(ergebnis.value.szene);
          geladen.set(ergebnis.value.id, ergebnis.value.szene);
        }
        const gebaut = haeuserBauen({ scene, plan: stadtplan, vorlagen: geladen });
        stadtBloecke.push(...gebaut.bloecke);
        for (const feld of gebaut.hausFelder) hausFelder.add(feld);
        // Der Platz vor Tankstelle und Wache steht jetzt fest - dort landet
        // gleich der Ring, auf dem man einsteigt oder beschuldigt.
        const tank = tankstelle ? gebaut.tuerPlaetze.get(tankstelle.id) : undefined;
        if (tank) tankPlatz = new THREE.Vector3(tank.x, 0, tank.z);
        const wache = polizei ? gebaut.tuerPlaetze.get(polizei.id) : undefined;
        if (wache) polizeiPlatz = new THREE.Vector3(wache.x, 0, wache.z);
      } else {

      const locationEintraege = locationsFuer3D(locations);
      const kulissen = await Promise.allSettled(locationEintraege.map((ort) => laden(ort.datei)));
      if (beendet) return;
      kulissenFehler = kulissen.some((ergebnis) => ergebnis.status === "rejected");
      const vorlagen = kulissen.flatMap((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return [];
        const vorlage = ergebnis.value.scene;
        texturenVerkleinern(vorlage, profil.texturGrenze);
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
        // Die erste aufgebaute Tankstelle ist Wimpys Garage, die erste
        // Wache die, auf der beschuldigt wird. Beide stehen am rechten
        // Straßenrand; der Platz davor liegt dicht an ihrer Kante.
        if (tankstelle && eintrag.id === tankstelle.id && tankPlatz === null) {
          tankPlatz = new THREE.Vector3(3.2, 0, block.position.z);
        }
        if (polizei && eintrag.id === polizei.id && polizeiPlatz === null) {
          polizeiPlatz = new THREE.Vector3(3.2, 0, block.position.z);
        }
        cursorZ -= eintrag.laenge + 1.1;
        i++;
      }
      }
      /*
       * Ein ruhiger Ring auf dem Boden zeigt, wo etwas geht. Er leuchtet
       * nicht und blinkt nicht - er liegt einfach da, wie aufgemalt. Gelb an
       * der Tankstelle, blau vor der Wache.
       */
      for (const [platz, farbe] of [
        [tankPlatz, 0xf6c667],
        [polizeiPlatz, 0x7ab6ff],
      ] as const) {
        if (!platz) continue;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.75, 1.15, 28),
          new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(platz.x, 0.04, platz.z);
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
    const wagenBauen = async (wunsch: { modell: string; drehung: number; groesse?: number }) => {
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
      // Dieselbe Rechnung wie in der Verfolgungsjagd: gleiche Länge für alle,
      // mal der Größe aus dem Katalog.
      körper.scale.multiplyScalar(autoLaenge(wunsch, 3) / Math.max(groesse.x, groesse.z, 0.001));
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
      fahrt = { winkel: spieler.rotation.y, kurs: spieler.rotation.y, tempo: 0, drift: 0 };
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
    /** Die Leistungsregelung und die Sichtweite, mit der sie gerade fährt. */
    let regel = REGEL_START;
    let sichtweite = profil.sichtweite;
    /** Wie viel vom vollen Kameraabstand gerade übrig ist: 1 = ganz hinten. */
    let naeher = 1;
    const zeichnen = (jetzt: number) => {
      /*
       * Zwei Zeitmaße: Für alles, was sich bewegt, ist die Schrittweite
       * gedeckelt - ein Tabwechsel darf niemanden durch eine Hauswand
       * schieben. Die Leistungsregelung dagegen will gerade wissen, wann ein
       * Bild zu lange gebraucht hat, und bekommt die rohe Zeit.
       */
      const rohDt = (jetzt - letzter) / 1000;
      const dt = Math.min(0.035, Math.max(0.001, rohDt));
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
         * Am Steuer ist der Stick dasselbe wie zu Fuß: Er zeigt, wohin es
         * gehen soll. Nur zieht der Wagen erst an, trägt, legt sich in die
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
        // fahrt.drift ist der Winkel, in dem sie zum Kurs steht.
        const schraeg = THREE.MathUtils.clamp(-fahrt.drift * 0.42, -0.3, 0.3);
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
      if (wetterfall) {
        wetterfall.bewegen(dt, jetzt);
        /*
         * Das Wetter zieht mit - wie in der Arena.
         *
         * Der Ausschnitt ist knapp dreißig auf siebzig Meter; eine Stadt ist
         * größer. Blieb er am Nullpunkt stehen, schneite es nur dort, und
         * wer in die hintere Ecke lief, stand im Trockenen. Beim Feuerwerk
         * fiele es sofort auf: Man ginge um die Ecke, und der Himmel wäre
         * leer.
         */
        wetterfall.gruppe.position.set(spieler.position.x, 0, spieler.position.z);
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
        if (distanz < 2.6 && (amSteuer || distanz < abstand)) {
          abstand = distanz;
          nah = { gruppe: spieler, info: { art: "tankstelle", id: tankstelle.id, name: tankstelle.name } };
        }
      }
      // Auf die Wache geht Wimpy zu Fuß - aus dem Auto heraus beschuldigt
      // niemand.
      if (polizeiPlatz && polizei && !amSteuer) {
        const distanz = polizeiPlatz.distanceTo(spieler.position);
        if (distanz < 2.6 && distanz < abstand) {
          abstand = distanz;
          nah = { gruppe: spieler, info: { art: "polizei", id: polizei.id, name: polizei.name } };
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
      const vollX = spieler.position.x - 9.5 * weite;
      const vollZ = spieler.position.z + 13.8 * weite;
      /*
       * In einer Rasterstadt steht die Kamera regelmäßig in einem Haus. Dann
       * rückt sie heran und ein Stück höher, statt hinter der Fassade zu
       * bleiben - gemessen aber immer an der vollen, ungekürzten Position.
       * Sonst schaukelte es sich auf: nah genug für freie Sicht, also wieder
       * zurück, also wieder verdeckt, also wieder heran.
       */
      if (stadtplan && hausFelder.size) {
        const verdeckt = sichtFelder(stadtplan, spieler.position.x, spieler.position.z, vollX, vollZ)
          .filter((feld) => hausFelder.has(`${feld.x},${feld.z}`)).length;
        naeher = THREE.MathUtils.damp(naeher, verdeckt >= 2 ? 0.6 : verdeckt === 1 ? 0.78 : 1, 3, dt);
      }
      zielKamera.set(
        spieler.position.x + (vollX - spieler.position.x) * naeher,
        5.1 * weite + (1 - naeher) * 1.8,
        spieler.position.z + (vollZ - spieler.position.z) * naeher,
      );
      camera.position.lerp(zielKamera, 1 - Math.exp(-(amSteuer ? 3.4 : 5) * dt));
      // Vorausgeschaut wird entlang des Kurses, nicht entlang der
      // Karosserie: Im Drift steht die quer, gefahren wird trotzdem dorthin.
      const voraus = flott * 5.5;
      camera.lookAt(
        spieler.position.x + Math.sin(fahrt.kurs) * voraus,
        1.05,
        spieler.position.z + 0.7 + Math.cos(fahrt.kurs) * voraus,
      );
      /*
       * Und dann wird aufgeräumt, jedes Bild neu. Zweierlei auf einmal:
       *
       * Was zu weit weg ist, wird gar nicht erst gezeichnet - dort steht
       * ohnehin nur Nebel, und ein einziger Baustein sind 180.000 Dreiecke.
       * Wie weit "zu weit" ist, verhandelt die Regelung laufend mit dem
       * Gerät: Wer ruckelt, sieht ein Stück weniger Stadt, und wer wieder
       * Luft hat, bekommt sie zurück.
       *
       * Und was zwischen Kamera und Wimpy steht, blendet sich weg. Die
       * Kamera sitzt siebzehn Meter schräg hinter ihm, im Raster also gern
       * einmal mitten in einem Haus; ohne das schaut man beim Spielen auf
       * eine Fassade. Weggeblendet wird weich über eine gute Zehntelsekunde
       * - nichts springt, nichts blitzt.
       */
      /**
       * Wie weit man in diesem Bild sieht.
       *
       * Im Blizzard zieht die Böe die Sicht zusätzlich zu - und zwar auch
       * im alten Straßenzug, in dem sonst nichts am Nebel dreht.
       */
      const sichtSetzen = (fern: number) => {
        if (!(scene.fog instanceof THREE.Fog)) return;
        const weit = fern * (wetterfall?.sicht(jetzt) ?? 1);
        scene.fog.far = weit;
        scene.fog.near = Math.min(nebelNah, weit * 0.45);
      };
      if (blizzard && !stadtBloecke.length) sichtSetzen(nebelFern);
      if (stadtBloecke.length) {
        // Nach einem Tabwechsel liegen Sekunden zwischen zwei Bildern. Das
        // ist kein Ruckeln, das ist eine Pause - die zählt nicht.
        if (rohDt < 0.5) regel = nachregeln(regel, rohDt);
        sichtweite += (profil.sichtweite * regel.faktor - sichtweite) * Math.min(1, dt * 0.7);
        sichtSetzen(Math.min(nebelFern, sichtweite));
        const imWeg = stadtplan
          ? sichtFelder(stadtplan, spieler.position.x, spieler.position.z, camera.position.x, camera.position.z)
          : [];
        for (const eintrag of stadtBloecke) {
          const feld = eintrag.feld;
          if (feld) {
            const ziel = imWeg.some((vor) => vor.x === feld.x && vor.z === feld.z) ? 0 : 1;
            if (eintrag.sicht !== ziel) {
              eintrag.sicht = THREE.MathUtils.damp(eintrag.sicht, ziel, 9, dt);
              if (Math.abs(eintrag.sicht - ziel) < 0.012) eintrag.sicht = ziel;
              for (const material of eintrag.materialien) material.opacity = eintrag.sicht;
            }
          }
          eintrag.gruppe.visible =
            eintrag.sicht > 0.02 && eintrag.mitte.distanceTo(camera.position) < sichtweite;
        }
      }
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
  polizeiId,
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
  onBeschuldigen,
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
  /** Welcher die Polizeiwache ist; leer = am Namen erkennen. */
  polizeiId?: string;
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
  /**
   * Auf der Wache wird beschuldigt. Fehlt der Rückruf - oder steht in der
   * Stadt gar keine Wache -, bleibt die Beschuldigung dort, wo sie immer
   * war: im Menü.
   */
  onBeschuldigen?: () => void;
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
    if (nah.art === "polizei") {
      onBeschuldigen?.();
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
        polizeiId={polizeiId}
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
  polizeiId,
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
  /** Welcher die Polizeiwache ist; leer = am Namen erkennen. */
  polizeiId?: string;
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
        polizeiId={polizeiId}
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
      {/* In der Probewelt gibt es keinen Fall, also auch niemanden zu
          beschuldigen - geprüft wird hier nur, ob man die Wache findet. */}
      {nah?.art === "polizei" && (
        <button
          className="experiment-ansprechen"
          onClick={() => { setzen(0, 0); setMeldung(`${nah.name} ist erreichbar - im Spiel wird hier beschuldigt.`); }}
        >
          <small>{nah.name.toUpperCase()}</small>
          <strong>🚔 WACHE BETRETEN</strong>
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
