"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Hintergrundmusik } from "@/components/Hintergrundmusik";
import { useStammdaten } from "@/lib/stammdaten";
import {
  VERFOLGER_MODELLE,
  fluchtStatement,
  type VerfolgerModell,
  type VerfolgungVorgabe,
} from "@/lib/verfolgung";

type JagdStatus = "bereit" | "mutprobe" | "jagd" | "gefangen";

const nameDesModells = (id: VerfolgerModell) =>
  VERFOLGER_MODELLE.find((m) => m.id === id)?.name ?? id;

/** Kantige schwarze Konturen machen selbst primitive 3D-Körper zu Comicfiguren. */
function umranden(mesh: THREE.Mesh, farbe = 0x172337) {
  const kanten = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 24),
    new THREE.LineBasicMaterial({ color: farbe, linewidth: 2 }),
  );
  mesh.add(kanten);
  return mesh;
}

function koerper(
  geometrie: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  skala: [number, number, number] = [1, 1, 1],
) {
  const mesh = umranden(new THREE.Mesh(geometrie, material));
  mesh.position.set(...position);
  mesh.scale.set(...skala);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function schafBauen(toon: THREE.MeshToonMaterial) {
  const gruppe = new THREE.Group();
  const wolle = toon.clone();
  wolle.color.set(0xfff9de);
  const dunkel = toon.clone();
  dunkel.color.set(0x343849);
  const rot = toon.clone();
  rot.color.set(0xe8424f);

  for (const [x, y, z, s] of [
    [0, 1.5, 0, 0.78], [-0.42, 1.45, 0, 0.56], [0.42, 1.42, 0, 0.56],
    [0, 1.8, 0.02, 0.58], [-0.3, 1.78, 0.05, 0.48], [0.3, 1.78, 0.05, 0.48],
  ] as const) {
    gruppe.add(koerper(new THREE.IcosahedronGeometry(s, 1), wolle, [x, y, z], [1, 0.9, 0.85]));
  }
  gruppe.add(koerper(new THREE.SphereGeometry(0.42, 10, 8), dunkel, [0, 1.65, 0.58], [0.72, 0.88, 0.65]));
  gruppe.add(koerper(new THREE.ConeGeometry(0.17, 0.48, 5), dunkel, [-0.38, 1.82, 0.53], [1, 1, 0.5]));
  gruppe.add(koerper(new THREE.ConeGeometry(0.17, 0.48, 5), dunkel, [0.38, 1.82, 0.53], [1, 1, 0.5]));
  for (const x of [-0.38, 0.38]) {
    gruppe.add(koerper(new THREE.CylinderGeometry(0.11, 0.14, 0.72, 6), dunkel, [x, 0.7, 0]));
  }
  const schal = koerper(new THREE.TorusGeometry(0.43, 0.11, 6, 12), rot, [0, 1.35, 0.3]);
  schal.rotation.x = Math.PI / 2;
  gruppe.add(schal);
  const ende = koerper(new THREE.BoxGeometry(0.22, 0.75, 0.09), rot, [0.38, 1.03, 0.22]);
  ende.rotation.z = -0.25;
  gruppe.add(ende);
  return gruppe;
}

function yetiBauen(toon: THREE.MeshToonMaterial) {
  const gruppe = new THREE.Group();
  const fell = toon.clone();
  fell.color.set(0xeee8d9);
  const schatten = toon.clone();
  schatten.color.set(0x777984);

  gruppe.add(koerper(new THREE.IcosahedronGeometry(0.95, 2), fell, [0, 1.45, 0], [0.9, 1.25, 0.72]));
  gruppe.add(koerper(new THREE.IcosahedronGeometry(0.7, 2), fell, [0, 2.35, 0.02], [0.9, 1, 0.78]));
  // Nur eine Schattenfläche statt eines Gesichts: die Figur bleibt bewusst unkenntlich.
  gruppe.add(koerper(new THREE.SphereGeometry(0.27, 10, 7), schatten, [0, 2.34, 0.58], [1.05, 0.62, 0.38]));
  for (const x of [-0.93, 0.93]) {
    const arm = koerper(new THREE.CylinderGeometry(0.22, 0.29, 1.65, 7), fell, [x, 1.35, 0]);
    arm.rotation.z = x < 0 ? -0.28 : 0.28;
    gruppe.add(arm);
    gruppe.add(koerper(new THREE.IcosahedronGeometry(0.34, 1), fell, [x * 1.12, 0.52, 0]));
  }
  for (const x of [-0.38, 0.38]) {
    gruppe.add(koerper(new THREE.CylinderGeometry(0.2, 0.3, 0.85, 7), schatten, [x, 0.5, 0]));
    gruppe.add(koerper(new THREE.SphereGeometry(0.32, 8, 6), schatten, [x, 0.12, 0.18], [1.35, 0.55, 1.65]));
  }
  for (let i = 0; i < 9; i++) {
    const zipfel = koerper(new THREE.ConeGeometry(0.16, 0.55, 5), fell, [((i % 3) - 1) * 0.34, 1.15 + Math.floor(i / 3) * 0.46, 0.66]);
    zipfel.rotation.x = Math.PI;
    gruppe.add(zipfel);
  }
  return gruppe;
}

export function sportwagenBauen(toon: THREE.MeshToonMaterial) {
  const gruppe = new THREE.Group();
  const weiss = toon.clone();
  weiss.color.set(0xf9fbff);
  const glas = toon.clone();
  glas.color.set(0x13263b);
  const schwarz = toon.clone();
  schwarz.color.set(0x171923);
  const rot = toon.clone();
  rot.color.set(0xff334c);

  gruppe.add(koerper(new THREE.BoxGeometry(2.25, 0.45, 4.2), weiss, [0, 0.62, 0]));
  const nase = koerper(new THREE.BoxGeometry(2.05, 0.3, 1.45), weiss, [0, 0.82, -1.45]);
  nase.rotation.x = -0.08;
  gruppe.add(nase);
  const kabine = koerper(new THREE.BoxGeometry(1.55, 0.65, 1.55), glas, [0, 1.04, 0.35], [1, 0.9, 1]);
  kabine.rotation.x = -0.06;
  gruppe.add(kabine);
  gruppe.add(koerper(new THREE.BoxGeometry(1.8, 0.1, 0.18), weiss, [0, 1.02, 1.93]));
  gruppe.add(koerper(new THREE.BoxGeometry(2.05, 0.11, 0.18), rot, [0, 0.72, 2.06]));
  for (const x of [-1.07, 1.07]) for (const z of [-1.25, 1.25]) {
    const rad = koerper(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10), schwarz, [x, 0.42, z]);
    rad.rotation.z = Math.PI / 2;
    gruppe.add(rad);
  }
  gruppe.scale.setScalar(0.78);
  return gruppe;
}

