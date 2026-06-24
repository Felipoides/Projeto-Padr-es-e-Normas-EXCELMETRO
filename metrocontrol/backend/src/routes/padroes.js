// ============================================================================
//  MetroControl — Rotas do módulo PADRÕES (entidade central)
// ============================================================================
import { all, get, run, transaction } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { autenticar, exigirEscrita } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';
import { uuid } from '../lib/security.js';

// Campos aceitos na criação/edição (whitelist — segurança contra mass assignment).
const CAMPOS = [
    'codigo_interno', 'numero_serie', 'fabricante', 'modelo', 'tipo_instrumento',
    'grandeza', 'faixa_indicacao', 'resolucao', 'exatidao', 'classe_metrologica',
    'capacidade', 'unidade', 'tolerancia', 'lacre', 'departamento',
    'usuario_instrumento', 'procedimento', 'instrucoes', 'procedimento_verificacao',
    'codigo_barras', 'travado',
    'localizacao', 'setor', 'mapa_x', 'mapa_y', 'data_aquisicao',
    'data_ultima_calibracao', 'data_proxima_calibracao',
    'data_ultima_checagem', 'data_proxima_checagem',
    'periodicidade_calibracao_meses', 'periodicidade_checagem_meses',
    'status', 'observacoes', 'valor_aquisicao',
];

/** Calcula a situação de vencimento (para semáforo no frontend). */
function enriquecer(p) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = (d) => d ? Math.ceil((new Date(d) - hoje) / 86400000) : null;
    const diasCal = dias(p.data_proxima_calibracao);
    const diasChk = dias(p.data_proxima_checagem);
    let situacao = 'ok';
    const menor = [diasCal, diasChk].filter((x) => x !== null);
    const min = menor.length ? Math.min(...menor) : null;
    if (min !== null) {
        if (min < 0) situacao = 'vencido';
        else if (min <= 7) situacao = 'critico';
        else if (min <= 15) situacao = 'alerta';
        else if (min <= 30) situacao = 'atencao';
    }
    return { ...p, dias_para_calibracao: diasCal, dias_para_checagem: diasChk, situacao_vencimento: situacao };
}

