"use client";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { spielerModell } from '@/lib/tiermodelle';
import { AUTO_MODELLE, FLUCHT_RUECKSTAND, REMPLER, START_AUTO_ID, fluchtTempo, type Auto } from '@/lib/autos';
import { useAutos } from '@/lib/useAutos';
import { useStammdaten } from '@/lib/stammdaten';
import { fluchtStatement, type VerfolgungVorgabe } from '@/lib/verfolgung';
import { Hintergrundmusik } from './Hintergrundmusik';

/**
 * Gefahren wird in Richtung +z, also auf die Kamera zu; die Welt wandert
 * dafür nach -z. Alles Folgende hängt an dieser einen Festlegung.
 */
const KAMERA_JAGD = { pos: [-12.6, 7.3, 18.8], ziel: [0, 0.8, 4], fov: 46 } as const;
/**
 * Die Anfahrt schaut von weiter außen und mit weiterem Blickwinkel auf den
 * Straßenrand: Sonst stünden Wimpy und sein Wagen im selben Fleck.
 */
const KAMERA_ANFAHRT = { pos: [-17.5, 4.6, 14.5], ziel: [-5.2, 1.2, 1.0], fov: 58 } as const;

/** Wo Wimpys Wagen parkt und wo Wimpy selbst danebensteht. */
const PARKPLATZ = { x: -6.6, z: 0.8, winkel: -0.42 };
const STANDPLATZ = { x: -10, z: 3 };

/**
 * Der Ablauf der Anfahrt in Sekunden.
 *
 * Erst sieht man Wimpy und seinen Wagen am Straßenrand, dann rast der andere
 * Wagen vorbei, dann steigt Wimpy ein und zieht los - ohne Schnitt, die
 * Kamera gleitet dabei in die Verfolgungsansicht.
 */
const ANFAHRT = { vorbei: 2.9, einsteigen: 4.3, losfahren: 5.9 };

/** Nur so weit vor Wimpy, dass der Fluchtwagen im Bild bleibt. */
const FLUCHT_NAH = 3.8;
const FLUCHT_FERN = 7.0;
/** Vorsprung am Start, und ab wann er als entkommen gilt. */
const ABSTAND_START = 180;
const ABSTAND_VERLOREN = 320;
/**
 * Abstand zwischen zwei Hindernissen in Weltmetern.
 *
 * Die Jagd dauert jetzt eine halbe Minute statt sechs Sekunden; stünden die
 * Klötze weiter so dicht, käme alle anderthalb Sekunden einer - das wäre
 * kein Ausweichen mehr, sondern ein Würfelspiel.
 */
const HINDERNIS_ABSTAND = 140;

const weich = (t: number) => t * t * (3 - 2 * t);

/**
 * Ein weicher runder Fleck als Textur - daraus werden Rauch und Schneefahne.
 *
 * Gemalt statt geladen: Eine Datei mehr im Netz wäre für einen grauen Punkt
 * nicht zu rechtfertigen, und so passt er sich jeder Auflösung an.
 */
function weicherPunkt(): THREE.CanvasTexture {
  const leinwand = document.createElement("canvas");
  leinwand.width = leinwand.height = 64;
  const stift = leinwand.getContext("2d");
  if (stift) {
    const verlauf = stift.createRadialGradient(32, 32, 0, 32, 32, 32);
    verlauf.addColorStop(0, "rgba(255,255,255,0.95)");
    verlauf.addColorStop(0.45, "rgba(255,255,255,0.45)");
    verlauf.addColorStop(1, "rgba(255,255,255,0)");
    stift.fillStyle = verlauf;
    stift.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(leinwand);
}

/**
 * Eine Wolke aus dem Vorrat.
 *
 * Statt ständig neue Objekte zu bauen, liegen immer dieselben bereit und
 * werden wiederverwendet, sobald sie ausgeblendet sind - das hält die
 * Bildrate auf dem Handy stabil.
 */
type Wolke = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  leben: number;
  dauer: number;
  tempo: THREE.Vector3;
  start: number;
  deckkraft: number;
};

/** Räder, die sich wirklich drehen können - falls das Modell welche mitbringt. */
const RAD_NAME = /wheel|rad\b|reifen|tyre|tire|felge/i;

