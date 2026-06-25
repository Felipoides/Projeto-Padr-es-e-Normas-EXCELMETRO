// ============================================================================
//  MetroControl — Camada de acesso ao banco de dados
//
//  Suporta DOIS bancos com a MESMA interface assíncrona:
//   • PostgreSQL (produção)  — driver `pg`, ativado por DATABASE_URL.
//   • SQLite     (dev/teste) — módulo nativo node:sqlite, padrão local.
//
//  Variáveis:
//   DATABASE_URL  -> usa PostgreSQL (ex.: postgres://user:pass@host:5432/db)
//   PG_MEM=1      -> usa PostgreSQL em memória (pg-mem) p/ testes
//   DB_PATH       -> caminho do arquivo SQLite (se não usar PostgreSQL)
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../../data/metrocontrol.db');

const USE_PG = !!(process.env.DATABASE_URL || process.env.PG_MEM);

// Escopo de transação por contexto assíncrono (cada requisição é isolada).
const als = new AsyncLocalStorage();

// Tabelas sem coluna "id" serial (não recebem RETURNING id no PostgreSQL).
const SEM_ID = new Set(['servico_padroes', 'servico_normas', 'configuracoes']);

let _pool = null;      // pool PostgreSQL
let _sqlite = null;    // conexão SQLite
let _pgmem = null;     // instância pg-mem (para testes)

// ---------------------------------------------------------------------------
//  Inicialização do driver (top-level await — resolvido antes do uso)
// ---------------------------------------------------------------------------
if (USE_PG) {
    if (process.env.PG_MEM) {
        const { newDb, DataType } = await import('pg-mem');
        _pgmem = newDb();
        // pg-mem não implementa to_char; registramos o mínimo necessário.
        // (O PostgreSQL real já possui to_char nativamente.)
        const fmtToChar = (d, fmt) => {
            if (d == null) return null;
            const dt = d instanceof Date ? d : new Date(d);
            const p = (n) => String(n).padStart(2, '0');
            return String(fmt)
                .replace(/YYYY/g, dt.getFullYear())
                .replace(/HH24/g, p(dt.getHours()))
                .replace(/MI/g, p(dt.getMinutes()))
                .replace(/SS/g, p(dt.getSeconds()))
                .replace(/MM/g, p(dt.getMonth() + 1))
                .replace(/DD/g, p(dt.getDate()));
        };
        for (const tipo of [DataType.timestamptz, DataType.timestamp]) {
            _pgmem.public.registerFunction({
                name: 'to_char', args: [tipo, DataType.text], returns: DataType.text,
                implementation: fmtToChar, impure: true,
            });
        }
        const { Pool } = _pgmem.adapters.createPg();
        _pool = new Pool();
    } else {
        const pg = (await import('pg')).default;
        _pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
            max: Number(process.env.PG_POOL_MAX) || 10,
        });
    }
} else {
    const { DatabaseSync } = await import('node:sqlite');
    _sqlite = new DatabaseSync(DB_PATH);
    _sqlite.exec('PRAGMA foreign_keys = ON;');
    _sqlite.exec('PRAGMA journal_mode = WAL;');
    _sqlite.exec('PRAGMA busy_timeout = 5000;');
}

// ---------------------------------------------------------------------------
//  Tradução de dialeto: converte SQL "estilo SQLite" para PostgreSQL.
//  (No modo SQLite o SQL é usado como está.)
// ---------------------------------------------------------------------------
function traduzPg(sql) {
    let s = sql;
    // Placeholders posicionais: ?  ->  $1, $2, ...
    let i = 0;
    s = s.replace(/\?/g, () => `$${++i}`);
    // Datas/horas relativas
    s = s.replace(/datetime\('now'\)/gi, `to_char(now(),'YYYY-MM-DD HH24:MI:SS')`);
    s = s.replace(/date\('now'\s*,\s*'([+-]?\d+)\s+(day|month|year)'\)/gi,
        (_m, n, u) => `to_char((now() + interval '${n.replace('+', '')} ${u}'),'YYYY-MM-DD')`);
    s = s.replace(/date\('now'\)/gi, `to_char(now(),'YYYY-MM-DD')`);
    // julianday(...) -> data (para diferenças em dias)
    s = s.replace(/julianday\('now'\)/gi, `now()::date`);
    s = s.replace(/julianday\(\s*([^)]+?)\s*\)/gi, `($1)::timestamp::date`);
    // strftime('%Y-%m', X) -> to_char
    s = s.replace(/strftime\('%Y-%m'\s*,\s*([^)]+?)\)/gi, `to_char(($1)::timestamp,'YYYY-MM')`);
    // INSERT OR IGNORE / OR REPLACE
    let onConflict = '';
    if (/insert\s+or\s+ignore/i.test(s)) onConflict = ' ON CONFLICT DO NOTHING';
    s = s.replace(/insert\s+or\s+(?:ignore|replace)\s+into/gi, 'INSERT INTO');
    return s + onConflict;
}

