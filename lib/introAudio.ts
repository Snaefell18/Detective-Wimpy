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

/**
 * Die festen Stücke des Spiels - und daneben jeder Pfad in /public/audio.
 * So kann ein Arc seinen eigenen Titelsong mitbringen, ohne dass der Manager
 * davon wissen muss: Der Pfad ist zugleich sein Schlüssel.
 */
export type FestesStueck = "prolog" | "intro" | "jubel";
export type Stueck = FestesStueck | `/${string}`;

const DATEIEN: Record<FestesStueck, string> = {
  prolog: "/audio/introdark.mp3",
  intro: "/audio/intro.mp3",
  jubel: "/audio/winner.mp3",
};

/** Der Pfad zu einem Stück - eigene Dateien sind ihr eigener Schlüssel. */
const dateiVon = (stueck: Stueck): string =>
  stueck in DATEIEN ? DATEIEN[stueck as FestesStueck] : stueck;

const spieler = new Map<Stueck, HTMLAudioElement>();
let laufend: Stueck | null = null;
let freigabe: Promise<void> | null = null;

function hole(stueck: Stueck): HTMLAudioElement {
  let audio = spieler.get(stueck);
  if (!audio) {
    audio = new Audio(dateiVon(stueck));
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
 * Warum überhaupt: iOS erlaubt hörbares Abspielen nur als Folge einer
 * Nutzergeste, und zwar je Audio-Element. Ein Stück, das nie in einer Geste
 * angespielt wurde, bleibt später still - stumm anzuspielen zählt nicht, denn
 * stummes Abspielen ist ohnehin erlaubt und hebt die Sperre nicht auf.
 *
 * Damit dabei nichts zu hören ist, gleich zwei Vorkehrungen: die Lautstärke
 * geht auf null (greift überall außer auf iOS, wo sie schreibgeschützt ist),
 * und play() wird nicht abgewartet, sondern im selben Tick wieder pausiert.
 *
 * Und vor allem: Jedes Stück wird nur EINMAL freigegeben. Sonst tippt jeder
 * spätere Klick die Siegermusik erneut an - genau das war zu hören, wenn man
 * den Täter benannt hatte und die Auflösung noch gar nicht stand.
 */
const freigegeben = new Set<Stueck>();

export function tonFreigeben(): Promise<void> {
  const offen = (Object.keys(DATEIEN) as Stueck[]).filter(
    // Was schon frei ist, wird nicht noch einmal angetippt. Und ein Stück,
    // das gerade in diesem Klick gestartet wurde, erst recht nicht.
    (stueck) => stueck !== laufend && !freigegeben.has(stueck),
  );
  if (offen.length === 0) return freigabe ?? Promise.resolve();

  const laeuft = offen.map((stueck) => {
    const audio = hole(stueck);
    audio.muted = false;
    const lautstaerke = audio.volume;
    audio.volume = 0;

    const versuch = audio
      .play()
      .then(() => {
        freigegeben.add(stueck);
      })
      .catch((grund: unknown) => {
        // AbortError heißt: Abspielen war erlaubt, wir haben es selbst
        // unterbrochen - das Stück ist also frei. NotAllowedError heißt
        // blockiert; dann hilft später der "Ton an"-Knopf oder die nächste
        // Geste, bei der es erneut versucht wird.
        if ((grund as { name?: string })?.name === "AbortError") {
          freigegeben.add(stueck);
        }
      })
      .finally(() => {
        audio.volume = lautstaerke;
      });

    audio.pause();
    audio.currentTime = 0;
    return versuch;
  });

  freigabe = Promise.all(laeuft).then(() => {
    // play() kann nach dem pause() noch durchlaufen - sicherheitshalber
    // alles anhalten, was nicht bewusst gestartet wurde.
    for (const [name, audio] of spieler) {
      if (name === laufend) continue;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    }
  });
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
