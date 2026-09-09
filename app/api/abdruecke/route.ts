import { NextResponse } from "next/server";
import { abdrueckeAmTatort } from "@/lib/abdruecke";
import { unseal } from "@/lib/seal";
import type { CaseFile } from "@/lib/types";

export const runtime = "nodejs";

type Body = { siegel: string };

/**
 * Das Fingerabdruckset.
 *
 * Am Tatort bleiben die Abdrücke von höchstens zwei Tieren übrig - und der
 * Täter ist garantiert darunter. Das ist der teuerste Gegenstand im Laden,
 * weil er den Fall halbiert: Danach ist es einer von zweien.
 *
 * Kein Modellaufruf nötig - der Täter steht bereits im versiegelten Fall.
 * Die Auswahl passiert hier auf dem Server, damit nie mehr über die Leitung
 * geht als die zwei Namen.
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

    const ids = abdrueckeAmTatort(fall);

    const namen = ids.map(
      (id) => fall.besetzung.find((c) => c.id === id)?.name ?? "ein unbekanntes Tier",
    );
    const ortName = fall.orte.find((o) => o.id === fall.tatort)?.name ?? "der Tatort";

    const text =
      namen.length > 1
        ? `Puder, Pinsel, Klebefolie - am Tatort (${ortName}) bleiben zwei Abdrücke übrig: ${namen[0]} und ${namen[1]}. Eines der beiden Tiere war es.`
        : `Puder, Pinsel, Klebefolie - am Tatort (${ortName}) bleibt ein einziger Abdruck übrig: ${namen[0]}.`;

    return NextResponse.json({ ids, namen, ortName, text });
  } catch (error) {
    console.error("[api/abdruecke]", error);
    return NextResponse.json(
      { fehler: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
