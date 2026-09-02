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
   - `ADMIN_TOKEN` - das Passwort für den Admin-Bereich. Ohne Angabe steht das
     Menü jedem offen, der die Adresse kennt (die Akten bleiben trotzdem zu).
   - `ELEVENLABS_API_KEY` und `ELEVENLABS_VOICE_ID` - optional, für gesprochene
     Erzählertexte (siehe unten). Ohne sie bleibt alles beim Text.
3. Deployen. Fertig - kein Server, keine Datenbank nötig.

## Firebase einrichten

Tiere, Schauplätze, Dinge und vorbereitete Fälle liegen in Firestore
(Projekt `detective-wimpy`). Drei Schritte, einmalig:

1. **Firestore anlegen** - in der Firebase-Konsole unter *Build → Firestore
   Database → Datenbank erstellen* (Region nach Wunsch).
2. **Anonyme Anmeldung aktivieren** - unter *Build → Authentication →
   Sign-in method → Anonym*. Lesen geht auch ohne; für das Speichern aus dem
   Admin-Menü ist sie nötig.
3. **Regeln veröffentlichen** - entweder den Inhalt von `firestore.rules` in
   der Konsole unter *Firestore → Regeln* einfügen, oder:

   ```bash
   npm run firebase:rules      # braucht einmalig: npx firebase-tools login
   ```

Danach im Admin-Menü unter **Tiere / Orte / Dinge** je einmal
„Projektdaten übernehmen“ drücken - damit wandern die Listen aus `data/` in
die Datenbank und lassen sich dort bearbeiten.

### Was wo liegt

| Sammlung     | Inhalt                                              |
| ------------ | --------------------------------------------------- |
| `charaktere` | die Tiere samt Werten                               |
| `orte`       | Schauplätze mit Stadt und Atmosphäre                |
| `items`      | Gegenstände und Spuren                              |
| `faelle`     | vorbereitete Fälle („Kampagnen“)                    |
| `sagen`      | Sagas: mehrere Fälle mit gemeinsamem Überthema      |
| `arcs`       | Arcs: mehrere Sagas unter einem Bogen               |
| `stimmen`    | gesprochene Erzählertexte (siehe unten)             |

Die Sammlungen `sagen` und `arcs` kamen später dazu. Wer seine Regeln vor
diesen Zeilen veröffentlicht hat, bekommt beim Öffnen der Arcs ein
„permission-denied“ - dann einmal `firestore.rules` aus dem Projekt in der
Firebase-Konsole neu veröffentlichen.

Die Lösung eines Falls steht **nicht** im Klartext in der Datenbank: Täter,
Motiv und gelogene Alibis stecken im Feld `siegel` - AES-256-verschlüsselt mit
einem Schlüssel, den nur der Server kennt. Deshalb dürfen Fälle öffentlich
lesbar sein, ohne dass sich jemand die Lösung erspähen kann.

Ist die Datenbank leer oder nicht erreichbar, spielt die App mit den Listen aus
`data/` weiter und sagt das im Admin-Menü.

Bilder gehören nicht in Firestore (ein Dokument darf dort nur 1 MB groß sein) -
sie liegen wie gehabt in `public/`.

## Kampagnen: Fälle vorbereiten

Jeder frisch gestartete Fall kostet einen Modellaufruf. Vorbereitete Fälle
kosten ihn genau einmal:

1. Admin-Menü → **Kampagnen**. Dort lassen sich Vorgaben machen: Name, Thema,
   Stadt, welche Tiere mitspielen, welche Dinge als Spuren vorkommen müssen,
   wer der Täter ist und wie knifflig es sein soll.
2. „Fall erzeugen und speichern“ legt ihn in der Datenbank ab.
3. Im Spiel steht er unter **Kampagnen** (Knopf unter „Neuen Fall starten“) und
   startet sofort - beliebig oft, ohne weitere Kosten.

## Sagas und Arcs

Eine **Saga** ist eine Reihe von Fällen mit gemeinsamem Überthema und einem
Finale, in dem der Drahtzieher auffliegt. Sie entsteht im Admin-Menü unter
**Sagas**; zwischen den Kapiteln spricht der Erzähler, wahlweise mit eigener
Tondatei aus `public/audio`.

Ein **Arc** fasst mehrere Sagas zu einer langen Reihe zusammen:

1. Admin-Menü → **Arcs**. Name, Klappentext, eigener Titelsong (Pfad in
   `public/audio`) und wie viele Sagas es werden sollen - eine bis zehn. Dazu
   gleich am Anfang: worauf alles hinausläuft, wer am Ende der Culprit ist und
   unter welchem Wort er in den Texten vorkommt („Der Schattenkanzler war
   weiterhin auf der Flucht.“). Alles davon lässt sich später ändern.
