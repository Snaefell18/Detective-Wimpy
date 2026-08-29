"use client";

/**
 * Der Titelsong lebt in einem einzigen Audio-Element außerhalb von React.
 *
 * Hintergrund: Safari und Chrome erlauben Abspielen nur als Folge einer
 * Nutzergeste. Das Intro startet aber erst, wenn der Fall fertig erzeugt ist -
 * also mehrere Sekunden nach dem Klick. Deshalb wird das Element schon im
 * Klick-Handler kurz "angetippt" (stumm starten, sofort anhalten). Danach gilt
 * es als freigegeben und darf später jederzeit spielen.
 */

let audio: HTMLAudioElement | null = null;
let jubel: HTMLAudioElement | null = null;
let prolog: HTMLAudioElement | null = null;

export function introAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/audio/intro.mp3");
    audio.preload = "auto";
  }
  return audio;
}

/** Der gesprochene Prolog vor dem Intro (public/audio/introdark.mp3). */
export function prologAudio(): HTMLAudioElement {
  if (!prolog) {
    prolog = new Audio("/audio/introdark.mp3");
    prolog.preload = "auto";
  }
  return prolog;
}

/**
 * Siegermusik für den gelösten Fall (public/audio/winner.mp3).
 * Fehlt die Datei, passiert einfach nichts.
 */
export function jubelSpielen(): void {
  if (!jubel) {
    jubel = new Audio("/audio/winner.mp3");
    jubel.preload = "auto";
  }
  jubel.currentTime = 0;
  void jubel.play().catch(() => {});
}

/** Beendet beide Stücke - z.B. beim Verlassen des Ergebnisses. */
export function musikStoppen(): void {
  for (const stueck of [audio, jubel, prolog]) {
    if (!stueck) continue;
    stueck.pause();
    stueck.currentTime = 0;
  }
}

/**
 * Im Klick-Handler aufrufen: gibt das Abspielen frei und lädt schon mal vor.
 *
 * Wichtig: hier kein load() aufrufen - das bricht das gerade gestartete play()
 * ab, und die Freigabe wäre wirkungslos.
 */
export function tonFreigeben(): void {
  // Beide Stücke freigeben: erst spricht der Prolog, dann läuft der Song.
  for (const a of [prologAudio(), introAudio()]) {
    a.muted = true;
    void a
      .play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
  }
}
