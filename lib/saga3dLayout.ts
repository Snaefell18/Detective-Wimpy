/** Verteilt beliebig viele Kapitelobjekte vollständig im begehbaren Korridor. */
export function kapitelPosition(index: number, anzahl: number, art: "tier" | "spur") {
  const reihen = Math.max(1, Math.ceil(anzahl / 2));
  const reihe = Math.floor(index / 2);
  return {
    x: (index % 2 ? -1 : 1) * (art === "tier" ? 3.15 : 1.65),
    z: (art === "tier" ? -4 : -1.5) - reihe * Math.min(7.4, (art === "tier" ? 27 : 30) / Math.max(1, reihen - 1)),
  };
}
