// ============================================================================
//  MetroControl — Dashboard Executivo (KPIs + séries para gráficos)
// ============================================================================
import { all, get } from '../db/database.js';
import { autenticar } from '../middleware/auth.js';

// Converte COUNT(*)/total (string no PostgreSQL) para número.
const nTotal = (linhas) => linhas.map((l) => ({ ...l, total: Number(l.total) }));

export function register(router) {
    router.get('/api/dashboard', async (ctx) => {
        await autenticar(ctx);

        const num = async (sql, p = []) => Number((await get(sql, p)).c) || 0;

        const totalPadroes = await num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL`);
        const disponiveis  = await num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='disponivel'`);
        const emUso        = await num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='em_uso'`);
        const emManutencao = await num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='em_manutencao'`);
        const foraOperacao = await num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='fora_operacao'`);

        const vencidos = await num(
            `SELECT COUNT(DISTINCT id) c FROM padroes
             WHERE excluido_em IS NULL AND
                   (data_proxima_calibracao < date('now') OR data_proxima_checagem < date('now'))`);
        const proximas30 = await num(
            `SELECT COUNT(DISTINCT id) c FROM padroes
             WHERE excluido_em IS NULL AND
                   (data_proxima_calibracao BETWEEN date('now') AND date('now','+30 day')
                    OR data_proxima_checagem BETWEEN date('now') AND date('now','+30 day'))`);

        const servicosConcluidos = await num(`SELECT COUNT(*) c FROM servicos WHERE excluido_em IS NULL AND status='concluido'`);
        const servicosAndamento  = await num(`SELECT COUNT(*) c FROM servicos WHERE excluido_em IS NULL AND status='em_andamento'`);
        const totalNormas        = await num(`SELECT COUNT(*) c FROM normas WHERE excluido_em IS NULL`);
        const movAbertas         = await num(`SELECT COUNT(*) c FROM movimentacoes WHERE excluido_em IS NULL AND status='aberta'`);

        // ---- Séries para gráficos -----------------------------------------
        const porStatus = nTotal(await all(
            `SELECT status, COUNT(*) total FROM padroes WHERE excluido_em IS NULL GROUP BY status`));
        const porGrandeza = nTotal(await all(
            `SELECT CASE WHEN grandeza IS NULL OR grandeza = '' THEN '(sem grandeza)' ELSE grandeza END grandeza,
                    COUNT(*) total
             FROM padroes WHERE excluido_em IS NULL
             GROUP BY CASE WHEN grandeza IS NULL OR grandeza = '' THEN '(sem grandeza)' ELSE grandeza END
             ORDER BY total DESC LIMIT 8`));
        const calibracoesPorMes = nTotal(await all(
            `SELECT strftime('%Y-%m', data_calibracao) mes, COUNT(*) total
             FROM calibracoes WHERE excluido_em IS NULL AND data_calibracao >= date('now','-12 month')
             GROUP BY mes ORDER BY mes`));
        const movimentacoesPorMes = nTotal(await all(
            `SELECT strftime('%Y-%m', data_retirada) mes, COUNT(*) total
             FROM movimentacoes WHERE excluido_em IS NULL AND data_retirada >= date('now','-12 month')
             GROUP BY mes ORDER BY mes`));

        // ---- Últimas atividades (timeline) --------------------------------
        const ultimasAtividades = await all(
            `SELECT acao, entidade, descricao, usuario_nome, criado_em
             FROM auditoria ORDER BY id DESC LIMIT 12`);

        return {
            kpis: {
                totalPadroes, disponiveis, emUso, emManutencao, foraOperacao,
                vencidos, proximas30, servicosConcluidos, servicosAndamento,
                totalNormas, movAbertas,
            },
            graficos: { porStatus, porGrandeza, calibracoesPorMes, movimentacoesPorMes },
            ultimasAtividades,
        };
    });

    // ---- Mapa de localização dos padrões --------------------------------
    router.get('/api/mapa', async (ctx) => {
        await autenticar(ctx);
        return await all(
            `SELECT id, codigo_interno, modelo, status, localizacao, setor, mapa_x, mapa_y
             FROM padroes WHERE excluido_em IS NULL`);
    });
}
