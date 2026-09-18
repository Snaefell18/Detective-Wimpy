"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { laufClipVon, modellFuerTier, ruheAuswahl, spielerModell } from '@/lib/tiermodelle';
import { ANIMATIONS_MODELLE } from '@/lib/animations.generated';
import { AUTO_MODELLE, FLUCHT_RUECKSTAND, REMPLER, START_AUTO_ID, autoLaenge, fluchtTempo, type Auto } from '@/lib/autos';
import { useAutos } from '@/lib/useAutos';
import { useStammdaten } from '@/lib/stammdaten';
import { fluchtStatement, jagdWelt, type JagdWelt, type VerfolgungVorgabe } from '@/lib/verfolgung';
import {
  DREI_D_LOCATIONS,
  DREI_D_STRASSENTYPEN,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
} from '@/lib/pursuit3d';
import { istHandy } from '@/lib/dreiDLeistung';
import { istBlizzard, istDunst, istSchneeWetter } from '@/lib/pursuit3d';
import { einpassen, gradientTextur } from './stadtBau';
import { haeuserZeilen, strasseBauen } from './strassenWelt';
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
 *
 * Die zwei Sekunden für den Weg zum Wagen sind Absicht: Darunter sieht man
 * die Gehanimation nicht, man sieht nur, dass jemand über den Gehweg
 * rutscht. Wem das zu lang ist, der tippt ins Bild und ist sofort drin.
 */
const ANFAHRT = { vorbei: 2.9, einsteigen: 4.9, losfahren: 6.6 };

/**
 * Der Ablauf der Verhaftung in Sekunden.
 *
 * Eingeholt war der Wagen bisher mit einer Zahl: Der Abstand fiel auf null,
 * das Bild verschwand, und auf der Karte stand ein Name. Wer da eigentlich
 * gefahren ist, hat man nie gesehen.
 *
 * Jetzt endet die Jagd, wie sie es verdient: Beide gehen in die Eisen, der
 * Fluchtwagen stellt sich quer, der Staub steht in der Luft - und dann steigt
 * der Flüchtige aus und dreht sich um. Das ist der Moment, für den man
 * gefahren ist, deshalb hat er seine eigene Zeit.
 */
const VERHAFTUNG = { bremsen: 1.35, staub: 2.3, aussteigen: 4.0, fertig: 6.6 };

/** Wo die beiden Wagen zum Stehen kommen - quer und der Weg versperrt. */
const HALTEPLATZ = {
  flucht: { x: -1.3, z: 5.6, winkel: -0.62 },
  wimpy: { x: 1.6, z: 0.9, winkel: 0.46 },
};
/** Und wo der Flüchtige aussteigt: auf der Seite, auf die die Kamera sieht. */
const AUSSTIEG = { x: -3.9, z: 4.5 };

/**
 * Die Häuserzeilen neben der Piste.
 *
 * Gemessen wird ab der Fahrbahnkante und an der *Hausfront*, nicht an der
 * Hausmitte: Ein Baustein ist mal zwölf und mal dreißig Meter tief, und wer
 * ihre Mittelpunkte auf eine Linie stellt, bekommt eine ausgefranste Zeile
 * mit einer breiten Lücke davor. Vorn an der Straße steht deshalb die Front,
 * und wie tief das Haus dahinter ist, darf es selbst wissen.
 *
 * Drei Zeilen, und sie stehen nicht symmetrisch:
 *
 * - **vorn rechts** - direkt am Gehweg. Das Spiel läuft in einer hochkanten
 *   Spalte, und die Kamera schaut von links vorn auf die Straße: Alles, was
 *   man sieht, steht rechts. Dort gehört die Stadt hin.
 * - **hinten rechts** - höher und ein Stück versetzt. Sie füllt, was vorn
 *   zwischen zwei Häusern durchblitzt, und gibt dem Horizont eine Skyline
 *   statt einer Kante.
 * - **links** - knapp hinter der Kamera. Im Hochformat sieht man sie nicht,
 *   im Breitbild steht dort eine Wand. Näher darf sie nicht: Was der Kamera
 *   zu nah kommt, fährt durch sie hindurch.
 */
const FAHRBAHN_RAND = 5.1;
/** Wie weit die Front vom Fahrbahnrand wegbleibt - ein Gehweg, mehr nicht. */
const GEHWEG = 1.5;

/** Die Kamera der Verhaftung: tiefer, näher, auf die Fahrertür. */
const KAMERA_VERHAFTUNG = { pos: [-9.4, 2.1, 11.2], ziel: [-2.6, 1.05, 5.0], fov: 40 } as const;

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
    /*
     * Ein fester Kern, der erst außen weich ausläuft. Ein durchgehend
     * weicher Verlauf ergibt aus vielen Wolken einen gleichmäßigen Schleier;
     * erst der Kern macht daraus einzelne Ballen, die man als Qualm sieht.
     */
    const verlauf = stift.createRadialGradient(32, 32, 0, 32, 32, 32);
    verlauf.addColorStop(0, "rgba(255,255,255,1)");
    verlauf.addColorStop(0.38, "rgba(255,255,255,0.88)");
    verlauf.addColorStop(0.72, "rgba(255,255,255,0.3)");
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
  /** Die Größe, mit der dieser Vorrat normalerweise anfängt. */
  start: number;
  /** Womit diese eine Wolke angefangen hat - der Kavalierstart bläst größer. */
  groesse: number;
  deckkraft: number;
  /** Wie kräftig diese eine Wolke ist; sonst gilt der Wert des Vorrats. */
  staerke: number;
};

/**
 * Quietschende Reifen - gerechnet, nicht geladen.
 *
 * Eine Tondatei dafür gibt es nicht, und eine nachzuliefern hieße, für
 * anderthalb Sekunden Krawall ein weiteres Stück durch die Leitung zu
 * schicken. Also entsteht das Quietschen im Browser: gefiltertes Rauschen,
 * dessen Tonhöhe absackt, wie es ein blockierender Reifen tut.
 *
 * Alles daran darf schiefgehen: Wo der Browser keinen Ton erlaubt oder das
 * Gerät stummgeschaltet ist, bleibt die Verhaftung eben still - sie ist ein
 * Bild, kein Geräusch.
 */
