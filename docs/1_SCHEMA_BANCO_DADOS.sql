-- ============================================================================
-- ARQUITETURA DE BANCO DE DADOS COMPLETA (POSTGRESQL / SUPABASE)
-- SISTEMA ERP SAAS MULTI-TENANT INDUSTRIAL (ENGQUADROS / CALLINFO)
-- ============================================================================
-- Versão: 2.8.0 - Segurança alta em docs/2_SEGURANCA_ALTA.sql (RLS tenant + RPCs + Storage PDF)
-- Base já existente: rode docs/4_ALINHAR_CADASTROS.sql (ADD COLUMN IF NOT EXISTS + reload PostgREST)
-- Compatibilidade: PostgreSQL 14+, Supabase Cloud / Self-Hosted
-- ============================================================================
-- ⚠️ IMPORTANTE: Após aplicar este schema, gire a chave anon do Supabase
-- e configure autenticação real (JWT) para evitar acesso não autorizado.
-- ============================================================================

-- 1. EXTENSÕES DO POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABELAS ESTRUTURAIS DO SAAS (TENANCY & ADMINISTRAÇÃO MASTER)
-- ============================================================================

-- Tabela de Empresas (Tenants / Instâncias SaaS)
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado', 'demonstracao')),
    dia_acerto INT NOT NULL DEFAULT 10 CHECK (dia_acerto BETWEEN 1 AND 31),
    valor_mensalidade NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    logo_url TEXT,
    configuracoes_gerais JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Administradores Master de Cada Tenant (Whitelabel)
CREATE TABLE IF NOT EXISTS public.admin_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome_fantasia VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    logo_url TEXT,
    cor_primaria VARCHAR(10) DEFAULT '#0b1c35',
    cor_secundaria VARCHAR(10) DEFAULT '#2b5c92',
    telefone VARCHAR(30),
    whatsapp VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Usuários e Equipe Interna (Engenheiros, Operadores, PCP, Vendedores)
-- Login canônico: usuario_login (usado pelo JS e pela RPC login_equipe).
-- NÃO usar coluna `usuario` — ela não existe no banco ao vivo.
CREATE TABLE IF NOT EXISTS public.equipe_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    usuario_login VARCHAR(80) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    cargo VARCHAR(80) DEFAULT 'Colaborador',
    permissoes JSONB NOT NULL DEFAULT '{"clientes": true, "obras": true, "arquivos": true, "tickets": true, "vendas": false, "compras": false, "financeiro": false, "relatorios": false, "orcamentos": false, "propostas": false, "orcamento_custos": false, "orcamento_pcp": false, "auth_prazo": false, "auth_margem": false}'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(80);

-- ============================================================================
-- 3. MÓDULO DE CLIENTES & PORTAL DO CLIENTE (PORTAL EXTERNO)
-- ============================================================================

-- Tabela de Clientes dos Tenants
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(20) NOT NULL,
    cpf_cnpj VARCHAR(20), -- Alias usado pelo admin.html (mesmo valor de cnpj)
    inscricao_estadual VARCHAR(30),
    chave_acesso VARCHAR(100) NOT NULL,
    chave_mestre VARCHAR(100), -- Alias usado pelo login.html (sinônimo de chave_acesso)
    email VARCHAR(150),
    telefone VARCHAR(30),
    whatsapp VARCHAR(30),
    nome_contato VARCHAR(120),
    responsavel VARCHAR(120),
    cargo_responsavel VARCHAR(80),
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
    tipo_pessoa VARCHAR(1) DEFAULT 'J',
    is_cliente BOOLEAN DEFAULT TRUE,
    is_fornecedor BOOLEAN DEFAULT FALSE,
    is_vendedor BOOLEAN DEFAULT FALSE,
    is_transportadora BOOLEAN DEFAULT FALSE,
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    endereco VARCHAR(255), -- Alias usado pelo admin.html (mesmo valor de logradouro)
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. MÓDULO FISCAL DESACOPLADO & REFORMA TRIBUTÁRIA (IBS/CBS)
-- ============================================================================

-- 4.1 Tributação Estadual (ICMS / ST / FCP)
CREATE TABLE IF NOT EXISTS public.tributacao_estadual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome_regra VARCHAR(120) NOT NULL,
    uf_origem VARCHAR(2) NOT NULL DEFAULT 'RJ',
    uf_destino VARCHAR(2) NOT NULL DEFAULT 'RJ',
    cst_csosn VARCHAR(4) NOT NULL,
    aliquota_icms NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    reducao_base_calculo NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    aliquota_fcp NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    mva_st NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    observacoes_fiscais TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.2 Tributação Federal (PIS / COFINS / IPI)
