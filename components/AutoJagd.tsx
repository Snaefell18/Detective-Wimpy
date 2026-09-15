"use client";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AUTO_MODELLE, START_AUTO_ID, fluchtTempo, type Auto } from '@/lib/autos';
import { useAutos } from '@/lib/useAutos';
import { useStammdaten } from '@/lib/stammdaten';
import { fluchtStatement, type VerfolgungVorgabe } from '@/lib/verfolgung';
import { Hintergrundmusik } from './Hintergrundmusik';

function RennCanvas({ auto, flucht, spur, onStand, onEnde, onFehler, onBereit }: {
  auto: Auto; flucht: Auto; spur: React.MutableRefObject<number>;
  onStand: (speed: number, abstand: number, treffer: boolean) => void;
  onEnde: (gefangen: boolean) => void; onFehler: (text: string) => void;
  onBereit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onStand, onEnde, onFehler, onBereit });
  callbacks.current = { onStand, onEnde, onFehler, onBereit };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let beendet = false, bereit = false, frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091426);
    scene.fog = new THREE.Fog(0x15283e, 28, 95);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 130);
    // Gleiche Achsen und Blickrichtung wie Jump-and-Run; etwas weiter für zwei Autos.
    camera.position.set(-12.6, 7.3, 18.8);
    camera.lookAt(0, 0.8, 4);
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
      const baum = mesh(new THREE.ConeGeometry(1.4, 4, 5), i % 3 ? 0x4b8496 : 0xc8e6ed, x, 2, i * 4 - 25);
      kulisse.push(baum);
    }
    const spieler = new THREE.Group(), gegner = new THREE.Group();
    scene.add(spieler, gegner);
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
    }
    void Promise.all([laden(auto, spieler), laden(flucht, gegner)]).then(() => {
      if (!beendet) { bereit = true; callbacks.current.onBereit(); }
    }).catch(() => { if (!beendet) callbacks.current.onFehler('Ein Automodell konnte nicht geladen werden. Bitte erneut starten.'); });
    const hindernisse = Array.from({ length: 5 }, (_, i) => ({
      obj: mesh(new THREE.BoxGeometry(1.9, 0.9, 0.8), 0xf6a14b, (i % 3 - 1) * 3.4, 0.45, 65 + i * 70), getroffen: false,
    }));
    let speed = 0, fluchtSpeed = 0, abstand = 180, zeit = 0, ausgabe = 0, unverwundbar = 0, letzter = performance.now();
    const taste = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && e.target.closest('input,select,textarea'))) return;
      const delta = ['ArrowLeft', 'ArrowUp', 'a', 'w'].includes(e.key) ? -1 : ['ArrowRight', 'ArrowDown', 'd', 's'].includes(e.key) ? 1 : 0;
      if (delta) { e.preventDefault(); spur.current = THREE.MathUtils.clamp(spur.current + delta, -1, 1); }
    };
    window.addEventListener('keydown', taste);
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix(); renderer.setSize(element.clientWidth, element.clientHeight);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const verloren = (e: Event) => { e.preventDefault(); bereit = false; callbacks.current.onFehler('Grafik unterbrochen. Bitte Jagd erneut starten.'); };
    renderer.domElement.addEventListener('webglcontextlost', verloren);
    function zeichnen(jetzt: number) {
      if (beendet) return;
      frame = requestAnimationFrame(zeichnen);
      const dt = Math.min(0.04, (jetzt - letzter) / 1000); letzter = jetzt;
      if (document.hidden || !bereit) return;
      zeit += dt; unverwundbar = Math.max(0, unverwundbar - dt);
      speed = Math.min(auto.speed, speed + auto.beschleunigung * dt);
      const weg = speed / 3.6 * dt;
      fluchtSpeed = Math.min(fluchtTempo(flucht, zeit), fluchtSpeed + flucht.beschleunigung / 3.6 * dt);
      abstand += fluchtSpeed * dt - weg;
      spieler.position.x = THREE.MathUtils.damp(spieler.position.x, spur.current * 3.4, 7, dt);
      gegner.position.set(Math.sin(zeit * 0.65) > 0.4 ? 3.4 : 0, 0, 3.8 + Math.max(0, abstand) * 0.065);
      let treffer = false;
      for (const h of hindernisse) {
        const vorher = h.obj.position.z;
        h.obj.position.z -= weg;
        if (!h.getroffen && vorher > -2 && h.obj.position.z <= 2 && Math.abs(h.obj.position.x - spieler.position.x) < 1.8 && !unverwundbar) {
          speed *= 0.32; abstand += 14; unverwundbar = 1; treffer = true; h.getroffen = true;
        }
        if (h.obj.position.z < -15) { h.obj.position.z += 350; h.obj.position.x = (Math.floor(Math.random() * 3) - 1) * 3.4; h.getroffen = false; }
      }
      for (const m of markierungen) { m.position.z -= weg; if (m.position.z < -22) m.position.z += 100; }
      for (const b of kulisse) { b.position.z -= weg; if (b.position.z < -30) b.position.z += 112; }
      ausgabe += dt;
      if (ausgabe > 0.12 || treffer) { callbacks.current.onStand(Math.round(speed), Math.max(0, Math.round(abstand)), unverwundbar > 0); ausgabe = 0; }
      renderer.render(scene, camera);
      if (abstand <= 0 || abstand > 260 || zeit > 150) { bereit = false; callbacks.current.onEnde(abstand <= 0); }
    }
    frame = requestAnimationFrame(zeichnen);
    return () => {
      beendet = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', taste);
      renderer.domElement.removeEventListener('webglcontextlost', verloren);
      sammeln(scene); ressourcen.forEach(r => r.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, [auto, flucht, spur]);
  return <div className="jagd-canvas" ref={host} aria-label="Wimpy verfolgt den Fluchtwagen auf drei Spuren" />;
}

