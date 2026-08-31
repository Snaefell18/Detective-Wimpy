import { NextResponse } from "next/server";
import { pruefeFall } from "@/lib/aktePruefen";
import { fehlerText } from "@/lib/antwort";
import type { Bogen } from "@/lib/sagaBogen";
import { CaseFileSchema, SagaVorgabenSchema } from "@/lib/schemas";
import { seal, unseal } from "@/lib/seal";
import type { CaseFile, PublicCase } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Die Akte eines Falls im Klartext - nur fürs Admin-Menü.
 *
 * Täter, Motiv, Alibis und Spuren liegen sonst nur verschlüsselt im Siegel,
 * damit sie im Spiel niemand nachlesen kann. Zum Bearbeiten muss der Server
 * sie aber herausgeben und danach wieder versiegeln. Deshalb hängt dieser
 * Weg an einem eigenen Passwort:
 *
 *   ADMIN_TOKEN in den Umgebungsvariablen setzen (Vercel > Settings).
 *
 * Ohne gesetztes Passwort ist die Akte in der Produktion gesperrt - sonst
 * könnte jeder die Lösung jeder Kampagne abrufen. Beim Entwickeln auf dem
 * eigenen Rechner ist sie offen, damit man nicht ständig etwas eintippen muss.
 */
function zugangGeprueft(request: Request): string | null {
  const erwartet = process.env.ADMIN_TOKEN;
  if (!erwartet) {
    return process.env.NODE_ENV === "production"
      ? "Die Akten sind gesperrt: Bitte ADMIN_TOKEN in den Umgebungsvariablen setzen."
      : null;
  }
  const mitgeschickt = request.headers.get("x-admin-token") ?? "";
  return mitgeschickt === erwartet ? null : "Falsches Admin-Passwort.";
}

/** Was der Browser über einen Fall erfahren darf. */
function oeffentlichVon(fall: CaseFile): PublicCase {
  return {
    id: fall.id,
    besetzung: fall.besetzung,
    stadt: fall.stadt,
    orte: fall.orte,
    titel: fall.titel,
    tatbeschreibung: fall.tatbeschreibung,
    introText: fall.introText,
    schlagworte: fall.schlagworte,
    tatort: fall.tatort,
    aufenthalt: Object.fromEntries(
      fall.verdaechtige.map((v) => [v.charakterId, v.aufenthaltsort]),
    ),
    erstelltAm: fall.erstelltAm,
  };
}

export async function POST(request: Request) {
  try {
    const gesperrt = zugangGeprueft(request);
    if (gesperrt) return NextResponse.json({ fehler: gesperrt }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const aktion = String(body?.aktion ?? "");

    if (aktion === "fall-lesen") {
      let fall: CaseFile;
      try {
        fall = unseal<CaseFile>(String(body?.siegel ?? ""));
      } catch {
        return NextResponse.json(
          { fehler: "Das Siegel lässt sich nicht öffnen. Wurde CASE_SECRET seitdem geändert?" },
          { status: 400 },
        );
      }
      // Ältere Fälle kennen manche Felder noch nicht.
      return NextResponse.json({
        fall: {
          ...fall,
          items: fall.items ?? [],
          reifegrad: fall.reifegrad ?? "kindgerecht",
          absurditaet: fall.absurditaet ?? "verspielt",
          schlagworte: fall.schlagworte ?? [],
        },
      });
    }

    if (aktion === "fall-schreiben") {
      const geprueft = CaseFileSchema.safeParse(body?.fall);
      if (!geprueft.success) {
        return NextResponse.json(
          { fehler: `Die Akte hat eine unerwartete Form: ${geprueft.error.issues[0]?.message}` },
          { status: 400 },
        );
      }
      const fall = geprueft.data as CaseFile;

      const probleme = pruefeFall(fall);
      if (probleme.length) {
        return NextResponse.json({ fehler: probleme.join(" ") }, { status: 400 });
      }

      return NextResponse.json({ fall: oeffentlichVon(fall), siegel: seal(fall) });
    }

    if (aktion === "bogen-lesen") {
      try {
        return NextResponse.json({ bogen: unseal<Bogen>(String(body?.bogenSiegel ?? "")) });
      } catch {
        return NextResponse.json(
          { fehler: "Der Bogen lässt sich nicht öffnen. Wurde CASE_SECRET seitdem geändert?" },
          { status: 400 },
        );
      }
    }

    if (aktion === "bogen-schreiben") {
      const roh = body?.bogen as Bogen | undefined;
      if (!roh?.id || !Array.isArray(roh.kapitel)) {
        return NextResponse.json({ fehler: "Der Bogen hat eine unerwartete Form." }, { status: 400 });
      }
      const vorgaben = SagaVorgabenSchema.safeParse(roh.vorgaben);
      if (!vorgaben.success) {
        return NextResponse.json({ fehler: "Die Vorgaben der Saga sind unbrauchbar." }, { status: 400 });
      }

      const ids = new Set(roh.besetzung.filter((c) => !c.istDetektiv).map((c) => c.id));
      if (!ids.has(roh.drahtzieherId)) {
        return NextResponse.json(
          { fehler: "Der Drahtzieher gehört nicht zu den Verdächtigen der Saga." },
          { status: 400 },
        );
      }
      const inKapiteln = roh.kapitel.find((k) => k.taeterId === roh.drahtzieherId);
      if (inKapiteln) {
        return NextResponse.json(
          {
            fehler: `Der Drahtzieher darf in keinem Kapitel der Täter sein - in „${inKapiteln.name}“ ist er es.`,
          },
          { status: 400 },
        );
      }
      for (const k of roh.kapitel) {
        if (!ids.has(k.taeterId)) {
          return NextResponse.json(
            { fehler: `Der Täter von „${k.name}“ gehört nicht zur Besetzung der Saga.` },
            { status: 400 },
          );
        }
      }

      return NextResponse.json({ bogenSiegel: seal({ ...roh, vorgaben: vorgaben.data }) });
    }

    return NextResponse.json({ fehler: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ fehler: fehlerText(error, "api/akte") }, { status: 500 });
  }
}
