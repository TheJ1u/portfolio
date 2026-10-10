import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const projects=JSON.parse(readFileSync('projects.json','utf8'));
test('Every project has unique identity, evidence summary and an honest limitation',()=>{
  assert.equal(new Set(projects.map(p=>p.id)).size,projects.length);
  for(const p of projects){for(const key of ['id','title','category','status','summary','problem','approach','demonstrates','limit'])assert.ok(p[key]?.trim(),`${p.id}: ${key}`);assert.ok(p.skills.length);}
});
test('Public links never point visitors to private project sources',()=>{
  for(const p of projects){if(p.source)assert.equal(p.source,'https://github.com/TheJ1u/ai-for-life');if(p.url)assert.equal(new URL(p.url).protocol,'https:');}
});
test('Built page has all projects, valid fragment targets and bundled assets',()=>{
  const html=readFileSync('docs/index.html','utf8');
  for(const p of projects)assert.ok(html.includes(`id="${p.id}"`));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  for(const [,id]of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),`Missing anchor ${id}`);
  for(const [,path]of html.matchAll(/(?:href|src)="([^"#:]+\.(?:css|js|svg))"/g))assert.ok(existsSync(`docs/${path}`),path);
  assert.ok(!html.includes('<!-- PROJECTS -->'));
});

