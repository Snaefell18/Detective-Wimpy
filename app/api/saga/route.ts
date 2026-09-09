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
  mitAnklage,
  mitVerhandlung,
  noetigeBeweise,
  richterAus,
  type Beweisstueck,
  type FinaleArt,
  type VerhandlungWahrheit,
} from "@/lib/sagaFinale";
import { strafeAus } from "@/lib/urteil";
import {
  STANDARD_SAGA_VORGABEN,
  auftrittVon,
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
import { pruefeVorgaben } from "@/lib/sagaPruefung";
import {
  CharacterSchema,
  LocationSchema,
  SagaVorgabenSchema,
  einzelnGeprueft,
} from "@/lib/schemas";
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

    // In den späteren Schritten zählt nur, dass genug Orte da sind - was
    // nicht durchkommt, wurde beim ersten Schritt schon gemeldet.
    const { orte } = orteAus(body?.orte);
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

/**
 * Die Schauplätze aus dem Browser - Stück für Stück geprüft.
 *
 * Kommt gar nichts an, gelten die Orte aus dem Projekt. Kommt etwas an, das
 * teilweise nicht stimmt, wird genau das gemeldet: Ein stiller Rückfall auf
 * fremde Orte wäre die schlimmere Antwort.
 */
function orteAus(roh: unknown): { orte: Location[]; verworfen: string[] } {
  const { gut, verworfen } = einzelnGeprueft<Location>(LocationSchema, roh);
  return { orte: gut.length ? gut : LOCATIONS, verworfen };
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
  /*
   * Tiere und Orte kommen aus der Datenbank des Browsers. Was daran nicht
   * durch die Prüfung geht, wird BENANNT statt stillschweigend durch die
   * Stammdaten des Projekts ersetzt.
   *
   * Der stille Rückfall war ein übler Fehler: Im Formular standen die eigenen
   * Tiere, gerechnet wurde mit den sechs aus dem Projekt - und die Meldung
   * lautete dann für jedes ausgewählte Tier „spielt aber nicht mit", obwohl
   * alles angehakt war.
   */
  const { gut: eigene, verworfen: schlechteTiere } = einzelnGeprueft<Character>(
    CharacterSchema,
    body?.charaktere,
  );
  const besetzung: Character[] = eigene.length ? eigene : CHARACTERS;

  const { orte, verworfen: schlechteOrte } = orteAus(body?.orte);

  if (schlechteTiere.length || schlechteOrte.length) {
    return NextResponse.json(
      {
        fehler: [
          "Aus der Datenbank kam etwas, das nicht durch die Prüfung geht - damit würde die Saga mit den falschen Tieren entstehen.",
          schlechteTiere.length ? `Tiere: ${schlechteTiere.join("; ")}.` : "",
          schlechteOrte.length ? `Orte: ${schlechteOrte.join("; ")}.` : "",
          "Bitte den genannten Eintrag im Admin-Menü kürzen oder ergänzen.",
        ]
          .filter(Boolean)
          .join(" "),
      },
      { status: 400 },
    );
  }

  // Stimmt an den Vorgaben etwas nicht, wird das gesagt statt stillschweigend
  // auf Standardwerte zurückzufallen: Sonst entstünde eine Saga mit drei
  // Kapiteln, während der Browser fünf erwartet - und der bricht dann mitten
  // im Erzeugen mit "Unbekanntes Kapitel" ab.
  const geprueft = SagaVorgabenSchema.safeParse(body?.vorgaben);
  if (body?.vorgaben && !geprueft.success) {
    const stelle = geprueft.error.issues[0];
    return NextResponse.json(
      {
        fehler: `Die Vorgaben sind unvollständig: ${stelle?.path.join(".") || "unbekanntes Feld"} - ${
          stelle?.message ?? "ungültiger Wert"
        }. Bitte im Formular nachsehen und noch einmal versuchen.`,
      },
      { status: 400 },
    );
  }

  const vorgaben: SagaVorgaben = {
    ...STANDARD_SAGA_VORGABEN,
    ...(geprueft.data ?? {}),
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

  // Alles, was später scheitern würde, scheitert hier - vor dem ersten
  // Modellaufruf. Ein Lauf, der erst im letzten Schritt auffliegt, ist
  // bezahlt und trotzdem verloren.
  const probleme = pruefeVorgaben({ vorgaben, charaktere: besetzung, orte });
  if (probleme.length) {
    return NextResponse.json({ fehler: probleme.join(" ") }, { status: 400 });
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
    abKapitel: auftrittVon({
      charakterId: bogen.drahtzieherId,
      vorgaben: bogen.vorgaben,
      drahtzieherId: bogen.drahtzieherId,
    }),
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

/**
 * Wen man anklagen kann.
 *
 * Alle Tiere der Saga außer dem Detektiv und dem Vorsitz. Die Dämonengestalt
 * gehört ausdrücklich nicht dazu: Sie kennt vor ihrem Auftritt niemand, und
 * bei "Gericht & Dämon" klagt man den Wirt an - was in ihm steckt, zeigt sich
 * erst danach.
 *
 * Und der Richtige steht IMMER darin. Das ist keine Schönheitsfrage: Fehlte
 * er, wäre die Verhandlung nicht zu gewinnen - nach zwanzig bezahlten
 * Modellaufrufen.
 */
function anklagbar(bogen: Bogen, richterId: string, angeklagterId: string): string[] {
  const daemonId = besessen(bogen.vorgaben)?.daemonId ?? "";
  const ids = bogen.besetzung
    .filter(
      (c) =>
        !c.istDetektiv &&
        c.id !== richterId &&
        (c.id === angeklagterId || c.id !== daemonId),
    )
    .map((c) => c.id);
  return ids.includes(angeklagterId) ? ids : [angeklagterId, ...ids];
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
  // Bei "Gericht & Dämon" klagt man den Wirt an - die Gestalt darin kennt
  // vorher niemand.
  const besessenheit = besessen(bogen.vorgaben);
  const angeklagterId = angeklagterAus({
    art,
    besetzung: bogen.besetzung,
    drahtzieherId: bogen.drahtzieherId,
    wirtId: besessenheit?.wirtId,
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
      // Der längste Aufruf der ganzen Erzeugung: acht Beweisstücke mit
      // Reaktionen, dazu drei Urteilstexte. Mit 5000 Token kam die Antwort
      // gelegentlich abgeschnitten zurück - und das ausgerechnet an der
      // teuersten Stelle, nach allen Kapiteln.
      zodOutputFormat(VerhandlungSchema),
      9000,
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
    // Öhö sperrt niemanden weg - er denkt sich etwas aus, das zur Tat passt.
    strafeSchuldig: strafeAus(d.strafeWort, d.strafeAuflage),
    strafeFrei: strafeAus(d.strafeFreiWort, d.strafeFreiAuflage),
    // Wen man anklagen muss, steht ausschließlich hier.
    angeklagterId,
    anklageRichtig: kurz(d.anklageRichtig, 900),
    anklageFalsch: kurz(d.anklageFalsch, 900),
    // Bei "Gericht & Dämon" bricht die Gestalt erst bei der richtigen Anklage
    // hervor - vorher weiß der Browser nicht einmal, dass es sie gibt.
    verwandlung:
      art === "gericht-daemon" && besessenheit
        ? {
            wirtId: besessenheit.wirtId,
            daemonId: besessenheit.daemonId,
            ton: besessenheit.ton ?? "",
          }
        : undefined,
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
      // Wo der Spieler selbst anklagt, bleibt die Bank im Offenen leer.
      bankId: mitAnklage(art) ? "" : angeklagterId,
      richterId: richter.id,
      anklage: kurz(d.anklage, 1200),
      beweise,
      noetig: noetigeBeweise(wahrheit.beweise.filter((b) => b.traegt).length),
      fehlgriffe: 2,
      // Angeklagter, Vorsitz und - beim Finale "Wimpy selbst" - die Gestalt,
      // die aus ihm herausbricht. Ohne sie hätte der Saal Gesichter, für die
      // es kein Bild gibt: Sie müssen in keinem Kapitel aufgetreten sein.
      // Wen man anklagen kann: alle Tiere, die in der Saga aufgetreten sind.
      // Die Dämonengestalt gehört ausdrücklich nicht dazu - sie kennt vor
      // ihrem Auftritt niemand.
      anklagbareIds: mitAnklage(art) ? anklagbar(bogen, richter.id, angeklagterId) : [],
      anklageVersuche: 2,
      personen: [angeklagter, richter, drahtzieherFigur].filter(
        (c, i, alle): c is Character =>
          Boolean(c) && alle.findIndex((x) => x?.id === c?.id) === i,
      ),
    },
  });
}
