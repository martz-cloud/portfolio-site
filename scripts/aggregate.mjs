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

for (const r of
