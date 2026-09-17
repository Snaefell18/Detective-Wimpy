"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { abspannModelle, abspannWelt, type AbspannVorgabe } from "@/lib/abspann";
import { AUTO_MODELLE, autoLaenge, type Auto } from "@/lib/autos";
import { useAutos } from "@/lib/useAutos";
import { tonQuelle } from "@/lib/stimme";
import type { JagdWelt } from "@/lib/verfolgung";
import { einpassen, gradientTextur } from "./stadtBau";
import { haeuserZeilen, strasseBauen } from "./strassenWelt";

/**
 * Der Abspann als Straßenfahrt.
 *
 * Zwei Tiere stehen am Straßenrand, gehen zu ihrem Wagen, steigen ein und
 * fahren los - und dann fahren sie einfach, solange der Song läuft. Rechts
 * zieht die Stadt vorbei, dieselbe wie in der Verfolgungsjagd; nur jagt hier
 * niemand jemanden. Ist der letzte Ton verklungen, blendet das Bild auf
 * Schwarz und die Saga darf enden.
 *
 * Der Anfang ist bewusst derselbe wie vor der Jagd (components/AutoJagd.tsx):
 * dieselben Plätze, dieselben Zeiten, dieselbe Kamerafahrt. Wer zwei Stunden
 * lang Wimpy zu seinem Wagen hat gehen sehen, soll ihn am Ende genauso gehen
 * sehen.
 */

/** Wo der Wagen wartet und wo die beiden danebenstehen. */
const PARKPLATZ = { x: -6.6, z: 0.8, winkel: -0.42 };
const STANDPLAETZE = [
  { x: -10, z: 3 },
  { x: -9.2, z: 1 },
];
/** Die Türen, in denen die beiden verschwinden. */
const TUEREN = [
  { x: PARKPLATZ.x - 0.9, z: PARKPLATZ.z + 0.5 },
  { x: PARKPLATZ.x - 0.4, z: PARKPLATZ.z - 0.9 },
];

/** Der Ablauf des Anfangs in Sekunden - wie vor der Jagd. */
const ANFAHRT = { losgehen: 1.4, einsteigen: 4.6, losfahren: 6.4 };

/** Die Kamera: erst schräg auf den Straßenrand, dann neben den Wagen. */
const KAMERA_START = { pos: [-17.5, 4.6, 14.5], ziel: [-5.2, 1.2, 1.0], fov: 58 } as const;
const KAMERA_FAHRT = { pos: [-12.6, 7.3, 18.8], ziel: [0, 0.8, 4], fov: 46 } as const;

/** Wie schnell der Wagen im Abspann fährt - gemütlich, es jagt ja niemand. */
const TEMPO = 74;

/** Die letzten Sekunden gehen auf Schwarz. */
const BLENDE = 3;

/** So lange steht der Titel im Bild, danach gehört es der Straße. */
const TITEL_ZEIT = 11;

const weich = (t: number) => t * t * (3 - 2 * t);

/** Räder, die sich wirklich drehen können - falls das Modell welche mitbringt. */
const RAD_NAME = /wheel|rad\b|reifen|tyre|tire|felge/i;

