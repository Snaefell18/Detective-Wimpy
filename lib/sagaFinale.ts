import type { Strafe } from "./urteil";
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
 *   "gericht-daemon" - wie "gericht", aber der Angeklagte ist besessen. Das
 *                   zeigt sich erst, wenn man ihn wirklich anklagt: Dann
 *                   bricht die Gestalt aus ihm heraus und sitzt an seiner
 *                   Stelle auf der Bank.
 */
export type FinaleArt =
  | "klassisch"
  | "gericht"
  | "gericht-daemon"
  | "ohne-taeter"
  | "wimpy";

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
    lang: "Der Drahtzieher tritt von Anfang an auf und spielt mit Wimpy. Jeder ahnt, wer es war; es fehlt der Beweis. Statt eines Finalfalls kommt die Verhandlung: Man legt die gesammelten Beweise vor, und Öhö spricht das Urteil.",
  },
  {
    id: "gericht-daemon",
    label: "Gericht & Dämon",
    hinweis: "der Angeklagte zeigt sein wahres Gesicht",
    lang: "Wie der Gerichtssaal - mit einem Geheimnis: Das Tier, das man anklagt, ist besessen. Bis dahin ist davon nichts zu sehen; erst wenn Wimpy es wirklich vor Gericht benennt, bricht die Gestalt aus ihm heraus und setzt sich an seiner Stelle auf die Anklagebank. Danach geht die Verhandlung gegen sie weiter.",
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
  art === "gericht" ||
  art === "gericht-daemon" ||
  art === "ohne-taeter" ||
  art === "wimpy";

/**
 * Muss der Spieler vor der Verhandlung selbst benennen, wen er anklagt?
 *
 * Nur da, wo es überhaupt eine offene Frage ist: Bei "kein Täter" sitzt der
 * Falsche längst auf der Bank, und bei "Wimpy selbst" hat sich der Detektiv
 * gerade eben selbst enttarnt.
 */
export const mitAnklage = (art: FinaleArt | undefined): boolean =>
  art === "gericht" || art === "gericht-daemon";

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
  /**
   * Wer auf der Anklagebank sitzt - aber nur, wo das ohnehin offenliegt: bei
   * "kein Täter" der zu Unrecht Verdächtigte, bei "Wimpy selbst" der Detektiv.
   *
   * Wo der Spieler selbst anklagt, steht hier nichts: Der Schuldige liegt im
   * Siegel, sonst könnte man ihn in der Datenbank nachschlagen.
   */
  bankId?: string;
  /** Wer die Verhandlung leitet - in aller Regel Öhö. */
  richterId: string;
  /** Womit Öhö eröffnet. */
  anklage: string;
  /**
   * Die Aktenlage, wie sie bei der Erzeugung entstanden ist.
   *
   * Vorgelegt wird sie nicht mehr: Im Saal zählt seit der Beweismitteltasche
   * ausschließlich, was der Spieler selbst mitgenommen hat. Erzeugt und
   * gespeichert wird sie trotzdem weiter - sie ist das verlässliche Zeichen
   * dafür, dass diese Saga überhaupt eine vollständige Verhandlung hat
   * (siehe sagaMitVerhandlung). Eine Saga ohne sie ist beim Erzeugen
   * steckengeblieben und springt beim Spielen vom Erzählertext in den
   * Epilog - das darf nie wieder passieren.
   */
  beweise: Beweisstueck[];
  /** Wie viele tragende Stücke es braucht. Aus der Zeit der Beweisführung. */
  noetig: number;
  /** Wie viele Fehlgriffe die Verhandlung verträgt. Ebenfalls von damals. */
  fehlgriffe: number;
  /**
   * Wen man anklagen kann - alle Tiere, die in der Saga aufgetreten sind.
   * Leer heißt: Es wird nicht angeklagt (siehe mitAnklage).
   */
  anklagbareIds?: string[];
  /** Wie oft man danebengreifen darf, bevor die Verhandlung platzt. */
  anklageVersuche?: number;
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

/** Der geheime Teil der Verhandlung - liegt ausschließlich im Siegel. */
export type VerhandlungWahrheit = {
  beweise: BeweisWahrheit[];
  /** Öhös Urteil, wenn genug getragen hat. */
  urteilSchuldig: string;
  /** Öhös Urteil, wenn die Verhandlung platzt. */
  urteilFrei: string;
  /** Was Öhö verhängt - Wiedergutmachung statt Wegsperren. */
  strafeSchuldig?: Strafe;
  /** Nur da, wo auch ein misslungenes Verfahren jemanden verurteilt. */
  strafeFrei?: Strafe;
  /**
   * Wen der Spieler anklagen muss. Steht nur hier - im offenen Teil der Saga
   * wäre es die Lösung.
   */
  angeklagterId?: string;
  /** Was Öhö sagt, wenn die Anklage sitzt. */
  anklageRichtig?: string;
  /** Was Öhö sagt, wenn sie danebengeht - freundlich, aber deutlich. */
  anklageFalsch?: string;
  /**
   * Nur bei "Gericht & Dämon": Wer da wirklich in wem steckt. Ausgelöst wird
   * die Verwandlung erst durch die richtige Anklage.
   */
  verwandlung?: {
    wirtId: string;
    daemonId: string;
    ton: string;
    /**
     * Was die Gestalt sagt, sobald sie dasteht - zwei bis vier Sätze in
     * ihrer eigenen Stimme. Leer bei älteren Sagas; dann bleibt der Moment
     * stumm wie bisher.
     */
    spruch?: string;
  };
};

/**
 * Wer die Verhandlung leitet.
 *
 * Öhö ist der Richter des Spiels - gefunden wird er über den Namen, damit
 * niemand eine Id von Hand eintragen muss. Gesucht wird nachsichtig: „Öhö“,
 * „Öhö“ und „Oehoe“ meinen denselben Vogel, und wie er im Datensatz
 * geschrieben steht, weiß man vorher nie. Gibt es ihn nicht, übernimmt das
 * älteste Tier der Besetzung, das nicht auf der Anklagebank sitzt.
 */
const alsSchluessel = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/ö/g, "o")
    .replace(/oe/g, "o")
    .replace(/[^a-z]/g, "");

