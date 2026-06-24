-- ============================================================================
--  MetroControl — Schema do Banco de Dados
--  Sistema de Gestão de Padrões Metrológicos / ISO-IEC 17025
--
--  Dialeto: SQLite (compatível com PostgreSQL com ajustes mínimos descritos
--           em docs/HOSPEDAGEM.md). Integridade referencial via FOREIGN KEYs.
--
--  Convenções:
--   - Toda tabela de negócio possui colunas de auditoria temporal:
--       criado_em, atualizado_em, criado_por, atualizado_por
--   - Exclusão é SEMPRE lógica (soft delete):
--       excluido_em (NULL = ativo), excluido_por, motivo_exclusao
--   - Datas em ISO-8601 (YYYY-MM-DD / YYYY-MM-DDTHH:MM:SSZ)
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;     -- melhor concorrência leitura/escrita

-- ----------------------------------------------------------------------------
--  USUÁRIOS E SEGURANÇA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    senha_hash      TEXT    NOT NULL,            -- scrypt: salt:hash (hex)
    perfil          TEXT    NOT NULL DEFAULT 'visualizador'
                        CHECK (perfil IN ('administrador','gestor','tecnico','auditor','visualizador')),
    ativo           INTEGER NOT NULL DEFAULT 1,  -- 0/1
    telefone        TEXT,
    cargo           TEXT,
    -- Autenticação em dois fatores (TOTP)
    twofa_secret    TEXT,                        -- segredo base32 (NULL = sem 2FA)
    twofa_ativo     INTEGER NOT NULL DEFAULT 0,
    -- Bloqueio por tentativas
    tentativas_login INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate   TEXT,
    ultimo_login    TEXT,
    -- Auditoria temporal / soft delete
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por      INTEGER REFERENCES usuarios(id),
    atualizado_por  INTEGER REFERENCES usuarios(id),
    excluido_em     TEXT,
    excluido_por    INTEGER REFERENCES usuarios(id),
    motivo_exclusao TEXT
);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil  ON usuarios(perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo   ON usuarios(ativo);

-- ----------------------------------------------------------------------------
--  CLIENTES (relacionados às movimentações e serviços)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    documento       TEXT,                         -- CNPJ/CPF
    contato         TEXT,
    email           TEXT,
    telefone        TEXT,
    endereco        TEXT,
    observacoes     TEXT,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por      INTEGER REFERENCES usuarios(id),
    atualizado_por  INTEGER REFERENCES usuarios(id),
    excluido_em     TEXT,
    excluido_por    INTEGER REFERENCES usuarios(id),
    motivo_exclusao TEXT
);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

