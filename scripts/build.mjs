// Renders the published site into docs/ from projects.json, site.json, case-studies/*.json and the two templates.
// No dependencies. Usage: npm run build
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';

// The published address. Change it here if the site moves to a custom domain.
const SITE = 'https://thej1u.github.io/portfolio';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const site = readJson('site.json');
// Approval gate: only projects marked "published": true are rendered. Everything else stays off the site.
const projects = readJson('projects.json').filter(p => p.published === true);
const extras = new Map(readdirSync('case-studies').filter(f => f.endsWith('.json')).map(f => { const c = readJson(`case-studies/${f}`); return [c.id, c]; }));
for (const id of extras.keys()) if (!projects.some(p => p.id === id)) throw new Error(`case study ${id} has no published project`);

const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
// Line endings are normalised so the version hash is the same on Windows, macOS and Linux.
const ver = file => createHash('sha1').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
const jsonLd = data => JSON.stringify(data).replace(/</g, '\\u003c');
const page = p => `${p.id}.html`;
const byId = id => projects.find(p => p.id === id);
const sourceIsPublic = p => Boolean(p.source) && p.sourceIsPublic !== false;

/* ---------- Shared pieces ---------- */

// Screenshots: assets/shots/<id>-<n>.webp (1600 px), <id>-<n>-800.webp and <id>-<n>-2560.webp.
function shot(p, n) {
  const files = { small: `assets/shots/${p.id}-${n}-800.webp`, big: `assets/shots/${p.id}-${n}.webp`, full: `assets/shots/${p.id}-${n}-2560.webp` };
  for (const f of Object.values(files)) if (!existsSync(f)) throw new Error(`${p.id}: missing ${f}`);
  return files;
}

function image(p, n, { sizes, eager = false, attrs = '' } = {}) {
  const { small, big } = shot(p, n);
  return `<img src="${small}" srcset="${small} 800w, ${big} 1600w" sizes="${sizes}" width="1600" height="1000" alt="${esc(p.slides[n - 1].alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${attrs}>`;
}

function head() {
  return `  <meta name="theme-color" content="#090b10">
  <script>(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';d.dataset.theme=t;d.classList.add('js')})()</script>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="assets/fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="style.css?v=${ver('style.css')}"><script src="app.js?v=${ver('app.js')}" defer></script>`;
}

function header(home) {
  const base = home ? '' : './';
  return `<a class="skip" href="#main">Skip to content</a>
<header class="bar"><div class="wrap bar-inner">
  <a class="wordmark" href="${home ? '#top' : './'}"><span class="mark" aria-hidden="true">JJ</span><span>Jordan Jenkins</span></a>
  <nav aria-label="Main"><a href="${base}#work">Work</a><a class="nav-extra" href="${base}#approach">Approach</a><a class="nav-extra" href="${base}#skills">Skills</a><a href="${base}#about">About</a><a href="${base}#contact">Contact</a></nav>
  <button type="button" id="theme-toggle" class="theme" hidden><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path class="sun" d="M12 4V2m0 20v-2M4 12H2m20 0h-2M6.3 6.3 4.9 4.9m14.2 14.2-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path class="moon" d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/></svg><span class="sr-only">Switch theme</span></button>
</div></header>`;
}

function footer(home) {
  return `<footer class="foot"><div class="wrap foot-inner">
  <p><a class="wordmark" href="${home ? '#top' : './'}"><span class="mark" aria-hidden="true">JJ</span><span>Jordan Jenkins</span></a></p>
  <p>Plain HTML, CSS and JavaScript. No framework, no trackers. <a class="text-link" href="https://github.com/TheJ1u/portfolio">Source on GitHub</a></p>
</div></footer>`;
}

function status(p) {
  const live = /^live\b/i.test(p.status);
  return `<span class="status${live ? ' live' : ''}"><span class="dot" aria-hidden="true"></span>${esc(p.status)}</span>`;
}

