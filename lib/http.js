// Kleine helpers voor de serverless-endpoints.
'use strict';

async function leesBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function cfgVan(t) {
  return {
    punten: t.punten || { winst: 3, gelijk: 1, verlies: 0 },
    tiebreakers: t.tiebreakers || ['punten', 'onderling', 'saldo', 'voor', 'gewonnen'],
    h2hIteratief: t.h2hIteratief !== false,
  };
}

function uid() {
  return 'x' + Math.random().toString(36).slice(2, 10);
}

module.exports = { leesBody, json, cfgVan, uid };
