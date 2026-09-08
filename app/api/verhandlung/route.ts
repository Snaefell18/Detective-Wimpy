import { NextResponse } from "next/server";
import { fehlerText } from "@/lib/antwort";
import type { Bogen } from "@/lib/sagaBogen";
import { unseal } from "@/lib/seal";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Der Gerichtssaal einer Saga.
 *
 * Hier wird nichts erfunden - alle Texte stehen schon im versiegelten Bogen,
 * seit die Saga entstanden ist. Diese Route ist nur das Schloss davor: Sie
 * öffnet das Siegel, das nur der Server lesen kann, und gibt genau das eine
 * Stück heraus, das Wimpy gerade vorgelegt hat.
 *
 * Deshalb geht sie auch ohne Modellaufruf - der Saal antwortet sofort, und
 * wer die Datenbank durchsieht, findet dort keine Lösung.
 *
 *   "anklagen" - ist das das richtige Tier? Und zeigt es dann sein wahres
 *                Gesicht? Wen man anklagen muss, steht nirgends im Browser.
 *   "vorlegen" - ein Beweisstück auf den Tisch: trägt es, und was sagt der Saal?
 *   "urteil"   - Öhös Schlusswort samt Auflage, je nach Ausgang.
 */
type Body = {
  bogenSiegel?: string;
  schritt?: "anklagen" | "vorlegen" | "urteil";
  beweisId?: string;
  charakterId?: string;
  geschafft?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    let bogen: Bogen;
    try {
      bogen = unseal<Bogen>(String(body.bogenSiegel ?? ""));
    } catch {
      return NextResponse.json(
        { fehler: "Diese Saga ist abgelaufen. Bitte neu laden." },
        { status: 400 },
      );
    }

    const wahrheit = bogen.finale?.wahrheit;
    if (!wahrheit?.beweise?.length) {
      return NextResponse.json(
        { fehler: "Zu dieser Saga gehört keine Verhandlung." },
        { status: 400 },
      );
    }

    if (body.schritt === "urteil") {
      return NextResponse.json({
        text: body.geschafft ? wahrheit.urteilSchuldig : wahrheit.urteilFrei,
        // Öhö sperrt niemanden weg: Er verhängt eine Wiedergutmachung.
        strafe: body.geschafft ? wahrheit.strafeSchuldig : wahrheit.strafeFrei,
      });
    }

    /*
     * Die Anklage.
     *
     * Der Vergleich passiert hier und nur hier - im Browser liegt nichts,
     * woraus sich der Schuldige ablesen ließe. Erst mit der richtigen Anklage
     * gibt der Server heraus, wer auf der Bank sitzt; bei "Gericht & Dämon"
     * kommt dann auch die Gestalt heraus, die in ihm steckte.
     */
    if (body.schritt === "anklagen") {
      const richtig = Boolean(
        wahrheit.angeklagterId && body.charakterId === wahrheit.angeklagterId,
      );
      if (!richtig) {
        return NextResponse.json({
          richtig: false,
          text: wahrheit.anklageFalsch ?? "Das Gericht sieht das anders.",
        });
      }

      const figur = (id: string | undefined) =>
        id ? (bogen.besetzung.find((c) => c.id === id) ?? null) : null;
      const verwandlung = wahrheit.verwandlung;

      return NextResponse.json({
        richtig: true,
        text: wahrheit.anklageRichtig ?? "Der Saal wird still.",
        angeklagter: figur(wahrheit.angeklagterId),
        verwandlung:
          verwandlung && verwandlung.daemonId
            ? {
                wirt: figur(verwandlung.wirtId),
                daemon: figur(verwandlung.daemonId),
                ton: verwandlung.ton ?? "",
              }
            : null,
      });
    }

    const stueck = wahrheit.beweise.find((b) => b.id === body.beweisId);
    if (!stueck) {
      return NextResponse.json({ fehler: "Unbekanntes Beweisstück." }, { status: 400 });
    }

    return NextResponse.json({ traegt: stueck.traegt === true, reaktion: stueck.reaktion });
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/verhandlung") },
      { status: 500 },
    );
  }
}