const tags = (list, label = 'Skills used') => `<ul class="tags" aria-label="${label}">${list.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
const metricList = (p, cls) => `<dl class="${cls}">${p.metrics.map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>`;

/* ---------- Home page ---------- */

// Hero: a stack of real screenshots. Pure CSS 3D; app.js adds the pointer tilt and the project switcher.
function deck() {
  const cards = projects.map((p, i) => `<li class="deck-card" style="--p:${i}"><a href="${page(p)}">${image(p, 1, { sizes: '(min-width: 1100px) 520px, 88vw', eager: i === 0 })}<span class="deck-label"><strong>${esc(p.short || p.title)}</strong><span>${esc(p.kind)}</span></span></a></li>`).join('');
  const buttons = projects.map((p, i) => `<button type="button" aria-pressed="${i === 0}" data-card="${i}">${esc(p.short || p.title)}</button>`).join('');
  return `<div class="deck" data-deck>
        <ul class="deck-cards">${cards}</ul>
        <div class="deck-nav" role="group" aria-label="Preview a project" hidden>${buttons}</div>
      </div>`;
}

function proof() {
  return `<ul class="proof" aria-label="Project highlights">${projects.map(p => `<li><a href="${page(p)}"><strong>${esc(p.metrics[0].value)}</strong><span>${esc(p.metrics[0].label)}</span><em>${esc(p.short || p.title)}</em></a></li>`).join('')}</ul>`;
}

function projectCard(p, i) {
  const links = [`<a class="text-link" href="${page(p)}" >Read the case study<span class="sr-only">: ${esc(p.title)}</span> <span aria-hidden="true">→</span></a>`];
  if (p.url) links.push(`<a class="quiet-link" href="${esc(p.url)}">Live site <span aria-hidden="true">↗</span></a>`);
  if (sourceIsPublic(p)) links.push(`<a class="quiet-link" href="${esc(p.source)}">Source <span aria-hidden="true">↗</span></a>`);
  return `<article class="project${p.featured ? ' featured' : ''}" id="${esc(p.id)}" data-reveal>
<div class="project-shot">${image(p, 1, { sizes: p.featured ? '(min-width: 900px) 640px, 100vw' : '(min-width: 900px) 380px, 100vw', attrs: ` style="view-transition-name:shot-${esc(p.id)}"` })}</div>
<div class="project-body">
<p class="project-meta"><span class="num">${String(i + 1).padStart(2, '0')}</span><span>${esc(p.kind)}</span></p>
<h3><a class="stretch" href="${page(p)}">${esc(p.title)}</a></h3>
<p class="project-status">${status(p)}</p>
<p class="project-summary">${esc(p.summary)}</p>
${metricList(p, 'project-metrics')}
${tags(p.skills.slice(0, 5), `${esc(p.title)} skills`)}
<p class="links">${links.join('')}</p>
</div></article>`;
}

function skills() {
  return site.skills.map(cat => `<section class="skill-cat"><h3>${esc(cat.category)}</h3><ul>${cat.items.map(item => {
    const evidence = item.evidence.map(id => { const p = byId(id); if (!p) throw new Error(`skill "${item.name}" cites unknown or unpublished project ${id}`); return `<a href="${page(p)}">${esc(p.short || p.title)}</a>`; }).join(', ');
    return `<li><span class="skill-name">${esc(item.name)}</span><span class="skill-ev">${evidence}</span></li>`;
  }).join('')}</ul></section>`).join('');
}

const experience = () => site.experience.map(job => `<li><p class="when">${esc(job.dates)}</p><h4>${esc(job.role)}</h4><p class="org">${esc(job.org)}</p><p>${esc(job.body)}</p></li>`).join('');

function education() {
  const e = site.education;
  return `<div class="edu"><p class="when">${esc(e.dates)}</p><h4>${esc(e.degree)}</h4><p class="org">${esc(e.school)}</p><p>${esc(e.detail)}</p></div>
        <div class="edu"><h4>Anthropic courses, completed</h4>${tags(site.training.completed, 'Completed courses')}</div>
        <div class="edu"><h4>Other training</h4>${tags(site.training.other, 'Other training')}</div>`;
}

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: site.name,
  url: `${SITE}/`,
  email: `mailto:${site.email}`,
  description: 'Information Systems student (Applied AI emphasis) at Utah Valley University and licensed insurance agent in Utah and Wyoming.',
  affiliation: { '@type': 'CollegeOrUniversity', name: 'Utah Valley University' },
  address: { '@type': 'PostalAddress', addressLocality: 'Provo', addressRegion: 'UT', addressCountry: 'US' },
  knowsLanguage: ['en', 'es'],
  knowsAbout: ['Information systems', 'Applied AI', 'AWS', 'Python', 'SQL', 'React', 'TypeScript', 'Web accessibility', 'Insurance'],
  sameAs: [site.github, site.linkedin],
};

function fill(template, values) {
  let html = template;
  for (const [key, value] of Object.entries(values)) html = html.replaceAll(`%${key}%`, () => value);
  return html;
}

const common = { SITE, EMAIL: esc(site.email), RESUME: esc(site.resume), LINKEDIN: esc(site.linkedin), GITHUB: esc(site.github), LOCATION: esc(site.location), HEAD: head() };

const index = fill(readFileSync('template.html', 'utf8'), {
  ...common,
  JSONLD: jsonLd(person),
  HEADER: header(true),
  FOOTER: footer(true),
  DECK: deck(),
  PROOF: proof(),
  COUNT_WORD: words[projects.length] || String(projects.length),
  PROJECTS: projects.map(projectCard).join('\n'),
  APPROACH: site.approach.map((s, i) => `<li><span class="step-n" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join(''),
  SKILLS: skills(),
  LEARNING: site.learning.map(s => `<li>${esc(s)}</li>`).join(''),
  BUSINESS: site.business.map(s => `<li>${esc(s)}</li>`).join(''),
  EXPERIENCE: experience(),
  EDUCATION: education(),
});

