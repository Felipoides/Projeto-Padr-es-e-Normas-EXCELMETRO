// ============================================================================
//  MetroControl — Registro de auditoria (histórico permanente de ações)
// ============================================================================
import { run } from '../db/database.js';

/**
 * Registra uma ação na trilha de auditoria.
 * @param {object} ctx      - contexto: { usuario, ip, userAgent }
 * @param {string} acao     - LOGIN | CRIAR | EDITAR | EXCLUIR | RESTAURAR | EXPORTAR ...
 * @param {string} entidade - tabela/recurso afetado
 * @param {number} entidadeId
 * @param {string} descricao
 * @param {object} dadosAntes  - snapshot anterior (versionamento)
 * @param {object} dadosDepois - snapshot posterior
 */
export async function registrarAuditoria(ctx, acao, entidade, entidadeId, descricao, dadosAntes = null, dadosDepois = null) {
    await run(
        `INSERT INTO auditoria
          (usuario_id, usuario_nome, acao, entidade, entidade_id, descricao,
           dados_antes, dados_depois, ip, user_agent)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
            ctx?.usuario?.id ?? null,
            ctx?.usuario?.nome ?? null,
            acao,
            entidade ?? null,
            entidadeId ?? null,
            descricao ?? null,
            dadosAntes ? JSON.stringify(dadosAntes) : null,
            dadosDepois ? JSON.stringify(dadosDepois) : null,
            ctx?.ip ?? null,
            ctx?.userAgent ?? null,
        ]
    );
}
