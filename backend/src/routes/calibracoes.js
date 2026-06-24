// ============================================================================
//  MetroControl — Calibrações, Checagens, Vencimentos, Alertas e Calendário
// ============================================================================
import { all, get, run, transaction } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirEscrita } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

/** Soma meses a uma data ISO e devolve YYYY-MM-DD. */
function somarMeses(dataISO, meses) {
    if (!dataISO || !meses) return null;
    const d = new Date(dataISO);
    d.setMonth(d.getMonth() + Number(meses));
    return d.toISOString().slice(0, 10);
}

export function register(router) {
    // ====================  CALIBRAÇÕES  ==================================
    router.get('/api/calibracoes', async (ctx) => {
        await autenticar(ctx);
        const where = ['c.excluido_em IS NULL']; const params = [];
        if (ctx.query.padrao_id) { where.push('c.padrao_id = ?'); params.push(ctx.query.padrao_id); }
        return await all(
            `SELECT c.*, p.codigo_interno, p.modelo FROM calibracoes c
             JOIN padroes p ON p.id = c.padrao_id
             WHERE ${where.join(' AND ')} ORDER BY c.data_calibracao DESC LIMIT 500`, params);
    });

    router.post('/api/calibracoes', async (ctx) => {
        await exigirEscrita(ctx);
        const b = ctx.body || {};
        const padrao = await get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [b.padrao_id]);
        if (!padrao) throw new HttpError(404, 'Padrão não encontrado.');
        if (!b.data_calibracao) throw new HttpError(400, 'Informe a data da calibração.');

        const proxima = b.data_proxima ||
            somarMeses(b.data_calibracao, padrao.periodicidade_calibracao_meses);

        return await transaction(async () => {
            const r = await run(
                `INSERT INTO calibracoes
                  (padrao_id, data_calibracao, data_proxima, numero_certificado, laboratorio,
                   rastreabilidade, resultado, incerteza, custo, observacoes, criado_por, atualizado_por)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    b.padrao_id, b.data_calibracao, proxima, b.numero_certificado || null,
                    b.laboratorio || null, b.rastreabilidade || null, b.resultado || null,
                    b.incerteza || null, b.custo || null, b.observacoes || null,
                    ctx.usuario.id, ctx.usuario.id,
                ]
            );
            // Atualiza as datas de calibração no próprio padrão.
            let novoStatus = padrao.status;
            if (b.resultado === 'reprovado') novoStatus = 'fora_operacao';
            else if (padrao.status === 'fora_operacao') novoStatus = 'disponivel';
            await run(`UPDATE padroes SET data_ultima_calibracao=?, data_proxima_calibracao=?,
                     status=?, atualizado_em=datetime('now') WHERE id = ?`,
                [b.data_calibracao, proxima, novoStatus, b.padrao_id]);
            await registrarAuditoria(ctx, 'CALIBRACAO', 'calibracoes', r.lastInsertRowid,
                `Calibração registrada para ${padrao.codigo_interno} (${b.resultado || 'sem resultado'})`);
            ctx.status = 201;
            return await get(`SELECT * FROM calibracoes WHERE id = ?`, [r.lastInsertRowid]);
        });
    });

    // ====================  CHECAGENS  ====================================
    router.get('/api/checagens', async (ctx) => {
        await autenticar(ctx);
        const where = ['c.excluido_em IS NULL']; const params = [];
        if (ctx.query.padrao_id) { where.push('c.padrao_id = ?'); params.push(ctx.query.padrao_id); }
        return await all(
            `SELECT c.*, p.codigo_interno FROM checagens c
             JOIN padroes p ON p.id = c.padrao_id
             WHERE ${where.join(' AND ')} ORDER BY c.data_checagem DESC LIMIT 500`, params);
    });

    router.post('/api/checagens', async (ctx) => {
        await exigirEscrita(ctx);
        const b = ctx.body || {};
        const padrao = await get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [b.padrao_id]);
        if (!padrao) throw new HttpError(404, 'Padrão não encontrado.');
        if (!b.data_checagem) throw new HttpError(400, 'Informe a data da checagem.');
        const proxima = b.data_proxima ||
            somarMeses(b.data_checagem, padrao.periodicidade_checagem_meses);
        return await transaction(async () => {
            const r = await run(
                `INSERT INTO checagens
                  (padrao_id, data_checagem, data_proxima, metodo, resultado,
                   responsavel_id, responsavel_nome, observacoes, criado_por, atualizado_por)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [
                    b.padrao_id, b.data_checagem, proxima, b.metodo || null, b.resultado || null,
                    ctx.usuario.id, ctx.usuario.nome, b.observacoes || null,
                    ctx.usuario.id, ctx.usuario.id,
                ]
            );
            await run(`UPDATE padroes SET data_ultima_checagem=?, data_proxima_checagem=?,
                     atualizado_em=datetime('now') WHERE id = ?`,
                [b.data_checagem, proxima, b.padrao_id]);
            await registrarAuditoria(ctx, 'CHECAGEM', 'checagens', r.lastInsertRowid,
                `Checagem registrada para ${padrao.codigo_interno}`);
            ctx.status = 201;
            return await get(`SELECT * FROM checagens WHERE id = ?`, [r.lastInsertRowid]);
        });
    });

    // ====================  PAINEL DE VENCIMENTOS  ========================
    router.get('/api/vencimentos', async (ctx) => {
        await autenticar(ctx);
        // Agrega calibrações e checagens em uma lista única classificada.
        const linhas = await all(
            `SELECT id, codigo_interno, modelo, tipo_instrumento, 'calibracao' AS tipo,
                    data_proxima_calibracao AS vence_em,
                    CAST(julianday(data_proxima_calibracao) - julianday('now') AS INTEGER) AS dias
             FROM padroes
             WHERE excluido_em IS NULL AND data_proxima_calibracao IS NOT NULL
             UNION ALL
             SELECT id, codigo_interno, modelo, tipo_instrumento, 'checagem' AS tipo,
                    data_proxima_checagem AS vence_em,
                    CAST(julianday(data_proxima_checagem) - julianday('now') AS INTEGER) AS dias
             FROM padroes
             WHERE excluido_em IS NULL AND data_proxima_checagem IS NOT NULL
             ORDER BY dias ASC`
        );
        const cat = { vencidos: [], em_7: [], em_15: [], em_30: [], futuros: [] };
        for (const l of linhas) {
            const dias = Number(l.dias);
            if (dias < 0) cat.vencidos.push(l);
            else if (dias <= 7) cat.em_7.push(l);
            else if (dias <= 15) cat.em_15.push(l);
            else if (dias <= 30) cat.em_30.push(l);
            else cat.futuros.push(l);
        }
        return cat;
    });

    // ====================  ALERTAS (badge/sino)  =========================
    router.get('/api/alertas', async (ctx) => {
        await autenticar(ctx);
        const cont = await get(
            `SELECT
               SUM(CASE WHEN dias < 0 THEN 1 ELSE 0 END) AS vencidos,
               SUM(CASE WHEN dias BETWEEN 0 AND 7  THEN 1 ELSE 0 END) AS em_7,
               SUM(CASE WHEN dias BETWEEN 8 AND 15 THEN 1 ELSE 0 END) AS em_15,
               SUM(CASE WHEN dias BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS em_30
             FROM (
               SELECT CAST(julianday(data_proxima_calibracao)-julianday('now') AS INTEGER) AS dias
               FROM padroes WHERE excluido_em IS NULL AND data_proxima_calibracao IS NOT NULL
               UNION ALL
               SELECT CAST(julianday(data_proxima_checagem)-julianday('now') AS INTEGER) AS dias
               FROM padroes WHERE excluido_em IS NULL AND data_proxima_checagem IS NOT NULL
             ) sub`
        );
        const v = Number(cont.vencidos) || 0, a = Number(cont.em_7) || 0,
              b = Number(cont.em_15) || 0, c = Number(cont.em_30) || 0;
        return { vencidos: v, em_7: a, em_15: b, em_30: c, total: v + a + b + c };
    });

    // ====================  CALENDÁRIO DE EVENTOS  ========================
    router.get('/api/calendario', async (ctx) => {
        await autenticar(ctx);
        return await all(
            `SELECT codigo_interno AS titulo, data_proxima_calibracao AS data, 'Calibração' AS tipo
             FROM padroes WHERE excluido_em IS NULL AND data_proxima_calibracao IS NOT NULL
             UNION ALL
             SELECT codigo_interno, data_proxima_checagem, 'Checagem'
             FROM padroes WHERE excluido_em IS NULL AND data_proxima_checagem IS NOT NULL
             ORDER BY data ASC`);
    });
}
