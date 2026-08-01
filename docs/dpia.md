# Risikoeinschätzung — kirai-zero

**Freiwillig geführt.** Eine Datenschutz-Folgenabschätzung ist nach Art. 35
Abs. 3 lit. b DSGVO bei umfangreicher Verarbeitung von Daten nach Art. 9 Abs. 1
Pflicht. Seit die App nicht mehr fragt, *warum* jemand etwas nicht mag,
verarbeitet sie keine solchen Daten mehr — der Auslöser ist entfallen (siehe
[`decisions.md`](decisions.md), Eintrag 11). Dasselbe gilt für die Pflicht zum
Datenschutzbeauftragten nach Art. 37 Abs. 1 lit. c.

Das Dokument bleibt trotzdem bestehen: die Risiken verschwinden nicht dadurch,
dass die formale Pflicht wegfällt, und ein Anwalt oder eine Aufsichtsbehörde
liest lieber ein vorhandenes Dokument als eine Behauptung.

| | |
|---|---|
| **Verantwortlicher** | *auszufüllen: Name, Anschrift, Kontakt* |
| **Stand** | *Datum der Fassung* |

## 1. Was verarbeitet wird

| Kategorie | Feld | Art. 9? |
|---|---|---|
| Kontodaten | E-Mail, Handle, Anzeigename, Passwort-Hash | nein |
| Präferenz | Gegenstand, Haltung, Notiz, Sichtbarkeit | nein |
| Freundschaften | Nutzer-IDs, Status, Zeitstempel | nein |

Vollständig im Verarbeitungsverzeichnis in
[`privacy-concept.md`](privacy-concept.md).

**Zweck.** Nutzende halten fest, was sie mögen und was sie — bekämen sie es
vorgesetzt oder geschenkt — nicht essen bzw. wegwerfen würden, und geben es
Personen frei, die sie als Freunde bestätigt haben. Damit sollen Geschenke
nicht im Müll landen und Gastgeber nicht am Geschmack ihrer Gäste vorbeikochen.

**Rechtsgrundlage.** Durchgehend Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 31 Abs. 2
lit. a revDSG. Keine Einwilligung, damit auch keine Altersschranke nach Art. 8
DSGVO — der gilt ausdrücklich nur, wenn Art. 6 Abs. 1 lit. a Anwendung findet.

**Empfänger.** Nur Personen, welche die betroffene Person selbst bestätigt hat,
und auch dort nur Einträge mit Sichtbarkeit «Für Freunde sichtbar». Keine
Dritten, kein Auftragsverarbeiter ausser dem Hoster.

**Aufbewahrung.** Konto bis zur Löschung durch die betroffene Person, danach
Markierung und endgültige Löschung durch einen stündlichen Job (zugesagt:
höchstens 24 h). Backups 90 Tage. Sitzungen längstens 30 Tage.

## 2. Notwendigkeit und Verhältnismässigkeit

- **Datenminimierung.** E-Mail, Handle, Anzeigename, Einträge. Kein Telefon,
  keine Adresse, kein Geburtsdatum, kein Adressbuch, kein Standort, keine
  Zahlungsdaten.
- **Kein Begründungsfeld.** Die App fragt nicht nach dem Warum. Das war eine
  Produktentscheidung — sie macht das Eintragen einfacher — und hat als
  Nebenwirkung die gesamte Art.-9-Verarbeitung beseitigt.
- **Keine Erhebung auf Vorrat.** Keine Analyse-Dienste, keine Werbe-IDs, keine
  Profilbildung. Sitzungen ohne IP-Adresse und User-Agent, Logs ohne
  Client-Adresse.
- **Sichtbarkeit in der Hand der Person.** Jeder Eintrag lässt sich einzeln auf
  «Nur für mich» stellen oder löschen.

## 3. Risiken

| # | Risiko | Eintritt | Schwere | Massnahme |
|---|---|---|---|---|
| R1 | Einträge werden Personen bekannt, die sie nicht kennen sollen | mittel | mittel | Zugriff nur über bestätigte Freundschaft, eine einzige Prüfstelle (`requireFriendship`), durch Tests abgedeckt; Sichtbarkeit je Eintrag steuerbar |
| R2 | Aus einer Liste lässt sich ein besonderes Merkmal **ableiten** (EuGH C-184/20) | mittel | mittel | nicht auflösbar, siehe unten |
| R3 | Kontoübernahme legt die gesamte Liste offen | niedrig | mittel | argon2id nach OWASP-Parametern, Sitzungstoken nur als SHA-256-Hash, Ratenbegrenzung auf Login und Registrierung, Login-Antwort ohne Kontoauskunft |
| R4 | Daten überleben die Löschung | niedrig | hoch | Zugriff und Sichtbarkeit enden in derselben Transaktion, Identifikatoren sofort überschrieben, Job löscht endgültig; Backups verfallen nach 90 Tagen, Restore löst eine Benachrichtigung aller Betroffenen aus |
| R5 | Jemand schreibt etwas Heikles ins freie Notizfeld | niedrig | niedrig | Freitext gehört der Person, wird nicht ausgewertet und nicht strukturiert; die App legt es weder nahe noch fragt sie danach |

## 4. Restrisiko

**R2 bleibt und ist der einzige nennenswerte Punkt.** Wer sieht, dass jemand
Schweinefleisch und Alkohol meidet, kann daraus etwas schliessen. Das ist einer
App über Essensvorlieben inhärent — sie kann es nicht verhindern, nur nicht
selbst betreiben. Konkret:

- Es gibt kein Feld, das ein solches Merkmal benennt.
- Es gibt keine Struktur, nach der sich filtern oder auswerten liesse.
- Der Verantwortliche verfolgt damit keinen Zweck.
- Die Einträge sehen nur Personen, welche die betroffene Person selbst
  bestätigt hat, und nur solange sie das will.

Damit bleibt ein Restrisiko, aber kein hohes im Sinn von Art. 36 DSGVO bzw.
Art. 23 revDSG. *Diese Einschätzung ist vom Verantwortlichen zu bestätigen.*
Fällt sie anders aus, ist vorab die Aufsichtsbehörde bzw. der EDÖB zu
konsultieren.

## 5. Offene Punkte

Siehe [`legal-review-checklist.md`](legal-review-checklist.md).
