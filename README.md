# 🛰️ MetroControl

**Sistema corporativo de gestão de padrões de medição, normas técnicas, serviços metrológicos e rastreabilidade operacional**, em conformidade com **ISO/IEC 17025**, **ABNT** e **Inmetro**.

> Plataforma web completa para laboratórios de metrologia: controla padrões, movimentações, calibrações, checagens, normas, serviços e o histórico completo de utilização — com total rastreabilidade, segurança avançada e auditoria permanente.

---

## ⭐ Por que este projeto é diferente

- **Zero dependências externas no backend.** Roda apenas com Node.js (≥ 22.5) usando os módulos nativos `node:sqlite`, `node:http` e `node:crypto`. Não precisa de `npm install`, não compila nada nativo, não quebra.
- **Funciona imediatamente.** `node backend/server.js` e pronto — o banco é criado e populado com dados de demonstração automaticamente.
- **Pronto para a nuvem.** O mesmo código migra para PostgreSQL gerenciado (Supabase, Neon, Railway) com ajustes mínimos — veja [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).
- **31 testes de integração** cobrindo autenticação, 2FA, RBAC, soft-delete, lixeira e todo o fluxo operacional.

---

## 🚀 Início rápido (3 passos)

```bash
# 1. Entre na pasta do projeto
cd "Projeto Padrões e Normas EXCELMETRO"

# 2. (PostgreSQL) instale o driver — para SQLite local pode pular
npm install

# 3. Inicie o servidor
npm start                 # SQLite local (padrão, zero config)
# npm run start:pg-demo   # PostgreSQL em memória (demo)
# DATABASE_URL=postgres://... npm start   # PostgreSQL real (produção)

# 4. Abra no navegador → http://localhost:3000
```

Na primeira execução o sistema cria o schema e popula com **12 padrões, 6 normas,
3 serviços, 5 usuários e históricos de demonstração**.

> 🐘 **Banco de dados:** funciona em **PostgreSQL** (produção, via `DATABASE_URL`)
> ou **SQLite** (dev local, padrão) com o mesmo código. Guia completo em
> [docs/POSTGRESQL.md](docs/POSTGRESQL.md). Validado por 52 testes nos dois bancos.

### 🔑 Contas de demonstração

| Perfil              | E-mail                          | Senha           | O que pode fazer                                      |
|---------------------|---------------------------------|-----------------|------------------------------------------------------|
| Administrador       | `admin@metrocontrol.com`        | `Admin@123`     | Tudo: usuários, exclusões, restaurar lixeira, auditoria |
| Controle de Padrões | `controle@metrocontrol.com`     | `Controle@123`  | Cadastra, movimenta, calibra padrões, normas, serviços, auditoria |

> ⚠️ **Em produção, troque todas as senhas** e defina as variáveis `JWT_SECRET` e `DB_PATH`.

---

## 🧩 Funcionalidades

| Módulo | Recursos |
|--------|----------|
| **Padrões** | Cadastro completo (20+ campos), busca avançada, filtros rápidos (disponíveis/em uso/vencidos/próximos/manutenção), QR Code individual, histórico, status operacional |
| **Movimentação** | Retirada/devolução com responsável, cliente, motivo, local, condição; visão de "o que está fora e há quanto tempo" |
| **Calibrações & Checagens** | Histórico, cálculo automático da próxima data, painel de vencimentos, alertas em 7/15/30 dias, calendário |
| **Normas** | Biblioteca digital, controle de revisões (versionamento), vínculo a serviços |
| **Serviços** | Procedimento, técnico, padrões e normas utilizados, status, histórico |
| **Dashboard** | KPIs executivos + gráficos interativos (rosca, barras, linha) + timeline de atividades |
| **Relatórios** | 8 relatórios em **PDF** (impressão) e **Excel/CSV** |
| **Segurança** | Login, senha com scrypt, **2FA (TOTP)**, RBAC com 2 perfis (Administrador + Controle de Padrões), bloqueio por tentativas, logs e auditoria |
| **Proteção de dados** | Exclusão **lógica** com dupla confirmação + motivo, **lixeira**, restauração, versionamento, histórico permanente |
| **Diferenciais** | QR Code + scanner por câmera, mapa de localização, linha do tempo, tema claro/escuro, pesquisa global |

