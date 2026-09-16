"use client";

import { useEffect, useRef } from "react";

/**
 * Die Daumensteuerung.
 *
 * Sie stand im 3D-Kapitel, weil dort zum ersten Mal jemand mit dem Daumen
 * durch eine Stadt gelaufen ist. Inzwischen läuft man mit demselben Daumen
 * auch durch die Kampfarena des Arc-Finales - und ein Stick, den es zweimal
 * gibt, fühlt sich früher oder später an zwei Stellen verschieden an.
 *
 * Ein Finger, ein Knauf, keine Zustände im React-Baum: Was der Stick zeigt,
 * geht sofort ins Ref der Szene; was er anzeigt, ist ein `transform`. So
 * rendert das Spiel beim Laufen kein einziges Mal neu.
 */
export function TouchJoystick({ setzen }: { setzen: (x: number, z: number) => void }) {
  const knauf = useRef<HTMLSpanElement>(null);
  const finger = useRef<number | null>(null);
  const aktuell = useRef(setzen);
  aktuell.current = setzen;
  const stoppen = () => {
    finger.current = null;
    aktuell.current(0, 0);
    if (knauf.current) knauf.current.style.transform = "translate(0, 0)";
  };
  useEffect(() => {
    window.addEventListener("blur", stoppen);
    document.addEventListener("visibilitychange", stoppen);
    return () => {
      window.removeEventListener("blur", stoppen);
      document.removeEventListener("visibilitychange", stoppen);
      aktuell.current(0, 0);
    };
  }, []);
  const bewegen = (e: React.PointerEvent<HTMLDivElement>) => {
    if (finger.current !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    const radius = box.width * 0.3;
    const dx = e.clientX - box.left - box.width / 2;
    const dz = e.clientY - box.top - box.height / 2;
    const distanz = Math.hypot(dx, dz);
    const faktor = Math.min(1, radius / Math.max(1, distanz));
    if (knauf.current) knauf.current.style.transform = `translate(${dx * faktor}px, ${dz * faktor}px)`;
    const staerke = Math.max(0, (Math.min(1, distanz / radius) - 0.12) / 0.88);
    const x = dx / Math.max(1, distanz) * staerke;
    const z = dz / Math.max(1, distanz) * staerke;
    // Die Stickrichtung folgt dem Bildschirm trotz schräger Kamera.
    const kameraLaenge = Math.hypot(13.8, 9.5);
    aktuell.current((x * 13.8 - z * 9.5) / kameraLaenge, (x * 9.5 + z * 13.8) / kameraLaenge);
  };
  return <div className="saga3d-joystick" role="group" aria-label="Wimpy steuern: Joystick in die gewünschte Richtung ziehen"
    onPointerDown={(e) => { if (finger.current !== null) return; finger.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); bewegen(e); }}
    onPointerMove={bewegen}
    onPointerUp={(e) => { if (finger.current === e.pointerId) stoppen(); }}
    onPointerCancel={stoppen} onLostPointerCapture={stoppen}>
    <span className="saga3d-joystick-knauf" ref={knauf} aria-hidden="true" />
  </div>;
}
