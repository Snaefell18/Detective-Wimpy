# Handoff: Detective Wimpy — Redesign „Noir"

## Overview
Vollständiges visuelles Redesign von **Detective Wimpy** (Next.js 15 App Router, React 19,
TypeScript, Firebase, Anthropic SDK). Die Spiellogik bleibt unverändert — es geht
ausschließlich um Darstellung.

**Noir** ist ein minimalistisches Kinomenü-Design: fast schwarzer Grund, das jeweilige
Szenenbild großflächig dahinter, alles Weitere ist Typografie. Schwere Condensed-Grotesk mit
harter Extrusion für Titel, dünne gesperrte Kapitälchen für Labels und Listen. Keine Flächen,
keine Rahmen, keine Radien — nur Haarlinien. Genau **ein** Akzent: Messing `#c2913f`.

Das ist eine eigenständige Interpretation des Detektiv-Noir-Genres, **keine Nachbildung eines
existierenden Spiels**.

**Das Bildmaterial trägt das Design.** Anders als im IST-Zustand, wo Bilder in Kästen und
hinter Glasflächen sitzen, ist hier jedes Bild **ganzseitig** und die Typografie liegt darauf.
Deshalb gilt für dieses Redesign eine harte Regel: **an jedem Ort ist das Ortsbild der
Bildschirm**, und im Gespräch sind **beide** Figuren zu sehen — die Befragte ganzseitig, Wimpy
als Silhouette im Vordergrund. Details im Abschnitt „Bilder".

## About the Design Files
Die Dateien in diesem Bündel sind **Design-Referenzen in HTML** — Prototypen, die Aussehen und
Verhalten zeigen, **kein Produktionscode zum Kopieren**. Aufgabe ist, die Screens im
bestehenden Next-Projekt neu zu stylen: die vorhandenen Komponenten in `components/` und die
semantischen Klassen in `app/globals.css` behalten, ihr Aussehen ersetzen. Werte übernehmen
(Hex, px, Sperrung, Schriftschnitte), Markup nicht.

Die Referenz nutzt Inline-Styles, weil sie ein Prototyp ist. Im Projekt gehört alles in die
Theme-Struktur aus dem Abschnitt „Zwei Designs parallel".

## Fidelity
**High-fidelity (hifi).** Farben, Typografie, Abstände, Sperrungen und Copy sind final und
sollen pixelnah übernommen werden.

**Ausnahme: die Bildflächen.** In der Referenz sind sie graue Streifenmuster mit
Weichzeichner — reine Platzhalter, damit man sieht, wo das Bild liegt und wie dunkel es sein
muss. Im echten Spiel stehen dort die Fotos aus `public/`. Der Weichzeichner der Referenz gilt
**nur** für das Titelbild im Hauptmenü; alle anderen Bilder sind scharf (s. u.).

---

## Zwei Designs parallel — Noir wird Standard, das alte bleibt erhalten

Ziel: Noir ist das Design, das jeder sieht. Das bisherige Design (dunkelblau, Neon, Glas)
bleibt vollständig funktionsfähig und ist per Umschalter wieder da. Kein „Design entfernen und
hoffen, dass Git es rettet".

**Vor dem ersten Commit:**
```bash
git tag pre-noir            # Rücksprung auf den IST-Zustand ist damit immer möglich
git switch -c redesign/noir
```

**Struktur.** `app/globals.css` (~54 kB) wird in drei Dateien geteilt:

| Datei | Inhalt |
|---|---|
| `app/globals.css` | Struktur: Layout, Flex/Grid, Größen, Positionen, Safe Areas, Scroll — **keine** Farben, **keine** Schriftfamilien, **keine** Radien/Schatten. Importiert die beiden Theme-Dateien. |
| `app/themes/klassisch.css` | `[data-theme="klassisch"] { … }` — die heutigen Variablenwerte **und** die heutigen Radien, Schatten, Glaseffekte, Verläufe. Wird nur inhaltlich verschoben, nicht geändert. |
| `app/themes/noir.css` | `[data-theme="noir"] { … }` — die Noir-Werte aus diesem Dokument. |

Jede optische Eigenschaft, die zwischen den Designs unterschiedlich ist, läuft über eine
Variable — auch Radien, Schatten, Rahmen und Schriftfamilien:

```css
[data-theme="klassisch"] {
  --grund: #050f22;  --flaeche: #102a4e;  --rand: #2d5a88;
  --text: #eaf3ff;   --text-leise: #9db8dc;
  --akzent: #f79320; --signal: #e4322b;
  --radius: 14px;    --schatten: 0 10px 30px rgba(0,0,0,.45);
  --glas: blur(12px);
  --f-display: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --f-text: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
}
[data-theme="noir"] {
  --grund: #080808;  --flaeche: transparent; --rand: rgba(239,233,221,.16);
  --text: #efe9dd;   --text-leise: #8e8a83;
  --akzent: #c2913f; --signal: #c2913f;
  --radius: 0;       --schatten: none;
  --glas: none;
  --f-display: "Big Shoulders Display", "Barlow Condensed", sans-serif;
  --f-text: "Barlow Condensed", system-ui, sans-serif;
}
```

