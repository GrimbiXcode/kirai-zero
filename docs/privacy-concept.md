# Datenschutzkonzept kirai-zero

Stand: MVP-Kern ohne Begründungsfeld, mit Löschpipeline. Dieses Dokument
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
| **Datenkategorien** | Verweis auf einen Katalogeintrag, Haltung (`stance`), freie Notiz (max. 280 Zeichen), Sichtbarkeit |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 31 Abs. 2 lit. a revDSG |
| **Löschung** | Jederzeit einzeln durch die betroffene Person, vollständig bei Kontolöschung |
| **Tabelle** | `preferences` |

**Keine besonderen Kategorien.** Die App fragt bewusst **nicht**, warum jemand
etwas nicht mag. Ein Eintrag sagt nur: *bekomme ich das vorgesetzt oder
geschenkt, esse ich es nicht bzw. werfe es weg.* Damit werden weder
Gesundheitsdaten noch religiöse oder weltanschauliche Überzeugungen erhoben.
Es gibt folglich keine Verarbeitung nach Art. 9 Abs. 1 DSGVO und keine
besonders schützenswerten Personendaten nach Art. 5 lit. c revDSG — und
entsprechend auch keine Einwilligung, keine Altersschranke nach Art. 8 DSGVO
und keine Pflicht zur Datenschutz-Folgenabschätzung.

**Restrisiko Ableitbarkeit.** Nach EuGH C-184/20 genügt es für Art. 9, dass
sich ein Merkmal ableiten lässt. Eine Liste mit «Schweinefleisch, Alkohol»
kann auf eine Überzeugung hindeuten, auch wenn niemand danach gefragt hat.
Das ist einer App über Essensvorlieben inhärent und lässt sich nicht
wegdesignen. Was wir dagegen tun: nicht danach fragen, keine solche Struktur
anlegen, nicht danach filtern können, keinen Zweck damit verfolgen — und jeden
Eintrag auf «Nur für mich» stellbar machen.

**Notizfeld.** Der Freitext gehört der Person und wird von uns nicht
ausgewertet. Wer dort etwas Heikles hineinschreibt, tut das selbstbestimmt;
die App legt es weder nahe noch strukturiert sie es.

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

### V6 — Personen und Notizen

| | |
|---|---|
| **Zweck** | Festhalten, was man über andere zu wissen glaubt — auch über Menschen ohne Konto |
| **Datenkategorien** | Selbst gewählter Anzeigename, optionale Notiz, Verweise auf Katalogeinträge mit Haltung, optionaler Verweis auf ein Konto |
| **Betroffene** | Der Ersteller **und die Person, um die es geht** |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO, Art. 31 Abs. 2 lit. a revDSG |
| **Empfänger** | Keine. Ein Personen-Profil ist ausschliesslich für seinen Ersteller sichtbar |
| **Löschung** | Jederzeit durch den Ersteller, vollständig mit dessen Konto |
| **Tabellen** | `persons`, `person_entries` |

**Das sind Daten über Dritte.** Anders als überall sonst in der Anwendung
stammen sie nicht von der betroffenen Person. Bei einem unverknüpften Profil
handelt es sich um einen frei gewählten Namen ohne weitere Identifikatoren;
sobald es mit einem Konto verknüpft ist, um eine identifizierte Person. Daraus
folgen zwei Fragen, die vor Produktivstart anwaltlich zu klären sind:

- **Art. 14 DSGVO** — Informationspflicht, wenn Daten nicht bei der betroffenen
  Person erhoben wurden. Aktuell vorgesehen: eine generische Aussage in der
  Datenschutzerklärung, dass Freunde private Notizen führen können, statt einer
  Mitteilung pro Verknüpfung.
- **Art. 15 DSGVO** — Auskunft. Eine Herausgabe würde die private Einschätzung
  samt Urheber offenlegen; Art. 15 Abs. 4 hält fest, dass die Auskunft die
  Rechte anderer nicht beeinträchtigen darf. Die Abwägung gehört dokumentiert.

**Was die Umsetzung von sich aus begrenzt:**

