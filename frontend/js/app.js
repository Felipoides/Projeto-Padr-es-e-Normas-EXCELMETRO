// ============================================================================
//  MetroControl — Aplicação principal (SPA)
//  Login + 2FA, shell, roteamento por hash e todas as telas dos módulos.
// ============================================================================
import { api, auth } from './api.js';
import {
    icon, el, escapeHtml, toast, modal, confirmar,
    fmtData, fmtDataHora, fmtMoeda, badge,
    STATUS_PADRAO, STATUS_SERVICO, SITUACAO,
} from './ui.js';
import * as Charts from './charts.js';

const root = document.getElementById('root');

// ---- Tema ------------------------------------------------------------------
function aplicarTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('metrocontrol_theme', t);
}
function iconeTema() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? icon('sun') : icon('moon');
}
function alternarTema() {
    const atual = document.documentElement.getAttribute('data-theme');
    aplicarTema(atual === 'dark' ? 'light' : 'dark');
    const btn = document.getElementById('btn-tema');
    if (btn) btn.innerHTML = iconeTema();
}
aplicarTema(localStorage.getItem('metrocontrol_theme') || 'light');

// ---- Permissões no frontend ------------------------------------------------
const podeEscrever = () => !['visualizador', 'auditor'].includes(auth.user?.perfil);
const ehNivel = (p) => {
    const n = { visualizador: 1, auditor: 2, tecnico: 3, gestor: 4, administrador: 5 };
    return (n[auth.user?.perfil] || 0) >= (n[p] || 99);
};

// ---- QR Code via imagem (API pública; funciona com internet) ---------------
function qrImg(conteudo, size = 220) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(conteudo)}`;
    return `<img src="${url}" alt="QR Code" width="${size}" height="${size}"
        onerror="this.outerHTML='<div class=&quot;empty&quot;>QR indisponível offline.<br>Conteúdo: ${escapeHtml(conteudo)}</div>'">`;
}

// ============================================================================
//  TELA DE LOGIN
// ============================================================================
function renderLogin() {
    root.innerHTML = `
    <div class="login-wrap">
      <div class="login-hero">
        <h1>MetroControl</h1>
        <p>Gestão total de padrões de medição, normas técnicas, calibrações e rastreabilidade metrológica — em conformidade com a ISO/IEC 17025.</p>
        <div class="badges">
          <span>✓ ISO/IEC 17025</span><span>✓ ABNT</span><span>✓ Inmetro</span>
          <span>✓ Rastreabilidade total</span><span>✓ Auditoria completa</span>
        </div>
      </div>
      <div class="login-form-side">
        <div class="login-card">
          <div class="brand">
            <svg class="logo" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#2563eb"/><path d="M50 18 L78 34 V66 L50 82 L22 66 V34 Z" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="10" fill="white"/></svg>
            <b>MetroControl</b>
          </div>
          <h2>Acesse sua conta</h2>
          <p class="sub">Entre com suas credenciais corporativas</p>
          <form id="login-form">
            <div class="field" style="margin-bottom:14px">
              <label>E-mail</label>
              <input type="email" id="email" value="admin@metrocontrol.com" required autocomplete="username">
            </div>
            <div class="field" style="margin-bottom:14px">
              <label>Senha</label>
              <input type="password" id="senha" value="Admin@123" required autocomplete="current-password">
            </div>
            <div class="field hidden" id="campo-2fa" style="margin-bottom:14px">
              <label>Código de verificação (2FA)</label>
              <input type="text" id="codigo2fa" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code">
              <div class="hint">Insira o código de 6 dígitos do seu aplicativo autenticador.</div>
            </div>
            <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px" type="submit" id="btn-login">Entrar</button>
          </form>
          <div class="demo-hint">
            <b>Contas de demonstração</b> (senha entre parênteses):<br>
            admin@metrocontrol.com (Admin@123) — Administrador<br>
            gestor@metrocontrol.com (Gestor@123) — Gestor<br>
            tecnico@metrocontrol.com (Tecnico@123) — Técnico<br>
            auditor@metrocontrol.com (Auditor@123) — Auditor<br>
            viewer@metrocontrol.com (Viewer@123) — Visualizador
          </div>
        </div>
      </div>
    </div>`;

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login');
        btn.disabled = true; btn.textContent = 'Entrando...';
        try {
            const r = await api.post('/auth/login', {
                email: document.getElementById('email').value.trim(),
                senha: document.getElementById('senha').value,
                codigo2fa: document.getElementById('codigo2fa').value || undefined,
            });
            if (r.precisa2fa) {
                document.getElementById('campo-2fa').classList.remove('hidden');
                document.getElementById('codigo2fa').focus();
                toast('Informe o código do seu aplicativo autenticador.', 'info', 'Verificação em 2 etapas');
                return;
            }
            auth.set(r.token, r.usuario);
            iniciar();
        } catch (err) {
            toast(err.message, 'err');
        } finally {
            btn.disabled = false; btn.textContent = 'Entrar';
        }
    };
}

// ============================================================================
//  SHELL DA APLICAÇÃO (sidebar + topbar)
// ============================================================================
const NAV = [
    { grupo: 'Operação' },
    { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
    { id: 'padroes', label: 'Padrões', ic: 'gauge' },
    { id: 'movimentacoes', label: 'Movimentações', ic: 'move' },
    { id: 'vencimentos', label: 'Calibrações & Vencimentos', ic: 'calendar' },
    { grupo: 'Documentação' },
    { id: 'normas', label: 'Normas Técnicas', ic: 'book' },
    { id: 'servicos', label: 'Serviços', ic: 'tool' },
    { id: 'mapa', label: 'Mapa de Localização', ic: 'map' },
    { id: 'relatorios', label: 'Relatórios', ic: 'report' },
    { grupo: 'Administração' },
    { id: 'usuarios', label: 'Usuários & Perfis', ic: 'users', nivel: 'gestor' },
    { id: 'auditoria', label: 'Auditoria', ic: 'shield', nivel: 'auditor' },
    { id: 'lixeira', label: 'Lixeira', ic: 'trash', nivel: 'gestor' },
];

function renderShell() {
    const u = auth.user;
    const iniciais = (u.nome || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
    const navHtml = NAV.map((n) => {
        if (n.grupo) return `<div class="group-label">${n.grupo}</div>`;
        if (n.nivel && !ehNivel(n.nivel)) return '';
        return `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.ic)}<span>${n.label}</span>
            ${n.id === 'vencimentos' ? '<span class="pill hidden" id="pill-venc"></span>' : ''}</a>`;
    }).join('');

    root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <svg class="logo" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#2563eb"/><path d="M50 18 L78 34 V66 L50 82 L22 66 V34 Z" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="10" fill="white"/></svg>
          <div><b>MetroControl</b><small>METROLOGIA 17025</small></div>
        </div>
        <nav class="nav">${navHtml}</nav>
        <div class="user-box">
          <div class="avatar">${iniciais}</div>
          <div class="info"><b>${escapeHtml(u.nome)}</b><span>${escapeHtml(u.perfil)}</span></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <h1 id="page-title">Dashboard</h1>
          <div class="search-global">
            ${icon('search')}
            <input type="text" id="busca-global" placeholder="Pesquisar padrões por código, série, modelo...">
          </div>
          <div class="spacer"></div>
          <button class="icon-btn" id="btn-scan" title="Escanear QR Code">${icon('camera')}</button>
          <button class="icon-btn" id="btn-alertas" title="Alertas de vencimento">${icon('bell')}<span class="dot hidden" id="alert-dot"></span></button>
          <button class="icon-btn" id="btn-tema" title="Alternar tema">${iconeTema()}</button>
          <button class="icon-btn" id="btn-perfil" title="Meu perfil">${icon('key')}</button>
          <button class="icon-btn" id="btn-sair" title="Sair">${icon('logout')}</button>
        </header>
        <div class="content" id="content"><div class="spinner"></div></div>
      </main>
    </div>`;

    document.getElementById('btn-tema').onclick = alternarTema;
    document.getElementById('btn-sair').onclick = () => { auth.clear(); renderLogin(); };
    document.getElementById('btn-perfil').onclick = telaPerfil;
    document.getElementById('btn-scan').onclick = abrirScanner;
    document.getElementById('btn-alertas').onclick = () => { location.hash = '#/vencimentos'; };
    const bg = document.getElementById('busca-global');
    bg.onkeydown = (e) => { if (e.key === 'Enter') location.hash = `#/padroes?busca=${encodeURIComponent(bg.value)}`; };
    atualizarAlertas();
}

function marcarNavAtivo(id) {
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === id));
    const titulo = NAV.find((n) => n.id === id)?.label || 'MetroControl';
    const t = document.getElementById('page-title'); if (t) t.textContent = titulo;
}

