"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bild } from "./Bild";
import { postJson } from "@/lib/api";
import {
  GEDULD,
  LEERE_ANHOERUNG,
  UEBERZEUGT,
  anhoerungsErgebnis,
  anhoerungsWorte,
  verrechnen,
  type AnhoerungAntwort,
  type AnhoerungStand,
  type AnhoerungZug,
} from "@/lib/anhoerung";
import { TASCHE_MAX, type Beweismittel } from "@/lib/beweismittel";
import type { FinaleArt } from "@/lib/sagaFinale";
import type { Character } from "@/lib/types";

/**
 * Die Anhörung: der Gerichtssaal als Gespräch zu dritt.
 *
 * Wimpy fragt, der Angeklagte antwortet, Öhö sitzt dabei - hakt nach, weist
 * zurück, fragt selbst. Beweismittel sind hier keine Knöpfe, die abgehakt
 * werden, sondern Argumente: Man legt eines vor und sagt dazu, was es
 * bedeutet. Genau das bringt den Saal weiter.
 *
 * Zwei Balken tragen die Szene: Wie weit das Gericht ist, und wie lange Öhö
 * das noch mitmacht. Die Zahlen dazu kommen ausschließlich vom Server; hier
 * werden sie nur verrechnet und angezeigt.
 *
 * Vorlegen kann Wimpy nur, was in der Beweismitteltasche liegt. Was er
 * unterwegs liegen gelassen hat, ist heute nicht mehr da.
 */
const VORSCHLAEGE = [
  "Wo waren Sie in der Tatnacht?",
  "Das passt nicht zu Ihrer eigenen Aussage.",
  "Erklären Sie das dem Gericht.",
  "Warum haben Sie das verschwiegen?",
];

