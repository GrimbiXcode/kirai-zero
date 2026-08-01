# Rechtliche Prüfung — wie vorgehen

Die ursprüngliche Frage war, ob eine Einwilligung für Gesundheitsangaben
genügt. Sie hat sich erledigt: die App fragt nicht mehr, warum jemand etwas
nicht mag, und verarbeitet damit keine besonderen Kategorien von Daten mehr.
Diese Liste hält fest, was dadurch entfallen ist und was noch zu tun bleibt.

## Was entfallen ist — und warum

| Thema | Status | Grund |
|---|---|---|
| Ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO / Art. 6 Abs. 7 revDSG | **entfällt** | Ohne Begründungsfeld werden weder Gesundheitsdaten noch religiöse oder weltanschauliche Überzeugungen erhoben. Rechtsgrundlage ist durchgehend Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 31 Abs. 2 lit. a revDSG |
| Altersgrenze und Elterneinwilligung nach Art. 8 DSGVO | **entfällt** | Art. 8 Abs. 1 greift ausdrücklich nur, «wenn Art. 6 Abs. 1 lit. a Anwendung findet». Ohne Einwilligung als Rechtsgrundlage gibt es keine Altersschranke und keine Verifikationspflicht |
| Pflicht zur Datenschutz-Folgenabschätzung, Art. 35 Abs. 3 lit. b DSGVO | **entfällt** | Der Auslöser ist die umfangreiche Verarbeitung von Art.-9-Daten. [`dpia.md`](dpia.md) wird freiwillig weitergeführt |
| Datenschutzbeauftragter, Art. 37 Abs. 1 lit. c DSGVO | **entfällt** | Derselbe Auslöser. In der Schweiz war ein Berater nach Art. 10 revDSG ohnehin freiwillig |
| Vorabkonsultation, Art. 36 DSGVO / Art. 23 revDSG | **entfällt**, solange das Restrisiko nicht als «hoch» eingestuft wird | Setzt eine DSFA mit hohem Restrisiko voraus |

## Was zu tun bleibt

### 1. Restrisiko bestätigen

[`dpia.md`](dpia.md) ausfüllen — es fehlen Verantwortlicher, Hosting-Standort,
Datum und die Bestätigung der Risikoeinschätzung. Aufwand: unter einer Stunde.

### 2. Kurzgutachten, falls gewünscht

Nur noch drei Fragen, und keine davon ist dringend:

1. Trägt die Einschätzung zum Ableitungsrisiko (EuGH C-184/20)? Die App erhebt
   nichts Besonderes, aber eine Liste gemiedener Speisen kann ein Merkmal
   erkennen lassen. Ist das dem Verantwortlichen zurechenbar, wenn er weder
   danach fragt noch danach auswerten kann?
2. Wie ist mit Minderjährigen umzugehen? Art. 8 DSGVO greift nicht mehr, aber
   Art. 8 Abs. 3 lässt das nationale Vertragsrecht unberührt — die
   Handlungsfähigkeit beim Vertragsschluss bleibt also eine Frage der AGB.
3. Genügt der Restore-Prozess (Benachrichtigung aller Betroffenen per Mail,
   Hinweis auf erneute Löschung) als Umgang mit gelöschten Konten in
   Sicherungen?
4. **Personen-Profile:** Nutzende können private Notizen über andere führen —
   über Menschen ohne Konto und über bestätigte Freunde. Genügt eine generische
   Aussage in der Datenschutzerklärung der Informationspflicht nach Art. 14, oder
   braucht es eine Mitteilung an die betroffene Person? Und trägt Art. 15 Abs. 4
   die Entscheidung, diese Notizen bei einer Auskunft nicht herauszugeben, weil
   sie die private Einschätzung samt Urheber offenlegen würden?

### 3. Dokumente und Verträge

- Datenschutzerklärung und Impressum verfassen und im UI verlinken
- Auftragsverarbeitungsvertrag mit dem Hoster
- Sobald die App E-Mails verschickt — etwa für die Restore-Benachrichtigung —
  AVV mit dem Mailanbieter; Anbieter in EU oder CH wählen
- Prüfen, ob ein Vertreter nach Art. 27 DSGVO bzw. Art. 14 revDSG nötig ist

## Was die App mitbringt

| Anforderung | Wo |
|---|---|
| Verarbeitungsverzeichnis (Art. 30) | [`privacy-concept.md`](privacy-concept.md) |
| Risikoeinschätzung | [`dpia.md`](dpia.md) |
| Auskunft und Übertragbarkeit | `GET /api/me/export` |
| Löschung | `DELETE /api/me` plus Job in `apps/api/src/lib/housekeeping.ts` |
| Restore-Ablauf samt Mailtext | [`privacy-concept.md`](privacy-concept.md) |
| Belege, dass die Zusagen halten | Tests in `apps/api/test/`, insbesondere `friend profile access` und `account deletion` |