export function register(router) {
    // ---- LISTAR (busca avançada + filtros) ------------------------------
    router.get('/api/padroes', async (ctx) => {
        autenticar(ctx);
        const q = ctx.query;
        const where = ['p.excluido_em IS NULL'];
        const params = [];

        // Busca textual global (qualquer campo relevante).
        if (q.busca) {
            const termo = `%${q.busca}%`;
            where.push(`(p.codigo_interno LIKE ? OR p.numero_serie LIKE ? OR p.fabricante LIKE ?
                        OR p.modelo LIKE ? OR p.tipo_instrumento LIKE ? OR p.grandeza LIKE ?
                        OR p.localizacao LIKE ? OR p.setor LIKE ?)`);
            params.push(termo, termo, termo, termo, termo, termo, termo, termo);
        }
        if (q.status) { where.push('p.status = ?'); params.push(q.status); }
        if (q.grandeza) { where.push('p.grandeza = ?'); params.push(q.grandeza); }

        // Filtros rápidos de vencimento.
        if (q.filtro === 'vencidos') {
            where.push(`(p.data_proxima_calibracao < date('now') OR p.data_proxima_checagem < date('now'))`);
        } else if (q.filtro === 'proximos') {
            where.push(`((p.data_proxima_calibracao BETWEEN date('now') AND date('now','+30 day'))
                        OR (p.data_proxima_checagem BETWEEN date('now') AND date('now','+30 day')))`);
        } else if (['disponivel', 'em_uso', 'em_manutencao', 'fora_operacao', 'inativo'].includes(q.filtro)) {
            where.push('p.status = ?'); params.push(q.filtro);
        }

        const limite = Math.min(parseInt(q.limite) || 200, 1000);
        const offset = parseInt(q.offset) || 0;
        const rows = all(
            `SELECT p.* FROM padroes p WHERE ${where.join(' AND ')}
             ORDER BY p.codigo_interno LIMIT ? OFFSET ?`,
            [...params, limite, offset]
        );
        const total = get(`SELECT COUNT(*) c FROM padroes p WHERE ${where.join(' AND ')}`, params).c;
        return { total, itens: rows.map(enriquecer) };
    });

    // ---- DETALHE COMPLETO (com históricos) ------------------------------
    router.get('/api/padroes/:id', async (ctx) => {
        autenticar(ctx);
        const p = get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!p) throw new HttpError(404, 'Padrão não encontrado.');
        return {
            ...enriquecer(p),
            movimentacoes: all(`SELECT * FROM movimentacoes WHERE padrao_id = ? AND excluido_em IS NULL
                                ORDER BY data_retirada DESC`, [p.id]),
            calibracoes: all(`SELECT * FROM calibracoes WHERE padrao_id = ? AND excluido_em IS NULL
                              ORDER BY data_calibracao DESC`, [p.id]),
            checagens: all(`SELECT * FROM checagens WHERE padrao_id = ? AND excluido_em IS NULL
                            ORDER BY data_checagem DESC`, [p.id]),
            anexos: all(`SELECT * FROM anexos WHERE entidade='padrao' AND entidade_id = ? AND excluido_em IS NULL`, [p.id]),
        };
    });

    // ---- BUSCAR POR UUID (leitura de QR Code) ---------------------------
    router.get('/api/padroes/uuid/:uuid', async (ctx) => {
        autenticar(ctx);
        const p = get(`SELECT * FROM padroes WHERE uuid = ? AND excluido_em IS NULL`, [ctx.params.uuid]);
        if (!p) throw new HttpError(404, 'Padrão não encontrado para este QR Code.');
        return enriquecer(p);
    });

    // ---- CRIAR -----------------------------------------------------------
    router.post('/api/padroes', async (ctx) => {
        exigirEscrita(ctx);
        const b = ctx.body || {};
        if (!b.codigo_interno) throw new HttpError(400, 'Código interno é obrigatório.');
        if (get(`SELECT id FROM padroes WHERE codigo_interno = ?`, [b.codigo_interno]))
            throw new HttpError(409, 'Já existe um padrão com este código interno.');

        const dados = {};
        for (const c of CAMPOS) dados[c] = b[c] ?? null;
        // Campos NOT NULL / com default: garante valores válidos quando omitidos.
        if (!dados.status) dados.status = 'disponivel';
        if (dados.travado == null) dados.travado = 0;
        if (dados.periodicidade_calibracao_meses == null) dados.periodicidade_calibracao_meses = 12;
        if (dados.periodicidade_checagem_meses == null) dados.periodicidade_checagem_meses = 6;
        const novoUuid = uuid();
        const cols = [...CAMPOS, 'uuid', 'criado_por', 'atualizado_por'];
        const vals = [...CAMPOS.map((c) => dados[c]), novoUuid, ctx.usuario.id, ctx.usuario.id];
        const ph = cols.map(() => '?').join(',');
        const r = run(`INSERT INTO padroes (${cols.join(',')}) VALUES (${ph})`, vals);
        registrarAuditoria(ctx, 'CRIAR', 'padroes', r.lastInsertRowid, `Padrão ${b.codigo_interno} criado`, null, dados);
        ctx.status = 201;
        return get(`SELECT * FROM padroes WHERE id = ?`, [r.lastInsertRowid]);
    });

    // ---- EDITAR ----------------------------------------------------------
    router.put('/api/padroes/:id', async (ctx) => {
        exigirEscrita(ctx);
        const antes = get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!antes) throw new HttpError(404, 'Padrão não encontrado.');
        const b = ctx.body || {};
        const sets = [], vals = [];
        for (const c of CAMPOS) {
            if (c in b) { sets.push(`${c} = ?`); vals.push(b[c]); }
        }
        if (!sets.length) throw new HttpError(400, 'Nenhum campo para atualizar.');
        sets.push(`atualizado_em = datetime('now')`, `atualizado_por = ?`);
        vals.push(ctx.usuario.id, ctx.params.id);
        run(`UPDATE padroes SET ${sets.join(', ')} WHERE id = ?`, vals);
        const depois = get(`SELECT * FROM padroes WHERE id = ?`, [ctx.params.id]);
        registrarAuditoria(ctx, 'EDITAR', 'padroes', antes.id, `Padrão ${antes.codigo_interno} editado`, antes, depois);
        return depois;
    });

    // ---- EXCLUIR (lógico, com dupla confirmação e motivo) ---------------
    router.delete('/api/padroes/:id', async (ctx) => {
        exigirEscrita(ctx);
        const p = get(`SELECT * FROM padroes WHERE id = ? AND excluido_em IS NULL`, [ctx.params.id]);
        if (!p) throw new HttpError(404, 'Padrão não encontrado.');
        const { confirmar, motivo } = ctx.body || {};
        if (confirmar !== true)
            throw new HttpError(400, 'Confirmação dupla obrigatória para exclusão (envie confirmar: true).');
        if (!motivo) throw new HttpError(400, 'Informe o motivo da exclusão (exigência de auditoria).');
        run(`UPDATE padroes SET excluido_em = datetime('now'), excluido_por = ?, motivo_exclusao = ? WHERE id = ?`,
            [ctx.usuario.id, motivo, p.id]);
        registrarAuditoria(ctx, 'EXCLUIR', 'padroes', p.id, `Exclusão lógica: ${motivo}`, p, null);
        return { ok: true, mensagem: 'Padrão movido para a lixeira. Pode ser recuperado por um administrador.' };
    });

    // ---- LISTA DE GRANDEZAS (para filtros do frontend) ------------------
    router.get('/api/padroes-grandezas', async (ctx) => {
        autenticar(ctx);
        return all(`SELECT DISTINCT grandeza FROM padroes
                    WHERE grandeza IS NOT NULL AND grandeza <> '' AND excluido_em IS NULL
                    ORDER BY grandeza`).map((r) => r.grandeza);
    });
}
