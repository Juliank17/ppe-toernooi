// PPE Toernooisysteem — reken-engine
// Bevat: poule-generatie (round-robin), bracket-generatie (knock-out),
// standenberekening en tiebreakers (incl. head-to-head, UEFA + FIFA-stijl).
//
// Bewust vrij van dependencies en van opslag/HTTP, zodat dit los te unit-testen is.

'use strict';

// ---------------------------------------------------------------------------
// 1. WEDSTRIJDGENERATIE
// ---------------------------------------------------------------------------

// Round-robin volgens de "circle method". Iedereen speelt 1x (of 2x) tegen
// elk ander team, verdeeld over rondes waarin niemand dubbel staat.
// teamIds: array van id's. dubbel: heen- én terugronde.
function genereerPoule(teamIds, { dubbel = false } = {}) {
  const lijst = teamIds.slice();
  const oneven = lijst.length % 2 === 1;
  if (oneven) lijst.push(null); // "BYE" — dit team rust die ronde
  const n = lijst.length;
  const rondes = n - 1;
  const perRonde = n / 2;
  const wedstrijden = [];

  for (let r = 0; r < rondes; r++) {
    for (let i = 0; i < perRonde; i++) {
      const thuis = lijst[i];
      const uit = lijst[n - 1 - i];
      if (thuis !== null && uit !== null) {
        // Wissel thuis/uit af per ronde voor een eerlijke verdeling
        const omdraaien = r % 2 === 1;
        wedstrijden.push({
          thuis: omdraaien ? uit : thuis,
          uit: omdraaien ? thuis : uit,
          ronde: r + 1,
        });
      }
    }
    // Roteer: eerste team blijft vast, de rest schuift met de klok mee
    lijst.splice(1, 0, lijst.pop());
  }

  if (dubbel) {
    const terug = wedstrijden.map((w) => ({
      thuis: w.uit,
      uit: w.thuis,
      ronde: w.ronde + rondes,
    }));
    return wedstrijden.concat(terug);
  }
  return wedstrijden;
}

// Knock-out bracket. seeds = teamIds op volgorde van plaatsing (1 = best).
// Vult aan tot een macht van 2 met byes (null); de beste seeds krijgen de bye.
// Retourneert de eerste ronde als paren + het aantal rondes.
function genereerBracket(seeds) {
  const n = seeds.length;
  let grootte = 1;
  while (grootte < n) grootte *= 2;

  // Standaard seed-volgorde zodat 1 en 2 elkaar pas in de finale treffen
  const volgorde = seedVolgorde(grootte);
  const slots = volgorde.map((pos) => (pos <= n ? seeds[pos - 1] : null));

  const eersteRonde = [];
  for (let i = 0; i < grootte; i += 2) {
    eersteRonde.push({ thuis: slots[i], uit: slots[i + 1], ronde: 1 });
  }
  return { grootte, rondes: Math.log2(grootte), eersteRonde };
}

// Klassieke bracket-seedvolgorde (1 vs laagste, enz.)
function seedVolgorde(grootte) {
  let ronde = [1, 2];
  while (ronde.length < grootte) {
    const volgende = [];
    const som = ronde.length * 2 + 1;
    for (const s of ronde) {
      volgende.push(s);
      volgende.push(som - s);
    }
    ronde = volgende;
  }
  return ronde;
}

// ---------------------------------------------------------------------------
// 2. STATISTIEKEN
// ---------------------------------------------------------------------------

// Alleen wedstrijden meetellen die een uitslag hebben (gespeeld).
function heeftUitslag(w) {
  return w && w.score && w.score.thuis != null && w.score.uit != null;
}

function legeStat() {
  return { G: 0, W: 0, GL: 0, V: 0, DPV: 0, DPT: 0, P: 0 };
}

