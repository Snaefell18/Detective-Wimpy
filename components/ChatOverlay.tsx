"use client";

import { useEffect, useRef, useState } from "react";
import { Bild } from "./Bild";
import { getCharacter } from "@/lib/characters";
import type { ChatTurn, TalkMode } from "@/lib/types";

const MODI: { id: TalkMode; label: string; symbol: string }[] = [
  { id: "reden", label: "Reden", symbol: "💬" },
  { id: "befragen", label: "Befragen", symbol: "🔎" },
  { id: "beschuldigen", label: "Beschuldigen", symbol: "☝️" },
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
  charakterId,
  verlauf,
  onSenden,
  onSchliessen,
  laedt,
  fehler,
}: {
  charakterId: string;
  verlauf: ChatTurn[];
  onSenden: (modus: TalkMode, text: string) => void;
  onSchliessen: () => void;
  laedt: boolean;
  fehler: string | null;
}) {
  const [modus, setModus] = useState<TalkMode>("reden");
  const [text, setText] = useState("");
  const endeRef = useRef<HTMLDivElement>(null);
  const charakter = getCharacter(charakterId);

  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf.length, laedt]);

  const senden = (nachricht: string) => {
    const sauber = nachricht.trim();
    if (!sauber || laedt) return;
    onSenden(modus, sauber);
    setText("");
  };

  return (
    <div className="overlay einblenden">
      <div className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ✕
        </button>
        <div className="charakter-bild klein">
          <Bild src={charakter?.bild} alt={charakter?.name ?? charakterId} platzhalter={charakter?.name} />
        </div>
        <div>
          <h1>{charakter?.name}</h1>
          <p className="unterzeile">{charakter?.tierart}</p>
        </div>
      </div>

      <div className="scroll chat">
        {verlauf.length === 0 && (
          <p className="leise" style={{ textAlign: "center", marginTop: 24 }}>
            {charakter?.name} schaut dich erwartungsvoll an.
          </p>
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

      <div className="chat-fuss">
        <div className="modus-reihe">
          {MODI.map((m) => (
            <button
              key={m.id}
              className="modus"
              data-aktiv={m.id === modus}
              onClick={() => setModus(m.id)}
            >
              {m.symbol} {m.label}
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
            placeholder={`${modus === "beschuldigen" ? "Beschuldige" : "Sag etwas zu"} ${charakter?.name} …`}
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
