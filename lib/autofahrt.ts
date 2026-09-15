/**
 * Wie sich Wimpys Wagen in der 3D-Stadt fährt.
 *
 * Bisher war das Auto ein schnellerer Fußgänger: Stick in eine Richtung, und
 * der Wagen stand sofort dort. Ein Auto soll sich aber wie ein Auto anfühlen -
 * es zieht an, es trägt, es rutscht in die Kurve und es braucht einen Moment,
 * bis es steht. Genau das steht hier, und zwar als reine Rechnung ohne
 * Three.js: So lässt sich das Fahrgefühl prüfen, ohne eine Grafikkarte zu
 * starten - und nachstellen, ohne die Szene anzufassen.
 *
 * Die Steuerung ist mit Absicht arcadig und nicht simuliert: Der Stick zeigt,
 * wohin es gehen soll, der Wagen dreht sich dorthin und gibt Gas. Wer den
 * Stick nach hinten drückt, bremst - erst wenn der Wagen steht, setzt er
 * zurück. Das ist auf einem Handy mit dem Daumen zu treffen; ein echtes
 * Lenkrad wäre es nicht.
 */

export type Fahrzustand = {
  /** Wohin der Wagen schaut, in Radiant (0 = nach +z). */
  winkel: number;
  /** Tempo entlang der Blickrichtung, in Metern je Sekunde. */
  tempo: number;
  /** Seitliches Rutschen in Metern je Sekunde - das ist der Drift. */
  drift: number;
};

export const STILLSTAND: Fahrzustand = { winkel: 0, tempo: 0, drift: 0 };

export type FahrWerte = {
  /** Höchstgeschwindigkeit in Metern je Sekunde. */
  hoechst: number;
  /** Wie kräftig er anzieht, in m/s². */
  schub: number;
  /** Wie hart die Bremse zupackt. */
  bremse: number;
  /** Wie schnell er rückwärts fährt. */
  rueckwaerts: number;
  /** Wie schnell er sich dreht, in Radiant je Sekunde. */
  lenkung: number;
  /** Wie gut die Reifen halten - klein heißt: rutscht lange. */
  griff: number;
};

/** Zu Fuß sind es gut vier Meter je Sekunde - daran misst sich alles. */
export const SCHRITT_TEMPO = 4.1;

/**
 * Aus den Werten des Autokatalogs werden Stadtwerte.
 *
 * 155 km/h wären 43 Meter je Sekunde - in einer Stadt aus neun Meter breiten
 * Feldern wäre man damit in einer Sekunde durch drei Kreuzungen. Das Tempo
 * wird deshalb gestaucht, aber die Unterschiede zwischen den Wagen bleiben
 * erhalten: Der schnellere ist auch hier der schnellere.
 */
export function fahrwerte(auto: { speed: number; beschleunigung: number }): FahrWerte {
  const schnell = klemm((Number(auto.speed) || 120) / 320, 0.15, 1);
  const zieht = klemm((Number(auto.beschleunigung) || 25) / 100, 0.05, 1);
  const hoechst = 9 + schnell * 12;
  return {
    hoechst,
    // Von null auf Höchsttempo in gut zwei bis vier Sekunden - arcadig, nicht
    // realistisch: Wer Gas gibt, soll es sofort merken.
    schub: hoechst / (2.6 - zieht * 1.2),
    bremse: hoechst * 1.35,
    rueckwaerts: Math.min(6, hoechst * 0.38),
    // Schwere, schnelle Wagen lenken träger - das macht den Unterschied
    // zwischen "wendig" und "Rakete" spürbar.
    lenkung: 3.4 - schnell * 1.1,
    griff: 5.2 - schnell * 1.6,
  };
}

const klemm = (wert: number, min: number, max: number) => Math.max(min, Math.min(max, wert));

