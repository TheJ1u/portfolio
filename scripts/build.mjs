import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const projects = JSON.parse(readFileSync('projects.json', 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cards = projects.map((p,i) => `<article class="project" id="${esc(p.id)}" data-category="${esc(p.category)}" data-search="${esc([p.title,p.summary,p.category,...p.skills].join(' ').toLowerCase())}">
 <div class="project-top"><span class="index">${String(i+1).padStart(2,'0')}</span><span class="status">${esc(p.status)}</span></div>
 <p class="eyebrow">${esc(p.category)}</p><h3>${esc(p.title)}</h3><p class="summary">${esc(p.summary)}</p>
 <ul class="tags" aria-label="Technologies and skills">${p.skills.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
 <details><summary>Explore project <span aria-hidden="true">+</span></summary><div class="detail-body"><h4>The problem</h4><p>${esc(p.problem)}</p><h4>The approach</h4><p>${esc(p.approach)}</p><h4>What it demonstrates</h4><p>${esc(p.demonstrates)}</p><p class="project-note">${esc(p.limit)}</p></div></details>
 ${p.url?`<div class="project-links"><a href="${esc(p.url)}">Visit website <span aria-hidden="true">↗</span></a><a href="${esc(p.source)}">Source code <span aria-hidden="true">↗</span></a></div>`:''}
</article>`).join('\n');
let html=readFileSync('template.html','utf8').replace('<!-- PROJECTS -->',cards);
mkdirSync('docs/assets',{recursive:true});
writeFileSync('docs/index.html',html);
for (const file of ['style.css','app.js']) copyFileSync(file,`docs/${file}`);
copyFileSync('assets/favicon.svg','docs/assets/favicon.svg');
writeFileSync('docs/.nojekyll','');
writeFileSync('docs/404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — Jordan</title><link rel="stylesheet" href="/portfolio/style.css"><main class="wrap hero"><p class="eyebrow">404 / Page not found</p><h1>Let’s get back<br>to the work.</h1><p><a class="button" href="/portfolio/">Return to Jordan’s portfolio</a></p></main></html>');
console.log(`Built portfolio with ${projects.length} projects.`);

