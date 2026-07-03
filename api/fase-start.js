// Volgende fase (knock-out) starten of terugdraaien — admin of personeel.
// Vult de bracket-slots op basis van de poule-eindstanden en de doorstroomregels.
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json, uid, cfgVan } = require('../lib/http');
const { teamOpPositie, kwalificatieVolgorde, seedVolgorde, vermijdEigenPoule } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, divisieId, terug } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const divisie = (t.divisies || []).find((d) => d.id === divisieId);
    if (!divisie) return json(res, 404, { fout: 'Divisie niet gevonden' });

    const pouleFase = divisie.fases.find((f) => f.type === 'poule');
    const bracketFase = divisie.fases.find((f) => f.type === 'bracket');
    if (!bracketFase) return json(res, 400, { fout: 'Geen knock-outfase in deze divisie' });

    // Terugdraaien: knock-out leegmaken maar het skelet (en de planning) behouden
    if (terug) {
      for (const w of t.wedstrijden || []) {
        if (w.fase === bracketFase.id) { w.thuis = null; w.uit = null; w.score = null; w.status = 'gepland'; }
      }
      bracketFase.gestart = false;
      await store.bewaarToernooi(t);
      return json(res, 200, { ok: true, teruggedraaid: true });
    }

    const cfg = cfgVan(t);
    const grootte = bracketFase.grootte || 8;
    const slots = new Array(grootte).fill(null);
    const pouleMatches = pouleFase ? t.wedstrijden.filter((w) => w.fase === pouleFase.id) : [];

    if (bracketFase.doorstroom && bracketFase.doorstroom.length && bracketFase.kwalificatie !== 'beste') {
      // Expliciete doorstroomregels: "pA#1" → team dat 1e staat in poule A
      for (const regel of bracketFase.doorstroom) {
        const [groepId, posStr] = String(regel.van).split('#');
        const pos = Number(posStr);
        const poule = pouleFase.poules.find((p) => p.id === groepId);
        if (!poule) continue;
        const pm = pouleMatches.filter((w) => w.groep === groepId);
        slots[regel.slot] = teamOpPositie(poule.teams, pm, cfg, pos);
      }
    } else if (pouleFase) {
      // Beste geplaatsten over alle poules: alle #1, dan alle #2, dan beste #3, enz.
      const qualifiers = kwalificatieVolgorde(pouleFase.poules, pouleMatches, cfg, grootte);
      const order = seedVolgorde(grootte);
      const slotVoorSeed = {};
      order.forEach((s, i) => (slotVoorSeed[s] = i));
      qualifiers.forEach((team, k) => {
        const seed = k + 1;
        if (seed <= grootte) slots[slotVoorSeed[seed]] = team;
      });
      // Vermijd dat teams uit dezelfde poule elkaar in ronde 1 treffen
      if ((pouleFase.poules || []).length > 1) {
        const pouleVan = (teamId) => {
          const p = pouleFase.poules.find((x) => (x.teams || []).includes(teamId));
          return p ? p.id : null;
        };
        vermijdEigenPoule(slots, pouleVan);
      }
    }

    // Eerste ronde invullen. Bij voorkeur in het bestaande skelet (behoudt de planning);
    // bestaat er nog geen skelet, dan maken we de ronde-1 wedstrijden alsnog aan.
    const ronde1 = t.wedstrijden
      .filter((w) => w.fase === bracketFase.id && w.ronde === 1)
      .sort((a, b) => (a.koIndex || 0) - (b.koIndex || 0));

    if (ronde1.length) {
      ronde1.forEach((w, i) => { w.thuis = slots[i * 2]; w.uit = slots[i * 2 + 1]; });
    } else {
      for (let i = 0; i < grootte; i += 2) {
        t.wedstrijden.push({
          id: uid(),
          divisie: divisieId, fase: bracketFase.id, groep: 'ko', ronde: 1, koIndex: i / 2,
          thuis: slots[i], uit: slots[i + 1],
          baan: null, tijd: null, scheidsrechter: null,
          score: null, status: 'gepland',
        });
      }
    }
    bracketFase.gestart = true;

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true, slots });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