2. Zu jeder Station gehören ein Erzählertext (optional mit Tondatei) und eine
   Saga. Die Saga lässt sich direkt hier erzeugen oder aus den vorhandenen
   auswählen.
3. Im Spiel öffnet **Arcs** zuerst die Übersicht: alle Sagen untereinander,
   mit Haken an dem, was durch ist. Starten lässt sich immer nur die nächste
   offene - die Reihenfolge ist die Geschichte. Wer mittendrin pausiert,
   findet dort „Weiterspielen“, und nach jeder Saga geht es dorthin zurück.
4. **Der Arc muss nicht am Stück entstehen.** Sobald die erste Station eine
   Saga hat, taucht er im Spiel unter **Arcs** auf und lässt sich spielen. Die
   übrigen Stationen dürfen nachwachsen, während schon gespielt wird - der
   Spielstand liegt auf dem Gerät und liest den Arc bei jedem Start neu.
5. Am Ende steht das große Finale. Gebaut ist bisher der Abschlusstext; die
   Gerichtsverhandlung ist als Art schon vorgesehen und kommt später.

Der Culprit ist dabei mehr als eine Notiz: Bis zur letzten Station bleibt er
aus der Besetzung der erzeugten Sagas heraus - dort kommt er nur unter seinem
Wort vor. In der letzten Saga ist er der Drahtzieher und betritt erst im Finale
die Bühne.

Ein Arc erzeugt keine eigenen Fälle - er verweist auf Sagas, die auch einzeln
spielbar bleiben. Löscht man einen Arc, bleiben seine Sagas erhalten.

## Erzählertexte sprechen lassen

Die Texte zwischen den Kapiteln, Sagas und Arc-Stationen kann ElevenLabs
sprechen. Dafür im Konto einen Schlüssel und eine Stimme aussuchen und beides
in die Umgebungsvariablen legen:

```
ELEVENLABS_API_KEY=…
ELEVENLABS_VOICE_ID=…            # aus der Voice Library kopieren
ELEVENLABS_MODEL=eleven_multilingual_v2   # optional, das ist der Default
```

Danach steht unter jedem Erzählertext im Admin-Menü ein Knopf **„Sprechen
lassen“**. Wichtig ist, wie das läuft:

- Gesprochen wird **einmal**, im Admin-Menü, hinter dem Passwort. Die Aufnahme
  landet als mp3 (32 kbit/s) in der Sammlung `stimmen`, der Erzählerteil merkt
  sich nur `stimme:<id>`.
- Im Spiel wird nichts erzeugt, nur abgespielt. Kein Schlüssel im Browser,
  keine Kosten pro Runde, und ohne Netz hilft der Zwischenspeicher von
  Firestore.
- Der Weg ist bewusst nicht offen: Jeder Aufruf kostet Geld, und eine offene
  Adresse dafür wäre eine Rechnung, die jeder Fremde hochtreiben kann.
- Grenzen: 2500 Zeichen je Text, 700 KB je Aufnahme (etwa drei Minuten) - ein
  Firestore-Dokument darf nur 1 MB groß sein. Längere Texte teilt man auf.

Eine selbst aufgenommene Datei in `public/audio` funktioniert unverändert
weiter; das Feld nimmt beides.

### Neue Gesichter

Stößt in einem Kapitel jemand zum ersten Mal dazu - ein Nachzügler oder im
Finale der Drahtzieher -, läuft davor eine kurze Ansage: „Ein neuer Spieler
betritt das Feld!“, darunter Bild und Name. Wer neu ist, wird nicht geplant,
sondern verglichen: Wer in der Besetzung dieses Falls steht und in der des
vorherigen nicht, ist neu. Das stimmt auch bei von Hand nachbearbeiteten
Sagas.

## Modelle und Kosten

Standard ist **Claude Sonnet 5** (2 $ / 10 $ je Million Token) - stark genug für
Fallkonstruktion und Rollenspiel und deutlich günstiger als Opus (5 $ / 25 $).
Umstellen ohne Codeänderung:

| Variable               | Wofür                          | Default           |
| ---------------------- | ------------------------------ | ----------------- |
| `ANTHROPIC_MODEL`      | Fall erzeugen, Auflösung       | `claude-sonnet-5` |
| `ANTHROPIC_MODEL_TALK` | nur die Gespräche              | wie oben          |

Die Gespräche sind der häufigste Aufruf - wer dort noch sparen will, setzt
`ANTHROPIC_MODEL_TALK=claude-haiku-4-5` (1 $ / 5 $). Umgekehrt bringt
`claude-opus-5` die stärksten Dialoge, kostet aber am meisten.

