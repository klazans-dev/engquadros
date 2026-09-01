-- ============================================================================
-- 8_FABRICANTE_GRUPO_MARCA.sql  (idempotente — rode no SQL Editor do Supabase)
-- Cadastros comerciais do catálogo + equivalência para troca no orçamento.
--
-- FABRICANTE  = Schneider, Siemens, WEG, ABB...
-- GRUPO       = família equivalente (ex.: Disjuntor 100A 3P). Itens do mesmo
--               grupo podem ser trocados no orçamento.
-- MARCA       = linha comercial (Acti9, SIRIUS, etc.), opcionalmente ligada
--               a um fabricante.
--
-- Depois de rodar: Ctrl+F5 no admin. Sem estas tabelas, os selects ficam
-- vazios e a troca de fabricante no orçamento não encontra equivalentes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Cadastros
-- ---------------------------------------------------------------------------
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

ALTER TABLE public.produto_fabricantes ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.produto_fabricantes ADD COLUMN IF NOT EXISTS nome VARCHAR(120);
ALTER TABLE public.produto_fabricantes ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.produto_fabricantes ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.produto_grupos ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.produto_grupos ADD COLUMN IF NOT EXISTS nome VARCHAR(160);
ALTER TABLE public.produto_grupos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.produto_grupos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.produto_grupos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.produto_marcas ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.produto_marcas ADD COLUMN IF NOT EXISTS fabricante_id UUID;
ALTER TABLE public.produto_marcas ADD COLUMN IF NOT EXISTS nome VARCHAR(120);
ALTER TABLE public.produto_marcas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.produto_marcas ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_fab_empresa_nome
  ON public.produto_fabricantes (empresa_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_grp_empresa_nome
  ON public.produto_grupos (empresa_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_marca_empresa_nome
  ON public.produto_marcas (empresa_id, lower(nome));

CREATE INDEX IF NOT EXISTS idx_prod_fab_empresa ON public.produto_fabricantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prod_grp_empresa ON public.produto_grupos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prod_marca_empresa ON public.produto_marcas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prod_marca_fab ON public.produto_marcas(fabricante_id);

-- ---------------------------------------------------------------------------
-- 2. Produto — vínculos (grupo_produto_id = chave de equivalência)
-- ---------------------------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fabricante_id UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS grupo_produto_id UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS marca_id UUID;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fabricante VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_produtos_fabricante ON public.produtos(empresa_id, fabricante_id);
CREATE INDEX IF NOT EXISTS idx_produtos_grupo_prod ON public.produtos(empresa_id, grupo_produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON public.produtos(empresa_id, marca_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_fabricante_id_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_fabricante_id_fkey
      FOREIGN KEY (fabricante_id) REFERENCES public.produto_fabricantes(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_grupo_produto_id_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_grupo_produto_id_fkey
      FOREIGN KEY (grupo_produto_id) REFERENCES public.produto_grupos(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_marca_id_fkey') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_marca_id_fkey
      FOREIGN KEY (marca_id) REFERENCES public.produto_marcas(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Itens de orçamento — guarda o vínculo para reabrir e trocar depois
--    (grupo_id já existe e é o painel da montagem — NÃO reutilizar)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS grupo_produto_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS fabricante_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS marca_id TEXT;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS fabricante VARCHAR(120);

-- ---------------------------------------------------------------------------
-- 4. RLS (só se 2_SEGURANCA_ALTA.sql já rodou) + grants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'eq_mesmo_tenant') THEN
    EXECUTE 'ALTER TABLE public.produto_fabricantes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.produto_grupos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.produto_marcas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_fab ON public.produto_fabricantes';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_grp ON public.produto_grupos';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_marca ON public.produto_marcas';
    EXECUTE $p$CREATE POLICY tenant_prod_fab ON public.produto_fabricantes
      FOR ALL USING (public.eq_mesmo_tenant(empresa_id))
      WITH CHECK (public.eq_mesmo_tenant(empresa_id))$p$;
    EXECUTE $p$CREATE POLICY tenant_prod_grp ON public.produto_grupos
      FOR ALL USING (public.eq_mesmo_tenant(empresa_id))
      WITH CHECK (public.eq_mesmo_tenant(empresa_id))$p$;
    EXECUTE $p$CREATE POLICY tenant_prod_marca ON public.produto_marcas
      FOR ALL USING (public.eq_mesmo_tenant(empresa_id))
      WITH CHECK (public.eq_mesmo_tenant(empresa_id))$p$;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_fabricantes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_grupos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_marcas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