function AbspannCanvas({
  auto,
  welt,
  modelle,
  laeuft,
  onBereit,
  onFehler,
}: {
  auto: Auto;
  welt: JagdWelt;
  modelle: AnimationsModell[];
  /** Solange das false ist, steht alles still - der Song wartet noch. */
  laeuft: React.MutableRefObject<boolean>;
  onBereit: () => void;
  onFehler: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onBereit, onFehler });
  callbacks.current = { onBereit, onFehler };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;

    const scene = new THREE.Scene();

    /* --- Aufräumen: alles, was Speicher hält, kommt hier hinein ------- */
    const ressourcen = new Set<{ dispose: () => void }>();
    const merken = (wert: { dispose: () => void }) => ressourcen.add(wert);
    const sammeln = (wurzel: THREE.Object3D) => wurzel.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      ressourcen.add(obj.geometry);
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        ressourcen.add(material);
        for (const wert of Object.values(material)) {
          if (wert instanceof THREE.Texture) ressourcen.add(wert);
        }
      }
    });

    /** Alles, was mit der Straße nach hinten wandert. */
    const ziehendes: { obj: THREE.Object3D; ende: number; sprung: number }[] = [];
    const zieht = (obj: THREE.Object3D, ende: number, sprung: number) => {
      ziehendes.push({ obj, ende, sprung });
      return obj;
    };

    const gradient = gradientTextur();
    merken(gradient);
    const strasse = strasseBauen({
      scene,
      welt,
      gradient,
      merken,
      zieht,
      // Wo die beiden auf ihren Wagen warten, steht nichts im Bild.
      freiHalten: (x, z) => x < -5 && z > -6 && z < 10,
    });

    const camera = new THREE.PerspectiveCamera(KAMERA_START.fov, 1, 0.1, 130);
    camera.position.set(...KAMERA_START.pos);
    camera.lookAt(...KAMERA_START.ziel);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      callbacks.current.onFehler("3D konnte nicht gestartet werden.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = strasse.belichtung;
    element.appendChild(renderer.domElement);

    /* --- Wagen und Mitfahrer ----------------------------------------- */
    const wagen = new THREE.Group();
    wagen.position.set(PARKPLATZ.x, 0, PARKPLATZ.z);
    wagen.rotation.y = PARKPLATZ.winkel;
    scene.add(wagen);
    const raeder: THREE.Object3D[] = [];

    type Mitfahrer = {
      gruppe: THREE.Group;
      mixer: THREE.AnimationMixer | null;
      stehen: THREE.AnimationAction | null;
      gehen: THREE.AnimationAction | null;
      geht: boolean;
      start: { x: number; z: number };
      tuer: { x: number; z: number };
    };
    const mitfahrer: Mitfahrer[] = STANDPLAETZE.map((platz, i) => {
      const gruppe = new THREE.Group();
      gruppe.position.set(platz.x, 0, platz.z);
      // Die Figuren schauen bei rotation.y = 0 nach +z; hier zur Straße.
      gruppe.rotation.y = Math.PI / 2;
      scene.add(gruppe);
      return {
        gruppe,
        mixer: null,
        stehen: null,
        gehen: null,
        geht: false,
        start: platz,
        tuer: TUEREN[i] ?? TUEREN[0],
      };
    });

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    async function wagenLaden() {
      const modell = AUTO_MODELLE.find((m) => m.id === auto.modell);
      if (!modell) throw new Error("Automodell fehlt.");
      const gltf = await loader.loadAsync(modell.datei);
      sammeln(gltf.scene);
      if (beendet) return;
      const obj = gltf.scene;
      obj.rotation.y = THREE.MathUtils.degToRad(auto.drehung);
      obj.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(obj);
      const groesse = box.getSize(new THREE.Vector3());
      obj.scale.multiplyScalar(autoLaenge(auto, 3.5) / Math.max(groesse.x, groesse.z, 0.001));
      obj.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(obj);
      const mitte = box.getCenter(new THREE.Vector3());
      obj.position.set(-mitte.x, -box.min.y, -mitte.z);
      wagen.add(obj);
      obj.traverse((teil) => {
        if (RAD_NAME.test(teil.name)) raeder.push(teil);
      });
    }

    /**
     * Die beiden Tiere - genau wie Wimpy vor der Jagd.
     *
     * Ein Ladefehler darf den Abspann nicht aufhalten: Fehlt ein Modell,
     * steigt eben nur einer ein, und wenn beide fehlen, fährt der Wagen von
     * selbst los. Musik und Bild laufen weiter.
     */
    async function figurLaden(modell: AnimationsModell | undefined, wer: Mitfahrer) {
      if (!modell) return;
      const gltf = await loader.loadAsync(modell.datei);
      sammeln(gltf.scene);
      if (beendet) return;
      const figur = gltf.scene;
      einpassen(figur, 1.7);
      wer.gruppe.add(figur);
      const mixer = new THREE.AnimationMixer(figur);
      wer.mixer = mixer;
      const ruhe = gltf.animations.find((c) => /idle|rest/i.test(c.name)) ?? gltf.animations[0];
      const geh =
        gltf.animations.find((c) => /walk/i.test(c.name)) ??
        gltf.animations.find((c) => /run/i.test(c.name));
      wer.stehen = ruhe ? mixer.clipAction(ruhe) : null;
      wer.gehen = geh ? mixer.clipAction(geh) : null;
      wer.stehen?.play();
    }

    void wagenLaden()
      .then(async () => {
        if (!beendet) callbacks.current.onBereit();
        await Promise.allSettled(
          mitfahrer.map((wer, i) => figurLaden(modelle[i], wer)),
        );
        await haeuserZeilen({
          scene,
          welt,
          gradient,
          loader,
          sammeln,
          zieht,
          abgebrochen: () => beendet,
        }).catch(() => undefined);
      })
      .catch(() => {
        if (!beendet) callbacks.current.onFehler("Der Wagen für den Abspann fehlt.");
      });

    /* --- Der Ablauf --------------------------------------------------- */
    let zeit = 0;
    let letzter = performance.now();
    let tempo = 0;

    const weltBewegen = (weg: number, dt: number) => {
      for (const teil of ziehendes) {
        teil.obj.position.z -= weg;
        if (teil.obj.position.z < teil.ende) teil.obj.position.z += teil.sprung;
      }
      strasse.wetterfall?.bewegen(dt, performance.now(), weg);
      for (const rad of raeder) rad.rotation.x -= weg * 1.6;
    };

    const zeichnen = (jetzt: number) => {
      const rohDt = (jetzt - letzter) / 1000;
      letzter = jetzt;
      if (!element.clientWidth || !element.clientHeight || document.hidden) {
        frame = requestAnimationFrame(zeichnen);
        return;
      }
      /*
       * Großzügiger als im Kampf: Dort hält eine Obergrenze das Spiel fair,
       * hier läuft die Musik nebenher weiter. Wer die Bilder deckelt, hat am
       * Ende einen Wagen, der noch parkt, während der Song schon verklingt.
       */
      const dt = laeuft.current ? Math.min(0.25, Math.max(0.001, rohDt)) : 0;
      zeit += dt;

      for (const wer of mitfahrer) wer.mixer?.update(dt);

      if (zeit < ANFAHRT.losfahren) {
        /* Der Anfang: hingehen, einsteigen, anfahren. */
        const schritt = THREE.MathUtils.clamp(
          (zeit - ANFAHRT.losgehen) / (ANFAHRT.einsteigen - ANFAHRT.losgehen),
          0,
          1,
        );
        for (const wer of mitfahrer) {
          if (zeit <= ANFAHRT.losgehen) continue;
          if (!wer.geht) {
            wer.geht = true;
            wer.stehen?.fadeOut(0.25);
            wer.gehen?.reset().fadeIn(0.25).play();
          }
          wer.gruppe.position.x = THREE.MathUtils.lerp(wer.start.x, wer.tuer.x, weich(schritt));
          wer.gruppe.position.z = THREE.MathUtils.lerp(wer.start.z, wer.tuer.z, weich(schritt));
          // Er geht dorthin, wo er hinschaut: Modelle blicken bei 0 nach +z.
          wer.gruppe.rotation.y = Math.atan2(
            wer.tuer.x - wer.start.x,
            wer.tuer.z - wer.start.z,
          );
          // Zum Schluss verschwindet er in der Kabine.
          const rein = THREE.MathUtils.clamp((schritt - 0.75) / 0.25, 0, 1);
          wer.gruppe.scale.setScalar(Math.max(0.001, 1 - rein));
          wer.gruppe.visible = rein < 1;
        }

        const anfahren = weich(
          THREE.MathUtils.clamp(
            (zeit - ANFAHRT.einsteigen) / (ANFAHRT.losfahren - ANFAHRT.einsteigen),
            0,
            1,
          ),
        );
        wagen.position.x = THREE.MathUtils.lerp(PARKPLATZ.x, 0, anfahren);
        wagen.position.z = THREE.MathUtils.lerp(PARKPLATZ.z, 0, anfahren);
        wagen.rotation.y = THREE.MathUtils.lerp(PARKPLATZ.winkel, 0, anfahren);
        camera.position.set(
          THREE.MathUtils.lerp(KAMERA_START.pos[0], KAMERA_FAHRT.pos[0], anfahren),
          THREE.MathUtils.lerp(KAMERA_START.pos[1], KAMERA_FAHRT.pos[1], anfahren),
          THREE.MathUtils.lerp(KAMERA_START.pos[2], KAMERA_FAHRT.pos[2], anfahren),
        );
        camera.lookAt(
          THREE.MathUtils.lerp(KAMERA_START.ziel[0], KAMERA_FAHRT.ziel[0], anfahren),
          THREE.MathUtils.lerp(KAMERA_START.ziel[1], KAMERA_FAHRT.ziel[1], anfahren),
          THREE.MathUtils.lerp(KAMERA_START.ziel[2], KAMERA_FAHRT.ziel[2], anfahren),
        );
        camera.fov = THREE.MathUtils.lerp(KAMERA_START.fov, KAMERA_FAHRT.fov, anfahren);
        camera.updateProjectionMatrix();
        tempo = TEMPO * 0.45 * anfahren;
      } else {
        /* Und dann fahren sie einfach. */
        for (const wer of mitfahrer) wer.gruppe.visible = false;
        wagen.position.set(0, 0, 0);
        wagen.rotation.y = 0;
        tempo += (TEMPO - tempo) * Math.min(1, dt * 0.6);
        camera.position.set(...KAMERA_FAHRT.pos);
        /*
         * Ein ganz langsames Pendeln, damit das Bild nicht steht: Der Wagen
         * bleibt in der Mitte, die Straße zieht, und die Kamera atmet.
         */
        camera.position.x += Math.sin(zeit * 0.24) * 1.6;
        camera.position.y += Math.sin(zeit * 0.17) * 0.5;
        camera.lookAt(KAMERA_FAHRT.ziel[0], KAMERA_FAHRT.ziel[1], KAMERA_FAHRT.ziel[2]);
        camera.fov = KAMERA_FAHRT.fov;
        camera.updateProjectionMatrix();
      }

      weltBewegen((tempo / 3.6) * dt, dt);
      // Der Blizzard zieht die Sicht zu wie überall sonst auch.
      if (strasse.blizzard && scene.fog instanceof THREE.Fog) {
        const faktor = strasse.wetterfall?.sicht(jetzt) ?? 1;
        scene.fog.near = strasse.sichtNah * faktor;
        scene.fog.far = strasse.sichtFern * faktor;
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
    const kontextVerloren = (e: Event) => {
      e.preventDefault();
      callbacks.current.onFehler("Die Grafik wurde unterbrochen.");
    };
    renderer.domElement.addEventListener("webglcontextlost", kontextVerloren);

    return () => {
      beendet = true;
      cancelAnimationFrame(frame);
      beobachter.disconnect();
      for (const wer of mitfahrer) wer.mixer?.stopAllAction();
      sammeln(scene);
      ressourcen.forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", kontextVerloren);
      renderer.domElement.remove();
    };
    // Die Straße wird einmal gebaut; alles Weitere läuft über die Uhr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.id, auto.modell, auto.drehung, auto.groesse, JSON.stringify(welt), modelle.map((m) => m.id).join()]);

  return <div className="jagd-canvas abspann-canvas" ref={host} aria-label="Der Abspann: eine Fahrt durch die Stadt" />;
}

/**
 * Der Abspann mit allem drum herum: Song, Titel, Blende und Schlussknopf.
 *
 * Die Uhr ist der Song. Kann der Browser ihn nicht abspielen (blockierter Ton,
 * fehlende Datei), läuft der Abspann trotzdem - dann eben nach einer festen
 * Zeit. Am Ende steht immer derselbe Knopf, und niemand bleibt hängen.
 */
export function StrassenCredits({
  vorgabe,
  titel,
  weiterText = "Saga beenden ›",
  onFertig,
}: {
  vorgabe: AbspannVorgabe;
  titel: string;
  weiterText?: string;
  onFertig: () => void;
}) {
  const { autos } = useAutos();
  const [fortschritt, setFortschritt] = useState(0);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState("");
  const [startNoetig, setStartNoetig] = useState(false);
  const laeuft = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const welt = abspannWelt(vorgabe);
  const modellIds = abspannModelle(vorgabe);
  const modelle = modellIds.map(
    (id) => ANIMATIONS_MODELLE.find((modell) => modell.id === id) ?? ANIMATIONS_MODELLE[0],
  );
  const auto = autos.find((a) => a.id === vorgabe.autoId) ?? autos[0];

  /** Ohne Song (oder ohne Ton) fährt der Abspann diese Zeit lang. */
  const STUMME_DAUER = 50;

  /*
   * Die Uhr des Abspanns ist der Song.
   *
   * Sie beginnt, wenn er wirklich spielt - bis dahin stehen die beiden noch
   * am Straßenrand, und Musik und Bild fangen gemeinsam an. Kann der Browser
   * ihn nicht abspielen (blockierter Ton, fehlende Datei, eine Aufnahme aus
   * der Datenbank, die nicht kommt), läuft der Abspann trotzdem: dann eben
   * nach der Wanduhr. Hängenbleiben darf er nie.
   */
  useEffect(() => {
    let aktiv = true;
    let bild = 0;
    let start = 0;
    laeuft.current = false;

    const losgehen = () => {
      if (!aktiv || start) return;
      start = performance.now();
      laeuft.current = true;
    };
    // Die Notbremse: Bleibt das Abspielversprechen liegen (das kommt auf iOS
    // vor, wenn die App dabei in den Hintergrund geht), fährt der Wagen
    // trotzdem los.
    const notbremse = window.setTimeout(losgehen, 3000);

    const tick = () => {
      if (!aktiv) return;
      const audio = audioRef.current;
      const dauer =
        audio && Number.isFinite(audio.duration) && audio.duration > 1
          ? audio.duration
          : STUMME_DAUER;
      if (start) {
        // Nur vorwärts: Die Wanduhr führt, die Aufnahme darf nachhelfen.
        const vergangen = Math.max((performance.now() - start) / 1000, audio?.currentTime ?? 0);
        setFortschritt(Math.min(1, vergangen / dauer));
      }
      bild = requestAnimationFrame(tick);
    };

    void tonQuelle(vorgabe.song)
      .then((quelle) => {
        if (!aktiv) return;
        if (!quelle) {
          losgehen();
          return;
        }
        const audio = new Audio(quelle);
        audioRef.current = audio;
        audio.preload = "auto";
        audio.addEventListener("ended", () => {
          if (aktiv) setFortschritt(1);
        });
        void audio.play().then(losgehen, () => {
          // Blockierter Ton: Die Fahrt beginnt trotzdem, und ein Knopf holt
          // die Musik nach.
          if (!aktiv) return;
          setStartNoetig(true);
          losgehen();
        });
      })
      .catch(() => losgehen());

    bild = requestAnimationFrame(tick);
    return () => {
      aktiv = false;
      cancelAnimationFrame(bild);
      window.clearTimeout(notbremse);
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // Der Song ist die Uhr - wechselt er, beginnt alles von vorn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgabe.song]);

  // Die letzten Sekunden gehen auf Schwarz, danach steht nur noch der Knopf.
  const dauer = audioRef.current?.duration;
  const gesamt = Number.isFinite(dauer) && (dauer ?? 0) > 1 ? (dauer as number) : STUMME_DAUER;
  const blende = Math.min(1, Math.max(0, (fortschritt - (gesamt - BLENDE) / gesamt) / (BLENDE / gesamt)));
  const vorbei = fortschritt >= 1;

  const nachholen = () => {
    const audio = audioRef.current;
    setStartNoetig(false);
    // Von vorn: Ein Abspann, der in der Mitte einsetzt, ist keiner.
    if (audio) audio.currentTime = 0;
    void audio?.play().catch(() => setStartNoetig(true));
  };

  return (
    <div className="jagd abspann" data-vorbei={vorbei || undefined}>
      {auto ? (
        <AbspannCanvas
          auto={auto}
          welt={welt}
          modelle={modelle}
          laeuft={laeuft}
          onBereit={() => setBereit(true)}
          onFehler={setFehler}
        />
      ) : (
        <div className="auto-jagd-laden" role="status">Für den Abspann fehlt ein Wagen.</div>
      )}

      {!bereit && !fehler && <div className="auto-jagd-laden" role="status">Der Abspann wird vorbereitet …</div>}

      {/* Der Titel steht die ersten Sekunden im Bild und zieht sich dann
          zurück - nach Sekunden, nicht nach Anteilen: Bei einem langen Song
          stünde er sonst minutenlang da. */}
      <div className="abspann-titel" data-weg={fortschritt * gesamt > TITEL_ZEIT || undefined}>
        <span className="intro-oberzeile">Detective Wimpy</span>
        <strong>{titel}</strong>
      </div>

      {/* Die Blende: Sie liegt über allem und wird zum Schluss undurchsichtig. */}
      <div className="abspann-blende" style={{ opacity: vorbei ? 1 : blende }} />

      <div className="abspann-leiste">
        {startNoetig && (
          <button className="intro-ton" onClick={nachholen}>🔈 Musik an</button>
        )}
        {!vorbei && (
          <button className="intro-skip" onClick={onFertig}>Überspringen ›</button>
        )}
      </div>

      {(vorbei || fehler) && (
        <div className="abspann-ende">
          {fehler && <p className="leise">{fehler}</p>}
          <strong className="abspann-ende-wort">Ende</strong>
          <button className="knopf aktion" onClick={onFertig}>{weiterText}</button>
        </div>
      )}
    </div>
  );
}
