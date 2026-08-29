"use client";

/**
 * Tonspur des Spiels: Prolog, Titelsong und Siegermusik.
 *
 * Alles läuft über einen kleinen Manager außerhalb von React. Zwei Gründe:
 *
 * 1. Es darf immer nur ein Stück spielen. Vorher konnten sich Erzähler und
 *    Titelsong überlagern, weil zwei Bildschirme gleichzeitig abspielten.
 * 2. Browser erlauben Abspielen nur als Folge einer Nutzergeste. Deshalb
 *    werden im Klick alle Stücke einmal kurz "angetippt" - danach dürfen sie
 *    auch später starten, etwa nachdem der Fall erzeugt wurde.
 */

export type Stueck = "prolog" | "intro" | "jubel";

const DATEIEN: Record<Stueck, string> = {
  prolog: "/audio/introdark.mp3",
  intro: "/audio/intro.mp3",
  jubel: "/audio/winner.mp3",
};

const spieler = new Map<Stueck, HTMLAudioElement>();
let laufend: Stueck | null = null;

function hole(stueck: Stueck): HTMLAudioElement {
  let audio = spieler.get(stueck);
  if (!audio) {
    audio = new Audio(DATEIEN[stueck]);
    audio.preload = "auto";
    spieler.set(stueck, audio);
  }
  return audio;
}

export const audioVon = (stueck: Stueck): HTMLAudioElement => hole(stueck);

/** Im Klick-Handler aufrufen: gibt alle Stücke frei und lädt sie vor. */
export function tonFreigeben(): void {
  for (const stueck of Object.keys(DATEIEN) as Stueck[]) {
    const audio = hole(stueck);
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }
}

/**
 * Spielt ein Stück von vorn und stoppt alle anderen.
 * Gibt zurück, ob der Ton tatsächlich läuft.
 */
export async function spiele(stueck: Stueck): Promise<boolean> {
  stoppeAusser(stueck);

  const audio = hole(stueck);
  audio.currentTime = 0;
  laufend = stueck;

  try {
    await audio.play();
    return true;
  } catch {
    // Blockiert der Browser, läuft die Szene stumm weiter.
    return false;
  }
}

/** Hält ein Stück an (oder alle, wenn keins genannt ist). */
export function stoppe(stueck?: Stueck): void {
  const betroffen = stueck ? [stueck] : ([...spieler.keys()] as Stueck[]);
  for (const name of betroffen) {
    const audio = spieler.get(name);
    if (!audio) continue;
    audio.pause();
    audio.currentTime = 0;
    if (laufend === name) laufend = null;
  }
}

function stoppeAusser(behalten: Stueck): void {
  for (const [name, audio] of spieler) {
    if (name === behalten) continue;
    audio.pause();
    audio.currentTime = 0;
  }
}

/** Läuft dieses Stück gerade hörbar? */
export const laeuft = (stueck: Stueck): boolean => {
  const audio = spieler.get(stueck);
  return Boolean(audio && !audio.paused && audio.currentTime > 0);
};

/** Spielzeit und Länge - daran hängen die Animationen. */
export function stand(stueck: Stueck): { zeit: number; dauer: number | null } {
  const audio = spieler.get(stueck);
  if (!audio) return { zeit: 0, dauer: null };
  return {
    zeit: audio.currentTime,
    dauer: Number.isFinite(audio.duration) && audio.duration > 1 ? audio.duration : null,
  };
}
