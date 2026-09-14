"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { laufAnimation } from "@/lib/pursuit";

type ItemArt = "hotdog" | "hennessy";
const ITEMS: { id: ItemArt; name: string; datei: string; farbe: number }[] = [
  { id: "hotdog", name: "Hotdog", datei: "/3d_items/hotdog.glb", farbe: 0xffcc35 },
  { id: "hennessy", name: "Hennessy", datei: "/3d_items/hennessy.glb", farbe: 0xff546d },
];
const LAUFEN = /(run|running|sprint|jog|walk|walking|laufen|rennen)/i;
const RUHE = /(rest|idle|t.?pose)/i;

function gradientTextur() {
  const textur = new THREE.DataTexture(
    new Uint8Array([45, 45, 45, 160, 160, 160, 255, 255, 255]),
    3, 1, THREE.RedFormat,
  );
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
    const vorher: THREE.Material[] = mehrfach ? kind.material : [kind.material];
    const neu = vorher.map((material) => {
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
    kind.material = mehrfach ? neu : neu[0];
  });
}

function aufHoeheBringen(objekt: THREE.Object3D, hoehe: number) {
  objekt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(objekt);
  const groesse = box.getSize(new THREE.Vector3());
  objekt.scale.multiplyScalar(hoehe / Math.max(0.001, groesse.y));
  objekt.updateMatrixWorld(true);
  const neu = new THREE.Box3().setFromObject(objekt);
  const mitte = neu.getCenter(new THREE.Vector3());
  objekt.position.set(objekt.position.x - mitte.x, objekt.position.y - neu.min.y, objekt.position.z - mitte.z);
}

function baum(gradient: THREE.Texture) {
  const gruppe = new THREE.Group();
  const stamm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6),
    new THREE.MeshToonMaterial({ color: 0x694539, gradientMap: gradient }),
  );
  stamm.position.y = 0.55;
  const krone = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 2.7, 7),
    new THREE.MeshToonMaterial({ color: 0x287f8c, gradientMap: gradient }),
  );
  krone.position.y = 1.9;
  gruppe.add(stamm, krone);
  return gruppe;
}

