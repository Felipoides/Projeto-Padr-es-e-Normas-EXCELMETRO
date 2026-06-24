// ============================================================================
//  MetroControl — Rotas de MOVIMENTAÇÃO (rastreamento de retirada/devolução)
// ============================================================================
import { all, get, run, transaction } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirEscrita } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

export function register(router) {
    // ---- LISTAR (com filtros) -------------------------------------------
    router.get('/api/movimentacoes', async (ctx) => {
        autenticar(ctx);
        const q = ctx.query;
        const where = ['m.excluido_em IS NULL'];
        const params = [];
        if (q.status) { where.push('m.status = ?'); params.push(q.status); }
        if (q.padrao_id) { where.push('m.padrao_id = ?'); params.push(q.padrao_id); }
        if (q.cliente_id) { where.push('m.cliente_id = ?'); params.push(q.cliente_id); }

        const rows = all(
            `SELECT m.*, p.codigo_interno, p.modelo, p.tipo_instrumento,
                    CAST(julianday('now') - julianday(m.data_retirada) AS INTEGER) AS dias_fora
             FROM movimentacoes m
             JOIN padroes p ON p.id = m.padrao_id
             WHERE ${where.join(' AND ')}
             ORDER BY m.data_retirada DESC LIMIT 500`,
            params
        );
        return rows;
    });

    // ---- PADRÕES ATUALMENTE FORA (visão rápida) -------------------------
    router.get('/api/movimentacoes/abertas', async (ctx) => {
        autenticar(ctx);
        return all(
            `SELECT m.*, p.codigo_interno, p.modelo,
                    CAST(julianday('now') - julianday(m.data_retirada) AS INTEGER) AS dias_fora
             FROM movimentacoes m
             JOIN padroes p ON p.id = m.padrao_id
             WHERE m.status='aberta' AND m.excluido_em IS NULL
             ORDER BY m.data_retirada ASC`
        );
    });

    // ---- REGISTRAR SAÍDA (e, opcionalmente, retorno no mesmo lançamento) -
    router.post('/api/movimentacoes', async (ctx) => {
        exigirEscrita(ctx);
        const b = ctx.body || {};
        if (!b.padrao_id) throw new HttpError(400, 'Informe o padrão.');
        const padrao = get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [b.padrao_id]);
        if (!padrao) throw new HttpError(404, 'Padrão não encontrado.');
        if (padrao.status === 'em_uso')
            throw new HttpError(409, 'Este padrão já está em uso (fora). Registre a devolução primeiro.');
        if (['em_manutencao', 'fora_operacao', 'inativo'].includes(padrao.status))
            throw new HttpError(409, `Padrão indisponível (status: ${padrao.status}).`);

        const cliente = b.cliente_id ? get(`SELECT nome FROM clientes WHERE id = ?`, [b.cliente_id]) : null;
        // Responsável pode ser texto livre (ex.: "Valdir/Alexandre"); senão usa o usuário logado.
        const responsavel = (b.responsavel_nome || '').trim() || ctx.usuario.nome;
        // Se a data de retorno já vier preenchida, a movimentação nasce fechada.
        const jaRetornou = !!b.data_devolucao;

        return transaction(() => {
            const r = run(
                `INSERT INTO movimentacoes
                  (padrao_id, retirado_por, retirado_por_nome, data_retirada, cliente_id, cliente_nome,
                   servico_id, motivo, local_utilizacao, observacoes, status,
                   devolvido_por, devolvido_por_nome, data_devolucao, condicao_devolucao,
                   criado_por, atualizado_por)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    b.padrao_id, ctx.usuario.id, responsavel,
                    b.data_retirada || new Date().toISOString(),
                    b.cliente_id || null, cliente?.nome || b.cliente_nome || null,
                    b.servico_id || null, b.motivo || null, b.local_utilizacao || null,
                    b.observacoes || null, jaRetornou ? 'fechada' : 'aberta',
                    jaRetornou ? ctx.usuario.id : null, jaRetornou ? responsavel : null,
                    b.data_devolucao || null, jaRetornou ? (b.condicao_devolucao || 'boa') : null,
                    ctx.usuario.id, ctx.usuario.id,
                ]
            );
            // Se já retornou, o padrão volta a ficar disponível (ou conforme a condição).
            let novoStatusPadrao = 'em_uso';
            if (jaRetornou) {
                novoStatusPadrao = 'disponivel';
                if (b.condicao_devolucao === 'danificado') novoStatusPadrao = 'em_manutencao';
                if (b.condicao_devolucao === 'requer_calibracao') novoStatusPadrao = 'fora_operacao';
            }
            run(`UPDATE padroes SET status=?, atualizado_em=datetime('now') WHERE id = ?`, [novoStatusPadrao, b.padrao_id]);
            registrarAuditoria(ctx, jaRetornou ? 'MOVIMENTACAO' : 'RETIRADA', 'movimentacoes', r.lastInsertRowid,
                jaRetornou ? `Saída e retorno de ${padrao.codigo_interno} registrados`
                           : `Saída do padrão ${padrao.codigo_interno}`);
            ctx.status = 201;
            return get(`SELECT * FROM movimentacoes WHERE id = ?`, [r.lastInsertRowid]);
        });
    });

    // ---- REGISTRAR DEVOLUÇÃO --------------------------------------------
    router.post('/api/movimentacoes/:id/devolver', async (ctx) => {
        exigirEscrita(ctx);
        const mov = get(`SELECT * FROM movimentacoes WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!mov) throw new HttpError(404, 'Movimentação não encontrada.');
        if (mov.status === 'fechada') throw new HttpError(409, 'Esta movimentação já foi finalizada.');
        const b = ctx.body || {};

        // Se o padrão voltou danificado/requer calibração, ajusta o status dele.
        let novoStatusPadrao = 'disponivel';
        if (b.condicao_devolucao === 'danificado') novoStatusPadrao = 'em_manutencao';
        if (b.condicao_devolucao === 'requer_calibracao') novoStatusPadrao = 'fora_operacao';

        return transaction(() => {
            run(
                `UPDATE movimentacoes SET
                   status='fechada', devolvido_por=?, devolvido_por_nome=?,
                   data_devolucao=?, condicao_devolucao=?, observacoes_devolucao=?,
                   atualizado_em=datetime('now'), atualizado_por=?
                 WHERE id = ?`,
                [
                    ctx.usuario.id, ctx.usuario.nome,
                    b.data_devolucao || new Date().toISOString(),
                    b.condicao_devolucao || 'boa', b.observacoes_devolucao || null,
                    ctx.usuario.id, mov.id,
                ]
            );
            run(`UPDATE padroes SET status=?, atualizado_em=datetime('now') WHERE id = ?`,
                [novoStatusPadrao, mov.padrao_id]);
            registrarAuditoria(ctx, 'DEVOLUCAO', 'movimentacoes', mov.id,
                `Devolução registrada (condição: ${b.condicao_devolucao || 'boa'})`);
            return get(`SELECT * FROM movimentacoes WHERE id = ?`, [mov.id]);
        });
    });

    // ---- DETALHE ---------------------------------------------------------
    router.get('/api/movimentacoes/:id', async (ctx) => {
        autenticar(ctx);
        const m = get(`SELECT m.*, p.codigo_interno FROM movimentacoes m
                       JOIN padroes p ON p.id = m.padrao_id WHERE m.id = ?`, [ctx.params.id]);
        if (!m) throw new HttpError(404, 'Movimentação não encontrada.');
        return m;
    });
}
