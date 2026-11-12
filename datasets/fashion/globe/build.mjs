// Builds the Trend Atlas globe page from the fashion dataset.
//
// Reads public/nerds-of-fashion/fashion.json and globe/arrivals-pilot.json
// (sourced arrival years for eight trends, from the day9 repo's
// arrivals-pilot branch), downloads one small V&A photo per trend into
// raw/globe/ (gitignored), and writes one self-contained HTML file to
// raw/globe/trend-atlas.html, ready to publish as an artifact.
//
// Usage, from the repo root: node datasets/fashion/globe/build.mjs
// Node with no dependencies. Deterministic once the photos are cached.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const HERE = 'datasets/fashion/globe';
const RAW = 'datasets/fashion/raw/globe';
const ben = JSON.parse(readFileSync('public/nerds-of-fashion/fashion.json', 'utf8'));
const pilot = JSON.parse(readFileSync(`${HERE}/arrivals-pilot.json`, 'utf8'));
mkdirSync(`${RAW}/vam`, { recursive: true });

// 1. Trends: a birthplace, the places each one reached, and when.
const REG = { UK: 'uk', US: 'us', FR: 'fr', IT: 'it' };
const CORE = new Set(Object.values(REG));
const PMAP = { miniskirt: 'miniskirt', 'punk fashion': 'punk', 'New Look (Dior)': 'new-look', 'bell-bottoms': 'bell-bottoms', 'hip hop fashion': 'hip-hop', 'grunge fashion': 'grunge', athleisure: 'athleisure', 'Harajuku street style': 'harajuku' };
const T = {};
for (const t of ben.trends) {
  const ps = {}, g = [];
  for (const p of t.periods) {
    const s = Math.max(1920, p.start), e = Math.min(2026, p.end);
    if (e < s) continue;
    if (p.region === 'global') g.push([s, e]); else (ps[REG[p.region]] ||= []).push([s, e]);
  }
  for (const k in ps) ps[k].sort((a, b) => a[0] - b[0]);
  g.sort((a, b) => a[0] - b[0]);
  const first = Object.entries(ps).map(([k, v]) => [k, v[0][0]]).sort((a, b) => a[1] - b[1]);
  const x = { id: t.id, n: t.name, c: t.category, d: t.description, ps, g, de: {}, o: [], y: null };
  const s0 = t.sources[0];
  if (s0) { x.q = s0.quote.length > 220 ? s0.quote.slice(0, 217).replace(/\s+\S*$/, '') + '…' : s0.quote; x.u = s0.url; }
  // A named country only counts as the birthplace if the trend is recorded there before it is recorded as worldwide.
  if (first.length && !(g.length && g[0][0] < first[0][1])) {
    x.y = first[0][1];
    x.o = first.filter((f) => f[1] === x.y).map((f) => f[0]);
    const waveEnd = Math.max(...x.o.map((k) => ps[k][0][1]));
    for (const [k, y] of first) if (!x.o.includes(k)) x.de[k] = { y, late: y > waveEnd + 5 ? 1 : 0 };
  }
  T[t.id] = x;
}
// The pilot: sourced arrival years for places beyond Ben's four countries.
const PLACE = { 'United Kingdom': 'uk', London: 'uk', Paris: 'fr', France: 'fr', 'United States': 'us', 'New York City': 'us', Seattle: 'us', Tokyo: 'jp', Japan: 'jp',
  'Mexico City': 'mex', Germany: 'de', Melbourne: 'mel', Australia: 'mel', Italy: 'it', 'Soviet Union': 'su', Tanzania: 'tz', 'Vatican City': 'va',
  'South Korea': 'kr', Netherlands: 'nl', Norway: 'no', Estonia: 'ee', Luxembourg: 'lu', Romania: 'ro', Sweden: 'se' };
