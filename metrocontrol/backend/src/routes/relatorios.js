// ============================================================================
//  MetroControl — Relatórios (Excel/CSV e dados para PDF)
//  Os relatórios em PDF são gerados no frontend a partir destes dados
//  (impressão nativa do navegador → "Salvar como PDF"). O CSV abre no Excel.
// ============================================================================
import { all } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';

// Definição de cada relatório: título, consulta SQL e colunas exibidas.
const RELATORIOS = {
    inventario: {
        titulo: 'Inventário Completo de Padrões',
        sql: `SELECT codigo_interno, numero_serie, fabricante, modelo, tipo_instrumento, grandeza,
                     faixa_indicacao, resolucao, exatidao, classe_metrologica, localizacao, status,
                     data_proxima_calibracao, data_proxima_checagem
              FROM padroes WHERE excluido_em IS NULL ORDER BY codigo_interno`,
    },
    vencidos: {
        titulo: 'Padrões com Calibração/Checagem Vencida',
        sql: `SELECT codigo_interno, modelo, tipo_instrumento, grandeza, localizacao, status,
                     data_proxima_calibracao, data_proxima_checagem
              FROM padroes WHERE excluido_em IS NULL AND
                    (data_proxima_calibracao < date('now') OR data_proxima_checagem < date('now'))
              ORDER BY data_proxima_calibracao`,
    },
    em_uso: {
        titulo: 'Padrões em Uso (Fora do Laboratório)',
        sql: `SELECT p.codigo_interno, p.modelo, m.retirado_por_nome AS responsavel,
                     m.cliente_nome, m.local_utilizacao, m.data_retirada,
                     CAST(julianday('now')-julianday(m.data_retirada) AS INTEGER) AS dias_fora
              FROM movimentacoes m JOIN padroes p ON p.id = m.padrao_id
              WHERE m.status='aberta' AND m.excluido_em IS NULL ORDER BY m.data_retirada`,
    },
    movimentacoes: {
        titulo: 'Histórico de Movimentações',
        sql: `SELECT p.codigo_interno, m.retirado_por_nome, m.data_retirada, m.cliente_nome,
                     m.motivo, m.local_utilizacao, m.devolvido_por_nome, m.data_devolucao,
                     m.condicao_devolucao, m.status
              FROM movimentacoes m JOIN padroes p ON p.id = m.padrao_id
              WHERE m.excluido_em IS NULL ORDER BY m.data_retirada DESC`,
    },
    calibracoes: {
        titulo: 'Histórico de Calibrações',
        sql: `SELECT p.codigo_interno, c.data_calibracao, c.data_proxima, c.numero_certificado,
                     c.laboratorio, c.rastreabilidade, c.resultado, c.incerteza, c.custo
              FROM calibracoes c JOIN padroes p ON p.id = c.padrao_id
              WHERE c.excluido_em IS NULL ORDER BY c.data_calibracao DESC`,
    },
    checagens: {
        titulo: 'Histórico de Checagens',
        sql: `SELECT p.codigo_interno, ch.data_checagem, ch.data_proxima, ch.metodo,
                     ch.resultado, ch.responsavel_nome
              FROM checagens ch JOIN padroes p ON p.id = ch.padrao_id
              WHERE ch.excluido_em IS NULL ORDER BY ch.data_checagem DESC`,
    },
    servicos: {
        titulo: 'Relatório de Serviços',
        sql: `SELECT codigo, nome, cliente_nome, tecnico_nome, data_inicio, data_conclusao, status
              FROM servicos WHERE excluido_em IS NULL ORDER BY data_inicio DESC`,
    },
    normas: {
        titulo: 'Relatório de Normas',
        sql: `SELECT codigo, nome, revisao, organismo, area_aplicacao, data_emissao, data_revisao, status
              FROM normas WHERE excluido_em IS NULL ORDER BY codigo`,
    },
};

/** Converte linhas em CSV compatível com Excel PT-BR (separador ; + BOM). */
function paraCSV(linhas) {
    if (!linhas.length) return '﻿(sem dados)';
    const cabec = Object.keys(linhas[0]);
    const escapa = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return /[";\n]/.test(s) ? `"${s}"` : s;
    };
    const corpo = linhas.map((l) => cabec.map((c) => escapa(l[c])).join(';')).join('\r\n');
    return '﻿' + cabec.join(';') + '\r\n' + corpo; // BOM para acentuação no Excel
}

export function register(router) {
    // Lista de relatórios disponíveis (para montar o menu).
    router.get('/api/relatorios', async (ctx) => {
        autenticar(ctx);
        return Object.entries(RELATORIOS).map(([chave, r]) => ({ chave, titulo: r.titulo }));
    });

    // Gera um relatório em JSON (para PDF) ou CSV (para Excel).
    router.get('/api/relatorios/:tipo', async (ctx) => {
        autenticar(ctx);
        const def = RELATORIOS[ctx.params.tipo];
        if (!def) throw new HttpError(404, 'Relatório inexistente.');
        const linhas = all(def.sql);
        registrarAuditoria(ctx, 'EXPORTAR', 'relatorios', null,
            `Relatório "${def.titulo}" exportado (${ctx.query.formato || 'json'})`);

        if (ctx.query.formato === 'csv') {
            return {
                __download: true,
                filename: `${ctx.params.tipo}_${new Date().toISOString().slice(0, 10)}.csv`,
                contentType: 'text/csv; charset=utf-8',
                body: paraCSV(linhas),
            };
        }
        return { titulo: def.titulo, gerado_em: new Date().toISOString(), total: linhas.length, linhas };
    });
}
