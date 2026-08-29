# Ortsbilder

Ein Bild pro Schauplatz. Der Dateiname ist `<stadt>-<ort>.png` (kleingeschrieben,
Umlaute ausgeschrieben, Sonderzeichen als Bindestrich) - genau so, wie es
`npm run import:orte` ausgibt und wie es im Admin-Menü unter **Bilder** steht.

Aus `data/locations.csv` ergeben sich aktuell:

| Stadt        | Ort          | Datei                             |
| ------------ | ------------ | --------------------------------- |
| Venedig      | Dal Moros    | `venedig-dal-moros.png`           |
| Venedig      | Bahnhof      | `venedig-bahnhof.png`             |
| Venedig      | Markusplatz  | `venedig-markusplatz.png`         |
| Venedig      | Harry's Bar  | `venedig-harry-s-bar.png`         |
| Venedig      | Giardini     | `venedig-giardini.png`            |
| Longyearbyen | Husky Café   | `longyearbyen-husky-cafe.png`     |
| Longyearbyen | Brauerei     | `longyearbyen-brauerei.png`       |
| Longyearbyen | Wildnis      | `longyearbyen-wildnis.png`        |
| Longyearbyen | Supermarkt   | `longyearbyen-supermarkt.png`     |
| Longyearbyen | Stadt        | `longyearbyen-stadt.png`          |

Empfehlung: Querformat, ca. 1600 × 1000 px. Die Bilder werden bildschirmfüllend
gezeigt, der untere Rand wird von einem Farbverlauf überlagert.

Neue Städte oder Orte: Zeile in `data/locations.csv` ergänzen,
`npm run import:orte` ausführen (nennt dir den erwarteten Dateinamen) und das
PNG ablegen. Jede Stadt braucht mindestens so viele Orte, wie ein Fall
Schauplätze hat (Standard: fünf).
