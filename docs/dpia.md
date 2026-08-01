# Datenschutz-Folgenabschätzung — kirai-zero

Nach Art. 35 DSGVO und Art. 22 revDSG. **Entwurf** — die kursiven Felder muss
der Verantwortliche vor einem Produktivstart ausfüllen; alles andere beschreibt
den Stand der Anwendung und ist aus dem Code belegbar.

Diese DSFA ist zugleich die Antwort auf die Frage, *wie* geprüft wird, ob die
Einwilligungslösung trägt: sie ist das dafür vorgesehene Instrument. Der
Ablauf drumherum steht in [`legal-review-checklist.md`](legal-review-checklist.md).

| | |
|---|---|
| **Verantwortlicher** | *auszufüllen: Name, Anschrift, Kontakt* |
| **Datenschutzbeauftragter / Berater** | *auszufüllen, siehe Checkliste Schritt 2* |
| **Stand** | *Datum der Fassung* |
| **Fassung des Einwilligungstexts** | `art9-2026-08` (Konstante `CONSENT_VERSION` in `packages/shared/src/enums.ts`) |

## 1. Warum überhaupt eine DSFA

Art. 35 Abs. 3 lit. b DSGVO verlangt sie bei umfangreicher Verarbeitung von
Daten nach Art. 9 Abs. 1. kirai-zero verarbeitet solche Daten nicht nebenbei,
sondern als Kernfunktion: Allergien und Unverträglichkeiten sind
Gesundheitsdaten, Gründe wie «Überzeugung» und «Religion» offenbaren religiöse
oder weltanschauliche Ansichten. Ob «umfangreich» erreicht ist, hängt an der
Nutzerzahl — die DSFA vorsorglich zu führen ist der günstigere Weg, als sie
später nachzuholen.

Nach Art. 22 revDSG gilt dasselbe, sobald ein hohes Risiko für die
Persönlichkeit besteht; die Bearbeitung besonders schützenswerter Daten in
grossem Umfang ist dort ausdrücklich als Beispiel genannt.

## 2. Systematische Beschreibung der Verarbeitung

**Zweck.** Nutzende halten fest, was sie mögen und was nicht, und geben es
Personen frei, die sie als Freunde bestätigt haben. Das soll verhindern, dass
Geschenke weggeworfen werden und dass Gastgeber Speisen zubereiten, die Gäste
nicht mögen oder nicht vertragen.

**Datenkategorien.** Siehe Verarbeitungsverzeichnis in
[`privacy-concept.md`](privacy-concept.md). Für diese DSFA relevant:

| Kategorie | Feld | Art. 9? |
|---|---|---|
| Kontodaten | E-Mail, Handle, Anzeigename, Passwort-Hash | nein |
| Präferenz | Gegenstand, Haltung, Notiz, Sichtbarkeit | nein |
| Präferenzgrund | `allergy`, `intolerance` | ja — Gesundheitsdaten |
| Präferenzgrund | `religious`, `ethical` | ja — religiöse/weltanschauliche Überzeugungen |
| Präferenzgrund | `taste`, `other` | nein |
| Einwilligungsnachweis | Zeitpunkt, Fassung | nein |

**Empfänger.** Ausschliesslich Personen, welche die betroffene Person selbst
als Freunde bestätigt hat, und auch dort nur Einträge mit Sichtbarkeit
«Für Freunde sichtbar». Keine Weitergabe an Dritte, keine Auftragsverarbeiter
ausser dem Hoster.

**Ort.** *auszufüllen: Hoster und Rechenzentrumsstandort (EU oder CH).*

**Aufbewahrung.** Konto und Einträge bis zur Löschung durch die betroffene
Person; danach Markierung und endgültige Löschung durch einen stündlich
laufenden Job (Zusage: höchstens 24 h). Backups 90 Tage, danach automatisch
gelöscht. Sitzungen längstens 30 Tage.

**Rechtsgrundlagen.**

| Verarbeitung | DSGVO | revDSG |
|---|---|---|
| Konto, Freundschaften, gewöhnliche Präferenzen | Art. 6 Abs. 1 lit. b | Art. 31 Abs. 2 lit. a |
| Präferenzen mit Art.-9-Grund | Art. 6 Abs. 1 lit. a **und** Art. 9 Abs. 2 lit. a | Art. 6 Abs. 7 lit. a |

Die doppelte Grundlage bei Art.-9-Daten ist Absicht: der EDSA geht davon aus,
dass eine Ausnahme nach Art. 9 Abs. 2 die Rechtsgrundlage nach Art. 6 nicht
ersetzt. Beides wird in einem Akt eingeholt.

## 3. Notwendigkeit und Verhältnismässigkeit

- **Datenminimierung.** Erhoben werden E-Mail, Handle, Anzeigename und die
  selbst erfassten Einträge. Kein Telefon, keine Adresse, kein Geburtsdatum,
  kein Adressbuch-Abgleich, keine Standortdaten, keine Zahlungsdaten.
- **Keine Erhebung auf Vorrat.** Keine Analyse-Dienste, keine Werbe-IDs, keine
  Profilbildung. Sitzungen speichern weder IP-Adresse noch User-Agent; die
  Logs enthalten keine Client-Adresse.
