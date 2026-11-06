# Jordan Jenkins: portfolio

The source for [thej1u.github.io/portfolio](https://thej1u.github.io/portfolio/): four projects, each with a screenshot slideshow, why I built it, what I learned, and its limits, plus a full case study of [jenkinsir.com](https://jenkinsir.com).

| Lighthouse (2026-11-06) | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home page, mobile and desktop | 100 | 100 | 100 | 100 |
| Case study, mobile and desktop | 100 | 100 | 100 | 100 |

An automated accessibility scan (axe-core, WCAG 2.1 AA) finds no violations in light or dark mode at desktop, phone and 320 px widths.

## How it's built

Plain HTML, CSS and JavaScript with a tiny Node build script. No framework and no dependencies to install.

```
projects.json           every project: summary, role, why I built it, what I learned, limits, slides
case-studies/*.json     long-form case studies (one page each)
template.html           home page layout
case-study.html         case study page layout
style.css, app.js       design, light/dark themes, slideshows, tabs, project index
assets/shots/           screenshots: <project-id>-<n>.webp (1600 px) and <project-id>-<n>-800.webp
assets/fonts/           Schibsted Grotesk, hosted with the site (SIL Open Font License, see OFL.txt)
scripts/build.mjs       renders docs/ (the published site), sitemap.xml and robots.txt
scripts/test.mjs        checks content, links, images and accessibility basics
```

Design choices:
- **Works without JavaScript.** Slideshows are scroll-snapping strips, so they swipe on phones and scroll with a trackpad or keyboard; JavaScript only adds the arrow buttons and the counter.
- **Fast.** No web-font request to Google, responsive WebP screenshots at two sizes, images below the fold load lazily.
- **Honest by test.** `npm test` fails if a project is missing why/learned/limits, if a slide has no alt text, if a link points to a private repository, or if jenkinsir.com is ever described as a business.

## Update the site

Requires a current Node.js. Nothing to install.

1. Edit `projects.json` (or a file in `case-studies/`). Keep every claim true and checkable.
2. Add screenshots as `assets/shots/<id>-<n>.webp` and `<id>-<n>-800.webp` (16:10, 1600×1000 and 800×500), with one `slides` entry (alt text + caption) per image.
3. Run `npm run build`, then `npm test`.
4. Commit the source changes and the regenerated `docs/` folder, then push to `main`.

**When a private repository becomes public:** add its URL to `PUBLIC_SOURCES` in `scripts/test.mjs` and remove `"sourceIsPublic": false` from that project in `projects.json`. The "View source" link then appears.

## Hosting

GitHub Pages serves the `main` branch, `/docs` folder. If the site moves to a custom domain, change `SITE` at the top of `scripts/build.mjs`.
