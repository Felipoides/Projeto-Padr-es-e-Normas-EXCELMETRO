// ============================================================================
//  MetroControl — População inicial (dados de demonstração)
//  Cria usuários de cada perfil, padrões, normas, serviços, movimentações e
//  calibrações com datas relativas a "hoje" (gera itens vencidos/a vencer).
// ============================================================================
import { run, get } from './database.js';
import { hashSenha, uuid } from '../lib/security.js';

// Helper de datas relativas (YYYY-MM-DD).
function dias(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

export function seed() {
    // ---- USUÁRIOS (um por perfil) ---------------------------------------
    const usuarios = [
        ['Administrador do Sistema', 'admin@metrocontrol.com', 'Admin@123', 'administrador', 'Gerente da Qualidade'],
        ['Maria Gestora', 'gestor@metrocontrol.com', 'Gestor@123', 'gestor', 'Coordenadora de Metrologia'],
        ['João Técnico', 'tecnico@metrocontrol.com', 'Tecnico@123', 'tecnico', 'Técnico em Metrologia'],
        ['Ana Auditora', 'auditor@metrocontrol.com', 'Auditor@123', 'auditor', 'Auditora Interna'],
        ['Carlos Visualizador', 'viewer@metrocontrol.com', 'Viewer@123', 'visualizador', 'Estagiário'],
    ];
    const idUsuario = {};
    for (const [nome, email, senha, perfil, cargo] of usuarios) {
        const r = run(
            `INSERT INTO usuarios (nome, email, senha_hash, perfil, cargo, ativo) VALUES (?,?,?,?,?,1)`,
            [nome, email, hashSenha(senha), perfil, cargo]);
        idUsuario[perfil] = r.lastInsertRowid;
    }
    const admin = idUsuario.administrador;

    // ---- CLIENTES --------------------------------------------------------
    const clientes = [
        ['Indústria Metalúrgica Alfa Ltda', '12.345.678/0001-90', 'Roberto Lima', 'roberto@alfa.com', '(11) 3333-1000'],
        ['AutoPeças Beta S.A.', '98.765.432/0001-10', 'Fernanda Souza', 'fernanda@beta.com', '(11) 4444-2000'],
        ['Laboratório Gamma Calibrações', '11.222.333/0001-44', 'Paulo Mendes', 'paulo@gamma.com', '(11) 5555-3000'],
    ];
    const idCliente = [];
    for (const [nome, doc, contato, email, tel] of clientes) {
        const r = run(`INSERT INTO clientes (nome, documento, contato, email, telefone, criado_por, atualizado_por)
                       VALUES (?,?,?,?,?,?,?)`, [nome, doc, contato, email, tel, admin, admin]);
        idCliente.push(r.lastInsertRowid);
    }

    // ---- NORMAS ----------------------------------------------------------
    const normas = [
        ['ISO/IEC 17025', 'Requisitos gerais para a competência de laboratórios de ensaio e calibração', '2017', 'ISO', 'Gestão da Qualidade Laboratorial', '2017-11-01'],
        ['ABNT NBR ISO 9001', 'Sistemas de gestão da qualidade — Requisitos', '2015', 'ABNT', 'Gestão da Qualidade', '2015-09-30'],
        ['VIM', 'Vocabulário Internacional de Metrologia — Conceitos fundamentais e gerais', '2012', 'Inmetro', 'Metrologia Geral', '2012-01-01'],
        ['ISO GUM', 'Guia para a expressão da incerteza de medição', '2008', 'ISO', 'Incerteza de Medição', '2008-01-01'],
        ['Portaria Inmetro 236', 'Regulamento técnico metrológico — Instrumentos de medição', '2021', 'Inmetro', 'Regulamentação', '2021-06-01'],
        ['ABNT NBR ISO 10012', 'Sistemas de gestão de medição', '2004', 'ABNT', 'Gestão de Medição', '2004-12-01'],
    ];
    const idNorma = [];
    for (const [codigo, nome, rev, org, area, emissao] of normas) {
        const r = run(
            `INSERT INTO normas (codigo, nome, revisao, organismo, area_aplicacao, data_emissao, status, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?, 'vigente', ?, ?)`,
            [codigo, nome, rev, org, area, emissao, admin, admin]);
        idNorma.push(r.lastInsertRowid);
    }

    // ---- PADRÕES (com datas variadas: vencidos, a vencer, ok) -----------
    const padroes = [
        // codigo, serie, fab, modelo, tipo, grandeza, faixa, resol, exatidao, classe, local, status, ult_cal(dias), prox_cal(dias), ult_chk(dias), prox_chk(dias)
        ['PAD-0001', 'SN-784512', 'Mitutoyo', 'CD-6 ASX', 'Paquímetro Digital', 'Comprimento', '0 a 150 mm', '0,01 mm', '± 0,02 mm', 'Classe 1', 'Sala de Metrologia — Armário A1', 'disponivel', -330, 35, -150, 30],
        ['PAD-0002', 'SN-114478', 'Mitutoyo', '293-340-30', 'Micrômetro Externo', 'Comprimento', '0 a 25 mm', '0,001 mm', '± 0,002 mm', 'Classe 1', 'Sala de Metrologia — Armário A1', 'disponivel', -360, -5, -180, 10],
        ['PAD-0003', 'SN-552210', 'Zurich', 'BG-2200', 'Balança Analítica', 'Massa', '0 a 2200 g', '0,01 g', '± 0,03 g', 'Classe II', 'Laboratório de Massa', 'em_uso', -200, 165, -90, 95],
        ['PAD-0004', 'SN-998877', 'Wika', 'CPG1500', 'Manômetro Digital', 'Pressão', '0 a 1000 bar', '0,1 bar', '± 0,05% FE', 'Classe 0,05', 'Bancada de Pressão', 'disponivel', -100, 265, -40, 140],
        ['PAD-0005', 'SN-334411', 'Fluke', '87V', 'Multímetro Digital', 'Tensão/Corrente', '0 a 1000 V', '0,001 V', '± 0,05%', 'True RMS', 'Laboratório Elétrico', 'disponivel', -20, 345, -10, 170],
        ['PAD-0006', 'SN-220033', 'Mitutoyo', 'HR-150A', 'Durômetro Rockwell', 'Dureza', '20 a 88 HRA', '0,5 HR', '± 0,8 HR', 'Classe A', 'Laboratório de Dureza', 'em_manutencao', -400, -45, -200, -20],
        ['PAD-0007', 'SN-667788', 'Incoterm', '9791', 'Termo-higrômetro', 'Temperatura', '-10 a 60 °C', '0,1 °C', '± 0,3 °C', 'Classe B', 'Sala de Metrologia', 'disponivel', -150, 200, -75, 110],
        ['PAD-0008', 'SN-445566', 'Mitutoyo', '516-104', 'Bloco Padrão (Jogo)', 'Comprimento', '1,005 a 100 mm', '—', '± 0,00015 mm', 'Grau 0', 'Cofre de Padrões', 'disponivel', -60, 670, -30, 335],
        ['PAD-0009', 'SN-101010', 'Gehaka', 'PG200', 'pHmetro', 'pH', '0 a 14 pH', '0,01 pH', '± 0,02 pH', 'Classe Lab', 'Laboratório Químico', 'fora_operacao', -500, -100, -250, -60],
        ['PAD-0010', 'SN-202020', 'Starrett', '436', 'Micrômetro Externo', 'Comprimento', '25 a 50 mm', '0,001 mm', '± 0,002 mm', 'Classe 1', 'Sala de Metrologia — Armário A2', 'disponivel', -280, 80, -140, 50],
        ['PAD-0011', 'SN-303030', 'Wika', 'CTH7000', 'Termômetro de Referência', 'Temperatura', '-50 a 400 °C', '0,01 °C', '± 0,05 °C', 'Classe AA', 'Laboratório de Temperatura', 'em_uso', -90, 270, -45, 140],
        ['PAD-0012', 'SN-404040', 'Kern', '572-37', 'Balança de Precisão', 'Massa', '0 a 6000 g', '0,01 g', '± 0,02 g', 'Classe II', 'Laboratório de Massa', 'disponivel', -45, 320, -22, 160],
    ];
    const idPadrao = [];
    for (const p of padroes) {
        const r = run(
            `INSERT INTO padroes
               (codigo_interno, numero_serie, fabricante, modelo, tipo_instrumento, grandeza,
                faixa_indicacao, resolucao, exatidao, classe_metrologica, localizacao, status,
                data_aquisicao, data_ultima_calibracao, data_proxima_calibracao,
                data_ultima_checagem, data_proxima_checagem, uuid, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11],
             dias(-700), dias(p[12]), dias(p[13]), dias(p[14]), dias(p[15]), uuid(), admin, admin]);
        idPadrao.push(r.lastInsertRowid);
    }

    // ---- CALIBRAÇÕES (histórico) ----------------------------------------
    const labs = ['RBC — Lab Acreditado 1234', 'Inmetro', 'RBC — CalibraTech', 'RBC — MetroLab'];
    for (let i = 0; i < idPadrao.length; i++) {
        run(`INSERT INTO calibracoes (padrao_id, data_calibracao, data_proxima, numero_certificado,
                 laboratorio, rastreabilidade, resultado, incerteza, custo, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [idPadrao[i], dias(padroes[i][12]), dias(padroes[i][13]),
             `CERT-${2024}-${String(1000 + i)}`, labs[i % labs.length], 'RBC/Inmetro',
             i === 8 ? 'reprovado' : (i === 5 ? 'aprovado_com_ressalva' : 'aprovado'),
             '± 0,002 mm', 250 + i * 30, admin, admin]);
    }

    // ---- CHECAGENS -------------------------------------------------------
    for (let i = 0; i < 6; i++) {
        run(`INSERT INTO checagens (padrao_id, data_checagem, data_proxima, metodo, resultado,
                 responsavel_id, responsavel_nome, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [idPadrao[i], dias(padroes[i][14]), dias(padroes[i][15]),
             'Comparação com padrão de referência', i === 8 ? 'nao_conforme' : 'conforme',
             idUsuario.tecnico, 'João Técnico', admin, admin]);
    }

    // ---- SERVIÇOS (com padrões e normas vinculados) ---------------------
    const servicos = [
        ['SRV-2024-001', 'Calibração de paquímetros do cliente Alfa', 'concluido', idCliente[0], dias(-40), dias(-35)],
        ['SRV-2024-002', 'Verificação de balanças industriais', 'em_andamento', idCliente[1], dias(-5), null],
        ['SRV-2024-003', 'Aferição de manômetros de processo', 'planejado', idCliente[2], dias(10), null],
    ];
    const idServico = [];
    for (const s of servicos) {
        const r = run(
            `INSERT INTO servicos (codigo, nome, status, cliente_id, cliente_nome, tecnico_id, tecnico_nome,
                 procedimento, data_inicio, data_conclusao, criado_por, atualizado_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [s[0], s[1], s[2], s[3], get(`SELECT nome FROM clientes WHERE id=?`, [s[3]]).nome,
             idUsuario.tecnico, 'João Técnico', 'PROC-MET-001 — Procedimento técnico de calibração',
             s[4], s[5], admin, admin]);
        idServico.push(r.lastInsertRowid);
    }
    // Vínculos
    run(`INSERT INTO servico_padroes (servico_id, padrao_id) VALUES (?,?)`, [idServico[0], idPadrao[0]]);
    run(`INSERT INTO servico_padroes (servico_id, padrao_id) VALUES (?,?)`, [idServico[0], idPadrao[1]]);
    run(`INSERT INTO servico_padroes (servico_id, padrao_id) VALUES (?,?)`, [idServico[1], idPadrao[2]]);
    run(`INSERT INTO servico_normas (servico_id, norma_id) VALUES (?,?)`, [idServico[0], idNorma[0]]);
    run(`INSERT INTO servico_normas (servico_id, norma_id) VALUES (?,?)`, [idServico[0], idNorma[3]]);

    // ---- MOVIMENTAÇÕES (uma aberta + uma fechada) -----------------------
    run(`INSERT INTO movimentacoes (padrao_id, retirado_por, retirado_por_nome, data_retirada,
             cliente_id, cliente_nome, servico_id, motivo, local_utilizacao, status, criado_por, atualizado_por)
         VALUES (?,?,?,?,?,?,?,?,?, 'aberta', ?, ?)`,
        [idPadrao[2], idUsuario.tecnico, 'João Técnico', dias(-3) + 'T08:30:00Z',
         idCliente[1], 'AutoPeças Beta S.A.', idServico[1], 'Verificação em campo',
         'Planta industrial Beta — Setor 3', admin, admin]);

    run(`INSERT INTO movimentacoes (padrao_id, retirado_por, retirado_por_nome, data_retirada,
             cliente_id, cliente_nome, motivo, local_utilizacao, status,
             devolvido_por, devolvido_por_nome, data_devolucao, condicao_devolucao, criado_por, atualizado_por)
         VALUES (?,?,?,?,?,?,?,?, 'fechada', ?,?,?,?,?,?)`,
        [idPadrao[10], idUsuario.tecnico, 'João Técnico', dias(-20) + 'T09:00:00Z',
         idCliente[0], 'Indústria Metalúrgica Alfa Ltda', 'Calibração no local',
         'Indústria Alfa — Laboratório', idUsuario.tecnico, 'João Técnico',
         dias(-18) + 'T16:00:00Z', 'otima', admin, admin]);

    // ---- CONFIGURAÇÕES ---------------------------------------------------
    run(`INSERT OR REPLACE INTO configuracoes (chave, valor, descricao) VALUES
         ('nome_empresa', 'EXCELMETRO — Laboratório de Metrologia', 'Nome exibido no sistema'),
         ('email_alertas', '1', 'Enviar alertas de vencimento por e-mail'),
         ('dias_alerta', '30,15,7', 'Antecedência dos alertas em dias')`);

    console.log('✅  Dados de demonstração criados:');
    console.log(`    • ${usuarios.length} usuários (um por perfil)`);
    console.log(`    • ${padroes.length} padrões metrológicos`);
    console.log(`    • ${normas.length} normas técnicas`);
    console.log(`    • ${servicos.length} serviços, ${clientes.length} clientes`);
}
