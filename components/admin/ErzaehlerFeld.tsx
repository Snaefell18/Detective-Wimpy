"use client";

import { useState } from "react";
import { istStimme, spracheErzeugen } from "@/lib/stimme";
import { SongWahl } from "./SongFeld";
import { VideoFeld } from "./VideoFeld";
import type { Erzaehlerteil } from "@/lib/sagaTypen";

/**
 * Text und Ton eines Erzählerteils - für Sagas wie für Arcs.
 *
 * Davor kann ein Video laufen - eine Datei aus /public/video. Ohne Eintrag
 * kommt keins.
 *
 * Den Ton gibt es auf zwei Wegen: eine Datei, die man selbst in
 * /public/audio ablegt, oder einmal sprechen lassen. Das Sprechen kostet
 * Geld, deshalb passiert es genau einmal und wandert dann in die Datenbank;
 * im Spiel wird nur noch abgespielt.
 */
export function ErzaehlerFeld({
  titel,
  hinweis,
  teil,
  onAendern,
}: {
  titel?: string;
  hinweis?: string;
  teil: Erzaehlerteil;
  onAendern: (teil: Partial<Erzaehlerteil>) => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const gesprochen = istStimme(teil.audio);

  const sprechen = async () => {
    const text = teil.text.trim();
    if (!text) {
      setFehler("Erst der Text, dann die Stimme.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      onAendern({ audio: await spracheErzeugen(text) });
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="erzaehler-feld">
      {titel && (
        <h4 className="unter-abschnitt">
          {titel} {hinweis && <span className="leise">· {hinweis}</span>}
        </h4>
      )}

      <label className="feld">
        <span className="leise">Erzählertext</span>
        <textarea
          rows={4}
          value={teil.text}
          onChange={(e) => onAendern({ text: e.target.value })}
          maxLength={2000}
        />
      </label>

      {gesprochen ? (
        <>
          <p className="leise klein">
            Gesprochen · liegt in der Datenbank ({teil.text.trim().length} Zeichen)
          </p>
          <div className="knopf-reihe">
            <button className="knopf klein" onClick={() => void sprechen()} disabled={laeuft}>
              {laeuft ? "Wird gesprochen …" : "Neu sprechen"}
            </button>
            <button className="knopf klein" onClick={() => onAendern({ audio: "" })}>
              Ton entfernen
            </button>
          </div>
        </>
      ) : (
        <>
          <SongWahl
            wert={teil.audio}
            onAendern={(audio) => onAendern({ audio })}
            beschriftung="Tondatei aus /public/audio (leer = nur Text)"
            leerText="Nur Text, kein Ton"
          />

          <label className="feld">
            <span className="leise">Oder ein Pfad von Hand</span>
            <input
              value={teil.audio}
              onChange={(e) => onAendern({ audio: e.target.value })}
              placeholder="/audio/saga-kapitel-1.mp3"
              maxLength={200}
            />
          </label>
          <button className="knopf klein" onClick={() => void sprechen()} disabled={laeuft}>
            {laeuft ? "Wird gesprochen …" : "🎙 Sprechen lassen"}
          </button>
        </>
      )}

      <VideoFeld
        wert={teil.video ?? ""}
        onAendern={(video) => onAendern({ video })}
      />

      {fehler && <p className="fehler">{fehler}</p>}
    </div>
  );
}