CREATE TABLE IF NOT EXISTS public.tributacao_federal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome_regra VARCHAR(120) NOT NULL,
    cst_pis VARCHAR(3) NOT NULL DEFAULT '01',
    aliquota_pis NUMERIC(5,2) NOT NULL DEFAULT 1.65,
    cst_cofins VARCHAR(3) NOT NULL DEFAULT '01',
    aliquota_cofins NUMERIC(5,2) NOT NULL DEFAULT 7.60,
    cst_ipi VARCHAR(3) NULL DEFAULT '50',
    aliquota_ipi NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    enquadramento_ipi VARCHAR(3) DEFAULT '999',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.3 Tributação Reforma Tributária (IBS Estadual/Municipal + CBS Federal - EC 132/2023)
CREATE TABLE IF NOT EXISTS public.tributacao_ibs_cbs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome_regra VARCHAR(120) NOT NULL,
    isento_reforma BOOLEAN NOT NULL DEFAULT FALSE,
    aliquota_cbs NUMERIC(5,2) NOT NULL DEFAULT 8.80,
    aliquota_ibs NUMERIC(5,2) NOT NULL DEFAULT 17.70,
    reducao_base_ibs_cbs NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    regime_diferenciado VARCHAR(50) DEFAULT 'Padrao',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 5. MÓDULO DE PRODUTOS, COMPONENTES E ENGENHARIA ELÉTRICA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) DEFAULT 'Painel',
    sku VARCHAR(60),
    ean_gtin VARCHAR(20),
    gtin_tributavel VARCHAR(20),
    unidade VARCHAR(10) DEFAULT 'UN',
    unidade_tributavel VARCHAR(10) DEFAULT 'UN',
    fator_conversao NUMERIC(12,6) DEFAULT 1,
    marca VARCHAR(80),
    fabricante VARCHAR(120),
    fabricante_id UUID,
    grupo_produto_id UUID,
    marca_id UUID,
    modelo VARCHAR(80),
    ativo BOOLEAN DEFAULT TRUE,
    imagem_url TEXT,
    preco_custo NUMERIC(12,2) DEFAULT 0.00,
    margem_lucro NUMERIC(8,2) DEFAULT 0.00,
    preco_venda NUMERIC(12,2) DEFAULT 0.00,
    estoque_atual NUMERIC(14,3) DEFAULT 0,
    estoque_minimo NUMERIC(14,3) DEFAULT 0,
    peso_liquido NUMERIC(12,4),
    peso_bruto NUMERIC(12,4),
    ncm VARCHAR(10),
    cfop VARCHAR(4) DEFAULT '5101',
    cfop_padrao VARCHAR(4) DEFAULT '5101',
    cest VARCHAR(10),
    origem_icms VARCHAR(2) DEFAULT '0',
    ex_tipi VARCHAR(3),
    codigo_beneficio_fiscal VARCHAR(20),
    informacoes_adicionais_nfe TEXT,
    cclass_trib VARCHAR(10),
    id_tributacao_estadual UUID REFERENCES public.tributacao_estadual(id) ON DELETE SET NULL,
    id_tributacao_federal UUID REFERENCES public.tributacao_federal(id) ON DELETE SET NULL,
    id_tributacao_ibs_cbs UUID REFERENCES public.tributacao_ibs_cbs(id) ON DELETE SET NULL,
    dados_tecnicos JSONB DEFAULT '{}'::jsonb,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.produto_fabricantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.produto_grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.produto_marcas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    fabricante_id UUID REFERENCES public.produto_fabricantes(id) ON DELETE SET NULL,
    nome VARCHAR(120) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 6. MÓDULO PCP (CHÃO DE FÁBRICA, PROJETOS E PRODUÇÃO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    cliente_cnpj VARCHAR(20), -- Campo usado diretamente pelo JS no portal do cliente
    nome_obra VARCHAR(200) NOT NULL,
    codigo_orcamento VARCHAR(50), -- Usado pelo dashboard como número do orçamento
    numero_orcamento VARCHAR(50),
    valor_total NUMERIC(12,2) DEFAULT 0.00,
    data_inicio DATE DEFAULT CURRENT_DATE,
    data_fim DATE, -- Previsão/realização de entrega (usado pelo JS)
    previsao_entrega DATE,
    data_conclusao DATE,
    progresso INT DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100), -- Percentual de conclusão (usado pelo JS)
    etapa_pcp_id UUID REFERENCES public.etapas_pcp(id) ON DELETE SET NULL, -- Etapa atual no kanban
    etapa_atual VARCHAR(50) DEFAULT 'engenharia', -- Nome da etapa atual (engenharia, mecanica, barramento, etc.)
    status_kanban VARCHAR(50) DEFAULT 'aguardando_engenharia',
    status_projeto VARCHAR(50) DEFAULT 'novo' CHECK (status_projeto IN ('novo', 'engenharia', 'em_execucao', 'concluido')),
    dados_checklist JSONB DEFAULT '{}'::jsonb,
    checklist_dados JSONB DEFAULT '{}'::jsonb,
    checklist_etapas JSONB DEFAULT '[]'::jsonb,
    historico_timeline JSONB DEFAULT '[]'::jsonb,
    especificacoes_tecnicas JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 6.1 ETAPAS DO PCP (NOVA TABELA - referenciada pelo kanban)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.etapas_pcp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL, -- Ex: "Engenharia", "Mecânica", "Barramento"
    titulo VARCHAR(100),
    ordem_exibicao INT DEFAULT 0,
    cor VARCHAR(20) DEFAULT '#2b5c92',
    status_macro_id UUID,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 7. ACERVO DE ARQUIVOS TÉCNICOS & PROJETOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.arquivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    cliente_cnpj VARCHAR(20), -- Campo usado diretamente pelo JS no portal do cliente
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    nome_documento VARCHAR(255) NOT NULL, -- Campo usado pelo JS (vs nome_arquivo)
    nome_arquivo VARCHAR(255),
    caminho_arquivo TEXT NOT NULL, -- URL do arquivo (usado pelo JS)
    url_arquivo TEXT, -- Alias para caminho_arquivo
    tipo VARCHAR(50) DEFAULT 'documento',
    tamanho VARCHAR(30),
    descricao TEXT,
    observacao TEXT,
    status_aprovacao VARCHAR(20) DEFAULT 'pendente' CHECK (status_aprovacao IN ('pendente', 'aprovado', 'reprovado')),
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 8. MÓDULO DE ATENDIMENTO & SUPORTE (SAC / HELPDESK CLIENTE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chamados_suporte (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    cliente_cnpj VARCHAR(20), -- Campo usado diretamente pelo JS
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    titulo VARCHAR(200),
    assunto VARCHAR(200) NOT NULL, -- Campo usado pelo JS
    descricao TEXT,
    mensagem TEXT NOT NULL, -- Campo usado pelo JS
    prioridade VARCHAR(20) DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
    status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'respondido', 'concluido', 'fechado')),
    resposta_equipe TEXT,
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_resposta TIMESTAMP WITH TIME ZONE,
    historico_mensagens JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 9. ÍNDICES DE PERFORMANCE (OTIMIZAÇÃO DE CONSULTAS E MULTI-TENANT)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON public.empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_admin_master_empresa ON public.admin_master(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_admin_empresa ON public.equipe_admin(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_chave ON public.clientes(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_clientes_chave_mestre ON public.clientes(chave_mestre);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON public.produtos(ncm);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_estadual ON public.produtos(id_tributacao_estadual);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_federal ON public.produtos(id_tributacao_federal);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_ibs_cbs ON public.produtos(id_tributacao_ibs_cbs);
CREATE INDEX IF NOT EXISTS idx_obras_empresa ON public.obras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_cliente ON public.obras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_obras_cliente_cnpj ON public.obras(cliente_cnpj);
CREATE INDEX IF NOT EXISTS idx_obras_status ON public.obras(status_kanban);
CREATE INDEX IF NOT EXISTS idx_obras_progresso ON public.obras(progresso);
CREATE INDEX IF NOT EXISTS idx_obras_etapa ON public.obras(etapa_pcp_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_empresa ON public.arquivos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_cliente ON public.arquivos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_cliente_cnpj ON public.arquivos(cliente_cnpj);
CREATE INDEX IF NOT EXISTS idx_arquivos_obra ON public.arquivos(obra_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_status_aprovação ON public.arquivos(status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_chamados_empresa ON public.chamados_suporte(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chamados_cliente ON public.chamados_suporte(cliente_id);
CREATE INDEX IF NOT EXISTS idx_chamados_cliente_cnpj ON public.chamados_suporte(cliente_cnpj);
CREATE INDEX IF NOT EXISTS idx_etapas_empresa ON public.etapas_pcp(empresa_id);

-- ============================================================================
-- 10. DADOS INICIAIS (SEEDS PADRÃO)
-- ============================================================================

-- Inserção de Regras Fiscais Padrão (Globais / Exemplo)
INSERT INTO public.tributacao_estadual (nome_regra, uf_origem, uf_destino, cst_csosn, aliquota_icms, reducao_base_calculo, aliquota_fcp, mva_st)
SELECT 'ICMS 18% Interno RJ/SP Padrão', 'RJ', 'RJ', '00', 18.00, 0.00, 2.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.tributacao_estadual WHERE nome_regra = 'ICMS 18% Interno RJ/SP Padrão');

INSERT INTO public.tributacao_estadual (nome_regra, uf_origem, uf_destino, cst_csosn, aliquota_icms, reducao_base_calculo, aliquota_fcp, mva_st)
SELECT 'ICMS 12% Interestadual (Sul/Sudeste para N/NE/CO)', 'RJ', 'BA', '00', 12.00, 0.00, 0.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.tributacao_estadual WHERE nome_regra = 'ICMS 12% Interestadual (Sul/Sudeste para N/NE/CO)');

INSERT INTO public.tributacao_federal (nome_regra, cst_pis, aliquota_pis, cst_cofins, aliquota_cofins, cst_ipi, aliquota_ipi)
SELECT 'Lucro Real Padrão (PIS 1.65% / COFINS 7.6% / IPI 5%)', '01', 1.65, '01', 7.60, '50', 5.00
WHERE NOT EXISTS (SELECT 1 FROM public.tributacao_federal WHERE nome_regra = 'Lucro Real Padrão (PIS 1.65% / COFINS 7.6% / IPI 5%)');

INSERT INTO public.tributacao_federal (nome_regra, cst_pis, aliquota_pis, cst_cofins, aliquota_cofins, cst_ipi, aliquota_ipi)
SELECT 'Alíquota Zero / Monofásico', '06', 0.00, '06', 0.00, '53', 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.tributacao_federal WHERE nome_regra = 'Alíquota Zero / Monofásico');

INSERT INTO public.tributacao_ibs_cbs (nome_regra, isento_reforma, aliquota_cbs, aliquota_ibs, reducao_base_ibs_cbs, regime_diferenciado)
SELECT 'Alíquota Padrão Reforma 2026-2033 (CBS 8.8% / IBS 17.7%)', FALSE, 8.80, 17.70, 0.00, 'Padrao'
WHERE NOT EXISTS (SELECT 1 FROM public.tributacao_ibs_cbs WHERE nome_regra = 'Alíquota Padrão Reforma 2026-2033 (CBS 8.8% / IBS 17.7%)');

-- Etapas padrão do PCP (se não existirem)
INSERT INTO public.etapas_pcp (empresa_id, nome, titulo, ordem_exibicao, cor)
SELECT id, 'engenharia', 'Engenharia & Projetos', 1, '#64748b' FROM public.empresas
WHERE NOT EXISTS (SELECT 1 FROM public.etapas_pcp WHERE nome = 'engenharia');

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas_pcp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tributacao_estadual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tributacao_federal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tributacao_ibs_cbs ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes (acesso aos seus próprios dados)
CREATE POLICY "Clientes leem próprios dados" ON public.clientes FOR SELECT USING (true);
-- Cadastro público desativado no login.html. INSERT permanece aberto para o painel admin
-- (mesma chave anon). Quando houver Auth/JWT, restrinja este INSERT ao papel autenticado.
CREATE POLICY "Clientes inserem próprios dados" ON public.clientes FOR INSERT WITH CHECK (true);

-- Políticas para obras (cliente acessa via cliente_cnpj)
CREATE POLICY "Obras: cliente le seus projetos" ON public.obras FOR SELECT USING (
    cliente_cnpj = current_setting('request.headers.x-cnpj', true)
    OR EXISTS (SELECT 1 FROM public.clientes WHERE id = obras.cliente_id AND cnpj = current_setting('request.headers.x-cnpj', true))
);
CREATE POLICY "Obras: cliente insere seus projetos" ON public.obras FOR INSERT WITH CHECK (true);

-- Políticas para arquivos
CREATE POLICY "Arquivos: cliente le seus arquivos" ON public.arquivos FOR SELECT USING (
    cliente_cnpj = current_setting('request.headers.x-cnpj', true)
    OR cliente_id IN (SELECT id FROM public.clientes WHERE cnpj = current_setting('request.headers.x-cnpj', true))
);
CREATE POLICY "Arquivos: cliente insere arquivos" ON public.arquivos FOR INSERT WITH CHECK (true);
CREATE POLICY "Arquivos: cliente atualiza aprovação" ON public.arquivos FOR UPDATE USING (
    cliente_cnpj = current_setting('request.headers.x-cnpj', true)
);

-- Políticas para chamados de suporte
CREATE POLICY "Chamados: cliente le seus chamados" ON public.chamados_suporte FOR SELECT USING (
    cliente_cnpj = current_setting('request.headers.x-cnpj', true)
);
CREATE POLICY "Chamados: cliente insere chamados" ON public.chamados_suporte FOR INSERT WITH CHECK (true);
CREATE POLICY "Chamados: cliente atualiza seus chamados" ON public.chamados_suporte FOR UPDATE USING (
    cliente_cnpj = current_setting('request.headers.x-cnpj', true)
);

-- Políticas para etapas PCP
CREATE POLICY "Etapas: le por empresa" ON public.etapas_pcp FOR SELECT USING (true);
CREATE POLICY "Etapas: empresa insere" ON public.etapas_pcp FOR INSERT WITH CHECK (true);

-- Política universal para empresas (todas as operações)
CREATE POLICY "Empresas: acesso total" ON public.empresas FOR ALL USING (true);

-- Política para admin_master
CREATE POLICY "Admin master: acesso total" ON public.admin_master FOR ALL USING (true);

-- Política para equipe admin
CREATE POLICY "Equipe admin: acesso total" ON public.equipe_admin FOR ALL USING (true);

-- Política para produtos
CREATE POLICY "Produtos: acesso total" ON public.produtos FOR ALL USING (true);

-- Política para tributações
CREATE POLICY "Tributacoes: acesso total" ON public.tributacao_estadual FOR ALL USING (true);
CREATE POLICY "Tributacoes Federais: acesso total" ON public.tributacao_federal FOR ALL USING (true);
CREATE POLICY "Tributacoes IBS/CBS: acesso total" ON public.tributacao_ibs_cbs FOR ALL USING (true);

-- ============================================================================
-- 12. FUNÇÕES AUXILIARES E TRIGGERS
-- ============================================================================

-- Função para obter CNPJ do cliente da request (usada pelas políticas RLS)
CREATE OR REPLACE FUNCTION public.get_cliente_cnpj()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.headers.x-cnpj', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar campo de atualização
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_master_updated_at BEFORE UPDATE ON public.admin_master
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_obras_updated_at BEFORE UPDATE ON public.obras
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_arquivos_updated_at BEFORE UPDATE ON public.arquivos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chamados_updated_at BEFORE UPDATE ON public.chamados_suporte
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para sync automático de cliente_cnpj
CREATE OR REPLACE FUNCTION public.sync_cliente_cnpj()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cliente_id IS NOT NULL AND NEW.cliente_cnpj IS NULL THEN
        SELECT c.cnpj INTO NEW.cliente_cnpj FROM public.clientes c WHERE c.id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obras_sync_cnpj BEFORE INSERT OR UPDATE ON public.obras
    FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_cnpj();

CREATE TRIGGER trg_arquivos_sync_cnpj BEFORE INSERT OR UPDATE ON public.arquivos
    FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_cnpj();

CREATE TRIGGER trg_chamados_sync_cnpj BEFORE INSERT OR UPDATE ON public.chamados_suporte
    FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_cnpj();

-- ============================================================================
-- 13. BUCKET DE STORAGE DO SUPABASE
-- ============================================================================

-- Para habilitar o bucket de arquivos no Storage do Supabase:
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs_clientes', 'pdfs_clientes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para upload e download
CREATE POLICY "Permissao Total Leitura Storage" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Escrita Storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Atualizacao Storage" ON storage.objects FOR UPDATE USING (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Exclusao Storage" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs_clientes');