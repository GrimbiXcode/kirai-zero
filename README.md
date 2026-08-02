# kirai-zero

Eintragen, was man mag und was nicht — und es mit Freundinnen und Freunden
teilen. Damit Geschenke nicht im Müll landen und beim Abendessen nichts auf den
Tisch kommt, das jemand nicht verträgt.

*kirai* (嫌い) ist japanisch für „nicht mögen". Ziel sind null unerwünschte
Geschenke.

## Was der MVP kann

- Konto anlegen, an- und abmelden
- Vorlieben und Abneigungen erfassen: Haltung („Liebe ich" bis „Mag ich nicht"),
  optionale Notiz, Sichtbarkeit pro Eintrag — ohne Angabe von Gründen
- Freundschaftsanfragen senden, annehmen, ablehnen, beenden
- Das Profil einer befreundeten Person ansehen
- Private Profile für Menschen anlegen, die (noch) kein Konto haben, und
  festhalten, was man über sie zu wissen glaubt — sichtbar nur für einen selbst
- Ein solches Profil mit dem Konto eines Freundes verknüpfen: die eigenen
  Vermutungen werden dann als bestätigt, widersprechend oder unbestätigt
  ausgewiesen
- Eigene Daten exportieren und das Konto sofort löschen

Läuft als Webapp/PWA und, über Capacitor aus derselben Codebasis, als App für
iOS und Android.

