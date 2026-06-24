// ============================================================================
//  MetroControl — Backup e Restauração de Dados
//  Exporta/importa todas as tabelas em JSON. Funciona em SQLite e PostgreSQL
//  sem depender de pg_dump/pg_restore.
// ============================================================================
import { all, run, transaction, USE_PG } from '../db/database.js';
import { exigirPerfil } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';
import { HttpError } from '../lib/http.js';

// Ordem de inserção: tabelas-pai primeiro, filhas depois.
// Para DELETE, usa-se a ordem INVERSA (filhas primeiro → evita FK violations).
const TABELAS = [
    'configuracoes',
    'usuarios',
    'clientes',
    'normas',
    'norma_revisoes',
    'padroes',
    'anexos',
    'servicos',
    'servico_padroes',
    'servico_normas',
    'calibracoes',
    'checagens',
    'movimentacoes',
    'auditoria',
];

export function register(router) {
    // ==================== EXPORTAR BACKUP (JSON) =============================
    router.get('/api/backup/exportar', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');

        const dados = {};
        for (const tabela of TABELAS) {
            dados[tabela] = await all(`SELECT * FROM ${tabela}`);
        }

        const backup = {
            metrocontrol_backup: true,
            versao: '1.0',
            banco: USE_PG ? 'postgresql' : 'sqlite',
            criado_em: new Date().toISOString(),
            criado_por: ctx.usuario.nome,
            total_registros: Object.values(dados).reduce((s, t) => s + t.length, 0),
            tabelas: dados,
        };

        await registrarAuditoria(ctx, 'BACKUP', 'sistema', null,
            `Backup exportado (${backup.total_registros} registros)`);

        const json = JSON.stringify(backup, null, 2);
        const agora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return {
            __download: true,
            contentType: 'application/json; charset=utf-8',
            filename: `metrocontrol-backup-${agora}.json`,
            body: json,
        };
    });

    // ==================== IMPORTAR / RESTAURAR ===============================
    router.post('/api/backup/restaurar', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const body = ctx.body;

        if (!body || !body.metrocontrol_backup) {
            throw new HttpError(400, 'Arquivo inválido. Envie um backup JSON do MetroControl.');
        }
        if (!body.tabelas || typeof body.tabelas !== 'object') {
            throw new HttpError(400, 'Backup corrompido — campo "tabelas" ausente.');
        }
        if (body.confirmar !== true) {
            throw new HttpError(400,
                'Confirmação obrigatória. Envie confirmar: true para prosseguir. ' +
                'ATENÇÃO: esta ação substitui TODOS os dados atuais!');
        }

        const resultado = { tabelas_restauradas: 0, registros_inseridos: 0, erros: [] };

        await transaction(async () => {
            // Limpa na ordem inversa (respeita FKs)
            for (const tabela of [...TABELAS].reverse()) {
                try { await run(`DELETE FROM ${tabela}`); }
                catch (e) { resultado.erros.push(`Limpar ${tabela}: ${e.message}`); }
            }

            // Reseta sequences no PostgreSQL
            if (USE_PG) {
                for (const tabela of TABELAS) {
                    try { await run(`ALTER SEQUENCE ${tabela}_id_seq RESTART WITH 1`); }
                    catch (_) { /* tabela sem sequence */ }
                }
            }

            // Insere dados — usa placeholders ? (o run() traduz para $n no PG)
            for (const tabela of TABELAS) {
                const linhas = body.tabelas[tabela];
                if (!Array.isArray(linhas) || linhas.length === 0) continue;

                const colunas = Object.keys(linhas[0]);
                const placeholders = colunas.map(() => '?').join(',');
                const sqlBase = `INSERT INTO ${tabela} (${colunas.join(',')}) VALUES (${placeholders})`;

                for (const linha of linhas) {
                    try {
                        const valores = colunas.map(c => linha[c] ?? null);
                        await run(sqlBase, valores);
                        resultado.registros_inseridos++;
                    } catch (e) {
                        resultado.erros.push(`${tabela} id=${linha.id}: ${e.message}`);
                    }
                }

                // Reajusta sequence para o MAX(id) atual
                if (USE_PG) {
                    try { await run(`SELECT setval('${tabela}_id_seq', COALESCE((SELECT MAX(id) FROM ${tabela}), 1))`); }
                    catch (_) { /* sem sequence */ }
                }

                resultado.tabelas_restauradas++;
            }
        });

        await registrarAuditoria(ctx, 'RESTAURAR_BACKUP', 'sistema', null,
            `Backup restaurado: ${resultado.registros_inseridos} registros em ${resultado.tabelas_restauradas} tabelas`);

        return {
            ok: true,
            mensagem: `Restauração concluída: ${resultado.registros_inseridos} registros restaurados.`,
            ...resultado,
        };
    });

    // ==================== INFO DO BANCO ======================================
    router.get('/api/backup/info', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const info = { banco: USE_PG ? 'PostgreSQL' : 'SQLite', tabelas: {} };
        for (const tabela of TABELAS) {
            const r = await all(`SELECT COUNT(*) as total FROM ${tabela}`);
            info.tabelas[tabela] = Number(r[0].total);
        }
        info.total_registros = Object.values(info.tabelas).reduce((s, n) => s + n, 0);
        return info;
    });
}
