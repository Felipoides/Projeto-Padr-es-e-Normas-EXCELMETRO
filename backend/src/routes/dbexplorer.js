// ============================================================================
//  MetroControl — Explorador do Banco de Dados (somente leitura, admin only)
// ============================================================================
import { all, get, rawAll, USE_PG } from '../db/database.js';
import { exigirPerfil } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';

export function register(router) {
    // ==================== LISTAR TABELAS =====================================
    router.get('/api/db/tabelas', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');

        let tabelas;
        if (USE_PG) {
            tabelas = await rawAll(
                `SELECT table_name AS nome
                 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                 ORDER BY table_name`);
        } else {
            tabelas = await all(
                `SELECT name AS nome FROM sqlite_master
                 WHERE type='table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name`);
        }

        const resultado = [];
        for (const t of tabelas) {
            const c = await get(`SELECT COUNT(*) AS total FROM ${t.nome}`);
            resultado.push({ nome: t.nome, registros: Number(c.total) });
        }
        return { banco: USE_PG ? 'PostgreSQL' : 'SQLite', tabelas: resultado };
    });

    // ==================== ESTRUTURA DE UMA TABELA ============================
    router.get('/api/db/tabelas/:nome/estrutura', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const tabela = ctx.params.nome.replace(/[^a-z_]/gi, '');

        let colunas;
        if (USE_PG) {
            colunas = await rawAll(
                `SELECT column_name AS nome, data_type AS tipo,
                        is_nullable AS nulo, column_default AS padrao
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1
                 ORDER BY ordinal_position`, [tabela]);
        } else {
            const raw = await all(`PRAGMA table_info(${tabela})`);
            colunas = raw.map(c => ({
                nome: c.name, tipo: c.type, nulo: c.notnull ? 'NO' : 'YES', padrao: c.dflt_value,
            }));
        }

        let indices;
        if (USE_PG) {
            indices = await rawAll(
                `SELECT indexname AS nome, indexdef AS definicao
                 FROM pg_indexes WHERE tablename = $1`, [tabela]);
        } else {
            indices = await all(`PRAGMA index_list(${tabela})`);
        }

        return { tabela, colunas, indices };
    });

    // ==================== DADOS DE UMA TABELA (paginado) =====================
    router.get('/api/db/tabelas/:nome/dados', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const tabela = ctx.params.nome.replace(/[^a-z_]/gi, '');
        const pagina = Math.max(1, parseInt(ctx.query.pagina) || 1);
        const porPagina = Math.min(200, Math.max(5, parseInt(ctx.query.por_pagina) || 50));
        const offset = (pagina - 1) * porPagina;
        const direcao = ctx.query.direcao === 'DESC' ? 'DESC' : 'ASC';
        const busca = ctx.query.busca || '';

        // Descobre colunas para definir ordem padrão (nem toda tabela tem 'id')
        let todasColunas;
        if (USE_PG) {
            todasColunas = (await rawAll(
                `SELECT column_name FROM information_schema.columns
                 WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [tabela]
            )).map(c => c.column_name);
        } else {
            todasColunas = (await all(`PRAGMA table_info(${tabela})`)).map(c => c.name);
        }
        const colPadrao = todasColunas.includes('id') ? 'id' : todasColunas[0] || 'rowid';
        const ordenarRaw = (ctx.query.ordenar || '').replace(/[^a-z_]/gi, '');
        const ordenar = (ordenarRaw && todasColunas.includes(ordenarRaw)) ? ordenarRaw : colPadrao;

        let whereClause = '';
        const params = [];

        if (busca) {
            let cols;
            if (USE_PG) {
                cols = await rawAll(
                    `SELECT column_name FROM information_schema.columns
                     WHERE table_schema='public' AND table_name=$1 AND data_type IN ('text','character varying')`,
                    [tabela]);
                cols = cols.map(c => c.column_name);
            } else {
                const raw = await all(`PRAGMA table_info(${tabela})`);
                cols = raw.filter(c => c.type === 'TEXT').map(c => c.name);
            }
            if (cols.length) {
                const conds = cols.map(() => USE_PG ? `COALESCE(??::text,'') ILIKE $${params.length + 1}` : `COALESCE(??, '') LIKE ?`);
                if (USE_PG) {
                    whereClause = 'WHERE ' + cols.map(c => `COALESCE(${c}::text,'') ILIKE $1`).join(' OR ');
                    params.push(`%${busca}%`);
                } else {
                    whereClause = 'WHERE ' + cols.map(c => `COALESCE(${c}, '') LIKE ?`).join(' OR ');
                    for (let i = 0; i < cols.length; i++) params.push(`%${busca}%`);
                }
            }
        }

        const totalRow = USE_PG
            ? await rawAll(`SELECT COUNT(*) AS total FROM ${tabela} ${whereClause}`, params)
            : await all(`SELECT COUNT(*) AS total FROM ${tabela} ${whereClause}`, params);
        const total = Number(totalRow[0].total);

        let dados;
        if (USE_PG) {
            dados = await rawAll(
                `SELECT * FROM ${tabela} ${whereClause} ORDER BY ${ordenar} ${direcao} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, porPagina, offset]);
        } else {
            dados = await all(
                `SELECT * FROM ${tabela} ${whereClause} ORDER BY ${ordenar} ${direcao} LIMIT ? OFFSET ?`,
                [...params, porPagina, offset]);
        }

        const colunas = dados.length ? Object.keys(dados[0]) : [];

        return {
            tabela, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina),
            colunas, dados,
        };
    });

    // ==================== CONSOLE SQL (somente SELECT) =======================
    router.post('/api/db/query', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const { sql } = ctx.body || {};
        if (!sql || typeof sql !== 'string') throw new HttpError(400, 'Envie o campo "sql".');

        const limpo = sql.trim().replace(/;+$/, '').trim();
        if (!/^\s*SELECT\b/i.test(limpo)) {
            throw new HttpError(403, 'Apenas consultas SELECT são permitidas.');
        }
        const proibidos = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE)\b/i;
        if (proibidos.test(limpo)) {
            throw new HttpError(403, 'Consulta contém comandos não permitidos.');
        }

        const limitado = /\bLIMIT\b/i.test(limpo) ? limpo : `${limpo} LIMIT 500`;

        try {
            const inicio = Date.now();
            const dados = USE_PG
                ? await rawAll(limitado)
                : await all(limitado);
            const ms = Date.now() - inicio;
            const colunas = dados.length ? Object.keys(dados[0]) : [];
            return { colunas, dados, total: dados.length, tempo_ms: ms };
        } catch (e) {
            throw new HttpError(400, `Erro na consulta: ${e.message}`);
        }
    });
}
