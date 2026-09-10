"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bild } from "@/components/Bild";
import { alsStaedte, parseCharacterCsv, parseLocationCsv, pruefeBesetzung } from "@/lib/csv";
import {
  ORDNER_ZU_ART,
  freieBilder,
  nameAusPfad,
  ordnerVon,
} from "@/lib/freieBilder";
import { BildFeld } from "./BildFeld";
import { StadtErfinden } from "./StadtErfinden";
import {
  ladeZubehoer,
  loesche,
  speichereCharakter,
  speichereItem,
  speichereListe,
  speichereOrt,
} from "@/lib/db";
import { erfindeDing } from "@/lib/erfinden";
import { stammdatenAktualisieren, useStammdaten } from "@/lib/stammdaten";
import { LEERE_BEZIEHUNGEN } from "@/lib/types";
import { vervollstaendigen } from "@/lib/stammdatenIds";
import type { Beziehungen, Character, Item, Location } from "@/lib/types";
import { AUFTRITTS_ARTEN } from "@/lib/sagaTypen";
import { SongFeld } from "./SongFeld";
import type { BereichProps } from "./typen";

type Art = "charaktere" | "orte" | "items";

const TITEL: Record<Art, string> = {
  charaktere: "Tiere",
  orte: "Schauplätze",
  items: "Dinge",
};

