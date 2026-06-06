#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const OWNER = process.env.GITHUB_OWNER || 'THZ11101';
const REPO = process.env.GITHUB_REPO || 'pc-build-sales-brief';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = 'https://api.github.com';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { date: process.env.BRIEF_DATE || '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--date') out.date = args[++i];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) {
    fail('Usage: node scripts/publish-github-pages.js --date YYYY-MM-DD');
  }
  return out;
}

function readGhHostsToken() {
  const appData = process.env.APPDATA;
  if (!appData) return '';
  const hostsPath = path.join(appData, 'GitHub CLI', 'hosts.yml');
  if (!fs.existsSync(hostsPath)) return '';
  const text = fs.readFileSync(hostsPath, 'utf8');
  const githubBlock = text.split(/\r?\n(?=\S)/).find((block) => /^github\.com:/m.test(block));
  const match = (githubBlock || text).match(/^\s*(?:oauth_token|token):\s*(.+?)\s*$/m);
  return match ? match[1].trim() : '';
}

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhHostsToken();
}

async function gh(method, route, body) {
  const auth = token();
  if (!auth) fail('Missing GitHub token. Sign in with GitHub CLI or set GH_TOKEN/GITHUB_TOKEN.');
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pc-build-sales-brief-publisher',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    fail(`GitHub API ${res.status} ${route}: ${json.message || text}`);
  }
  return json;
}

function requiredFiles(date) {
  return [
    `brief-data/${date}.json`,
    `briefs/${date}.html`,
    `share-images/${date}.png`,
    'index.html',
    'color-palette-demo.html',
    '.github/workflows/daily-brief.yml',
    'README.md',
    'scripts/send-feishu-local-summary.js',
    'scripts/publish-github-pages.js',
  ];
}

function readLocalFile(file) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) fail(`Missing required file: ${file}`);
  return fs.readFileSync(full).toString('base64');
}

async function enablePagesIfNeeded() {
  try {
    await gh('GET', `/repos/${OWNER}/${REPO}/pages`);
    return;
  } catch (error) {
    if (!String(error.message || error).includes('404')) throw error;
  }
  await gh('POST', `/repos/${OWNER}/${REPO}/pages`, {
    source: { branch: BRANCH, path: '/' },
  });
}

async function upsertFile(file, content, message) {
  let sha;
  try {
    const existing = await gh('GET', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(file).replace(/%2F/g, '/')}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch (error) {
    if (!String(error.message || error).includes('404')) throw error;
  }
  await gh('PUT', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(file).replace(/%2F/g, '/')}`, {
    message,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
  console.log(`Published ${file}`);
}

async function waitForPages(date) {
  const urls = [
    `https://${OWNER.toLowerCase()}.github.io/${REPO}/briefs/${date}.html`,
    `https://${OWNER.toLowerCase()}.github.io/${REPO}/share-images/${date}.png`,
  ];
  for (const url of urls) {
    let ok = false;
    for (let i = 0; i < 24; i += 1) {
      const res = await fetch(`${url}?t=${Date.now()}`, { method: 'GET' });
      if (res.ok) {
        ok = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!ok) fail(`Timed out waiting for GitHub Pages URL: ${url}`);
    console.log(`Verified ${url}`);
  }
}

async function main() {
  const { date } = parseArgs();
  const message = `chore: publish daily brief ${date}`;
  for (const file of requiredFiles(date)) {
    await upsertFile(file, readLocalFile(file), message);
  }
  await enablePagesIfNeeded();
  await waitForPages(date);
  console.log(`Published GitHub Pages brief for ${date}`);
}

main().catch((error) => fail(error.stack || error.message));
