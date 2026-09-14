"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import {
  PURSUIT_STATEMENTS,
  laufAnimation,
  pursuitAuswahlGueltig,
  pursuitStartauswahl,
  zufaelligeIntroAnimation,
} from "@/lib/pursuit";
import { mutFlascheBauen } from "@/components/Verfolgungsjagd";
import { PursuitJumpNRun } from "@/components/PursuitJumpNRun";

type Phase = "auswahl" | "intro" | "jagd" | "gefangen";
type Auswahl = [string, string, string];

const modellVon = (id: string) => ANIMATIONS_MODELLE.find((modell) => modell.id === id);

function gradientTextur() {
  const gradient = new THREE.DataTexture(
    new Uint8Array([48, 48, 48, 155, 155, 155, 255, 255, 255]),
    3,
    1,
    THREE.RedFormat,
  );
  gradient.needsUpdate = true;
  gradient.magFilter = THREE.NearestFilter;
  gradient.minFilter = THREE.NearestFilter;
  return gradient;
}

function toonMaterialien(objekt: THREE.Object3D, gradient: THREE.Texture) {
  objekt.traverse((kind) => {
    if (!(kind instanceof THREE.Mesh)) return;
    kind.castShadow = true;
    kind.receiveShadow = true;
    const warMehrteilig = Array.isArray(kind.material);
    const original: THREE.Material[] = warMehrteilig ? kind.material : [kind.material];
    const neu = original.map((material) => {
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
    kind.material = warMehrteilig ? neu : neu[0];
  });
}

function einpassen(objekt: THREE.Object3D, zielhoehe: number) {
  objekt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(objekt);
  const groesse = box.getSize(new THREE.Vector3());
  const skala = zielhoehe / Math.max(0.001, groesse.y);
  objekt.scale.multiplyScalar(skala);
  objekt.updateMatrixWorld(true);
  const neu = new THREE.Box3().setFromObject(objekt);
  const mitte = neu.getCenter(new THREE.Vector3());
  objekt.position.x -= mitte.x;
  objekt.position.y -= neu.min.y;
  objekt.position.z -= mitte.z;
}

function bodenUndLicht(scene: THREE.Scene, gradient: THREE.Texture, jagd: boolean) {
  scene.add(new THREE.HemisphereLight(0xf7ffff, 0x3b6179, 2.8));
  const sonne = new THREE.DirectionalLight(0xffefc2, 3.5);
  sonne.position.set(-8, 13, 8);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  scene.add(sonne);
  const schnee = new THREE.Mesh(
    new THREE.PlaneGeometry(jagd ? 90 : 34, jagd ? 120 : 28),
    new THREE.MeshToonMaterial({ color: 0xf2fdff, gradientMap: gradient }),
  );
  schnee.rotation.x = -Math.PI / 2;
  schnee.position.z = jagd ? -36 : 0;
  schnee.receiveShadow = true;
  scene.add(schnee);
}

function baum(toon: THREE.MeshToonMaterial) {
  const gruppe = new THREE.Group();
  const stamm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.16, 1, 6),
    new THREE.MeshToonMaterial({ color: 0x6b4939, gradientMap: toon.gradientMap }),
  );
  stamm.position.y = 0.5;
  const krone = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 2.5, 7),
    new THREE.MeshToonMaterial({ color: 0x248291, gradientMap: toon.gradientMap }),
  );
  krone.position.y = 1.75;
  gruppe.add(stamm, krone);
  return gruppe;
}

async function modellLaden(
  loader: GLTFLoader,
  modell: AnimationsModell,
  gradient: THREE.Texture,
  modus: "intro" | "jagd",
) {
  const gltf = await loader.loadAsync(modell.datei);
  const figur = gltf.scene;
  toonMaterialien(figur, gradient);
  einpassen(figur, modus === "intro" ? 1.9 : 1.8);
  const name = modus === "intro"
    ? zufaelligeIntroAnimation(gltf.animations.map((clip) => clip.name))
    : laufAnimation(gltf.animations.map((clip) => clip.name));
  const mixer = new THREE.AnimationMixer(figur);
  const clip = gltf.animations.find((kandidat) => kandidat.name === name);
  if (clip) mixer.clipAction(clip).reset().play();
  return { figur, mixer, clipName: name };
}