export function AutoJagd({ vorgabe, onFertig, autoId, besitz = {}, vorschau = false }: {
  vorgabe: VerfolgungVorgabe; onFertig: () => void; autoId?: string; besitz?: Record<string, number>; vorschau?: boolean;
}) {
  const { autos, fehler: katalogFehler } = useAutos();
  const stammdaten = useStammdaten();
  const [wahl, setWahl] = useState(autoId ?? START_AUTO_ID);
  const [fluchtId, setFluchtId] = useState(vorgabe.fluchtAutoId ?? 'auto-sport');
  const [rennen, setRennen] = useState<{ auto: Auto; flucht: Auto } | null>(null);
  const [phase, setPhase] = useState<'bereit' | 'jagd' | 'gefangen' | 'entkommen'>('bereit');
  const [fehler, setFehler] = useState('');
  const [bereit, setBereit] = useState(false);
  const [stand, setStand] = useState({ speed: 0, abstand: 180, treffer: false });
  const spur = useRef(0);
  const fliehender = stammdaten.charaktere.find(c => c.id === vorgabe.fliehenderId);
  const verfuegbar = autos.filter(a => vorschau || a.id === START_AUTO_ID || besitz[a.id]);
  const starten = () => {
    const auto = verfuegbar.find(a => a.id === wahl) ?? verfuegbar[0];
    const flucht = autos.find(a => a.id === (vorschau ? fluchtId : vorgabe.fluchtAutoId ?? 'auto-sport')) ?? autos[0];
    if (!auto || !flucht) { setFehler('Bitte zuerst ein Automodell im Admin-Menü hinterlegen.'); return; }
    spur.current = 0; setFehler(''); setBereit(false); setStand({ speed: 0, abstand: 180, treffer: false }); setRennen({ auto, flucht }); setPhase('jagd');
  };
  return <div className="jagd" data-treffer={stand.treffer}>
    {phase === 'jagd' && rennen && !fehler ? <>
      {vorgabe.musik && <Hintergrundmusik stueck={vorgabe.musik} />}
      <RennCanvas {...rennen} spur={spur} onBereit={() => setBereit(true)} onStand={(speed, abstand, treffer) => setStand({ speed, abstand, treffer })} onEnde={fang => setPhase(fang ? 'gefangen' : 'entkommen')} onFehler={setFehler} />
      {!bereit && <div className="auto-jagd-laden" role="status">Die Wagen werden bereitgestellt …</div>}
      <div className="auto-jagd-hud"><strong>WIMPY · {rennen.auto.name}</strong><span>{stand.speed} km/h · Abstand {stand.abstand} m</span>{stand.treffer && <b>REMPLER! TEMPO VERLOREN</b>}</div>
      <div className="auto-jagd-steuerung"><button aria-label="Eine Spur nach links" onClick={() => { spur.current = Math.max(-1, spur.current - 1); }}>◀</button><button aria-label="Eine Spur nach rechts" onClick={() => { spur.current = Math.min(1, spur.current + 1); }}>▶</button></div>
    </> : <div className="jagd-start auto-jagd-auswahl"><article className="jagd-startkarte">
      <span className="jagd-kicker">WIMPY · PURSUIT</span><h1>{phase === 'gefangen' ? 'EINGEHOLT!' : phase === 'entkommen' ? 'ENTKOMMEN!' : vorgabe.name}</h1>
      {phase === 'gefangen' ? <><h2>{fliehender?.name ?? vorgabe.fliehenderId}</h2><blockquote>„{fluchtStatement(vorgabe)}“</blockquote><button className="knopf aktion" onClick={onFertig}>Weiter ›</button></> : <>
        <p>Drei Spuren. Weiche den Hindernissen aus und hole den Fluchtwagen ein. Pfeiltasten oder die großen Touch-Tasten wechseln die Spur.</p>
        {phase === 'entkommen' && <p>Der Wagen ist entwischt. Versuche es erneut oder wähle einen anderen Wagen aus deiner Garage.</p>}
        <label className="feld">Wimpys Wagen<select value={verfuegbar.some(a => a.id === wahl) ? wahl : verfuegbar[0]?.id ?? ''} onChange={e => setWahl(e.target.value)}>{verfuegbar.map(a => <option key={a.id} value={a.id}>{a.name} · {a.speed} km/h · +{a.beschleunigung} km/h/s</option>)}</select></label>
        {vorschau && <label className="feld">Fluchtwagen<select value={fluchtId} onChange={e => setFluchtId(e.target.value)}>{autos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {(fehler || katalogFehler) && <p role="alert">{fehler || katalogFehler}</p>}
        <button className="knopf aktion" onClick={starten}>Verfolgung starten ›</button>
      </>}
    </article></div>}
  </div>;
}