- **Erforderlichkeit der Art.-9-Daten.** Der Zweck — verhindern, dass jemand
  etwas Unverträgliches vorgesetzt bekommt — lässt sich ohne die Unterscheidung
  zwischen «mag ich nicht» und «vertrage ich nicht» nicht erreichen. Ein
  Verzicht auf das Feld würde den Schutzzweck aufheben, den die Anwendung
  gerade verfolgt.
- **Freiwilligkeit.** Kein Grund muss angegeben werden; die Voreinstellung ist
  «Geschmack». Wer keinen Art.-9-Grund wählt, kann die App vollständig nutzen.
  Die Einwilligung ist damit nicht an die Leistungserbringung gekoppelt
  (Art. 7 Abs. 4 DSGVO).
- **Granularität.** Die Einwilligung wird je Eintrag erteilt, nicht pauschal
  fürs Konto.

## 4. Risiken für die betroffenen Personen

| # | Risiko | Eintritt | Schwere | Massnahme |
|---|---|---|---|---|
| R1 | Gesundheits- oder Glaubensangaben werden Personen bekannt, die sie nicht kennen sollen | mittel | hoch | Zugriff nur über bestätigte Freundschaft, eine einzige Prüfstelle (`requireFriendship`), durch Tests abgedeckt; Sichtbarkeit je Eintrag steuerbar |
| R2 | Einwilligung genügt den Anforderungen an «ausdrücklich» nicht | mittel | hoch | eigene, unvorbelegte Checkbox, die das Speichern blockiert; Text nennt Angabe, Zweck, Empfänger und Widerruf; Nachweis mit Zeitpunkt und Textfassung gespeichert |
| R3 | Merkmale lassen sich aus Einträgen **ableiten**, auch ohne Art.-9-Grund (EuGH C-184/20) | hoch | mittel | technisch nicht auflösbar; im Einwilligungstext ausdrücklich benannt, damit die Einwilligung informiert ist; Sichtbarkeit «Nur für mich» steht für jeden Eintrag bereit |
| R4 | Kontoübernahme legt die gesamte Liste offen | niedrig | hoch | argon2id nach OWASP-Parametern, Sitzungstoken nur als SHA-256-Hash gespeichert, Ratenbegrenzung auf Login und Registrierung, Login-Antwort ohne Kontoauskunft |
| R5 | Daten überleben die Löschung | niedrig | hoch | Zugriff und Sichtbarkeit enden in derselben Transaktion, Identifikatoren werden sofort überschrieben, Job löscht endgültig; Backups verfallen nach 90 Tagen |
| R6 | Betroffene wissen nicht, was gespeichert ist | niedrig | mittel | Selbstbedienungs-Export als JSON, enthält auch den Einwilligungsnachweis |
| R7 | Minderjährige erteilen eine Einwilligung, die sie nicht wirksam erteilen können | *offen* | mittel | **noch nicht umgesetzt**, siehe Abschnitt 6 |

## 5. Restrisiko

Nach den Massnahmen verbleiben R3 (Ableitbarkeit, prinzipbedingt) und R7
(Alter, noch nicht adressiert). R3 ist dem Zweck der Anwendung inhärent: eine
App, die Vorlieben teilt, kann nicht verhindern, dass daraus Schlüsse gezogen
werden — sie kann es nur transparent machen und die Sichtbarkeit in die Hand
der betroffenen Person legen.

*Einschätzung des Verantwortlichen, ob das Restrisiko «hoch» im Sinn von
Art. 36 DSGVO / Art. 23 revDSG bleibt: auszufüllen.* Fällt sie auf «hoch», ist
die Aufsichtsbehörde bzw. der EDÖB vorab zu konsultieren.

## 6. Offene Punkte

1. **Mindestalter und Art. 8 DSGVO.** Es gibt heute keine Altersabfrage. Zu
   entscheiden: Mindestalter festlegen und abfragen, oder Einwilligung der
   Erziehungsberechtigten einholen. Ohne Entscheidung bleibt R7 offen.
2. **Datenschutzerklärung und Impressum** verfassen und im UI verlinken; der
   Einwilligungstext muss darauf verweisen.
3. **Auftragsverarbeitungsvertrag** mit dem Hoster.
4. **Backups**: die 90-Tage-Frist und die automatische Löschung sind
   dokumentiert, aber noch nicht technisch belegt — Prüfung, dass die
   Aufbewahrungsregel beim gewählten Hoster tatsächlich greift.
5. **Vertreter** nach Art. 27 DSGVO bzw. Art. 14 revDSG, je nach Sitz des
   Verantwortlichen.

## 7. Grundlagen

- EDSA, Leitlinien 05/2020 zur Einwilligung — ausdrückliche Einwilligung
  verlangt eine ausdrückliche Erklärung
- EuGH, Urteil vom 1.8.2022, C-184/20 — Art. 9 erfasst auch mittelbar
  ableitbare Merkmale
- Art. 35, 36 DSGVO; Art. 22, 23 revDSG
