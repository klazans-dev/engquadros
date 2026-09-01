-- ============================================================================
-- 5_PROPOSTAS.sql  (idempotente — rode no SQL Editor do Supabase)
-- Corrige orcamento_itens.produto_id (UUID vs id numérico '1') e cria
-- modelos + propostas técnicas/comerciais do editor.
-- Depois: NOTIFY recarrega o cache do PostgREST.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Catálogo legado usa id 1, 2, 3… — a coluna UUID recusava o insert.
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS produto_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS grupo_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS grupo_nome VARCHAR(120);
DO $$
BEGIN
  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_produto_id_fkey;
  ALTER TABLE public.orcamento_itens ALTER COLUMN produto_id TYPE TEXT USING produto_id::text;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS projeto VARCHAR(200);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS transportadora VARCHAR(120);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS prazo_entrega VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS orcamentista VARCHAR(120);

-- ---------------------------------------------------------------------------
-- Modelos reutilizáveis (capa, textos, contrato) por empresa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propostas_modelos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(160) NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'tecnica_comercial',
    mostrar_sku BOOLEAN DEFAULT TRUE,
    mostrar_fabricante BOOLEAN DEFAULT FALSE,
    inversao BOOLEAN DEFAULT FALSE,
    secoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    campos_personalizados JSONB DEFAULT '{}'::jsonb,
    padrao BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS tipo VARCHAR(40) DEFAULT 'tecnica_comercial';
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS mostrar_sku BOOLEAN DEFAULT TRUE;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS mostrar_fabricante BOOLEAN DEFAULT FALSE;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS inversao BOOLEAN DEFAULT FALSE;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS secoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS campos_personalizados JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS padrao BOOLEAN DEFAULT FALSE;
ALTER TABLE public.propostas_modelos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- Proposta gerada a partir de um orçamento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    orcamento_id TEXT,
    modelo_id UUID,
    numero VARCHAR(50),
    tipo VARCHAR(40) NOT NULL DEFAULT 'tecnica_comercial',
    mostrar_sku BOOLEAN DEFAULT TRUE,
    mostrar_fabricante BOOLEAN DEFAULT FALSE,
    inversao BOOLEAN DEFAULT FALSE,
    secoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    campos_personalizados JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS orcamento_id TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS modelo_id UUID;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS tipo VARCHAR(40) DEFAULT 'tecnica_comercial';
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS mostrar_sku BOOLEAN DEFAULT TRUE;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS mostrar_fabricante BOOLEAN DEFAULT FALSE;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS inversao BOOLEAN DEFAULT FALSE;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS secoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS campos_personalizados JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_prop_modelos_empresa ON public.propostas_modelos (empresa_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_propostas_empresa ON public.propostas (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_propostas_orc ON public.propostas (empresa_id, orcamento_id);

ALTER TABLE public.propostas_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_propostas_modelos" ON public.propostas_modelos;
DROP POLICY IF EXISTS "tenant_propostas" ON public.propostas;

DO $$
BEGIN
  IF to_regprocedure('public.eq_mesmo_tenant(uuid)') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "tenant_propostas_modelos" ON public.propostas_modelos
      FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))$p$;
    EXECUTE $p$CREATE POLICY "tenant_propostas" ON public.propostas
      FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))$p$;
  ELSE
    EXECUTE $p$CREATE POLICY "tenant_propostas_modelos" ON public.propostas_modelos FOR ALL USING (true) WITH CHECK (true)$p$;
    EXECUTE $p$CREATE POLICY "tenant_propostas" ON public.propostas FOR ALL USING (true) WITH CHECK (true)$p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas_modelos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
