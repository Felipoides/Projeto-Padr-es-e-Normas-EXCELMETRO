# 🖥️ Guia de Uso e Demonstração da Interface — MetroControl

Este guia mostra **como usar cada tela** do sistema, com representações visuais
(mockups) da interface e o passo a passo de cada funcionalidade.

> Para ver de verdade: inicie com `npm start` e abra <http://localhost:3000>.
> Entre com `admin@metrocontrol.com` / `Admin@123`.

---

## 1. 🔐 Tela de Login (com 2FA)

```
┌───────────────────────────────┬────────────────────────────────┐
│                               │                                 │
│   MetroControl                │   [⬡] MetroControl              │
│                               │                                 │
│   Gestão total de padrões     │   Acesse sua conta              │
│   de medição, normas e        │   Entre com suas credenciais    │
│   rastreabilidade — ISO 17025 │                                 │
│                               │   E-mail                        │
│   ✓ ISO/IEC 17025  ✓ ABNT     │   [ admin@metrocontrol.com    ] │
│   ✓ Inmetro  ✓ Rastreabilidade│   Senha                         │
│   ✓ Auditoria completa        │   [ ••••••••                  ] │
│                               │   Código 2FA (se ativo)         │
│                               │   [ 000000 ]                    │
│   (fundo gradiente azul/teal) │   [        Entrar           ]   │
│                               │                                 │
└───────────────────────────────┴────────────────────────────────┘
```

**Como usar:**
1. Informe e-mail e senha. As contas de demonstração aparecem na própria tela.
2. Se o 2FA estiver ativo, o campo de **código de verificação** aparece — digite
   os 6 dígitos do app autenticador (Google Authenticator/Authy).
3. Após 5 tentativas erradas, a conta é **bloqueada por 15 minutos** (anti-força-bruta).

---

## 2. 📊 Dashboard Executivo

```
┌──────────┬──────────────────────────────────────────────────────────┐
│ [⬡] Metro│  Dashboard          [🔍 pesquisa global]   [📷][🔔][🌙][⎘] │
│  Control │ ─────────────────────────────────────────────────────────│
│          │  Painel Executivo                                         │
│ OPERAÇÃO │  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐ │
│ ▸Dashboard│ │ 12  ││  8  ││  2  ││  3  ││  2  ││  1  ││  1  ││  6  │ │
│ ▸Padrões │  │Total││Disp.││Uso  ││Venc.││30d  ││Fora ││Serv.││Norm.│ │
│ ▸Movim.  │  └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘ │
│ ▸Calibr.3│  ┌────────────────────┐  ┌──────────────────────────┐    │
│          │  │  Padrões por status│  │  Padrões por grandeza    │    │
│ DOCUMENT.│  │     ◕ (rosca)      │  │   ▆ ▅ ▃ ▂ (barras)       │    │
│ ▸Normas  │  └────────────────────┘  └──────────────────────────┘    │
│ ▸Serviços│  ┌────────────────────┐  ┌──────────────────────────┐    │
│ ▸Mapa    │  │ Calibrações/mês ╱╲ │  │ ⚡ Últimas atividades     │    │
│ ▸Relat.  │  │     (linha)    ╱  ╲│  │ • Login admin ...        │    │
│ ADMIN    │  └────────────────────┘  └──────────────────────────┘    │
│ ▸Usuários│                                                           │
│ ▸Auditor.│  [AD] Administrador                                       │
│ ▸Lixeira │      administrador                                        │
└──────────┴──────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- **8 cartões de KPI** clicáveis — cada um leva direto à lista filtrada
  (ex.: clicar em "Vencidos" abre Padrões já filtrados por vencidos).
- **Gráficos interativos** (rosca, barras, linha) desenhados em SVG nativo.
- **Timeline** das últimas 12 ações registradas na auditoria.
- **Sino 🔔** com ponto vermelho quando há vencimentos; **badge numérico** no menu "Calibrações".

---

## 3. 🎚️ Padrões — lista, busca e filtros rápidos

```
 Padrões de Medição                          [+ Novo padrão]
 12 padrões cadastrados · busca avançada e filtros rápidos
 [🔍 Código, série, fabricante, modelo, grandeza, localização...    ]
 (Todos)(Disponíveis)(Em uso)(Vencidos)(Próximos)(Manutenção)(Fora)
 ┌─────────┬──────────────────┬──────────┬───────────┬─────────┬─────────┐
 │ CÓDIGO  │ EQUIPAMENTO      │ GRANDEZA │ LOCAL     │ STATUS  │SITUAÇÃO │
 ├─────────┼──────────────────┼──────────┼───────────┼─────────┼─────────┤
 │ PAD-0001│ CD-6 ASX         │Comprim.  │ Armário A1│●Dispon. │●Em dia  │
 │ PAD-0002│ 293-340-30       │Comprim.  │ Armário A1│●Dispon. │●Vencido │
 │ PAD-0003│ BG-2200          │Massa     │ Lab Massa │●Em uso  │●Em dia  │
 │ PAD-0006│ HR-150A          │Dureza    │ Lab Dureza│●Manut.  │●Vencido │
 └─────────┴──────────────────┴──────────┴───────────┴─────────┴─────────┘
