// ============================================================================
//  MetroControl — Cliente da API REST
// ============================================================================
const TOKEN_KEY = 'metrocontrol_token';
const USER_KEY = 'metrocontrol_user';

export const auth = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
    set(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
    get logged() { return !!this.token; },
};

/** Requisição genérica à API. Lança Error com .status e .data em caso de erro. */
async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    const res = await fetch(`/api${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && auth.logged) {
        auth.clear();
        location.reload();
        throw new Error('Sessão expirada.');
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
        const err = new Error((data && data.erro) || `Erro ${res.status}`);
        err.status = res.status; err.data = data;
        throw err;
    }
    return data;
}

export const api = {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    del: (p, b) => request('DELETE', p, b),
    /** Constrói query string a partir de um objeto, ignorando vazios. */
    qs: (obj) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(obj || {})) if (v !== '' && v != null) p.append(k, v);
        const s = p.toString();
        return s ? `?${s}` : '';
    },
    /** Baixa um arquivo autenticado (relatórios CSV). */
    async download(path, filename) {
        const res = await fetch(`/api${path}`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename || 'arquivo';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    },
};
