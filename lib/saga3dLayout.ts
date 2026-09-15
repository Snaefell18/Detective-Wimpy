/** Verteilt beliebig viele Kapitelobjekte vollständig im begehbaren Korridor. */
export function kapitelPosition(index: number, anzahl: number, art: "tier" | "spur") {
  // Beide Arten nutzen die ganze Straße; versetzte Spuren und getrennte
  // Seitenkorridore halten Beweise auch bei patrouillierenden Tieren frei.
  const fortschritt = (index + (art === "tier" ? 0.5 : 0.85)) / Math.max(1, anzahl);
  return {
    x: (index % 2 ? -1 : 1) * (art === "tier" ? 2.9 : 0.85),
    z: 12 - fortschritt * 45,
  };
}
