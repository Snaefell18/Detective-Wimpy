/**
 * Der Showdown: die Rechnung hinter dem Kampf.
 *
 * Hier steht alles, was den Endkampf ausmacht, aber keine Grafikkarte
 * braucht: wie viel jeder aushält, wie viel ein Treffer wegnimmt, wie lange
 * eine Pause dauert - und vor allem, was der Gegner als Nächstes vorhat. Das
 * liegt bewusst neben der Szene und nicht in ihr: So lässt sich ein ganzer
 * Kampf durchrechnen und prüfen, ohne dass ein einziges Dreieck gezeichnet
 * wird (siehe tests/endkampf.test.mjs).
 *
 * Die Grundregel des Kampfes ist: **Nichts trifft ohne Ansage.** Der Gegner
 * holt sichtbar aus, und erst wenn er fertig ausgeholt hat, tut es weh. Wer
 * in dieser Zeit weggeht oder sich wegrollt, bleibt heil. Deshalb ist der
 * Kampf auch für ein Kind zu schaffen, ohne dass er langweilig wird.
 */

import type { AnimationsModell } from "./animations.generated";

/** Wie hart der Showdown ist. */
export type KampfStufe = "sanft" | "mittel" | "hart";

export const KAMPF_STUFEN: { id: KampfStufe; label: string; hinweis: string }[] = [
  { id: "sanft", label: "Sanft", hinweis: "für kleine Detektive - der Gegner holt lange aus" },
  { id: "mittel", label: "Mittel", hinweis: "der gedachte Normalfall" },
  { id: "hart", label: "Hart", hinweis: "mehr Leben, kürzere Pausen, dreifache Salven" },
];

export type KampfWerte = {
  /** Wimpys Lebensbalken. 110 sind neun Treffer auf mittlerer Stufe. */
  wimpyLeben: number;
  gegnerLeben: number;
  /** Wie schnell die beiden laufen, in Metern je Sekunde. */
  wimpyTempo: number;
  gegnerTempo: number;
  /** Was Wimpy austeilt. */
  schuss: number;
  schlag: number;
  /** Und was er einsteckt. */
  gegnerSchlag: number;
  gegnerZauber: number;
  gegnerStampf: number;
  /**
   * Wie lange der Gegner ausholt, bevor der Schlag einschlägt.
   *
   * Das ist die eigentliche Schwierigkeit des Kampfes: Diese Zeit hat man,
   * um wegzukommen. Eine Sekunde ist viel, eine halbe ist knapp.
   */
  ausholen: number;
  /** Wie lange er nach einem Angriff braucht, bis der nächste kommt. */
  pause: { min: number; max: number };
};

const WERTE: Record<KampfStufe, KampfWerte> = {
  sanft: {
    wimpyLeben: 120,
    gegnerLeben: 280,
    wimpyTempo: 4.6,
    gegnerTempo: 2.5,
    schuss: 8,
    schlag: 20,
    gegnerSchlag: 8,
    gegnerZauber: 6,
    gegnerStampf: 9,
    ausholen: 1.15,
    pause: { min: 1.5, max: 2.6 },
  },
  mittel: {
    wimpyLeben: 110,
    gegnerLeben: 400,
    wimpyTempo: 4.6,
    gegnerTempo: 3.1,
    schuss: 7,
    schlag: 18,
    gegnerSchlag: 12,
    gegnerZauber: 9,
    gegnerStampf: 13,
    ausholen: 0.9,
    pause: { min: 1.1, max: 2 },
  },
  hart: {
    wimpyLeben: 100,
    gegnerLeben: 560,
    wimpyTempo: 4.7,
    gegnerTempo: 3.6,
    schuss: 7,
    schlag: 17,
    gegnerSchlag: 16,
    gegnerZauber: 11,
    gegnerStampf: 17,
    ausholen: 0.72,
    pause: { min: 0.8, max: 1.5 },
  },
};

export const werteFuer = (stufe: KampfStufe | undefined): KampfWerte =>
  WERTE[stufe ?? "mittel"] ?? WERTE.mittel;

