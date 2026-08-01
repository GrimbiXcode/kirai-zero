# Architekturentscheidungen

Kurze Notizen zu Entscheidungen, die man später sonst nicht mehr nachvollziehen
kann. Neue Einträge unten anhängen.

## 1. Eigene API und eigene Datenbank statt Backend-as-a-Service

Supabase, Firebase und Auth0 wären schneller aufgesetzt. Alle drei bedeuten
einen weiteren Auftragsverarbeiter mit US-Mutterkonzern — für einen sozialen
Graphen samt der Frage, wer wen kennt und was jemand meidet. Fastify +
PostgreSQL auf einem EU/CH-Host kostet mehr Betriebsaufwand und lässt dafür
keine Frage nach Drittlandtransfers offen.

(Ursprünglich stand hier zusätzlich das Argument, die Daten könnten Allergien
enthalten. Seit Eintrag 11 trifft das nicht mehr zu; die Entscheidung trägt
auch ohne.)

## 2. Zentraler Item-Katalog statt Freitext

Die Eventplanung („welche Zutat mag niemand am Tisch") ist eine Mengenoperation
über die Präferenzen mehrerer Personen. Mit Freitext scheitert sie an
„Koriander" gegen „koriander" gegen „Corriander". Der Katalog dedupliziert über
einen normalisierten Slug, der Umlaute transliteriert (`Süsskartoffel` →
`suesskartoffel`).

Der Slug ist pro Art eindeutig, nicht global: „Schokolade" existiert sinnvoll
sowohl als Lebensmittel wie auch als Geschenkidee.

## 3. `stance` und `reason` getrennt — *überholt durch Eintrag 11*

Eine einzige Skala von „liebe ich" bis „hasse ich" verliert die wichtigste
Information: ob jemand etwas nicht mag oder nicht verträgt. Für die
Gastgeberin ist der Unterschied zwischen Geschmack und Allergie der Unterschied
zwischen einer Unhöflichkeit und einem Notfall. Deshalb zwei Felder — und im
Freundesprofil werden Allergien und Unverträglichkeiten vorangestellt.

## 4. Zwei Auth-Transporte

Der Web-Build ist same-site und nutzt ein httpOnly-Cookie. Der Capacitor-Build
läuft unter `capacitor://localhost` und ist damit zwangsläufig cross-origin;
ein Cookie bräuchte dort `SameSite=None` und wäre fragiler als ein Bearer-Token
aus dem sicheren Gerätespeicher. Die Middleware akzeptiert beides.

Schreibende Zugriffe mit Cookie-Authentifizierung verlangen zusätzlich einen
Origin aus der Allowlist. Zusammen mit `SameSite=Lax` deckt das CSRF ab, ohne
ein Token-Verfahren einzuführen. Bearer-Requests sind bauartbedingt nicht
CSRF-anfällig, weil kein Browser den Header von sich aus mitschickt.

## 5. 404 statt 403 für Fremde

`GET /api/friends/:userId/profile` antwortet Unbeteiligten mit 404. Ein 403
würde bestätigen, dass es das Konto gibt — das ist selbst schon eine Auskunft
über eine andere Person.

## 6. Keine Analytics, keine externen Ressourcen

Bewusste Produktentscheidung, kein Versehen. Konkret heisst das für jeden
neuen Codeabschnitt:

- keine Skripte, Schriften, Bilder oder Stylesheets von fremden Hosts — alles
  wird mitgeliefert (die CSP `default-src 'self'` erzwingt das)
- keine Fehler- oder Performance-Telemetrie an Dritte
- keine Cookies ausser dem Sitzungscookie

Wer das ändern will, ändert zuerst dieses Dokument und das Datenschutzkonzept.

## 7. i18n ohne Bibliothek

Ein typisiertes Wörterbuch (`apps/web/src/i18n`) statt i18next: die App hat
wenige hundert Strings, braucht keine Pluralregeln-Engine und soll klein
bleiben. Fehlende Schlüssel fallen beim Typecheck auf, nicht erst zur Laufzeit.
Eine weitere Sprache ist eine zusätzliche Datei mit demselben Typ.

## 8. Quellcode-Pakete ohne Build-Schritt

`packages/shared` wird direkt als TypeScript-Quelle eingebunden
(`exports: "./src/index.ts"`) und von Vite, tsx und tsup aufgelöst. Deshalb
verwenden Imports im gesamten Repository **keine** `.js`-Endungen —
`moduleResolution: "bundler"` erwartet das so, und drizzle-kit kann die
Endungen beim Laden des Schemas nicht auf `.ts` zurückführen.

## 9. Einwilligung als Schranke, nicht als Hinweis — *überholt durch Eintrag 11*

Art. 9 Abs. 2 lit. a DSGVO verlangt eine *ausdrückliche* Einwilligung, und der
EDSA versteht darunter eine ausdrückliche Erklärung — nicht bloss eine
eindeutige bestätigende Handlung. Ein Hinweistext, der beim Auswählen des
Grundes mitläuft, ist keine Erklärung. Deshalb blockiert eine eigene,
unvorbelegte Checkbox das Speichern, und der Server weist einen Eintrag ohne
`consentGiven` mit `consent_required` ab.

Betroffen sind vier Gründe, nicht zwei: `religious` und `ethical` fallen unter
«religiöse oder weltanschauliche Überzeugungen» und stehen in Art. 9 Abs. 1
gleichrangig neben Gesundheitsdaten. `isHealthCritical` bleibt davon
unberührt — das steuert weiterhin nur die Hervorhebung im Freundesprofil, wo es
um Gefahr am Esstisch geht und nicht um Rechtsgrundlagen. Für die
Einwilligungspflicht gibt es `isSpecialCategory`.

Die Prüfung hängt nicht an der Sichtbarkeit. Art. 9 beschränkt das Verarbeiten,
nicht erst das Weitergeben; ein privat gehaltener Allergie-Eintrag braucht die
Einwilligung genauso.

Nicht auflösbar bleibt, dass sich solche Merkmale nach EuGH C-184/20 auch
ableiten lassen — «kein Schweinefleisch» kann eine Überzeugung offenbaren, ohne
dass jemand `religious` wählt. Das wird im Einwilligungstext benannt, damit die
Einwilligung wenigstens informiert ist.

## 10. Löschen: markieren, sofort entziehen, dann räumen

Zugesagt sind 24 Stunden bis zur endgültigen Löschung. Statt weiterhin direkt
hart zu löschen, markiert `DELETE /api/me` die Zeile und ein stündlicher Job
räumt sie ab. Das macht die Löschung zu einem beobachtbaren Vorgang und passt
zur Backup-Aufbewahrung.

Der Preis wäre ein Zeitfenster, in dem die Daten noch da sind — deshalb
passiert in derselben Transaktion alles, was Zugriff und Sichtbarkeit ausmacht:
Identifikatoren werden überschrieben (Anmeldung unmöglich, Handle sofort wieder
frei), Sitzungen, Freundschaften und Anfragen werden gelöscht. Was
zurückbleibt, ist über keine Route mehr erreichbar, weil das Freundesprofil
eine Freundschaft und die eigene Liste eine Sitzung verlangt.

Eine Wiederherstellung innerhalb des Fensters gibt es bewusst nicht: sie würde
verlangen, dass die Freundschaften bestehen bleiben, und damit müsste jede
Abfrage gelöschte Konten ausfiltern — viel mehr Fläche für ein Leck als der
Nutzen wert ist.

## 11. Kein Feld für das Warum

Die App fragt nicht, weshalb jemand etwas nicht mag. Ein Eintrag auf der
negativen Seite sagt genau eine Sache: *bekomme ich das vorgesetzt oder
geschenkt, esse ich es nicht bzw. werfe es weg.* Das ist zuerst eine
Produktentscheidung — wer eintragen will, muss sich nicht zwischen sechs
Gründen entscheiden, und die Kategorien halfen ohnehin niemandem beim Kochen
oder beim Schenken.

Die Nebenwirkung ist der grössere Gewinn. Mit `reason` erhob die App
Gesundheitsdaten (`allergy`, `intolerance`) und Angaben zur Weltanschauung
(`religious`, `ethical`), also besondere Kategorien nach Art. 9 Abs. 1 DSGVO.
Daran hing eine Kette: ausdrückliche Einwilligung samt Nachweis, Altersschranke
nach Art. 8 DSGVO, DSFA-Pflicht nach Art. 35 Abs. 3 lit. b, möglicherweise ein
Datenschutzbeauftragter. Ohne das Feld fällt die ganze Kette weg — Art. 8 etwa
gilt ausdrücklich nur, «wenn Art. 6 Abs. 1 lit. a Anwendung findet», und
Rechtsgrundlage ist jetzt durchgehend Art. 6 Abs. 1 lit. b.

Was bleibt: aus einer Liste gemiedener Speisen lässt sich weiterhin etwas
ableiten, und nach EuGH C-184/20 genügt Ableitbarkeit für Art. 9. Das ist einer
App über Essensvorlieben inhärent. Der Unterschied ist, dass die App es nicht
mehr erhebt, nicht strukturiert, nicht auswerten kann und keinen Zweck damit
verfolgt. Dokumentiert in `docs/dpia.md`.

Mit dem Grund fiel auch die Stufe `avoid` weg: sie unterschied sich von
`dislike` nur, solange ein Grund den Schweregrad lieferte. Vier Stufen bleiben,
die Abstufung nach oben (`love` gegen `like`) trägt weiterhin, weil sie beim
Geschenk den Unterschied macht.

Weil die Bedeutung jetzt nicht mehr aus dem Grund hervorgeht, steht sie
ausgeschrieben über der Spalte — einmal in der eigenen Liste, einmal im
Freundesprofil.

## 12. Restore benachrichtigt alle Betroffenen

Sicherungen laufen nach 90 Tagen ab; einzelne Personen daraus zu löschen ist
bei verschlüsselten Vollsicherungen nicht sinnvoll möglich. Das Problem ist
nicht die Aufbewahrung, sondern der Ernstfall: ein Restore kann ein gelöschtes
Konto zurückbringen, ohne dass die betroffene Person davon erfährt.

Deshalb ist die Benachrichtigung Teil des Restore-Vorgangs, nicht eine
Kulanzgeste: **alle** Personen in der wiederhergestellten Datenbank werden
angeschrieben, gerade auch die zurückgeholten, mit dem Hinweis, das Konto
erneut zu löschen oder sich beim Support zu melden. Ablauf und fertiger
Mailtext stehen in `docs/privacy-concept.md`.

Kein Code: die App verschickt im Normalbetrieb keine E-Mails, und ein Restore
ist ein seltener, manueller Vorgang. Ein Mailversand dafür aufzubauen hiesse,
einen weiteren Auftragsverarbeiter einzuführen — für einen Fall, der von Hand
ohnehin begleitet wird.

## 13. Ein Behälter für beide Fälle, Status berechnet statt gespeichert

Ein Personen-Profil ist die private Notizsammlung eines Nutzers über einen
Menschen. Ob dieser Mensch ein Konto hat, ist eine Eigenschaft dieses
Behälters (`linked_user_id`) und kein eigener Typ. Damit deckt dasselbe Modell
beide Wege ab: die Grossmutter ohne Konto, die sich später vielleicht
registriert, und der Freund, dem man ohne Umweg Vermutungen anhängt. Ein
registriertes Konto kann so mit n Profilen verknüpft sein — eines je Freund,
der Notizen über es führt.

**Der Abgleich wird bei jedem Lesen berechnet**, nicht beim Verknüpfen
gespeichert. Ein Flag wäre am Tag darauf falsch, sobald die Person den Eintrag
selbst nachträgt. Verglichen wird die Richtung, nicht der exakte Wert: «Liebe
ich» gegen «Mag ich» ist Zustimmung. Neben *bestätigt* und *unbestätigt* gibt
es *widerspricht* — genau der Fall, in dem das Handeln nach der eigenen
Vermutung den Schaden anrichtet, den die App verhindern soll. Ihn als
«unbestätigt» zu verstecken wäre die schlechtere Antwort.

**Der Abgleich verschafft keinen Einblick.** Er läuft nur unter Freunden und
nur über Einträge mit `visibility = 'friends'`. Ein privat gehaltener Eintrag
der Person ist von einem fehlenden nicht zu unterscheiden — sonst wäre das
Verknüpfen ein Weg, mehr zu sehen als auf dem Freundesprofil. Dafür gibt es je
einen Test in `persons.test.ts` und im E2E-Durchlauf.

**Verknüpfen setzt eine bestätigte Freundschaft voraus**, und die Verknüpfung
endet mit ihr. Ohne Beziehung wäre sie eine Behauptung über jemanden, zu dem
gar kein Kontakt besteht, und sie würde ohnehin keinen Abgleich liefern. Beim
Entfreunden und beim Löschen des verknüpften Kontos fällt sie weg; die Notizen
bleiben, denn sie sind die Daten ihres Erstellers. Preis: nach einer erneuten
Freundschaft muss man neu verknüpfen.

**Was die App über Dritte weiss, bleibt minimal.** Ein unverknüpftes Profil
besteht aus einem frei gewählten Anzeigenamen — keine E-Mail, keine Nummer,
kein Geburtsdatum. Die Pflichten nach Art. 14 und 15 DSGVO sind damit nicht
erledigt, aber klein gehalten; sie stehen als offene Frage in
`docs/legal-review-checklist.md`.
