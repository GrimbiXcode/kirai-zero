# Datenschutzkonzept kirai-zero

Stand: MVP-Kern mit Einwilligungsschranke und Löschpipeline. Dieses Dokument
beschreibt, was die Anwendung technisch tut. Es ersetzt keine rechtliche
Prüfung — es bereitet sie vor. Wie diese Prüfung abläuft, steht in
[`legal-review-checklist.md`](legal-review-checklist.md); das dabei
entstehende Dokument in [`dpia.md`](dpia.md).

## Grundsatz

Es wird nur erhoben, was die Anwendung zum Funktionieren braucht. Kein
Tracking, keine Analytics, keine Werbe-IDs, keine Profilbildung, keine
Weitergabe an Dritte. Was nicht erhoben wird, braucht keine Löschfrist und kann
nicht abfliessen.

## Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

### V1 — Nutzerkonto

| | |
|---|---|
| **Zweck** | Authentifizierung, Zuordnung der Präferenzen zu einer Person |
| **Datenkategorien** | E-Mail-Adresse, Handle, Anzeigename, Passwort-Hash (argon2id), Sprache, Zeitpunkt der Erstellung und letzten Änderung |
| **Betroffene** | Registrierte Nutzerinnen und Nutzer |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) |
| **Empfänger** | Keine. Nur der Betreiber, Hosting in EU/CH |
| **Löschung** | Auf Verlangen der betroffenen Person; Ablauf siehe «Löschprozess und Aufbewahrung» |
| **Tabelle** | `users` |

Nicht erhoben: Telefonnummer, Adresse, Geburtsdatum, Geschlecht, Adressbuch,
Standort, Zahlungsdaten.

### V2 — Sitzungen

| | |
|---|---|
| **Zweck** | Angemeldet bleiben |
| **Datenkategorien** | SHA-256-Hash des Sitzungstokens, Zeitstempel (erstellt, zuletzt gesehen, Ablauf), Nutzer-ID |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO |
| **Löschung** | Bei Abmeldung, spätestens 30 Tage nach letzter Nutzung; abgelaufene Sitzungen werden stündlich automatisch entfernt. Beim Löschen des Kontos sofort |
| **Tabelle** | `sessions` |

**Ausdrücklich nicht gespeichert:** IP-Adresse und User-Agent. Ein Test in
`apps/api/test/account.test.ts` prüft, dass diese Spalten nicht existieren, damit
das nicht unbemerkt zurückkommt.

### V3 — Präferenzen

| | |
|---|---|
| **Zweck** | Kern des Dienstes: Vorlieben und Abneigungen für Freundinnen und Freunde sichtbar machen |
| **Datenkategorien** | Verweis auf einen Katalogeintrag, Haltung (`stance`), Begründung (`reason`), freie Notiz (max. 280 Zeichen), Sichtbarkeit, Einwilligungsnachweis |
| **Besonderheit** | Vier der sechs Gründe sind **besondere Kategorien** nach Art. 9 Abs. 1 DSGVO: `allergy` und `intolerance` sind Gesundheitsdaten, `religious` und `ethical` offenbaren religiöse oder weltanschauliche Überzeugungen |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO für gewöhnliche Einträge; für die vier genannten Gründe Art. 6 Abs. 1 lit. a **und** Art. 9 Abs. 2 lit. a (ausdrückliche Einwilligung), in der Schweiz Art. 6 Abs. 7 lit. a revDSG |
| **Löschung** | Jederzeit einzeln durch die betroffene Person, vollständig bei Kontolöschung |
| **Tabelle** | `preferences` |

