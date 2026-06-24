// ============================================================================
//  MetroControl — Dashboard Executivo (KPIs + séries para gráficos)
// ============================================================================
import { all, get } from '../db/database.js';
import { autenticar } from '../middleware/auth.js';

export function register(router) {
    router.get('/api/dashboard', async (ctx) => {
        autenticar(ctx);

        const num = (sql, p = []) => get(sql, p).c || 0;

        const totalPadroes = num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL`);
        const disponiveis  = num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='disponivel'`);
        const emUso        = num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='em_uso'`);
        const emManutencao = num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='em_manutencao'`);
        const foraOperacao = num(`SELECT COUNT(*) c FROM padroes WHERE excluido_em IS NULL AND status='fora_operacao'`);

        const vencidos = num(
            `SELECT COUNT(DISTINCT id) c FROM padroes
             WHERE excluido_em IS NULL AND
                   (data_proxima_calibracao < date('now') OR data_proxima_checagem < date('now'))`);
        const proximas30 = num(
            `SELECT COUNT(DISTINCT id) c FROM padroes
             WHERE excluido_em IS NULL AND
                   (data_proxima_calibracao BETWEEN date('now') AND date('now','+30 day')
                    OR data_proxima_checagem BETWEEN date('now') AND date('now','+30 day'))`);

        const servicosConcluidos = num(`SELECT COUNT(*) c FROM servicos WHERE excluido_em IS NULL AND status='concluido'`);
        const servicosAndamento  = num(`SELECT COUNT(*) c FROM servicos WHERE excluido_em IS NULL AND status='em_andamento'`);
        const totalNormas        = num(`SELECT COUNT(*) c FROM normas WHERE excluido_em IS NULL`);
        const movAbertas         = num(`SELECT COUNT(*) c FROM movimentacoes WHERE excluido_em IS NULL AND status='aberta'`);

        // ---- Séries para gráficos -----------------------------------------
        const porStatus = all(
            `SELECT status, COUNT(*) total FROM padroes WHERE excluido_em IS NULL GROUP BY status`);
        const porGrandeza = all(
            `SELECT COALESCE(NULLIF(grandeza,''),'(sem grandeza)') grandeza, COUNT(*) total
             FROM padroes WHERE excluido_em IS NULL GROUP BY grandeza ORDER BY total DESC LIMIT 8`);
        const calibracoesPorMes = all(
            `SELECT strftime('%Y-%m', data_calibracao) mes, COUNT(*) total
             FROM calibracoes WHERE excluido_em IS NULL AND data_calibracao >= date('now','-12 month')
             GROUP BY mes ORDER BY mes`);
        const movimentacoesPorMes = all(
            `SELECT strftime('%Y-%m', data_retirada) mes, COUNT(*) total
             FROM movimentacoes WHERE excluido_em IS NULL AND data_retirada >= date('now','-12 month')
             GROUP BY mes ORDER BY mes`);

        // ---- Últimas atividades (timeline) --------------------------------
        const ultimasAtividades = all(
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
        autenticar(ctx);
        return all(
            `SELECT id, codigo_interno, modelo, status, localizacao, setor, mapa_x, mapa_y
             FROM padroes WHERE excluido_em IS NULL`);
    });
}
