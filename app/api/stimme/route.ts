import { NextResponse } from "next/server";
import { fehlerText } from "@/lib/antwort";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Erzählertexte sprechen lassen - über ElevenLabs.
 *
 * Bewusst nur fürs Admin-Menü, nicht fürs Spiel: Jeder Aufruf kostet Geld,
 * und ein offener Weg dorthin wäre eine Rechnung, die jeder Fremde in die
 * Höhe treiben kann. Deshalb dasselbe Passwort wie für die Akten - und
 * deshalb wird das Ergebnis einmal erzeugt und danach gespeichert, statt bei
 * jedem Abspielen neu.
 *
 * Nötig sind zwei Umgebungsvariablen:
 *   ELEVENLABS_API_KEY   - der Schlüssel aus dem ElevenLabs-Konto
 *   ELEVENLABS_VOICE_ID  - welche Stimme (aus der Voice Library kopieren)
 *
 * Ohne Schlüssel bleibt alles wie bisher: Der Knopf sagt, dass nichts
 * eingerichtet ist, und Tondateien lassen sich weiterhin von Hand ablegen.
 */

/**
 * Welches Modell spricht.
 *
 * Voreingestellt ist das mehrsprachige - sonst klingt Deutsch wie Englisch
 * mit Akzent. Über ELEVENLABS_MODEL lässt sich ein anderes wählen, etwa
 * "eleven_v3"; ob das Konto es über die Schnittstelle darf, entscheidet
 * ElevenLabs, nicht diese App.
 */
const modellName = (): string => process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";

/**
 * Die Regler je Modell.
 *
 * v3 nimmt für "stability" nur drei Werte an (0, 0.5 und 1) und kennt "style"
 * nicht - schickt man die feinen Werte der älteren Modelle, lehnt es die
 * Anfrage ab. Deshalb hier zwei Sätze statt einem.
 */
function einstellungenFuer(modell: string): Record<string, number> {
  return modell.includes("_v3")
    ? { stability: 0.5, similarity_boost: 0.8 }
    : { stability: 0.45, similarity_boost: 0.8, style: 0.35 };
}

/** Genug für einen Erzählertext - und eine Bremse für die Kosten. */
const MAX_ZEICHEN = 2500;

/**
 * Was in ein Firestore-Dokument passt: Die Grenze liegt bei 1 MB, und
 * base64 macht aus jedem Byte vier Drittel. 700 KB Ton bleiben deutlich
 * darunter - das sind bei 32 kbit/s etwa drei Minuten.
 */
const MAX_BYTES = 700_000;

function zugangGeprueft(request: Request): string | null {
  const erwartet = process.env.ADMIN_TOKEN;
  if (!erwartet) {
    return process.env.NODE_ENV === "production"
      ? "Die Sprachausgabe ist gesperrt: Bitte ADMIN_TOKEN in den Umgebungsvariablen setzen."
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

    const schluessel = process.env.ELEVENLABS_API_KEY;
    const stimme = process.env.ELEVENLABS_VOICE_ID;
    if (!schluessel || !stimme) {
      return NextResponse.json(
        {
          fehler:
            "Die Sprachausgabe ist nicht eingerichtet: ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID in den Umgebungsvariablen setzen.",
        },
        { status: 501 },
      );
    }

    const modell = modellName();
    const body = await request.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ fehler: "Kein Text zum Sprechen." }, { status: 400 });
    }
    if (text.length > MAX_ZEICHEN) {
      return NextResponse.json(
        {
          fehler: `Der Text ist mit ${text.length} Zeichen zu lang - höchstens ${MAX_ZEICHEN}. Bitte kürzen oder auf zwei Teile verteilen.`,
        },
        { status: 400 },
      );
    }

    // mp3 mit 32 kbit/s: Für eine Erzählerstimme reicht das hörbar aus und
    // hält die Datei klein genug für die Datenbank.
    const antwort = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        stimme,
      )}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "xi-api-key": schluessel,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modell,
          voice_settings: einstellungenFuer(modell),
        }),
        signal: AbortSignal.timeout(50_000),
      },
    );

    if (!antwort.ok) {
      const grund = await antwort.text().catch(() => "");
      const hinweise: Record<number, string> = {
        401: "Der ELEVENLABS_API_KEY stimmt nicht.",
        403: "Der Schlüssel darf diese Stimme nicht benutzen.",
        404: "Diese ELEVENLABS_VOICE_ID gibt es nicht.",
        400: `Das Modell „${modell}“ hat die Anfrage abgelehnt. Ist es für dieses Konto über die Schnittstelle freigeschaltet?`,
        422: `Das Modell „${modell}“ hat die Anfrage abgelehnt. Ist es für dieses Konto über die Schnittstelle freigeschaltet?`,
        429: "Das Kontingent bei ElevenLabs ist aufgebraucht.",
      };
      const hinweis = hinweise[antwort.status] ?? "";
      return NextResponse.json(
        {
          fehler: `Die Sprachausgabe hat abgelehnt (${antwort.status}). ${hinweis} ${grund.slice(
            0,
            300,
          )}`.trim(),
        },
        { status: 502 },
      );
    }

    const daten = Buffer.from(await antwort.arrayBuffer());
    if (daten.length > MAX_BYTES) {
      return NextResponse.json(
        {
          fehler: `Die Aufnahme ist mit ${Math.round(
            daten.length / 1000,
          )} KB zu groß für die Datenbank. Bitte den Text kürzen.`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${daten.toString("base64")}`,
      bytes: daten.length,
      zeichen: text.length,
    });
  } catch (error) {
    return NextResponse.json({ fehler: fehlerText(error, "api/stimme") }, { status: 500 });
  }
}
