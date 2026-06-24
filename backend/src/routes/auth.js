// ============================================================================
//  MetroControl — Rotas de Autenticação e 2FA
// ============================================================================
import { get, run } from '../db/database.js';
import {
    verificarSenha, hashSenha, gerarToken,
    gerarSegredoTOTP, verificarTOTP, otpauthURL,
} from '../lib/security.js';
import { HttpError } from '../lib/http.js';
import { autenticar } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export function register(router) {
    // ---- LOGIN -----------------------------------------------------------
    router.post('/api/auth/login', async (ctx) => {
        const { email, senha, codigo2fa } = ctx.body || {};
        if (!email || !senha) throw new HttpError(400, 'Informe e-mail e senha.');

        const usuario = get(
            `SELECT * FROM usuarios WHERE email = ? AND excluido_em IS NULL`,
            [String(email).toLowerCase().trim()]
        );
        if (!usuario) throw new HttpError(401, 'Credenciais inválidas.');

        // Conta bloqueada?
        if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
            throw new HttpError(423, `Conta bloqueada temporariamente. Tente novamente após ${usuario.bloqueado_ate}.`);
        }
        if (!usuario.ativo) throw new HttpError(403, 'Usuário inativo. Contate o administrador.');

        // Senha correta?
        if (!verificarSenha(senha, usuario.senha_hash)) {
            const tentativas = (usuario.tentativas_login || 0) + 1;
            let bloqueio = null;
            if (tentativas >= MAX_TENTATIVAS) {
                bloqueio = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString();
            }
            run(`UPDATE usuarios SET tentativas_login = ?, bloqueado_ate = ? WHERE id = ?`,
                [tentativas, bloqueio, usuario.id]);
            registrarAuditoria({ ...ctx, usuario }, 'LOGIN_FALHA', 'usuarios', usuario.id,
                `Tentativa de login falha (${tentativas}/${MAX_TENTATIVAS})`);
            throw new HttpError(401, 'Credenciais inválidas.');
        }

        // 2FA habilitado?
        if (usuario.twofa_ativo) {
            if (!codigo2fa) return { precisa2fa: true };
            if (!verificarTOTP(usuario.twofa_secret, codigo2fa)) {
                throw new HttpError(401, 'Código de verificação (2FA) inválido.');
            }
        }

        // Sucesso — zera tentativas e registra login.
        run(`UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = datetime('now') WHERE id = ?`,
            [usuario.id]);
        registrarAuditoria({ ...ctx, usuario }, 'LOGIN', 'usuarios', usuario.id, 'Login bem-sucedido');

        const token = gerarToken({ sub: usuario.id, perfil: usuario.perfil, nome: usuario.nome });
        return {
            token,
            usuario: {
                id: usuario.id, nome: usuario.nome, email: usuario.email,
                perfil: usuario.perfil, twofa_ativo: !!usuario.twofa_ativo,
            },
        };
    });

    // ---- USUÁRIO ATUAL ---------------------------------------------------
    router.get('/api/auth/me', async (ctx) => {
        autenticar(ctx);
        const u = get(`SELECT id, nome, email, perfil, telefone, cargo, twofa_ativo, ultimo_login
                       FROM usuarios WHERE id = ?`, [ctx.usuario.id]);
        return u;
    });

    // ---- TROCAR PRÓPRIA SENHA -------------------------------------------
    router.post('/api/auth/senha', async (ctx) => {
        autenticar(ctx);
        const { senha_atual, senha_nova } = ctx.body || {};
        if (!senha_nova || senha_nova.length < 8)
            throw new HttpError(400, 'A nova senha deve ter ao menos 8 caracteres.');
        const u = get(`SELECT * FROM usuarios WHERE id = ?`, [ctx.usuario.id]);
        if (!verificarSenha(senha_atual, u.senha_hash))
            throw new HttpError(401, 'Senha atual incorreta.');
        run(`UPDATE usuarios SET senha_hash = ?, atualizado_em = datetime('now') WHERE id = ?`,
            [hashSenha(senha_nova), u.id]);
        registrarAuditoria(ctx, 'TROCAR_SENHA', 'usuarios', u.id, 'Senha alterada pelo próprio usuário');
        return { ok: true };
    });

    // ---- 2FA: gerar segredo (setup) -------------------------------------
    router.post('/api/auth/2fa/setup', async (ctx) => {
        autenticar(ctx);
        const secret = gerarSegredoTOTP();
        // Armazena o segredo, mas só ativa após confirmação do código.
        run(`UPDATE usuarios SET twofa_secret = ? WHERE id = ?`, [secret, ctx.usuario.id]);
        return {
            secret,
            otpauth: otpauthURL(secret, ctx.usuario.email),
        };
    });

    // ---- 2FA: ativar (confirma código) ----------------------------------
    router.post('/api/auth/2fa/ativar', async (ctx) => {
        autenticar(ctx);
        const { codigo } = ctx.body || {};
        const u = get(`SELECT twofa_secret FROM usuarios WHERE id = ?`, [ctx.usuario.id]);
        if (!u.twofa_secret) throw new HttpError(400, 'Gere o segredo 2FA primeiro.');
        if (!verificarTOTP(u.twofa_secret, codigo))
            throw new HttpError(401, 'Código inválido. Verifique seu aplicativo autenticador.');
        run(`UPDATE usuarios SET twofa_ativo = 1 WHERE id = ?`, [ctx.usuario.id]);
        registrarAuditoria(ctx, 'ATIVAR_2FA', 'usuarios', ctx.usuario.id, 'Autenticação em dois fatores ativada');
        return { ok: true };
    });

    // ---- 2FA: desativar -------------------------------------------------
    router.post('/api/auth/2fa/desativar', async (ctx) => {
        autenticar(ctx);
        const { senha } = ctx.body || {};
        const u = get(`SELECT senha_hash FROM usuarios WHERE id = ?`, [ctx.usuario.id]);
        if (!verificarSenha(senha, u.senha_hash)) throw new HttpError(401, 'Senha incorreta.');
        run(`UPDATE usuarios SET twofa_ativo = 0, twofa_secret = NULL WHERE id = ?`, [ctx.usuario.id]);
        registrarAuditoria(ctx, 'DESATIVAR_2FA', 'usuarios', ctx.usuario.id, 'Autenticação em dois fatores desativada');
        return { ok: true };
    });
}
