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

Alle Bilder liegen unter `public/`, weil Next.js nur von dort ausliefert. Die
URLs sind trotzdem genau die gewünschten:

| Ordner               | URL im Spiel   | Inhalt              |
| -------------------- | -------------- | ------------------- |
| `public/charaktere/` | `/charaktere/` | Tiere               |
| `public/orte/`       | `/orte/`       | Schauplätze         |
| `public/items/`      | `/items/`      | Gegenstände/Spuren  |

In jedem Ordner liegt eine `README.md` mit der exakten Liste der erwarteten
Dateinamen. Solange ein Bild fehlt, zeigt die App einen Platzhalter mit dem
Namen - das Spiel funktioniert also auch ohne Grafiken schon vollständig.

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

Alle Farben liegen als CSS-Variablen ganz oben in `app/globals.css` - dort einmal
ändern reicht, um das ganze Spiel umzufärben.

## Projektstruktur

```
app/
  layout.tsx            Metadaten, PWA-Einstellungen, Viewport (iPhone-tauglich)
  page.tsx              Hält alles zusammen: Tabs, Overlays, Spielfluss
  globals.css           Komplettes Styling (Safe-Areas, Dark Noir)
  api/case/route.ts     Fall erzeugen (Täter würfeln + Claude)
  api/talk/route.ts     Gespräch mit einem Charakter
  api/search/route.ts   Umsehen an einem Ort
  api/accuse/route.ts   Finale Beschuldigung und Auflösung
components/             Bildschirme und Overlays
lib/
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