/**
 * Eine Stufe sanfter - oder nichts, wenn es schon die sanfteste ist.
 *
 * Gebraucht nach einer Niederlage: Wer zum dritten Mal im Staub liegt, soll
 * nicht ewig gegen dieselbe Wand laufen. Der Kampf wird dann eine Stufe
 * milder, und die Geschichte geht weiter. Eingestellt bleibt im Editor
 * trotzdem, was dort steht - das hier gilt nur für diesen einen Abend.
 */
export const leichtereStufe = (stufe: KampfStufe | undefined): KampfStufe | null =>
  stufe === "hart" ? "mittel" : (stufe ?? "mittel") === "mittel" ? "sanft" : null;

/* --- Feste Maße des Kampfes ---------------------------------------- */

/** Wie schnell Wimpy zaubern darf. Kurz genug, dass es sich flüssig anfühlt. */
export const SCHUSS_PAUSE = 0.42;
/** Der Nahkampf tut mehr weh und braucht deshalb länger. */
export const SCHLAG_PAUSE = 0.72;
/** Ab hier ist man nah genug für einen Schlag - und der Knopf schaltet um. */
export const SCHLAG_REICHWEITE = 3.2;
/** Die Rolle: kurz, schnell und in dieser Zeit unverwundbar. */
export const ROLLE_DAUER = 0.4;
export const ROLLE_PAUSE = 1.5;
export const ROLLE_TEMPO = 2.7;
/** Wie lange Wimpy nach einem Treffer blinkt und nichts abbekommt. */
export const SCHUTZ_ZEIT = 0.9;
/** Wie schnell die Zauberkugeln fliegen (Meter je Sekunde). */
export const SCHUSS_TEMPO = 18;
export const GEGNER_SCHUSS_TEMPO = 11;
/** Wie weit eine Kugel höchstens fliegt, bevor sie verpufft. */
export const SCHUSS_WEITE = 34;
/** Wie nah der Gegner an Wimpy sein muss, damit sein Schlag wirklich sitzt. */
export const GEGNER_SCHLAG_TREFFER = 3.6;
/** Der Radius der Stampf-Schockwelle. Sie erwischt auch, wer knapp danebensteht. */
export const STAMPF_RADIUS = 6;
/**
 * Ab wo er zaubert statt zu laufen.
 *
 * Bewusst knapp: Mit einer großen Reichweite bleibt er weit draußen stehen
 * und feuert - dann läuft der ganze Kampf auf Distanz ab, man sieht nichts
 * von seinem Modell und trifft ihn nur als Punkt am Horizont. Elf Meter sind
 * nah genug, dass er dabei sichtbar näher kommt.
 */
export const ZAUBER_REICHWEITE = 11;
/** Wie lange der Gegner nach einem Angriff noch steht, bevor er weiterläuft. */
export const NACHHALL = 0.45;
/** Der Schreckmoment beim Phasenwechsel - da steht er offen wie ein Scheunentor. */
export const BETAEUBT_ZEIT = 1.4;

export type GegnerAngriff = "schlag" | "zauber" | "stampf";

/**
 * Was der Gegner gerade tut.
 *
 *   "jagen"     - er läuft auf Wimpy zu.
 *   "ausholen"  - er hat sich entschieden; jetzt läuft die Vorwarnzeit.
 *   "nachhall"  - der Angriff ist heraus, er steht noch einen Moment offen.
 *   "betaeubt"  - beim Phasenwechsel: Er taumelt und kassiert doppelt.
 */
export type GegnerZustand = "jagen" | "ausholen" | "nachhall" | "betaeubt";

