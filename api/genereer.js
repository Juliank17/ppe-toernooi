// Wedstrijden genereren voor een poulefase (admin).
'use strict';

const store = require('../lib/store');
const { isAdmin } = require('../lib/auth');
const { leesBody, json, uid } = require('../lib/http');
const { genereerPoule } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });
    if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });

    const { id, divisieId, faseId, dubbel } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });

    const divisie = (t.divisies || []).find((d) => d.id === divisieId);
    const fase = divisie && (divisie.fases || []).find((f) => f.id === faseId);
    if (!fase || fase.type !== 'poule') return json(res, 400, { fout: 'Poulefase niet gevonden' });

    // Bestaande wedstrijden van deze fase opnieuw genereren
    t.wedstrijden = (t.wedstrijden || []).filter((w) => w.fase !== faseId);

    let aantal = 0;
    for (const poule of fase.poules) {
      const paren = genereerPoule(poule.teams || [], { dubbel: Boolean(dubbel) });
      for (const p of paren) {
        t.wedstrijden.push({
          id: uid(),
          divisie: divisieId, fase: faseId, groep: poule.id, ronde: p.ronde,
          thuis: p.thuis, uit: p.uit,
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
