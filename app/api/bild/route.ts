import { NextResponse } from "next/server";
import { adminGesperrt } from "@/lib/adminSchloss";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bilder erzeugen lassen - über die Bild-Schnittstelle von OpenAI.
 *
 * Das ist die einzige Stelle im Projekt, an der ein anderes Haus als
 * Anthropic gefragt wird: Fälle, Sagen und Gespräche laufen unverändert über
 * Claude. Hier geht es nur um Bilder, und die kann Claude nicht malen.
 *
 * Wie bei der Sprachausgabe gilt: nur fürs Admin-Menü, hinter demselben
 * Passwort. Jeder Aufruf kostet Geld, und ein offener Weg dorthin wäre eine
 * Rechnung, die jeder Fremde in die Höhe treiben kann. Erzeugt wird deshalb
 * einmal, und das Ergebnis wird gespeichert.
 *
 * Nötig ist eine Umgebungsvariable:
 *   OPENAI_API_KEY - der Schlüssel aus dem OpenAI-Konto
 *
 * Optional:
 *   OPENAI_IMAGE_MODEL   - Voreinstellung "gpt-image-2.5-flare"
 *   OPENAI_IMAGE_QUALITY - Voreinstellung "high"; daneben "low", "medium",
 *                          "xhigh", "max" und "auto"
 *
 * Ohne Schlüssel bleibt alles wie bisher: Der Knopf sagt, dass nichts
 * eingerichtet ist, und Bilder lassen sich weiterhin von Hand ablegen.
 */

/**
 * Welches Modell malt - und wie sorgfältig.
 *
 * Voreingestellt ist Flare aus der 2.5er-Reihe: die schnellere und günstigere
 * der beiden Varianten. Für flächige Comicbilder mit klaren Konturen ist das
 * genau richtig; Sunburst spielt seine Stärke beim genauen Nachbearbeiten
 * aus, und nachbearbeitet wird hier nichts - jedes Bild entsteht einmal.
 *
 * Die Qualität steht auf "high": deutlich mehr Sorgfalt als "medium", aber
 * ohne die Sprünge nach "xhigh" oder "max", die vor allem länger dauern und
 * die Rechnung treiben. Weil jedes Bild nur einmal entsteht und danach für
 * immer im Spiel steht, lohnt sich diese Stufe.
 *
 * Beides lässt sich über Umgebungsvariablen ändern, ohne den Code anzufassen.
 */
const modellName = (): string =>
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";

const qualitaet = (): string => process.env.OPENAI_IMAGE_QUALITY ?? "high";

/** Was das Format sein darf - alles andere lehnt die Schnittstelle ab. */
const FORMATE = new Set(["1024x1024", "1024x1536", "1536x1024"]);

/** Genug für eine ausführliche Beschreibung - und eine Bremse für die Kosten. */
const MAX_ZEICHEN = 4000;

/**
 * Die Vorlage als Datei verpacken.
 *
 * Der Umzeichnen-Weg erwartet multipart/form-data, nicht JSON - das Bild
 * kommt vom Browser als data:-URL und wird hier zurückverwandelt.
 */
function alsFormular(vorlage: string, felder: Record<string, string>): FormData {
  const [kopf, inhalt] = vorlage.split(",");
  const typ = /data:([^;]+)/.exec(kopf ?? "")?.[1] ?? "image/png";
  const bytes = Buffer.from(inhalt ?? "", "base64");
  const endung = typ.includes("jpeg") ? "jpg" : typ.includes("webp") ? "webp" : "png";

  const formular = new FormData();
  formular.append("image", new Blob([new Uint8Array(bytes)], { type: typ }), `vorlage.${endung}`);
  formular.append("n", "1");
  for (const [name, wert] of Object.entries(felder)) formular.append(name, wert);
  return formular;
}

