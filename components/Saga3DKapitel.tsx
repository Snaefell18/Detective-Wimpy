"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ANIMATIONS_MODELLE, type AnimationsModell } from "@/lib/animations.generated";
import { postJson } from "@/lib/api";
import { herkunftsZeile, type Beweismittel } from "@/lib/beweismittel";
import { laufAnimation } from "@/lib/pursuit";
import { dateienFuer3D } from "@/lib/pursuit3d";
import type { DreiDTageszeit, DreiDWetter } from "@/lib/pursuit3d";
import type { Character, PublicCase } from "@/lib/types";
import type { Fund } from "@/lib/useGame";
import { FundMoment } from "./FundMoment";

type Richtung = { x: number; z: number };
type SpurVorschau = { itemId: string; ortId: string; name: string; bild: string | null };
type Naehe =
  | { art: "tier"; id: string; name: string }
  | { art: "spur"; id: string; ortId: string; name: string };

const normal = (wert: string) => wert.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

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

function cellShading(
  objekt: THREE.Object3D,
  gradient: THREE.Texture,
  clippingPlanes: THREE.Plane[] = [],
) {
  objekt.traverse((kind) => {
    if (!(kind instanceof THREE.Mesh)) return;
    kind.castShadow = true;
    kind.receiveShadow = true;
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

function KapitelCanvas({
  steuerung,
  fall,
  locations,
  spuren,
  gefundeneSpuren,
  tageszeit,
  wetter,
  charakterModelle,
  onNaehe,
  onBereit,
}: {
  steuerung: MutableRefObject<Richtung>;
  fall: PublicCase;
  locations: string[];
  spuren: SpurVorschau[];
  gefundeneSpuren: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  charakterModelle: Record<string, string>;
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
    const himmel = {
      morgen: 0xf3a979,
      tag: wetter === "sonne" ? 0x62c8ff : 0x91b8d2,
      abend: 0xa84567,
      nacht: 0x070a16,
    }[tageszeit];
    const nebel = wetter === "regen" ? 0x536777 : himmel;
    scene.background = new THREE.Color(himmel);
    scene.fog = new THREE.Fog(nebel, wetter === "regen" ? 13 : 20, wetter === "regen" ? 48 : 68);
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
    renderer.localClippingEnabled = true;
    renderer.toneMappingExposure = tageszeit === "nacht" ? 0.82 : wetter === "sonne" ? 1.18 : 0.98;
    element.appendChild(renderer.domElement);

    const oben = tageszeit === "nacht" ? 0x7aa1ff : tageszeit === "abend" ? 0xffad87 : 0xe8f8ff;
    scene.add(new THREE.HemisphereLight(oben, tageszeit === "nacht" ? 0x160d2e : 0x455348, tageszeit === "nacht" ? 2.15 : 2.8));
    const licht = new THREE.DirectionalLight(
      wetter === "sonne" ? 0xfff1b8 : tageszeit === "abend" ? 0xff9c72 : 0xb9ddff,
      wetter === "sonne" ? 5.2 : wetter === "regen" ? 1.5 : 2.8,
    );
    licht.position.set(-8, 14, 9);
    licht.castShadow = true;
    scene.add(licht);
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 90),
      new THREE.MeshToonMaterial({ color: wetter === "regen" ? 0x263647 : tageszeit === "tag" ? 0x4b5868 : 0x293448, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = -8;
    boden.receiveShadow = true;
    scene.add(boden);
    const fahrbahn = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 90),
      new THREE.MeshToonMaterial({
        color: wetter === "regen" ? 0x263a4a : tageszeit === "nacht" ? 0x202b3c : 0x52606c,
        gradientMap: gradient,
      }),
    );
    fahrbahn.rotation.x = -Math.PI / 2;
    fahrbahn.position.set(0, 0.012, -8);
    fahrbahn.receiveShadow = true;
    scene.add(fahrbahn);
    const bordstein = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.22, 90),
      new THREE.MeshToonMaterial({ color: 0xc5c7c3, gradientMap: gradient }),
    );
    bordstein.position.set(4.72, 0.1, -8);
    bordstein.receiveShadow = true;
    scene.add(bordstein);
    let regen: THREE.Points | null = null;
    if (wetter === "regen") {
      const positionen = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) {
        positionen[i * 3] = Math.random() * 18 - 9;
        positionen[i * 3 + 1] = Math.random() * 15;
        positionen[i * 3 + 2] = Math.random() * 70 - 48;
      }
      const geometrie = new THREE.BufferGeometry();
      geometrie.setAttribute("position", new THREE.BufferAttribute(positionen, 3));
      regen = new THREE.Points(
        geometrie,
        new THREE.PointsMaterial({ color: 0xc6edff, size: 0.075, transparent: true, opacity: 0.85 }),
      );
      scene.add(regen);
    }
    if (wetter === "sonne") {
      const sonne = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff3a1 }),
      );
      sonne.position.set(-17, 18, -35);
      scene.add(sonne);
    }
    for (let i = 0; i < 18; i++) {
      const strich = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.025, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x74eaff }),
      );
      strich.position.set(0, 0.03, i * 4.2 - 38);
      scene.add(strich);
    }

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
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
        // Alles, was ein Location-GLB selbst vor die Bordsteinkante legt
        // (Straße, Autos, Mobiliar), wird abgeschnitten. So bleibt es eine
        // Kulisse und kann den wirklich begehbaren Streifen nicht verschlucken.
        cellShading(vorlage, gradient, [new THREE.Plane(new THREE.Vector3(1, 0, 0), -4.88)]);
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
          const modell = modellFuer(charakter, index, charakterModelle[charakter.id]);
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
        const vorherX = spieler.position.x;
        const vorherZ = spieler.position.z;
        const neuX = THREE.MathUtils.clamp(vorherX + (x / laenge) * dt * 4.1, -4.15, 4.15);
        const neuZ = THREE.MathUtils.clamp(vorherZ + (z / laenge) * dt * 4.1, -36, 15);
        const kollidiert = npcGruppen.some((npc) => {
          const dx = npc.gruppe.position.x - neuX;
          const dz = npc.gruppe.position.z - neuZ;
          return dx * dx + dz * dz < 1.15 * 1.15;
        });
        if (!kollidiert) spieler.position.set(neuX, 0, neuZ);
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
      if (regen) {
        const positionen = regen.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positionen.count; i++) {
          const y = positionen.getY(i) - dt * 13;
          positionen.setY(i, y < 0 ? 15 : y);
        }
        positionen.needsUpdate = true;
      }
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
  }, [charakterModelle, fall, locations, spuren, steuerung, tageszeit, wetter]);

  return <div className="saga3d-canvas" ref={host} aria-label="Spielbares 3D-Kapitel" />;
}

