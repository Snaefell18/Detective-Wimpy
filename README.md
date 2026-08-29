# Detective Wimpy 🔍

Ein Detektivspiel für den Browser und den iPhone-Homescreen. Man spielt Wimpy,
ein Bushbaby mit Lupe, reist zwischen Orten, quatscht mit Tieren, befragt und
beschuldigt sie - und findet am Ende (hoffentlich) den Täter.

Die Charaktere, ihre Alibis, Geheimnisse, Spuren und alle Dialoge kommen live von
der Claude-API. Der Täter wird bei jedem neuen Fall zufällig gezogen.

## Schnellstart

```bash
npm install
cp .env.example .env.local     # ANTHROPIC_API_KEY eintragen
npm run dev                    # http://localhost:3000
```

## Auf Vercel deployen

1. Repository in Vercel importieren (Framework wird als Next.js erkannt).
2. Unter **Settings → Environment Variables** hinterlegen:
   - `ANTHROPIC_API_KEY` - der Claude-Key (Pflicht).
   - `ANTHROPIC_MODEL` - optional, Default ist `claude-opus-5`.
   - `CASE_SECRET` - optional, langer Zufallsstring zum Verschlüsseln des Falls.
     Ohne Angabe wird der API-Key als Schlüsselbasis benutzt.
3. Deployen. Fertig - kein Server, keine Datenbank nötig.

Auf dem iPhone: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Die App
startet dann im Vollbild ohne Safari-Leisten (`display: standalone`), mit
eigenem Icon und korrekten Abständen zu Dynamic Island und Home-Indicator.

## Bilder einpflegen

Es gibt zwei Wege - der erste ist der richtige, der zweite der schnelle.

### 1. Dauerhaft: ins Projekt legen

Alle Bilder liegen unter `public/`, weil Next.js nur von dort ausliefert. Die
URLs sind trotzdem genau die gewünschten:

| Ordner               | URL im Spiel   | Inhalt              |
| -------------------- | -------------- | ------------------- |
| `public/charaktere/` | `/charaktere/` | Tiere               |
| `public/orte/`       | `/orte/`       | Schauplätze         |
| `public/items/`      | `/items/`      | Gegenstände/Spuren  |

Der Dateiname entscheidet, wozu ein Bild gehört: `chat.png` gehört zu Chat,
`cafe.png` zum Café Mondlicht. In jedem Ordner liegt eine `README.md` mit der
vollständigen Liste; im Admin-Menü unter **Bilder** steht zu jedem Eintrag der
erwartete Dateiname.

So kommen die Dateien ins Projekt:

- **Über GitHub im Browser:** Repository öffnen → in den Ordner wechseln →
  *Add file → Upload files* → PNGs hineinziehen → *Commit changes*. Vercel
  baut danach automatisch neu.
- **Lokal:** Dateien in den Ordner kopieren, dann
  `git add public/charaktere && git commit -m "Bilder" && git push`.

Empfehlung: Charaktere hochkant freigestellt (PNG mit Transparenz, ca.
900 × 1200 px) - sie werden im Gespräch bildschirmfüllend gezeigt. Orte im
Querformat (ca. 1600 × 1000 px), Gegenstände quadratisch (512 px).

### 2. Zum Ausprobieren: im Admin-Menü

Unter **Admin → Bilder** kannst du zu jedem Eintrag ein Bild direkt vom Handy
wählen. Es wird verkleinert, im Browser gespeichert und sofort im Spiel benutzt.
Praktisch zum Testen, aber es liegt nur auf diesem einen Gerät - für alle
anderen (und nach dem Leeren der Browserdaten) zählt Weg 1.

Solange ein Bild fehlt, zeigt die App einen Platzhalter mit dem Namen - das
Spiel funktioniert also auch ganz ohne Grafiken.

## Admin-Menü

Auf dem Startbildschirm oben rechts das Zahnrad (oder direkt `/admin`):

