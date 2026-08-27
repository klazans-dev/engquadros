# Manual do Gestor ERP (Painel Administrativo)

Guia de operação completo do ERP Industrial para Administradores Master, Engenheiros, Coordenadores de PCP e Equipe Interna.

---

## 📑 Sumário

1. [Acesso ao Sistema e Autenticação](#1-acesso-ao-sistema-e-autenticação)
2. [Identidade Visual e Whitelabel (Tema & Logo)](#2-identidade-visual-e-whitelabel-tema--logo)
3. [Módulo de Cadastros](#3-módulo-de-cadastros)
   - [3.1 Gestão de Pessoas / Clientes](#31-gestão-de-pessoas--clientes)
   - [3.2 Catálogo de Produtos e Precificação](#32-catálogo-de-produtos-e-precificação)
   - [3.3 Equipe Interna e Permissões](#33-equipe-interna-e-permissões)
4. [Módulo de Tributação & Reforma Tributária (IBS/CBS)](#4-módulo-de-tributação--reforma-tributária-ibscbs)
   - [4.1 Regras Estaduais (ICMS, ST, FCP)](#41-regras-estaduais-icms-st-fcp)
   - [4.2 Regras Federais (PIS, COFINS, IPI)](#42-regras-federais-pis-cofins-ipi)
   - [4.3 Nova Reforma Tributária (IBS + CBS)](#43-nova-reforma-tributária-ibs--cbs)
5. [Módulo Operacional (PCP & Chão de Fábrica)](#5-módulo-operacional-pcp--chão-de-fábrica)
   - [5.1 Kanban de Produção](#51-kanban-de-produção)
   - [5.2 Checklists Técnicos e Avanço Físico](#52-checklists-técnicos-e-avanço-físico)
   - [5.3 Modo TV Fábrica](#53-modo-tv-fábrica)
6. [Módulo de Atendimento (Chamados & Suporte)](#6-módulo-de-atendimento-chamados--suporte)
7. [Dashboard BI Executivo & Relatórios](#7-dashboard-bi-executivo--relatórios)

---

## 1. Acesso ao Sistema e Autenticação

1. Acesse o endereço do sistema no navegador e entre na tela de Login (`login.html` ou `admin.html`).
2. Selecione a aba **Gestor / Admin**.
3. Insira suas credenciais:
   - **Usuário / E-mail**: Seu e-mail ou usuário cadastrado.
   - **Senha**: Sua senha de acesso.
   - **CNPJ da Empresa**: O CNPJ da sua empresa (Tenant).
4. Clique em **Entrar no Painel**. O sistema fará a autenticação segura no Supabase e carregará os módulos autorizados para o seu perfil.

---

## 2. Identidade Visual e Whitelabel (Tema & Logo)

O ERP é 100% personalizável para a marca da sua empresa:
1. No menu lateral, acesse **Configurações / Identidade Visual**.
2. **Razão Social & Nome Fantasia**: Altere o nome exibido no topo e nos cabeçalhos.
3. **Cores da Marca**:
   - **Cor Primária**: Define o tom da barra lateral, botões principais e títulos.
   - **Cor Secundária**: Define gradientes, detalhes de destaque e bordas.
4. **Logomarca**: Envie uma imagem PNG ou JPG da sua empresa. Ela será aplicada automaticamente no menu lateral, na tela de login e nos relatórios de impressão.
5. Clique em **Salvar Configurações**.

---

## 3. Módulo de Cadastros

### 3.1 Gestão de Pessoas / Clientes
- **Cadastrar Cliente:** Clique em **Novo Cliente**.
- **Automação por CNPJ:** Digite o CNPJ da empresa cliente e clique em **Puxar Dados**. O sistema consulta automaticamente a base da Receita Federal e preenche Razão Social, Endereço, Bairro, CEP e Cidade.
- **Chave de Acesso do Cliente:** Defina uma chave única (ex: `CLI@2026`). O cliente usará essa chave + CNPJ para entrar no portal dele (`painel-cliente.html`).
- **Bloqueio/Inativação:** Altere o status para "Inativo" ou "Bloqueado" para suspender o acesso do cliente imediatamente.

### 3.2 Catálogo de Produtos e Precificação
- **Aba 1 (Dados Básicos & Preços):**
  - Informe Nome, Categoria (Painel, Componente, Barramento), SKU e Código EAN/GTIN.
  - **Motor de Markup:** Digite o Custo Base (R$) e a Margem Markup (%) desejada. O sistema calcula automaticamente o Preço de Venda Final.
  - **Especificações de Engenharia:** Tensão Nominal (ex: `220V/380V`), Corrente Máxima (`100A`) e Potência (`15kW`).
- **Aba 2 (Regras Fiscais):**
  - NCM (8 dígitos) e CFOP Padrão de saída.
  - Selecione o **Grupo Estadual de ICMS**, o **Grupo Federal de PIS/COFINS** e o **Grupo da Reforma IBS/CBS**.
- **Foto do Produto:** Envie uma foto do seu computador ou cole o link da web. O sistema comprime automaticamente para máxima performance.

### 3.3 Equipe Interna e Permissões
- Cadastre novos colaboradores (engenheiros, compradores, operadores).
- Marque individualmente quais abas cada um pode visualizar:
  - `Cadastros`, `Operacional (PCP)`, `Arquivos`, `Atendimento`, `Vendas`, `Compras`, `Financeiro`, `Relatórios BI`.

---

## 4. Módulo de Tributação & Reforma Tributária (IBS/CBS)

O sistema conta com arquitetura fiscal desacoplada para atender tanto ao regime atual quanto ao período de transição da **Reforma Tributária (EC 132/2023)**.

### 4.1 Regras Estaduais (ICMS, ST, FCP)
- Acesse **Cadastros > Tributação Estadual**.
- Configure regras por UF de Origem e UF de Destino.
- Parametrize: Alíquota ICMS (%), CST/CSOSN, Redução de Base (%), FCP (Fundo de Combate à Pobreza %) e MVA-ST (%) para Substituição Tributária.

### 4.2 Regras Federais (PIS, COFINS, IPI)
- Acesse **Cadastros > Tributação Federal**.
- Configure regras para Lucro Real, Presumido ou Monofásico/Zero.
- Parametrize: Alíquota PIS (%), CST PIS, Alíquota COFINS (%), CST COFINS, Alíquota IPI (%) e Código de Enquadramento IPI.

### 4.3 Nova Reforma Tributária (IBS + CBS)
- Acesse **Cadastros > Tributação Reforma (IBS/CBS)**.
- Parametrize:
  - **Alíquota CBS (Federal)**: Alíquota federal (padrão 8.80%).
  - **Alíquota IBS (Estadual/Municipal)**: Alíquota estadual (padrão 17.70%).
  - **Regime Diferenciado / Redução de Base**: Aplique reduções (ex: 60%) para setores favorecidos ou marque **Isenção Total**.

---

## 5. Módulo Operacional (PCP & Chão de Fábrica)

### 5.1 Kanban de Produção
- Visualize todas as ordens de fabricação de quadros e painéis.
- **Mover Etapas:** Arraste os cards entre as colunas (ex: *Mecânica* $\rightarrow$ *Barramento* $\rightarrow$ *Fiação* $\rightarrow$ *Testes* $\rightarrow$ *Concluído*).
- O salvamento da posição é instantâneo no banco de dados.

### 5.2 Checklists Técnicos e Avanço Físico
- Clique no botão **Processos** em qualquer card de obra.
- Marque os itens concluídos pela equipe da fábrica. A barra de progresso (0% a 100%) é recalculada automaticamente e sincronizada com o cliente.

### 5.3 Modo TV Fábrica
- Clique no botão **Modo TV** no canto superior do PCP.
- A tela entra em modo fullscreen com fonte de alto contraste e atualização contínua para painéis industriais na fábrica.

---

## 6. Módulo de Atendimento (Chamados & Suporte)

- Receba solicitações de dúvidas técnicas, garantias ou ajustes de projeto abertas pelos clientes.
- Responda em formato de chat interno com histórico cronológico.
- Altere o status do chamado (*Aberto*, *Em Análise*, *Respondido*, *Concluído*).

---

## 7. Dashboard BI Executivo & Relatórios

- Acesse **Relatórios > Dashboard BI Executivo** ou abra `dashboard.html`.
- **Gráficos em Tempo Real:**
  - Status e Volume de Projetos (Distribuição por Fase).
  - Capacidade e Entregas Mensais.
- **KPIs de Eficiência:** Índice de Entregas no Prazo (On-time Delivery), Média de Avanço Físico e Total Faturado.
- **Exportação:** Exporte as tabelas para planilhas CSV ou imprima relatórios executivos em PDF com layout pronto para impressão (`Ctrl + P`).
