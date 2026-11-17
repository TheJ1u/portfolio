// Checks every external link in the built site over the network, with no sign-in.
// A GitHub repository that answers 404 to an anonymous visitor is private or gone, so this is also
// the real-world proof that no "View source" link points at a private repository.
//
//   npm run check:links        (run after npm run build)
import { readFileSync, readdirSync } from 'node:fs';

const pages = readdirSync('docs').filter(f => f.endsWith('.html'));
const found = new Map(); // url -> pages that use it
for (const page of pages) {
  for (const [, url] of readFileSync(`docs/${page}`, 'utf8').matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    if (!found.has(url)) found.set(url, []);
    found.get(url).push(page);
  }
}

// LinkedIn refuses automated requests (status 999), so it cannot be verified this way.
const unverifiable = url => /linkedin\.com/.test(url);

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': 'portfolio-link-check' }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return { ok: true, status: res.status };
      if (method === 'GET') return { ok: false, status: res.status };
    } catch (error) {
      if (method === 'GET') return { ok: false, status: error.name === 'TimeoutError' ? 'timeout' : 'network error' };
    }
  }
}

let failures = 0;
for (const [url, where] of found) {
  // The site's own canonical addresses only exist after a deploy; npm test already checks those pages locally.
  if (url.startsWith('https://thej1u.github.io/portfolio/')) continue;
  if (unverifiable(url)) { console.log(`skip   ${url} (blocks automated checks; open it by hand)`); continue; }
  const result = await check(url);
  if (result.ok) console.log(`ok     ${url}`);
  else {
    failures += 1;
    const hint = /github\.com\/[^/]+\/[^/]+/.test(url) && result.status === 404 ? ' <- private or deleted repository' : '';
    console.log(`BROKEN ${url} (${result.status})${hint}  used in: ${where.join(', ')}`);
  }
}
console.log(`\n${found.size} external links checked, ${failures} broken.`);
process.exit(failures ? 1 : 0);
