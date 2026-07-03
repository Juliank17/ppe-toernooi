# PPE Toernooisysteem — projectcontext

Lees dit bestand eerst. Het geeft je (Claude) in één keer de volledige context om verder
te bouwen aan het eigen toernooisysteem van Prime Padel Events (vervanger van Tournify).

## Wat het is

Een zelfgebouwd toernooibeheersysteem: poules + knock-out, standen met tiebreakers,
live scores, planbord en een personeel-modus. Vervangt Tournify (kostte €1200/jaar).

- **Live (productie):** https://ppe-toernooi-qwer.vercel.app
- **Repo:** https://github.com/Juliank17/ppe-toernooi (branch `main`)
- **Let op:** er bestaat ook een oud, níét-gekoppeld Vercel-project op
  `ppe-toernooi.vercel.app` — dat is dood hout en toont een oude versie. Gebruik altijd `-qwer`.

## Werkwijze / deploy (belangrijk)

- Deze map is een **GitHub-clone**. Bewerk hier de bestanden.
- Publiceren gaat via **GitHub Desktop**: Commit to main → Push origin.
  Vercel (`-qwer`) bouwt daarna **automatisch** opnieuw (~1 min). Er is geen build-stap.
- Na een push kan de live-site ~1 min achterlopen; hard verversen (Ctrl+F5) helpt.
- De reken-engine is los te testen: `node test/tournament.test.js` (geen dependencies).

## Stack

Zelfde als het PPE-dashboard: **statische HTML/JS + Vercel serverless functions
(`api/*.js`, CommonJS) + Upstash Redis** (REST). Geen framework, geen build.

Environment variables (staan in Vercel, zie `.env.example`):
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `INTERNAL_KEY`, `STAFF_SECRET`.

## Huisstijl & conventies

- Navy `#0A1D38` + lime `#C5E506`, fonts Anton + Archivo, Title Case, Nederlands.
- Gedeelde stijl in `assets/style.css`.
- Secrets nooit in code — alleen via environment variables.
- Drie rollen: **admin** (interne sleutel), **personeel** (toernooi-PIN → cookie), **publiek** (alleen-lezen).

## Bestandsmap

```
index.html      landing
nieuw.html      setup-wizard (nieuw toernooi: vorm, niveaus, banen, teams/poulegrootte, knock-out-grootte)
admin.html      toernooi-overzicht (klik → beheer.html), snelle create, JSON-editor
beheer.html     PER-TOERNOOI HUB met tabs: Overzicht (gegevens/banen+eindtijd/knock-out/genereren),
                Teams & check-in (hernoemen, aanwezig aanvinken), Schema (breed planbord: slepen,
                kleur per niveau, pauzes/blokkades, auto-invullen, leegmaken), Standen, Delen
staff.html      personeel-modus (PIN): scores invoeren (per niveau + speeltijd), check-in, ronde starten
live.html       publieke live-pagina (standen + schema); routes /live/<slug>
planning.html   losse planbord-variant (kies toernooi); beheer.html is de hoofdweg
assets/style.css  huisstijl
api/            toernooi.js  genereer.js  score.js  fase-start.js  plan.js
                staff-login.js  staff-data.js  deelnemer.js  aanwezig.js  live.js
lib/            tournament.js (ENGINE)  store.js (Redis)  auth.js  http.js
test/           tournament.test.js
```

## Datamodel (Redis)

Eén JSON per toernooi onder key `toernooi:{id}`; `slug:{slug}` → id; `toernooi:index` = lijst.
Toernooi-object bevat o.a.: `naam, slug, datum, locatie, status, personeelspin,
banen[{id,naam,type,starttijd,eindtijd}], wedstrijdduur, wisseltijd, scoreType, punten,
tiebreakers[], h2hIteratief, blokkades[{baan,tijd,label}], divisies[], teams[{id,naam,divisie,afwezig}],
wedstrijden[]`.

- **divisies** = niveaus (bv. Beginner/Beginner+/Intermediate). Elke divisie heeft `fases`:
  een `poule`-fase (`poules[{id,naam,teams[]}]`) en optioneel een `bracket`-fase
  (`{grootte, kwalificatie:'beste', gestart}`).
- **wedstrijden**: poulewedstrijden (`groep=pouleId`) en knock-out-skelet (`groep='ko', ronde, koIndex, label`),
  met `thuis, uit, baan, tijd, score, status`.

## Kernlogica (lib/tournament.js) — goed getest

- `genereerPoule` (round-robin, circle method), `genereerBracketSkelet` (alle KO-rondes als lege wedstrijden).
- `berekenStand` + tiebreakers incl. **head-to-head** (UEFA-iteratief én FIFA-stijl). Getest tegen het
  Tournify help-center voorbeeld.
- `kwalificatieVolgorde`: knock-out vult zich met de **beste geplaatsten over álle poules**
  (alle nrs 1, dan nrs 2, dan beste nrs 3, …). Bracket-seeding = standaard (beste vs zwakste, topseeds gespreid).
- Knock-out-skelet wordt bij `genereer` aangemaakt zodat je KO-rondes vooraf kunt inplannen;
  `fase-start` vult de teams in het bestaande ronde-1-skelet.

## Status & open punten (TODO)

Werkt end-to-end: aanmaken (wizard) → teams → genereren (poule + KO-skelet) → planbord
(incl. eindtijden, pauzes, kleuren) → scores → knock-outfase starten → live/standen/check-in.

Nog te doen / ideeën:
- **Winnaars automatisch doorschuiven** in de knock-out (ronde 2+ vult nu nog niet vanzelf met winnaars).
- Scheidsrechter-toewijzing, wedstrijdbriefjes/export, diavoorstelling, sets-modus met geavanceerde punten.
- Eventueel koppeling met het PPE-dashboard.
- Opruimen: oud Vercel-project `ppe-toernooi` verwijderen; `-qwer` hernoemen naar `ppe-toernooi`.
- Eerst één seizoen **náást** Tournify draaien op een echt toernooi vóór definitieve overstap.

## Veiligheid

Schrijven naar de database is echt. Bij ingrijpende acties: eerst voorbereiden en tonen,
pas uitvoeren na expliciete OK van de gebruiker. Nooit op een echt lopend toernooi testen.
