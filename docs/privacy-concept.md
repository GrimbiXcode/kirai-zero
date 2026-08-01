# Datenschutzkonzept kirai-zero

Stand: Erstfassung zum MVP-Kern. Dieses Dokument beschreibt, was die Anwendung
technisch tut. Es ersetzt keine rechtliche Prüfung — es bereitet sie vor, indem
es die Fakten liefert, die eine Datenschutzerklärung und ein
Verarbeitungsverzeichnis brauchen.

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
| **Löschung** | Sofort und vollständig bei Kontolöschung durch die betroffene Person |
| **Tabelle** | `users` |

Nicht erhoben: Telefonnummer, Adresse, Geburtsdatum, Geschlecht, Adressbuch,
Standort, Zahlungsdaten.

### V2 — Sitzungen

| | |
|---|---|
| **Zweck** | Angemeldet bleiben |
| **Datenkategorien** | SHA-256-Hash des Sitzungstokens, Zeitstempel (erstellt, zuletzt gesehen, Ablauf), Nutzer-ID |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO |
| **Löschung** | Bei Abmeldung, spätestens 30 Tage nach letzter Nutzung; abgelaufene Sitzungen werden stündlich automatisch entfernt |
| **Tabelle** | `sessions` |

**Ausdrücklich nicht gespeichert:** IP-Adresse und User-Agent. Ein Test in
`apps/api/test/account.test.ts` prüft, dass diese Spalten nicht existieren, damit
das nicht unbemerkt zurückkommt.

### V3 — Präferenzen

| | |
|---|---|
| **Zweck** | Kern des Dienstes: Vorlieben und Abneigungen für Freundinnen und Freunde sichtbar machen |
| **Datenkategorien** | Verweis auf einen Katalogeintrag, Haltung (`stance`), Begründung (`reason`), freie Notiz (max. 280 Zeichen), Sichtbarkeit |
| **Besonderheit** | `reason = allergy` oder `intolerance` sind **Gesundheitsdaten** im Sinn von Art. 9 DSGVO |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO; für Gesundheitsdaten zusätzlich Art. 9 Abs. 2 lit. a (ausdrückliche Einwilligung) |
| **Löschung** | Jederzeit einzeln durch die betroffene Person, vollständig bei Kontolöschung |
| **Tabelle** | `preferences` |

Zur Einwilligung: Die Angabe einer Allergie ist immer freiwillig und wird nie
verlangt. Vor Produktivstart ist im UI an der Stelle, an der `allergy` oder
`intolerance` gewählt wird, ein ausdrücklicher Einwilligungshinweis zu
ergänzen — die Auswahl selbst ist die Einwilligungshandlung, sie muss aber als
solche erkennbar sein. **Diese UI-Ergänzung steht noch aus.**

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
| Löschung (Art. 17) | `DELETE /api/me` — sofortige, vollständige Löschung ohne Wartefrist und ohne Soft-Delete |
| Einschränkung (Art. 18) | Einzelne Einträge lassen sich auf `visibility = private` setzen, statt sie zu löschen |

Im Export erscheinen Dritte (Freundinnen und Freunde) nur mit Handle und
Anzeigename — also mit Daten, welche die exportierende Person ohnehin sieht.
Nie mit E-Mail-Adresse.

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

1. Einwilligungshinweis im UI bei Auswahl von `allergy`/`intolerance` (siehe V3)
2. Datenschutzerklärung und Impressum verfassen und im UI verlinken
3. Auftragsverarbeitungsvertrag mit dem Hoster (Hetzner, Infomaniak, Exoscale)
4. Backups: Verschlüsselung, Aufbewahrungsfrist und Löschung dokumentieren —
   eine gelöschte Person darf nicht unbegrenzt in Backups fortleben
5. Prüfen, ob ein Vertreter nach Art. 27 DSGVO bzw. Art. 14 revDSG nötig ist
   (abhängig vom Sitz des Betreibers)
6. Ratenbegrenzung arbeitet im Speicher auf Basis der IP-Adresse. Sie wird
   nicht persistiert und nicht geloggt; bei einem Wechsel auf einen
   gemeinsamen Speicher (Redis) ist das erneut zu bewerten
