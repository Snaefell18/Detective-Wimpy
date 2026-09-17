"use client";

import { useEffect, useRef, useState } from "react";
import { Szene } from "./Bild";
import { VideoSzene } from "./VideoSzene";
import { spiele, stoppe, type Stueck } from "@/lib/introAudio";
import { tonQuelle } from "@/lib/stimme";
import { sichtbareErzaehlerZeilen } from "@/lib/erzaehlerTiming";
import { leseDauer } from "@/lib/introTiming";
import { videoVon, type Erzaehlerteil } from "@/lib/sagaTypen";

/**
 * Ein Erzählerteil zwischen zwei Kapiteln: Text, der zeilenweise erscheint,
 * dazu - sobald eine Datei hinterlegt ist - die gesprochene Fassung.
 *
 * Ohne Tondatei läuft der Text in der Zeit durch, die er zum Vorlesen braucht.
 * Weiter geht es immer erst auf Fingertipp, damit niemand etwas verpasst.
 *
 * Ist ein Video hinterlegt, läuft es davor - bildschirmfüllend, danach erst
 * Titelkarte und Text. Ohne Eintrag bleibt alles wie bisher.
 *
 * Die Zeit ohne Tondatei richtet sich nach dem Text. Sechzehn Sekunden für
 * alles waren für einen Zweizeiler zu viel und für einen Absatz viel zu wenig:
 * Die Zeilen erschienen schneller, als man sie vorlesen konnte, und wer mitlas,
 * war nach dem dritten Satz raus. Jetzt bekommt jeder Text die Zeit, die er
 * zum Vorlesen braucht - Weiter geht es ohnehin erst auf Fingertipp.
 */
const stummeDauer = (text: string) => leseDauer(text, 9, 400);

/** Die Titelkarte vor einem Kapitel - wie in einer Serie. */
export type Kapitelkarte = { marke: string; name: string; bild?: string | null };

/** I, II, III … - für die Titelkarte, nicht für Rechnungen. */
export function roemisch(zahl: number): string {
  const tafel: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.max(0, Math.round(zahl));
  let wort = "";
  for (const [wert, zeichen] of tafel) {
    while (rest >= wert) {
      wort += zeichen;
      rest -= wert;
    }
  }
  return wort || String(zahl);
}

/** Wie lange die Titelkarte steht, bevor der Erzähler anfängt. */
const KARTE_DAUER = 2300;

