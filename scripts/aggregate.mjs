// scripts/aggregate.mjs
// Aggregates portfolio.json from all public repos in ORG into data/projects.json

import fs from 'node:fs';
import path from 'node:path';

const org = process.env.ORG || 'martz-cloud';
const token = process.env.GITHUB_TOKEN || '';

const headers = {
  'Accept': 'application/vnd.github+json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
};

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

async function tryGet(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

function b64ToString(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
}

const OUT_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, 'projects.json');

const skipNames = new Set(['portfolio-site', '.github']);

// Get public repos (first 100)
const repos = await gh(
  `https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=updated`
);

const projects = [];

for (const r of repos) {
  if (r.fork || r.archived || skipNames.has(r.name)) continue;

  const meta = await tryGet(
    `https://api.github.com/repos/${org}/${r.name}/contents/portfolio.json`
  );
  if (!meta || !meta.content) continue;

  try {
    const parsed = JSON.parse(b64ToString(meta.content));
    if (!parsed || !parsed.title) continue;

    // -------- Normalize links so Pages points back to GitHub (no 404s) --------
    parsed.links = parsed.links || {};
    parsed.links.repo = parsed.links.repo || r.html_url;
    const repoUrl = parsed.links.repo.replace(/\/+$/, '');

    const toAbs = (p, type) => {
      if (!p) return null;
      if (/^https?:\/\//i.test(p)) return p;        // already absolute
      const trimmed = String(p).replace(/^\/+/, '');
      if (type === 'docs')   return `${repoUrl}/tree/main/${trimmed}`;  // folder
      if (type === 'readme') return `${repoUrl}/blob/main/${trimmed}`;  // file
      return `${repoUrl}/blob/main/${trimmed}`;
    };

    // Prefer docs if provided; fall back to README.md
    parsed.links.docs = toAbs(parsed.links.docs || null, 'docs');
    parsed.links.readme = toAbs(parsed.links.readme || 'README.md', 'readme');

    // Slug fallback
    parsed.slug = parsed.slug || r.name.replace(/^proj-/, '');

    projects.push({ ...parsed, _updated_at: r.updated_at });
    // -------------------------------------------------------------------------
  } catch (e) {
    console.log(`Skipping ${r.name}: invalid portfolio.json (${e.message})`);
  }
}

// Sort by recent updates
projects.sort((a, b) => new Date(b._updated_at) - new Date(a._updated_at));

// Write payload
const payload = {
  organization: org,
  generatedAt: new Date().toISOString(),
  count: projects.length,
  projects: projects.map(({ _updated_at, ...rest }) => rest),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
console.log(`Wrote ${OUT_FILE} with ${payload.count} projects.`);