/** Der kürzeste Weg von einem Winkel zum anderen, immer zwischen -PI und PI. */
export function winkelDifferenz(von: number, nach: number): number {
  return ((nach - von + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export type FahrEingabe = {
  /** Stickrichtung in Weltkoordinaten, Länge 0 bis 1. */
  x: number;
  z: number;
  /** Handbremse: löst den Hinterwagen, damit er um die Ecke rutscht. */
  handbremse?: boolean;
};

/**
 * Ein Zeitschritt.
 *
 * Zurück kommt der neue Zustand und die Strecke, die der Wagen in diesem
 * Schritt zurücklegt - wohin er damit tatsächlich darf, entscheidet die
 * Stadt, nicht die Physik.
 */
export function fahrSchritt(
  zustand: Fahrzustand,
  eingabe: FahrEingabe,
  dt: number,
  werte: FahrWerte,
): { zustand: Fahrzustand; bewegung: { x: number; z: number } } {
  const schritt = Math.min(0.05, Math.max(0.001, dt));
  const staerke = Math.min(1, Math.hypot(eingabe.x, eingabe.z));
  let { winkel, tempo, drift } = zustand;

  if (staerke > 0.08) {
    const ziel = Math.atan2(eingabe.x, eingabe.z);
    const differenz = winkelDifferenz(winkel, ziel);
    const zurueck = Math.abs(differenz) > 2.2;

    if (zurueck && tempo > 0.6) {
      // Der Stick zeigt nach hinten, der Wagen fährt noch vorwärts: bremsen.
      tempo = Math.max(0, tempo - werte.bremse * staerke * schritt);
    } else if (zurueck) {
      // Steht er, geht es rückwärts - langsam, wie es sich gehört.
      tempo = Math.max(-werte.rueckwaerts, tempo - werte.schub * 0.6 * staerke * schritt);
    } else {
      /*
       * Gas. Der Schub lässt oben spürbar nach, damit sich die letzten
       * Stundenkilometer nach etwas anfühlen, statt einfach dazuzukommen.
       */
      const anteil = klemm(Math.abs(tempo) / werte.hoechst, 0, 1);
      tempo += werte.schub * staerke * (1 - anteil * 0.55) * schritt;
    }

    /*
     * Lenken. Langsam dreht er fast auf der Stelle, schnell zieht er weite
     * Bögen - und rückwärts andersherum, sonst stimmt das Gefühl nicht.
     */
    if (!zurueck || tempo < 0) {
      const flott = klemm(Math.abs(tempo) / werte.hoechst, 0, 1);
      const rate = werte.lenkung * (1 - flott * 0.55) * (eingabe.handbremse ? 1.45 : 1);
      // Im Stand lenkt niemand - aber schon das Anfahren soll gehorchen.
      const wirkung = klemm(Math.abs(tempo) / 1.6, 0, 1);
      const drehung = klemm(differenz, -rate * schritt, rate * schritt) * wirkung * Math.sign(tempo || 1);
      winkel += drehung;
      /*
       * Was der Wagen an Richtung gewinnt, verliert er einen Moment lang zur
       * Seite: Er rutscht. Das ist der ganze Zauber an einer Arcade-Kurve -
       * und mit Handbremse bricht er richtig aus.
       */
      drift += drehung * Math.abs(tempo) * (eingabe.handbremse ? 2.6 : 0.85);
    }
  } else {
    // Kein Gas: Er rollt aus, statt stehen zu bleiben.
    const rollen = werte.schub * 0.45 * schritt;
    tempo = tempo > 0 ? Math.max(0, tempo - rollen) : Math.min(0, tempo + rollen);
  }

  tempo = klemm(tempo, -werte.rueckwaerts, werte.hoechst);
  // Die Reifen finden wieder Halt - mit gezogener Handbremse langsamer.
  const halt = werte.griff * (eingabe.handbremse ? 0.3 : 1);
  drift -= drift * Math.min(1, halt * schritt);
  if (Math.abs(drift) < 0.01) drift = 0;

  const vor = { x: Math.sin(winkel), z: Math.cos(winkel) };
  const quer = { x: Math.cos(winkel), z: -Math.sin(winkel) };
  return {
    zustand: { winkel, tempo, drift },
    bewegung: {
      x: (vor.x * tempo + quer.x * drift) * schritt,
      z: (vor.z * tempo + quer.z * drift) * schritt,
    },
  };
}

/**
 * Gegen eine Wand gefahren.
 *
 * Kein harter Stopp: Der Wagen verliert Schwung und rutscht an der Wand
 * entlang weiter. Anhalten müsste man selbst können, nicht die Mauer.
 */
export function angeeckt(zustand: Fahrzustand): Fahrzustand {
  return { ...zustand, tempo: zustand.tempo * 0.45, drift: zustand.drift * 0.3 };
}

/** Fürs HUD: aus Weltmetern je Sekunde werden wieder Stundenkilometer. */
export const angezeigtesTempo = (zustand: Fahrzustand, werte: FahrWerte, auto: { speed: number }) =>
  Math.round((Math.abs(zustand.tempo) / werte.hoechst) * (Number(auto.speed) || 120));