async function fahrzeugLaden(
  loader: GLTFLoader,
  datei: string,
  gradient: THREE.Texture,
  drehung: number,
) {
  const gltf = await loader.loadAsync(datei);
  const fahrzeug = gltf.scene;
  toonMaterialien(fahrzeug, gradient);
  fahrzeug.rotation.y = drehung;
  fahrzeug.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fahrzeug);
  const groesse = box.getSize(new THREE.Vector3());
  fahrzeug.scale.multiplyScalar(3.15 / Math.max(0.001, groesse.x, groesse.z));
  fahrzeug.updateMatrixWorld(true);
  const neu = new THREE.Box3().setFromObject(fahrzeug);
  const mitte = neu.getCenter(new THREE.Vector3());
  fahrzeug.position.set(-mitte.x, -neu.min.y, -mitte.z);
  return fahrzeug;
}

function PursuitCanvas({
  modus,
  auswahl,
  lenkung,
  onBereit,
  onFortschritt,
  onGefangen,
}: {
  modus: "intro" | "jagd";
  auswahl: Auswahl;
  lenkung: React.MutableRefObject<number>;
  onBereit?: (clips: string[]) => void;
  onFortschritt?: (wert: number, treffer: boolean) => void;
  onGefangen?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onBereit, onFortschritt, onGefangen });
  callbacks.current = { onBereit, onFortschritt, onGefangen };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(modus === "intro" ? 0x87ddeb : 0xa9e4f1);
    scene.fog = new THREE.Fog(0xcdeff4, 20, 75);
    const gradient = gradientTextur();
    const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
    const breite = Math.max(320, element.clientWidth);
    const hoehe = Math.max(360, element.clientHeight);
    const camera = new THREE.PerspectiveCamera(modus === "intro" ? 42 : 54, breite / hoehe, 0.1, 140);
    camera.position.set(0, modus === "intro" ? 3.3 : 5.2, modus === "intro" ? 10 : 10.5);
    camera.lookAt(0, modus === "intro" ? 1.3 : 1.2, modus === "intro" ? 0 : -10);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      callbacks.current.onBereit?.([]);
      if (modus === "jagd") callbacks.current.onGefangen?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(breite, hoehe);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    element.appendChild(renderer.domElement);
    bodenUndLicht(scene, gradient, modus === "jagd");

    const loader = new GLTFLoader();
    const mixers: THREE.AnimationMixer[] = [];
    const halter: THREE.Group[] = [];
    const bewegteDinge: THREE.Object3D[] = [];
    const hindernisse: { objekt: THREE.Group; getroffen: boolean }[] = [];
    let car: THREE.Group | null = null;
    let helden: THREE.Group | null = null;

    const aufbauen = async () => {
      if (modus === "intro") {
        const modelle = auswahl.map(modellVon).filter((wert): wert is AnimationsModell => Boolean(wert));
        const ergebnisse = await Promise.allSettled(
          modelle.map((modell) => modellLaden(loader, modell, gradient, "intro")),
        );
        if (beendet) return;
        const clips: string[] = [];
        ergebnisse.forEach((ergebnis, index) => {
          if (ergebnis.status !== "fulfilled") return;
          const h = new THREE.Group();
          h.add(ergebnis.value.figur);
          h.position.set((index - 1) * 1.55, 0.14, 0);
          h.rotation.y = index === 1 ? 0 : (index - 1) * -0.08;
          scene.add(h);
          halter.push(h);
          mixers.push(ergebnis.value.mixer);
          clips.push(ergebnis.value.clipName ?? "Überraschungs-Move");
          const podest = new THREE.Mesh(
            new THREE.CylinderGeometry(0.72, 0.84, 0.28, 8),
            new THREE.MeshToonMaterial({
              color: [0xffdf42, 0x60e3f0, 0xff5570][index],
              gradientMap: gradient,
            }),
          );
          podest.position.set((index - 1) * 1.55, 0.02, 0);
          scene.add(podest);
          if (index > 0) {
            const flasche = mutFlascheBauen(toon);
            flasche.position.set(index === 1 ? -0.65 : 0.95, 0.22, 0.65);
            flasche.rotation.z = index === 1 ? 0.22 : -0.22;
            scene.add(flasche);
          }
        });
        for (let i = 0; i < 16; i++) {
          const t = baum(toon);
          t.position.set((i % 2 ? 1 : -1) * (5.2 + (i % 4)), 0, -7 + Math.floor(i / 2) * 2.2);
          t.scale.setScalar(0.65 + (i % 3) * 0.18);
          scene.add(t);
        }
        callbacks.current.onBereit?.(clips);
        return;
      }

      const piste = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 110),
        new THREE.MeshToonMaterial({ color: 0xb9dbe4, gradientMap: gradient }),
      );
      piste.rotation.x = -Math.PI / 2;
      piste.position.set(0, 0.025, -36);
      scene.add(piste);
      for (let i = 0; i < 18; i++) {
        const marke = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.03, 1.9),
          new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        marke.position.set(0, 0.06, -i * 5.6 + 5);
        scene.add(marke);
        bewegteDinge.push(marke);
      }
      for (let i = 0; i < 28; i++) {
        const t = baum(toon);
        t.position.set((i % 2 ? 1 : -1) * (6.4 + (i % 4) * 1.25), 0, -i * 4.2 + 8);
        t.scale.setScalar(0.7 + (i % 5) * 0.1);
        scene.add(t);
        bewegteDinge.push(t);
      }
      const [lamboErgebnis, ferrariErgebnis] = await Promise.allSettled([
        fahrzeugLaden(loader, "/3d_items/lambo.glb", gradient, Math.PI / 2),
        fahrzeugLaden(loader, "/3d_items/ferrari.glb", gradient, 0),
      ]);
      if (beendet) return;
      car = new THREE.Group();
      if (lamboErgebnis.status === "fulfilled") car.add(lamboErgebnis.value);
      car.position.set(0, 0.08, -10.5);
      scene.add(car);
      helden = new THREE.Group();
      helden.position.set(0, 0.06, 2.1);
      scene.add(helden);

      const verfolger = auswahl.slice(1).map(modellVon).filter((wert): wert is AnimationsModell => Boolean(wert));
      const ergebnisse = await Promise.allSettled(
        verfolger.map((modell) => modellLaden(loader, modell, gradient, "jagd")),
      );
      if (beendet) return;
      ergebnisse.forEach((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled" || !helden) return;
        const verfolgerWagen = new THREE.Group();
        if (ferrariErgebnis.status === "fulfilled") verfolgerWagen.add(ferrariErgebnis.value.clone(true));
        verfolgerWagen.position.x = index ? 1.55 : -1.55;
        const fahrer = new THREE.Group();
        fahrer.add(ergebnis.value.figur);
        fahrer.position.set(0, 0.52, 0.12);
        fahrer.rotation.y = Math.PI;
        fahrer.scale.setScalar(0.48);
        verfolgerWagen.add(fahrer);
        helden.add(verfolgerWagen);
        halter.push(fahrer);
        mixers.push(ergebnis.value.mixer);
      });
      callbacks.current.onBereit?.(ergebnisse.flatMap((e) => e.status === "fulfilled" && e.value.clipName ? [e.value.clipName] : []));

      const felsMat = new THREE.MeshToonMaterial({ color: 0x6f8498, gradientMap: gradient });
      const schneeMat = new THREE.MeshToonMaterial({ color: 0xf6ffff, gradientMap: gradient });
      for (let i = 0; i < 9; i++) {
        const gruppe = new THREE.Group();
        const fels = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58), felsMat);
        fels.scale.set(1.15, 0.75, 0.92);
        fels.position.y = 0.42;
        const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 5), schneeMat);
        kappe.scale.set(1.12, 0.35, 0.9);
        kappe.position.y = 0.73;
        gruppe.add(fels, kappe);
        gruppe.position.set(((i * 5) % 3 - 1) * 2.7, 0, -18 - i * 8.5);
        scene.add(gruppe);
        hindernisse.push({ objekt: gruppe, getroffen: false });
      }
    };
    void aufbauen();

    const tasten = new Set<string>();
    const runter = (event: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "a", "d"].includes(event.key.toLowerCase())) event.preventDefault();
      tasten.add(event.key.toLowerCase());
    };
    const hoch = (event: KeyboardEvent) => tasten.delete(event.key.toLowerCase());
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);

    let letzter = performance.now();
    let zeit = 0;
    let fortschritt = 0;
    let spielerX = 0;
    let impuls = 0;
    let letzteAusgabe = 0;
    let gefangen = false;
    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      zeit += dt;
      mixers.forEach((mixer) => mixer.update(dt));
      if (modus === "intro") {
        halter.forEach((h, index) => {
          h.position.y = 0.14 + Math.sin(zeit * 2.4 + index) * 0.035;
        });
        camera.position.x = Math.sin(zeit * 0.32) * 0.45;
        camera.lookAt(0, 1.3, 0);
      } else if (helden && car) {
        const taste = (tasten.has("arrowleft") || tasten.has("a") ? -1 : 0) +
          (tasten.has("arrowright") || tasten.has("d") ? 1 : 0);
        const steuer = Math.max(-1, Math.min(1, taste || lenkung.current));
        impuls += (steuer * 6.3 - impuls * 5.5) * dt;
        spielerX = THREE.MathUtils.clamp(spielerX + impuls * dt, -3.45, 3.45);
        helden.position.x = THREE.MathUtils.lerp(helden.position.x, spielerX, 0.18);
        helden.rotation.z = THREE.MathUtils.lerp(helden.rotation.z, -impuls * 0.055, 0.12);
        halter.forEach((h, index) => { h.position.y = Math.sin(zeit * 10 + index * Math.PI) * 0.04; });
        const wagenX = Math.sin(zeit * 0.62) * 2.15 + Math.sin(zeit * 1.47) * 0.42;
        car.position.x = wagenX;
        car.rotation.z = Math.sin(zeit * 0.62) * -0.06;
        const naehe = 1 - Math.min(1, Math.abs(spielerX - wagenX) / 4.5);
        fortschritt = Math.min(100, fortschritt + dt * (3.45 + naehe * 2.3));
        bewegteDinge.forEach((objekt) => {
          objekt.position.z += dt * (objekt instanceof THREE.Mesh ? 14 : 12);
          if (objekt.position.z > 13) objekt.position.z -= objekt instanceof THREE.Mesh ? 101 : 118;
        });
        let treffer = false;
        hindernisse.forEach((hindernis, index) => {
          hindernis.objekt.position.z += dt * 14;
          hindernis.objekt.rotation.y += dt * 0.55;
          if (hindernis.objekt.position.z > 9) {
            hindernis.objekt.position.z -= 78;
            hindernis.objekt.position.x = (((Math.floor(zeit) + index * 7) % 3) - 1) * 2.7;
            hindernis.getroffen = false;
          }
          if (!hindernis.getroffen && hindernis.objekt.position.z > 0.8 && hindernis.objekt.position.z < 3.2 && Math.abs(hindernis.objekt.position.x - spielerX) < 1.05) {
            hindernis.getroffen = true;
            fortschritt = Math.max(0, fortschritt - 7);
            impuls += hindernis.objekt.position.x < spielerX ? 2.4 : -2.4;
            treffer = true;
          }
        });
        if (jetzt - letzteAusgabe > 90 || treffer) {
          letzteAusgabe = jetzt;
          callbacks.current.onFortschritt?.(fortschritt, treffer);
        }
        if (fortschritt >= 100 && !gefangen) {
          gefangen = true;
          callbacks.current.onFortschritt?.(100, false);
          window.setTimeout(() => callbacks.current.onGefangen?.(), 450);
        }
      }
      renderer.render(scene, camera);
      if (!gefangen) frame = requestAnimationFrame(zeichnen);
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
      window.removeEventListener("resize", groesse);
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      scene.traverse((objekt) => {
        if (!(objekt instanceof THREE.Mesh || objekt instanceof THREE.LineSegments)) return;
        objekt.geometry.dispose();
        const materialien = Array.isArray(objekt.material) ? objekt.material : [objekt.material];
        materialien.forEach((material) => material.dispose());
      });
      gradient.dispose();
      toon.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [auswahl, lenkung, modus]);

  return <div className="jagd-canvas" ref={host} aria-label={modus === "intro" ? "Animierte Vorstellung der Pursuit-Charaktere" : "Spielbare Schneeverfolgung"} />;
}

