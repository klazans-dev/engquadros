-- ============================================================================
-- 3_ORCAMENTOS.sql  (idempotente — rode no SQL Editor do Supabase)
-- Orçamentos comerciais + itens da montagem + layout visual (JSONB).
-- NÃO cria coluna cliente_id: o app e a base ao vivo usam cliente_cnpj.
-- RLS: eq_mesmo_tenant(empresa_id) — igual a docs/2_SEGURANCA_ALTA.sql.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Cabeçalho do orçamento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_cnpj VARCHAR(20),
    numero VARCHAR(50),
    situacao VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    validade DATE,
    vendedor VARCHAR(120),
    prazo_pagamento VARCHAR(80),
    tipo_frete VARCHAR(80),
    custo_material NUMERIC(14,2) DEFAULT 0,
    mao_obra_pct NUMERIC(8,2) DEFAULT 0,
    mao_obra_valor NUMERIC(14,2) DEFAULT 0,
    markup_pct NUMERIC(8,2) DEFAULT 0,
    total_venda NUMERIC(14,2) DEFAULT 0,
    total_compra NUMERIC(14,2) DEFAULT 0,
    lucro_valor NUMERIC(14,2) DEFAULT 0,
    lucro_pct NUMERIC(8,2) DEFAULT 0,
    totais JSONB DEFAULT '{}'::jsonb,
    montagem JSONB DEFAULT '{"slots":[]}'::jsonb,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS situacao VARCHAR(30) DEFAULT 'PENDENTE';
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS validade DATE;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS vendedor VARCHAR(120);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS prazo_pagamento VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS tipo_frete VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS custo_material NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS mao_obra_pct NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS mao_obra_valor NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS total_venda NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS total_compra NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS lucro_valor NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS lucro_pct NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS totais JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS montagem JSONB DEFAULT '{"slots":[]}'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS projeto VARCHAR(200);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS modalidade VARCHAR(30) DEFAULT 'industrializacao';
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- Itens (BOM) — produto_id é referência suave (sem FK) para sobreviver a exclusão
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    produto_id TEXT, -- UUID ou id numérico do catálogo legado
    sku VARCHAR(60),
    descricao VARCHAR(255),
    qtde NUMERIC(14,3) DEFAULT 1,
    custo_unit NUMERIC(14,4) DEFAULT 0,
    venda_unit NUMERIC(14,4) DEFAULT 0,
    ordem INTEGER DEFAULT 0,
    tipo VARCHAR(50),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS produto_id TEXT;
DO $$
BEGIN
  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_produto_id_fkey;
  ALTER TABLE public.orcamento_itens ALTER COLUMN produto_id TYPE TEXT USING produto_id::text;
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS descricao VARCHAR(255);
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS qtde NUMERIC(14,3) DEFAULT 1;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS custo_unit NUMERIC(14,4) DEFAULT 0;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS venda_unit NUMERIC(14,4) DEFAULT 0;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS grupo_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS grupo_nome VARCHAR(120);
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa ON public.orcamentos (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero ON public.orcamentos (empresa_id, numero);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON public.orcamentos (empresa_id, cliente_cnpj);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orc ON public.orcamento_itens (orcamento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_empresa ON public.orcamento_itens (empresa_id);

-- ---------------------------------------------------------------------------
-- RLS tenant (mesmo padrão de 2_SEGURANCA_ALTA)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "tenant_orcamento_itens" ON public.orcamento_itens;

CREATE POLICY "tenant_orcamentos" ON public.orcamentos
  FOR ALL
  USING (public.eq_mesmo_tenant(empresa_id))
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_orcamento_itens" ON public.orcamento_itens
  FOR ALL
  USING (public.eq_mesmo_tenant(empresa_id))
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO anon, authenticated;
