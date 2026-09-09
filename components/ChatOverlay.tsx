"use client";

import { useEffect, useRef, useState } from "react";
import { Bild, Szene } from "./Bild";
import { wirkungVon, type Zubehoer } from "@/lib/zubehoer";
import type { Character, ChatTurn, TalkMode } from "@/lib/types";

const MODI: { id: TalkMode; label: string; symbol: string }[] = [
  { id: "reden", label: "Reden", symbol: "💬" },
  { id: "befragen", label: "Befragen", symbol: "🔎" },
  { id: "beschuldigen", label: "Anklagen", symbol: "☝️" },
];

const VORSCHLAEGE: Record<TalkMode, string[]> = {
  reden: ["Wie geht's dir heute?", "Was machst du hier so?", "Erzähl mir was Neues."],
  befragen: [
    "Wo warst du zur Tatzeit?",
    "Wen hast du hier gesehen?",
    "Was weißt du über den Fall?",
  ],
  beschuldigen: [
    "Ich glaube, du warst es!",
    "Deine Geschichte passt nicht zusammen.",
    "Gib es zu - ich habe Beweise.",
  ],
};

export function ChatOverlay({
  charakter,
  detektiv,
  verlauf,
  onSenden,
  onSchliessen,
  laedt,
  fehler,
  tasche,
  onEinsetzen,
  wirktGerade,
}: {
  charakter: Character;
  /** Wimpy - er steht als Fragender vorne in der Szene. */
  detektiv?: Character;
  verlauf: ChatTurn[];
  onSenden: (modus: TalkMode, text: string) => void;
  onSchliessen: () => void;
  laedt: boolean;
  fehler: string | null;
  /** Was Wimpy dabeihat und hier einsetzen kann - mit Anzahl. */
  tasche: { stueck: Zubehoer; anzahl: number }[];
  /** Einsetzen und verbrauchen. */
  onEinsetzen: (stueck: Zubehoer) => void;
  /** Was gerade wirkt - steht über dem Eingabefeld. */
  wirktGerade: string | null;
}) {
  const [modus, setModus] = useState<TalkMode>("reden");
  const [text, setText] = useState("");
  const [tascheOffen, setTascheOffen] = useState(false);
  const endeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [verlauf.length, laedt]);

  const senden = (nachricht: string) => {
    const sauber = nachricht.trim();
    if (!sauber || laedt) return;
    onSenden(modus, sauber);
    setText("");
  };

  return (
    <div className="overlay gespraech einblenden">
      {/* Das Gegenüber füllt den Bildschirm - der Text liegt darüber. */}
      <Szene
        src={charakter.bild}
        alt={charakter.name}
        platzhalter={charakter.name}
        variante="portraet"
      />

      <div className="gespraech-kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ✕
        </button>

        {/* Beide Gesichter klein in der Kopfzeile - im Klassisch stehen sie
            groß in der Szene, dort sind sie per CSS ausgeblendet. */}
        <div className="gespraech-marke gegenueber" aria-hidden>
          <Bild src={charakter.bild} alt="" platzhalter={charakter.name} groesse="80px" />
        </div>

        <div className="gespraech-titel">
          <h1>{charakter.name}</h1>
          <p className="unterzeile">
            {charakter.tierart}, {charakter.alter} Jahre
          </p>
        </div>

        {/*
          Die Tasche liegt oben, wo der Daumen sie nicht sucht, sondern
          findet - und nicht mehr unten zwischen Eingabefeld und Senden.

          Sie taucht überhaupt erst auf, wenn wirklich etwas darin ist. Wer
          noch nie einen Gegenstand bekommen hat, soll gar nicht wissen, dass
          es so etwas gibt: Das erste Stück ist dann eine Überraschung und
          kein längst bekannter, bloß leerer Knopf.
        */}
        {tasche.length > 0 && (
          <button
            type="button"
            className="rund-knopf tasche-knopf"
            data-offen={tascheOffen}
            aria-label="Tasche"
            title="Tasche"
            onClick={() => setTascheOffen((auf) => !auf)}
          >
            <span className="symbol">🧰</span>
            <span className="knopf-wort">Tasche</span>
            <i className="tasche-punkt" />
          </button>
        )}

        {detektiv && (
          <div className="gespraech-marke ich" aria-hidden>
            <Bild src={detektiv.bild} alt="" platzhalter={detektiv.name} groesse="80px" />
          </div>
        )}
      </div>

      {/* Was Wimpy dabeihat - eine Klappe direkt unter der Kopfzeile. Wird
          das letzte Stück verbraucht, verschwindet sie mitsamt dem Knopf. */}
      {tascheOffen && tasche.length > 0 && (
        <div className="tasche">
          {tasche.map(({ stueck, anzahl }) => {
            const wirkung = wirkungVon(stueck.wirkung);
            return (
              <button
                key={stueck.id}
                className="tasche-stueck"
                disabled={laedt}
                onClick={() => {
                  onEinsetzen(stueck);
                  setTascheOffen(false);
                }}
              >
                <div className="tasche-bild">
                  <Bild src={stueck.bild} alt={stueck.name} platzhalter={stueck.name} />
                </div>
                <span className="tasche-text">
                  <strong>
                    {stueck.name} <span className="leise">×{anzahl}</span>
                  </strong>
                  <span className="leise klein">{wirkung?.hinweis}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="scroll chat">
        {verlauf.length === 0 && (
          <p className="chat-leer">{charakter.name} schaut dich erwartungsvoll an.</p>
        )}

        {verlauf.map((zug, index) => (
          <div
            key={index}
            className={`blase ${zug.role === "wimpy" ? "eigen" : "fremd"}`}
          >
            {zug.text}
          </div>
        ))}

        {laedt && (
          <div className="blase fremd tippt">
            <span />
            <span />
            <span />
          </div>
        )}

        {fehler && <p className="fehler">{fehler}</p>}
        <div ref={endeRef} />
      </div>

      {detektiv && (
        <div className="frager" data-modus={modus}>
          <Bild
            src={detektiv.bild}
            alt={detektiv.name}
            platzhalter={detektiv.name}
            groesse="180px"
          />
        </div>
      )}

      <div className="chat-fuss">

        {wirktGerade && <p className="wirkt">{wirktGerade}</p>}

        <div className="modus-reihe">
          {MODI.map((m) => (
            <button
              key={m.id}
              className="modus"
              data-aktiv={m.id === modus}
              onClick={() => setModus(m.id)}
            >
              <span className="symbol">{m.symbol}</span>
              <span className="zeilen-text">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="vorschlaege">
          {VORSCHLAEGE[modus].map((v) => (
            <button key={v} className="vorschlag" onClick={() => senden(v)} disabled={laedt}>
              {v}
            </button>
          ))}
        </div>

        <form
          className="eingabe"
          onSubmit={(e) => {
            e.preventDefault();
            senden(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`${modus === "beschuldigen" ? "Klage" : "Sag etwas zu"} ${charakter.name}${modus === "beschuldigen" ? " an" : ""} …`}
            maxLength={300}
            enterKeyHint="send"
          />
          <button type="submit" className="senden" disabled={laedt || !text.trim()}>
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}