```

**Como usar:**
- **Busca avançada:** digite qualquer termo — busca em código, série, fabricante,
  modelo, tipo, grandeza, localização e setor simultaneamente (debounce de 350 ms).
- **Filtros rápidos (chips):** Disponíveis, Em uso, Vencidos, Próximos ao
  vencimento, Em manutenção, Fora de operação.
- **Semáforo de situação:** Em dia / Atenção / Alerta / Crítico / Vencido,
  calculado a partir das datas de próxima calibração/checagem.
- Clique em qualquer linha para abrir a **ficha completa**.

---

## 4. 📋 Ficha do Padrão (detalhe + QR + ações)

```
 PAD-0001  ●Disponível ●Em dia    [⬚ QR Code][← Voltar][⇄ Movimentar]
 Mitutoyo CD-6 ASX · Paquímetro Digital  [📅 Calibração][✎ Editar][🗑]
 ┌──────────────────────────┐  ┌───────────────────────────────────┐
 │ DADOS TÉCNICOS           │  │ 📅 VENCIMENTOS                     │
 │ Nº série    SN-784512    │  │ Última calibr.  12/07/2025         │
 │ Grandeza    Comprimento  │  │ Próxima calibr. 29/07/2026 (35 d)  │
 │ Faixa       0 a 150 mm   │  │ Última checagem 25/01/2026         │
 │ Resolução   0,01 mm      │  │ Próxima check.  24/07/2026 (30 d)  │
 │ Exatidão    ± 0,02 mm    │  │ ── Linha do tempo ──               │
 │ Classe      Classe 1     │  │ • Calibração registrada ...        │
 │ Local       Armário A1   │  │ • Padrão criado ...                │
 └──────────────────────────┘  └───────────────────────────────────┘
 ┌──────────────────────────────────────────────────────────────────┐
 │ Histórico de calibrações                                         │
 │ DATA       CERTIFICADO   LABORATÓRIO     RESULTADO   PRÓXIMA      │
 │ 12/07/2025 CERT-2024-1000 RBC Lab 1234   aprovado    29/07/2026   │
 └──────────────────────────────────────────────────────────────────┘
 ┌──────────────────────────────────────────────────────────────────┐
 │ Histórico de movimentações  (retirada · responsável · cliente)   │
 └──────────────────────────────────────────────────────────────────┘