Sparsam ist die App ohnehin gebaut: Das Weltwissen wird zwischengespeichert
(Prompt-Caching), Gespräche laufen mit niedrigem Aufwand (`effort: "low"`), und
das Durchsuchen der Orte kommt ganz ohne Modell aus.

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
Querformat (ca. 1600 × 1000 px), Gegenstände quadratisch (512 px), das Titelbild
`public/start.png` im Hochformat (z.B. 1080 × 1920).

Ortsbilder heißen `<stadt>-<ort>.png`, also `venedig-markusplatz.png`.
`npm run import:orte` gibt die erwarteten Namen aus.

**Dateiendungen klein schreiben.** Vercel läuft auf Linux und unterscheidet
Groß- und Kleinschreibung: `Fan.PNG` wird unter `/charaktere/fan.png` nicht
gefunden. Am besten alles kleingeschrieben ablegen.

**Bilder klein halten.** Zwei Dinge sorgen dafür, dass die App auch über
Mobilfunk schnell bleibt. Erstens liefert Next.js die Bilder automatisch als
WebP in der Größe aus, die das Gerät wirklich braucht - aus einem 1280-px-PNG
werden auf dem iPhone rund 70 kB statt 500. Zweitens sollten die Dateien im
Repository nicht riesig sein; aus Bildgeneratoren kommen gern 2-3 MB. Einmal

```bash
npm run bilder:optimieren          # verkleinert alles unter public/
npm run bilder:optimieren -- --pruefen   # zeigt nur, was passieren würde
```

und die Dateien liegen bei ~300-500 kB, ohne sichtbaren Verlust; Transparenz
bleibt erhalten.

### 2. Zum Ausprobieren: im Admin-Menü

Unter **Admin → Bilder** kannst du zu jedem Eintrag ein Bild direkt vom Handy
wählen. Es wird verkleinert, im Browser gespeichert und sofort im Spiel benutzt.
Praktisch zum Testen, aber es liegt nur auf diesem einen Gerät - für alle
anderen (und nach dem Leeren der Browserdaten) zählt Weg 1.

Solange ein Bild fehlt, zeigt die App einen Platzhalter mit dem Namen - das
Spiel funktioniert also auch ganz ohne Grafiken.

## Admin-Menü

Auf dem Startbildschirm oben rechts das Zahnrad (oder direkt `/admin`).

**Der ganze Bereich hängt an einem Passwort:** dem `ADMIN_TOKEN` vom Server -
demselben, mit dem auch die Akten geöffnet werden. Geprüft wird es beim Server,
der Browser bekommt nur ein Ja oder Nein; danach bleibt es auf dem Gerät, bis
man oben rechts wieder abschließt. Ist auf dem Server keines gesetzt, sagt der
Bildschirm das und lässt einen trotzdem hinein - sonst käme man an sein eigenes
Menü nicht mehr heran.

Was das schützt und was nicht: Es hält Neugierige vom Menü fern und ist die
einzige Tür zu den Akten - Täter und Lösung gibt der Server ohne dieses
Passwort nicht heraus. Die Stammdaten in Firestore hängen dagegen an den
Datenbankregeln; dieser Bildschirm ersetzt sie nicht.

Dahinter:

- **Tiere / Orte / Dinge** - Einträge anlegen, ändern und löschen; die Werte
  (Charisma, Kriminalität …) stellt man direkt mit Schiebereglern ein. Für
  Tiere und Orte lässt sich weiterhin eine CSV einlesen - sie landet dann
  direkt in der Datenbank.
- **Kampagnen** - Fälle vorbereiten und verwalten (siehe oben).
- **Sagas / Arcs** - lange Reihen anlegen, Erzählertexte und Tondateien
  pflegen (siehe oben).
- **Bilder** - eigene Bilder hinterlegen oder wieder entfernen (siehe oben),
  inklusive Titelbild des Startbildschirms.
- **Spiel** - Stadt (oder Zufall), Schauplätze pro Fall, Intro an/aus,
  Erzählton (kindgerecht, spannend, albern), Anzahl der Beschuldigungen,
  Startverdacht, sowie Zurücksetzen von Einstellungen und Spielstand.

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

## Intro vor jeder Runde

Nach dem Klick auf „Neuen Fall starten“ wird zuerst der Fall erzeugt (ein paar
Sekunden, mit Hinweis auf dem Startbildschirm) - bei einer Kampagne entfällt
das Warten ganz.