-- ----------------------------------------------------------------------------
--  PADRÕES DE MEDIÇÃO  (entidade central)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS padroes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_interno      TEXT    NOT NULL UNIQUE,      -- código único interno
    numero_serie        TEXT,
    fabricante          TEXT,
    modelo              TEXT,
    tipo_instrumento    TEXT,
    grandeza            TEXT,                          -- grandeza medida
    faixa_indicacao     TEXT,                          -- ex: "0 a 100 mm"
    resolucao           TEXT,                          -- ex: "0,01 mm"
    exatidao            TEXT,                          -- ex: "± 0,02 mm"
    classe_metrologica  TEXT,
    -- Campos adicionais (compatibilidade com o sistema legado de metrologia)
    capacidade          TEXT,                          -- ex: "-30 a 1000 °C"
    unidade             TEXT,                          -- unidade de medida (°C, mm, kg...)
    tolerancia          TEXT,                          -- tolerância admissível
    lacre               TEXT,                          -- identificação do lacre / N.A.
    departamento        TEXT,                          -- departamento responsável
    usuario_instrumento TEXT,                          -- usuário/setor que utiliza o padrão
    procedimento        TEXT,                          -- procedimento de calibração aplicado
    instrucoes          TEXT,                          -- instruções de uso
    procedimento_verificacao TEXT,                     -- procedimento de verificação
    codigo_barras       TEXT,                          -- código de barras (legado)
    travado             INTEGER NOT NULL DEFAULT 0,    -- registro travado (não editável)
    localizacao         TEXT,                          -- localização física
    -- Coordenadas para o "mapa de localização" (opcional)
    mapa_x              REAL,
    mapa_y              REAL,
    setor               TEXT,
    -- Datas operacionais
    data_aquisicao      TEXT,
    data_ultima_calibracao  TEXT,
    data_proxima_calibracao TEXT,
    data_ultima_checagem    TEXT,
    data_proxima_checagem   TEXT,
    periodicidade_calibracao_meses INTEGER DEFAULT 12,
    periodicidade_checagem_meses   INTEGER DEFAULT 6,
    -- Estado operacional
    status              TEXT    NOT NULL DEFAULT 'disponivel'
                            CHECK (status IN ('disponivel','em_uso','em_manutencao','fora_operacao','inativo')),
    observacoes         TEXT,
    valor_aquisicao     REAL,
    -- QR Code: o conteúdo do QR é o uuid abaixo (estável e único)
    uuid                TEXT    NOT NULL UNIQUE,
    -- Auditoria / soft delete
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_padroes_codigo    ON padroes(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_padroes_status    ON padroes(status);
CREATE INDEX IF NOT EXISTS idx_padroes_grandeza  ON padroes(grandeza);
CREATE INDEX IF NOT EXISTS idx_padroes_prox_cal  ON padroes(data_proxima_calibracao);
CREATE INDEX IF NOT EXISTS idx_padroes_prox_chk  ON padroes(data_proxima_checagem);
CREATE INDEX IF NOT EXISTS idx_padroes_uuid      ON padroes(uuid);
CREATE INDEX IF NOT EXISTS idx_padroes_excluido  ON padroes(excluido_em);

-- ----------------------------------------------------------------------------
--  ANEXOS (certificados, fotos, PDFs) — genérico por entidade
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anexos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade        TEXT    NOT NULL,              -- 'padrao' | 'norma' | 'calibracao' | 'servico'
    entidade_id     INTEGER NOT NULL,
    tipo            TEXT    NOT NULL DEFAULT 'documento'
                        CHECK (tipo IN ('certificado','foto','documento','pdf')),
    nome_arquivo    TEXT    NOT NULL,
    nome_original   TEXT,
    mime            TEXT,
    tamanho_bytes   INTEGER,
    descricao       TEXT,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por      INTEGER REFERENCES usuarios(id),
    excluido_em     TEXT,
    excluido_por    INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON anexos(entidade, entidade_id);

-- ----------------------------------------------------------------------------
--  MOVIMENTAÇÕES (retirada / devolução / rastreamento)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimentacoes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    -- Retirada
    retirado_por        INTEGER REFERENCES usuarios(id),
    retirado_por_nome   TEXT,                       -- redundância p/ histórico permanente
    data_retirada       TEXT    NOT NULL DEFAULT (datetime('now')),
    cliente_id          INTEGER REFERENCES clientes(id),
    cliente_nome        TEXT,
    servico_id          INTEGER REFERENCES servicos(id),
    motivo              TEXT,
    local_utilizacao    TEXT,
    -- Devolução
    devolvido_por       INTEGER REFERENCES usuarios(id),
    devolvido_por_nome  TEXT,
    data_devolucao      TEXT,
    condicao_devolucao  TEXT CHECK (condicao_devolucao IN ('otima','boa','danificado','requer_calibracao', NULL)),
    observacoes_devolucao TEXT,
    -- Estado: 'aberta' (fora) | 'fechada' (devolvido)
    status              TEXT    NOT NULL DEFAULT 'aberta'
                            CHECK (status IN ('aberta','fechada')),
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_mov_padrao  ON movimentacoes(padrao_id);
CREATE INDEX IF NOT EXISTS idx_mov_status  ON movimentacoes(status);
CREATE INDEX IF NOT EXISTS idx_mov_cliente ON movimentacoes(cliente_id);

-- ----------------------------------------------------------------------------
--  CALIBRAÇÕES (histórico)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calibracoes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    data_calibracao     TEXT    NOT NULL,
    data_proxima        TEXT,
    numero_certificado  TEXT,
    laboratorio         TEXT,                       -- laboratório que calibrou
    rastreabilidade     TEXT,                       -- ex: RBC / Inmetro
    resultado           TEXT CHECK (resultado IN ('aprovado','aprovado_com_ressalva','reprovado', NULL)),
    incerteza           TEXT,
    custo               REAL,
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_cal_padrao ON calibracoes(padrao_id);
CREATE INDEX IF NOT EXISTS idx_cal_data   ON calibracoes(data_calibracao);

-- ----------------------------------------------------------------------------
--  CHECAGENS INTERMEDIÁRIAS (histórico)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checagens (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    data_checagem       TEXT    NOT NULL,
    data_proxima        TEXT,
    metodo              TEXT,
    resultado           TEXT CHECK (resultado IN ('conforme','nao_conforme', NULL)),
    responsavel_id      INTEGER REFERENCES usuarios(id),
    responsavel_nome    TEXT,
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_chk_padrao ON checagens(padrao_id);

-- ----------------------------------------------------------------------------
--  NORMAS TÉCNICAS (biblioteca digital)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS normas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT    NOT NULL,           -- ex: ISO/IEC 17025
    nome                TEXT    NOT NULL,
    revisao             TEXT,                       -- ex: 2017
    data_emissao        TEXT,
    data_revisao        TEXT,
    area_aplicacao      TEXT,
    organismo           TEXT,                       -- ABNT / ISO / Inmetro
    status              TEXT    NOT NULL DEFAULT 'vigente'
                            CHECK (status IN ('vigente','revisada','cancelada')),
    arquivo_pdf         TEXT,                       -- nome do arquivo
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_normas_codigo ON normas(codigo);

-- Histórico de revisões de normas (versionamento)
CREATE TABLE IF NOT EXISTS norma_revisoes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    norma_id        INTEGER NOT NULL REFERENCES normas(id),
    revisao         TEXT,
    data_revisao    TEXT,
    descricao       TEXT,
    arquivo_pdf     TEXT,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por      INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_norma_rev ON norma_revisoes(norma_id);

-- ----------------------------------------------------------------------------
--  SERVIÇOS METROLÓGICOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT    UNIQUE,
    nome                TEXT    NOT NULL,
    descricao           TEXT,
    procedimento        TEXT,                       -- procedimento técnico
    cliente_id          INTEGER REFERENCES clientes(id),
    cliente_nome        TEXT,
    tecnico_id          INTEGER REFERENCES usuarios(id),
    tecnico_nome        TEXT,
    data_inicio         TEXT,
    data_conclusao      TEXT,
    status              TEXT    NOT NULL DEFAULT 'planejado'
                            CHECK (status IN ('planejado','em_andamento','concluido','cancelado')),
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    criado_por          INTEGER REFERENCES usuarios(id),
    atualizado_por      INTEGER REFERENCES usuarios(id),
    excluido_em         TEXT,
    excluido_por        INTEGER REFERENCES usuarios(id),
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);

-- Junção: serviço <-> padrões utilizados
CREATE TABLE IF NOT EXISTS servico_padroes (
    servico_id  INTEGER NOT NULL REFERENCES servicos(id),
    padrao_id   INTEGER NOT NULL REFERENCES padroes(id),
    PRIMARY KEY (servico_id, padrao_id)
);

-- Junção: serviço <-> normas aplicadas
CREATE TABLE IF NOT EXISTS servico_normas (
    servico_id  INTEGER NOT NULL REFERENCES servicos(id),
    norma_id    INTEGER NOT NULL REFERENCES normas(id),
    PRIMARY KEY (servico_id, norma_id)
);

-- ----------------------------------------------------------------------------
--  AUDITORIA / LOGS (histórico permanente — nunca excluído)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER REFERENCES usuarios(id),
    usuario_nome    TEXT,
    acao            TEXT    NOT NULL,               -- LOGIN, CRIAR, EDITAR, EXCLUIR, RESTAURAR, EXPORTAR...
    entidade        TEXT,                           -- tabela afetada
    entidade_id     INTEGER,
    descricao       TEXT,
    dados_antes     TEXT,                           -- JSON snapshot (versionamento)
    dados_depois    TEXT,                           -- JSON snapshot
    ip              TEXT,
    user_agent      TEXT,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_usuario  ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON auditoria(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_data     ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_acao     ON auditoria(acao);

-- ----------------------------------------------------------------------------
--  CONFIGURAÇÕES DO SISTEMA (chave/valor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracoes (
    chave           TEXT PRIMARY KEY,
    valor           TEXT,
    descricao       TEXT,
    atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
--  VIEWS de apoio (vencimentos calculados)
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS vw_padroes_vencimento AS
SELECT
    p.*,
    CAST(julianday(p.data_proxima_calibracao) - julianday(date('now')) AS INTEGER) AS dias_para_calibracao,
    CAST(julianday(p.data_proxima_checagem)   - julianday(date('now')) AS INTEGER) AS dias_para_checagem
FROM padroes p
WHERE p.excluido_em IS NULL;
