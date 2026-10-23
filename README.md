# Jordan Jenkins's portfolio website

A visual project portfolio covering practical AI, business applications, websites, and research. AI For Life is the featured project, with direct links to its website and source. Text From Sheet also links to its public web app and source.

[Visit the Jordan Jenkins project collection](https://thej1u.github.io/portfolio/)

## Update the site

1. Edit `projects.json` to add or update a project. Keep descriptions factual and do not include private data or credentials.
2. Run `npm run build` to regenerate the published files in `docs/`.
3. Run `npm test` before committing.
4. Commit the source changes and generated `docs/` files, then push to `main`.

### Add real screenshots

Drop images into `assets/shots/` named `<project-id>-1.png`, `<project-id>-2.png`, and so on (the id is the `id` field in `projects.json`, for example `ai-for-life-1.png`). The build uses them automatically instead of the illustration, adds a numbered switcher when a project has more than one, and labels them "Screenshot". Add an optional `captions` list to the project in `projects.json` to describe each image. Only use screenshots with no client names, contact lists, or account data.

No dependencies need to be installed. Use a current Node.js release.

`template.html` contains the page structure; `style.css` and `app.js` provide the responsive design, category filters, search, the live preview stage, tabs, the screenshot switcher, and the light/dark toggle. All project content remains readable without JavaScript. Private projects have high-level descriptions without links to inaccessible source repositories.

## Hosting

GitHub Pages should deploy from the `main` branch, `/docs` folder. Other project repositories do not need to be made public.

## Content scope

Seven projects are included based on existing documentation. No user counts, revenue, performance results, certifications, or individual contribution claims have been invented. Work without a public demo is labeled accordingly.