function JumpCanvas({
  modell,
  sprung,
  onPunkte,
  onItem,
  onTreffer,
}: {
  modell: AnimationsModell;
  sprung: MutableRefObject<number>;
  onPunkte: (punkte: number) => void;
  onItem: (art: ItemArt, animation: string) => void;
  onTreffer: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPunkte, onItem, onTreffer });
  callbacks.current = { onPunkte, onItem, onTreffer };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x83ddec);
    scene.fog = new THREE.Fog(0xcdf5fa, 18, 58);
    const gradient = gradientTextur();
    const breite = Math.max(320, element.clientWidth);
    const hoehe = Math.max(360, element.clientHeight);
    const camera = new THREE.PerspectiveCamera(46, breite / hoehe, 0.1, 100);
    camera.position.set(-8.4, 4.35, 11.2);
    camera.lookAt(0, 1.1, 0.8);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return;
    }
    renderer.setSize(breite, hoehe);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    element.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf9ffff, 0x355b78, 2.7));
    const sonne = new THREE.DirectionalLight(0xffefc5, 3.6);
    sonne.position.set(-7, 12, 8);
    sonne.castShadow = true;
    scene.add(sonne);
    const piste = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 90),
      new THREE.MeshToonMaterial({ color: 0xd7f2f5, gradientMap: gradient }),
    );
    piste.rotation.x = -Math.PI / 2;
    piste.position.set(0, 0, 17);
    piste.receiveShadow = true;
    scene.add(piste);
    const schnee = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 100),
      new THREE.MeshToonMaterial({ color: 0xf4feff, gradientMap: gradient }),
    );
    schnee.rotation.x = -Math.PI / 2;
    schnee.position.set(0, -0.03, 17);
    scene.add(schnee);

    const streifen: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i++) {
      const strich = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.025, 1.5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      strich.position.set(0, 0.035, i * 4 - 6);
      scene.add(strich);
      streifen.push(strich);
    }
    const baeume: THREE.Group[] = [];
    for (let i = 0; i < 24; i++) {
      const t = baum(gradient);
      t.position.set((i % 2 ? 1 : -1) * (5 + (i % 4) * 1.25), 0, i * 4.4 - 10);
      t.scale.setScalar(0.65 + (i % 3) * 0.15);
      scene.add(t);
      baeume.push(t);
    }

    const loader = new GLTFLoader();
    const spieler = new THREE.Group();
    spieler.position.set(-0.25, 0, 0);
    scene.add(spieler);
    let mixer: THREE.AnimationMixer | null = null;
    let laufAktion: THREE.AnimationAction | null = null;
    let aktiveAktion: THREE.AnimationAction | null = null;
    let spezialBis = 0;
    let spezialIndex = 0;
    let figurGeladen = false;
    let drehKick = 0;
    let spezialClips: THREE.AnimationClip[] = [];

    const figurPromise = loader.loadAsync(modell.datei).then((gltf) => {
      if (beendet) return;
      const figur = gltf.scene;
      cellShading(figur, gradient);
      aufHoeheBringen(figur, 2.05);
      spieler.add(figur);
      mixer = new THREE.AnimationMixer(figur);
      const laufName = laufAnimation(gltf.animations.map((clip) => clip.name));
      const laufClip = gltf.animations.find((clip) => clip.name === laufName);
      if (laufClip) {
        laufAktion = mixer.clipAction(laufClip);
        laufAktion.play();
        aktiveAktion = laufAktion;
      }
      spezialClips = gltf.animations.filter((clip) => !LAUFEN.test(clip.name) && !RUHE.test(clip.name));
      figurGeladen = true;
    });

    type LaufObjekt = {
      gruppe: THREE.Group;
      art: "hindernis" | ItemArt;
      erledigt: boolean;
      basisY: number;
    };
    const objekte: LaufObjekt[] = [];
    const hindernisMat = new THREE.MeshToonMaterial({ color: 0x58758b, gradientMap: gradient });
    const schneeMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
    const itemVorlagen = new Map<ItemArt, THREE.Object3D>();

    const itemsPromise = Promise.all(ITEMS.map(async (item) => {
      const gltf = await loader.loadAsync(item.datei);
      if (beendet) return;
      cellShading(gltf.scene, gradient);
      aufHoeheBringen(gltf.scene, item.id === "hotdog" ? 0.8 : 1.05);
      itemVorlagen.set(item.id, gltf.scene);
    })).then(() => {
      if (beendet) return;
      for (let i = 0; i < 15; i++) {
        const art: LaufObjekt["art"] = i % 3 === 0 ? "hindernis" : (i % 2 ? "hotdog" : "hennessy");
        const gruppe = new THREE.Group();
        let basisY = 0;
        if (art === "hindernis") {
          const klotz = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62), hindernisMat);
          klotz.scale.set(1.35, 0.78, 0.9);
          klotz.position.y = 0.48;
          const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 5), schneeMat);
          kappe.scale.set(1.2, 0.3, 0.9);
          kappe.position.y = 0.82;
          gruppe.add(klotz, kappe);
        } else {
          const vorlage = itemVorlagen.get(art);
          if (vorlage) gruppe.add(vorlage.clone(true));
          basisY = 1.0;
          gruppe.position.y = basisY;
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.7, 0.07, 6, 16),
            new THREE.MeshBasicMaterial({ color: ITEMS.find((item) => item.id === art)?.farbe ?? 0xffffff }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.35;
          gruppe.add(ring);
        }
        gruppe.position.z = 12 + i * 9.5;
        scene.add(gruppe);
        objekte.push({ gruppe, art, erledigt: false, basisY });
      }
    });
    void Promise.allSettled([figurPromise, itemsPromise]);

    let y = 0;
    let tempoY = 0;
    let letzterSprung = sprung.current;
    let zeit = 0;
    let letzter = performance.now();
    let punkte = 0;
    let letztePunkte = 0;
    let letztePunkteAusgabe = 0;
    const springen = () => {
      if (y <= 0.025) tempoY = 7.1;
    };
    const taste = (event: KeyboardEvent) => {
      if ([" ", "arrowup", "w"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        springen();
      }
    };
    window.addEventListener("keydown", taste);

    const sammelAnimation = (art: ItemArt) => {
      let name = "COMIC-SPIN";
      if (mixer && spezialClips.length) {
        const clip = spezialClips[spezialIndex % spezialClips.length];
        spezialIndex++;
        name = clip.name;
        const aktion = mixer.clipAction(clip);
        aktion.reset();
        aktion.setLoop(THREE.LoopOnce, 1);
        aktion.clampWhenFinished = true;
        aktiveAktion?.fadeOut(0.12);
        aktion.fadeIn(0.1).play();
        aktiveAktion = aktion;
        spezialBis = zeit + Math.min(1.65, Math.max(0.8, clip.duration));
      } else {
        drehKick = 1;
        spezialBis = zeit + 0.85;
      }
      callbacks.current.onItem(art, name);
    };

    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      zeit += dt;
      if (sprung.current !== letzterSprung) {
        letzterSprung = sprung.current;
        springen();
      }
      tempoY -= 18.5 * dt;
      y = Math.max(0, y + tempoY * dt);
      if (y === 0 && tempoY < 0) tempoY = 0;
      spieler.position.y = y;
      spieler.rotation.y = drehKick > 0 ? drehKick * Math.PI * 2 : 0;
      if (drehKick > 0) drehKick = Math.max(0, drehKick - dt * 1.25);
      if (figurGeladen && y === 0 && spezialBis <= zeit) spieler.position.y += Math.sin(zeit * 10) * 0.025;
      mixer?.update(dt);
      if (spezialBis > 0 && zeit >= spezialBis) {
        spezialBis = 0;
        if (laufAktion && aktiveAktion !== laufAktion) {
          aktiveAktion?.fadeOut(0.12);
          laufAktion.reset().fadeIn(0.12).play();
          aktiveAktion = laufAktion;
        }
      }

      const tempo = Math.min(10, 6.8 + zeit * 0.035);
      streifen.forEach((strich) => {
        strich.position.z -= tempo * dt;
        if (strich.position.z < -8) strich.position.z += 72;
      });
      baeume.forEach((t) => {
        t.position.z -= tempo * dt * 0.72;
        if (t.position.z < -13) t.position.z += 106;
      });
      let groesstesZ = objekte.reduce((max, objekt) => Math.max(max, objekt.gruppe.position.z), 18);
      objekte.forEach((objekt, index) => {
        objekt.gruppe.position.z -= tempo * dt;
        if (objekt.art !== "hindernis") {
          objekt.gruppe.rotation.y += dt * 2.6;
          objekt.gruppe.position.y = objekt.basisY + Math.sin(zeit * 4 + index) * 0.14;
        }
        if (!objekt.erledigt && objekt.gruppe.position.z < 0.85 && objekt.gruppe.position.z > -0.75) {
          if (objekt.art === "hindernis") {
            if (y < 0.82) {
              objekt.erledigt = true;
              callbacks.current.onTreffer();
              punkte = Math.max(0, punkte - 25);
            }
          } else {
            objekt.erledigt = true;
            objekt.gruppe.visible = false;
            punkte += objekt.art === "hotdog" ? 100 : 150;
            sammelAnimation(objekt.art);
          }
        }
        if (objekt.gruppe.position.z < -7) {
          groesstesZ += 9.5 + Math.random() * 3;
          objekt.gruppe.position.z = groesstesZ;
          objekt.erledigt = false;
          objekt.gruppe.visible = true;
        }
      });
      punkte += dt * 4;
      if (Math.floor(punkte) !== letztePunkte && jetzt - letztePunkteAusgabe > 120) {
        letztePunkte = Math.floor(punkte);
        letztePunkteAusgabe = jetzt;
        callbacks.current.onPunkte(letztePunkte);
      }
      camera.position.x = -8.4 + Math.sin(zeit * 0.35) * 0.1;
      camera.lookAt(0, 1.1 + y * 0.1, 0.8);
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
      window.removeEventListener("keydown", taste);
      window.removeEventListener("resize", groesse);
      scene.traverse((objekt) => {
        if (!(objekt instanceof THREE.Mesh)) return;
        objekt.geometry.dispose();
        const materialien = Array.isArray(objekt.material) ? objekt.material : [objekt.material];
        materialien.forEach((material) => material.dispose());
      });
      gradient.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modell, sprung]);

  return <div className="jagd-canvas" ref={host} aria-label="Pursuit Jump and Run" />;
}

