-- ============================================================================
--  MetroControl — Schema do Banco de Dados (PostgreSQL)
--  Versão PostgreSQL do schema.sql. Datas/horas são guardadas como TEXT (ISO),
--  mantendo o comportamento idêntico ao SQLite. Booleanos como INTEGER (0/1).
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nome            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    senha_hash      TEXT    NOT NULL,
    perfil          TEXT    NOT NULL DEFAULT 'controle_padroes'
                        CHECK (perfil IN ('administrador','controle_padroes')),
    ativo           INTEGER NOT NULL DEFAULT 1,
    telefone        TEXT,
    cargo           TEXT,
    twofa_secret    TEXT,
    twofa_ativo     INTEGER NOT NULL DEFAULT 0,
    tentativas_login INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate   TEXT,
    ultimo_login    TEXT,
    criado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em   TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por      INTEGER,
    atualizado_por  INTEGER,
    excluido_em     TEXT,
    excluido_por    INTEGER,
    motivo_exclusao TEXT
);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil  ON usuarios(perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo   ON usuarios(ativo);

CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL PRIMARY KEY,
    nome            TEXT    NOT NULL,
    documento       TEXT,
    contato         TEXT,
    email           TEXT,
    telefone        TEXT,
    endereco        TEXT,
    observacoes     TEXT,
    criado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em   TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por      INTEGER,
    atualizado_por  INTEGER,
    excluido_em     TEXT,
    excluido_por    INTEGER,
    motivo_exclusao TEXT
);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

