# Videos

Hier liegen die Videos, die vor einem Erzählerteil laufen - vor einem Kapitel,
vor dem Finale, zwischen zwei Sagen eines Arcs. Eingetragen wird der Pfad im
Admin-Menü (z.B. `/video/kapitel-1.mp4`); wo nichts eingetragen ist, kommt
auch kein Video.

## Format

Das Spiel zeigt das Video bildschirmfüllend und beschneidet, was nicht ins
Bild passt ("cover"). Fürs iPhone 16 Pro heißt das:

- **Hochformat 9:19,5**, am besten 1179 × 2556 (oder 886 × 1920 - reicht auch)
- **MP4 (H.264 oder HEVC), AAC-Ton** - das spielt iOS ohne Umwege
- Wichtiges in die Bildmitte: Ränder können auf anderen Geräten wegfallen
- Möglichst klein halten - alles hier wird beim Öffnen aus dem Netz geladen

Beispiel mit ffmpeg:

```
ffmpeg -i roh.mov -vf "scale=1179:2556:force_original_aspect_ratio=increase,crop=1179:2556" \
  -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 128k -movflags +faststart kapitel-1.mp4
```

## Im Spiel

Das Video startet von allein. Erlaubt der Browser keinen Ton, läuft es stumm
weiter und ein Knopf schaltet ihn an. Nach kurzer Zeit erscheint
"Überspringen ›". Fehlt die Datei, geht es sofort weiter - ohne Fehlermeldung.
