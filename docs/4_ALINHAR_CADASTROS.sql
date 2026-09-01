-- ============================================================================
-- 4_ALINHAR_CADASTROS.sql  (idempotente — rode no SQL Editor do Supabase)
-- Completa o banco ao vivo com TODOS os campos de um cadastro real.
-- O CREATE TABLE IF NOT EXISTS não altera tabela antiga: por isso cada
-- coluna também entra com ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--
-- Cobre o erro: Could not find the 'ean_gtin' column of 'produtos' in the
-- schema cache — e o mesmo tipo de falha em cliente, fiscal, obra, equipe.
--
-- NÃO cria coluna `usuario` (equipe usa usuario_login).
-- NÃO cria coluna `cliente_id` em obras/arquivos/chamados (app usa cliente_cnpj).
--
-- Depois de rodar: Ctrl+F5 no admin e grave o produto de novo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Tabelas fiscais (regras que o produto vincula)
-- ---------------------------------------------------------------------------
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

ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS nome_regra VARCHAR(120);
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS uf_origem VARCHAR(2) DEFAULT 'RJ';
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS uf_destino VARCHAR(2) DEFAULT 'RJ';
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS cst_csosn VARCHAR(4);
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS reducao_base_calculo NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS aliquota_fcp NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS mva_st NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS observacoes_fiscais TEXT;
ALTER TABLE public.tributacao_estadual ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.tributacao_federal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome_regra VARCHAR(120) NOT NULL,
    cst_pis VARCHAR(3) NOT NULL DEFAULT '01',
    aliquota_pis NUMERIC(5,2) NOT NULL DEFAULT 1.65,
    cst_cofins VARCHAR(3) NOT NULL DEFAULT '01',
    aliquota_cofins NUMERIC(5,2) NOT NULL DEFAULT 7.60,
    cst_ipi VARCHAR(3) DEFAULT '50',
    aliquota_ipi NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    enquadramento_ipi VARCHAR(3) DEFAULT '999',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS nome_regra VARCHAR(120);
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS cst_pis VARCHAR(3) DEFAULT '01';
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC(5,2) DEFAULT 1.65;
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS cst_cofins VARCHAR(3) DEFAULT '01';
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC(5,2) DEFAULT 7.60;
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS cst_ipi VARCHAR(3) DEFAULT '50';
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS enquadramento_ipi VARCHAR(3) DEFAULT '999';
ALTER TABLE public.tributacao_federal ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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

ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS nome_regra VARCHAR(120);
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS isento_reforma BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS aliquota_cbs NUMERIC(5,2) DEFAULT 8.80;
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS aliquota_ibs NUMERIC(5,2) DEFAULT 17.70;
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS reducao_base_ibs_cbs NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS regime_diferenciado VARCHAR(50) DEFAULT 'Padrao';
ALTER TABLE public.tributacao_ibs_cbs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- 2. Produtos — identidade, preço, fiscal NF-e, reforma, engenharia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Identidade comercial (formulário aba 1)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS nome VARCHAR(200);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'Painel';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ean_gtin VARCHAR(20);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS gtin_tributavel VARCHAR(20);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS unidade VARCHAR(10) DEFAULT 'UN';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS unidade_tributavel VARCHAR(10) DEFAULT 'UN';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fator_conversao NUMERIC(12,6) DEFAULT 1;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(80);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS modelo VARCHAR(80);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Precificação
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS margem_lucro NUMERIC(8,2) DEFAULT 0.00;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_atual NUMERIC(14,3) DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_minimo NUMERIC(14,3) DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS peso_liquido NUMERIC(12,4);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS peso_bruto NUMERIC(12,4);

-- Fiscal NF-e / SPED (formulário aba 2 + edição completa)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ncm VARCHAR(10);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cest VARCHAR(10);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cfop VARCHAR(4) DEFAULT '5101';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cfop_padrao VARCHAR(4) DEFAULT '5101';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS origem_icms VARCHAR(2) DEFAULT '0';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ex_tipi VARCHAR(3);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo_beneficio_fiscal VARCHAR(20);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS informacoes_adicionais_nfe TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS id_tributacao_estadual UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS id_tributacao_federal UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS id_tributacao_ibs_cbs UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cclass_trib VARCHAR(10);

-- Engenharia elétrica (também gravada em dados_tecnicos JSON)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS dados_tecnicos JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

