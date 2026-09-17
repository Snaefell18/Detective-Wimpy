"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AnimationsModell } from "@/lib/animations.generated";
import { REGEL_START, leistungsProfil, nachregeln } from "@/lib/dreiDLeistung";
import {
  GEGNER_SCHLAG_TREFFER,
  GEGNER_SCHUSS_TEMPO,
  ROLLE_TEMPO,
  SCHUSS_TEMPO,
  SCHUSS_WEITE,
  STAMPF_RADIUS,
  angriffSchaden,
  ausholFortschritt,
  clipsFuerModell,
  darfRollen,
  darfSchiessen,
  darfSchlagen,
  gegnerDenken,
  gegnerTempo,
  gegnerTreffen,
  neuerKampf,
  rolleGesetzt,
  salvenBreite,
  schlagGesetzt,
  schussGesetzt,
  uhrWeiter,
  werteFuer,
  wimpyTreffen,
  type KampfStand,
  type KampfStufe,
} from "@/lib/kampf";
import { DREI_D_LOCATIONS } from "@/lib/pursuit3d";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "@/lib/pursuit3d";
import {
  FELD_GROESSE,
  begehbar,
  feldMitte,
  gebaeudeArten,
  planAusmass,
  sichtFelder,
  startFeld,
  strassenFelder,
  type Stadtplan,
} from "@/lib/stadtplan";
import { vergessen } from "@/lib/vorladen";
import { Hintergrundmusik } from "./Hintergrundmusik";
import { TouchJoystick } from "./TouchJoystick";
import {
  LEUCHTEN,
  SAND_LICHT,
  cellShading,
  einpassen,
  fahrbahnMaterial,
  gradientTextur,
  haeuserBauen,
  sandDunst,
  schneeLand,
  strassenBauen,
  texturenVerkleinern,
  wetterFeld,
  type StadtBlock,
} from "./stadtBau";

/**
 * Der Showdown in 3D: Wimpy gegen den Culprit.
 *
 * Die Arena ist eine ganz normale 3D-Stadt (components/stadtBau.ts), nur
 * ohne Tiere, Spuren und Autos. Darin stehen zwei Figuren, und was zwischen
 * ihnen passiert, rechnet lib/kampf.ts aus - diese Datei zeichnet es bloß:
 * Kugeln, Funken, Wellen, eine Kamera, die wackelt, wenn es kracht.
 *
 * Was hier steht, muss auf einem iPhone laufen. Deshalb gilt dasselbe wie im
 * 3D-Kapitel: Sichtweite, Schatten und Texturgröße kommen aus
 * lib/dreiDLeistung, es gibt keine zusätzlichen Lichtquellen, und jeder
 * Effekt kommt aus einem kleinen Vorrat, der wiederverwendet wird, statt in
 * jedem Treffer neue Objekte anzulegen.
 */

type Richtung = { x: number; z: number };

/**
 * Die beiden Knöpfe.
 *
 * Gezählt statt geschaltet: Die Oberfläche erhöht bei jedem Tippen die Zahl,
 * die Szene merkt sich die zuletzt gesehene. So geht kein Tippen verloren,
 * auch wenn zwischen zwei Bildern zweimal gedrückt wird - und die Szene wird
 * nie neu aufgebaut, weil sich eine Eigenschaft geändert hat.
 */
export type KampfBefehl = { angriff: number; ausweichen: number };

/** Was das HUD über den Stand des Kampfes wissen muss. */
export type KampfAnzeige = {
  wimpy: number;
  gegner: number;
  phase: 1 | 2;
  kombo: number;
  /** Ist der Gegner nah genug für den Nahkampf? Dann heißt der Knopf anders. */
  nah: boolean;
  rolleBereit: boolean;
  ergebnis: KampfStand["ergebnis"];
};

const LEERE_ANZEIGE: KampfAnzeige = {
  wimpy: 1,
  gegner: 1,
  phase: 1,
  kombo: 0,
  nah: false,
  rolleBereit: true,
  ergebnis: "laeuft",
};

/** Die Farben des Kampfes: Wimpy zaubert türkis, der Culprit violett. */
const WIMPY_FARBE = 0x5ce1ff;
const GEGNER_FARBE = 0xc45cff;

