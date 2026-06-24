// ============================================================================
//  MetroControl — Segurança (hash de senha, JWT, TOTP/2FA)
//  Implementado 100% sobre node:crypto. Sem dependências externas.
// ============================================================================
import crypto from 'node:crypto';

// Segredo de assinatura do JWT. EM PRODUÇÃO defina JWT_SECRET no ambiente.
const JWT_SECRET = process.env.JWT_SECRET || 'metrocontrol-dev-secret-troque-em-producao';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 horas

// ---------------------------------------------------------------------------
//  SENHAS — scrypt com salt aleatório (formato salt:hash em hex)
// ---------------------------------------------------------------------------
export function hashSenha(senha) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(senha, salt, 64);
    return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verificarSenha(senha, armazenado) {
    if (!armazenado || !armazenado.includes(':')) return false;
    const [saltHex, hashHex] = armazenado.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const derived = crypto.scryptSync(senha, salt, 64);
    const esperado = Buffer.from(hashHex, 'hex');
    // Comparação em tempo constante (evita timing attacks).
    return derived.length === esperado.length &&
           crypto.timingSafeEqual(derived, esperado);
}

// ---------------------------------------------------------------------------
//  JWT — HS256 (header.payload.signature, base64url)
// ---------------------------------------------------------------------------
function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlJSON(obj) { return b64url(JSON.stringify(obj)); }
function fromB64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}

export function gerarToken(payload, ttl = TOKEN_TTL_SECONDS) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const body = { ...payload, iat: now, exp: now + ttl };
    const data = `${b64urlJSON(header)}.${b64urlJSON(body)}`;
    const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
    return `${data}.${sig}`;
}

export function verificarToken(token) {
    if (!token || token.split('.').length !== 3) return null;
    const [h, p, s] = token.split('.');
    const data = `${h}.${p}`;
    const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
    // Comparação segura da assinatura.
    if (s.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
    try {
        const payload = JSON.parse(fromB64url(p).toString('utf8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch { return null; }
}

// ---------------------------------------------------------------------------
//  TOTP / 2FA — RFC 6238 (compatível com Google Authenticator / Authy)
// ---------------------------------------------------------------------------
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function gerarSegredoTOTP(tamanho = 20) {
    const bytes = crypto.randomBytes(tamanho);
    let bits = '', out = '';
    for (const b of bytes) bits += b.toString(2).padStart(8, '0');
    for (let i = 0; i + 5 <= bits.length; i += 5) {
        out += BASE32[parseInt(bits.substr(i, 5), 2)];
    }
    return out;
}

function base32Decode(b32) {
    let bits = '';
    for (const c of b32.replace(/=+$/, '').toUpperCase()) {
        const idx = BASE32.indexOf(c);
        if (idx === -1) continue;
        bits += idx.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return Buffer.from(bytes);
}

function gerarCodigoTOTP(secret, contador) {
    const key = base32Decode(secret);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(contador));
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) |
                 (hmac[offset + 2] << 8) | hmac[offset + 3];
    return (code % 1_000_000).toString().padStart(6, '0');
}

/** Verifica o código TOTP com janela de tolerância (±1 passo = ±30s). */
export function verificarTOTP(secret, codigo, janela = 1) {
    if (!secret || !codigo) return false;
    const passo = Math.floor(Date.now() / 1000 / 30);
    for (let i = -janela; i <= janela; i++) {
        if (gerarCodigoTOTP(secret, passo + i) === String(codigo).trim()) return true;
    }
    return false;
}

/** URL otpauth:// para gerar o QR Code de configuração do 2FA. */
export function otpauthURL(secret, email, emissor = 'MetroControl') {
    return `otpauth://totp/${encodeURIComponent(emissor)}:${encodeURIComponent(email)}` +
           `?secret=${secret}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------
export function uuid() { return crypto.randomUUID(); }
