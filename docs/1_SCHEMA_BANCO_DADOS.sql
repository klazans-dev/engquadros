-- ============================================================================
-- ARQUITETURA DE BANCO DE DADOS COMPLETA (POSTGRESQL / SUPABASE)
-- SISTEMA ERP SAAS MULTI-TENANT INDUSTRIAL (ENGQUADROS / CALLINFO)
-- ============================================================================
-- Versão: 2.5.0 - Reforma Tributária & Gestão PCP Multi-Empresa
-- Compatibilidade: PostgreSQL 14+, Supabase Cloud / Self-Hosted
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Usuários e Equipe Interna (Engenheiros, Operadores, PCP, Vendedores)
CREATE TABLE IF NOT EXISTS public.equipe_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    usuario VARCHAR(80) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    cargo VARCHAR(80) DEFAULT 'Colaborador',
    permissoes JSONB NOT NULL DEFAULT '{"clientes": true, "obras": true, "arquivos": true, "tickets": true, "vendas": false, "compras": false, "financeiro": false, "relatorios": false}'::jsonb,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
    inscricao_estadual VARCHAR(30),
    chave_acesso VARCHAR(100) NOT NULL, -- Senha/Chave de acesso do portal cliente
    email VARCHAR(150),
    telefone VARCHAR(30),
    responsavel VARCHAR(120),
    cargo_responsavel VARCHAR(80),
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
    cep VARCHAR(10),
    logradouro VARCHAR(255),
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
    tipo VARCHAR(50) DEFAULT 'Painel',
    sku VARCHAR(60),
    ean_gtin VARCHAR(20),
    unidade VARCHAR(10) DEFAULT 'UN',
    preco_custo NUMERIC(12,2) DEFAULT 0.00,
    margem_lucro NUMERIC(6,2) DEFAULT 0.00,
    preco_venda NUMERIC(12,2) DEFAULT 0.00,
    
    -- Dados Fiscais de Apoio
    ncm VARCHAR(10),
    cfop VARCHAR(4) DEFAULT '5101',
    cfop_padrao VARCHAR(4) DEFAULT '5101',
    cest VARCHAR(10),
    origem_icms VARCHAR(2) DEFAULT '0',
    
    -- Vínculo com os Grupos Tributários (Foreign Keys)
    id_tributacao_estadual UUID REFERENCES public.tributacao_estadual(id) ON DELETE SET NULL,
    id_tributacao_federal UUID REFERENCES public.tributacao_federal(id) ON DELETE SET NULL,
    id_tributacao_ibs_cbs UUID REFERENCES public.tributacao_ibs_cbs(id) ON DELETE SET NULL,
    
    -- Especificações Técnicas de Engenharia e Imagem
    dados_tecnicos JSONB DEFAULT '{}'::jsonb, -- { tensao, corrente_maxima, potencia, imagem_url }
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 6. MÓDULO PCP (CHÃO DE FÁBRICA, PROJETOS E PRODUÇÃO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nome_obra VARCHAR(200) NOT NULL,
    numero_orcamento VARCHAR(50),
    valor_total NUMERIC(12,2) DEFAULT 0.00,
    data_inicio DATE DEFAULT CURRENT_DATE,
    previsao_entrega DATE,
    data_conclusao DATE,
    
    -- Controle de Etapas Kanban do PCP
    status_kanban VARCHAR(50) DEFAULT 'aguardando_engenharia',
    porcentagem_conclusao INT DEFAULT 0 CHECK (porcentagem_conclusao BETWEEN 0 AND 100),
    
    -- Checklists Industriais e Timeline
    checklist_etapas JSONB DEFAULT '[]'::jsonb,
    historico_timeline JSONB DEFAULT '[]'::jsonb,
    especificacoes_tecnicas JSONB DEFAULT '{}'::jsonb,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 7. ACERVO DE ARQUIVOS TÉCNICOS & PROJETOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.arquivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    url_arquivo TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'documento', -- pdf, imagem, dwg, memorial, laudo
    tamanho VARCHAR(30),
    descricao TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 8. MÓDULO DE ATENDIMENTO & SUPORTE (SAC / HELPDESK CLIENTE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chamados_suporte (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    prioridade VARCHAR(20) DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
    status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'respondido', 'concluido', 'fechado')),
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
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON public.produtos(ncm);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_estadual ON public.produtos(id_tributacao_estadual);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_federal ON public.produtos(id_tributacao_federal);
CREATE INDEX IF NOT EXISTS idx_produtos_fk_ibs_cbs ON public.produtos(id_tributacao_ibs_cbs);
CREATE INDEX IF NOT EXISTS idx_obras_empresa ON public.obras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_cliente ON public.obras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_obras_status ON public.obras(status_kanban);
CREATE INDEX IF NOT EXISTS idx_arquivos_empresa ON public.arquivos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_cliente ON public.arquivos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_obra ON public.arquivos(obra_id);
CREATE INDEX IF NOT EXISTS idx_chamados_empresa ON public.chamados_suporte(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chamados_cliente ON public.chamados_suporte(cliente_id);

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

-- ============================================================================
-- 11. POLÍTICAS DE SEGURANÇA E STORAGE DO SUPABASE
-- ============================================================================

-- Para habilitar o bucket de arquivos no Storage do Supabase:
-- Inserir bucket 'pdfs_clientes' com acesso público de leitura
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs_clientes', 'pdfs_clientes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para upload e download livre via anon/service_role
CREATE POLICY "Permissao Total Leitura Storage" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Escrita Storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Atualizacao Storage" ON storage.objects FOR UPDATE USING (bucket_id = 'pdfs_clientes');
CREATE POLICY "Permissao Total Exclusao Storage" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs_clientes');
