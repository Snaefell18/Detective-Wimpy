import type { Character } from "./types";

/**
 * Wie eine Saga endet.
 *
 * Das steht vor der Erzeugung fest, denn es färbt alles: Schon der Kern, jedes
 * Kapitel und jeder einzelne Fall werden anders gebaut, je nachdem, worauf die
 * Saga zuläuft.
 *
 *   "klassisch"   - wie bisher: ein letzter Fall, in dem der Drahtzieher
 *                   überführt wird.
 *   "gericht"     - Columbo: Man weiß früh, wer es war. Er weiß, dass man es
 *                   weiß, und spielt damit. Was fehlt, ist der Beweis - und
 *                   den legt man am Ende im Gerichtssaal vor.
 *   "ohne-taeter" - Es gibt keinen Schuldigen. Was wie eine Serie von Taten
 *                   aussah, war etwas anderes; im Finale muss Wimpy die
 *                   Wahrheit belegen und den Falschen freibekommen.
 *   "wimpy"       - Der Detektiv selbst war es. Er war besessen, wusste nichts
 *                   davon, und muss am Ende die Beweise gegen sich selbst
 *                   vorlegen.
 */
export type FinaleArt = "klassisch" | "gericht" | "ohne-taeter" | "wimpy";

export const FINALE_ARTEN: {
  id: FinaleArt;
  label: string;
  hinweis: string;
  /** Was das für die ganze Saga bedeutet - steht im Admin-Menü darunter. */
  lang: string;
}[] = [
  {
    id: "klassisch",
    label: "Klassisch",
    hinweis: "ein letzter Fall",
    lang: "Wie gewohnt: Nach den Kapiteln kommt ein Finalfall, in dem der Drahtzieher gestellt und beschuldigt wird.",
  },
  {
    id: "gericht",
    label: "Gerichtssaal",
    hinweis: "Columbo - man ahnt es früh",
    lang: "Der Drahtzieher tritt von Anfang an auf und spielt mit Wimpy. Jeder ahnt, wer es war; es fehlt der Beweis. Statt eines Finalfalls kommt die Verhandlung: Man legt die gesammelten Beweise vor, und Öho spricht das Urteil.",
  },
  {
    id: "ohne-taeter",
    label: "Kein Täter",
    hinweis: "es gab nie einen Schuldigen",
    lang: "Alles deutete auf ein Tier - zu Unrecht. Hinter der Serie steckt etwas ganz anderes: eine Maschine, das Wetter, eine alte Uhr, eine Kette von Zufällen. Im Finale sitzt der Falsche auf der Anklagebank, und Wimpy muss mit dem Gesammelten beweisen, dass es keinen Täter gibt.",
  },
  {
    id: "wimpy",
    label: "Wimpy selbst",
    hinweis: "der Detektiv war besessen",
    lang: "Wimpy war die ganze Saga über von einem anderen Wesen besessen und hat selbst getan, was er aufklärte. Vor der Verhandlung bricht es aus ihm heraus - danach legt er die Beweise gegen sich selbst vor.",
  },
];

/** Läuft diese Saga statt in einen Finalfall in eine Verhandlung? */
export const mitVerhandlung = (art: FinaleArt | undefined): boolean =>
  art === "gericht" || art === "ohne-taeter" || art === "wimpy";

/** Ein Beweisstück, wie es der Spieler sieht - ohne jeden Hinweis darauf, ob es trägt. */
export type Beweisstueck = {
  id: string;
  /** Kurzer Name auf der Karte. */
  name: string;
  /** Woher es stammt: "Kapitel 2 - Die Nacht am Hafen". */
  herkunft: string;
  /** Was man damit zeigen will - zwei, drei Sätze. */
  text: string;
};

/**
 * Die Verhandlung, wie sie im offenen Teil der Saga steht.
 *
 * Welche Stücke tragen und was der Angeklagte darauf erwidert, steht NICHT
 * hier, sondern im versiegelten Bogen - sonst könnte man die Lösung in der
 * Datenbank nachlesen.
 */
export type Verhandlung = {
  art: FinaleArt;
  /** Wer auf der Anklagebank sitzt. Bei "wimpy" der Detektiv selbst. */
  angeklagterId: string;
  /** Wer die Verhandlung leitet - in aller Regel Öho. */
  richterId: string;
  /** Womit Öho eröffnet. */
  anklage: string;
  /** Alles, was Wimpy vorlegen kann - Tragendes und Fehlschlüsse gemischt. */
  beweise: Beweisstueck[];
  /** Wie viele tragende Stücke es braucht. */
  noetig: number;
  /** Wie viele Fehlgriffe die Verhandlung verträgt. */
  fehlgriffe: number;
  /**
   * Angeklagter und Vorsitz mit Bild und Namen.
   *
   * Sie stehen hier, weil beide im Saal zu sehen sein müssen - auch wenn
   * einer von ihnen in keinem einzigen Kapitel aufgetreten ist. Verraten wird
   * damit nichts, was der Saal nicht ohnehin zeigt.
   */
  personen?: Character[];
};

