# Controle de Versionamento & Changelog do Sistema ERP SaaS

Registro cronológico e detalhado de todas as versões, alterações arquiteturais, módulos fiscais, integrações com Supabase e melhorias de interface.

---

## 📌 Sumário de Versões

| Versão | Data | Módulos Principais | Status |
| :--- | :--- | :--- | :--- |
| **v2.5.0** | 2026-08-27 | Módulo de Gestão de Tributação & Nova Reforma (IBS/CBS) | **Vigente (Atual)** |
| **v2.4.0** | 2026-08-27 | Dashboard BI Executivo & Indicadores Industriais PCP | **Vigente** |
| **v2.3.0** | 2026-08-27 | Módulo de Cadastro de Produtos & Engenharia com Markup Dinâmico | **Vigente** |
| **v2.2.0** | 2026-08-26 | Painel Master SaaS Multi-Tenant & Whitelabel Dinâmico | **Vigente** |
| **v2.1.0** | 2026-08-26 | PCP Industrial (Kanban, Checklists Técnicos e Modo TV Fábrica) | **Vigente** |
| **v2.0.0** | 2026-08-25 | Reestruturação Segura de Permissões & Login por Empresa | **Vigente** |
| **v1.0.0** | 2026-08-20 | Fundação do ERP Industrial & Portal do Cliente | Concluída |

---

## 🚀 Detalhamento das Versões

### [v2.5.0] - 2026-08-27: Arquitetura Fiscal Desacoplada & Reforma Tributária (IBS/CBS)
#### Adicionado:
- **Tabelas Fiscais Dedicadas:** Criação das tabelas `tributacao_estadual`, `tributacao_federal` e `tributacao_ibs_cbs`.
- **Nova Reforma Tributária (IBS/CBS):** Suporte completo à Emenda Constitucional 132/2023 com parametrização de alíquotas CBS (Federal), IBS (Estadual/Municipal), regimes diferenciados (60% redução) e isenções.
- **Painéis CRUD de Tributação em `admin.html`:**
  - *Tributação Estadual:* Cadastro, edição e exclusão de regras de ICMS, ST (MVA), FCP e Reduções.
  - *Tributação Federal:* Parametrização de PIS, COFINS, IPI e Códigos de Enquadramento.
  - *Tributação Reforma:* Configuração de alíquotas de transição IBS/CBS.
- **Formulário de Produtos com Abas Inteligentes:**
  - Aba 1: Dados Comerciais, Preço de Custo, Markup, Preço de Venda e Dados de Engenharia.
  - Aba 2: NCM, CFOP Padrão e Dropdowns com Foreign Keys vinculadas às tabelas tributárias.
- **Sincronização em Tempo Real:** Atualização automática dos dropdowns fiscais ao cadastrar ou alterar regras.

---

### [v2.4.0] - 2026-08-27: Dashboard BI Executivo & Relatórios PCP
#### Adicionado:
- **Revitalização Total de `dashboard.html`:** Implementação de painel analítico com gráficos Chart.js em tempo real.
- **KPIs Industriais:**
  - Total de Obras em Produção.
  - Entregas & Testes de QA no Mês.
  - Eficiência de Prazo (On-Time Delivery Rate).
  - Avanço Físico Médio Ponderado.
- **Matriz Semanal de Cronograma PCP:** Tabela interativa com busca, filtros de status, tags dinâmicas e exportação para CSV.
- **Folha de Impressão Executiva (`@media print`):** Layout otimizado para geração de PDFs e relatórios de diretoria.
- **Integração no `admin.html`:** O botão "Dashboards" na aba Relatórios agora abre o novo BI Executivo.

---

### [v2.3.0] - 2026-08-27: Módulo de Produtos & Engenharia Elétrica
#### Adicionado:
- **Catálogo de Produtos em `admin.html`:** Listagem em cards com thumb de imagem, SKU, NCM, tipo e valor de venda.
- **Motor de Markup Automático:** Cálculo em tempo real do preço de venda com base no custo de aquisição e margem percentual desejada.
- **Campos de Engenharia Elétrica:** Tensão Nominal, Corrente Máxima (A) e Potência (kW).
- **Compressor de Imagens Client-Side:** Redimensionamento e compressão automática via HTML5 Canvas (JPEG 70%) para não sobrecarregar o storage do Supabase.

---

### [v2.2.0] - 2026-08-26: Arquitetura Multi-Tenant & Painel Master SaaS (`painelsaas.html`)
#### Adicionado:
- **Controle Master Multi-Empresa:** Painel `painelsaas.html` para criação, bloqueio e edição de empresas clientes (Tenants).
- **Faturamento e Cobrança:** Controle de dia de vencimento (acerto) e valor de mensalidade com somatório de faturamento estimado.
- **Whitelabel Dinâmico:** Customização de cores primárias, cores secundárias e upload de logomarca individual para cada empresa contratante.
- **Isolamento de Dados:** Cada consulta no ERP filtra obrigatoriamente por `empresa_id`.

---

### [v2.1.0] - 2026-08-26: Chão de Fábrica PCP & Modo TV Industrial
#### Adicionado:
- **Kanban PCP em Tempo Real:** Quadro visual com colunas arrastáveis (Drag & Drop) representando as fases de montagem (Mecânica, Barramento, Fiação, Teste de Tensão, Embalagem).
- **Checklists e Processos Customizáveis:** Definição de critérios de qualidade por etapa com cálculo automático da porcentagem de conclusão da obra (0% a 100%).
- **Modo TV / Painel de Fábrica:** Visualização em tela cheia com auto-refresh para monitoramento nas linhas de montagem.

---

### [v2.0.0] - 2026-08-25: Autenticação Segura & Matriz de Permissões
#### Adicionado:
- **Controle de Acesso por Módulo:** Matriz booleana de permissões em `equipe_admin` (`clientes`, `obras`, `arquivos`, `tickets`, `vendas`, `compras`, `financeiro`, `relatorios`).
- **Eliminação de prompts bloqueantes:** Acesso seguro direto à identidade visual e configurações administrativas.
- **Sessão Unificada via `sessionStorage`:** Persistência de token, ID da empresa e dados do usuário logado.

---

### [v1.0.0] - 2026-08-20: Fundação da Plataforma
#### Adicionado:
- Landing Page comercial institucional (`index.html`).
- Tela de login unificada para Gestores e Clientes (`login.html`).
- Portal exclusivo do cliente (`painel-cliente.html`) com login por CNPJ e Chave de Acesso.
- Acervo de arquivos técnicos e suporte a PDFs de projetos de engenharia.