const ARCHIVE = { delpher: 'Dutch newspapers', nb: 'Norwegian newspapers', ddb: 'German newspapers', digar: 'Estonian newspapers', elux: 'Luxembourg newspapers' };
const rank = { high: 0, medium: 1, low: 2 };
T.harajuku = { id: 'harajuku', n: 'Harajuku street style', c: 'subculture', d: 'More layers, more colour, more everything, from one Tokyo district.', ps: {}, g: [], de: {}, o: [], y: null };
for (const r of pilot) {
  if (r.method === 'ngram' || !r.origin_place || !PMAP[r.term]) continue;
  const t = T[PMAP[r.term]], p = PLACE[r.place];
  if (!t.o.length) { t.o = [PLACE[r.origin_place]]; t.y = r.origin_year; t.q = r.origin_sentence.slice(0, 220); t.u = r.origin_source; }
  if (t.o.includes(p) || r.arrival_year < t.y) continue;
  if (CORE.has(p) && t.ps[p]) continue;
  let ev;
  if (r.method.startsWith('newspapers:')) {
    const c = Object.fromEntries(/by year: ([^.]*)/.exec(r.source_sentence)[1].split(',').map((s) => s.trim().split(': ').map(Number)));
    const prev = c[r.arrival_year - 1];
    ev = ARCHIVE[r.method.split(':')[1]] + ': ' + (prev === undefined ? '' : prev.toLocaleString('en-GB') + ' mentions in ' + (r.arrival_year - 1) + ', ') + c[r.arrival_year].toLocaleString('en-GB') + ' in ' + r.arrival_year + '.';
  } else {
    ev = (r.source_sentence_en || r.source_sentence).trim();
    if (ev.length > 220) ev = ev.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    ev = 'Wikipedia: “' + ev + '”';
  }
  const a = { y: r.arrival_year, c: r.confidence, ev, url: r.source, dec: r.year_precision === 'decade' ? 1 : 0 };
  const had = t.de[p];
  if (!had || (had.c && (rank[a.c] < rank[had.c] || (rank[a.c] === rank[had.c] && a.y < had.y)))) t.de[p] = a;
}
const list = Object.values(T).filter((t) => t.o.length);
const ex = {};
for (const t of ben.trends) if (t.examples.length && T[t.id].o.length) ex[t.id] = [...t.examples].sort((a, b) => a.year - b.year)[0];

// 2. One V&A photo per trend, shrunk to 220px and embedded, because the
// artifact page cannot load images from other sites.
const thumbs = {};
for (const [id, e] of Object.entries(ex)) {
  const f = `${RAW}/vam/${id}.jpg`;
  if (!existsSync(f)) {
    const r = await fetch(e.image.replace('/full/!800,/', '/full/!220,/'), { headers: { 'User-Agent': 'fashion-trends-research-script/0.1' } });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/jpeg')) { console.warn('no photo for', id, r.status); continue; }
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await new Promise((s) => setTimeout(s, 250));
  }
  const b = readFileSync(f);
  if (b.length > 40000 || b[0] !== 0xff || b[1] !== 0xd8) { console.warn('bad photo for', id); continue; }
  thumbs[id] = { s: 'data:image/jpeg;base64,' + b.toString('base64'), t: e.title, y: e.year, u: e.url, by: e.designer };
}

// 3. The page: shell + script, with the coastlines, trends and photos inlined.
const inline = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
let page = readFileSync(`${HERE}/page.html`, 'utf8') + readFileSync(`${HERE}/page.js`, 'utf8');
for (const [k, v] of [['LAND', JSON.parse(readFileSync(`${HERE}/land-110m.json`, 'utf8'))], ['DATA', list], ['THUMBS', thumbs]]) {
  if (!page.includes(`/*${k}*/null`)) throw new Error(`placeholder ${k} missing`);
  page = page.replace(`/*${k}*/null`, () => inline(v));
}
writeFileSync(`${RAW}/trend-atlas.html`, page);

// Coverage, so the page's claims can be checked against the data.
const total = ben.trends.length;
const pct = (n) => `${n} (${Math.round((n / total) * 100)}%)`;
const solid = (t) => Object.values(t.de).filter((d) => !d.late && d.c !== 'low').length;
console.log(`Dataset trends:                 ${total}`);
console.log(`With a birthplace (on globe):   ${pct(list.filter((t) => ben.trends.some((b) => b.id === t.id)).length)}`);
console.log(`  ...and at least one journey:  ${pct(list.filter((t) => Object.keys(t.de).length).length)}`);
console.log(`  ...and a well dated journey:  ${pct(list.filter((t) => solid(t) >= 1).length)}`);
console.log(`  ...and three or more of them: ${pct(list.filter((t) => solid(t) >= 3).length)}`);
console.log(`No named country at all:        ${pct(ben.trends.filter((b) => b.periods.every((p) => p.region === 'global')).length)}`);
console.log(`Photos embedded:                ${Object.keys(thumbs).length}`);
console.log(`Wrote ${RAW}/trend-atlas.html (${(page.length / 1024).toFixed(0)} KB)`);
