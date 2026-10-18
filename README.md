# Sportify

Mobile Trainings-App (Deutsch) als installierbare PWA: Trainingsplan A/B, Pausen-Timer mit Signalton, Intervall-Timer, Kalender, Fortschritt.

**Enthält keine persönlichen Daten.** Plan, Log und Werte werden einmalig per „Import“ aus einer lokalen JSON-Datei geladen und nur im Browser (localStorage) gespeichert.

Muskelzuordnung der Übungen nach dem Katalog von [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0; ExerciseDB-Einträge MIT). Keine openGym-Bilder/Animationen enthalten. Übungstexte selbst geschrieben.

## Übungsbilder

- Fast alle Demo-Bilder (Start/Ende) stammen aus [free-exercise-db](https://github.com/yuhonas/free-exercise-db) von yuhonas – Public Domain ([Unlicense](https://unlicense.org/)). Verkleinert und als WebP konvertiert.
- „Bird Dog“: Bild „Bird Dog“ von Settebello via [wger.de](https://wger.de/de/exercise/1572/view/), Lizenz [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); verkleinert und als WebP konvertiert. Diese bearbeitete Datei (`img/birddog-0.webp`) steht ebenfalls unter CC BY-SA 4.0.
- Zuordnung Übung → Bild: `src/media-map.json` im Projekt (neue Übungen dort ergänzen, `python3 build.py`). Ohne passendes freies Bild: Fußspitzen heben an der Wand.
