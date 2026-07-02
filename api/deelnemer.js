// Deelnemer/team aanmelden (admin of personeel).
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { leesBody, json, uid } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, team } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });
    if (!team || !team.naam) return json(res, 400, { fout: 'Teamnaam ontbreekt' });

    const nieuw = {
      id: uid(),
      naam: String(team.naam).trim(),
      spelers: Array.isArray(team.spelers) ? team.spelers : [],
      divisie: team.divisie || null,
      seed: team.seed || null,
      afwezig: false,
    };
    t.teams = t.teams || [];
    t.teams.push(nieuw);

    // Optioneel meteen in een poule plaatsen
    if (team.poule && team.divisie) {
      const divisie = (t.divisies || []).find((d) => d.id === team.divisie);
      const pouleFase = divisie && divisie.fases.find((f) => f.type === 'poule');
      const poule = pouleFase && pouleFase.poules.find((p) => p.id === team.poule);
      if (poule) {
        poule.teams = poule.teams || [];
        poule.teams.push(nieuw.id);
      }
    }

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true, team: nieuw });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