```

**Ações disponíveis (conforme perfil):**
- **QR Code** → abre a etiqueta com QR escaneável e botão **Imprimir etiqueta**.
- **Movimentar** → registra a retirada do padrão.
- **Registrar calibração** → lança calibração e recalcula a próxima data automaticamente.
- **Editar / Excluir** → exclusão exige dupla confirmação + motivo (vai p/ lixeira).

---

## 5. ⬚ QR Code e 📷 Scanner por câmera

```
        Etiqueta QR Code
   ┌───────────────────────┐
   │   ▛▀▌ ▐▌▀▛  ▐▌        │
   │   ▌▄▐ ▌▐ ▄▌  ▀  (QR)  │   ← escaneável: abre a ficha do
   │   ▀▘▘ ▐▖▝▀▘ ▝▘         │      padrão direto no sistema
   └───────────────────────┘
         PAD-0001
       Mitutoyo CD-6 ASX
   [🖨 Imprimir etiqueta] [Fechar]
```

- Cada padrão tem um **QR Code único e permanente** (baseado no `uuid`).
- O QR codifica `https://<host>/#/q/<uuid>`. Ao escanear com o celular, abre a
  **ficha do padrão** diretamente.
- O botão **📷 (topo)** abre o **scanner por câmera** — aponte para o QR de um
  padrão e o sistema navega até ele. Há campo manual de fallback.

---

## 6. ⇄ Movimentações (rastreamento)

```
 Movimentações                                  [+ Nova retirada]
 (Todas)(Em uso · fora)(Devolvidas)
 ┌─────────┬────────────┬──────────────┬───────────┬───────────────┐
 │ PADRÃO  │ RESPONSÁVEL│ RETIRADA     │ CLIENTE   │ SITUAÇÃO       │
 ├─────────┼────────────┼──────────────┼───────────┼────────────────┤
 │ PAD-0003│ João Téc.  │ 21/06 08:30  │ Beta S.A. │●3 dia(s) fora  │ [✓Devolver]
 │ PAD-0011│ João Téc.  │ 04/06 09:00  │ Alfa Ltda │●Devolvido 06/06│
 └─────────┴────────────┴──────────────┴───────────┴────────────────┘
```

**Fluxo completo de rastreamento:**
1. **Nova retirada:** escolha o padrão (somente disponíveis), cliente, motivo e
   local. → o status do padrão vira **Em uso** automaticamente.
2. Na lista você vê **quem está usando**, **há quantos dias está fora** e o **cliente**.
3. **Devolver:** informe a **condição** (ótima/boa/danificado/requer calibração).
   - "danificado" → padrão vai para **manutenção**;
   - "requer calibração" → padrão vai para **fora de operação**.

---

## 7. 📅 Calibrações & Vencimentos

```
 Calibrações & Vencimentos              [📄 Relatório de vencidos]
 ┌──────────────────────────────────────────────────────────────┐
 │ Vencidos                                            [ 5 ]     │
 │ CÓDIGO    EQUIPAMENTO   TIPO        VENCE EM     DIAS         │
 │ PAD-0002  293-340-30    Calibração  19/06/2026   -5 d  (verm.)│
 │ PAD-0006  HR-150A       Calibração  10/05/2026  -45 d        │
 ├──────────────────────────────────────────────────────────────┤
 │ Vencem em até 7 dias                                [ 0 ] 👍  │
 │ Vencem em até 15 dias                               [ 1 ]     │
 │ Vencem em até 30 dias                               [ 1 ]     │
 └──────────────────────────────────────────────────────────────┘
```

- **Controle automático:** sempre que uma calibração é registrada, a próxima data
  é calculada pela periodicidade do padrão.
- **Alertas em 4 faixas:** vencidos, 7, 15 e 30 dias.
- Clique numa linha para abrir a ficha do padrão.

---

## 8. 📖 Normas e 🔧 Serviços

**Normas** — biblioteca digital com código, nome, revisão, organismo (ABNT/ISO/
Inmetro), área de aplicação e PDF. Ao mudar a revisão, a versão anterior é
**arquivada automaticamente** (versionamento). Cada norma mostra os **serviços
que a aplicam**.

**Serviços** — cadastre o serviço com **procedimento, técnico responsável,
padrões utilizados e normas aplicadas** (seleção múltipla). A ficha do serviço
lista os padrões usados (clicáveis) e as normas.

