// Team op aanwezig/afwezig zetten voor de check-in (admin of personeel).
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, teamId, aanwezig } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const team = (t.teams || []).find((x) => x.id === teamId);
    if (!team) return json(res, 404, { fout: 'Team niet gevonden' });
    team.afwezig = !aanwezig;

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
