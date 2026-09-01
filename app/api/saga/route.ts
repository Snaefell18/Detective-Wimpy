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
import {
  buildFinalePrompt,
  buildKapitelPrompt,
  buildKernPrompt,
} from "@/lib/sagaPrompts";
import type { FinaleDraft, KapitelDraft, KernDraft } from "@/lib/sagaSchemas";
import { FinaleSchema, KernSchema, makeKapitelSchema } from "@/lib/sagaSchemas";
import {
  STANDARD_SAGA_VORGABEN,
  besetzungFuerKapitel,
  neuInKapitel,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { CharacterSchema, LocationSchema, SagaVorgabenSchema } from "@/lib/schemas";
import { seal, unseal } from "@/lib/seal";
import type { Character, City, Location } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Der Bogen einer Saga - in vielen kleinen Aufrufen.
 *
 *   "kern"    - Titel, Überthema, Wahrheit, Auftakt
 *   "kapitel" - ein Aufruf je Kapitel, nacheinander
 *   "finale"  - Frage, Erzählertext, Epilog
 *
 * Vorher entstand der ganze Bogen in einem Zug; bei langen Sagas lief das in
 * das Zeitlimit der Plattform. Die Fälle der Kapitel kommen danach wie gehabt
 * einzeln über /api/case, jeder wiederum in drei Schritten.
 *
 * Zwischen den Schritten wandert der halbfertige Bogen verschlüsselt durch
 * den Browser: Drahtzieher, Wahrheit und Enthüllungen bleiben geheim.
 */
type Schritt = "kern" | "kapitel" | "finale";

const modellOptionen = (
  system: string,
  frage: string,
  format: ReturnType<typeof zodOutputFormat>,
  maxTokens: number,
) =>
  ({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } },
    ],
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium", format },
    messages: [{ role: "user" as const, content: frage }],
  }) as MessageCreateParamsNonStreaming;

/** Weltwissen - in allen Schritten identisch, wird also zwischengespeichert. */
const welt = (besetzung: Character[], orte: Location[], staedte: City[], v: SagaVorgaben) =>
  buildWorldPrompt(
    besetzung,
    orte.slice(0, 40),
    staedte.map((s) => s.name).join(", "),
    v.ton,
    [],
    v.reifegrad,
    v.absurditaet,
  );

/** Welche Stadt für Kapitel n (1-basiert; 0 = Finale) gewünscht ist. */
function stadtFuer(vorgaben: SagaVorgaben, nummer: number, staedte: City[]): string {
  const index = nummer === 0 ? vorgaben.kapitelAnzahl : nummer - 1;
  const gewuenscht = vorgaben.kapitelStaedte[index] ?? "";
  const wert =
    gewuenscht || (vorgaben.staedteWechseln ? "zufall" : vorgaben.stadt || "zufall");
  if (wert === "zufall") return "zufall";
  return staedte.some((s) => s.id === wert) ? wert : "zufall";
}

const stadtName = (id: string, staedte: City[]) =>
  id === "zufall"
    ? "einer Stadt deiner Wahl aus der Liste"
    : (staedte.find((s) => s.id === id)?.name ?? "einer Stadt aus der Liste");

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const schritt: Schritt = ["kapitel", "finale"].includes(body?.schritt)
      ? body.schritt
      : "kern";

    if (schritt === "kern") return await kernSchritt(body);

    let bogen: Bogen;
    try {
      bogen = unseal<Bogen>(String(body?.bogenSiegel ?? ""));
    } catch {
      return NextResponse.json(
        { fehler: "Der halbfertige Bogen ist abgelaufen. Bitte noch einmal von vorn anfangen." },
        { status: 400 },
      );
    }

    const orte = orteAus(body?.orte);
    const staedte = alsStaedte(orte).filter(
      (s) => s.orte.length >= bogen.vorgaben.ortsAnzahl,
    );

    return schritt === "kapitel"
      ? await kapitelSchritt(bogen, orte, staedte, Number(body?.nummer ?? 1))
      : await finaleSchritt(bogen, orte, staedte);
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/saga") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}

function orteAus(roh: unknown): Location[] {
  const geprueft = LocationSchema.array().max(120).safeParse(roh);
  return geprueft.success && geprueft.data.length ? (geprueft.data as Location[]) : LOCATIONS;
}

/* --- Schritt 1: der Kern -------------------------------------------- */

async function kernSchritt(body: Record<string, unknown>) {
  const rohBesetzung = CharacterSchema.array().max(24).safeParse(body?.charaktere);
  const besetzung: Character[] = rohBesetzung.success
    ? (rohBesetzung.data as Character[])
    : CHARACTERS;

  const orte = orteAus(body?.orte);

  const vorgaben: SagaVorgaben = {
    ...STANDARD_SAGA_VORGABEN,
    ...(SagaVorgabenSchema.safeParse(body?.vorgaben).data ?? {}),
  };

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

  const response = await getAnthropic().messages.create(
    modellOptionen(
      welt(spielendeBesetzung, orte, staedte, vorgaben),
      buildKernPrompt(spielendeBesetzung, staedte, drahtzieher, vorgaben),
      zodOutputFormat(KernSchema),
      3000,
    ),
    budget(45),
  );

  const antwort = ergebnisAus<KernDraft>(response, "api/saga:kern");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const bogen: Bogen = {
    id: crypto.randomUUID(),
    name: vorgaben.name.trim() || antwort.daten.name,
    thema: antwort.daten.thema,
    klappentext: antwort.daten.klappentext,
    vorgaben,
    besetzung: spielendeBesetzung,
    drahtzieherId: drahtzieher.id,
    drahtzieherName: drahtzieher.name,
    wahrheit: antwort.daten.wahrheit,
    drahtzieherMotiv: antwort.daten.drahtzieherMotiv,
    auftaktText: antwort.daten.auftaktText,
    schlagworte: antwort.daten.schlagworte.slice(0, 6),
    kapitel: [],
    finale: { frage: "", auftrag: "", erzaehlerText: "", epilogText: "", stadt: "zufall" },
    erstelltAm: Date.now(),
  };

  return NextResponse.json({
    schritt: "kern",
    bogenSiegel: seal(bogen),
    id: bogen.id,
    name: bogen.name,
    thema: bogen.thema,
    klappentext: bogen.klappentext,
    auftaktText: bogen.auftaktText,
    schlagworte: bogen.schlagworte,
    kapitelAnzahl: vorgaben.kapitelAnzahl,
  });
}

