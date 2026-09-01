-- ============================================================================
-- 7_ORCAMENTO_CALC.sql  (idempotente — rode no SQL Editor do Supabase)
-- Campos comerciais/logísticos do rodapé do orçamento.
-- Cálculo por painel (produto industrializado) fica em montagem JSONB.
-- modalidade: simples | industrializacao (também gravada em totais.comercial)
-- ============================================================================

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS transportadora VARCHAR(120);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS prazo_entrega VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS tipo_frete VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(80);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS frete_valor NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS frete_custo NUMERIC(14,2) DEFAULT 0;

ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS marca VARCHAR(80);

-- simples = itens + custos + markup | industrializacao = plantas visuais + PCP
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS modalidade VARCHAR(30) DEFAULT 'industrializacao';

NOTIFY pgrst, 'reload schema';
