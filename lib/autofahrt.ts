/**
 * Wie sich Wimpys Wagen in der 3D-Stadt fährt.
 *
 * Gesteuert wird er genau wie Wimpy zu Fuß: Der Stick zeigt, wohin es gehen
 * soll, und dorthin geht es. Kein Lenkrad, kein Rückwärtsgang, kein
 * Umschalten zwischen Gas und Bremse - wer nach links will, hält nach links.
 *
 * Der Unterschied zum Laufen ist die Masse. Ein Auto steht nicht sofort auf
 * Tempo und hört nicht sofort auf; und je schneller es ist, desto weiter ist
 * der Bogen, den es braucht, um einer neuen Richtung zu folgen. Im
 * Schritttempo dreht es fast auf der Stelle - da fühlt es sich an wie zu Fuß.
 * Mit Tempo zieht es Kurven, und wer den Stick quer legt, geht dabei
 * automatisch vom Gas.
 *
 * Deshalb gibt es zwei Winkel: den Kurs, auf dem der Wagen tatsächlich rollt,
 * und den Winkel, in dem die Karosserie dazu steht. Normalerweise hinkt sie
 * dem Kurs ein wenig hinterher - das ist es, was man als Kurve sieht. Mit
 * angezogener Handbremse dreht sie zum Stick, während der Wagen noch
 * geradeaus weiterschiebt: quer durch die Kurve.
 *
 * Das Ganze ist reine Rechnung ohne Three.js. So lässt sich das Fahrgefühl
 * prüfen, ohne eine Grafikkarte zu starten.
 */

export type Fahrzustand = {
  /** Wohin die Karosserie schaut, in Radiant (0 = nach +z). */
  winkel: number;
  /** Wohin der Wagen tatsächlich rollt, in Radiant. */
  kurs: number;
  /** Tempo entlang des Kurses, in Metern je Sekunde. Nie negativ. */
  tempo: number;
  /** Wie schräg die Karosserie zum Kurs steht, in Radiant - der Drift. */
  drift: number;
};

export const STILLSTAND: Fahrzustand = { winkel: 0, kurs: 0, tempo: 0, drift: 0 };

export type FahrWerte = {
  /** Höchstgeschwindigkeit in Metern je Sekunde. */
  hoechst: number;
  /** Wie kräftig er anzieht, in m/s². */
  schub: number;
  /** Wie hart er verzögert, wenn der Stick etwas anderes will. */
  bremse: number;
  /** Wie schnell der Kurs dem Stick folgt, in Radiant je Sekunde. */
  kurve: number;
  /** Wie schnell sich die Karosserie wieder in den Kurs legt. */
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
    bremse: hoechst * 1.6,
    /*
     * Wie schnell der Kurs dem Stick folgt. Im Stand ist das so gut wie
     * sofort; mit Tempo bleibt davon ein Bogen übrig, der noch in eine
     * Kreuzung passt. Schwere, schnelle Wagen ziehen weitere Bögen - das
     * macht den Unterschied zwischen "wendig" und "Rakete" spürbar.
     */
    kurve: 9.5 - schnell * 2.2,
    griff: 6.5 - schnell * 2,
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

/** Ab hier zählt der Stick als gedrückt - darunter ist es Daumenzittern. */
const TOTBEREICH = 0.08;

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
  const gedrueckt = staerke > TOTBEREICH;
  const handbremse = eingabe.handbremse === true;
  let { winkel, kurs, tempo } = zustand;
  const flott = klemm(tempo / werte.hoechst, 0, 1);

  let zielTempo = 0;
  let zielKurs = kurs;
  if (gedrueckt) {
    zielKurs = Math.atan2(eingabe.x, eingabe.z);
    const ab = winkelDifferenz(kurs, zielKurs);
    /*
     * Eine Kurve kostet Tempo: Wer den Stick quer legt, geht von selbst vom
     * Gas und zieht dadurch enger ein. Mit Handbremse deutlich weniger -
     * genau dafür ist sie da.
     */
    const geradeaus = Math.max(0, Math.cos(ab));
    const boden = handbremse ? 0.75 : 0.45;
    zielTempo = staerke * werte.hoechst * (boden + (1 - boden) * geradeaus);
    /*
     * Und der Kurs dreht zum Stick. Im Schritttempo fast sofort - da fährt
     * sich der Wagen wie Wimpy zu Fuß -, mit Tempo nur noch im Bogen. Mit
     * Handbremse verlieren die Reifen den Halt und er schiebt weiter
     * geradeaus, während die Karosserie schon quer steht.
     */
    const rate = werte.kurve * (1 - flott * 0.62) * (handbremse ? 0.5 : 1);
    kurs += klemm(ab, -rate * schritt, rate * schritt);
  }

  /*
   * Tempo. Anziehen kostet Zeit, und oben lässt der Schub nach, damit sich
   * die letzten Stundenkilometer nach etwas anfühlen. Ohne Stick rollt er
   * aus, statt stehen zu bleiben; mit Stick in eine andere Richtung bremst
   * er richtig.
   */
  if (tempo < zielTempo) {
    tempo = Math.min(zielTempo, tempo + werte.schub * (1 - flott * 0.45) * schritt);
  } else {
    tempo = Math.max(zielTempo, tempo - (gedrueckt ? werte.bremse : werte.schub * 0.4) * schritt);
  }
  tempo = klemm(tempo, 0, werte.hoechst);

  /*
   * Zuletzt die Karosserie. Sie legt sich in den Kurs, bleibt dabei aber
   * einen Moment zurück - dieses Nachhängen ist die Kurve, die man sieht.
   * Mit Handbremse schaut sie dorthin, wo der Stick hinzeigt, und der Wagen
   * rutscht darunter weg.
   */
  const koerperZiel = handbremse && gedrueckt ? zielKurs : kurs;
  /*
   * Nachgezogen wird weich, nicht mit fester Rate: Solange der Kurs sich
   * dreht, bleibt die Karosserie dabei um einen kleinen Winkel zurück, und
   * genau der ist die Schräglage, die man in der Kurve sieht. Steht der Kurs
   * still, holt sie ihn in einem Wimpernschlag ein.
   */
  const koerperRate = werte.griff * (handbremse ? 4 : 3);
  const nach = winkelDifferenz(winkel, koerperZiel);
  winkel += nach * (1 - Math.exp(-koerperRate * schritt));
  const drift = winkelDifferenz(kurs, winkel);

  return {
    zustand: { winkel, kurs, tempo, drift },
    bewegung: {
      x: Math.sin(kurs) * tempo * schritt,
      z: Math.cos(kurs) * tempo * schritt,
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
