"use client";

import { useState } from "react";
import { Anhoerung } from "./Anhoerung";
import { Bild, Szene } from "./Bild";
import { Gerichtseinzug } from "./Gerichtseinzug";
import { Verwandlung } from "./Verwandlung";
import { postJson } from "@/lib/api";
import type { Beweismittel } from "@/lib/beweismittel";
import { spiele } from "@/lib/introAudio";
import { mitAnklage, saalTexte, type Verhandlung } from "@/lib/sagaFinale";
import { hatStrafe, type Strafe } from "@/lib/urteil";
import type { Character } from "@/lib/types";

/**
 * Das Finale als Gerichtsverhandlung.
 *
 * Der Abend hat drei Teile:
 *
 *   1. Die Anklage - Wimpy benennt, wen er beschuldigt. Zwei Versuche.
 *      Sitzt sie, wird der Saal still; und ist der Angeklagte besessen,
 *      zeigt sich das genau jetzt und keinen Moment früher.
 *   2. Die Anhörung - verhandelt wird im Gespräch zu dritt: Wimpy fragt, der
 *      Angeklagte antwortet, Öhö hakt nach und urteilt, sobald er überzeugt
 *      ist. Vorlegen kann Wimpy nur, was in der Beweismitteltasche liegt.
 *   3. Das Urteil - Öhö sperrt niemanden weg, er denkt sich eine
 *      Wiedergutmachung aus, die zur Sache passt.
 *
 * Nichts Entscheidendes liegt im Browser: Wer angeklagt werden muss, was ein
 * Beweismittel wirklich beweist und was am Ende verhängt wird, steht im
 * versiegelten Bogen und in den Siegeln der Tasche. Die Anhörung selbst ist
 * der einzige Schritt mit Modellaufruf; Anklage und Urteil kommen ohne aus,
 * denn ihre Texte stehen seit der Erzeugung fest.
 */
type AnklageAntwort = {
  richtig: boolean;
  text: string;
  angeklagter?: Character | null;
  verwandlung?: { wirt: Character | null; daemon: Character | null; ton: string } | null;
};

