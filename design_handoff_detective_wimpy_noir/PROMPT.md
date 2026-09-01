# Prompt für Claude Code

Leg den Ordner `design_handoff_detective_wimpy_noir/` ins Repo-Root von **Detective-Wimpy**
(Branch `claude/detective-wimpy-app-g8qvyr`) und gib Claude Code den Text zwischen den Linien.

---

Ich habe ein visuelles Redesign für diese App („Noir") und will es im bestehenden Code
umsetzen. Noir wird das Standard-Design. Das bisherige Design soll dabei **nicht verloren
gehen**, sondern per Umschalter wiederherstellbar bleiben. Die komplette Spezifikation liegt in
`design_handoff_detective_wimpy_noir/`.

**Lies zuerst vollständig:**
1. `design_handoff_detective_wimpy_noir/README.md` — alle Hex-Werte, Schriftgrößen,
   Sperrungen, Abstände, Zustände und Copy, Screen für Screen, mit Zuordnung zu den echten
   Dateien in `components/`. Besonders wichtig: die Abschnitte **„Zwei Designs parallel"** und
   **„Bilder"**.
2. Die PNGs in `design_handoff_detective_wimpy_noir/screens/` (01–09).
3. `design_handoff_detective_wimpy_noir/noir-reference.html` — dieselben Screens live, mit
   Hover-Zuständen.

**Grundsätze:**
- Die HTML-Referenz ist ein Prototyp mit Inline-Styles. Im Projekt läuft alles über die
  Theme-Struktur aus dem README: `app/globals.css` behält nur Struktur, die Optik zieht in
  `app/themes/noir.css` und `app/themes/klassisch.css`. Werte übernehmen, Markup nicht.
- Das Design ist **hi-fi**: Farben, Typo, Abstände und Sperrungen sind final und sollen
  pixelnah übernommen werden.
- **Spiellogik nicht anfassen.** `lib/**` bleibt unverändert, ausgenommen das neue
  `lib/design.ts` und ein optionales Feld für die Widerspruchsanzeige (frag vorher).
- Die zehn „Stilregeln" im README gelten auch für Screens, die nicht gezeichnet sind
  (`IntroSequenz`, `Prolog`, `ErzaehlerScreen`, `KampagnenListe`, `SagenListe`).

**Zwei Punkte, die mir besonders wichtig sind — bitte nicht abkürzen:**

**A) Die Bilder tragen das Design.** In Noir ist jedes Bild ganzseitig und die Typografie liegt
darauf:
- **An jedem Ort ist das Ortsbild der Bildschirm** — `public/orte/*.png` randlos, scharf,
  entsättigt und abgedunkelt, mit Vignette und Lesbarkeitsverlauf darüber. Nicht in einem
  Kasten, nicht beschnitten auf ein Drittel der Höhe, nicht weichgezeichnet.
- **Nur das Titelbild** im Hauptmenü ist unscharf (das ist das Kinomenü-Motiv).
- **Im Gespräch sind beide Figuren zu sehen:** die Befragte ganzseitig und scharf im
  Hintergrund, Wimpy als fast schwarze, leicht unscharfe Silhouette rechts unten
  angeschnitten. Das ergibt die Über-die-Schulter-Aufnahme. Die exakten Filterwerte stehen im
  README.
- Nach dem Umbau alle 30 Ortsbilder einmal durchsehen: helle Motive (Kopenhagen, Longyearbyen)
  brauchen eventuell eine andere Helligkeit. Dafür gibt es die Variable
  `--bild-helligkeit` — nichts pro Bild hartkodieren.

**B) Das alte Design bleibt wiederherstellbar.** So, wie im README beschrieben:
- Vor dem ersten Commit `git tag pre-noir` setzen und auf einem Branch arbeiten.
- Beide Designs leben parallel als `[data-theme="noir"]` (Default) und
  `[data-theme="klassisch"]`. Jede optische Eigenschaft, die sich unterscheidet, läuft über
  eine CSS-Variable — auch Radien, Schatten, Glaseffekte und Schriftfamilien.
- Umschalter im Admin-Bereich (`components/admin/SpielBereich.tsx`), Zustand in
  `lib/design.ts` + `localStorage`, `data-theme` vor dem ersten Paint gesetzt (kein Flash).
