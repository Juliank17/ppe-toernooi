// Publieke, afgeslankte data voor de live-pagina (polling). Geen geheimen.
'use strict';

const store = require('../lib/store');
const { json, cfgVan } = require('../lib/http');
const { berekenStand, seedVolgorde } = require('../lib/tournament');

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

      let bracket = [];
      if (bracketFase) {
        const ws = t.wedstrijden
          .filter((w) => w.fase === bracketFase.id)
          .sort((a, b) => (a.ronde - b.ronde) || ((a.koIndex || 0) - (b.koIndex || 0)));

        // Placeholders voor nog niet ingevulde plekken: in ronde 1 op basis van
        // de kwalificatie (alle nrs 1, dan nrs 2, ...), daarna "Winnaar <vorige ronde>".
        const G = bracketFase.grootte || 0;
        const sv = G >= 2 ? seedVolgorde(G) : [];
        const P = pouleFase ? (pouleFase.poules || []).length : 0;
        const seedLabel = (k) => {
          if (!P) return `Geplaatste #${k}`;
          const positie = Math.floor((k - 1) / P) + 1;
          if (P === 1) return `Nr. ${k} ${pouleFase.poules[0].naam}`;
          const j = k - (positie - 1) * P;
          return (j === 1 ? 'Beste' : j + 'e') + ` nr. ${positie}`;
        };
        const labelVan = (ronde, idx) => {
          const kind = ws.find((x) => (x.ronde || 1) === ronde && (x.koIndex || 0) === idx);
          return kind && kind.label ? kind.label : `KO-ronde ${ronde}`;
        };
        const plek = (w, kant) => {
          const teamId = kant === 0 ? w.thuis : w.uit;
          if (teamId) return naam(teamId);
          const r = w.ronde || 1, i = w.koIndex || 0;
          if (r === 1) return sv.length ? seedLabel(sv[2 * i + kant]) : 'n.t.b.';
          return `Winnaar ${labelVan(r - 1, 2 * i + kant)}`;
        };

        bracket = ws.map((w) => ({
          ronde: w.ronde, label: w.label || null,
          thuis: plek(w, 0), uit: plek(w, 1),
          voorlopig: !w.thuis || !w.uit,
          score: w.score, status: w.status,
        }));
      }

      return { id: d.id, naam: d.naam, poules, bracket, knockoutGestart: Boolean(bracketFase && bracketFase.gestart) };
    });

    const schema = (t.wedstrijden || [])
      .filter((w) => w.baan && w.tijd)
      .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)))
      .map((w) => ({
        divisie: w.divisie, groep: w.groep, label: w.label || null,
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
