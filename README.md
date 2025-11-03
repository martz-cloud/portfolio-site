# Portfolio Site (GitHub Pages)

This is the public hub for my projects. It lists every repo in the org that contains a `portfolio.json` file.

## How it works
- A nightly GitHub Action (`.github/workflows/sync-projects.yml`) scans the org using the GitHub API.
- For each public repo with a valid `portfolio.json`, it aggregates metadata into `data/projects.json`.
- `index.html` fetches `data/projects.json` and renders the cards.

## Customize
- Replace **ORG_PLACEHOLDER** links and update the workflow `env: ORG:` value to your org name.
- Add a PDF resume at `resume/Resume.pdf` (optional).

## Local preview
Open `index.html` directly in a browser or serve with any static server.