export type KampfStand = {
  werte: KampfWerte;
  wimpy: {
    leben: number;
    maxLeben: number;
    /** Restzeit der Unverwundbarkeit - nach einem Treffer und in der Rolle. */
    schutz: number;
    schussPause: number;
    schlagPause: number;
    rollePause: number;
    rolleRest: number;
    /** Wie viele Treffer am Stück sitzen, ohne selbst etwas abzubekommen. */
    kombo: number;
    /** Die höchste Kombo dieses Kampfes - sie steht am Ende auf der Karte. */
    besteKombo: number;
  };
  gegner: {
    leben: number;
    maxLeben: number;
    /** Ab der Hälfte wird er wütend: schneller, härter, dreifache Salven. */
    phase: 1 | 2;
    zustand: GegnerZustand;
    angriff: GegnerAngriff | null;
    /** Restzeit des aktuellen Zustands. */
    rest: number;
    /** Wartezeit bis zum nächsten Angriff. */
    pause: number;
  };
  /** Wie lange der Kampf schon läuft. */
  zeit: number;
  ergebnis: "laeuft" | "gewonnen" | "verloren";
};

export function neuerKampf(werte: KampfWerte): KampfStand {
  return {
    werte,
    wimpy: {
      leben: werte.wimpyLeben,
      maxLeben: werte.wimpyLeben,
      schutz: 0,
      schussPause: 0,
      schlagPause: 0,
      rollePause: 0,
      rolleRest: 0,
      kombo: 0,
      besteKombo: 0,
    },
    gegner: {
      leben: werte.gegnerLeben,
      maxLeben: werte.gegnerLeben,
      phase: 1,
      zustand: "jagen",
      angriff: null,
      // Ein paar ruhige Sekunden zum Ankommen, bevor der Erste losgeht.
      rest: 0,
      pause: 1.6,
    },
    zeit: 0,
    ergebnis: "laeuft",
  };
}

const runter = (wert: number, dt: number) => Math.max(0, wert - dt);

/**
 * Alle Uhren einen Schritt weiter.
 *
 * Getrennt vom Denken des Gegners, weil beides verschieden oft gebraucht
 * wird: Die Uhren laufen in jedem Bild, das Denken erst danach - und zwar
 * mit den schon abgelaufenen Zeiten.
 */
export function uhrWeiter(stand: KampfStand, dt: number): KampfStand {
  if (stand.ergebnis !== "laeuft") return stand;
  return {
    ...stand,
    zeit: stand.zeit + dt,
    wimpy: {
      ...stand.wimpy,
      schutz: runter(stand.wimpy.schutz, dt),
      schussPause: runter(stand.wimpy.schussPause, dt),
      schlagPause: runter(stand.wimpy.schlagPause, dt),
      rollePause: runter(stand.wimpy.rollePause, dt),
      rolleRest: runter(stand.wimpy.rolleRest, dt),
    },
    gegner: {
      ...stand.gegner,
      rest: runter(stand.gegner.rest, dt),
      pause: runter(stand.gegner.pause, dt),
    },
  };
}

/* --- Was Wimpy darf ------------------------------------------------- */

export const darfSchiessen = (stand: KampfStand): boolean =>
  stand.ergebnis === "laeuft" && stand.wimpy.schussPause <= 0 && stand.wimpy.rolleRest <= 0;

/** Der Nahkampf steht nur offen, wenn man wirklich davorsteht. */
export const darfSchlagen = (stand: KampfStand, abstand: number): boolean =>
  stand.ergebnis === "laeuft" &&
  stand.wimpy.schlagPause <= 0 &&
  stand.wimpy.rolleRest <= 0 &&
  abstand <= SCHLAG_REICHWEITE;

export const darfRollen = (stand: KampfStand): boolean =>
  stand.ergebnis === "laeuft" && stand.wimpy.rollePause <= 0 && stand.wimpy.rolleRest <= 0;

export const schussGesetzt = (stand: KampfStand): KampfStand => ({
  ...stand,
  wimpy: { ...stand.wimpy, schussPause: SCHUSS_PAUSE },
});

export const schlagGesetzt = (stand: KampfStand): KampfStand => ({
  ...stand,
  // Nach einem Schlag ist auch kurz kein Zauber drin, sonst hebeln sich die
  // beiden Knöpfe gegenseitig aus.
  wimpy: { ...stand.wimpy, schlagPause: SCHLAG_PAUSE, schussPause: Math.max(stand.wimpy.schussPause, 0.3) },
});

