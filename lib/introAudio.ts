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
let freigabe: Promise<void> | null = null;

function hole(stueck: Stueck): HTMLAudioElement {
  let audio = spieler.get(stueck);
  if (!audio) {
    audio = new Audio(DATEIEN[stueck]);
    audio.preload = "auto";
    audio.dataset.stueck = stueck;
    // Im Dokument verankert, damit iOS das Element nicht wegräumt.
    audio.hidden = true;
    if (typeof document !== "undefined") document.body.appendChild(audio);
    spieler.set(stueck, audio);
  }
  return audio;
}

export const audioVon = (stueck: Stueck): HTMLAudioElement => hole(stueck);

/**
 * Im Klick-Handler aufrufen: gibt alle Stücke frei und lädt sie vor.
 *
 * Das Ergebnis wird gemerkt, damit ein späteres spiele() abwarten kann - sonst
 * könnte die Freigabe ein gerade gestartetes Stück wieder anhalten.
 */
export function tonFreigeben(): Promise<void> {
  freigabe = (async () => {
    await Promise.all(
      (Object.keys(DATEIEN) as Stueck[]).map(async (stueck) => {
        // Ein Stück, das gerade im Klick gestartet wurde, nicht wieder anhalten.
        if (stueck === laufend) return;
        const audio = hole(stueck);
        audio.muted = true;
        try {
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Blockiert der Browser, hilft später der "Ton an"-Knopf.
        }
        audio.muted = false;
      }),
    );
  })();
  return freigabe;
}

/**
 * Spielt ein Stück von vorn und stoppt alle anderen.
 * Gibt zurück, ob der Ton tatsächlich läuft.
 */
export async function spiele(stueck: Stueck): Promise<boolean> {
  const audio = hole(stueck);

  // Läuft es schon (z.B. direkt im Klick gestartet), nicht neu anstoßen.
  if (!audio.paused && audio.currentTime > 0) {
    stoppeAusser(stueck);
    return true;
  }

  // Erst die Freigabe abwarten - sie pausiert die Stücke absichtlich einmal.
  if (freigabe) {
    try {
      await freigabe;
    } catch {
      // egal, gleich wird es ohnehin versucht
    }
  }

  stoppeAusser(stueck);
  audio.muted = false;
  audio.currentTime = 0;
  laufend = stueck;

  try {
    await audio.play();
    return !audio.paused;
  } catch {
    // Blockiert der Browser, läuft die Szene stumm weiter.
    return false;
  }
}

/**
 * Startet ein Stück sofort und ohne Umweg - nur direkt aus einem Klick heraus
 * aufrufen. Auf iOS ist das der einzige verlässliche Weg, Ton zu bekommen.
 */
export function spieleSofort(stueck: Stueck): void {
  const audio = hole(stueck);
  stoppeAusser(stueck);
  audio.muted = false;
  audio.currentTime = 0;
  laufend = stueck;
  void audio.play().catch(() => {});
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
