"use client";

import { useState } from "react";
import { Bild } from "@/components/Bild";
import { auftragReicht, type BildArt, type BildEintrag } from "@/lib/bildPrompt";
import { bildErzeugen, istGespeichertesBild } from "@/lib/bildSpeicher";

/**
 * Das Bild eines Eintrags: von Hand hinterlegen oder erzeugen lassen.
 *
 * Erzeugt wird aus dem, was oben im Formular steht, plus einem freien Feld
 * für Wünsche ans Aussehen. Der Stil liegt fest (lib/bildPrompt.ts), damit
 * alles zusammenpasst; Format und Größe stimmen von selbst. Das fertige Bild
 * landet in der Datenbank, der Eintrag merkt sich nur "bild:<id>".
 *
 * Ohne eingerichteten Schlüssel ändert sich nichts: Der Knopf sagt, was
 * fehlt, und der Pfad lässt sich weiterhin von Hand eintragen.
 */
export function BildFeld({
  wert,
  vorschlag,
  onAendern,
  art,
  eintrag,
}: {
  wert: string;
  vorschlag: string;
  onAendern: (wert: string) => void;
  art: BildArt;
  /** Was im Formular steht - daraus entsteht der Auftrag ans Bildmodell. */
  eintrag: BildEintrag;
}) {
  const [wunsch, setWunsch] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frisch, setFrisch] = useState<string | null>(null);

  const reicht = auftragReicht(art, eintrag, wunsch);

  const erzeugen = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const { wert: neu, daten } = await bildErzeugen(art, eintrag, wunsch.trim());
      onAendern(neu);
      setFrisch(daten);
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <label className="feld">
        <span className="leise">Bildpfad (leer = automatisch)</span>
        <input
          value={istGespeichertesBild(wert) ? "" : wert}
          placeholder={istGespeichertesBild(wert) ? "Erzeugtes Bild hinterlegt" : vorschlag}
          onChange={(e) => onAendern(e.target.value)}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Wie soll es aussehen? (Farben, Kleidung, Licht, Details - der
          Comicstil steht fest)
        </span>
        <textarea
          rows={2}
          value={wunsch}
          onChange={(e) => setWunsch(e.target.value)}
          placeholder={
            art === "charaktere"
              ? "z.B. rote Latzhose, Mehl an den Pfoten, verschmitzter Blick"
              : art === "orte"
                ? "z.B. Abendlicht, Lampions über der Gasse, nasses Kopfsteinpflaster"
                : "z.B. messingfarben, abgegriffen, mit kleiner Delle"
          }
          maxLength={600}
        />
      </label>

      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf aktion klein"
          disabled={laeuft || !reicht}
          onClick={() => void erzeugen()}
        >
          {laeuft ? "Wird gemalt … (bis zu einer Minute)" : "🎨 Bild erzeugen"}
        </button>
        {istGespeichertesBild(wert) && (
          <button type="button" className="knopf klein" onClick={() => onAendern("")}>
            Erzeugtes Bild verwerfen
          </button>
        )}
      </div>

      {!reicht && (
        <p className="leise klein">
          Für ein Bild braucht es mindestens einen Namen, eine Beschreibung
          oder einen Wunsch.
        </p>
      )}

      {(frisch || istGespeichertesBild(wert)) && (
        <div className="bild-vorschau">
          <Bild src={frisch ?? wert} alt="Erzeugtes Bild" platzhalter="Bild" />
        </div>
      )}

      {fehler && <p className="fehler">{fehler}</p>}
    </>
  );
}
