// Uitslag opslaan (admin of personeel).
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, wedstrijdId, score, leeg } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const w = (t.wedstrijden || []).find((m) => m.id === wedstrijdId);
    if (!w) return json(res, 404, { fout: 'Wedstrijd niet gevonden' });

    if (leeg) {
      w.score = null;
      w.status = 'gepland';
    } else {
      if (!score || score.thuis == null || score.uit == null) {
        return json(res, 400, { fout: 'Ongeldige score' });
      }
      w.score = { thuis: Number(score.thuis), uit: Number(score.uit) };
      w.status = 'klaar';
    }

    t.log = t.log || [];
    t.log.push({ t: Date.now(), actie: 'score', wedstrijd: wedstrijdId, door: magSchrijven(req, t) ? 'staff/admin' : '?' });

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