// Bereken stats voor een set teams op basis van de meegegeven wedstrijden.
// Elk team krijgt zijn record over ALLE meegegeven wedstrijden waarin het speelt
// (de tegenstander hoeft niet in teamIds te zitten). Wil je een mini-competitie
// (head-to-head), geef dan alleen de onderlinge wedstrijden mee — dat doet de
// aanroeper via wedstrijdenTussen(). Zo klopt zowel het algemene doelsaldo als
// de onderlinge vergelijking.
function berekenStats(teamIds, wedstrijden, cfg) {
  const setIds = new Set(teamIds);
  const stats = {};
  teamIds.forEach((id) => (stats[id] = legeStat()));

  for (const w of wedstrijden) {
    if (!heeftUitslag(w)) continue;
    const heeftThuis = setIds.has(w.thuis);
    const heeftUit = setIds.has(w.uit);
    if (!heeftThuis && !heeftUit) continue;
    const st = w.score.thuis;
    const su = w.score.uit;

    if (heeftThuis) {
      const t = stats[w.thuis];
      t.G++; t.DPV += st; t.DPT += su;
      if (st > su) { t.W++; t.P += cfg.punten.winst; }
      else if (st < su) { t.V++; t.P += cfg.punten.verlies; }
      else { t.GL++; t.P += cfg.punten.gelijk; }
    }
    if (heeftUit) {
      const u = stats[w.uit];
      u.G++; u.DPV += su; u.DPT += st;
      if (su > st) { u.W++; u.P += cfg.punten.winst; }
      else if (su < st) { u.V++; u.P += cfg.punten.verlies; }
      else { u.GL++; u.P += cfg.punten.gelijk; }
    }
  }
  return stats;
}

// Numerieke waarde van één (meetbaar) criterium; hoger = beter.
function criteriumWaarde(id, crit, stats) {
  const s = stats[id];
  switch (crit) {
    case 'punten': return s.P;
    case 'saldo': return s.DPV - s.DPT;
    case 'voor': return s.DPV;
    case 'gewonnen': return s.W;
    case 'tegen': return -s.DPT;          // minder tegen = beter
    case 'gemiddeld': return s.G ? s.P / s.G : 0;
    default: return 0;
  }
}

function wedstrijdenTussen(teamIds, wedstrijden) {
  const set = new Set(teamIds);
  return wedstrijden.filter((w) => set.has(w.thuis) && set.has(w.uit));
}

// ---------------------------------------------------------------------------
// 3. RANGSCHIKKING MET TIEBREAKERS (incl. head-to-head)
// ---------------------------------------------------------------------------
//
// rangschikBuckets retourneert een lijst van "buckets": elk bucket is een
// groep teams die (voorlopig) exact gelijk staan. Platgeslagen = eindvolgorde;
// een bucket met >1 team = een niet-opgeloste gelijkstand.

function rangschikBuckets(teamIds, criteria, statMatches, globalMatches, cfg) {
  if (teamIds.length <= 1) return [teamIds.slice()];
  if (criteria.length === 0) return [teamIds.slice()]; // volledig gelijk

  const [crit, ...rest] = criteria;

  if (crit === 'onderling') {
    // Mini-competitie met alléén de nu gelijkstaande teams
    const mini = wedstrijdenTussen(teamIds, globalMatches);
    const meetbaar = cfg.tiebreakers.filter((c) => c !== 'onderling');
    const subBuckets = rangschikBuckets(teamIds, meetbaar, mini, globalMatches, cfg);

    const resultaat = [];
    for (const b of subBuckets) {
      if (b.length === 1) {
        resultaat.push(b);
      } else if (cfg.h2hIteratief && b.length < teamIds.length) {
        // UEFA-stijl: pas head-to-head opnieuw toe op de kleinere groep
        resultaat.push(...rangschikBuckets(b, ['onderling', ...rest], statMatches, globalMatches, cfg));
      } else {
        // FIFA-stijl (of geen voortgang meer): ga verder met algemene stats
        resultaat.push(...rangschikBuckets(b, rest, globalMatches, globalMatches, cfg));
      }
    }
    return resultaat;
  }

  // Meetbaar criterium: groepeer op waarde, hoogste eerst
  const stats = berekenStats(teamIds, statMatches, cfg);
  const groepen = new Map();
  for (const id of teamIds) {
    const w = criteriumWaarde(id, crit, stats);
    if (!groepen.has(w)) groepen.set(w, []);
    groepen.get(w).push(id);
  }
  const waarden = [...groepen.keys()].sort((a, b) => b - a);

  const resultaat = [];
  for (const w of waarden) {
    const groep = groepen.get(w);
    resultaat.push(...rangschikBuckets(groep, rest, statMatches, globalMatches, cfg));
  }
  return resultaat;
}

