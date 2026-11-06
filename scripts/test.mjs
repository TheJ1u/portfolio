import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const projects = JSON.parse(readFileSync('projects.json', 'utf8'));
const caseStudies = readdirSync('case-studies').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`case-studies/${f}`, 'utf8')));

// Repositories confirmed public. Add one here only after it is actually public on GitHub,
// and set "sourceIsPublic" to true (or remove it) in projects.json.
const PUBLIC_SOURCES = ['https://github.com/TheJ1u/ai-for-life', 'https://github.com/TheJ1u/text-from-sheet'];

test('Every project explains itself: why, what I learned, my role, limits and screenshots', () => {
  assert.equal(new Set(projects.map(p => p.id)).size, projects.length);
  for (const p of projects) {
    for (const key of ['id', 'title', 'kind', 'status', 'summary', 'role', 'why', 'approach', 'demonstrates', 'limit']) assert.ok(p[key]?.trim(), `${p.id}: ${key}`);
    assert.ok(p.learned?.length >= 2, `${p.id}: needs at least two lessons`);
    assert.ok(p.skills.length, `${p.id}: skills`);
    assert.ok(p.slides?.length >= 2, `${p.id}: needs a slideshow (2+ slides)`);
    p.slides.forEach((s, k) => {
      assert.ok(s.alt?.trim().length > 20 && s.caption?.trim(), `${p.id} slide ${k + 1}: alt text and caption`);
      for (const f of [`assets/shots/${p.id}-${k + 1}.webp`, `assets/shots/${p.id}-${k + 1}-800.webp`]) assert.ok(existsSync(f), `missing ${f}`);
    });
  }
});

test('Links never send visitors to a private repository or a dead page', () => {
  for (const p of projects) {
    if (p.source && p.sourceIsPublic !== false) assert.ok(PUBLIC_SOURCES.includes(p.source), `${p.id}: ${p.source} is not confirmed public`);
    if (p.url) assert.equal(new URL(p.url).protocol, 'https:');
    if (p.caseStudy) assert.ok(caseStudies.some(c => c.file === p.caseStudy), `${p.id}: case study ${p.caseStudy} has no content file`);
  }
});

test('jenkinsir.com is described as an educational website, never a business', () => {
  // The site has no LLC or DBA, so it must never be called a practice, agency or company.
  const text = JSON.stringify([projects.find(p => p.id === 'jenkinsir'), caseStudies.find(c => c.id === 'jenkinsir')]);
  assert.doesNotMatch(text, /\b(practice|agency|company|firm)\b/i);
});

test('Built pages have every project, valid anchors, real assets and no leftover placeholders', () => {
  const pages = ['docs/index.html', ...caseStudies.map(c => `docs/${c.file}`)];
  const index = readFileSync('docs/index.html', 'utf8');
  for (const p of projects) assert.ok(index.includes(`id="${p.id}"`), `${p.id} missing from index`);
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `${page}: duplicate ids`);
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `${page}: missing anchor ${id}`);
    for (const [, path] of html.matchAll(/(?:href|src)="([^"#:?]+\.(?:css|js|svg|png|webp|woff2|pdf|html))(?:\?v=[0-9a-f]+)?"/g)) assert.ok(existsSync(`docs/${path}`), `${page}: missing ${path}`);
    for (const [, set] of html.matchAll(/srcset="([^"]+)"/g)) for (const part of set.split(',')) assert.ok(existsSync(`docs/${part.trim().split(' ')[0]}`), `${page}: missing ${part}`);
    for (const [, img] of html.matchAll(/<img([^>]+)>/g)) assert.match(img, /alt="[^"]{20,}"/, `${page}: image without useful alt text`);
    assert.ok(!/<!-- [A-Z_]+ -->|%[A-Z_]+%/.test(html), `${page}: unreplaced placeholder`);
  }
  assert.ok(existsSync('docs/sitemap.xml') && existsSync('docs/robots.txt'));
});