- **Charaktere** - die Excel-Tabelle als CSV einlesen. Die Datei wird geprüft
  (genau ein Detektiv, mindestens zwei Verdächtige, keine doppelten Namen) und
  gilt ab dem nächsten Fall. Darunter die aktuelle Besetzung mit Bildstatus.
  „Eigene Liste verwerfen“ schaltet zurück auf `data/characters.csv`.
- **Bilder** - eigene Bilder hinterlegen oder wieder entfernen (siehe oben).
- **Spiel** - Erzählton (kindgerecht, spannend, albern), Anzahl der
  Beschuldigungen, Startverdacht, sowie Zurücksetzen von Einstellungen und
  Spielstand.

Alles davon liegt im Browser des Geräts, nicht auf dem Server. Beim Start eines
Falls schickt die App Besetzung und Einstellungen einmal mit; sie werden in den
verschlüsselten Fall eingebacken und gelten für dessen gesamte Laufzeit.

## Charaktere aus der Excel/CSV pflegen

Die Werte der Tiere stehen in `data/characters.csv` (Semikolon-getrennt, direkt
aus Excel exportierbar). Nach jeder Änderung:

```bash
npm run import:csv
```

Das schreibt `lib/characters.generated.ts` neu und meldet, welches Bild zu
welchem Tier gehört. Spalten:

```
Nummer;Name;Tierart;Alter;Charisma;Freundlichkeit;Fitness;Zauberkraft;
Schelmischkeit;Kriminalitätslevel;Intelligenz;Charakter[;Bild]
```

- Leere Zeilen (Vorlagenzeilen 6-12) werden übersprungen - einfach ausfüllen und
  neu importieren, dann sind die Tiere sofort im Spiel.
- Die Zeile mit dem Wort „Detektiv“ in der Spalte `Charakter` ist die Spielfigur
  und taucht nicht als Verdächtiger auf.
- Die optionale Spalte `Bild` überschreibt den automatischen Pfad.

Die Werte sind nicht nur Deko: Sie stehen im Prompt und steuern das Verhalten -
hohe Schelmischkeit heißt Ablenkungsmanöver, hohe Intelligenz bessere Ausreden,
hohe Freundlichkeit offenere Antworten.

## Wie das Spiel funktioniert

1. **Fall erzeugen** (`POST /api/case`): Der Server würfelt einen Täter aus allen
   Verdächtigen und lässt Claude die Geschichte darum herum bauen - Tat, Motiv,
   Alibis, Geheimnisse, Aufenthaltsorte und 4-6 Spuren.
2. **Umsehen** (`POST /api/search`): Findet an einem Ort die nächste unentdeckte
   Spur. Braucht kein Modell und ist deshalb sofort da.
3. **Reden / Befragen / Beschuldigen** (`POST /api/talk`): Claude spielt den
   jeweiligen Charakter, kennt sein Alibi und sein Geheimnis - und beim Täter
   auch den Tathergang. Zurück kommen Antwort, Stimmung, eine mögliche Notiz,
   eine eventuell entdeckte Spur und die Änderung des Verdachtswerts.
4. **Auflösen** (`POST /api/accuse`): Zwei Versuche. Ob die Beschuldigung stimmt,
   entscheidet der Server - Claude erzählt nur die Auflösung.

### Warum man den Täter nicht in den Dev-Tools nachlesen kann

Der vollständige Fall (Täter, Motiv, gelogene Alibis) verlässt den Server nur
AES-256-GCM-verschlüsselt als „Siegel“. Der Browser trägt dieses undurchsichtige
Siegel bei jeder Anfrage mit sich, entschlüsseln kann es nur der Server. Dadurch
bleibt alles zustandslos - ideal für Vercel, ganz ohne Datenbank.

Der Spielstand selbst (Ort, Notizen, Chatverläufe, Verdachtswerte) liegt im
`localStorage` des Geräts, ein angefangener Fall überlebt also das Schließen der App.

## Design

Farben und Typografie orientieren sich am Detective-Conan-Keyvisual:

