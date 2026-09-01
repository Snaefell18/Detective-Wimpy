"use client";

export type Tab = "ort" | "verdaechtige" | "inventar" | "notizbuch";

const TABS: { id: Tab; symbol: string; label: string }[] = [
  { id: "ort", symbol: "🗺️", label: "Orte" },
  { id: "verdaechtige", symbol: "🐾", label: "Tiere" },
  { id: "inventar", symbol: "🎒", label: "Inventar" },
  { id: "notizbuch", symbol: "📓", label: "Notizen" },
];

export function Nav({
  aktiv,
  onWechsel,
  spurenAnzahl,
}: {
  aktiv: Tab;
  onWechsel: (tab: Tab) => void;
  spurenAnzahl: number;
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
              <span className="nav-zaehler">{spurenAnzahl}</span>
            )}
          </span>
        </button>
      ))}
    </nav>
  );
}
