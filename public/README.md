# Statische Dateien

| Datei / Ordner     | Wofür                                                     |
| ------------------ | --------------------------------------------------------- |
| `start.png`        | Titelbild des Startbildschirms (Hochformat, z.B. 1080×1920) |
| `audio/intro.mp3`  | Titelsong - seine Länge bestimmt die Länge des Intros      |
| `charaktere/`      | Tierbilder                                                 |
| `orte/`            | Schauplätze                                                |
| `items/`           | Gegenstände und Spuren                                     |
| `icons/`           | App-Icons für den Home-Bildschirm                          |

Beim Startbild liegt der Platz für die Knöpfe im oberen Drittel („Himmel“):
Der Titel sollte in den oberen ~22 % stehen, darunter braucht es eine ruhige
Fläche. Fehlt `start.png`, zeigt die App stattdessen den Schriftzug.

Ein neuer Titelsong ersetzt einfach `audio/intro.mp3` - das Intro passt sich
automatisch an die neue Länge an.
