"use client";

import { tonQuelle } from "./stimme";

/**
 * Hintergrundmusik - das Stück, das leise weiterläuft, während man ermittelt.
 *
 * Bewusst außerhalb von lib/introAudio.ts und mit einem eigenen Element:
 * Der Prolog, der Titelsong und die Siegermusik halten sich gegenseitig an,
 * die Hintergrundmusik aber soll von alldem unberührt bleiben. Sie wird nur
 * dort angehalten, wo eine Szene ihre eigene Musik mitbringt - und dann an
 * derselben Stelle fortgesetzt, nicht neu begonnen.
 *
 * Alles daran ist optional: Ohne ausgewähltes Stück passiert schlicht nichts.
 * Verweigert der Browser das Abspielen (auf dem Handy ist Ton nur nach einer
 * Berührung erlaubt), wird es bei der nächsten Berührung noch einmal
 * versucht - und wenn es nie klappt, spielt man eben ohne Musik weiter.
 */

/** Leise genug, dass Erzähltext und Gespräche vorne bleiben. */
const LAUTSTAERKE = 0.28;
/** Wie lange ein Ein- oder Ausblenden dauert. */
const BLENDE = 700;

let audio: HTMLAudioElement | null = null;
/** Welcher Wert gerade geladen ist - der Pfad aus den Vorgaben, nicht die Quelle. */
let gewaehlt = "";
let blende = 0;
/** Wartet auf die nächste Berührung, weil der Browser gerade abgelehnt hat. */
let wartetAufGeste = false;

function element(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.hidden = true;
    // Im Dokument verankert, damit iOS das Element nicht wegräumt.
    document.body.appendChild(audio);
  }
  return audio;
}

/** Sanft auf einen Wert fahren - harte Sprünge hört man unangenehm. */
function blenden(ziel: number, fertig?: () => void): void {
  const a = audio;
  if (!a) return;
  window.clearInterval(blende);
  const start = a.volume;
  const beginn = performance.now();
  blende = window.setInterval(() => {
    const anteil = Math.min(1, (performance.now() - beginn) / BLENDE);
    a.volume = Math.max(0, Math.min(1, start + (ziel - start) * anteil));
    if (anteil >= 1) {
      window.clearInterval(blende);
      fertig?.();
    }
  }, 40);
}

/**
 * Noch einmal versuchen, sobald der Spieler das nächste Mal etwas berührt.
 * Ein einziger Horcher, der sich selbst wieder abmeldet.
 */
function beiNaechsterGeste(): void {
  if (wartetAufGeste || typeof document === "undefined") return;
  wartetAufGeste = true;
  const nochmal = () => {
    document.removeEventListener("pointerdown", nochmal);
    wartetAufGeste = false;
    if (gewaehlt) void starten();
  };
  document.addEventListener("pointerdown", nochmal, { once: true });
}

async function starten(): Promise<void> {
  const a = element();
  if (!a || !a.src) return;
  try {
    await a.play();
    blenden(LAUTSTAERKE);
  } catch {
    // Der Browser will eine Berührung sehen - dann eben beim nächsten Tippen.
    beiNaechsterGeste();
  }
}

/**
 * Dieses Stück spielen. Derselbe Wert wie beim letzten Mal setzt nur fort,
 * ein neuer beginnt von vorn. Ein leerer Wert hält an.
 */
export function musikSpielen(wert: string): void {
  const stueck = (wert ?? "").trim();
  if (!stueck) {
    musikPausieren();
    return;
  }

  const a = element();
  if (!a) return;

  if (stueck === gewaehlt && a.src) {
    // Dasselbe Stück wie vorher: da weitermachen, wo es aufgehört hat.
    if (a.paused) void starten();
    else blenden(LAUTSTAERKE);
    return;
  }

  gewaehlt = stueck;
  void tonQuelle(stueck)
    .then((quelle) => {
      // In der Zwischenzeit kann längst etwas anderes gewählt worden sein.
      if (!quelle || gewaehlt !== stueck || !audio) return;
      audio.src = quelle;
      audio.volume = 0;
      void starten();
    })
    .catch(() => {
      // Kein Stück gefunden - dann bleibt es still.
    });
}

/** Anhalten, aber die Stelle merken: Weiter geht es später genau dort. */
export function musikPausieren(): void {
  const a = audio;
  if (!a || a.paused) return;
  blenden(0, () => a.pause());
}

/** Ganz aus - zum Beispiel, wenn der Fall vorbei ist. */
export function musikAus(): void {
  const a = audio;
  gewaehlt = "";
  if (!a) return;
  window.clearInterval(blende);
  a.pause();
  a.removeAttribute("src");
  a.volume = 0;
}
