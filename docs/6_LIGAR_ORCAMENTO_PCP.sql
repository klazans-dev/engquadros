-- ============================================================================
-- 6_LIGAR_ORCAMENTO_PCP.sql  (idempotente — rode no SQL Editor do Supabase)
-- Liga cada PAINEL/QUADRO do orçamento a um projeto (tabela obras) do PCP.
-- O Kanban da fábrica e o painel do cliente já leem obras; estes campos
-- evitam duplicar o mesmo quadro e permitem atualizar o BOM depois.
-- Depois: NOTIFY recarrega o cache do PostgREST.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS orcamento_id TEXT;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS grupo_id TEXT;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS origem VARCHAR(40) DEFAULT 'manual';
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS codigo_orcamento VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS numero_orcamento VARCHAR(50);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS cliente_cnpj VARCHAR(20);
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS especificacoes_tecnicas JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS etapa_pcp_id UUID;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS status_kanban VARCHAR(50) DEFAULT 'aguardando_engenharia';

CREATE INDEX IF NOT EXISTS idx_obras_orcamento ON public.obras (empresa_id, orcamento_id);
CREATE INDEX IF NOT EXISTS idx_obras_grupo ON public.obras (empresa_id, grupo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_obras_orc_grupo_unico
  ON public.obras (empresa_id, orcamento_id, grupo_id)
  WHERE orcamento_id IS NOT NULL AND grupo_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
