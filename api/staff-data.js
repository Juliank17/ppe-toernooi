// Data voor de personeel-modus: wedstrijd-id's, teams, divisies. Achter PIN/admin.
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { fout: 'Methode niet toegestaan' });
    const { slug } = req.query || {};
    const t = await store.haalToernooiViaSlug(slug);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const naam = (id) => {
      const tm = (t.teams || []).find((x) => x.id === id);
      return tm ? tm.naam : (id || 'n.t.b.');
    };

    return json(res, 200, {
      id: t.id, naam: t.naam, slug: t.slug,
      teams: (t.teams || []).map((x) => ({ id: x.id, naam: x.naam, divisie: x.divisie })),
      divisies: (t.divisies || []).map((d) => ({
        id: d.id, naam: d.naam,
        poules: ((d.fases.find((f) => f.type === 'poule') || {}).poules || []).map((p) => ({ id: p.id, naam: p.naam })),
        heeftKnockout: d.fases.some((f) => f.type === 'bracket'),
        knockoutGestart: (d.fases.find((f) => f.type === 'bracket') || {}).gestart || false,
      })),
      wedstrijden: (t.wedstrijden || []).map((w) => ({
        id: w.id, divisie: w.divisie, groep: w.groep, ronde: w.ronde,
        thuis: naam(w.thuis), uit: naam(w.uit),
        baan: w.baan, tijd: w.tijd, score: w.score, status: w.status,
      })),
    });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
