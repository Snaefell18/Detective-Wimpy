"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tonQuelle } from "@/lib/stimme";

/**
 * Der Abspann eines Arcs.
 *
 * Nicht ein geschätzter Timer, sondern die Uhr des Audioelements bewegt die
 * Credits. Das `ended`-Ereignis beendet auch den Arc. Damit stehen Bild und
 * Musik selbst bei variabler Ladezeit und auf langsamen Geräten exakt gleich
 * lang auf der Bühne.
 */
export function ArcCredits({
  titel,
  text,
  song,
  onFertig,
}: {
  titel: string;
  text: string;
  song: string;
  onFertig: () => void;
}) {
  const zeilen = useMemo(
    () => text.split(/\n+/).map((z) => z.trim()).filter(Boolean),
    [text],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fertigRef = useRef(onFertig);
  const [fortschritt, setFortschritt] = useState(0);
  const [startNoetig, setStartNoetig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    fertigRef.current = onFertig;
  }, [onFertig]);

  useEffect(() => {
    let aktiv = true;
    let bild = 0;
    let audio: HTMLAudioElement | null = null;

    const tick = () => {
      if (!aktiv || !audio) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setFortschritt(Math.min(1, audio.currentTime / audio.duration));
      }
      bild = requestAnimationFrame(tick);
    };

    void tonQuelle(song)
      .then((quelle) => {
        if (!aktiv) return;
        if (!quelle) {
          setFehler("Für die Credits fehlt ein Song.");
          return;
        }
        audio = new Audio(quelle);
        audioRef.current = audio;
        audio.preload = "auto";
        audio.addEventListener("ended", () => {
          setFortschritt(1);
          fertigRef.current();
        });
        bild = requestAnimationFrame(tick);
        void audio.play().catch(() => setStartNoetig(true));
      })
      .catch(() => {
        if (aktiv) setFehler("Der Credits-Song konnte nicht geladen werden.");
      });

    return () => {
      aktiv = false;
      cancelAnimationFrame(bild);
      audio?.pause();
      audioRef.current = null;
    };
  }, [song]);

  const starten = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setFehler(null);
    setStartNoetig(false);
    void audio.play().catch(() => {
      setStartNoetig(true);
      setFehler("Der Browser konnte den Credits-Song nicht starten.");
    });
  };

  return (
    <div
      className="arc-credits"
      style={{
        ["--credits-prozent" as string]: `${fortschritt * 100}%`,
        ["--credits-vh" as string]: `${fortschritt * 110}vh`,
      }}
    >
      <div className="arc-credits-vignette" />
      <div className="arc-credits-rolle">
        <p className="intro-oberzeile">Detective Wimpy</p>
        <h1 className="intro-logo">{titel}</h1>
        <div className="arc-credits-linien">
          {(zeilen.length ? zeilen : ["Ende"]).map((zeile, i) => (
            <p key={`${i}-${zeile}`}>{zeile}</p>
          ))}
        </div>
        <strong className="arc-credits-ende">Ende</strong>
      </div>

      {(startNoetig || fehler) && (
        <div className="arc-credits-start">
          {fehler && <p>{fehler}</p>}
          {startNoetig && (
            <button className="knopf aktion" onClick={starten}>
              Credits starten
            </button>
          )}
          {!startNoetig && fehler && (
            <button className="knopf" onClick={onFertig}>
              Zum Hauptmenü
            </button>
          )}
        </div>
      )}
    </div>
  );
}