export function ErzaehlerScreen({
  teil,
  titel,
  weiterText = "Weiter ›",
  musik,
  karte,
  onWeiter,
}: {
  teil: Erzaehlerteil;
  titel?: string;
  weiterText?: string;
  /**
   * Titelkarte davor. Solange sie steht, beginnt der Erzähler nicht - sonst
   * liefe der Text unter einer Karte weiter, die ihn verdeckt.
   */
  karte?: Kapitelkarte;
  /**
   * Musik unter dem Text - für gewonnene Abschnitte einer Saga. Eine eigene
   * Sprecherdatei hat immer Vorrang, die soll die Musik nicht übertönen.
   */
  musik?: Stueck;
  onWeiter: () => void;
}) {
  const zeilen = teil.text
    .split(/\n+/)
    .map((z) => z.trim())
    .filter(Boolean);
  const [fortschritt, setFortschritt] = useState(0);
  const video = videoVon(teil);
  const [videoLaeuft, setVideoLaeuft] = useState(Boolean(video));
  const [karteLaeuft, setKarteLaeuft] = useState(Boolean(karte));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef(performance.now());
  // Absichtlich an den Texten der Karte statt am Objekt: Der Aufrufer baut es
  // bei jedem Renderdurchgang neu, und ein Effekt mit dem Objekt als
  // Abhängigkeit würde bei jedem Rendern neu beginnen.
  const karteMarke = karte?.marke;
  const karteName = karte?.name;

  // Folgt im selben Bildschirm ein anderer Erzählerteil, müssen Video,
  // Titelkarte UND Textuhr von vorn anfangen. Das ist besonders bei Arcs
  // wichtig: React behält dort dieselbe Komponente zwischen zwei Stationen.
  // Früher wechselte zwar der sichtbare Text, während Uhr und Audio noch zum
  // vorherigen Teil gehörten - dadurch waren Schrift und Sprecher völlig
  // auseinander.
  useEffect(() => {
    setVideoLaeuft(Boolean(video));
    setKarteLaeuft(Boolean(karteMarke || karteName));
    setFortschritt(0);
  }, [video, teil.text, teil.audio, karteMarke, karteName]);

  useEffect(() => {
    // Erst das Video, dann die Karte - sonst wäre sie vorbei, bevor man sie
    // zu sehen bekommt.
    if (videoLaeuft || (!karteMarke && !karteName)) return;
    const id = window.setTimeout(() => setKarteLaeuft(false), KARTE_DAUER);
    return () => window.clearTimeout(id);
  }, [karteMarke, karteName, videoLaeuft]);

  useEffect(() => {
    if (videoLaeuft || karteLaeuft) return;
    let laeuftNoch = true;
    let wartetAufAudio = Boolean(teil.audio);
    startRef.current = performance.now();

    if (teil.audio) {
      /*
       * Der Sprecher hat Vorrang - und zwar wirklich: Vom vorherigen
       * Bildschirm kann noch die Siegermusik laufen (nach einem gewonnenen
       * Finale etwa). Zwei Stimmen übereinander versteht niemand, deshalb
       * wird erst alles angehalten, was der Tonmanager gerade spielt.
       */
      stoppe();

      // Eine gesprochene Fassung kann in der Datenbank liegen ("stimme:…").
      // Das Nachschlagen dauert einen Moment. Bis dahin wartet auch die
      // Textuhr, damit die erste Zeile nicht längst weitergelaufen ist, wenn
      // die Stimme beginnt.
      void tonQuelle(teil.audio)
        .then((quelle) => {
          if (!laeuftNoch) return;
          if (!quelle) {
            wartetAufAudio = false;
            startRef.current = performance.now();
            return;
          }
          const audio = new Audio(quelle);
          audioRef.current = audio;
          audio.addEventListener("ended", () => {
            if (laeuftNoch) setFortschritt(1);
          });
          void audio
            .play()
            .then(() => {
              // Die Textuhr beginnt mit der Stimme, nicht schon während die
              // Aufnahme aus der Datenbank geladen wird.
              if (laeuftNoch) {
                wartetAufAudio = false;
                startRef.current = performance.now();
              }
            })
            .catch(() => {
              // Blockiert der Browser den Ton, läuft die Szene stumm weiter -
              // und der Text erscheint wie früher zeilenweise.
              audioRef.current = null;
              wartetAufAudio = false;
              startRef.current = performance.now();
            });
        })
        .catch(() => {
          // Auch eine nicht abrufbare Datenbankaufnahme lässt den Text nicht
          // für immer auf der ersten Zeile stehen.
          wartetAufAudio = false;
          startRef.current = performance.now();
        });
    } else if (musik) {
      void spiele(musik);
    }

    const tick = () => {
      if (!laeuftNoch) return;
      const audio = audioRef.current;
      if (wartetAufAudio) {
        setFortschritt(0);
        requestAnimationFrame(tick);
        return;
      }
      const hatAudio = Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 1);
      const dauer = hatAudio && audio ? audio.duration : stummeDauer(teil.text);
      const zeit = hatAudio && audio
        ? audio.currentTime
        : (performance.now() - startRef.current) / 1000;
      setFortschritt(Math.min(1, zeit / dauer));
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);

    return () => {
      laeuftNoch = false;
      cancelAnimationFrame(id);
      audioRef.current?.pause();
      audioRef.current = null;
      if (musik) stoppe(musik);
    };
  }, [teil.audio, teil.text, musik, karteLaeuft, videoLaeuft]);

  const sichtbar = sichtbareErzaehlerZeilen(zeilen, fortschritt);

  if (videoLaeuft && video) {
    return <VideoSzene quelle={video} onFertig={() => setVideoLaeuft(false)} />;
  }

  if (karteLaeuft && karte) {
    return (
      <div className="kapitel-karte" onPointerDown={() => setKarteLaeuft(false)}>
        {karte.bild && (
          <div className="kapitel-karte-bild">
            <Szene src={karte.bild} alt="" platzhalter="" variante="titel" />
          </div>
        )}
        <div className="kapitel-karte-text">
          <span className="intro-oberzeile">{karte.marke}</span>
          <h1 className="intro-logo slam">{karte.name}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="prolog erzaehler" onPointerDown={onWeiter}>
      <div className="prolog-vignette" />

      <div className="prolog-text">
        {titel && <p className="erzaehler-titel">{titel}</p>}

        {/* Schrift und Aufnahme laufen parallel. Die Audio-Uhr bestimmt,
            welche Zeile gerade sichtbar wird. */}
        {zeilen.slice(0, sichtbar).map((zeile, i) => (
          <p
            key={i}
            className="prolog-zeile"
            data-letzte={i === sichtbar - 1 ? "true" : undefined}
          >
            {zeile}
          </p>
        ))}
      </div>

      {/* Tippen geht überall - der Knopf darf den Tipp nicht doppelt zählen. */}
      <button
        className="erzaehler-weiter pochen"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onWeiter}
      >
        {weiterText}
      </button>
    </div>
  );
}
