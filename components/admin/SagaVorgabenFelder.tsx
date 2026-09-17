"use client";

import { useState } from "react";
import { useAutos } from '@/lib/useAutos';
import dynamic from "next/dynamic";
import { alsStaedte } from "@/lib/csv";
import { useGeschenke } from "@/lib/useLaden";
import { SongWahl } from "./SongFeld";
import { JagdWeltFeld } from "./JagdWeltFeld";
import { KampfFeld } from "./KampfFeld";
import { StadtplanFeld } from "./StadtplanFeld";
import { StadtWahl } from "./StadtWahl";
import { yen } from "@/lib/zubehoer";
import {
  AUFTRITTS_ARTEN,
  artFuerAuftritt,
  auftrittVon,
  besessen,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import { sichere3DTiere } from "@/lib/saga3dSync";
import { WETTERLAGEN, type Wetterlage } from "@/lib/types";
import { STANDARD_KAMPF } from "@/lib/endkampf";
import { FINALE_ARTEN, mitAnklage, mitKampf, type FinaleArt } from "@/lib/sagaFinale";
import type { VersammlungVorgabe } from "@/lib/versammlung";
import type { VerfolgungVorgabe } from "@/lib/verfolgung";
import { TonFeld } from "./TonFeld";
import { VideoFeld } from "./VideoFeld";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import {
  DREI_D_LOCATIONS,
  DREI_D_STRASSENTYPEN,
  DREI_D_TAGESZEITEN,
  DREI_D_WETTER,
  STANDARD_KAPITEL_3D,
} from "@/lib/pursuit3d";

const Verfolgungsjagd = dynamic(
  () => import("../Verfolgungsjagd").then((modul) => modul.Verfolgungsjagd),
  { ssr: false },
);

/**
 * Alle Vorgaben einer Saga an einem Ort.
 *
 * Dieselben Felder braucht man an zwei Stellen: beim Anlegen einer einzelnen
 * Saga und beim Erzeugen einer Saga für eine Arc-Station. Zwei Kopien wären
 * zwei Baustellen - deshalb liegen sie hier.
 *
 * `vomArc` markiert die Felder, die eine übergeordnete Reihe schon gesetzt
 * hat. Sie bleiben bearbeitbar (wer es besser weiß, darf), zeigen aber an,
 * woher ihr Wert kommt.
 */
const SCHWIERIGKEITEN: { id: SagaVorgaben["schwierigkeit"]; label: string }[] = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "knifflig", label: "Knifflig" },
];

const REIFEGRADE: { id: SagaVorgaben["reifegrad"]; label: string; hinweis: string }[] = [
  { id: "kindgerecht", label: "Kindgerecht", hinweis: "Streiche, Diebstähle" },
  { id: "jugendlich", label: "Jugendlich", hinweis: "Drohungen, Rauferei" },
  { id: "erwachsen", label: "Erwachsen", hinweis: "Gewalt, Tote nur Menschen" },
];

const ABSURDITAETEN: { id: SagaVorgaben["absurditaet"]; label: string; hinweis: string }[] = [
  { id: "bodenstaendig", label: "Bodenständig", hinweis: "könnte so passiert sein" },
  { id: "verspielt", label: "Verspielt", hinweis: "schrullig, leicht überzogen" },
  { id: "absurd", label: "Absurd", hinweis: "Logik wie im Traum" },
];

const TOENE: { id: SagaVorgaben["ton"]; label: string }[] = [
  { id: "kindgerecht", label: "Warmherzig" },
  { id: "spannend", label: "Spannend" },
  { id: "albern", label: "Albern" },
];