function RennCanvas({ auto, flucht, spur, drehung, figur: figurModell, onStand, onEnde, onFehler, onBereit, onPhase }: {
  auto: Auto; flucht: Auto; spur: React.MutableRefObject<number>;
  /** Wimpys 3D-Modell aus den Stammdaten - fehlt es, steht niemand am Rand. */
  figur?: { datei: string };
  /** Zusätzliche Drehung des Fluchtwagens in Grad - live veränderbar. */
  drehung: React.MutableRefObject<number>;
  onStand: (speed: number, abstand: number, treffer: boolean) => void;
  onEnde: (gefangen: boolean) => void; onFehler: (text: string) => void;
  onBereit: () => void; onPhase: (phase: 'anfahrt' | 'jagd') => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onStand, onEnde, onFehler, onBereit, onPhase });
  callbacks.current = { onStand, onEnde, onFehler, onBereit, onPhase };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false, bereit = false, frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091426);
    scene.fog = new THREE.Fog(0x15283e, 28, 95);
    // Gleiche Achsen und Blickrichtung wie Jump-and-Run; etwas weiter für zwei Autos.
    const camera = new THREE.PerspectiveCamera(KAMERA_ANFAHRT.fov, 1, 0.1, 130);
    camera.position.set(...KAMERA_ANFAHRT.pos);
    camera.lookAt(...KAMERA_ANFAHRT.ziel);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { callbacks.current.onFehler('3D konnte nicht gestartet werden.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xc2e9ff, 0x253042, 3));
    const licht = new THREE.DirectionalLight(0xffe2b6, 3);
    licht.position.set(-8, 14, 10); scene.add(licht);
    const ressourcen = new Set<{ dispose: () => void }>();
    const sammeln = (root: THREE.Object3D) => root.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      ressourcen.add(obj.geometry);
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        ressourcen.add(mat);
        for (const wert of Object.values(mat)) if (wert instanceof THREE.Texture) ressourcen.add(wert);
      }
    });
    const mesh = (geo: THREE.BufferGeometry, farbe: number, x: number, y: number, z: number) => {
      const obj = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: farbe }));
      obj.position.set(x, y, z); scene.add(obj); return obj;
    };
    mesh(new THREE.BoxGeometry(34, 0.2, 130), 0xb8d6e2, 0, -0.22, 24);
    mesh(new THREE.BoxGeometry(10.2, 0.1, 130), 0x25384c, 0, -0.05, 24);
    const markierungen: THREE.Mesh[] = [];
    for (const x of [-1.7, 1.7]) for (let i = 0; i < 25; i++) markierungen.push(mesh(new THREE.BoxGeometry(0.08, 0.02, 2), 0x7cdaee, x, 0.02, i * 4 - 20));
    const kulisse: THREE.Mesh[] = [];
    for (let i = 0; i < 28; i++) {
      const x = (i % 2 ? -1 : 1) * (7 + i % 3);
      // Wo Wimpy und sein Wagen auf die Jagd warten, steht kein Baum im Bild.
      const z = i * 4 - 25;
      const imWeg = x < -5 && z > -6 && z < 10;
      const baum = mesh(new THREE.ConeGeometry(1.4, 4, 5), i % 3 ? 0x4b8496 : 0xc8e6ed, x, 2, imWeg ? z + 56 : z);
      kulisse.push(baum);
    }
    const spieler = new THREE.Group(), gegner = new THREE.Group(), wimpy = new THREE.Group();
    spieler.position.set(PARKPLATZ.x, 0, PARKPLATZ.z); spieler.rotation.y = PARKPLATZ.winkel;
    // Vor der Vorbeifahrt steht der Fluchtwagen weit außerhalb des Bildes.
    gegner.position.set(0, 0, -60);
    wimpy.position.set(STANDPLATZ.x, 0, STANDPLATZ.z);
    // Die Figuren schauen bei rotation.y = 0 nach +z; Wimpy blickt zur Straße.
    wimpy.rotation.y = Math.PI / 2;
    scene.add(spieler, gegner, wimpy);
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    async function laden(wagen: Auto, gruppe: THREE.Group) {
      const modell = AUTO_MODELLE.find(m => m.id === wagen.modell);
      if (!modell) throw new Error('Automodell fehlt.');
      const gltf = await loader.loadAsync(modell.datei);
      sammeln(gltf.scene);
      if (beendet) { ressourcen.forEach(r => r.dispose()); return; }
      const obj = gltf.scene;
      obj.rotation.y = THREE.MathUtils.degToRad(wagen.drehung);
      obj.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      obj.scale.multiplyScalar(3.5 / Math.max(size.x, size.z, 0.001));
      obj.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(obj);
      const mitte = box.getCenter(new THREE.Vector3());
      obj.position.set(-mitte.x, -box.min.y, -mitte.z);
      gruppe.add(obj);
      /*
       * Die beiden mitgelieferten Wagen sind je ein einziges Mesh - da gibt es
       * nichts, was sich drehen ließe. Bringt ein später hinzugefügtes Modell
       * benannte Räder mit, drehen die sich hier von selbst mit.
       */
      obj.traverse((teil) => { if (RAD_NAME.test(teil.name)) raeder.push(teil); });
    }
    /*
     * Wimpy am Straßenrand. Er gehört zur Anfahrt, nicht zur Jagd: Wenn sein
     * Modell fehlt oder zu lange braucht, beginnt die Anfahrt trotzdem - nur
     * eben ohne ihn. Ein Ladefehler darf die Verfolgung nie aufhalten.
     */
    let mixer: THREE.AnimationMixer | null = null;
    let stehen: THREE.AnimationAction | null = null;
    let gehen: THREE.AnimationAction | null = null;
    async function figurLaden() {
      if (!figurModell) return;
      const gltf = await loader.loadAsync(figurModell.datei);
      sammeln(gltf.scene);
      if (beendet) { ressourcen.forEach(r => r.dispose()); return; }
      const figur = gltf.scene;
      figur.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(figur);
      const groesse = box.getSize(new THREE.Vector3());
      figur.scale.multiplyScalar(1.7 / Math.max(0.001, groesse.y));
      figur.updateMatrixWorld(true);
      const neu = new THREE.Box3().setFromObject(figur);
      const mitte = neu.getCenter(new THREE.Vector3());
      figur.position.set(-mitte.x, -neu.min.y, -mitte.z);
      wimpy.add(figur);
      mixer = new THREE.AnimationMixer(figur);
      const ruheClip = gltf.animations.find(c => /idle|rest/i.test(c.name)) ?? gltf.animations[0];
      const gehClip = gltf.animations.find(c => /walk/i.test(c.name)) ?? gltf.animations.find(c => /run/i.test(c.name));
      stehen = ruheClip ? mixer.clipAction(ruheClip) : null;
      gehen = gehClip ? mixer.clipAction(gehClip) : null;
      stehen?.play();
    }
    void Promise.all([laden(auto, spieler), laden(flucht, gegner)]).then(async () => {
      await figurLaden().catch(() => undefined);
      if (!beendet) { bereit = true; callbacks.current.onBereit(); }
    }).catch(() => { if (!beendet) callbacks.current.onFehler('Ein Automodell konnte nicht geladen werden. Bitte erneut starten.'); });
    /* --- Was Tempo sichtbar macht ------------------------------------ */
    const raeder: THREE.Object3D[] = [];
    const punkt = weicherPunkt();
    ressourcen.add(punkt);
    const vorrat = (anzahl: number, farbe: number, groesse: number, deckkraft: number): Wolke[] =>
      Array.from({ length: anzahl }, () => {
        const material = new THREE.SpriteMaterial({ map: punkt, color: farbe, transparent: true, opacity: 0, depthWrite: false });
        ressourcen.add(material);
        const sprite = new THREE.Sprite(material);
        sprite.scale.setScalar(groesse);
        sprite.visible = false;
        scene.add(sprite);
        return { sprite, material, leben: 0, dauer: 1, tempo: new THREE.Vector3(), start: groesse, deckkraft };
      });
    // Auspuff: gräulich und träge. Schneefahne: weiß, kurz, dicht über dem Boden.
    const rauch = vorrat(20, 0xa8bccd, 1, 0.58);
    const fahne = vorrat(16, 0xffffff, 0.7, 0.34);
    let rauchUhr = 0, fahneUhr = 0;
    /**
     * Eine freie Wolke ans Heck setzen.
     *
     * `tempoZ` ist bewusst nicht das echte Fahrtempo: Physikalisch bliebe der
     * Qualm mit 40 Metern je Sekunde zurück und wäre im nächsten Bild nicht
     * mehr da. Er zieht deshalb nur gemächlich ab - so sieht man ihn auch.
     */
    const qualmen = (
      vorratListe: Wolke[], gruppe: THREE.Group, seite: number,
      tempoZ: number, dauer: number, hoehe: number,
    ) => {
      const frei = vorratListe.find((w) => w.leben <= 0);
      if (!frei) return;
      frei.leben = dauer;
      frei.dauer = dauer;
      frei.sprite.position.set(
        gruppe.position.x + seite + (Math.random() - 0.5) * 0.3,
        hoehe,
        gruppe.position.z - 1.35 + (Math.random() - 0.5) * 0.25,
      );
      frei.tempo.set((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.4, tempoZ);
      frei.sprite.scale.setScalar(frei.start);
      frei.sprite.visible = true;
    };
    /** Wolken altern lassen: aufsteigen, größer werden, ruhig verschwinden. */
    const wolkenBewegen = (vorratListe: Wolke[], dt: number) => {
      for (const w of vorratListe) {
        if (w.leben <= 0) continue;
        w.leben -= dt;
        if (w.leben <= 0) { w.sprite.visible = false; w.material.opacity = 0; continue; }
        w.sprite.position.addScaledVector(w.tempo, dt);
        const anteil = w.leben / w.dauer;
        // Sanft ein- und ausblenden - nichts blitzt, nichts springt.
        w.material.opacity = w.deckkraft * Math.min(1, anteil * 2.2) * anteil;
        w.sprite.scale.setScalar(w.start * (1 + (1 - anteil) * 1.6));
      }
    };
    /**
     * Tempostriche am Fahrbahnrand.
     *
     * Sie liegen weit außen, wo das Auge sie nicht verfolgt, und ziehen ruhig
     * durch - kein Blinken, kein Flackern: nur ein Zug im Augenwinkel, der mit
     * dem Tempo länger und deutlicher wird.
     */
    const striche = Array.from({ length: 14 }, (_, i) => {
      const streifen = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 3),
        new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0 }),
      );
      streifen.position.set((i % 2 ? -1 : 1) * (5.6 + (i % 3) * 0.5), 0.5 + (i % 4) * 0.35, i * 7 - 30);
      scene.add(streifen);
      ressourcen.add(streifen.geometry);
      ressourcen.add(streifen.material);
      return streifen;
    });

    const hindernisse = Array.from({ length: 5 }, (_, i) => ({
      obj: mesh(new THREE.BoxGeometry(1.9, 0.9, 0.8), 0xf6a14b, (i % 3 - 1) * 3.4, 0.45, 65 + i * HINDERNIS_ABSTAND), getroffen: false,
    }));
    let phase: 'anfahrt' | 'jagd' = 'anfahrt', anfahrtZeit = 0;
    let speed = 0, fluchtSpeed = 0, abstand = ABSTAND_START, zeit = 0, ausgabe = 0, unverwundbar = 0, letzter = performance.now();
    /** Straße und Kulisse ziehen vorbei - in der Anfahrt wie in der Jagd. */
    const weltBewegen = (weg: number) => {
      for (const m of markierungen) { m.position.z -= weg; if (m.position.z < -22) m.position.z += 100; }
      for (const b of kulisse) { b.position.z -= weg; if (b.position.z < -30) b.position.z += 112; }
    };
    /** Aus der Anfahrt in die Jagd - ohne Schnitt, nur ohne Wimpy am Rand. */
    const losfahren = () => {
      if (phase !== 'anfahrt') return;
      phase = 'jagd';
      wimpy.visible = false;
      spieler.position.set(spur.current * 3.4, 0, 0);
      spieler.rotation.set(0, 0, 0);
      gegner.position.set(0, 0, FLUCHT_FERN);
      camera.position.set(...KAMERA_JAGD.pos);
      camera.lookAt(...KAMERA_JAGD.ziel);
      camera.fov = KAMERA_JAGD.fov;
      camera.updateProjectionMatrix();
      callbacks.current.onPhase('jagd');
    };
    const taste = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && e.target.closest('input,select,textarea'))) return;
      if (phase === 'anfahrt') { e.preventDefault(); losfahren(); return; }
      const delta = ['ArrowLeft', 'ArrowUp', 'a', 'w'].includes(e.key) ? -1 : ['ArrowRight', 'ArrowDown', 'd', 's'].includes(e.key) ? 1 : 0;
      if (delta) { e.preventDefault(); spur.current = THREE.MathUtils.clamp(spur.current + delta, -1, 1); }
    };
    window.addEventListener('keydown', taste);
    // Ein Tipp aufs Bild überspringt die Anfahrt - niemand will sie zehnmal sehen.
    const tippen = () => { if (phase === 'anfahrt' && bereit) losfahren(); };
    renderer.domElement.addEventListener('pointerdown', tippen);
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix(); renderer.setSize(element.clientWidth, element.clientHeight);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const verloren = (e: Event) => { e.preventDefault(); bereit = false; callbacks.current.onFehler('Grafik unterbrochen. Bitte Jagd erneut starten.'); };
    renderer.domElement.addEventListener('webglcontextlost', verloren);
    /** Die Anfahrt: zuschauen, einsteigen, losfahren. */
    function anfahrt(dt: number) {
      anfahrtZeit += dt;
      const t = anfahrtZeit;
      mixer?.update(dt);

      // Der andere Wagen rast an Wimpy vorbei und ist gleich wieder weg.
      const raste = THREE.MathUtils.clamp((t - 0.7) / (ANFAHRT.vorbei - 0.7), 0, 1);
      // Auf der Spur, die am nächsten an Wimpy vorbeiführt.
      gegner.position.set(-3.4, 0, THREE.MathUtils.lerp(-40, 26, raste));

      // Dann geht Wimpy die zwei Schritte zu seinem Wagen und steigt ein.
      if (t > ANFAHRT.vorbei) {
        const schritt = THREE.MathUtils.clamp((t - ANFAHRT.vorbei) / (ANFAHRT.einsteigen - ANFAHRT.vorbei), 0, 1);
        if (gehen && stehen?.isRunning()) { stehen.fadeOut(0.25); gehen.reset().fadeIn(0.25).play(); }
        const ziel = { x: PARKPLATZ.x - 0.9, z: PARKPLATZ.z + 0.5 };
        wimpy.position.x = THREE.MathUtils.lerp(STANDPLATZ.x, ziel.x, weich(schritt));
        wimpy.position.z = THREE.MathUtils.lerp(STANDPLATZ.z, ziel.z, weich(schritt));
        // Er geht dorthin, wo er hinschaut: Modelle blicken bei 0 nach +z.
        wimpy.rotation.y = Math.atan2(ziel.x - STANDPLATZ.x, ziel.z - STANDPLATZ.z);
        // Zum Schluss verschwindet er in der Fahrerkabine.
        const rein = THREE.MathUtils.clamp((schritt - 0.75) / 0.25, 0, 1);
        wimpy.scale.setScalar(Math.max(0.001, 1 - rein));
        wimpy.visible = rein < 1;
      }

      // Und zieht auf die Straße, während die Kamera nach hinten gleitet.
      const anfahren = weich(THREE.MathUtils.clamp((t - ANFAHRT.einsteigen) / (ANFAHRT.losfahren - ANFAHRT.einsteigen), 0, 1));
      spieler.position.x = THREE.MathUtils.lerp(PARKPLATZ.x, spur.current * 3.4, anfahren);
      spieler.position.z = THREE.MathUtils.lerp(PARKPLATZ.z, 0, anfahren);
      spieler.rotation.y = THREE.MathUtils.lerp(PARKPLATZ.winkel, 0, anfahren);
      camera.position.set(
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.pos[0], KAMERA_JAGD.pos[0], anfahren),
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.pos[1], KAMERA_JAGD.pos[1], anfahren),
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.pos[2], KAMERA_JAGD.pos[2], anfahren),
      );
      camera.lookAt(
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.ziel[0], KAMERA_JAGD.ziel[0], anfahren),
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.ziel[1], KAMERA_JAGD.ziel[1], anfahren),
        THREE.MathUtils.lerp(KAMERA_ANFAHRT.ziel[2], KAMERA_JAGD.ziel[2], anfahren),
      );
      camera.fov = THREE.MathUtils.lerp(KAMERA_ANFAHRT.fov, KAMERA_JAGD.fov, anfahren);
      camera.updateProjectionMatrix();
      // Der Wagen ist schon in Fahrt, wenn die Jagd übernimmt: kein Ruck.
      speed = auto.speed * 0.4 * anfahren;
      weltBewegen(speed / 3.6 * dt);
      // Der Motor läuft schon, während Wimpy noch zusieht: ein ruhiger
      // Standgasqualm, der beim Anfahren kräftiger wird.
      rauchUhr -= dt;
      if (rauchUhr <= 0) {
        rauchUhr = anfahren > 0 ? 0.1 : 0.5;
        qualmen(rauch, spieler, 0.5, -1 - anfahren * 4, anfahren > 0 ? 1 : 1.6, 0.42);
      }
      wolkenBewegen(rauch, dt);
      wolkenBewegen(fahne, dt);
      if (t >= ANFAHRT.losfahren) losfahren();
    }
    function zeichnen(jetzt: number) {
      if (beendet) return;
      frame = requestAnimationFrame(zeichnen);
      const dt = Math.min(0.04, (jetzt - letzter) / 1000); letzter = jetzt;
      if (document.hidden || !bereit) return;
      // Die zusätzliche Drehung des Fluchtwagens lässt sich in der Vorschau
      // im laufenden Bild ändern, ohne die Szene neu zu bauen.
      gegner.rotation.y = THREE.MathUtils.degToRad(drehung.current);
      if (phase === 'anfahrt') { anfahrt(dt); renderer.render(scene, camera); return; }
      zeit += dt; unverwundbar = Math.max(0, unverwundbar - dt);
      speed = Math.min(auto.speed, speed + auto.beschleunigung * dt);
      const weg = speed / 3.6 * dt;
      // Der Flüchtige richtet sich nach Wimpys Wagen: Er bleibt knapp voraus,
      // geht in den Kurven vom Gas - und ist damit immer einholbar.
      // Liegt Wimpy hinter dem Start zurück - meist nach einem Rempler -,
      // lässt sich der Flüchtige ein Stück zurückfallen.
      const band = auto.speed / 3.6 * (abstand > ABSTAND_START ? FLUCHT_RUECKSTAND : 1);
      fluchtSpeed = Math.min(fluchtTempo(flucht, zeit, band), fluchtSpeed + flucht.beschleunigung / 3.6 * dt);
      abstand += fluchtSpeed * dt - weg;
      spieler.position.x = THREE.MathUtils.damp(spieler.position.x, spur.current * 3.4, 7, dt);
      /*
       * Der Fluchtwagen bleibt im Bild.
       *
       * Voraus heißt hier +z, und dort läuft die Straße aus dem Bildrand
       * heraus: Ein Vorsprung von 200 Metern maßstäblich gefahren hieße, dass
       * man den Wagen, den man jagt, nie zu sehen bekommt. Der Abstand wird
       * deshalb in ein schmales sichtbares Band gelegt - die Zahl im HUD sagt,
       * wie weit es wirklich ist.
       */
      const fern = THREE.MathUtils.clamp(abstand, 0, ABSTAND_VERLOREN) / ABSTAND_VERLOREN;
      gegner.position.z = THREE.MathUtils.damp(gegner.position.z, THREE.MathUtils.lerp(FLUCHT_NAH, FLUCHT_FERN, fern), 4, dt);
      gegner.position.x = THREE.MathUtils.damp(gegner.position.x, Math.sin(zeit * 0.65) > 0.4 ? -3.4 : 0, 3, dt);
      let treffer = false;
      for (const h of hindernisse) {
        const vorher = h.obj.position.z;
        h.obj.position.z -= weg;
        if (!h.getroffen && vorher > -2 && h.obj.position.z <= 2 && Math.abs(h.obj.position.x - spieler.position.x) < 1.8 && !unverwundbar) {
          speed *= REMPLER.tempo; abstand += REMPLER.verlust; unverwundbar = 1; treffer = true; h.getroffen = true;
        }
        if (h.obj.position.z < -15) { h.obj.position.z += HINDERNIS_ABSTAND * 5; h.obj.position.x = (Math.floor(Math.random() * 3) - 1) * 3.4; h.getroffen = false; }
      }
      weltBewegen(weg);

      /* --- Was das Tempo sichtbar macht ------------------------------ */
      const tempoAnteil = THREE.MathUtils.clamp(speed / Math.max(1, auto.speed), 0, 1);
      // Auspuff: je schneller, desto dichter die Fahne hinter dem Wagen.
      rauchUhr -= dt;
      if (rauchUhr <= 0) {
        rauchUhr = 0.14 - tempoAnteil * 0.08;
        const abzug = -(2.5 + tempoAnteil * 5.5);
        qualmen(rauch, spieler, 0.5, abzug, 0.9 + tempoAnteil * 0.5, 0.42);
        qualmen(rauch, gegner, 0.5, abzug, 0.9, 0.5);
      }
      // Schneefahne von den Hinterrädern - erst ab ordentlichem Tempo.
      fahneUhr -= dt;
      if (fahneUhr <= 0 && tempoAnteil > 0.25) {
        fahneUhr = 0.06;
        qualmen(fahne, spieler, (Math.random() < 0.5 ? -1 : 1) * 0.75, -(3 + tempoAnteil * 7), 0.45 + tempoAnteil * 0.3, 0.18);
      }
      wolkenBewegen(rauch, dt);
      wolkenBewegen(fahne, dt);

      // Die Karosserie legt sich in den Spurwechsel und nickt beim Rempler.
      const seitlich = (spur.current * 3.4 - spieler.position.x) / 3.4;
      spieler.rotation.z = THREE.MathUtils.damp(spieler.rotation.z, -seitlich * 0.2, 6, dt);
      spieler.rotation.x = THREE.MathUtils.damp(spieler.rotation.x, unverwundbar > 0 ? 0.05 : -0.015 * tempoAnteil, 5, dt);
      // Und sie zittert bei hohem Tempo ganz leicht - spürbar, nicht sichtbar.
      spieler.position.y = Math.sin(zeit * 34) * 0.012 * tempoAnteil;
      gegner.position.y = Math.sin(zeit * 31 + 1.3) * 0.01;

      // Räder, sofern das Modell welche mitbringt.
      for (const rad of raeder) rad.rotation.x -= weg / dt * dt * 1.6;

      // Tempostriche und ein ganz leicht weiteres Sichtfeld beim Vollgas.
      for (const strich of striche) {
        strich.position.z -= weg * 1.6;
        if (strich.position.z < -34) strich.position.z += 98 + Math.random() * 6;
        strich.scale.z = 0.6 + tempoAnteil * 2.4;
        (strich.material as THREE.MeshBasicMaterial).opacity = Math.max(0, tempoAnteil - 0.3) * 0.75;
      }
      const sichtfeld = KAMERA_JAGD.fov + tempoAnteil * 4;
      if (Math.abs(camera.fov - sichtfeld) > 0.01) {
        camera.fov = THREE.MathUtils.damp(camera.fov, sichtfeld, 3, dt);
        camera.updateProjectionMatrix();
      }

      ausgabe += dt;
      if (ausgabe > 0.12 || treffer) { callbacks.current.onStand(Math.round(speed), Math.max(0, Math.round(abstand)), unverwundbar > 0); ausgabe = 0; }
      renderer.render(scene, camera);
      if (abstand <= 0 || abstand > ABSTAND_VERLOREN || zeit > 180) { bereit = false; callbacks.current.onEnde(abstand <= 0); }
    }
    frame = requestAnimationFrame(zeichnen);
    return () => {
      beendet = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', taste);
      renderer.domElement.removeEventListener('pointerdown', tippen);
      renderer.domElement.removeEventListener('webglcontextlost', verloren);
      mixer?.stopAllAction();
      sammeln(scene); ressourcen.forEach(r => r.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, [auto, flucht, spur, drehung, figurModell]);
  return <div className="jagd-canvas" ref={host} aria-label="Wimpy verfolgt den Fluchtwagen auf drei Spuren" />;
}

