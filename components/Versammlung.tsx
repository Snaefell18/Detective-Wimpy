"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { postJson } from "@/lib/api";
import type { Beweismittel } from "@/lib/beweismittel";
import { useStammdaten } from "@/lib/stammdaten";
import {
  versammlungsMittel,
  type VersammlungAntwort,
  type VersammlungBeitrag,
  type VersammlungBeweis,
  type VersammlungVorgabe,
} from "@/lib/versammlung";
import { Bild } from "./Bild";
import { FundMoment } from "./FundMoment";

const VORSCHLAEGE = [
  "Welche Aussage passt hier überhaupt nicht zusammen?",
  "Wer hatte als Erstes davon erfahren?",
  "Was verschweigt ihr gerade alle?",
  "Gehen wir den Ablauf noch einmal genau durch.",
];

type RatStil = CSSProperties & {
  "--i"?: number;
  "--n"?: number;
  "--resonanz"?: number;
  "--dx"?: string;
  "--offset"?: string;
  "--tilt"?: string;
};

/**
 * Die Versammlung: eine freie, mehrstimmige Ratsrunde zwischen Kapiteln.
 *
 * Sie hat absichtlich keine sichtbare Punktzahl. Hinter dem irisierenden
 * Kern verdichtet sich das Gespräch trotzdem; sobald genug konkrete Details
 * zusammengekommen sind, reißt er auf und gibt ein zusätzliches Beweisstück
 * frei. Der Spieler darf vorher oder nachher jederzeit Schluss machen.
 */
