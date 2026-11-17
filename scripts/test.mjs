// Content, privacy and accessibility checks. Run after a build: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const all = readJson('projects.json');
const projects = all.filter(p => p.published === true);
const unpublished = all.filter(p => p.published !== true);
const site = readJson('site.json');
const caseStudies = readdirSync('case-studies').filter(f => f.endsWith('.json')).map(f => readJson(`case-studies/${f}`));
const pages = ['docs/index.html', ...projects.map(p => `docs/${p.id}.html`)];
const html = Object.fromEntries(pages.map(page => [page, existsSync(page) ? readFileSync(page, 'utf8') : '']));

// Repositories confirmed public. Add one here only after it is actually public on GitHub
// (npm run check:links verifies this list against GitHub itself).
export const PUBLIC_SOURCES = ['https://github.com/TheJ1u/ai-for-life', 'https://github.com/TheJ1u/text-from-sheet'];

test('Every published project explains itself: why, role, lessons, limits, numbers and screenshots', () => {
  assert.equal(new Set(all.map(p => p.id)).size, all.length, 'duplicate project id');
  for (const p of projects) {
    for (const key of ['id', 'title', 'short', 'kind', 'status', 'summary', 'role', 'why', 'approach', 'demonstrates', 'limit']) assert.ok(p[key]?.trim(), `${p.id}: ${key}`);
    assert.match(p.id, /^[a-z0-9-]+$/, `${p.id}: id must be lowercase letters, digits and dashes`);
    assert.ok(p.learned?.length >= 2, `${p.id}: needs at least two lessons`);
    assert.ok(p.skills?.length, `${p.id}: skills`);
    assert.ok(p.metrics?.length >= 1 && p.metrics.every(m => m.value?.trim() && m.label?.trim()), `${p.id}: metrics need a value and a label`);
    assert.ok(p.slides?.length >= 2, `${p.id}: needs a slideshow (2+ slides)`);
    p.slides.forEach((s, k) => {
      assert.ok(s.alt?.trim().length > 20 && s.caption?.trim(), `${p.id} slide ${k + 1}: alt text and caption`);
      for (const f of [`assets/shots/${p.id}-${k + 1}.webp`, `assets/shots/${p.id}-${k + 1}-800.webp`, `assets/shots/${p.id}-${k + 1}-2560.webp`]) assert.ok(existsSync(f), `missing ${f}`);
    });
  }
});

test('Approval gate: nothing unpublished reaches the built site', () => {
  for (const p of unpublished) {
    assert.ok(!existsSync(`docs/${p.id}.html`), `${p.id} is not published but has a page`);
    for (const page of pages) assert.ok(!html[page].includes(`${p.id}.html`) && !html[page].includes(`shots/${p.id}-`), `${page} mentions unpublished project ${p.id}`);
    assert.ok(!readdirSync('docs/assets/shots').some(f => f.startsWith(`${p.id}-`)), `${p.id}: screenshots were copied to docs/`);
  }
  for (const c of caseStudies) assert.ok(projects.some(p => p.id === c.id), `case study ${c.id} has no published project`);
});

test('Privacy: links never send visitors to a private repository', () => {
  for (const p of projects) {
    if (p.source && p.sourceIsPublic !== false) assert.ok(PUBLIC_SOURCES.includes(p.source), `${p.id}: ${p.source} is not confirmed public`);
    if (p.url) assert.equal(new URL(p.url).protocol, 'https:');
  }
  // Any GitHub repository link in the built pages must be on the confirmed-public list (or be this site's own source).
  const allowed = new Set([...PUBLIC_SOURCES, 'https://github.com/TheJ1u/portfolio', site.github]);
  for (const page of pages) for (const [, url] of html[page].matchAll(/href="(https:\/\/github\.com\/[^"]*)"/g)) assert.ok(allowed.has(url.replace(/\/$/, '')), `${page}: links to ${url}, which is not confirmed public`);
});

test('Privacy: no secrets or private-work details in anything that gets published', () => {
  const published = [...pages.map(page => html[page]), readFileSync('docs/app.js', 'utf8'), readFileSync('docs/style.css', 'utf8')].join('\n');
  for (const pattern of [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9-]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,}/i]) assert.doesNotMatch(published, pattern);
  assert.ok(readFileSync('.gitignore', 'utf8').split(/\r?\n/).includes('.private/'), '.private/ must stay ignored: this repository is public');
});

test('Skills are backed by evidence: every skill cites a published project', () => {
  for (const cat of site.skills) for (const item of cat.items) {
    assert.ok(item.evidence?.length, `${item.name}: needs at least one project as evidence`);
    for (const id of item.evidence) assert.ok(projects.some(p => p.id === id), `${item.name}: cites unknown or unpublished project ${id}`);
  }
  const demonstrated = new Set(site.skills.flatMap(c => c.items.map(i => i.name.toLowerCase())));
  for (const s of site.learning) assert.ok(!demonstrated.has(s.toLowerCase()), `"${s}" is listed as both demonstrated and still learning`);
  assert.doesNotMatch(html['docs/index.html'], /skill-bar|<progress|<meter/i, 'no percentage skill bars');
});

