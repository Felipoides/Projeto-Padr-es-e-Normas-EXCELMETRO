// ============================================================================
//  MetroControl — Rotas do módulo NORMAS (biblioteca digital + versionamento)
// ============================================================================
import { all, get, run } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirEscrita } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

const CAMPOS = ['codigo', 'nome', 'revisao', 'data_emissao', 'data_revisao',
    'area_aplicacao', 'organismo', 'status', 'arquivo_pdf', 'observacoes'];

export function register(router) {
    router.get('/api/normas', async (ctx) => {
        await autenticar(ctx);
        const where = ['excluido_em IS NULL']; const params = [];
        if (ctx.query.busca) {
            const t = `%${ctx.query.busca}%`;
            where.push('(codigo LIKE ? OR nome LIKE ? OR area_aplicacao LIKE ? OR organismo LIKE ?)');
            params.push(t, t, t, t);
        }
        if (ctx.query.status) { where.push('status = ?'); params.push(ctx.query.status); }
        return await all(`SELECT * FROM normas WHERE ${where.join(' AND ')} ORDER BY codigo`, params);
    });

    router.get('/api/normas/:id', async (ctx) => {
        await autenticar(ctx);
        const n = await get(`SELECT * FROM normas WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!n) throw new HttpError(404, 'Norma não encontrada.');
        return {
            ...n,
            revisoes: await all(`SELECT * FROM norma_revisoes WHERE norma_id = ? ORDER BY criado_em DESC`, [n.id]),
            servicos: await all(`SELECT s.id, s.codigo, s.nome FROM servico_normas sn
                           JOIN servicos s ON s.id = sn.servico_id
                           WHERE sn.norma_id = ? AND s.excluido_em IS NULL`, [n.id]),
        };
    });

    router.post('/api/normas', async (ctx) => {
        await exigirEscrita(ctx);
        const b = ctx.body || {};
        if (!b.codigo || !b.nome) throw new HttpError(400, 'Código e nome são obrigatórios.');
        const cols = [...CAMPOS, 'criado_por', 'atualizado_por'];
        const vals = [...CAMPOS.map((c) => b[c] ?? null), ctx.usuario.id, ctx.usuario.id];
        const r = await run(`INSERT INTO normas (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
        await registrarAuditoria(ctx, 'CRIAR', 'normas', r.lastInsertRowid, `Norma ${b.codigo} cadastrada`);
        ctx.status = 201;
        return await get(`SELECT * FROM normas WHERE id = ?`, [r.lastInsertRowid]);
    });

    router.put('/api/normas/:id', async (ctx) => {
        await exigirEscrita(ctx);
        const antes = await get(`SELECT * FROM normas WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!antes) throw new HttpError(404, 'Norma não encontrada.');
        const b = ctx.body || {};
        // Se a revisão mudou, registra histórico (versionamento).
        if (b.revisao && b.revisao !== antes.revisao) {
            await run(`INSERT INTO norma_revisoes (norma_id, revisao, data_revisao, descricao, arquivo_pdf, criado_por)
                 VALUES (?,?,?,?,?,?)`,
                [antes.id, antes.revisao, antes.data_revisao,
                 `Revisão anterior arquivada automaticamente`, antes.arquivo_pdf, ctx.usuario.id]);
        }
        const sets = [], vals = [];
        for (const c of CAMPOS) if (c in b) { sets.push(`${c}=?`); vals.push(b[c]); }
        sets.push(`atualizado_em=datetime('now')`, `atualizado_por=?`);
        vals.push(ctx.usuario.id, ctx.params.id);
        await run(`UPDATE normas SET ${sets.join(',')} WHERE id = ?`, vals);
        const depois = await get(`SELECT * FROM normas WHERE id = ?`, [ctx.params.id]);
        await registrarAuditoria(ctx, 'EDITAR', 'normas', antes.id, `Norma ${antes.codigo} editada`, antes, depois);
        return depois;
    });

    router.delete('/api/normas/:id', async (ctx) => {
        await exigirEscrita(ctx);
        const n = await get(`SELECT * FROM normas WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!n) throw new HttpError(404, 'Norma não encontrada.');
        const { confirmar, motivo } = ctx.body || {};
        if (confirmar !== true) throw new HttpError(400, 'Confirmação dupla obrigatória (confirmar: true).');
        if (!motivo) throw new HttpError(400, 'Informe o motivo da exclusão.');
        await run(`UPDATE normas SET excluido_em=datetime('now'), excluido_por=?, motivo_exclusao=? WHERE id = ?`,
            [ctx.usuario.id, motivo, n.id]);
        await registrarAuditoria(ctx, 'EXCLUIR', 'normas', n.id, `Exclusão lógica: ${motivo}`, n, null);
        return { ok: true, mensagem: 'Norma movida para a lixeira.' };
    });
}