/** Die Rolle macht unverwundbar, solange sie läuft. */
export const rolleGesetzt = (stand: KampfStand): KampfStand => ({
  ...stand,
  wimpy: {
    ...stand.wimpy,
    rolleRest: ROLLE_DAUER,
    rollePause: ROLLE_PAUSE,
    schutz: Math.max(stand.wimpy.schutz, ROLLE_DAUER),
  },
});

/**
 * Die Kombo.
 *
 * Wer trifft, ohne getroffen zu werden, teilt mehr aus - bis zu anderthalb
 * mal so viel. Das ist die Belohnung fürs Ausweichen: Der Kampf geht schneller
 * zu Ende, wenn man sauber spielt, und niemand wird dafür bestraft, dass er
 * nur draufhält.
 */
export const wucht = (stand: KampfStand): number =>
  1 + Math.min(0.5, stand.wimpy.kombo * 0.04);

/** Ein betäubter Gegner steckt doppelt ein - dafür ist der Moment ja da. */
const BETAEUBT_FAKTOR = 2;

/**
 * Wimpy trifft.
 *
 * Zurück kommt der neue Stand, der tatsächliche Schaden (für die Zahl, die
 * hochfliegt) und ob der Gegner gerade in seine zweite Phase gekippt ist -
 * den Moment inszeniert die Szene mit allem, was sie hat.
 */
export function gegnerTreffen(
  stand: KampfStand,
  art: "schuss" | "schlag",
): { stand: KampfStand; schaden: number; phaseWechsel: boolean; erledigt: boolean } {
  if (stand.ergebnis !== "laeuft") return { stand, schaden: 0, phaseWechsel: false, erledigt: false };
  const grund = art === "schlag" ? stand.werte.schlag : stand.werte.schuss;
  const schaden = Math.round(
    grund * wucht(stand) * (stand.gegner.zustand === "betaeubt" ? BETAEUBT_FAKTOR : 1),
  );
  const leben = Math.max(0, stand.gegner.leben - schaden);
  const haelfte = stand.gegner.maxLeben / 2;
  const phaseWechsel = stand.gegner.phase === 1 && leben <= haelfte && leben > 0;
  const kombo = stand.wimpy.kombo + 1;
  return {
    schaden,
    phaseWechsel,
    erledigt: leben <= 0,
    stand: {
      ...stand,
      ergebnis: leben <= 0 ? "gewonnen" : stand.ergebnis,
      wimpy: { ...stand.wimpy, kombo, besteKombo: Math.max(stand.wimpy.besteKombo, kombo) },
      gegner: {
        ...stand.gegner,
        leben,
        phase: phaseWechsel ? 2 : stand.gegner.phase,
        // Der Phasenwechsel wirft ihn aus allem heraus, was er gerade vorhatte.
        zustand: phaseWechsel ? "betaeubt" : stand.gegner.zustand,
        angriff: phaseWechsel ? null : stand.gegner.angriff,
        rest: phaseWechsel ? BETAEUBT_ZEIT : stand.gegner.rest,
        pause: phaseWechsel ? BETAEUBT_ZEIT + 0.4 : stand.gegner.pause,
      },
    },
  };
}

/**
 * Und andersherum.
 *
 * Wer Schutz hat - frisch getroffen oder mitten in der Rolle -, bekommt
 * nichts ab. Das ist kein Nebenweg, sondern das ganze Spiel: Ausweichen wird
 * belohnt, und nach einem Treffer hat man einen Moment Luft.
 */
export function wimpyTreffen(
  stand: KampfStand,
  schaden: number,
): { stand: KampfStand; getroffen: boolean } {
  if (stand.ergebnis !== "laeuft" || stand.wimpy.schutz > 0) return { stand, getroffen: false };
  const leben = Math.max(0, stand.wimpy.leben - Math.round(schaden));
  return {
    getroffen: true,
    stand: {
      ...stand,
      ergebnis: leben <= 0 ? "verloren" : stand.ergebnis,
      wimpy: { ...stand.wimpy, leben, schutz: SCHUTZ_ZEIT, kombo: 0 },
    },
  };
}

/* --- Was der Gegner vorhat ------------------------------------------ */

