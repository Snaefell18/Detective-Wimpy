# Charakterbilder

Hier kommen die Tier-PNGs rein. **Der Dateiname muss der Id aus der CSV entsprechen**
(Name in Kleinbuchstaben, Umlaute ausgeschrieben, Leerzeichen als Bindestrich).

Aktuell erwartet das Spiel:

| Charakter | Tierart    | Datei         |
| --------- | ---------- | ------------- |
| Wimpy     | Bushbaby   | `wimpy.png`   |
| Chat      | Katze      | `chat.png`    |
| Fan       | Kiwi       | `fan.png`     |
| Mikkeli   | Husky      | `mikkeli.png` |
| Jumpy     | Koboldmaki | `jumpy.png`   |

Empfehlung: quadratisch, 512x512 px, transparenter Hintergrund. Die App zeigt die
Bilder rund beschnitten - also genug Rand um das Tier lassen.

Solange ein Bild fehlt, zeigt die App automatisch einen Platzhalter mit dem Namen.

Wer einen anderen Dateinamen braucht, hängt in `data/characters.csv` eine
zusätzliche Spalte `Bild` an (z. B. `/charaktere/chat-elegant.png`) und führt
`npm run import:csv` aus.