export function richterAus(besetzung: Character[], angeklagterId: string): Character | null {
  const frei = besetzung.filter((c) => c.id !== angeklagterId && !c.istDetektiv);
  const oeho = frei.find((c) => alsSchluessel(c.name).startsWith("oho"));
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
  /** Bei "Gericht & Dämon": das Tier, in dem die Gestalt steckt. */
  wirtId?: string;
}): string {
  const { art, besetzung, drahtzieherId, wirtId } = args;
  if (art === "wimpy") return besetzung.find((c) => c.istDetektiv)?.id ?? "";
  // Angeklagt wird, wen man vor sich hat: bei einer Besessenheit der Wirt -
  // die Gestalt darin kennt vorher niemand.
  if (art === "gericht-daemon" && wirtId) return wirtId;
  return drahtzieherId;
}

/** Wie viele Stücke tragen müssen: drei, sofern es überhaupt so viele gibt. */
export const noetigeBeweise = (traegtAnzahl: number): number =>
  Math.max(1, Math.min(3, traegtAnzahl));

/**
 * Der Stand einer laufenden Beweisführung - aus der Zeit vor der Anhörung.
 *
 * Der Saal verhandelt heute im Gespräch (siehe lib/anhoerung.ts). Das hier
 * bleibt, weil ältere Sagas dieselben Zahlen tragen und der Admin-Bereich
 * sie anzeigt.
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
  gewonnen: string;
  verloren: string;
} {
  if (art === "ohne-taeter") {
    return {
      titel: "Die Verhandlung",
      vorlegen: "Vorlegen",
      gewonnen: "Freispruch",
      verloren: "Der Saal glaubt es nicht",
    };
  }
  if (art === "wimpy") {
    return {
      titel: "Die Verhandlung",
      vorlegen: "Gegen mich vorlegen",
      gewonnen: "Schuldig",
      verloren: "Das Verfahren platzt",
    };
  }
  return {
    titel: "Die Verhandlung",
    vorlegen: "Vorlegen",
    gewonnen: "Schuldig",
    verloren: "Das Verfahren platzt",
  };
}