Dann spricht der **Prolog** (`public/audio/introdark.mp3`): Die festen Zeilen
des Sprechers erscheinen im Takt der Aufnahme, danach der Anriss dieses Falls,
den Claude beim Erzeugen mitgeschrieben hat. Ohne die Datei läuft der Prolog
stumm in 14 Sekunden durch.

Direkt danach startet der Titelsong (`public/audio/intro.mp3`) und mit ihm die
Vorstellung:
Titelkarte, Stadt, Fallakte mit Schreibmaschinentext, jeder Verdächtige einzeln
mit seinen Werten, die fünf Schauplätze, „Wer war es?“ - und zum Schluss der
Startschuss. So steht im Intro von der ersten Sekunde an alles fest.

Das Intro ist an den Song gekoppelt (`audio.currentTime`), nicht an feste
Sekunden: Es endet **genau** mit dem letzten Ton. Tauschst du die MP3 gegen eine
längere oder kürzere aus, passt sich der Ablauf von selbst an.

Damit der Ton trotz der Wartezeit erlaubt bleibt, wird das Audio-Element schon
im Klick selbst kurz angetippt - Browser lassen Abspielen nur als Folge einer
Nutzergeste zu. Blockiert es doch einmal, läuft das Intro stumm und kürzer;
ein „Ton an“-Knopf und ein Tipp auf den Bildschirm holen die Musik nach.
Überspringen geht immer, und im Admin-Menü lässt sich das Intro abschalten.

## Städte und Schauplätze

Jeder Fall spielt in einer Stadt aus `data/locations.csv`; daraus werden fünf
Schauplätze gezogen (im Admin einstellbar, 3 bis 8). Hat eine Stadt mehr Orte
als nötig, wird gemischt - dieselbe Stadt fühlt sich beim nächsten Fall anders
an. Die Atmosphäre-Spalte geht in die Prompts ein und färbt, was an einem Ort
passiert.

```
Stadt;Location;Atmosphäre
Venedig;Markusplatz;Episch
Longyearbyen;Wildnis;gefährlich
```

Neue Städte einfach anhängen und `npm run import:orte` ausführen - jede Stadt
braucht mindestens so viele Orte, wie ein Fall Schauplätze hat. Wer nichts
einchecken will, liest die Tabelle im Admin-Menü unter **Orte** ein.

## Wie das Spiel funktioniert

1. **Fall erzeugen** (`POST /api/case`): Der Server wählt Stadt und Schauplätze,
   würfelt einen Täter aus allen Verdächtigen und lässt Claude die Geschichte
   darum herum bauen - Tat, Motiv, Alibis, Geheimnisse, Aufenthaltsorte und
   4-6 Spuren, passend zur Stadt.
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

Der Spielstand selbst (Ort, Inventar, Notizen, Chatverläufe, Verdachtswerte)
liegt im `localStorage` des Geräts, ein angefangener Fall überlebt also das
Schließen der App.

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
components/             Bildschirme, Overlays, Prolog und Intro-Sequenz
components/admin/       die Bereiche des Admin-Menüs
lib/
  firebase.ts           Firebase-Anbindung (Firestore + anonyme Anmeldung)
  db.ts                 Lesen und Schreiben der Sammlungen
  stammdaten.ts         Tiere/Orte/Dinge aus der Datenbank, sonst aus data/
  adminStore.ts         Gerätedaten: eigene Bilder und Spieloptionen
  csv.ts                Das CSV-Format - benutzt von App und Import-Skript
  bildUpload.ts         Bilder verkleinern und als Data-URL ablegen
  characters.ts         Charaktere + Helfer (aus der CSV erzeugt)
  locations.ts          Städte und Schauplätze
  items.ts              Gegenstände
  prompts.ts            Alle Prompts an Claude
  schemas.ts            Struktur der Antworten (Zod)
  seal.ts               Verschlüsselung des Falls
  useGame.ts            Spielzustand inkl. Speicherung auf dem Gerät
data/characters.csv     Die Tier-Tabelle aus Excel
data/locations.csv      Städte und ihre Schauplätze
public/audio/intro.mp3  Titelsong - seine Länge ist die Länge des Intros
scripts/import-csv.mjs  CSV -> lib/characters.generated.ts
scripts/import-locations.mjs  CSV -> lib/locations.generated.ts
scripts/make-icons.mjs  Erzeugt die App-Icons
scripts/optimize-images.mjs   Verkleinert die Bilder in public/
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
| `npm run import:orte`| Städte und Orte aus der CSV neu einlesen    |
| `npm run bilder:optimieren` | Bilder in public/ handytauglich verkleinern |
| `npm run firebase:rules` | Sicherheitsregeln und Indizes veröffentlichen |
| `npm run lint`       | Linter                                      |
