"use client";

export type Tab = "ort" | "verdaechtige" | "inventar" | "notizbuch";

const TABS: { id: Tab; symbol: string; label: string }[] = [
  { id: "ort", symbol: "🗺️", label: "Orte" },
  { id: "verdaechtige", symbol: "🐾", label: "Tiere" },
  // Der alte Reiter, neuer Inhalt: Hier liegt die Beweismitteltasche.
  { id: "inventar", symbol: "🎒", label: "Beweise" },
  { id: "notizbuch", symbol: "📓", label: "Notizen" },
];

export function Nav({
  aktiv,
  onWechsel,
  spurenAnzahl,
  spurenMax,
}: {
  aktiv: Tab;
  onWechsel: (tab: Tab) => void;
  /** Wie viele Beweismittel in der Tasche liegen. */
  spurenAnzahl: number;
  /** Wie viele hineinpassen - dann steht am Reiter "3/6". */
  spurenMax?: number;
}) {
  return (
    <nav className="nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          data-aktiv={tab.id === aktiv}
          onClick={() => onWechsel(tab.id)}
          aria-label={tab.label}
        >
          <span className="symbol">{tab.symbol}</span>
          <span className="nav-text">
            {tab.label}
            {tab.id === "inventar" && spurenAnzahl > 0 && (
              <span className="nav-zaehler">
                {spurenMax ? `${spurenAnzahl}/${spurenMax}` : spurenAnzahl}
              </span>
            )}
          </span>
        </button>
      ))}
    </nav>
  );
}