---

## 9. 🗺️ Mapa de Localização

```
 Mapa de Localização         ●Disponível ●Em uso ●Manut. ●Fora ●Inativo
 ┌──────────────────────────────────────────────────────────────┐
 │   📍01        📍04                📍07                        │
 │      📍02         📍05    📍06              📍08              │
 │   (grade do laboratório — pinos coloridos por status)        │
 └──────────────────────────────────────────────────────────────┘
```
Distribuição física dos padrões; cada pino tem cor por status e abre a ficha ao clicar.

---

## 10. 📄 Relatórios (PDF e Excel)

```
 Relatórios
 ┌────────────────────────────────────────┐ ┌──────────────────────────┐
 │ 📄 Inventário Completo de Padrões       │ │ 📄 Padrões Vencidos      │
 │    Exporte em PDF ou Excel  [PDF][Excel]│ │   [PDF] [Excel]          │
 └────────────────────────────────────────┘ └──────────────────────────┘
 (também: Em uso, Movimentações, Calibrações, Checagens, Serviços, Normas)
```

- **PDF:** abre uma janela formatada pronta para "Salvar como PDF" (impressão do navegador).
- **Excel/CSV:** baixa um `.csv` com BOM e separador `;` (abre perfeito no Excel PT-BR).
- Toda exportação é registrada na **auditoria**.

---

## 11. 👥 Usuários, 🛡️ Auditoria e 🗑️ Lixeira

**Usuários (RBAC):** administrador cria/edita usuários, define perfil, redefine
senha e ativa/inativa contas. A tela documenta o que cada perfil pode fazer.

**Auditoria:** trilha **permanente** de todas as ações (login, criação, edição,
exclusão, restauração, exportação, calibração, retirada…), com usuário, data/hora,
entidade, descrição e IP.

**Lixeira (proteção de dados):** lista tudo que foi excluído logicamente, com
**motivo** e **quem excluiu**. O administrador pode **restaurar** qualquer registro
— nada é apagado de verdade.

```
 Lixeira
 ┌──────────┬──────────────┬───────────────┬─────────────┬──────────────┐
 │ TIPO     │ REGISTRO     │ MOTIVO        │ EXCLUÍDO EM │              │
 │ padroes  │ PAD-0099     │ duplicidade   │ 24/06 11:20 │ [↺ Restaurar]│
 └──────────┴──────────────┴───────────────┴─────────────┴──────────────┘
```

---

## 12. 🔑 Segurança da conta (2FA)

Clique no ícone **🔑** (topo) → aba **Verificação em 2 etapas**:
1. **Ativar 2FA** → o sistema mostra um **QR Code** + segredo.
2. Escaneie no **Google Authenticator / Authy**.
3. Digite o código gerado para **confirmar e ativar**.
4. Nos próximos logins, o código de 6 dígitos passa a ser exigido.

Também é possível **alterar a própria senha** na aba ao lado.

---

## 13. 🌗 Tema, pesquisa global e responsividade

- **Tema claro/escuro:** botão 🌙/☀️ no topo (preferência salva no navegador).
- **Pesquisa global:** campo no topo — Enter leva à lista de padrões já filtrada.
- **Responsivo:** layout se adapta a telas menores (a barra lateral recolhe).

---

### Resumo do que cada perfil enxerga

| Recurso | Admin | Gestor | Técnico | Auditor | Visualiz. |
|---------|:-----:|:------:|:-------:|:-------:|:---------:|
| Ver módulos operacionais | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar/editar padrões, normas, serviços | ✅ | ✅ | ✅ | — | — |
| Movimentar / calibrar | ✅ | ✅ | ✅ | — | — |
| Excluir (→ lixeira) | ✅ | ✅ | ✅ | — | — |
| Usuários & perfis | ✅ | 👁 | — | — | — |
| Auditoria | ✅ | ✅ | — | ✅ | — |
| Restaurar da lixeira | ✅ | — | — | — | — |

👁 = somente leitura.
