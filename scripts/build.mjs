import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';

// The published address. Change it here if the site moves to a custom domain.
const SITE = 'https://thej1u.github.io/portfolio';

const projects = JSON.parse(readFileSync('projects.json', 'utf8'));
const caseStudies = readdirSync('case-studies').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`case-studies/${f}`, 'utf8')));
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ver = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);

// Screenshots: each project's slides are assets/shots/<id>-<n>.webp (1600 px) plus <id>-<n>-800.webp.
function slideFiles(p, n) {
  const big = `assets/shots/${p.id}-${n}.webp`;
  const small = `assets/shots/${p.id}-${n}-800.webp`;
  for (const f of [big, small]) if (!existsSync(f)) throw new Error(`${p.id}: missing ${f}`);
  return { big, small };
}

// A slideshow is a horizontal strip that scroll-snaps (works without JavaScript, swipes on phones).
// app.js adds previous/next buttons and a counter.
function slideshow(p, { eager = false, sizes = '(min-width: 900px) 62vw, 100vw' } = {}) {
  const n = p.slides.length;
  const figures = p.slides.map((s, k) => {
    const { big, small } = slideFiles(p, k + 1);
    return `<div class="slide" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${n}"><figure><div class="frame"><a href="${big}"><img src="${big}" srcset="${small} 800w, ${big} 1600w" sizes="${sizes}" width="1600" height="1000" alt="${esc(s.alt)}" loading="${eager && k === 0 ? 'eager' : 'lazy'}" decoding="async"><span class="sr-only"> (open full size)</span></a></div><figcaption>${esc(s.caption)}</figcaption></figure></div>`;
  }).join('');
  const controls = n > 1 ? `<div class="slide-controls" hidden><button type="button" class="slide-prev" aria-label="Previous screenshot">&larr;</button><span class="slide-count">1 / ${n}</span><button type="button" class="slide-next" aria-label="Next screenshot">&rarr;</button></div>` : '';
  return `<div class="slideshow"><div class="slides" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(p.title)} screenshots, ${n} slides">${figures}</div>${controls}</div>`;
}

function links(p) {
  const out = [];
  if (p.caseStudy) out.push(`<a class="button small" href="${esc(p.caseStudy)}">Read the case study</a>`);
  if (p.url) out.push(`<a class="${out.length ? 'text-link' : 'button small'}" href="${esc(p.url)}">Visit site</a>`);
  if (p.source && p.sourceIsPublic !== false) out.push(`<a class="${out.length ? 'text-link' : 'button small'}" href="${esc(p.source)}">View source</a>`);
  if (p.source && p.sourceIsPublic === false) out.push(`<span class="note">Source code is private for now.</span>`);
  return out.length ? `<p class="links">${out.join('')}</p>` : '';
}

const items = projects.map((p, i) => `<li class="item" id="${esc(p.id)}">
<button type="button" class="row" aria-controls="panel-${esc(p.id)}" aria-expanded="false"><span class="row-title">${esc(p.title)}</span><span class="row-meta">${esc(p.kind)}</span><span class="row-status">${esc(p.status)}</span></button>
<div class="panel" id="panel-${esc(p.id)}">
${slideshow(p, { eager: i === 0 })}
<h3>${esc(p.title)}</h3>
<p class="summary">${esc(p.summary)}</p>
<p class="role"><strong>My role.</strong> ${esc(p.role)}</p>
<div class="story">
<section class="why"><h4>Why I built it</h4><p>${esc(p.why)}</p></section>
<section class="learned"><h4>What I learned</h4><ul>${p.learned.map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>
</div>
<section class="facet" data-facet="How it works"><h4>How it works</h4><p>${esc(p.approach)}</p></section>
<section class="facet" data-facet="What it shows"><h4>What it shows</h4><p>${esc(p.demonstrates)}</p></section>
<section class="facet" data-facet="Limits"><h4>Limits</h4><p>${esc(p.limit)}</p></section>
<ul class="tags" aria-label="Skills used">${p.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
${links(p)}
</div></li>`).join('\n');

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Jordan Jenkins',
  url: `${SITE}/`,
  email: 'mailto:jordypauly01@gmail.com',
  description: 'Information Systems student (Applied AI emphasis) at Utah Valley University and licensed insurance agent in Utah and Wyoming.',
  affiliation: { '@type': 'CollegeOrUniversity', name: 'Utah Valley University' },
  address: { '@type': 'PostalAddress', addressLocality: 'Provo', addressRegion: 'UT', addressCountry: 'US' },
  knowsLanguage: ['en', 'es'],
  knowsAbout: ['Information systems', 'Applied AI', 'AWS', 'Python', 'SQL', 'React', 'TypeScript', 'Web accessibility', 'Insurance'],
  sameAs: ['https://github.com/TheJ1u', 'https://www.linkedin.com/in/jordan-jenkinscrsg/'],
};

