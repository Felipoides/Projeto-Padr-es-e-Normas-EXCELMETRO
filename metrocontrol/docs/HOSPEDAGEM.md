# ☁️ Hospedagem em Nuvem — MetroControl

Guia prático para colocar o MetroControl **no ar** e hospedar o **banco de dados na nuvem**.
Há três caminhos, do mais simples ao mais robusto. Escolha conforme sua necessidade.

| Caminho | Banco | Esforço | Indicado para |
|--------:|-------|:------:|---------------|
| **A** | SQLite em disco persistente | ⭐ baixo | Demonstração, equipe pequena, 1 instância |
| **B** | PostgreSQL gerenciado (Supabase/Neon) | ⭐⭐ médio | **Produção recomendada** |
| **C** | VPS próprio (Ubuntu) | ⭐⭐⭐ alto | Controle total / dados on-premise |

---

## ✅ Pré-requisitos comuns

Antes de publicar, **defina variáveis de ambiente** (nunca deixe os padrões):

| Variável | Para quê | Exemplo |
|----------|----------|---------|
| `PORT` | Porta do servidor | `3000` (a nuvem geralmente injeta) |
| `JWT_SECRET` | Segredo de assinatura dos tokens | string longa e aleatória |
| `DB_PATH` | Caminho do arquivo SQLite (caminho A) | `/data/metrocontrol.db` |
| `DATABASE_URL` | String do PostgreSQL (caminho B) | `postgres://user:pass@host/db` |
| `CORS_ORIGIN` | Domínio do frontend, se separado | `https://app.suaempresa.com` |

Gere um `JWT_SECRET` forte:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 🟢 Caminho A — Deploy rápido com SQLite + disco persistente

Funciona muito bem para **um único servidor**. O ponto de atenção é que o arquivo
SQLite precisa ficar em um **volume persistente** (senão é apagado a cada deploy).

### A.1 — Render.com (grátis para começar)

1. Suba o projeto para um repositório no GitHub.
2. Em <https://render.com> → **New** → **Web Service** → conecte o repositório.
3. Configure:
   - **Build Command:** *(deixe vazio — não há dependências!)*
   - **Start Command:** `node backend/server.js`
   - **Instance Type:** Free (ou superior).
4. Em **Disks**, adicione um disco persistente:
   - **Mount Path:** `/data`
   - **Size:** 1 GB (suficiente para milhares de registros).
5. Em **Environment**, defina:
   ```
   DB_PATH   = /data/metrocontrol.db
   JWT_SECRET = (cole o segredo gerado)
   ```
6. **Create Web Service.** Em ~1 min sua URL `https://metrocontrol.onrender.com` está no ar.

### A.2 — Railway.app

1. <https://railway.app> → **New Project** → **Deploy from GitHub**.
2. **Variables:** `JWT_SECRET`, `DB_PATH=/data/metrocontrol.db`.
3. **Settings → Volumes:** monte um volume em `/data`.
4. Start command: `node backend/server.js`. Pronto.

### A.3 — Fly.io (com volume)
```bash
fly launch --no-deploy           # cria fly.toml
fly volumes create data --size 1 # volume persistente
# no fly.toml: [mounts] source="data" destination="/data"
fly secrets set JWT_SECRET=xxxx DB_PATH=/data/metrocontrol.db
fly deploy
```

> **Backup (caminho A):** copie periodicamente o arquivo do volume:
> `cp /data/metrocontrol.db /data/backups/mc-$(date +%F).db`
> Em Render/Railway, agende um cron job simples ou baixe pelo shell do serviço.

---

## 🔵 Caminho B — PostgreSQL gerenciado na nuvem (RECOMENDADO p/ produção)

Aqui o **banco de dados fica hospedado num serviço dedicado** (com backups
automáticos, alta disponibilidade e acesso de várias instâncias). Recomendados:

