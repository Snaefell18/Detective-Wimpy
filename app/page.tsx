"use client";

import { useCallback, useState } from "react";
import { BeschuldigenOverlay } from "@/components/BeschuldigenOverlay";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ErgebnisScreen } from "@/components/ErgebnisScreen";
import { IntroSequenz } from "@/components/IntroSequenz";
import { InventarScreen } from "@/components/InventarScreen";
import { KampagnenListe } from "@/components/KampagnenListe";
import { Prolog } from "@/components/Prolog";
import { Nav, type Tab } from "@/components/Nav";
import { NotizbuchScreen } from "@/components/NotizbuchScreen";
import { OrtScreen } from "@/components/OrtScreen";
import { StartScreen } from "@/components/StartScreen";
import { VerdaechtigeScreen } from "@/components/VerdaechtigeScreen";
import { useAdmin } from "@/lib/adminStore";
import { spieleSofort, tonFreigeben } from "@/lib/introAudio";
import { useGame } from "@/lib/useGame";

export default function Home() {
  const spiel = useGame();
  const { daten: admin } = useAdmin();
  const [tab, setTab] = useState<Tab>("ort");
  const [chatMit, setChatMit] = useState<string | null>(null);
  const [beschuldigenOffen, setBeschuldigenOffen] = useState(false);
  const [phase, setPhase] = useState<"aus" | "prolog" | "intro">("aus");
  const [kampagnenOffen, setKampagnenOffen] = useState(false);

  const { stand, geladen, laedt, fehler, setFehler } = spiel;

  // Stabile Rückmeldungen: sonst starten Prolog und Intro bei jedem Render neu.
  const prologFertig = useCallback(() => setPhase("intro"), []);
  const introFertig = useCallback(() => setPhase("aus"), []);

  /**
   * Der gesprochene Prolog startet sofort im Klick - iOS erlaubt das Abspielen
   * nur direkt aus einer Nutzergeste heraus, ein await davor verwirkt sie.
   * Der Fall wird parallel erzeugt; ist er beim Ende des Prologs noch nicht da,
   * wartet die Intro-Phase kurz mit "Die Akte wird geöffnet …".
   */
  const fallStarten = async () => {
    if (admin.einstellungen.intro) {
      spieleSofort("prolog");
      void tonFreigeben();
      setPhase("prolog");
    }
    const geklappt = await spiel.neuerFall();
    if (!geklappt) setPhase("aus");
  };

  /** Vorbereiteter Fall aus der Datenbank - startet ohne Modellaufruf. */
  const kampagneStarten = (kampagne: Parameters<typeof spiel.kampagneStarten>[0]) => {
    if (admin.einstellungen.intro) {
      spieleSofort("prolog");
      void tonFreigeben();
    }
    spiel.kampagneStarten(kampagne);
    setKampagnenOffen(false);
    if (admin.einstellungen.intro) setPhase("prolog");
  };

  if (!geladen) {
    return <main className="app" />;
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

  // 1. Noch kein Fall - Startbildschirm.
  if (!stand.fall || stand.status === "kein-fall") {
    return (
      <main className="app">
        <StartScreen
          onStart={() => void fallStarten()}
          onKampagnen={() => setKampagnenOffen(true)}
          laedt={laedt === "fall"}
          fehler={fehler}
        />

        {kampagnenOffen && (
          <KampagnenListe
            onStarten={kampagneStarten}
            onSchliessen={() => setKampagnenOffen(false)}
          />
        )}
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
          onHauptmenue={spiel.aufgeben}
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
      <header className={tab === "ort" ? "kopf schwebend" : "kopf"}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{stand.fall.titel}</h1>
          <p className="unterzeile">
            {stand.fall.stadt} · {stand.gefundeneSpuren.length} Spuren
          </p>
        </div>
        <button
          className="knopf klein"
          onClick={() => {
            if (window.confirm("Aktuellen Fall wirklich aufgeben?")) spiel.aufgeben();
          }}
        >
          Aufgeben
        </button>
      </header>

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
            onUmsehen={spiel.umsehen}
            suchtGerade={laedt === "suche"}
          />
        )}

        {tab === "verdaechtige" && (
          <VerdaechtigeScreen
            fall={stand.fall}
            verdacht={stand.verdacht}
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

      <Nav aktiv={tab} onWechsel={setTab} spurenAnzahl={stand.gefundeneSpuren.length} />

      {chatMit && chatCharakter && (
        <ChatOverlay
          charakter={chatCharakter}
          detektiv={stand.fall.besetzung.find((c) => c.istDetektiv)}
          verlauf={stand.verlauf[chatMit] ?? []}
          onSenden={(modus, text) => spiel.sprich(chatMit, modus, text)}
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
            if (ergebnis) setBeschuldigenOffen(false);
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
