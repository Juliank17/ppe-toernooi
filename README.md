# PPE Toernooisysteem

Eigen toernooibeheer voor Prime Padel Events — poules + knock-out, standen met
tiebreakers, live scores en een personeel-modus. Zelfde stack als het dashboard:
statische HTML/JS + Vercel serverless functions + Upstash Redis.

Dit is een **apart project**: eigen repo, eigen Vercel-project, eigen Upstash-database.
Los van het dashboard, zodat een storing hier het dashboard nooit raakt.

## Structuur

```
ppe-toernooi/
├── index.html          landingspagina
├── nieuw.html          setup-wizard (stap voor stap een toernooi opzetten)
├── admin.html          beheer (achter interne sleutel)
├── staff.html          personeel-modus (achter PIN)
├── live.html           publieke live-pagina (standen + schema)
├── assets/style.css    huisstijl (navy/lime, Anton + Archivo)
├── api/                serverless endpoints
│   ├── toernooi.js     ophalen/opslaan (admin)
│   ├── genereer.js     poulewedstrijden genereren (admin)
│   ├── score.js        uitslag opslaan (admin/personeel)
│   ├── fase-start.js   knock-outfase starten/terugdraaien
│   ├── staff-login.js  PIN → personeel-cookie
│   ├── staff-data.js   data voor de personeel-modus
│   ├── deelnemer.js    team aanmelden
│   └── live.js         publieke live-data
├── lib/
│   ├── tournament.js   REKEN-ENGINE: poules, standen, tiebreakers (head-to-head)
│   ├── store.js        Upstash Redis helpers
│   ├── auth.js         admin-sleutel + personeel-PIN/cookie
│   └── http.js         kleine helpers
└── test/
    └── tournament.test.js   tests voor de engine
```

## Lokaal de engine testen

De reken-engine heeft geen dependencies en is los te testen:

```bash
node test/tournament.test.js
```

De tests bevatten o.a. het exacte head-to-head voorbeeld uit het Tournify help center
(zowel UEFA- als FIFA-stijl) als controle.

## Deployen (Vercel)

1. Zet deze map in een **eigen Git-repo** (los van het dashboard).
2. Maak een gratis **Upstash Redis**-database (upstash.com) → kopieer de REST-URL en -token.
3. Maak een **nieuw Vercel-project** vanaf de repo.
4. Zet de environment variables (zie `.env.example`):
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `INTERNAL_KEY`, `STAFF_SECRET`.
5. Deploy. Optioneel: koppel het subdomein `toernooi.primepadelevents.nl`.

## Gebruik op hoofdlijnen

1. **Admin** (`/admin.html`): vul je interne sleutel in, maak een toernooi aan
   (er komt meteen een voorbeeldstructuur in), pas de JSON aan (banen, niveaus,
   poules, teams), en klik **Genereer poulewedstrijden**.
2. **Personeel** (`/staff/<slug>`): inloggen met de PIN → scores invoeren,
   teams aanmelden, en de knock-outfase starten.
3. **Spelers** (`/live/<slug>`): volgen standen en schema live (ververst automatisch).

## Status

MVP-scaffold. Werkt end-to-end voor: poules genereren → scores → standen met
tiebreakers → knock-outfase starten → publieke live-pagina. Nog te doen (zie de
bouwspec): sleepbaar planbord, scheidsrechters, export/wedstrijdbriefjes,
diavoorstelling, sets-modus, en de winnaar-doorstroom binnen de bracket.

> Belangrijk: draai dit eerst één seizoen **náást** Tournify op een echt toernooi
> voordat je overstapt.
