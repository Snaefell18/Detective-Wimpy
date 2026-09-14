"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { postJson } from "@/lib/api";
import { herkunftsZeile, type Beweismittel } from "@/lib/beweismittel";
import { laufAnimation } from "@/lib/pursuit";
import { dateienFuer3D } from "@/lib/pursuit3d";
import type { Character, PublicCase } from "@/lib/types";
import type { Fund } from "@/lib/useGame";
import { FundMoment } from "./FundMoment";

type Richtung = { x: number; z: number };
type SpurVorschau = { itemId: string; ortId: string; name: string; bild: string | null };
type Naehe =
  | { art: "tier"; id: string; name: string }
  | { art: "spur"; id: string; ortId: string; name: string };

const normal = (wert: string) => wert.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

function modellFuer(charakter: Character, index: number): AnimationsModell | undefined {
  const schluessel = [charakter.id, charakter.name, charakter.tierart].map(normal);
  return (
    ANIMATIONS_MODELLE.find((modell) =>
      schluessel.some((wert) => wert && (normal(modell.id).includes(wert) || wert.includes(normal(modell.id)))),
    ) ?? ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy")[index % Math.max(1, ANIMATIONS_MODELLE.length - 1)]
  );
}

function gradientTextur() {
  const textur = new THREE.DataTexture(
    new Uint8Array([35, 35, 35, 145, 145, 145, 255, 255, 255]),
    3,
    1,
    THREE.RedFormat,
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
    const materialien: THREE.Material[] = mehrfach ? kind.material : [kind.material];
    const toon = materialien.map((material: THREE.Material) => {
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

function KapitelCanvas({
  steuerung,
  fall,
  locations,
  spuren,
  gefundeneSpuren,
  onNaehe,
  onBereit,
}: {
  steuerung: MutableRefObject<Richtung>;
  fall: PublicCase;
  locations: string[];
  spuren: SpurVorschau[];
  gefundeneSpuren: string[];
  onNaehe: (wert: Naehe | null) => void;
  onBereit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onNaehe, onBereit, gefunden: new Set(gefundeneSpuren) });
  callbacks.current = { onNaehe, onBereit, gefunden: new Set(gefundeneSpuren) };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a16);
    scene.fog = new THREE.Fog(0x11152a, 18, 62);
    const gradient = gradientTextur();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(-9.5, 5.1, 13.8);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.toneMappingExposure = 0.9;
    element.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x7aa1ff, 0x160d2e, 2.15));
    const licht = new THREE.DirectionalLight(0xa7e9ff, 2.5);
    licht.position.set(-8, 14, 9);
    licht.castShadow = true;
    scene.add(licht);
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 80),
      new THREE.MeshToonMaterial({ color: 0x22283b, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = -8;
    boden.receiveShadow = true;
    scene.add(boden);
    for (let i = 0; i < 18; i++) {
      const strich = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.025, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x74eaff }),
      );
      strich.position.set(0, 0.03, i * 4.2 - 38);
      scene.add(strich);
    }

    const loader = new GLTFLoader();
    const spieler = new THREE.Group();
    scene.add(spieler);
    const mixers: THREE.AnimationMixer[] = [];
    const npcGruppen: { gruppe: THREE.Group; info: Naehe; basisZ: number; phase: number }[] = [];
    const spurGruppen: { gruppe: THREE.Group; info: Naehe }[] = [];
    let spielerMixer: THREE.AnimationMixer | null = null;
    let laufAktion: THREE.AnimationAction | null = null;
    let ruheAktion: THREE.AnimationAction | null = null;
    let aktiveAktion: THREE.AnimationAction | null = null;
    let letzteNaehe = "";

    const figurLaden = async (modell: AnimationsModell, hoehe: number) => {
      const gltf = await loader.loadAsync(modell.datei);
      const figur = gltf.scene;
      cellShading(figur, gradient);
      einpassen(figur, hoehe);
      return { figur, animationen: gltf.animations };
    };

    const aufbauen = async () => {
      const kulissen = await Promise.allSettled(dateienFuer3D(locations).map((datei) => loader.loadAsync(datei)));
      if (beendet) return;
      const vorlagen = kulissen.flatMap((ergebnis) => {
        if (ergebnis.status !== "fulfilled") return [];
        const vorlage = ergebnis.value.scene;
        cellShading(vorlage, gradient);
        einpassen(vorlage, 10.66);
        // Die exportierten Häuserfronten zeigen so mit ihrer Vorderseite zur Straße.
        vorlage.rotation.y = -Math.PI / 2;
        return [vorlage];
      });
      for (let i = 0; i < 7 && vorlagen.length; i++) {
        const block = new THREE.Group();
        block.add(vorlagen[i % vorlagen.length].clone(true));
        block.position.set(7.25, 0, i * 15.5 - 46);
        scene.add(block);
      }

      const wimpy = ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy");
      if (wimpy) {
        const geladen = await figurLaden(wimpy, 2.05);
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

      const tiere = fall.besetzung.filter((charakter) => !charakter.istDetektiv && !charakter.istDaemon);
      const npcLadungen = await Promise.allSettled(
        tiere.map((charakter, index) => {
          const modell = modellFuer(charakter, index);
          return modell ? figurLaden(modell, 1.8) : Promise.reject(new Error("Kein Modell"));
        }),
      );
      if (beendet) return;
      npcLadungen.forEach((ergebnis, index) => {
        if (ergebnis.status !== "fulfilled") return;
        const charakter = tiere[index];
        const gruppe = new THREE.Group();
        gruppe.add(ergebnis.value.figur);
        const z = index * -7.4 + 5;
        gruppe.position.set(index % 2 ? -3.1 : 3.2, 0, z);
        scene.add(gruppe);
        npcGruppen.push({
          gruppe,
          info: { art: "tier", id: charakter.id, name: charakter.name },
          basisZ: z,
          phase: index * 1.7,
        });
        const mixer = new THREE.AnimationMixer(ergebnis.value.figur);
        const clips = ergebnis.value.animationen;
        const clip = clips.find((kandidat) =>
          index % 3 === 0 ? /dance|shuffle|ymca/i.test(kandidat.name) : /idle|walk|rest/i.test(kandidat.name),
        ) ?? clips[index % Math.max(1, clips.length)];
        if (clip) mixer.clipAction(clip).play();
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
          if (spur.bild) {
            try {
              const textur = await new THREE.TextureLoader().loadAsync(spur.bild);
              textur.colorSpace = THREE.SRGBColorSpace;
              const bild = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ map: textur, transparent: true }),
              );
              bild.position.set(0, 0.72, 0.061);
              gruppe.add(bild);
            } catch {
              // Der goldene Rahmen bleibt als klare, untersuchbare Requisite stehen.
            }
          }
          gruppe.position.set(index % 2 ? 2.15 : -2.15, 0, index * -5.8 + 1.5);
          gruppe.rotation.y = index % 2 ? -0.35 : 0.35;
          scene.add(gruppe);
          spurGruppen.push({
            gruppe,
            info: { art: "spur", id: spur.itemId, ortId: spur.ortId, name: spur.name },
          });
        }),
      );
      if (!beendet) callbacks.current.onBereit();
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
      const tx = (tasten.has("d") || tasten.has("arrowright") ? 1 : 0) - (tasten.has("a") || tasten.has("arrowleft") ? 1 : 0);
      const tz = (tasten.has("s") || tasten.has("arrowdown") ? 1 : 0) - (tasten.has("w") || tasten.has("arrowup") ? 1 : 0);
      const x = THREE.MathUtils.clamp(tx || steuerung.current.x, -1, 1);
      const z = THREE.MathUtils.clamp(tz || steuerung.current.z, -1, 1);
      const bewegt = Math.abs(x) + Math.abs(z) > 0.05;
      if (bewegt) {
        const laenge = Math.hypot(x, z) || 1;
        spieler.position.x = THREE.MathUtils.clamp(spieler.position.x + (x / laenge) * dt * 4.1, -4.8, 4.8);
        spieler.position.z = THREE.MathUtils.clamp(spieler.position.z + (z / laenge) * dt * 4.1, -36, 15);
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
      npcGruppen.forEach((npc, index) => {
        if (index % 3 !== 1) return;
        npc.gruppe.position.z = npc.basisZ + Math.sin(jetzt / 1800 + npc.phase) * 2.3;
        npc.gruppe.rotation.y = Math.cos(jetzt / 1800 + npc.phase) > 0 ? 0 : Math.PI;
      });

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
      camera.position.lerp(zielKamera, 0.08);
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
    window.addEventListener("resize", groesse);
    return () => {
      beendet = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("resize", groesse);
      renderer.dispose();
      renderer.domElement.remove();
      gradient.dispose();
    };
  }, [fall, locations, spuren, steuerung]);

  return <div className="saga3d-canvas" ref={host} aria-label="Spielbares 3D-Kapitel" />;
}

