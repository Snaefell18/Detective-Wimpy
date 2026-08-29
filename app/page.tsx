"use client";

import { useState } from "react";
import { BeschuldigenOverlay } from "@/components/BeschuldigenOverlay";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ErgebnisScreen } from "@/components/ErgebnisScreen";
import { Nav, type Tab } from "@/components/Nav";
import { NotizbuchScreen } from "@/components/NotizbuchScreen";
import { OrtScreen } from "@/components/OrtScreen";
import { StartScreen } from "@/components/StartScreen";
import { VerdaechtigeScreen } from "@/components/VerdaechtigeScreen";
import { getLocation } from "@/lib/locations";
import { useGame } from "@/lib/useGame";

export default function Home() {
  const spiel = useGame();
  const [tab, setTab] = useState<Tab>("ort");
  const [chatMit, setChatMit] = useState<string | null>(null);
  const [beschuldigenOffen, setBeschuldigenOffen] = useState(false);

  const { stand, geladen, laedt, fehler, setFehler } = spiel;

  if (!geladen) {
    return <main className="app" />;
  }

  // 1. Noch kein Fall - Startbildschirm.
  if (!stand.fall || stand.status === "kein-fall") {
    return (
      <main className="app">
        <StartScreen
          onStart={spiel.neuerFall}
          laedt={laedt === "fall"}
          fehler={fehler}
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
          onNeuerFall={spiel.neuerFall}
          laedt={laedt === "fall"}
        />
      </main>
    );
  }

  // 3. Laufendes Spiel.
  const ort = getLocation(stand.ortId);

  return (
    <main className="app">
      <header className="kopf">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{stand.fall.titel}</h1>
          <p className="unterzeile">
            {ort?.name} · {stand.gefundeneSpuren.length} Spuren
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

      <div className="scroll">
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

        {tab === "notizbuch" && (
          <NotizbuchScreen
            gefundeneSpuren={stand.gefundeneSpuren}
            notizen={stand.notizen}
          />
        )}
      </div>

      {fehler && tab !== "ort" && !chatMit && <p className="fehler schwebend">{fehler}</p>}

      <Nav aktiv={tab} onWechsel={setTab} spurenAnzahl={stand.gefundeneSpuren.length} />

      {chatMit && (
        <ChatOverlay
          charakterId={chatMit}
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
