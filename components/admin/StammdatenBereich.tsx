"use client";

import { useRef, useState } from "react";
import { Bild } from "@/components/Bild";
import { alsStaedte, parseCharacterCsv, parseLocationCsv, pruefeBesetzung } from "@/lib/csv";
import {
  loesche,
  speichereCharakter,
  speichereItem,
  speichereListe,
  speichereOrt,
} from "@/lib/db";
import { stammdatenAktualisieren, useStammdaten } from "@/lib/stammdaten";
import { LEERE_BEZIEHUNGEN } from "@/lib/types";
import type { Beziehungen, Character, Item, Location } from "@/lib/types";
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

  const eintraege: (Character | Location | Item)[] =
    art === "charaktere"
      ? stammdaten.charaktere
      : art === "orte"
        ? stammdaten.orte
        : stammdaten.items;

  const ausDerDatenbank = stammdaten.quelle[art] === "datenbank";

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

      {neu && (
        <Formular
          art={art}
          alleCharaktere={stammdaten.charaktere}
          eintrag={null}
          onAbbrechen={() => setNeu(false)}
          onSpeichern={async (eintrag) => {
            await mitFehler(() => speichern(art, eintrag), `${nameVon(eintrag)} angelegt.`);
            setNeu(false);
          }}
        />
      )}

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

/** Ein Formular je Art - so bleiben die Felder typsicher. */
function Formular({
  art,
  alleCharaktere,
  eintrag,
  onSpeichern,
  onAbbrechen,
}: {
  art: Art;
  /** Für die Beziehungen: alle Tiere, die zur Auswahl stehen. */
  alleCharaktere: Character[];
  eintrag: Character | Location | Item | null;
  onSpeichern: (eintrag: Character | Location | Item) => void;
  onAbbrechen: () => void;
}) {
  if (art === "charaktere") {
    return (
      <CharakterFormular
        alle={alleCharaktere}
        eintrag={(eintrag as Character) ?? (leererEintrag("charaktere") as Character)}
        onSpeichern={onSpeichern}
        onAbbrechen={onAbbrechen}
      />
    );
  }
  if (art === "orte") {
    return (
      <OrtFormular
        eintrag={(eintrag as Location) ?? (leererEintrag("orte") as Location)}
        onSpeichern={onSpeichern}
        onAbbrechen={onAbbrechen}
      />
    );
  }
  return (
    <ItemFormular
      eintrag={(eintrag as Item) ?? (leererEintrag("items") as Item)}
      onSpeichern={onSpeichern}
      onAbbrechen={onAbbrechen}
    />
  );
}

function Rahmen({
  kannSpeichern,
  onAbsenden,
  onAbbrechen,
  children,
}: {
  kannSpeichern: boolean;
  onAbsenden: () => void;
  onAbbrechen: () => void;
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

function BildFeld({
  wert,
  vorschlag,
  onAendern,
}: {
  wert: string;
  vorschlag: string;
  onAendern: (wert: string) => void;
}) {
  return (
    <label className="feld">
      <span className="leise">Bildpfad (leer = automatisch)</span>
      <input
        value={wert}
        placeholder={vorschlag}
        onChange={(e) => onAendern(e.target.value)}
      />
    </label>
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
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Character;
  alle: Character[];
  onSpeichern: (eintrag: Character) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Character>(eintrag);
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
      kannSpeichern={entwurf.name.trim().length > 0}
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("charaktere", entwurf) as Character)}
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
      />
    </Rahmen>
  );
}

function OrtFormular({
  eintrag,
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Location;
  onSpeichern: (eintrag: Location) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Location>(eintrag);
  const aendern = (teil: Partial<Location>) =>
    setEntwurf((alt) => ({ ...alt, ...teil }));

  return (
    <Rahmen
      kannSpeichern={entwurf.name.trim().length > 0 && entwurf.stadt.trim().length > 0}
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("orte", entwurf) as Location)}
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
      />
    </Rahmen>
  );
}

function ItemFormular({
  eintrag,
  onSpeichern,
  onAbbrechen,
}: {
  eintrag: Item;
  onSpeichern: (eintrag: Item) => void;
  onAbbrechen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Item>(eintrag);
  const aendern = (teil: Partial<Item>) => setEntwurf((alt) => ({ ...alt, ...teil }));

  return (
    <Rahmen
      kannSpeichern={entwurf.name.trim().length > 0}
      onAbbrechen={onAbbrechen}
      onAbsenden={() => onSpeichern(vervollstaendigen("items", entwurf) as Item)}
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
      />
    </Rahmen>
  );
}

/** Ergänzt Id, Bildpfad und abgeleitete Felder. */
function vervollstaendigen(
  art: Art,
  entwurf: Character | Location | Item,
): Character | Location | Item {
  const slug = (wert: string) =>
    wert
      .toLowerCase()
      .replaceAll("ä", "ae")
      .replaceAll("ö", "oe")
      .replaceAll("ü", "ue")
      .replaceAll("ß", "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (art === "orte") {
    const ort = entwurf as Location;
    const stadtId = slug(ort.stadt);
    const id = ort.id || `${stadtId}-${slug(ort.name)}`;
    return {
      ...ort,
      id,
      stadtId,
      bild: ort.bild || `/orte/${id}.png`,
      beschreibung:
        ort.beschreibung ||
        (ort.atmosphaere ? `${ort.name} - ${ort.atmosphaere}.` : ort.name),
    };
  }

  const id = entwurf.id || slug(entwurf.name);
  const ordner = art === "charaktere" ? "charaktere" : "items";
  return { ...entwurf, id, bild: entwurf.bild || `/${ordner}/${id}.png` };
}
