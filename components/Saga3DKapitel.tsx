"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { kapitelPosition } from "@/lib/saga3dLayout";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { postJson } from "@/lib/api";
import { herkunftsZeile, type Beweismittel } from "@/lib/beweismittel";
import { laufAnimation } from "@/lib/pursuit";
import { locationsFuer3D } from "@/lib/pursuit3d";
import type { DreiDStrassentyp, DreiDTageszeit, DreiDWetter } from "@/lib/pursuit3d";
import type { Character, PublicCase } from "@/lib/types";
import type { Fund } from "@/lib/useGame";
import { FundMoment } from "./FundMoment";

type Richtung = { x: number; z: number };
const LEERE_SPUREN: SpurVorschau[] = [];
const STANDARD_GROESSEN: Record<string, number> = {};
type SpurVorschau = { itemId: string; ortId: string; name: string; bild: string | null };
type Naehe =
  | { art: "tier"; id: string; name: string }
  | { art: "spur"; id: string; ortId: string; name: string };

const normal = (wert: string) => wert.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

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

function modellFuer(charakter: Character, index: number, modellId?: string): AnimationsModell | undefined {
  const schluessel = [charakter.id, charakter.name, charakter.tierart].map(normal);
  return (
    ANIMATIONS_MODELLE.find((modell) => modell.id === modellId) ??
    ANIMATIONS_MODELLE.find((modell) =>
      schluessel.some((wert) => wert && (normal(modell.id).includes(wert) || wert.includes(normal(modell.id)))),
    ) ?? ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy")[index % Math.max(1, ANIMATIONS_MODELLE.length - 1)]
  );
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

function cellShading(
  objekt: THREE.Object3D,
  gradient: THREE.Texture,
  clippingPlanes: THREE.Plane[] = [],
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
  onNaehe,
  onBereit,
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
  onNaehe: (wert: Naehe | null) => void;
  onBereit: () => void;
  pausiert?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onNaehe, onBereit, pausiert, gefunden: new Set(gefundeneSpuren) });
  callbacks.current = { onNaehe, onBereit, pausiert, gefunden: new Set(gefundeneSpuren) };
  const [ladeFehler, setLadeFehler] = useState("");
  const [versuch, setVersuch] = useState(0);
  const position = useRef(new THREE.Vector3());
  // Wertgleiche Props (insbesondere [] in der Probe) dürfen keine Szene neu laden.
  const bauplanText = JSON.stringify({ besetzung: fall.besetzung, locations, spuren, charakterModelle, charakterGroessen, locationDrehungen });
  const bauplan = useMemo(() => JSON.parse(bauplanText) as {
    besetzung: Character[]; locations: string[]; spuren: SpurVorschau[];
    charakterModelle: Record<string, string>; locationDrehungen: Record<string, number>;
    charakterGroessen: Record<string, number>;
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
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 90),
      new THREE.MeshToonMaterial({ color: strassentyp === "schnee" ? 0xc9dce8 : strassentyp === "sand" ? 0x897052 : wetter === "regen" ? 0x263647 : tageszeit === "tag" ? 0x4b5868 : 0x293448, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = -8;
    boden.receiveShadow = true;
    scene.add(boden);
    const fahrbahnMaterial = new THREE.MeshToonMaterial({
      map: strassentyp !== "asphalt" ? naturStrassenTextur(strassentyp === "schnee") : null,
      color: strassentyp !== "asphalt"
        ? wetter === "regen" ? 0xb1a18a : 0xffffff
        : wetter === "regen" ? 0x263a4a : tageszeit === "nacht" ? 0x202b3c : 0x52606c,
      gradientMap: gradient,
    });
    const fahrbahn = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 90),
      fahrbahnMaterial,
    );
    fahrbahn.rotation.x = -Math.PI / 2;
    fahrbahn.position.set(0, 0.012, -8);
    fahrbahn.receiveShadow = true;
    scene.add(fahrbahn);
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
    for (let i = 0; strassentyp === "asphalt" && i < 18; i++) {
      const strich = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.025, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x74eaff }),
      );
      strich.position.set(0, 0.03, i * 4.2 - 38);
      scene.add(strich);
    }
    if (strassentyp !== "asphalt") {
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

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const spieler = new THREE.Group();
    spieler.position.copy(position.current);
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
      const locationEintraege = locationsFuer3D(locations);
      const kulissen = await Promise.allSettled(locationEintraege.map((ort) => laden(ort.datei)));
      if (beendet) return;
      const vorlagen = kulissen.flatMap((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return [];
        const vorlage = ergebnis.value.scene;
        cellShading(vorlage, gradient);
        registrieren(vorlage);
        const ort = locationEintraege[index];
        const ausmass = kulisseEinpassen(vorlage, locationDrehungen[ort.id] ?? 0);
        return [{ vorlage, laenge: Math.max(5, ausmass.z) }];
      });
      let cursorZ = 19;
      let i = 0;
      while (cursorZ > -51 && vorlagen.length && i < 24) {
        const eintrag = vorlagen[i % vorlagen.length];
        const block = new THREE.Group();
        block.add(eintrag.vorlage.clone(true));
        block.position.z = cursorZ - eintrag.laenge / 2;
        scene.add(block);
        cursorZ -= eintrag.laenge + 1.1;
        i++;
      }

      const wimpy = ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy");
      if (wimpy) {
        const geladen = await figurLaden(wimpy, 2.05 * groessenFaktor("wimpy"));
        if (beendet) return;
        spieler.add(geladen.figur);
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
          const modell = modellFuer(charakter, index, charakterModelle[charakter.id]);
          return modell ? figurLaden(modell, 1.8 * groessenFaktor(charakter.id)) : Promise.reject(new Error("Kein Modell"));
        }),
      );
      if (beendet) return;
      npcLadungen.forEach((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return;
        const charakter = tiere[index];
        const gruppe = new THREE.Group();
        gruppe.add(ergebnis.value.figur);
        const { x, z } = kapitelPosition(index, tiere.length, "tier");
        const radius = 0.5 * groessenFaktor(charakter.id);
        gruppe.position.set(Math.sign(x) * Math.min(Math.abs(x), 4.5 - radius), 0, z);
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
          const { x, z } = kapitelPosition(index, spuren.length, "spur");
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
        if (kulissen.some((r) => r.status === "rejected") || npcLadungen.some((r) => r.status === "rejected")) {
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
      const tx = (tasten.has("d") || tasten.has("arrowright") ? 1 : 0) - (tasten.has("a") || tasten.has("arrowleft") ? 1 : 0);
      const tz = (tasten.has("s") || tasten.has("arrowdown") ? 1 : 0) - (tasten.has("w") || tasten.has("arrowup") ? 1 : 0);
      const x = THREE.MathUtils.clamp(tx || steuerung.current.x, -1, 1);
      const z = THREE.MathUtils.clamp(tz || steuerung.current.z, -1, 1);
      let bewegt = false;
      const staerke = Math.min(1, Math.hypot(x, z));
      if (staerke > 0.05) {
        const laenge = Math.hypot(x, z) || 1;
        const vorherX = spieler.position.x;
        const vorherZ = spieler.position.z;
        const neuX = THREE.MathUtils.clamp(vorherX + (x / laenge) * staerke * dt * 4.1, -4.15, 4.15);
        const neuZ = THREE.MathUtils.clamp(vorherZ + (z / laenge) * staerke * dt * 4.1, -36, 15);
        const kollidiert = npcGruppen.some((npc) => {
          const dx = npc.gruppe.position.x - neuX;
          const dz = npc.gruppe.position.z - neuZ;
          return dx * dx + dz * dz < (npc.radius + 0.65) ** 2;
        });
        if (!kollidiert) {
          spieler.position.set(neuX, 0, neuZ);
          bewegt = Math.hypot(neuX - vorherX, neuZ - vorherZ) > 0.0001;
        }
        spieler.rotation.y = Math.atan2(x, z);
      }
      const gewuenscht = bewegt ? laufAktion : (ruheAktion ?? laufAktion);
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
            npc.gruppe.position.z += schritt;
            laeuft = Math.abs(schritt) > 0.0001;
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
      [...npcGruppen, ...spurGruppen.filter((ziel) => ziel.gruppe.visible)].forEach((ziel) => {
        const distanz = ziel.gruppe.position.distanceTo(spieler.position);
        if (distanz < abstand) {
          abstand = distanz;
          nah = ziel;
        }
      });
      const nahesZiel = nah as { gruppe: THREE.Group; info: Naehe } | null;
      const schluessel = nahesZiel ? `${nahesZiel.info.art}:${nahesZiel.info.id}` : "";
      if (schluessel !== letzteNaehe) {
        letzteNaehe = schluessel;
        callbacks.current.onNaehe(nahesZiel?.info ?? null);
      }
      zielKamera.set(spieler.position.x - 9.5, 5.1, spieler.position.z + 13.8);
      camera.position.lerp(zielKamera, 1 - Math.exp(-5 * dt));
      camera.lookAt(spieler.position.x, 1.05, spieler.position.z + 0.7);
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
  gefundeneSpuren,
  kapitel,
  tasche,
  suchtGerade,
  onCharakter,
  onSpur,
  onAufnehmen,
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
  gefundeneSpuren: string[];
  kapitel: number | null;
  tasche: Beweismittel[];
  suchtGerade: boolean;
  onCharakter: (id: string) => void;
  onSpur: (ortId: string, itemId: string) => Promise<Fund | null>;
  onAufnehmen: (mittel: Beweismittel, statt?: string) => void;
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
        pausiert={pausiert || Boolean(fund) || suchtGerade}
        steuerung={steuerung}
        fall={fall}
        locations={locations}
        tageszeit={tageszeit}
        wetter={wetter}
        strassentyp={strassentyp}
        charakterModelle={charakterModelle}
        charakterGroessen={charakterGroessen}
        locationDrehungen={locationDrehungen}
        spuren={spuren}
        gefundeneSpuren={gefundeneSpuren}
        onNaehe={setNah}
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
      {nah && (
        <button className="experiment-ansprechen saga3d-interaktion" onClick={() => void interagieren()} disabled={suchtGerade}>
          <small>{nah.art === "tier" ? "IN DER NÄHE" : "SPUR ENTDECKT"}</small>
          <strong>{suchtGerade ? "WIMPY UNTERSUCHT …" : `${nah.name} ${nah.art === "tier" ? "ANSPRECHEN" : "ANSEHEN"}`}</strong>
        </button>
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
  onZurueck,
  onSchliessen,
}: {
  locations: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  strassentyp: DreiDStrassentyp;
  modellIds: string[];
  locationDrehungen: Record<string, number>;
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
      {meldung && <button className="saga3d-meldung" onClick={() => setMeldung("")}>{meldung}</button>}
    </div>
  );
}