export function PursuitJumpNRun({ onZurueck, onSchliessen }: { onZurueck: () => void; onSchliessen: () => void }) {
  const [modellId, setModellId] = useState(ANIMATIONS_MODELLE[0]?.id ?? "");
  const [spielt, setSpielt] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [hotdogs, setHotdogs] = useState(0);
  const [flaschen, setFlaschen] = useState(0);
  const [meldung, setMeldung] = useState("");
  const [treffer, setTreffer] = useState(false);
  const sprung = useRef(0);
  const modell = ANIMATIONS_MODELLE.find((eintrag) => eintrag.id === modellId);

  if (!spielt || !modell) {
    return (
      <div className="jagd pursuit-auswahl pursuit-spiel jump-auswahl">
        <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
        <section className="pursuit-panel">
          <button className="pursuit-zurueck" onClick={onZurueck}>‹ Modi</button>
          <span className="jagd-kicker">PURSUIT · MODUS II</span>
          <h1>JUMP ’N’ RUN</h1>
          <p>Wähle dein Tier. Es läuft. Du springst. Der Hotdog wartet auf niemanden.</p>
          <div className="jump-charaktere">
            {ANIMATIONS_MODELLE.map((eintrag) => (
              <button key={eintrag.id} data-aktiv={eintrag.id === modellId} onClick={() => setModellId(eintrag.id)}>
                <strong>{eintrag.name}</strong>
                <span>{eintrag.animationen.length} Moves</span>
              </button>
            ))}
          </div>
          <div className="jump-items-vorschau">
            <span>🌭 Hotdog · 100</span><span>🍾 Hennessy · 150</span>
          </div>
          <button className="knopf aktion pursuit-los" onClick={() => setSpielt(true)}>LOSRENNEN ›</button>
        </section>
      </div>
    );
  }

  const springen = () => { sprung.current += 1; };
  return (
    <div className="jagd pursuit-spiel jump-spiel" data-treffer={treffer}>
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <JumpCanvas
        modell={modell}
        sprung={sprung}
        onPunkte={setPunkte}
        onTreffer={() => {
          setTreffer(true);
          setMeldung("KRRKS!");
          window.setTimeout(() => setTreffer(false), 280);
        }}
        onItem={(art, animation) => {
          if (art === "hotdog") setHotdogs((wert) => wert + 1);
          else setFlaschen((wert) => wert + 1);
          setMeldung(`${art === "hotdog" ? "HOTDOG!" : "HENNESSY!"} · ${animation}`);
        }}
      />
      <header className="jump-hud">
        <div><span className="jagd-kicker">PURSUIT · JUMP ’N’ RUN</span><strong>{modell.name}</strong></div>
        <div className="jump-score">{punkte.toLocaleString("de-DE")}<small>PUNKTE</small></div>
        <div className="jump-inventar"><span>🌭 {hotdogs}</span><span>🍾 {flaschen}</span></div>
      </header>
      {meldung && <div className="jump-meldung" key={`${meldung}-${hotdogs}-${flaschen}`}>{meldung}</div>}
      <button className="jump-knopf" onPointerDown={springen} aria-label="Springen">SPRUNG!<small>LEERTASTE</small></button>
      <button className="pursuit-zurueck jump-raus" onClick={() => setSpielt(false)}>‹ Figur wechseln</button>
    </div>
  );
}
