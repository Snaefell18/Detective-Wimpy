"use client";

/**
 * Zwei Designs stehen parallel zur Verfügung.
 *
 *   "klassisch" - das bisherige Aussehen: Marineblau, Neon, Glasflächen.
 *   "noir"      - das neue Kinomenü-Design: fast schwarz, Messing, Haarlinien.
 *
 * Welches gilt, steht als data-theme am <html>-Element; das Aussehen entscheidet
 * ausschließlich CSS. Im Code wird nie nach dem Design verzweigt, um etwas
 * anders zu färben - nur dort, wo sich der Aufbau wirklich unterscheidet.
 */
export type Design = "noir" | "klassisch";

export const DESIGNS: { id: Design; label: string; hinweis: string }[] = [
  { id: "noir", label: "Noir", hinweis: "schwarz, Messing, Haarlinien" },
  { id: "klassisch", label: "Klassisch", hinweis: "Marineblau, Neon, Glas" },
];

export const DESIGN_KEY = "wimpy-design";

/** Das Design, mit dem gestartet wird, solange niemand etwas gewählt hat. */
export const STANDARD_DESIGN: Design = "klassisch";

export function leseDesign(): Design {
  if (typeof document === "undefined") return STANDARD_DESIGN;
  const gesetzt = document.documentElement.dataset.theme;
  return gesetzt === "noir" || gesetzt === "klassisch" ? gesetzt : STANDARD_DESIGN;
}

export function setzeDesign(design: Design): void {
  document.documentElement.dataset.theme = design;
  try {
    window.localStorage.setItem(DESIGN_KEY, design);
  } catch {
    // Privater Modus - dann gilt die Wahl nur für diese Sitzung.
  }
}

/**
 * Läuft als erstes Skript im <head>, noch vor dem ersten Bild auf dem
 * Schirm - sonst blitzt kurz das falsche Design auf.
 */
export const DESIGN_SKRIPT = `(function(){try{
var d=localStorage.getItem(${JSON.stringify(DESIGN_KEY)});
var p=new URLSearchParams(location.search).get("design");
if(p==="noir"||p==="klassisch")d=p;
if(d==="noir"||d==="klassisch")document.documentElement.dataset.theme=d;
}catch(e){}})();`;
