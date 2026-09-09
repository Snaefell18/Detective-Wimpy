"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AbdruckSchau } from "@/components/AbdruckSchau";
import { Bild } from "@/components/Bild";
import { ArcsListe } from "@/components/ArcsListe";
import { ArcUebersicht } from "@/components/ArcUebersicht";
import { ArcVorspann, themeVon } from "@/components/ArcVorspann";
import { BeschuldigenOverlay } from "@/components/BeschuldigenOverlay";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ErgebnisScreen } from "@/components/ErgebnisScreen";
import { IntroSequenz } from "@/components/IntroSequenz";
import { InventarScreen } from "@/components/InventarScreen";
import { GeschenkSchau } from "@/components/GeschenkSchau";
import { Hintergrundmusik } from "@/components/Hintergrundmusik";
import { LohnSchau } from "@/components/LohnSchau";
import { ShopScreen } from "@/components/ShopScreen";
import { KampagnenListe } from "@/components/KampagnenListe";
import { ErzaehlerScreen, roemisch } from "@/components/ErzaehlerScreen";
import { SagaVorspann } from "@/components/SagaVorspann";
import { Prolog } from "@/components/Prolog";
import { SagenListe } from "@/components/SagenListe";
import { Nav, type Tab } from "@/components/Nav";
import { NeuerSpieler } from "@/components/NeuerSpieler";
import { ReaktionScreen } from "@/components/ReaktionScreen";
import { Gerichtseinzug } from "@/components/Gerichtseinzug";
import { Gerichtssaal } from "@/components/Gerichtssaal";
import { VideoSzene } from "@/components/VideoSzene";
import { Verwandlung } from "@/components/Verwandlung";
import { VerdachtsMeldung, type Verdachtsmeldung } from "@/components/VerdachtsMeldung";
import { NotizbuchScreen } from "@/components/NotizbuchScreen";
import { OrtScreen } from "@/components/OrtScreen";
import { StartScreen } from "@/components/StartScreen";
import { VerdaechtigeScreen } from "@/components/VerdaechtigeScreen";
import { useAdmin } from "@/lib/adminStore";
import { arcAbspann, type Arc } from "@/lib/arcTypen";
import { mitVerhandlung } from "@/lib/sagaFinale";
import { ladeSagas } from "@/lib/db";
import { spieleSofort, tonFreigeben } from "@/lib/introAudio";
import {
  artFuerAuftritt,
  besessen,
  geschenkFuerKapitel,
  musikFuerKapitel,
  neueGesichter,
  neuImSaal,
  sagaBesetzung,
  sagaMitVerhandlung,
  tonFuerAuftritt,
  warFrueherDa,
  wetterFuerKapitel,
  type Saga,
} from "@/lib/sagaTypen";
import type { Character } from "@/lib/types";
import { useLaden } from "@/lib/useLaden";
import { wirkungVon, type Zubehoer } from "@/lib/zubehoer";
import { useArcLauf } from "@/lib/useArcLauf";
import { useBeutel } from "@/lib/useBeutel";
import { useGame, type Abdruecke } from "@/lib/useGame";
import { useSagaLauf } from "@/lib/useSagaLauf";

