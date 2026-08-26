// Tests voor de reken-engine. Draaien met:  node test/tournament.test.js
'use strict';

const assert = require('assert');
const T = require('../lib/tournament');

let geslaagd = 0;
function test(naam, fn) {
  try {
    fn();
    geslaagd++;
    console.log('  ✓ ' + naam);
  } catch (e) {
    console.error('  ✗ ' + naam + '\n    ' + e.message);
    process.exitCode = 1;
  }
}

const cfgStandaard = {
  punten: { winst: 3, gelijk: 1, verlies: 0 },
  tiebreakers: ['punten', 'onderling', 'saldo', 'voor', 'gewonnen'],
  h2hIteratief: true,
};

console.log('\nPoule-generatie');

test('4 teams → 6 wedstrijden, 3 rondes, iedereen 3x', () => {
  const w = T.genereerPoule(['a', 'b', 'c', 'd']);
  assert.strictEqual(w.length, 6);
  assert.strictEqual(Math.max(...w.map((m) => m.ronde)), 3);
  for (const id of ['a', 'b', 'c', 'd']) {
    const n = w.filter((m) => m.thuis === id || m.uit === id).length;
    assert.strictEqual(n, 3, id + ' speelt ' + n + ' i.p.v. 3');
  }
});

test('5 teams (oneven) → 10 wedstrijden, iedereen 4x, geen BYE in output', () => {
  const w = T.genereerPoule(['a', 'b', 'c', 'd', 'e']);
  assert.strictEqual(w.length, 10);
  assert.ok(w.every((m) => m.thuis && m.uit), 'geen null/BYE toegestaan');
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    assert.strictEqual(w.filter((m) => m.thuis === id || m.uit === id).length, 4);
  }
});

test('geen enkel team speelt 2x in dezelfde ronde', () => {
  const w = T.genereerPoule(['a', 'b', 'c', 'd', 'e', 'f']);
  const perRonde = {};
  for (const m of w) {
    perRonde[m.ronde] = perRonde[m.ronde] || new Set();
    assert.ok(!perRonde[m.ronde].has(m.thuis), 'dubbel in ronde');
    assert.ok(!perRonde[m.ronde].has(m.uit), 'dubbel in ronde');
    perRonde[m.ronde].add(m.thuis);
    perRonde[m.ronde].add(m.uit);
  }
});

test('dubbel = heen en terug → 12 wedstrijden bij 4 teams', () => {
  const w = T.genereerPoule(['a', 'b', 'c', 'd'], { dubbel: true });
  assert.strictEqual(w.length, 12);
});

console.log('\nBracket-generatie');

