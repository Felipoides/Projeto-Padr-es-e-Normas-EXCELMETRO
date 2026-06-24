// ============================================================================
//  MetroControl — Gestão de Usuários e Perfis (RBAC)
// ============================================================================
import { all, get, run } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { exigirPerfil } from '../middleware/auth.js';
import { hashSenha } from '../lib/security.js';
import { registrarAuditoria } from '../lib/audit.js';

const PERFIS = ['administrador', 'gestor', 'tecnico', 'auditor', 'visualizador'];

export function register(router) {
    router.get('/api/usuarios', async (ctx) => {
        exigirPerfil(ctx, 'gestor');
        return all(`SELECT id, nome, email, perfil, ativo, telefone, cargo, twofa_ativo, ultimo_login, criado_em
                    FROM usuarios WHERE excluido_em IS NULL ORDER BY nome`);
    });

    router.post('/api/usuarios', async (ctx) => {
        exigirPerfil(ctx, 'administrador');
        const b = ctx.body || {};
        if (!b.nome || !b.email || !b.senha) throw new HttpError(400, 'Nome, e-mail e senha são obrigatórios.');
        if (b.senha.length < 8) throw new HttpError(400, 'A senha deve ter ao menos 8 caracteres.');
        if (!PERFIS.includes(b.perfil)) throw new HttpError(400, 'Perfil inválido.');
        const email = String(b.email).toLowerCase().trim();
        if (get(`SELECT id FROM usuarios WHERE email = ?`, [email]))
            throw new HttpError(409, 'Já existe um usuário com este e-mail.');
        const r = run(
            `INSERT INTO usuarios (nome, email, senha_hash, perfil, telefone, cargo, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?,?,?)`,
            [b.nome, email, hashSenha(b.senha), b.perfil, b.telefone || null, b.cargo || null,
             ctx.usuario.id, ctx.usuario.id]);
        registrarAuditoria(ctx, 'CRIAR', 'usuarios', r.lastInsertRowid, `Usuário ${email} (${b.perfil}) criado`);
        ctx.status = 201;
        return get(`SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?`, [r.lastInsertRowid]);
    });

    router.put('/api/usuarios/:id', async (ctx) => {
        exigirPerfil(ctx, 'administrador');
        const u = get(`SELECT * FROM usuarios WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!u) throw new HttpError(404, 'Usuário não encontrado.');
        const b = ctx.body || {};
        const sets = [], vals = [];
        for (const c of ['nome', 'perfil', 'ativo', 'telefone', 'cargo']) {
            if (c in b) {
                if (c === 'perfil' && !PERFIS.includes(b.perfil)) throw new HttpError(400, 'Perfil inválido.');
                sets.push(`${c}=?`); vals.push(b[c]);
            }
        }
        if (!sets.length) throw new HttpError(400, 'Nenhum campo para atualizar.');
        sets.push(`atualizado_em=datetime('now')`, `atualizado_por=?`);
        vals.push(ctx.usuario.id, ctx.params.id);
        run(`UPDATE usuarios SET ${sets.join(',')} WHERE id = ?`, vals);
        registrarAuditoria(ctx, 'EDITAR', 'usuarios', u.id, `Usuário ${u.email} editado`, u);
        return get(`SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?`, [u.id]);
    });

    router.post('/api/usuarios/:id/senha', async (ctx) => {
        exigirPerfil(ctx, 'administrador');
        const u = get(`SELECT * FROM usuarios WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!u) throw new HttpError(404, 'Usuário não encontrado.');
        const { senha_nova } = ctx.body || {};
        if (!senha_nova || senha_nova.length < 8) throw new HttpError(400, 'Senha deve ter ao menos 8 caracteres.');
        run(`UPDATE usuarios SET senha_hash=?, tentativas_login=0, bloqueado_ate=NULL WHERE id = ?`,
            [hashSenha(senha_nova), u.id]);
        registrarAuditoria(ctx, 'RESET_SENHA', 'usuarios', u.id, `Senha redefinida pelo administrador`);
        return { ok: true };
    });

    router.delete('/api/usuarios/:id', async (ctx) => {
        exigirPerfil(ctx, 'administrador');
        if (Number(ctx.params.id) === ctx.usuario.id)
            throw new HttpError(400, 'Você não pode excluir o próprio usuário.');
        const u = get(`SELECT * FROM usuarios WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!u) throw new HttpError(404, 'Usuário não encontrado.');
        const { confirmar, motivo } = ctx.body || {};
        if (confirmar !== true) throw new HttpError(400, 'Confirmação dupla obrigatória (confirmar: true).');
        run(`UPDATE usuarios SET excluido_em=datetime('now'), excluido_por=?, motivo_exclusao=?, ativo=0 WHERE id = ?`,
            [ctx.usuario.id, motivo || 'sem motivo', u.id]);
        registrarAuditoria(ctx, 'EXCLUIR', 'usuarios', u.id, `Usuário ${u.email} desativado/excluído`, u, null);
        return { ok: true };
    });

    router.get('/api/perfis', async (ctx) => {
        exigirPerfil(ctx, 'gestor');
        return PERFIS;
    });
}
