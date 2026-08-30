"use client";

/**
 * Ein POST an die eigene API - mit Antworten, die kein JSON sind, kommt es
 * ebenfalls zurecht.
 *
 * Läuft eine Serverless-Funktion in ihr Zeitlimit, antwortet die Plattform
 * mit einer HTML-Fehlerseite. Ein blindes response.json() wirft darauf in
 * Safari "The string did not match the expected pattern." - eine Meldung, mit
 * der niemand etwas anfangen kann. Deshalb wird hier erst der Text gelesen
 * und dann vorsichtig geparst.
 */
export async function postJson<T>(pfad: string, body: unknown): Promise<T> {
  const antwort = await fetch(pfad, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const roh = await antwort.text();
  let daten: unknown = null;
  try {
    daten = roh ? JSON.parse(roh) : null;
  } catch {
    // Keine JSON-Antwort - der Text unten erklärt, was los ist.
  }

  const fehler =
    daten && typeof daten === "object" && "fehler" in daten
      ? String((daten as { fehler: unknown }).fehler)
      : null;

  if (!antwort.ok || fehler) {
    throw new Error(fehler ?? serverFehler(antwort.status));
  }

  if (daten === null) {
    throw new Error(serverFehler(antwort.status));
  }

  return daten as T;
}

/** Verständlicher Text zu einem Statuscode ohne brauchbaren Inhalt. */
function serverFehler(status: number): string {
  if (status === 504 || status === 408) {
    return "Der Server hat zu lange gebraucht und abgebrochen. Bitte noch einmal versuchen - mit knapperen Vorgaben geht es meist schneller.";
  }
  if (status === 502 || status === 503) {
    return "Der Server war gerade nicht erreichbar. Bitte noch einmal versuchen.";
  }
  return `Der Server hat unerwartet geantwortet (Status ${status}). Bitte noch einmal versuchen.`;
}