function ArenaCanvas({
  plan,
  strassentyp,
  tageszeit,
  wetter,
  stufe,
  spielerModell,
  gegnerModell,
  gegnerGroesse,
  steuerung,
  befehle,
  onAnzeige,
  onBereit,
  onEnde,
}: {
  plan: Stadtplan;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  stufe: KampfStufe;
  spielerModell?: AnimationsModell;
  gegnerModell?: AnimationsModell;
  gegnerGroesse: number;
  steuerung: MutableRefObject<Richtung>;
  befehle: MutableRefObject<KampfBefehl>;
  onAnzeige: (wert: KampfAnzeige) => void;
  onBereit: () => void;
  onEnde: (ergebnis: "gewonnen" | "verloren") => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [versuch, setVersuch] = useState(0);
  const callbacks = useRef({ onAnzeige, onBereit, onEnde });
  callbacks.current = { onAnzeige, onBereit, onEnde };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    setLadeFehler("");

    /* --- Aufräumen: alles, was Speicher hält, kommt hier hinein ------- */
    const ressourcen = new Set<{ dispose: () => void }>();
    const merken = (wert: { dispose: () => void }) => ressourcen.add(wert);
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

    const profil = leistungsProfil(plan);
    const werte = werteFuer(stufe);
    let stand = neuerKampf(werte);

    /* --- Die Arena --------------------------------------------------- */
    const scene = new THREE.Scene();
    const nacht = tageszeit === "nacht";
    const himmel = {
      morgen: 0xf3a979,
      tag: wetter === "sonne" ? 0x62c8ff : 0x91b8d2,
      abend: 0xa84567,
      nacht: 0x070a16,
    }[tageszeit];
    const schneeWetter = wetter === "schnee" || wetter === "schneesturm";
    /** Liegt hier Schnee? Dann gelten andere Farben, anderes Licht - und Wehen. */
    const schneeLand3D = strassentyp === "schnee";
    // Der Sandsturm nimmt die Sicht wie ein Schneesturm - nur in Ocker.
    const sandSturm = wetter === "sandsturm";
    const dunst = wetter === "nebel" || wetter === "schneesturm" || sandSturm;
    const nebel = sandSturm
      ? sandDunst(tageszeit)
      : dunst || schneeWetter ? (nacht ? 0x253749 : 0xb7cbd6) : wetter === "regen" ? 0x536777 : himmel;
    scene.background = new THREE.Color(dunst || schneeWetter ? nebel : himmel);
    const nebelNah = dunst ? 17 : wetter === "regen" ? 13 : 20;
    const nebelFern = Math.min(dunst ? 36 : 68, profil.sichtweite);
    scene.fog = new THREE.Fog(nebel, Math.min(nebelNah, nebelFern * 0.45), nebelFern);
    const gradient = gradientTextur();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, Math.min(140, nebelFern + 40));
    camera.position.set(-9.5, 5.1, 13.8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: profil.kantenglaettung, alpha: false });
    } catch {
      setLadeFehler("3D konnte nicht gestartet werden. Bitte erneut versuchen.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, profil.pixelGrenze));
    renderer.shadowMap.enabled = profil.schatten;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Im Schneeland steht die Blende enger - sonst wird aus Weiß Creme.
    renderer.toneMappingExposure = nacht
      ? 0.86
      : wetter === "sonne" ? (schneeLand3D ? 0.94 : 1.18) : schneeLand3D ? 0.9 : 0.98;
    element.appendChild(renderer.domElement);
    const kontextVerloren = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setLadeFehler("Die Grafik wurde unterbrochen. Hier den Kampf neu beginnen.");
    };
    renderer.domElement.addEventListener("webglcontextlost", kontextVerloren);

    const oben = nacht ? 0x7aa1ff : tageszeit === "abend" ? 0xffad87 : 0xe8f8ff;
    // Schnee wirft kaltes Licht zurück, kein olivgrünes - siehe 3D-Kapitel.
    const unten = schneeLand3D
      ? (nacht ? 0x24405e : 0xd3e6f4)
      : nacht ? 0x160d2e : 0x455348;
    scene.add(new THREE.HemisphereLight(oben, unten, nacht ? 2.15 : 2.8));
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

    const ausmass = planAusmass(plan);
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(ausmass.breite + 24, ausmass.tiefe + 24),
      new THREE.MeshToonMaterial({
        color: sandSturm
          ? nacht ? 0x3b2f1f : 0xa98a5c
          // Unberührter Schnee ist heller als die Fahrbahn - siehe 3D-Kapitel.
          : strassentyp === "schnee" ? (nacht ? 0x8fa9c4 : 0xf1f8ff) : strassentyp === "sand" ? 0xb59468 : nacht ? 0x1d2732 : 0x6b7166,
        gradientMap: gradient,
      }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    scene.add(boden);
    registrieren(boden);
    // Auch die Arena steht im Schneeland, wenn ihre Straßen aus Schnee sind.
    if (schneeLand3D) {
      schneeLand({
        scene,
        gradient,
        merken,
        ausmass: { breite: ausmass.breite + 24, tiefe: ausmass.tiefe + 24 },
        plan,
        menge: profil.schatten ? 26 : 14,
        tageszeit,
      });
    }

    const stadtBloecke: StadtBlock[] = [];
    stadtBloecke.push(...strassenBauen({
      scene,
      plan,
      gradient,
      belag: fahrbahnMaterial({ gradient, strassentyp, tageszeit, wetter, imRaster: true, merken }),
      strassentyp,
      tageszeit,
      merken,
    }));
    /** Auf welchen Feldern ein Haus steht - dafür weicht die Kamera aus. */
    const hausFelder = new Set<string>();

    /* --- Wetter: dieselbe Rechnung wie in der Stadt ------------------- */
    const wetterfall = wetterFeld({
      wetter,
      scene,
      merken,
      weite: 40,
      tiefe: 40,
      anzahl: wetter === "schneesturm" ? 1200 : sandSturm ? 1500 : 700,
    });

    /* --- Die beiden Kämpfer ------------------------------------------ */
    const spieler = new THREE.Group();
    const gegner = new THREE.Group();
    const start = startFeld(plan);
    if (start) {
      const mitte = feldMitte(plan, start.x, start.z);
      spieler.position.set(mitte.x, 0, mitte.z);
    }
    /*
     * Wo der Gegner steht, wenn es losgeht.
     *
     * Nicht daneben - sonst hätte man seinen ersten Schlag kassiert, bevor
     * der Daumen am Stick liegt. Aber auch nicht in der hintersten Ecke: Auf
     * einem großen Platz stünde er dann im Nebel, und die ersten zwanzig
     * Sekunden liefe man einander nur entgegen. Zwei Straßen Abstand sind
     * genau richtig - und wenn die Arena kleiner ist, eben so weit wie sie
     * hergibt.
     */
    const wunschAbstand = FELD_GROESSE * 2;
    const gegnerFeld = strassenFelder(plan).reduce(
      (beste, feld) => {
        const mitte = feldMitte(plan, feld.x, feld.z);
        const distanz = Math.hypot(mitte.x - spieler.position.x, mitte.z - spieler.position.z);
        return Math.abs(distanz - wunschAbstand) < Math.abs(beste.distanz - wunschAbstand)
          ? { distanz, mitte }
          : beste;
      },
      { distanz: 0, mitte: { x: spieler.position.x, z: spieler.position.z } },
    );
    gegner.position.set(gegnerFeld.mitte.x, 0, gegnerFeld.mitte.z);
    scene.add(spieler);
    scene.add(gegner);

    /* --- Alles, was fliegt, leuchtet und knallt ----------------------- */
    const kugelGeometrie = new THREE.SphereGeometry(0.34, 10, 8);
    const halbGeometrie = new THREE.SphereGeometry(0.62, 10, 8);
    merken(kugelGeometrie);
    merken(halbGeometrie);
    const kugelMaterial = {
      wimpy: new THREE.MeshBasicMaterial({ color: WIMPY_FARBE }),
      gegner: new THREE.MeshBasicMaterial({ color: GEGNER_FARBE }),
    };
    const halbMaterial = {
      wimpy: new THREE.MeshBasicMaterial({ color: WIMPY_FARBE, transparent: true, opacity: 0.32, depthWrite: false }),
      gegner: new THREE.MeshBasicMaterial({ color: GEGNER_FARBE, transparent: true, opacity: 0.32, depthWrite: false }),
    };
    for (const material of [...Object.values(kugelMaterial), ...Object.values(halbMaterial)]) merken(material);

    type Kugel = {
      gruppe: THREE.Group;
      richtung: THREE.Vector3;
      tempo: number;
      lebt: number;
      vonWimpy: boolean;
      schaden: number;
    };
    const kugeln: Kugel[] = [];
    /** Ein Geschoss aus dem Vorrat - oder ein neues, wenn alle unterwegs sind. */
    const kugelHolen = (vonWimpy: boolean): Kugel => {
      const frei = kugeln.find((k) => k.lebt <= 0 && k.vonWimpy === vonWimpy);
      if (frei) return frei;
      const art = vonWimpy ? "wimpy" : "gegner";
      const gruppe = new THREE.Group();
      gruppe.add(new THREE.Mesh(kugelGeometrie, kugelMaterial[art]));
      const halo = new THREE.Mesh(halbGeometrie, halbMaterial[art]);
      gruppe.add(halo);
      scene.add(gruppe);
      const kugel: Kugel = { gruppe, richtung: new THREE.Vector3(), tempo: 0, lebt: 0, vonWimpy, schaden: 0 };
      kugeln.push(kugel);
      return kugel;
    };
    const schiessen = (
      von: THREE.Vector3,
      nach: THREE.Vector3,
      vonWimpy: boolean,
      schaden: number,
      streuung = 0,
    ) => {
      const kugel = kugelHolen(vonWimpy);
      const winkel = Math.atan2(nach.x - von.x, nach.z - von.z) + streuung;
      kugel.richtung.set(Math.sin(winkel), 0, Math.cos(winkel));
      kugel.tempo = vonWimpy ? SCHUSS_TEMPO : GEGNER_SCHUSS_TEMPO;
      kugel.schaden = schaden;
      kugel.lebt = SCHUSS_WEITE / kugel.tempo;
      kugel.gruppe.position.set(von.x + kugel.richtung.x * 0.8, 1.15, von.z + kugel.richtung.z * 0.8);
      kugel.gruppe.visible = true;
    };

    /*
     * Funken.
     *
     * Ein Treffer ohne Funken fühlt sich an wie ein Tastendruck ins Leere.
     * Acht Schwärme zu je sechzehn Punkten reichen für den ganzen Kampf: Wer
     * ausgebrannt ist, wird wieder angezündet.
     */
    const FUNKEN = 16;
    const funkenSchwaerme: { punkte: THREE.Points; tempo: Float32Array; lebt: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const geometrie = new THREE.BufferGeometry();
      geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FUNKEN * 3), 3));
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const punkte = new THREE.Points(geometrie, material);
      punkte.frustumCulled = false;
      punkte.visible = false;
      scene.add(punkte);
      merken(geometrie);
      merken(material);
      funkenSchwaerme.push({ punkte, tempo: new Float32Array(FUNKEN * 3), lebt: 0 });
    }
    const funken = (stelle: THREE.Vector3, farbe: number, wucht = 1) => {
      const schwarm = funkenSchwaerme.find((s) => s.lebt <= 0) ?? funkenSchwaerme[0];
      const positionen = schwarm.punkte.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < FUNKEN; i++) {
        positionen.setXYZ(i, stelle.x, stelle.y, stelle.z);
        const winkel = Math.random() * Math.PI * 2;
        const hoch = 1.2 + Math.random() * 3.4;
        const weite = (1.6 + Math.random() * 4.2) * wucht;
        schwarm.tempo.set([Math.sin(winkel) * weite, hoch, Math.cos(winkel) * weite], i * 3);
      }
      positionen.needsUpdate = true;
      (schwarm.punkte.material as THREE.PointsMaterial).color.setHex(farbe);
      (schwarm.punkte.material as THREE.PointsMaterial).size = 0.3 * wucht;
      schwarm.punkte.visible = true;
      schwarm.lebt = 0.55;
    };

    /** Wellen: der Stampfer, der Wutausbruch und jeder große Einschlag. */
    const wellenGeometrie = new THREE.RingGeometry(0.62, 1, 36);
    merken(wellenGeometrie);
    const wellen: { mesh: THREE.Mesh; lebt: number; dauer: number; weite: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: GEGNER_FARBE,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(wellenGeometrie, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      merken(material);
      wellen.push({ mesh, lebt: 0, dauer: 0.5, weite: 1 });
    }
    const welle = (stelle: THREE.Vector3, weite: number, farbe: number, dauer = 0.5) => {
      const frei = wellen.find((w) => w.lebt <= 0) ?? wellen[0];
      frei.mesh.position.set(stelle.x, 0.08, stelle.z);
      (frei.mesh.material as THREE.MeshBasicMaterial).color.setHex(farbe);
      frei.mesh.visible = true;
      frei.weite = weite;
      frei.dauer = dauer;
      frei.lebt = dauer;
    };

    /*
     * Der Warnring.
     *
     * Er ist die wichtigste Zeile dieser Datei: Solange der Gegner ausholt,
     * wächst unter ihm ein Ring. Ist er voll, schlägt es ein. Wer ihn sieht,
     * kann weg - und genau deshalb ist der Kampf zu schaffen.
     */
    const warnGeometrie = new THREE.RingGeometry(0.75, 1, 32);
    const warnMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    merken(warnGeometrie);
    merken(warnMaterial);
    const warnRing = new THREE.Mesh(warnGeometrie, warnMaterial);
    warnRing.rotation.x = -Math.PI / 2;
    warnRing.visible = false;
    scene.add(warnRing);

    /** Der Schatten unter den Füßen - ein Fleck, kein zweiter Durchgang. */
    const fleckGeometrie = new THREE.CircleGeometry(0.85, 20);
    const fleckMaterial = new THREE.MeshBasicMaterial({
      color: 0x0b1220,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    merken(fleckGeometrie);
    merken(fleckMaterial);
    for (const traeger of [spieler, gegner]) {
      const fleck = new THREE.Mesh(fleckGeometrie, fleckMaterial);
      fleck.rotation.x = -Math.PI / 2;
      fleck.position.y = 0.05;
      traeger.add(fleck);
    }
    /*
     * Und ein Ring unter dem Gegner.
     *
     * Eine Arena ist groß, nachts ist sie dunkel, und hinter einer Häuserecke
     * ist ein Tier schnell verschwunden. Der Ring sagt jederzeit, wo er
     * steht - ohne dass man die Kamera schwenken muss, die es hier gar nicht
     * gibt.
     */
    const zielGeometrie = new THREE.RingGeometry(1.15, 1.4, 28);
    const zielMaterial = new THREE.MeshBasicMaterial({
      color: GEGNER_FARBE,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    merken(zielGeometrie);
    merken(zielMaterial);
    const zielRing = new THREE.Mesh(zielGeometrie, zielMaterial);
    zielRing.rotation.x = -Math.PI / 2;
    zielRing.position.y = 0.06;
    gegner.add(zielRing);

    /* --- Modelle laden ------------------------------------------------ */
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    THREE.Cache.enabled = true;
    const geladen = new Map<string, ReturnType<typeof loader.loadAsync>>();
    const laden = (datei: string) => {
      let ladung = geladen.get(datei);
      if (!ladung) {
        ladung = loader.loadAsync(datei).then((gltf) => {
          registrieren(gltf.scene);
          void vergessen(datei);
          if (beendet) freigeben();
          return gltf;
        });
        geladen.set(datei, ladung);
      }
      return ladung;
    };

    const mixer: THREE.AnimationMixer[] = [];
    /** Eine Figur samt ihrer Aktionen - beide Kämpfer sind gleich gebaut. */
    type Kaempfer = {
      mixer: THREE.AnimationMixer | null;
      aktionen: Record<"lauf" | "ruhe" | "schlag" | "wurf" | "jubel", THREE.AnimationAction | null>;
      aktiv: THREE.AnimationAction | null;
      /** Restzeit, in der die laufende Aktion nicht unterbrochen wird. */
      festRest: number;
      /** Materialien der Figur - sie blitzen bei einem Treffer auf. */
      materialien: THREE.MeshToonMaterial[];
      blitz: number;
    };
    const leererKaempfer = (): Kaempfer => ({
      mixer: null,
      aktionen: { lauf: null, ruhe: null, schlag: null, wurf: null, jubel: null },
      aktiv: null,
      festRest: 0,
      materialien: [],
      blitz: 0,
    });
    const held = leererKaempfer();
    const boese = leererKaempfer();

    const figurLaden = async (
      modell: AnimationsModell | undefined,
      traeger: THREE.Group,
      kaempfer: Kaempfer,
      hoehe: number,
    ) => {
      if (!modell) throw new Error("Kein Modell");
      const gltf = await laden(modell.datei);
      if (beendet) throw new Error("Szene geschlossen");
      const figur = cloneSkeleton(gltf.scene);
      cellShading(figur, gradient);
      einpassen(figur, hoehe);
      registrieren(figur);
      traeger.add(figur);
      figur.traverse((kind) => {
        if (!(kind instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(kind.material) ? kind.material : [kind.material]) {
          if (material instanceof THREE.MeshToonMaterial) kaempfer.materialien.push(material);
        }
      });
      const werkzeug = new THREE.AnimationMixer(figur);
      mixer.push(werkzeug);
      kaempfer.mixer = werkzeug;
      const clips = clipsFuerModell(modell);
      const hole = (name: string | null) => {
        const clip = name ? gltf.animations.find((eintrag) => eintrag.name === name) : null;
        return clip ? werkzeug.clipAction(clip) : null;
      };
      kaempfer.aktionen = {
        lauf: hole(clips.lauf),
        ruhe: hole(clips.ruhe),
        schlag: hole(clips.schlag),
        wurf: hole(clips.wurf),
        jubel: hole(clips.jubel),
      };
      kaempfer.aktiv = kaempfer.aktionen.ruhe ?? kaempfer.aktionen.lauf;
      kaempfer.aktiv?.play();
    };

    /** Weich von einer Bewegung in die nächste. */
    const zeigen = (kaempfer: Kaempfer, welche: keyof Kaempfer["aktionen"], tempo = 1) => {
      const ziel = kaempfer.aktionen[welche] ?? kaempfer.aktionen.ruhe ?? kaempfer.aktionen.lauf;
      if (!ziel || ziel === kaempfer.aktiv) {
        if (ziel) ziel.setEffectiveTimeScale(tempo);
        return;
      }
      kaempfer.aktiv?.fadeOut(0.12);
      ziel.reset().setEffectiveTimeScale(tempo).fadeIn(0.12).play();
      kaempfer.aktiv = ziel;
    };

    const aufbauen = async () => {
      let fehlt = false;
      const gebraucht = gebaeudeArten(plan);
      const bausteine = await Promise.allSettled(
        gebraucht.map(async (id) => {
          const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
          if (!ort) throw new Error("Baustein fehlt");
          return { id, szene: (await laden(ort.datei)).scene };
        }),
      );
      if (beendet) return;
      fehlt = bausteine.some((ergebnis) => ergebnis.status === "rejected");
      const vorlagen = new Map<string, THREE.Object3D>();
      for (const ergebnis of bausteine) {
        if (ergebnis.status !== "fulfilled") continue;
        texturenVerkleinern(ergebnis.value.szene, profil.texturGrenze);
        cellShading(ergebnis.value.szene, gradient, [], LEUCHTEN[tageszeit] ?? 0);
        registrieren(ergebnis.value.szene);
        vorlagen.set(ergebnis.value.id, ergebnis.value.szene);
      }
      const gebaut = haeuserBauen({ scene, plan, vorlagen });
      stadtBloecke.push(...gebaut.bloecke);
      for (const feld of gebaut.hausFelder) hausFelder.add(feld);

      const figuren = await Promise.allSettled([
        figurLaden(spielerModell, spieler, held, 2.05),
        figurLaden(gegnerModell, gegner, boese, 1.8 * gegnerGroesse),
      ]);
      if (beendet) return;
      if (figuren.some((ergebnis) => ergebnis.status === "rejected") || fehlt) {
        setLadeFehler("Ein Teil der Arena fehlt. Hier den Kampf neu laden.");
      }
      registrieren(scene);
      callbacks.current.onBereit();
    };
    void aufbauen().catch(() => {
      if (!beendet) setLadeFehler("Die Arena konnte nicht geladen werden. Erneut versuchen.");
    });

    /* --- Steuerung ---------------------------------------------------- */
    const tasten = new Set<string>();
    const runter = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      const taste = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d", " "].includes(taste)) {
        event.preventDefault();
      }
      // Leertaste und Umschalt sind die beiden Knöpfe - sie zählen genau wie
      // ein Fingertipp, damit am Schreibtisch dieselbe Regel gilt.
      if (taste === " " && !tasten.has(" ")) befehle.current.angriff += 1;
      if (event.shiftKey && !tasten.has("shift")) befehle.current.ausweichen += 1;
      if (event.shiftKey) tasten.add("shift");
      tasten.add(taste);
    };
    const hoch = (event: KeyboardEvent) => {
      tasten.delete(event.key.toLowerCase());
      if (!event.shiftKey) tasten.delete("shift");
    };
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);
    const stoppen = () => { tasten.clear(); steuerung.current = { x: 0, z: 0 }; };
    window.addEventListener("blur", stoppen);
    document.addEventListener("visibilitychange", stoppen);

    /* --- Der Ablauf --------------------------------------------------- */
    let letzter = performance.now();
    let regel = REGEL_START;
    let sichtweite = profil.sichtweite;
    let naeher = 1;
    /** Wie stark die Kamera gerade wackelt. */
    let beben = 0;
    /** Der kurze Stillstand nach einem harten Treffer - er macht Wucht. */
    let stopper = 0;
    /** Nach dem Ende läuft alles in Zeitlupe weiter, bevor die Karte kommt. */
    let abspann = 0;
    let gemeldet = false;
    let letzteAnzeige = "";
    let gesehenerAngriff = befehle.current.angriff;
    let gesehenesAusweichen = befehle.current.ausweichen;
    /** In welche Richtung die Rolle geht - sie hört nicht mehr auf den Stick. */
    const rolleRichtung = new THREE.Vector3(0, 0, 1);
    const zielKamera = new THREE.Vector3();
    const blick = new THREE.Vector3();
    const abstandVon = () => Math.hypot(gegner.position.x - spieler.position.x, gegner.position.z - spieler.position.z);

    /** Ein Schritt, der an Hauswänden abgleitet statt hindurchzugehen. */
    const versetzen = (koerper: THREE.Object3D, dx: number, dz: number, platz: number) => {
      const vorherX = koerper.position.x;
      const vorherZ = koerper.position.z;
      let neuX = vorherX + dx;
      let neuZ = vorherZ + dz;
      if (!begehbar(plan, neuX, neuZ, platz)) {
        if (begehbar(plan, neuX, vorherZ, platz)) neuZ = vorherZ;
        else if (begehbar(plan, vorherX, neuZ, platz)) neuX = vorherX;
        else { neuX = vorherX; neuZ = vorherZ; }
      }
      koerper.position.x = neuX;
      koerper.position.z = neuZ;
      return Math.hypot(neuX - vorherX, neuZ - vorherZ) > 0.0001;
    };

    const anzeigeMelden = (abstand: number) => {
      const wert: KampfAnzeige = {
        wimpy: stand.wimpy.leben / stand.wimpy.maxLeben,
        gegner: stand.gegner.leben / stand.gegner.maxLeben,
        phase: stand.gegner.phase,
        kombo: stand.wimpy.kombo,
        nah: abstand <= GEGNER_SCHLAG_TREFFER + 0.4,
        rolleBereit: darfRollen(stand),
        ergebnis: stand.ergebnis,
      };
      const schluessel = `${Math.round(wert.wimpy * 100)}|${Math.round(wert.gegner * 100)}|${wert.phase}|${wert.kombo}|${wert.nah}|${wert.rolleBereit}|${wert.ergebnis}`;
      if (schluessel === letzteAnzeige) return;
      letzteAnzeige = schluessel;
      callbacks.current.onAnzeige(wert);
    };

    /** Wimpy kassiert - mit allem, was dazugehört. */
    const einstecken = (schaden: number) => {
      const treffer = wimpyTreffen(stand, schaden);
      stand = treffer.stand;
      if (!treffer.getroffen) return;
      funken(new THREE.Vector3(spieler.position.x, 1.1, spieler.position.z), 0xff8080, 1.1);
      beben = Math.max(beben, 0.5);
      stopper = Math.max(stopper, 0.05);
      held.blitz = 0.4;
    };

    /** Und der Gegner ebenso - inklusive Wutausbruch. */
    const austeilen = (art: "schuss" | "schlag") => {
      const treffer = gegnerTreffen(stand, art);
      stand = treffer.stand;
      if (!treffer.schaden) return;
      const stelle = new THREE.Vector3(gegner.position.x, 1.3 * gegnerGroesse, gegner.position.z);
      funken(stelle, art === "schlag" ? 0xfff0a8 : WIMPY_FARBE, art === "schlag" ? 1.5 : 1);
      boese.blitz = 0.28;
      if (art === "schlag") {
        beben = Math.max(beben, 0.45);
        stopper = Math.max(stopper, 0.07);
      }
      if (treffer.phaseWechsel) {
        // Der Moment, in dem die Maske reißt: Welle, Beben, alles.
        welle(gegner.position, 9, GEGNER_FARBE, 0.9);
        beben = 1;
        stopper = 0.16;
      }
      if (treffer.erledigt) {
        welle(gegner.position, 12, WIMPY_FARBE, 1.2);
        funken(stelle, 0xffffff, 2.2);
        beben = 1;
      }
    };

    const zeichnen = (jetzt: number) => {
      const rohDt = (jetzt - letzter) / 1000;
      letzter = jetzt;
      if (!element.clientWidth || !element.clientHeight || document.hidden) {
        stoppen();
        frame = requestAnimationFrame(zeichnen);
        return;
      }
      const echt = Math.min(0.035, Math.max(0.001, rohDt));
      /*
       * Zwei Bremsen auf derselben Uhr: der kurze Stillstand nach einem
       * harten Treffer und die Zeitlupe, sobald der Kampf entschieden ist.
       * Beide verlangsamen nur, was sich bewegt - die Kamera läuft weiter.
       */
      stopper = Math.max(0, stopper - echt);
      const laeuft = stand.ergebnis === "laeuft";
      const dt = echt * (stopper > 0 ? 0.12 : laeuft ? 1 : 0.35);

      const abstand = abstandVon();
      if (laeuft) {
        stand = uhrWeiter(stand, dt);

        /* --- Wimpy ---------------------------------------------------- */
        const tx = (tasten.has("d") || tasten.has("arrowright") ? 1 : 0) - (tasten.has("a") || tasten.has("arrowleft") ? 1 : 0);
        const tz = (tasten.has("s") || tasten.has("arrowdown") ? 1 : 0) - (tasten.has("w") || tasten.has("arrowup") ? 1 : 0);
        const x = THREE.MathUtils.clamp(tx || steuerung.current.x, -1, 1);
        const z = THREE.MathUtils.clamp(tz || steuerung.current.z, -1, 1);
        const staerke = Math.min(1, Math.hypot(x, z));

        // Die Knöpfe: Der Angriff wird von selbst zum Nahkampf, sobald man
        // nah genug steht - ein Knopf weniger, um den man sich kümmern muss.
        if (befehle.current.ausweichen !== gesehenesAusweichen) {
          gesehenesAusweichen = befehle.current.ausweichen;
          if (darfRollen(stand)) {
            stand = rolleGesetzt(stand);
            if (staerke > 0.15) rolleRichtung.set(x / staerke, 0, z / staerke);
            else rolleRichtung.set(Math.sin(spieler.rotation.y), 0, Math.cos(spieler.rotation.y));
            zeigen(held, "lauf", 2.2);
            held.festRest = 0.2;
          }
        }
        if (befehle.current.angriff !== gesehenerAngriff) {
          gesehenerAngriff = befehle.current.angriff;
          if (darfSchlagen(stand, abstand)) {
            stand = schlagGesetzt(stand);
            zeigen(held, "schlag", 1.5);
            held.festRest = 0.34;
            spieler.rotation.y = Math.atan2(gegner.position.x - spieler.position.x, gegner.position.z - spieler.position.z);
            austeilen("schlag");
            welle(spieler.position, 3.4, WIMPY_FARBE, 0.32);
          } else if (darfSchiessen(stand)) {
            stand = schussGesetzt(stand);
            zeigen(held, "wurf", 1.6);
            held.festRest = 0.28;
            spieler.rotation.y = Math.atan2(gegner.position.x - spieler.position.x, gegner.position.z - spieler.position.z);
            // Gezielt wird von selbst: Wer mit dem Daumen steuert, soll
            // treffen, wenn er in die richtige Richtung schaut.
            schiessen(spieler.position, gegner.position, true, werte.schuss);
          }
        }

        let bewegt = false;
        if (stand.wimpy.rolleRest > 0) {
          bewegt = versetzen(
            spieler,
            rolleRichtung.x * werte.wimpyTempo * ROLLE_TEMPO * dt,
            rolleRichtung.z * werte.wimpyTempo * ROLLE_TEMPO * dt,
            0.7,
          );
          spieler.rotation.y = Math.atan2(rolleRichtung.x, rolleRichtung.z);
        } else if (staerke > 0.05) {
          // Schräg ist nicht schneller: erst auf Länge eins bringen, dann mit
          // dem Ausschlag des Sticks multiplizieren.
          const laenge = Math.hypot(x, z) || 1;
          bewegt = versetzen(
            spieler,
            (x / laenge) * staerke * werte.wimpyTempo * dt,
            (z / laenge) * staerke * werte.wimpyTempo * dt,
            0.7,
          );
          if (held.festRest <= 0) spieler.rotation.y = Math.atan2(x, z);
        }
        /*
         * Durcheinander laufen die beiden nicht.
         *
         * Ohne diese Zeilen steht Wimpy irgendwann mitten im Gegner - und
         * ein Endgegner, durch den man hindurchgehen kann, ist keiner. Weg
         * geschoben wird nur, solange dabei niemand in einer Hauswand
         * landet.
         */
        const platzDazwischen = 1.3 + gegnerGroesse * 0.35;
        const wegX = spieler.position.x - gegner.position.x;
        const wegZ = spieler.position.z - gegner.position.z;
        const dazwischen = Math.hypot(wegX, wegZ);
        if (dazwischen > 0.001 && dazwischen < platzDazwischen) {
          const zielX = gegner.position.x + (wegX / dazwischen) * platzDazwischen;
          const zielZ = gegner.position.z + (wegZ / dazwischen) * platzDazwischen;
          if (begehbar(plan, zielX, zielZ, 0.7)) spieler.position.set(zielX, 0, zielZ);
        }
        held.festRest = Math.max(0, held.festRest - dt);
        if (held.festRest <= 0) zeigen(held, bewegt ? "lauf" : "ruhe", bewegt ? Math.max(0.5, staerke) : 1);

        /* --- Der Culprit ----------------------------------------------- */
        const denken = gegnerDenken(stand, { abstand });
        stand = denken.stand;
        const tempo = gegnerTempo(stand);
        const zuWimpy = Math.atan2(spieler.position.x - gegner.position.x, spieler.position.z - gegner.position.z);
        if (tempo > 0) {
          // Auf zwei Metern bleibt er stehen: Er soll zuschlagen, nicht in
          // Wimpy hineinlaufen.
          if (abstand > 2.1) {
            versetzen(gegner, Math.sin(zuWimpy) * tempo * dt, Math.cos(zuWimpy) * tempo * dt, 0.9);
          }
          gegner.rotation.y = THREE.MathUtils.damp(gegner.rotation.y, naeherAmWinkel(gegner.rotation.y, zuWimpy), 6, dt);
          // Wer schon davorsteht, läuft nicht auf der Stelle weiter.
          zeigen(boese, abstand > 2.1 ? "lauf" : "ruhe", 1);
        } else if (stand.gegner.zustand === "ausholen") {
          // Beim Ausholen dreht er sich noch nach - danach nicht mehr, sonst
          // träfe er auch den, der längst weg ist.
          gegner.rotation.y = THREE.MathUtils.damp(gegner.rotation.y, naeherAmWinkel(gegner.rotation.y, zuWimpy), 3, dt);
          zeigen(boese, stand.gegner.angriff === "zauber" ? "wurf" : "schlag", 0.8);
        } else if (stand.gegner.zustand === "betaeubt") {
          zeigen(boese, "ruhe", 0.6);
        }
        if (denken.ausloesen === "schlag") {
          if (abstand <= GEGNER_SCHLAG_TREFFER + 0.6) einstecken(angriffSchaden(stand, "schlag"));
          welle(gegner.position, GEGNER_SCHLAG_TREFFER + 0.6, GEGNER_FARBE, 0.3);
          beben = Math.max(beben, 0.3);
        }
        if (denken.ausloesen === "stampf") {
          welle(gegner.position, STAMPF_RADIUS, GEGNER_FARBE, 0.6);
          funken(new THREE.Vector3(gegner.position.x, 0.4, gegner.position.z), GEGNER_FARBE, 1.6);
          if (abstand <= STAMPF_RADIUS) einstecken(angriffSchaden(stand, "stampf"));
          beben = Math.max(beben, 0.7);
        }
        if (denken.ausloesen === "zauber") {
          const breite = salvenBreite(stand);
          for (let i = 0; i < breite; i++) {
            schiessen(
              gegner.position,
              spieler.position,
              false,
              angriffSchaden(stand, "zauber"),
              (i - (breite - 1) / 2) * 0.17,
            );
          }
        }

        /* --- Was fliegt ------------------------------------------------ */
        for (const kugel of kugeln) {
          if (kugel.lebt <= 0) continue;
          kugel.lebt -= dt;
          kugel.gruppe.position.addScaledVector(kugel.richtung, kugel.tempo * dt);
          kugel.gruppe.rotation.y += dt * 6;
          const ziel = kugel.vonWimpy ? gegner.position : spieler.position;
          const treffweite = kugel.vonWimpy ? 1.1 + gegnerGroesse * 0.5 : 1.1;
          const nah = Math.hypot(kugel.gruppe.position.x - ziel.x, kugel.gruppe.position.z - ziel.z) < treffweite;
          if (nah) {
            funken(kugel.gruppe.position.clone(), kugel.vonWimpy ? WIMPY_FARBE : GEGNER_FARBE);
            if (kugel.vonWimpy) austeilen("schuss");
            else einstecken(kugel.schaden);
            kugel.lebt = 0;
          } else if (!begehbar(plan, kugel.gruppe.position.x, kugel.gruppe.position.z, 0.2)) {
            // An der Hauswand zerplatzt sie - Straßen sind Deckung.
            funken(kugel.gruppe.position.clone(), kugel.vonWimpy ? WIMPY_FARBE : GEGNER_FARBE, 0.7);
            kugel.lebt = 0;
          }
          if (kugel.lebt <= 0) kugel.gruppe.visible = false;
        }
      }

      /* --- Effekte, Kamera, Bild -------------------------------------- */
      for (const schwarm of funkenSchwaerme) {
        if (schwarm.lebt <= 0) continue;
        schwarm.lebt -= echt;
        const positionen = schwarm.punkte.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < FUNKEN; i++) {
          schwarm.tempo[i * 3 + 1] -= 14 * echt;
          positionen.setXYZ(
            i,
            positionen.getX(i) + schwarm.tempo[i * 3] * echt,
            Math.max(0.05, positionen.getY(i) + schwarm.tempo[i * 3 + 1] * echt),
            positionen.getZ(i) + schwarm.tempo[i * 3 + 2] * echt,
          );
        }
        positionen.needsUpdate = true;
        (schwarm.punkte.material as THREE.PointsMaterial).opacity = Math.max(0, schwarm.lebt / 0.55);
        if (schwarm.lebt <= 0) schwarm.punkte.visible = false;
      }
      for (const eintrag of wellen) {
        if (eintrag.lebt <= 0) continue;
        eintrag.lebt -= echt;
        const fortschritt = 1 - Math.max(0, eintrag.lebt) / eintrag.dauer;
        eintrag.mesh.scale.setScalar(0.4 + fortschritt * eintrag.weite);
        (eintrag.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - fortschritt));
        if (eintrag.lebt <= 0) eintrag.mesh.visible = false;
      }
      const warnung = ausholFortschritt(stand);
      warnRing.visible = warnung > 0;
      if (warnung > 0) {
        const weite = stand.gegner.angriff === "stampf" ? STAMPF_RADIUS : GEGNER_SCHLAG_TREFFER + 0.6;
        warnRing.position.set(gegner.position.x, 0.07, gegner.position.z);
        warnRing.scale.setScalar(weite * (0.35 + warnung * 0.65));
        warnMaterial.opacity = 0.2 + warnung * 0.55;
        warnMaterial.color.setHex(warnung > 0.85 ? 0xffffff : 0xff6b6b);
      }
      for (const kaempfer of [held, boese]) {
        if (kaempfer.blitz <= 0) continue;
        kaempfer.blitz = Math.max(0, kaempfer.blitz - echt);
        for (const material of kaempfer.materialien) {
          material.emissive.setHex(0xffffff);
          material.emissiveIntensity = kaempfer.blitz * 1.6;
        }
      }
      // Die zweite Phase färbt den Culprit dauerhaft: Man sieht ihm an, dass
      // er jetzt ernst macht.
      if (stand.gegner.phase === 2 && boese.blitz <= 0) {
        for (const material of boese.materialien) {
          material.emissive.setHex(GEGNER_FARBE);
          material.emissiveIntensity = 0.32 + Math.sin(jetzt * 0.006) * 0.1;
        }
      }
      if (wetterfall) {
        wetterfall.bewegen(echt, jetzt);
        // Das Wetter zieht mit: Es fällt dort, wo gerade gekämpft wird.
        wetterfall.punkte.position.set(spieler.position.x, 0, spieler.position.z);
      }
      for (const werkzeug of mixer) werkzeug.update(dt);

      /*
       * Die Kamera.
       *
       * Sie steht wie im 3D-Kapitel schräg hinter Wimpy - das ist wichtig,
       * denn der Daumenstick rechnet mit genau dieser Schräge. Neu ist
       * zweierlei: Sie rückt ab, wenn die beiden weit auseinanderstehen, und
       * sie schaut nicht auf Wimpy, sondern zwischen die beiden. So hat man
       * den Gegner immer im Bild, ohne selbst zielen zu müssen.
       */
      const weite = 1 + THREE.MathUtils.clamp(abstand / 60, 0, 0.25);
      const vollX = spieler.position.x - 9.5 * weite;
      const vollZ = spieler.position.z + 13.8 * weite;
      if (hausFelder.size) {
        const verdeckt = sichtFelder(plan, spieler.position.x, spieler.position.z, vollX, vollZ)
          .filter((feld) => hausFelder.has(`${feld.x},${feld.z}`)).length;
        naeher = THREE.MathUtils.damp(naeher, verdeckt >= 2 ? 0.6 : verdeckt === 1 ? 0.78 : 1, 3, echt);
      }
      beben = Math.max(0, beben - echt * 2.2);
      zielKamera.set(
        spieler.position.x + (vollX - spieler.position.x) * naeher,
        5.1 * weite + (1 - naeher) * 1.8,
        spieler.position.z + (vollZ - spieler.position.z) * naeher,
      );
      camera.position.lerp(zielKamera, 1 - Math.exp(-4.5 * echt));
      if (beben > 0) {
        const kraft = beben * beben * 0.55;
        camera.position.x += (Math.random() - 0.5) * kraft;
        camera.position.y += (Math.random() - 0.5) * kraft;
      }
      /*
       * Geschaut wird ein Stück in Richtung des Gegners - aber höchstens vier
       * Meter weit. Ohne diese Grenze wandert der Blick bei einem Gegner am
       * anderen Ende des Platzes so weit, dass Wimpy unten aus dem Bild
       * läuft und man auf leeren Asphalt schaut.
       */
      const hin = Math.min(4, abstand * 0.3) / Math.max(0.001, abstand);
      blick.set(
        spieler.position.x + (gegner.position.x - spieler.position.x) * hin,
        1.25,
        spieler.position.z + (gegner.position.z - spieler.position.z) * hin,
      );
      camera.lookAt(blick);

      // Was zu weit weg ist, wird nicht gezeichnet; was der Kamera im Weg
      // steht, blendet sich weg. Beides wie in der Stadt.
      if (rohDt < 0.5) regel = nachregeln(regel, rohDt);
      sichtweite += (profil.sichtweite * regel.faktor - sichtweite) * Math.min(1, echt * 0.7);
      if (scene.fog instanceof THREE.Fog) {
        const fern = Math.min(nebelFern, sichtweite);
        scene.fog.far = fern;
        scene.fog.near = Math.min(nebelNah, fern * 0.45);
      }
      const imWeg = sichtFelder(plan, spieler.position.x, spieler.position.z, camera.position.x, camera.position.z);
      for (const eintrag of stadtBloecke) {
        const feld = eintrag.feld;
        if (feld) {
          const ziel = imWeg.some((vor) => vor.x === feld.x && vor.z === feld.z) ? 0 : 1;
          if (eintrag.sicht !== ziel) {
            eintrag.sicht = THREE.MathUtils.damp(eintrag.sicht, ziel, 9, echt);
            if (Math.abs(eintrag.sicht - ziel) < 0.012) eintrag.sicht = ziel;
            for (const material of eintrag.materialien) material.opacity = eintrag.sicht;
          }
        }
        eintrag.gruppe.visible =
          eintrag.sicht > 0.02 && eintrag.mitte.distanceTo(camera.position) < sichtweite;
      }

      anzeigeMelden(abstand);
      /*
       * Das Ende bekommt seinen Moment.
       *
       * Eine Sekunde Zeitlupe, in der der Gegner umkippt oder Wimpy tanzt -
       * erst danach kommt die Karte. Ohne diese Sekunde wäre der schönste
       * Treffer des Spiels nur ein Bildwechsel.
       */
      if (stand.ergebnis !== "laeuft") {
        if (abspann === 0) {
          zeigen(stand.ergebnis === "gewonnen" ? held : boese, "jubel", 1);
          zeigen(stand.ergebnis === "gewonnen" ? boese : held, "ruhe", 0.4);
        }
        abspann += echt;
        const verlierer = stand.ergebnis === "gewonnen" ? gegner : spieler;
        // Wer verliert, sinkt in die Knie und kippt zur Seite.
        verlierer.rotation.z = THREE.MathUtils.damp(verlierer.rotation.z, 1.35, 2.4, echt);
        verlierer.position.y = THREE.MathUtils.damp(verlierer.position.y, -0.35, 2, echt);
        if (abspann > 1.4 && !gemeldet) {
          gemeldet = true;
          callbacks.current.onEnde(stand.ergebnis === "gewonnen" ? "gewonnen" : "verloren");
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
      for (const werkzeug of mixer) werkzeug.stopAllAction();
      registrieren(scene);
      freigeben();
      renderer.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", kontextVerloren);
      renderer.domElement.remove();
      gradient.dispose();
    };
    // Die Arena wird einmal gebaut. Alles, was sich im Kampf ändert, läuft
    // über Refs - sonst risse jeder Treffer die Szene ab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, strassentyp, tageszeit, wetter, stufe, spielerModell, gegnerModell, gegnerGroesse, versuch]);

  return <>
    <div className="saga3d-canvas kampf-canvas" ref={host} aria-label="Der Endkampf in 3D" />
    {ladeFehler && <button className="saga3d-meldung" onClick={() => setVersuch((v) => v + 1)}>{ladeFehler}</button>}
  </>;
}

/**
 * Den kürzeren Weg um den Kreis nehmen.
 *
 * Ohne das dreht sich der Gegner einmal komplett herum, sobald der Winkel
 * über π hinausläuft - und sieht dabei aus wie ein Kreisel.
 */
function naeherAmWinkel(von: number, zu: number): number {
  let ziel = zu;
  while (ziel - von > Math.PI) ziel -= Math.PI * 2;
  while (ziel - von < -Math.PI) ziel += Math.PI * 2;
  return ziel;
}

/**
 * Der Kampf mit allem drum herum: Startkarte, Lebensbalken, Knöpfe, Ende.
 *
 * Der Aufrufer bekommt nur zwei Nachrichten - gewonnen oder aufgegeben. Alles
 * dazwischen, auch das Wiederholen nach einer Niederlage, bleibt hier.
 */
export function Endkampf({
  plan,
  strassentyp,
  tageszeit,
  wetter,
  stufe,
  musik,
  gegnerName,
  gegnerSpruch,
  spielerModell,
  gegnerModell,
  gegnerGroesse,
  titel,
  vorschau = false,
  onGewonnen,
  onAufgeben,
}: {
  plan: Stadtplan;
  strassentyp: DreiDStrassentyp;
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  stufe: KampfStufe;
  musik: string;
  gegnerName: string;
  gegnerSpruch: string;
  spielerModell?: AnimationsModell;
  gegnerModell?: AnimationsModell;
  gegnerGroesse: number;
  titel: string;
  /** In der Admin-Vorschau schließt der Knopf nur das Fenster. */
  vorschau?: boolean;
  onGewonnen: () => void;
  onAufgeben: () => void;
}) {
  const steuerung = useRef<Richtung>({ x: 0, z: 0 });
  const befehle = useRef<KampfBefehl>({ angriff: 0, ausweichen: 0 });
  const [phase, setPhase] = useState<"bereit" | "kampf" | "gewonnen" | "verloren">("bereit");
  const [geladen, setGeladen] = useState(false);
  const [anzeige, setAnzeige] = useState<KampfAnzeige>(LEERE_ANZEIGE);
  /** Wie oft schon gekämpft wurde - jeder Neustart baut die Arena neu auf. */
  const [runde, setRunde] = useState(0);

  const starten = () => {
    steuerung.current = { x: 0, z: 0 };
    befehle.current = { angriff: 0, ausweichen: 0 };
    setAnzeige(LEERE_ANZEIGE);
    setGeladen(false);
    setRunde((wert) => wert + 1);
    setPhase("kampf");
  };

  if (phase === "bereit" || phase === "gewonnen" || phase === "verloren") {
    return (
      <div className="jagd kampf">
        <div className="jagd-start kampf-start">
          <article className="jagd-startkarte kampf-karte" data-ende={phase}>
            <span className="jagd-kicker">
              {phase === "gewonnen" ? "GESTELLT" : phase === "verloren" ? "AM BODEN" : "DER SHOWDOWN"}
            </span>
            <h1>
              {phase === "gewonnen" ? "GEWONNEN!" : phase === "verloren" ? "NOCH EINMAL!" : titel}
            </h1>
            {phase === "gewonnen" && <>
              <h2>{gegnerName}</h2>
              <blockquote>„{gegnerSpruch}“</blockquote>
              <button className="knopf aktion" onClick={onGewonnen}>Weiter ›</button>
            </>}
            {phase === "verloren" && <>
              <p>
                Wimpy liegt im Staub - aber aufgeben gilt nicht. {gegnerName} steht
                noch genau dort, wo er stand.
              </p>
              <button className="knopf aktion" onClick={starten}>Noch einmal ›</button>
              <button className="knopf" onClick={onAufgeben}>
                {vorschau ? "Vorschau schließen" : "Genug für heute - zum Ende ›"}
              </button>
            </>}
            {phase === "bereit" && <>
              <h2>Wimpy gegen {gegnerName}</h2>
              <p>
                Mit dem Daumen läufst du, mit <strong>ZAUBER</strong> wirfst du - und wer
                nah genug steht, schlägt zu. Wenn unter {gegnerName} ein roter Ring
                aufleuchtet, holt er aus: Dann heißt es weg da, am besten mit
                <strong> ROLLE</strong>.
              </p>
              <p className="leise klein">
                Am Schreibtisch: WASD oder Pfeiltasten laufen, Leertaste greift an,
                Umschalt rollt.
              </p>
              <button className="knopf aktion" onClick={starten}>Kampf beginnen ›</button>
              <button className="knopf" onClick={onAufgeben}>
                {vorschau ? "Vorschau schließen" : "Lieber ohne Kampf zum Ende ›"}
              </button>
            </>}
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="jagd kampf" data-phase={anzeige.phase} data-getroffen={anzeige.wimpy < 0.34}>
      {musik && <Hintergrundmusik stueck={musik} />}
      <ArenaCanvas
        key={runde}
        plan={plan}
        strassentyp={strassentyp}
        tageszeit={tageszeit}
        wetter={wetter}
        stufe={stufe}
        spielerModell={spielerModell}
        gegnerModell={gegnerModell}
        gegnerGroesse={gegnerGroesse}
        steuerung={steuerung}
        befehle={befehle}
        onAnzeige={setAnzeige}
        onBereit={() => setGeladen(true)}
        onEnde={(ergebnis) => setPhase(ergebnis)}
      />
      <div className="kampf-balken">
        <div className="kampf-leben kampf-leben-wimpy">
          <small>WIMPY</small>
          <span><i style={{ width: `${Math.max(0, anzeige.wimpy) * 100}%` }} /></span>
        </div>
        <div className="kampf-leben kampf-leben-gegner" data-wuetend={anzeige.phase === 2}>
          <small>{gegnerName.toUpperCase()}{anzeige.phase === 2 ? " · WÜTEND" : ""}</small>
          <span><i style={{ width: `${Math.max(0, anzeige.gegner) * 100}%` }} /></span>
        </div>
      </div>
      {anzeige.kombo >= 3 && <div className="kampf-kombo" role="status">{anzeige.kombo}× KOMBO</div>}
      {!geladen && <div className="auto-jagd-laden" role="status">Die Arena wird gebaut …</div>}
      <TouchJoystick setzen={(x, z) => { steuerung.current = { x, z }; }} />
      <div className="kampf-aktionen">
        <button
          className="kampf-knopf kampf-knopf-angriff"
          data-nah={anzeige.nah}
          onPointerDown={() => { befehle.current.angriff += 1; }}
        >
          {anzeige.nah ? "SCHLAG" : "ZAUBER"}
        </button>
        <button
          className="kampf-knopf kampf-knopf-rolle"
          data-bereit={anzeige.rolleBereit}
          onPointerDown={() => { befehle.current.ausweichen += 1; }}
        >
          ROLLE
        </button>
      </div>
      <button
        className="kampf-abbrechen"
        onClick={onAufgeben}
        aria-label={vorschau ? "Probe schließen" : "Kampf verlassen"}
      >
        ×
      </button>
    </div>
  );
}