/** Verwaltet eine Stammdaten-Sammlung in der Datenbank. */
export function StammdatenBereich({
  art,
  onMeldung,
  onFehler,
}: BereichProps & { art: Art }) {
  const stammdaten = useStammdaten();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  /**
   * Ein Bild aus /public, zu dem gerade ein Eintrag entsteht. Steht hier ein
   * Pfad, öffnet sich das Formular mit diesem Bild und einem Namensvorschlag.
   */
  const [ausBild, setAusBild] = useState<string | null>(null);
  /**
   * Eine andere Fassung eines vorhandenen Eintrags - etwa die Dämonenform
   * eines Tiers. Das Original steht hier nur Modell: Gespeichert wird ein
   * neuer Eintrag unter einer neuen Id, angefasst wird das alte nie.
   */
  const [version, setVersion] = useState<(Character | Location | Item) | null>(null);
  /**
   * Ein frisch erfundener Vorschlag, der noch niemandem gehört.
   *
   * Er öffnet das gewöhnliche Formular - mit Namen und Beschreibung schon
   * ausgefüllt. Gespeichert wird erst, wenn dort auf Speichern getippt wird;
   * bis dahin lässt sich alles ändern und ein Bild dazu erzeugen.
   */
  const [erfunden, setErfunden] = useState<Item | null>(null);
  /** Läuft gerade ein Erfinden-Aufruf? */
  const [erfindet, setErfindet] = useState(false);
  /** Der Bildschirm für eine ganze Stadt. */
  const [stadtOffen, setStadtOffen] = useState(false);
  /** Bilder, die schon im Laden hängen - sie sind nicht frei. */
  const [ladenBilder, setLadenBilder] = useState<string[]>([]);
  const [alleZeigen, setAlleZeigen] = useState(false);

  const eintraege: (Character | Location | Item)[] =
    art === "charaktere"
      ? stammdaten.charaktere
      : art === "orte"
        ? stammdaten.orte
        : stammdaten.items;

  const ausDerDatenbank = stammdaten.quelle[art] === "datenbank";

  // Auch der Laden belegt Bilder. Klappt das Laden nicht, gilt eben nur, was
  // in den Stammdaten steht - dann steht ein Bild zu viel in der Liste, was
  // niemandem wehtut.
  useEffect(() => {
    let sichtbar = true;
    void ladeZubehoer()
      .then(({ daten }) => {
        if (sichtbar) setLadenBilder(daten.map((z) => z.bild));
      })
      .catch(() => {});
    return () => {
      sichtbar = false;
    };
  }, []);

  /**
   * Bilder aus /public, an denen nichts hängt.
   *
   * Zuerst die aus dem Ordner, der zu dieser Ansicht gehört - auf der Seite
   * "Tiere" also die aus /public/charaktere. Der Rest steht dahinter, denn
   * ein Bild kann auch im falschen Ordner gelandet sein.
   */
  const freie = useMemo(() => {
    const belegt = [
      ...stammdaten.charaktere.map((c) => c.bild),
      ...stammdaten.orte.map((o) => o.bild),
      ...stammdaten.items.map((i) => i.bild),
      ...ladenBilder,
    ];
    const offen = freieBilder(belegt);
    const passend = offen.filter((p) => ORDNER_ZU_ART[ordnerVon(p)] === art);
    const andere = offen.filter((p) => ORDNER_ZU_ART[ordnerVon(p)] !== art);
    return { passend, andere };
  }, [stammdaten.charaktere, stammdaten.orte, stammdaten.items, ladenBilder, art]);

  const mitFehler = async (arbeit: () => Promise<void>, erfolg: string) => {
    setBeschaeftigt(true);
    onFehler(null);
    try {
      await arbeit();
      await stammdatenAktualisieren();
      onMeldung(erfolg);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error
          ? `Speichern fehlgeschlagen: ${fehler.message}`
          : "Speichern fehlgeschlagen.",
      );
    } finally {
      setBeschaeftigt(false);
    }
  };

  /**
   * Ein Ding erfinden lassen.
   *
   * Der Vorschlag kostet einen Aufruf und landet direkt im Formular - nicht
   * in der Datenbank. Was schon da ist, geht mit: Sonst kämen dieselben drei
   * Taschenuhren immer wieder.
   */
  const dingErfinden = async () => {
    setErfindet(true);
    onFehler(null);
    try {
      const vorschlag = await erfindeDing(
        stammdaten.items.map((i) => i.name),
        "",
      );
      setNeu(false);
      setAusBild(null);
      setVersion(null);
      setBearbeitet(null);
      setErfunden({
        ...(leererEintrag("items") as Item),
        name: vorschlag.name,
        beschreibung: vorschlag.beschreibung,
      });
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Das hat nicht geklappt.");
    } finally {
      setErfindet(false);
    }
  };

  const uebernehmen = () =>
    mitFehler(
      () => speichereListe(art, eintraege as { id: string }[]),
      `${eintraege.length} Einträge in die Datenbank übernommen.`,
    );

  const csvEinlesen = async (datei: File) => {
    onFehler(null);
    try {
      const text = await datei.text();
      if (art === "charaktere") {
        const geparst = parseCharacterCsv(text);
        const problem = pruefeBesetzung(geparst);
        if (problem) return onFehler(problem);
        await mitFehler(
          () => speichereListe("charaktere", geparst),
          `${geparst.length} Tiere eingelesen und gespeichert.`,
        );
      } else if (art === "orte") {
        const geparst = parseLocationCsv(text);
        if (geparst.length === 0) return onFehler("Die Datei enthält keine Orte.");
        await mitFehler(
          () => speichereListe("orte", geparst),
          `${geparst.length} Orte in ${alsStaedte(geparst).length} Städten gespeichert.`,
        );
      }
    } catch {
      onFehler("Die Datei konnte nicht gelesen werden.");
    }
  };

  return (
    <>
      {stammdaten.fehler && <p className="hinweis warnung">{stammdaten.fehler}</p>}

      <p className="leise">
        {TITEL[art]} liegen in der Datenbank und gelten für alle Geräte.{" "}
        {ausDerDatenbank
          ? "Diese Liste kommt aus der Datenbank."
          : "Die Datenbank ist hier noch leer - es gelten die Listen aus dem Projekt."}
      </p>

      <div className="knopf-reihe">
        <button className="knopf aktion" onClick={() => setNeu(true)} disabled={beschaeftigt}>
          + Neu
        </button>
        {!ausDerDatenbank && (
          <button className="knopf" onClick={uebernehmen} disabled={beschaeftigt}>
            Projektdaten übernehmen
          </button>
        )}
        {/* Erfinden lassen statt selbst ausdenken. Kostet einen Aufruf und
            legt nichts an - der Vorschlag landet im Formular. */}
        {art === "items" && (
          <button
            className="knopf"
            onClick={() => void dingErfinden()}
            disabled={beschaeftigt || erfindet}
          >
            {erfindet ? "Wird erfunden …" : "✨ Ding erfinden"}
          </button>
        )}
        {art === "orte" && (
          <button
            className="knopf"
            onClick={() => {
              setNeu(false);
              setAusBild(null);
              setVersion(null);
              setBearbeitet(null);
              setStadtOffen(true);
            }}
            disabled={beschaeftigt || stadtOffen}
          >
            ✨ Stadt erfinden
          </button>
        )}
        {art !== "items" && (
          <button
            className="knopf"
            onClick={() => dateiRef.current?.click()}
            disabled={beschaeftigt}
          >
            CSV einlesen
          </button>
        )}
      </div>

      {stadtOffen && art === "orte" && (
        <StadtErfinden
          vorhandeneStaedte={[...new Set(stammdaten.orte.map((o) => o.stadt))]}
          onFertig={() => setStadtOffen(false)}
          onAbbrechen={() => setStadtOffen(false)}
          onMeldung={onMeldung}
          onFehler={onFehler}
        />
      )}

      <input
        ref={dateiRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) void csvEinlesen(datei);
          e.target.value = "";
        }}
      />

      {(neu || ausBild || version || erfunden) && (
        <Formular
          art={art}
          alleCharaktere={stammdaten.charaktere}
          // Kommt der Anstoß von einem Bild, steht es schon drin - samt einem
          // Namensvorschlag aus dem Dateinamen. Bei einer Version stehen alle
          // Angaben des Originals drin, aber ohne dessen Id und ohne dessen
          // Bild: Beides bekommt die neue Fassung für sich.
          eintrag={
            // Erfunden wird nur bei den Dingen - der Riegel steht hier, damit
            // ein Vorschlag nie in einem anderen Formular landet.
            erfunden && art === "items"
              ? erfunden
              : version
                ? { ...version, id: "", name: `${version.name} (Version)`, bild: "" }
                : ausBild
                  ? { ...leererEintrag(art), bild: ausBild, name: nameAusPfad(ausBild) }
                  : null
          }
          vorlage={
            version
              ? { quelle: version.bild, name: version.name, id: version.id }
              : undefined
          }
          onAbbrechen={() => {
            setNeu(false);
            setAusBild(null);
            setVersion(null);
            setErfunden(null);
          }}
          onSpeichern={async (eintrag) => {
            await mitFehler(() => speichern(art, eintrag), `${nameVon(eintrag)} angelegt.`);
            setNeu(false);
            setAusBild(null);
            setVersion(null);
            setErfunden(null);
          }}
        />
      )}

      <FreieBilder
        art={art}
        passend={freie.passend}
        andere={freie.andere}
        alleZeigen={alleZeigen}
        onAlleZeigen={() => setAlleZeigen((auf) => !auf)}
        onAnlegen={(pfad) => {
          setNeu(false);
          setBearbeitet(null);
          setAusBild(pfad);
        }}
      />

      <h2 className="abschnitt">
        {TITEL[art]} ({eintraege.length})
      </h2>

      <ul className="liste">
        {eintraege.map((eintrag) =>
          bearbeitet === eintrag.id ? (
            <li key={eintrag.id} className="listen-formular">
              <Formular
                art={art}
                alleCharaktere={stammdaten.charaktere}
                eintrag={eintrag}
                onAbbrechen={() => setBearbeitet(null)}
                onSpeichern={async (geaendert) => {
                  await mitFehler(
                    () => speichern(art, geaendert),
                    `${nameVon(geaendert)} gespeichert.`,
                  );
                  setBearbeitet(null);
                }}
              />
            </li>
          ) : (
            <li key={eintrag.id}>
              <div className="listen-bild">
                <Bild src={eintrag.bild} alt={eintrag.name} platzhalter={eintrag.name} />
              </div>
              <div className="listen-text">
                <strong>
                  {eintrag.name}{" "}
                  {"istDetektiv" in eintrag && eintrag.istDetektiv && (
                    <span className="marke">Detektiv</span>
                  )}
                </strong>
                <span className="leise">{zeile(eintrag)}</span>
                <span className="leise pfad">{eintrag.bild.split("/").pop()}</span>
              </div>
              <div className="listen-aktionen">
                <button className="knopf klein" onClick={() => setBearbeitet(eintrag.id)}>
                  Ändern
                </button>
                {/* Eine andere Fassung desselben Eintrags - das Original
                    bleibt dabei unangetastet. */}
                <button
                  className="knopf klein"
                  onClick={() => {
                    setNeu(false);
                    setBearbeitet(null);
                    setAusBild(null);
                    setVersion(eintrag);
                  }}
                >
                  Version
                </button>
                {ausDerDatenbank && (
                  <button
                    className="knopf klein"
                    onClick={() => {
                      if (!window.confirm(`${eintrag.name} wirklich löschen?`)) return;
                      void mitFehler(
                        () => loesche(art, eintrag.id),
                        `${eintrag.name} gelöscht.`,
                      );
                    }}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ */

const ART_WORT: Record<Art, string> = {
  charaktere: "Tier",
  orte: "Schauplatz",
  items: "Ding",
};

/**
 * Bilder aus /public, an denen noch nichts hängt.
 *
 * Wer ein Bild in den Ordner legt und einträgt, sieht es hier - ein Tipp, und
 * das Formular steht offen, Bild und Namensvorschlag schon eingetragen. Die
 * Liste kommt aus lib/bilder.generated.ts und wird bei jedem Build neu
 * geschrieben; ein frisch hochgeladenes Bild taucht also nach dem nächsten
 * Deploy auf.
 */
function FreieBilder({
  art,
  passend,
  andere,
  alleZeigen,
  onAlleZeigen,
  onAnlegen,
}: {
  art: Art;
  /** Bilder aus dem Ordner, der zu dieser Ansicht gehört. */
  passend: string[];
  /** Alles Übrige - ein Bild kann auch im falschen Ordner liegen. */
  andere: string[];
  alleZeigen: boolean;
  onAlleZeigen: () => void;
  onAnlegen: (pfad: string) => void;
}) {
  if (passend.length === 0 && andere.length === 0) return null;
  const gezeigt = alleZeigen ? [...passend, ...andere] : passend;

  return (
    <>
      <h2 className="abschnitt">
        Bilder ohne Eintrag ({passend.length}
        {andere.length > 0 ? ` + ${andere.length} aus anderen Ordnern` : ""})
      </h2>
      <p className="leise klein">
        Diese Dateien liegen in /public, gehören aber zu keinem Tier, keinem
        Schauplatz, keinem Ding und zu nichts im Laden. Ein Tipp auf „Anlegen“
        öffnet das Formular mit diesem Bild.
      </p>

      {passend.length === 0 && !alleZeigen && (
        <p className="leise">
          Im passenden Ordner ist alles zugeordnet.{" "}
          {andere.length > 0 && "Aus anderen Ordnern liegt aber noch etwas herum."}
        </p>
      )}

      <div className="bild-gitter">
        {gezeigt.map((pfad) => {
          const ordner = ordnerVon(pfad);
          return (
            <div key={pfad} className="bild-kachel">
              <div className="bild-kachel-bild">
                <Bild src={pfad} alt={pfad} platzhalter={nameAusPfad(pfad)} />
              </div>
              {/* Der Dateiname trägt die Information - der ganze Pfad würde
                  abgeschnitten und stünde dann nutzlos da. */}
              <span className="leise pfad" title={pfad}>
                {pfad.split("/").pop()}
              </span>
              {ORDNER_ZU_ART[ordner] !== art && <span className="marke">{ordner}</span>}
              <button className="knopf klein aktion" onClick={() => onAnlegen(pfad)}>
                Als {ART_WORT[art]} anlegen
              </button>
            </div>
          );
        })}
      </div>

      {andere.length > 0 && (
        <div className="knopf-reihe">
          <button className="knopf klein" onClick={onAlleZeigen}>
            {alleZeigen
              ? "Nur den passenden Ordner zeigen"
              : `Auch die ${andere.length} aus anderen Ordnern zeigen`}
          </button>
        </div>
      )}
    </>
  );
}

const nameVon = (eintrag: { name: string }) => eintrag.name;

const zeile = (eintrag: Character | Location | Item) => {
  if ("tierart" in eintrag) return `${eintrag.tierart}, ${eintrag.alter} J.`;
  if ("stadt" in eintrag) return `${eintrag.stadt} · ${eintrag.atmosphaere}`;
  return eintrag.beschreibung;
};

const speichern = (art: Art, eintrag: Character | Location | Item) => {
  if (art === "charaktere") return speichereCharakter(eintrag as Character);
  if (art === "orte") return speichereOrt(eintrag as Location);
  return speichereItem(eintrag as Item);
};

const STAT_FELDER: { key: keyof Character["stats"]; label: string }[] = [
  { key: "charisma", label: "Charisma" },
  { key: "freundlichkeit", label: "Freundlichkeit" },
  { key: "fitness", label: "Fitness" },
  { key: "zauberkraft", label: "Zauberkraft" },
  { key: "schelmischkeit", label: "Schelmischkeit" },
  { key: "kriminalitaetslevel", label: "Kriminalität" },
  { key: "intelligenz", label: "Intelligenz" },
];

const leererEintrag = (art: Art): Character | Location | Item => {
  if (art === "charaktere")
    return {
      id: "",
      nummer: 0,
      name: "",
      tierart: "",
      alter: 1,
      stats: {
        charisma: 5,
        freundlichkeit: 5,
        fitness: 5,
        zauberkraft: 0,
        schelmischkeit: 5,
        kriminalitaetslevel: 3,
        intelligenz: 5,
      },
      beschreibung: "",
      bild: "",
      istDetektiv: false,
    } satisfies Character;

  if (art === "orte")
    return {
      id: "",
      stadt: "",
      stadtId: "",
      name: "",
      atmosphaere: "",
      beschreibung: "",
      bild: "",
    } satisfies Location;

  return { id: "", name: "", beschreibung: "", bild: "" } satisfies Item;
};

/**
 * Woraus eine andere Fassung entsteht - das Original.
 *
 * Die Id steht dabei, weil sie das eine ist, was die neue Fassung NICHT
 * übernehmen darf: Sonst überschriebe die Dämonenform das Tier, aus dem sie
 * hervorgegangen ist.
 */
export type Vorlage = { quelle: string; name: string; id: string };

/** Ein Formular je Art - so bleiben die Felder typsicher. */
function Formular({
  art,
  alleCharaktere,
  eintrag,
  vorlage,
  onSpeichern,
  onAbbrechen,
}: {
  art: Art;
  /** Für die Beziehungen: alle Tiere, die zur Auswahl stehen. */
  alleCharaktere: Character[];
  eintrag: Character | Location | Item | null;
  vorlage?: Vorlage;
  onSpeichern: (eintrag: Character | Location | Item) => void;
  onAbbrechen: () => void;
}) {
  if (art === "charaktere") {
    return (
      <CharakterFormular
        alle={alleCharaktere}
        eintrag={(eintrag as Character) ?? (leererEintrag("charaktere") as Character)}
        vorlage={vorlage}
        onSpeichern={onSpeichern}
        onAbbrechen={onAbbrechen}
      />
    );
  }
  if (art === "orte") {
    return (
      <OrtFormular
        eintrag={(eintrag as Location) ?? (leererEintrag("orte") as Location)}
        vorlage={vorlage}
        onSpeichern={onSpeichern}
        onAbbrechen={onAbbrechen}
      />
    );
  }
  return (
    <ItemFormular
      eintrag={(eintrag as Item) ?? (leererEintrag("items") as Item)}
      vorlage={vorlage}
      onSpeichern={onSpeichern}
      onAbbrechen={onAbbrechen}
    />
  );
}

function Rahmen({
  kannSpeichern,
  onAbsenden,
  onAbbrechen,
  warnung,
  children,
}: {
  kannSpeichern: boolean;
  onAbsenden: () => void;
  onAbbrechen: () => void;
  /** Steht über den Knöpfen - etwa, wenn eine Version das Original träfe. */
  warnung?: string | null;
  children: React.ReactNode;
}) {
  return (
    <form
      className="formular"
      onSubmit={(e) => {
        e.preventDefault();
        if (kannSpeichern) onAbsenden();
      }}
    >
      {children}
      {warnung && <p className="hinweis warnung">{warnung}</p>}
      <div className="knopf-reihe">
        <button type="submit" className="knopf aktion" disabled={!kannSpeichern}>
          Speichern
        </button>
        <button type="button" className="knopf" onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

const BEZIEHUNGS_FELDER: {
  key: keyof Beziehungen;
  label: string;
  hinweis: string;
}[] = [
  { key: "besteFreunde", label: "Beste Freunde", hinweis: "werden gedeckt" },
  { key: "freunde", label: "Freunde", hinweis: "werden in Schutz genommen" },
  { key: "feinde", label: "Feinde", hinweis: "bekommen Spitzen ab" },
  { key: "erzfeinde", label: "Erzfeinde", hinweis: "werden angeschwärzt" },
];

function CharakterFormular({
  eintrag,
  alle,
  vorlage,
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Character;
  alle: Character[];
  /** Beim Anlegen einer Version: das Original, aus dem sie hervorgeht. */
  vorlage?: Vorlage;
  onSpeichern: (eintrag: Character) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Character>(eintrag);
  // Eine Version darf ihrem Original nie den Platz nehmen.
  const trifftOriginal = ueberschreibtOriginal("charaktere", entwurf, vorlage);
  const aendern = (teil: Partial<Character>) =>
    setEntwurf((alt) => ({ ...alt, ...teil }));

  const beziehungen: Beziehungen = entwurf.beziehungen ?? LEERE_BEZIEHUNGEN;

  /** Ein Tier in einer der vier Listen an- oder abwählen - immer nur in einer. */
  const beziehungUmschalten = (feld: keyof Beziehungen, id: string) => {
    const drin = beziehungen[feld].includes(id);
    const bereinigt = Object.fromEntries(
      (Object.keys(LEERE_BEZIEHUNGEN) as (keyof Beziehungen)[]).map((k) => [
        k,
        beziehungen[k].filter((x) => x !== id),
      ]),
    ) as Beziehungen;
    aendern({
      beziehungen: drin
        ? bereinigt
        : { ...bereinigt, [feld]: [...bereinigt[feld], id] },
    });
  };

  return (
    <Rahmen
      kannSpeichern={entwurf.name.trim().length > 0 && !trifftOriginal}
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("charaktere", entwurf) as Character)}
      warnung={
        trifftOriginal
          ? `Diese Version würde „${vorlage?.name}“ überschreiben. Bitte gib ihr einen eigenen Namen - das Original soll ja bleiben.`
          : null
      }
    >
      <label className="feld">
        <span className="leise">Name</span>
        <input value={entwurf.name} onChange={(e) => aendern({ name: e.target.value })} />
      </label>

      <div className="feld-reihe">
        <label className="feld">
          <span className="leise">Tierart</span>
          <input
            value={entwurf.tierart}
            onChange={(e) => aendern({ tierart: e.target.value })}
          />
        </label>
        <label className="feld schmal">
          <span className="leise">Alter</span>
          <input
            type="number"
            min={0}
            max={200}
            value={entwurf.alter}
            onChange={(e) => aendern({ alter: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="stat-felder">
        {STAT_FELDER.map((feld) => (
          <label key={feld.key} className="stat-feld">
            <span className="leise">{feld.label}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={entwurf.stats[feld.key]}
              onChange={(e) =>
                aendern({
                  stats: { ...entwurf.stats, [feld.key]: Number(e.target.value) },
                })
              }
            />
            <strong>{entwurf.stats[feld.key]}</strong>
          </label>
        ))}
      </div>

      <label className="schalter">
        <input
          type="checkbox"
          checked={entwurf.istDetektiv}
          onChange={(e) => aendern({ istDetektiv: e.target.checked })}
        />
        <span>Ist der Detektiv (die Spielfigur)</span>
      </label>

      <label className="feld">
        <span className="leise">Beschreibung</span>
        <textarea
          rows={3}
          value={entwurf.beschreibung}
          onChange={(e) => aendern({ beschreibung: e.target.value })}
        />
      </label>

      <label className="feld">
        <span className="leise">Beruf · färbt Alibis, Spuren und Gesprächsthemen</span>
        <input
          value={entwurf.beruf ?? ""}
          onChange={(e) => aendern({ beruf: e.target.value })}
          placeholder="z.B. Bäckerin, Nachtwächter am Hafen, Opernsouffleuse"
          maxLength={200}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Kommunikationsstil · wird im Gespräch wörtlich befolgt
        </span>
        <textarea
          rows={3}
          value={entwurf.sprachstil ?? ""}
          onChange={(e) => aendern({ sprachstil: e.target.value })}
          placeholder="z.B. Spricht in ganz kurzen Sätzen, nennt Wimpy immer „Chef“ und fängt jede Antwort mit einem Seufzer an."
          maxLength={800}
        />
      </label>

      <h4 className="unter-abschnitt">
        Auftritt <span className="leise">· wenn dieses Tier später dazustößt</span>
      </h4>
      <p className="leise klein">
        Das ist die Voreinstellung dieses Tieres: Sie gilt in jeder Saga, in der
        es später auftaucht - und lässt sich dort trotzdem für den Einzelfall
        anders einstellen.
      </p>

      <SongFeld
        wert={entwurf.auftrittTon ?? ""}
        beschriftung="Sein Song"
        leerText="Ohne eigenen Song · nimmt den der Saga"
        onAendern={(auftrittTon) => aendern({ auftrittTon })}
      />

      <label className="feld">
        <span className="leise">Seine Animation</span>
        <select
          value={entwurf.auftrittArt ?? ""}
          onChange={(e) => aendern({ auftrittArt: e.target.value })}
        >
          <option value="">Ohne eigene Art · nimmt die der Saga</option>
          {AUFTRITTS_ARTEN.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} · {a.hinweis}
            </option>
          ))}
        </select>
      </label>

      <h4 className="unter-abschnitt">
        Beziehungen <span className="leise">· wirken sich im Spiel aus</span>
      </h4>
      {BEZIEHUNGS_FELDER.map((feld) => (
        <div key={feld.key} className="beziehungs-feld">
          <span className="leise klein">
            {feld.label} · {feld.hinweis}
          </span>
          <div className="marken-reihe">
            {alle
              .filter((c) => c.id !== entwurf.id)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="marke-knopf"
                  data-aktiv={beziehungen[feld.key].includes(c.id)}
                  onClick={() => beziehungUmschalten(feld.key, c.id)}
                >
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      ))}

      <BildFeld
        wert={entwurf.bild}
        vorschlag={`/charaktere/${entwurf.id || "name"}.png`}
        onAendern={(bild) => aendern({ bild })}
        art="charaktere"
        eintrag={{
          name: entwurf.name,
          tierart: entwurf.tierart,
          alter: entwurf.alter,
          beruf: entwurf.beruf,
          beschreibung: entwurf.beschreibung,
        }}
        vorlage={vorlage}
      />
    </Rahmen>
  );
}

function OrtFormular({
  eintrag,
  vorlage,
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Location;
  /** Beim Anlegen einer Version: das Original, aus dem sie hervorgeht. */
  vorlage?: Vorlage;
  onSpeichern: (eintrag: Location) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Location>(eintrag);
  // Eine Version darf ihrem Original nie den Platz nehmen.
  const trifftOriginal = ueberschreibtOriginal("orte", entwurf, vorlage);
  const aendern = (teil: Partial<Location>) =>
    setEntwurf((alt) => ({ ...alt, ...teil }));

  return (
    <Rahmen
      kannSpeichern={
        entwurf.name.trim().length > 0 &&
        entwurf.stadt.trim().length > 0 &&
        !trifftOriginal
      }
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("orte", entwurf) as Location)}
      warnung={
        trifftOriginal
          ? `Diese Version würde „${vorlage?.name}“ überschreiben. Bitte gib ihr einen eigenen Namen - das Original soll ja bleiben.`
          : null
      }
    >
      <div className="feld-reihe">
        <label className="feld">
          <span className="leise">Stadt</span>
          <input
            value={entwurf.stadt}
            onChange={(e) => aendern({ stadt: e.target.value })}
          />
        </label>
        <label className="feld">
          <span className="leise">Ort</span>
          <input value={entwurf.name} onChange={(e) => aendern({ name: e.target.value })} />
        </label>
      </div>

      <label className="feld">
        <span className="leise">Atmosphäre</span>
        <input
          value={entwurf.atmosphaere}
          placeholder="z.B. dunkel und legendär"
          onChange={(e) => aendern({ atmosphaere: e.target.value })}
        />
      </label>

      <label className="feld">
        <span className="leise">Beschreibung (leer = aus der Atmosphäre)</span>
        <textarea
          rows={2}
          value={entwurf.beschreibung}
          onChange={(e) => aendern({ beschreibung: e.target.value })}
        />
      </label>

      <BildFeld
        wert={entwurf.bild}
        vorschlag={`/orte/${entwurf.id || "stadt-ort"}.png`}
        onAendern={(bild) => aendern({ bild })}
        art="orte"
        eintrag={{
          name: entwurf.name,
          stadt: entwurf.stadt,
          atmosphaere: entwurf.atmosphaere,
          beschreibung: entwurf.beschreibung,
        }}
        vorlage={vorlage}
      />
    </Rahmen>
  );
}

function ItemFormular({
  eintrag,
  vorlage,
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Item;
  /** Beim Anlegen einer Version: das Original, aus dem sie hervorgeht. */
  vorlage?: Vorlage;
  onSpeichern: (eintrag: Item) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Item>(eintrag);
  // Eine Version darf ihrem Original nie den Platz nehmen.
  const trifftOriginal = ueberschreibtOriginal("items", entwurf, vorlage);
  const aendern = (teil: Partial<Item>) => setEntwurf((alt) => ({ ...alt, ...teil }));

  return (
    <Rahmen
      kannSpeichern={entwurf.name.trim().length > 0 && !trifftOriginal}
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("items", entwurf) as Item)}
      warnung={
        trifftOriginal
          ? `Diese Version würde „${vorlage?.name}“ überschreiben. Bitte gib ihr einen eigenen Namen - das Original soll ja bleiben.`
          : null
      }
    >
      <label className="feld">
        <span className="leise">Name</span>
        <input value={entwurf.name} onChange={(e) => aendern({ name: e.target.value })} />
      </label>

      <label className="feld">
        <span className="leise">Beschreibung</span>
        <textarea
          rows={2}
          value={entwurf.beschreibung}
          onChange={(e) => aendern({ beschreibung: e.target.value })}
        />
      </label>

      <BildFeld
        wert={entwurf.bild}
        vorschlag={`/items/${entwurf.id || "name"}.png`}
        onAendern={(bild) => aendern({ bild })}
        art="items"
        eintrag={{ name: entwurf.name, beschreibung: entwurf.beschreibung }}
        vorlage={vorlage}
      />
    </Rahmen>
  );
}

/**
 * Würde diese Version ihr Original überschreiben?
 *
 * Die Id entsteht aus dem Namen. Bleibt der Name gleich, entstünde dieselbe
 * Id - und der Dämon nähme dem Tier seinen Platz in der Datenbank. Das ist
 * genau das, was nie passieren darf, deshalb wird hier gebremst.
 */
export const ueberschreibtOriginal = (
  art: Art,
  entwurf: Character | Location | Item,
  vorlage?: { id: string },
): boolean =>
  // Gerechnet wird mit derselben Funktion, die auch beim Speichern die Id
  // vergibt - alles andere wäre eine zweite Wahrheit.
  Boolean(vorlage && vervollstaendigen(art, entwurf).id === vorlage.id);