- tiefes Marineblau (`#050f22`) als Grund, Karten in Stahlblau,
- ein schräger Lichtstrahl und ein angedeutetes Panel-Raster im Hintergrund,
- der Rot-Orange-Verlauf des Serienlogos mit gelber Kontur für Titel,
  Hauptaktionen und die eigenen Chatblasen,
- Eisblau (`#7cc4ff`) für Werte, Fokusrahmen und ruhige Akzente.

Das Layout ist bewusst rahmenlos: Der Ort füllt den ganzen Bildschirm, die Tiere
stehen frei in der Szene, und im Gespräch ist das Gegenüber bildschirmfüllend zu
sehen - die Sprechblasen schweben darüber. Statt Kartenrändern gibt es weiche
Verläufe und Glasflächen.

Alle Farben liegen als CSS-Variablen ganz oben in `app/globals.css` - dort einmal
ändern reicht, um das ganze Spiel umzufärben.

## Projektstruktur

```
app/
  layout.tsx            Metadaten, PWA-Einstellungen, Viewport (iPhone-tauglich)
  page.tsx              Hält alles zusammen: Tabs, Overlays, Spielfluss
  admin/page.tsx        Admin-Menü: Charaktere, Bilder, Einstellungen
  globals.css           Komplettes Styling (Safe-Areas, Szenen-Layout)
  api/case/route.ts     Fall erzeugen (Täter würfeln + Claude)
  api/talk/route.ts     Gespräch mit einem Charakter
  api/search/route.ts   Umsehen an einem Ort
  api/accuse/route.ts   Finale Beschuldigung und Auflösung
components/             Bildschirme und Overlays
lib/
  adminStore.ts         Admin-Daten auf dem Gerät (Besetzung, Bilder, Optionen)
  csv.ts                Das CSV-Format - benutzt von App und Import-Skript
  bildUpload.ts         Bilder verkleinern und als Data-URL ablegen
  characters.ts         Charaktere + Helfer (aus der CSV erzeugt)
  locations.ts          Orte
  items.ts              Gegenstände
  prompts.ts            Alle Prompts an Claude
  schemas.ts            Struktur der Antworten (Zod)
  seal.ts               Verschlüsselung des Falls
  useGame.ts            Spielzustand inkl. Speicherung auf dem Gerät
data/characters.csv     Die Tier-Tabelle aus Excel
scripts/import-csv.mjs  CSV -> lib/characters.generated.ts
scripts/make-icons.mjs  Erzeugt die App-Icons
```

## Für später: Mehrspielermodus

Die Architektur ist darauf vorbereitet:

- `lib/prompts.ts` und `lib/schemas.ts` trennen Rolle, Wissen und Antwortformat
  sauber - ein zweiter Spieler bekommt einfach eine eigene Rolle („du bist
  heimlich Tier X“) statt eines Claude-Charakters.
- Der Fall steckt bereits in einem versiegelten, zustandslosen Objekt. Für zwei
  Geräte braucht es nur einen gemeinsamen Ort dafür - dafür bietet sich
  **Firebase** (Firestore + anonyme Anmeldung) an: ein Dokument pro Raum mit
  Fall-Siegel, Zügen und Chatverlauf, beide Clients hören per `onSnapshot` mit.
- Gedacht ist: Spieler 2 zieht ein zufälliges Tier, antwortet selbst statt
  Claude, und Wimpy muss herausfinden, welches Tier hinter den Antworten steckt.
  Claude kann dabei die übrigen Tiere weiterspielen und als Schiedsrichter
  bewerten, wie gut Spieler 2 in seiner Rolle geblieben ist.

## Befehle

| Befehl               | Zweck                                       |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Lokal entwickeln                            |
| `npm run build`      | Produktions-Build (macht auch den Typecheck)|
| `npm run typecheck`  | Nur Typen prüfen                            |
| `npm run import:csv` | Charaktere aus der CSV neu einlesen         |
| `npm run lint`       | Linter                                      |
