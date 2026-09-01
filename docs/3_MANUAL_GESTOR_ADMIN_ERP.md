# Manual de Operações do Gestor ERP

Guia técnico, fiscal e operacional para administradores master, engenheiros, coordenação de PCP e equipe interna.

No painel: **Sistema → Manual de uso** (mesmo conteúdo, com busca e tópicos expansíveis).

---

## Sumário

0. [Menu principal, tema e navegação](#0-menu-principal-tema-e-navegação)
1. [Gestão de clientes](#1-gestão-de-clientes)
2. [Catálogo de produtos](#2-catálogo-de-produtos)
3. [Tributação e reforma (IBS / CBS)](#3-tributação-e-reforma-ibs--cbs)
4. [Operacional: PCP e Status de obras](#4-operacional-pcp-e-status-de-obras)
5. [Dashboard BI](#5-dashboard-bi)
6. [Documentos técnicos](#6-documentos-técnicos)
7. [Atendimento](#7-atendimento)
8. [Equipe e permissões](#8-equipe-e-permissões)
9. [Identidade visual](#9-identidade-visual)
10. [Orçamentos](#10-orçamentos)
11. [Editor de proposta](#11-editor-de-proposta)

---

## Acesso

1. Abra o sistema no navegador (`admin.html` / login).
2. Na aba **Gestor / Admin**, informe usuário, senha e CNPJ da empresa (tenant).
3. O menu mostra só os módulos liberados para o perfil.

---

## 0. Menu principal, tema e navegação

- **Uma barra só:** o mesmo menu aparece em Admin, Orçamentos, Propostas e Dashboard BI. Os módulos abrem **na mesma aba** do navegador.
- **Submenus:** Cadastros, Operacional, Vendas, Relatórios e Sistema começam fechados. Clique no nome do módulo para abrir Clientes, Tributações, PCP, Status, Orçamentos, Dashboard BI etc. Clique de novo para recolher **só aquele submenu** — a barra lateral permanece.
- **Minimizar a barra:** o botão redondo na borda recolhe ou expande o menu inteiro (ícones). Isso **não** fecha sozinho ao navegar. O estado fica na sessão do navegador.
- **Identidade e Tema:** em Sistema → Identidade e Tema, grave cor primária, cor secundária, logomarca e nome fantasia. As cores e a logo valem em todas as telas após salvar (use Ctrl+F5 se o navegador cachear).
- **Status de obras:** Operacional → Status de obras abre o quadro (Novos, Engenharia/Produção, Concluído). Não é preciso passar pelo card grande do módulo.

---

## 1. Gestão de clientes

- **Cadastros → Clientes** → Novo Cliente.
- Digite o CNPJ e use **Puxar Dados** (Receita Federal: razão social, endereço, CEP, cidade).
- Defina a chave do portal. O cliente entra com CNPJ + chave em `painel-cliente.html`.
- Status Inativo ou Bloqueado suspende o portal na hora.

---

## 2. Catálogo de produtos

- **Cadastros → Produtos.**
- Abas: dados básicos e preços (custo + markup = venda) e regras fiscais (NCM, CFOP e grupos de tributação).
- **Fabricante, Grupo e Marca:** cadastre em Cadastros → Fabricantes / Grupos de produto / Marcas (ou o + ao lado do campo no produto). O **grupo** é a chave de equivalência: produtos do mesmo grupo (ex.: Disjuntor 100A 3P) podem ser trocados no orçamento por outro fabricante ou marca. SQL: `docs/8_FABRICANTE_GRUPO_MARCA.sql`.
- A foto enviada é comprimida automaticamente.
- Tensão, corrente e potência entram em memoriais e propostas.

---

## 3. Tributação e reforma (IBS / CBS)

As alíquotas ficam em **grupos reutilizáveis**, não grudadas no produto.

| Menu | Uso |
|---|---|
| Cadastros → Tributação Estadual | ICMS por UF origem/destino, CST/CSOSN, redução de base, FCP, MVA-ST |
| Cadastros → Tributação Federal | PIS, COFINS, IPI, Lucro Real/Presumido, alíquota zero |
| Cadastros → Tributação Reforma | CBS federal, IBS estadual/municipal, redução (ex.: 60%), isenção |

No cadastro do item, vincule os três grupos. Ao gravar uma regra, os dropdowns do produto atualizam.

---

## 4. Operacional: PCP e Status de obras

- **Status de obras** (Operacional → Status de obras): quadros recém-enviados do orçamento entram em **Novos** (`etapa_pcp_id` vazio). Só **Iniciar Produção** no card coloca o painel na primeira etapa do PCP.
- **PCP / Fábrica** (Operacional → PCP / Fábrica): arraste os cards entre as colunas. O salvamento é automático.
- **Checklists:** em Processos no card, marque tarefas; o avanço físico (0–100%) sincroniza com o cliente.
- **Modo TV:** projeta o Kanban na linha com contraste alto e atualização contínua.

---

## 5. Dashboard BI

- **Relatórios → Dashboard BI** (permissão Relatórios). O menu lateral continua o mesmo do Admin.
- **Abas do painel:** Visão Geral (previsto vs. realizado, conversão, projetos em andamento, saúde de prazos), Comercial & Orçamentos (funil B2B) e Projetos & Produção (PCP e matriz semanal).
- **Filtros:** período (todo, mês, trimestre) e texto livre (cliente, obra, CNPJ ou projeto). As abas de conteúdo não somem ao rolar.
- **Dados:** números vêm de orçamentos, obras e chamados. Se a consulta vier vazia, o chip **Demonstração** ilustra o layout até haver registros.
- **PDF / CSV:** Relatório PDF (Ctrl+P) e exportação CSV da matriz de PCP.

---

## 6. Documentos técnicos

- Upload de PDFs de diagramas, memoriais, laudos e fotos. Somente PDF no portal, até 20 MB.
- Associe à obra para aparecer no Kanban e no portal do cliente.

---

## 7. Atendimento

- Menu **Atendimento ao cliente**.
- Tickets por prioridade; respostas no chat interno chegam no portal do cliente.

---

## 8. Equipe e permissões

- **Cadastros → Equipe** (somente master). Cadastre operadores, engenheiros e vendedores.
- **Módulos:** Cadastros, Operacional, Arquivos, Atendimento, Vendas, Compras, Financeiro, Relatórios.
- **Vendas (detalhe):** Orçamentos, Editor de proposta, ver custos/lucro, enviar ao Status/PCP, autorizar prazo expirado e autorizar margem abaixo da mínima.
- O que não estiver marcado some do menu e da tela.

Para um funcionário ver só um cliente: no perfil do cliente (senha master), use **Delegação de Equipe**.

---

## 9. Identidade visual

- **Sistema → Identidade e Tema.**
- Grava: cor primária (barra e botões), cor secundária (destaques), logomarca, nome fantasia, WhatsApp e e-mail. O CNPJ master **não** se altera nesta tela.
- Aparece em: menu, login, orçamento, proposta, dashboard e cabeçalhos de impressão.

---

## 10. Orçamentos

- **Vendas → Orçamentos.** O menu do ERP permanece à esquerda.
- **Novo:** escolha Simples (itens avulsos, custo + markup) ou Industrialização (plantas, painéis e PCP). Atalhos **1** e **2** no teclado.
- **Catálogo:** clique no resultado da busca para inserir; Enter insere o primeiro. **F3** foca a busca; **Ctrl+S** salva; **Ctrl+P** imprime.
- **Trocar fabricante:** na lista de materiais, use **Trocar fabricante** (todo o orçamento) ou o ícone de setas no item. Só há equivalentes se os produtos compartilharem o mesmo **Grupo**. SKU, preço e marca são atualizados e a diferença de valor aparece na tela.
- **Industrialização:** plantas no card; Atualizar planta recalcula o layout. Rodapé com condições comerciais, barra de lucro e cálculo por grupo. Custos só para quem tem a permissão.
- **Status / PCP:** cria cada quadro em Status (**Novos**). A fábrica só recebe depois de **Iniciar Produção**. Confirme antes de enviar ou de excluir um painel.
- **Impressão:** simples não imprime planta nem lucro. Industrial imprime SVG das plantas. Dados do emitente vêm da Identidade (logo, CNPJ, e-mail, telefone).
- **Banco:** rode no SQL Editor do Supabase, se ainda não rodou: `docs/3_ORCAMENTOS.sql`, `docs/7_ORCAMENTO_CALC.sql` e `docs/8_FABRICANTE_GRUPO_MARCA.sql`. Sem as tabelas, o rascunho fica só neste navegador.

---

## 11. Editor de proposta

- **Vendas → Propostas**, ou o botão Proposta dentro do orçamento (permissão correspondente).
- Use o botão do modelo profissional EngQuadros; o texto padrão segue o tipo do orçamento (simples ou industrialização).
- **Ctrl+S** grava o modelo; **Ctrl+P** imprime. Paletas de cor da folha ficam na barra de formatação.