// Publieke functie: geef gesorteerde standenrijen terug voor één poule.
function berekenStand(pouleTeamIds, alleWedstrijden, cfg) {
  const pouleMatches = wedstrijdenTussen(pouleTeamIds, alleWedstrijden);
  const buckets = rangschikBuckets(pouleTeamIds, cfg.tiebreakers, pouleMatches, pouleMatches, cfg);
  const stats = berekenStats(pouleTeamIds, pouleMatches, cfg);

  const rijen = [];
  let positie = 0;
  for (const bucket of buckets) {
    for (const id of bucket) {
      positie++;
      const s = stats[id];
      rijen.push({
        positie,
        team: id,
        G: s.G, W: s.W, GL: s.GL, V: s.V,
        DPV: s.DPV, DPT: s.DPT, saldo: s.DPV - s.DPT, P: s.P,
        gelijkstand: bucket.length > 1, // waarschuwing: nog niet definitief te scheiden
      });
    }
  }
  return rijen;
}

// Handige helper voor fase-overgang: wie eindigt op positie n in een poule.
function teamOpPositie(pouleTeamIds, alleWedstrijden, cfg, n) {
  const stand = berekenStand(pouleTeamIds, alleWedstrijden, cfg);
  const rij = stand.find((r) => r.positie === n);
  return rij ? rij.team : null;
}

// Kwalificatie over meerdere poules heen: vul een knock-out van `grootte` teams
// door de best geplaatsten te nemen. Eerst alle nummers 1 (onderling gerangschikt),
// dan alle nummers 2, dan de beste nummers 3, enzovoort tot de bracket vol is.
// Zo krijg je bv. bij 3 poules en 8 plekken: 3× #1, 3× #2, en de 2 beste #3's.
function meetbareCriteria(cfg) {
  return (cfg.tiebreakers || ['punten', 'saldo', 'voor']).filter((c) => c !== 'onderling');
}
function rijWaarde(r, crit) {
  switch (crit) {
    case 'punten': return r.P;
    case 'saldo': return r.saldo;
    case 'voor': return r.DPV;
    case 'gewonnen': return r.W;
    case 'tegen': return -r.DPT;
    case 'gemiddeld': return r.G ? r.P / r.G : 0;
    default: return 0;
  }
}
function vergelijkRijen(a, b, cfg) {
  for (const c of meetbareCriteria(cfg)) {
    const d = rijWaarde(b, c) - rijWaarde(a, c);
    if (d) return d;
  }
  return 0;
}
// Retourneert een geordende lijst van teamId's (beste eerst), maximaal `grootte`.
function kwalificatieVolgorde(poules, alleWedstrijden, cfg, grootte) {
  const standen = (poules || []).map((p) => berekenStand(p.teams || [], alleWedstrijden, cfg));
  const maxLen = standen.reduce((m, s) => Math.max(m, s.length), 0);
  const uit = [];
  for (let pos = 1; pos <= maxLen; pos++) {
    const groep = standen.map((s) => s.find((r) => r.positie === pos)).filter(Boolean);
    groep.sort((a, b) => vergelijkRijen(a, b, cfg));
    for (const r of groep) {
      uit.push(r.team);
      if (uit.length >= grootte) return uit;
    }
  }
  return uit;
}

// Herstelpas op de ronde-1-slots: vermijd waar mogelijk dat teams uit dezelfde
// poule elkaar direct treffen. slots = teamId's in bracket-volgorde (paren 0-1, 2-3, ...),
// pouleVan = functie teamId → pouleId. Ruilt alleen de "zwakkere" plekken (oneven
// indexen) tussen paren, zodat de seeding-tiers intact blijven. Niet altijd
// oplosbaar (bv. veel teams uit één poule) — dan blijft het paar staan.
function vermijdEigenPoule(slots, pouleVan) {
  const n = slots.length;
  for (let i = 0; i < n; i += 2) {
    const a = slots[i], b = slots[i + 1];
    if (!a || !b) continue;
    if (pouleVan(a) !== pouleVan(b)) continue;
    // Zoek een ander paar om de uit-plek mee te ruilen, zonder daar een
    // nieuw eigen-poule-duel te veroorzaken. Dichtstbijzijnde paar eerst.
    for (let afstand = 2; afstand < n; afstand += 2) {
      let geruild = false;
      for (const j of [i + afstand, i - afstand]) {
        if (j < 0 || j >= n || j === i) continue;
        const c = slots[j], d = slots[j + 1];
        if (!d) continue;
        const okHier = pouleVan(a) !== pouleVan(d);
        const okDaar = !c || pouleVan(c) !== pouleVan(b);
        if (okHier && okDaar) {
          slots[i + 1] = d; slots[j + 1] = b;
          geruild = true; break;
        }
      }
      if (geruild) break;
    }
  }
  return slots;
}