async function atualizarAlertas() {
    try {
        const a = await api.get('/alertas');
        const dot = document.getElementById('alert-dot');
        const pill = document.getElementById('pill-venc');
        if (a.total > 0) { dot?.classList.remove('hidden'); if (pill) { pill.classList.remove('hidden'); pill.textContent = a.total; } }
        else { dot?.classList.add('hidden'); pill?.classList.add('hidden'); }
    } catch {}
}

const content = () => document.getElementById('content');
const setContent = (html) => { content().innerHTML = ''; if (typeof html === 'string') content().innerHTML = html; else content().appendChild(html); };
const loading = () => setContent('<div class="spinner"></div>');

// ============================================================================
//  ROTEADOR
// ============================================================================
const ROTAS = {
    dashboard: viewDashboard, padroes: viewPadroes, movimentacoes: viewMovimentacoes,
    vencimentos: viewVencimentos, normas: viewNormas, servicos: viewServicos,
    mapa: viewMapa, relatorios: viewRelatorios, usuarios: viewUsuarios,
    auditoria: viewAuditoria, lixeira: viewLixeira,
};

async function rotear() {
    const hash = location.hash.replace(/^#\//, '') || 'dashboard';
    const [caminho, qsRaw] = hash.split('?');
    const partes = caminho.split('/');
    const query = Object.fromEntries(new URLSearchParams(qsRaw || ''));

    // Rota especial de QR: #/q/<uuid>
    if (partes[0] === 'q' && partes[1]) {
        try { const p = await api.get(`/padroes/uuid/${partes[1]}`); location.hash = `#/padroes/${p.id}`; }
        catch { toast('Padrão não encontrado para este QR Code.', 'err'); location.hash = '#/padroes'; }
        return;
    }
    if (partes[0] === 'padroes' && partes[1]) { marcarNavAtivo('padroes'); return viewPadraoDetalhe(partes[1]); }
    if (partes[0] === 'servicos' && partes[1]) { marcarNavAtivo('servicos'); return viewServicoDetalhe(partes[1]); }
    if (partes[0] === 'normas' && partes[1]) { marcarNavAtivo('normas'); return viewNormaDetalhe(partes[1]); }

    marcarNavAtivo(partes[0]);
    const view = ROTAS[partes[0]] || viewDashboard;
    view(query);
}

// ============================================================================
//  DASHBOARD
// ============================================================================
async function viewDashboard() {
    loading();
    const d = await api.get('/dashboard');
    const k = d.kpis;
    const kpiCard = (val, lbl, ic, cor, hash) => `
      <div class="kpi ${hash ? 'clickable' : ''}" ${hash ? `onclick="location.hash='${hash}'"` : ''}>
        <div class="ico ${cor}">${icon(ic)}</div>
        <div class="val">${val}</div><div class="lbl">${lbl}</div>
      </div>`;

    const statusData = d.graficos.porStatus.map((s) => ({
        rotulo: (STATUS_PADRAO[s.status] || [s.status])[0], valor: s.total,
        cor: { disponivel: '#16a34a', em_uso: '#2563eb', em_manutencao: '#d97706', fora_operacao: '#dc2626', inativo: '#94a3b8' }[s.status],
    }));
    const grandezaData = d.graficos.porGrandeza.map((g) => ({ rotulo: g.grandeza, valor: g.total }));
    const calData = d.graficos.calibracoesPorMes.map((c) => ({ rotulo: c.mes.slice(5), valor: c.total }));

    const atividades = d.ultimasAtividades.map((a) => `
      <div class="tl-item">
        <div class="tl-act">${escapeHtml(a.descricao || a.acao)}</div>
        <div class="tl-meta">${escapeHtml(a.usuario_nome || 'Sistema')} · ${fmtDataHora(a.criado_em)}</div>
      </div>`).join('') || '<div class="empty">Sem atividades.</div>';

    setContent(`
      <div class="page-head"><div class="ph-text">
        <h2>Painel Executivo</h2><p>Visão consolidada do parque de padrões metrológicos</p>
      </div></div>
      <div class="kpi-grid">
        ${kpiCard(k.totalPadroes, 'Total de padrões', 'box', 'blue', '#/padroes')}
        ${kpiCard(k.disponiveis, 'Disponíveis', 'check', 'green', '#/padroes?filtro=disponivel')}
        ${kpiCard(k.emUso, 'Em uso', 'move', 'sky', '#/padroes?filtro=em_uso')}
        ${kpiCard(k.vencidos, 'Vencidos', 'alert', 'red', '#/padroes?filtro=vencidos')}
        ${kpiCard(k.proximas30, 'Vencem em 30 dias', 'clock', 'amber', '#/vencimentos')}
        ${kpiCard(k.movAbertas, 'Fora do laboratório', 'box', 'purple', '#/movimentacoes?status=aberta')}
        ${kpiCard(k.servicosConcluidos, 'Serviços concluídos', 'tool', 'teal', '#/servicos')}
        ${kpiCard(k.totalNormas, 'Normas cadastradas', 'book', 'blue', '#/normas')}
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>Padrões por status</h3></div><div class="card-body">${Charts.donut(statusData)}</div></div>
        <div class="card"><div class="card-head"><h3>Padrões por grandeza</h3></div><div class="card-body">${Charts.barras(grandezaData)}</div></div>
      </div>
      <div class="grid-3">
        <div class="card"><div class="card-head"><h3>Calibrações por mês</h3><span class="sub">últimos 12 meses</span></div>
          <div class="card-body">${calData.length ? Charts.linha(calData) : '<div class="empty">Sem calibrações no período.</div>'}</div></div>
        <div class="card"><div class="card-head"><h3>${icon('activity')} Últimas atividades</h3></div>
          <div class="card-body"><div class="timeline">${atividades}</div></div></div>
      </div>`);
}

// ============================================================================
//  PADRÕES — lista
// ============================================================================
const FILTROS_RAPIDOS = [
    ['', 'Todos'], ['disponivel', 'Disponíveis'], ['em_uso', 'Em uso'],
    ['vencidos', 'Vencidos'], ['proximos', 'Próximos ao vencimento'],
    ['em_manutencao', 'Em manutenção'], ['fora_operacao', 'Fora de operação'],
];
let filtroPadrao = { busca: '', filtro: '' };

async function viewPadroes(query = {}) {
    if (query.busca !== undefined) filtroPadrao.busca = query.busca;
    if (query.filtro !== undefined) filtroPadrao.filtro = query.filtro;
    loading();
    const r = await api.get('/padroes' + api.qs(filtroPadrao));
    const chips = FILTROS_RAPIDOS.map(([v, l]) =>
        `<button class="chip ${filtroPadrao.filtro === v ? 'active' : ''}" data-filtro="${v}">${l}</button>`).join('');

    const linhas = r.itens.map((p) => `
      <tr onclick="location.hash='#/padroes/${p.id}'" style="cursor:pointer">
        <td class="mono">${escapeHtml(p.codigo_interno)}</td>
        <td><div class="t-strong">${escapeHtml(p.modelo || '—')}</div><div class="t-muted">${escapeHtml(p.fabricante || '')} · ${escapeHtml(p.tipo_instrumento || '')}</div></td>
        <td>${escapeHtml(p.grandeza || '—')}</td>
        <td>${escapeHtml(p.localizacao || '—')}</td>
        <td>${badge(STATUS_PADRAO, p.status)}</td>
        <td>${badge(SITUACAO, p.situacao_vencimento)}</td>
        <td class="t-muted">${fmtData(p.data_proxima_calibracao)}</td>
      </tr>`).join('');

    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Padrões de Medição</h2><p>${r.total} padrões cadastrados · busca avançada e filtros rápidos</p></div>
        <div class="ph-actions">${podeEscrever() ? `<button class="btn btn-primary" id="novo">${icon('plus')} Novo padrão</button>` : ''}</div></div>
      <div class="toolbar">
        <div class="search">${icon('search')}<input type="text" id="busca" placeholder="Código, série, fabricante, modelo, grandeza, localização..." value="${escapeHtml(filtroPadrao.busca)}"></div>
      </div>
      <div class="chips" style="margin-bottom:16px">${chips}</div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Código</th><th>Equipamento</th><th>Grandeza</th><th>Localização</th><th>Status</th><th>Situação</th><th>Próx. calibração</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="7"><div class="empty">'+icon('box')+'<div>Nenhum padrão encontrado.</div></div></td></tr>'}</tbody>
      </table></div></div>
    </div>`);

    c.querySelectorAll('[data-filtro]').forEach((b) => b.onclick = () => { filtroPadrao.filtro = b.dataset.filtro; viewPadroes(); });
    const busca = c.querySelector('#busca');
    let tmr; busca.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { filtroPadrao.busca = busca.value; viewPadroes(); }, 350); };
    const nv = c.querySelector('#novo'); if (nv) nv.onclick = () => formPadrao();
    setContent(c);
}

// ---- Formulário de padrão (criar/editar) -----------------------------------
function formPadrao(p = null) {
    const campos = [
        ['codigo_interno', 'Código interno (identificação) *', 'text'], ['numero_serie', 'Número de série', 'text'],
        ['tipo_instrumento', 'Instrumento (tipo)', 'text'], ['fabricante', 'Fabricante', 'text'],
        ['modelo', 'Modelo', 'text'], ['grandeza', 'Grandeza medida', 'text'],
        ['capacidade', 'Capacidade', 'text'], ['faixa_indicacao', 'Faixa de utilização', 'text'],
        ['resolucao', 'Resolução', 'text'], ['unidade', 'Unidade', 'text'],
        ['exatidao', 'Exatidão', 'text'], ['tolerancia', 'Tolerância', 'text'],
        ['classe_metrologica', 'Classe metrológica', 'text'], ['lacre', 'Lacre', 'text'],
        ['departamento', 'Departamento', 'text'], ['usuario_instrumento', 'Usuário', 'text'],
        ['procedimento', 'Procedimento', 'text'], ['codigo_barras', 'Código de barras', 'text'],
        ['localizacao', 'Localização física', 'text'], ['setor', 'Setor', 'text'],
        ['data_aquisicao', 'Data de aquisição', 'date'],
        ['data_ultima_calibracao', 'Última calibração', 'date'], ['data_proxima_calibracao', 'Próxima calibração', 'date'],
        ['data_ultima_checagem', 'Última checagem', 'date'], ['data_proxima_checagem', 'Próxima checagem', 'date'],
        ['periodicidade_calibracao_meses', 'Periodicidade calibração (meses)', 'number'],
        ['periodicidade_checagem_meses', 'Periodicidade checagem (meses)', 'number'],
    ];
    const fields = campos.map(([n, l, t]) =>
        `<div class="field"><label>${l}</label><input type="${t}" name="${n}" value="${p ? escapeHtml(p[n] ?? '') : (t === 'number' ? (n.includes('calibracao') ? 12 : 6) : '')}"></div>`).join('');
    const statusOpts = Object.entries(STATUS_PADRAO).map(([v, [l]]) => `<option value="${v}" ${p?.status === v ? 'selected' : ''}>${l}</option>`).join('');
    const body = el(`<form class="form-grid" id="fp">
      ${fields}
      <div class="field"><label>Status operacional</label><select name="status">${statusOpts}</select></div>
      <div class="field"><label>Periodicidade (unidade)</label><input type="text" value="Mês(es)" disabled></div>
      <div class="field full"><label>Instruções de uso</label><textarea name="instrucoes">${p ? escapeHtml(p.instrucoes ?? '') : ''}</textarea></div>
      <div class="field full"><label>Procedimento de verificação</label><textarea name="procedimento_verificacao">${p ? escapeHtml(p.procedimento_verificacao ?? '') : ''}</textarea></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes">${p ? escapeHtml(p.observacoes ?? '') : ''}</textarea></div>
      <div class="field full"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="travado" style="width:auto" ${p?.travado ? 'checked' : ''}> Travar registro (impede edição acidental)</label></div>
    </form>`);
    const btnCancel = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnSave = el(`<button class="btn btn-primary">${icon('check')} Salvar</button>`);
    const m = modal({ title: p ? `Editar ${p.codigo_interno}` : 'Novo padrão', body, footer: [btnCancel, btnSave], size: 'lg' });
    btnCancel.onclick = m.close;
    btnSave.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        for (const k in dados) if (dados[k] === '') dados[k] = null;
        dados.travado = body.querySelector('[name=travado]').checked ? 1 : 0;
        btnSave.disabled = true;
        try {
            if (p) { await api.put(`/padroes/${p.id}`, dados); toast('Padrão atualizado.'); }
            else { await api.post('/padroes', dados); toast('Padrão criado.'); }
            m.close(); rotear(); atualizarAlertas();
        } catch (err) { toast(err.message, 'err'); btnSave.disabled = false; }
    };
}

// ---- Detalhe do padrão -----------------------------------------------------
async function viewPadraoDetalhe(id) {
    loading();
    const p = await api.get(`/padroes/${id}`);
    const timeline = await api.get(`/auditoria/timeline/padroes/${id}`).catch(() => []);
    const dlItem = (k, v) => `<div class="dl-item"><div class="k">${k}</div><div class="v">${v ?? '—'}</div></div>`;

    const movs = p.movimentacoes.map((m) => `<tr><td>${escapeHtml(m.local_utilizacao || '—')}</td><td>${escapeHtml(m.retirado_por_nome || '—')}</td>
        <td>${fmtDataHora(m.data_retirada)}</td><td>${m.data_devolucao ? fmtDataHora(m.data_devolucao) : '<span class="t-muted">—</span>'}</td>
        <td>${m.status === 'aberta' ? '<span class="badge b-amber">Em uso</span>' : '<span class="badge b-green">Devolvido</span>'}</td></tr>`).join('')
        || '<tr><td colspan="5" class="t-muted">Sem movimentações.</td></tr>';
    const cals = p.calibracoes.map((c) => `<tr><td>${fmtData(c.data_calibracao)}</td><td>${escapeHtml(c.numero_certificado || '—')}</td>
        <td>${escapeHtml(c.laboratorio || '—')}</td><td>${escapeHtml(c.resultado || '—')}</td><td>${fmtData(c.data_proxima)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="t-muted">Sem calibrações.</td></tr>';
    const tl = timeline.map((t) => `<div class="tl-item"><div class="tl-act">${escapeHtml(t.descricao || t.acao)}</div><div class="tl-meta">${escapeHtml(t.usuario_nome || '')} · ${fmtDataHora(t.criado_em)}</div></div>`).join('') || '<div class="empty">Sem eventos.</div>';

    const c = el(`<div>
      <div class="page-head">
        <div class="ph-text"><h2>${escapeHtml(p.codigo_interno)} ${badge(STATUS_PADRAO, p.status)} ${badge(SITUACAO, p.situacao_vencimento)}</h2>
          <p>${escapeHtml(p.fabricante || '')} ${escapeHtml(p.modelo || '')} · ${escapeHtml(p.tipo_instrumento || '')}</p></div>
        <div class="ph-actions">
          <button class="btn btn-ghost" id="b-qr">${icon('qr')} QR Code</button>
          <a class="btn btn-ghost" href="#/padroes">${icon('chevron')} Voltar</a>
          ${podeEscrever() ? `<button class="btn btn-ghost" id="b-mov">${icon('move')} Movimentar</button>` : ''}
          ${podeEscrever() ? `<button class="btn btn-ghost" id="b-cal">${icon('calendar')} Registrar calibração</button>` : ''}
          ${podeEscrever() ? `<button class="btn btn-primary" id="b-edit">${icon('edit')} Editar</button>` : ''}
          ${ehNivel('tecnico') ? `<button class="btn btn-danger" id="b-del">${icon('trash')}</button>` : ''}
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>Dados técnicos</h3>${p.travado ? '<span class="badge b-gray">🔒 Travado</span>' : ''}</div><div class="card-body"><div class="dl">
          ${dlItem('Nº de série', escapeHtml(p.numero_serie))}${dlItem('Grandeza', escapeHtml(p.grandeza))}
          ${dlItem('Capacidade', escapeHtml(p.capacidade))}${dlItem('Faixa de utilização', escapeHtml(p.faixa_indicacao))}
          ${dlItem('Resolução', escapeHtml(p.resolucao))}${dlItem('Unidade', escapeHtml(p.unidade))}
          ${dlItem('Exatidão', escapeHtml(p.exatidao))}${dlItem('Tolerância', escapeHtml(p.tolerancia))}
          ${dlItem('Classe metrológica', escapeHtml(p.classe_metrologica))}${dlItem('Lacre', escapeHtml(p.lacre))}
          ${dlItem('Departamento', escapeHtml(p.departamento))}${dlItem('Usuário', escapeHtml(p.usuario_instrumento))}
          ${dlItem('Procedimento', escapeHtml(p.procedimento))}${dlItem('Código de barras', escapeHtml(p.codigo_barras))}
          ${dlItem('Localização', escapeHtml(p.localizacao))}${dlItem('Setor', escapeHtml(p.setor))}
          ${dlItem('Aquisição', fmtData(p.data_aquisicao))}${dlItem('Identificador (QR)', `<span class="mono" style="font-size:11px">${escapeHtml(p.uuid)}</span>`)}
        </div></div></div>
        <div class="card"><div class="card-head"><h3>${icon('calendar')} Vencimentos</h3></div><div class="card-body"><div class="dl">
          ${dlItem('Última calibração', fmtData(p.data_ultima_calibracao))}
          ${dlItem('Próxima calibração', `<span class="${p.dias_para_calibracao<0?'sev-vencido':p.dias_para_calibracao<=15?'sev-alerta':''}">${fmtData(p.data_proxima_calibracao)} ${p.dias_para_calibracao!=null?`(${p.dias_para_calibracao} d)`:''}</span>`)}
          ${dlItem('Última checagem', fmtData(p.data_ultima_checagem))}
          ${dlItem('Próxima checagem', `<span class="${p.dias_para_checagem<0?'sev-vencido':p.dias_para_checagem<=15?'sev-alerta':''}">${fmtData(p.data_proxima_checagem)} ${p.dias_para_checagem!=null?`(${p.dias_para_checagem} d)`:''}</span>`)}
        </div>
        <div style="margin-top:14px"><div class="card-head" style="padding:0 0 10px"><h3>${icon('activity')} Linha do tempo</h3></div>
          <div class="timeline" style="max-height:200px;overflow:auto">${tl}</div></div>
        </div></div>
      </div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Histórico de calibrações</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Data</th><th>Certificado</th><th>Laboratório</th><th>Resultado</th><th>Próxima</th></tr></thead><tbody>${cals}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Histórico de movimentações (saída / retorno)</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Local</th><th>Responsável</th><th>Data Saída</th><th>Data Retorno</th><th>Situação</th></tr></thead><tbody>${movs}</tbody></table></div></div>
    </div>`);

    c.querySelector('#b-qr').onclick = () => mostrarQR(p);
    const be = c.querySelector('#b-edit'); if (be) be.onclick = () => formPadrao(p);
    const bm = c.querySelector('#b-mov'); if (bm) bm.onclick = () => formMovimentacao(p);
    const bc = c.querySelector('#b-cal'); if (bc) bc.onclick = () => formCalibracao(p);
    const bd = c.querySelector('#b-del'); if (bd) bd.onclick = async () => {
        const r = await confirmar({ title: 'Excluir padrão', message: `Excluir "${p.codigo_interno}"? O registro irá para a lixeira e poderá ser recuperado.`, danger: true, pedirMotivo: true });
        if (r) { try { await api.del(`/padroes/${p.id}`, r); toast('Padrão movido para a lixeira.'); location.hash = '#/padroes'; } catch (e) { toast(e.message, 'err'); } }
    };
    setContent(c);
}

function mostrarQR(p) {
    const conteudo = `${location.origin}/#/q/${p.uuid}`;
    const body = el(`<div class="qr-box">
        ${qrImg(conteudo, 220)}
        <div class="code">${escapeHtml(p.codigo_interno)}</div>
        <div class="t-muted" style="margin-top:6px">${escapeHtml(p.modelo || '')}</div>
        <div class="t-muted" style="font-size:11px;margin-top:10px">Aponte a câmera para abrir o padrão diretamente no sistema.</div>
      </div>`);
    const btnPrint = el(`<button class="btn btn-ghost">${icon('report')} Imprimir etiqueta</button>`);
    const btnClose = el(`<button class="btn btn-primary">Fechar</button>`);
    const m = modal({ title: 'Etiqueta QR Code', body, footer: [btnPrint, btnClose], size: 'sm' });
    btnClose.onclick = m.close;
    btnPrint.onclick = () => {
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Etiqueta ${p.codigo_interno}</title></head><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>${p.codigo_interno}</h2><p>${p.fabricante||''} ${p.modelo||''}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(conteudo)}"><p>MetroControl · Metrologia</p>
          <script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    };
}

// ============================================================================
//  MOVIMENTAÇÕES
// ============================================================================
async function viewMovimentacoes(query = {}) {
    loading();
    const status = query.status || '';
    const movs = await api.get('/movimentacoes' + api.qs({ status }));
    const chips = [['', 'Todas'], ['aberta', 'Em uso (fora)'], ['fechada', 'Devolvidas']]
        .map(([v, l]) => `<button class="chip ${status === v ? 'active' : ''}" onclick="location.hash='#/movimentacoes${v ? '?status=' + v : ''}'">${l}</button>`).join('');
    const linhas = movs.map((m) => `<tr>
        <td class="mono">${escapeHtml(m.codigo_interno)}</td>
        <td>${escapeHtml(m.local_utilizacao || '—')}</td>
        <td>${escapeHtml(m.retirado_por_nome || '—')}</td>
        <td>${fmtDataHora(m.data_retirada)}</td>
        <td>${m.data_devolucao ? fmtDataHora(m.data_devolucao) : '<span class="t-muted">—</span>'}</td>
        <td>${m.status === 'aberta' ? `<span class="badge b-amber">${m.dias_fora} dia(s) fora</span>` : '<span class="badge b-green">Devolvido</span>'}</td>
        <td>${m.status === 'aberta' && podeEscrever() ? `<button class="btn btn-sm btn-primary" data-dev="${m.id}">${icon('check')} Registrar retorno</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7"><div class="empty">'+icon('move')+'<div>Nenhuma movimentação.</div></div></td></tr>';

    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Movimentações (Controle de Saída)</h2><p>Saída e retorno de padrões — com local, responsável e datas</p></div>
        <div class="ph-actions">${podeEscrever() ? `<button class="btn btn-primary" id="nova">${icon('plus')} Nova movimentação</button>` : ''}</div></div>
      <div class="chips" style="margin-bottom:16px">${chips}</div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Padrão</th><th>Local</th><th>Responsável</th><th>Data Saída</th><th>Data Retorno</th><th>Situação</th><th></th></tr></thead>
        <tbody>${linhas}</tbody></table></div></div></div>`);
    const nv = c.querySelector('#nova'); if (nv) nv.onclick = () => formMovimentacao();
    c.querySelectorAll('[data-dev]').forEach((b) => b.onclick = () => formDevolucao(b.dataset.dev));
    setContent(c);
}

// Data/hora atual no formato aceito por <input type="datetime-local">.
function agoraLocal() {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
}

async function formMovimentacao(padrao = null) {
    let padroes = [];
    if (!padrao) padroes = (await api.get('/padroes?filtro=disponivel&limite=500')).itens;
    const clientes = await api.get('/clientes').catch(() => []);
    const optsP = padrao ? `<option value="${padrao.id}">${escapeHtml(padrao.codigo_interno)} — ${escapeHtml(padrao.modelo || '')}</option>`
        : padroes.map((p) => `<option value="${p.id}">${escapeHtml(p.codigo_interno)} — ${escapeHtml(p.modelo || '')}</option>`).join('');
    const optsC = `<option value="">— Sem cliente —</option>` + clientes.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
    const body = el(`<form class="form-grid" id="fm">
      <div class="field full"><label>Padrão *</label><select name="padrao_id">${optsP}</select></div>
      <div class="field"><label>Local de utilização</label><input name="local_utilizacao" placeholder="Ex.: Impacta, planta, campo..."></div>
      <div class="field"><label>Responsável</label><input name="responsavel_nome" value="${escapeHtml(auth.user.nome)}" placeholder="Ex.: Valdir/Alexandre"></div>
      <div class="field"><label>Data de saída *</label><input type="datetime-local" name="data_retirada" value="${agoraLocal()}"></div>
      <div class="field"><label>Cliente relacionado</label><select name="cliente_id">${optsC}</select></div>
      <div class="field full"><label>Motivo da utilização</label><input name="motivo" placeholder="Ex.: calibração em campo, ensaio..."></div>
      <div class="field full"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="ja-retornou" style="width:auto"> Já retornou? Registrar a data de retorno agora</label></div>
      <div class="field hidden" id="bloco-retorno"><label>Data de retorno</label><input type="datetime-local" name="data_devolucao" value="${agoraLocal()}"></div>
      <div class="field hidden" id="bloco-condicao"><label>Condição na devolução</label>
        <select name="condicao_devolucao"><option value="otima">Ótima</option><option value="boa" selected>Boa</option>
          <option value="danificado">Danificado (→ manutenção)</option><option value="requer_calibracao">Requer calibração (→ fora de operação)</option></select></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes"></textarea></div>
    </form>`);
    const chk = body.querySelector('#ja-retornou');
    chk.onchange = () => {
        body.querySelector('#bloco-retorno').classList.toggle('hidden', !chk.checked);
        body.querySelector('#bloco-condicao').classList.toggle('hidden', !chk.checked);
    };
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Registrar movimentação</button>`);
    const m = modal({ title: 'Registrar saída / retorno', body, footer: [btnC, btnS] });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        if (!chk.checked) { delete dados.data_devolucao; delete dados.condicao_devolucao; }
        btnS.disabled = true;
        try { await api.post('/movimentacoes', dados); toast(chk.checked ? 'Saída e retorno registrados.' : 'Saída registrada.'); m.close(); rotear(); atualizarAlertas(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

function formDevolucao(id) {
    const body = el(`<form class="form-grid">
      <div class="field full"><label>Data de retorno *</label><input type="datetime-local" name="data_devolucao" value="${agoraLocal()}"></div>
      <div class="field full"><label>Condição do padrão na devolução</label>
        <select name="condicao_devolucao">
          <option value="otima">Ótima</option><option value="boa" selected>Boa</option>
          <option value="danificado">Danificado (→ manutenção)</option>
          <option value="requer_calibracao">Requer calibração (→ fora de operação)</option>
        </select></div>
      <div class="field full"><label>Observações da devolução</label><textarea name="observacoes_devolucao"></textarea></div>
    </form>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Confirmar devolução</button>`);
    const m = modal({ title: 'Registrar devolução', body, footer: [btnC, btnS], size: 'sm' });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        btnS.disabled = true;
        try { await api.post(`/movimentacoes/${id}/devolver`, dados); toast('Devolução registrada.'); m.close(); rotear(); atualizarAlertas(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

// ============================================================================
//  CALIBRAÇÕES & VENCIMENTOS
// ============================================================================
async function viewVencimentos() {
    loading();
    const v = await api.get('/vencimentos');
    const grupos = [
        ['vencidos', 'Vencidos', 'b-red', v.vencidos],
        ['em_7', 'Vencem em até 7 dias', 'b-amber', v.em_7],
        ['em_15', 'Vencem em até 15 dias', 'b-amber', v.em_15],
        ['em_30', 'Vencem em até 30 dias', 'b-sky', v.em_30],
    ];
    const tabela = (itens) => itens.length ? `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Equipamento</th><th>Tipo</th><th>Vence em</th><th>Dias</th></tr></thead><tbody>
        ${itens.map((i) => `<tr onclick="location.hash='#/padroes/${i.id}'" style="cursor:pointer">
          <td class="mono">${escapeHtml(i.codigo_interno)}</td><td>${escapeHtml(i.modelo || '—')}</td>
          <td><span class="badge ${i.tipo === 'calibracao' ? 'b-blue' : 'b-purple'}">${i.tipo === 'calibracao' ? 'Calibração' : 'Checagem'}</span></td>
          <td>${fmtData(i.vence_em)}</td><td class="${i.dias < 0 ? 'sev-vencido' : i.dias <= 7 ? 'sev-critico' : i.dias <= 15 ? 'sev-alerta' : 'sev-atencao'}">${i.dias} d</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="card-body t-muted">Nenhum item nesta faixa. 👍</div>';

    const cards = grupos.map(([k, l, cls, itens]) => `
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${l}</h3><span class="badge ${cls}">${itens.length}</span></div>${tabela(itens)}</div>`).join('');

    setContent(`<div>
      <div class="page-head"><div class="ph-text"><h2>Calibrações & Vencimentos</h2><p>Controle automático de calibrações e checagens — alertas em 7, 15 e 30 dias</p></div>
        <div class="ph-actions"><a class="btn btn-ghost" href="#/relatorios">${icon('report')} Relatório de vencidos</a></div></div>
      ${cards}</div>`);
}

function formCalibracao(padrao) {
    const body = el(`<form class="form-grid">
      <div class="field"><label>Data da calibração *</label><input type="date" name="data_calibracao" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Próxima (auto se vazio)</label><input type="date" name="data_proxima"></div>
      <div class="field"><label>Nº do certificado</label><input name="numero_certificado"></div>
      <div class="field"><label>Laboratório</label><input name="laboratorio" placeholder="RBC / Inmetro..."></div>
      <div class="field"><label>Rastreabilidade</label><input name="rastreabilidade" value="RBC/Inmetro"></div>
      <div class="field"><label>Incerteza</label><input name="incerteza"></div>
      <div class="field"><label>Resultado</label><select name="resultado">
        <option value="aprovado">Aprovado</option><option value="aprovado_com_ressalva">Aprovado com ressalva</option><option value="reprovado">Reprovado</option></select></div>
      <div class="field"><label>Custo (R$)</label><input type="number" step="0.01" name="custo"></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes"></textarea></div>
    </form>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Registrar</button>`);
    const m = modal({ title: `Calibração — ${padrao.codigo_interno}`, body, footer: [btnC, btnS] });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        dados.padrao_id = padrao.id;
        for (const k in dados) if (dados[k] === '') dados[k] = null;
        btnS.disabled = true;
        try { await api.post('/calibracoes', dados); toast('Calibração registrada.'); m.close(); rotear(); atualizarAlertas(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

// ============================================================================
//  NORMAS
// ============================================================================
async function viewNormas(query = {}) {
    loading();
    const normas = await api.get('/normas' + api.qs({ busca: query.busca }));
    const linhas = normas.map((n) => `<tr onclick="location.hash='#/normas/${n.id}'" style="cursor:pointer">
        <td class="mono">${escapeHtml(n.codigo)}</td><td class="t-strong">${escapeHtml(n.nome)}</td>
        <td>${escapeHtml(n.revisao || '—')}</td><td>${escapeHtml(n.organismo || '—')}</td>
        <td>${escapeHtml(n.area_aplicacao || '—')}</td>
        <td>${badge({ vigente: ['Vigente', 'b-green'], revisada: ['Revisada', 'b-amber'], cancelada: ['Cancelada', 'b-red'] }, n.status)}</td></tr>`).join('')
        || '<tr><td colspan="6"><div class="empty">'+icon('book')+'<div>Nenhuma norma.</div></div></td></tr>';
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Normas Técnicas</h2><p>Biblioteca digital com controle de revisões e vínculo a serviços</p></div>
        <div class="ph-actions">${podeEscrever() ? `<button class="btn btn-primary" id="nova">${icon('plus')} Nova norma</button>` : ''}</div></div>
      <div class="toolbar"><div class="search">${icon('search')}<input id="busca" placeholder="Buscar por código, nome, organismo..." value="${escapeHtml(query.busca||'')}"></div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Revisão</th><th>Organismo</th><th>Aplicação</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table></div></div></div>`);
    const busca = c.querySelector('#busca'); let tmr;
    busca.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => location.hash = `#/normas?busca=${encodeURIComponent(busca.value)}`, 350); };
    const nv = c.querySelector('#nova'); if (nv) nv.onclick = () => formNorma();
    setContent(c);
}

function formNorma(n = null) {
    const f = (name, label, val = '') => `<div class="field"><label>${label}</label><input name="${name}" value="${escapeHtml((n && n[name]) ?? val)}"></div>`;
    const body = el(`<form class="form-grid">
      ${f('codigo', 'Código *')}${f('nome', 'Nome *')}${f('revisao', 'Revisão')}${f('organismo', 'Organismo (ABNT/ISO/Inmetro)')}
      ${f('area_aplicacao', 'Área de aplicação')}
      <div class="field"><label>Data de emissão</label><input type="date" name="data_emissao" value="${n?.data_emissao||''}"></div>
      <div class="field"><label>Data de revisão</label><input type="date" name="data_revisao" value="${n?.data_revisao||''}"></div>
      <div class="field"><label>Status</label><select name="status"><option value="vigente">Vigente</option><option value="revisada" ${n?.status==='revisada'?'selected':''}>Revisada</option><option value="cancelada" ${n?.status==='cancelada'?'selected':''}>Cancelada</option></select></div>
      <div class="field full"><label>Arquivo PDF (nome/referência)</label><input name="arquivo_pdf" value="${escapeHtml(n?.arquivo_pdf||'')}" placeholder="Ex.: ISO17025-2017.pdf"></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes">${escapeHtml(n?.observacoes||'')}</textarea></div>
    </form>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Salvar</button>`);
    const m = modal({ title: n ? `Editar ${n.codigo}` : 'Nova norma', body, footer: [btnC, btnS] });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        btnS.disabled = true;
        try { if (n) await api.put(`/normas/${n.id}`, dados); else await api.post('/normas', dados); toast('Norma salva.'); m.close(); rotear(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

async function viewNormaDetalhe(id) {
    loading();
    const n = await api.get(`/normas/${id}`);
    const dlItem = (k, v) => `<div class="dl-item"><div class="k">${k}</div><div class="v">${v ?? '—'}</div></div>`;
    const revs = n.revisoes.map((r) => `<tr><td>${escapeHtml(r.revisao || '—')}</td><td>${fmtData(r.data_revisao)}</td><td>${escapeHtml(r.descricao || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="t-muted">Sem revisões anteriores.</td></tr>';
    const servs = n.servicos.map((s) => `<span class="badge b-blue" style="margin:2px">${escapeHtml(s.codigo || s.nome)}</span>`).join(' ') || '<span class="t-muted">Nenhum serviço vinculado.</span>';
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>${escapeHtml(n.codigo)}</h2><p>${escapeHtml(n.nome)}</p></div>
        <div class="ph-actions"><a class="btn btn-ghost" href="#/normas">${icon('chevron')} Voltar</a>${podeEscrever() ? `<button class="btn btn-primary" id="ed">${icon('edit')} Editar</button>` : ''}</div></div>
      <div class="card" style="margin-bottom:16px"><div class="card-body"><div class="dl">
        ${dlItem('Revisão', escapeHtml(n.revisao))}${dlItem('Organismo', escapeHtml(n.organismo))}
        ${dlItem('Emissão', fmtData(n.data_emissao))}${dlItem('Revisão (data)', fmtData(n.data_revisao))}
        ${dlItem('Aplicação', escapeHtml(n.area_aplicacao))}${dlItem('Arquivo', escapeHtml(n.arquivo_pdf))}
      </div></div></div>
      <div class="grid-2">
        <div class="card"><div class="card-head"><h3>Histórico de revisões</h3></div><div class="table-wrap"><table><thead><tr><th>Revisão</th><th>Data</th><th>Descrição</th></tr></thead><tbody>${revs}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h3>Serviços que aplicam esta norma</h3></div><div class="card-body">${servs}</div></div>
      </div></div>`);
    const ed = c.querySelector('#ed'); if (ed) ed.onclick = () => formNorma(n);
    setContent(c);
}

// ============================================================================
//  SERVIÇOS
// ============================================================================
async function viewServicos(query = {}) {
    loading();
    const servs = await api.get('/servicos' + api.qs({ busca: query.busca }));
    const linhas = servs.map((s) => `<tr onclick="location.hash='#/servicos/${s.id}'" style="cursor:pointer">
        <td class="mono">${escapeHtml(s.codigo || ('#' + s.id))}</td><td class="t-strong">${escapeHtml(s.nome)}</td>
        <td>${escapeHtml(s.cliente_nome || '—')}</td><td>${escapeHtml(s.tecnico_nome || '—')}</td>
        <td>${fmtData(s.data_inicio)}</td><td>${badge(STATUS_SERVICO, s.status)}</td></tr>`).join('')
        || '<tr><td colspan="6"><div class="empty">'+icon('tool')+'<div>Nenhum serviço.</div></div></td></tr>';
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Serviços Metrológicos</h2><p>Procedimentos, padrões e normas aplicados por serviço</p></div>
        <div class="ph-actions">${podeEscrever() ? `<button class="btn btn-primary" id="novo">${icon('plus')} Novo serviço</button>` : ''}</div></div>
      <div class="toolbar"><div class="search">${icon('search')}<input id="busca" placeholder="Buscar serviço, cliente, técnico..." value="${escapeHtml(query.busca||'')}"></div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Serviço</th><th>Cliente</th><th>Técnico</th><th>Início</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table></div></div></div>`);
    const busca = c.querySelector('#busca'); let tmr;
    busca.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => location.hash = `#/servicos?busca=${encodeURIComponent(busca.value)}`, 350); };
    const nv = c.querySelector('#novo'); if (nv) nv.onclick = () => formServico();
    setContent(c);
}

async function formServico(s = null) {
    const [padroes, normas, clientes] = await Promise.all([
        api.get('/padroes?limite=500').then((r) => r.itens), api.get('/normas'), api.get('/clientes').catch(() => []),
    ]);
    const optC = `<option value="">—</option>` + clientes.map((c) => `<option value="${c.id}" ${s?.cliente_id===c.id?'selected':''}>${escapeHtml(c.nome)}</option>`).join('');
    const optP = padroes.map((p) => `<option value="${p.id}">${escapeHtml(p.codigo_interno)} — ${escapeHtml(p.modelo||'')}</option>`).join('');
    const optN = normas.map((n) => `<option value="${n.id}">${escapeHtml(n.codigo)} — ${escapeHtml(n.nome)}</option>`).join('');
    const body = el(`<form class="form-grid">
      <div class="field"><label>Código</label><input name="codigo" value="${escapeHtml(s?.codigo||'')}"></div>
      <div class="field"><label>Nome do serviço *</label><input name="nome" value="${escapeHtml(s?.nome||'')}"></div>
      <div class="field"><label>Cliente</label><select name="cliente_id">${optC}</select></div>
      <div class="field"><label>Status</label><select name="status">${Object.entries(STATUS_SERVICO).map(([v,[l]])=>`<option value="${v}" ${s?.status===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Data início</label><input type="date" name="data_inicio" value="${s?.data_inicio||''}"></div>
      <div class="field"><label>Data conclusão</label><input type="date" name="data_conclusao" value="${s?.data_conclusao||''}"></div>
      <div class="field full"><label>Procedimento técnico</label><input name="procedimento" value="${escapeHtml(s?.procedimento||'')}"></div>
      <div class="field full"><label>Padrões utilizados (Ctrl/Cmd p/ múltiplos)</label><select name="padroes" multiple size="4">${optP}</select></div>
      <div class="field full"><label>Normas aplicadas</label><select name="normas" multiple size="3">${optN}</select></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes">${escapeHtml(s?.observacoes||'')}</textarea></div>
    </form>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Salvar</button>`);
    const m = modal({ title: s ? `Editar serviço` : 'Novo serviço', body, footer: [btnC, btnS], size: 'lg' });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const fd = new FormData(body);
        const dados = Object.fromEntries(fd.entries());
        dados.padroes = [...body.querySelector('[name=padroes]').selectedOptions].map((o) => +o.value);
        dados.normas = [...body.querySelector('[name=normas]').selectedOptions].map((o) => +o.value);
        dados.tecnico_nome = auth.user.nome; dados.tecnico_id = auth.user.id;
        if (dados.cliente_id) dados.cliente_nome = clientes.find((c) => c.id == dados.cliente_id)?.nome;
        btnS.disabled = true;
        try { if (s) await api.put(`/servicos/${s.id}`, dados); else await api.post('/servicos', dados); toast('Serviço salvo.'); m.close(); rotear(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

async function viewServicoDetalhe(id) {
    loading();
    const s = await api.get(`/servicos/${id}`);
    const dlItem = (k, v) => `<div class="dl-item"><div class="k">${k}</div><div class="v">${v ?? '—'}</div></div>`;
    const pads = s.padroes.map((p) => `<tr onclick="location.hash='#/padroes/${p.id}'" style="cursor:pointer"><td class="mono">${escapeHtml(p.codigo_interno)}</td><td>${escapeHtml(p.modelo||'—')}</td><td>${escapeHtml(p.tipo_instrumento||'')}</td></tr>`).join('') || '<tr><td colspan="3" class="t-muted">Nenhum padrão.</td></tr>';
    const norms = s.normas.map((n) => `<span class="badge b-blue" style="margin:2px">${escapeHtml(n.codigo)}</span>`).join(' ') || '<span class="t-muted">Nenhuma norma.</span>';
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>${escapeHtml(s.nome)} ${badge(STATUS_SERVICO, s.status)}</h2><p>${escapeHtml(s.codigo||'')} · ${escapeHtml(s.cliente_nome||'')}</p></div>
        <div class="ph-actions"><a class="btn btn-ghost" href="#/servicos">${icon('chevron')} Voltar</a>${podeEscrever() ? `<button class="btn btn-primary" id="ed">${icon('edit')} Editar</button>` : ''}</div></div>
      <div class="card" style="margin-bottom:16px"><div class="card-body"><div class="dl">
        ${dlItem('Técnico responsável', escapeHtml(s.tecnico_nome))}${dlItem('Cliente', escapeHtml(s.cliente_nome))}
        ${dlItem('Início', fmtData(s.data_inicio))}${dlItem('Conclusão', fmtData(s.data_conclusao))}
        ${dlItem('Procedimento', escapeHtml(s.procedimento))}${dlItem('Normas aplicadas', norms)}
      </div></div></div>
      <div class="card"><div class="card-head"><h3>Padrões utilizados</h3></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Modelo</th><th>Tipo</th></tr></thead><tbody>${pads}</tbody></table></div></div></div>`);
    const ed = c.querySelector('#ed'); if (ed) ed.onclick = () => formServico(s);
    setContent(c);
}

// ============================================================================
//  MAPA DE LOCALIZAÇÃO
// ============================================================================
async function viewMapa() {
    loading();
    const pts = await api.get('/mapa');
    const cores = { disponivel: '#16a34a', em_uso: '#2563eb', em_manutencao: '#d97706', fora_operacao: '#dc2626', inativo: '#94a3b8' };
    // Distribui em grade os padrões sem coordenadas explícitas.
    const pins = pts.map((p, i) => {
        const x = p.mapa_x != null ? p.mapa_x : 8 + (i % 6) * 15;
        const y = p.mapa_y != null ? p.mapa_y : 14 + Math.floor(i / 6) * 22;
        return `<div class="map-pin" style="left:${x}%;top:${y}%" onclick="location.hash='#/padroes/${p.id}'">
          <div class="lbl">${escapeHtml(p.codigo_interno)} · ${escapeHtml(p.localizacao||'')}</div>
          <div class="dot" style="background:${cores[p.status]||'#64748b'}"><span>${escapeHtml(p.codigo_interno.replace(/[^0-9]/g,'').slice(-2)||'•')}</span></div>
        </div>`;
    }).join('');
    const legenda = Object.entries(STATUS_PADRAO).map(([k, [l]]) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:12.5px"><span style="width:11px;height:11px;border-radius:50%;background:${cores[k]}"></span>${l}</span>`).join('');
    setContent(`<div>
      <div class="page-head"><div class="ph-text"><h2>Mapa de Localização</h2><p>Distribuição física dos padrões pelo laboratório · clique em um pino</p></div></div>
      <div class="card"><div class="card-body"><div style="margin-bottom:14px">${legenda}</div><div class="mapa">${pins}</div></div></div></div>`);
}

// ============================================================================
//  RELATÓRIOS
// ============================================================================
async function viewRelatorios() {
    loading();
    const rels = await api.get('/relatorios');
    const cards = rels.map((r) => `
      <div class="card"><div class="card-body" style="display:flex;align-items:center;gap:14px">
        <div class="ico blue" style="width:46px;height:46px;border-radius:11px;display:grid;place-items:center;flex-shrink:0">${icon('report')}</div>
        <div style="flex:1"><div class="t-strong" style="font-size:14.5px">${escapeHtml(r.titulo)}</div>
          <div class="t-muted">Exporte em PDF ou Excel</div></div>
        <button class="btn btn-ghost btn-sm" data-pdf="${r.chave}" data-titulo="${escapeHtml(r.titulo)}">${icon('file')} PDF</button>
        <button class="btn btn-primary btn-sm" data-csv="${r.chave}">${icon('download')} Excel</button>
      </div></div>`).join('');
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Relatórios</h2><p>Geração de relatórios gerenciais e de conformidade</p></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px">${cards}</div></div>`);
    c.querySelectorAll('[data-csv]').forEach((b) => b.onclick = () => api.download(`/relatorios/${b.dataset.csv}?formato=csv`, `${b.dataset.csv}.csv`).then(() => toast('Exportado para Excel/CSV.')));
    c.querySelectorAll('[data-pdf]').forEach((b) => b.onclick = () => gerarPDF(b.dataset.pdf, b.dataset.titulo));
    setContent(c);
}

async function gerarPDF(tipo, titulo) {
    const r = await api.get(`/relatorios/${tipo}`);
    if (!r.linhas.length) return toast('Sem dados para este relatório.', 'warn');
    const cols = Object.keys(r.linhas[0]);
    const ths = cols.map((c) => `<th style="text-align:left;border-bottom:2px solid #333;padding:6px">${c.replace(/_/g, ' ')}</th>`).join('');
    const trs = r.linhas.map((l) => `<tr>${cols.map((c) => `<td style="border-bottom:1px solid #ccc;padding:6px">${escapeHtml(l[c] ?? '')}</td>`).join('')}</tr>`).join('');
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${titulo}</title></head><body style="font-family:sans-serif;padding:30px;font-size:12px">
      <div style="display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:10px;margin-bottom:16px">
        <h2 style="color:#2563eb;margin:0">MetroControl — ${titulo}</h2>
        <div style="text-align:right;color:#666">Gerado em ${new Date().toLocaleString('pt-BR')}<br>Total: ${r.total} registros</div></div>
      <table style="width:100%;border-collapse:collapse"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
      <p style="margin-top:20px;color:#888;font-size:10px">Documento gerado pelo MetroControl · Conformidade ISO/IEC 17025 · Use "Salvar como PDF" na impressão.</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
    toast('Relatório aberto para impressão/PDF.', 'info');
}

// ============================================================================
//  USUÁRIOS
// ============================================================================
async function viewUsuarios() {
    loading();
    const us = await api.get('/usuarios');
    const linhas = us.map((u) => `<tr>
        <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="width:32px;height:32px;font-size:12px">${(u.nome||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div>
          <div><div class="t-strong">${escapeHtml(u.nome)}</div><div class="t-muted">${escapeHtml(u.email)}</div></div></div></td>
        <td>${badge({administrador:['Administrador','b-purple'],gestor:['Gestor','b-blue'],tecnico:['Técnico','b-sky'],auditor:['Auditor','b-amber'],visualizador:['Visualizador','b-gray']}, u.perfil)}</td>
        <td>${escapeHtml(u.cargo||'—')}</td>
        <td>${u.ativo ? '<span class="badge b-green">Ativo</span>' : '<span class="badge b-gray">Inativo</span>'}</td>
        <td>${u.twofa_ativo ? '<span class="badge b-green">2FA on</span>' : '<span class="t-muted">—</span>'}</td>
        <td class="t-muted">${fmtDataHora(u.ultimo_login)}</td>
        <td>${ehNivel('administrador') ? `<button class="btn btn-sm btn-ghost" data-ed="${u.id}">${icon('edit')}</button> <button class="btn btn-sm btn-ghost" data-pw="${u.id}">${icon('key')}</button>` : ''}</td></tr>`).join('');
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Usuários & Perfis</h2><p>Controle de acesso baseado em papéis (RBAC)</p></div>
        <div class="ph-actions">${ehNivel('administrador') ? `<button class="btn btn-primary" id="novo">${icon('plus')} Novo usuário</button>` : ''}</div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Cargo</th><th>Situação</th><th>2FA</th><th>Último acesso</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Perfis e permissões</h3></div><div class="card-body">
        <div class="dl">
          <div class="dl-item"><div class="k">Administrador</div><div class="v">Acesso total: usuários, exclusões, restauração da lixeira, auditoria.</div></div>
          <div class="dl-item"><div class="k">Gestor</div><div class="v">Gerencia padrões/normas/serviços, vê usuários, auditoria e lixeira.</div></div>
          <div class="dl-item"><div class="k">Técnico</div><div class="v">Cadastra e movimenta padrões, registra calibrações e checagens.</div></div>
          <div class="dl-item"><div class="k">Auditor</div><div class="v">Somente leitura + acesso à trilha de auditoria.</div></div>
          <div class="dl-item"><div class="k">Visualizador</div><div class="v">Somente leitura dos módulos operacionais.</div></div>
        </div></div></div></div>`);
    const nv = c.querySelector('#novo'); if (nv) nv.onclick = () => formUsuario();
    c.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => formUsuario(us.find((u) => u.id == b.dataset.ed)));
    c.querySelectorAll('[data-pw]').forEach((b) => b.onclick = () => resetSenha(b.dataset.pw));
    setContent(c);
}

function formUsuario(u = null) {
    const perfis = ['administrador', 'gestor', 'tecnico', 'auditor', 'visualizador'];
    const body = el(`<form class="form-grid">
      <div class="field"><label>Nome *</label><input name="nome" value="${escapeHtml(u?.nome||'')}"></div>
      <div class="field"><label>E-mail *</label><input type="email" name="email" value="${escapeHtml(u?.email||'')}" ${u?'disabled':''}></div>
      ${!u ? `<div class="field"><label>Senha * (mín. 8)</label><input type="password" name="senha"></div>` : ''}
      <div class="field"><label>Perfil *</label><select name="perfil">${perfis.map((p) => `<option value="${p}" ${u?.perfil===p?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>Cargo</label><input name="cargo" value="${escapeHtml(u?.cargo||'')}"></div>
      <div class="field"><label>Telefone</label><input name="telefone" value="${escapeHtml(u?.telefone||'')}"></div>
      ${u ? `<div class="field"><label>Situação</label><select name="ativo"><option value="1" ${u.ativo?'selected':''}>Ativo</option><option value="0" ${!u.ativo?'selected':''}>Inativo</option></select></div>` : ''}
    </form>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">${icon('check')} Salvar</button>`);
    const m = modal({ title: u ? `Editar usuário` : 'Novo usuário', body, footer: [btnC, btnS] });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        const dados = Object.fromEntries(new FormData(body).entries());
        if (dados.ativo !== undefined) dados.ativo = +dados.ativo;
        btnS.disabled = true;
        try { if (u) await api.put(`/usuarios/${u.id}`, dados); else await api.post('/usuarios', dados); toast('Usuário salvo.'); m.close(); rotear(); }
        catch (e) { toast(e.message, 'err'); btnS.disabled = false; }
    };
}

function resetSenha(id) {
    const body = el(`<div class="field"><label>Nova senha (mín. 8 caracteres)</label><input type="password" id="ns"></div>`);
    const btnC = el(`<button class="btn btn-ghost">Cancelar</button>`);
    const btnS = el(`<button class="btn btn-primary">Redefinir</button>`);
    const m = modal({ title: 'Redefinir senha', body, footer: [btnC, btnS], size: 'sm' });
    btnC.onclick = m.close;
    btnS.onclick = async () => {
        try { await api.post(`/usuarios/${id}/senha`, { senha_nova: body.querySelector('#ns').value }); toast('Senha redefinida.'); m.close(); }
        catch (e) { toast(e.message, 'err'); }
    };
}

// ============================================================================
//  AUDITORIA
// ============================================================================
async function viewAuditoria(query = {}) {
    loading();
    const r = await api.get('/auditoria' + api.qs({ acao: query.acao, entidade: query.entidade, limite: 300 }));
    const corAcao = { LOGIN: 'b-green', LOGIN_FALHA: 'b-red', CRIAR: 'b-blue', EDITAR: 'b-amber', EXCLUIR: 'b-red', RESTAURAR: 'b-green', EXPORTAR: 'b-purple', CALIBRACAO: 'b-sky', RETIRADA: 'b-blue', DEVOLUCAO: 'b-green' };
    const linhas = r.itens.map((a) => `<tr>
        <td class="t-muted" style="white-space:nowrap">${fmtDataHora(a.criado_em)}</td>
        <td>${escapeHtml(a.usuario_nome || 'Sistema')}</td>
        <td><span class="badge ${corAcao[a.acao] || 'b-gray'}">${escapeHtml(a.acao)}</span></td>
        <td>${escapeHtml(a.entidade || '—')}</td>
        <td>${escapeHtml(a.descricao || '')}</td>
        <td class="t-muted">${escapeHtml(a.ip || '')}</td></tr>`).join('')
        || '<tr><td colspan="6"><div class="empty">Sem registros.</div></td></tr>';
    setContent(`<div>
      <div class="page-head"><div class="ph-text"><h2>Trilha de Auditoria</h2><p>${r.total} eventos registrados · histórico permanente e imutável</p></div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Descrição</th><th>IP</th></tr></thead><tbody>${linhas}</tbody></table></div></div></div>`);
}

// ============================================================================
//  LIXEIRA
// ============================================================================
async function viewLixeira() {
    loading();
    const itens = await api.get('/lixeira');
    const linhas = itens.map((i) => `<tr>
        <td><span class="badge b-gray">${escapeHtml(i.entidade)}</span></td>
        <td class="t-strong">${escapeHtml(i.rotulo)}</td>
        <td class="t-muted">${escapeHtml(i.motivo_exclusao || '—')}</td>
        <td class="t-muted">${fmtDataHora(i.excluido_em)}</td>
        <td>${ehNivel('administrador') ? `<button class="btn btn-sm btn-primary" data-r="${i.entidade}/${i.id}">${icon('restore')} Restaurar</button>` : '<span class="t-muted">Somente admin</span>'}</td></tr>`).join('')
        || '<tr><td colspan="5"><div class="empty">'+icon('trash')+'<div>Lixeira vazia.</div></div></td></tr>';
    const c = el(`<div>
      <div class="page-head"><div class="ph-text"><h2>Lixeira</h2><p>Registros excluídos logicamente — recuperação preserva o histórico</p></div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Registro</th><th>Motivo</th><th>Excluído em</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div></div></div>`);
    c.querySelectorAll('[data-r]').forEach((b) => b.onclick = async () => {
        const [ent, id] = b.dataset.r.split('/');
        const conf = await confirmar({ title: 'Restaurar registro', message: 'Deseja restaurar este registro da lixeira?' });
        if (conf) { try { await api.post(`/lixeira/${ent}/${id}/restaurar`); toast('Registro restaurado.'); viewLixeira(); } catch (e) { toast(e.message, 'err'); } }
    });
    setContent(c);
}

// ============================================================================
//  PERFIL / 2FA / SENHA
// ============================================================================
async function telaPerfil() {
    const me = await api.get('/auth/me');
    const body = el(`<div>
      <div class="tabs"><button class="active" data-tab="senha">Alterar senha</button><button data-tab="2fa">Verificação em 2 etapas</button></div>
      <div id="tab-senha">
        <form class="form-grid">
          <div class="field full"><label>Senha atual</label><input type="password" id="sa"></div>
          <div class="field full"><label>Nova senha (mín. 8)</label><input type="password" id="sn"></div>
        </form>
        <button class="btn btn-primary" id="bs" style="margin-top:14px">${icon('check')} Alterar senha</button>
      </div>
      <div id="tab-2fa" class="hidden">
        <p style="margin-bottom:12px">Status: ${me.twofa_ativo ? '<span class="badge b-green">2FA ativado</span>' : '<span class="badge b-gray">Desativado</span>'}</p>
        <div id="2fa-area"></div>
      </div>
    </div>`);
    const m = modal({ title: 'Meu perfil — Segurança', body, footer: null });
    body.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
        body.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
        body.querySelector('#tab-senha').classList.toggle('hidden', b.dataset.tab !== 'senha');
        body.querySelector('#tab-2fa').classList.toggle('hidden', b.dataset.tab !== '2fa');
    });
    body.querySelector('#bs').onclick = async () => {
        try { await api.post('/auth/senha', { senha_atual: body.querySelector('#sa').value, senha_nova: body.querySelector('#sn').value }); toast('Senha alterada.'); m.close(); }
        catch (e) { toast(e.message, 'err'); }
    };
    const area = body.querySelector('#2fa-area');
    if (me.twofa_ativo) {
        area.innerHTML = `<button class="btn btn-danger" id="off">Desativar 2FA</button>`;
        area.querySelector('#off').onclick = async () => {
            const senha = prompt('Confirme sua senha para desativar o 2FA:');
            if (!senha) return;
            try { await api.post('/auth/2fa/desativar', { senha }); toast('2FA desativado.'); m.close(); } catch (e) { toast(e.message, 'err'); }
        };
    } else {
        area.innerHTML = `<button class="btn btn-primary" id="setup">${icon('shield')} Ativar 2FA</button>`;
        area.querySelector('#setup').onclick = async () => {
            const r = await api.post('/auth/2fa/setup');
            area.innerHTML = `<div class="qr-box">${qrImg(r.otpauth, 190)}
              <p style="margin:12px 0;font-size:12.5px">Escaneie com Google Authenticator / Authy.<br>Segredo: <span class="mono">${r.secret}</span></p>
              <div class="field"><label>Digite o código gerado</label><input id="cod" inputmode="numeric" maxlength="6" placeholder="000000"></div>
              <button class="btn btn-primary" id="ativar" style="margin-top:12px">Confirmar e ativar</button></div>`;
            area.querySelector('#ativar').onclick = async () => {
                try { await api.post('/auth/2fa/ativar', { codigo: area.querySelector('#cod').value }); toast('2FA ativado com sucesso!'); m.close(); }
                catch (e) { toast(e.message, 'err'); }
            };
        };
    }
}

// ============================================================================
//  SCANNER QR (câmera) — carrega biblioteca sob demanda
// ============================================================================
function abrirScanner() {
    const body = el(`<div><div id="reader" style="width:100%"></div>
      <p class="t-muted" style="margin-top:10px;font-size:12.5px">Aponte a câmera para o QR Code de um padrão. Requer permissão de câmera e conexão à internet para carregar o leitor.</p>
      <div id="scan-fallback" class="hidden"><div class="field"><label>Ou informe o identificador (UUID) manualmente</label><input id="uuid-man" placeholder="cole o conteúdo do QR"></div><button class="btn btn-primary" id="ir">Abrir padrão</button></div></div>`);
    const m = modal({ title: 'Escanear QR Code', body, footer: null });
    body.querySelector('#ir')?.addEventListener('click', () => {
        const v = body.querySelector('#uuid-man').value.trim();
        const uuid = v.includes('/q/') ? v.split('/q/')[1] : v;
        m.close(); location.hash = `#/q/${uuid}`;
    });
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.onload = () => {
        try {
            const h = new window.Html5Qrcode('reader');
            h.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (txt) => {
                h.stop();
                const uuid = txt.includes('/q/') ? txt.split('/q/')[1] : txt;
                m.close(); location.hash = `#/q/${uuid}`;
            }, () => {}).catch(() => { body.querySelector('#scan-fallback').classList.remove('hidden'); });
        } catch { body.querySelector('#scan-fallback').classList.remove('hidden'); }
    };
    script.onerror = () => { body.querySelector('#reader').innerHTML = '<div class="empty">Leitor indisponível offline.</div>'; body.querySelector('#scan-fallback').classList.remove('hidden'); };
    document.body.appendChild(script);
}

// ============================================================================
//  INICIALIZAÇÃO
// ============================================================================
function iniciar() {
    renderShell();
    rotear();
    setInterval(atualizarAlertas, 60000);
}
window.addEventListener('hashchange', () => { if (auth.logged) rotear(); });

(async function boot() {
    if (auth.logged) {
        try { await api.get('/auth/me'); iniciar(); }
        catch { auth.clear(); renderLogin(); }
    } else renderLogin();
})();
