// Upstash Redis via de REST-API — zelfde patroon als het PPE-dashboard.
// Eén JSON-record per toernooi + een index + een slug→id verwijzing.
'use strict';

const KV_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function beschikbaar() {
  return Boolean(KV_URL && KV_TOKEN);
}

async function cmd(args) {
  if (!beschikbaar()) throw new Error('Redis niet geconfigureerd (env-variabelen ontbreken)');
  let laatste;
  for (let poging = 1; poging <= 2; poging++) {
    try {
      const r = await fetch(KV_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error('Redis-fout ' + r.status);
      const j = await r.json();
      return j.result;
    } catch (e) {
      laatste = e; // netwerk-hik ("fetch failed") of tijdelijke fout: nog één keer proberen
      if (poging === 1) await new Promise((rs) => setTimeout(rs, 400));
    }
  }
  throw new Error('Database tijdelijk niet bereikbaar (' + (laatste && laatste.message) + ') — probeer het over een paar seconden opnieuw.');
}

async function get(key) {
  const res = await cmd(['GET', key]);
  return res ? JSON.parse(res) : null;
}

async function set(key, obj) {
  return cmd(['SET', key, JSON.stringify(obj)]);
}

async function del(key) {
  return cmd(['DEL', key]);
}

// --- Toernooi-specifieke helpers ---

const K_INDEX = 'toernooi:index';
const kToernooi = (id) => `toernooi:${id}`;
const kSlug = (slug) => `slug:${slug}`;

async function haalToernooi(id) {
  return get(kToernooi(id));
}

async function haalToernooiViaSlug(slug) {
  const id = await cmd(['GET', kSlug(slug)]);
  return id ? get(kToernooi(id)) : null;
}

async function bewaarToernooi(t) {
  await set(kToernooi(t.id), t);
  if (t.slug) await cmd(['SET', kSlug(t.slug), t.id]);
  await werkIndexBij(t);
  return t;
}

async function werkIndexBij(t) {
  const index = (await get(K_INDEX)) || [];
  const rij = {
    id: t.id, slug: t.slug, naam: t.naam,
    datum: t.datum, locatie: t.locatie, status: t.status,
    vorm: t.vorm || 'poule_ko',
  };
  const i = index.findIndex((r) => r.id === t.id);
  if (i >= 0) index[i] = rij; else index.push(rij);
  await set(K_INDEX, index);
}

async function haalIndex() {
  return (await get(K_INDEX)) || [];
}

// Algemene instellingen (o.a. standaard sponsorenlijst voor nieuwe toernooien)
const K_INSTELLINGEN = 'instellingen:algemeen';
async function haalInstellingen() {
  return (await get(K_INSTELLINGEN)) || {};
}
async function bewaarInstellingen(obj) {
  return set(K_INSTELLINGEN, obj);
}

// Verwijdert het toernooi, de slug-verwijzing en de index-rij.
async function verwijderToernooi(id) {
  const t = await haalToernooi(id);
  if (!t) return false;
  await del(kToernooi(id));
  if (t.slug) await del(kSlug(t.slug));
  const index = (await get(K_INDEX)) || [];
  await set(K_INDEX, index.filter((r) => r.id !== id));
  return true;
}

module.exports = {
  beschikbaar,
  haalToernooi,
  haalToernooiViaSlug,
  bewaarToernooi,
  haalIndex,
  verwijderToernooi,
  haalInstellingen,
  bewaarInstellingen,
  _get: get, _set: set, _del: del,
};
