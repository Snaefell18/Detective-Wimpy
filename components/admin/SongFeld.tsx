"use client";

import { AUDIO_DATEIEN } from "@/lib/audio.generated";
import { tonQuelle } from "@/lib/stimme";

/**
 * Ein Song aus allen, die im Projekt liegen - als Auswahlliste.
 *
 * Die Liste entsteht beim Bauen aus /public/audio (siehe
 * scripts/audio-liste.mjs); ein frisch hochgeladener Song steht also nach dem
 * nächsten Deploy hier drin. Was nicht in der Liste steht - eine Datei aus der
 * Datenbank etwa -, bleibt trotzdem gewählt und wird zusätzlich angezeigt.
 */

/** Aus "/audio/hutsong.mp3" wird "Hutsong". */
export function songName(pfad: string): string {
  const datei = pfad.split("/").pop() ?? pfad;
  const ohneEndung = datei.replace(/\.[a-z0-9]+$/i, "");
  return ohneEndung.charAt(0).toUpperCase() + ohneEndung.slice(1);
}

export function SongFeld({
  wert,
  onAendern,
  /** Was in der Liste ganz oben steht, wenn nichts gewählt ist. */
  leerText = "Nichts gewählt",
  beschriftung,
}: {
  wert: string;
  onAendern: (wert: string) => void;
  leerText?: string;
  beschriftung?: string;
}) {
  // Ein Song, der nicht (mehr) im Ordner liegt, verschwindet nicht aus der
  // Auswahl - sonst wäre er beim nächsten Öffnen still weg.
  const liste = wert && !AUDIO_DATEIEN.includes(wert) ? [wert, ...AUDIO_DATEIEN] : AUDIO_DATEIEN;

  const probieren = () => {
    if (!wert) return;
    void tonQuelle(wert).then((quelle) => {
      if (quelle) void new Audio(quelle).play().catch(() => {});
    });
  };

  return (
    <>
      <label className="feld">
        {beschriftung && <span className="leise">{beschriftung}</span>}
        <select value={wert} onChange={(e) => onAendern(e.target.value)}>
          <option value="">{leerText}</option>
          {liste.map((pfad) => (
            <option key={pfad} value={pfad}>
              {songName(pfad)}
            </option>
          ))}
        </select>
      </label>

      {wert && (
        <div className="knopf-reihe">
          <button className="knopf klein" onClick={probieren}>
            ▶ Anhören
          </button>
          <button className="knopf klein" onClick={() => onAendern("")}>
            Zurücksetzen
          </button>
        </div>
      )}
    </>
  );
}
