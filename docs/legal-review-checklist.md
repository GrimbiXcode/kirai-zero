# Rechtliche Prüfung — wie vorgehen

Die Ausgangsfrage war: *«Reicht eine Einwilligung für die Gesundheitsangaben,
und wie prüfe ich das?»* Die kurze Antwort: eine Einwilligung ist der richtige
Weg, aber sie muss **ausdrücklich** sein, und geprüft wird das nicht durch
Nachlesen, sondern durch die Schritte unten. Diese Liste ist die Reihenfolge;
[`dpia.md`](dpia.md) ist das Dokument, das dabei entsteht.

## Was die Recherche ergeben hat

1. **Die Einwilligung trägt** — Art. 9 Abs. 2 lit. a DSGVO und Art. 6 Abs. 7
   lit. a revDSG sehen sie ausdrücklich vor. Die anderen Ausnahmen in Art. 9
   Abs. 2 passen nicht: «offensichtlich öffentlich gemacht» (lit. e) scheidet
   aus, weil die Listen nur für bestätigte Freunde sichtbar sind, und die
   Haushaltsausnahme in Art. 2 Abs. 2 lit. c gilt für die Nutzenden, nicht für
   den Betreiber der Plattform.
2. **«Ausdrücklich» heisst mehr als anklicken.** Der EDSA verlangt eine
   ausdrückliche Erklärung und nennt dafür etwa das Ausfüllen eines
   elektronischen Formulars oder eine zweistufige Bestätigung. Ein
   Informationstext, der beim Auswählen mitläuft, genügt nicht — deshalb hat
   die App jetzt eine eigene, unvorbelegte Checkbox, die das Speichern
   blockiert, und speichert Zeitpunkt und Textfassung als Nachweis
   (Art. 7 Abs. 1).
3. **Es sind vier Gründe, nicht zwei.** `religious` und `ethical` fallen unter
   «religiöse oder weltanschauliche Überzeugungen» in Art. 9 Abs. 1, genau wie
   `allergy` und `intolerance` unter Gesundheitsdaten.
4. **Ableitung genügt.** Nach EuGH C-184/20 greift Art. 9 auch, wenn sich das
   Merkmal nur ableiten lässt. Das ist bei einer App über Essensvorlieben nicht
   vollständig vermeidbar und deshalb im Einwilligungstext benannt.
5. **Art. 9 betrifft das Verarbeiten, nicht erst das Teilen.** Auch ein privat
   gehaltener Allergie-Eintrag braucht die Einwilligung; die Schranke im Server
   prüft deshalb unabhängig von der Sichtbarkeit.

## Die Schritte

### 1. DSFA ausfüllen — selbst, ohne Anwalt

[`dpia.md`](dpia.md) ist bis auf die kursiven Felder fertig. Auszufüllen sind
Verantwortlicher, Hosting-Standort, Datum und die Einschätzung des Restrisikos.
Aufwand: ein bis zwei Stunden. Das Ergebnis entscheidet über Schritt 3.

### 2. Klären, ob ein Datenschutzbeauftragter nötig ist

**EU:** Art. 37 Abs. 1 lit. c DSGVO verlangt einen DSB, wenn die Kerntätigkeit
in der umfangreichen Verarbeitung von Art.-9-Daten besteht. Bei kirai-zero ist
die Verarbeitung Kerntätigkeit — offen ist allein, ob sie «umfangreich» wird.
Das hängt an der Nutzerzahl und ist deshalb bei jedem Wachstumsschritt neu zu
beurteilen, nicht einmalig.

**Schweiz:** ein Berater nach Art. 10 revDSG ist freiwillig, hat aber einen
konkreten Vorteil — private Verantwortliche dürfen dann auf die Konsultation
des EDÖB verzichten (Art. 23 Abs. 4 revDSG).

### 3. Nur bei hohem Restrisiko: Behörde vorab konsultieren

Bleibt das Restrisiko nach Schritt 1 «hoch», ist die Konsultation Pflicht:
Art. 36 DSGVO bei der zuständigen Aufsichtsbehörde, Art. 23 revDSG beim EDÖB.
Der EDÖB antwortet innert zwei bis drei Monaten — das gehört in die Planung,
nicht in die Woche vor dem Start.

### 4. Kurzgutachten eines Fachanwalts

Nicht für «ist Datenschutz nötig», sondern für die drei Fragen, die sich aus
der Recherche nicht abschliessend beantworten lassen:

1. Genügt die umgesetzte Checkbox-Lösung dem Erfordernis der ausdrücklichen
   Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO und Art. 6 Abs. 7 revDSG — oder
   braucht es eine zweistufige Bestätigung?
2. Wie ist mit der Ableitbarkeit nach C-184/20 umzugehen? Genügt der Hinweis im
   Einwilligungstext, oder folgt daraus eine weitergehende Pflicht?
3. Welches Mindestalter ist anzusetzen, und muss es aktiv abgefragt werden
   (Art. 8 DSGVO)? Das ist der einzige Punkt, an dem die App heute noch gar
   nichts tut.

Mit der ausgefüllten DSFA im Anhang prüft ein Anwalt ein Dokument, statt die
Verarbeitung erst zu rekonstruieren — das ist der Unterschied zwischen einem
Kurzgutachten und einem Mandat.

### 5. Datenschutzerklärung, Impressum, AVV

Erst danach, weil die Texte auf den Ergebnissen aufbauen. Dazu der
Auftragsverarbeitungsvertrag mit dem Hoster und die Prüfung, ob ein Vertreter
nach Art. 27 DSGVO bzw. Art. 14 revDSG nötig ist.

## Was die App bereits mitbringt

Damit die Prüfung nicht bei null anfängt:

| Anforderung | Wo |
|---|---|
| Verarbeitungsverzeichnis (Art. 30) | [`privacy-concept.md`](privacy-concept.md) |
| DSFA-Entwurf | [`dpia.md`](dpia.md) |
| Einwilligungstext | `apps/web/src/i18n/de.json`, Schlüssel `lists.consent*` |
| Nachweis der Einwilligung | Spalten `consented_at`, `consent_version` in `preferences` |
| Auskunft und Übertragbarkeit | `GET /api/me/export` |
| Löschung | `DELETE /api/me` plus Job in `apps/api/src/lib/housekeeping.ts` |
| Belege, dass die Zusagen halten | Tests in `apps/api/test/`, insbesondere `special-category consent` und `account deletion` |