/** Was zu einem Beweisstück wirklich gilt - liegt nur im Siegel. */
export type BeweisWahrheit = {
  id: string;
  /** Trägt es vor Gericht? */
  traegt: boolean;
  /** Was im Saal geschieht, wenn Wimpy es vorlegt. */
  reaktion: string;
};

/** Der geheime Teil der Verhandlung. */
export type VerhandlungWahrheit = {
  beweise: BeweisWahrheit[];
  /** Öhos Urteil, wenn genug getragen hat. */
  urteilSchuldig: string;
  /** Öhos Urteil, wenn die Verhandlung platzt. */
  urteilFrei: string;
};

/**
 * Wer die Verhandlung leitet.
 *
 * Öho ist der Richter des Spiels - gefunden wird er über den Namen, damit
 * niemand eine Id von Hand eintragen muss. Gibt es ihn nicht, übernimmt das
 * älteste Tier der Besetzung, das nicht auf der Anklagebank sitzt.
 */
export function richterAus(besetzung: Character[], angeklagterId: string): Character | null {
  const frei = besetzung.filter((c) => c.id !== angeklagterId && !c.istDetektiv);
  const oeho = frei.find((c) => c.name.trim().toLowerCase().startsWith("öho"));
  if (oeho) return oeho;
  return [...frei].sort((a, b) => b.alter - a.alter)[0] ?? null;
}

/**
 * Wer bei dieser Finale-Art auf der Anklagebank sitzt.
 *
 * Beim Gerichtsfinale der Drahtzieher, bei "kein Täter" das Tier, das alle
 * verdächtigen - und bei "Wimpy selbst" der Detektiv.
 */
export function angeklagterAus(args: {
  art: FinaleArt;
  besetzung: Character[];
  drahtzieherId: string;
}): string {
  const { art, besetzung, drahtzieherId } = args;
  if (art === "wimpy") return besetzung.find((c) => c.istDetektiv)?.id ?? "";
  return drahtzieherId;
}

/** Wie viele Stücke tragen müssen: drei, sofern es überhaupt so viele gibt. */
export const noetigeBeweise = (traegtAnzahl: number): number =>
  Math.max(1, Math.min(3, traegtAnzahl));

/**
 * Der Stand einer laufenden Verhandlung.
 *
 * Liegt nur im Bildschirm, nicht in der Datenbank: Wer die Verhandlung
 * verlässt, fängt sie neu an - eine halbe Beweisführung wäre keine.
 */
export type VerhandlungsStand = {
  /** Schon vorgelegte Stücke, in der Reihenfolge des Vorlegens. */
  gelegt: string[];
  /** Wie viele davon getragen haben. */
  getroffen: number;
  /** Wie viele danebengingen. */
  daneben: number;
};

export const LEERER_VERHANDLUNGS_STAND: VerhandlungsStand = {
  gelegt: [],
  getroffen: 0,
  daneben: 0,
};

/** Ist die Verhandlung durch - und wie? */
export function verhandlungsErgebnis(
  stand: VerhandlungsStand,
  verhandlung: Pick<Verhandlung, "noetig" | "fehlgriffe">,
): "laeuft" | "gewonnen" | "verloren" {
  if (stand.getroffen >= verhandlung.noetig) return "gewonnen";
  if (stand.daneben > verhandlung.fehlgriffe) return "verloren";
  return "laeuft";
}

/**
 * Die Wörter des Gerichtssaals - je nach Art dieselbe Mechanik, aber ein
 * ganz anderer Abend.
 */
export function saalTexte(art: FinaleArt): {
  titel: string;
  vorlegen: string;
  /** Über der Beweisliste. */
  regal: string;
  gewonnen: string;
  verloren: string;
} {
  if (art === "ohne-taeter") {
    return {
      titel: "Die Verhandlung",
      vorlegen: "Vorlegen",
      regal: "Was du zusammengetragen hast",
      gewonnen: "Freispruch",
      verloren: "Der Saal glaubt es nicht",
    };
  }
  if (art === "wimpy") {
    return {
      titel: "Die Verhandlung",
      vorlegen: "Gegen mich vorlegen",
      regal: "Was gegen dich spricht",
      gewonnen: "Schuldig",
      verloren: "Das Verfahren platzt",
    };
  }
  return {
    titel: "Die Verhandlung",
    vorlegen: "Vorlegen",
    regal: "Deine Beweise",
    gewonnen: "Schuldig",
    verloren: "Das Verfahren platzt",
  };
}