- Kein Hex-Wert, kein Radius, kein Schriftname in Komponentencode. Keine Theme-Abfrage in JS
  für Optik — nur CSS entscheidet über Aussehen.
- Am Ende muss sich das alte Design mit **einem Klick** vollständig zurückholen lassen: gleiche
  Farben, gleiche Rundungen, gleiche Glaseffekte, gleiche Emoji-Navigation wie heute.

**Reihenfolge:**
1. **Bestandsaufnahme.** `app/globals.css` ist ~54 kB. Sag mir, welche Regeln zu welchem Screen
   gehören, was reine Struktur ist (bleibt) und was Optik ist (wandert in die Theme-Dateien),
   und wo du Konflikte siehst. **Warte dann auf mein OK.**
2. **Theme-Gerüst.** `globals.css` aufteilen, `app/themes/klassisch.css` mit dem heutigen
   Aussehen füllen, `app/themes/noir.css` anlegen, `lib/design.ts` + Umschalter bauen,
   `data-theme` in `app/layout.tsx`. Ziel dieses Schritts: **die App sieht in Klassisch
   unverändert aus**, Noir ist noch leer. `npm run typecheck` und `npm run build` grün.
3. **Noir-Fundament.** Palette, Fonts über `next/font/google`, Typo-Skala, Haarlinien-Zeile,
   Auswahlmarke, Tabbar, Blendenwischer — als wiederverwendbare Regeln, nicht pro Komponente
   neu erfunden.
4. **Bilder.** `components/Bild.tsx`: die drei Bildrollen (`titel` / `ort` / `portraet`),
   Vignette, Lesbarkeitsverlauf, Wimpy-Silhouette im Gespräch, Listenbilder.
5. **Screens, einzeln, in dieser Reihenfolge:** StartScreen → Nav → OrtScreen → ChatOverlay →
   VerdaechtigeScreen → InventarScreen → NotizbuchScreen → BeschuldigenOverlay →
   ErgebnisScreen. Nach **jedem** Screen kurz zeigen, was sich geändert hat, damit ich mit dem
   PNG vergleichen kann. Nicht alle neun auf einmal.
6. **Abnahme.** Beide Themes einmal komplett durchklicken, `npm run build` grün, und mir sagen,
   welche Screens noch im Klassisch-Look sind (Intro, Prolog, Erzähler, Kampagnen, Sagas,
   Admin).

**Frag mich, statt zu erfinden:**
- Liefert `lib/antwort.ts` schon einen Hinweis darauf, dass eine Antwort einer gefundenen Spur
  widerspricht? Wenn nein: wie ziehen wir das durch?
- Im Noir heißt der Tab „Inventar" **Beweise**. Passt das für dich auch im Klassisch-Theme,
  oder soll dort „Inventar" stehen bleiben?
- Der Gesprächsverlauf wird in Noir zum Untertitel (nur der letzte Zug groß, Rest per Wischen).
  Ist das so gewollt, oder soll der volle Verlauf immer sichtbar bleiben?
- Die App-Icons in `public/icons/` sind auf das alte Blau gezeichnet. Sollen sie neu gemacht
  werden — und wenn ja, passend zu welchem Design, da es jetzt zwei gibt?

---

## Inhalt des Ordners

| Datei | Zweck |
|---|---|
| `README.md` | Vollständige Spezifikation — Theme-Struktur, Tokens, Bilder, neun Screens, Interaktionen, Stilregeln, Dateizuordnung |
| `noir-reference.html` | Alle neun Screens live im Browser, mit Hover-Zuständen |
| `screens/01-start.png` | Hauptmenü |
| `screens/02-ort.png` | Ort / Schauplatz |
| `screens/03-gespraech.png` | Gespräch (Befragte + Wimpy) |
| `screens/04-tierakte.png` | Tierakte (Verdächtige) |
| `screens/05-beweise.png` | Beweise (Inventar) |
| `screens/06-notizen.png` | Notizbuch |
| `screens/07-beschuldigen.png` | Beschuldigen |
| `screens/08-ergebnis-geloest.png` | Ergebnis, Fall gelöst |
| `screens/09-ergebnis-daneben.png` | Ergebnis, daneben |

PNGs sind 780×1688 (2× von 390×844). Die grauen Streifenflächen sind Bildplatzhalter — der
vorgesehene Pfad aus `public/` steht jeweils im Bild.