export function Pursuit({ onSchliessen }: { onSchliessen: () => void }) {
  const [spielmodus, setSpielmodus] = useState<"wahl" | "verfolgung" | "jump">("wahl");
  const start = useMemo(() => pursuitStartauswahl(ANIMATIONS_MODELLE), []);
  const [auswahl, setAuswahl] = useState<Auswahl>(start ?? ["", "", ""]);
  const [phase, setPhase] = useState<Phase>("auswahl");
  const [bereit, setBereit] = useState(false);
  const [clips, setClips] = useState<string[]>([]);
  const [fortschritt, setFortschritt] = useState(0);
  const [treffer, setTreffer] = useState(false);
  const [statement, setStatement] = useState(PURSUIT_STATEMENTS[0]);
  const lenkung = useRef(0);

  const rolleSetzen = (rolle: number, id: string) => {
    setAuswahl((vorher) => {
      const neu = [...vorher] as Auswahl;
      const andereRolle = neu.indexOf(id);
      if (andereRolle >= 0 && andereRolle !== rolle) neu[andereRolle] = neu[rolle];
      neu[rolle] = id;
      return neu;
    });
  };
  const namen = auswahl.map((id) => modellVon(id)?.name ?? id);
  const gueltig = pursuitAuswahlGueltig(auswahl, ANIMATIONS_MODELLE);

  const neuStarten = () => {
    setBereit(false);
    setClips([]);
    setFortschritt(0);
    setTreffer(false);
    setPhase("intro");
  };

  if (spielmodus === "wahl") {
    return (
      <div className="jagd pursuit-auswahl pursuit-spiel pursuit-modi">
        <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
        <section className="pursuit-panel">
          <span className="jagd-kicker">WÄHLE DEIN CHAOS</span>
          <h1>PURSUIT</h1>
          <p>Zwei vollkommen vernünftige Arten, sich durch den Schnee zu bewegen.</p>
          <div className="pursuit-moduswahl">
            <button type="button" className="pursuit-moduskarte" onClick={() => setSpielmodus("verfolgung")}>
              <small>MODUS I · 3 TIERE</small>
              <strong>VERFOLGUNGS&shy;JAGD</strong>
              <span>Ein Lamborghini, zwei Ferraris und ein sehr fragwürdiger Fluchtgrund.</span>
              <b>JAGD STARTEN ›</b>
            </button>
            <button type="button" className="pursuit-moduskarte pursuit-moduskarte-jump" onClick={() => setSpielmodus("jump")}>
              <small>MODUS II · 1 TIER</small>
              <strong>JUMP ’N’ RUN</strong>
              <span>Springe über Schneeklötze und sammle Hotdogs und Hennessy.</span>
              <b>LOSRENNEN ›</b>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (spielmodus === "jump") {
    return <PursuitJumpNRun onZurueck={() => setSpielmodus("wahl")} onSchliessen={onSchliessen} />;
  }

  if (!start) {
    return (
      <div className="jagd jagd-start pursuit-auswahl pursuit-spiel">
        <article className="jagd-startkarte">
          <span className="jagd-kicker">PURSUIT</span>
          <h1>Modelle fehlen</h1>
          <p>Für Flüchtenden und zwei Verfolger werden mindestens drei GLB-Dateien in public/animations benötigt.</p>
          <button className="knopf aktion" onClick={onSchliessen}>Zum Hauptmenü</button>
        </article>
      </div>
    );
  }

  if (phase === "auswahl") {
    const rollen = ["FLIEHT IM LAMBORGHINI", "FERRARI-VERFOLGER LINKS", "FERRARI-VERFOLGER RECHTS"];
    return (
      <div className="jagd pursuit-auswahl pursuit-spiel">
        <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
        <section className="pursuit-panel">
          <button className="pursuit-zurueck" onClick={() => setSpielmodus("wahl")}>‹ Modi</button>
          <span className="jagd-kicker">EIN 3D-MINISPIEL</span>
          <h1>PURSUIT</h1>
          <p>Drei Tiere. Ein Lamborghini. Zwei Ferraris. Sehr vernünftige Entscheidungen.</p>
          <div className="pursuit-rollen">
            {rollen.map((rolle, index) => (
              <fieldset key={rolle}>
                <legend>{rolle}</legend>
                <div className="pursuit-modelle">
                  {ANIMATIONS_MODELLE.map((modell) => (
                    <button
                      type="button"
                      key={modell.id}
                      data-aktiv={auswahl[index] === modell.id}
                      onClick={() => rolleSetzen(index, modell.id)}
                    >
                      <strong>{modell.name}</strong>
                      <span>{modell.animationen.length} {modell.animationen.length === 1 ? "Animation" : "Animationen"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <button className="knopf aktion pursuit-los" disabled={!gueltig} onClick={neuStarten}>
            INTRO STARTEN ›
          </button>
        </section>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="jagd pursuit-intro pursuit-spiel">
        <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
        <PursuitCanvas
          modus="intro"
          auswahl={auswahl}
          lenkung={lenkung}
          onBereit={(neueClips) => { setClips(neueClips); setBereit(true); }}
        />
        <div className="pursuit-intro-kopf">
          <span className="jagd-kicker">TONIGHT&apos;S TOTALLY NORMAL LINE-UP</span>
          <h1>PURSUIT!</h1>
        </div>
        <div className="pursuit-namen">
          {namen.map((name, index) => (
            <div key={`${name}-${index}`}>
              <small>{index === 0 ? "FLÜCHTET" : "JAGT"}</small>
              <strong>{name}</strong>
              <span>{clips[index] ?? "lädt den Move …"}</span>
            </div>
          ))}
        </div>
        <button
          className="knopf aktion pursuit-vollgas"
          disabled={!bereit}
          onClick={() => { setBereit(false); setPhase("jagd"); }}
        >
          {bereit ? "VOLLGAS! ›" : "MODELLE KOMMEN INS LICHT …"}
        </button>
      </div>
    );
  }

  if (phase === "gefangen") {
    return (
      <div className="jagd jagd-gefangen pursuit-spiel">
        <div className="jagd-fangblitz" />
        <article className="jagd-statement">
          <span className="jagd-kicker">GESTELLT IM SCHNEE</span>
          <h1>{namen[0]}</h1>
          <blockquote>„{statement}“</blockquote>
          <p>{namen[1]} und {namen[2]} sehen einander an. Der Motor verstummt genau drei Sekunden lang.</p>
          <div className="pursuit-fangaktionen">
            <button className="knopf aktion" onClick={() => setPhase("auswahl")}>Neue Besetzung</button>
            <button className="knopf" onClick={neuStarten}>Nochmal!</button>
            <button className="knopf glas" onClick={onSchliessen}>Hauptmenü</button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="jagd pursuit-spiel" data-treffer={treffer}>
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <PursuitCanvas
        modus="jagd"
        auswahl={auswahl}
        lenkung={lenkung}
        onFortschritt={(wert, istTreffer) => {
          setFortschritt(wert);
          if (istTreffer) {
            setTreffer(true);
            window.setTimeout(() => setTreffer(false), 320);
          }
        }}
        onGefangen={() => {
          setStatement(PURSUIT_STATEMENTS[Math.floor(Math.random() * PURSUIT_STATEMENTS.length)]);
          setPhase("gefangen");
        }}
      />
      <header className="jagd-hud">
        <div><span className="jagd-kicker">PURSUIT · {namen[1]} + {namen[2]}</span><strong>{Math.max(0, Math.ceil(100 - fortschritt))} m Abstand</strong></div>
        <div className="jagd-meter"><i style={{ width: `${fortschritt}%` }} /></div>
      </header>
      <div className="jagd-schlag">{treffer ? "KRRKS!" : fortschritt > 82 ? "FAST!" : ""}</div>
      <div className="jagd-steuerung" aria-label="Lenkung">
        <button onPointerDown={() => { lenkung.current = -1; }} onPointerUp={() => { lenkung.current = 0; }} onPointerCancel={() => { lenkung.current = 0; }} onPointerLeave={() => { lenkung.current = 0; }} aria-label="Nach links lenken">‹</button>
        <span>A / D</span>
        <button onPointerDown={() => { lenkung.current = 1; }} onPointerUp={() => { lenkung.current = 0; }} onPointerCancel={() => { lenkung.current = 0; }} onPointerLeave={() => { lenkung.current = 0; }} aria-label="Nach rechts lenken">›</button>
      </div>
    </div>
  );
}