/** In der zweiten Phase ist alles eine Spur schneller und kürzer. */
const phasenFaktor = (phase: 1 | 2) => (phase === 2 ? 0.78 : 1);

export const gegnerTempo = (stand: KampfStand): number =>
  stand.werte.gegnerTempo * (stand.gegner.phase === 2 ? 1.25 : 1) *
  // Wer ausholt, steht. Sonst liefe er einem in den Schlag hinein, und man
  // sähe nie, was gleich passiert.
  (stand.gegner.zustand === "jagen" ? 1 : 0);

/** Wie viele Kugeln eine Salve hat. Wütend werden heißt: dreifach. */
export const salvenBreite = (stand: KampfStand): number => (stand.gegner.phase === 2 ? 3 : 1);

const pauseAus = (stand: KampfStand, zufall: () => number) => {
  const { min, max } = stand.werte.pause;
  return (min + (max - min) * zufall()) * phasenFaktor(stand.gegner.phase);
};

/**
 * Was er als Nächstes versucht.
 *
 * Nah dran wird geschlagen, weiter weg gezaubert - und in der zweiten Phase
 * stampft er ab und zu auf, statt zu schlagen: Die Welle erwischt auch den,
 * der gerade einen Schritt zurückgegangen ist.
 */
export function angriffWaehlen(
  phase: 1 | 2,
  abstand: number,
  zufall: () => number = Math.random,
): GegnerAngriff | null {
  if (abstand <= GEGNER_SCHLAG_TREFFER) {
    return phase === 2 && zufall() < 0.35 ? "stampf" : "schlag";
  }
  if (abstand <= ZAUBER_REICHWEITE) return "zauber";
  // Zu weit weg: Er läuft erst einmal weiter.
  return null;
}

/**
 * Ein Denkschritt.
 *
 * `ausloesen` ist der Moment, in dem es wirklich weh tut - die Szene lässt
 * dann die Welle laufen oder die Kugeln fliegen. Vorher steht nur, dass er
 * ausholt; genau das sieht man ihm an.
 */
export function gegnerDenken(
  stand: KampfStand,
  args: { abstand: number; zufall?: () => number },
): { stand: KampfStand; ausloesen: GegnerAngriff | null } {
  const { abstand, zufall = Math.random } = args;
  if (stand.ergebnis !== "laeuft") return { stand, ausloesen: null };
  const gegner = stand.gegner;

  if (gegner.zustand === "betaeubt" || gegner.zustand === "nachhall") {
    if (gegner.rest > 0) return { stand, ausloesen: null };
    return { stand: { ...stand, gegner: { ...gegner, zustand: "jagen", angriff: null } }, ausloesen: null };
  }

  if (gegner.zustand === "ausholen") {
    if (gegner.rest > 0) return { stand, ausloesen: null };
    return {
      ausloesen: gegner.angriff,
      stand: {
        ...stand,
        gegner: {
          ...gegner,
          zustand: "nachhall",
          rest: NACHHALL,
          pause: pauseAus(stand, zufall),
        },
      },
    };
  }

  // "jagen": Er läuft, bis die Pause abgelaufen ist und er nah genug steht.
  if (gegner.pause > 0) return { stand, ausloesen: null };
  const angriff = angriffWaehlen(gegner.phase, abstand, zufall);
  if (!angriff) return { stand, ausloesen: null };
  return {
    ausloesen: null,
    stand: {
      ...stand,
      gegner: {
        ...gegner,
        zustand: "ausholen",
        angriff,
        rest: stand.werte.ausholen * phasenFaktor(gegner.phase),
      },
    },
  };
}

/** Wie weit die Ausholbewegung ist: 0 gerade begonnen, 1 gleich schlägt es ein. */
export const ausholFortschritt = (stand: KampfStand): number => {
  if (stand.gegner.zustand !== "ausholen") return 0;
  const ganz = stand.werte.ausholen * phasenFaktor(stand.gegner.phase);
  return ganz > 0 ? Math.min(1, 1 - stand.gegner.rest / ganz) : 1;
};

