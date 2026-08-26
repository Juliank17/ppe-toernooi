// Uitslag opslaan (admin of personeel).
'use strict';

const store = require('../lib/store');
const { magSchrijven, isAdmin } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');
const { werkBracketBij } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });

    const { id, wedstrijdId, score, leeg } = await leesBody(req);
    const t = await store.haalToernooi(id);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const w = (t.wedstrijden || []).find((m) => m.id === wedstrijdId);
    if (!w) return json(res, 404, { fout: 'Wedstrijd niet gevonden' });

    // Is dit een knock-outwedstrijd? Dan geldt: gelijk = golden point verplicht.
    const divisie = (t.divisies || []).find((d) => d.id === w.divisie);
    const bracketFase = divisie && divisie.fases.find((f) => f.type === 'bracket');
    const isKO = Boolean(bracketFase && w.fase === bracketFase.id);

    if (leeg) {
      w.score = null;
      w.status = 'gepland';
    } else {
      if (!score || score.thuis == null || score.uit == null) {
        return json(res, 400, { fout: 'Ongeldige score' });
      }
      const nieuw = { thuis: Number(score.thuis), uit: Number(score.uit) };
      if (isKO && nieuw.thuis === nieuw.uit) {
        if (score.gp !== 'thuis' && score.gp !== 'uit') {
          return json(res, 400, { fout: 'Gelijkspel in de knock-out: geef door wie het beslissende punt (golden point) won.' });
        }
        nieuw.gp = score.gp;
      }
      w.score = nieuw;
      w.status = 'klaar';
    }

    // Winnaars doorschuiven (en correcties/cascades verwerken)
    if (isKO) werkBracketBij(t.wedstrijden, bracketFase.id);

    // Leesbaar logboek: wie deed wat, met teamnamen
    const naamVan = (id) => { const tm = (t.teams || []).find((x) => x.id === id); return tm ? tm.naam : 'n.t.b.'; };
    t.log = t.log || [];
    t.log.push({
      t: Date.now(),
      actie: leeg ? 'score gewist' : 'score',
      tekst: `${w.label ? w.label + ': ' : ''}${naamVan(w.thuis)} ${leeg ? '—' : w.score.thuis + '-' + w.score.uit + (w.score.gp ? '*' : '')} ${naamVan(w.uit)}`,
      door: isAdmin(req) ? 'admin' : 'personeel',
    });
    if (t.log.length > 200) t.log = t.log.slice(-200);

    await store.bewaarToernooi(t);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