---

## 📂 Estrutura do projeto

```
metrocontrol/
├── backend/
│   ├── server.js                # Servidor HTTP + API (ponto de entrada)
│   └── src/
│       ├── db/
│       │   ├── schema.sql        # Schema completo (tabelas, FKs, índices, views)
│       │   ├── database.js       # Conexão e helpers (node:sqlite)
│       │   └── seed.js           # Dados de demonstração
│       ├── lib/
│       │   ├── security.js       # scrypt, JWT, TOTP/2FA
│       │   ├── http.js           # Micro-framework HTTP (router, estáticos)
│       │   └── audit.js          # Trilha de auditoria
│       ├── middleware/
│       │   └── auth.js           # Autenticação + RBAC
│       └── routes/               # 1 arquivo por módulo (padrões, normas, …)
├── frontend/
│   ├── index.html
│   ├── css/styles.css            # Design system (tema claro/escuro)
│   └── js/
│       ├── app.js                # SPA: login, shell, rotas, telas
│       ├── api.js                # Cliente da API REST
│       ├── ui.js                 # Ícones, toasts, modais, formatação
│       └── charts.js             # Gráficos em SVG puro
├── data/                         # Banco SQLite (criado em runtime)
├── docs/                         # 📚 Documentação completa (LEIA!)
│   ├── ARQUITETURA.md
│   ├── BANCO-DE-DADOS.md         # Diagrama ER + estrutura das tabelas
│   ├── HOSPEDAGEM.md             # ☁️ Como hospedar o banco na nuvem
│   ├── GUIA-DE-USO.md            # 🖥️ Como usar + demonstração da UI
│   └── API.md                    # Referência das APIs REST
└── package.json
```

---

## 📚 Documentação

| Documento | Conteúdo |
|-----------|----------|
| [**GUIA-DE-USO.md**](docs/GUIA-DE-USO.md) | Passo a passo de cada tela, com demonstração da interface e funcionalidades |
| [**HOSPEDAGEM.md**](docs/HOSPEDAGEM.md) | ☁️ Como hospedar o sistema e o banco de dados na nuvem (Render, Railway, Supabase, Neon, VPS) |
| [**BANCO-DE-DADOS.md**](docs/BANCO-DE-DADOS.md) | Diagrama ER, estrutura de todas as tabelas, índices e integridade referencial |
| [**ARQUITETURA.md**](docs/ARQUITETURA.md) | Visão de arquitetura, camadas, decisões técnicas, segurança |
| [**API.md**](docs/API.md) | Referência completa dos endpoints REST |

---

## 🛠️ Comandos úteis

```bash
npm start        # Inicia o servidor (produção)
npm run dev      # Inicia com auto-reload (node --watch)
npm run reset    # Apaga o banco e recria do zero na próxima inicialização

# Variáveis de ambiente suportadas:
PORT=8080            node backend/server.js   # muda a porta
DB_PATH=/dados/mc.db node backend/server.js   # muda o local do banco
JWT_SECRET=...       node backend/server.js   # segredo do token (produção!)
```

---

## ✅ Conformidade

O modelo de dados e os controles foram desenhados para apoiar requisitos de:
- **ISO/IEC 17025** — rastreabilidade metrológica, controle de equipamentos, registros.
- **ABNT NBR ISO 9001 / 10012** — gestão da qualidade e de medição.
- **Inmetro** — regulamentação técnica metrológica.

> Este é um sistema de **gestão e rastreabilidade**. A conformidade plena depende
> também dos procedimentos e da acreditação do laboratório.

---

## 📄 Licença

MIT — uso livre para fins comerciais e educacionais.
