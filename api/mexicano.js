// Mexicano-endpoint. Drie smaken in één function (Hobby-plan limiet: max 12 functions):
//   GET  ?slug=&publiek=1 → alleen-lezen voor toeschouwers (geen code nodig)
//   GET  ?slug=           → volledige data voor personeel/admin (PIN-cookie of sleutel)
//   POST {slug, mexicano} → state opslaan (personeel/admin)
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { slug, publiek } = req.query || {};
      const t = await store.haalToernooiViaSlug(slug);
      if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });

      if (publiek) {
        // Toeschouwers: alleen namen, scores en stand — geen instellingen/PIN
        return json(res, 200, {
          naam: t.naam, datum: t.datum, locatie: t.locatie,
          mexicano: t.mexicano || null,
        });
      }

      if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });
      return json(res, 200, {
        naam: t.naam, datum: t.datum, locatie: t.locatie, slug: t.slug,
        banen: t.banen || [], wedstrijdduur: t.wedstrijdduur,
        mexicanoPunten: t.mexicanoPunten, mexicanoOpTijd: t.mexicanoOpTijd,
        spelers: t.spelers || [],
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
