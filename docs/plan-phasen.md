# Datumsphasen und Tagesausnahmen

Die App löst den Trainingsplan zur Laufzeit nach dem **Kalenderdatum Europe/Berlin** auf. Eine Phase und eine Tagesausnahme können Wochenplan, Einheiten und Übungsdefinitionen ersetzen. Das ist ein Datenformat für `plan/current.json`. Diese Datei und `examples/phase-fictional.json` enthalten **keinen echten Trainingsplan**.

Alte `plan/current.json` ohne die neuen Felder bleiben gültig. Logs, Gewichte, Geräte und der Plan eines anderen Profils werden von diesem Format nicht umgeschrieben.

## Datei, die die App liest

Unverändert, im privaten Repo `tinofavetto/sportify-logs`:

- Tino: `plan/current.json`
- anderes Profil: `users/<id>/plan/current.json` (Steffi: `users/steffi/plan/current.json`)

```json
{
  "kind": "sportify-plan",
  "version": "20261107-1800",
  "updatedAt": "2026-11-07T18:00:00.000Z",
  "plan": {}
}
```

`version` ist eine Zeichenkette und muss **lexikografisch größer** sein als `plan._ver` auf dem Gerät (die App vergleicht mit `<=`). Bisheriges Muster `YYYYMMDD-HHMM` beibehalten und eine spätere Zeit nehmen. `plan.sessions` muss vorhanden bleiben, sonst ignoriert `loadPlan` die Datei.

## Neue Felder im Planobjekt

Beide Felder sind optional. Fehlende Felder ändern nichts am bisherigen Plan.

### `phases[]`

Eine Phase gilt an einem Berliner Kalendertag `D`, wenn `from <= D` und (`until` fehlt oder `D <= until`). Mehrere passende Phasen werden nach `from` aufsteigend angewendet; bei gleichem `from` nach `id`. Das spätere Objekt gewinnt feldweise.

| Feld | Wirkung |
| --- | --- |
| `id` | Optional, nur zur Anzeige/Sortierung. |
| `from` | `YYYY-MM-DD`, inklusive, Pflicht. Ohne gültiges `from` wird die Phase ignoriert. |
| `until` | `YYYY-MM-DD`, inklusive. Weglassen = offen. |
| `note` | Infotext, solange die Phase gilt. Ersetzt keinen Workout. |
| `schedule` | Wochentage, die sich ändern. Nicht genannte Tage bleiben aus dem bisherigen Plan. |
| `week` | Dieselben Schlüssel, nur der Text auf der Planseite. |
| `sessions` | Pro Schlüssel (`A`, `B`, `cardio`, `interval`, `rest` oder ein eigener Name) wird **die ganze Einheit ersetzt**. |
| `exercises` | Pro Übungs-ID flache Ergänzung der Bibliothek (Name, `how`, `cues`, `m`, `legs`, …). |
| `extras` | Pro Schlüssel ersetzt. `null` entfernt den Zusatzblock. |
| `warmSteps`, `warmup`, `supersetNote`, `notInPlan`, `muscleTarget`, `notes`, `planStart` | Ersetzen den bisherigen Wert, wenn das Feld gesetzt ist. |
| `goal`, `rules`, `sleep`, `steps`, `supplements`, `deload` | Flach gemischt. Nicht genannte Unterfelder bleiben. |

### `exceptions`

Schlüssel sind `YYYY-MM-DD`. Alias, falls schon vorhanden: `dayOverrides` (nur gelesen, wenn `exceptions` fehlt). Die Ausnahme wird **nach** den Phasen auf genau diesen Tag gelegt.