**Umschalten.** `data-theme` auf `<html>`:
- Default `"noir"`, gesetzt serverseitig in `app/layout.tsx`
  (`<html lang="de" data-theme="noir">`), damit es keinen Flash gibt.
- Nutzerwahl in `localStorage` unter `wimpy-design` (`"noir" | "klassisch"`), gelesen von
  einem kleinen Inline-Skript im `<head>`, das das Attribut vor dem ersten Paint korrigiert.
- Neues Modul `lib/design.ts`: `type Design = "noir" | "klassisch"`, `leseDesign()`,
  `setzeDesign(d)` (schreibt Attribut + localStorage).
- **Umschalter im Admin-Bereich** (`components/admin/SpielBereich.tsx`): zwei Knöpfe
  „Noir" / „Klassisch". Der Admin-Bereich ist Werkzeug und bleibt im Klassisch-Look — dort
  reicht die Palette, keine Noir-Typografie.
- Optional, wenn du es sauber magst: `?design=klassisch` als Query-Parameter für schnelles
  Vergleichen ohne Admin-Umweg.

**Regeln, damit das nicht verrottet:**
1. Kein Komponentencode enthält Hex-Werte, Radien, Schatten oder Schriftnamen — alles `var()`.
2. Kein Theme-Check in JS (`if (design === "noir")`) für Optik. Nur CSS entscheidet über
   Aussehen. JS-Verzweigung ist ausschließlich erlaubt, wo sich die *Struktur* unterscheidet
   (siehe „Strukturelle Unterschiede").
3. Neue Regeln kommen in `globals.css` (Struktur) oder in **beide** Theme-Dateien — nie nur in
   eine.
4. `npm run build` muss in beiden Themes durchlaufen; einmal von Hand beide Themes durchklicken.

**Strukturelle Unterschiede** (die einzigen Stellen, an denen Noir mehr als Optik ändert —
im Klassisch-Theme muss das alte Verhalten erhalten bleiben):
- **Navigation:** Noir hat Text-Tabs ohne Icons, Klassisch hat die Emoji-Tabs. Lösung:
  `Nav.tsx` rendert immer Label + optionales Icon-Element; im Noir-Theme wird das Icon per
  CSS ausgeblendet (`[data-theme="noir"] .nav .symbol { display: none }`). Die Emoji bleiben
  dadurch im Code, ohne in Noir aufzutauchen.
- **Ort-Screen:** Noir führt „Umsehen" und die anwesenden Figuren in **einer** Liste; Klassisch
  hat den Umsehen-Knopf getrennt unter den Figuren-Kacheln. Das ist der einzige Fall, der eine
  echte Verzweigung im Markup rechtfertigt — kapsele sie in `OrtScreen` hinter einer Variable
  und dokumentiere sie mit einem Kommentar.
- **Gespräch:** Noir zeigt den Dialog als Untertitel (nur der letzte Zug groß, Verlauf über
  Wischen/Scrollen erreichbar), Klassisch als Blasenliste. Beide Darstellungen aus demselben
  `verlauf`-Array; Noir rendert `verlauf.at(-1)` groß und den Rest in einem einklappbaren
  Verlauf.

---

## Design Tokens

### Palette
| Token | Hex | Verwendung |
|---|---|---|
| `--grund` | `#080808` | Screen-Grund unter allen Bildern |
| `--tief` | `#040404` | Vignettenrand, Verlaufsende |
| `--text` | `#efe9dd` | Titel, aktive Listeneinträge, Untertitel-Dialog |
| `--text-2` | `#c8c2b8` | inaktive Listeneinträge, Fließtext auf Bild |
| `--text-leise` | `#8e8a83` | Meta-Labels, Sekundärtext, inaktive Tabs, Zahlen |
| `--text-aus` | `#6d6a64` | deaktiviert, Platzhaltertext in Eingabefeldern |
| `--akzent` | `#c2913f` | Messing: Auswahl, Beweise, Verdacht > 60 %, irreversible Aktion |
| `--rand` | `rgba(239,233,221,.16)` | Haarlinien (Trenner, Rahmen der Ortschips) |
| `--rand-akzent` | `rgba(194,145,63,.5)` | Haarlinie um die irreversible Aktion |
| `--hover` | `rgba(239,233,221,.05)` | Hover-/Press-Fläche auf Zeilen |
| `--hover-akzent` | `rgba(194,145,63,.12)` | Hover auf Akzent-Zeilen |
| `--platzhalter` | `#4c4944` | **nur** für Asset-Pfad-Platzhalter der Referenz — im Spiel nie |

Kein zweiter Akzent. Kein Rot, kein Grün, kein Blau. Ein Fehlschlag ist nicht rot, sondern
groß gesetzt — das Wort trägt die Bedeutung.

Kontrastuntergrenze: kleiner Text (≤ 12px) nie unter `--text-leise`. `--text-aus` nur für
nicht-interaktive oder ausgegraute Elemente.

`themeColor` in `app/layout.tsx` auf **`#080808`**, `appleWebApp.statusBarStyle` bleibt
`black-translucent`.

### Typografie
Über `next/font/google` in `app/layout.tsx` laden:

```ts
import { Big_Shoulders_Display, Barlow_Condensed } from "next/font/google";
const display = Big_Shoulders_Display({ subsets:["latin"], weight:["600","700","800","900"], variable:"--f-display-noir", display:"swap" });
const text    = Barlow_Condensed({ subsets:["latin"], weight:["400","500","600","700"], variable:"--f-text-noir", display:"swap" });
```
Die Variablen der Schriften auf `<html>` legen; `app/themes/noir.css` mappt
`--f-display: var(--f-display-noir)`. Beide Familien deckten Latin ab — die Umlaute (ÄÖÜ) sind
enthalten, bitte im Build gegenprüfen (Titel „VERDÄCHTIGE" und „ZURÜCK" sind Testfälle).

| Rolle | Familie | Schnitt | Größe / LH | Sperrung |
|---|---|---|---|---|
| Titel Hauptmenü | display | 900, uppercase | 82px / .82 | .005em |
| Titel Ergebnis | display | 900, uppercase | 74px / .80 | .005em |
| Titel Beschuldigen | display | 900, uppercase | 66px / .82 | .005em |
| Titel Ort | display | 900, uppercase | 56px / .86 | .01em |
| Titel Listen-Screens | display | 900, uppercase | 52px / .86 | .01em |
| Name im Gespräch | display | 900, uppercase | 50px / .86 | .01em |
| Menüzeile Hauptmenü | display | 800, uppercase | 27px / 1 | .03em |
| Listenzeile (Aktion, Name, Knopf) | display | 800, uppercase | 23–26px / 1 | .03em |
| Zahl (Versuche, Fragen) | display | 800 | 19–26px / 1 | normal |
| Dialog-Untertitel | text | 400 | 20px / 1.45 | .01em |
| Zitat (Reaktion) | text | 400 | 18px / 1.45 | .01em |
| Fragezeile | text | 500 | 16px / 1.25 | .02em |
| Fließtext | text | 400 | 13.5–15px / 1.5–1.6 | .02em |
| Meta-Label | text | 600 | 9–10px, uppercase | .26–.34em |
| Wert-Label (Prozent, Zeit) | text | 500–600 | 9.5px | .2–.26em |

**Meta-Labels sind immer uppercase und weit gesperrt** (.26em und mehr) — das ist neben der
Extrusion das zweite Erkennungsmerkmal des Designs. Sie ersetzen im ganzen Projekt die Rolle
von `.leise` / `.klein`.

**Titel-Extrusion** (nur Display-Titel, nie Listenzeilen):
```css
text-shadow: 2px 2px 0 #14130f, 4px 4px 0 #0c0b09, 6px 7px 0 #070605, 0 18px 34px rgba(0,0,0,.95);
```
Kleinere Titel (≤ 56px) nehmen die kurze Variante: `2px 2px 0 #14130f, 4px 4px 0 #0a0908,
0 14px 28px rgba(0,0,0,.9)`.

### Geometrie
- **Keine Radien, keine Flächen, keine Schatten** (außer der Titel-Extrusion). Alle
  `border-radius`, `box-shadow`, `backdrop-filter` und Panel-Hintergründe wandern ins
  Klassisch-Theme.
- **Listenzeile** ist das einzige Layoutelement: `border-top: 1px solid var(--rand)`, die
  letzte Zeile zusätzlich `border-bottom`. Padding `14–16px 0`. Kein seitliches Padding, kein
  Rahmen, keine Fläche.
- **Auswahlmarke:** 2px breiter, 24–44px hoher `--akzent`-Balken am linken Rand der Zeile.
  Nicht ausgewählte Zeilen tragen denselben Balken transparent, damit die Textkante nicht
  springt.
- **Screen-Padding:** `56px 24px 26–30px` (oben Statusleiste, unten `--safe-bottom` addieren).
- **Tabbar:** vier gleich breite Textfelder, `padding-top: 16px`, `border-top: 1px solid
  var(--rand)`; aktiv `border-top: 2px solid var(--akzent)` und `--text`. Höhe inkl. Padding
  ≥ 44px. Keine Icons (im Noir-Theme ausgeblendet), keine Flächen.
- **Ortschips** (Ortsleiste): Rechteck, 1px `--rand`, Padding `10px 12px`, Meta-Label; aktiver
  Chip 1px `--akzent` und Text `--akzent`.
- **Balken** (Verdacht, Stats): 2px hoch, Spur `--rand`, Füllung `--akzent` ab 60 %, sonst
  `--text-leise`. Keine Radien, keine Animation.

### Animation
```css
@keyframes blinken { 0%,100% { opacity:.35 } 50% { opacity:1 } }
```
- Widerspruchs-/Beweismarke: 5×5px `--akzent`-Quadrat, `blinken 1.4s ease-in-out infinite`
  (im Ort-Header ruhiger: 2.6s).
- Zustandswechsel: `120ms ease-out` auf `background-color`, `color`, `border-color`.
- **Screenwechsel — Blendenwischer:** der neue Screen kommt als harte Schwarzblende
  (`opacity` 0→1→0 auf einer `--tief`-Fläche, 160ms rein / 200ms raus). Passt zum Kinomenü und
  ersetzt die `.einblenden`-Klasse.
- `@media (prefers-reduced-motion: reduce)`: `blinken` und Wischer abschalten.

---

## Bilder — die wichtigste Regel dieses Designs

Alle Assets liegen bereits in `public/` und bleiben unverändert. Was sich ändert, ist wie sie
gezeigt werden. `components/Bild.tsx` (`Bild` und `Szene`) ist die zentrale Stelle.

### Drei Bildrollen
| Rolle | `Szene variante` | Verhalten |
|---|---|---|
| **Titelbild** | `titel` | `/start.png`, ganzseitig, **unscharf** — das Menü darf ruhig sein |
| **Ortsbild** | `ort` | `public/orte/*.png`, ganzseitig, **scharf** — das Bild ist der Ort |
| **Figurenbild** | `portraet` | `public/charaktere/*.png`, ganzseitig, **scharf** |

Alle drei: `object-fit: cover`, `fill`, `sizes="100vw"`, `priority`. Alle drei entsättigt —
Noir heißt nicht schwarzweiß, aber fast:

```css
[data-theme="noir"] .szene img { filter: saturate(.32) contrast(1.06) brightness(.62); }
[data-theme="noir"] .szene-titel img { filter: saturate(.28) contrast(1.12) brightness(.5) blur(22px); transform: scale(1.06); }
[data-theme="noir"] .szene-ort img { filter: saturate(.34) contrast(1.05) brightness(.66); }
[data-theme="noir"] .szene-portraet img { filter: saturate(.3) contrast(1.08) brightness(.6); }
```
`scale(1.06)` beim Titelbild verhindert weiche Ränder durch den Blur.

### Zwei Overlays über jedem Bild
Immer beide, immer in dieser Reihenfolge — sie machen die Typografie lesbar, ohne das Bild
zu verstecken:
```css
.szene-vignette { position:absolute; inset:0;
  background: radial-gradient(120% 80% at 50% 34%, rgba(8,8,8,.05) 0%, rgba(8,8,8,.72) 60%, var(--tief) 100%); }
.szene-verlauf  { position:absolute; inset:0;
  background: linear-gradient(to top, rgba(4,4,4,.96) 30%, rgba(4,4,4,.3) 64%, rgba(4,4,4,.5)); }
```
Die Prozentwerte pro Screen leicht anders — sie stehen bei den Screens. `.szene-verlauf`
existiert schon in `Bild.tsx` und bekommt nur neue Werte; `.szene-vignette` ist neu.

**Prüfung:** Nach dem Umbau jeden der 30 Orte einmal ansehen. Hellere Bilder (Kopenhagen,
Longyearbyen im Schnee) brauchen eventuell `brightness(.58)` statt `.66` — dafür eine Variable
`--bild-helligkeit` je Theme, damit man einmal zentral nachziehen kann. Nichts auf Bildniveau
hartkodieren.

### Gespräch: beide Figuren im Bild
Der Gesprächsmodus zeigt **zwei** Bilder gleichzeitig:
1. **Die Befragte** — `<Szene variante="portraet" src={charakter.bild}>`, ganzseitig, scharf,
   entsättigt, Overlays darüber. Der Dialog liegt als Untertitel auf ihrem Gesichtsbereich
   (`top: 44%`), nicht darüber.
2. **Wimpy** — `<Bild src={detektiv.bild}>` als Silhouette im Vordergrund, rechts unten,
   angeschnitten. Ersetzt `.frager` und wird im Noir-Theme so gesetzt:
   ```css
   [data-theme="noir"] .frager {
     position: absolute; right: -18px; bottom: 0;
     width: 132px; height: 230px;
     filter: saturate(0) brightness(.3) contrast(1.2) blur(3px);
     pointer-events: none;
   }
   ```
   Fast schwarz, leicht unscharf — er ist Vordergrundmasse, keine Illustration. Der
   `data-modus`-Zustand (reden / befragen / anklagen) bleibt am Element, verändert im Noir aber
   nur die Helligkeit: `.3` / `.34` / `.4`.

So liest der Screen wie eine Über-die-Schulter-Aufnahme: das Gesicht der Befragten im Licht,
Wimpy als dunkle Kante am Bildrand.

### Kleine Bilder in Listen
Dossiers (74×74), Beweise (64×64), Wahl-Liste (44×44): Rechteck ohne Rahmen und ohne Radius,
`filter: saturate(.2) brightness(.9) blur(1px)`. Der leichte Blur hält sie als Textur im
Hintergrund der Zeile, statt sie mit dem Titel zu konkurrieren. `.bild-platzhalter` bekommt im
Noir-Theme dieselbe Streifenfüllung wie in der Referenz plus ein Meta-Label mit dem Namen.

### App-Icons
`public/icons/icon-192.png`, `icon-512.png`, `icon-180.png` sind auf das alte Blau gezeichnet.
Für Noir neu anlegen: `#080808`-Grund, Wimpy-Silhouette oder Monogramm in `#efe9dd`, ein
Messing-Detail. Das ist eine Design-Aufgabe — frag nach, statt zu improvisieren.

---

## Screens / Views

Referenz-Screenshots in `screens/`, lebende Version in `noir-reference.html` (mit
Hover-Zuständen). Alle Screens 390 × 844.

### 01 — Hauptmenü · `components/StartScreen.tsx` (`.start`)
`screens/01-start.png`

Titelbild ganzseitig und unscharf, Vignette (`.1 → .72 → #050505` bei `50% 42%`), darüber ein
Verlauf `rgba(5,5,5,.94) 12% → .2 48%`.

- **Fall-Marke** oben links: 20×1px `--akzent`-Linie + Meta-Label `FALL 001 — VENEDIG`
  (`--akzent`). Im Code: laufender Fall oder, wenn keiner läuft, die Fallnummer der letzten Akte.
- **Titel** (`margin-top:auto`): „DETEKTIV" / „WIMPY", Display 82px/.82, volle Extrusion.
  Ersetzt `.start-logo` und wird **immer** gezeigt — nicht nur, wenn das Titelbild fehlt.
  `ohneBild` steuert dann nur noch, ob der Verlauf dichter wird.
- **Untertext:** „Fünf Orte. Ein Lügner. Zwei Versuche, bevor die Akte zugeht." 15px/1.55,
  `--text-leise`, `max-width: 30ch`.
- **Menü** als Haarlinien-Liste, `margin-top:30px`, vier Zeilen (`.knopf.aktion` /
  `.knopf.glas.schmal` entfallen als Knopf-Optik):
  | Zeile | Zustand |
  |---|---|
  | NEUER FALL | aktiv: Akzentbalken, `--text`, rechts Meta `START` in `--akzent` |
  | FORTSETZEN | `--text-aus`; rechts der Ortsname des Spielstands als Meta in `--text-leise`. Ohne Spielstand entfällt die Zeile ganz |
  | KAMPAGNEN | `--text-aus` |
  | SAGAS | `--text-aus` |
  Ladezustand: Label wird „WIRD AUSGEHECKT …", Zeile `--text-aus`, nicht klickbar; der
  Fortschrittstext (`schritt`) steht als Meta-Label rechts.
- **Fußzeile:** `18 VERDÄCHTIGE` · `6 STÄDTE` als Meta-Labels `--text-leise`, rechts `ADMIN`
  als Meta-Label `--text-leise` (interaktiv, deshalb nicht dunkler).
- **Fehler** (`.fehler`): Meta-Label `--akzent` über einer Haarlinie, kein Kasten.

### 02 — Ort · `components/OrtScreen.tsx` (`.ort-ansicht`)
`screens/02-ort.png`

**Das Ortsbild ist der Screen** — ganzseitig, scharf, entsättigt. Vignette bei `50% 34%`,
Verlauf `rgba(5,5,5,.96) 34% → .28 66%`.

- **Kopfzeile:** `‹ ORTE` Meta-Label 13px `--text-leise`; rechts eine blinkende
  `--akzent`-Marke + `3 BEWEISE`; ganz rechts die Uhrzeit als Wert-Label `--text-leise`.
- **Ortstitel-Block** (`margin-top:auto`, sitzt also über der Aktionsliste, tief im Bild):
  16×1px Linie + Meta `SCHAUPLATZ 2 VON 5`, darunter `ort.name` uppercase Display 56px/.86 mit
  kurzer Extrusion, darunter `ort.atmosphaere` 14.5px/1.6 `--text-leise`.
- **Aktionsliste** — die eine strukturelle Änderung: `.figuren` (Kacheln) und der
  Umsehen-Knopf werden **eine** Liste.
  | Zeile | Aufbau |
  |---|---|
  | UMSEHEN | Akzentbalken, Display 23px `--text`, Meta darunter `SPUR MÖGLICH` in `--akzent`, Chevron `›`. Läuft die Suche: „WIMPY SUCHT …", Balken transparent, Zeile `--text-aus` |
  | `${name} ANSPRECHEN` | je anwesende Figur; Display 23px `--text-2`, Meta `${TIERART} · ANWESEND` in `--text-leise` |
  | erledigt | dieselbe Zeile mit `opacity:.5` und Meta `ERLEDIGT`; bleibt sichtbar |
  Niemand da: eine Zeile mit Meta-Label `KEINE MENSCHENSEELE. BEZIEHUNGSWEISE TIERSEELE.`
  **Fundtext** (`.fund`) erscheint als Zeile mit Akzentbalken direkt über der Liste; antippen
  schließt.
- **Ortsleiste** (`.orte-leiste`): horizontal scrollbare Chips (s. Geometrie), aktiver Ort in
  `--akzent`, Personenzahl als ` · 2` im Label. Die runden Ortsbilder entfallen.
- **Tabbar:** ORTE · TIERE · BEWEISE · NOTIZEN. „INVENTAR" heißt im Noir **BEWEISE** — das
  Wort passt zum Ton und ist kürzer. Zähler als `--akzent`-Zahl oben rechts im Feld.

### 03 — Gespräch · `components/ChatOverlay.tsx` (`.overlay.gespraech`)
`screens/03-gespraech.png`

Befragte ganzseitig und scharf; Wimpy als Silhouette rechts unten (s. „Bilder"). Vignette bei
`50% 30%` mit weichem Zentrum (`rgba(8,8,8,0)`), Verlauf `rgba(4,4,4,.97) 30% → .3 64%`.

- **Kopfzeile:** `‹ ZURÜCK`; rechts Meta `VERHÖR` + verbleibende Fragen als Display-Zahl
  `--akzent`.
- **Dialog als Untertitel** (`top: 44%`, zentriert, `max-width: 26ch`): die **letzte**
  Äußerung, 20px/1.45 `--text`, `text-shadow: 0 2px 12px rgba(0,0,0,.95)`. Darunter bei
  Widerspruch: blinkende 5×5px `--akzent`-Marke + Meta `WIDERSPRUCH ZU SPUR 3` in `--akzent`.
  Der Verlauf (`.scroll.chat`) bleibt erreichbar: nach oben wischen blendet die älteren Züge
  als Liste ein (`--text-leise`, 15px, je Zug eine Haarlinie). Eigene Fragen im Verlauf sind
  `--text-2` und mit `— ` vorangestellt; keine Blasen.
  Tippt-Anzeige: drei 5×5px `--text-leise`-Quadrate mit `blinken` (0 / .2s / .4s).
- **Name** (`margin-top:auto`): `charakter.name` uppercase Display 50px/.86, darunter 16×1px
  Linie + Meta `${TIERART} · ${alter} JAHRE · ${rolle}`.
- **Fragenliste:** Haarlinien-Zeilen, links die Ordnungszahl als Wert-Label `--text-leise`
  (Breite 14px), Text 16px `--text-2`. Die Schlüsselfrage (Beweis vorlegen) hat statt der Zahl
  den Akzentbalken, Display 20px `--text` und rechts Meta `BEWEIS` in `--akzent`.
- **Modus-Reihe** (`reden` / `befragen` / `anklagen`): drei Meta-Labels in einer Zeile über der
  Fragenliste, aktiver Modus `--text` mit 2px `--akzent`-Oberlinie, inaktiv `--text-leise`.
  Emoji entfallen.
- **Eingabefeld:** kein Rahmen, nur `border-bottom: 1px solid var(--rand)`; Text 15px,
  Placeholder `--text-aus`; Senden als Meta-Label `SENDEN` in `--akzent` rechts daneben,
  `disabled` → `--text-aus`.

### 04 — Tierakte · `components/VerdaechtigeScreen.tsx`
`screens/04-tierakte.png`

Kein Bild — Grund ist ein ruhiger Radialverlauf `#141312 → #050505`. Die Listen-Screens sind
absichtlich bildlos: sie sind Akten, nicht Szenen.

- **Kopf:** Linie + Meta `TIERAKTE` (`--akzent`), Titel „VERDÄCHTIGE" Display 52px; rechts
  Versuchszähler (Display-Zahl `--akzent` + Meta `VERSUCHE`).
- **Dossierzeile:** Akzentbalken (nur bei Verdacht > 60 %), Bild 74×74, dann:
  Name Display 26px (`--text` bei > 60 %, sonst `--text-2`) + Meta `${TIERART} · ${alter} J.`;
  Verdachtsbalken 2px + Prozentwert als Wert-Label (Farbe wie der Balken); Stat-Zeile als
  **ein** Meta-Label `SCHELM 9 · KLUGHEIT 7 · CHARISMA 6 · FITNESS 5` (die Balken pro Stat
  entfallen — sie passen nicht zum Minimalismus und tragen keine Information, die die Zahl
  nicht hat); Hinweise als Fließtext 13.5px `--text-2`, je Hinweis eine Zeile.
- **Leerzustand:** Fließtext `--text-leise`, kein Kasten.
- **Auflösen-Zeile** über der Tabbar: Akzentbalken, Display 25px „FALL AUFLÖSEN", rechts Meta
  `KEIN ZURÜCK` in `--akzent`.

### 05 — Beweise · `components/InventarScreen.tsx`
`screens/05-beweise.png`

- **Kopf:** Linie + Meta `3 VON 5 GEFUNDEN`, Titel „BEWEISE" Display 52px.
- **Beweiszeile:** Bild 64×64, Name Display 24px, Fundort als Meta (`--akzent` wenn offen,
  sonst `--text-leise`), Chevron.
  - **Offen** (`data-offen`): Akzentbalken, Name `--text`, darunter die Fundnotiz 13.5px
    `--text-2`, Chevron entfällt.
  - **Geschlossen:** Balken transparent, Name `--text-2`.
- **Rest-Hinweis** am Ende: Meta-Label `NOCH 2 FUNDE MÖGLICH — AN DEN ORTEN UMSEHEN`. Ersetzt
  auch den Leerzustand („DIE TASCHEN SIND LEER — AN DEN ORTEN UMSEHEN").

### 06 — Notizen · `components/NotizbuchScreen.tsx`
`screens/06-notizen.png`

- **Kopf:** Linie + Meta `6 EINTRÄGE`, Titel „NOTIZEN" Display 52px.
- **Eintrag:** Haarlinie oben; Quelle als Meta-Label, Text 14.5px.
  - Fundnotiz (`quelle === "Fund"`): Akzentbalken links, Quelle `FUND · ${ORT}` in `--akzent`,
    rechts die Zeit als Wert-Label, Text in `--text`.
  - Figuren-Notiz: Quelle = Name uppercase in `--text-leise`, Text `--text-2`.
  - Erzähler: Quelle `ERZÄHLER`, sonst wie Figuren-Notiz.
- Reihenfolge bleibt neueste zuerst.

### 07 — Beschuldigen · `components/BeschuldigenOverlay.tsx` (`.overlay`)
`screens/07-beschuldigen.png`

- Grund: Radialverlauf mit warmem Kern (`#16110f → #050404`) — der einzige Screen mit einer
  Spur Wärme im Schwarz.
- **Kopfzeile:** `✕ ABBRECHEN`; rechts Display-Zahl `--akzent` + Meta `VERSUCHE`.
- **Titel:** „WER WAR ES?" Display 66px/.82, zweizeilig, volle Extrusion.
- **Wahl-Liste** statt Kachelgitter: je Zeile Akzentbalken (nur die gewählte), Bild 44×44,
  Name Display 26px, rechts der Verdachtswert als Wert-Label. Gewählt: Name `--text`,
  Wert `--akzent`. Nicht gewählt: `--text-2` / `--text-leise`.
- **Begründungsfeld:** Meta-Label `WIMPYS BEGRÜNDUNG — OPTIONAL`, darunter Textarea ohne
  Rahmen, nur `border-bottom: 1px solid var(--rand)`, 14.5px, `min-height: 44px`,
  Placeholder `--text-aus`.
- **Bestätigen:** Zeile mit `--rand-akzent` oben und unten, Akzentbalken, Display 27px in
  `--akzent`: `${NAME} BESCHULDIGEN`. Hover `--hover-akzent`. Ohne Auswahl `--text-aus` und
  nicht klickbar. Darunter Warntext 13px `--text-leise`.

### 08 — Ergebnis gelöst · `components/ErgebnisScreen.tsx` (`ergebnis.richtig === true`)
`screens/08-ergebnis-geloest.png`

Täterbild ganzseitig (`portraet`), Vignette `50% 36%`, Verlauf `rgba(4,4,4,.97) 26% → .3 62%`.

- **Kopf:** Linie + Meta `FALL 001 · ERSTER VERSUCH` in `--akzent`.
- **Titel** (`margin-top:auto`): „FALL" / „GELÖST" Display 74px/.80, volle Extrusion.
- **Name:** „Die Täterin war **Fanny**, die Bäckerin vom Markusplatz." 15px/1.5 `--text-2`,
  Name in `--text` 600.
- **Auflösung:** Haarlinie oben, Meta `DIE AUFLÖSUNG` `--text-leise`, Text 14.5px/1.6.
- **Reaktion:** Haarlinie oben, Meta `${NAME} SAGT` in `--akzent`, Zitat 18px/1.45 `--text`.
- **Zeilen:** „NÄCHSTER FALL" (Akzentbalken, Display 25px `--text`, Chevron) und
  „HAUPTMENÜ" (`--text-aus`). In einer Saga trägt die erste Zeile `weiterText`.

### 09 — Ergebnis daneben · `components/ErgebnisScreen.tsx` (`ergebnis.richtig === false`)
`screens/09-ergebnis-daneben.png`

Bild des **falsch Beschuldigten**, nicht des Täters — der bleibt unbekannt. Sonst gleicher
Aufbau, vier Unterschiede:
- Kopf-Meta: `NOCH EIN VERSUCH` (bei 0: `AKTE GESCHLOSSEN`).
- Titel „DANEBEN" einzeilig, Display 74px. Kein Rot — die Größe trägt es.
- Reaktion steht **vor** der Notiz; das zweite Panel heißt `WIMPYS NOTIZ` (`--text-leise`) und
  formuliert die nächste Spur.
- Erste Zeile „WEITER ERMITTELN". Bei 0 Versuchen stattdessen „FALL SCHLIESSEN" und der Täter
  wird aufgelöst.

### Noch nicht gezeichnet
`IntroSequenz.tsx`, `Prolog.tsx`, `ErzaehlerScreen.tsx`, `KampagnenListe.tsx`,
`SagenListe.tsx`, `app/admin/*`. Dafür gelten die Stilregeln unten — oder frag nach einem
Entwurf. Der Admin-Bereich bleibt im Klassisch-Look.

---

## Stilregeln (für alles, was nicht gezeichnet ist)
1. Das Bild ist der Hintergrund, nie ein Element in einem Kasten. Ohne Bild: ruhiger
   Radialverlauf, keine Fläche.
2. Jede Liste ist eine Reihe von Haarlinien-Zeilen. Keine Karten, keine Panels, keine Radien.
3. Genau **eine** Zeile pro Liste trägt den Akzentbalken.
4. `--akzent` nur für: Auswahl, Beweise/Funde, Verdacht > 60 %, Widerspruch, irreversible
   Aktion. Nie dekorativ, nie zwei Akzentflächen nebeneinander.
5. Titel immer Display 900 uppercase mit Extrusion; ein Wort pro Zeile, wenn es passt.
6. Alle Kleinlabels uppercase und ≥ .26em gesperrt.
7. Zahlen (Versuche, Fragen, Prozente) immer Display; Fließtext nie.
8. Keine Emoji, keine Farbverläufe außer Vignette und Lesbarkeitsverlauf, kein Glow, keine
   Rahmen außer Haarlinien.
9. Eingabefelder haben nur eine untere Haarlinie.
10. Kleiner Text nie unter `--text-leise` auf `--grund` (Kontrast).

---

## Interactions & Behavior
Spiellogik unverändert (`lib/useGame.ts`). Neu oder geändert:
- **Hover/Press:** Zeilen bekommen `--hover` (Akzentzeilen `--hover-akzent`), 120ms.
- **Disabled:** Text `--text-aus`, Balken transparent, kein Hover.
- **Ort:** erledigte Aktionen bleiben mit `opacity:.5` stehen.
- **Gespräch:** Untertitel zeigt immer den letzten Zug; älterer Verlauf per Wischen. Das ist
  eine Darstellungsänderung, keine Datenänderung.
- **Widerspruchserkennung** ist der einzige neue Logikanteil: eine Antwort, die einer
  gefundenen Spur widerspricht, bekommt die Akzentmarke und die Meta-Zeile. Falls
  `lib/antwort.ts` das noch nicht liefert, zuerst nur die Darstellung bauen und den Hinweis
  als optionales Feld (`widerspruchZuSpur?: string`) durchziehen — nicht raten.
- **Hit-Targets** ≥ 44px: alle Zeilen und Tabs erfüllen das (Zeilenhöhe 14–16px Padding +
  Inhalt ≥ 24px).
- **Safe Areas:** `viewportFit: "cover"` bleibt; Screen-Padding und Tabbar rechnen
  `--safe-top` / `--safe-bottom` ein.
- **Responsive:** eine Spalte, skaliert über die Höhe. Auf breiteren Geräten Inhalt auf
  max. 460px begrenzen und zentrieren; das Bild bleibt randlos.
- **Reduced Motion:** `blinken` und Blendenwischer abschalten.

## State Management
Keine neuen Stores außer der Design-Wahl:
- Neu: `lib/design.ts` (`"noir" | "klassisch"`, `localStorage: wimpy-design`) + Inline-Skript
  im `<head>`, das `data-theme` vor dem ersten Paint setzt.
- Vorhanden: `lib/useGame.ts` (`fall`, `verdacht`, `verlauf`, `notizen`, `gefundeneSpuren`,
  `beschuldigungenUebrig`, `ergebnis`, `laedt`, `schritt`, `fehler`); lokal
  `OrtScreen.fundText`, `ChatOverlay.modus/text`, `BeschuldigenOverlay.gewaehlt/begruendung`,
  `InventarScreen.offen`, `StartScreen.ohneBild`.
- Neu (nur Darstellung): pro Ort ein Set erledigter Aktionen; optional
  `widerspruchZuSpur` an `ChatTurn`; `verlaufOffen` im ChatOverlay für den eingeblendeten
  Gesprächsverlauf.

## Files
In diesem Bündel:
- `PROMPT.md` — der Text, den du Claude Code als Einstieg gibst.
- `README.md` — diese Spezifikation.
- `noir-reference.html` — alle neun Screens live im Browser, mit Hover-Zuständen.
- `screens/01…09-*.png` — dieselben Screens als PNG (780×1688, 2×).

Im Zielrepo (`Snaefell18/Detective-Wimpy`, Branch `claude/detective-wimpy-app-g8qvyr`):

| Screen | Datei(en) |
|---|---|
| 01 Hauptmenü | `components/StartScreen.tsx` |
| 02 Ort | `components/OrtScreen.tsx` |
| 03 Gespräch | `components/ChatOverlay.tsx` |
| 04 Tierakte | `components/VerdaechtigeScreen.tsx` |
| 05 Beweise | `components/InventarScreen.tsx` |
| 06 Notizen | `components/NotizbuchScreen.tsx` |
| 07 Beschuldigen | `components/BeschuldigenOverlay.tsx` |
| 08/09 Ergebnis | `components/ErgebnisScreen.tsx` |
| Navigation | `components/Nav.tsx` |
| Bilder (alle Rollen) | `components/Bild.tsx` |
| Styles | `app/globals.css` → + `app/themes/noir.css`, `app/themes/klassisch.css` |
| Fonts, Theme-Color, `data-theme` | `app/layout.tsx` |
| Design-Umschalter | `lib/design.ts` (neu), `components/admin/SpielBereich.tsx` |
| Screen-Verteilung | `app/page.tsx` |

Im Design-Projekt: `Detektiv Wimpy Redesign.dc.html`, Turn 5, Option `5a`. Die Turns 1–4
(inklusive der Kōhaku-Richtung `3b`/`4a` mit eigenem Handoff-Ordner) sind Alternativen und
nicht Teil dieses Auftrags.