/* ---------- Case study pages (one per published project) ---------- */

// A slideshow is a horizontal strip that scroll-snaps (works without JavaScript, swipes on phones).
// app.js adds previous/next buttons, a counter and the full-screen viewer.
function slideshow(p) {
  const n = p.slides.length;
  const figures = p.slides.map((s, k) => {
    const { big, small, full } = shot(p, k + 1);
    const first = k === 0;
    return `<div class="slide" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${n}"><figure><div class="frame"${first ? ` style="view-transition-name:shot-${esc(p.id)}"` : ''}><a href="${full}" data-big="${big}" class="zoom"><img src="${big}" srcset="${small} 800w, ${big} 1600w" sizes="(min-width: 1240px) 1160px, 100vw" width="1600" height="1000" alt="${esc(s.alt)}" ${first ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="sr-only"> (open larger view)</span></a></div><figcaption>${esc(s.caption)}</figcaption></figure></div>`;
  }).join('');
  const controls = n > 1 ? `<div class="slide-controls" hidden><button type="button" class="slide-prev" aria-label="Previous screenshot">&larr;</button><span class="slide-count">1 / ${n}</span><button type="button" class="slide-next" aria-label="Next screenshot">&rarr;</button></div>` : '';
  return `<div class="slideshow"><div class="slides" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(p.title)} screenshots, ${n} slides">${figures}</div>${controls}</div>`;
}