| Feld | Wirkung |
| --- | --- |
| `type` | Geplanter Tag: `rest`, `cardio`, `interval`, `A`, `B`, `AB` oder ein Sitzungsschlüssel wie `recovery`. |
| `title` | Überschrift nur an diesem Tag, solange der Tag nicht manuell auf einen anderen Typ gestellt wurde. |
| `note` | Infotext nur an diesem Tag. Wird nicht ins Log geschrieben. |
| `session` | Ersetzt an diesem Tag `sessions[type]` komplett (eigener Walk, eigene Sätze). |
| `items` | Ersetzt nur die `items` von `sessions[type]`. |
| `optionalItems` | Zusätzliche Übungen, als optional markiert. Bei Krafttagen zusätzlich zur Einheit, sonst unter der Cardio-/Ruhekarte. |
| `exercises` | Wie in der Phase, nur für die Auflösung dieses Tags. |
| `skipLegs` | `true`: Übungen mit `legs` werden an diesem Tag nicht automatisch verplant, auch wenn der Typ danach manuell auf Kraft gestellt wird. |
| `factor`, `setFactor` | Zusätzliche Multiplikatoren auf Gewicht und Satzzahl (wie Deload, nur dieser Tag). |
| `forbid` | Wirkt nur **ohne** `type`: ein geplanter Slot aus dieser Liste wird zu `rest`. |

`schedule` / `week` verwenden `"0"` (Sonntag) bis `"6"` (Samstag). Erlaubt sind auch `so`/`mo`/`di`/`mi`/`do`/`fr`/`sa` und englische Kurznamen. Ein fehlender Schlüssel heißt nicht „löschen“, sondern „vom bisherigen Plan behalten“. Ruhe explizit als `"rest"` setzen.

Ein eigener Sitzungsschlüssel (`"5": "recovery"` plus `sessions.recovery`) nutzt die vorhandene Darstellung:

- `kind: "cardio"` mit `walkOnly: true` → Incline-Walk-Karte
- `kind: "interval"` → Intervallkarte
- `kind: "strength"` oder `items` ohne Cardio/Intervall → Krafteinheit
- `kind: "rest"` oder nur `desc` → Ruhetag

`short` setzt das Kalenderkürzel (sonst das Kürzel von `kind`).

Cardio-Einheiten, die flach bleiben sollen, setzen `segments.step` auf `0` und eine niedrige `rec.incline`. `step: 0` erzeugt keine harte Phase mehr. `since` auf der Einheit begrenzt, ab wann alte Cardio-Logs Steigung und Tempo fortschreiben. Die eingebaute Walk-Vorlage gilt weiter, wenn `walkOnly` fehlt oder der Name „Crosstrainer“ enthält.

## A/B

`AB` ist ein Krafttag. Der Buchstabe läuft über **alle Kraftslots** in Kalenderreihenfolge weiter, auch über die Wochengrenze und über einen Phasenwechsel. Kraftslots sind geplante `AB`, feste `A`/`B` und bereits gespeicherte Tage vom Typ A oder B.

Anker ist der letzte gespeicherte Typ A oder B **vor** dem angezeigten Tag (`days[datum].type`). Danach zählt jeder geplante Krafttag, auch wenn er noch nicht geloggt ist. Ein gespeicherter Nicht-Kraft-Typ verbraucht keinen Buchstaben. Ein gespeicherter A/B-Typ setzt die Kette neu auf.

Ohne `schedule` bleibt das alte Wochenmuster: Mo/Mi/Fr Kraft, Di/Do Cardio, Sa Intervall, So Ruhe. Mit `schedule` zählt die App nur die dort gesetzten Krafttage und nimmt nicht Mo/Mi/Fr an.

Beispiel, Anker Freitag 2026-11-06 = B, Phase ab 2026-11-09 mit Kraft Mo/Mi/Sa: 09.11. A, 11.11. B, 14.11. A, 16.11. B, 18.11. A, 21.11. B. Der 16.11. ist ein Montag und damit B, nicht wieder A.

Gespeicherte Tage, Gewichte und Geräte bleiben. Dieselbe `ex`-ID schreibt in denselben Verlauf. Eine neue ID startet bei `rec` der Einheit und hat keine alten Sätze.

## Datum, Cache, offline

„Heute“ ist `Europe/Berlin`, nicht die Zeitzone des Geräts und nicht das Build-Datum. Ohne `?date=` wird das beim Öffnen, beim Zurückkehren in die App und einmal pro Minute neu gelesen. Liegt die App über Mitternacht offen, springt der heutige Tag mit. `?date=YYYY-MM-DD` bleibt eine feste Vorgabe.

