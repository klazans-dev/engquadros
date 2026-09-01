-- ============================================================================
-- 2_SEGURANCA_ALTA.sql  (idempotente — rode no SQL Editor do Supabase)
-- Tenant via headers x-empresa-id / x-cnpj + RPCs de login + Storage PDF
-- Portal do cliente: SELECT em obras/arquivos/chamados usa eq_digits (CNPJ
-- mascarado no banco vs header só com dígitos). NÃO exige coluna cliente_id
-- (a base ao vivo e o JS usam só cliente_cnpj). Reexecute este arquivo
-- depois de atualizar o front.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Coluna canônica do login da equipe (JS + RPC login_equipe).
-- NÃO criar coluna `usuario`: a base ao vivo e o app usam só usuario_login.
ALTER TABLE public.equipe_admin ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(80);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eq_digits(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(t, ''), '\D', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.request_header(nome text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw text;
  j json;
BEGIN
  raw := current_setting('request.headers', true);
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    j := raw::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN NULLIF(btrim(COALESCE(j ->> lower(nome), '')), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.request_cnpj()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.eq_digits(public.request_header('x-cnpj')), '');
$$;

-- Cliente enxerga o registro se o header x-cnpj (só dígitos) bate com
-- cliente_cnpj da linha (máscara irrelevante). NÃO usa coluna cliente_id:
-- a base ao vivo e o JS filtram só por cliente_cnpj.
-- A assinatura antiga (text, uuid) é removida DEPOIS do DROP POLICY,
-- senão o Postgres recusa o DROP se alguma policy ainda depender dela.
CREATE OR REPLACE FUNCTION public.cliente_enxerga_registro(p_cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.request_cnpj() IS NOT NULL
    AND public.eq_digits(p_cnpj) = public.request_cnpj();
$$;

CREATE OR REPLACE FUNCTION public.request_empresa_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE v text;
BEGIN
  v := public.request_header('x-empresa-id');
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  BEGIN
    RETURN v::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.eq_mesmo_tenant(p_empresa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.request_empresa_id() IS NOT NULL
     AND p_empresa IS NOT NULL
     AND p_empresa = public.request_empresa_id();
$$;

-- ---------------------------------------------------------------------------
-- Login (SECURITY DEFINER — não expõe coluna senha ao anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.login_admin_master(p_cnpj text, p_senha text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.admin_master%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM public.admin_master
  WHERE senha = p_senha
    AND public.eq_digits(cnpj) = public.eq_digits(p_cnpj)
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'empresa_id', COALESCE(r.empresa_id, r.id),
    'cnpj', r.cnpj,
    'nome_fantasia', r.nome_fantasia,
    'logo_url', r.logo_url,
    'cor_primaria', r.cor_primaria,
    'cor_secundaria', r.cor_secundaria,
    'email', r.email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.login_equipe(p_cnpj_empresa text, p_usuario text, p_senha text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.admin_master%ROWTYPE;
DECLARE e public.equipe_admin%ROWTYPE;
BEGIN
  SELECT * INTO m
  FROM public.admin_master
  WHERE public.eq_digits(cnpj) = public.eq_digits(p_cnpj_empresa)
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO e
  FROM public.equipe_admin
  WHERE empresa_id = COALESCE(m.empresa_id, m.id)
    AND senha = p_senha
    AND usuario_login = p_usuario
    AND COALESCE(ativo, TRUE) = TRUE
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'equipe', jsonb_build_object(
      'id', e.id,
      'nome', e.nome,
      'usuario_login', e.usuario_login,
      'permissoes', e.permissoes
    ),
    'master', jsonb_build_object(
      'empresa_id', COALESCE(m.empresa_id, m.id),
      'cnpj', m.cnpj,
      'nome_fantasia', m.nome_fantasia,
      'logo_url', m.logo_url,
      'cor_primaria', m.cor_primaria,
      'cor_secundaria', m.cor_secundaria
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.login_cliente(p_cnpj text, p_chave text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.clientes%ROWTYPE;
BEGIN
  SELECT * INTO c
  FROM public.clientes
  WHERE public.eq_digits(cnpj) = public.eq_digits(p_cnpj)
    AND (
      chave_mestre = p_chave
      OR chave_acesso = p_chave
    )
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.status IN ('bloqueado', 'inativo') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', c.id,
    'cnpj', c.cnpj,
    'razao_social', c.razao_social,
    'status', c.status,
    'empresa_id', c.empresa_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_branding(p_cnpj text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.admin_master%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM public.admin_master
  WHERE public.eq_digits(cnpj) = public.eq_digits(p_cnpj)
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'logo_url', r.logo_url,
    'nome_fantasia', r.nome_fantasia
  );
END;
$$;

REVOKE ALL ON FUNCTION public.login_admin_master(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.login_equipe(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.login_cliente(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_branding(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_admin_master(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_equipe(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_cliente(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_branding(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eq_digits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_header(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_cnpj() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_empresa_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eq_mesmo_tenant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_enxerga_registro(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: remove políticas abertas
-- ---------------------------------------------------------------------------
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

DROP POLICY IF EXISTS "Clientes leem próprios dados" ON public.clientes;
DROP POLICY IF EXISTS "Clientes inserem próprios dados" ON public.clientes;
DROP POLICY IF EXISTS "Obras: cliente le seus projetos" ON public.obras;
DROP POLICY IF EXISTS "Obras: cliente insere seus projetos" ON public.obras;
DROP POLICY IF EXISTS "Arquivos: cliente le seus arquivos" ON public.arquivos;
DROP POLICY IF EXISTS "Arquivos: cliente insere arquivos" ON public.arquivos;
DROP POLICY IF EXISTS "Arquivos: cliente atualiza aprovação" ON public.arquivos;
DROP POLICY IF EXISTS "Chamados: cliente le seus chamados" ON public.chamados_suporte;
DROP POLICY IF EXISTS "Chamados: cliente insere chamados" ON public.chamados_suporte;
DROP POLICY IF EXISTS "Chamados: cliente atualiza seus chamados" ON public.chamados_suporte;
DROP POLICY IF EXISTS "Etapas: le por empresa" ON public.etapas_pcp;
DROP POLICY IF EXISTS "Etapas: empresa insere" ON public.etapas_pcp;
DROP POLICY IF EXISTS "Empresas: acesso total" ON public.empresas;
DROP POLICY IF EXISTS "Admin master: acesso total" ON public.admin_master;
DROP POLICY IF EXISTS "Equipe admin: acesso total" ON public.equipe_admin;
DROP POLICY IF EXISTS "Produtos: acesso total" ON public.produtos;
DROP POLICY IF EXISTS "Tributacoes: acesso total" ON public.tributacao_estadual;
DROP POLICY IF EXISTS "Tributacoes Federais: acesso total" ON public.tributacao_federal;
DROP POLICY IF EXISTS "Tributacoes IBS/CBS: acesso total" ON public.tributacao_ibs_cbs;

DROP POLICY IF EXISTS "tenant_empresas" ON public.empresas;
DROP POLICY IF EXISTS "tenant_admin_master" ON public.admin_master;
DROP POLICY IF EXISTS "tenant_equipe_admin" ON public.equipe_admin;
DROP POLICY IF EXISTS "tenant_clientes" ON public.clientes;
DROP POLICY IF EXISTS "tenant_produtos" ON public.produtos;
DROP POLICY IF EXISTS "tenant_obras" ON public.obras;
DROP POLICY IF EXISTS "tenant_arquivos" ON public.arquivos;
DROP POLICY IF EXISTS "tenant_chamados" ON public.chamados_suporte;
DROP POLICY IF EXISTS "tenant_etapas" ON public.etapas_pcp;
DROP POLICY IF EXISTS "tenant_trib_est" ON public.tributacao_estadual;
DROP POLICY IF EXISTS "tenant_trib_fed" ON public.tributacao_federal;
DROP POLICY IF EXISTS "tenant_trib_ibs" ON public.tributacao_ibs_cbs;

DROP FUNCTION IF EXISTS public.cliente_enxerga_registro(text, uuid);

CREATE POLICY "tenant_empresas" ON public.empresas
  FOR ALL USING (id = public.request_empresa_id())
  WITH CHECK (id = public.request_empresa_id());

CREATE POLICY "tenant_admin_master" ON public.admin_master
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id))
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_equipe_admin" ON public.equipe_admin
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id))
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_clientes" ON public.clientes
  FOR ALL USING (
    public.eq_mesmo_tenant(empresa_id)
    OR (
      public.request_cnpj() IS NOT NULL
      AND public.eq_digits(cnpj) = public.request_cnpj()
    )
  )
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_produtos" ON public.produtos
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL)
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_obras" ON public.obras
  FOR ALL USING (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  )
  WITH CHECK (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  );

CREATE POLICY "tenant_arquivos" ON public.arquivos
  FOR ALL USING (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  )
  WITH CHECK (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  );

CREATE POLICY "tenant_chamados" ON public.chamados_suporte
  FOR ALL USING (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  )
  WITH CHECK (
    public.eq_mesmo_tenant(empresa_id)
    OR public.cliente_enxerga_registro(cliente_cnpj)
  );

CREATE POLICY "tenant_etapas" ON public.etapas_pcp
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL)
  WITH CHECK (public.eq_mesmo_tenant(empresa_id));

CREATE POLICY "tenant_trib_est" ON public.tributacao_estadual
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL)
  WITH CHECK (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL);

CREATE POLICY "tenant_trib_fed" ON public.tributacao_federal
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL)
  WITH CHECK (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL);

CREATE POLICY "tenant_trib_ibs" ON public.tributacao_ibs_cbs
  FOR ALL USING (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL)
  WITH CHECK (public.eq_mesmo_tenant(empresa_id) OR empresa_id IS NULL);

DO $$
BEGIN
  IF to_regclass('public.vinculo_equipe_cliente') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.vinculo_equipe_cliente ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_vinculo ON public.vinculo_equipe_cliente';
    EXECUTE 'CREATE POLICY tenant_vinculo ON public.vinculo_equipe_cliente FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))';
  END IF;
  IF to_regclass('public.status_pcp') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.status_pcp ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_status_pcp ON public.status_pcp';
    EXECUTE 'CREATE POLICY tenant_status_pcp ON public.status_pcp FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))';
  END IF;
  IF to_regclass('public.produto_fabricantes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.produto_fabricantes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_fab ON public.produto_fabricantes';
    EXECUTE 'CREATE POLICY tenant_prod_fab ON public.produto_fabricantes FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))';
  END IF;
  IF to_regclass('public.produto_grupos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.produto_grupos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_grp ON public.produto_grupos';
    EXECUTE 'CREATE POLICY tenant_prod_grp ON public.produto_grupos FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))';
  END IF;
  IF to_regclass('public.produto_marcas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.produto_marcas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_prod_marca ON public.produto_marcas';
    EXECUTE 'CREATE POLICY tenant_prod_marca ON public.produto_marcas FOR ALL USING (public.eq_mesmo_tenant(empresa_id)) WITH CHECK (public.eq_mesmo_tenant(empresa_id))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Storage: PDF + pasta = empresa_id (primeiro segmento do path)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs_clientes', 'pdfs_clientes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permissao Total Leitura Storage" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Total Escrita Storage" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Total Atualizacao Storage" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Total Exclusao Storage" ON storage.objects;
DROP POLICY IF EXISTS "eq_pdfs_select" ON storage.objects;
DROP POLICY IF EXISTS "eq_pdfs_insert" ON storage.objects;
DROP POLICY IF EXISTS "eq_pdfs_update" ON storage.objects;
DROP POLICY IF EXISTS "eq_pdfs_delete" ON storage.objects;

CREATE POLICY "eq_pdfs_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pdfs_clientes'
    AND (
      (storage.foldername(name))[1] = public.request_header('x-empresa-id')
    )
  );

CREATE POLICY "eq_pdfs_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'pdfs_clientes'
    AND public.request_empresa_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.request_header('x-empresa-id')
    AND (
      lower(COALESCE(metadata->>'mimetype', '')) IN ('application/pdf', 'application/x-pdf')
      OR lower(name) LIKE '%.pdf'
      OR lower(COALESCE(metadata->>'mimetype', '')) LIKE 'image/%'
    )
  );

CREATE POLICY "eq_pdfs_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'pdfs_clientes'
    AND (storage.foldername(name))[1] = public.request_header('x-empresa-id')
  );

CREATE POLICY "eq_pdfs_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'pdfs_clientes'
    AND (storage.foldername(name))[1] = public.request_header('x-empresa-id')
  );
