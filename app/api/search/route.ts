import { NextResponse } from "next/server";
import { getItem } from "@/lib/items";
import { findeOrt } from "@/lib/locations";
import { seal, unseal } from "@/lib/seal";
import type { BeweismittelKern } from "@/lib/beweismittel";
import type { CaseFile } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  siegel: string;
  ortId: string;
  gefundeneSpuren: string[];
  /** Eingesetztes Detektiv-Zubehör - "spuersinn" schärft den Riecher. */
  wirkung?: string;
};

/**
 * "Umsehen" an einem Ort. Braucht kein Modell - die Spuren stehen schon im
 * versiegelten Fall. Gibt höchstens eine noch unentdeckte Spur zurück.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    let fall: CaseFile;
    try {
      fall = unseal<CaseFile>(body.siegel);
    } catch {
      return NextResponse.json(
        { fehler: "Der Fall ist abgelaufen. Bitte starte einen neuen Fall." },
        { status: 400 },
      );
    }

    const gefunden = new Set(body.gefundeneSpuren ?? []);
    const hier = fall.spuren.find((s) => s.ortId === body.ortId && !gefunden.has(s.itemId));

    /*
     * Mit geschärftem Spürsinn reicht der Blick über den Ort hinaus: Liegt
     * hier nichts mehr, führt eine Ahnung zur nächsten offenen Spur - egal,
     * wo sie liegt. Ohne das Zubehör bleibt alles wie bisher.
     */
    const woanders =
      !hier && body.wirkung === "spuersinn"
        ? fall.spuren.find((s) => !gefunden.has(s.itemId))
        : undefined;
    const spur = hier ?? woanders;

    if (!spur) {
      const ort = findeOrt(fall.orte, body.ortId);
      return NextResponse.json({
        spur: null,
        text: `Wimpy sucht ${ort ? `am Ort "${ort.name}"` : "hier"} jeden Winkel ab - hier ist nichts mehr zu holen.`,
      });
    }

    // Erst im Fall nachschlagen - er kann Gegenstände aus der Datenbank
    // enthalten, die es in lib/items.ts gar nicht gibt.
    const item = fall.items?.find((i) => i.id === spur.itemId) ?? getItem(spur.itemId);
    const name = item?.name ?? spur.itemId;

    // Der Spieler bekommt die Beobachtung, nie die Bedeutung: Was der Fund
    // beweist, soll er selbst erschließen. Ältere Fälle haben keine
    // Beobachtung - dort bleibt es beim alten Text, sonst stünde nichts da.
    const beobachtung = spur.beobachtung?.trim() || spur.bedeutung;
    const vermutung = spur.vermutung?.trim();

    /*
     * Das Siegel des Fundes.
     *
     * Nimmt der Spieler das Stück in die Beweismitteltasche, trägt es diesen
     * Umschlag mit sich - und die Verhandlung kann später nachlesen, was er
     * wirklich beweist, ohne den ganzen Fall zu kennen. Im Browser bleibt er
     * unlesbar; dort steht wie immer nur die Beobachtung.
     */
    const ortName = findeOrt(fall.orte, spur.ortId)?.name ?? "";
    const kern: BeweismittelKern = {
      id: spur.itemId,
      name,
      beobachtung,
      bedeutung: spur.bedeutung,
      zeigtAufCharakterId: spur.zeigtAufCharakterId,
      fuehrtInDieIrre: spur.fuehrtInDieIrre === true,
      herkunft: [ortName, fall.titel].filter(Boolean).join(" · "),
    };

    return NextResponse.json({
      spur: {
        itemId: spur.itemId,
        name,
        bild: item?.bild ?? null,
        beobachtung,
        vermutung: vermutung || null,
        herkunft: ortName,
        siegel: seal(kern),
      },
      text: `${
        woanders
          ? `Wimpy stutzt, dreht sich um - und hat plötzlich ${
              findeOrt(fall.orte, spur.ortId)?.name ?? "einen anderen Ort"
            } im Kopf. Dort liegt es: ${name}. `
          : `Wimpy hebt etwas auf: ${name}. `
      }${beobachtung}${vermutung ? `\n\nWimpy murmelt: „${vermutung}“` : ""}`,
    });
  } catch (error) {
    console.error("[api/search]", error);
    return NextResponse.json(
      { fehler: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
