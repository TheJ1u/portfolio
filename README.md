# Jordan Jenkins: portfolio

The source for [thej1u.github.io/portfolio](https://thej1u.github.io/portfolio/): a home page built for a 30-second read, plus a full case study page for every project (the problem, my role, how it works, what I learned, the limits and what I'd do next).

| Lighthouse 12 (2026-11-16, local build) | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home page, desktop | 100 | 100 | 100 | 100 |
| Home page, mobile | 99 | 100 | 100 | 100 |
| Case study (jenkinsir.com), desktop | 100 | 100 | 100 | 100 |
| Case study (jenkinsir.com), mobile | 97 | 100 | 100 | 100 |

## How it's built

Plain HTML, CSS and JavaScript with a small Node build script. No framework and nothing to install.

```
projects.json           every project: summary, role, why, lessons, limits, numbers, slides, "published" flag
site.json               profile: skills (each with the project that proves it), experience, education
case-studies/*.json     optional extra depth for a project (decisions, mistakes, architecture lanes)
template.html           home page layout
case-study.html         case study page layout
style.css, app.js       design, dark/light themes, 3D screenshot deck, slideshows, screenshot viewer
assets/shots/           screenshots: <id>-<n>.webp (1600 px), <id>-<n>-800.webp, <id>-<n>-2560.webp
scripts/build.mjs       renders docs/ (the published site), sitemap.xml and robots.txt
scripts/test.mjs        content, privacy and accessibility checks
scripts/discover.mjs    finds new repositories and problems; writes a private report
scripts/check-links.mjs checks every external link without signing in
scripts/serve.mjs       local preview server
```

Design choices:
- **Works without JavaScript and without motion.** Every page is complete as plain HTML. JavaScript adds the deck tilt, slideshow buttons and scroll reveals; `prefers-reduced-motion` turns all animation off.
- **3D without a 3D library.** The hero deck is CSS transforms on real screenshots. A WebGL library such as Three.js would add roughly 150 KB of JavaScript for decoration, which costs load time on phones.
- **Fast.** One self-hosted font, responsive WebP screenshots, lazy loading below the fold, no third-party requests.
- **Honest by test.** `npm test` fails if a project is missing its lessons or limits, if a skill has no project behind it, if a link points to a repository that isn't confirmed public, or if an unpublished project leaks into the built site.

## Commands

```
npm run preview       build, then serve at http://localhost:4173
npm test              build, then run all checks
npm run discover      look for new or changed repositories (writes .private/, changes nothing)
npm run check:links   check every external link over the network
```

## Add a project (approval-based)

Nothing reaches the site unless its entry in `projects.json` has `"published": true`.

1. Run `npm run discover`. It writes `.private/discovery.md` (ranked candidates, repositories that changed visibility, stale projects) and a draft for each strong candidate in `.private/drafts/`.
2. Pick one. In its draft, replace every `[bracketed]` placeholder with something true and checkable. Decide what is safe to disclose if the repository is private.
3. Add screenshots as `assets/shots/<id>-<n>.webp` (1600×1000), `<id>-<n>-800.webp` (800×500) and `<id>-<n>-2560.webp`, with one `slides` entry (alt text and caption) per image.
4. Copy the finished entry into `projects.json` and set `"published": true`. To show a skill on the home page, add the project's id as evidence in `site.json`.
5. Run `npm test`, then `npm run preview` and read the page.
6. Commit on a branch, open a pull request, review the preview, and merge to `main` to publish.

To take a project down, set `"published": false` and rebuild. Its page, its screenshots and every mention disappear from `docs/`.

**`.private/` is git-ignored and must stay that way.** This repository is public, and the discovery report names private repositories.

**When a private repository becomes public:** `npm run discover` reports it. Add its URL to `PUBLIC_SOURCES` in `scripts/test.mjs` and remove `"sourceIsPublic": false` from the project. The "View source" link then appears. `npm run check:links` confirms it without signing in.

## Hosting

GitHub Pages serves the `main` branch, `/docs` folder. If the site moves to a custom domain, change `SITE` at the top of `scripts/build.mjs`.
