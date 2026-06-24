// ============================================================================
//  MetroControl — Middleware de autenticação e autorização (RBAC)
// ============================================================================
import { verificarToken } from '../lib/security.js';
import { HttpError } from '../lib/http.js';
import { get } from '../db/database.js';

// Hierarquia de permissões. Quanto maior o número, mais poder.
export const NIVEIS = {
    visualizador: 1,
    auditor: 2,
    tecnico: 3,
    gestor: 4,
    administrador: 5,
};

/**
 * Extrai e valida o token JWT do header Authorization.
 * Popula ctx.usuario com os dados atuais do banco.
 * Lança HttpError 401 se inválido.
 */
export function autenticar(ctx) {
    const auth = ctx.req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token ? verificarToken(token) : null;
    if (!payload) throw new HttpError(401, 'Não autenticado. Faça login.');

    // Recarrega o usuário (garante perfil/ativo atualizados e não excluído).
    const usuario = get(
        `SELECT id, nome, email, perfil, ativo FROM usuarios
         WHERE id = ? AND excluido_em IS NULL`, [payload.sub]
    );
    if (!usuario || !usuario.ativo) throw new HttpError(401, 'Sessão inválida ou usuário inativo.');
    ctx.usuario = usuario;
    return usuario;
}

/**
 * Garante que o usuário autenticado possua nível mínimo do perfil exigido.
 * Ex.: exigirPerfil(ctx, 'gestor')
 */
export function exigirPerfil(ctx, perfilMinimo) {
    if (!ctx.usuario) autenticar(ctx);
    const nivelUsuario = NIVEIS[ctx.usuario.perfil] || 0;
    const nivelExigido = NIVEIS[perfilMinimo] || 99;
    if (nivelUsuario < nivelExigido) {
        throw new HttpError(403, `Acesso negado. Requer perfil mínimo: ${perfilMinimo}.`);
    }
}

/** Verifica se o perfil pode escrever (criar/editar/excluir). */
export function exigirEscrita(ctx) {
    if (!ctx.usuario) autenticar(ctx);
    if (['visualizador', 'auditor'].includes(ctx.usuario.perfil)) {
        throw new HttpError(403, 'Seu perfil tem acesso somente leitura.');
    }
}