**Einwilligung.** Kein Grund muss angegeben werden; die Voreinstellung ist
«Geschmack», und die App ist ohne jede Art.-9-Angabe voll nutzbar. Wird einer
der vier besonderen Gründe gewählt, verlangt die App eine eigene, unvorbelegte
Bestätigung, bevor gespeichert werden kann — ein blosser Hinweistext wäre keine
ausdrückliche Erklärung im Sinn von Art. 9 Abs. 2 lit. a. Der Server prüft das
ebenfalls und antwortet sonst mit `consent_required`; die Prüfung hängt
**nicht** an der Sichtbarkeit, weil Art. 9 die Verarbeitung selbst beschränkt
und nicht erst die Weitergabe.

Zum Nachweis (Art. 7 Abs. 1) speichert `preferences` Zeitpunkt (`consented_at`)
und Fassung des Textes (`consent_version`). Der Widerruf ist so leicht wie die
Erteilung: ein anderer Grund oder das Löschen des Eintrags entfernt beides.

**Vorbehalt zur Ableitbarkeit.** Nach EuGH C-184/20 genügt es für Art. 9, dass
sich ein Merkmal ableiten lässt — «kein Schweinefleisch» kann auf eine religiöse
Überzeugung hindeuten, auch ohne dass jemand `religious` wählt. Das lässt sich
technisch nicht ausschliessen. Der Einwilligungstext benennt es deshalb
ausdrücklich, und jeder Eintrag lässt sich auf «Nur für mich» stellen.

### V4 — Freundschaften und Anfragen

| | |
|---|---|
| **Zweck** | Zugriffssteuerung: nur befreundete Konten sehen die Listen |
| **Datenkategorien** | Nutzer-IDs beider Seiten, Status, Zeitstempel |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO |
| **Löschung** | Beim Entfernen der Freundschaft, vollständig bei Kontolöschung |
| **Tabellen** | `friendships`, `friend_requests` |

### V5 — Katalog

| | |
|---|---|
| **Zweck** | Gemeinsame Bezeichner, damit Präferenzen verschiedener Personen vergleichbar sind |
| **Datenkategorien** | Name, Slug, Art, optionaler Verweis auf den erstellenden Account |
| **Löschung** | Bei Kontolöschung wird der Autorenverweis auf NULL gesetzt; der Eintrag bleibt, weil andere Personen ihn in ihren Listen verwenden |
| **Tabelle** | `items` |

## Betroffenenrechte

| Recht | Umsetzung |
|---|---|
| Auskunft (Art. 15) | `GET /api/me/export` — vollständiger JSON-Export, in den Einstellungen als Download |
| Datenübertragbarkeit (Art. 20) | derselbe Export, maschinenlesbar |
| Berichtigung (Art. 16) | Präferenzen sind jederzeit editierbar |
| Löschung (Art. 17) | `DELETE /api/me` — siehe Löschprozess unten |
| Einschränkung (Art. 18) | Einzelne Einträge lassen sich auf `visibility = private` setzen, statt sie zu löschen |

Im Export erscheinen Dritte (Freundinnen und Freunde) nur mit Handle und
Anzeigename — also mit Daten, welche die exportierende Person ohnehin sieht.
Nie mit E-Mail-Adresse. Der Einwilligungsnachweis ist Teil des Exports, damit
nachvollziehbar bleibt, wozu man wann zugestimmt hat.

## Löschprozess und Aufbewahrung

### Livesystem

Beim Löschen des Kontos läuft in **einer Transaktion**:

1. Die Kontozeile wird als gelöscht markiert (`deleted_at`).
2. E-Mail, Handle, Anzeigename und Passwort-Hash werden mit nicht
   rückführbaren Platzhaltern überschrieben. Damit ist eine Anmeldung
   ausgeschlossen, und Handle wie E-Mail-Adresse sind sofort wieder frei.
3. Sitzungen, Freundschaften und Freundschaftsanfragen werden entfernt. Die
   Sichtbarkeit für andere endet damit in derselben Sekunde, nicht erst mit
   dem Löschjob.