export function Saga3DKapitel({
  fall,
  siegel,
  locations,
  tageszeit,
  wetter,
  charakterModelle,
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
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  charakterModelle: Record<string, string>;
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
        tageszeit={tageszeit}
        wetter={wetter}
        charakterModelle={charakterModelle}
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

/** Dieselbe Stadttechnik ohne Fall-API – für Modus IV unter Pursuit. */
export function Saga3DProbeSzene({
  locations,
  tageszeit,
  wetter,
  modellIds,
  onZurueck,
  onSchliessen,
}: {
  locations: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  modellIds: string[];
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
  const stoppen = () => setzen(0, 0);

  return (
    <div className="jagd pursuit-spiel saga3d-probe">
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <KapitelCanvas
        steuerung={steuerung}
        fall={fall}
        locations={locations}
        tageszeit={tageszeit}
        wetter={wetter}
        charakterModelle={modellZuordnung}
        spuren={[]}
        gefundeneSpuren={[]}
        onNaehe={setNah}
        onBereit={() => setBereit(true)}
      />
      <header className="experiment-hud">
        <span className="jagd-kicker">MODUS IV · 3D-WELT-PROBE</span>
        <strong>{tageszeit.toUpperCase()} · {wetter === "sonne" ? "SONNENSCHEIN" : wetter.toUpperCase()}</strong>
        <small>{bereit ? `${modellIds.length} Modelle in der Testwelt.` : "Straßen und Tiere werden geladen …"}</small>
      </header>
      <button className="pursuit-zurueck experiment-zurueck" onClick={onZurueck}>‹ Einstellungen</button>
      <div className="experiment-steuerkreuz" aria-label="Wimpy steuern">
        <button onPointerDown={() => setzen(0, -1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▲</button>
        <button onPointerDown={() => setzen(-1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>◀</button>
        <button onPointerDown={() => setzen(1, 0)} onPointerUp={stoppen} onPointerCancel={stoppen}>▶</button>
        <button onPointerDown={() => setzen(0, 1)} onPointerUp={stoppen} onPointerCancel={stoppen}>▼</button>
      </div>
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
