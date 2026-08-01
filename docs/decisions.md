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
