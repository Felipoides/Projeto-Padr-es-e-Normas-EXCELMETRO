// ============================================================================
//  MetroControl — Servidor principal (API REST + frontend estático)
//  Execução:  node backend/server.js     (ou  npm start)
//  Sem dependências externas — usa apenas módulos nativos do Node.js.
// ============================================================================
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { initSchema, get, USE_PG } from './src/db/database.js';
import { Router, HttpError, sendJSON, lerCorpo, servirEstatico } from './src/lib/http.js';
import { seed } from './src/db/seed.js';

// --- Importa e registra todos os módulos de rotas --------------------------
import * as auth from './src/routes/auth.js';
import * as padroes from './src/routes/padroes.js';
import * as movimentacoes from './src/routes/movimentacoes.js';
import * as calibracoes from './src/routes/calibracoes.js';
import * as normas from './src/routes/normas.js';
import * as servicos from './src/routes/servicos.js';
import * as dashboard from './src/routes/dashboard.js';
import * as relatorios from './src/routes/relatorios.js';
import * as usuarios from './src/routes/usuarios.js';
import * as auditoria from './src/routes/auditoria.js';
import * as backup from './src/routes/backup.js';
import * as dbexplorer from './src/routes/dbexplorer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, '../frontend');
const PORT = process.env.PORT || 3000;

// --- Inicialização do banco (top-level await — ESM) -------------------------
await initSchema();
const totalUsuarios = Number((await get(`SELECT COUNT(*) c FROM usuarios`)).c);
if (totalUsuarios === 0) {
    console.log('🌱  Banco vazio — populando com dados de demonstração...');
    await seed();
}

// --- Montagem do roteador ---------------------------------------------------
const router = new Router();
for (const mod of [auth, padroes, movimentacoes, calibracoes, normas,
    servicos, dashboard, relatorios, usuarios, auditoria, backup, dbexplorer]) {
    mod.register(router);
}

// --- Servidor HTTP ----------------------------------------------------------
const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS (útil se o frontend for hospedado separado do backend).
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    // ---- Rotas da API ----
    if (pathname.startsWith('/api/')) {
        const match = router.match(req.method, pathname);
        if (!match) return sendJSON(res, 404, { erro: 'Endpoint não encontrado.' });

        // Monta o contexto da requisição.
        const ctx = {
            req, res,
            params: match.params,
            query: Object.fromEntries(url.searchParams),
            body: {},
            usuario: null,
            status: 200,
            ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(),
            userAgent: req.headers['user-agent'] || '',
        };

        try {
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                const limite = pathname === '/api/backup/restaurar' ? 200 * 1024 * 1024 : undefined;
                ctx.body = await lerCorpo(req, limite);
            }
            const handler = match.route.handlers[match.route.handlers.length - 1];
            const resultado = await handler(ctx);

            // Download (CSV/Excel)?
            if (resultado && resultado.__download) {
                res.writeHead(200, {
                    'Content-Type': resultado.contentType,
                    'Content-Disposition': `attachment; filename="${resultado.filename}"`,
                });
                return res.end(resultado.body);
            }
            return sendJSON(res, ctx.status || 200, resultado ?? { ok: true });
        } catch (err) {
            if (err instanceof HttpError) {
                return sendJSON(res, err.status, { erro: err.message, detalhes: err.detalhes });
            }
            console.error('Erro interno:', err);
            return sendJSON(res, 500, { erro: 'Erro interno do servidor.', detalhe: String(err.message || err) });
        }
    }

    // ---- Frontend estático (SPA) ----
    const servido = await servirEstatico(res, FRONTEND_DIR, pathname);
    if (!servido) {
        // Fallback para SPA: entrega o index.html em rotas não-arquivo.
        const ok = await servirEstatico(res, FRONTEND_DIR, '/index.html');
        if (!ok) { res.writeHead(404).end('Not found'); }
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════╗');
    console.log('  ║                  MetroControl                      ║');
    console.log('  ║      Gestão de Padrões Metrológicos / 17025        ║');
    console.log('  ╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  ➜  Aplicação:  http://localhost:${PORT}`);
    console.log(`  ➜  API REST:   http://localhost:${PORT}/api`);
    console.log(`  ➜  Banco:      ${USE_PG ? 'PostgreSQL' + (process.env.PG_MEM ? ' (em memória / teste)' : '') : 'SQLite (local)'}`);
    console.log('');
    console.log('  Login padrão:  admin@metrocontrol.com  /  Admin@123');
    console.log('');
});
