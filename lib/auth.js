// Toegangscontrole. Twee niveaus:
//  - Admin: gedeelde interne sleutel (env INTERNAL_KEY), zoals in het dashboard.
//  - Personeel: toernooi-specifieke PIN → korte, ondertekende cookie.
'use strict';

const crypto = require('crypto');

const INTERNAL_KEY = process.env.INTERNAL_KEY || '';
const STAFF_SECRET = process.env.STAFF_SECRET || process.env.INTERNAL_KEY || 'dev-secret';
const STAFF_UREN = 12; // personeel-cookie is een halve dag geldig

// Timing-veilige vergelijking
function veiligGelijk(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// --- Admin ---
function isAdmin(req) {
  if (!INTERNAL_KEY) return false;
  const key = req.headers['x-internal-key'] || '';
  return veiligGelijk(key, INTERNAL_KEY);
}

// --- Personeel-token ---
function maakStaffToken(slug) {
  const exp = Date.now() + STAFF_UREN * 3600 * 1000;
  const payload = `${slug}.${exp}`;
  const sig = crypto.createHmac('sha256', STAFF_SECRET).update(payload).digest('hex').slice(0, 32);
  return `${payload}.${sig}`;
}

function controleerStaffToken(token, slug) {
  if (!token) return false;
  const delen = String(token).split('.');
  if (delen.length !== 3) return false;
  const [s, exp, sig] = delen;
  if (s !== slug) return false;
  if (Number(exp) < Date.now()) return false;
  const verwacht = crypto
    .createHmac('sha256', STAFF_SECRET)
    .update(`${s}.${exp}`)
    .digest('hex')
    .slice(0, 32);
  return veiligGelijk(sig, verwacht);
}

// Leest de personeel-cookie uit het verzoek
function staffTokenUitCookie(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/ppe_staff=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Mag deze aanvraag scores/aanmeldingen doen voor dit toernooi?
function magSchrijven(req, toernooi) {
  if (isAdmin(req)) return true;
  const token = staffTokenUitCookie(req);
  return controleerStaffToken(token, toernooi.slug);
}

module.exports = {
  isAdmin,
  maakStaffToken,
  controleerStaffToken,
  staffTokenUitCookie,
  magSchrijven,
  veiligGelijk,
};