export function Saga3DKapitel({
  fall,
  siegel,
  locations,
  gefundeneSpuren,
  kapitel,
  tasche,
  suchtGerade,
  onCharakter,
  onSpur,
  onAufnehmen,
}: {
  fall: PublicCase;
  siegel: string;
  locations: string[];
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
  useEffect(() => {
    let aktiv = true;
    void postJson<{ spuren: SpurVorschau[] }>("/api/search", {
      siegel,
      ortId: fall.orte[0]?.id ?? "",
      gefundeneSpuren,
      vorschau: true,
    })
      .then((antwort) => {
        if (aktiv) setSpuren(antwort.spuren ?? []);
      })
      .catch(() => {
        if (aktiv) setSpuren([]);
      });
    return () => {
      aktiv = false;
    };
    // Für denselben versiegelten Fall bleibt die Vorschau stehen; gefundene
    // Requisiten blendet die laufende Szene ohne teures Neuladen selbst aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siegel]);

  const setzen = (x: number, z: number) => {
    steuerung.current = { x, z };
  };
  const stoppen = () => setzen(0, 0);

  const interagieren = async () => {
    if (!nah) return;
    if (nah.art === "tier") {
      onCharakter(nah.id);
      return;
    }
    setMeldung("");
    const ergebnis = await onSpur(nah.ortId, nah.id);
    if (ergebnis?.spur) setFund(ergebnis);
    else if (ergebnis?.text) setMeldung(ergebnis.text);
  };

  return (
    <div className="saga3d">
      <KapitelCanvas
        steuerung={steuerung}
        fall={fall}
        locations={locations}
        spuren={spuren}
        gefundeneSpuren={gefundeneSpuren}
        onNaehe={setNah}
        onBereit={() => setBereit(true)}
      />
      <div className="saga3d-hud">
        <span className="jagd-kicker">{kapitel === 0 ? "3D-FINALE" : `KAPITEL ${kapitel ?? ""} · 3D`}</span>
        <strong>{fall.stadt}</strong>
        <small>{bereit ? "Finde Tiere und untersuche herumliegende Spuren." : "Die Stadt wird aufgebaut …"}</small>
      </div>
      <div className="experiment-steuerkreuz" aria-label="Wimpy steuern">
        <button onPointerDown={() => setzen(0, -1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▲</button>
        <button onPointerDown={() => setzen(-1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>◀</button>
        <button onPointerDown={() => setzen(1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>▶</button>
        <button onPointerDown={() => setzen(0, 1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▼</button>
      </div>
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
