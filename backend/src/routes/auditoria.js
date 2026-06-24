// ============================================================================
//  MetroControl — Trilha de Auditoria e Lixeira (recuperação de registros)
// ============================================================================
import { all, get, run } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirPerfil } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

// Entidades que suportam exclusão lógica / restauração.
const ENTIDADES_LIXEIRA = {
    padroes: 'codigo_interno',
    normas: 'codigo',
    servicos: 'nome',
    movimentacoes: 'id',
    clientes: 'nome',
    usuarios: 'email',
};

export function register(router) {
    // ====================  AUDITORIA  ====================================
    router.get('/api/auditoria', async (ctx) => {
        await exigirPerfil(ctx, 'controle_padroes');
        const q = ctx.query;
        const where = ['1=1']; const params = [];
        if (q.acao)     { where.push('acao = ?'); params.push(q.acao); }
        if (q.entidade) { where.push('entidade = ?'); params.push(q.entidade); }
        if (q.usuario_id) { where.push('usuario_id = ?'); params.push(q.usuario_id); }
        if (q.de)  { where.push('criado_em >= ?'); params.push(q.de); }
        if (q.ate) { where.push('criado_em <= ?'); params.push(q.ate + ' 23:59:59'); }
        const limite = Math.min(parseInt(q.limite) || 200, 1000);
        const itens = await all(
            `SELECT * FROM auditoria WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
            [...params, limite]);
        const total = Number((await get(`SELECT COUNT(*) c FROM auditoria WHERE ${where.join(' AND ')}`, params)).c);
        return { total, itens };
    });

    // Linha do tempo de eventos de um padrão específico (timeline).
    router.get('/api/auditoria/timeline/:entidade/:id', async (ctx) => {
        await autenticar(ctx);
        return await all(
            `SELECT acao, descricao, usuario_nome, criado_em FROM auditoria
             WHERE entidade = ? AND entidade_id = ? ORDER BY id DESC`,
            [ctx.params.entidade, ctx.params.id]);
    });

    // ====================  LIXEIRA  ======================================
    router.get('/api/lixeira', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const resultado = [];
        for (const [tabela, rotulo] of Object.entries(ENTIDADES_LIXEIRA)) {
            const linhas = await all(
                `SELECT id, ${rotulo} AS rotulo, excluido_em, excluido_por, motivo_exclusao
                 FROM ${tabela} WHERE excluido_em IS NOT NULL ORDER BY excluido_em DESC`);
            for (const l of linhas) resultado.push({ entidade: tabela, ...l });
        }
        resultado.sort((a, b) => (b.excluido_em || '').localeCompare(a.excluido_em || ''));
        return resultado;
    });

    // Restaurar registro da lixeira (somente administrador).
    router.post('/api/lixeira/:entidade/:id/restaurar', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const tabela = ctx.params.entidade;
        if (!ENTIDADES_LIXEIRA[tabela]) throw new HttpError(400, 'Entidade inválida.');
        const reg = await get(`SELECT * FROM ${tabela} WHERE id = ? AND excluido_em IS NOT NULL`, [ctx.params.id]);
        if (!reg) throw new HttpError(404, 'Registro não encontrado na lixeira.');
        await run(`UPDATE ${tabela} SET excluido_em=NULL, excluido_por=NULL, motivo_exclusao=NULL WHERE id = ?`,
            [ctx.params.id]);
        await registrarAuditoria(ctx, 'RESTAURAR', tabela, Number(ctx.params.id),
            `Registro restaurado da lixeira`);
        return { ok: true, mensagem: 'Registro restaurado com sucesso.' };
    });
}
