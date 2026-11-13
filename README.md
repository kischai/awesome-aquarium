# Awesome Aquarium – die Webseite

Hier liegt nur die **fertig gebaute Seite** (Startseite `index.html`, Spiel `spiel.html`, Bilder, Musik).
Sie wird aus dem Spiel-Projekt mit `tools/build-site.sh` erzeugt – hier nichts von Hand ändern, beim nächsten Bauen wird alles überschrieben.

- Läuft auf Ample (statisch), Konten und Spielstände liegen bei Supabase (mit Row Level Security).
- `js/config.js` enthält nur die öffentliche Supabase-Adresse und den Publishable Key – beides ist für den Browser gedacht.
- `.github/workflows/keepalive.yml` pingt dreimal am Tag die Datenbank, damit das kostenlose Supabase-Projekt nicht pausiert.

Mitspielen geht nur mit Einladungscode.