export function SagaVorgabenFelder({
  vorgaben,
  onAendern,
  vomArc,
}: {
  vorgaben: SagaVorgaben;
  onAendern: (teil: Partial<SagaVorgaben>) => void;
  /** Hinweis je Feld, das der Arc vorgibt - z.B. { thema: "Kommt aus dem Arc" }. */
  vomArc?: Partial<Record<keyof SagaVorgaben, string>>;
}) {
  const [jagdVorschau, setJagdVorschau] = useState<VerfolgungVorgabe | null>(null);
  const { autos } = useAutos();
  const stammdaten = useStammdaten();
  const staedte = alsStaedte(stammdaten.orte);
  const verdaechtige = stammdaten.charaktere.filter(
    (c) => !c.istDetektiv && !c.istDaemon,
  );
  /**
   * Die Dämonenformen - sie spielen nicht mit, sondern brechen aus jemandem
   * heraus. Deshalb stehen sie nur dort zur Wahl, wo eine Verwandlung
   * gemeint ist, und nicht in der Besetzung.
   */
  const gestalten = stammdaten.charaktere.filter((c) => c.istDaemon && !c.istDetektiv);
  /**
   * Alle, die als Schuldige infrage kommen - auch die Gestalten.
   *
   * Beim Gerichtsfinale mit Dämon ist die Gestalt selbst der Drahtzieher,
   * und im Feld "Dämonenform" ist sie ohnehin gemeint. Nur in der Besetzung,
   * beim Wirt und bei der falschen Fährte hat sie nichts verloren.
   */
  const mitGestalten = [...verdaechtige, ...gestalten];
  // Nur wer in dieser Saga vorkommt - leere Auswahl heißt: alle.
  const mitspieler =
    vorgaben.charaktere.length >= 2
      ? verdaechtige.filter((c) => vorgaben.charaktere.includes(c.id))
      : verdaechtige;
  const kapitelNummern = Array.from({ length: vorgaben.kapitelAnzahl }, (_, i) => i);
  /** Wer nicht von Anfang an dabei ist - nur die bekommen einen Auftritt. */
  const spaeteMitspieler = mitspieler.filter(
    (c) =>
      auftrittVon({
        charakterId: c.id,
        vorgaben,
        drahtzieherId: vorgaben.drahtzieherId,
      }) > 1,
  );

  const setzen = (teil: Partial<SagaVorgaben>) => onAendern(teil);

  const setzeBesessenheit = (teil: Partial<SagaVorgaben["besessenheit"]>) =>
    onAendern({
      besessenheit: {
        ...(vorgaben.besessenheit ?? { wirtId: "", daemonId: "", ton: "" }),
        ...teil,
      },
    });

  const detektivId = stammdaten.charaktere.find((c) => c.istDetektiv)?.id ?? "";
  const art: FinaleArt = vorgaben.finaleArt ?? "klassisch";

  /**
   * Die Art des Finales umstellen.
   *
   * "Wimpy selbst" ist zugleich eine Besessenheit - der Wirt ist der Detektiv.
   * Deshalb wird sie hier gleich mit eingerichtet und beim Wechsel auf eine
   * andere Art wieder abgeräumt; sonst bliebe eine halbe Besessenheit stehen,
   * von der niemand mehr weiß, woher sie kommt.
   */
  const finaleArtSetzen = (neu: FinaleArt) => {
    const ton = vorgaben.besessenheit?.ton ?? "";

    /*
     * Ein Gerichtsfinale und der Twist schließen einander aus: Vor Gericht
     * tritt der Drahtzieher von Anfang an auf und spielt mit Wimpy, der Twist
     * verlangt genau das Gegenteil. Statt es hinterher zu beanstanden, wird
     * der Twist hier gleich abgeschaltet - eine Arc-Station setzt ihn nämlich
     * von selbst, und dann stünde man vor einer Meldung, die man gar nicht
     * verursacht hat.
     */
    const ohneTwist = mitAnklage(neu) ? { twist: false } : {};

    if (neu === "wimpy" || neu === "gericht-wimpy") {
      onAendern({
        ...ohneTwist,
        finaleArt: neu,
        besessenheit: {
          wirtId: detektivId,
          daemonId: vorgaben.besessenheit?.daemonId ?? "",
          ton,
        },
      });
      return;
    }
    if (vorgaben.besessenheit?.wirtId === detektivId) {
      onAendern({
        ...ohneTwist,
        finaleArt: neu,
        besessenheit: { wirtId: "", daemonId: "", ton },
      });
      return;
    }
    onAendern({ ...ohneTwist, finaleArt: neu });
  };

  /** Vor Gericht gibt es keinen Twist - dann bleibt die Wahl auch gesperrt. */
  const twistGesperrt = mitAnklage(art);

  const namenVon = (id: string) =>
    stammdaten.charaktere.find((c) => c.id === id)?.name ?? id;

  const umschalten = (feld: "charaktere" | "items", id: string) =>
    onAendern({
      [feld]: vorgaben[feld].includes(id)
        ? vorgaben[feld].filter((x) => x !== id)
        : [...vorgaben[feld], id],
    });

  // Der Laden - für die Geschenke nach einem Kapitel. Verschenken lässt sich
  // beides, Zubehör und Autos. Ohne Verbindung bleibt es beim Grundregal und
  // den Standardwagen: Die Auswahl ist dann kürzer, aber nie leer, und
  // "kein Geschenk" steht ohnehin immer zur Wahl.
  const laden = useGeschenke();

  /**
   * Ein Eintrag in einer Liste je Kapitel - ohne Löcher davor.
   *
   * `liste[3] = x` auf einer kurzen Liste hinterlässt sonst leere Plätze, und
   * die werden auf dem Weg zum Server zu `null`. Daran scheiterte die Prüfung
   * der ganzen Vorgaben.
   */
  const anStelle = <T,>(liste: T[] | undefined, i: number, wert: T, leer: T): T[] => {
    const kopie = [...(liste ?? [])];
    while (kopie.length <= i) kopie.push(leer);
    kopie[i] = wert;
    return kopie;
  };

  /** Täter für Kapitel i (0-basiert) - leerer Wert heißt: freie Wahl. */
  const kapitelTaeterSetzen = (i: number, id: string) =>
    onAendern({ kapitelTaeter: anStelle(vorgaben.kapitelTaeter, i, id, "") });

  const wunschSetzen = (i: number, text: string) =>
    onAendern({ kapitelWuensche: anStelle(vorgaben.kapitelWuensche, i, text, "") });

  /** Stadt je Kapitel; der letzte Eintrag gehört zum Finale. */
  const stadtSetzen = (i: number, stadt: string) =>
    onAendern({ kapitelStaedte: anStelle(vorgaben.kapitelStaedte, i, stadt, "") });

  /** Video vor einem Kapitel; der letzte Eintrag gehört zum Finale. */
  const videoSetzen = (i: number, pfad: string) =>
    onAendern({ kapitelVideos: anStelle(vorgaben.kapitelVideos, i, pfad, "") });

  /** Hintergrundmusik je Kapitel; der letzte Eintrag gehört zum Finale. */
  const musikSetzen = (i: number, pfad: string) =>
    onAendern({ kapitelMusik: anStelle(vorgaben.kapitelMusik, i, pfad, "") });

  /** Geschenk nach einem Kapitel; der letzte Eintrag gehört zum Finale. */
  const geschenkSetzen = (i: number, id: string) =>
    onAendern({ kapitelGeschenke: anStelle(vorgaben.kapitelGeschenke, i, id, "") });

  /** Die Dämonenform, als die sich der Täter dieses Kapitels entpuppt. */
  const daemonSetzen = (i: number, id: string) =>
    onAendern({ kapitelDaemon: anStelle(vorgaben.kapitelDaemon, i, id, "") });

  /** Ein zweiter Täter für dieses Kapitel. */
  const mittaeterSetzen = (i: number, id: string) =>
    onAendern({ kapitelMittaeter: anStelle(vorgaben.kapitelMittaeter, i, id, "") });

  /** Wetter je Kapitel; der letzte Eintrag gehört zum Finale. */
  const wetterSetzen = (i: number, lage: Wetterlage | "") =>
    onAendern({
      kapitelWetter: anStelle<Wetterlage | "">(vorgaben.kapitelWetter, i, lage, ""),
    });

  const dreiDSetzen = (i: number, teil: Partial<SagaVorgaben["kapitel3d"][number]>) => {
    const bisher = vorgaben.kapitel3d?.[i] ?? STANDARD_KAPITEL_3D;
    onAendern({
      kapitel3d: anStelle(
        vorgaben.kapitel3d,
        i,
        { ...STANDARD_KAPITEL_3D, ...bisher, ...teil },
        { ...STANDARD_KAPITEL_3D, locations: [...STANDARD_KAPITEL_3D.locations] },
      ),
    });
  };

  const ratNach = (nachKapitel: number) =>
    (vorgaben.versammlungen ?? []).find((v) => v.nachKapitel === nachKapitel);

  const ratAendern = (nachKapitel: number, teil: Partial<VersammlungVorgabe>) =>
    onAendern({
      versammlungen: (vorgaben.versammlungen ?? []).map((v) =>
        v.nachKapitel === nachKapitel ? { ...v, ...teil } : v,
      ),
    });

  const ratUmschalten = (nachKapitel: number) => {
    const bisher = vorgaben.versammlungen ?? [];
    if (bisher.some((v) => v.nachKapitel === nachKapitel)) {
      onAendern({ versammlungen: bisher.filter((v) => v.nachKapitel !== nachKapitel) });
      return;
    }
    const start = mitspieler.slice(0, Math.min(4, mitspieler.length)).map((c) => c.id);
    const neu: VersammlungVorgabe = {
      id: `rat-nach-${nachKapitel}`,
      nachKapitel,
      name: `Der Rat nach Kapitel ${nachKapitel}`,
      anlass: "Die jüngsten Ereignisse verlangen eine gemeinsame Aussprache.",
      thema: vorgaben.kapitelWuensche?.[nachKapitel] || vorgaben.thema,
      vorsitzId: start[0] ?? "",
      teilnehmerIds: start,
      beobachterIds: [],
      undercoverId: "",
    };
    onAendern({
      versammlungen: [...bisher, neu].sort((a, b) => a.nachKapitel - b.nachKapitel),
      // In einer Lücke spielt genau ein großes Ereignis.
      verfolgungsjagden: (vorgaben.verfolgungsjagden ?? []).filter(
        (v) => v.nachKapitel !== nachKapitel,
      ),
    });
  };

  const ratRolle = (
    rat: VersammlungVorgabe,
    id: string,
    rolle: "teilnehmer" | "beobachter",
  ) => {
    const inTeilnehmern = rat.teilnehmerIds.includes(id);
    const inBeobachtern = rat.beobachterIds.includes(id);
    const teilnehmerIds =
      rolle === "teilnehmer"
        ? inTeilnehmern
          ? rat.teilnehmerIds.filter((x) => x !== id)
          : [...rat.teilnehmerIds, id]
        : rat.teilnehmerIds.filter((x) => x !== id);
    const beobachterIds =
      rolle === "beobachter"
        ? inBeobachtern
          ? rat.beobachterIds.filter((x) => x !== id)
          : [...rat.beobachterIds, id]
        : rat.beobachterIds.filter((x) => x !== id);
    ratAendern(rat.nachKapitel, {
      teilnehmerIds,
      beobachterIds,
      vorsitzId: teilnehmerIds.includes(rat.vorsitzId) ? rat.vorsitzId : "",
      undercoverId:
        teilnehmerIds.includes(rat.undercoverId) || beobachterIds.includes(rat.undercoverId)
          ? rat.undercoverId
          : "",
    });
  };

  const jagdNach = (nachKapitel: number) =>
    (vorgaben.verfolgungsjagden ?? []).find((v) => v.nachKapitel === nachKapitel);

  const jagdAendern = (nachKapitel: number, teil: Partial<VerfolgungVorgabe>) =>
    onAendern({
      verfolgungsjagden: (vorgaben.verfolgungsjagden ?? []).map((v) =>
        v.nachKapitel === nachKapitel ? { ...v, ...teil } : v,
      ),
    });

  const jagdUmschalten = (nachKapitel: number) => {
    const bisher = vorgaben.verfolgungsjagden ?? [];
    if (bisher.some((v) => v.nachKapitel === nachKapitel)) {
      onAendern({ verfolgungsjagden: bisher.filter((v) => v.nachKapitel !== nachKapitel) });
      return;
    }
    const start = (mitspieler.length >= 3 ? mitspieler : verdaechtige).slice(0, 3);
    const neu: VerfolgungVorgabe = {
      id: `jagd-nach-${nachKapitel}`,
      nachKapitel,
      name: `Die weiße Spur nach Kapitel ${nachKapitel}`,
      fliehenderId: start[0]?.id ?? "",
      fluchtAutoId: 'auto-sport',
      verfolger: [
        { charakterId: "wimpy", modell: "schaf" },
        { charakterId: "wimpy", modell: "yeti" },
      ],
      musik: "",
      fluchtgrund: "ich jemanden schützen musste, der noch nicht entdeckt werden darf",
      statement: "",
    };
    onAendern({
      verfolgungsjagden: [...bisher, neu].sort((a, b) => a.nachKapitel - b.nachKapitel),
      versammlungen: (vorgaben.versammlungen ?? []).filter(
        (v) => v.nachKapitel !== nachKapitel,
      ),
    });
  };


  /** Steht dieses Feld schon durch den Arc fest? */
  const arcHinweis = (feld: keyof SagaVorgaben) =>
    vomArc?.[feld] ? <span className="leise klein"> · {vomArc[feld]}</span> : null;

  return (
    <>
      <label className="feld">
        <span className="leise">Name (leer = das Modell erfindet einen)</span>
        <input
          value={vorgaben.name}
          onChange={(e) => setzen({ name: e.target.value })}
          placeholder="z.B. Die Spur der sieben Glocken"
          maxLength={120}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Überthema · was sich langsam enthüllt{arcHinweis("thema")}
        </span>
        <textarea
          rows={3}
          value={vorgaben.thema}
          onChange={(e) => setzen({ thema: e.target.value })}
          placeholder="z.B. Jemand sammelt heimlich die Glocken aller Stadttiere ein"
          maxLength={2000}
        />
      </label>

      <h3 className="unter-abschnitt">Kapitel</h3>
      <div className="wahl-reihe">
        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.kapitelAnzahl === n}
            onClick={() => setzen({ kapitelAnzahl: n })}
          >
            <strong>{n}</strong>
            <span className="leise">+ Finale</span>
          </button>
        ))}
      </div>

      {[...kapitelNummern, vorgaben.kapitelAnzahl].map((i) => {
        const istFinale = i === vorgaben.kapitelAnzahl;
        return (
          <div className="kapitel-block" key={i}>
            <h4 className="unter-abschnitt">
              {istFinale ? "Finale" : `Kapitel ${i + 1}`}
            </h4>

            {!istFinale && (
              <label className="feld">
                <span className="leise">Wunsch (frei lassen = freie Hand)</span>
                <input
                  value={vorgaben.kapitelWuensche[i] ?? ""}
                  onChange={(e) => wunschSetzen(i, e.target.value)}
                  placeholder="z.B. Spielt auf dem Nachtmarkt, ein Fahrrad verschwindet"
                  maxLength={400}
                />
              </label>
            )}

            {!istFinale && (
              <>
                <span className="leise klein">Täter dieses Kapitels</span>
                <div className="marken-reihe">
                  <button
                    className="marke-knopf"
                    data-aktiv={!(vorgaben.kapitelTaeter?.[i] ?? "")}
                    onClick={() => kapitelTaeterSetzen(i, "")}
                  >
                    Zufällig
                  </button>
                  {mitspieler
                    // Der Drahtzieher ist erst im Finale schuldig, und wer im
                    // Kapitel noch gar nicht auftritt, kann es nicht gewesen sein.
                    .filter((c) => c.id !== vorgaben.drahtzieherId)
                    .filter(
                      (c) =>
                        auftrittVon({
                          charakterId: c.id,
                          vorgaben,
                          drahtzieherId: vorgaben.drahtzieherId,
                        }) <=
                        i + 1,
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className="marke-knopf"
                        data-aktiv={vorgaben.kapitelTaeter?.[i] === c.id}
                        onClick={() => kapitelTaeterSetzen(i, c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </>
            )}

            {!istFinale && (
              <>
                {/* Zwei, die es zusammen getan haben. Beide zu beschuldigen
                    ist richtig; die Auflösung nennt ohnehin beide. */}
                <span className="leise klein">
                  Zweiter Täter · sie haben es gemeinsam getan
                </span>
                <div className="marken-reihe">
                  <button
                    className="marke-knopf"
                    data-aktiv={!(vorgaben.kapitelMittaeter?.[i] ?? "")}
                    onClick={() => mittaeterSetzen(i, "")}
                  >
                    Keiner
                  </button>
                  {mitspieler
                    .filter((c) => c.id !== vorgaben.drahtzieherId)
                    .filter((c) => c.id !== (vorgaben.kapitelTaeter?.[i] ?? ""))
                    .filter(
                      (c) =>
                        auftrittVon({
                          charakterId: c.id,
                          vorgaben,
                          drahtzieherId: vorgaben.drahtzieherId,
                        }) <=
                        i + 1,
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className="marke-knopf"
                        data-aktiv={vorgaben.kapitelMittaeter?.[i] === c.id}
                        onClick={() => mittaeterSetzen(i, c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>

                {/* Und die Gestalt, die am Ende aus dem Täter bricht. */}
                <span className="leise klein">
                  Verwandlung am Ende · der Täter entpuppt sich
                </span>
                <div className="marken-reihe">
                  <button
                    className="marke-knopf"
                    data-aktiv={!(vorgaben.kapitelDaemon?.[i] ?? "")}
                    onClick={() => daemonSetzen(i, "")}
                  >
                    Keine
                  </button>
                  {gestalten.map((c) => (
                    <button
                      key={c.id}
                      className="marke-knopf"
                      data-aktiv={vorgaben.kapitelDaemon?.[i] === c.id}
                      onClick={() => daemonSetzen(i, c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {gestalten.length === 0 && (
                  <p className="leise klein">
                    Noch keine Dämonenform angelegt - unter „Tiere“ ein Tier
                    als Dämonenform markieren, dann steht es hier zur Wahl.
                  </p>
                )}
              </>
            )}

            {istFinale && (
              <p className="leise klein">
                Im Finale ist der Drahtzieher der Täter - das steht oben. Eine
                Verwandlung gehört dort zur Besessenheit der ganzen Saga.
              </p>
            )}

            <VideoFeld
              wert={vorgaben.kapitelVideos?.[i] ?? ""}
              onAendern={(pfad) => videoSetzen(i, pfad)}
              beschriftung={
                istFinale
                  ? "Video vor dem Finale (leer = kein Video)"
                  : "Video vor dem Kapitel (leer = kein Video)"
              }
            />

            {/* Die Hintergrundmusik dieses Kapitels. Nichts gewählt heißt:
                die aus dem Admin-Menü - und wenn dort auch nichts steht,
                eben keine. */}
            <SongWahl
              wert={vorgaben.kapitelMusik?.[i] ?? ""}
              onAendern={(pfad) => musikSetzen(i, pfad)}
              beschriftung={
                istFinale
                  ? "Hintergrundmusik im Finale"
                  : "Hintergrundmusik in diesem Kapitel"
              }
              leerText="Wie im Admin-Menü eingestellt"
            />

            {/* Ein Geschenk nach dem Kapitel - freiwillig, und jede Lücke
                ist erlaubt: Es lässt sich auch nur für ein einziges Kapitel
                eintragen. Steht der Gegenstand später nicht mehr im Laden,
                bleibt die Übergabe einfach aus. */}
            <label className="feld">
              <span className="leise">
                {istFinale
                  ? "Geschenk nach dem Finale"
                  : "Geschenk nach diesem Kapitel"}{" "}
                · nur wenn gelöst
              </span>
              <select
                value={vorgaben.kapitelGeschenke?.[i] ?? ""}
                onChange={(e) => geschenkSetzen(i, e.target.value)}
              >
                <option value="">Kein Geschenk</option>
                {/* Zwei Gruppen, weil es zwei Arten Geschenk sind: Was in die
                    Tasche wandert, und was in der Garage steht. */}
                <optgroup label="Zubehör">
                  {laden
                    .filter((z) => z.wirkung !== "auto")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} · sonst {yen(z.preis)}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Autos · fährt er ab sofort">
                  {laden
                    .filter((z) => z.wirkung === "auto")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} · sonst {yen(z.preis)}
                      </option>
                    ))}
                </optgroup>
                {/* Ein Gegenstand, den es nicht mehr gibt, würde die Auswahl
                    sonst still auf "Kein Geschenk" stellen. */}
                {(vorgaben.kapitelGeschenke?.[i] ?? "") !== "" &&
                  !laden.some((z) => z.id === vorgaben.kapitelGeschenke[i]) && (
                    <option value={vorgaben.kapitelGeschenke[i]}>
                      {vorgaben.kapitelGeschenke[i]} · nicht mehr im Laden
                    </option>
                  )}
              </select>
            </label>

            <span className="leise klein">Wetter</span>
            <div className="marken-reihe">
              <button
                className="marke-knopf"
                data-aktiv={!vorgaben.kapitelWetter?.[i]}
                onClick={() => wetterSetzen(i, "")}
              >
                Wie eingestellt
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelWetter?.[i] === "aus"}
                onClick={() => wetterSetzen(i, "aus")}
              >
                Klar
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelWetter?.[i] === "zufall"}
                onClick={() => wetterSetzen(i, "zufall")}
              >
                Zufall
              </button>
              {WETTERLAGEN.map((lage) => (
                <button
                  key={lage.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.kapitelWetter?.[i] === lage.id}
                  onClick={() => wetterSetzen(i, lage.id)}
                  title={lage.hinweis}
                >
                  {lage.label}
                </button>
              ))}
            </div>

            <span className="leise klein">Stadt</span>
            <div className="marken-reihe">
              <button
                className="marke-knopf"
                data-aktiv={!vorgaben.kapitelStaedte[i]}
                onClick={() => stadtSetzen(i, "")}
              >
                Wie eingestellt
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelStaedte[i] === "zufall"}
                onClick={() => stadtSetzen(i, "zufall")}
              >
                Zufall
              </button>
              {staedte.map((stadt) => (
                <button
                  key={stadt.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.kapitelStaedte[i] === stadt.id}
                  onClick={() => stadtSetzen(i, stadt.id)}
                >
                  {stadt.name}
                </button>
              ))}
            </div>

            <div className="pruefung" style={{ marginTop: 14 }}>
              <label className="feld" style={{ margin: 0 }}>
                <span>
                  <input
                    type="checkbox"
                    checked={vorgaben.kapitel3d?.[i]?.aktiv === true}
                    onChange={(e) => dreiDSetzen(i, { aktiv: e.target.checked })}
                  />{" "}
                  <strong>{istFinale ? "Finale in 3D spielen" : "Dieses Kapitel in 3D spielen"}</strong>
                </span>
                <span className="leise klein">
                  Wimpy läuft frei durch die Stadt; Tiere, Gespräche und Spuren bleiben Teil des normalen Falls.
                </span>
              </label>
              {vorgaben.kapitel3d?.[i]?.aktiv && (
                <>
                  <span className="leise klein">Bausteine der 3D-Stadt</span>
                  <div className="marken-reihe">
                    {DREI_D_LOCATIONS.map((ort) => {
                      const locations = vorgaben.kapitel3d?.[i]?.locations?.length
                        ? vorgaben.kapitel3d[i].locations
                        : STANDARD_KAPITEL_3D.locations;
                      const aktiv = locations.includes(ort.id);
                      return (
                        <button
                          key={ort.id}
                          className="marke-knopf"
                          data-aktiv={aktiv}
                          onClick={() => {
                            const neu = aktiv
                              ? locations.filter((id) => id !== ort.id)
                              : [...locations, ort.id];
                            dreiDSetzen(i, { locations: neu.length ? neu : [ort.id] });
                          }}
                        >
                          {ort.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="probe-drehungen">
                    {(vorgaben.kapitel3d?.[i]?.locations?.length
                      ? vorgaben.kapitel3d[i].locations
                      : STANDARD_KAPITEL_3D.locations
                    ).map((id) => {
                      const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
                      const grad = vorgaben.kapitel3d?.[i]?.locationDrehungen?.[id] ?? 0;
                      return ort ? (
                        <button
                          key={id}
                          className="knopf klein"
                          onClick={() => dreiDSetzen(i, {
                            locationDrehungen: {
                              ...(vorgaben.kapitel3d?.[i]?.locationDrehungen ?? {}),
                              [id]: (grad + 90) % 360,
                            },
                          })}
                        >
                          {ort.name} drehen · {grad}°
                        </button>
                      ) : null;
                    })}
                  </div>
                  {/* Entweder Straßenzug wie bisher - oder ein selbst
                      gelegter Stadtplan mit Kreuzungen und Sackgassen. */}
                  <span className="leise klein">Aufbau der Stadt</span>
                  {/* Eine im Reiter „Städte“ geplante Stadt bringt Plan,
                      Tankstelle, Belag und Licht in einem Zug mit. Sie wird
                      dabei abgeschrieben: Was hier steht, bleibt stehen. */}
                  <StadtWahl
                    onUebernehmen={(stadt) => dreiDSetzen(i, {
                      plan: stadt.plan,
                      ...(stadt.locations.length ? { locations: stadt.locations } : {}),
                      tankstelleId: stadt.tankstelleId,
                      polizeiId: stadt.polizeiId,
                      strassentyp: stadt.strassentyp,
                      tageszeit: stadt.tageszeit,
                      wetter: stadt.wetter,
                    })}
                  />
                  <StadtplanFeld
                    plan={vorgaben.kapitel3d?.[i]?.plan ?? null}
                    onAendern={(plan) => dreiDSetzen(i, { plan })}
                  />
                  {/* Wo Wimpy in sein Auto steigt. Ohne Wahl erkennt das Spiel
                      die Tankstelle am Namen des Bausteins. */}
                  <label className="feld">
                    <span className="leise klein">Tankstelle · hier steigt Wimpy ins Auto</span>
                    <select
                      value={vorgaben.kapitel3d?.[i]?.tankstelleId ?? ""}
                      onChange={(e) => dreiDSetzen(i, { tankstelleId: e.target.value })}
                    >
                      <option value="">Automatisch erkennen (Name enthält „Tank“)</option>
                      {(vorgaben.kapitel3d?.[i]?.locations?.length
                        ? vorgaben.kapitel3d[i].locations
                        : STANDARD_KAPITEL_3D.locations
                      ).map((id) => (
                        <option key={id} value={id}>
                          {DREI_D_LOCATIONS.find((ort) => ort.id === id)?.name ?? id}
                        </option>
                      ))}
                    </select>
                  </label>
                  {/* Steht eine Wache in der Stadt, wird dort beschuldigt -
                      und nur dort. Ohne Wache bleibt der Knopf in der
                      Leiste, sonst käme man nie zur Auflösung. */}
                  <label className="feld">
                    <span className="leise klein">Polizeiwache · hier beschuldigt Wimpy</span>
                    <select
                      value={vorgaben.kapitel3d?.[i]?.polizeiId ?? ""}
                      onChange={(e) => dreiDSetzen(i, { polizeiId: e.target.value })}
                    >
                      <option value="">Automatisch erkennen (Name enthält „Polizei“)</option>
                      {(vorgaben.kapitel3d?.[i]?.locations?.length
                        ? vorgaben.kapitel3d[i].locations
                        : STANDARD_KAPITEL_3D.locations
                      ).map((id) => (
                        <option key={id} value={id}>
                          {DREI_D_LOCATIONS.find((ort) => ort.id === id)?.name ?? id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="leise klein">Straßentyp</span>
                  <div className="marken-reihe">
                    {DREI_D_STRASSENTYPEN.map((typ) => (
                      <button
                        key={typ.id}
                        className="marke-knopf"
                        data-aktiv={(vorgaben.kapitel3d?.[i]?.strassentyp ?? "asphalt") === typ.id}
                        onClick={() => dreiDSetzen(i, { strassentyp: typ.id })}
                      >
                        {typ.name}
                      </button>
                    ))}
                  </div>
                  <span className="leise klein">Tageszeit</span>
                  <div className="marken-reihe">
                    {DREI_D_TAGESZEITEN.map((zeit) => (
                      <button
                        key={zeit.id}
                        className="marke-knopf"
                        data-aktiv={(vorgaben.kapitel3d?.[i]?.tageszeit ?? "tag") === zeit.id}
                        onClick={() => dreiDSetzen(i, { tageszeit: zeit.id })}
                      >
                        {zeit.name}
                      </button>
                    ))}
                  </div>
                  <span className="leise klein">3D-Wetter</span>
                  <div className="marken-reihe">
                    {DREI_D_WETTER.map((wetter) => (
                      <button
                        key={wetter.id}
                        className="marke-knopf"
                        data-aktiv={(vorgaben.kapitel3d?.[i]?.wetter ?? "klar") === wetter.id}
                        onClick={() => dreiDSetzen(i, { wetter: wetter.id })}
                      >
                        {wetter.name}
                      </button>
                    ))}
                  </div>
                  <span className="leise klein">3D-Modelle der Tiere</span>
                  <span className="leise klein">Nur fest eingeplante Kapiteltiere. Bei einem noch unbekannten Twist-Drahtzieher erfolgt die Modellwahl nach der Generierung. Das Modell aus den Stammdaten gilt von selbst - hier steht nur, was in diesem Kapitel anders sein soll.</span>
                  <div className="probe-charakter-zuordnung">
                    {sichere3DTiere(vorgaben, stammdaten.charaktere, i).map((charakter) => (
                      <label className="feld" key={charakter.id}>
                        <span className="leise klein">{charakter.name}</span>
                        <select
                          value={vorgaben.kapitel3d?.[i]?.charakterModelle?.[charakter.id] ?? ""}
                          onChange={(e) => {
                            const charakterModelle = {
                              ...(vorgaben.kapitel3d?.[i]?.charakterModelle ?? {}),
                            };
                            if (e.target.value) charakterModelle[charakter.id] = e.target.value;
                            else delete charakterModelle[charakter.id];
                            dreiDSetzen(i, { charakterModelle });
                          }}
                        >
                          {/* Was in den Stammdaten beim Tier steht, gilt
                              überall - hier steht nur, was für dieses eine
                              Kapitel davon abweichen soll. */}
                          <option value="">
                            {charakter.modell3d
                              ? `Aus den Stammdaten: ${ANIMATIONS_MODELLE.find((m) => m.id === charakter.modell3d)?.name ?? charakter.modell3d}`
                              : "Automatisch nach Name/Tierart"}
                          </option>
                          {ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy").map((modell) => (
                            <option key={modell.id} value={modell.id}>{modell.name}</option>
                          ))}
                        </select>
                        <span className="leise klein">Größe · 1 = normal</span>
                        <input type="number" min="0.5" max="2.5" step="0.1"
                          aria-label={`Größe von ${charakter.name}`}
                          value={vorgaben.kapitel3d?.[i]?.charakterGroessen?.[charakter.id] ?? 1}
                          onChange={(e) => {
                            const wert = e.target.valueAsNumber;
                            if (Number.isFinite(wert)) dreiDSetzen(i, { charakterGroessen: {
                              ...(vorgaben.kapitel3d?.[i]?.charakterGroessen ?? {}),
                              [charakter.id]: Math.min(2.5, Math.max(0.5, wert)),
                            } });
                          }} />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Versammlungen sind ein eigener Reiz der Arc-Sagas. Einzelne Sagas
          bleiben schlank; im Arc-Formular ist dagegen jede echte Lücke
          zwischen zwei Kapiteln frei bespielbar. */}
      {vomArc && (
        <section className="rat-editor">
          <h3 className="unter-abschnitt">
            Versammlungen <span className="leise">· zwischen den Kapiteln</span>
          </h3>
          <p className="leise klein">
            Optional. Der Rat läuft als freies Gruppengespräch: Viele Tiere
            reden miteinander, Wimpy kann jederzeit fragen oder widersprechen.
            Im Hintergrund verdichtet sich die Diskussion zu einem zusätzlichen
            Beweis. Tiere am Rand müssen im angrenzenden Fall nicht mitspielen.
          </p>

          {Array.from({ length: Math.max(0, vorgaben.kapitelAnzahl - 1) }, (_, i) => i + 1).map(
            (nachKapitel) => {
              const rat = ratNach(nachKapitel);
              const dabei = rat
                ? [...rat.teilnehmerIds, ...rat.beobachterIds]
                : [];
              return (
                <div className="rat-editor-block" key={nachKapitel} data-aktiv={Boolean(rat)}>
                  <div className="rat-editor-kopf">
                    <div>
                      <strong>Nach Kapitel {nachKapitel}</strong>
                      <span className="leise klein">
                        {rat ? ` · ${rat.name}` : " · keine Versammlung"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="knopf klein"
                      onClick={() => ratUmschalten(nachKapitel)}
                    >
                      {rat ? "Entfernen" : "Versammlung einrichten"}
                    </button>
                  </div>

                  {rat && (
                    <div className="rat-editor-inhalt">
                      <label className="feld">
                        <span className="leise">Name der Versammlung</span>
                        <input
                          value={rat.name}
                          onChange={(e) => ratAendern(nachKapitel, { name: e.target.value })}
                          placeholder="Rat der sieben Schnurrhaare"
                          maxLength={120}
                        />
                      </label>
                      <label className="feld">
                        <span className="leise">Anlass · warum alle zusammenkommen</span>
                        <textarea
                          rows={2}
                          value={rat.anlass}
                          onChange={(e) => ratAendern(nachKapitel, { anlass: e.target.value })}
                          placeholder="Nach dem Vorfall am Hafen verlangt die Stadt Antworten."
                          maxLength={500}
                        />
                      </label>
                      <label className="feld">
                        <span className="leise">Was erörtert werden soll</span>
                        <textarea
                          rows={3}
                          value={rat.thema}
                          onChange={(e) => ratAendern(nachKapitel, { thema: e.target.value })}
                          placeholder="Wer profitiert davon, dass alle Uhren dieselbe falsche Zeit zeigen?"
                          maxLength={1200}
                        />
                      </label>

                      <span className="leise klein">Teilnehmer · reden regelmäßig mit</span>
                      <div className="marken-reihe">
                        {verdaechtige.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className="marke-knopf"
                            data-aktiv={rat.teilnehmerIds.includes(c.id)}
                            onClick={() => ratRolle(rat, c.id, "teilnehmer")}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>

                      <span className="leise klein">
                        Tiere am Rand · hören zu, dürfen sich überraschend einmischen
                      </span>
                      <div className="marken-reihe">
                        {verdaechtige.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className="marke-knopf"
                            data-aktiv={rat.beobachterIds.includes(c.id)}
                            onClick={() => ratRolle(rat, c.id, "beobachter")}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>

                      <label className="feld">
                        <span className="leise">Vorsitz · beendet die Runde irgendwann selbst</span>
                        <select
                          value={rat.vorsitzId}
                          onChange={(e) => ratAendern(nachKapitel, { vorsitzId: e.target.value })}
                        >
                          <option value="">Vorsitz wählen …</option>
                          {rat.teilnehmerIds.map((id) => (
                            <option key={id} value={id}>
                              {namenVon(id)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="feld">
                        <span className="leise">
                          Undercover dabei · bleibt für Spieler und Rat vollständig geheim
                        </span>
                        <select
                          value={rat.undercoverId}
                          onChange={(e) => ratAendern(nachKapitel, { undercoverId: e.target.value })}
                        >
                          <option value="">Niemand</option>
                          {dabei.map((id) => (
                            <option key={id} value={id}>
                              {namenVon(id)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </section>
      )}

      {vomArc && (
        <section className="jagd-editor">
          <h3 className="unter-abschnitt">
            Verfolgungsjagden <span className="leise">· zwischen den Kapiteln</span>
          </h3>
          <p className="leise klein">
            Optional und anstelle einer Versammlung in derselben Lücke. Zwei Tiere
            jagen gemeinsam einen weißen Sportwagen durch den Schnee. Die fliehende
            Figur bleibt während der Fahrt hinter der Scheibe unkenntlich und gibt
            erst nach dem Fang ihr Statement ab.
          </p>

          {Array.from({ length: Math.max(0, vorgaben.kapitelAnzahl - 1) }, (_, i) => i + 1).map(
            (nachKapitel) => {
              const jagd = jagdNach(nachKapitel);
              const rat = ratNach(nachKapitel);
              return (
                <div className="rat-editor-block" key={nachKapitel} data-aktiv={Boolean(jagd)}>
                  <div className="rat-editor-kopf">
                    <div>
                      <strong>Nach Kapitel {nachKapitel}</strong>
                      <span className="leise klein">
                        {jagd
                          ? ` · ${jagd.name}`
                          : rat
                            ? " · derzeit findet hier eine Versammlung statt"
                            : " · keine Verfolgungsjagd"}
                      </span>
                    </div>
                    <div className="aktionen">
                      {jagd && (
                        <button
                          type="button"
                          className="knopf klein"
                          onClick={() => setJagdVorschau(jagd)}
                        >
                          3D-Vorschau
                        </button>
                      )}
                      <button
                        type="button"
                        className="knopf klein"
                        onClick={() => jagdUmschalten(nachKapitel)}
                      >
                        {jagd ? "Entfernen" : rat ? "Versammlung ersetzen" : "Jagd einrichten"}
                      </button>
                    </div>
                  </div>

                  {jagd && (
                    <div className="rat-editor-inhalt">
                      <label className="feld">
                        <span className="leise">Titel der Verfolgungsjagd</span>
                        <input
                          value={jagd.name}
                          maxLength={120}
                          onChange={(e) => jagdAendern(nachKapitel, { name: e.target.value })}
                          placeholder="Die weiße Spur"
                        />
                      </label>

                      <label className="feld">
                        <span className="leise">Tier im Fluchtwagen</span>
                        <select
                          value={jagd.fliehenderId}
                          onChange={(e) => jagdAendern(nachKapitel, { fliehenderId: e.target.value })}
                        >
                          <option value="">Tier wählen …</option>
                          {verdaechtige.map((c) => (
                            <option
                              key={c.id}
                              value={c.id}
                            >
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="feld">
                        <span className="leise">Fluchtwagen · Wimpy verfolgt mit seinem eigenen Auto</span>
                        <select value={jagd.fluchtAutoId ?? 'auto-sport'} onChange={e => jagdAendern(nachKapitel, { fluchtAutoId: e.target.value })}>
                          {autos.map(auto => <option key={auto.id} value={auto.id}>{auto.name} · {auto.speed} km/h</option>)}
                        </select>
                      </label>
                      {/* Jedes Modell steht anders in seiner Datei. Fährt der
                          Wagen verkehrt herum voraus, wird er hier gedreht -
                          in der 3D-Vorschau sieht man es sofort. */}
                      <label className="feld">
                        <span className="leise">Fluchtwagen drehen · falls er verkehrt herum fährt</span>
                        <select
                          value={jagd.fluchtDrehung ?? 0}
                          onChange={(e) =>
                            jagdAendern(nachKapitel, { fluchtDrehung: Number(e.target.value) })
                          }
                        >
                          {[0, 90, 180, 270].map((grad) => (
                            <option key={grad} value={grad}>
                              {grad}° {grad === 180 ? "· umgedreht" : grad === 0 ? "· wie im Katalog" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <JagdWeltFeld
                        jagd={jagd}
                        onAendern={(teil) => jagdAendern(nachKapitel, teil)}
                      />

                      <SongWahl
                        wert={jagd.musik ?? ""}
                        onAendern={(musik) => jagdAendern(nachKapitel, { musik })}
                        beschriftung="Song während der Fahrt"
                        leerText="Ohne Jagdmusik"
                      />

                      <label className="feld">
                        <span className="leise">Warum das Tier flieht</span>
                        <textarea
                          rows={2}
                          maxLength={800}
                          value={jagd.fluchtgrund}
                          onChange={(e) => jagdAendern(nachKapitel, { fluchtgrund: e.target.value })}
                          placeholder="es jemanden schützen will …"
                        />
                      </label>
                      <label className="feld">
                        <span className="leise">
                          Statement nach dem Fang · leer = automatisch aus dem Fluchtgrund
                        </span>
                        <textarea
                          rows={3}
                          maxLength={1200}
                          value={jagd.statement}
                          onChange={(e) => jagdAendern(nachKapitel, { statement: e.target.value })}
                          placeholder="Ich bin geflohen, weil …"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </section>
      )}

      {jagdVorschau && (
        <div className="jagd-vorschau">
          <Verfolgungsjagd
            vorschau
            vorgabe={jagdVorschau}
            onFertig={() => setJagdVorschau(null)}
            onDrehung={(grad) => {
              // Was in der Vorschau gedreht wird, steht danach auch in der Jagd.
              setJagdVorschau((alt) => (alt ? { ...alt, fluchtDrehung: grad } : alt));
              jagdAendern(jagdVorschau.nachKapitel, { fluchtDrehung: grad });
            }}
          />
          <button
            type="button"
            className="jagd-vorschau-schliessen"
            onClick={() => setJagdVorschau(null)}
            aria-label="3D-Vorschau schließen"
          >
            ×
          </button>
        </div>
      )}

      <h3 className="unter-abschnitt">
        Stadt <span className="leise">· gilt, wo oben „Wie eingestellt“ steht</span>
      </h3>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.staedteWechseln}
          onClick={() => setzen({ staedteWechseln: true })}
        >
          <strong>Wechselnd</strong>
          <span className="leise">jedes Mal woanders</span>
        </button>
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="wahl-chip"
            data-aktiv={!vorgaben.staedteWechseln && vorgaben.stadt === stadt.id}
            onClick={() => setzen({ staedteWechseln: false, stadt: stadt.id })}
          >
            <strong>{stadt.name}</strong>
            <span className="leise">{stadt.orte.length} Orte</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Tiere <span className="leise">· keins gewählt = alle</span>
        {arcHinweis("charaktere")}
      </h3>
      <div className="marken-reihe">
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.charaktere.includes(c.id)}
            onClick={() => umschalten("charaktere", c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Dinge <span className="leise">· müssen vorkommen</span>
      </h3>
      <div className="marken-reihe">
        {stammdaten.items.map((i) => (
          <button
            key={i.id}
            className="marke-knopf"
            data-aktiv={vorgaben.items.includes(i.id)}
            onClick={() => umschalten("items", i.id)}
          >
            {i.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Drahtzieher <span className="leise">· wer hinter allem steckt</span>
        {arcHinweis("drahtzieherId")}
      </h3>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={vorgaben.drahtzieherId === ""}
          onClick={() => setzen({ drahtzieherId: "" })}
        >
          Zufällig
        </button>
        {mitGestalten.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.drahtzieherId === c.id}
            onClick={() => setzen({ drahtzieherId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Falsche Fährte{" "}
        <span className="leise">· ein Verdacht, der die ganze Saga über mitläuft</span>
      </h3>
      <p className="leise klein">
        Optional. Auf dieses Tier zeigt in jedem Kapitel etwas - und es ist
        unschuldig. Es erklärt sich schlecht, weil es etwas anderes verbirgt,
        etwas Harmloses. Vor Gericht trägt nichts davon: Wer der Fährte
        nachjagt, sammelt eine Tasche voller Stücke, die nichts beweisen.
      </p>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={!vorgaben.falscheFaehrte?.charakterId}
          onClick={() => setzen({ falscheFaehrte: { charakterId: "", was: "" } })}
        >
          Keine
        </button>
        {verdaechtige
          .filter((c) => c.id !== vorgaben.drahtzieherId)
          .map((c) => (
            <button
              key={c.id}
              className="marke-knopf"
              data-aktiv={vorgaben.falscheFaehrte?.charakterId === c.id}
              onClick={() =>
                setzen({
                  falscheFaehrte: {
                    charakterId: c.id,
                    was: vorgaben.falscheFaehrte?.was ?? "",
                  },
                })
              }
            >
              {c.name}
            </button>
          ))}
      </div>
      {vorgaben.falscheFaehrte?.charakterId && (
        <label className="feld">
          <span className="leise">
            Warum es immer wieder so aussieht · leer heißt: das Modell denkt
            sich etwas aus
          </span>
          <textarea
            rows={2}
            value={vorgaben.falscheFaehrte?.was ?? ""}
            onChange={(e) =>
              setzen({
                falscheFaehrte: {
                  charakterId: vorgaben.falscheFaehrte?.charakterId ?? "",
                  was: e.target.value,
                },
              })
            }
            placeholder="z.B. Er ist jede Nacht am Hafen unterwegs und sagt nie, warum."
            maxLength={600}
          />
        </label>
      )}

      <h3 className="unter-abschnitt">
        Twist <span className="leise">· der Drahtzieher bleibt bis zum Finale unsichtbar</span>
        {arcHinweis("twist")}
      </h3>
      <div className="wahl-reihe">
        <button
          className="wahl-chip"
          data-aktiv={!vorgaben.twist}
          onClick={() => setzen({ twist: false })}
        >
          <strong>Normal</strong>
          <span className="leise">Er läuft in den Kapiteln beiläufig mit</span>
        </button>
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.twist}
          disabled={twistGesperrt}
          onClick={() => setzen({ twist: true })}
        >
          <strong>Twist</strong>
          <span className="leise">Man begegnet ihm erst im Finale</span>
        </button>
      </div>
      {twistGesperrt && (
        <p className="leise klein">
          Beim Gerichtsfinale gibt es keinen Twist: Dort tritt der Drahtzieher
          von Anfang an auf und spielt mit Wimpy - das ist der ganze Reiz.
        </p>
      )}
      <p className="leise klein">
        Mit Twist kommt der Drahtzieher in keinem Kapitel vor - man sieht ihn
        nicht und kann ihn nicht befragen. Die Hinweise auf ihn gibt es
        trotzdem von Anfang an, nur über Eigenschaften statt über seinen
        Namen: eine Handschrift, ein Geruch, ein Siegel. Der Erzählertext vor
        dem Finale inszeniert dann seinen Auftritt.
      </p>

      <h3 className="unter-abschnitt">
        Auftritte <span className="leise">· wer wann dazustößt</span>
      </h3>
      <p className="leise klein">
        Standard ist „Von Anfang an“. Wer später einsteigt, taucht in dem
        Kapitel zum ersten Mal auf; der Erzählertext davor erklärt seine
        Ankunft. „Erst im Finale“ heißt: In keinem Kapitel zu sehen. Das darf
        auch der Drahtzieher sein - mit der Twist-Wahl oben steht er ohnehin
        schon auf „Erst im Finale“.
        <br />
        In der Zeile darunter lässt sich jedes einzelne Kapitel abwählen: Dann
        ist das Tier zwischendurch weg und taucht später wieder auf. Bliebe ein
        Kapitel dadurch ohne genug Verdächtige, rückt jemand nach - ein
        spielbarer Fall geht vor.
      </p>
      {mitspieler.map((c) => {
        const finale = vorgaben.kapitelAnzahl + 1;
        const gesperrt = vorgaben.twist && c.id === vorgaben.drahtzieherId;
        const jetzt = gesperrt ? finale : (vorgaben.neuzugaenge?.[c.id] ?? 1);
        return (
          <div key={c.id} className="auftritt-zeile">
            <span className="leise klein">
              {c.name}
              {c.id === vorgaben.drahtzieherId ? " · Drahtzieher" : ""}
            </span>
            <div className="marken-reihe">
              {Array.from({ length: finale }, (_, i) => i + 1).map((ab) => (
                <button
                  key={ab}
                  className="marke-knopf"
                  disabled={gesperrt}
                  data-aktiv={jetzt === ab}
                  onClick={() =>
                    setzen({
                      neuzugaenge: { ...(vorgaben.neuzugaenge ?? {}), [c.id]: ab },
                    })
                  }
                >
                  {ab === 1 ? "Von Anfang an" : ab === finale ? "Erst im Finale" : `Ab Kapitel ${ab}`}
                </button>
              ))}
            </div>

            {/* Wer da ist, muss nicht bleiben: Hier lässt sich jedes Kapitel
                einzeln abwählen - verreist, untergetaucht, wieder da. */}
            <div className="marken-reihe">
              <span className="leise klein">Pausiert in</span>
              {Array.from({ length: finale }, (_, i) => i + 1)
                .filter((nr) => nr >= jetzt)
                .map((nr) => {
                  const pause = (vorgaben.abwesenheiten?.[c.id] ?? []).includes(nr);
                  return (
                    <button
                      key={nr}
                      className="marke-knopf"
                      data-aktiv={pause}
                      onClick={() => {
                        const bisher = vorgaben.abwesenheiten?.[c.id] ?? [];
                        setzen({
                          abwesenheiten: {
                            ...(vorgaben.abwesenheiten ?? {}),
                            [c.id]: pause
                              ? bisher.filter((x) => x !== nr)
                              : [...bisher, nr].sort((a, b) => a - b),
                          },
                        });
                      }}
                    >
                      {nr > vorgaben.kapitelAnzahl ? "Finale" : nr}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">Publikum</h3>
      <div className="wahl-reihe">
        {REIFEGRADE.map((r) => (
          <button
            key={r.id}
            className="wahl-chip"
            data-aktiv={vorgaben.reifegrad === r.id}
            onClick={() => setzen({ reifegrad: r.id })}
          >
            <strong>{r.label}</strong>
            <span className="leise">{r.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Absurdität</h3>
      <div className="wahl-reihe">
        {ABSURDITAETEN.map((a) => (
          <button
            key={a.id}
            className="wahl-chip"
            data-aktiv={vorgaben.absurditaet === a.id}
            onClick={() => setzen({ absurditaet: a.id })}
          >
            <strong>{a.label}</strong>
            <span className="leise">{a.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Erzählton</h3>
      <div className="wahl-reihe">
        {TOENE.map((t) => (
          <button
            key={t.id}
            className="wahl-chip"
            data-aktiv={vorgaben.ton === t.id}
            onClick={() => setzen({ ton: t.id })}
          >
            <strong>{t.label}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schwierigkeit</h3>
      <div className="wahl-reihe">
        {SCHWIERIGKEITEN.map((s) => (
          <button
            key={s.id}
            className="wahl-chip"
            data-aktiv={vorgaben.schwierigkeit === s.id}
            onClick={() => setzen({ schwierigkeit: s.id })}
          >
            <strong>{s.label}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schauplätze je Fall</h3>
      <div className="wahl-reihe">
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.ortsAnzahl === n}
            onClick={() => setzen({ ortsAnzahl: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Finale <span className="leise">· worauf die ganze Saga zuläuft</span>
      </h3>
      <p className="leise klein">
        Das steht vor der Erzeugung fest und färbt alles: Schon das Überthema,
        jedes Kapitel und jeder einzelne Fall werden anders gebaut. Nachträglich
        umstellen lässt es sich nicht - die Texte wären dann für ein anderes
        Ende geschrieben.
      </p>
      <div className="wahl-reihe umbrechend">
        {FINALE_ARTEN.map((eintrag) => (
          <button
            key={eintrag.id}
            className="wahl-chip"
            data-aktiv={art === eintrag.id}
            onClick={() => finaleArtSetzen(eintrag.id)}
          >
            <strong>{eintrag.label}</strong>
            <span className="leise">{eintrag.hinweis}</span>
          </button>
        ))}
      </div>
      <p className="hinweis">{FINALE_ARTEN.find((e) => e.id === art)?.lang}</p>

      {/* Der Showdown: Wer den Drahtzieher überführt hat, muss ihn danach
          auch noch stellen. Die Arena dafür steht hier - beim Finale
          „Gericht & Flucht“ genauso, nur beginnt sie dort im Saal. */}
      {mitKampf(art) && (
        <KampfFeld
          kampf={vorgaben.kampf ?? STANDARD_KAMPF}
          gegnerId={vorgaben.drahtzieherId}
          gegnerWort={vorgaben.name}
          ohneGegner="Für diese Saga ist der Drahtzieher noch nicht gewählt - dann wird er zufällig gezogen. Gekämpft wird trotzdem gegen den Richtigen: Das Spiel nimmt den, der nach der Auflösung dasteht. Nur das Modell hier unten greift dann nicht."
          titel={vorgaben.name}
          einleitung={
            art === "gericht-kampf"
              ? "Die Saga läuft in den Gerichtssaal - und wenn das Urteil gesprochen ist, rennt der Verurteilte. Dann kommt diese Arena, davor wahlweise die Verfolgungsjagd. Platzt das Verfahren, wird nicht gekämpft: Dann geht er ohnehin."
              : "Die Saga läuft wie eine klassische in ihren Finalfall - und danach wehrt sich der Überführte. Erst wenn Wimpy ihn gestellt hat, kommt der Epilog. Wer den Finalfall nicht löst, sieht keinen Kampf."
          }
          onAendern={(kampf) => setzen({ kampf })}
        />
      )}

      {(art === "wimpy" || art === "gericht-wimpy") && (
        <>
          <span className="leise klein">Was in Wimpy steckte</span>
          <div className="marken-reihe">
            {mitGestalten.map((c) => (
              <button
                key={c.id}
                className="marke-knopf"
                data-aktiv={vorgaben.besessenheit?.daemonId === c.id}
                onClick={() => setzeBesessenheit({ wirtId: detektivId, daemonId: c.id })}
              >
                {c.name}
              </button>
            ))}
          </div>
          {vorgaben.besessenheit?.daemonId ? (
            <>
              <p className="hinweis">
                {namenVon(vorgaben.besessenheit.daemonId)} steckte die ganze Saga
                über in Wimpy. {art === "gericht-wimpy"
                  ? "Im Saal muss Wimpy erst angeklagt werden; dann bricht es aus ihm heraus."
                  : "Vor der Verhandlung bricht es aus ihm heraus - und im Saal sitzt Wimpy selbst auf der Anklagebank."}
              </p>
              <span className="leise klein">Ton zur Verwandlung</span>
              <TonFeld
                wert={vorgaben.besessenheit.ton}
                satzVorschlag="Es war die ganze Zeit hier!"
                onAendern={(ton) => setzeBesessenheit({ ton })}
              />
            </>
          ) : (
            <p className="leise klein">
              Noch die Gestalt wählen, die in ihm steckte - ohne sie fehlt der
              Verhandlung ihr Grund.
            </p>
          )}
        </>
      )}

      {art !== "klassisch" && (
        <>
          <span className="leise klein">Song zum Einzug des Gerichts</span>
          <p className="leise klein">
            Vor der Verhandlung kündigt sich das Gericht an: Es klopft, die
            Türen fliegen auf, und Öhö flattert herein, um Recht zu sprechen.
            Die Ankündigung läuft genau so lange wie das gewählte Stück.
          </p>
          <TonFeld
            wert={vorgaben.gerichtTon ?? ""}
            satzVorschlag="Das Gericht! Erhebt euch!"
            standardTon=""
            leerHinweis="Nichts gewählt · kurze Ankündigung ohne Musik"
            onAendern={(gerichtTon) => setzen({ gerichtTon })}
          />
        </>
      )}

      {art !== "wimpy" && art !== "gericht-wimpy" && (
      <>
      <h3 className="unter-abschnitt">
        Besessenheit{" "}
        <span className="leise">· ein Tier war die ganze Zeit ein Dämon</span>
      </h3>
      {art === "gericht-daemon" && (
        <p className="hinweis">
          Für dieses Finale gehört die Besessenheit dazu: Das Tier, das du hier
          wählst, sitzt später auf der Anklagebank - und zeigt erst dann, wer
          wirklich in ihm steckt.
        </p>
      )}
      <p className="leise klein">
        Wähle das Tier, das besessen war, und die Gestalt, die in ihm steckt.
        Die Dämonenform legst du wie jedes andere Tier unter „Tiere“ an - mit
        Bild und allem. In den Kapiteln begegnet man nur dem Wirt; direkt vor
        dem Finale bricht der Dämon aus ihm heraus, der Wirt verschwindet, und
        der Dämon ist der Schuldige der ganzen Saga.
      </p>

      <span className="leise klein">Besessen war</span>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={!vorgaben.besessenheit?.wirtId}
          onClick={() => setzeBesessenheit({ wirtId: "" })}
        >
          Niemand
        </button>
        {verdaechtige
          .filter((c) => c.id !== vorgaben.besessenheit?.daemonId)
          .map((c) => (
            <button
              key={c.id}
              className="marke-knopf"
              data-aktiv={vorgaben.besessenheit?.wirtId === c.id}
              onClick={() => setzeBesessenheit({ wirtId: c.id })}
            >
              {c.name}
            </button>
          ))}
      </div>

      {vorgaben.besessenheit?.wirtId && (
        <>
          <span className="leise klein">Seine Dämonenform</span>
          <div className="marken-reihe">
            {mitGestalten
              .filter((c) => c.id !== vorgaben.besessenheit?.wirtId)
              .map((c) => (
                <button
                  key={c.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.besessenheit?.daemonId === c.id}
                  onClick={() => setzeBesessenheit({ daemonId: c.id })}
                >
                  {c.name}
                </button>
              ))}
          </div>

          {besessen(vorgaben) ? (
            <>
              <p className="hinweis">
                {namenVon(vorgaben.besessenheit.daemonId)} steckt in{" "}
                {namenVon(vorgaben.besessenheit.wirtId)} und ist der Drahtzieher
                dieser Saga - die Wahl oben wird dafür übergangen.
              </p>
              <span className="leise klein">Ton zur Verwandlung</span>
              <TonFeld
                wert={vorgaben.besessenheit.ton}
                satzVorschlag="Es war die ganze Zeit hier!"
                onAendern={(ton) => setzeBesessenheit({ ton })}
              />
            </>
          ) : (
            <p className="leise klein">
              Jetzt noch die Dämonenform wählen - ohne sie passiert nichts.
            </p>
          )}
        </>
      )}

      </>
      )}

      <h3 className="unter-abschnitt">
        Auftritt eines neuen Tiers{" "}
        <span className="leise">· der Ton, wenn jemand dazustößt</span>
      </h3>
      <p className="leise klein">
        Gilt für diese ganze Saga. Ohne Auswahl gilt, was im Admin-Menü unter
        „Spiel“ steht - und wenn dort auch nichts steht, newplayer.mp3. Solange der Ton läuft, bleibt die Figur im Dunkeln -
        enthüllt wird sie erst am Ende, und zwar über die ganze Länge des
        Stücks.
      </p>
      <TonFeld
        wert={vorgaben.neuzugangTon}
        onAendern={(neuzugangTon) => setzen({ neuzugangTon })}
      />

      <h4 className="unter-abschnitt">
        Auftritt je Tier{" "}
        <span className="leise">· für alle, die später dazustoßen</span>
      </h4>
      {spaeteMitspieler.length === 0 ? (
        <p className="leise klein">
          Zurzeit steigt niemand später ein. Wer soll das sein? Oben unter
          „Auftritte“ ein Kapitel wählen - dann steht das Tier hier.
        </p>
      ) : (
        <>
          <p className="leise klein">
            Ohne eigene Wahl klingt es wie oben. Für den Drahtzieher lohnt sich
            ein anderes Stück - sein Auftritt ist der letzte der Saga.
          </p>
          {spaeteMitspieler.map((c) => (
            <div key={c.id} className="erzaehler-feld">
              <h4 className="unter-abschnitt">
                {c.name}
                <span className="leise">
                  {" "}
                  ·{" "}
                  {auftrittVon({
                    charakterId: c.id,
                    vorgaben,
                    drahtzieherId: vorgaben.drahtzieherId,
                  }) > vorgaben.kapitelAnzahl
                    ? "erst im Finale"
                    : `ab Kapitel ${auftrittVon({
                        charakterId: c.id,
                        vorgaben,
                        drahtzieherId: vorgaben.drahtzieherId,
                      })}`}
                </span>
              </h4>
              <span className="leise klein">Auftritt</span>
              <div className="wahl-reihe">
                {AUFTRITTS_ARTEN.map((a) => (
                  <button
                    key={a.id}
                    className="wahl-chip"
                    data-aktiv={artFuerAuftritt(c.id, vorgaben) === a.id}
                    onClick={() =>
                      setzen({
                        neuzugangArten: {
                          ...(vorgaben.neuzugangArten ?? {}),
                          [c.id]: a.id,
                        },
                      })
                    }
                  >
                    <strong>{a.label}</strong>
                    <span className="leise klein">{a.hinweis}</span>
                  </button>
                ))}
              </div>

              <TonFeld
                wert={vorgaben.neuzugangToene?.[c.id] ?? ""}
                satzVorschlag={`${c.name} betritt das Feld!`}
                onAendern={(wert) =>
                  setzen({
                    neuzugangToene: { ...(vorgaben.neuzugangToene ?? {}), [c.id]: wert },
                  })
                }
              />
            </div>
          ))}
        </>
      )}

      <h3 className="unter-abschnitt">Beschuldigungen je Fall</h3>
      <div className="wahl-reihe">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.beschuldigungen === n}
            onClick={() => setzen({ beschuldigungen: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
