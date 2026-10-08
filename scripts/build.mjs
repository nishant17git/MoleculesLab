#!/usr/bin/env node
/**
 * Build step for the offline layer. Zero dependencies — plain Node 18+.
 *
 *   node scripts/build.mjs          regenerate everything
 *   node scripts/build.mjs --check  verify nothing is stale (exit 1 if it is) — handy for CI / pre-commit
 *
 * It does three things:
 *   1. Walks the files that make up the app and fingerprints them (SHA-256).
 *   2. Writes `precache-manifest.js`, which `sw.js` imports. A changed fingerprint is what
 *      makes the service worker download that file again and ship an update to users.
 *   3. Fills the <!-- modulepreload --> block in index.html from the real import graph, so the
 *      browser fetches the whole JS module tree in one round trip.
 *
 * Third-party URLs (three.js, GSAP, fonts) are read straight from index.html, so there is a
 * single source of truth.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

/** What is cached for offline use (paths relative to the project root). */
const PRECACHE_FILES = ['index.html', 'manifest.webmanifest'];
const PRECACHE_DIRS = ['src', 'assets/icons', 'assets/audio'];
const IGNORED = /(^|\/)(\.DS_Store|Thumbs\.db)$|\.map$/;

const ENTRY_MODULE = 'src/js/main.js';
const INDEX_HTML = path.join(ROOT, 'index.html');
const MANIFEST_OUT = path.join(ROOT, 'precache-manifest.js');

const posix = (p) => p.split(path.sep).join('/');
const sha = (data) => createHash('sha256').update(data).digest('hex');

/* ---------- file discovery ---------- */

async function walk(dir) {
    const out = [];
    for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = posix(path.join(dir, entry.name));
        if (entry.isDirectory()) out.push(...(await walk(rel)));
        else if (!IGNORED.test(rel)) out.push(rel);
    }
    return out;
}

/* ---------- module graph → <link rel="modulepreload"> ---------- */

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;

async function moduleGraph(entry) {
    const seen = new Set();
    const visit = async (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        const source = await readFile(path.join(ROOT, file), 'utf8');
        for (const match of source.matchAll(IMPORT_RE)) {
            const specifier = match[1] || match[2];
            const resolved = posix(path.normalize(path.join(path.dirname(file), specifier)));
            if (!existsSync(path.join(ROOT, resolved))) {
                throw new Error(`${file} imports "${specifier}", which does not exist`);
            }
            await visit(resolved);
        }
    };
    await visit(entry);
    return [...seen];
}

function withModulePreloads(html, modules) {
    const start = '<!-- modulepreload:start -->';
    const end = '<!-- modulepreload:end -->';
    const from = html.indexOf(start);
    const to = html.indexOf(end);
    if (from === -1 || to === -1) throw new Error('index.html is missing the modulepreload:start/end markers');

    const ordered = [ENTRY_MODULE, ...modules.filter((m) => m !== ENTRY_MODULE).sort()];
    const links = ordered.map((m) => `    <link rel="modulepreload" href="${m}">`).join('\n');
    return `${html.slice(0, from + start.length)}\n${links}\n    ${html.slice(to)}`;
}

/* ---------- third-party URLs, read from index.html ---------- */

function attributes(tag) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2];
    return attrs;
}

function remoteAssets(html) {
    const assets = [];
    for (const tag of html.match(/<script\b[^>]*>/g) || []) {
        const { src } = attributes(tag);
        if (src?.startsWith('https://')) assets.push({ url: src, required: true });
    }
    for (const tag of html.match(/<link\b[^>]*>/g) || []) {
        const { rel, href } = attributes(tag);
        if (rel === 'stylesheet' && href?.startsWith('https://')) assets.push({ url: href, required: false });
    }
    return assets;
}

/* ---------- sanity checks ---------- */

function localReferences(html) {
    const refs = [];
    for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) || []) {
        const { src, href, rel } = attributes(tag);
        const target = src || href;
        if (!target || /^(https?:|data:|#)/.test(target)) continue;
        if (rel === 'preconnect') continue;
        refs.push(target);
    }
    return refs;
}

async function manifestReferences() {
    const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    return (manifest.icons || []).map((icon) => icon.src);
}

/* ---------- main ---------- */

async function main() {
    const problems = [];

    let html = await readFile(INDEX_HTML, 'utf8');
    const modules = await moduleGraph(ENTRY_MODULE);
    html = withModulePreloads(html, modules);

    const files = new Set(PRECACHE_FILES);
    for (const dir of PRECACHE_DIRS) (await walk(dir)).forEach((f) => files.add(f));

    for (const ref of [...localReferences(html), ...(await manifestReferences())]) {
        if (!existsSync(path.join(ROOT, ref))) problems.push(`Referenced file is missing: ${ref}`);
        else if (!files.has(posix(path.normalize(ref)))) problems.push(`Referenced but not precached (offline would break): ${ref}`);
    }

    const entries = [];
    for (const file of [...files].sort()) {
        const data = file === 'index.html' ? Buffer.from(html) : await readFile(path.join(ROOT, file));
        entries.push({ url: file, revision: sha(data).slice(0, 10) });
    }

    const remote = remoteAssets(html);
    const version = sha(JSON.stringify({ entries, remote })).slice(0, 10);

    const manifestSource = `/* AUTO-GENERATED by scripts/build.mjs — do not edit by hand. Run \`npm run build\`. */
self.__MOLECULES_PRECACHE__ = ${JSON.stringify({ version, entries, remote }, null, 2)};
`;

    if (problems.length) {
        console.error(problems.map((p) => `✗ ${p}`).join('\n'));
        process.exit(1);
    }

    if (CHECK_ONLY) {
        const currentHtml = await readFile(INDEX_HTML, 'utf8');
        const currentManifest = existsSync(MANIFEST_OUT) ? await readFile(MANIFEST_OUT, 'utf8') : '';
        if (currentHtml !== html || currentManifest !== manifestSource) {
            console.error('✗ precache-manifest.js / index.html are out of date. Run: npm run build');
            process.exit(1);
        }
        console.log(`✓ Up to date (version ${version}, ${entries.length} files)`);
        return;
    }

    await writeFile(INDEX_HTML, html);
    await writeFile(MANIFEST_OUT, manifestSource);

    const total = (await Promise.all(entries.map((e) => readFile(path.join(ROOT, e.url))))).reduce((n, b) => n + b.length, 0);
    console.log(`✓ Precache manifest written — version ${version}`);
    console.log(`  ${entries.length} app files (${(total / 1024).toFixed(1)} KB), ${remote.length} third-party URLs, ${modules.length} modules preloaded`);
}

main().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exit(1);
});
