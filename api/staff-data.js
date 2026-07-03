// Data voor de personeel-modus: wedstrijd-id's, teams, divisies. Achter PIN/admin.
'use strict';

const store = require('../lib/store');
const { magSchrijven } = require('../lib/auth');
const { json } = require('../lib/http');
const { seedVolgorde } = require('../lib/tournament');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { fout: 'Methode niet toegestaan' });
    const { slug } = req.query || {};
    const t = await store.haalToernooiViaSlug(slug);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });
    if (!magSchrijven(req, t)) return json(res, 401, { fout: 'Geen toegang' });

    const naam = (id) => {
      const tm = (t.teams || []).find((x) => x.id === id);
      return tm ? tm.naam : (id || 'n.t.b.');
    };

    // Placeholders voor lege knock-out-plekken (zelfde aanpak als de live-API):
    // ronde 1 op basis van de plaatsing, daarna "Winnaar <vorige ronde>".
    const koCtx = {};
    for (const d of t.divisies || []) {
      const bf = d.fases.find((f) => f.type === 'bracket');
      if (!bf) continue;
      const pf = d.fases.find((f) => f.type === 'poule');
      const G = bf.grootte || 0;
      koCtx[d.id] = {
        ws: (t.wedstrijden || []).filter((w) => w.fase === bf.id),
        sv: G >= 2 ? seedVolgorde(G) : [],
        poules: pf ? (pf.poules || []) : [],
      };
    }
    const plek = (w, kant) => {
      const teamId = kant === 0 ? w.thuis : w.uit;
      if (teamId) return naam(teamId);
      const ctx = w.groep === 'ko' ? koCtx[w.divisie] : null;
      if (!ctx) return 'n.t.b.';
      const r = w.ronde || 1, i = w.koIndex || 0;
      if (r === 1) {
        const k = ctx.sv[2 * i + kant];
        if (!k) return 'n.t.b.';
        const P = ctx.poules.length;
        if (!P) return `Geplaatste #${k}`;
        const positie = Math.floor((k - 1) / P) + 1;
        if (P === 1) return `Nr. ${k} ${ctx.poules[0].naam}`;
        const j = k - (positie - 1) * P;
        return (j === 1 ? 'Beste' : j + 'e') + ` nr. ${positie}`;
      }
      const kind = ctx.ws.find((x) => (x.ronde || 1) === r - 1 && (x.koIndex || 0) === 2 * i + kant);
      return 'Winnaar ' + (kind && kind.label ? kind.label : 'KO-ronde ' + (r - 1));
    };

    return json(res, 200, {
      id: t.id, naam: t.naam, slug: t.slug,
      banen: (t.banen || []).map((b) => ({ id: b.id, naam: b.naam })),
      teams: (t.teams || []).map((x) => ({ id: x.id, naam: x.naam, divisie: x.divisie, afwezig: !!x.afwezig })),
      divisies: (t.divisies || []).map((d) => ({
        id: d.id, naam: d.naam,
        poules: ((d.fases.find((f) => f.type === 'poule') || {}).poules || []).map((p) => ({ id: p.id, naam: p.naam })),
        heeftKnockout: d.fases.some((f) => f.type === 'bracket'),
        knockoutGestart: (d.fases.find((f) => f.type === 'bracket') || {}).gestart || false,
      })),
      wedstrijden: (t.wedstrijden || []).map((w) => ({
        id: w.id, divisie: w.divisie, groep: w.groep, ronde: w.ronde, label: w.label || null,
        thuis: plek(w, 0), uit: plek(w, 1),
        voorlopig: w.groep === 'ko' && (!w.thuis || !w.uit),
        baan: w.baan, tijd: w.tijd, score: w.score, status: w.status,
      })),
    });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