test('jenkinsir.com is described as an educational website, never a business', () => {
  // The site has no LLC or DBA, so it must never be called a practice, agency or company.
  const text = JSON.stringify([all.find(p => p.id === 'jenkinsir'), caseStudies.find(c => c.id === 'jenkinsir')]);
  assert.doesNotMatch(text, /\b(practice|agency|company|firm)\b/i);
});

test('Built pages: every project, valid anchors, real assets, no leftover placeholders', () => {
  for (const p of projects) assert.ok(html['docs/index.html'].includes(`id="${p.id}"`) && html['docs/index.html'].includes(`href="${p.id}.html"`), `${p.id} missing from the home page`);
  for (const page of pages) {
    const doc = html[page];
    assert.ok(doc, `${page} was not built`);
    const ids = [...doc.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `${page}: duplicate ids`);
    for (const [, id] of doc.matchAll(/href="(?:\.\/)?#([^"]+)"/g)) {
      const target = doc.includes('class="case"') && !ids.includes(id) ? html['docs/index.html'] : doc;
      assert.ok(target.includes(`id="${id}"`), `${page}: missing anchor ${id}`);
    }
    for (const [, path] of doc.matchAll(/(?:href|src)="([^"#:?]+\.(?:css|js|svg|png|webp|woff2|pdf|html))(?:\?v=[0-9a-f]+)?"/g)) assert.ok(existsSync(`docs/${path}`), `${page}: missing ${path}`);
    for (const [, set] of doc.matchAll(/srcset="([^"]+)"/g)) for (const part of set.split(',')) assert.ok(existsSync(`docs/${part.trim().split(' ')[0]}`), `${page}: missing ${part}`);
    assert.ok(!/<!-- [A-Z_]+ -->|%[A-Z_]+%/.test(doc), `${page}: unreplaced placeholder`);
    assert.ok(!/\[[A-Z][^\]\n]{2,40}\]/.test(doc.replace(/<script[\s\S]*?<\/script>/g, '')), `${page}: bracketed placeholder text left in the page`);
  }
  assert.ok(existsSync('docs/sitemap.xml') && existsSync('docs/robots.txt') && existsSync('docs/404.html'));
  const sitemap = readFileSync('docs/sitemap.xml', 'utf8');
  for (const p of projects) assert.ok(sitemap.includes(`/${p.id}.html`), `${p.id} missing from sitemap`);
});

test('Accessibility basics on every built page', () => {
  for (const page of pages) {
    const doc = html[page];
    assert.match(doc, /<html lang="en">/, `${page}: lang`);
    assert.equal([...doc.matchAll(/<h1[\s>]/g)].length, 1, `${page}: exactly one h1`);
    assert.match(doc, /<a class="skip" href="#main">/, `${page}: skip link`);
    assert.match(doc, /<main id="main">/, `${page}: main landmark`);
    assert.match(doc, /<title>[^<]{10,}<\/title>/, `${page}: title`);
    assert.match(doc, /<meta name="description" content="[^"]{50,}">/, `${page}: description`);
    for (const [, img] of doc.matchAll(/<img([^>]+)>/g)) {
      assert.match(img, /alt="[^"]{20,}"/, `${page}: image without useful alt text`);
      assert.match(img, /width="\d+" height="\d+"/, `${page}: image without dimensions (causes layout shift)`);
    }
    // Headings never skip a level (h2 -> h4), which screen-reader users rely on to navigate.
    const levels = [...doc.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
    levels.forEach((level, i) => { if (i) assert.ok(level - levels[i - 1] <= 1, `${page}: heading jumps from h${levels[i - 1]} to h${level}`); });
    for (const [, attrs, body] of doc.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) assert.ok(/aria-label="[^"]+"/.test(attrs) || body.replace(/<svg[\s\S]*?<\/svg>|<[^>]+>/g, '').trim(), `${page}: button without a name`);
    for (const [, data] of doc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(data), `${page}: structured data is not valid JSON`);
  }
});

test('Motion is optional: reduced-motion and no-JavaScript visitors get the full page', () => {
  const css = readFileSync('style.css', 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  // Scroll reveal must be pure CSS tied to scroll position, inside a feature check, and never depend on JavaScript.
  assert.ok(css.includes('@supports (animation-timeline: view())'), 'reveal must sit behind a feature check');
  assert.ok(!/\.js [^{]*\[data-reveal\]/.test(css), 'reveal must not depend on JavaScript');
  assert.ok(!readFileSync('app.js', 'utf8').includes('data-reveal'), 'app.js must not control reveal');
});
