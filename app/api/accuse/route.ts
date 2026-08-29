import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText } from "@/lib/antwort";
import { MODEL, getAnthropic } from "@/lib/anthropic";
import { buildAccusePrompt, buildWorldPrompt } from "@/lib/prompts";
import { AccuseSchema } from "@/lib/schemas";
import type * as z from "zod/v4";
import { unseal } from "@/lib/seal";
import type { AccuseResult, CaseFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  siegel: string;
  charakterId: string;
  begruendung: string;
  gefundeneSpuren: string[];
};

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

    if (!fall.besetzung.some((c) => c.id === body.charakterId)) {
      return NextResponse.json({ fehler: "Unbekannter Charakter." }, { status: 400 });
    }

    const response = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: [
        {
          type: "text",
          text: buildWorldPrompt(fall.besetzung, fall.orte, fall.stadt, fall.ton),
          cache_control: { type: "ephemeral" },
        },
      ],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(AccuseSchema) },
      messages: [
        {
          role: "user",
          content: buildAccusePrompt({
            fall,
            charakterId: body.charakterId,
            begruendung: (body.begruendung ?? "").slice(0, 500),
            gefundeneSpuren: body.gefundeneSpuren ?? [],
          }),
        },
      ],
    });

    const modellAntwort = ergebnisAus<z.infer<typeof AccuseSchema>>(response, "api/accuse");
    if ("fehler" in modellAntwort) {
      return NextResponse.json(
        { fehler: modellAntwort.fehler },
        { status: modellAntwort.status },
      );
    }
    const aufloesung = modellAntwort.daten;

    // Wer der Täter ist, entscheidet der Server - nicht das Modell.
    const richtig = body.charakterId === fall.taeterId;
    const ergebnis: AccuseResult & { taeterId: string } = {
      richtig,
      aufloesung: aufloesung.aufloesung,
      reaktion: aufloesung.reaktion,
      taeterId: fall.taeterId,
    };

    return NextResponse.json(ergebnis);
  } catch (error) {
    return NextResponse.json({ fehler: fehlerText(error, "api/accuse") }, { status: 500 });
  }
}
