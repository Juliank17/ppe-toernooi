// Mexicano-state lezen/opslaan — voor personeel (PIN-cookie) én admin (interne sleutel).
// Zelfde toegangsmodel als de andere spelvorm: magSchrijven = admin of geldige staff-cookie.
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { slug } = req.query || {};
      const t = await store.haalToernooiViaSlug(slug);
      if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
      if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });
      return json(res, 200, {
        naam: t.naam, datum: t.datum, locatie: t.locatie, slug: t.slug,
        banen: t.banen || [], wedstrijdduur: t.wedstrijdduur,
        mexicanoPunten: t.mexicanoPunten, spelers: t.spelers || [],
        mexicano: t.mexicano || null,
      });
    }

    if (req.method === 'POST') {
      const { slug, mexicano } = await leesBody(req);
      const t = await store.haalToernooiViaSlug(slug);
      if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
      if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });
      t.mexicano = mexicano;
      await store.bewaarToernooi(t);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { fout: 'Methode niet toegestaan' });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