| Provedor | Plano grátis | Observação |
|----------|:---:|-----------|
| **[Supabase](https://supabase.com)** | ✅ | PostgreSQL + painel + backups |
| **[Neon](https://neon.tech)** | ✅ | PostgreSQL serverless, escala a zero |
| **[Railway PostgreSQL](https://railway.app)** | ✅ | Banco + app no mesmo projeto |
| **Amazon RDS / Google Cloud SQL** | 💲 | Corporativo, alta escala |

### B.1 — Criar o banco (exemplo com Supabase)

1. Crie a conta em <https://supabase.com> → **New Project**.
2. Defina nome, senha do banco e região (escolha a mais próxima — ex.: São Paulo).
3. Em **Project Settings → Database → Connection string**, copie a URI:
   ```
   postgresql://postgres:[SENHA]@db.xxxx.supabase.co:5432/postgres
   ```
4. Essa string é o seu `DATABASE_URL`.

> No **Neon** o processo é idêntico: crie o projeto e copie a *connection string*.

### B.2 — Adaptar o código para PostgreSQL

O backend isola **todo** o acesso ao banco em um único arquivo
([`backend/src/db/database.js`](../backend/src/db/database.js)) com as funções
`all / get / run / transaction`. Basta criar uma versão PostgreSQL desse arquivo.

1. Instale o driver oficial:
   ```bash
   npm install pg
   ```
2. Substitua o conteúdo de `database.js` por este adaptador (mesma interface):

```js
// backend/src/db/database.js  (versão PostgreSQL)
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },   // exigido por Supabase/Neon
});

// Converte "?" (SQLite) para "$1, $2..." (PostgreSQL)
function conv(sql) { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); }

export async function all(sql, params = []) { return (await pool.query(conv(sql), params)).rows; }
export async function get(sql, params = []) { return (await pool.query(conv(sql), params)).rows[0]; }
export async function run(sql, params = []) {
    const r = await pool.query(conv(sql) + ' RETURNING *', params).catch(async () => pool.query(conv(sql), params));
    return { changes: r.rowCount, lastInsertRowid: r.rows?.[0]?.id };
}
export async function transaction(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn(); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
}
export function initSchema() { /* rode schema.pg.sql uma vez — ver B.3 */ }
```

3. **Importante:** com PostgreSQL as funções viram `async`. Como as rotas já usam
   `async/await`, basta acrescentar `await` nas chamadas a `all/get/run` dentro
   das rotas (ou usar a versão de rotas já adaptada). Para projetos pequenos, o
   **Caminho A (SQLite)** evita essa mudança e já é suficiente.

### B.3 — Ajustes de schema (SQLite → PostgreSQL)

O [`schema.sql`](../backend/src/db/schema.sql) é quase 100% compatível. Troque apenas:

| SQLite | PostgreSQL |
|--------|-----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` (ou `BIGSERIAL`) |
| `datetime('now')` | `NOW()` |
| `TEXT` para datas | `TIMESTAMP` / `DATE` |
| `julianday(...)` | `EXTRACT(DAY FROM (a - b))` |
| `INTEGER` para booleanos | `BOOLEAN` |
| `PRAGMA ...` | *(remover — não existe)* |

Salve como `schema.pg.sql` e execute uma vez no painel SQL do Supabase/Neon
(copie e cole), ou via `psql "$DATABASE_URL" -f schema.pg.sql`.

### B.4 — Conectar o app ao banco

No serviço onde o app roda (Render/Railway/Vercel), defina:
```
DATABASE_URL = postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres
JWT_SECRET   = (segredo gerado)
```
Deploy. O app agora lê e grava no PostgreSQL gerenciado, **com backups automáticos
do provedor**.

---

## 🟣 Caminho C — VPS próprio (Ubuntu 22.04+)

Para quem precisa de dados **on-premise** ou controle total.

```bash
# 1. Instale o Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Envie o projeto (git clone ou scp) e entre na pasta
cd /opt/metrocontrol

# 3. Rode como serviço com PM2 (reinício automático)
sudo npm install -g pm2
JWT_SECRET=xxxx DB_PATH=/opt/metrocontrol/data/metrocontrol.db \
  pm2 start backend/server.js --name metrocontrol
pm2 save && pm2 startup

# 4. (Opcional) Nginx como proxy reverso + HTTPS
sudo apt install nginx certbot python3-certbot-nginx
# proxy_pass http://localhost:3000;  →  depois:  sudo certbot --nginx
```

**Backup automático (cron diário):**
```bash
0 2 * * * cp /opt/metrocontrol/data/metrocontrol.db \
            /opt/metrocontrol/backups/mc-$(date +\%F).db
```

---

## 🔒 Checklist de produção

- [ ] `JWT_SECRET` forte definido por variável de ambiente.
- [ ] Senhas das contas de demonstração **trocadas** (ou contas removidas).
- [ ] HTTPS habilitado (Render/Railway já fornecem; em VPS use certbot).
- [ ] Banco em **volume persistente** (A) ou **serviço gerenciado** (B).
- [ ] Backups configurados e **testados** (restaure um backup ao menos uma vez).
- [ ] `CORS_ORIGIN` restrito ao seu domínio (não use `*` em produção).
- [ ] 2FA ativado para os perfis Administrador e Gestor.

---

## ❓ Qual escolher?

- **Quer ver funcionando hoje, sem complicação?** → Caminho **A** (Render + disco).
- **Vai usar de verdade, com vários usuários e backups gerenciados?** → Caminho **B** (Supabase/Neon).
- **Precisa manter os dados dentro da empresa?** → Caminho **C** (VPS).

Em todos os casos, o **frontend é servido pelo próprio backend** — você só precisa
publicar **um** serviço. Não há build, não há bundler, não há dor de cabeça.
