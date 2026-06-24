// ============================================================================
//  MetroControl — Gráficos em SVG puro (sem dependências/CDN)
// ============================================================================
import { escapeHtml } from './ui.js';

const PALETA = ['#2563eb', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#16a34a', '#db2777'];

/** Gráfico de rosca (donut). dados: [{rotulo, valor, cor?}] */
export function donut(dados, { tamanho = 180, espessura = 30 } = {}) {
    const total = dados.reduce((s, d) => s + d.valor, 0) || 1;
    const r = (tamanho - espessura) / 2;
    const cx = tamanho / 2, cy = tamanho / 2;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const segs = dados.map((d, i) => {
        const frac = d.valor / total;
        const len = frac * circ;
        const cor = d.cor || PALETA[i % PALETA.length];
        const dash = `${len} ${circ - len}`;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cor}"
            stroke-width="${espessura}" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}"
            transform="rotate(-90 ${cx} ${cy})"><title>${escapeHtml(d.rotulo)}: ${d.valor}</title></circle>`;
        offset += len;
        return el;
    }).join('');
    const legenda = dados.map((d, i) => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin-bottom:6px">
        <span style="width:11px;height:11px;border-radius:3px;background:${d.cor || PALETA[i % PALETA.length]};flex-shrink:0"></span>
        <span style="flex:1;color:var(--text-muted)">${escapeHtml(d.rotulo)}</span>
        <b>${d.valor}</b></div>`).join('');
    return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center">
        <div style="position:relative;flex-shrink:0">
            <svg width="${tamanho}" height="${tamanho}">${segs}</svg>
            <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
                <div><div style="font-size:26px;font-weight:800;line-height:1">${total}</div>
                <div style="font-size:11px;color:var(--text-muted)">Total</div></div></div>
        </div>
        <div style="flex:1;min-width:140px">${legenda}</div></div>`;
}

/** Gráfico de barras verticais. dados: [{rotulo, valor}] */
export function barras(dados, { altura = 220 } = {}) {
    if (!dados.length) return '<div class="empty">Sem dados</div>';
    const max = Math.max(...dados.map((d) => d.valor), 1);
    const barW = Math.min(56, 100 / dados.length);
    const cols = dados.map((d, i) => {
        const h = (d.valor / max) * (altura - 40);
        const cor = PALETA[i % PALETA.length];
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:0">
            <div style="font-size:12px;font-weight:700">${d.valor}</div>
            <div style="width:${barW}%;max-width:48px;min-height:3px;height:${h}px;background:linear-gradient(180deg,${cor},${cor}bb);border-radius:6px 6px 0 0;transition:.3s"></div>
            <div style="font-size:11px;color:var(--text-muted);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%" title="${escapeHtml(d.rotulo)}">${escapeHtml(d.rotulo)}</div>
        </div>`;
    }).join('');
    return `<div style="display:flex;align-items:flex-end;gap:10px;height:${altura}px;padding-top:10px">${cols}</div>`;
}

/** Gráfico de linha (séries temporais). dados: [{rotulo, valor}] */
export function linha(dados, { altura = 220 } = {}) {
    if (dados.length < 2) return barras(dados, { altura });
    const w = 600, h = altura, pad = 30;
    const max = Math.max(...dados.map((d) => d.valor), 1);
    const stepX = (w - pad * 2) / (dados.length - 1);
    const pts = dados.map((d, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (d.valor / max) * (h - pad * 2);
        return [x, y];
    });
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const areaPath = `${linePath} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;
    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#2563eb" stroke="var(--bg-card)" stroke-width="2"><title>${escapeHtml(dados[i].rotulo)}: ${dados[i].valor}</title></circle>`).join('');
    const labels = dados.map((d, i) => `<text x="${pts[i][0]}" y="${h - 8}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${escapeHtml(d.rotulo)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${altura}" preserveAspectRatio="none" style="overflow:visible">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${areaPath}" fill="url(#lg)"/>
        <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}${labels}</svg>`;
}