test('8 seeds → 4 openingswedstrijden, 3 rondes', () => {
  const b = T.genereerBracket(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']);
  assert.strictEqual(b.grootte, 8);
  assert.strictEqual(b.rondes, 3);
  assert.strictEqual(b.eersteRonde.length, 4);
  // Seed 1 treft de laagste seed in ronde 1
  assert.deepStrictEqual([b.eersteRonde[0].thuis, b.eersteRonde[0].uit], ['s1', 's8']);
});

test('6 seeds → aangevuld tot 8, beste 2 seeds krijgen een bye', () => {
  const b = T.genereerBracket(['s1', 's2', 's3', 's4', 's5', 's6']);
  assert.strictEqual(b.grootte, 8);
  // Seed 1 en seed 2 hebben geen tegenstander (bye = null)
  assert.strictEqual(b.eersteRonde[0].uit, null); // s1 vs bye
});

console.log('\nStanden & punten');

test('basis: 3 winst = 9 punten, saldo klopt', () => {
  const teams = ['x', 'y', 'z'];
  const w = [
    { thuis: 'x', uit: 'y', score: { thuis: 2, uit: 0 } },
    { thuis: 'x', uit: 'z', score: { thuis: 1, uit: 0 } },
    { thuis: 'y', uit: 'z', score: { thuis: 1, uit: 1 } },
  ];
  const stand = T.berekenStand(teams, w, cfgStandaard);
  const x = stand.find((r) => r.team === 'x');
  assert.strictEqual(x.positie, 1);
  assert.strictEqual(x.P, 6);       // 2 gewonnen
  assert.strictEqual(x.saldo, 3);
});

// Het exacte voorbeeld uit het Tournify help center over head-to-head.
// Rood wint alles; Blauw, Groen en Geel eindigen alle drie op 3 punten.
function h2hPoule() {
  return {
    teams: ['Rood', 'Blauw', 'Groen', 'Geel'],
    wedstrijden: [
      { thuis: 'Rood', uit: 'Geel', score: { thuis: 1, uit: 0 } },
      { thuis: 'Rood', uit: 'Blauw', score: { thuis: 5, uit: 0 } },
      { thuis: 'Rood', uit: 'Groen', score: { thuis: 1, uit: 0 } },
      { thuis: 'Blauw', uit: 'Groen', score: { thuis: 2, uit: 1 } },
      { thuis: 'Groen', uit: 'Geel', score: { thuis: 1, uit: 0 } },
      { thuis: 'Geel', uit: 'Blauw', score: { thuis: 1, uit: 0 } },
    ],
  };
}

test('globale stats komen overeen met de tabel uit het help center', () => {
  const { teams, wedstrijden } = h2hPoule();
  const s = T.berekenStats(teams, wedstrijden, cfgStandaard);
  assert.deepStrictEqual([s.Rood.DPV, s.Rood.DPT, s.Rood.P], [7, 0, 9]);
  assert.deepStrictEqual([s.Blauw.DPV, s.Blauw.DPT, s.Blauw.P], [2, 7, 3]);
  assert.deepStrictEqual([s.Groen.DPV, s.Groen.DPT, s.Groen.P], [2, 3, 3]);
  assert.deepStrictEqual([s.Geel.DPV, s.Geel.DPT, s.Geel.P], [1, 2, 3]);
});

test('head-to-head UEFA-stijl (iteratief): Rood, Blauw, Groen, Geel', () => {
  const { teams, wedstrijden } = h2hPoule();
  const cfg = { ...cfgStandaard, h2hIteratief: true };
  const volgorde = T.berekenStand(teams, wedstrijden, cfg).map((r) => r.team);
  assert.deepStrictEqual(volgorde, ['Rood', 'Blauw', 'Groen', 'Geel']);
});

test('head-to-head FIFA-stijl (niet-iteratief): Rood, Groen, Blauw, Geel', () => {
  const { teams, wedstrijden } = h2hPoule();
  const cfg = { ...cfgStandaard, h2hIteratief: false };
  const volgorde = T.berekenStand(teams, wedstrijden, cfg).map((r) => r.team);
  assert.deepStrictEqual(volgorde, ['Rood', 'Groen', 'Blauw', 'Geel']);
});

test('teamOpPositie geeft de juiste doorstromer', () => {
  const { teams, wedstrijden } = h2hPoule();
  assert.strictEqual(T.teamOpPositie(teams, wedstrijden, cfgStandaard, 1), 'Rood');
});

console.log('\nEigen-poule-vermijding in ronde 1');

test('zelfde-poule-duel wordt weggeruild', () => {
  // Paren: (A1,A2) zelfde poule → moet ruilen met een ander paar
  const poule = { A1: 'pA', A2: 'pA', B1: 'pB', B2: 'pB' };
  const slots = ['A1', 'A2', 'B1', 'B2'];
  T.vermijdEigenPoule(slots, (id) => poule[id]);
  for (let i = 0; i < slots.length; i += 2) {
    assert.notStrictEqual(poule[slots[i]], poule[slots[i + 1]],
      `paar ${slots[i]}–${slots[i + 1]} komt uit dezelfde poule`);
  }
  // Alle teams moeten er nog exact één keer in staan
  assert.deepStrictEqual([...slots].sort(), ['A1', 'A2', 'B1', 'B2']);
});

test('grotere bracket: geen eigen-poule-duels als het oplosbaar is', () => {
  const poule = { A1:'pA',A2:'pA',B1:'pB',B2:'pB',C1:'pC',C2:'pC',D1:'pD',D2:'pD' };
  // Bewust ongunstige volgorde: elk paar is een eigen-poule-duel
  const slots = ['A1','A2','B1','B2','C1','C2','D1','D2'];
  T.vermijdEigenPoule(slots, (id) => poule[id]);
  for (let i = 0; i < slots.length; i += 2) {
    assert.notStrictEqual(poule[slots[i]], poule[slots[i + 1]]);
  }
  assert.deepStrictEqual([...slots].sort(), ['A1','A2','B1','B2','C1','C2','D1','D2']);
});

test('onoplosbaar (alles uit één poule) blijft heel: geen teams kwijt', () => {
  const slots = ['A1', 'A2', 'A3', 'A4'];
  T.vermijdEigenPoule(slots, () => 'pA');
  assert.deepStrictEqual([...slots].sort(), ['A1', 'A2', 'A3', 'A4']);
});

test('byes (null) worden met rust gelaten', () => {
  const poule = { A1: 'pA', A2: 'pA', B1: 'pB' };
  const slots = ['A1', null, 'B1', 'A2'];
  T.vermijdEigenPoule(slots, (id) => poule[id]);
  assert.strictEqual(slots[1], null, 'bye van seed 1 mag niet weggeruild worden');
  assert.deepStrictEqual([...slots].filter(Boolean).sort(), ['A1', 'A2', 'B1']);
});

console.log('\nKnock-out: winnaars doorschuiven');

function maakBracket4(){
  // Skelet voor 4 teams: 2 halve finales + finale
  return [
    { fase:'f', ronde:1, koIndex:0, thuis:'A', uit:'B', score:null, status:'gepland' },
    { fase:'f', ronde:1, koIndex:1, thuis:'C', uit:'D', score:null, status:'gepland' },
    { fase:'f', ronde:2, koIndex:0, thuis:null, uit:null, score:null, status:'gepland' },
  ];
}

test('winnaars stromen door naar de finale', () => {
  const ws = maakBracket4();
  ws[0].score = { thuis: 6, uit: 3 };
  ws[1].score = { thuis: 2, uit: 6 };
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, 'A');
  assert.strictEqual(ws[2].uit, 'D');
});

