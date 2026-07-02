// Personeel logt in met de toernooi-PIN → korte, ondertekende cookie.
'use strict';

const store = require('../lib/store');
const { maakStaffToken, veiligGelijk } = require('../lib/auth');
const { leesBody, json } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { fout: 'Methode niet toegestaan' });
    const { slug, pin } = await leesBody(req);
    const t = await store.haalToernooiViaSlug(slug);
    if (!t) return json(res, 404, { fout: 'Toernooi niet gevonden' });

    if (!t.personeelspin || !veiligGelijk(pin || '', t.personeelspin)) {
      return json(res, 401, { fout: 'Onjuiste code' });
    }

    const token = maakStaffToken(t.slug);
    res.setHeader(
      'Set-Cookie',
      `ppe_staff=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}`
    );
    return json(res, 200, { ok: true, naam: t.naam });
  } catch (e) {
    return json(res, 500, { fout: e.message });
  }
};
