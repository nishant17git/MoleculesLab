#!/usr/bin/env node
/**
 * Tiny static server for local development — zero dependencies.
 *
 *   npm start            → http://localhost:8080
 *   npm start -- 3000    → custom port
 *
 * Service workers need http://localhost or https://, so opening index.html directly
 * from disk (file://) won't work for the offline features.
 * Supports HTTP Range requests (needed for audio) and sends `no-cache` so edits show up
 * on refresh. Never expose this to the internet.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.woff2': 'font/woff2',
};

export function createStaticServer({ root = ROOT, cacheControl = 'no-cache' } = {}) {
    return createServer((req, res) => {
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
            res.writeHead(400).end('Bad request');
            return;
        }
        if (pathname.endsWith('/')) pathname += 'index.html';

        const file = path.join(root, pathname);
        if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
            return;
        }

        const { size, mtimeMs } = statSync(file);
        const headers = {
            'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': cacheControl,
            'Accept-Ranges': 'bytes',
            ETag: `W/"${size}-${Math.floor(mtimeMs)}"`,
        };

        if (req.headers['if-none-match'] === headers.ETag) {
            res.writeHead(304, headers).end();
            return;
        }

        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
            const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
            if (start > end || start >= size) {
                res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
                return;
            }
            res.writeHead(206, {
                ...headers,
                'Content-Range': `bytes ${start}-${end}/${size}`,
                'Content-Length': end - start + 1,
            });
            createReadStream(file, { start, end }).pipe(res);
            return;
        }

        res.writeHead(200, { ...headers, 'Content-Length': size });
        if (req.method === 'HEAD') res.end();
        else createReadStream(file).pipe(res);
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const port = Number(process.argv[2]) || 8080;
    createStaticServer().listen(port, () => {
        console.log(`Molecules Lab dev server → http://localhost:${port}`);
    });
}