export function Anhoerung({
  art,
  bogenSiegel,
  frage,
  anklage,
  richter,
  angeklagter,
  detektiv,
  tasche,
  kulisse,
  kopf,
  onUrteil,
}: {
  art: FinaleArt;
  bogenSiegel: string;
  /** Steht groß über dem Saal. */
  frage: string;
  /** Womit Öhö eröffnet hat. */
  anklage: string;
  richter: Character | undefined;
  angeklagter: Character | undefined;
  detektiv: Character | undefined;
  /** Was in der Beweismitteltasche liegt. */
  tasche: Beweismittel[];
  /** Die Kulisse des Saals - kommt vom Gerichtssaal, damit sie überall gleich ist. */
  kulisse: ReactNode;
  kopf: ReactNode;
  /** Die Verhandlung ist durch: Öhö spricht sein Urteil. */
  onUrteil: (geschafft: boolean) => void;
}) {
  const worte = anhoerungsWorte(art);
  const [stand, setStand] = useState<AnhoerungStand>(LEERE_ANHOERUNG);
  const [text, setText] = useState("");
  const [legtVor, setLegtVor] = useState<Beweismittel | null>(null);
  const [regalOffen, setRegalOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stand.verlauf.length, laeuft]);

  const ergebnis = anhoerungsErgebnis(stand);
  const vorbei = ergebnis !== "laeuft";
  const offeneStuecke = tasche.filter((m) => !stand.vorgelegt.includes(m.id));

  const senden = async (nachricht: string) => {
    const sauber = nachricht.trim();
    const stueck = legtVor;
    // Legt Wimpy etwas vor, darf er es ohne Worte tun - der Satz steht dann
    // für ihn da. Ganz ohne beides passiert nichts.
    const gesagt = sauber || (stueck ? `Hohes Gericht, ich lege ${stueck.name} vor.` : "");
    if (!gesagt || laeuft || vorbei) return;

    setLaeuft(true);
    setFehler(null);
    setText("");
    setLegtVor(null);

    const eigener: AnhoerungZug = {
      rolle: "wimpy",
      text: gesagt,
      ...(stueck ? { mittelId: stueck.id } : {}),
    };
    // Der eigene Satz steht sofort im Saal - alles andere kommt mit der Antwort.
    setStand((alt) => ({ ...alt, verlauf: [...alt.verlauf, eigener] }));

    try {
      const antwort = await postJson<AnhoerungAntwort>(
        "/api/anhoerung",
        {
          bogenSiegel,
          mittelSiegel: tasche.map((m) => m.siegel).filter(Boolean),
          vorgelegt: stand.vorgelegt,
          legtVor: stueck?.id,
          nachricht: gesagt,
          verlauf: stand.verlauf,
          ueberzeugung: stand.ueberzeugung,
          geduld: stand.geduld,
          bankId: angeklagter?.id,
          richterId: richter?.id,
        },
        40,
      );

      const zuege: AnhoerungZug[] = [];
      if (antwort.angeklagter) zuege.push({ rolle: "angeklagter", text: antwort.angeklagter });
      if (antwort.richter) zuege.push({ rolle: "richter", text: antwort.richter });

      setStand((alt) =>
        // Der eigene Satz liegt schon drin; verrechnet wird nur, was
        // zurückkommt.
        verrechnen(alt, antwort, zuege, stueck?.id),
      );
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das ging schief.");
      // Den eigenen Satz zurücknehmen, damit man ihn erneut sagen kann - und
      // das Stück wieder in die Hand, es liegt ja noch nicht auf dem Tisch.
      setStand((alt) => ({ ...alt, verlauf: alt.verlauf.slice(0, -1) }));
      setText(sauber);
      setLegtVor(stueck);
    } finally {
      setLaeuft(false);
    }
  };

  const nameVon = (rolle: AnhoerungZug["rolle"]) =>
    rolle === "wimpy"
      ? (detektiv?.name ?? "Wimpy")
      : rolle === "richter"
        ? (richter?.name ?? "Der Vorsitz")
        : (angeklagter?.name ?? "Der Angeklagte");

  return (
    <div className="saal anhoerung">
      {kulisse}
      {kopf}

      <div className="saal-waage anhoerung-stand">
        <div>
          <span className="saal-marke">{worte.maß}</span>
          <div className="anhoerung-balken">
            <span style={{ width: `${(stand.ueberzeugung / UEBERZEUGT) * 100}%` }} />
          </div>
        </div>
        <div className="saal-geduld">
          <span className="saal-marke">Geduld des Gerichts</span>
          <span className="saal-lichter">
            {Array.from({ length: GEDULD }, (_, i) => (
              <i key={i} data-weg={i >= stand.geduld} />
            ))}
          </span>
        </div>
      </div>

      <div className="scroll chat anhoerung-saal">
        <h2 className="saal-frage">{frage}</h2>
        {anklage && <p className="saal-anklage">„{anklage}“</p>}

        {stand.verlauf.length === 0 && (
          <p className="chat-leer">{worte.ziel}</p>
        )}

        {stand.verlauf.map((zug, index) => {
          const stueck = zug.mittelId
            ? tasche.find((m) => m.id === zug.mittelId)
            : undefined;
          return (
            <div
              key={index}
              className={`blase ${
                zug.rolle === "wimpy" ? "eigen" : zug.rolle === "richter" ? "vorsitz" : "fremd"
              }`}
            >
              {zug.rolle !== "wimpy" && (
                <span className="blase-name">{nameVon(zug.rolle)}</span>
              )}
              {stueck && (
                <span className="blase-beweis">
                  <span className="blase-beweis-bild">
                    {/* Ohne Bild bleibt der Kreis leer - der Name steht ja
                        gleich daneben. */}
                    <Bild src={stueck.bild} alt="" platzhalter="" />
                  </span>
                  {stueck.name}
                </span>
              )}
              {zug.text}
            </div>
          );
        })}

        {laeuft && (
          <div className="blase fremd tippt">
            <span />
            <span />
            <span />
          </div>
        )}

        {fehler && <p className="fehler">{fehler}</p>}
        <div ref={endeRef} />
      </div>

      {/* Ist es entschieden, geht es nur noch weiter zum Urteil. */}
      {vorbei ? (
        <div className="saal-leiste">
          <p className="anhoerung-schluss">
            {ergebnis === "gewonnen"
              ? worte.entschieden
              : "Öhö hat genug gehört. Mehr war heute nicht zu holen."}
          </p>
          <button className="knopf aktion" onClick={() => onUrteil(ergebnis === "gewonnen")}>
            {richter?.name ?? "Der Vorsitz"} spricht ›
          </button>
        </div>
      ) : (
        <div className="chat-fuss anhoerung-fuss">
          {legtVor && (
            <p className="wirkt">
              Du legst vor: <strong>{legtVor.name}</strong>{" "}
              <button className="anhoerung-weg" onClick={() => setLegtVor(null)}>
                ✕
              </button>
            </p>
          )}

          {/* Das Regal: nur was in der Tasche liegt, und jedes Stück einmal. */}
          <div className="anhoerung-leiste">
            <button
              className="knopf klein"
              data-offen={regalOffen}
              onClick={() => setRegalOffen((auf) => !auf)}
            >
              🗂️ Beweismittel ({offeneStuecke.length}/{TASCHE_MAX})
            </button>
            <button
              className="knopf klein"
              onClick={() => {
                if (
                  window.confirm(
                    "Schlusswort erbitten? Was jetzt noch fehlt, fehlt endgültig.",
                  )
                ) {
                  onUrteil(false);
                }
              }}
            >
              Schlusswort erbitten
            </button>
          </div>

          {regalOffen && (
            <div className="tasche anhoerung-regal">
              {offeneStuecke.length === 0 && (
                <p className="leise klein">
                  {tasche.length === 0
                    ? "Du hast nichts mitgebracht. Es bleibt beim Fragen."
                    : "Alles, was du hattest, liegt auf dem Tisch."}
                </p>
              )}
              {offeneStuecke.map((mittel) => (
                <button
                  key={mittel.id}
                  className="tasche-stueck"
                  disabled={laeuft}
                  onClick={() => {
                    setLegtVor(mittel);
                    setRegalOffen(false);
                  }}
                >
                  <div className="tasche-bild">
                    <Bild src={mittel.bild} alt={mittel.name} platzhalter={mittel.name} />
                  </div>
                  <span className="tasche-text">
                    <strong>{mittel.name}</strong>
                    <span className="leise klein">{mittel.herkunft}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="vorschlaege">
            {VORSCHLAEGE.map((v) => (
              <button
                key={v}
                className="vorschlag"
                onClick={() => void senden(v)}
                disabled={laeuft}
              >
                {v}
              </button>
            ))}
          </div>

          <form
            className="eingabe"
            onSubmit={(e) => {
              e.preventDefault();
              void senden(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                legtVor ? `Was beweist ${legtVor.name}?` : `${worte.vorlegen} oder fragen …`
              }
              maxLength={300}
              enterKeyHint="send"
            />
            <button
              type="submit"
              className="senden"
              disabled={laeuft || (!text.trim() && !legtVor)}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
