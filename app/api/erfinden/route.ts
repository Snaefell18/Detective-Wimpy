import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { adminGesperrt } from "@/lib/adminSchloss";
import { MODEL, budget, getAnthropic } from "@/lib/anthropic";
import { ergebnisAus, fehlerText, istZeitueberschreitung, sauberText } from "@/lib/antwort";
import { buildDingPrompt, buildStadtPrompt } from "@/lib/erfindenPrompt";
import { DingSchema, StadtSchema } from "@/lib/schemas";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import type * as z from "zod/v4";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Neue Stammdaten erfinden lassen - ein Ding oder eine ganze Stadt.
 *
 * Das Ergebnis wird nirgends gespeichert: Es geht als Vorschlag zurück ins
 * Admin-Menü, wo man ihn ansieht, ändert, ein Bild dazu erzeugt und erst dann
 * ablegt. Deshalb ist hier auch nichts zu reparieren - was nicht gefällt,
 * wird einfach nicht gespeichert.
 *
 * Kostet Geld, hängt also am selben Schloss wie Akten und Bilder.
 */
type Body = {
  art?: "ding" | "stadt";
  /** Namen, die es schon gibt - damit nichts doppelt kommt. */
  vorhanden?: string[];
  /** Freier Wunsch aus dem Menü. */
  wunsch?: string;
  /** Nur bei "stadt": Wunschname und wie viele Orte. */
  stadt?: string;
  anzahl?: number;
};

/** Höchstens so viele Orte auf einmal - mehr wäre kein Vorschlag mehr. */
const HOECHSTENS = 8;

/**
 * Dieselben Optionen wie überall sonst beim Erfinden: adaptives Denken,
 * kleiner Aufwand. Es geht um einen Vorschlag, nicht um einen ganzen Fall.
 */
const optionen = (
  frage: string,
  format: ReturnType<typeof zodOutputFormat>,
  maxTokens: number,
) =>
  ({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "low" as const, format },
    messages: [{ role: "user" as const, content: frage }],
  }) as MessageCreateParamsNonStreaming;

export async function POST(request: Request) {
  try {
    const gesperrt = adminGesperrt(request, "Das Erfinden");
    if (gesperrt) return NextResponse.json({ fehler: gesperrt }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const vorhanden = (body.vorhanden ?? [])
      .filter((n) => typeof n === "string")
      .map((n) => n.slice(0, 60));
    const wunsch = String(body.wunsch ?? "").slice(0, 400);

    if (body.art === "stadt") {
      const anzahl = Math.max(1, Math.min(HOECHSTENS, Math.round(Number(body.anzahl) || 5)));
      const antwort = await getAnthropic().messages.create(
        optionen(
          buildStadtPrompt({
            stadt: String(body.stadt ?? "").slice(0, 60),
            anzahl,
            vorhanden,
            wunsch,
          }),
          zodOutputFormat(StadtSchema),
          6000,
        ),
        budget(40, 1),
      );

      const gelesen = ergebnisAus<z.infer<typeof StadtSchema>>(antwort, "api/erfinden:stadt");
      if ("fehler" in gelesen) {
        return NextResponse.json({ fehler: gelesen.fehler }, { status: gelesen.status });
      }

      const daten = gelesen.daten;
      const orte = (daten.orte ?? [])
        .slice(0, anzahl)
        .map((o) => ({
          name: sauberText(o.name).slice(0, 80),
          atmosphaere: sauberText(o.atmosphaere).slice(0, 300),
          beschreibung: sauberText(o.beschreibung).slice(0, 500),
        }))
        .filter((o) => o.name);

      if (!orte.length) {
        return NextResponse.json(
          { fehler: "Es kam keine brauchbare Stadt zurück. Bitte noch einmal versuchen." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        stadt: sauberText(daten.stadt).slice(0, 60) || String(body.stadt ?? "").slice(0, 60),
        orte,
      });
    }

    const antwort = await getAnthropic().messages.create(
      optionen(buildDingPrompt({ vorhanden, wunsch }), zodOutputFormat(DingSchema), 3000),
      budget(30, 1),
    );

    const gelesen = ergebnisAus<z.infer<typeof DingSchema>>(antwort, "api/erfinden:ding");
    if ("fehler" in gelesen) {
      return NextResponse.json({ fehler: gelesen.fehler }, { status: gelesen.status });
    }

    const name = sauberText(gelesen.daten.name).slice(0, 80);
    if (!name) {
      return NextResponse.json(
        { fehler: "Es kam kein brauchbarer Vorschlag zurück. Bitte noch einmal versuchen." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      name,
      beschreibung: sauberText(gelesen.daten.beschreibung).slice(0, 500),
    });
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/erfinden") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}