CREATE TABLE IF NOT EXISTS padroes (
    id                  SERIAL PRIMARY KEY,
    codigo_interno      TEXT    NOT NULL UNIQUE,
    numero_serie        TEXT,
    fabricante          TEXT,
    modelo              TEXT,
    tipo_instrumento    TEXT,
    grandeza            TEXT,
    faixa_indicacao     TEXT,
    resolucao           TEXT,
    exatidao            TEXT,
    classe_metrologica  TEXT,
    capacidade          TEXT,
    unidade             TEXT,
    tolerancia          TEXT,
    lacre               TEXT,
    departamento        TEXT,
    usuario_instrumento TEXT,
    procedimento        TEXT,
    instrucoes          TEXT,
    procedimento_verificacao TEXT,
    codigo_barras       TEXT,
    travado             INTEGER NOT NULL DEFAULT 0,
    localizacao         TEXT,
    mapa_x              REAL,
    mapa_y              REAL,
    setor               TEXT,
    data_aquisicao      TEXT,
    data_ultima_calibracao  TEXT,
    data_proxima_calibracao TEXT,
    data_ultima_checagem    TEXT,
    data_proxima_checagem   TEXT,
    periodicidade_calibracao_meses INTEGER DEFAULT 12,
    periodicidade_checagem_meses   INTEGER DEFAULT 6,
    status              TEXT    NOT NULL DEFAULT 'disponivel'
                            CHECK (status IN ('disponivel','em_uso','em_manutencao','fora_operacao','inativo')),
    observacoes         TEXT,
    valor_aquisicao     REAL,
    uuid                TEXT    NOT NULL UNIQUE,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_padroes_codigo    ON padroes(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_padroes_status    ON padroes(status);
CREATE INDEX IF NOT EXISTS idx_padroes_grandeza  ON padroes(grandeza);
CREATE INDEX IF NOT EXISTS idx_padroes_prox_cal  ON padroes(data_proxima_calibracao);
CREATE INDEX IF NOT EXISTS idx_padroes_prox_chk  ON padroes(data_proxima_checagem);
CREATE INDEX IF NOT EXISTS idx_padroes_uuid      ON padroes(uuid);
CREATE INDEX IF NOT EXISTS idx_padroes_excluido  ON padroes(excluido_em);

CREATE TABLE IF NOT EXISTS anexos (
    id              SERIAL PRIMARY KEY,
    entidade        TEXT    NOT NULL,
    entidade_id     INTEGER NOT NULL,
    tipo            TEXT    NOT NULL DEFAULT 'documento'
                        CHECK (tipo IN ('certificado','foto','documento','pdf')),
    nome_arquivo    TEXT    NOT NULL,
    nome_original   TEXT,
    mime            TEXT,
    tamanho_bytes   INTEGER,
    descricao       TEXT,
    criado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por      INTEGER,
    excluido_em     TEXT,
    excluido_por    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON anexos(entidade, entidade_id);

CREATE TABLE IF NOT EXISTS servicos (
    id                  SERIAL PRIMARY KEY,
    codigo              TEXT    UNIQUE,
    nome                TEXT    NOT NULL,
    descricao           TEXT,
    procedimento        TEXT,
    cliente_id          INTEGER REFERENCES clientes(id),
    cliente_nome        TEXT,
    tecnico_id          INTEGER REFERENCES usuarios(id),
    tecnico_nome        TEXT,
    data_inicio         TEXT,
    data_conclusao      TEXT,
    status              TEXT    NOT NULL DEFAULT 'planejado'
                            CHECK (status IN ('planejado','em_andamento','concluido','cancelado')),
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id                  SERIAL PRIMARY KEY,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    retirado_por        INTEGER REFERENCES usuarios(id),
    retirado_por_nome   TEXT,
    data_retirada       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    cliente_id          INTEGER REFERENCES clientes(id),
    cliente_nome        TEXT,
    servico_id          INTEGER REFERENCES servicos(id),
    motivo              TEXT,
    local_utilizacao    TEXT,
    devolvido_por       INTEGER REFERENCES usuarios(id),
    devolvido_por_nome  TEXT,
    data_devolucao      TEXT,
    condicao_devolucao  TEXT CHECK (condicao_devolucao IS NULL OR condicao_devolucao IN ('otima','boa','danificado','requer_calibracao')),
    observacoes_devolucao TEXT,
    status              TEXT    NOT NULL DEFAULT 'aberta'
                            CHECK (status IN ('aberta','fechada')),
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_mov_padrao  ON movimentacoes(padrao_id);
CREATE INDEX IF NOT EXISTS idx_mov_status  ON movimentacoes(status);
CREATE INDEX IF NOT EXISTS idx_mov_cliente ON movimentacoes(cliente_id);

CREATE TABLE IF NOT EXISTS calibracoes (
    id                  SERIAL PRIMARY KEY,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    data_calibracao     TEXT    NOT NULL,
    data_proxima        TEXT,
    numero_certificado  TEXT,
    laboratorio         TEXT,
    rastreabilidade     TEXT,
    resultado           TEXT CHECK (resultado IS NULL OR resultado IN ('aprovado','aprovado_com_ressalva','reprovado')),
    incerteza           TEXT,
    custo               REAL,
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_cal_padrao ON calibracoes(padrao_id);
CREATE INDEX IF NOT EXISTS idx_cal_data   ON calibracoes(data_calibracao);

CREATE TABLE IF NOT EXISTS checagens (
    id                  SERIAL PRIMARY KEY,
    padrao_id           INTEGER NOT NULL REFERENCES padroes(id),
    data_checagem       TEXT    NOT NULL,
    data_proxima        TEXT,
    metodo              TEXT,
    resultado           TEXT CHECK (resultado IS NULL OR resultado IN ('conforme','nao_conforme')),
    responsavel_id      INTEGER REFERENCES usuarios(id),
    responsavel_nome    TEXT,
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_chk_padrao ON checagens(padrao_id);

CREATE TABLE IF NOT EXISTS normas (
    id                  SERIAL PRIMARY KEY,
    codigo              TEXT    NOT NULL,
    nome                TEXT    NOT NULL,
    revisao             TEXT,
    data_emissao        TEXT,
    data_revisao        TEXT,
    area_aplicacao      TEXT,
    organismo           TEXT,
    status              TEXT    NOT NULL DEFAULT 'vigente'
                            CHECK (status IN ('vigente','revisada','cancelada')),
    arquivo_pdf         TEXT,
    observacoes         TEXT,
    criado_em           TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    atualizado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por          INTEGER,
    atualizado_por      INTEGER,
    excluido_em         TEXT,
    excluido_por        INTEGER,
    motivo_exclusao     TEXT
);
CREATE INDEX IF NOT EXISTS idx_normas_codigo ON normas(codigo);

CREATE TABLE IF NOT EXISTS norma_revisoes (
    id              SERIAL PRIMARY KEY,
    norma_id        INTEGER NOT NULL REFERENCES normas(id),
    revisao         TEXT,
    data_revisao    TEXT,
    descricao       TEXT,
    arquivo_pdf     TEXT,
    criado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
    criado_por      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_norma_rev ON norma_revisoes(norma_id);

CREATE TABLE IF NOT EXISTS servico_padroes (
    servico_id  INTEGER NOT NULL REFERENCES servicos(id),
    padrao_id   INTEGER NOT NULL REFERENCES padroes(id),
    PRIMARY KEY (servico_id, padrao_id)
);

CREATE TABLE IF NOT EXISTS servico_normas (
    servico_id  INTEGER NOT NULL REFERENCES servicos(id),
    norma_id    INTEGER NOT NULL REFERENCES normas(id),
    PRIMARY KEY (servico_id, norma_id)
);

CREATE TABLE IF NOT EXISTS auditoria (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER,
    usuario_nome    TEXT,
    acao            TEXT    NOT NULL,
    entidade        TEXT,
    entidade_id     INTEGER,
    descricao       TEXT,
    dados_antes     TEXT,
    dados_depois    TEXT,
    ip              TEXT,
    user_agent      TEXT,
    criado_em       TEXT    NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_audit_usuario  ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON auditoria(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_data     ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_acao     ON auditoria(acao);

CREATE TABLE IF NOT EXISTS configuracoes (
    chave           TEXT PRIMARY KEY,
    valor           TEXT,
    descricao       TEXT,
    atualizado_em   TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
);
