# 🔌 Referência da API REST — MetroControl

Base URL: `http://localhost:3000/api`
Autenticação: header `Authorization: Bearer <token JWT>` (exceto no login).
Formato: JSON em todas as requisições e respostas.

> Códigos de erro padronizados: `400` (validação), `401` (não autenticado),
> `403` (sem permissão), `404` (não encontrado), `409` (conflito), `423` (bloqueado).

---

## 🔐 Autenticação

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | `/auth/login` | Login (retorna `token` ou `{precisa2fa:true}`) | público |
| GET | `/auth/me` | Dados do usuário logado | autenticado |
| POST | `/auth/senha` | Trocar a própria senha | autenticado |
| POST | `/auth/2fa/setup` | Gerar segredo 2FA + URL otpauth | autenticado |
| POST | `/auth/2fa/ativar` | Confirmar e ativar 2FA | autenticado |
| POST | `/auth/2fa/desativar` | Desativar 2FA (exige senha) | autenticado |

**Exemplo — login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@metrocontrol.com","senha":"Admin@123"}'
# → { "token": "eyJ...", "usuario": { "id":1, "perfil":"administrador", ... } }
```

---

## 🎚️ Padrões

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/padroes?busca=&filtro=&status=&grandeza=&limite=&offset=` | Listar com busca/filtros |
| GET | `/padroes/:id` | Detalhe + históricos + anexos |
| GET | `/padroes/uuid/:uuid` | Buscar por QR Code |
| POST | `/padroes` | Criar (escrita) |
| PUT | `/padroes/:id` | Editar (escrita) |
| DELETE | `/padroes/:id` | Excluir lógico — body `{confirmar:true, motivo}` |
| GET | `/padroes-grandezas` | Lista de grandezas distintas |

**Filtros rápidos** (`filtro=`): `disponivel`, `em_uso`, `vencidos`, `proximos`,
`em_manutencao`, `fora_operacao`.

---

## ⇄ Movimentações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/movimentacoes?status=&padrao_id=&cliente_id=` | Listar |
| GET | `/movimentacoes/abertas` | Padrões atualmente fora |
| POST | `/movimentacoes` | Registrar retirada (escrita) |
| POST | `/movimentacoes/:id/devolver` | Registrar devolução (escrita) |
| GET | `/movimentacoes/:id` | Detalhe |

---

## 📅 Calibrações, Checagens e Vencimentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET / POST | `/calibracoes` | Listar / registrar calibração |
| GET / POST | `/checagens` | Listar / registrar checagem |
| GET | `/vencimentos` | Painel agrupado (vencidos, 7, 15, 30 dias) |
| GET | `/alertas` | Contadores para o sino/badge |
| GET | `/calendario` | Eventos para calendário |

> Ao registrar calibração/checagem, a **próxima data** é calculada automaticamente
> pela periodicidade do padrão, e as datas do padrão são atualizadas.

---

## 📖 Normas e 🔧 Serviços

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST/PUT/DELETE | `/normas` `/normas/:id` | CRUD de normas (versionamento de revisão) |
| GET/POST/PUT/DELETE | `/servicos` `/servicos/:id` | CRUD de serviços (com `padroes[]` e `normas[]`) |
| GET/POST | `/clientes` | Listar / criar clientes |

---

## 📊 Dashboard e Mapa

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/dashboard` | KPIs + séries de gráficos + últimas atividades |
| GET | `/mapa` | Padrões com localização para o mapa |

---

## 📄 Relatórios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/relatorios` | Lista de relatórios disponíveis |
| GET | `/relatorios/:tipo?formato=json\|csv` | Gerar relatório (JSON p/ PDF, CSV p/ Excel) |

Tipos: `inventario`, `vencidos`, `em_uso`, `movimentacoes`, `calibracoes`,
`checagens`, `servicos`, `normas`.

---

## 👥 Administração

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/usuarios` | Listar usuários | controle_padroes+ |
| POST | `/usuarios` | Criar usuário | admin |
| PUT | `/usuarios/:id` | Editar usuário | admin |
| POST | `/usuarios/:id/senha` | Redefinir senha | admin |
| DELETE | `/usuarios/:id` | Desativar/excluir | admin |
| GET | `/auditoria?acao=&entidade=&usuario_id=&de=&ate=` | Trilha de auditoria | controle_padroes+ |
| GET | `/auditoria/timeline/:entidade/:id` | Linha do tempo de um registro | autenticado |
| GET | `/lixeira` | Itens excluídos | admin |
| POST | `/lixeira/:entidade/:id/restaurar` | Restaurar | admin |

---

## Níveis de acesso (RBAC)

`controle_padroes (1) < administrador (2)`

- **Controle de Padrões:** opera padrões, movimentações, calibrações, normas, serviços, auditoria (leitura).
- **Administrador:** acesso total — usuários, lixeira, restauração e todas as operações.