export async function POST(request: Request) {
  try {
    const gesperrt = adminGesperrt(request, "Die Bilderzeugung");
    if (gesperrt) return NextResponse.json({ fehler: gesperrt }, { status: 403 });

    const schluessel = process.env.OPENAI_API_KEY;
    if (!schluessel) {
      return NextResponse.json(
        {
          fehler:
            "Die Bilderzeugung ist nicht eingerichtet: OPENAI_API_KEY in den Umgebungsvariablen setzen.",
        },
        { status: 501 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const auftrag = String(body?.auftrag ?? "").trim();
    if (!auftrag) {
      return NextResponse.json({ fehler: "Kein Auftrag fürs Bild." }, { status: 400 });
    }
    if (auftrag.length > MAX_ZEICHEN) {
      return NextResponse.json(
        { fehler: `Der Auftrag ist mit ${auftrag.length} Zeichen zu lang.` },
        { status: 400 },
      );
    }

    // Eine Vorlage kommt als data:-URL; mehr als ein paar Megabyte nimmt
    // weder die Schnittstelle noch die Funktion selbst entgegen.
    if (typeof body?.vorlage === "string" && body.vorlage.length > 4_000_000) {
      return NextResponse.json({ fehler: "Die Vorlage ist zu groß." }, { status: 400 });
    }

    const format = String(body?.format ?? "1024x1024");
    if (!FORMATE.has(format)) {
      return NextResponse.json({ fehler: "Unbekanntes Bildformat." }, { status: 400 });
    }

    const modell = modellName();
    // Die feineren Regler kennt nur die gpt-image-Reihe; ältere Modelle wie
    // dall-e-3 lehnen sie ab. Bei durchsichtigem Grund verlangt die
    // Schnittstelle png oder webp - deshalb steht png hier fest.
    const gptBild = modell.startsWith("gpt-image");
    const extras: Record<string, string> = gptBild
      ? {
          background: body?.freigestellt ? "transparent" : "opaque",
          output_format: "png",
          quality: qualitaet(),
        }
      : {};

    /*
     * Eine Vorlage macht aus dem Malen ein Umzeichnen: Dieselbe Figur, neu
     * eingekleidet - so entsteht aus einem Tier seine Dämonenfassung, ohne
     * dass es ein anderes Tier wird. Dafür gibt es einen eigenen Weg
     * (/images/edits), der das Bild als Datei erwartet.
     */
    const vorlage = typeof body?.vorlage === "string" ? body.vorlage : "";
    const antwort = vorlage
      ? await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${schluessel}` },
          body: alsFormular(vorlage, { model: modell, prompt: auftrag, size: format, ...extras }),
          signal: AbortSignal.timeout(55_000),
        })
      : await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${schluessel}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: modell, prompt: auftrag, n: 1, size: format, ...extras }),
          signal: AbortSignal.timeout(55_000),
        });

    if (!antwort.ok) {
      const grund = await antwort.text().catch(() => "");
      const hinweise: Record<number, string> = {
        401: "Der OPENAI_API_KEY stimmt nicht.",
        403: `Das Konto darf „${modell}“ nicht benutzen. Für die gpt-image-Modelle muss die Organisation bei OpenAI einmal verifiziert werden.`,
        404: `Das Modell „${modell}“ gibt es für dieses Konto nicht.`,
        429: "Das Kontingent bei OpenAI ist aufgebraucht oder es kamen zu viele Anfragen.",
      };
      const hinweis = hinweise[antwort.status] ?? "";
      return NextResponse.json(
        {
          fehler: `Die Bilderzeugung hat abgelehnt (${antwort.status}). ${hinweis} ${grund.slice(
            0,
            300,
          )}`.trim(),
        },
        { status: 502 },
      );
    }

    const daten = (await antwort.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const bild = daten.data?.[0];

    // Manche Modelle schicken statt der Daten einen Link - dann eben holen.
    const base64 =
      bild?.b64_json ??
      (bild?.url
        ? await fetch(bild.url, { signal: AbortSignal.timeout(20_000) })
            .then((r) => r.arrayBuffer())
            .then((puffer) => Buffer.from(puffer).toString("base64"))
            .catch(() => "")
        : "");

    if (!base64) {
      return NextResponse.json(
        { fehler: "Die Bilderzeugung hat nichts zurückgegeben." },
        { status: 502 },
      );
    }

    return NextResponse.json({ bild: `data:image/png;base64,${base64}` });
  } catch (fehler) {
    console.error("[api/bild]", fehler);
    const abgelaufen = (fehler as { name?: string })?.name === "TimeoutError";
    return NextResponse.json(
      {
        fehler: abgelaufen
          ? "Die Bilderzeugung hat zu lange gebraucht. Bitte noch einmal versuchen - oder in den Umgebungsvariablen OPENAI_IMAGE_QUALITY eine Stufe herunterstellen (etwa auf „medium“)."
          : fehler instanceof Error
            ? fehler.message
            : "Unbekannter Fehler",
      },
      { status: 500 },
    );
  }
}