export default function Home() {
  const spiel = useGame();
  const { daten: admin } = useAdmin();
  const [tab, setTab] = useState<Tab>("ort");
  const [chatMit, setChatMit] = useState<string | null>(null);
  const [beschuldigenOffen, setBeschuldigenOffen] = useState(false);
  const [phase, setPhase] = useState<"aus" | "prolog" | "intro">("aus");
  const [kampagnenOffen, setKampagnenOffen] = useState(false);
  const [sagenOffen, setSagenOffen] = useState(false);
  const [arcsOffen, setArcsOffen] = useState(false);
  const [ladenOffen, setLadenOffen] = useState(false);
  /** Der Inhalt des Ladens - die Beschreibungen kommen aus der Datenbank. */
  const zubehoer = useLaden();
  /**
   * Eingesetztes Zubehör, das auf die nächste Antwort wartet.
   * Charakter-Id -> Wirkung; verbraucht wird beim Absenden der Frage.
   */
  const [wirkt, setWirkt] = useState<Record<string, string>>({});
  /** Geschärfter Spürsinn fürs nächste Umsehen. */
  const [spuersinn, setSpuersinn] = useState(false);
  /** Die Tasche im Fall - eine Klappe unter der Kopfzeile. */
  const [tascheOffen, setTascheOffen] = useState(false);
  /** Das Ergebnis des Fingerabdrucksets - liegt über dem Schauplatz. */
  const [abdruckSchau, setAbdruckSchau] = useState<Abdruecke | null>(null);
  const [arcMeldung, setArcMeldung] = useState<string | null>(null);
  /**
   * Der Arc liegt beiseite, ohne beendet zu sein: Der Fortschritt bleibt
   * gespeichert, das Hauptmenü ist wieder erreichbar. Über "Arcs" geht es
   * weiter.
   */
  const [arcRuht, setArcRuht] = useState(false);
  /** Wer gleich zum ersten Mal mitspielt - wird vor dem Kapitel angekündigt. */
  const [neuling, setNeuling] = useState<{ tiere: Character[]; finale: boolean } | null>(null);
  /** Die Reaktion des Beschuldigten - steht zwischen Beschuldigung und Urteil. */
  const [reaktion, setReaktion] = useState<{ charakterId: string; text: string } | null>(null);
  /** Die Verwandlung vor dem Finale - läuft, sobald sie gesetzt ist. */
  const [verwandlung, setVerwandlung] = useState(false);
  /** Der Einzug des Gerichts - kommt zwischen Erzähler und Saal. */
  const [einzug, setEinzug] = useState(false);
  /**
   * Was an dieser Saga fehlt - steht statt eines stillen Weiterblätterns da.
   * Lieber ein ehrlicher Satz als ein verschlucktes Finale.
   */
  const [sagaFehlt, setSagaFehlt] = useState<string | null>(null);
  const [verdachtsMeldung, setVerdachtsMeldung] = useState<Verdachtsmeldung | null>(null);
  const saga = useSagaLauf();
  const arc = useArcLauf();
  const geld = useBeutel();

  const { stand, geladen, laedt, schritt, fehler, setFehler } = spiel;

  /**
   * Bewegt sich ein Verdacht, fährt rechts kurz eine Meldung herein. Verglichen
   * wird mit dem letzten Stand; beim ersten Fall gibt es nichts zu vergleichen.
   */
  const verdachtVorher = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const jetzt = stand.verdacht;
    const vorher = verdachtVorher.current;
    verdachtVorher.current = jetzt;
    if (!vorher || !stand.fall) return;

    for (const [id, wert] of Object.entries(jetzt)) {
      const alt = vorher[id];
      if (alt === undefined || alt === wert) continue;
      const charakter = stand.fall.besetzung.find((c) => c.id === id);
      if (!charakter) continue;
      setVerdachtsMeldung({
        id: Date.now(),
        charakter,
        richtung: wert > alt ? "hoch" : "runter",
        wert,
      });
      // Nur die stärkste Bewegung zeigen - zwei Meldungen übereinander wären
      // Krach statt Information.
      break;
    }
  }, [stand.verdacht, stand.fall]);

  // Stabile Rückmeldungen: sonst starten Prolog und Intro bei jedem Render neu.
  const prologFertig = useCallback(() => setPhase("intro"), []);
  const introFertig = useCallback(() => setPhase("aus"), []);
  const sagaSetzePhase = saga.setzePhase;
  const sagaAuftakt = useCallback(() => sagaSetzePhase("auftakt"), [sagaSetzePhase]);
  const arcSetzePhase = arc.setzePhase;
  const arcUebersicht = useCallback(() => arcSetzePhase("uebersicht"), [arcSetzePhase]);

  /**
   * Der gesprochene Prolog startet sofort im Klick - iOS erlaubt das Abspielen
   * nur direkt aus einer Nutzergeste heraus, ein await davor verwirkt sie.
   * Der Fall wird parallel erzeugt; ist er beim Ende des Prologs noch nicht da,
   * wartet die Intro-Phase kurz mit "Die Akte wird geöffnet …".
   */
  const fallStarten = async () => {
    // Die Freigabe gehört in jeden Klick, der ein Spiel beginnt - auch ohne
    // Intro, sonst bleibt die Siegermusik am Ende stumm.
    void tonFreigeben();
    if (admin.einstellungen.intro) {
      spieleSofort("prolog");
      setPhase("prolog");
    }
    const geklappt = await spiel.neuerFall();
    if (!geklappt) setPhase("aus");
  };

  /** Vorbereiteter Fall aus der Datenbank - startet ohne Modellaufruf. */
  const kampagneStarten = (kampagne: Parameters<typeof spiel.kampagneStarten>[0]) => {
    void tonFreigeben();
    if (admin.einstellungen.intro) spieleSofort("prolog");
    spiel.kampagneStarten(kampagne);
    setKampagnenOffen(false);
    if (admin.einstellungen.intro) setPhase("prolog");
  };

  /* --- Sagas: Erzählerteile und Kapitel ------------------------------ */

  /**
   * Der Lohn: 100 ¥ für jeden gelösten Fall.
   *
   * Verbucht wird über die Fall-Id, und der Beutel merkt sich, wofür schon
   * gezahlt wurde - derselbe Fall zahlt also nie zweimel, egal wie oft dieser
   * Bildschirm neu gezeichnet wird.
   */
  const fallGeloest = geld.fallGeloest;
  useEffect(() => {
    if (stand.status === "beendet" && stand.ergebnis?.richtig && stand.fall) {
      fallGeloest(stand.fall.id);
    }
  }, [stand.status, stand.ergebnis?.richtig, stand.fall, fallGeloest]);

  /**
   * Was Wimpy gerade dabeihat - gefiltert danach, wo es überhaupt wirkt.
   * Ein Spürsinn-Fläschchen gehört nicht ins Gespräch, das Serum nicht an
   * den Schauplatz.
   */
  const tascheFuer = (wo: "gespraech" | "fall") =>
    zubehoer
      .filter((z) => (geld.beutel.vorrat[z.id] ?? 0) > 0 && wirkungVon(z.wirkung)?.wo === wo)
      .map((stueck) => ({ stueck, anzahl: geld.beutel.vorrat[stueck.id] ?? 0 }));

  /**
   * Ein Stück Zubehör einsetzen.
   *
   * Verbraucht wird sofort - wer es aus der Tasche nimmt, hat es benutzt.
   * Was danach passiert, hängt an der Wirkung: Das Gespräch merkt sich die
   * nächste Antwort, der Spürsinn das nächste Umsehen, und eine zusätzliche
   * Beschuldigung wirkt auf der Stelle.
   */
  const einsetzen = (stueck: Zubehoer, charakterId?: string) => {
    const wirkung = wirkungVon(stueck.wirkung);
    if (!wirkung) return;

    // Ein zweites Set am selben Tatort fände dieselben zwei Abdrücke - das
    // wäre teuer bezahlte Wiederholung. Also gar nicht erst verbrauchen.
    if (stueck.wirkung === "abdruecke" && stand.abdruecke.length > 0) {
      setFehler(
        "Die Abdrücke von diesem Tatort hast du schon - sie stehen im Notizbuch.",
      );
      return;
    }

    geld.verbrauchen(stueck.id);

    if (wirkung.wo === "gespraech" && charakterId) {
      setWirkt((alt) => ({ ...alt, [charakterId]: stueck.wirkung }));
      return;
    }
    if (stueck.wirkung === "spuersinn") {
      setSpuersinn(true);
      return;
    }
    if (stueck.wirkung === "abdruecke") {
      void spiel.abdrueckeNehmen().then((gefunden) => {
        if (gefunden) setAbdruckSchau(gefunden);
      });
      return;
    }
    if (stueck.wirkung === "beschuldigung") spiel.extraBeschuldigung();
  };

  /** Läuft gerade der Fall, der zur Saga gehört? */
  const sagaFallLaeuft = Boolean(
    saga.stand && stand.fall && stand.fall.id === saga.stand.lauf.fallId,
  );

  /**
   * Das Wetter über dem laufenden Kapitel.
   *
   * Es hängt am Kapitel, nicht am Ort: Wer durch die Schauplätze läuft, hat
   * dieselbe Lage über sich, bis das Kapitel vorbei ist. Außerhalb einer Saga
   * bleibt es bei der Einstellung im Admin-Menü.
   */
  const sagaWetter =
    sagaFallLaeuft && saga.stand
      ? wetterFuerKapitel(
          saga.stand.saga.vorgaben,
          // Das Finale steht hinter den Kapiteln.
          saga.stand.lauf.phase === "finale"
            ? saga.stand.saga.vorgaben.kapitelAnzahl
            : saga.stand.lauf.kapitel,
          admin.einstellungen.wetter,
        )
      : undefined;

  /**
   * Die Hintergrundmusik über dem laufenden Fall - dieselbe Rechnung wie
   * beim Wetter: Ein Kapitel darf sie überschreiben, sonst gilt, was im
   * Admin-Menü steht. Leer heißt überall: keine Musik.
   */
  const laufendeMusik =
    sagaFallLaeuft && saga.stand
      ? musikFuerKapitel(
          saga.stand.saga.vorgaben,
          saga.stand.lauf.phase === "finale"
            ? saga.stand.saga.vorgaben.kapitelAnzahl
            : saga.stand.lauf.kapitel,
          admin.einstellungen.musik,
        )
      : admin.einstellungen.musik;

  /**
   * Das Geschenk nach einem gelösten Kapitel.
   *
   * Alles daran ist freiwillig, und jede Lücke ist erlaubt: Wer nichts
   * einträgt, bekommt nichts; wer es nur für das dritte Kapitel einträgt,
   * bekommt es auch nur dort. Steht der Gegenstand nicht mehr im Laden,
   * passiert schlicht nichts - lieber kein Geschenk als ein Fehler.
   *
   * Verbucht wird über Saga und Kapitelnummer: Dasselbe Kapitel noch einmal
   * zu spielen bringt kein zweites Exemplar.
   */
  const geschenkErhalten = geld.geschenkErhalten;
  useEffect(() => {
    if (stand.status !== "beendet" || !stand.ergebnis?.richtig) return;
    if (!saga.stand || !stand.fall) return;
    const { saga: sagaDaten, lauf } = saga.stand;
    if (stand.fall.id !== lauf.fallId) return;

    // Dieselbe Zählung wie beim Wetter: Das Finale steht hinter den Kapiteln.
    const index =
      lauf.phase === "finale" ? sagaDaten.vorgaben.kapitelAnzahl : lauf.kapitel;
    const id = geschenkFuerKapitel(sagaDaten.vorgaben, index);
    if (!id) return;

    const stueck = zubehoer.find((z) => z.id === id);
    if (!stueck) return;

    geschenkErhalten(
      `geschenk:${sagaDaten.id}:${index}`,
      stueck,
      lauf.phase === "finale" ? "Ein Geschenk zum Abschluss" : `Geschenk für Kapitel ${index + 1}`,
    );
  }, [
    stand.status,
    stand.ergebnis?.richtig,
    stand.fall,
    saga.stand,
    zubehoer,
    geschenkErhalten,
  ]);

  const sagaStarten = (gewaehlt: Saga, vonVorn: boolean) => {
    void tonFreigeben();
    setSagenOffen(false);

    const weiter = !vonVorn && saga.stand?.saga.id === gewaehlt.id;
    if (!weiter) {
      saga.starten(gewaehlt, true);
      return;
    }

    saga.starten(gewaehlt, false);
    const phase = saga.stand!.lauf.phase;

    if (phase === "fall" || phase === "finale") {
      if (sagaFallLaeuft) {
        // Der Fall liegt nur pausiert herum - einfach weiterspielen.
        if (stand.status === "pausiert") spiel.fortsetzen();
      } else {
        // Das Kapitel wurde abgebrochen: noch einmal vom Erzählerteil an.
        saga.setzePhase(phase === "finale" ? "finale-erzaehler" : "erzaehler", null);
      }
    }
  };

  /**
   * Den Fall des aktuellen Kapitels (oder das Finale) beginnen.
   *
   * Stößt hier jemand zum ersten Mal dazu, kommt erst die Ansage - danach
   * ruft sie diese Funktion noch einmal auf, dann mit `angekuendigt`.
   */
  const sagaFallStarten = (finale: boolean, angekuendigt = false) => {
    void tonFreigeben();
    if (!saga.stand) return;

    // Läuft die Saga in einen Gerichtssaal, gibt es keinen Finalfall mehr -
    // die Ansagen davor (Verwandlung, neue Gesichter) bleiben aber dieselben.
    const saal = finale ? sagaMitVerhandlung(saga.stand.saga) : null;
    const quelle = finale
      ? saga.stand.saga.finale
      : saga.stand.saga.kapitel[saga.stand.lauf.kapitel];

    /*
     * Sollte eine Verhandlung kommen, ist aber keine da, wird NICHT einfach
     * weitergeblättert. Genau das ist einmal passiert: Vom Erzählertext ging
     * es direkt in den Epilog, das ganze Finale fiel aus, und niemand erfuhr,
     * warum. Lieber ehrlich stehen bleiben und sagen, was fehlt.
     */
    if (finale && !saal && mitVerhandlung(saga.stand.saga.vorgaben.finaleArt)) {
      setSagaFehlt(
        "Zu dieser Saga fehlt die Verhandlung - der Gerichtssaal wurde beim Erzeugen nicht fertig. Im Admin-Menü lässt sie sich unter „Sagas“ nachliefern, ohne die Saga neu zu erzeugen.",
      );
      return;
    }

    if (!saal && (!quelle?.fall || !quelle.siegel)) {
      saga.setzePhase(finale ? "epilog" : "erzaehler");
      return;
    }

    if (!angekuendigt) {
      // Vor dem Finale bricht der Dämon aus seinem Wirt - das ist der eine
      // Auftritt, der keine Ansage bekommt, sondern eine Verwandlung.
      //
      // Nicht so beim Finale "Gericht & Dämon": Dort ist die Verwandlung der
      // Lohn für die richtige Anklage und gehört in den Saal, nicht davor.
      const besessenheit = besessen(saga.stand.saga.vorgaben);
      if (finale && besessenheit && saal?.art !== "gericht-daemon") {
        setVerwandlung(true);
        return;
      }

      const neue = (
        saal
          ? // Vor dem Saal gibt es keinen Finalfall, mit dem sich vergleichen
            // ließe: Neu ist, wer in keinem Kapitel dabei war. Wo der Spieler
            // selbst anklagt, steht dort niemand - eine Ansage würde die
            // Anklage vorwegnehmen.
            neuImSaal(saga.stand.saga, saal.bankId ?? "")
          : neueGesichter(saga.stand.saga, finale ? -1 : saga.stand.lauf.kapitel)
      ).filter(
        // Die Dämonenform kündigt sich nie als "neuer Spieler" an.
        (c) => c.id !== besessenheit?.daemonId,
      );
      if (neue.length > 0) {
        setNeuling({ tiere: neue, finale });
        return;
      }
    }

    if (saal) {
      // Erst das Gericht ankündigen - Öhö flattert herein -, dann der Saal.
      setEinzug(true);
      return;
    }

    spiel.fertigenFallStarten(
      quelle!.fall!,
      quelle!.siegel!,
      saga.stand.saga.vorgaben.beschuldigungen,
    );
    saga.setzePhase(finale ? "finale" : "fall", quelle!.fall!.id);
  };

  /* --- Arcs: mehrere Sagen unter einem Bogen -------------------------- */

  /** Gehört die laufende Saga zur aktuellen Station des Arcs? */
  const sagaGehoertZumArc = Boolean(
    arc.stand && saga.stand && arc.stand.lauf.sagaId === saga.stand.saga.id,
  );

  const arcStarten = (gewaehlt: Arc, vonVorn: boolean) => {
    void tonFreigeben();
    setArcsOffen(false);
    setArcMeldung(null);
    setArcRuht(false);

    const weiter = !vonVorn && arc.stand?.arc.id === gewaehlt.id;
    if (!weiter) {
      // Der Titelsong startet direkt im Klick - iOS lässt Ton nur so zu.
      spieleSofort(themeVon(gewaehlt));
      arc.starten(gewaehlt, true);
      return;
    }

    // Weiterspielen führt immer in die Übersicht - von dort sieht man, was
    // ansteht, und nimmt auch eine pausierte Saga wieder auf.
    arc.starten(gewaehlt, false);
  };

  /**
   * Liegt ein Fall dieses Arcs pausiert herum? Dann heißt der Knopf in der
   * Übersicht "Weiterspielen" statt "Saga beginnen".
   */
  const arcPausiert =
    arc.stand && saga.stand && stand.status === "pausiert" && sagaFallLaeuft
      ? (arc.stand.arc.teile.find((t) => t.sagaId === saga.stand?.saga.id)?.nummer ?? null)
      : null;

  /**
   * Eine Station beginnen: erst der Erzählertext, dann ihre Saga.
   *
   * Wer sie schon angefangen und pausiert hat, landet direkt wieder im Fall -
   * der Erzähler war ja schon dran.
   */
  const arcTeilStarten = (index: number) => {
    void tonFreigeben();
    if (!arc.stand) return;
    const teil = arc.stand.arc.teile[index];
    if (!teil?.sagaId) {
      setArcMeldung("Dieser Teil wird noch vorbereitet.");
      return;
    }
    setArcMeldung(null);

    if (arcPausiert === teil.nummer && saga.stand) {
      arc.setzePhase("saga", saga.stand.saga.id);
      spiel.fortsetzen();
      return;
    }
    arc.waehleTeil(index);
  };

  /** Die Saga der aktuellen Station holen und starten. */
  const arcSagaStarten = async () => {
    void tonFreigeben();
    if (!arc.stand) return;
    const teil = arc.stand.arc.teile[arc.stand.lauf.teil];
    if (!teil?.sagaId) {
      setArcMeldung("Dieser Teil wird noch vorbereitet.");
      return;
    }
    setArcMeldung(null);
    try {
      const { daten } = await ladeSagas();
      const gefunden = daten.find((s) => s.id === teil.sagaId);
      if (!gefunden) {
        setArcMeldung("Die Saga zu diesem Teil ist gerade nicht abrufbar.");
        return;
      }
      // Eine angefangene Saga läuft weiter, wo sie stand.
      saga.starten(gefunden, saga.stand?.saga.id !== gefunden.id);
      arc.setzePhase("saga", gefunden.id);
    } catch {
      setArcMeldung("Die Saga zu diesem Teil konnte nicht geladen werden.");
    }
  };

  /**
   * Das Finale einer schon abgeschlossenen Station nachholen.
   *
   * Fiel es beim ersten Durchgang aus - etwa, weil die Verhandlung
   * unvollständig gespeichert war -, muss deshalb niemand die ganze Saga noch
   * einmal spielen. Es geht direkt beim Erzählertext vor dem Finale los.
   * Am Fortschritt des Arcs ändert das nichts: Die Station ist ja schon
   * abgehakt, und mehr als einmal wird sie nicht gezählt.
   */
  const arcFinaleNachholen = async (index: number) => {
    void tonFreigeben();
    if (!arc.stand) return;
    const teil = arc.stand.arc.teile[index];
    if (!teil?.sagaId) return;
    setArcMeldung(null);
    try {
      const { daten } = await ladeSagas();
      const gefunden = daten.find((s) => s.id === teil.sagaId);
      if (!gefunden) {
        setArcMeldung("Die Saga zu diesem Teil ist gerade nicht abrufbar.");
        return;
      }
      arc.waehleTeil(index);
      saga.nurFinale(gefunden);
      arc.setzePhase("saga", gefunden.id);
    } catch {
      setArcMeldung("Die Saga zu diesem Teil konnte nicht geladen werden.");
    }
  };

  /** Eine Saga des Arcs ist durch - weiter zur nächsten Station. */
  const arcWeiter = () => {
    void tonFreigeben();
    saga.beenden();
    spiel.aufgeben();
    arc.teilGeschafft();
  };

  if (!geladen || !saga.geladen || !arc.geladen) {
    return <main className="app" />;
  }

  // Die Auszahlung: Sie kommt über allem und wartet, bis man weitertippt.
  if (geld.lohn) {
    return (
      <main className="app">
        <LohnSchau
          betrag={geld.lohn.betrag}
          grund={geld.lohn.grund}
          gesamt={geld.beutel.yen}
          onFertig={geld.lohnAbholen}
        />
      </main>
    );
  }

  // Und danach die Übergabe: erst das Geld, dann das Päckchen.
  if (geld.geschenk) {
    return (
      <main className="app">
        <GeschenkSchau
          stueck={geld.geschenk.stueck}
          grund={geld.geschenk.grund}
          onFertig={geld.geschenkAbholen}
        />
      </main>
    );
  }

  // Erst der gesprochene Prolog, dann das Intro mit dem Titelsong.
  if (phase === "prolog") {
    return (
      <main className="app">
        <Prolog onFertig={prologFertig} />
      </main>
    );
  }

  if (phase === "intro") {
    return (
      <main className="app">
        {stand.fall ? (
          <IntroSequenz fall={stand.fall} onFertig={introFertig} />
        ) : (
          // Der Prolog war schneller als die Fallerzeugung.
          <div className="prolog">
            <div className="prolog-vignette" />
            <p className="prolog-zeile" data-letzte="true">
              Die Akte wird geöffnet …
            </p>
          </div>
        )}
      </main>
    );
  }

  // Die Verwandlung vor dem Finale: aus dem Wirt bricht der Dämon.
  if (verwandlung && saga.stand && phase === "aus") {
    const besessenheit = besessen(saga.stand.saga.vorgaben);
    // Alle Tiere der Saga - auch die, die nur im Gerichtssaal stehen: Bei
    // einer Verhandlung gibt es keinen Finalfall, aus dem sich die
    // Dämonengestalt holen ließe.
    const alle = sagaBesetzung(saga.stand.saga);
    const finde = (id: string) => alle.find((c) => c.id === id);

    return (
      <main className="app">
        <Verwandlung
          wirt={finde(besessenheit?.wirtId ?? "")}
          daemon={finde(besessenheit?.daemonId ?? "")}
          ton={besessenheit?.ton ?? ""}
          onFertig={() => {
            setVerwandlung(false);
            sagaFallStarten(true, true);
          }}
        />
      </main>
    );
  }

  // Der Einzug des Gerichts - die Ankündigung vor der Verhandlung.
  if (einzug && saga.stand && phase === "aus") {
    const saal = sagaMitVerhandlung(saga.stand.saga);
    const richter = sagaBesetzung(saga.stand.saga).find((c) => c.id === saal?.richterId);
    return (
      <main className="app">
        <Gerichtseinzug
          richter={richter}
          ton={saga.stand.saga.vorgaben.gerichtTon}
          onFertig={() => {
            setEinzug(false);
            saga.setzePhase("verhandlung", null);
          }}
        />
      </main>
    );
  }

  // "Ein neuer Spieler betritt das Feld!" - direkt vor dem Kapitel.
  if (neuling && phase === "aus") {
    return (
      <main className="app">
        <NeuerSpieler
          tiere={neuling.tiere}
          art={(charakterId) =>
            artFuerAuftritt(
              charakterId,
              saga.stand?.saga.vorgaben,
              neuling.tiere.find((c) => c.id === charakterId),
            )
          }
          zurueck={(charakterId) =>
            Boolean(
              saga.stand &&
                warFrueherDa(
                  saga.stand.saga,
                  neuling.finale ? -1 : saga.stand.lauf.kapitel,
                  charakterId,
                ),
            )
          }
          // Erst die Saga, dann das Tier selbst, dann das Admin-Menü.
          ton={(charakterId) =>
            tonFuerAuftritt(
              charakterId,
              saga.stand?.saga.vorgaben,
              admin.einstellungen.neuzugangTon,
              neuling.tiere.find((c) => c.id === charakterId),
            )
          }
          onFertig={() => {
            const finale = neuling.finale;
            setNeuling(null);
            sagaFallStarten(finale, true);
          }}
        />
      </main>
    );
  }

  // Läuft gerade ein Fall, der nichts mit der Saga zu tun hat? Dann hat er
  // Vorrang - die Saga wartet, bis man sie über "Sagas" wieder aufnimmt.
  const fremderFallLaeuft = Boolean(
    stand.fall && stand.status !== "kein-fall" && !sagaFallLaeuft,
  );

  // Bildschirme des Arcs. Läuft gerade eine seiner Sagen, hat die Vorrang -
  // dann steht die Phase auf "saga" und der Block darunter übernimmt.
  if (
    arc.stand &&
    !arcRuht &&
    arc.stand.lauf.phase !== "saga" &&
    phase === "aus" &&
    !fremderFallLaeuft
  ) {
    const { arc: arcDaten, lauf } = arc.stand;
    const teil = arcDaten.teile[lauf.teil];

    if (lauf.phase === "vorspann") {
      return (
        <main className="app">
          <ArcVorspann arc={arcDaten} onFertig={arcUebersicht} />
        </main>
      );
    }

    if (lauf.phase === "uebersicht") {
      return (
        <main className="app">
          <ArcUebersicht
            arc={arcDaten}
            lauf={lauf}
            pausiert={arcPausiert}
            onStarten={arcTeilStarten}
            onFinaleNachholen={(i) => void arcFinaleNachholen(i)}
            onFinale={() => arc.setzePhase("finale")}
            // Der Arc bleibt liegen - über "Arcs" geht es später weiter.
            onSchliessen={() => setArcRuht(true)}
          />
          {arcMeldung && <p className="fehler schwebend">{arcMeldung}</p>}
        </main>
      );
    }

    if (lauf.phase === "finale") {
      // Endet der Arc mit einem Abspann, läuft das Video bildschirmfüllend -
      // und danach ist Schluss, ohne Erzählertext.
      const abspann = arcAbspann(arcDaten);
      if (abspann) {
        return (
          <main className="app">
            <VideoSzene quelle={abspann} onFertig={arc.beenden} />
          </main>
        );
      }

      // Ein Abspann, der noch fehlt: Der Arc endet trotzdem sauber, und das
      // Video lässt sich jederzeit nachtragen.
      if (arcDaten.finale.art === "video") {
        return (
          <main className="app">
            <ErzaehlerScreen
              teil={{
                ...arcDaten.finale.erzaehler,
                text:
                  arcDaten.finale.erzaehler.text.trim() ||
                  "Der Abspann ist noch nicht gedreht.\nDu hast trotzdem alles gelöst.",
              }}
              titel={`${arcDaten.name} - Ende`}
              weiterText="Zum Hauptmenü ›"
              musik="jubel"
              onWeiter={arc.beenden}
            />
          </main>
        );
      }

      return (
        <main className="app">
          <ErzaehlerScreen
            teil={arcDaten.finale.erzaehler}
            titel={`${arcDaten.name} - Finale`}
            weiterText="Zum Hauptmenü ›"
            musik="jubel"
            onWeiter={arc.beenden}
          />
        </main>
      );
    }

    // Der Erzählertext vor einer Station.
    return (
      <main className="app">
        <ErzaehlerScreen
          teil={teil?.erzaehler ?? { text: "", audio: "" }}
          titel={`${arcDaten.name} · ${teil?.name ?? "Weiter"}`}
          karte={{
            marke: `Teil ${roemisch(teil?.nummer ?? lauf.teil + 1)}`,
            name: teil?.name ?? arcDaten.name,
          }}
          weiterText={teil?.sagaId ? "Saga beginnen ›" : "Zurück zur Übersicht ›"}
          onWeiter={() => {
            if (teil?.sagaId) void arcSagaStarten();
            else arc.setzePhase("uebersicht");
          }}
        />
        {arcMeldung && <p className="fehler schwebend">{arcMeldung}</p>}
      </main>
    );
  }

  // Erzählerteile einer Saga.
  if (saga.stand && phase === "aus" && !fremderFallLaeuft) {
    const { saga: sagaDaten, lauf } = saga.stand;

    if (lauf.phase === "vorspann") {
      return (
        <main className="app">
          <SagaVorspann saga={sagaDaten} onFertig={sagaAuftakt} />
        </main>
      );
    }

    if (lauf.phase === "auftakt") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.auftakt}
            titel={sagaDaten.name}
            onWeiter={() => saga.setzePhase("erzaehler")}
          />
        </main>
      );
    }

    if (lauf.phase === "erzaehler") {
      const kapitel = sagaDaten.kapitel[lauf.kapitel];
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={kapitel.erzaehler}
            titel={`Kapitel ${kapitel.nummer}: ${kapitel.name}`}
            karte={{
              marke: `Kapitel ${roemisch(kapitel.nummer)}`,
              name: kapitel.name,
              bild: kapitel.fall?.orte[0]?.bild,
            }}
            weiterText="Fall übernehmen ›"
            onWeiter={() => sagaFallStarten(false)}
          />
        </main>
      );
    }

    if (sagaFehlt) {
      return (
        <main className="app">
          <div className="scroll">
            <div className="inhalt">
              <h1>Hier fehlt etwas</h1>
              <p className="hinweis warnung">{sagaFehlt}</p>
              <div className="knopf-reihe">
                <button
                  className="knopf aktion"
                  onClick={() => {
                    setSagaFehlt(null);
                    saga.setzePhase("epilog", null, false);
                  }}
                >
                  Trotzdem zum Abspann ›
                </button>
                <button
                  className="knopf"
                  onClick={() => {
                    setSagaFehlt(null);
                    saga.beenden();
                    spiel.aufgeben();
                  }}
                >
                  Zum Hauptmenü
                </button>
              </div>
            </div>
          </div>
        </main>
      );
    }

    if (lauf.phase === "finale-erzaehler") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.finale.erzaehler}
            titel={sagaDaten.finale.frage}
            karte={{
              marke: "Finale",
              name: sagaDaten.name,
              bild: sagaDaten.finale.fall?.orte[0]?.bild,
            }}
            weiterText={sagaMitVerhandlung(sagaDaten) ? "In den Saal ›" : "Ins Finale ›"}
            onWeiter={() => sagaFallStarten(true)}
          />
        </main>
      );
    }

    if (lauf.phase === "verhandlung") {
      const saal = sagaMitVerhandlung(sagaDaten);
      if (saal) {
        return (
          <main className="app">
            <Gerichtssaal
              verhandlung={saal}
              bogenSiegel={sagaDaten.bogenSiegel}
              besetzung={sagaBesetzung(sagaDaten)}
              frage={sagaDaten.finale.frage}
              onFertig={(geschafft) => saga.setzePhase("epilog", null, geschafft)}
            />
          </main>
        );
      }
    }

    if (lauf.phase === "epilog") {
      // 500 ¥ für eine ganze Saga - aber nur, wenn das Finale wirklich
      // geschafft ist. Verbucht wird über die Saga-Id, also genau einmal.
      if (lauf.finaleGeschafft) geld.sagaGeschafft(sagaDaten.id);
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.finale.epilog}
            titel={`${sagaDaten.name} - Ende`}
            musik={lauf.finaleGeschafft ? "jubel" : undefined}
            weiterText={sagaGehoertZumArc ? "Weiter im Arc ›" : "Zum Hauptmenü ›"}
            onWeiter={() => {
              if (sagaGehoertZumArc) {
                arcWeiter();
                return;
              }
              saga.beenden();
              spiel.aufgeben();
            }}
          />
        </main>
      );
    }
  }

  // 1. Kein Fall oder pausiert - Startbildschirm.
  if (!stand.fall || stand.status === "kein-fall" || stand.status === "pausiert") {
    return (
      <main className="app">
        <StartScreen
          onStart={() => void fallStarten()}
          onKampagnen={() => setKampagnenOffen(true)}
          onSagas={() => setSagenOffen(true)}
          onArcs={() => setArcsOffen(true)}
          onLaden={() => setLadenOffen(true)}
          yenImBeutel={geld.beutel.yen}
          // Der Laden zeigt sich erst nach dem ersten Honorar - oder wenn
          // schon etwas in der Tasche liegt, damit er nach dem Ausgeben des
          // letzten Yen nicht wieder verschwindet.
          ladenBekannt={
            geld.beutel.yen > 0 ||
            geld.beutel.bezahlt.length > 0 ||
            Object.keys(geld.beutel.vorrat).length > 0
          }
          onFortsetzen={stand.status === "pausiert" ? spiel.fortsetzen : undefined}
          laufenderFall={stand.status === "pausiert" ? stand.fall?.titel : undefined}
          laedt={laedt === "fall"}
          schritt={schritt}
          fehler={fehler}
        />

        {kampagnenOffen && (
          <KampagnenListe
            onStarten={kampagneStarten}
            onSchliessen={() => setKampagnenOffen(false)}
          />
        )}

        {arcsOffen && (
          <ArcsListe
            onStarten={arcStarten}
            onSchliessen={() => setArcsOffen(false)}
            laufend={
              arc.stand ? { arcId: arc.stand.arc.id, teil: arc.stand.lauf.teil } : null
            }
          />
        )}

        {ladenOffen && (
          <ShopScreen
            yenImBeutel={geld.beutel.yen}
            vorrat={geld.beutel.vorrat}
            onKaufen={(stueck) => geld.kaufen(stueck.id, stueck.preis)}
            onSchliessen={() => setLadenOffen(false)}
          />
        )}

        {sagenOffen && (
          <SagenListe
            onStarten={sagaStarten}
            onSchliessen={() => setSagenOffen(false)}
            laufend={
              saga.stand
                ? { sagaId: saga.stand.saga.id, kapitel: saga.stand.lauf.kapitel }
                : null
            }
          />
        )}
      </main>
    );
  }

  // Zwischen Beschuldigung und Urteil: die Reaktion des Beschuldigten.
  if (reaktion && stand.fall) {
    return (
      <main className="app">
        <ReaktionScreen
          charakter={stand.fall.besetzung.find((c) => c.id === reaktion.charakterId)}
          text={reaktion.text}
          onFertig={() => setReaktion(null)}
        />
      </main>
    );
  }

  // 2. Fall vorbei - Auflösung.
  if (stand.status === "beendet" && stand.ergebnis) {
    return (
      <main className="app">
        <ErgebnisScreen
          ergebnis={stand.ergebnis}
          besetzung={stand.fall.besetzung}
          onNeuerFall={() => void fallStarten()}
          onHauptmenue={() => {
            // Die Saga bleibt liegen - über "Sagas" geht es später weiter.
            spiel.aufgeben();
          }}
          onWeiter={
            sagaFallLaeuft
              ? () => {
                  // Gleich läuft der nächste Erzählerteil - Freigabe erneuern.
                  void tonFreigeben();
                  if (saga.stand?.lauf.phase === "finale") {
                    // Der Epilog kommt auch nach einer verlorenen Finalrunde -
                    // die Siegermusik gehört dann aber nicht dazu.
                    saga.setzePhase("epilog", null, stand.ergebnis?.richtig === true);
                  } else saga.kapitelGeschafft();
                  spiel.aufgeben();
                }
              : undefined
          }
          weiterText={
            saga.stand?.lauf.phase === "finale" ? "Epilog ›" : "Nächstes Kapitel ›"
          }
          laedt={laedt === "fall"}
        />
      </main>
    );
  }

  // 3. Laufendes Spiel.
  const chatCharakter = chatMit
    ? stand.fall.besetzung.find((c) => c.id === chatMit)
    : undefined;

  return (
    <main className="app">
      {/* Die Hintergrundmusik läuft, solange dieser Bildschirm steht - also
          am Schauplatz, bei den Verdächtigen, im Inventar, im Notizbuch und
          im Gespräch. Jede Szene mit eigener Musik ist ein anderer Zweig;
          dort pausiert sie und läuft danach an derselben Stelle weiter. */}
      <Hintergrundmusik stueck={laufendeMusik} />

      <header className={tab === "ort" ? "kopf schwebend" : "kopf"}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{stand.fall.titel}</h1>
          <p className="unterzeile">
            {stand.fall.stadt} · {stand.gefundeneSpuren.length} Spuren
          </p>
        </div>
        {/* Im Klassisch trägt das Symbol den Knopf, im Noir das Wort - beide
            stehen im Markup, das Design blendet aus, was es nicht braucht. */}
        <div className="kopf-knoepfe">
          {/* Die Tasche steht oben bei den anderen Knöpfen - sie gehört zum
              Fall, nicht zum Schauplatz, und ist von überall erreichbar.

              Und sie zeigt sich erst, wenn wirklich etwas darin ist: Wer noch
              nie einen Gegenstand bekommen hat, soll von der Möglichkeit gar
              nichts wissen. Das erste Stück ist dann eine Überraschung. */}
          {tascheFuer("fall").length > 0 && (
            <button
              className="rund-knopf tasche-knopf"
              data-offen={tascheOffen}
              onClick={() => setTascheOffen((auf) => !auf)}
              aria-label="Tasche"
              title="Tasche"
            >
              <span className="symbol">🧰</span>
              <span className="knopf-wort">Tasche</span>
              <i className="tasche-punkt" />
            </button>
          )}
          <button
            className="rund-knopf"
            onClick={spiel.pausieren}
            aria-label="Pausieren"
            title="Pausieren"
          >
            <span className="symbol">⏸</span>
            <span className="knopf-wort">Pause</span>
          </button>
          <button
            className="rund-knopf"
            onClick={() => {
              if (window.confirm("Aktuellen Fall wirklich beenden?")) spiel.aufgeben();
            }}
            aria-label="Fall beenden"
            title="Fall beenden"
          >
            <span className="symbol">✕</span>
            <span className="knopf-wort">Ende</span>
          </button>
        </div>
      </header>

      {/* Verbraucht man das letzte Stück, verschwindet die Klappe mitsamt
          dem Knopf - eine leere Tasche steht nirgends herum. */}
      {tascheOffen && tascheFuer("fall").length > 0 && (
        <div className="tasche tasche-oben">
          {tascheFuer("fall").map(({ stueck, anzahl }) => (
            <button
              key={stueck.id}
              className="tasche-stueck"
              onClick={() => {
                einsetzen(stueck);
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
                <span className="leise klein">{wirkungVon(stueck.wirkung)?.hinweis}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {abdruckSchau && stand.fall && (
        <AbdruckSchau
          abdruecke={abdruckSchau}
          besetzung={stand.fall.besetzung}
          onSchliessen={() => setAbdruckSchau(null)}
        />
      )}

      <div className={tab === "ort" ? "buehne" : "scroll"}>
        {tab === "ort" && (
          <OrtScreen
            fall={stand.fall}
            ortId={stand.ortId}
            onOrtWechsel={spiel.gehZuOrt}
            onCharakter={(id) => {
              setFehler(null);
              setChatMit(id);
            }}
            onUmsehen={async () => {
              // Geschärfter Spürsinn gilt für genau ein Umsehen.
              const wirkung = spuersinn ? "spuersinn" : undefined;
              if (spuersinn) setSpuersinn(false);
              return spiel.umsehen(wirkung);
            }}
            suchtGerade={laedt === "suche"}
            wetter={sagaWetter}
          />
        )}

        {tab === "verdaechtige" && (
          <VerdaechtigeScreen
            fall={stand.fall}
            verdacht={stand.verdacht}
            verlauf={stand.verlauf}
            notizen={stand.notizen}
            onCharakter={(id) => {
              setFehler(null);
              setChatMit(id);
            }}
            onBeschuldigen={() => {
              setFehler(null);
              setBeschuldigenOffen(true);
            }}
            beschuldigungenUebrig={stand.beschuldigungenUebrig}
          />
        )}

        {tab === "inventar" && (
          <InventarScreen
            gefundeneSpuren={stand.gefundeneSpuren}
            notizen={stand.notizen}
          />
        )}

        {tab === "notizbuch" && (
          <NotizbuchScreen notizen={stand.notizen} besetzung={stand.fall.besetzung} />
        )}
      </div>

      {fehler && tab !== "ort" && !chatMit && <p className="fehler schwebend">{fehler}</p>}

      {verdachtsMeldung && (
        <VerdachtsMeldung
          meldung={verdachtsMeldung}
          onFertig={() => setVerdachtsMeldung(null)}
        />
      )}

      <Nav aktiv={tab} onWechsel={setTab} spurenAnzahl={stand.gefundeneSpuren.length} />

      {chatMit && chatCharakter && (
        <ChatOverlay
          charakter={chatCharakter}
          detektiv={stand.fall.besetzung.find((c) => c.istDetektiv)}
          verlauf={stand.verlauf[chatMit] ?? []}
          tasche={tascheFuer("gespraech")}
          wirktGerade={
            wirkt[chatMit] ? (wirkungVon(wirkt[chatMit])?.bestaetigung ?? null) : null
          }
          onEinsetzen={(stueck) => einsetzen(stueck, chatMit)}
          onSenden={(modus, text) => {
            // Eingesetztes Zubehör wirkt auf genau diese eine Frage.
            const wirkung = wirkt[chatMit];
            if (wirkung) {
              setWirkt(({ [chatMit]: _weg, ...rest }) => rest);
            }
            return spiel.sprich(chatMit, modus, text, wirkung);
          }}
          onSchliessen={() => {
            setFehler(null);
            setChatMit(null);
          }}
          laedt={laedt === "gespraech"}
          fehler={fehler}
        />
      )}

      {beschuldigenOffen && (
        <BeschuldigenOverlay
          besetzung={stand.fall.besetzung}
          verdacht={stand.verdacht}
          versucheUebrig={stand.beschuldigungenUebrig}
          onBestaetigen={async (id, begruendung) => {
            const ergebnis = await spiel.beschuldige(id, begruendung);
            if (!ergebnis) return;
            setBeschuldigenOffen(false);
            // Erst das Gesicht und der Satz - das Urteil kommt danach.
            if (ergebnis.reaktion) setReaktion({ charakterId: id, text: ergebnis.reaktion });
          }}
          onSchliessen={() => {
            setFehler(null);
            setBeschuldigenOffen(false);
          }}
          laedt={laedt === "urteil"}
          fehler={fehler}
        />
      )}
    </main>
  );
}