const stamp = html => html
  .replace('href="style.css"', `href="style.css?v=${ver('style.css')}"`)
  .replace('src="app.js"', `src="app.js?v=${ver('app.js')}"`)
  .replaceAll('%SITE%', SITE);

const index = stamp(readFileSync('template.html', 'utf8'))
  .replace('%PERSON_JSONLD%', JSON.stringify(person).replace(/</g, '\\u003c'))
  .replace('<!-- PROJECTS -->', items)
  .replace('<!-- COUNT_WORD -->', words[projects.length] || String(projects.length));

// Case study pages.
const caseTemplate = readFileSync('case-study.html', 'utf8');
function caseStudyPage(c) {
  const p = projects.find(x => x.id === c.id);
  if (!p) throw new Error(`case study ${c.id} has no project`);
  const lane = l => `<div class="lane"><h3>${esc(l.title)}</h3><ol class="${l.flow ? 'flow' : ''}">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
  const cards = list => list.map(d => `<article class="card"><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p></article>`).join('');
  const body = `
<section aria-labelledby="problem"><h2 id="problem">The problem</h2>${c.problem.map(t => `<p>${esc(t)}</p>`).join('')}</section>
<section aria-labelledby="role"><h2 id="role">My role</h2><p>${esc(c.role)}</p></section>
<section class="split" aria-label="Why I built it and what I learned"><div><h2>Why I built it</h2><p>${esc(p.why)}</p></div><div><h2>What I learned</h2><ul>${p.learned.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div></section>
<section aria-labelledby="how"><h2 id="how">How it works</h2><div class="lanes">${c.lanes.map(lane).join('')}</div></section>
<section aria-labelledby="decisions"><h2 id="decisions">Key decisions</h2><div class="cards">${cards(c.decisions)}</div></section>
<section aria-labelledby="mistakes"><h2 id="mistakes">What went wrong, and what I changed</h2><div class="cards">${cards(c.mistakes)}</div></section>
<section aria-labelledby="stack"><h2 id="stack">Skills used</h2><ul class="tags">${p.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>`;
  return stamp(caseTemplate)
    .replaceAll('%TITLE%', esc(c.title))
    .replaceAll('%SUBTITLE%', esc(c.subtitle))
    .replaceAll('%DESCRIPTION%', esc(c.description))
    .replaceAll('%FILE%', esc(c.file))
    .replaceAll('%ID%', esc(c.id))
    .replace('%FACTS%', c.facts.map(f => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join(''))
    .replace('%LINKS%', p.url ? `<a class="button" href="${esc(p.url)}">Visit ${esc(c.title)}</a><a class="text-link" href="./#contact">Ask me about it</a>` : '')
    .replace('%SLIDES%', slideshow(p, { eager: true, sizes: '(min-width: 1240px) 1240px, 100vw' }))
    .replace('%METRICS%', c.metrics.map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join(''))
    .replace('%BODY%', body)
    .replace('%CLOSING%', esc(c.closing));
}

// Write the published site into docs/ (GitHub Pages serves main /docs).
rmSync('docs', { recursive: true, force: true });
mkdirSync('docs/assets/shots', { recursive: true });
mkdirSync('docs/assets/fonts', { recursive: true });
writeFileSync('docs/index.html', index);
for (const c of caseStudies) writeFileSync(`docs/${c.file}`, caseStudyPage(c));
for (const file of ['style.css', 'app.js']) copyFileSync(file, `docs/${file}`);
for (const f of readdirSync('assets/shots')) copyFileSync(`assets/shots/${f}`, `docs/assets/shots/${f}`);
for (const f of readdirSync('assets/fonts')) copyFileSync(`assets/fonts/${f}`, `docs/assets/fonts/${f}`);
for (const f of ['favicon.svg', 'og-image.png', 'Jordan_Jenkins_Resume.pdf']) copyFileSync(`assets/${f}`, `docs/assets/${f}`);
writeFileSync('docs/.nojekyll', '');
writeFileSync('docs/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync('docs/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[`${SITE}/`, ...caseStudies.map(c => `${SITE}/${c.file}`)].map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('docs/404.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — Jordan Jenkins</title><link rel="stylesheet" href="/portfolio/style.css"><main class="wrap hero" style="min-height:70vh"><h1><span class="line">Page not found.</span></h1><p class="lede">That address doesn’t lead anywhere. The projects are on the home page.</p><p class="hero-actions"><a class="button" href="/portfolio/">Go to the portfolio</a></p></main></html>`);
const slides = projects.reduce((n, p) => n + p.slides.length, 0);
console.log(`Built portfolio: ${projects.length} projects, ${slides} slides, ${caseStudies.length} case study page(s).`);