**Noch nicht enthalten:** Eventplanung mit Gäste-Aggregation, Präferenz-Anfragen
an Freunde („magst du X?"), Push-Benachrichtigungen. Datenmodell und API sind so
geschnitten, dass diese Features additiv dazukommen.

## Aufbau

```
apps/api        Fastify + Drizzle + PostgreSQL
apps/web        Vite + React, PWA, Capacitor-Wrapper
packages/shared Zod-Schemas, Enums und Typen für beide Seiten
docs/           Datenschutzkonzept und Architekturentscheidungen
```

Voraussetzungen: Node 22+, pnpm 10+, PostgreSQL 16 (oder Docker).

## Loslegen

```bash
cp .env.example .env
docker compose up -d postgres        # oder eine lokale PostgreSQL-Instanz
pnpm install
pnpm db:migrate
pnpm db:seed                         # ~250 Katalogeinträge auf Deutsch
pnpm dev                             # API auf :3000, Web auf :5173
```

Die Datenbank `kirai_test` legt docker-compose beim ersten Start mit an; ohne
Docker einmalig `createdb kirai_test` (und `createdb kirai_e2e` für die
End-to-End-Tests).

## Tests

```bash
pnpm test        # API-Integrationstests (Postgres nötig) + Web-Unit-Tests
pnpm test:e2e    # Playwright gegen den echten Stack
pnpm typecheck
```

Die API-Tests laufen gegen `TEST_DATABASE_URL` und legen den Schwerpunkt auf
Autorisierung: Fremde sehen nichts, private Einträge verlassen den Server nicht,
das Beenden einer Freundschaft entzieht den Zugriff sofort, eine Kontolöschung
lässt nichts zurück.

Bringt die Umgebung ein Chromium mit, dessen Build-Nummer nicht zu Playwright
passt, hilft `PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chromium pnpm test:e2e`.

## Handy-Apps

```bash
pnpm --filter web build
pnpm --filter web exec cap add ios      # einmalig
pnpm --filter web exec cap add android  # einmalig
pnpm --filter web exec cap sync
```

Die gebauten Assets werden in die App gepackt; `server.url` ist bewusst nicht
gesetzt, es wird zur Laufzeit nichts nachgeladen. Die API-Adresse kommt aus
`VITE_API_URL` zur Buildzeit.

Auf dem Web läuft die Anmeldung über ein httpOnly-Cookie, in den nativen Builds
über ein Bearer-Token im sicheren Gerätespeicher — die API akzeptiert beides.

## Datenschutz

Kern der Anwendung, nicht Beiwerk:

- Gespeichert werden nur E-Mail, Benutzername, Anzeigename, Passwort-Hash und
  die selbst erfassten Einträge
- Keine Analyse, kein Tracking, keine Werbung, keine externen Skripte oder
  Schriften — die API sendet `default-src 'self'`
- Sitzungen ohne IP-Adresse und ohne User-Agent; Logs ohne Client-Adresse
- Export und Löschung sind im Produkt, nicht auf Anfrage per E-Mail

**Kein Feld für das Warum.** Die App fragt nicht, weshalb jemand etwas nicht
mag. Ein Eintrag sagt nur: bekomme ich das vorgesetzt oder geschenkt, esse ich
es nicht bzw. werfe es weg. Damit werden weder Gesundheitsdaten noch Angaben
zur Weltanschauung erhoben — es gibt keine besonderen Kategorien nach Art. 9
DSGVO, keine Einwilligung und keine Altersschranke.

**Notizen über andere.** Personen-Profile enthalten Angaben über Menschen, die
sie selbst nicht gemacht haben. Deshalb: nur ein frei gewählter Anzeigename,
keine weiteren Identifikatoren; verknüpft wird nur mit bestätigten Freunden;
der Abgleich zeigt nichts, was das Freundesprofil nicht ohnehin zeigt. Die
Pflichten nach Art. 14 und 15 DSGVO stehen als offene Frage in der
Prüf-Checkliste.

**Fristen.** Sitzungen längstens 30 Tage. Beim Löschen des Kontos enden Zugriff
und Sichtbarkeit sofort; ein stündlicher Job entfernt die Daten endgültig
(zugesagte Obergrenze 24 Stunden). Backups werden nach 90 Tagen automatisch
gelöscht. Muss je eine Sicherung eingespielt werden, werden alle Betroffenen
per E-Mail informiert.

Wer am Code arbeitet, findet die Konventionen und die nicht verhandelbaren
Regeln in [`AGENTS.md`](AGENTS.md).

Details und das Verarbeitungsverzeichnis stehen in
[`docs/privacy-concept.md`](docs/privacy-concept.md), die Risikoeinschätzung in
[`docs/dpia.md`](docs/dpia.md) und der Stand der rechtlichen Prüfung in
[`docs/legal-review-checklist.md`](docs/legal-review-checklist.md). Warum die
Architektur so aussieht, wie sie aussieht, steht in
[`docs/decisions.md`](docs/decisions.md).

## Docker

Ein Image für die ganze App: der API-Prozess liefert auch den gebauten
Web-Client aus. Damit besteht ein Deployment aus einem Container plus
PostgreSQL — und alles läuft auf einer Origin, wodurch CORS und
Cross-Site-Cookies gar nicht erst zum Thema werden.

```bash
docker build -t kirai-zero .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/kirai \
  kirai-zero
```

Der Container wendet beim Start die Migrationen an und spielt den Katalog ein;
beides ist idempotent. `SKIP_MIGRATIONS=true` schaltet es ab, falls die
Migration separat laufen soll. Der Ablauf setzt **eine** Instanz voraus —
mehrere Repliken gegen dieselbe Datenbank bräuchten ein Lock.

Gebaute Images liegen auf `ghcr.io/grimbixcode/kirai-zero`.

## Deployment

`docker-compose.deploy.yml` ist eine Vorlage für einen Server:

```bash
cp .env.deploy.example .env      # POSTGRES_PASSWORD setzen
docker compose -f docker-compose.deploy.yml up -d
```

Die App horcht auf `127.0.0.1:3000` — davor gehört ein Reverse Proxy mit TLS
(Caddy, nginx, Traefik). `COOKIE_SECURE=true` ist in der Vorlage gesetzt und
verlangt HTTPS. PostgreSQL wird bewusst nicht nach aussen exponiert.

## Continuous Integration

| Auslöser | Was passiert |
|---|---|
| Jeder Push und Pull Request | Typecheck, Unit- und Integrationstests, End-to-End-Lauf |
| Push auf `main` | Image bauen und einmal gegen eine Datenbank starten — ohne Push |
| Tag `v*` | Image bauen und nach `ghcr.io` pushen, inklusive `latest` |

Für den Registry-Push ist kein Secret nötig; der eingebaute `GITHUB_TOKEN`
reicht. Die Workflows liegen in `.github/workflows/`.

## Betrieb

Für Produktion mindestens setzen:

```
NODE_ENV=production
DATABASE_URL=…            # PostgreSQL in EU oder CH
CORS_ORIGINS=https://…    # Web-Origin, plus capacitor://localhost für iOS
COOKIE_SECURE=true        # verlangt TLS
```

Die Sitzungsbereinigung läuft im API-Prozess selbst (stündlich); ein Cronjob ist
nicht nötig.