/** Eine erfundene, etikettlose Comic-Cognacflasche mit ikonisch langem Hals. */
export function mutFlascheBauen(toon: THREE.MeshToonMaterial) {
  const gruppe = new THREE.Group();
  const glas = toon.clone();
  glas.color.set(0x4e7d3a);
  const cognac = toon.clone();
  cognac.color.set(0xc87824);
  const etikett = toon.clone();
  etikett.color.set(0xf4df9e);
  const deckel = toon.clone();
  deckel.color.set(0x151b26);

  gruppe.add(koerper(new THREE.CylinderGeometry(0.24, 0.31, 0.86, 8), glas, [0, 0.43, 0]));
  gruppe.add(koerper(new THREE.CylinderGeometry(0.13, 0.2, 0.22, 8), glas, [0, 0.97, 0]));
  gruppe.add(koerper(new THREE.CylinderGeometry(0.105, 0.13, 0.74, 8), glas, [0, 1.43, 0]));
  gruppe.add(koerper(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 8), deckel, [0, 1.86, 0]));
  gruppe.add(koerper(new THREE.BoxGeometry(0.38, 0.34, 0.035), etikett, [0, 0.55, 0.29]));
  gruppe.add(koerper(new THREE.CylinderGeometry(0.205, 0.25, 0.46, 8), cognac, [0, 0.3, 0]));
  gruppe.scale.setScalar(0.7);
  return gruppe;
}

