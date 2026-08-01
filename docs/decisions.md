# Architekturentscheidungen

Kurze Notizen zu Entscheidungen, die man später sonst nicht mehr nachvollziehen
kann. Neue Einträge unten anhängen.

## 1. Eigene API und eigene Datenbank statt Backend-as-a-Service

Supabase, Firebase und Auth0 wären schneller aufgesetzt. Alle drei bedeuten
einen weiteren Auftragsverarbeiter mit US-Mutterkonzern für Daten, die
Gesundheitsangaben enthalten können (Allergien). Fastify + PostgreSQL auf einem
EU/CH-Host kostet mehr Betriebsaufwand und lässt dafür keine Frage nach
Drittlandtransfers offen.

## 2. Zentraler Item-Katalog statt Freitext

Die Eventplanung („welche Zutat mag niemand am Tisch") ist eine Mengenoperation
über die Präferenzen mehrerer Personen. Mit Freitext scheitert sie an
„Koriander" gegen „koriander" gegen „Corriander". Der Katalog dedupliziert über
einen normalisierten Slug, der Umlaute transliteriert (`Süsskartoffel` →
`suesskartoffel`).

Der Slug ist pro Art eindeutig, nicht global: „Schokolade" existiert sinnvoll
sowohl als Lebensmittel wie auch als Geschenkidee.

## 3. `stance` und `reason` getrennt

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

## 9. Einwilligung als Schranke, nicht als Hinweis

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
