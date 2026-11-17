// Finds portfolio candidates and problems, and writes a PRIVATE report. It never changes the site.
//
//   npm run discover
//
// What it does:
//   1. Lists your GitHub repositories with the GitHub CLI (gh), including private ones.
//   2. Compares them with projects.json and reports: new repositories, repositories that became public,
//      published projects whose repository is no longer public, and stale projects.
//   3. Scores each unlisted repository so the strongest candidates come first.
//   4. Writes .private/discovery.md and a draft .private/drafts/<repo>.json for each strong candidate.
//
// Everything lands in .private/, which is git-ignored, because this repository is public and the report
// names private repositories. Nothing appears on the site until you copy a draft into projects.json,
// fill in every field truthfully, and set "published": true.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const OWNER = 'TheJ1u';
const SKIP = new Set(['portfolio', OWNER]); // this site and the profile README
const gh = args => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));

let repos;
try {
  repos = gh(['repo', 'list', OWNER, '--limit', '200', '--json', 'name,visibility,isFork,isArchived,description,primaryLanguage,pushedAt,createdAt,homepageUrl,url,diskUsage']);
} catch (error) {
  console.error('Could not list repositories. Install the GitHub CLI and run "gh auth login" first.\n', error.message);
  process.exit(1);
}

const projects = JSON.parse(readFileSync('projects.json', 'utf8'));
const repoOf = p => p.source?.match(/github\.com\/[^/]+\/([^/#?]+)/)?.[1];
const listed = new Map(projects.filter(repoOf).map(p => [repoOf(p), p]));
const days = date => Math.round((Date.now() - new Date(date).getTime()) / 86_400_000);

function readme(name) {
  try { return Buffer.from(gh(['api', `repos/${OWNER}/${name}/readme`]).content, 'base64').toString('utf8'); } catch { return ''; }
}

// A rough, explainable score. It ranks candidates; it does not decide anything.
function score(repo, text) {
  const reasons = [];
  let n = 0;
  const add = (points, why) => { n += points; reasons.push(`${points > 0 ? '+' : ''}${points} ${why}`); };
  if (text.length > 1500) add(2, 'has a real README'); else if (text.length < 200) add(-2, 'README is missing or a stub');
  if (/create-next-app|bootstrapped with/i.test(text)) add(-2, 'README is still the framework template');
  if (/\btests?\b|\bpytest\b|\bunittest\b|\bCI\b/i.test(text)) add(2, 'mentions tests or CI');
  if (/status|limit|not yet|placeholder|fake data/i.test(text)) add(1, 'states its status or limits');
  if (repo.homepageUrl) add(2, 'has a live URL');
  if (repo.description) add(1, 'has a description');
  if (days(repo.pushedAt) < 45) add(1, 'active in the last 45 days');
  if (repo.isArchived) add(-3, 'archived');
  if (repo.isFork) add(-3, 'fork');
  if ((repo.diskUsage || 0) < 20) add(-1, 'very small');
  return { n, reasons };
}

const candidates = [];
const becamePublic = [];
const noLongerPublic = [];
for (const repo of repos) {
  const project = listed.get(repo.name);
  const isPublic = repo.visibility === 'PUBLIC';
  if (project) {
    if (isPublic && project.sourceIsPublic === false) becamePublic.push({ repo, project });
    if (!isPublic && project.published === true && project.sourceIsPublic !== false) noLongerPublic.push({ repo, project });
    continue;
  }
  if (SKIP.has(repo.name)) continue;
  const text = readme(repo.name);
  candidates.push({ repo, text, ...score(repo, text) });
}
candidates.sort((a, b) => b.n - a.n);

const stale = projects.filter(p => p.published === true && repoOf(p)).map(p => ({ p, repo: repos.find(r => r.name === repoOf(p)) })).filter(x => x.repo && days(x.repo.pushedAt) > 180);

mkdirSync('.private/drafts', { recursive: true });
const lines = [
  '# Portfolio discovery report (PRIVATE: do not commit or share)',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)}. ${repos.length} repositories checked; ${projects.filter(p => p.published === true).length} projects are published on the site.`,
  '',
  '## Needs action',
  '',
  ...(noLongerPublic.length ? noLongerPublic.map(x => `- **Broken link risk:** \`${x.repo.name}\` is no longer public, but "${x.project.title}" links to it. Set \`"sourceIsPublic": false\` and remove it from PUBLIC_SOURCES in scripts/test.mjs.`) : ['- No published project links to a private repository.']),
  ...(becamePublic.length ? becamePublic.map(x => `- **Now public:** \`${x.repo.name}\`. If you want a "View source" link on "${x.project.title}", remove \`"sourceIsPublic": false\` and add the URL to PUBLIC_SOURCES in scripts/test.mjs.`) : ['- No listed repository has changed from private to public.']),
  ...(stale.length ? stale.map(x => `- **Stale:** "${x.p.title}" has had no commits for ${days(x.repo.pushedAt)} days. Check that its status line on the site is still true.`) : []),
  '',
  '## Candidates not on the site (strongest first)',
  '',
  'Scores only rank. You decide what is disclosed. Private repositories stay private; a case study can still be written without a source link, as with jenkinsir.com.',
  '',
  '| Repository | Visibility | Language | Last push | Score | Why |',
  '| --- | --- | --- | --- | --- | --- |',
  ...candidates.map(c => `| ${c.repo.name} | ${c.repo.visibility.toLowerCase()}${c.repo.isArchived ? ', archived' : ''} | ${c.repo.primaryLanguage?.name || 'n/a'} | ${c.repo.pushedAt.slice(0, 10)} | ${c.n} | ${c.reasons.join('; ')} |`),
  '',
  '## How to approve one',
  '',
  '1. Open its draft in `.private/drafts/`. Replace every [bracketed] placeholder with something true and checkable.',
  '2. Add screenshots to `assets/shots/` (see README.md).',
  '3. Copy the finished object into `projects.json` and set `"published": true`.',
  '4. Run `npm run build`, `npm test` and `npm run preview`, then review the branch before merging.',
  '',
];
writeFileSync('.private/discovery.md', lines.join('\n'));

