// ============================================================================
//  MetroControl — Importação de padrões a partir de CSV/JSON do Access
// ============================================================================
import { run, get } from '../db/database.js';
import { exigirPerfil } from '../middleware/auth.js';
import { registrarAuditoria } from '../lib/audit.js';
import { HttpError } from '../lib/http.js';
import { uuid } from '../lib/security.js';

const STATUS_MAP = {
    'ativo': 'disponivel', 'disponível': 'disponivel', 'disponivel': 'disponivel',
    'em uso': 'em_uso', 'em_uso': 'em_uso',
    'desativado': 'inativo', 'inativo': 'inativo',
    'em manutenção': 'em_manutencao', 'em_manutencao': 'em_manutencao', 'manutenção': 'em_manutencao',
    'fora de operação': 'fora_operacao', 'fora_operacao': 'fora_operacao',
};

function normalizar(nome) {
    const mapa = {
        'identificação': 'codigo_interno', 'identificacao': 'codigo_interno', 'codigo': 'codigo_interno', 'id': 'codigo_interno',
        'instrumento': 'tipo_instrumento', 'tipo': 'tipo_instrumento',
        'fabricante': 'fabricante',
        'modelo': 'modelo',
        'capacidade': 'capacidade',
        'faixa utilização': 'faixa_indicacao', 'faixa utilizacao': 'faixa_indicacao', 'faixa': 'faixa_indicacao', 'faixa_utilizacao': 'faixa_indicacao',
        'resolução': 'resolucao', 'resolucao': 'resolucao',
        'unidade': 'unidade',
        'exatidão': 'exatidao', 'exatidao': 'exatidao',
        'tolerância': 'tolerancia', 'tolerancia': 'tolerancia',
        'lacre': 'lacre',
        'nº série': 'numero_serie', 'n serie': 'numero_serie', 'no serie': 'numero_serie', 'numero_serie': 'numero_serie', 'serie': 'numero_serie',
        'departamento': 'departamento',
        'usuário': 'usuario_instrumento', 'usuario': 'usuario_instrumento',
        'procedimento': 'procedimento',
        'periodicidade': 'periodicidade_calibracao_meses',
        'status': 'status',
        'código barras': 'codigo_barras', 'codigo barras': 'codigo_barras', 'codigo_barras': 'codigo_barras',
        'travar': 'travado',
        'classe': 'classe_metrologica', 'classe metrológica': 'classe_metrologica', 'classe_metrologica': 'classe_metrologica',
        'localização': 'localizacao', 'localizacao': 'localizacao',
        'setor': 'setor',
        'grandeza': 'grandeza',
        'observações': 'observacoes', 'observacoes': 'observacoes',
        'instruções': 'instrucoes', 'instrucoes': 'instrucoes',
        'procedimento verificação': 'procedimento_verificacao', 'procedimento_verificacao': 'procedimento_verificacao',
    };
    const limpo = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    return mapa[limpo] || null;
}

export function register(router) {
    router.post('/api/importar/padroes', async (ctx) => {
        await exigirPerfil(ctx, 'administrador');
        const { registros } = ctx.body || {};
        if (!Array.isArray(registros) || !registros.length) {
            throw new HttpError(400, 'Envie { registros: [...] } com os dados dos padrões.');
        }

        const colunasBd = [
            'codigo_interno', 'tipo_instrumento', 'fabricante', 'modelo', 'grandeza',
            'capacidade', 'faixa_indicacao', 'resolucao', 'unidade', 'exatidao', 'tolerancia',
            'classe_metrologica', 'lacre', 'numero_serie', 'departamento', 'usuario_instrumento',
            'procedimento', 'localizacao', 'setor', 'codigo_barras', 'observacoes', 'instrucoes',
            'procedimento_verificacao', 'periodicidade_calibracao_meses',
        ];

        let importados = 0, ignorados = 0, erros = [];

        for (const reg of registros) {
            try {
                const mapeado = {};
                for (const [chaveOriginal, valor] of Object.entries(reg)) {
                    const campo = normalizar(chaveOriginal);
                    if (campo) mapeado[campo] = valor;
                }

                const codigo = mapeado.codigo_interno;
                if (!codigo || String(codigo).trim() === '') { ignorados++; continue; }

                const existe = await get(`SELECT id FROM padroes WHERE codigo_interno = ? AND excluido_em IS NULL`, [String(codigo).trim()]);
                if (existe) { ignorados++; continue; }

                if (mapeado.status) {
                    const sl = String(mapeado.status).toLowerCase().trim();
                    mapeado.status = STATUS_MAP[sl] || 'disponivel';
                }

                if (mapeado.travado) {
                    const tv = String(mapeado.travado).trim();
                    mapeado.travado = (tv === '-1' || tv === '1' || tv.toLowerCase() === 'true' || tv === 'sim') ? 1 : 0;
                }

                if (mapeado.periodicidade_calibracao_meses) {
                    mapeado.periodicidade_calibracao_meses = parseInt(mapeado.periodicidade_calibracao_meses) || 12;
                }

                const semDuplicar = new Set(['status', 'travado', 'periodicidade_calibracao_meses']);
                const campos = [], valores = [], phs = [];
                for (const col of colunasBd) {
                    if (semDuplicar.has(col)) continue;
                    if (mapeado[col] !== undefined && mapeado[col] !== null && String(mapeado[col]).trim() !== '') {
                        campos.push(col);
                        valores.push(String(mapeado[col]).trim());
                        phs.push('?');
                    }
                }

                campos.push('status', 'travado', 'uuid', 'periodicidade_calibracao_meses', 'periodicidade_checagem_meses', 'criado_por', 'atualizado_por');
                valores.push(
                    mapeado.status || 'disponivel',
                    mapeado.travado || 0,
                    uuid(),
                    mapeado.periodicidade_calibracao_meses || 12,
                    6,
                    ctx.usuario.id,
                    ctx.usuario.id,
                );
                phs.push('?', '?', '?', '?', '?', '?', '?');

                await run(`INSERT INTO padroes (${campos.join(',')}) VALUES (${phs.join(',')})`, valores);
                importados++;
            } catch (e) {
                erros.push(`${reg.codigo_interno || reg.Identificação || '?'}: ${e.message}`);
            }
        }

        await registrarAuditoria(ctx, 'IMPORTAR', 'padroes', null,
            `Importação: ${importados} importados, ${ignorados} ignorados, ${erros.length} erros`);

        return {
            ok: true,
            importados,
            ignorados,
            erros: erros.slice(0, 20),
            mensagem: `${importados} padrões importados, ${ignorados} ignorados (já existem ou sem código).`,
        };
    });
}
