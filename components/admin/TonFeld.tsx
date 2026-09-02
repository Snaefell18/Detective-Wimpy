"use client";

import { useRef, useState } from "react";
import { dateiAlsStimme, istStimme, spracheErzeugen, tonQuelle } from "@/lib/stimme";

/**
 * Der Ton beim Auftritt eines neuen Tiers - auf drei Wegen.
 *
 * Eine hochgeladene Datei wandert in die Datenbank, damit sie auf jedem Gerät
 * gleich klingt; ein Pfad in /public/audio geht genauso, und der Sprecher
 * spricht einen Satz. "Ohne Ton" ist der Ausgangszustand: Die Ansage läuft
 * dann mit einer kurzen Spannungspause.
 */
export function TonFeld({
  wert,
  onAendern,
  satzVorschlag = "Ein neuer Spieler betritt das Feld!",
}: {
  wert: string;
  onAendern: (wert: string) => void;
  /** Was der Sprecher vorschlagsweise sagen soll. */
  satzVorschlag?: string;
}) {
  const [satz, setSatz] = useState(satzVorschlag);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  const probieren = () => {
    if (!wert) return;
    void tonQuelle(wert).then((quelle) => {
      if (quelle) void new Audio(quelle).play().catch(() => {});
    });
  };

  const hochladen = async (datei: File | undefined) => {
    if (!datei) return;
    setLaeuft("datei");
    setFehler(null);
    try {
      onAendern(await dateiAlsStimme(datei));
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(null);
      if (dateiRef.current) dateiRef.current.value = "";
    }
  };

  const sprechen = async () => {
    setLaeuft("stimme");
    setFehler(null);
    try {
      onAendern(await spracheErzeugen(satz.trim()));
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(null);
    }
  };

  return (
    <>
      <p className="leise klein">
        {!wert
          ? "Zurzeit ohne Ton - nur eine kurze Spannungspause."
          : istStimme(wert)
            ? "Ton hinterlegt · liegt in der Datenbank"
            : `Ton hinterlegt · ${wert}`}
      </p>

      <div className="knopf-reihe">
        {wert && (
          <>
            <button className="knopf klein" onClick={probieren}>
              ▶ Anhören
            </button>
            <button className="knopf klein" onClick={() => onAendern("")}>
              Ohne Ton
            </button>
          </>
        )}
        <button
          className="knopf klein"
          disabled={laeuft !== null}
          onClick={() => dateiRef.current?.click()}
        >
          {laeuft === "datei" ? "Wird geladen …" : "Datei wählen"}
        </button>
        <input
          ref={dateiRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(ereignis) => void hochladen(ereignis.target.files?.[0])}
        />
      </div>

      <label className="feld">
        <span className="leise">Oder ein Pfad in /public/audio</span>
        <input
          value={istStimme(wert) ? "" : wert}
          onChange={(ereignis) => onAendern(ereignis.target.value)}
          placeholder="/audio/newplayer.mp3"
          maxLength={200}
        />
      </label>

      <label className="feld">
        <span className="leise">Oder der Sprecher sagt einen Satz</span>
        <input value={satz} onChange={(ereignis) => setSatz(ereignis.target.value)} maxLength={200} />
      </label>
      <button className="knopf klein" disabled={laeuft !== null} onClick={() => void sprechen()}>
        {laeuft === "stimme" ? "Wird gesprochen …" : "🎙 Sprechen lassen"}
      </button>

      {fehler && <p className="fehler">{fehler}</p>}
    </>
  );
}