UPDATE public.produtos SET cfop_padrao = cfop WHERE cfop_padrao IS NULL AND cfop IS NOT NULL;
UPDATE public.produtos SET cfop = cfop_padrao WHERE cfop IS NULL AND cfop_padrao IS NOT NULL;
UPDATE public.produtos SET gtin_tributavel = ean_gtin WHERE gtin_tributavel IS NULL AND ean_gtin IS NOT NULL;
UPDATE public.produtos SET dados_tecnicos = '{}'::jsonb WHERE dados_tecnicos IS NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON public.produtos(empresa_id, sku);
CREATE INDEX IF NOT EXISTS idx_produtos_ean ON public.produtos(ean_gtin);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON public.produtos(ncm);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_id_tributacao_estadual_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_id_tributacao_estadual_fkey
      FOREIGN KEY (id_tributacao_estadual) REFERENCES public.tributacao_estadual(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_id_tributacao_federal_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_id_tributacao_federal_fkey
      FOREIGN KEY (id_tributacao_federal) REFERENCES public.tributacao_federal(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_id_tributacao_ibs_cbs_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_id_tributacao_ibs_cbs_fkey
      FOREIGN KEY (id_tributacao_ibs_cbs) REFERENCES public.tributacao_ibs_cbs(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Clientes — o formulário grava cpf_cnpj, endereco, papéis e chave_mestre
-- ---------------------------------------------------------------------------
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS chave_acesso VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS chave_mestre VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_contato VARCHAR(120);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS responsavel VARCHAR(120);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cargo_responsavel VARCHAR(80);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ativo';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(1) DEFAULT 'J';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_cliente BOOLEAN DEFAULT TRUE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_fornecedor BOOLEAN DEFAULT FALSE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_vendedor BOOLEAN DEFAULT FALSE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_transportadora BOOLEAN DEFAULT FALSE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep VARCHAR(10);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS endereco VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

UPDATE public.clientes SET cpf_cnpj = cnpj WHERE cpf_cnpj IS NULL AND cnpj IS NOT NULL;
UPDATE public.clientes SET cnpj = cpf_cnpj WHERE cnpj IS NULL AND cpf_cnpj IS NOT NULL;
UPDATE public.clientes SET endereco = logradouro WHERE endereco IS NULL AND logradouro IS NOT NULL;
UPDATE public.clientes SET logradouro = endereco WHERE logradouro IS NULL AND endereco IS NOT NULL;
UPDATE public.clientes SET chave_acesso = chave_mestre WHERE chave_acesso IS NULL AND chave_mestre IS NOT NULL;
UPDATE public.clientes SET chave_mestre = chave_acesso WHERE chave_mestre IS NULL AND chave_acesso IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Admin master / equipe (campos que o painel grava)
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(150);
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(30);
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(10) DEFAULT '#0b1c35';
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(10) DEFAULT '#2b5c92';
ALTER TABLE public.admin_master ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);

ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(80);
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS nome VARCHAR(150);
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS senha VARCHAR(255);
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS cargo VARCHAR(80) DEFAULT 'Colaborador';
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
-- Chaves usadas pelo app: clientes, obras, arquivos, tickets, vendas, compras, financeiro, relatorios,
-- orcamentos, propostas, orcamento_custos, orcamento_pcp, auth_prazo, auth_margem.
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);

CREATE TABLE IF NOT EXISTS public.vinculo_equipe_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    equipe_id UUID NOT NULL REFERENCES public.equipe_admin(id) ON DELETE CASCADE,
    cliente_cnpj VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.vinculo_equipe_cliente ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.vinculo_equipe_cliente ADD COLUMN IF NOT EXISTS equipe_id UUID;
ALTER TABLE public.vinculo_equipe_cliente ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);

-- ---------------------------------------------------------------------------
-- 5. Obras / PCP — o JS grava estes nomes (não cliente_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS nome_obra VARCHAR(200);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS codigo_orcamento VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS numero_orcamento VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS valor_total NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS data_fim DATE;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS previsao_entrega DATE;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS progresso INT DEFAULT 0;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS etapa_pcp_id UUID;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS etapa_atual VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS status_kanban VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS status_projeto VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS dados_checklist JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS checklist_dados JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS checklist_etapas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS historico_timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS especificacoes_tecnicas JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.status_pcp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cor VARCHAR(20) DEFAULT '#10b981',
    ordem_exibicao INT DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.status_pcp ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.status_pcp ADD COLUMN IF NOT EXISTS nome VARCHAR(100);
ALTER TABLE public.status_pcp ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#10b981';
ALTER TABLE public.status_pcp ADD COLUMN IF NOT EXISTS ordem_exibicao INT DEFAULT 0;
ALTER TABLE public.status_pcp ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS nome VARCHAR(100);
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS titulo VARCHAR(100);
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS ordem_exibicao INT DEFAULT 0;
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#2b5c92';
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.etapas_pcp ADD COLUMN IF NOT EXISTS status_macro_id UUID;

CREATE TABLE IF NOT EXISTS public.processos_padrao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    categoria_id VARCHAR(80),
    nome VARCHAR(150) NOT NULL,
    icone VARCHAR(80),
    ordem_exibicao INT DEFAULT 0,
    itens JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS categoria_id VARCHAR(80);
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS nome VARCHAR(150);
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS icone VARCHAR(80);
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS ordem_exibicao INT DEFAULT 0;
ALTER TABLE public.processos_padrao ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS nome_documento VARCHAR(255);
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255);
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS caminho_arquivo TEXT;
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS url_arquivo TEXT;
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS obra_id UUID;

ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);
ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS assunto VARCHAR(200);
ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS mensagem TEXT;
ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS resposta_equipe TEXT;
ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS data_resposta TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- 6. Regras fiscais padrão (só insere se ainda não existirem)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7. Permissões API + recarrega o cache do PostgREST (obrigatório)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tributacao_estadual TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tributacao_federal TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tributacao_ibs_cbs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etapas_pcp TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_pcp TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_padrao TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vinculo_equipe_cliente TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chamados_suporte TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_admin TO anon, authenticated;
GRANT SELECT, UPDATE ON public.admin_master TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
