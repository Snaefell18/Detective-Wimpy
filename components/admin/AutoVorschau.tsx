"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AUTO_MODELLE, autoLaenge } from "@/lib/autos";

/**
 * Wie herum steht der Wagen in seiner Datei?
 *
 * Jeder Export legt das Modell anders ab: Der eine schaut nach vorn, der
 * nächste liegt quer, der übernächste steht rückwärts. Im Spiel wird das mit
 * einer Drehung geradegerückt - und bisher musste man die raten, ins Spiel
 * gehen, hinsehen, zurück, wieder raten.
 *
 * Hier sieht man es. Die Straße läuft mit einem Pfeil nach vorn davon, der
 * Wagen steht genauso darauf, wie er später fährt: Zeigt die Schnauze in
 * Pfeilrichtung, stimmt die Drehung. Zeigt sie woandershin, ist der nächste
 * Knopf einen Tipp entfernt.
 */
export function AutoVorschau({
  modell,
  drehung,
  groesse = 1,
  onDrehen,
}: {
  /** Id aus AUTO_MODELLE - die Datei, die gezeigt wird. */
  modell: string;
  /** Die eingestellte Drehung in Grad. */
  drehung: number;
  /**
   * Die eingestellte Größe. Die Straße bleibt, wie sie ist - so sieht man
   * sofort, ob der Wagen zur Fahrbahn passt oder daneben aussieht wie ein
   * Spielzeug.
   */
  groesse?: number;
  /** Ein Tipp auf einen der Knöpfe setzt sie neu. */
  onDrehen: (grad: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [fehler, setFehler] = useState("");
  /**
   * Das geladene Modell überlebt Drehungen: Wer viermal auf 90 Grad tippt,
   * soll nicht viermal dieselbe Datei aus dem Netz holen.
   */
  const wagen = useRef<THREE.Object3D | null>(null);
  const eintrag = AUTO_MODELLE.find((m) => m.id === modell);

  useEffect(() => {
    const element = host.current;
    if (!element || !eintrag) return;
    let beendet = false;
    let frame = 0;
    setFehler("");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12161f);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    // Schräg von hinten oben - ungefähr der Blick, den man auch im Spiel hat.
    camera.position.set(-2.8, 3.2, -7.2);
    camera.lookAt(0, 0.4, 2.8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFehler("3D-Vorschau konnte nicht gestartet werden.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    element.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a3040, 2.6));
    const licht = new THREE.DirectionalLight(0xfff3d6, 2.2);
    licht.position.set(-4, 7, -5);
    scene.add(licht);

    const weg: { dispose: () => void }[] = [];
    const merken = <T extends { dispose: () => void }>(wert: T) => {
      weg.push(wert);
      return wert;
    };

    // Die Fahrbahn, damit der Wagen nicht im Nichts steht.
    const strasse = new THREE.Mesh(
      merken(new THREE.PlaneGeometry(9, 34)),
      merken(new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 1 })),
    );
    strasse.rotation.x = -Math.PI / 2;
    strasse.position.z = 4;
    scene.add(strasse);

    /*
     * Und was daraus eine Richtung macht: Mittelstriche, die auf den
     * Betrachter zulaufen, als führe der Wagen. Sie wandern langsam und
     * gleichmäßig - nichts blitzt, nichts springt.
     */
    const strichGeometrie = merken(new THREE.PlaneGeometry(0.22, 1.5));
    const strichMaterial = merken(
      new THREE.MeshBasicMaterial({ color: 0xdfe4e8, transparent: true, opacity: 0.4 }),
    );
    const STRICH_ABSTAND = 3.2;
    const STRICH_START = -7;
    const striche: THREE.Mesh[] = [];
    for (const seite of [-2.6, 2.6]) {
      for (let i = 0; i < 8; i++) {
        const strich = new THREE.Mesh(strichGeometrie, strichMaterial);
        strich.rotation.x = -Math.PI / 2;
        strich.position.set(seite, 0.01, STRICH_START + i * STRICH_ABSTAND);
        scene.add(strich);
        striche.push(strich);
      }
    }

    /*
     * Der Pfeil zeigt nach +z. Das ist die Richtung, in die das Spiel jeden
     * Wagen fahren lässt; die Drehung aus dem Katalog ist genau das, was das
     * Modell dorthin ausrichtet. Er setzt direkt vor der Schnauze an, damit
     * man beides in einem Blick hat.
     */
    const pfeilFarbe = merken(new THREE.MeshBasicMaterial({ color: 0xf6c667 }));
    const schaft = new THREE.Mesh(merken(new THREE.PlaneGeometry(0.34, 3.6)), pfeilFarbe);
    schaft.rotation.x = -Math.PI / 2;
    schaft.position.set(0, 0.02, 5.6);
    scene.add(schaft);
    const spitze = new THREE.Mesh(merken(new THREE.CircleGeometry(0.85, 3)), pfeilFarbe);
    spitze.rotation.x = -Math.PI / 2;
    spitze.rotation.z = -Math.PI / 2;
    spitze.position.set(0, 0.02, 8.1);
    scene.add(spitze);

    const gruppe = new THREE.Group();
    scene.add(gruppe);

    const aufstellen = (vorlage: THREE.Object3D) => {
      gruppe.clear();
      const koerper = vorlage.clone(true);
      /*
       * Dasselbe Einpassen wie im Spiel: erst drehen, dann auf die Länge
       * bringen, die zu seiner Größe gehört, dann mittig auf die Straße
       * stellen. Was hier steht, steht dort genauso - und weil die Fahrbahn
       * dabei gleich breit bleibt, sieht man sofort, ob der Wagen zu klein
       * geraten ist.
       */
      koerper.rotation.y = THREE.MathUtils.degToRad(drehung);
      koerper.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(koerper);
      const masse = box.getSize(new THREE.Vector3());
      koerper.scale.multiplyScalar(autoLaenge({ groesse }, 3) / Math.max(masse.x, masse.z, 0.001));
      koerper.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(koerper);
      const mitte = box.getCenter(new THREE.Vector3());
      koerper.position.set(-mitte.x, -box.min.y, -mitte.z);
      gruppe.add(koerper);
    };

    let letzter = performance.now();
    const zeichnen = (jetzt: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (jetzt - letzter) / 1000));
      letzter = jetzt;
      if (element.clientWidth && element.clientHeight) {
        // Die Striche laufen auf den Betrachter zu: Der Wagen fährt vorwärts.
        const strecke = STRICH_ABSTAND * striche.length / 2;
        for (const strich of striche) {
          strich.position.z -= dt * 3.4;
          if (strich.position.z < STRICH_START) strich.position.z += strecke;
        }
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(zeichnen);
    };

    const vorhanden = wagen.current;
    if (vorhanden) {
      aufstellen(vorhanden);
      frame = requestAnimationFrame(zeichnen);
    } else {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader
        .loadAsync(eintrag.datei)
        .then((gltf) => {
          if (beendet) return;
          wagen.current = gltf.scene;
          aufstellen(gltf.scene);
          frame = requestAnimationFrame(zeichnen);
        })
        .catch(() => {
          if (!beendet) setFehler("Das Modell konnte nicht geladen werden.");
        });
    }

    // Heißt bewusst nicht "groesse": So heißt die Größe des Wagens.
    const anpassen = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(element.clientWidth, element.clientHeight);
    };
    anpassen();
    const beobachter = new ResizeObserver(anpassen);
    beobachter.observe(element);

    return () => {
      beendet = true;
      cancelAnimationFrame(frame);
      beobachter.disconnect();
      weg.forEach((wert) => wert.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [eintrag, drehung, groesse]);

  // Das geladene Modell gehört zur Datei; wechselt die, muss es neu geholt werden.
  useEffect(() => {
    wagen.current = null;
  }, [modell]);

  if (!eintrag) {
    return <p className="leise klein">Für dieses Modell liegt keine Datei im Ordner.</p>;
  }

  return (
    <div className="auto-vorschau">
      <div className="auto-vorschau-bild" ref={host} aria-label={`Vorschau: ${eintrag.name}`} />
      {fehler && <p className="fehler klein">{fehler}</p>}
      <p className="leise klein">
        Die Schnauze muss in Pfeilrichtung zeigen – so fährt der Wagen im Spiel.
      </p>
      <div className="knopf-reihe">
        {[0, 90, 180, 270].map((grad) => (
          <button
            key={grad}
            type="button"
            className="marke-knopf"
            data-aktiv={((drehung % 360) + 360) % 360 === grad}
            onClick={() => onDrehen(grad)}
          >
            {grad}°
          </button>
        ))}
      </div>
      <p className="leise klein">
        {eintrag.quer
          ? "Der Build hat gemessen: Dieses Modell liegt quer in seiner Datei – meist passen 90° oder 270°."
          : "Der Build hat gemessen: Dieses Modell liegt längs in seiner Datei – meist passen 0° oder 180°."}
      </p>
    </div>
  );
}
