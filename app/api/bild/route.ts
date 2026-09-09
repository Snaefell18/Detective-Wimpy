import { NextResponse } from "next/server";

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
 *   OPENAI_IMAGE_MODEL   - Voreinstellung "gpt-image-2.5-sunburst"
 *   OPENAI_IMAGE_QUALITY - "low", "medium" (Voreinstellung), "high", "xhigh",
 *                          "max" oder "auto"; die oberen Stufen kennen erst
 *                          die 2.5er-Modelle
 *
 * Ohne Schlüssel bleibt alles wie bisher: Der Knopf sagt, dass nichts
 * eingerichtet ist, und Bilder lassen sich weiterhin von Hand ablegen.
 */

/**
 * Welches Modell malt.
 *
 * Voreingestellt ist Sunburst aus der 2.5er-Reihe: die genauere der beiden
 * Varianten. Die schnellere und billigere heißt "gpt-image-2.5-flare" - für
 * flächige Comicbilder reicht sie meist und braucht weniger Zeit, was auf
 * einer Serverless-Funktion mit einer Minute Laufzeit zählt. Ein anderes
 * Modell trägt man einfach in OPENAI_IMAGE_MODEL ein.
 */
const modellName = (): string =>
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";

/** Was das Format sein darf - alles andere lehnt die Schnittstelle ab. */
const FORMATE = new Set(["1024x1024", "1024x1536", "1536x1024"]);

/** Genug für eine ausführliche Beschreibung - und eine Bremse für die Kosten. */
const MAX_ZEICHEN = 4000;

function zugangGeprueft(request: Request): string | null {
  const erwartet = process.env.ADMIN_TOKEN;
  if (!erwartet) {
    return process.env.NODE_ENV === "production"
      ? "Die Bilderzeugung ist gesperrt: Bitte ADMIN_TOKEN in den Umgebungsvariablen setzen."
      : null;
  }
  return (request.headers.get("x-admin-token") ?? "") === erwartet
    ? null
    : "Falsches Admin-Passwort.";
}

export async function POST(request: Request) {
  try {
    const gesperrt = zugangGeprueft(request);
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

    const format = String(body?.format ?? "1024x1024");
    if (!FORMATE.has(format)) {
      return NextResponse.json({ fehler: "Unbekanntes Bildformat." }, { status: 400 });
    }

    const modell = modellName();
    // Die feineren Regler kennt nur die gpt-image-Reihe; ältere Modelle wie
    // dall-e-3 lehnen sie ab. Bei durchsichtigem Grund verlangt die
    // Schnittstelle png oder webp - deshalb steht png hier fest.
    const extras = modell.startsWith("gpt-image")
      ? {
          background: body?.freigestellt ? "transparent" : "opaque",
          output_format: "png",
          quality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
        }
      : {};

    const antwort = await fetch("https://api.openai.com/v1/images/generations", {
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
          ? "Die Bilderzeugung hat zu lange gebraucht. Bitte noch einmal versuchen - oder in den Umgebungsvariablen OPENAI_IMAGE_QUALITY herunterstellen (etwa auf „low“) oder mit OPENAI_IMAGE_MODEL auf „gpt-image-2.5-flare“ wechseln, das schneller malt."
          : fehler instanceof Error
            ? fehler.message
            : "Unbekannter Fehler",
      },
      { status: 500 },
    );
  }
}