// Winnaar van een knock-outwedstrijd. Bij gelijkspel beslist het "golden point"
// (score.gp = 'thuis' of 'uit'). Eén lege kant = bye: de andere kant wint direct.
function winnaarKO(w) {
  if (!w) return null;
  if (w.thuis && !w.uit) return w.thuis;   // bye
  if (!w.thuis && w.uit) return w.uit;     // bye
  if (!w.thuis || !w.uit) return null;
  if (!heeftUitslag(w)) return null;
  if (w.score.thuis > w.score.uit) return w.thuis;
  if (w.score.thuis < w.score.uit) return w.uit;
  if (w.score.gp === 'thuis') return w.thuis;
  if (w.score.gp === 'uit') return w.uit;
  return null; // gelijk zonder golden point: onbeslist
}

// Schuift winnaars door naar de volgende knock-outronde (en verwerkt correcties:
// verandert de winnaar van een wedstrijd, dan wordt de vervolgwedstrijd bijgewerkt
// en diens uitslag gewist — cascade tot en met de finale). Muteert de wedstrijden.
function werkBracketBij(alleWedstrijden, faseId) {
  const ws = alleWedstrijden
    .filter((w) => w.fase === faseId)
    .sort((a, b) => ((a.ronde || 1) - (b.ronde || 1)) || ((a.koIndex || 0) - (b.koIndex || 0)));
  if (!ws.length) return;
  const rondes = Math.max(...ws.map((w) => w.ronde || 1));
  for (let r = 1; r < rondes; r++) {
    for (const w of ws.filter((x) => (x.ronde || 1) === r)) {
      const doel = ws.find((x) => (x.ronde || 1) === r + 1 && (x.koIndex || 0) === Math.floor((w.koIndex || 0) / 2));
      if (!doel) continue;
      const kant = (w.koIndex || 0) % 2 === 0 ? 'thuis' : 'uit';
      const win = winnaarKO(w);
      if (doel[kant] !== win) {
        doel[kant] = win || null;
        doel.score = null; // vervolgwedstrijd klopt niet meer na een correctie
        doel.status = 'gepland';
      }
    }
  }
}

// Volledig bracket-skelet: alle rondes als (nog lege) wedstrijden, zodat je ze
// vast kunt inplannen voordat de teams bekend zijn. Retourneert {ronde, index, label}.
function genereerBracketSkelet(grootte) {
  const rondes = Math.round(Math.log2(grootte));
  const out = [];
  for (let r = 1; r <= rondes; r++) {
    const aantal = grootte / Math.pow(2, r);
    for (let i = 0; i < aantal; i++) {
      out.push({ ronde: r, index: i, label: rondeNaam(r, rondes, i, aantal) });
    }
  }
  return out;
}

function rondeNaam(ronde, totaalRondes, index, aantalInRonde) {
  const vanAchter = totaalRondes - ronde;
  const namen = { 0: 'Finale', 1: 'Halve finale', 2: 'Kwartfinale', 3: 'Achtste finale' };
  const basis = namen[vanAchter] || (Math.pow(2, vanAchter + 1) + 'e finale');
  return aantalInRonde > 1 ? `${basis} ${index + 1}` : basis;
}

module.exports = {
  genereerPoule,
  genereerBracket,
  genereerBracketSkelet,
  rondeNaam,
  seedVolgorde,
  berekenStats,
  berekenStand,
  teamOpPositie,
  kwalificatieVolgorde,
  vermijdEigenPoule,
  winnaarKO,
  werkBracketBij,
  wedstrijdenTussen,
};
