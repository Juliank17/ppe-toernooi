// Volgende fase (knock-out) starten of terugdraaien — admin of personeel.
// Vult de bracket-slots op basis van de poule-eindstanden en de doorstroomregels.
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json, uid, cfgVan } = require('../lib/http');
const { teamOpPositie } = require('../lib/tournament');

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

    // Terugdraaien: bracket-wedstrijden weghalen (uitslagen elders blijven staan)
    if (terug) {
      t.wedstrijden = (t.wedstrijden || []).filter((w) => w.fase !== bracketFase.id);
      bracketFase.gestart = false;
      await store.bewaarToernooi(t);
      return json(res, 200, { ok: true, teruggedraaid: true });
    }

    const cfg = cfgVan(t);
    const grootte = bracketFase.grootte || 8;
    const slots = new Array(grootte).fill(null);

    // Doorstroomregels toepassen: "pA#1" → team dat 1e staat in poule A
    for (const regel of bracketFase.doorstroom || []) {
      const [groepId, posStr] = String(regel.van).split('#');
      const pos = Number(posStr);
      const poule = pouleFase.poules.find((p) => p.id === groepId);
      if (!poule) continue;
      const pouleMatches = t.wedstrijden.filter((w) => w.fase === pouleFase.id && w.groep === groepId);
      slots[regel.slot] = teamOpPositie(poule.teams, pouleMatches, cfg, pos);
    }

    // Eerste ronde opbouwen uit opeenvolgende slots
    t.wedstrijden = t.wedstrijden.filter((w) => w.fase !== bracketFase.id);
    for (let i = 0; i < grootte; i += 2) {
      t.wedstrijden.push({
        id: uid(),
        divisie: divisieId, fase: bracketFase.id, groep: 'bracket', ronde: 1,
        thuis: slots[i], uit: slots[i + 1],
        baan: null, tijd: null, scheidsrechter: null,
        score: null, status: 'gepland',
      });
    }
    bracketFase.gestart = true;

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true, slots });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