function reifenQuietschen(): void {
  try {
    const Hersteller =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Hersteller) return;
    const kontext = new Hersteller();
    const dauer = 1.15;
    const laenge = Math.floor(kontext.sampleRate * dauer);
    const puffer = kontext.createBuffer(1, laenge, kontext.sampleRate);
    const daten = puffer.getChannelData(0);
    for (let i = 0; i < laenge; i++) daten[i] = Math.random() * 2 - 1;
    const rauschen = kontext.createBufferSource();
    rauschen.buffer = puffer;
    // Ein schmales Band macht aus Rauschen ein Quietschen; es rutscht nach
    // unten, weil der Wagen dabei langsamer wird.
    const filter = kontext.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 14;
    filter.frequency.setValueAtTime(2300, kontext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(680, kontext.currentTime + dauer);
    const laut = kontext.createGain();
    laut.gain.setValueAtTime(0.0001, kontext.currentTime);
    laut.gain.exponentialRampToValueAtTime(0.16, kontext.currentTime + 0.08);
    laut.gain.exponentialRampToValueAtTime(0.0001, kontext.currentTime + dauer);
    rauschen.connect(filter).connect(laut).connect(kontext.destination);
    // Auf dem iPhone beginnt jeder Kontext angehalten. Getippt hat der
    // Spieler längst - spätestens, um die Jagd zu starten.
    if (kontext.state === "suspended") void kontext.resume().catch(() => {});
    rauschen.start();
    rauschen.onended = () => void kontext.close().catch(() => {});
  } catch {
    // Kein Ton - kein Problem.
  }
}

/** Räder, die sich wirklich drehen können - falls das Modell welche mitbringt. */
const RAD_NAME = /wheel|rad\b|reifen|tyre|tire|felge/i;

