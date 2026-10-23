import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';

const projects = JSON.parse(readFileSync('projects.json', 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

// Real screenshots: drop files named <project-id>-1.png, <project-id>-2.png... into assets/shots/.
const shotDir = 'assets/shots';
const shotFiles = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
const shotsFor = p => shotFiles.filter(f => f.startsWith(`${p.id}-`) && /\.(png|jpe?g|webp)$/i.test(f));

// Illustration fallback: an abstract layout drawn from the project's category.
function rng(seed) { let s = seed * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function art(p, index) {
  const r = rng(index + 3);
  const bar = (x, y, w, h, c = 'a', rx = 6) => `<rect class="${c}" x="${x}" y="${y}" width="${Math.round(w)}" height="${h}" rx="${rx}"/>`;
  let g = '';
  if (p.category === 'Websites') {
    g += bar(32, 28, 90, 14, 'b') + [0, 1, 2].map(k => bar(440 + k * 60, 28, 44, 14)).join('');
    g += bar(32, 84, 300 + r() * 120, 30, 'b') + bar(32, 128, 220 + r() * 120, 30, 'b');
    g += bar(32, 180, 240 + r() * 100, 10) + bar(32, 200, 200, 10) + bar(32, 232, 120, 34, 'c', 17);
    for (let k = 0; k < 3; k++) g += bar(32 + k * 196, 290, 180, 84, 'd', 10) + bar(46 + k * 196, 306, 80 + r() * 60, 10, 'b') + bar(46 + k * 196, 328, 140, 8) + bar(46 + k * 196, 344, 100, 8);
  } else if (p.category === 'Business tools') {
    g += bar(32, 28, 120, 16, 'b') + bar(500, 24, 108, 24, 'c', 12);
    g += bar(32, 72, 576, 30, 'd', 8);
    for (let k = 0; k < 6; k++) {
      const y = 118 + k * 44;
      g += bar(40, y, 120, 12, 'b') + bar(200, y, 90 + r() * 120, 12) + bar(420, y, 60, 12) + bar(520, y, 70, 18, k % 3 === 0 ? 'c' : 'a', 9);
      g += `<rect class="a" x="32" y="${y + 26}" width="576" height="1"/>`;
    }
  } else {
    g += `<rect class="a" x="48" y="40" width="2" height="300"/><rect class="a" x="48" y="338" width="540" height="2"/>`;
    for (let k = 1; k < 5; k++) g += `<rect class="d" x="52" y="${40 + k * 60}" width="536" height="1"/>`;
    let pts = '', y = 280;
    for (let k = 0; k <= 10; k++) { y = Math.max(70, Math.min(310, y - 14 + (r() - 0.45) * 50)); pts += `${60 + k * 52},${Math.round(y)} `; }
    g += `<polyline class="s" points="${pts.trim()}"/>`;
    g += bar(60, 360, 80, 10, 'b') + bar(160, 360, 60, 10);
  }
  return `<svg class="art" viewBox="0 0 640 400" role="img" aria-label="Illustration of the ${esc(p.title)} layout">${g}</svg>`;
}

function shotMarkup(p, index) {
  const files = shotsFor(p);
  const list = files.length
    ? files.map((f, k) => ({ real: true, media: `<img src="assets/shots/${esc(f)}" alt="${esc(p.captions?.[k] || `${p.title} screenshot ${k + 1}`)}" loading="${index === 0 && k === 0 ? 'eager' : 'lazy'}">`, cap: p.captions?.[k] || `${p.title} screenshot ${k + 1}.` }))
    : [{ real: false, media: art(p, index), cap: p.source ? 'An illustration of the layout. A screenshot is coming.' : 'This project isn’t public, so this is an illustration of its layout, not a screenshot.' }];
  const figures = list.map((s, k) => `<figure class="shot"${k ? ' hidden' : ''}><div class="frame"><div class="frame-bar" aria-hidden="true"><i></i><i></i><i></i></div><div class="frame-body ${s.real ? 'is-real' : 'is-art'}">${s.media}</div></div><figcaption><span class="kind">${s.real ? 'Screenshot' : 'Illustration'}</span> ${esc(s.cap)}</figcaption></figure>`).join('');
  const thumbs = list.length > 1 ? `<div class="thumbs" role="group" aria-label="Screenshots">${list.map((s, k) => `<button type="button" class="thumb" data-i="${k}" aria-pressed="${k === 0}" aria-label="Show screenshot ${k + 1}">${k + 1}</button>`).join('')}</div>` : '';
  return `<div class="shots">${figures}${thumbs}</div>`;
}

const categories = [...new Set(projects.map(p => p.category))];
const filters = ['All', ...categories].map((c, i) => `<button type="button" class="chip" data-filter="${esc(c)}" aria-pressed="${i === 0}">${esc(c)} <span class="n">${c === 'All' ? projects.length : projects.filter(p => p.category === c).length}</span></button>`).join('');

const items = projects.map((p, i) => `<li class="item" id="${esc(p.id)}" data-category="${esc(p.category)}" data-search="${esc([p.title, p.summary, p.category, p.status, ...p.skills].join(' ').toLowerCase())}">
<button type="button" class="row" aria-controls="panel-${esc(p.id)}" aria-expanded="false"><span class="row-title">${esc(p.title)}</span><span class="row-meta">${esc(p.category)}</span><span class="row-status">${esc(p.status)}</span></button>
<div class="panel" id="panel-${esc(p.id)}">
${shotMarkup(p, i)}
<h3>${esc(p.title)}</h3>
<p class="summary">${esc(p.summary)}</p>
<section class="facet" data-facet="Problem"><h4>Problem</h4><p>${esc(p.problem)}</p></section>
<section class="facet" data-facet="Approach"><h4>Approach</h4><p>${esc(p.approach)}</p></section>
<section class="facet" data-facet="What it shows"><h4>What it shows</h4><p>${esc(p.demonstrates)}</p></section>
<section class="facet" data-facet="Limits"><h4>Limits</h4><p>${esc(p.limit)}</p></section>
<ul class="tags" aria-label="Skills used">${p.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
${(p.url || p.source) ? `<p class="links">${p.url ? `<a class="button small" href="${esc(p.url)}">Visit site</a>` : ''}${p.source ? `<a class="${p.url ? 'text-link' : 'button small'}" href="${esc(p.source)}">View source</a>` : ''}</p>` : ''}
</div></li>`).join('\n');

const ver = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);
const html = readFileSync('template.html', 'utf8')
  .replace('href="style.css"', `href="style.css?v=${ver('style.css')}"`)
  .replace('src="app.js"', `src="app.js?v=${ver('app.js')}"`)
  .replace('<!-- PROJECTS -->', items)
  .replace('<!-- FILTERS -->', filters)
  .replace('<!-- COUNT_WORD -->', (words[projects.length] || String(projects.length)).toLowerCase());

mkdirSync('docs/assets/shots', { recursive: true });
writeFileSync('docs/index.html', html);
for (const file of ['style.css', 'app.js']) copyFileSync(file, `docs/${file}`);
for (const f of shotFiles) copyFileSync(`${shotDir}/${f}`, `docs/assets/shots/${f}`);
copyFileSync('assets/favicon.svg', 'docs/assets/favicon.svg');
copyFileSync('assets/Jordan_Jenkins_Resume.pdf', 'docs/assets/Jordan_Jenkins_Resume.pdf');
writeFileSync('docs/.nojekyll', '');
writeFileSync('docs/404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — Jordan Jenkins</title><link rel="stylesheet" href="/portfolio/style.css"><main class="wrap hero" style="min-height:70vh"><h1><span class="line">Page not found.</span></h1><p class="lede">That address doesn’t lead anywhere. The projects are on the home page.</p><p class="hero-actions"><a class="button" href="/portfolio/">Go to the portfolio</a></p></main></html>');
console.log(`Built portfolio with ${projects.length} projects and ${shotFiles.length} screenshot file(s).`);
