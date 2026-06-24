// ============================================================================
//  MetroControl — Middleware de autenticação e autorização (RBAC)
// ============================================================================
import { verificarToken } from '../lib/security.js';
import { HttpError } from '../lib/http.js';
import { get } from '../db/database.js';

// Hierarquia de permissões. Quanto maior o número, mais poder.
export const NIVEIS = {
    controle_padroes: 1,
    administrador: 2,
};

/**
 * Extrai e valida o token JWT do header Authorization.
 * Popula ctx.usuario com os dados atuais do banco.
 * Lança HttpError 401 se inválido.
 */
export async function autenticar(ctx) {
    const auth = ctx.req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token ? verificarToken(token) : null;
    if (!payload) throw new HttpError(401, 'Não autenticado. Faça login.');

    // Recarrega o usuário (garante perfil/ativo atualizados e não excluído).
    const usuario = await get(
        `SELECT id, nome, email, perfil, ativo FROM usuarios
         WHERE id = ? AND excluido_em IS NULL`, [payload.sub]
    );
    if (!usuario || !usuario.ativo) throw new HttpError(401, 'Sessão inválida ou usuário inativo.');
    ctx.usuario = usuario;
    return usuario;
}

/**
 * Garante que o usuário autenticado possua nível mínimo do perfil exigido.
 * Ex.: await exigirPerfil(ctx, 'administrador')
 */
export async function exigirPerfil(ctx, perfilMinimo) {
    if (!ctx.usuario) await autenticar(ctx);
    const nivelUsuario = NIVEIS[ctx.usuario.perfil] || 0;
    const nivelExigido = NIVEIS[perfilMinimo] || 99;
    if (nivelUsuario < nivelExigido) {
        throw new HttpError(403, `Acesso negado. Requer perfil mínimo: ${perfilMinimo}.`);
    }
}

/** Verifica se o perfil pode escrever (criar/editar/excluir). */
export async function exigirEscrita(ctx) {
    if (!ctx.usuario) await autenticar(ctx);
    if (!['controle_padroes', 'administrador'].includes(ctx.usuario.perfil)) {
        throw new HttpError(403, 'Seu perfil não tem permissão de escrita.');
    }
}
