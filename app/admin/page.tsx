"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminSchloss, abmelden } from "@/components/admin/AdminSchloss";
import { ArcsBereich } from "@/components/admin/ArcsBereich";
import { BilderBereich } from "@/components/admin/BilderBereich";
import { KampagnenBereich } from "@/components/admin/KampagnenBereich";
import { SagenBereich } from "@/components/admin/SagenBereich";
import { SpielBereich } from "@/components/admin/SpielBereich";
import { StammdatenBereich } from "@/components/admin/StammdatenBereich";

type Bereich = "kampagnen" | "sagen" | "arcs" | "tiere" | "orte" | "items" | "bilder" | "spiel";

const REITER: { id: Bereich; label: string }[] = [
  { id: "kampagnen", label: "Kampagnen" },
  { id: "sagen", label: "Sagas" },
  { id: "arcs", label: "Arcs" },
  { id: "tiere", label: "Tiere" },
  { id: "orte", label: "Orte" },
  { id: "items", label: "Dinge" },
  { id: "bilder", label: "Bilder" },
  { id: "spiel", label: "Spiel" },
];

/** Alles hinter dem Schloss. */
export default function AdminSeite() {
  return (
    <AdminSchloss>
      <AdminInhalt />
    </AdminSchloss>
  );
}

function AdminInhalt() {
  const [bereich, setBereich] = useState<Bereich>("kampagnen");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const melden = (text: string) => {
    setFehler(null);
    setMeldung(text);
    window.setTimeout(() => setMeldung(null), 4000);
  };

  const gemeinsam = { onMeldung: melden, onFehler: setFehler };

  return (
    <main className="app admin">
      <header className="kopf">
        <Link href="/" className="zurueck" aria-label="Zurück zum Spiel">
          ‹
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Admin</h1>
          <p className="unterzeile">Kampagnen, Stammdaten und Einstellungen</p>
        </div>
        <div className="kopf-knoepfe">
          <button
            className="rund-knopf"
            onClick={abmelden}
            aria-label="Abschließen"
            title="Abschließen"
          >
            <span className="symbol">🔒</span>
            <span className="knopf-wort">Zu</span>
          </button>
        </div>
      </header>

      <div className="reiter">
        {REITER.map((r) => (
          <button
            key={r.id}
            data-aktiv={bereich === r.id}
            onClick={() => {
              setFehler(null);
              setBereich(r.id);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="scroll">
        <div className="inhalt">
          {meldung && <p className="hinweis erfolg">{meldung}</p>}
          {fehler && <p className="fehler">{fehler}</p>}

          {bereich === "kampagnen" && <KampagnenBereich {...gemeinsam} />}
          {bereich === "sagen" && <SagenBereich {...gemeinsam} />}
          {bereich === "arcs" && <ArcsBereich {...gemeinsam} />}
          {bereich === "tiere" && <StammdatenBereich art="charaktere" {...gemeinsam} />}
          {bereich === "orte" && <StammdatenBereich art="orte" {...gemeinsam} />}
          {bereich === "items" && <StammdatenBereich art="items" {...gemeinsam} />}
          {bereich === "bilder" && <BilderBereich {...gemeinsam} />}
          {bereich === "spiel" && <SpielBereich {...gemeinsam} />}
        </div>
      </div>
    </main>
  );
}