// ---------------------------------------------------------------------------
//  API de consulta (assíncrona em ambos os drivers)
// ---------------------------------------------------------------------------
/** Retorna várias linhas. */
export async function all(sql, params = []) {
    if (USE_PG) {
        const client = als.getStore()?.client || _pool;
        return (await client.query(traduzPg(sql), params)).rows;
    }
    return _sqlite.prepare(sql).all(...params);
}

/** Retorna uma linha (ou undefined). */
export async function get(sql, params = []) {
    if (USE_PG) {
        const client = als.getStore()?.client || _pool;
        return (await client.query(traduzPg(sql), params)).rows[0];
    }
    return _sqlite.prepare(sql).get(...params);
}

/** Executa INSERT/UPDATE/DELETE. Retorna { changes, lastInsertRowid }. */
export async function run(sql, params = []) {
    if (USE_PG) {
        let s = sql;
        if (/^\s*insert\s/i.test(sql) && !/returning/i.test(sql)) {
            const m = /insert\s+(?:or\s+\w+\s+)?into\s+([a-z_][\w]*)/i.exec(sql);
            const tabela = m ? m[1].toLowerCase() : null;
            if (tabela && !SEM_ID.has(tabela)) s = sql.replace(/;?\s*$/, ' RETURNING id');
        }
        const client = als.getStore()?.client || _pool;
        const r = await client.query(traduzPg(s), params);
        return { changes: r.rowCount, lastInsertRowid: r.rows?.[0]?.id, rows: r.rows };
    }
    const r = _sqlite.prepare(sql).run(...params);
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
}

/** Executa uma função dentro de uma transação atômica. */
export async function transaction(fn) {
    if (USE_PG) {
        const client = await _pool.connect();
        try {
            await client.query('BEGIN');
            const res = await als.run({ client }, fn);
            await client.query('COMMIT');
            return res;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }
    _sqlite.exec('BEGIN');
    try { const r = await fn(); _sqlite.exec('COMMIT'); return r; }
    catch (err) { _sqlite.exec('ROLLBACK'); throw err; }
}

// ---------------------------------------------------------------------------
//  Schema + migrações
// ---------------------------------------------------------------------------
/** Cria o schema (idempotente) e aplica migrações de colunas novas. */
export async function initSchema() {
    const arquivo = USE_PG ? 'schema.pg.sql' : 'schema.sql';
    const sql = readFileSync(join(__dirname, arquivo), 'utf8');
    if (USE_PG) {
        // Executa statement a statement (compatível com pg e pg-mem).
        const limpo = sql.replace(/^\s*--.*$/gm, '');
        for (const stmt of limpo.split(';')) {
            const t = stmt.trim();
            if (!t) continue;
            // pg-mem (modo teste) tem bug no planejador com índice em coluna
            // anulável; pulamos CREATE INDEX só nele. No PostgreSQL real os
            // índices são criados normalmente (ganho de performance).
            if (process.env.PG_MEM && /^CREATE\s+INDEX/i.test(t)) continue;
            await _pool.query(t);
        }
    } else {
        _sqlite.exec(sql);
    }
    await migrar();
}

/** Adiciona colunas novas a bancos já existentes (idempotente). */
async function migrar() {
    const novas = {
        padroes: [
            ['capacidade', 'TEXT'], ['unidade', 'TEXT'], ['tolerancia', 'TEXT'],
            ['lacre', 'TEXT'], ['departamento', 'TEXT'], ['usuario_instrumento', 'TEXT'],
            ['procedimento', 'TEXT'], ['instrucoes', 'TEXT'], ['procedimento_verificacao', 'TEXT'],
            ['codigo_barras', 'TEXT'], ['travado', 'INTEGER NOT NULL DEFAULT 0'],
        ],
        movimentacoes: [
            ['os_numero', 'TEXT'],
        ],
        servicos: [
            ['os_numero', 'TEXT'],
        ],
    };
    for (const [tabela, colunas] of Object.entries(novas)) {
        if (USE_PG) {
            for (const [nome, tipo] of colunas) {
                await _pool.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${nome} ${tipo}`);
            }
        } else {
            const existentes = _sqlite.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
            for (const [nome, tipo] of colunas) {
                if (!existentes.includes(nome)) _sqlite.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${tipo}`);
            }
        }
    }
}

/** Executa SQL sem tradução de dialeto (para consultas nativas do driver). */
export async function rawAll(sql, params = []) {
    if (USE_PG) {
        const client = als.getStore()?.client || _pool;
        return (await client.query(sql, params)).rows;
    }
    return _sqlite.prepare(sql).all(...params);
}

export { DB_PATH, USE_PG };
