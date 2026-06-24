// ============================================================================
//  MetroControl — Camada de acesso ao banco de dados
//  Usa o módulo nativo node:sqlite (Node 22.5+). Sem dependências externas.
// ============================================================================
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Caminho do arquivo do banco (configurável por variável de ambiente).
// Para produção em nuvem, basta apontar DB_PATH para um volume persistente
// ou migrar para PostgreSQL (ver docs/HOSPEDAGEM.md).
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../../data/metrocontrol.db');

export const db = new DatabaseSync(DB_PATH);

// Boas práticas de integridade e performance.
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

/** Executa o schema (idempotente — usa IF NOT EXISTS) e migra colunas novas. */
export function initSchema() {
    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    db.exec(sql);
    migrar();
}

/**
 * Adiciona colunas novas a bancos já existentes (SQLite não tem
 * "ADD COLUMN IF NOT EXISTS"). Idempotente: só adiciona o que falta.
 */
function migrar() {
    const novasColunas = {
        padroes: [
            ['capacidade', 'TEXT'], ['unidade', 'TEXT'], ['tolerancia', 'TEXT'],
            ['lacre', 'TEXT'], ['departamento', 'TEXT'], ['usuario_instrumento', 'TEXT'],
            ['procedimento', 'TEXT'], ['instrucoes', 'TEXT'], ['procedimento_verificacao', 'TEXT'],
            ['codigo_barras', 'TEXT'], ['travado', 'INTEGER NOT NULL DEFAULT 0'],
        ],
    };
    for (const [tabela, colunas] of Object.entries(novasColunas)) {
        const existentes = all(`PRAGMA table_info(${tabela})`).map((c) => c.name);
        for (const [nome, tipo] of colunas) {
            if (!existentes.includes(nome)) {
                db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${tipo}`);
            }
        }
    }
}

// ---- Helpers de consulta -------------------------------------------------

/** Retorna várias linhas. */
export function all(sql, params = []) {
    return db.prepare(sql).all(...params);
}

/** Retorna uma linha (ou undefined). */
export function get(sql, params = []) {
    return db.prepare(sql).get(...params);
}

/** Executa INSERT/UPDATE/DELETE. Retorna { changes, lastInsertRowid }. */
export function run(sql, params = []) {
    return db.prepare(sql).run(...params);
}

/** Executa uma função dentro de uma transação atômica. */
export function transaction(fn) {
    db.exec('BEGIN');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

/** Monta dinamicamente cláusulas WHERE com filtros opcionais. */
export function buildWhere(conditions) {
    const parts = [];
    const params = [];
    for (const [clause, value] of conditions) {
        if (value !== undefined && value !== null && value !== '') {
            parts.push(clause);
            params.push(value);
        }
    }
    return { where: parts.length ? 'WHERE ' + parts.join(' AND ') : '', params };
}

export { DB_PATH };