Der Service-Worker-Cache heißt nicht mehr `sportify-0d0b46b5` und enthält `plan-phase.js`. Nach dem Deploy einmal online öffnen, damit die neue Hülle installiert wird. Danach wählt die gecachte App die Phase aus dem bereits gespeicherten Plan, auch wenn GitHub nicht erreichbar ist. Ein älterer App-Stand ignoriert `phases` und `exceptions` still und zeigt nur den Basisplan.

Die App-Version in „Daten“ und in gesendeten Einheiten ist `20261108-1415`. Ein Merge dieses Stands ist noch keine Veröffentlichung auf dem Handy.

## Verlauf und andere Profile

- `applyData` ersetzt weiterhin nur den Plan. `days`, `weights`, Geräte und Einstellungen bleiben.
- Einheiten mit derselben Übungs-ID behalten Progression, RIR und Gewichtsschritte.
- Ein Plan ohne `phases`/`exceptions` behält seine Einheiten. Sein `schedule` entscheidet die Krafttage.
- Steffis Plan nur anfassen, wenn ihr privater `users/steffi/plan/current.json` wirklich neu gepusht werden soll. Diese Änderung verlangt das nicht.

## Veröffentlichung auf dem Elternrechner

Nicht den Inhalt von `/workspace/sportify/src/private.js` und keine echten Logs in dieses öffentliche Repo kopieren. `examples/phase-fictional.json` nicht nach `sportify-logs` pushen (`version` dort ist absichtlich `20990101-0000`).

1. Diesen PR mergen (nicht vorher) und das GitHub-Pages-Deploy abwarten. Auf dem Handy Sportify einmal online öffnen und unter Daten die Version `20261108-1415` sehen. Bis dahin gilt auf dem Gerät weiter der alte Wochenplan.
2. In der **privaten** Planquelle (`/workspace/sportify/src/private.js` bzw. dem Builder, der bisher `push-plan.py` füttert) am bestehenden Planobjekt `phases` und `exceptions` ergänzen. `sessions`, `schedule`, Deload, Ziel und die bisherigen Übungs-IDs der Basis behalten.
3. Für die angenommene Umstellung reichen inhaltlich, mit den echten privaten Einheiten statt der fiktiven:
   - Ausnahme `2026-11-07`: `type: "cardio"`, eigene flache Walk-Einheit (`walkOnly: true`, `segments.step: 0`, niedrige Steigung, `since` auf diesen Tag), optionale Technik als `optionalItems`, `skipLegs: true`. Kein `interval` und keine schwere Beineinheit als geplanter Typ.
   - Ausnahme `2026-11-08`: `type: "rest"`.
   - Phase `from: "2026-11-09"` ohne `until`: `schedule` mit Mo/Mi/Sa = `AB`, Fr = Sitzung der aktiven Erholung, So = `rest`. Di/Do nur eintragen, wenn sie sich ändern; sonst bleiben sie. `sessions.A` und `sessions.B` komplett auf die neuen Übungen setzen (nicht nur eine Notiz). Neue Übungen unter `exercises` definieren. `week` und bei Bedarf `warmSteps` mitliefern.
4. `version` erhöhen, `updatedAt` setzen.
5. Das bestehende `push-plan.py` wie bei den letzten Planständen laufen lassen. Es schreibt das private `plan/current.json`. Steffi nicht mitschreiben, wenn sich ihr Plan nicht ändert.
6. Sportify öffnen (online, damit `plan/current.json` ankommt). Danach funktioniert die Auflösung offline aus localStorage. Prüfen: 07.11. flacher Walk ohne hartes Intervall, 08.11. Ruhe, 09.11. A, 11.11. B, 14.11. A, 16.11. B, 18.11. A, 21.11. B, sofern der letzte gespeicherte Krafttag vor dem 09.11. ein B am 06.11. ist.
7. Verlauf nicht neu veröffentlichen. Wer eine Übung weiterführen will, behält ihre `ex`-ID.

Die fiktive Form derselben Struktur steht in `examples/phase-fictional.json`. Tests: `node --test test/plan-phase.test.js`.
