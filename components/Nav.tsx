"use client";

export type Tab = "ort" | "verdaechtige" | "notizbuch";

const TABS: { id: Tab; symbol: string; label: string }[] = [
  { id: "ort", symbol: "🗺️", label: "Orte" },
  { id: "verdaechtige", symbol: "🐾", label: "Verdächtige" },
  { id: "notizbuch", symbol: "📓", label: "Notizbuch" },
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
          <span>
            {tab.label}
            {tab.id === "notizbuch" && spurenAnzahl > 0 ? ` (${spurenAnzahl})` : ""}
          </span>
        </button>
      ))}
    </nav>
  );
}
