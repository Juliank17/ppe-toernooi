// Toernooi ophalen/opslaan (admin).
'use strict';

const store = require('../lib/store');
const { isAdmin } = require('../lib/auth');
const { leesBody, json, uid } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      // Overzicht of één toernooi
      if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });
      const { id } = req.query || {};
      if (id) {
        const t = await store.haalToernooi(id);
        return t ? json(res, 200, t) : json(res, 404, { fout: 'Niet gevonden' });
      }
      return json(res, 200, { toernooien: await store.haalIndex() });
    }

    if (req.method === 'POST') {
      if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });
      const body = await leesBody(req);
      const bestaat = body.id ? await store.haalToernooi(body.id) : null;

      const t = Object.assign(
        {
          id: body.id || uid(),
          slug: body.slug,
          naam: body.naam || 'Nieuw toernooi',
          datum: body.datum || new Date().toISOString().slice(0, 10),
          locatie: body.locatie || '',
          status: body.status || 'concept',
          personeelspin: body.personeelspin || '',
          banen: [],
          wedstrijdduur: 20,
          wisseltijd: 5,
          scoreType: 'punten',
          punten: { winst: 3, gelijk: 1, verlies: 0 },
          tiebreakers: ['punten', 'onderling', 'saldo', 'voor', 'gewonnen'],
          h2hIteratief: true,
          divisies: [],
          teams: [],
          wedstrijden: [],
        },
        bestaat || {},
        body // ingestuurde velden overschrijven het laatst
      );

      if (!t.slug) return json(res, 400, { fout: 'slug is verplicht' });
      await store.bewaarToernooi(t);
      return json(res, 200, { ok: true, id: t.id, slug: t.slug });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin(req)) return json(res, 401, { fout: 'Geen toegang' });
      const { id } = req.query || {};
      if (!id) return json(res, 400, { fout: 'id is verplicht' });
      const ok = await store.verwijderToernooi(id);
      return ok ? json(res, 200, { ok: true }) : json(res, 404, { fout: 'Niet gevonden' });
    }

    return json(res, 405, { fout: 'Methode niet toegestaan' });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
