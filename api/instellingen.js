// Algemene instellingen (admin): o.a. de standaard sponsorenlijst
// die elk nieuw toernooi automatisch meekrijgt.
'use strict';

const store = require('../lib/store');
const { isAdmin } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });

    if (req.method === 'GET') {
      return json(res, 200, await store.haalInstellingen());
    }

    if (req.method === 'POST') {
      const body = await leesBody(req);
      const inst = await store.haalInstellingen();
      if (Array.isArray(body.sponsoren)) inst.sponsoren = body.sponsoren;
      await store.bewaarInstellingen(inst);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { fout: 'Methode niet toegestaan' });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
