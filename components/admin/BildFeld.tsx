"use client";

import { useState } from "react";
import { Bild } from "@/components/Bild";
import { auftragReicht, FREIGESTELLT, type BildArt, type BildEintrag } from "@/lib/bildPrompt";
import { bildErzeugen, istGespeichertesBild } from "@/lib/bildSpeicher";
import { pruefeFreistellung } from "@/lib/bildPruefung";

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
  vorlage,
}: {
  wert: string;
  vorschlag: string;
  onAendern: (wert: string) => void;
  art: BildArt;
  /** Was im Formular steht - daraus entsteht der Auftrag ans Bildmodell. */
  eintrag: BildEintrag;
  /**
   * Das Bild, aus dem eine andere Fassung werden soll - beim Anlegen einer
   * Version. Das Original wird dabei nur gelesen; es bleibt unangetastet.
   */
  vorlage?: { quelle: string; name: string };
}) {
  const [wunsch, setWunsch] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frisch, setFrisch] = useState<string | null>(null);
  const [warnung, setWarnung] = useState<string | null>(null);
  /** Vorlage benutzen? Bei einer Version ist das der Sinn der Sache. */
  const [mitVorlage, setMitVorlage] = useState(true);

  const reicht = auftragReicht(art, eintrag, wunsch);
  const benutzt = vorlage?.quelle && mitVorlage ? vorlage.quelle : undefined;

  const erzeugen = async () => {
    setLaeuft(true);
    setFehler(null);
    setWarnung(null);
    try {
      const { wert: neu, daten } = await bildErzeugen(art, eintrag, wunsch.trim(), benutzt);
      onAendern(neu);
      setFrisch(daten);

      // Nachsehen, ob der Hintergrund wirklich weg ist. Zusichern lässt sich
      // das nicht - deshalb wird es wenigstens gesagt.
      if (FREIGESTELLT[art]) {
        const { freigestellt } = await pruefeFreistellung(daten);
        if (!freigestellt) {
          setWarnung(
            "Der Hintergrund ist nicht durchsichtig geworden. Das Bild ist gespeichert - wenn es stören sollte, erzeuge es einfach noch einmal.",
          );
        }
      }
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

      {vorlage?.quelle && (
        <>
          <p className="leise klein">
            Version von „{vorlage.name}“. Mit Vorlage bleibt es unverkennbar
            dasselbe Tier - verändert wird nur, was du unten schreibst. Das
            ursprüngliche Tier bleibt dabei unangetastet: Hier entsteht ein
            neuer Eintrag mit einem neuen Bild.
          </p>
          <label className="feld reihe">
            <input
              type="checkbox"
              checked={mitVorlage}
              onChange={(e) => setMitVorlage(e.target.checked)}
            />
            <span>Vorlage benutzen</span>
          </label>
          {mitVorlage && (
            <div className="bild-vorschau klein">
              <Bild src={vorlage.quelle} alt={vorlage.name} platzhalter={vorlage.name} />
            </div>
          )}
        </>
      )}

      <label className="feld">
        <span className="leise">
          {benutzt
            ? "Was ist anders? (der Rest bleibt wie auf der Vorlage)"
            : "Wie soll es aussehen? (Farben, Kleidung, Licht, Details - der Comicstil steht fest)"}
        </span>
        <textarea
          rows={2}
          value={wunsch}
          onChange={(e) => setWunsch(e.target.value)}
          placeholder={
            benutzt
              ? "z.B. als Dämon: glühende Augen, Schattenhörner, Rauch um die Pfoten"
              : art === "charaktere"
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
          {laeuft
            ? "Wird gemalt … (bis zu einer Minute)"
            : benutzt
              ? "🎨 Version malen"
              : "🎨 Bild erzeugen"}
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

      {warnung && <p className="hinweis warnung">{warnung}</p>}
      {fehler && <p className="fehler">{fehler}</p>}
    </>
  );
}