export function Gerichtssaal({
  verhandlung,
  bogenSiegel,
  besetzung,
  frage,
  einzugTon = "",
  tasche,
  onFertig,
}: {
  verhandlung: Verhandlung;
  bogenSiegel: string;
  /** Alle Tiere der Saga - für Bilder und Namen. */
  besetzung: Character[];
  /** Steht groß über dem Saal. */
  frage: string;
  /** Das Stück zum Einzug des Gerichts - leer heißt: feste Dauer. */
  einzugTon?: string;
  /**
   * Die Beweismitteltasche - alles, was Wimpy über die Saga hinweg
   * mitgenommen hat. Nur damit lässt sich hier arbeiten; leer heißt: Es
   * bleibt beim Fragen.
   */
  tasche: Beweismittel[];
  /** Die Verhandlung ist durch - mit oder ohne Schuldspruch. */
  onFertig: (geschafft: boolean) => void;
}) {
  const finde = (id: string) => besetzung.find((c) => c.id === id);
  const worte = saalTexte(verhandlung.art);
  const richter = finde(verhandlung.richterId);
  const klagenNoetig = mitAnklage(verhandlung.art);

  /* --- Zustand -------------------------------------------------------- */

  /** Wer auf der Anklagebank sitzt. Beim Anklagen erst nach dem Treffer. */
  const [bank, setBank] = useState<Character | undefined>(() =>
    klagenNoetig ? undefined : finde(verhandlung.bankId ?? ""),
  );
  const [versuche, setVersuche] = useState(verhandlung.anklageVersuche ?? 2);
  /** Wen man gerade im Blick hat, bevor man wirklich anklagt. */
  const [gewaehlt, setGewaehlt] = useState<Character | null>(null);
  /** Wen das Gericht schon abgewiesen hat - denselben zweimal wäre schade. */
  const [abgewiesen, setAbgewiesen] = useState<string[]>([]);
  /** Öhös Wort zur Anklage - richtig wie falsch. */
  const [spruch, setSpruch] = useState<{ text: string; richtig: boolean } | null>(null);
  /** Läuft gerade die Verwandlung des Angeklagten? */
  const [wandelt, setWandelt] = useState<AnklageAntwort["verwandlung"]>(null);
  /**
   * Ist das Gericht schon eingezogen?
   *
   * Der Einzug kommt bewusst spät: erst wird angeklagt, dann zeigt sich, was
   * in dem Angeklagten steckt - und dann erst flattert Öhö herein und
   * eröffnet. Vorher wüsste er ja noch gar nicht, gegen wen.
   */
  const [eingezogen, setEingezogen] = useState(false);

  const [urteil, setUrteil] = useState<
    { text: string; geschafft: boolean; strafe?: Strafe } | null
  >(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /* --- Die Anklage ---------------------------------------------------- */

  const anklagen = async (wen: Character) => {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const ergebnis = await postJson<AnklageAntwort>(
        "/api/verhandlung",
        { bogenSiegel, schritt: "anklagen", charakterId: wen.id },
        30,
      );

      if (ergebnis.richtig) {
        setBank(ergebnis.angeklagter ?? wen);
        setWandelt(ergebnis.verwandlung ?? null);
        setSpruch({ text: ergebnis.text, richtig: true });
        setGewaehlt(null);
        return;
      }

      const uebrig = versuche - 1;
      setVersuche(uebrig);
      setAbgewiesen((alt) => [...alt, wen.id]);
      setGewaehlt(null);
      setSpruch({ text: ergebnis.text, richtig: false });
      // Zwei Fehlgriffe, und das Verfahren ist zu Ende, bevor es begann.
      if (uebrig <= 0) await urteilHolen(false);
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das ging schief.");
    } finally {
      setLaeuft(false);
    }
  };

  /** Öhös Schlusswort - es steht seit der Erzeugung fest. */
  const urteilHolen = async (geschafft: boolean) => {
    try {
      const { text, strafe } = await postJson<{ text: string; strafe?: Strafe }>(
        "/api/verhandlung",
        { bogenSiegel, schritt: "urteil", geschafft },
        30,
      );
      setUrteil({ text, geschafft, strafe });
    } catch {
      // Ohne Netz endet die Verhandlung trotzdem - nur eben wortkarg.
      setUrteil({
        text: geschafft
          ? "Der Saal erhebt sich. Das Urteil steht."
          : "Der Vorsitz schließt die Akte. Mehr war heute nicht zu holen.",
        geschafft,
      });
    }
  };

  /* --- Bausteine ------------------------------------------------------ */

  const kulisse = (
    <div className="saal-kulisse" aria-hidden="true">
      <div className="saal-taefelung" />
      <div className="saal-licht" />
      <div className="saal-flimmern" />
    </div>
  );

  const kopf = (
    <header className="kopf saal-kopf">
      <div className="saal-portraet">
        <Bild
          src={richter?.bild}
          alt={richter?.name ?? ""}
          platzhalter={richter?.name}
          rund
          sofort
        />
      </div>
      {/* Sobald jemand auf der Bank sitzt, sieht man ihn auch. */}
      {bank && (
        <div className="saal-portraet" data-bank="true">
          <Bild src={bank.bild} alt={bank.name} platzhalter={bank.name} rund sofort />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{worte.titel}</h1>
        <p className="unterzeile">
          Vorsitz: {richter?.name ?? "—"}
          {bank ? ` · Angeklagt: ${bank.name}` : ""}
        </p>
      </div>
    </header>
  );

  /* --- Das Urteil ---------------------------------------------------- */

  if (urteil) {
    return (
      <div className="saal urteil" data-geschafft={urteil.geschafft}>
        <Szene
          src={richter?.bild}
          alt={richter?.name ?? ""}
          platzhalter={richter?.name}
          variante="portraet"
        />
        <div className="saal-schleier" />
        <div className="saal-urteil-inhalt">
          <span className="intro-oberzeile">{richter?.name ?? "Der Vorsitz"} spricht</span>
          <h1 className="intro-logo saal-urteil-wort">
            {urteil.geschafft ? worte.gewonnen : worte.verloren}
          </h1>
          <span className="saal-strich" />

          <p className="saal-spruch">{urteil.text}</p>

          {/* Öhö sperrt niemanden weg - er denkt sich etwas aus, das zur
              Sache passt. Steht nichts drin, gab es auch nichts. */}
          {hatStrafe(urteil.strafe) && (
            <div className="saal-auflage">
              {urteil.strafe?.wort && (
                <strong className="saal-auflage-wort">{urteil.strafe.wort}</strong>
              )}
              {urteil.strafe?.auflage && <p>{urteil.strafe.auflage}</p>}
            </div>
          )}

          <button
            className="knopf aktion"
            onClick={() => {
              if (urteil.geschafft) void spiele("jubel");
              onFertig(urteil.geschafft);
            }}
          >
            Weiter ›
          </button>
        </div>
      </div>
    );
  }

  /* --- Die Verwandlung: erst jetzt zeigt sich, was in ihm steckte ----- */

  if (wandelt && spruch === null) {
    return (
      <Verwandlung
        wirt={wandelt.wirt ?? undefined}
        daemon={wandelt.daemon ?? undefined}
        ton={wandelt.ton}
        onFertig={() => {
          if (wandelt.daemon) setBank(wandelt.daemon);
          setWandelt(null);
        }}
      />
    );
  }

  /* --- Öhös Wort zur Anklage ------------------------------------------ */

  if (spruch) {
    const gesicht = spruch.richtig ? (bank ?? richter) : richter;
    return (
      <div className="saal reaktion" data-traegt={spruch.richtig}>
        <Szene
          src={gesicht?.bild}
          alt={gesicht?.name ?? ""}
          platzhalter={gesicht?.name}
          variante="portraet"
        />
        <div className="saal-schleier" />
        <div className="saal-mitte">
          <span className="saal-siegel" data-traegt={spruch.richtig}>
            {spruch.richtig ? "Angenommen" : "Abgewiesen"}
          </span>
          <h1 className="intro-stadt">
            {spruch.richtig ? "Der Saal wird still." : "Das Gericht sieht das anders."}
          </h1>
          <p className="saal-spruch">{spruch.text}</p>
          {!spruch.richtig && (
            <p className="leise klein">
              {versuche > 0
                ? `Noch ${versuche === 1 ? "ein Versuch" : `${versuche} Versuche`}.`
                : "Kein Versuch mehr."}
            </p>
          )}
          <button className="knopf aktion" onClick={() => setSpruch(null)}>
            Weiter ›
          </button>
        </div>
      </div>
    );
  }

  /* --- Das Gericht zieht ein ------------------------------------------ */

  /*
   * Jetzt steht fest, wer auf der Bank sitzt - und bei einer Besessenheit
   * auch, was wirklich dort sitzt. Erst hier lohnt sich der große Auftritt.
   *
   * Wo gar nicht angeklagt wird, gibt es nichts abzuwarten: Dort zieht das
   * Gericht sofort ein - auch dann, wenn zur Bank kein Tier zu finden ist.
   */
  if (!eingezogen && (bank || !klagenNoetig)) {
    return (
      <Gerichtseinzug
        richter={richter}
        ton={einzugTon}
        onFertig={() => setEingezogen(true)}
      />
    );
  }

  /* --- Wen klagst du an? ---------------------------------------------- */

  if (klagenNoetig && !bank) {
    const anklagbar = (verhandlung.anklagbareIds ?? [])
      .map(finde)
      .filter((c): c is Character => Boolean(c));

    return (
      <div className="saal">
        {kulisse}
        {kopf}
        <div className="scroll">
          <div className="inhalt">
            <h2 className="saal-frage">Wen klagst du an?</h2>

            <div className="saal-versuche">
              <span className="saal-marke">Versuche</span>
              <span className="saal-lichter">
                {Array.from({ length: verhandlung.anklageVersuche ?? 2 }, (_, i) => (
                  <i key={i} data-weg={i >= versuche} />
                ))}
              </span>
            </div>

            {anklagbar.map((c) => (
              <button
                key={c.id}
                className="dossier saal-verdaechtig"
                data-aktiv={gewaehlt?.id === c.id}
                data-abgewiesen={abgewiesen.includes(c.id)}
                disabled={abgewiesen.includes(c.id)}
                onClick={() => setGewaehlt(gewaehlt?.id === c.id ? null : c)}
              >
                <div className="dossier-bild">
                  <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
                </div>
                <div className="dossier-text">
                  <div className="dossier-kopf">
                    <strong>{c.name}</strong>
                    <span className="leise">
                      {c.tierart}
                      {c.beruf?.trim() ? ` · ${c.beruf.trim()}` : ""}
                    </span>
                  </div>
                  {abgewiesen.includes(c.id) ? (
                    <span className="saal-gewaehlt" data-aus="true">
                      Vom Gericht abgewiesen
                    </span>
                  ) : (
                    gewaehlt?.id === c.id && (
                      <span className="saal-gewaehlt">Bereit zur Anklage</span>
                    )
                  )}
                </div>
              </button>
            ))}

            {anklagbar.length === 0 && (
              <p className="leise">
                Diese Verhandlung kennt niemanden zum Anklagen - hier stimmt
                etwas nicht.
              </p>
            )}

            {fehler && <p className="fehler">{fehler}</p>}
          </div>
        </div>

        {gewaehlt && (
          <div className="saal-leiste">
            <button
              className="knopf aktion"
              disabled={laeuft}
              onClick={() => void anklagen(gewaehlt)}
            >
              {laeuft ? "Das Gericht hört zu …" : `${gewaehlt.name} anklagen ›`}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* --- Die Anhörung ---------------------------------------------------- */

  /*
   * Ab hier führt die Anhörung die Verhandlung: ein Gespräch zu dritt, in
   * dem Beweismittel Argumente sind und nicht Knöpfe. Sie bringt ihre eigene
   * Fußzeile mit, deshalb bekommt sie Kulisse und Kopfzeile von hier - so
   * sieht der Saal überall gleich aus.
   */
  return (
    <Anhoerung
      art={verhandlung.art}
      bogenSiegel={bogenSiegel}
      frage={frage}
      anklage={verhandlung.anklage}
      richter={richter}
      angeklagter={bank}
      detektiv={besetzung.find((c) => c.istDetektiv)}
      tasche={tasche}
      kulisse={kulisse}
      kopf={kopf}
      onUrteil={(geschafft) => void urteilHolen(geschafft)}
    />
  );
}