/* --- Schritt 2: ein Kapitel ----------------------------------------- */

async function kapitelSchritt(
  bogen: Bogen,
  orte: Location[],
  staedte: City[],
  nummer: number,
) {
  if (nummer < 1 || nummer > bogen.vorgaben.kapitelAnzahl) {
    return NextResponse.json({ fehler: "Unbekanntes Kapitel." }, { status: 400 });
  }

  // Nur wer in diesem Kapitel überhaupt auftritt, kann sein Täter sein -
  // sonst zeigten die Spuren auf jemanden, den man nie zu Gesicht bekommt.
  const dabei = besetzungFuerKapitel({
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
    kapitel: nummer,
    vorgaben: bogen.vorgaben,
  });
  const moeglich = dabei.filter(
    (c) => !c.istDetektiv && c.id !== bogen.drahtzieherId,
  );
  const neue = neuInKapitel({
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
    kapitel: nummer,
    vorgaben: bogen.vorgaben,
  });
  const stadt = stadtFuer(bogen.vorgaben, nummer, staedte);

  const response = await getAnthropic().messages.create(
    modellOptionen(
      welt(dabei, orte, staedte, bogen.vorgaben),
      buildKapitelPrompt({
        nummer,
        anzahl: bogen.vorgaben.kapitelAnzahl,
        thema: bogen.thema,
        wahrheit: bogen.wahrheit,
        drahtzieherName: bogen.drahtzieherName,
        drahtzieherId: bogen.drahtzieherId,
        moeglicheTaeter: moeglich,
        bisher: bogen.kapitel.map((k) => ({ name: k.name, enthuellung: k.enthuellung })),
        wunsch: bogen.vorgaben.kapitelWuensche[nummer - 1] ?? "",
        stadt: stadtName(stadt, staedte),
        twist: bogen.vorgaben.twist === true,
        neueTiere: neue.map((c) => c.name),
      }),
      zodOutputFormat(makeKapitelSchema(dabei)),
      3000,
    ),
    budget(45),
  );

  const antwort = ergebnisAus<KapitelDraft>(response, "api/saga:kapitel");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const d = antwort.daten;
  const taeterId =
    moeglich.find((c) => c.id === d.taeterId)?.id ??
    moeglich[(nummer - 1) % moeglich.length].id;

  const kapitel = {
    nummer,
    name: d.name || `Kapitel ${nummer}`,
    teaser: d.teaser ?? "",
    erzaehlerText: d.erzaehlerText ?? "",
    auftrag: d.auftrag ?? "",
    enthuellung: d.enthuellung ?? "",
    taeterId,
    stadt,
  };

  // Ein bereits vorhandenes Kapitel gleicher Nummer wird ersetzt.
  const naechster: Bogen = {
    ...bogen,
    kapitel: [...bogen.kapitel.filter((k) => k.nummer !== nummer), kapitel].sort(
      (a, b) => a.nummer - b.nummer,
    ),
  };

  return NextResponse.json({
    schritt: "kapitel",
    bogenSiegel: seal(naechster),
    kapitel: {
      nummer,
      name: kapitel.name,
      teaser: kapitel.teaser,
      erzaehlerText: kapitel.erzaehlerText,
    },
  });
}

/* --- Schritt 3: das Finale ------------------------------------------ */

async function finaleSchritt(bogen: Bogen, orte: Location[], staedte: City[]) {
  const response = await getAnthropic().messages.create(
    modellOptionen(
      welt(bogen.besetzung, orte, staedte, bogen.vorgaben),
      buildFinalePrompt({
        thema: bogen.thema,
        wahrheit: bogen.wahrheit,
        drahtzieherName: bogen.drahtzieherName,
        motiv: bogen.drahtzieherMotiv,
        bisher: bogen.kapitel.map((k) => ({ name: k.name, enthuellung: k.enthuellung })),
        twist: bogen.vorgaben.twist === true,
        neueTiere: neuInKapitel({
          besetzung: bogen.besetzung,
          drahtzieherId: bogen.drahtzieherId,
          kapitel: 0,
          vorgaben: bogen.vorgaben,
        }).map((c) => c.name),
      }),
      zodOutputFormat(FinaleSchema),
      3000,
    ),
    budget(45),
  );

  const antwort = ergebnisAus<FinaleDraft>(response, "api/saga:finale");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const d = antwort.daten;
  const fertig: Bogen = {
    ...bogen,
    finale: {
      frage: d.frage || "Wer steckt hinter allem?",
      auftrag: d.auftrag ?? "",
      erzaehlerText: d.erzaehlerText ?? "",
      epilogText: d.epilogText ?? "",
      stadt: stadtFuer(bogen.vorgaben, 0, staedte),
    },
  };

  return NextResponse.json({
    schritt: "finale",
    bogenSiegel: seal(fertig),
    finale: {
      frage: fertig.finale.frage,
      erzaehlerText: fertig.finale.erzaehlerText,
      epilogText: fertig.finale.epilogText,
    },
  });
}
