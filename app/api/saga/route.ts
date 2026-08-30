import { NextResponse } from "next/server";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText, istZeitueberschreitung } from "@/lib/antwort";
import { MODEL, budget, getAnthropic } from "@/lib/anthropic";
import { CHARACTERS } from "@/lib/characters";
import { alsStaedte } from "@/lib/csv";
import { LOCATIONS } from "@/lib/locations";
import { buildWorldPrompt } from "@/lib/prompts";
import type { Bogen } from "@/lib/sagaBogen";
import { buildBogenPrompt } from "@/lib/sagaPrompts";
import type { BogenDraft } from "@/lib/sagaSchemas";
import { makeBogenSchema } from "@/lib/sagaSchemas";
import { STANDARD_SAGA_VORGABEN, type SagaVorgaben } from "@/lib/sagaTypen";
import { CharacterSchema, LocationSchema, SagaVorgabenSchema } from "@/lib/schemas";
import { seal } from "@/lib/seal";
import type { Character, Location } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Der Bogen einer Saga - ein einziger, kleiner Aufruf.
 *
 * Die Fälle der Kapitel entstehen danach einzeln über /api/case, jeder
 * wiederum in drei Schritten. So bleibt jede Anfrage weit unter dem Zeitlimit
 * der Plattform, auch wenn eine Saga aus fünf Fällen besteht.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const rohBesetzung = CharacterSchema.array().max(24).safeParse(body?.charaktere);
    const besetzung: Character[] = rohBesetzung.success
      ? (rohBesetzung.data as Character[])
      : CHARACTERS;

    const rohOrte = LocationSchema.array().max(120).safeParse(body?.orte);
    const orte: Location[] =
      rohOrte.success && rohOrte.data.length ? (rohOrte.data as Location[]) : LOCATIONS;

    const vorgaben: SagaVorgaben = {
      ...STANDARD_SAGA_VORGABEN,
      ...(SagaVorgabenSchema.safeParse(body?.vorgaben).data ?? {}),
    };

    // Nur die gewünschten Tiere - der Detektiv ist immer dabei.
    const gefiltert =
      vorgaben.charaktere.length >= 2
        ? besetzung.filter((c) => c.istDetektiv || vorgaben.charaktere.includes(c.id))
        : besetzung;
    const spielendeBesetzung =
      gefiltert.filter((c) => !c.istDetektiv).length >= 3 ? gefiltert : besetzung;

    const verdaechtige = spielendeBesetzung.filter((c) => !c.istDetektiv);
    if (verdaechtige.length < 3) {
      return NextResponse.json(
        { fehler: "Eine Saga braucht mindestens drei Verdächtige." },
        { status: 400 },
      );
    }

    const drahtzieher =
      verdaechtige.find((c) => c.id === vorgaben.drahtzieherId) ??
      verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

    const staedte = alsStaedte(orte).filter((s) => s.orte.length >= vorgaben.ortsAnzahl);
    if (staedte.length === 0) {
      return NextResponse.json(
        {
          fehler: `Keine Stadt hat ${vorgaben.ortsAnzahl} Schauplätze. Bitte im Admin-Menü die Ortsliste oder die Anzahl anpassen.`,
        },
        { status: 400 },
      );
    }

    const optionen = {
      model: MODEL,
      max_tokens: 8192,
      system: [
        {
          type: "text" as const,
          text: buildWorldPrompt(
            spielendeBesetzung,
            orte.slice(0, 40),
            staedte.map((s) => s.name).join(", "),
            vorgaben.ton,
            [],
            vorgaben.reifegrad,
            vorgaben.absurditaet,
          ),
          cache_control: { type: "ephemeral" as const },
        },
      ],
      thinking: { type: "adaptive" as const },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(makeBogenSchema(spielendeBesetzung, vorgaben.kapitelAnzahl)),
      },
      messages: [
        {
          role: "user" as const,
          content: buildBogenPrompt(spielendeBesetzung, staedte, drahtzieher, vorgaben),
        },
      ],
    } as MessageCreateParamsNonStreaming;

    const response = await getAnthropic().messages.create(optionen, budget(50));

    const antwort = ergebnisAus<BogenDraft>(response, "api/saga:bogen");
    if ("fehler" in antwort) {
      return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
    }

    const draft = antwort.daten;
    const gueltig = new Set(verdaechtige.map((c) => c.id));
    const andere = verdaechtige.filter((c) => c.id !== drahtzieher.id);

    // Kapitel auf die gewünschte Anzahl bringen und die Täter absichern:
    // Der Drahtzieher darf in keinem Kapitel der Schuldige sein.
    const kapitel = (draft.kapitel ?? [])
      .slice(0, vorgaben.kapitelAnzahl)
      .map((k, i) => ({
        nummer: i + 1,
        name: k.name || `Kapitel ${i + 1}`,
        teaser: k.teaser ?? "",
        erzaehlerText: k.erzaehlerText ?? "",
        auftrag: k.auftrag ?? "",
        enthuellung: k.enthuellung ?? "",
        taeterId:
          gueltig.has(k.taeterId) && k.taeterId !== drahtzieher.id
            ? k.taeterId
            : andere[i % andere.length].id,
      }));

    if (kapitel.length < vorgaben.kapitelAnzahl) {
      return NextResponse.json(
        { fehler: "Das Modell hat zu wenige Kapitel geliefert. Bitte noch einmal versuchen." },
        { status: 502 },
      );
    }

    const bogen: Bogen = {
      id: crypto.randomUUID(),
      name: vorgaben.name.trim() || draft.name,
      thema: draft.thema,
      klappentext: draft.klappentext,
      vorgaben,
      besetzung: spielendeBesetzung,
      drahtzieherId: drahtzieher.id,
      drahtzieherName: drahtzieher.name,
      wahrheit: draft.wahrheit,
      drahtzieherMotiv: draft.drahtzieherMotiv,
      auftaktText: draft.auftaktText,
      kapitel,
      finale: {
        frage: draft.finale?.frage ?? "Wer steckt hinter allem?",
        auftrag: draft.finale?.auftrag ?? "",
        erzaehlerText: draft.finale?.erzaehlerText ?? "",
        epilogText: draft.finale?.epilogText ?? "",
      },
      erstelltAm: Date.now(),
    };

    // Öffentlich sind nur Namen, Anrisse und Erzählertexte - Drahtzieher,
    // Wahrheit und die Enthüllungen bleiben im Siegel.
    return NextResponse.json({
      bogenSiegel: seal(bogen),
      id: bogen.id,
      name: bogen.name,
      thema: bogen.thema,
      klappentext: bogen.klappentext,
      auftaktText: bogen.auftaktText,
      kapitel: bogen.kapitel.map((k) => ({
        nummer: k.nummer,
        name: k.name,
        teaser: k.teaser,
        erzaehlerText: k.erzaehlerText,
      })),
      finale: {
        frage: bogen.finale.frage,
        erzaehlerText: bogen.finale.erzaehlerText,
        epilogText: bogen.finale.epilogText,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/saga") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}
