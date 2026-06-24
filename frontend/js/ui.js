// ============================================================================
//  MetroControl — Utilitários de UI (ícones, toasts, modais, formatação)
// ============================================================================

// ---- Ícones SVG (Feather-style, traço) ------------------------------------
const PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    gauge: '<path d="M12 21a9 9 0 1 0-9-9"/><path d="M3 12h2M12 3v2M21 12h-2"/><path d="m12 12 4-3"/><circle cx="12" cy="12" r="1.5"/>',
    move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.5-2.5z"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="17.5" y1="14" x2="17.5" y2="17.5"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
};
export function icon(name, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
}

// ---- Criação de elementos --------------------------------------------------
export function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
}
export function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Formatação ------------------------------------------------------------
export function fmtData(d) {
    if (!d) return '—';
    const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('pt-BR');
}
export function fmtDataHora(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
export function fmtMoeda(v) {
    if (v == null) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---- Mapas de rótulos/cores ------------------------------------------------
export const STATUS_PADRAO = {
    disponivel: ['Disponível', 'b-green'],
    em_uso: ['Em uso', 'b-blue'],
    em_manutencao: ['Em manutenção', 'b-amber'],
    fora_operacao: ['Fora de operação', 'b-red'],
    inativo: ['Inativo', 'b-gray'],
};
export const STATUS_SERVICO = {
    planejado: ['Planejado', 'b-gray'], em_andamento: ['Em andamento', 'b-blue'],
    concluido: ['Concluído', 'b-green'], cancelado: ['Cancelado', 'b-red'],
};
export const SITUACAO = {
    ok: ['Em dia', 'b-green'], atencao: ['Atenção', 'b-sky'], alerta: ['Alerta', 'b-amber'],
    critico: ['Crítico', 'b-amber'], vencido: ['Vencido', 'b-red'],
};
export function badge(map, key) {
    const [txt, cls] = map[key] || [key || '—', 'b-gray'];
    return `<span class="badge ${cls}">${escapeHtml(txt)}</span>`;
}

// ---- Toasts ----------------------------------------------------------------
export function toast(msg, tipo = 'ok', titulo) {
    const titMap = { ok: 'Sucesso', err: 'Erro', warn: 'Atenção', info: 'Informação' };
    const t = el(`<div class="toast ${tipo}"><div>${titulo ? `<b>${escapeHtml(titulo)}</b>` : `<b>${titMap[tipo] || ''}</b>`}<span>${escapeHtml(msg)}</span></div></div>`);
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 4000);
}

// ---- Modal -----------------------------------------------------------------
export function modal({ title, body, footer, size = '' }) {
    const root = document.getElementById('modal-root');
    const overlay = el(`<div class="modal-overlay"><div class="modal ${size}">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="x">&times;</button></div>
        <div class="modal-body"></div>
        ${footer !== null ? '<div class="modal-foot"></div>' : ''}
    </div></div>`);
    const bodyEl = overlay.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const footEl = overlay.querySelector('.modal-foot');
    if (footEl && footer) { if (typeof footer === 'string') footEl.innerHTML = footer; else footer.forEach((f) => footEl.appendChild(f)); }
    const close = () => overlay.remove();
    overlay.querySelector('.x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    root.appendChild(overlay);
    return { overlay, close, bodyEl, footEl };
}

/** Confirmação com possível dupla confirmação e motivo (para exclusões). */
export function confirmar({ title, message, danger = false, pedirMotivo = false }) {
    return new Promise((resolve) => {
        const body = el(`<div>
            <p style="margin-bottom:14px">${escapeHtml(message)}</p>
            ${pedirMotivo ? `
              <div class="field" style="margin-bottom:12px">
                <label>Motivo da exclusão (obrigatório p/ auditoria)</label>
                <input type="text" id="cf-motivo" placeholder="Ex.: equipamento descartado, duplicidade...">
              </div>
              <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer">
                <input type="checkbox" id="cf-confirma" style="width:auto"> Confirmo que desejo realizar esta ação (confirmação dupla)
              </label>` : ''}
        </div>`);
        const btnCancel = el(`<button class="btn btn-ghost">Cancelar</button>`);
        const btnOk = el(`<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${danger ? 'Excluir' : 'Confirmar'}</button>`);
        const m = modal({ title, body, footer: [btnCancel, btnOk], size: 'sm' });
        btnCancel.onclick = () => { m.close(); resolve(null); };
        btnOk.onclick = () => {
            if (pedirMotivo) {
                const motivo = body.querySelector('#cf-motivo').value.trim();
                const confirma = body.querySelector('#cf-confirma').checked;
                if (!confirma) return toast('Marque a confirmação dupla para prosseguir.', 'warn');
                if (!motivo) return toast('Informe o motivo da exclusão.', 'warn');
                m.close(); resolve({ confirmar: true, motivo });
            } else { m.close(); resolve({ confirmar: true }); }
        };
    });
}