// Drafts hold only public-safe facts from GitHub metadata. Everything that needs judgement is a placeholder.
let drafted = 0;
for (const c of candidates.filter(x => x.n >= 3)) {
  const file = `.private/drafts/${c.repo.name}.json`;
  if (existsSync(file)) continue;
  const isPublic = c.repo.visibility === 'PUBLIC';
  const draft = {
    id: c.repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    published: false,
    title: '[Project title]',
    short: '[Short name]',
    kind: `[Type] · ${c.repo.primaryLanguage?.name || '[Language]'}`,
    status: '[Live / Working demo / In progress] · [one honest qualifier]',
    summary: c.repo.description || '[One or two sentences: what it does and for whom]',
    role: '[What you decided, built and verified, and what AI tools did]',
    why: '[The real problem behind it]',
    learned: ['[Lesson 1]', '[Lesson 2]'],
    approach: '[How it works, in plain language]',
    demonstrates: '[What an employer should take from it]',
    limit: '[What does not work yet, what is fake or untested]',
    next: '[What you would do next]',
    skills: [c.repo.primaryLanguage?.name || '[Skill]'],
    ...(c.repo.homepageUrl ? { url: c.repo.homepageUrl } : {}),
    source: c.repo.url,
    ...(isPublic ? {} : { sourceIsPublic: false }),
    metrics: [{ value: '[Number]', label: '[what it counts, verified]' }],
    flow: ['[Step 1]', '[Step 2]', '[Step 3]'],
    slides: [{ alt: '[Describe screenshot 1 for someone who cannot see it]', caption: '[Caption 1]' }, { alt: '[Describe screenshot 2]', caption: '[Caption 2]' }],
  };
  writeFileSync(file, `${JSON.stringify(draft, null, 2)}\n`);
  drafted += 1;
}

console.log(`Checked ${repos.length} repositories.`);
console.log(`  ${noLongerPublic.length} published project(s) link to a repository that is no longer public`);
console.log(`  ${becamePublic.length} listed repository(ies) became public`);
console.log(`  ${candidates.length} candidate(s) not on the site, ${drafted} new draft(s) written`);
console.log('Report: .private/discovery.md (private, git-ignored). Nothing on the site changed.');