function TrinkCanvas({
  modelle,
  onFertig,
}: {
  modelle: [VerfolgerModell, VerfolgerModell];
  onFertig: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fertig = useRef(onFertig);
  fertig.current = onFertig;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const breite = Math.max(320, element.clientWidth);
    const hoehe = Math.max(360, element.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x92ddea);
    const camera = new THREE.PerspectiveCamera(42, breite / hoehe, 0.1, 60);
    camera.position.set(0, 3.2, 8.8);
    camera.lookAt(0, 1.45, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      fertig.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(breite, hoehe);
    renderer.shadowMap.enabled = true;
    element.appendChild(renderer.domElement);

    const gradient = new THREE.DataTexture(
      new Uint8Array([55, 55, 55, 170, 170, 170, 255, 255, 255]),
      3,
      1,
      THREE.RedFormat,
    );
    gradient.needsUpdate = true;
    gradient.magFilter = THREE.NearestFilter;
    gradient.minFilter = THREE.NearestFilter;
    const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
    scene.add(new THREE.HemisphereLight(0xf5ffff, 0x45617a, 2.8));
    const licht = new THREE.DirectionalLight(0xffefc2, 3.4);
    licht.position.set(-6, 10, 7);
    licht.castShadow = true;
    scene.add(licht);

    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshToonMaterial({ color: 0xf3fdff, gradientMap: gradient }),
    );
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    scene.add(boden);

    const figuren = modelle.map((modell, index) => {
      const figur = modell === "schaf" ? schafBauen(toon) : yetiBauen(toon);
      figur.position.set(index ? 1.55 : -1.55, 0, 0);
      figur.rotation.y = index ? -0.16 : 0.16;
      figur.scale.setScalar(modell === "schaf" ? 1.05 : 0.82);
      scene.add(figur);
      const flasche = mutFlascheBauen(toon);
      flasche.position.set(index ? 0.78 : -0.78, 1.05, 0.72);
      flasche.rotation.z = index ? -0.18 : 0.18;
      scene.add(flasche);
      return { figur, flasche, seite: index ? 1 : -1 };
    });

    let frame = 0;
    let gerufen = false;
    const start = performance.now();
    const zeichnen = (jetzt: number) => {
      const zeit = (jetzt - start) / 1000;
      const schluck = Math.sin(Math.min(1, zeit / 1.65) * Math.PI);
      figuren.forEach(({ figur, flasche, seite }, index) => {
        figur.position.y = Math.sin(zeit * 5 + index) * 0.035;
        flasche.position.y = 1.05 + schluck * 1.12;
        flasche.position.x = seite * (0.78 - schluck * 0.5);
        flasche.rotation.z = seite * (0.18 + schluck * 1.08);
        flasche.rotation.x = -schluck * 0.38;
      });
      camera.position.x = Math.sin(zeit * 0.8) * 0.18;
      camera.lookAt(0, 1.45, 0);
      renderer.render(scene, camera);
      if (zeit >= 2.85 && !gerufen) {
        gerufen = true;
        fertig.current();
        return;
      }
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
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", groesse);
      scene.traverse((objekt) => {
        if (objekt instanceof THREE.Mesh || objekt instanceof THREE.LineSegments) {
          objekt.geometry.dispose();
          const materialien = Array.isArray(objekt.material) ? objekt.material : [objekt.material];
          materialien.forEach((material) => material.dispose());
        }
      });
      gradient.dispose();
      toon.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelle]);

  return <div className="jagd-canvas" ref={host} aria-hidden="true" />;
}