export function Versammlung({
  vorgabe,
  bogenSiegel,
  inhalt,
  onAufnehmen,
  onFertig,
}: {
  vorgabe: VersammlungVorgabe;
  bogenSiegel: string;
  inhalt: Beweismittel[];
  onAufnehmen: (mittel: Beweismittel, statt?: string) => void;
  onFertig: () => void;
}) {
  const stammdaten = useStammdaten();
  const [verlauf, setVerlauf] = useState<VersammlungBeitrag[]>([]);
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState(0);
  const [runde, setRunde] = useState(0);
  const [beweisGefunden, setBeweisGefunden] = useState(false);
  const [fund, setFund] = useState<VersammlungBeweis | null>(null);
  const [beendet, setBeendet] = useState(false);
  const gestartet = useRef(false);
  const verlaufRef = useRef<HTMLDivElement>(null);

  const alleIds = useMemo(
    () => new Set([...vorgabe.teilnehmerIds, ...vorgabe.beobachterIds, vorgabe.vorsitzId]),
    [vorgabe],
  );
  const tiere = useMemo(
    () => stammdaten.charaktere.filter((c) => alleIds.has(c.id)),
    [alleIds, stammdaten.charaktere],
  );
  const detektiv = stammdaten.charaktere.find((c) => c.istDetektiv);
  const vorsitz = tiere.find((c) => c.id === vorgabe.vorsitzId);
  const nameVon = (id: string) =>
    (id === detektiv?.id ? detektiv : tiere.find((c) => c.id === id))?.name ?? id;
  const tierVon = (id: string) =>
    id === detektiv?.id ? detektiv : tiere.find((c) => c.id === id);

  useEffect(() => {
    const element = verlaufRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [verlauf.length, laeuft]);

  const anfragen = async ({
    nachricht = "",
    start = false,
    schluss = false,
  }: {
    nachricht?: string;
    start?: boolean;
    schluss?: boolean;
  }) => {
    const sauber = nachricht.trim();
    if (laeuft || beendet || (!start && !schluss && !sauber)) return;

    setLaeuft(true);
    setFehler(null);
    setText("");
    const eigener: VersammlungBeitrag | null =
      !start && !schluss
        ? { sprecherId: detektiv?.id ?? "wimpy", text: sauber, spieler: true }
        : null;
    const davor = eigener ? [...verlauf, eigener] : verlauf;
    if (eigener) setVerlauf(davor);
    const naechsteRunde = start || schluss ? runde : runde + 1;

    try {
      const antwort = await postJson<VersammlungAntwort>(
        "/api/versammlung",
        {
          bogenSiegel,
          versammlungId: vorgabe.id,
          charaktere: stammdaten.charaktere.filter(
            (c) => alleIds.has(c.id) || c.istDetektiv,
          ),
          verlauf: davor,
          nachricht: sauber,
          fortschritt,
          runde: naechsteRunde,
          start,
          beenden: schluss,
          beweisGefunden,
        },
        45,
      );
      setVerlauf((alt) => [...alt, ...antwort.beitraege]);
      setFortschritt((alt) => Math.min(100, alt + antwort.fortschrittPlus));
      setRunde(naechsteRunde);
      if (antwort.beweis && !beweisGefunden) {
        setBeweisGefunden(true);
        setFund(antwort.beweis);
        setVerlauf((alt) => [
          ...alt,
          {
            sprecherId: "system",
            text: `Die Resonanz reißt auf: ${antwort.beweis?.name ?? "Etwas"} fällt aus dem Gespräch.`,
            system: true,
          },
        ]);
      }
      if (antwort.beendet) setBeendet(true);
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Die Stimmen sind abgerissen.");
      if (eigener) setVerlauf((alt) => alt.slice(0, -1));
      if (schluss) {
        setVerlauf((alt) => [
          ...alt,
          {
            sprecherId: vorgabe.vorsitzId,
            text: "Genug für heute. Der Rat löst sich auf, bevor der Raum uns eine Gegenfrage stellt.",
          },
        ]);
        setBeendet(true);
      } else if (eigener) setText(sauber);
    } finally {
      setLaeuft(false);
    }
  };

  useEffect(() => {
    if (!stammdaten.geladen || gestartet.current || !vorsitz) return;
    gestartet.current = true;
    void anfragen({ start: true });
    // Die Eröffnung gehört genau einmal zum Mount dieser Szene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stammdaten.geladen, vorsitz?.id]);

  const fundFuerMoment = fund
    ? {
        spur: {
          itemId: fund.itemId,
          name: fund.name,
          bild: fund.bild,
          beobachtung: fund.beobachtung,
          vermutung: fund.vermutung,
          herkunft: fund.herkunft,
          siegel: fund.siegel,
        },
        text: fund.beobachtung,
      }
    : null;

  return (
    <div
      className="versammlung"
      data-beendet={beendet}
      style={{ "--resonanz": fortschritt / 100 } as RatStil}
    >
      <div className="rat-kosmos" aria-hidden="true">
        <i className="rat-sonne" />
        <i className="rat-orbit rat-orbit-eins" />
        <i className="rat-orbit rat-orbit-zwei" />
        <i className="rat-orbit rat-orbit-drei" />
        <div className="rat-augenmond"><span /></div>
        <div className="rat-partikel">
          {Array.from({ length: 18 }, (_, i) => (
            <i
              key={i}
              style={{
                "--i": i,
                "--dx": `${((i % 3) - 1) * 24}px`,
                left: `${(i * 47) % 100}%`,
                top: `${(i * 31) % 91}%`,
                width: `${3 + (i % 4) * 2}px`,
                height: `${3 + (i % 4) * 2}px`,
                animationDuration: `${7 + (i % 7)}s`,
              } as RatStil}
            />
          ))}
        </div>
      </div>

      <header className="rat-kopf">
        <span className="rat-siegel">✦ {vorgabe.anlass} ✦</span>
        <h1>{vorgabe.name}</h1>
        <p>{vorgabe.thema}</p>
      </header>

      <div className="rat-figuren" aria-label="Tiere in der Versammlung">
        {tiere.map((tier, i) => {
          const beobachtet = vorgabe.beobachterIds.includes(tier.id);
          return (
            <div
              key={tier.id}
              className="rat-figur"
              data-vorsitz={tier.id === vorgabe.vorsitzId}
              data-beobachter={beobachtet}
              style={{
                "--i": i,
                "--n": Math.max(tiere.length, 1),
                "--offset": `${(i % 3) * 5}px`,
                "--tilt": `${(i % 2) * 3 - 1.5}deg`,
                animationDuration: `${4.6 + (i % 4) * 0.8}s`,
              } as RatStil}
            >
              <div className="rat-figur-bild">
                <Bild src={tier.bild} alt={tier.name} platzhalter={tier.name} rund sofort />
              </div>
              <span>{tier.name}</span>
              {tier.id === vorgabe.vorsitzId && <b>VORSITZ</b>}
              {beobachtet && <b>AM RAND</b>}
            </div>
          );
        })}
      </div>

      <div className="rat-resonanz" aria-label="Im Hintergrund verdichtet sich etwas">
        <span className="rat-resonanz-kern">?</span>
        <i />
      </div>

      <div className="rat-chat" aria-live="polite">
        <div className="rat-verlauf" ref={verlaufRef}>
          {verlauf.length === 0 && !fehler && (
            <p className="rat-wartet">Die Stühle flüstern. Der Vorsitz sammelt seine Stimme …</p>
          )}
          {verlauf.map((beitrag, index) => {
            if (beitrag.system) {
              return <div className="rat-system" key={index}>{beitrag.text}</div>;
            }
            const tier = tierVon(beitrag.sprecherId);
            return (
              <div className="rat-beitrag" data-spieler={beitrag.spieler} key={index}>
                {!beitrag.spieler && (
                  <div className="rat-beitrag-bild">
                    <Bild src={tier?.bild} alt="" platzhalter={nameVon(beitrag.sprecherId)} rund />
                  </div>
                )}
                <div className="rat-blase">
                  <span>{beitrag.spieler ? "Du" : nameVon(beitrag.sprecherId)}</span>
                  <p>{beitrag.text}</p>
                </div>
              </div>
            );
          })}
          {laeuft && (
            <div className="rat-beitrag rat-denkt">
              <div className="rat-blase"><i /><i /><i /></div>
            </div>
          )}
          {fehler && <p className="fehler rat-fehler">{fehler}</p>}
        </div>

        {beendet ? (
          <div className="rat-schluss">
            <span>Der Rat zerfällt wieder in gewöhnliche Geometrie.</span>
            <button className="knopf aktion" onClick={onFertig}>Weiter zum nächsten Kapitel ›</button>
          </div>
        ) : (
          <div className="rat-eingabe-zone">
            <div className="rat-vorschlaege">
              {VORSCHLAEGE.map((v) => (
                <button key={v} onClick={() => void anfragen({ nachricht: v })} disabled={laeuft}>
                  {v}
                </button>
              ))}
            </div>
            <form
              className="rat-eingabe"
              onSubmit={(e) => {
                e.preventDefault();
                void anfragen({ nachricht: text });
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Mitdiskutieren, widersprechen, nachfragen …"
                maxLength={600}
                disabled={laeuft}
              />
              <button type="submit" disabled={laeuft || !text.trim()} aria-label="Senden">➤</button>
            </form>
            <button
              className="rat-beenden"
              disabled={laeuft}
              onClick={() => void anfragen({ schluss: true })}
            >
              Runde jederzeit beenden
            </button>
          </div>
        )}
      </div>

      {fundFuerMoment && (
        <div className="versammlungs-fund">
          <FundMoment
            fund={fundFuerMoment}
            herkunft={fund?.herkunft ?? vorgabe.name}
            inhalt={inhalt}
            onAufnehmen={(mittel, statt) => onAufnehmen(versammlungsMittel(fund!), statt)}
            onFertig={() => setFund(null)}
          />
        </div>
      )}
    </div>
  );
}