- Nur ein Anzeigename. Keine E-Mail, keine Telefonnummer, kein Geburtsdatum —
  ein unverknüpftes Profil identifiziert niemanden ausserhalb des Kopfes seines
  Erstellers.
- Verknüpfen geht **nur mit bestätigten Freunden**. Über Unbeteiligte lässt
  sich kein Konto-Bezug herstellen.
- Der Abgleich verschafft **keinen zusätzlichen Einblick**: er läuft nur unter
  Freunden und nur über Einträge, die ohnehin für Freunde sichtbar sind. Ein
  privat gehaltener Eintrag ist von einem fehlenden nicht zu unterscheiden.
- Endet die Freundschaft oder wird das verknüpfte Konto gelöscht, fällt die
  Verknüpfung weg. Die Notizen bleiben, der Konto-Bezug nicht.
- Die Notizen stehen im Export ihres Erstellers und verschwinden mit dessen
  Konto.

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
Nie mit E-Mail-Adresse.

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
gezieltes Löschen einzelner Personen aus bestehenden Sicherungen findet nicht
statt: bei verschlüsselten Vollsicherungen ist das nicht sinnvoll möglich, und
die Sicherungen werden ausschliesslich zur Wiederherstellung nach einem
Ausfall verwendet.

### Wiederherstellung aus einer Sicherung

Ein Restore kann Konten zurückbringen, die zwischenzeitlich gelöscht wurden.
Deshalb gilt verbindlich:

1. Die Wiederherstellung wird protokolliert: Zeitpunkt, Stand der eingespielten
   Sicherung, Anlass.
2. **Alle** Personen in der wiederhergestellten Datenbank werden per E-Mail
   informiert — ausdrücklich auch jene, deren Konto durch den Restore wieder
   existiert. Gerade sie müssen es erfahren, denn sie haben ihr Konto gelöscht
   geglaubt.
3. Die Mail nennt den Vorgang, den Stand und die Handlungsmöglichkeit: Konto
   erneut löschen oder sich beim Support melden.

Der Versand erfolgt heute manuell als Teil des Restore-Vorgangs; die App
verschickt im Normalbetrieb keine E-Mails. Sobald das automatisiert wird, ist
der Mailanbieter ein Auftragsverarbeiter und braucht einen AVV.

#### Textvorlage

> **Betreff:** Wichtig: Wiederherstellung der kirai-zero-Datenbank
>
> Hallo
>
> wir mussten am {DATUM} eine Sicherung unserer Datenbank einspielen. Der
> Datenstand entspricht dadurch dem {STAND-DATUM}. Änderungen, die du danach
> vorgenommen hast, können verloren gegangen sein.
>
> Wichtig, falls du dein Konto nach dem {STAND-DATUM} gelöscht hast: Durch die
> Wiederherstellung kann dein Konto samt Einträgen wieder vorhanden sein. Das
> war nicht beabsichtigt. Bitte lösche es in diesem Fall erneut unter
> Einstellungen → Konto löschen, oder melde dich bei {SUPPORT-ADRESSE} — wir
> erledigen es dann für dich.
>
> Es tut uns leid für die Umstände.
>
> kirai-zero

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
die freiwillige Risikoeinschätzung in [`dpia.md`](dpia.md).

1. Datenschutzerklärung und Impressum verfassen und im UI verlinken
2. Auftragsverarbeitungsvertrag mit dem Hoster (Hetzner, Infomaniak, Exoscale)
3. Technisch belegen, dass die 90-Tage-Regel für Backups beim gewählten Hoster
   tatsächlich greift
4. Handlungsfähigkeit Minderjähriger beim Vertragsschluss in den AGB regeln —
   Art. 8 DSGVO greift nicht mehr, das nationale Vertragsrecht bleibt davon
   nach Art. 8 Abs. 3 aber unberührt
5. Prüfen, ob ein Vertreter nach Art. 27 DSGVO bzw. Art. 14 revDSG nötig ist
   (abhängig vom Sitz des Betreibers)
6. Ratenbegrenzung arbeitet im Speicher auf Basis der IP-Adresse. Sie wird
   nicht persistiert und nicht geloggt; bei einem Wechsel auf einen
   gemeinsamen Speicher (Redis) ist das erneut zu bewerten
