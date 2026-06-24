# 🐘 Rodando o MetroControl com PostgreSQL

O MetroControl agora suporta **dois bancos com o mesmo código**, escolhidos por
variável de ambiente:

| Modo | Como ativar | Para quê |
|------|-------------|----------|
| **PostgreSQL** | definir `DATABASE_URL` | **Produção** (recomendado) |
| PostgreSQL em memória | `PG_MEM=1` | Demonstração/teste sem instalar nada |
| SQLite (arquivo) | *(padrão, sem variáveis)* | Desenvolvimento local rápido |

Toda a lógica é idêntica — a troca acontece só em
[`backend/src/db/database.js`](../backend/src/db/database.js), que traduz o SQL e
usa o driver `pg` quando há `DATABASE_URL`.

---

## 1. Pré-requisito: instalar o driver

```bash
npm install        # instala 'pg' (driver PostgreSQL)
```

## 2. Ver funcionando JÁ, sem instalar PostgreSQL (modo demo em memória)

```bash
npm run start:pg-demo      # equivale a:  PG_MEM=1 node backend/server.js
```
Sobe o sistema usando **PostgreSQL em memória** (pg-mem) — ótimo para validar o
comportamento PostgreSQL sem instalar um servidor. Os dados somem ao parar.

## 3. PostgreSQL de verdade (local ou nuvem)

### 3.1 Banco na nuvem (Supabase / Neon — grátis, com backup)
1. Crie um projeto em <https://supabase.com> ou <https://neon.tech>.
2. Copie a *connection string*, algo como:
   `postgresql://usuario:senha@host:5432/banco`
3. Rode o app apontando para ela:
   ```bash
   DATABASE_URL="postgresql://usuario:senha@host:5432/banco" npm start
   ```
   Na primeira execução, o schema (`schema.pg.sql`) é criado e os dados de
   demonstração são inseridos automaticamente.

### 3.2 PostgreSQL local (Linux)
```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE DATABASE metrocontrol;"
sudo -u postgres psql -c "CREATE USER metro WITH PASSWORD 'metro123';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE metrocontrol TO metro;"

DATABASE_URL="postgresql://metro:metro123@localhost:5432/metrocontrol" \
  PGSSL=disable npm start
```
> Use `PGSSL=disable` para conexões locais sem TLS. Em nuvem, deixe o SSL ligado
> (padrão).

---

## 4. Variáveis de ambiente

| Variável | Efeito |
|----------|--------|
| `DATABASE_URL` | Ativa PostgreSQL e define a conexão |
| `PGSSL=disable` | Desliga SSL (PostgreSQL local) |
| `PG_POOL_MAX` | Tamanho do pool (padrão 10) |
| `PG_MEM=1` | PostgreSQL em memória (teste/demo) |
| `JWT_SECRET` | Segredo dos tokens (defina em produção!) |
| `PORT` | Porta HTTP (padrão 3000) |

---

## 5. Detalhes técnicos da portabilidade

- **Datas/horas** são armazenadas como TEXT ISO em ambos os bancos (comportamento
  idêntico). Funções do SQLite (`datetime('now')`, `date('now','+30 day')`,
  `julianday()`, `strftime()`) são traduzidas para PostgreSQL em tempo de execução.
- **Transações** usam um cliente dedicado por requisição via `AsyncLocalStorage`
  (isolamento correto sob concorrência no PostgreSQL).
- **IDs**: `SERIAL` no PostgreSQL, `AUTOINCREMENT` no SQLite. Inserts usam
  `RETURNING id` automaticamente no PostgreSQL.
- **Booleanos** são `INTEGER (0/1)` em ambos, mantendo o código igual.
- O schema PostgreSQL fica em
  [`backend/src/db/schema.pg.sql`](../backend/src/db/schema.pg.sql).

> ✅ Validado com **52 testes de integração** rodando tanto em SQLite quanto em
> PostgreSQL (pg-mem) — mesmo resultado nos dois.
