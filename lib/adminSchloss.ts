/**
 * Das Schloss vor allem, was im Admin-Menü Geld kostet.
 *
 * Erzeugen, Bilder, Akten: Wer die Adresse kennt, käme sonst an jede Lösung
 * und an jeden Aufruf. Deshalb hängt all das an einem Passwort:
 *
 *   ADMIN_TOKEN in den Umgebungsvariablen setzen (Vercel > Settings).
 *
 * Ohne gesetztes Passwort ist der Weg in der Produktion zu und beim
 * Entwickeln auf dem eigenen Rechner offen - sonst müsste man beim Bauen
 * ständig etwas eintippen.
 */
export function adminGesperrt(request: Request, was: string): string | null {
  const erwartet = process.env.ADMIN_TOKEN;
  if (!erwartet) {
    return process.env.NODE_ENV === "production"
      ? `${was} ist gesperrt: Bitte ADMIN_TOKEN in den Umgebungsvariablen setzen.`
      : null;
  }
  return (request.headers.get("x-admin-token") ?? "") === erwartet
    ? null
    : "Falsches Admin-Passwort.";
}