function RennCanvas({ auto, flucht, spur, drehung, welt, figur: figurModell, fluechtig: fluechtigModell, onStand, onEnde, onFehler, onBereit, onPhase }: {
  auto: Auto; flucht: Auto; spur: React.MutableRefObject<number>;
  /** Wimpys 3D-Modell aus den Stammdaten - fehlt es, steht niemand am Rand. */
  figur?: { datei: string };
  /**
   * Das Modell dessen, der im Fluchtwagen sitzt.
   *
   * Es kommt erst bei der Verhaftung ins Bild - bis dahin ist der Fahrer
   * hinter getönten Scheiben genauso unkenntlich wie bisher. Fehlt es,
   * halten die Wagen trotzdem dramatisch an; nur aussteigen tut dann
   * niemand.
   */
  fluechtig?: { datei: string };
  /** Belag, Licht, Wetter und Bausteine der Strecke. */
  welt: JagdWelt;
  /** Zusätzliche Drehung des Fluchtwagens in Grad - live veränderbar. */
  drehung: React.MutableRefObject<number>;
  onStand: (speed: number, abstand: number, treffer: boolean) => void;
  onEnde: (gefangen: boolean) => void; onFehler: (text: string) => void;
  onBereit: () => void; onPhase: (phase: 'anfahrt' | 'jagd' | 'verhaftung') => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onStand, onEnde, onFehler, onBereit, onPhase });
  callbacks.current = { onStand, onEnde, onFehler, onBereit, onPhase };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false, bereit = false, frame = 0;
    const scene = new THREE.Scene();
    const { strassentyp, tageszeit, wetter, locations } = welt;
    const nacht = tageszeit === "nacht";

    /* --- Aufräumen: alles, was Speicher hält, kommt hier hinein ------- */
    const ressourcen = new Set<{ dispose: () => void }>();
    const merken = (wert: { dispose: () => void }) => ressourcen.add(wert);
    const sammeln = (root: THREE.Object3D) => root.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      ressourcen.add(obj.geometry);
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        ressourcen.add(mat);
        for (const wert of Object.values(mat)) if (wert instanceof THREE.Texture) ressourcen.add(wert);
      }
    });

    /**
     * Alles, was mit der Straße nach hinten wandert.
     *
     * Jeder Eintrag bringt mit, wie weit er zurückfallen darf und wie weit er
     * dann wieder nach vorn springt - so ziehen Fahrbahnmarkierungen,
     * Schneestangen und ganze Häuserzeilen in einer einzigen Schleife vorbei,
     * obwohl sie unterschiedlich weit auseinanderstehen.
     */
    const ziehendes: { obj: THREE.Object3D; ende: number; sprung: number }[] = [];
    const zieht = (obj: THREE.Object3D, ende: number, sprung: number) => {
      ziehendes.push({ obj, ende, sprung });
      return obj;
    };

    const gradient = gradientTextur();
    merken(gradient);
    /*
     * Himmel, Licht, Fahrbahn, Landschaft und Wetter stehen in
     * components/strassenWelt.ts - dieselbe Straße fährt der Abspann.
     */
    const strasse = strasseBauen({
      scene,
      welt,
      gradient,
      merken,
      zieht,
      // Wo Wimpy und sein Wagen auf die Jagd warten, steht nichts im Bild.
      freiHalten: (x, z) => x < -5 && z > -6 && z < 10,
    });
    const { sichtNah, sichtFern, blizzard, wetterfall } = strasse;

    // Gleiche Achsen und Blickrichtung wie Jump-and-Run; etwas weiter für zwei Autos.
    const camera = new THREE.PerspectiveCamera(KAMERA_ANFAHRT.fov, 1, 0.1, 130);
    camera.position.set(...KAMERA_ANFAHRT.pos);
    camera.lookAt(...KAMERA_ANFAHRT.ziel);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { callbacks.current.onFehler('3D konnte nicht gestartet werden.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Im Schneeland steht die Blende enger - sonst wird aus Weiß Creme.
    renderer.toneMappingExposure = strasse.belichtung;
    element.appendChild(renderer.domElement);

    const spieler = new THREE.Group(), gegner = new THREE.Group(), wimpy = new THREE.Group();
    /** Der Flüchtige selbst - unsichtbar, bis er aussteigt. */
    const fluechtiger = new THREE.Group();
    fluechtiger.visible = false;
    spieler.position.set(PARKPLATZ.x, 0, PARKPLATZ.z); spieler.rotation.y = PARKPLATZ.winkel;
    // Vor der Vorbeifahrt steht der Fluchtwagen weit außerhalb des Bildes.
    gegner.position.set(0, 0, -60);
    wimpy.position.set(STANDPLATZ.x, 0, STANDPLATZ.z);
    // Die Figuren schauen bei rotation.y = 0 nach +z; Wimpy blickt zur Straße.
    wimpy.rotation.y = Math.PI / 2;
    scene.add(spieler, gegner, wimpy, fluechtiger);
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
      // Jeder Wagen wird auf dieselbe Länge gebracht - mal die Größe, die
      // im Katalog steht. Eine Limousine darf länger sein als ein Flitzer.
      obj.scale.multiplyScalar(autoLaenge(wagen, 3.5) / Math.max(size.x, size.z, 0.001));
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
    /**
     * Ob schon auf Gehen umgeschaltet wurde.
     *
     * Ein Schalter, kein Zustandstest: fadeOut hält eine Aktion nicht an,
     * isRunning blieb also für immer wahr - und damit lief jedes Bild ein
     * reset() auf die Gehanimation. Die stand dadurch bei Bild eins still,
     * und Wimpy rutschte in Ruhepose zu seinem Wagen.
     */
    let geht = false;
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
      const gehClip = laufClipVon(gltf.animations);
      // Die Ruhepose steht in ruheAuswahl ganz hinten: Sie ist ein einziges
      // Bild, und wer am Straßenrand wartet, soll nicht wie eingefroren
      // dastehen, solange das Modell etwas Besseres mitbringt.
      const ruheClip = ruheAuswahl(gltf.animations, gehClip)[0] ?? gltf.animations[0];
      stehen = ruheClip ? mixer.clipAction(ruheClip) : null;
      gehen = gehClip ? mixer.clipAction(gehClip) : null;
      stehen?.play();
    }
    /*
     * Und der, der da vorne fährt.
     *
     * Sein Modell wird nebenher geholt, nicht abgewartet: Gebraucht wird es
     * erst am Ende der Jagd, und bis dahin ist eine halbe Minute vergangen.
     * Kommt es nicht an, hält der Wagen trotzdem quer - es steigt dann nur
     * niemand aus.
     */
    let taeterMixer: THREE.AnimationMixer | null = null;
    let taeterStehen: THREE.AnimationAction | null = null;
    let taeterGehen: THREE.AnimationAction | null = null;
    let taeterDa = false;
    /**
     * Ob er schon steht.
     *
     * Wieder ein Schalter statt isRunning(): fadeOut hält eine Aktion nicht
     * an - genau wie oben bei Wimpy am Straßenrand.
     */
    let taeterSteht = false;
    async function fluechtigenLaden() {
      if (!fluechtigModell) return;
      const gltf = await loader.loadAsync(fluechtigModell.datei);
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
      fluechtiger.add(figur);
      taeterMixer = new THREE.AnimationMixer(figur);
      const gehClip = laufClipVon(gltf.animations);
      // Die Ruhepose steht in ruheAuswahl ganz hinten: Sie ist ein einziges
      // Bild, und wer am Straßenrand wartet, soll nicht wie eingefroren
      // dastehen, solange das Modell etwas Besseres mitbringt.
      const ruheClip = ruheAuswahl(gltf.animations, gehClip)[0] ?? gltf.animations[0];
      taeterStehen = ruheClip ? taeterMixer.clipAction(ruheClip) : null;
      taeterGehen = gehClip ? taeterMixer.clipAction(gehClip) : null;
      taeterDa = true;
    }
    /**
     * Die Häuser am Straßenrand - dieselben Zeilen wie im Abspann.
     *
     * Sie kommen nebenher, nicht vorweg: Ein Baustein ist ein paar Megabyte
     * groß, und die Jagd soll losgehen können, bevor Tokio steht.
     */
    const bausteineLaden = () => haeuserZeilen({
      scene, welt, gradient, loader, sammeln, zieht, abgebrochen: () => beendet,
    });

    void Promise.all([laden(auto, spieler), laden(flucht, gegner)]).then(async () => {
      await figurLaden().catch(() => undefined);
      if (!beendet) { bereit = true; callbacks.current.onBereit(); }
      await fluechtigenLaden().catch(() => undefined);
      await bausteineLaden().catch(() => undefined);
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
        return {
          sprite, material, leben: 0, dauer: 1, tempo: new THREE.Vector3(),
          start: groesse, groesse, deckkraft, staerke: deckkraft,
        };
      });
    /*
     * Auspuff: gräulich und träge. Reifenrauch: weiß, kurz, dicht über dem
     * Boden. Beide Vorräte sind deutlich größer, als die Jagd selbst
     * braucht - der Kavalierstart leert sie in anderthalb Sekunden fast
     * ganz, und danach liegen sie wieder still da.
     */
    const rauch = vorrat(78, 0xa8bccd, 1, 0.58);
    /*
     * Der Reifenrauch ist nicht weiß, sondern ein kräftiges Grau.
     *
     * Weißer Qualm ist zwar das, was man vom Kavalierstart kennt - hier fährt
     * er aber über Schnee los, und auf hellem Grund sieht man weiß auf weiß
     * gar nichts. Das Grau liegt zwischen Schnee und Asphalt und ist deshalb
     * auf beidem zu sehen.
     */
    /*
     * Was hinter den Rädern aufstiebt, hat die Farbe des Belags: Schnee
     * blaugrau, Sand ocker, die Wiese staubig grün.
     */
    const fahne = vorrat(
      54,
      strassentyp === "sand" ? 0xd9c39b : strassentyp === "gras" ? 0x9aa87a : 0xa4b3bf,
      0.7,
      0.34,
    );
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
      /** Für den Kavalierstart: breiter, größer, dichter, dunkler. */
      wucht: { streuung?: number; wuchs?: number; steigen?: number; farbe?: number; dichte?: number } = {},
    ) => {
      const frei = vorratListe.find((w) => w.leben <= 0);
      if (!frei) return;
      const streuung = wucht.streuung ?? 0.3;
      frei.leben = dauer;
      frei.dauer = dauer;
      frei.sprite.position.set(
        gruppe.position.x + seite + (Math.random() - 0.5) * streuung,
        hoehe,
        gruppe.position.z - 1.35 + (Math.random() - 0.5) * streuung * 0.8,
      );
      frei.tempo.set(
        (Math.random() - 0.5) * streuung * 1.6,
        (wucht.steigen ?? 0.35) + Math.random() * 0.4,
        tempoZ,
      );
      frei.groesse = frei.start * (wucht.wuchs ?? 1);
      frei.staerke = frei.deckkraft * (wucht.dichte ?? 1);
      frei.material.color.setHex(wucht.farbe ?? (vorratListe === rauch ? 0xa8bccd : 0xffffff));
      frei.sprite.scale.setScalar(frei.groesse);
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
        w.material.opacity = w.staerke * Math.min(1, anteil * 2.2) * anteil;
        w.sprite.scale.setScalar(w.groesse * (1 + (1 - anteil) * 1.6));
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

    /** Die Klötze, denen man ausweicht - orange, damit man sie kommen sieht. */
    const hindernisGeometrie = new THREE.BoxGeometry(1.9, 0.9, 0.8);
    const hindernisMaterial = new THREE.MeshToonMaterial({ color: 0xf6a14b });
    ressourcen.add(hindernisGeometrie);
    ressourcen.add(hindernisMaterial);
    const hindernisse = Array.from({ length: 5 }, (_, i) => {
      const obj = new THREE.Mesh(hindernisGeometrie, hindernisMaterial);
      obj.position.set((i % 3 - 1) * 3.4, 0.45, 65 + i * HINDERNIS_ABSTAND);
      scene.add(obj);
      return { obj, getroffen: false };
    });
    let phase: 'anfahrt' | 'jagd' | 'verhaftung' = 'anfahrt', anfahrtZeit = 0, verhaftungZeit = 0;
    /** Wie die beiden standen und wie schnell sie waren, als die Jagd endete. */
    const halt = { tempo: 0, spielerX: 0, spielerZ: 0, gegnerX: 0, gegnerZ: 0 };
    let speed = 0, fluchtSpeed = 0, abstand = ABSTAND_START, zeit = 0, ausgabe = 0, unverwundbar = 0, letzter = performance.now();
    /** Straße, Kulisse und Wetter ziehen vorbei - in der Anfahrt wie in der Jagd. */
    const weltBewegen = (weg: number, dt: number) => {
      for (const teil of ziehendes) {
        teil.obj.position.z -= weg;
        if (teil.obj.position.z < teil.ende) teil.obj.position.z += teil.sprung;
      }
      // Der Schnee fällt nicht nur, er bleibt auch zurück: Was vor dem Wagen
      // in der Luft steht, ist einen Augenblick später hinter ihm.
      const jetzt = performance.now();
      wetterfall?.bewegen(dt, jetzt, weg);
      // Und im Blizzard zieht jede Böe die Sicht weiter zu.
      if (blizzard && scene.fog instanceof THREE.Fog) {
        /*
         * Die Böe nimmt hier weniger Sicht als anderswo: Wer fährt, muss den
         * Wagen vor sich noch als Schemen erkennen können - sonst jagt man
         * einer Zahl im HUD hinterher.
         */
        const faktor = 1 - (1 - (wetterfall?.sicht(jetzt) ?? 1)) * 0.6;
        scene.fog.near = sichtNah * faktor;
        scene.fog.far = sichtFern * faktor;
      }
    };
    /** Aus der Anfahrt in die Jagd - ohne Schnitt, nur ohne Wimpy am Rand. */
    const losfahren = () => {
      if (phase !== 'anfahrt') return;
      phase = 'jagd';
      wimpy.visible = false;
      /*
       * Der Wagen springt vom Parkplatz auf seine Spur - und die Wolken
       * springen mit. Sonst bliebe die ganze Qualmwand dort liegen, wo er
       * eben noch stand, und die Jagd begänne mit einem sauberen Schnitt
       * mitten in den Effekt hinein.
       */
      const versatz = new THREE.Vector3(
        spur.current * 3.4 - spieler.position.x, 0, -spieler.position.z,
      );
      for (const w of [...rauch, ...fahne]) if (w.leben > 0) w.sprite.position.add(versatz);
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
      if (phase === 'verhaftung') { e.preventDefault(); verhaftungEnde(); return; }
      const delta = ['ArrowLeft', 'ArrowUp', 'a', 'w'].includes(e.key) ? -1 : ['ArrowRight', 'ArrowDown', 'd', 's'].includes(e.key) ? 1 : 0;
      if (delta) { e.preventDefault(); spur.current = THREE.MathUtils.clamp(spur.current + delta, -1, 1); }
    };
    window.addEventListener('keydown', taste);
    // Ein Tipp aufs Bild überspringt die Anfahrt - niemand will sie zehnmal sehen.
    const tippen = () => {
      if (phase === 'anfahrt' && bereit) losfahren();
      else if (phase === 'verhaftung') verhaftungEnde();
    };
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
        if (!geht) {
          geht = true;
          stehen?.fadeOut(0.25);
          gehen?.reset().fadeIn(0.25).play();
        }
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
      weltBewegen(speed / 3.6 * dt, dt);

      /*
       * Der Kavalierstart.
       *
       * Sobald Wimpy im Wagen sitzt, geht die Kupplung kommen und der Wagen
       * steht einen Moment qualmend auf der Stelle: schwarzer Auspuff aus dem
       * Heck, weißer Reifenrauch von beiden Hinterrädern, beides breit und
       * dicht. Das ist nicht nur Krawall - es deckt zu, dass die Räder sich
       * nicht drehen: Die beiden mitgelieferten Wagen sind je ein einziges
       * Mesh ohne eigene Felgen.
       *
       * Am Anfang qualmt es am stärksten und lässt nach, wie es sich gehört -
       * aber gleichmäßig, nichts blitzt und nichts springt.
       */
      const roh = THREE.MathUtils.clamp(
        (t - ANFAHRT.einsteigen) / (ANFAHRT.losfahren - ANFAHRT.einsteigen), 0, 1,
      );
      const kavalier = t >= ANFAHRT.einsteigen ? 1 - roh * 0.45 : 0;
      rauchUhr -= dt;
      if (rauchUhr <= 0) {
        if (kavalier > 0) {
          /*
           * Viele kleine dichte Ballen statt weniger großer Schleier: Erst
           * dadurch sieht es nach Qualm aus und nicht nach Nebel. Die Wolken
           * wachsen über ihr Leben auf das Zweieinhalbfache - aus den Ballen
           * wird von selbst eine Wand.
           */
          rauchUhr = 0.04;
          for (const seite of [0.42, 0.06, -0.3]) {
            qualmen(rauch, spieler, seite, -1.2 - anfahren * 5, 1, 0.45 + Math.random() * 0.4, {
              streuung: 0.55, wuchs: 1.3 + kavalier * 0.7, steigen: 0.8, dichte: 1.45, farbe: 0x47535f,
            });
          }
        } else {
          // Vorher läuft nur der Motor: ein ruhiger Standgasqualm.
          rauchUhr = 0.5;
          qualmen(rauch, spieler, 0.5, -1, 1.6, 0.42);
        }
      }
      fahneUhr -= dt;
      if (fahneUhr <= 0 && kavalier > 0) {
        fahneUhr = 0.035;
        // Von beiden Hinterrädern, flach über dem Asphalt - und sie bleibt
        // etwas länger liegen als der Auspuff, so wie verbrannter Gummi es tut.
        for (const seite of [0.82, -0.82]) {
          qualmen(fahne, spieler, seite, -1.4 - anfahren * 5.5, 1.05, 0.14 + Math.random() * 0.22, {
            streuung: 0.65, wuchs: 2.2 + kavalier * 1.2, steigen: 0.45, dichte: 2.4, farbe: 0x8d9daa,
          });
        }
      }
      wolkenBewegen(rauch, dt);
      wolkenBewegen(fahne, dt);
      if (t >= ANFAHRT.losfahren) losfahren();
    }

    /** Und weiter zur Karte mit dem Namen und dem, was er zu sagen hat. */
    const verhaftungEnde = () => {
      if (phase !== 'verhaftung' || !bereit) return;
      bereit = false;
      callbacks.current.onEnde(true);
    };

    /** Aus der Jagd in die Verhaftung - der Abstand ist auf null. */
    const stellen = () => {
      if (phase !== 'jagd') return;
      phase = 'verhaftung';
      halt.tempo = speed;
      halt.spielerX = spieler.position.x;
      halt.spielerZ = spieler.position.z;
      halt.gegnerX = gegner.position.x;
      halt.gegnerZ = gegner.position.z;
      reifenQuietschen();
      callbacks.current.onStand(0, 0, false);
      callbacks.current.onPhase('verhaftung');
    };

    /**
     * Die Verhaftung: bremsen, quer stellen, aussteigen, umdrehen.
     *
     * Gefahren wird hier nichts mehr - die Welt steht still, sobald die
     * Wagen stehen, und die Kamera gleitet von der Verfolgungsansicht auf
     * die Fahrertür des Fluchtwagens. Wer keine Figur geladen bekommen hat,
     * sieht denselben Halt und danach dieselbe Karte; nur die Enthüllung
     * fällt aus.
     */
    function verhaftung(dt: number) {
      verhaftungZeit += dt;
      const t = verhaftungZeit;

      // 1. Beide gehen in die Eisen. Der Fluchtwagen bricht dabei aus und
      //    steht am Ende quer über der Fahrbahn.
      const bremsen = weich(THREE.MathUtils.clamp(t / VERHAFTUNG.bremsen, 0, 1));
      speed = halt.tempo * (1 - bremsen);
      weltBewegen(speed / 3.6 * dt, dt);
      gegner.position.x = THREE.MathUtils.lerp(halt.gegnerX, HALTEPLATZ.flucht.x, bremsen);
      gegner.position.z = THREE.MathUtils.lerp(halt.gegnerZ, HALTEPLATZ.flucht.z, bremsen);
      gegner.rotation.y = THREE.MathUtils.degToRad(drehung.current) + HALTEPLATZ.flucht.winkel * bremsen;
      spieler.position.x = THREE.MathUtils.lerp(halt.spielerX, HALTEPLATZ.wimpy.x, bremsen);
      spieler.position.z = THREE.MathUtils.lerp(halt.spielerZ, HALTEPLATZ.wimpy.z, bremsen);
      spieler.rotation.y = HALTEPLATZ.wimpy.winkel * bremsen;
      // Die Seitenlage aus dem letzten Spurwechsel geht weich heraus, statt
      // im ersten Bild der Verhaftung zu verschwinden.
      spieler.rotation.z = THREE.MathUtils.damp(spieler.rotation.z, 0, 6, dt);
      // Die Karosserien tauchen vorn ein und wippen einmal zurück.
      const nicken = Math.sin(THREE.MathUtils.clamp(t / VERHAFTUNG.bremsen, 0, 1) * Math.PI) * 0.07;
      spieler.rotation.x = nicken;
      gegner.rotation.x = nicken * 0.8;
      spieler.position.y = 0;
      gegner.position.y = 0;

      // 2. Und dabei qualmen alle vier Räder. Danach steht der Staub nur
      //    noch in der Luft und zieht ab.
      if (t < VERHAFTUNG.bremsen) {
        fahneUhr -= dt;
        if (fahneUhr <= 0) {
          fahneUhr = 0.03;
          for (const wagen of [spieler, gegner]) {
            for (const seite of [0.85, -0.85]) {
              qualmen(fahne, wagen, seite, -0.6, 1.5, 0.12 + Math.random() * 0.2, {
                streuung: 0.8, wuchs: 2.6, steigen: 0.5, dichte: 2.6, farbe: 0x9aa7b2,
              });
            }
          }
        }
        rauchUhr -= dt;
        if (rauchUhr <= 0) {
          rauchUhr = 0.06;
          for (const wagen of [spieler, gegner]) {
            qualmen(rauch, wagen, 0.5, -1, 1.4, 0.45, { wuchs: 1.6, streuung: 0.6, dichte: 1.2 });
          }
        }
      }
      wolkenBewegen(rauch, dt);
      wolkenBewegen(fahne, dt);

      // 3. Die Kamera kommt herunter und schaut auf die Fahrertür.
      const schwenk = weich(THREE.MathUtils.clamp(t / VERHAFTUNG.staub, 0, 1));
      const naeher = weich(THREE.MathUtils.clamp((t - VERHAFTUNG.aussteigen) / 1.8, 0, 1)) * 0.16;
      camera.position.set(
        THREE.MathUtils.lerp(KAMERA_JAGD.pos[0], KAMERA_VERHAFTUNG.pos[0], schwenk + naeher),
        THREE.MathUtils.lerp(KAMERA_JAGD.pos[1], KAMERA_VERHAFTUNG.pos[1], schwenk + naeher),
        THREE.MathUtils.lerp(KAMERA_JAGD.pos[2], KAMERA_VERHAFTUNG.pos[2], schwenk + naeher),
      );
      camera.lookAt(
        THREE.MathUtils.lerp(KAMERA_JAGD.ziel[0], KAMERA_VERHAFTUNG.ziel[0], schwenk),
        THREE.MathUtils.lerp(KAMERA_JAGD.ziel[1], KAMERA_VERHAFTUNG.ziel[1], schwenk),
        THREE.MathUtils.lerp(KAMERA_JAGD.ziel[2], KAMERA_VERHAFTUNG.ziel[2], schwenk),
      );
      camera.fov = THREE.MathUtils.lerp(KAMERA_JAGD.fov, KAMERA_VERHAFTUNG.fov, schwenk);
      camera.updateProjectionMatrix();

      // 4. Die Tür geht auf: Er steigt aus, tritt vom Wagen weg - und dreht
      //    sich um. Erst da sieht man, wer die ganze Zeit gefahren ist.
      if (taeterDa && t > VERHAFTUNG.staub) {
        const raus = THREE.MathUtils.clamp(
          (t - VERHAFTUNG.staub) / (VERHAFTUNG.aussteigen - VERHAFTUNG.staub), 0, 1,
        );
        if (!fluechtiger.visible) {
          fluechtiger.visible = true;
          (taeterGehen ?? taeterStehen)?.reset().play();
        }
        const tuer = { x: gegner.position.x - 1.15, z: gegner.position.z - 0.35 };
        fluechtiger.position.set(
          THREE.MathUtils.lerp(tuer.x, AUSSTIEG.x, weich(raus)),
          0,
          THREE.MathUtils.lerp(tuer.z, AUSSTIEG.z, weich(raus)),
        );
        // Aus dem Wagen heraus wächst er auf seine Größe: erst der Kopf,
        // dann steht er. Eine eigene Ausstiegsanimation bringt kein Modell
        // mit, und so sieht es aus, als käme er hinter der Tür hervor.
        fluechtiger.scale.setScalar(THREE.MathUtils.lerp(0.55, 1, weich(Math.min(1, raus * 1.6))));
        if (raus < 1) {
          // Er geht vom Wagen weg - also dorthin, wohin er schaut.
          fluechtiger.rotation.y = Math.atan2(AUSSTIEG.x - tuer.x, AUSSTIEG.z - tuer.z);
        } else {
          // Und dann dreht er sich zur Kamera um.
          if (!taeterSteht) {
            taeterSteht = true;
            if (taeterStehen && taeterGehen) {
              taeterGehen.fadeOut(0.3);
              taeterStehen.reset().fadeIn(0.3).play();
            }
          }
          const zurKamera = Math.atan2(
            camera.position.x - fluechtiger.position.x,
            camera.position.z - fluechtiger.position.z,
          );
          fluechtiger.rotation.y = THREE.MathUtils.damp(fluechtiger.rotation.y, zurKamera, 4, dt);
        }
        taeterMixer?.update(dt);
      }

      if (t >= (taeterDa ? VERHAFTUNG.fertig : VERHAFTUNG.staub + 0.8)) verhaftungEnde();
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
      if (phase === 'verhaftung') { verhaftung(dt); renderer.render(scene, camera); return; }
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
      weltBewegen(weg, dt);

      /* --- Was das Tempo sichtbar macht ------------------------------ */
      const tempoAnteil = THREE.MathUtils.clamp(speed / Math.max(1, auto.speed), 0, 1);
      /*
       * Der Kavalierstart klingt in die Jagd hinein aus, statt mit dem
       * Phasenwechsel abzureißen - die erste Sekunde qualmt noch nach.
       */
      const nachstart = Math.max(0, 1 - zeit / 1.1);
      // Auspuff: je schneller, desto dichter die Fahne hinter dem Wagen.
      rauchUhr -= dt;
      if (rauchUhr <= 0) {
        rauchUhr = (0.14 - tempoAnteil * 0.08) * (1 - nachstart * 0.6);
        const abzug = -(2.5 + tempoAnteil * 5.5);
        qualmen(rauch, spieler, 0.5, abzug, 0.9 + tempoAnteil * 0.5, 0.42, {
          wuchs: 1 + nachstart * 1.8, streuung: 0.3 + nachstart * 0.6, dichte: 1 + nachstart * 0.3,
        });
        qualmen(rauch, gegner, 0.5, abzug, 0.9, 0.5);
      }
      // Reifenrauch von den Hinterrädern - beim Start dicht, danach nur noch
      // ab ordentlichem Tempo eine Fahne.
      fahneUhr -= dt;
      if (fahneUhr <= 0 && (tempoAnteil > 0.25 || nachstart > 0)) {
        fahneUhr = 0.06 - nachstart * 0.025;
        for (const seite of nachstart > 0 ? [0.78, -0.78] : [(Math.random() < 0.5 ? -1 : 1) * 0.75]) {
          qualmen(fahne, spieler, seite, -(3 + tempoAnteil * 7), 0.45 + tempoAnteil * 0.3 + nachstart * 0.6, 0.18, {
            wuchs: 1 + nachstart * 2.2, streuung: 0.3 + nachstart * 0.8, dichte: 1 + nachstart * 0.9,
          });
        }
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
      // Eingeholt heißt nicht sofort vorbei: Jetzt kommt die Verhaftung.
      if (abstand <= 0) stellen();
      else if (abstand > ABSTAND_VERLOREN || zeit > 180) { bereit = false; callbacks.current.onEnde(false); }
    }
    frame = requestAnimationFrame(zeichnen);
    return () => {
      beendet = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', taste);
      renderer.domElement.removeEventListener('pointerdown', tippen);
      renderer.domElement.removeEventListener('webglcontextlost', verloren);
      mixer?.stopAllAction();
      taeterMixer?.stopAllAction();
      sammeln(scene); ressourcen.forEach(r => r.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, [auto, flucht, spur, drehung, welt, figurModell, fluechtigModell]);
  return <div className="jagd-canvas" ref={host} aria-label="Wimpy verfolgt den Fluchtwagen auf drei Spuren" />;
}

export function AutoJagd({ vorgabe, onFertig, autoId, besitz = {}, vorschau = false, fluechtigModell, onDrehung }: {
  vorgabe: VerfolgungVorgabe; onFertig: () => void; autoId?: string; besitz?: Record<string, number>; vorschau?: boolean;
  /**
   * Womit der Flüchtige bei der Verhaftung aussteigt.
   *
   * Vor dem Showdown ist das wichtig: Dort ist für den Gegner oft ein
   * eigenes Modell gewählt (größer, finsterer), und wer aus dem Wagen
   * steigt, muss derselbe sein, der gleich in der Arena steht. Leer heißt:
   * das Modell aus den Stammdaten.
   */
  fluechtigModell?: string;
  /** Nur in der Vorschau: die gefundene Drehung des Fluchtwagens zurückgeben. */
  onDrehung?: (grad: number) => void;
}) {
  const { autos, fehler: katalogFehler } = useAutos();
  const stammdaten = useStammdaten();
  const [wahl, setWahl] = useState(autoId ?? START_AUTO_ID);
  const [fluchtId, setFluchtId] = useState(vorgabe.fluchtAutoId ?? 'auto-sport');
  const [rennen, setRennen] = useState<{ auto: Auto; flucht: Auto } | null>(null);
  const [phase, setPhase] = useState<'bereit' | 'anfahrt' | 'jagd' | 'verhaftung' | 'gefangen' | 'entkommen'>('bereit');
  const [fehler, setFehler] = useState('');
  const [bereit, setBereit] = useState(false);
  const [stand, setStand] = useState({ speed: 0, abstand: ABSTAND_START, treffer: false });
  const [fluchtDrehung, setFluchtDrehung] = useState(vorgabe.fluchtDrehung ?? 0);
  const spur = useRef(0);
  const drehung = useRef(fluchtDrehung);
  // Die Verhaftung läuft in derselben Szene weiter: Wer sie abbricht, sähe
  // die Wagen nie halten.
  const faehrt = phase === 'anfahrt' || phase === 'jagd' || phase === 'verhaftung';
  const fliehender = stammdaten.charaktere.find(c => c.id === vorgabe.fliehenderId);
  // Am Straßenrand steht Wimpy in dem Modell, das ihm in den Stammdaten
  // zugeordnet ist - dasselbe wie in den 3D-Kapiteln.
  const figur = spielerModell(stammdaten.charaktere.find(c => c.istDetektiv));
  /*
   * Und wer im Fluchtwagen sitzt, steht erst am Ende der Jagd im Bild.
   *
   * Steht das Tier in den Stammdaten, gilt sein Modell - dasselbe wie in den
   * 3D-Kapiteln. In der Probe gibt es oft gar kein Tier; dann steigt
   * irgendwer aus, nur eben nicht Wimpy selbst.
   */
  const fluechtig = fliehender
    ? modellFuerTier(fliehender, 0, fluechtigModell)
    : ANIMATIONS_MODELLE.find(m => m.id === fluechtigModell)
      ?? ANIMATIONS_MODELLE.find(m => m.id !== figur?.id)
      ?? ANIMATIONS_MODELLE[0];
  const verfuegbar = autos.filter(a => vorschau || a.id === START_AUTO_ID || besitz[a.id]);
  /*
   * Die Strecke: Belag, Licht, Wetter, Bausteine.
   *
   * Im Spiel gilt, was in der Jagd steht. In der Vorschau darf man daran
   * drehen, ohne etwas zu speichern - deshalb liegt die Wahl daneben und
   * wird darübergelegt. Der Umweg über den Text hält die Szene ruhig: Ein
   * gleich aussehendes Objekt baut sonst bei jedem Bild die Welt neu auf.
   */
  const [weltWahl, setWeltWahl] = useState<Partial<JagdWelt>>({});
  const weltText = JSON.stringify(jagdWelt({ ...vorgabe, ...weltWahl }));
  const welt = useMemo(() => JSON.parse(weltText) as JagdWelt, [weltText]);
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
      {vorgabe.musik && (phase === 'jagd' || phase === 'verhaftung') && <Hintergrundmusik stueck={vorgabe.musik} />}
      <RennCanvas {...rennen} spur={spur} drehung={drehung} welt={welt} figur={figur} fluechtig={fluechtig} onBereit={() => setBereit(true)} onPhase={setPhase} onStand={(speed, abstand, treffer) => setStand({ speed, abstand, treffer })} onEnde={fang => setPhase(fang ? 'gefangen' : 'entkommen')} onFehler={setFehler} />
      {!bereit && <div className="auto-jagd-laden" role="status">Die Wagen werden bereitgestellt …</div>}
      {bereit && phase === 'anfahrt' && <div className="auto-jagd-anfahrt" role="status"><strong>{vorgabe.name}</strong><span>Tippen überspringt</span></div>}
      {phase === 'jagd' && <>
        <div className="auto-jagd-hud"><strong>WIMPY · {rennen.auto.name}</strong><span>{stand.speed} km/h · Abstand {stand.abstand} m</span>{stand.treffer && <b>REMPLER! TEMPO VERLOREN</b>}</div>
        <div className="auto-jagd-steuerung"><button aria-label="Eine Spur nach links" onClick={() => { spur.current = Math.max(-1, spur.current - 1); }}>◀</button><button aria-label="Eine Spur nach rechts" onClick={() => { spur.current = Math.min(1, spur.current + 1); }}>▶</button></div>
      </>}
      {/* Die Verhaftung spielt sich im Bild ab - hier steht nur, was gerade
          geschieht, und kein Knopf, den man dabei drücken müsste. */}
      {phase === 'verhaftung' && <div className="auto-jagd-verhaftung" role="status"><strong>GESTELLT!</strong><span>Quer über der Fahrbahn - und die Tür geht auf.</span><small>Tippen überspringt</small></div>}
      {vorschau && <div className="auto-jagd-drehen"><button type="button" onClick={() => drehen(-90)} aria-label="Fluchtwagen nach links drehen">↺</button><span>Fluchtwagen {fluchtDrehung}°</span><button type="button" onClick={() => drehen(90)} aria-label="Fluchtwagen nach rechts drehen">↻</button></div>}
    </> : <div className="jagd-start auto-jagd-auswahl"><article className="jagd-startkarte">
      <span className="jagd-kicker">WIMPY · PURSUIT</span><h1>{phase === 'gefangen' ? 'EINGEHOLT!' : phase === 'entkommen' ? 'ENTKOMMEN!' : vorgabe.name}</h1>
      {phase === 'gefangen' ? <><h2>{fliehender?.name ?? vorgabe.fliehenderId}</h2><blockquote>„{fluchtStatement(vorgabe)}“</blockquote><button className="knopf aktion" onClick={onFertig}>Weiter ›</button></> : <>
        <p>Drei Spuren. Weiche den Hindernissen aus und hole den Fluchtwagen ein. Pfeiltasten oder die großen Touch-Tasten wechseln die Spur.</p>
        {phase === 'entkommen' && <p>Der Wagen ist entwischt. Versuche es erneut oder wähle einen anderen Wagen aus deiner Garage.</p>}
        <label className="feld">Wimpys Wagen<select value={verfuegbar.some(a => a.id === wahl) ? wahl : verfuegbar[0]?.id ?? ''} onChange={e => setWahl(e.target.value)}>{verfuegbar.map(a => <option key={a.id} value={a.id}>{a.name} · {a.speed} km/h · +{a.beschleunigung} km/h/s</option>)}</select></label>
        {vorschau && <label className="feld">Fluchtwagen<select value={fluchtId} onChange={e => setFluchtId(e.target.value)}>{autos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {vorschau && <label className="feld">Fluchtwagen drehen<select value={fluchtDrehung} onChange={e => { const grad = Number(e.target.value); setFluchtDrehung(grad); drehung.current = grad; onDrehung?.(grad); }}>{[0, 90, 180, 270].map(grad => <option key={grad} value={grad}>{grad}°</option>)}</select></label>}
        {/* In der Probe lässt sich die ganze Strecke umbauen, ohne dass dafür
            etwas gespeichert werden muss: Belag, Licht, Wetter - und die
            Häuser, an denen man vorbeifährt. */}
        {vorschau && <>
          <label className="feld">Straße<select value={welt.strassentyp} onChange={e => setWeltWahl(alt => ({ ...alt, strassentyp: e.target.value as JagdWelt['strassentyp'] }))}>{DREI_D_STRASSENTYPEN.map(typ => <option key={typ.id} value={typ.id}>{typ.name}</option>)}</select></label>
          <label className="feld">Tageszeit<select value={welt.tageszeit} onChange={e => setWeltWahl(alt => ({ ...alt, tageszeit: e.target.value as JagdWelt['tageszeit'] }))}>{DREI_D_TAGESZEITEN.map(zeit => <option key={zeit.id} value={zeit.id}>{zeit.name}</option>)}</select></label>
          <label className="feld">Wetter<select value={welt.wetter} onChange={e => setWeltWahl(alt => ({ ...alt, wetter: e.target.value as JagdWelt['wetter'] }))}>{DREI_D_WETTER.map(lage => <option key={lage.id} value={lage.id}>{lage.name}</option>)}</select></label>
          <span className="leise klein">Bausteine am Straßenrand · höchstens drei</span>
          <div className="marken-reihe">
            {DREI_D_LOCATIONS.map(ort => {
              const aktiv = welt.locations.includes(ort.id);
              return <button
                key={ort.id}
                type="button"
                className="marke-knopf"
                data-aktiv={aktiv}
                onClick={() => setWeltWahl(alt => {
                  const bisher = alt.locations ?? welt.locations;
                  return {
                    ...alt,
                    locations: aktiv
                      ? bisher.filter(id => id !== ort.id)
                      : [...bisher, ort.id].slice(-3),
                  };
                })}
              >{ort.name}</button>;
            })}
          </div>
        </>}
        {(fehler || katalogFehler) && <p role="alert">{fehler || katalogFehler}</p>}
        <button className="knopf aktion" onClick={starten}>Verfolgung starten ›</button>
      </>}
    </article></div>}
  </div>;
}
