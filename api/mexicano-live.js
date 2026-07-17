// Publieke, alleen-lezen Mexicano-data voor toeschouwers (geen PIN nodig).
// Bevat alleen namen, scores en de stand — geen instellingen of geheimen.
'use strict';

const store = require('../lib/store');
const { json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { fout: 'Methode niet toegestaan' });
    const { slug } = req.query || {};
    const t = await store.haalToernooiViaSlug(slug);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    return json(res, 200, {
      naam: t.naam, datum: t.datum, locatie: t.locatie,
      mexicano: t.mexicano || null,
    });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
