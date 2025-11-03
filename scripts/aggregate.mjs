// Aggregate portfolio.json from all public repos in an org
// Outputs to data/projects.json
import fs from 'node:fs';
import path from 'node:path';

const org = process.env.ORG || 'martz-cloud';
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log('GITHUB_TOKEN not set; using unauthenticated requests (may be rate limited).');
}

const headers = {
  'Accept': 'application/vnd.github+json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
};

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error ${res.status} for ${url}`);
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
const OUT_FILE = path.join(OUT_DIR, 'projects.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const skipNames = new Set(['portfolio-site', '.github']);
const repos = await gh(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=updated`);

const projects = [];

for (const r of repos) {
  if (r.fork || r.archived || skipNames.has(r.name)) continue;

  const meta = await tryGet(`https://api.github.com/repos/${org}/${r.name}/contents/portfolio.json`);
  if (!meta || !meta.content) continue;

  try {
    const parsed = JSON.parse(b64ToString(meta.content));
    if (!parsed.title) continue;

    // ---- normalize links so Pages points back to GitHub (no 404s) ----
    parsed.links = parsed.links || {};
    parsed.links.repo = parsed.links.repo || r.html_url;
    const repoUrl = parsed.links.repo.replace(/\/+$/, '');

    const toAbs = (p, type) => {
      if (!p) return null;
      if (/^https?:\/\//i.test(p)) return p;                    // already absolute
      const trimmed = String(p).replace(/^\/+/, '');
      if (type === 'docs')   return `${repoUrl}/tree/main/${trimmed}`; // folder view
      if (type === 'readme') return `${repoUrl}/blob/main/${trimmed}`;
