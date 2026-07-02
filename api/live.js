// Publieke, afgeslankte data voor de live-pagina (polling). Geen geheimen.
'use strict';

const store = require('../lib/store');
const { json, cfgVan } = require('../lib/http');
const { berekenStand } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { fout: 'Methode niet toegestaan' });
    const { slug } = req.query || {};
    const t = await store.haalToernooiViaSlug(slug);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });

    const cfg = cfgVan(t);
    const naam = (id) => {
      const tm = (t.teams || []).find((x) => x.id === id);
      return tm ? tm.naam : (id || 'n.t.b.');
    };

    const divisies = (t.divisies || []).map((d) => {
      const pouleFase = d.fases.find((f) => f.type === 'poule');
      const bracketFase = d.fases.find((f) => f.type === 'bracket');

      const poules = pouleFase
        ? pouleFase.poules.map((p) => {
            const matches = t.wedstrijden.filter((w) => w.fase === pouleFase.id && w.groep === p.id);
            const stand = berekenStand(p.teams || [], matches, cfg).map((r) => ({
              ...r, teamNaam: naam(r.team),
            }));
            return { id: p.id, naam: p.naam, stand };
          })
        : [];

      const bracket = bracketFase
        ? t.wedstrijden
            .filter((w) => w.fase === bracketFase.id)
            .map((w) => ({
              ronde: w.ronde,
              thuis: naam(w.thuis), uit: naam(w.uit),
              score: w.score, status: w.status,
            }))
        : [];

      return { id: d.id, naam: d.naam, poules, bracket, knockoutGestart: Boolean(bracketFase && bracketFase.gestart) };
    });

    const schema = (t.wedstrijden || [])
      .filter((w) => w.baan && w.tijd)
      .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)))
      .map((w) => ({
        divisie: w.divisie, groep: w.groep,
        baan: w.baan, tijd: w.tijd,
        thuis: naam(w.thuis), uit: naam(w.uit),
        score: w.score, status: w.status,
      }));

    return json(res, 200, {
      naam: t.naam, datum: t.datum, locatie: t.locatie, status: t.status,
      banen: t.banen || [],
      divisies,
      schema,
    });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
