import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, getAnthropic } from "@/lib/anthropic";
import { buildAccusePrompt, buildWorldPrompt } from "@/lib/prompts";
import { AccuseSchema } from "@/lib/schemas";
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

    const response = await getAnthropic().messages.parse({
      model: MODEL,
      max_tokens: 4000,
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

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { fehler: "Die Auflösung konnte nicht erzeugt werden." },
        { status: 502 },
      );
    }

    // Wer der Täter ist, entscheidet der Server - nicht das Modell.
    const richtig = body.charakterId === fall.taeterId;
    const ergebnis: AccuseResult & { taeterId: string } = {
      richtig,
      aufloesung: response.parsed_output.aufloesung,
      reaktion: response.parsed_output.reaktion,
      taeterId: fall.taeterId,
    };

    return NextResponse.json(ergebnis);
  } catch (error) {
    console.error("[api/accuse]", error);
    return NextResponse.json(
      { fehler: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