const clip = (text, max = 155) => text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max - 1))}…`;

function casePage(p, i) {
  const c = extras.get(p.id) || {};
  const paragraphs = list => list.map(t => `<p>${esc(t)}</p>`).join('');
  const cards = list => `<div class="cards">${list.map(d => `<article class="card"><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p></article>`).join('')}</div>`;
  const lane = l => `<div class="lane"><h3>${esc(l.title)}</h3><ol class="${l.flow ? 'flow' : ''}">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
  const how = `<p>${esc(p.approach)}</p>${c.lanes ? `<div class="lanes">${c.lanes.map(lane).join('')}</div>` : ''}${p.flow ? `<ol class="pipeline" aria-label="How data moves through ${esc(p.title)}">${p.flow.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}`;
  const sections = [
    ['problem', 'The problem', paragraphs(c.problem || [p.why])],
    ['role', 'My role', `<p>${esc(c.role || p.role)}</p>`],
    ['how', 'How it works', how],
    c.decisions && ['decisions', 'Key decisions', cards(c.decisions)],
    ['learned', 'What I learned', `<ul class="lessons">${p.learned.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`],
    c.mistakes && ['mistakes', 'What went wrong, and what I changed', cards(c.mistakes)],
    ['shows', 'What it shows', `<p>${esc(p.demonstrates)}</p>`],
    ['limits', p.next ? 'Limits, and what I’d do next' : 'Limits', `<p>${esc(p.limit)}</p>${p.next ? `<p class="next-step"><strong>Next.</strong> ${esc(p.next)}</p>` : ''}`],
    ['stack', 'Skills used', tags(p.skills)],
  ].filter(Boolean);

  const links = [];
  if (p.url) links.push(`<a class="button" href="${esc(p.url)}">Visit the live site <span aria-hidden="true">↗</span></a>`);
  if (sourceIsPublic(p)) links.push(`<a class="button${links.length ? ' ghost' : ''}" href="${esc(p.source)}">View source <span aria-hidden="true">↗</span></a>`);
  if (!sourceIsPublic(p)) links.push('<span class="note">Source code is private.</span>');
  links.push('<a class="text-link" href="./#contact">Ask me about it</a>');

  const next = projects[(i + 1) % projects.length];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const pagerLink = (q, label, cls) => `<a class="${cls}" href="${page(q)}"><span>${label}</span><strong>${esc(q.title)}</strong><em>${esc(q.kind)}</em></a>`;
  const description = c.description || clip(`Case study: ${p.summary}`);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CreativeWork', name: p.title, description, url: `${SITE}/${page(p)}`, image: `${SITE}/assets/shots/${p.id}-1.webp`, keywords: p.skills.join(', '), author: { '@type': 'Person', name: site.name, url: `${SITE}/` } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Portfolio', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: p.title, item: `${SITE}/${page(p)}` }] },
    ],
  };

  return fill(readFileSync('case-study.html', 'utf8'), {
    ...common,
    JSONLD: jsonLd(data),
    HEADER: header(false),
    FOOTER: footer(false),
    TITLE: esc(p.title),
    SUBTITLE: esc(c.subtitle || p.summary),
    DESCRIPTION: esc(description),
    FILE: page(p),
    ID: esc(p.id),
    OG_ALT: esc(p.slides[0].alt),
    KIND: esc(p.kind),
    STATUS: status(p),
    LINKS: links.join(''),
    SLIDES: slideshow(p),
    METRICS: (c.metrics || p.metrics).map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join(''),
    TOC: sections.map(([id, title]) => `<li><a href="#${id}">${esc(title)}</a></li>`).join(''),
    BODY: sections.map(([id, title, body]) => `<section id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${body}</section>`).join('\n'),
    PAGER: projects.length > 1 ? `${pagerLink(prev, '← Previous project', 'prev')}${pagerLink(next, 'Next project →', 'next')}` : '',
  });
}

/* ---------- Write docs/ (GitHub Pages serves main /docs) ---------- */

rmSync('docs', { recursive: true, force: true });
mkdirSync('docs/assets/shots', { recursive: true });
mkdirSync('docs/assets/fonts', { recursive: true });
writeFileSync('docs/index.html', index);
projects.forEach((p, i) => writeFileSync(`docs/${page(p)}`, casePage(p, i)));
for (const file of ['style.css', 'app.js']) writeFileSync(`docs/${file}`, readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
// Only screenshots of published projects are copied, so an unapproved project's images never reach the site.
for (const p of projects) p.slides.forEach((_, k) => Object.values(shot(p, k + 1)).forEach(f => copyFileSync(f, `docs/${f}`)));
for (const f of readdirSync('assets/fonts')) copyFileSync(`assets/fonts/${f}`, `docs/assets/fonts/${f}`);
for (const f of ['favicon.svg', 'og-image.png', 'Jordan_Jenkins_Resume.pdf']) copyFileSync(`assets/${f}`, `docs/assets/${f}`);
writeFileSync('docs/.nojekyll', '');
writeFileSync('docs/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync('docs/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[`${SITE}/`, ...projects.map(p => `${SITE}/${page(p)}`)].map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('docs/404.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — Jordan Jenkins</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/portfolio/style.css"></head><body><main class="wrap notfound"><p class="kicker">404</p><h1>Page not found.</h1><p class="lede">That address doesn’t lead anywhere. The projects are on the home page.</p><p class="hero-actions"><a class="button" href="/portfolio/">Go to the portfolio</a></p></main></body></html>`);
const slides = projects.reduce((n, p) => n + p.slides.length, 0);
console.log(`Built portfolio: ${projects.length} published projects, ${slides} slides, ${projects.length} case study pages.`);
