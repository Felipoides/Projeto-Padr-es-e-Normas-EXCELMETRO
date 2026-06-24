// ============================================================================
//  MetroControl — Rotas do módulo SERVIÇOS (com padrões e normas vinculados)
// ============================================================================
import { all, get, run, transaction } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirEscrita } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

const CAMPOS = ['codigo', 'nome', 'descricao', 'procedimento', 'cliente_id', 'cliente_nome',
    'tecnico_id', 'tecnico_nome', 'data_inicio', 'data_conclusao', 'status', 'observacoes'];

function vincular(servicoId, padroes = [], normas = []) {
    run(`DELETE FROM servico_padroes WHERE servico_id = ?`, [servicoId]);
    run(`DELETE FROM servico_normas  WHERE servico_id = ?`, [servicoId]);
    for (const pid of padroes) run(`INSERT OR IGNORE INTO servico_padroes (servico_id, padrao_id) VALUES (?,?)`, [servicoId, pid]);
    for (const nid of normas) run(`INSERT OR IGNORE INTO servico_normas (servico_id, norma_id) VALUES (?,?)`, [servicoId, nid]);
}

export function register(router) {
    router.get('/api/servicos', async (ctx) => {
        autenticar(ctx);
        const where = ['s.excluido_em IS NULL']; const params = [];
        if (ctx.query.busca) {
            const t = `%${ctx.query.busca}%`;
            where.push('(s.codigo LIKE ? OR s.nome LIKE ? OR s.cliente_nome LIKE ? OR s.tecnico_nome LIKE ?)');
            params.push(t, t, t, t);
        }
        if (ctx.query.status) { where.push('s.status = ?'); params.push(ctx.query.status); }
        return all(`SELECT s.* FROM servicos s WHERE ${where.join(' AND ')} ORDER BY s.data_inicio DESC, s.id DESC`, params);
    });

    router.get('/api/servicos/:id', async (ctx) => {
        autenticar(ctx);
        const s = get(`SELECT * FROM servicos WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!s) throw new HttpError(404, 'Serviço não encontrado.');
        return {
            ...s,
            padroes: all(`SELECT p.id, p.codigo_interno, p.modelo, p.tipo_instrumento
                          FROM servico_padroes sp JOIN padroes p ON p.id = sp.padrao_id
                          WHERE sp.servico_id = ?`, [s.id]),
            normas: all(`SELECT n.id, n.codigo, n.nome FROM servico_normas sn
                         JOIN normas n ON n.id = sn.norma_id WHERE sn.servico_id = ?`, [s.id]),
        };
    });

    router.post('/api/servicos', async (ctx) => {
        exigirEscrita(ctx);
        const b = ctx.body || {};
        if (!b.nome) throw new HttpError(400, 'Nome do serviço é obrigatório.');
        return transaction(() => {
            const cols = [...CAMPOS, 'criado_por', 'atualizado_por'];
            const vals = [...CAMPOS.map((c) => b[c] ?? null), ctx.usuario.id, ctx.usuario.id];
            const r = run(`INSERT INTO servicos (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
            vincular(r.lastInsertRowid, b.padroes, b.normas);
            registrarAuditoria(ctx, 'CRIAR', 'servicos', r.lastInsertRowid, `Serviço "${b.nome}" criado`);
            ctx.status = 201;
            return get(`SELECT * FROM servicos WHERE id = ?`, [r.lastInsertRowid]);
        });
    });

    router.put('/api/servicos/:id', async (ctx) => {
        exigirEscrita(ctx);
        const antes = get(`SELECT * FROM servicos WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!antes) throw new HttpError(404, 'Serviço não encontrado.');
        const b = ctx.body || {};
        return transaction(() => {
            const sets = [], vals = [];
            for (const c of CAMPOS) if (c in b) { sets.push(`${c}=?`); vals.push(b[c]); }
            if (sets.length) {
                sets.push(`atualizado_em=datetime('now')`, `atualizado_por=?`);
                vals.push(ctx.usuario.id, ctx.params.id);
                run(`UPDATE servicos SET ${sets.join(',')} WHERE id = ?`, vals);
            }
            if (b.padroes || b.normas) vincular(antes.id, b.padroes || [], b.normas || []);
            const depois = get(`SELECT * FROM servicos WHERE id = ?`, [antes.id]);
            registrarAuditoria(ctx, 'EDITAR', 'servicos', antes.id, `Serviço "${antes.nome}" editado`, antes, depois);
            return depois;
        });
    });

    router.delete('/api/servicos/:id', async (ctx) => {
        exigirEscrita(ctx);
        const s = get(`SELECT * FROM servicos WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!s) throw new HttpError(404, 'Serviço não encontrado.');
        const { confirmar, motivo } = ctx.body || {};
        if (confirmar !== true) throw new HttpError(400, 'Confirmação dupla obrigatória (confirmar: true).');
        if (!motivo) throw new HttpError(400, 'Informe o motivo da exclusão.');
        run(`UPDATE servicos SET excluido_em=datetime('now'), excluido_por=?, motivo_exclusao=? WHERE id = ?`,
            [ctx.usuario.id, motivo, s.id]);
        registrarAuditoria(ctx, 'EXCLUIR', 'servicos', s.id, `Exclusão lógica: ${motivo}`, s, null);
        return { ok: true };
    });

    // ====================  CLIENTES (apoio)  =============================
    router.get('/api/clientes', async (ctx) => {
        autenticar(ctx);
        return all(`SELECT * FROM clientes WHERE excluido_em IS NULL ORDER BY nome`);
    });
    router.post('/api/clientes', async (ctx) => {
        exigirEscrita(ctx);
        const b = ctx.body || {};
        if (!b.nome) throw new HttpError(400, 'Nome do cliente é obrigatório.');
        const r = run(`INSERT INTO clientes (nome, documento, contato, email, telefone, endereco, observacoes, criado_por, atualizado_por)
                       VALUES (?,?,?,?,?,?,?,?,?)`,
            [b.nome, b.documento || null, b.contato || null, b.email || null,
             b.telefone || null, b.endereco || null, b.observacoes || null, ctx.usuario.id, ctx.usuario.id]);
        registrarAuditoria(ctx, 'CRIAR', 'clientes', r.lastInsertRowid, `Cliente "${b.nome}" criado`);
        ctx.status = 201;
        return get(`SELECT * FROM clientes WHERE id = ?`, [r.lastInsertRowid]);
    });
}