function VerfolgungsCanvas({
  modelle,
  aktiv,
  lenkung,
  onFortschritt,
  onGefangen,
}: {
  modelle: [VerfolgerModell, VerfolgerModell];
  aktiv: boolean;
  lenkung: React.MutableRefObject<number>;
  onFortschritt: (wert: number, treffer: boolean) => void;
  onGefangen: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onFortschritt, onGefangen });
  callbacks.current = { onFortschritt, onGefangen };

  useEffect(() => {
    const element = host.current;
    if (!element || !aktiv) return;

    const breite = Math.max(320, element.clientWidth);
    const hoehe = Math.max(360, element.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa9e4f1);
    scene.fog = new THREE.Fog(0xcdeff4, 18, 68);
    const camera = new THREE.PerspectiveCamera(54, breite / hoehe, 0.1, 120);
    camera.position.set(0, 5.2, 10.5);
    camera.lookAt(0, 1.2, -10);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      callbacks.current.onGefangen();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(breite, hoehe);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);

    const gradient = new THREE.DataTexture(
      new Uint8Array([62, 62, 62, 170, 170, 170, 255, 255, 255]),
      3,
      1,
      THREE.RedFormat,
    );
    gradient.needsUpdate = true;
    gradient.magFilter = THREE.NearestFilter;
    gradient.minFilter = THREE.NearestFilter;
    const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });

    scene.add(new THREE.HemisphereLight(0xf2feff, 0x52718b, 2.35));
    const sonne = new THREE.DirectionalLight(0xfff2cf, 3.1);
    sonne.position.set(-8, 14, 8);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(1024, 1024);
    scene.add(sonne);

    const schneeMat = new THREE.MeshToonMaterial({ color: 0xeafcff, gradientMap: gradient });
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), schneeMat);
    boden.rotation.x = -Math.PI / 2;
    boden.position.z = -30;
    boden.receiveShadow = true;
    scene.add(boden);
    const piste = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 100),
      new THREE.MeshToonMaterial({ color: 0xbddce5, gradientMap: gradient }),
    );
    piste.rotation.x = -Math.PI / 2;
    piste.position.set(0, 0.025, -30);
    piste.receiveShadow = true;
    scene.add(piste);

    const marken: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i++) {
      const marke = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 1.9),
        new THREE.MeshBasicMaterial({ color: 0xf6ffff }),
      );
      marke.position.set(0, 0.06, -i * 5.5 + 5);
      scene.add(marke);
      marken.push(marke);
    }

    const berge: THREE.Group[] = [];
    const fichteMat = toon.clone();
    fichteMat.color.set(0x2a8391);
    const stammMat = toon.clone();
    stammMat.color.set(0x77513d);
    for (let i = 0; i < 26; i++) {
      const baum = new THREE.Group();
      baum.add(koerper(new THREE.CylinderGeometry(0.12, 0.17, 1.1, 6), stammMat, [0, 0.5, 0]));
      baum.add(koerper(new THREE.ConeGeometry(0.8, 2.5, 7), fichteMat, [0, 1.75, 0]));
      const seite = i % 2 ? 1 : -1;
      baum.position.set(seite * (6.5 + (i % 4) * 1.4), 0, -i * 4.4 + 8);
      baum.scale.setScalar(0.72 + (i % 5) * 0.11);
      scene.add(baum);
      berge.push(baum);
    }

    const car = sportwagenBauen(toon);
    car.position.set(0, 0.08, -10.5);
    scene.add(car);

    const helden = new THREE.Group();
    const links = modelle[0] === "schaf" ? schafBauen(toon) : yetiBauen(toon);
    const rechts = modelle[1] === "schaf" ? schafBauen(toon) : yetiBauen(toon);
    links.position.x = -0.72;
    rechts.position.x = 0.72;
    links.scale.setScalar(0.72);
    rechts.scale.setScalar(0.72);
    helden.add(links, rechts);
    helden.position.set(0, 0.05, 2.1);
    helden.rotation.x = -0.05;
    scene.add(helden);

    const hindernisse: { ding: THREE.Group; getroffen: boolean }[] = [];
    const felsenMat = toon.clone();
    felsenMat.color.set(0x71869a);
    for (let i = 0; i < 9; i++) {
      const ding = new THREE.Group();
      const fels = koerper(new THREE.DodecahedronGeometry(0.56, 0), felsenMat, [0, 0.42, 0], [1.15, 0.72, 0.92]);
      const kappe = koerper(new THREE.SphereGeometry(0.46, 8, 5), schneeMat, [0, 0.73, 0], [1.12, 0.35, 0.9]);
      ding.add(fels, kappe);
      ding.position.set(((i * 5) % 3 - 1) * 2.7, 0, -18 - i * 8.5);
      scene.add(ding);
      hindernisse.push({ ding, getroffen: false });
    }

    const flockenGeo = new THREE.BufferGeometry();
    const punkte = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      punkte[i * 3] = (Math.random() - 0.5) * 30;
      punkte[i * 3 + 1] = Math.random() * 13;
      punkte[i * 3 + 2] = -Math.random() * 70 + 8;
    }
    flockenGeo.setAttribute("position", new THREE.BufferAttribute(punkte, 3));
    const flocken = new THREE.Points(
      flockenGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, transparent: true, opacity: 0.92 }),
    );
    scene.add(flocken);

    let frame = 0;
    let letzter = performance.now();
    let vergangen = 0;
    let fortschritt = 0;
    let spielerX = 0;
    let impuls = 0;
    let ausgabe = 0;
    let beendet = false;
    const tasten = new Set<string>();
    const tasteRunter = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) e.preventDefault();
      tasten.add(e.key.toLowerCase());
    };
    const tasteHoch = (e: KeyboardEvent) => tasten.delete(e.key.toLowerCase());
    window.addEventListener("keydown", tasteRunter);
    window.addEventListener("keyup", tasteHoch);

    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      vergangen += dt;
      const taste = (tasten.has("arrowleft") || tasten.has("a") ? -1 : 0) +
        (tasten.has("arrowright") || tasten.has("d") ? 1 : 0);
      const steuer = Math.max(-1, Math.min(1, taste || lenkung.current));
      impuls += (steuer * 6.2 - impuls * 5.5) * dt;
      spielerX = THREE.MathUtils.clamp(spielerX + impuls * dt, -3.45, 3.45);
      helden.position.x = THREE.MathUtils.lerp(helden.position.x, spielerX, 0.18);
      helden.rotation.z = THREE.MathUtils.lerp(helden.rotation.z, -impuls * 0.055, 0.12);
      links.position.y = Math.sin(vergangen * 9) * 0.055;
      rechts.position.y = Math.sin(vergangen * 9 + Math.PI) * 0.055;

      const wagenX = Math.sin(vergangen * 0.62) * 2.15 + Math.sin(vergangen * 1.47) * 0.42;
      car.position.x = wagenX;
      car.rotation.z = Math.sin(vergangen * 0.62) * -0.06;
      car.position.z = -10.5 + Math.sin(vergangen * 2.1) * 0.16 + fortschritt * 0.045;
      const naehe = 1 - Math.min(1, Math.abs(spielerX - wagenX) / 4.5);
      fortschritt = Math.min(100, fortschritt + dt * (3.35 + naehe * 2.25));

      for (const marke of marken) {
        marke.position.z += dt * 14;
        if (marke.position.z > 8) marke.position.z -= 99;
      }
      for (const baum of berge) {
        baum.position.z += dt * 12;
        if (baum.position.z > 13) baum.position.z -= 114;
      }
      let treffer = false;
      for (const hindernis of hindernisse) {
        hindernis.ding.position.z += dt * 14;
        hindernis.ding.rotation.y += dt * 0.55;
        if (hindernis.ding.position.z > 9) {
          hindernis.ding.position.z -= 78;
          hindernis.ding.position.x = (((Math.floor(vergangen) + hindernisse.indexOf(hindernis) * 7) % 3) - 1) * 2.7;
          hindernis.getroffen = false;
        }
        if (!hindernis.getroffen && hindernis.ding.position.z > 0.8 && hindernis.ding.position.z < 3.2 && Math.abs(hindernis.ding.position.x - spielerX) < 1.05) {
          hindernis.getroffen = true;
          fortschritt = Math.max(0, fortschritt - 7);
          impuls += hindernis.ding.position.x < spielerX ? 2.4 : -2.4;
          treffer = true;
        }
      }
      const positionen = flockenGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positionen.count; i++) {
        let z = positionen.getZ(i) + dt * 19;
        let y = positionen.getY(i) - dt * 0.4;
        if (z > 10) z -= 78;
        if (y < 0) y = 12;
        positionen.setZ(i, z);
        positionen.setY(i, y);
      }
      positionen.needsUpdate = true;

      if (jetzt - ausgabe > 90 || treffer) {
        ausgabe = jetzt;
        callbacks.current.onFortschritt(fortschritt, treffer);
      }
      renderer.render(scene, camera);
      if (fortschritt >= 100 && !beendet) {
        beendet = true;
        callbacks.current.onFortschritt(100, false);
        window.setTimeout(() => callbacks.current.onGefangen(), 500);
        return;
      }
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
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", groesse);
      window.removeEventListener("keydown", tasteRunter);
      window.removeEventListener("keyup", tasteHoch);
      renderer.dispose();
      gradient.dispose();
      toon.dispose();
      scene.traverse((objekt) => {
        if (objekt instanceof THREE.Mesh || objekt instanceof THREE.LineSegments || objekt instanceof THREE.Points) {
          objekt.geometry.dispose();
          const materialien = Array.isArray(objekt.material) ? objekt.material : [objekt.material];
          materialien.forEach((material) => material.dispose());
        }
      });
      renderer.domElement.remove();
    };
  }, [aktiv, lenkung, modelle]);

  return <div className="jagd-canvas" ref={host} aria-hidden="true" />;
}

