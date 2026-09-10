import { GEDULD, MIT_BEWEIS_MAX, OHNE_BEWEIS_MAX, UEBERZEUGT, type AnhoerungZug } from "./anhoerung";
import { characterBrief } from "./characters";
import type { BeweismittelKern } from "./beweismittel";
import type { Bogen } from "./sagaBogen";
import type { FinaleArt } from "./sagaFinale";
import { URTEILS_REGEL } from "./urteil";
import type { Character } from "./types";

/**
 * Der Prompt für einen Zug in der Anhörung.
 *
 * Geschrieben werden zwei Stimmen auf einmal: der Angeklagte und Öhö. Das ist
 * Absicht - ein Saal, in dem jede Antwort einen eigenen Aufruf bräuchte, wäre
 * doppelt so teuer und würde sich anfühlen wie zwei getrennte Gespräche. So
 * fällt beides in einem Zug, und der Vorsitz reagiert auf dieselbe Aussage,
 * die der Spieler gerade gehört hat.
 *
 * Was ein Beweismittel wirklich beweist, steht ausschließlich hier - es kommt
 * aus den Siegeln der Tasche und wandert nie in den Browser zurück.
 */

/** Ein Beweismittel, wie es der Saal kennt: außen die Karte, innen die Wahrheit. */
export type SaalMittel = {
  kern: BeweismittelKern;
  /** Liegt es schon auf dem Tisch? */
  gelegt: boolean;
  /** Legt Wimpy es gerade jetzt vor? */
  jetzt: boolean;
};

const ZIELE: Record<FinaleArt, string> = {
  klassisch:
    "Wimpy will den Angeklagten überführen. Am Ende soll er zugeben, was er getan hat.",
  gericht:
    "Alle ahnen, dass der Angeklagte es war - beweisen konnte es niemand. Wimpy soll ihn so weit bringen, dass er sich selbst verrät.",
  "gericht-daemon":
    "Auf der Bank sitzt nicht mehr das Tier, das alle kannten, sondern das Wesen, das in ihm steckte. Es ist älter, kälter und spielt mit dem Saal. Wimpy soll es festnageln.",
  "ohne-taeter":
    "Es gibt keinen Täter. Der Angeklagte ist unschuldig, und Wimpy muss dem Gericht zeigen, dass hinter allem etwas anderes steckt - keine Schuld, sondern eine Verkettung. Der Angeklagte hilft ihm dabei, so gut er kann.",
  wimpy:
    "Der Detektiv klagt sich selbst an. Er war besessen und hat getan, was er aufklärte. Er legt die Beweise gegen sich vor; Öhö prüft sie so gründlich wie bei jedem anderen.",
};

