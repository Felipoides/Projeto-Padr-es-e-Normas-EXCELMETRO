// ============================================================================
//  MetroControl — Micro-framework HTTP (sobre node:http, sem dependências)
//  Fornece: roteamento com parâmetros, parsing de JSON/query, middlewares,
//  respostas auxiliares e servidor de arquivos estáticos.
// ============================================================================
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf',
};

/** Erro de API com status HTTP. */
export class HttpError extends Error {
    constructor(status, message, detalhes) {
        super(message);
        this.status = status;
        this.detalhes = detalhes;
    }
}

export class Router {
    constructor() {
        this.routes = [];
        this.middlewares = [];
    }

    use(fn) { this.middlewares.push(fn); return this; }

    add(method, path, ...handlers) {
        // Converte "/api/padroes/:id" em regex com grupos nomeados.
        const keys = [];
        const pattern = path.replace(/:[^/]+/g, (m) => {
            keys.push(m.slice(1));
            return '([^/]+)';
        });
        this.routes.push({
            method,
            regex: new RegExp(`^${pattern}/?$`),
            keys,
            handlers,
        });
        return this;
    }
    get(p, ...h) { return this.add('GET', p, ...h); }
    post(p, ...h) { return this.add('POST', p, ...h); }
    put(p, ...h) { return this.add('PUT', p, ...h); }
    patch(p, ...h) { return this.add('PATCH', p, ...h); }
    delete(p, ...h) { return this.add('DELETE', p, ...h); }

    match(method, pathname) {
        for (const r of this.routes) {
            if (r.method !== method) continue;
            const m = r.regex.exec(pathname);
            if (m) {
                const params = {};
                r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
                return { route: r, params };
            }
        }
        return null;
    }
}

// ---- Helpers de resposta ---------------------------------------------------
export function sendJSON(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

// ---- Leitura do corpo da requisição ---------------------------------------
export function lerCorpo(req, limiteBytes = 20 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let chunks = [], tamanho = 0;
        req.on('data', (c) => {
            tamanho += c.length;
            if (tamanho > limiteBytes) { reject(new HttpError(413, 'Payload muito grande')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => {
            if (!chunks.length) return resolve({});
            const raw = Buffer.concat(chunks).toString('utf8');
            const ct = req.headers['content-type'] || '';
            try {
                if (ct.includes('application/json')) resolve(JSON.parse(raw));
                else resolve(raw);
            } catch { reject(new HttpError(400, 'JSON inválido')); }
        });
        req.on('error', reject);
    });
}

// ---- Servidor de arquivos estáticos (frontend SPA) ------------------------
export async function servirEstatico(res, rootDir, urlPath) {
    let rel = decodeURIComponent(urlPath.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    // Bloqueia path traversal.
    const filePath = normalize(join(rootDir, rel));
    if (!filePath.startsWith(normalize(rootDir))) {
        res.writeHead(403).end('Forbidden');
        return true;
    }
    try {
        const info = await stat(filePath);
        if (info.isDirectory()) return servirEstatico(res, rootDir, rel + '/index.html');
        const data = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
            'Content-Length': data.length,
            'Cache-Control': 'no-cache',
        });
        res.end(data);
        return true;
    } catch {
        return false; // não encontrado — o chamador decide o fallback
    }
}
