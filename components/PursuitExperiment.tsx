"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { laufAnimation } from "@/lib/pursuit";
import { ruheAuswahl } from "@/lib/tiermodelle";
import { TOKYO_FASSADEN } from "@/lib/pursuit3d";

type Richtung = { x: number; z: number };
type NpcInfo = { id: string; name: string };

function gradientTextur() {
  const textur = new THREE.DataTexture(new Uint8Array([42, 42, 42, 155, 155, 155, 255, 255, 255]), 3, 1, THREE.RedFormat);
  textur.needsUpdate = true;
  textur.magFilter = THREE.NearestFilter;
  textur.minFilter = THREE.NearestFilter;
  return textur;
}

function cellShading(objekt: THREE.Object3D, gradient: THREE.Texture) {
  objekt.traverse((kind) => {
    if (!(kind instanceof THREE.Mesh)) return;
    kind.castShadow = true;
    kind.receiveShadow = true;
    const mehrfach = Array.isArray(kind.material);
    const materialien: THREE.Material[] = mehrfach ? kind.material : [kind.material];
    const toon = materialien.map((material) => {
      const quelle = material as THREE.MeshStandardMaterial;
      return new THREE.MeshToonMaterial({
        color: quelle.color?.clone() ?? new THREE.Color(0xffffff),
        map: quelle.map ?? null,
        gradientMap: gradient,
        transparent: quelle.transparent,
        opacity: quelle.opacity,
        alphaTest: quelle.alphaTest,
        side: quelle.side,
      });
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

function ExperimentCanvas({
  steuerung,
  onNaehe,
  onBereit,
}: {
  steuerung: MutableRefObject<Richtung>;
  onNaehe: (npc: NpcInfo | null) => void;
  onBereit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onNaehe, onBereit });
  callbacks.current = { onNaehe, onBereit };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b1c);
    scene.fog = new THREE.Fog(0x141329, 18, 54);
    const gradient = gradientTextur();
    const camera = new THREE.PerspectiveCamera(46, Math.max(320, element.clientWidth) / Math.max(360, element.clientHeight), 0.1, 100);
    camera.position.set(-8.4, 4.35, 11.2);
    camera.lookAt(0, 1.1, 0.8);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return;
    }
    renderer.setSize(Math.max(320, element.clientWidth), Math.max(360, element.clientHeight));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.toneMappingExposure = 0.86;
    element.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x728cff, 0x140c2e, 1.9));
    const licht = new THREE.DirectionalLight(0x84dfff, 2.5);
    licht.position.set(-7, 12, 8);
    licht.castShadow = true;
    scene.add(licht);
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 54),
      new THREE.MeshToonMaterial({ color: 0x202536, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = -2;
    boden.receiveShadow = true;
    scene.add(boden);
    for (let i = 0; i < 12; i++) {
      const strich = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 1.6), new THREE.MeshBasicMaterial({ color: 0x71e8ff }));
      strich.position.set(0, 0.03, i * 4 - 24);
      scene.add(strich);
    }
    for (let i = 0; i < 10; i++) {
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.3 + (i % 3) * 0.55, 0.12),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff357f : 0x35dfff }),
      );
      neon.position.set(5.2, 1.5, i * 5.4 - 24);
      scene.add(neon);
    }

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const spieler = new THREE.Group();
    scene.add(spieler);
    const npcGruppen: { gruppe: THREE.Group; info: NpcInfo }[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    let spielerMixer: THREE.AnimationMixer | null = null;
    let laufAktion: THREE.AnimationAction | null = null;
    let ruheAktion: THREE.AnimationAction | null = null;
    let aktiveAktion: THREE.AnimationAction | null = null;
    let letzterNpc = "";
    const wimpy = ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy" || modell.name.toLowerCase() === "wimpy");
    const andere = ANIMATIONS_MODELLE.filter((modell) => modell.id !== wimpy?.id);

    const figurLaden = async (modell: AnimationsModell, hoehe: number) => {
      const gltf = await loader.loadAsync(modell.datei);
      const figur = gltf.scene;
      cellShading(figur, gradient);
      einpassen(figur, hoehe);
      return { figur, animationen: gltf.animations };
    };

    const aufbauen = async () => {
      const kulissen = await Promise.allSettled(TOKYO_FASSADEN.map((datei) => loader.loadAsync(datei)));
      if (beendet) return;
      const vorlagen = kulissen.flatMap((ergebnis) => {
        if (ergebnis.status !== "fulfilled") return [];
        const vorlage = ergebnis.value.scene;
        cellShading(vorlage, gradient);
        einpassen(vorlage, 10.66);
        vorlage.rotation.y = -Math.PI / 2;
        return [vorlage];
      });
      for (let i = 0; i < 5 && vorlagen.length; i++) {
        const block = new THREE.Group();
        block.add(vorlagen[i % vorlagen.length].clone(true));
        block.position.set(7.25, 0, i * 15.5 - 30);
        scene.add(block);
      }

      if (wimpy) {
        const geladen = await figurLaden(wimpy, 2.05);
        if (beendet) return;
        spieler.add(geladen.figur);
        spielerMixer = new THREE.AnimationMixer(geladen.figur);
        laufAktion = spielerMixer.clipAction(geladen.animationen.find((clip) => clip.name === laufAnimation(geladen.animationen.map((clip) => clip.name))) ?? geladen.animationen[0]);
        const ruheClip = ruheAuswahl(geladen.animationen)[0];
        if (ruheClip) ruheAktion = spielerMixer.clipAction(ruheClip);
        aktiveAktion = ruheAktion ?? laufAktion;
        aktiveAktion?.play();
      }

      const npcErgebnisse = await Promise.allSettled(andere.map((modell) => figurLaden(modell, 1.8)));
      if (beendet) return;
      const positionen = [
        new THREE.Vector3(3.1, 0, -5.5),
        new THREE.Vector3(-3.3, 0, -10),
        new THREE.Vector3(3.4, 0, -15),
        new THREE.Vector3(-2.8, 0, 5),
        new THREE.Vector3(3.2, 0, 9),
      ];
      npcErgebnisse.forEach((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return;
        const modell = andere[index];
        const gruppe = new THREE.Group();
        gruppe.add(ergebnis.value.figur);
        gruppe.position.copy(positionen[index % positionen.length]);
        gruppe.rotation.y = index % 2 ? Math.PI * 0.75 : -Math.PI * 0.35;
        scene.add(gruppe);
        npcGruppen.push({ gruppe, info: { id: modell.id, name: modell.name } });
        const mixer = new THREE.AnimationMixer(ergebnis.value.figur);
        // Jedes Tier bekommt einen anderen Leerlauf, wo das Modell mehrere
        // hat - sonst steht die ganze Reihe im Gleichschritt.
        const ruhen = ruheAuswahl(ergebnis.value.animationen);
        const clip = ruhen[index % Math.max(1, ruhen.length)] ?? ergebnis.value.animationen[0];
        if (clip) mixer.clipAction(clip).play();
        mixers.push(mixer);
      });
      callbacks.current.onBereit();
    };
    void aufbauen();

    const tasten = new Set<string>();
    const runter = (event: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(event.key.toLowerCase())) event.preventDefault();
      tasten.add(event.key.toLowerCase());
    };
    const hoch = (event: KeyboardEvent) => tasten.delete(event.key.toLowerCase());
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);

    let letzter = performance.now();
    const zielKamera = new THREE.Vector3();
    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      const tastaturX = (tasten.has("d") || tasten.has("arrowright") ? 1 : 0) - (tasten.has("a") || tasten.has("arrowleft") ? 1 : 0);
      const tastaturZ = (tasten.has("s") || tasten.has("arrowdown") ? 1 : 0) - (tasten.has("w") || tasten.has("arrowup") ? 1 : 0);
      const x = THREE.MathUtils.clamp(tastaturX || steuerung.current.x, -1, 1);
      const z = THREE.MathUtils.clamp(tastaturZ || steuerung.current.z, -1, 1);
      const bewegt = Math.abs(x) + Math.abs(z) > 0.05;
      if (bewegt) {
        const laenge = Math.hypot(x, z) || 1;
        spieler.position.x = THREE.MathUtils.clamp(spieler.position.x + (x / laenge) * dt * 4.1, -4.7, 4.7);
        spieler.position.z = THREE.MathUtils.clamp(spieler.position.z + (z / laenge) * dt * 4.1, -20, 17);
        spieler.rotation.y = Math.atan2(x, z);
      }
      const gewuenscht = bewegt ? laufAktion : (ruheAktion ?? laufAktion);
      if (gewuenscht && gewuenscht !== aktiveAktion) {
        aktiveAktion?.fadeOut(0.14);
        gewuenscht.reset().fadeIn(0.14).play();
        aktiveAktion = gewuenscht;
      }
      spielerMixer?.update(dt);
      mixers.forEach((mixer) => mixer.update(dt));
      let nah: { gruppe: THREE.Group; info: NpcInfo } | null = null;
      let abstand = 2.45;
      npcGruppen.forEach((npc) => {
        const distanz = npc.gruppe.position.distanceTo(spieler.position);
        if (distanz < abstand) { abstand = distanz; nah = npc; }
      });
      const npcId = (nah as { info: NpcInfo } | null)?.info.id ?? "";
      if (npcId !== letzterNpc) {
        letzterNpc = npcId;
        callbacks.current.onNaehe((nah as { info: NpcInfo } | null)?.info ?? null);
      }
      zielKamera.set(spieler.position.x - 8.4, 4.35, spieler.position.z + 11.2);
      camera.position.lerp(zielKamera, 0.08);
      camera.lookAt(spieler.position.x, 1.1, spieler.position.z + 0.8);
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
    window.addEventListener("resize", groesse);
    return () => {
      beendet = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("resize", groesse);
      const geometrien = new Set<THREE.BufferGeometry>();
      const materialien = new Set<THREE.Material>();
      scene.traverse((objekt) => {
        if (!(objekt instanceof THREE.Mesh)) return;
        geometrien.add(objekt.geometry);
        (Array.isArray(objekt.material) ? objekt.material : [objekt.material]).forEach((material) => materialien.add(material));
      });
      geometrien.forEach((geometrie) => geometrie.dispose());
      materialien.forEach((material) => material.dispose());
      gradient.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [steuerung]);

  return <div className="jagd-canvas" ref={host} aria-label="Freier 3D-Testbereich mit Wimpy" />;
}