export function Verfolgungsjagd({
  vorgabe,
  onFertig,
}: {
  vorgabe: VerfolgungVorgabe;
  onFertig: () => void;
}) {
  const stammdaten = useStammdaten();
  const [status, setStatus] = useState<JagdStatus>("bereit");
  const [fortschritt, setFortschritt] = useState(0);
  const [treffer, setTreffer] = useState(false);
  const lenkung = useRef(0);
  const fliehender = stammdaten.charaktere.find((c) => c.id === vorgabe.fliehenderId);
  const verfolger = useMemo(
    () => vorgabe.verfolger.map((v) => ({
      ...v,
      tier: stammdaten.charaktere.find((c) => c.id === v.charakterId),
    })),
    [stammdaten.charaktere, vorgabe.verfolger],
  );
  const modelle = useMemo<[VerfolgerModell, VerfolgerModell]>(
    () => [vorgabe.verfolger[0].modell, vorgabe.verfolger[1].modell],
    [vorgabe.verfolger],
  );

  const steuern = (wert: number) => {
    lenkung.current = wert;
  };

  if (status === "bereit") {
    return (
      <div className="jagd jagd-start">
        <div className="jagd-comicwort">WROOOM!</div>
        <div className="jagd-startkarte">
          <span className="jagd-kicker">OPTIONALES ZWISCHENEREIGNIS</span>
          <h1>{vorgabe.name}</h1>
          <p>
            Ein grellweißer Sportwagen schneidet durch den Schnee. Hinter der
            dunklen Scheibe ist nicht zu erkennen, wer am Steuer sitzt.
          </p>
          <div className="jagd-team">
            {verfolger.map((v) => (
              <div className="jagd-teammitglied" key={v.charakterId}>
                <span>{nameDesModells(v.modell)}</span>
                <strong>{v.tier?.name ?? v.charakterId}</strong>
              </div>
            ))}
          </div>
          <p className="leise klein">Steuere beide mit A/D, den Pfeiltasten oder den großen Tasten.</p>
          <button className="knopf aktion jagd-los" onClick={() => setStatus("mutprobe")}>
            VERFOLGUNG AUFNEHMEN ›
          </button>
        </div>
      </div>
    );
  }

  if (status === "mutprobe") {
    return (
      <div className="jagd jagd-mutprobe">
        <TrinkCanvas modelle={modelle} onFertig={() => setStatus("jagd")} />
        <div className="jagd-trinktext">
          <span className="jagd-kicker">DIE RUHE VOR DEM WROOOM</span>
          <strong>EIN SCHLUCK MUT.</strong>
          <em>DANN VOLLGAS!</em>
        </div>
      </div>
    );
  }

  if (status === "gefangen") {
    return (
      <div className="jagd jagd-gefangen">
        <div className="jagd-fangblitz" />
        <article className="jagd-statement">
          <span className="jagd-kicker">GESTELLT IM SCHNEE</span>
          <h1>{fliehender?.name ?? vorgabe.fliehenderId}</h1>
          <blockquote>„{fluchtStatement(vorgabe)}“</blockquote>
          <p>Der Motor verstummt. Der Schnee fällt wieder senkrecht.</p>
          <button className="knopf aktion" onClick={onFertig}>Weiter zum nächsten Kapitel ›</button>
        </article>
      </div>
    );
  }

  return (
    <div className="jagd" data-treffer={treffer}>
      {vorgabe.musik && <Hintergrundmusik stueck={vorgabe.musik} />}
      <VerfolgungsCanvas
        modelle={modelle}
        aktiv
        lenkung={lenkung}
        onFortschritt={(wert, istTreffer) => {
          setFortschritt(wert);
          if (istTreffer) {
            setTreffer(true);
            window.setTimeout(() => setTreffer(false), 320);
          }
        }}
        onGefangen={() => setStatus("gefangen")}
      />
      <header className="jagd-hud">
        <div>
          <span className="jagd-kicker">{vorgabe.name}</span>
          <strong>{Math.max(0, Math.ceil(100 - fortschritt))} m Abstand</strong>
        </div>
        <div className="jagd-meter"><i style={{ width: `${fortschritt}%` }} /></div>
      </header>
      <div className="jagd-schlag">{treffer ? "KRRKS!" : fortschritt > 82 ? "FAST!" : ""}</div>
      <div className="jagd-steuerung" aria-label="Lenkung">
        <button
          onPointerDown={() => steuern(-1)}
          onPointerUp={() => steuern(0)}
          onPointerCancel={() => steuern(0)}
          onPointerLeave={() => steuern(0)}
          aria-label="Nach links lenken"
        >
          ‹
        </button>
        <span>A / D</span>
        <button
          onPointerDown={() => steuern(1)}
          onPointerUp={() => steuern(0)}
          onPointerCancel={() => steuern(0)}
          onPointerLeave={() => steuern(0)}
          aria-label="Nach rechts lenken"
        >
          ›
        </button>
      </div>
    </div>
  );
}
