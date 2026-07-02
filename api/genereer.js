// Wedstrijden genereren voor een hele divisie (admin):
// poulewedstrijden + een leeg knock-out-skelet (alle rondes), zodat je ook de
// knock-out alvast kunt inplannen voordat de teams bekend zijn.
'use strict';

const store = require('../lib/store');
const { isAdmin } = require('../lib/auth');
const { leesBody, json, uid } = require('../lib/http');
const { genereerPoule, genereerBracketSkelet } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });
    if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });

    const { id, divisieId, dubbel } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });

    const divisie = (t.divisies || []).find((d) => d.id === divisieId);
    if (!divisie) return json(res, 404, { fout: 'Divisie niet gevonden' });

    const pouleFase = (divisie.fases || []).find((f) => f.type === 'poule');
    const bracketFase = (divisie.fases || []).find((f) => f.type === 'bracket');

    // Bestaande wedstrijden van deze divisie opnieuw genereren
    t.wedstrijden = (t.wedstrijden || []).filter((w) => w.divisie !== divisieId);

    let aantal = 0;

    // Poulewedstrijden
    if (pouleFase) {
      for (const poule of pouleFase.poules) {
        const paren = genereerPoule(poule.teams || [], { dubbel: Boolean(dubbel) });
        for (const p of paren) {
          t.wedstrijden.push({
            id: uid(),
            divisie: divisieId, fase: pouleFase.id, groep: poule.id, ronde: p.ronde,
            thuis: p.thuis, uit: p.uit,
            baan: null, tijd: null, scheidsrechter: null,
            score: null, status: 'gepland',
          });
          aantal++;
        }
      }
    }

    // Knock-out-skelet (lege wedstrijden per ronde)
    if (bracketFase) {
      // Grootte afronden naar een macht van 2 (8, 16, ...)
      let g = bracketFase.grootte || 8;
      let p = 1; while (p < g) p *= 2;
      bracketFase.grootte = p;
      bracketFase.gestart = false;
      const skelet = genereerBracketSkelet(p);
      for (const s of skelet) {
        t.wedstrijden.push({
          id: uid(),
          divisie: divisieId, fase: bracketFase.id, groep: 'ko',
          ronde: s.ronde, koIndex: s.index, label: s.label,
          thuis: null, uit: null,
          baan: null, tijd: null, scheidsrechter: null,
          score: null, status: 'gepland',
        });
        aantal++;
      }
    }

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true, aantal });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