/** Der Schaden eines ausgelösten Angriffs. */
export const angriffSchaden = (stand: KampfStand, angriff: GegnerAngriff): number =>
  angriff === "schlag"
    ? stand.werte.gegnerSchlag
    : angriff === "stampf"
      ? stand.werte.gegnerStampf
      : stand.werte.gegnerZauber;

/* --- Welche Animation wozu passt ------------------------------------ */

/**
 * Die Modelle bringen mit, was sie mitbringen.
 *
 * Wimpy hat einen Baseballwurf - der ist der Zauberwurf. Der Yeti hat ein
 * wütendes Aufstampfen - das ist die Schockwelle. Andere Modelle haben
 * vielleicht nur "Walking". Deshalb wird hier nicht nach festen Namen
 * gesucht, sondern nach dem, was ein Name verrät, und am Ende bleibt immer
 * etwas übrig: Lieber dieselbe Pose zweimal als eine Figur, die einfriert.
 */
export type KampfClips = {
  lauf: string | null;
  ruhe: string | null;
  /** Nahkampf: zuschlagen, treten, aufstampfen. */
  schlag: string | null;
  /** Zaubern und Werfen - alles, was die Arme nach vorn bringt. */
  wurf: string | null;
  /** Nach dem Sieg wird getanzt. */
  jubel: string | null;
  /**
   * Und wenn einer am Boden liegt.
   *
   * Nicht jedes Modell hat so etwas - viele kennen nur Laufen und Tanzen.
   * Fehlt der Clip, kippt die Figur trotzdem um: Das macht die Szene selbst,
   * mit Drehung und Absacken. Der Clip ist die Kür, das Umkippen die Pflicht.
   */
  besiegt: string | null;
};

const MUSTER = {
  lauf: /(run|sprint|jog|laufen|rennen)/i,
  gehen: /(walk|gehen)/i,
  ruhe: /(idle|rest|t.?pose)/i,
  wurf: /(pitch|throw|baseball|golf|cast|magic|zauber|wurf|shoot)/i,
  schlag: /(punch|kick|attack|stomp|slam|swing|hit|charge|angry|smash|shuffle)/i,
  jubel: /(dance|ymca|shake|funny|breakdance|muscle|heart|cheer|salsa|samba|rumba)/i,
  /*
   * Was nach einer verlorenen Runde aussieht: umgehauen werden, nach Luft
   * ringen, einschlafen, zusammensacken. Bewusst eng gefasst - „down" allein
   * stünde auch in „Male_Head_Down_Charge", und das ist ein Angriff.
   */
  besiegt: /(knock.?down|defeat|death|dying|\bdie\b|faint|\bko\b|catching.?breath|sleep|collaps|stunned|hurt)/i,
};

export function kampfClips(namen: string[]): KampfClips {
  const finde = (muster: RegExp, ausser: (string | null)[] = []) =>
    namen.find((name) => muster.test(name) && !ausser.includes(name)) ?? null;

  const lauf = finde(MUSTER.lauf) ?? finde(MUSTER.gehen);
  const ruhe = finde(MUSTER.ruhe);
  const besiegt = finde(MUSTER.besiegt, [lauf, ruhe]);
  const wurf = finde(MUSTER.wurf, [lauf, ruhe, besiegt]);
  const schlag = finde(MUSTER.schlag, [lauf, ruhe, wurf, besiegt]) ?? wurf;
  const jubel = finde(MUSTER.jubel, [lauf, ruhe, besiegt]) ?? ruhe;
  return {
    lauf: lauf ?? namen[0] ?? null,
    ruhe: ruhe ?? namen[0] ?? null,
    schlag: schlag ?? lauf ?? namen[0] ?? null,
    wurf: wurf ?? schlag ?? lauf ?? namen[0] ?? null,
    jubel: jubel ?? namen[0] ?? null,
    // Hier ausdrücklich ohne Ersatz: Lieber gar kein Clip als ein Tanz,
    // während der Verlierer zu Boden geht.
    besiegt,
  };
}

/** Dasselbe für ein Modell aus der erzeugten Liste - bequem für die Szene. */
export const clipsFuerModell = (modell: AnimationsModell | undefined): KampfClips =>
  kampfClips(modell?.animationen ?? []);
