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
  buildVerhandlungPrompt,
  finaleArtRegeln,
} from "@/lib/sagaPrompts";
import type { FinaleDraft, KapitelDraft, KernDraft, VerhandlungDraft } from "@/lib/sagaSchemas";
import {
  FinaleSchema,
  KernSchema,
  VerhandlungSchema,
  makeKapitelSchema,
} from "@/lib/sagaSchemas";
import {
  angeklagterAus,
  mitVerhandlung,
  noetigeBeweise,
  richterAus,
  type Beweisstueck,
  type FinaleArt,
  type VerhandlungWahrheit,
} from "@/lib/sagaFinale";
import {
  STANDARD_SAGA_VORGABEN,
  besetzungFuerKapitel,
  besessen,
  besetzungFuerSaga,
  kapitelTaeterFuer,
  neuInKapitel,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import {
  nochNichtDa,
  ohneEnttarnung,
  ohneNamen,
  titelOhneNamen,
  worteOhneNamen,
} from "@/lib/namenSchutz";
import { CharacterSchema, LocationSchema, SagaVorgabenSchema } from "@/lib/schemas";
import { haftTage } from "@/lib/schrankhaft";
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

/**
 * Wirt und Dämonengestalt mit Namen - so, wie die Prompts sie brauchen.
 * Ohne eingerichtete Besessenheit kommt undefined, und alles bleibt wie
 * bisher.
 */
function besessenheitVon(
  besetzung: Character[],
  vorgaben: SagaVorgaben,
): { wirt: string; daemon: string } | undefined {
  const b = besessen(vorgaben);
  if (!b) return undefined;
  const name = (id: string) => besetzung.find((c) => c.id === id)?.name;
  const wirt = name(b.wirtId);
  const daemon = name(b.daemonId);
  return wirt && daemon ? { wirt, daemon } : undefined;
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

  // Der Drahtzieher ist immer dabei, auch wenn man ihn oben nicht angehakt
  // hat - sonst würfelt der Server unten jemand anderen aus.
  const spielendeBesetzung = besetzungFuerSaga(besetzung, vorgaben);

  const verdaechtige = spielendeBesetzung.filter((c) => !c.istDetektiv);
  if (verdaechtige.length < 3) {
    return NextResponse.json(
      { fehler: "Eine Saga braucht mindestens drei Verdächtige." },
      { status: 400 },
    );
  }

  // Gibt es eine Besessenheit, ist die Dämonenform der Schuldige der ganzen
  // Saga - sie steckte hinter allem, auch wenn man bis zum Finale nur ihren
  // Wirt zu sehen bekommt.
  const daemon = besessen(vorgaben)?.daemonId ?? "";
  const drahtzieher =
    verdaechtige.find((c) => c.id === daemon) ??
    verdaechtige.find((c) => c.id === vorgaben.drahtzieherId) ??
    verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

  // Beim Finale "Wimpy selbst" ist der Detektiv der Wirt: Die Dämonenform
  // steckt die ganze Saga über in ihm. Damit gelten für die Kapitel dieselben
  // Regeln wie bei jeder anderen Besessenheit - eine Zeile pro Kapitel, nie
  // benannt -, und vor der Verhandlung läuft die Verwandlung.
  const detektiv = spielendeBesetzung.find((c) => c.istDetektiv);
  if (vorgaben.finaleArt === "wimpy" && detektiv) {
    vorgaben.besessenheit = {
      wirtId: detektiv.id,
      daemonId: drahtzieher.id,
      ton: vorgaben.besessenheit?.ton ?? "",
    };
  }

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

  // Wer erst später auftritt, darf hier noch nirgends stehen: Titel,
  // Klappentext, Auftakt und Schlagworte sind der Vorspann - das Erste, was
  // der Spieler sieht.
  const zuFrueh = nochNichtDa({
    besetzung: spielendeBesetzung,
    drahtzieherId: drahtzieher.id,
    vorgaben,
    kapitel: 0,
  }).map((c) => c.name);

  // Die Sicherheitsregeln der Datenbank begrenzen Name, Überthema und
  // Klappentext. Ein Modell, dem man ein langes Überthema vorgibt - wie es
  // ein Arc tut -, antwortet gern ebenso lang; ungekürzt lehnt Firestore das
  // Speichern später ab, und zwar mit einer Meldung über fehlende Rechte.
  const kuerze = (text: string, laenge: number) =>
    text.length > laenge ? `${text.slice(0, laenge - 1).trimEnd()}…` : text;

  /**
   * Vor dem Finale darf niemand lesen, wer hinter allem steckt. Erst die
   * Namen der noch nicht Aufgetretenen streichen, dann die Sätze, die den
   * Drahtzieher als den Verantwortlichen ausweisen.
   */
  const sauber = (text: string) =>
    ohneEnttarnung(ohneNamen(text, zuFrueh), drahtzieher.name);

  const bogen: Bogen = {
    id: crypto.randomUUID(),
    name: kuerze(
      vorgaben.name.trim() ||
        titelOhneNamen(antwort.daten.name, [...zuFrueh, drahtzieher.name]) ||
        "Die Spur im Schatten",
      120,
    ),
    thema: kuerze(sauber(antwort.daten.thema), 2000),
    klappentext: kuerze(sauber(antwort.daten.klappentext), 2000),
    vorgaben,
    besetzung: spielendeBesetzung,
    drahtzieherId: drahtzieher.id,
    drahtzieherName: drahtzieher.name,
    wahrheit: antwort.daten.wahrheit,
    drahtzieherMotiv: antwort.daten.drahtzieherMotiv,
    auftaktText: sauber(antwort.daten.auftaktText),
    schlagworte: worteOhneNamen(antwort.daten.schlagworte, zuFrueh).slice(0, 6),
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
  const wunschTaeter = bogen.vorgaben.kapitelTaeter?.[nummer - 1] ?? "";
  const neue = neuInKapitel({
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
    kapitel: nummer,
    vorgaben: bogen.vorgaben,
  });
  const stadt = stadtFuer(bogen.vorgaben, nummer, staedte);

  // Wer erst nach diesem Kapitel dazustößt, kommt hier weder vor noch zur
  // Sprache - das sagt schon der Prompt, geprüft wird es danach trotzdem.
  const zuFrueh = nochNichtDa({
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
    vorgaben: bogen.vorgaben,
    kapitel: nummer,
  }).map((c) => c.name);

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
        besessenheit: besessenheitVon(bogen.besetzung, bogen.vorgaben),
        finaleRegeln: kapitelRegeln(bogen),
        neueTiere: neue.map((c) => c.name),
        wunschTaeter: moeglich.find((c) => c.id === wunschTaeter)?.name ?? "",
        nochNichtDaTiere: zuFrueh,
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
  const taeterId = kapitelTaeterFuer({
    moeglich,
    wunsch: wunschTaeter,
    vorschlag: d.taeterId,
    nummer,
  });

  // Auch hier gilt: anteasern ja, benennen nein. Der Drahtzieher steht erst
  // im Finale fest - vorher fliegt jeder Satz, der ihn als den Kopf hinter
  // allem ausweist.
  const sauber = (text: string) =>
    ohneEnttarnung(ohneNamen(text, zuFrueh), bogen.drahtzieherName);

  const kapitel = {
    nummer,
    name: (
      titelOhneNamen(d.name ?? "", [...zuFrueh, bogen.drahtzieherName]) ||
      `Kapitel ${nummer}`
    ).slice(0, 120),
    teaser: sauber(d.teaser ?? ""),
    erzaehlerText: sauber(d.erzaehlerText ?? ""),
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

/**
 * Die Regeln der gewählten Finale-Art für ein Kapitel.
 *
 * Bei "Wimpy selbst" bleibt es leer: Dort steht dieselbe Ansage schon in den
 * Besessenheitsregeln, und zweimal dasselbe macht Prompts nicht besser.
 */
function kapitelRegeln(bogen: Bogen): string {
  const art: FinaleArt = bogen.vorgaben.finaleArt ?? "klassisch";
  if (art === "klassisch" || art === "wimpy") return "";
  return finaleArtRegeln({
    art,
    taeterName: bogen.drahtzieherName,
    detektivName: bogen.besetzung.find((c) => c.istDetektiv)?.name ?? "Wimpy",
  });
}

/* --- Schritt 3: das Finale ------------------------------------------ */

async function finaleSchritt(bogen: Bogen, orte: Location[], staedte: City[]) {
  const art: FinaleArt = bogen.vorgaben.finaleArt ?? "klassisch";
  if (mitVerhandlung(art)) return await verhandlungsSchritt(bogen, orte, staedte, art);

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
        besessenheit: besessenheitVon(bogen.besetzung, bogen.vorgaben),
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

/* --- Schritt 3b: die Verhandlung statt eines Finalfalls -------------- */

/**
 * Der Gerichtssaal.
 *
 * Was der Browser bekommt, sind die Beweisstücke ohne jede Wertung; ob eines
 * trägt und was der Saal dazu sagt, wandert in den versiegelten Bogen. Geprüft
 * wird später auf dem Server (siehe app/api/verhandlung/route.ts) - im offenen
 * Teil der Datenbank steht die Lösung nirgends.
 */
async function verhandlungsSchritt(
  bogen: Bogen,
  orte: Location[],
  staedte: City[],
  art: FinaleArt,
) {
  const angeklagterId = angeklagterAus({
    art,
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
  });
  const angeklagter = bogen.besetzung.find((c) => c.id === angeklagterId);
  const richter = richterAus(bogen.besetzung, angeklagterId);
  const detektiv = bogen.besetzung.find((c) => c.istDetektiv);
  const drahtzieherFigur = bogen.besetzung.find((c) => c.id === bogen.drahtzieherId);

  if (!angeklagter || !richter) {
    return NextResponse.json(
      {
        fehler:
          "Für die Verhandlung fehlen Angeklagter oder Vorsitz. Bitte mehr Tiere für die Saga auswählen.",
      },
      { status: 400 },
    );
  }

  const response = await getAnthropic().messages.create(
    modellOptionen(
      welt(bogen.besetzung, orte, staedte, bogen.vorgaben),
      buildVerhandlungPrompt({
        art,
        thema: bogen.thema,
        wahrheit: bogen.wahrheit,
        angeklagter: angeklagter.name,
        richter: richter.name,
        detektivName: detektiv?.name ?? "Wimpy",
        motiv: bogen.drahtzieherMotiv,
        kapitel: bogen.kapitel.map((k) => ({ name: k.name, enthuellung: k.enthuellung })),
      }),
      zodOutputFormat(VerhandlungSchema),
      5000,
    ),
    budget(45),
  );

  const antwort = ergebnisAus<VerhandlungDraft>(response, "api/saga:verhandlung");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }
  const d = antwort.daten;

  const roh = (d.beweise ?? []).slice(0, 10);
  if (roh.length < 2) {
    return NextResponse.json(
      { fehler: "Die Verhandlung kam ohne Beweise zurück. Bitte noch einmal erzeugen." },
      { status: 502 },
    );
  }
  // Ohne ein einziges tragendes Stück wäre die Verhandlung nicht zu gewinnen -
  // dann trägt eben das erste.
  const traegtIrgendwas = roh.some((b) => b.traegt);

  const kurz = (text: string, laenge: number) => (text ?? "").trim().slice(0, laenge);

  const beweise: Beweisstueck[] = roh.map((b, i) => ({
    id: `b${i + 1}`,
    name: kurz(b.name, 120) || `Beweisstück ${i + 1}`,
    herkunft: kurz(b.herkunft, 120),
    text: kurz(b.text, 600),
  }));

  const wahrheit: VerhandlungWahrheit = {
    beweise: roh.map((b, i) => ({
      id: `b${i + 1}`,
      traegt: traegtIrgendwas ? b.traegt === true : i === 0,
      reaktion: kurz(b.reaktion, 900),
    })),
    urteilSchuldig: kurz(d.urteilSchuldig, 1200),
    urteilFrei: kurz(d.urteilFrei, 1200),
    // Jedes Urteil dieser Stadt endet in Tagen Schrankhaft. Beim Freispruch
    // sind es null - dann bleibt die Schranktür zu.
    tageSchuldig: haftTage(d.tageSchuldig, art === "ohne-taeter" ? 0 : 21),
    tageFrei: haftTage(d.tageFrei, art === "ohne-taeter" ? 14 : 0),
  };

  const fertig: Bogen = {
    ...bogen,
    finale: {
      frage: kurz(d.frage, 200) || "Reicht, was du hast?",
      auftrag: "",
      erzaehlerText: kurz(d.erzaehlerText, 2000),
      epilogText: kurz(d.epilogText, 2000),
      stadt: stadtFuer(bogen.vorgaben, 0, staedte),
      wahrheit,
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
    verhandlung: {
      art,
      angeklagterId,
      richterId: richter.id,
      anklage: kurz(d.anklage, 1200),
      beweise,
      noetig: noetigeBeweise(wahrheit.beweise.filter((b) => b.traegt).length),
      fehlgriffe: 2,
      // Angeklagter, Vorsitz und - beim Finale "Wimpy selbst" - die Gestalt,
      // die aus ihm herausbricht. Ohne sie hätte der Saal Gesichter, für die
      // es kein Bild gibt: Sie müssen in keinem Kapitel aufgetreten sein.
      personen: [angeklagter, richter, drahtzieherFigur].filter(
        (c, i, alle): c is Character =>
          Boolean(c) && alle.findIndex((x) => x?.id === c?.id) === i,
      ),
    },
  });
}