const TESTSAETZE = [
  "Tokyo ist heute ungewöhnlich still. Das gefällt mir überhaupt nicht.",
  "Ich habe hinter der nächsten Häuserfront etwas rascheln hören.",
  "Du steuerst schon erstaunlich gut für einen ersten 3D-Test, Wimpy.",
  "Später könnte hier ein echtes Saga-Geheimnis auf dich warten.",
];

export function PursuitExperiment({ onZurueck, onSchliessen }: { onZurueck: () => void; onSchliessen: () => void }) {
  const steuerung = useRef<Richtung>({ x: 0, z: 0 });
  const [nah, setNah] = useState<NpcInfo | null>(null);
  const [dialog, setDialog] = useState<{ name: string; text: string } | null>(null);
  const [bereit, setBereit] = useState(false);
  const setzen = (x: number, z: number) => { steuerung.current = { x, z }; };
  const stoppen = () => setzen(0, 0);

  return (
    <div className="jagd pursuit-spiel experiment-spiel">
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <ExperimentCanvas steuerung={steuerung} onNaehe={setNah} onBereit={() => setBereit(true)} />
      <header className="experiment-hud">
        <span className="jagd-kicker">EXPERIMENT III · 3D-SAGA-LABOR</span>
        <strong>WIMPY IN TOKYO</strong>
        <small>{bereit ? "Finde die anderen Tiere und sprich sie an." : "Tokyo und seine Bewohner werden geladen …"}</small>
      </header>
      <button className="pursuit-zurueck experiment-zurueck" onClick={onZurueck}>‹ Modi</button>
      <div className="experiment-steuerkreuz" aria-label="Wimpy steuern">
        <button onPointerDown={() => setzen(0, -1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▲</button>
        <button onPointerDown={() => setzen(-1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>◀</button>
        <button onPointerDown={() => setzen(1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>▶</button>
        <button onPointerDown={() => setzen(0, 1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▼</button>
      </div>
      {nah && !dialog && (
        <button className="experiment-ansprechen" onClick={() => setDialog({ name: nah.name, text: TESTSAETZE[Math.abs(nah.id.length * 7) % TESTSAETZE.length] })}>
          <small>IN DER NÄHE</small><strong>{nah.name} ANSPRECHEN</strong>
        </button>
      )}
      {dialog && (
        <article className="experiment-dialog">
          <span className="jagd-kicker">{dialog.name}</span>
          <p>„{dialog.text}“</p>
          <button className="knopf aktion" onClick={() => setDialog(null)}>Weiter</button>
        </article>
      )}
    </div>
  );
}
