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
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}`);
  }
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

const skipNames = new Set(['portfolio-site', '.github']);
try { fs.mkdirSync(OUT_DIR, { recursive: true }); } catch {}

const repos = await gh(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=updated`);
const projects = [];

for (const r of repos) {
  if (r.fork || r.archived || skipNames.has(r.name)) continue;
  const meta = await tryGet(`https://api.github.com/repos/${org}/${r.name}/contents/portfolio.json`);
  if (!meta || !meta.content) continue;
  try {
    const parsed = JSON.parse(b64ToString(meta.content));
    if (!parsed.title) continue;
    // backfill links.repo if missing
    parsed.links = parsed.links || {};
    parsed.links.repo = parsed.links.repo || r.html_url;
    parsed.slug = parsed.slug || r.name.replace(/^proj-/, '');
    projects.push({ ...parsed, _updated_at: r.updated_at });
  } catch (e) {
    console.log(`Skipping ${r.name}: invalid portfolio.json`);
  }
}

projects.sort((a, b) => new Date(b._updated_at) - new Date(a._updated_at));
const payload = {
  organization: org,
  generatedAt: new Date().toISOString(),
  count: projects.length,
  projects: projects.map(({ _updated_at, ...rest }) => rest),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
console.log(`Wrote ${OUT_FILE} with ${projects.length} projects.`);