test('gelijkspel met golden point beslist de winnaar', () => {
  const ws = maakBracket4();
  ws[0].score = { thuis: 5, uit: 5, gp: 'uit' };
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, 'B');
  assert.strictEqual(ws[2].uit, null); // andere helft nog niet gespeeld
});

test('gelijkspel zónder golden point stroomt niet door', () => {
  const ws = maakBracket4();
  ws[0].score = { thuis: 5, uit: 5 };
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, null);
});

test('correctie: andere winnaar wist de vervolguitslag (cascade)', () => {
  const ws = maakBracket4();
  ws[0].score = { thuis: 6, uit: 3 };
  ws[1].score = { thuis: 6, uit: 1 };
  T.werkBracketBij(ws, 'f');
  ws[2].score = { thuis: 6, uit: 4 }; // finale al gespeeld: A wint
  // Correctie in halve finale 1: B blijkt gewonnen te hebben
  ws[0].score = { thuis: 3, uit: 6 };
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, 'B');
  assert.strictEqual(ws[2].score, null, 'finale-uitslag moet gewist zijn');
});

test('bye (lege kant) stroomt direct door', () => {
  const ws = maakBracket4();
  ws[1].uit = null; // C heeft een bye
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].uit, 'C');
});

test('uitslag wissen trekt de winnaar terug uit de volgende ronde', () => {
  const ws = maakBracket4();
  ws[0].score = { thuis: 6, uit: 3 };
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, 'A');
  ws[0].score = null;
  T.werkBracketBij(ws, 'f');
  assert.strictEqual(ws[2].thuis, null);
});

console.log('\n' + geslaagd + ' tests geslaagd.' + (process.exitCode ? ' (met fouten)' : ''));
