"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminToken, pruefeZugang, setzeAdminToken } from "@/lib/akte";

/**
 * Das Schloss vor dem Admin-Bereich.
 *
 * Es ist dasselbe Passwort wie für die Akten (ADMIN_TOKEN auf dem Server) -
 * eines für alles. Geprüft wird es beim Server, nicht hier: Der Browser kennt
 * das Passwort nicht, er bekommt nur ein Ja oder Nein zurück. Wer einmal
 * hereingelassen wurde, bleibt es auch bei den Akten, denn das Passwort liegt
 * danach an derselben Stelle wie bisher.
 *
 * Ehrlich gesagt, was das schützt und was nicht: Es hält Neugierige vom Menü
 * fern und ist die einzige Tür zu den Akten - Täter und Lösung gibt der Server
 * ohne dieses Passwort nicht heraus. Die Stammdaten in Firestore hängen
 * dagegen an den Datenbankregeln; wer sie ändern will, kommt an diesem
 * Bildschirm vorbei. Das Schloss ersetzt sie also nicht.
 */
type Zustand = "prueft" | "zu" | "offen";

export function AdminSchloss({ children }: { children: React.ReactNode }) {
  const [zustand, setZustand] = useState<Zustand>("prueft");
  const [wert, setWert] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ohnePasswort, setOhnePasswort] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  const anklopfen = useCallback(async (token: string, still: boolean) => {
    setLaeuft(true);
    if (!still) setFehler(null);
    try {
      const antwort = await pruefeZugang(token);
      setOhnePasswort(antwort.ohnePasswort);
      if (antwort.ohnePasswort) {
        // Ohne gesetztes ADMIN_TOKEN gibt es nichts zu prüfen. Dann steht das
        // Menü offen - aber nicht, ohne das einmal zu sagen.
        setZustand("zu");
        return;
      }
      setzeAdminToken(token);
      setZustand("offen");
    } catch (grund) {
      setZustand("zu");
      if (!still) {
        setFehler(grund instanceof Error ? grund.message : "Das hat nicht geklappt.");
      }
    } finally {
      setLaeuft(false);
    }
  }, []);

  // Ein gemerktes Passwort wird beim Öffnen still geprüft - stimmt es nicht
  // mehr, steht hier eben wieder das Schloss.
  useEffect(() => {
    const gemerkt = adminToken();
    if (gemerkt) void anklopfen(gemerkt, true);
    else void anklopfen("", true);
  }, [anklopfen]);

  if (zustand === "offen") return <>{children}</>;

  return (
    <main className="app admin">
      <header className="kopf">
        <Link href="/" className="zurueck" aria-label="Zurück zum Spiel">
          ‹
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Admin</h1>
          <p className="unterzeile">Nur mit Passwort</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {zustand === "prueft" && <p className="leise">Einen Moment …</p>}

          {zustand === "zu" && (
            <>
              <h2 className="abschnitt">Verschlossen</h2>
              <p className="leise">
                Dahinter liegen Kampagnen, Sagas, Arcs und die Stammdaten - und
                die Akten mit Täter und Lösung. Es ist dasselbe Passwort wie für
                die Akten: das <code>ADMIN_TOKEN</code> vom Server.
              </p>

              {ohnePasswort ? (
                <>
                  <p className="hinweis">
                    Auf diesem Server ist gar kein <code>ADMIN_TOKEN</code>
                    {" "}gesetzt. Der Admin-Bereich steht damit jedem offen, der
                    die Adresse kennt - und die Akten bleiben in der Produktion
                    trotzdem gesperrt. Am besten in den Umgebungsvariablen
                    (Vercel → Settings) eines setzen.
                  </p>
                  <button
                    className="knopf aktion"
                    onClick={() => setZustand("offen")}
                  >
                    Trotzdem öffnen
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void anklopfen(wert.trim(), false);
                  }}
                >
                  <label className="feld">
                    <span className="leise">Passwort</span>
                    <input
                      type="password"
                      value={wert}
                      onChange={(e) => setWert(e.target.value)}
                      autoComplete="current-password"
                      autoFocus
                    />
                  </label>
                  {fehler && <p className="fehler">{fehler}</p>}
                  <button className="knopf aktion" type="submit" disabled={laeuft}>
                    {laeuft ? "Wird geprüft …" : "Aufschließen"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** Das gemerkte Passwort wieder vergessen - schließt den Bereich sofort ab. */
export function abmelden(): void {
  setzeAdminToken("");
  window.location.reload();
}