export function buildAnhoerungPrompt(args: {
  bogen: Bogen;
  art: FinaleArt;
  angeklagter: Character | undefined;
  richter: Character | undefined;
  /** Der Detektiv - er stellt die Fragen. */
  detektiv: Character | undefined;
  /** Alles, was Wimpy in der Tasche hat. */
  mittel: SaalMittel[];
  verlauf: AnhoerungZug[];
  nachricht: string;
  ueberzeugung: number;
  geduld: number;
}): string {
  const {
    bogen,
    art,
    angeklagter,
    richter,
    detektiv,
    mittel,
    verlauf,
    nachricht,
    ueberzeugung,
    geduld,
  } = args;

  const jetzt = mittel.find((m) => m.jetzt);
  const wahrheit = bogen.finale?.wahrheit;
  /** Klagt der Detektiv sich selbst an, spricht der Angeklagte nicht extra. */
  const eigeneSache = Boolean(angeklagter?.istDetektiv);
  const name = (c: Character | undefined, ersatz: string) => c?.name ?? ersatz;
  const richterName = name(richter, "Der Vorsitz");
  const bankName = name(angeklagter, "Der Angeklagte");

  const mittelListe = mittel.length
    ? mittel
        .map(
          (m) =>
            `- ${m.kern.name} (${m.kern.herkunft || "Herkunft unbekannt"})${
              m.jetzt ? " ← LEGT WIMPY GERADE VOR" : m.gelegt ? " (liegt schon auf dem Tisch)" : ""
            }\n  Was Wimpy sieht: ${m.kern.beobachtung || "(nichts notiert)"}\n  Was es wirklich beweist: ${
              m.kern.bedeutung || "(nichts hinterlegt)"
            }${
              m.kern.fuehrtInDieIrre
                ? "\n  ACHTUNG: Dieses Stück führt in die Irre. Es sieht belastend aus, beweist aber nichts."
                : ""
            }${
              m.kern.fernwirkung
                ? "\n  Dieses Stück reicht über sein Kapitel hinaus: Es zeigt auf den, um den es heute geht. Vorgelegt und richtig erklärt, wiegt es schwer."
                : ""
            }`,
        )
        .join("\n")
    : "- Wimpy hat nichts dabei. Er muss es mit Fragen schaffen.";

  return `Du schreibst einen Zug in einer Gerichtsverhandlung im Detektivspiel "Detective Wimpy". Alles auf Deutsch.

WER IM SAAL IST
Vorsitz: ${richterName}${richter ? ` [${richter.id}] - ${characterBrief(richter)}` : ""}
Auf der Anklagebank: ${bankName}${angeklagter ? ` [${angeklagter.id}] - ${characterBrief(angeklagter)}` : ""}
Fragt: ${name(detektiv, "Detective Wimpy")}${detektiv ? ` - ${characterBrief(detektiv)}` : ""}
${angeklagter?.sprachstil?.trim() ? `\nSO REDET DER ANGEKLAGTE (wichtiger als alles andere)\n${angeklagter.sprachstil.trim()}\n` : ""}${
    richter?.sprachstil?.trim()
      ? `\nSO REDET DER VORSITZ (wichtiger als alles andere)\n${richter.sprachstil.trim()}\n`
      : ""
  }
WORUM ES GEHT
${ZIELE[art]}
Die Saga: ${bogen.name} - ${bogen.thema}
Was wirklich dahintersteckt (Verschlusssache): ${bogen.wahrheit}
Motiv des Drahtziehers: ${bogen.drahtzieherMotiv}
Die Frage, die heute beantwortet wird: ${bogen.finale?.frage ?? "(keine)"}
${
    wahrheit?.angeklagterId
      ? `Der Schuldige ist ${bogen.besetzung.find((c) => c.id === wahrheit.angeklagterId)?.name ?? wahrheit.angeklagterId} - er sitzt auf der Bank.`
      : ""
  }

WAS WIMPY VORLEGEN KANN (was es beweist, weiß nur du - nie der Spieler)
${mittelListe}

WIE DER SAAL SEIN GEWICHT VERTEILT
- Die Überzeugung des Gerichts steht bei ${ueberzeugung} von ${UEBERZEUGT}. Bei ${UEBERZEUGT} ist entschieden.
- Öhös Geduld steht bei ${geduld} von ${GEDULD}.
- Trägt der Zug etwas bei, setze ueberzeugungPlus entsprechend: ein starkes, im richtigen Moment vorgelegtes Stück ${MIT_BEWEIS_MAX / 2} bis ${MIT_BEWEIS_MAX}, eine gute Frage, die den Angeklagten ins Wanken bringt, 5 bis ${OHNE_BEWEIS_MAX}.
- Ein Stück, das in die Irre führt, oder ein Vorhalt, der nicht passt: ueberzeugungPlus negativ (bis -15). Öhö sagt dann freundlich, warum das nichts trägt.
- Bringt ein Zug gar nichts - Geplauder, Wiederholung, Beleidigung -, setze ueberzeugungPlus auf 0 und geduldMinus auf 1.
- ${jetzt ? `Wimpy legt gerade "${jetzt.kern.name}" vor. Der Angeklagte MUSS darauf eingehen.` : "Wimpy legt in diesem Zug nichts vor - er redet nur."}
- Dasselbe Stück ein zweites Mal bringt nichts Neues: ueberzeugungPlus 0.

WIE DIE ZWEI STIMMEN KLINGEN
${
    eigeneSache
      ? `- angeklagter: leer lassen ("") - auf der Bank sitzt Wimpy selbst, und für ihn spricht der Spieler.`
      : `- angeklagter: 1 bis 3 Sätze wörtliche Rede von ${bankName}. Er gibt nichts zu, solange die Überzeugung unter ${UEBERZEUGT} liegt - er weicht aus, dreht Wimpys Worte um, wird bei einem Treffer aber sichtbar unruhig und gibt Kleinigkeiten preis.`
  }
- richter: 1 bis 3 Sätze von ${richterName}. Er ist kein Erzähler, sondern der Vorsitz: Er ordnet, hakt nach, stellt eigene Fragen ("Und wo waren Sie da genau?"), weist Unbelegtes zurück und lobt, was trägt. Er darf schweigen (""), wenn ein Zug nichts hergibt - aber öfter stellt er selbst eine Frage.
- Keine Namensprefixe, keine Anführungszeichen um die ganze Antwort, keine Regieanweisungen in Klammern, keine Tags.
- Niemand verrät, was in der Verschlusssache steht, solange nicht gestanden wurde.

WANN ES ENTSCHIEDEN IST
- Setze gestaendnis nur auf true, wenn die Überzeugung mit diesem Zug ${UEBERZEUGT} erreicht${
    eigeneSache ? "" : ` und ${bankName} in demselben Zug wirklich zugibt, was er getan hat`
  }.
- Schreibe niemals das Urteil und niemals eine Strafe. Das spricht ${richterName} danach selbst.
${URTEILS_REGEL.split("\n")[0]}

BISHER IM SAAL
${
    verlauf.length
      ? verlauf
          .slice(-10)
          .map(
            (z) =>
              `${z.rolle === "wimpy" ? name(detektiv, "Wimpy") : z.rolle === "richter" ? richterName : bankName}: ${z.text}`,
          )
          .join("\n")
      : "(die Verhandlung beginnt gerade)"
  }

WIMPY SAGT: "${nachricht}"`;
}