export function AutoJagd({ vorgabe, onFertig, autoId, besitz = {}, vorschau = false, onDrehung }: {
  vorgabe: VerfolgungVorgabe; onFertig: () => void; autoId?: string; besitz?: Record<string, number>; vorschau?: boolean;
  /** Nur in der Vorschau: die gefundene Drehung des Fluchtwagens zurückgeben. */
  onDrehung?: (grad: number) => void;
}) {
  const { autos, fehler: katalogFehler } = useAutos();
  const stammdaten = useStammdaten();
  const [wahl, setWahl] = useState(autoId ?? START_AUTO_ID);
  const [fluchtId, setFluchtId] = useState(vorgabe.fluchtAutoId ?? 'auto-sport');
  const [rennen, setRennen] = useState<{ auto: Auto; flucht: Auto } | null>(null);
  const [phase, setPhase] = useState<'bereit' | 'anfahrt' | 'jagd' | 'gefangen' | 'entkommen'>('bereit');
  const [fehler, setFehler] = useState('');
  const [bereit, setBereit] = useState(false);
  const [stand, setStand] = useState({ speed: 0, abstand: ABSTAND_START, treffer: false });
  const [fluchtDrehung, setFluchtDrehung] = useState(vorgabe.fluchtDrehung ?? 0);
  const spur = useRef(0);
  const drehung = useRef(fluchtDrehung);
  const faehrt = phase === 'anfahrt' || phase === 'jagd';
  const fliehender = stammdaten.charaktere.find(c => c.id === vorgabe.fliehenderId);
  // Am Straßenrand steht Wimpy in dem Modell, das ihm in den Stammdaten
  // zugeordnet ist - dasselbe wie in den 3D-Kapiteln.
  const figur = spielerModell(stammdaten.charaktere.find(c => c.istDetektiv));
  const verfuegbar = autos.filter(a => vorschau || a.id === START_AUTO_ID || besitz[a.id]);
  const drehen = (schritt: number) => {
    const grad = (((fluchtDrehung + schritt) % 360) + 360) % 360;
    setFluchtDrehung(grad); drehung.current = grad; onDrehung?.(grad);
  };
  const starten = () => {
    const auto = verfuegbar.find(a => a.id === wahl) ?? verfuegbar[0];
    const flucht = autos.find(a => a.id === (vorschau ? fluchtId : vorgabe.fluchtAutoId ?? 'auto-sport')) ?? autos[0];
    if (!auto || !flucht) { setFehler('Bitte zuerst ein Automodell im Admin-Menü hinterlegen.'); return; }
    spur.current = 0; drehung.current = fluchtDrehung;
    setFehler(''); setBereit(false); setStand({ speed: 0, abstand: ABSTAND_START, treffer: false }); setRennen({ auto, flucht }); setPhase('anfahrt');
  };
  return <div className="jagd" data-treffer={stand.treffer}>
    {faehrt && rennen && !fehler ? <>
      {vorgabe.musik && phase === 'jagd' && <Hintergrundmusik stueck={vorgabe.musik} />}
      <RennCanvas {...rennen} spur={spur} drehung={drehung} figur={figur} onBereit={() => setBereit(true)} onPhase={setPhase} onStand={(speed, abstand, treffer) => setStand({ speed, abstand, treffer })} onEnde={fang => setPhase(fang ? 'gefangen' : 'entkommen')} onFehler={setFehler} />
      {!bereit && <div className="auto-jagd-laden" role="status">Die Wagen werden bereitgestellt …</div>}
      {bereit && phase === 'anfahrt' && <div className="auto-jagd-anfahrt" role="status"><strong>{vorgabe.name}</strong><span>Tippen überspringt</span></div>}
      {phase === 'jagd' && <>
        <div className="auto-jagd-hud"><strong>WIMPY · {rennen.auto.name}</strong><span>{stand.speed} km/h · Abstand {stand.abstand} m</span>{stand.treffer && <b>REMPLER! TEMPO VERLOREN</b>}</div>
        <div className="auto-jagd-steuerung"><button aria-label="Eine Spur nach links" onClick={() => { spur.current = Math.max(-1, spur.current - 1); }}>◀</button><button aria-label="Eine Spur nach rechts" onClick={() => { spur.current = Math.min(1, spur.current + 1); }}>▶</button></div>
      </>}
      {vorschau && <div className="auto-jagd-drehen"><button type="button" onClick={() => drehen(-90)} aria-label="Fluchtwagen nach links drehen">↺</button><span>Fluchtwagen {fluchtDrehung}°</span><button type="button" onClick={() => drehen(90)} aria-label="Fluchtwagen nach rechts drehen">↻</button></div>}
    </> : <div className="jagd-start auto-jagd-auswahl"><article className="jagd-startkarte">
      <span className="jagd-kicker">WIMPY · PURSUIT</span><h1>{phase === 'gefangen' ? 'EINGEHOLT!' : phase === 'entkommen' ? 'ENTKOMMEN!' : vorgabe.name}</h1>
      {phase === 'gefangen' ? <><h2>{fliehender?.name ?? vorgabe.fliehenderId}</h2><blockquote>„{fluchtStatement(vorgabe)}“</blockquote><button className="knopf aktion" onClick={onFertig}>Weiter ›</button></> : <>
        <p>Drei Spuren. Weiche den Hindernissen aus und hole den Fluchtwagen ein. Pfeiltasten oder die großen Touch-Tasten wechseln die Spur.</p>
        {phase === 'entkommen' && <p>Der Wagen ist entwischt. Versuche es erneut oder wähle einen anderen Wagen aus deiner Garage.</p>}
        <label className="feld">Wimpys Wagen<select value={verfuegbar.some(a => a.id === wahl) ? wahl : verfuegbar[0]?.id ?? ''} onChange={e => setWahl(e.target.value)}>{verfuegbar.map(a => <option key={a.id} value={a.id}>{a.name} · {a.speed} km/h · +{a.beschleunigung} km/h/s</option>)}</select></label>
        {vorschau && <label className="feld">Fluchtwagen<select value={fluchtId} onChange={e => setFluchtId(e.target.value)}>{autos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {vorschau && <label className="feld">Fluchtwagen drehen<select value={fluchtDrehung} onChange={e => { const grad = Number(e.target.value); setFluchtDrehung(grad); drehung.current = grad; onDrehung?.(grad); }}>{[0, 90, 180, 270].map(grad => <option key={grad} value={grad}>{grad}°</option>)}</select></label>}
        {(fehler || katalogFehler) && <p role="alert">{fehler || katalogFehler}</p>}
        <button className="knopf aktion" onClick={starten}>Verfolgung starten ›</button>
      </>}
    </article></div>}
  </div>;
}