Ein Hintergrundjob löscht die markierte Zeile endgültig; er läuft beim Start
und danach stündlich. **Zugesagte Obergrenze: 24 Stunden**, real unter einer
Stunde. Die Kaskaden im Schema entfernen dabei die Präferenzen; selbst
angelegte Katalogeinträge bleiben ohne Autorenverweis bestehen, weil andere
Personen sie in ihren Listen verwenden.

Zwischen Markierung und endgültiger Löschung ist nichts erreichbar: das
Freundesprofil verlangt eine Freundschaft, die eigene Liste eine Sitzung —
beides existiert nicht mehr. Eine Wiederherstellung gibt es bewusst nicht.

### Backups

Backups werden **90 Tage** aufbewahrt und danach automatisch gelöscht.
Spätestens damit verschwinden auch gelöschte Konten aus den Sicherungen. Ein
gezieltes Löschen einzelner Personen aus bestehenden Backups findet nicht
statt: bei verschlüsselten Vollsicherungen ist das nicht sinnvoll möglich, und
die Sicherungen bleiben bis zum Ablauf der Frist gesperrt — sie werden
ausschliesslich zur Wiederherstellung nach einem Ausfall verwendet. Wird eine
Sicherung eingespielt, sind die zwischenzeitlich eingegangenen Löschbegehren
erneut auszuführen; dafür ist ein Protokoll der Löschungen zu führen.
**Diese Position ist rechtlich zu bestätigen** — sie steht als offener Punkt
in der Prüf-Checkliste.

## Technische und organisatorische Massnahmen

- Passwörter: argon2id, 19 MiB Speicher, 2 Iterationen (OWASP-Empfehlung)
- Sitzungstoken: 32 Byte aus `crypto.randomBytes`, in der Datenbank nur als
  SHA-256-Hash — ein Datenbankleck gibt keine nutzbaren Sitzungen preis
- Zugriffskontrolle: eine einzige Stelle (`requireFriendship` in
  `apps/api/src/lib/friendship.ts`), durch Tests abgedeckt
- Unbeteiligte erhalten 404 statt 403, damit die API die Existenz von Konten
  nicht bestätigt
- Login und Registrierung sind ratenbegrenzt; Login-Antworten unterscheiden
  nicht zwischen „Konto unbekannt" und „Passwort falsch", auch nicht in der
  Antwortzeit
- CSP `default-src 'self'`, keine externen Skripte, Schriften oder CDNs
- Logs ohne IP-Adresse, ohne User-Agent, ohne Request-Bodies
- Transport ausschliesslich über TLS (HSTS), in Produktion `COOKIE_SECURE=true`

## Offene Punkte vor Produktivstart

Der Ablauf dazu steht in [`legal-review-checklist.md`](legal-review-checklist.md),
das Prüfdokument in [`dpia.md`](dpia.md).

1. Datenschutz-Folgenabschätzung fertigstellen und Restrisiko einschätzen
2. Mindestalter festlegen und abfragen (Art. 8 DSGVO) — hier tut die App
   bislang nichts
3. Prüfen, ob ein Datenschutzbeauftragter nach Art. 37 Abs. 1 lit. c DSGVO
   nötig ist; in der Schweiz Berater nach Art. 10 revDSG erwägen
4. Datenschutzerklärung und Impressum verfassen und im UI verlinken
5. Auftragsverarbeitungsvertrag mit dem Hoster (Hetzner, Infomaniak, Exoscale)
6. Technisch belegen, dass die 90-Tage-Regel für Backups beim gewählten Hoster
   tatsächlich greift, und die Behandlung von Löschbegehren beim Einspielen
   einer Sicherung rechtlich bestätigen lassen
7. Prüfen, ob ein Vertreter nach Art. 27 DSGVO bzw. Art. 14 revDSG nötig ist
   (abhängig vom Sitz des Betreibers)
8. Ratenbegrenzung arbeitet im Speicher auf Basis der IP-Adresse. Sie wird
   nicht persistiert und nicht geloggt; bei einem Wechsel auf einen
   gemeinsamen Speicher (Redis) ist das erneut zu bewerten
