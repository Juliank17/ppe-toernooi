// Wedstrijden op banen/tijden plannen (admin of personeel).
// Accepteert een batch: [{wedstrijdId, baan, tijd}]. baan/tijd = null → terug naar "niet gepland".
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, planning } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });
    if (!Array.isArray(planning)) return json(res, 400, { fout: 'planning ontbreekt' });

    const perId = new Map((t.wedstrijden || []).map((w) => [w.id, w]));
    let bijgewerkt = 0;
    for (const p of planning) {
      const w = perId.get(p.wedstrijdId);
      if (!w) continue;
      w.baan = p.baan || null;
      w.tijd = p.tijd || null;
      bijgewerkt++;
    }

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true, bijgewerkt });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
