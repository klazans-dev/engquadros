/**
 * Dashboard BI gerencial — EngQuadros
 * KPIs e gráficos Chart.js. Selects do Supabase em buscarObras / buscarOrcamentos /
 * buscarClientes / buscarChamados. Se a consulta falhar ou vier vazia, usa mocks
 * de demonstração para a diretoria visualizar o layout.
 */
(function (global) {
    'use strict';

    var supabaseClient = EqSec.criarClienteSupabase();
    var empresaId = sessionStorage.getItem('empresaId');
    var chartInstances = {};
    var estado = {
        obras: [],
        orcamentos: [],
        clientes: [],
        chamados: [],
        demoObras: false,
        demoOrc: false,
        demoChamados: false
    };

    var CORES = {
        marca: '#0b1c35',
        sutil: '#2b5c92',
        sucesso: '#10b981',
        alerta: '#f59e0b',
        erro: '#ef4444',
        ciano: '#06b6d4',
        cobre: '#c2782a',
        slate: '#64748b',
        mt: '#0ea5e9'
    };

    var FUNIL_ORDEM = ['PENDENTE', 'ENVIADO', 'APROVADO', 'CANCELADO'];
    var FUNIL_COR = {
        PENDENTE: CORES.slate,
        ENVIADO: CORES.sutil,
        APROVADO: CORES.sucesso,
        CANCELADO: CORES.erro
    };

    /* ---------- mocks (substituídos quando o select retornar linhas) ---------- */

    function mocksOrcamentos() {
        return [
            { numero: 'ORC-2026-041', cliente_nome: 'Usina Vale Verde S.A.', cliente_cnpj: '11.222.333/0001-44', situacao: 'APROVADO', total_venda: 486000, criado_em: '2026-07-12', modalidade: 'industrializacao', projeto: 'QGBT Subestação 3' },
            { numero: 'ORC-2026-038', cliente_nome: 'Metalúrgica Horizonte Ltda.', cliente_cnpj: '22.333.444/0001-55', situacao: 'APROVADO', total_venda: 312400, criado_em: '2026-06-03', modalidade: 'industrializacao', projeto: 'CCM Laminador' },
            { numero: 'ORC-2026-052', cliente_nome: 'Cimento Norte S.A.', cliente_cnpj: '33.444.555/0001-66', situacao: 'ENVIADO', total_venda: 198750, criado_em: '2026-08-18', modalidade: 'industrializacao', projeto: 'Painéis forno 2' },
            { numero: 'ORC-2026-055', cliente_nome: 'Agroindústria Rio Claro', cliente_cnpj: '44.555.666/0001-77', situacao: 'PENDENTE', total_venda: 87400, criado_em: '2026-08-26', modalidade: 'simples', projeto: 'Reposicao disjuntores' },
            { numero: 'ORC-2026-049', cliente_nome: 'Porto Atlântico Logística', cliente_cnpj: '55.666.777/0001-88', situacao: 'APROVADO', total_venda: 254900, criado_em: '2026-08-02', modalidade: 'industrializacao', projeto: 'Eletrocentro pátio 4' },
            { numero: 'ORC-2026-033', cliente_nome: 'Saneamento Municipal SPE', cliente_cnpj: '66.777.888/0001-99', situacao: 'CANCELADO', total_venda: 141200, criado_em: '2026-05-21', modalidade: 'industrializacao', projeto: 'CCM ETA' },
            { numero: 'ORC-2026-057', cliente_nome: 'Usina Vale Verde S.A.', cliente_cnpj: '11.222.333/0001-44', situacao: 'ENVIADO', total_venda: 167800, criado_em: '2026-08-28', modalidade: 'simples', projeto: 'Spare QGBT' }
        ];
    }

    function mocksObras() {
        var hoje = new Date();
        function iso(offsetDias) {
            var d = new Date(hoje);
            d.setDate(d.getDate() + offsetDias);
            return d.toISOString().slice(0, 10);
        }
        return [
            { id: 'm1', nome_obra: 'QGBT Subestação 3', cliente_cnpj: '11.222.333/0001-44', progresso: 72, etapa_pcp_id: 'e3', status_kanban: 'em_fabricacao', data_fim: iso(18), data_inicio: iso(-40), codigo_orcamento: 'ORC-2026-041' },
            { id: 'm2', nome_obra: 'CCM Laminador', cliente_cnpj: '22.333.444/0001-55', progresso: 48, etapa_pcp_id: 'e2', status_kanban: 'aguardando_pecas', data_fim: iso(-3), data_inicio: iso(-55), codigo_orcamento: 'ORC-2026-038' },
            { id: 'm3', nome_obra: 'Eletrocentro pátio 4', cliente_cnpj: '55.666.777/0001-88', progresso: 91, etapa_pcp_id: 'e5', status_kanban: 'ensaios', data_fim: iso(8), data_inicio: iso(-70), codigo_orcamento: 'ORC-2026-049' },
            { id: 'm4', nome_obra: 'Painel comando silos', cliente_cnpj: '44.555.666/0001-77', progresso: 0, etapa_pcp_id: null, status_kanban: 'aguardando_engenharia', data_fim: iso(45), data_inicio: iso(0), codigo_orcamento: 'ORC-2026-055' },
            { id: 'm5', nome_obra: 'Cubículo MT forno 2', cliente_cnpj: '33.444.555/0001-66', progresso: 28, etapa_pcp_id: 'e1', status_kanban: 'em_fabricacao', data_fim: iso(22), data_inicio: iso(-20), codigo_orcamento: 'ORC-2026-052' },
            { id: 'm6', nome_obra: 'QGBT Administrativo', cliente_cnpj: '22.333.444/0001-55', progresso: 100, etapa_pcp_id: 'e6', status_kanban: 'finalizado', data_fim: iso(-12), data_inicio: iso(-90), codigo_orcamento: 'ORC-2026-021' }
        ];
    }

    function mocksClientes() {
        return [
            { cnpj: '11222333000144', razao_social: 'Usina Vale Verde S.A.', status: 'ativo' },
            { cnpj: '22333444000155', razao_social: 'Metalúrgica Horizonte Ltda.', status: 'ativo' },
            { cnpj: '33444555000166', razao_social: 'Cimento Norte S.A.', status: 'ativo' },
            { cnpj: '44555666000177', razao_social: 'Agroindústria Rio Claro', status: 'ativo' },
            { cnpj: '55666777000188', razao_social: 'Porto Atlântico Logística', status: 'ativo' },
            { cnpj: '66777888000199', razao_social: 'Saneamento Municipal SPE', status: 'ativo' }
        ];
    }

    function mocksChamados() {
        return [
            { status: 'resolvido' }, { status: 'resolvido' }, { status: 'fechado' },
            { status: 'aberto' }, { status: 'em andamento' }
        ];
    }

    /* ---------- util ---------- */

    function num(v) {
        var n = Number(v);
        return isFinite(n) ? n : 0;
    }

    function sit(o) {
        return String((o && o.situacao) || 'PENDENTE').toUpperCase();
    }

    function fmtBRL(v) {
        return num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function fmtData(iso) {
        if (!iso) return '—';
        var p = String(iso).slice(0, 10).split('-');
        if (p.length !== 3) return String(iso);
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function hojeISO() {
        return new Date().toISOString().slice(0, 10);
    }

    function dataObra(o) {
        return o.data_fim || o.previsao_entrega || o.data_inicio || o.criado_em || '';
    }

    function dataOrc(o) {
        return o.criado_em || o.atualizado_em || '';
    }

    function noPeriodo(isoStr, periodo) {
        if (!periodo || periodo === 'todos') return true;
        if (!isoStr) return true;
        var d = new Date(isoStr);
        if (isNaN(d.getTime())) return true;
        var agora = new Date();
        if (periodo === 'mes') {
            return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
        }
        if (periodo === 'trimestre') {
            var dif = (agora.getFullYear() - d.getFullYear()) * 12 + (agora.getMonth() - d.getMonth());
            return dif >= 0 && dif <= 3;
        }
        return true;
    }

    function periodoAtual() {
        var el = document.getElementById('filtroPeriodo');
        return el ? el.value : 'todos';
    }

    function textoFiltro() {
        var el = document.getElementById('filtroTexto');
        return String((el && el.value) || '').toLowerCase().trim();
    }

    function passaTexto(blob) {
        var t = textoFiltro();
        if (!t) return true;
        return String(blob || '').toLowerCase().indexOf(t) >= 0;
    }

    function obrasFiltradas() {
        var p = periodoAtual();
        return estado.obras.filter(function (o) {
            if (!noPeriodo(dataObra(o), p)) return false;
            return passaTexto([
                o.nome_obra, o.codigo_orcamento, o.numero_orcamento, o.cliente_cnpj, nomeCliente(o.cliente_cnpj)
            ].join(' '));
        });
    }

    function orcFiltrados() {
        var p = periodoAtual();
        return estado.orcamentos.filter(function (o) {
            if (!noPeriodo(dataOrc(o), p)) return false;
            return passaTexto([
                o.numero, o.cliente_nome, o.cliente_cnpj, o.projeto, o.modalidade, o.situacao
            ].join(' '));
        });
    }

    function nomeCliente(cnpjOuNome) {
        if (!cnpjOuNome) return 'Sem cliente';
        var str = String(cnpjOuNome).trim();
        var dig = str.replace(/\D/g, '');
        var low = str.toLowerCase();
        var hit = (estado.clientes || []).find(function (c) {
            var cDig = String(c.cnpj || '').replace(/\D/g, '');
            if (cDig && dig && cDig === dig) return true;
            if (c.razao_social && String(c.razao_social).toLowerCase() === low) return true;
            return false;
        });
        if (hit && hit.razao_social) return hit.razao_social;
        return str;
    }

    function setTxt(id, txt) {
        var el = document.getElementById(id);
        if (el) el.textContent = txt;
    }

    function setHtml(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    /* Ponto de conexão: altere o select abaixo quando o schema do tenant divergir. */
    async function selectComFallback(tabela, selects, extra) {
        var i;
        var res;
        for (i = 0; i < selects.length; i++) {
            var q = supabaseClient.from(tabela).select(selects[i]).eq('empresa_id', empresaId);
            if (extra) q = extra(q);
            res = await q;
            if (!res.error) return res.data || [];
        }
        console.warn('BI: falha em ' + tabela, res && res.error);
        return null;
    }

    async function buscarOrcamentos() {
        return selectComFallback('orcamentos', [
            'id, numero, cliente_nome, cliente_cnpj, situacao, total_venda, criado_em, modalidade, projeto',
            'id, numero, cliente_nome, cliente_cnpj, situacao, total_venda, criado_em, projeto',
            'id, numero, cliente_nome, cliente_cnpj, situacao, total_venda, criado_em'
        ], function (q) {
            return q.order('criado_em', { ascending: false }).limit(500);
        });
    }

    async function buscarObras() {
        return selectComFallback('obras', ['*'], function (q) {
            return q.order('id', { ascending: false }).limit(800);
        });
    }

    async function buscarClientes() {
        return selectComFallback('clientes', [
            'cnpj, razao_social, status',
            'cnpj, razao_social'
        ]);
    }

    async function buscarChamados() {
        return selectComFallback('chamados_suporte', ['*']);
    }

    /* ---------- classificação de projeto ---------- */

    function classificarStatusObra(o) {
        var p = num(o.progresso);
        var k = String(o.status_kanban || '').toLowerCase();
        if (p >= 100 || k === 'finalizado' || k === 'expedido') return 'Finalizado';
        if (/peca|peça|aguardando_pecas/.test(k)) return 'Aguardando peças';
        if (!o.etapa_pcp_id && p === 0) return 'Novos';
        if (p >= 85 || k === 'ensaios' || k === 'teste' || k === 'qa') return 'Ensaios / QA';
        if (p > 0 || o.etapa_pcp_id) return 'Em fabricação';
        return 'Aguardando engenharia';
    }

    function obraEmAndamento(o) {
        var p = num(o.progresso);
        return p > 0 && p < 100;
    }

    function obraAtrasada(o) {
        var p = num(o.progresso);
        var fim = o.data_fim || o.previsao_entrega;
        if (p >= 100 || !fim) return false;
        return String(fim).slice(0, 10) < hojeISO();
    }

    function mixPainel(nome) {
        var n = String(nome || '').toLowerCase();
        if (/qgbt|baixa tens|distribui/.test(n)) return 'QGBT (BT)';
        if (/\bccm\b|motor|comando/.test(n)) return 'CCM';
        if (/média|media tens|\bmt\b|cubículo|cubiculo|subesta|spcs/.test(n)) return 'Média tensão';
        if (/eletrocentro|container|skid/.test(n)) return 'Eletrocentro';
        return 'Outros painéis';
    }

    /* ---------- charts ---------- */

    function destruirCharts() {
        Object.keys(chartInstances).forEach(function (k) {
            if (chartInstances[k]) {
                chartInstances[k].destroy();
                chartInstances[k] = null;
            }
        });
    }

    function optsBarra() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, ticks: { callback: function (v) { return fmtBRL(v); } }, grid: { color: 'rgba(11,28,53,0.06)' } },
                y: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' } } }
            }
        };
    }

    function optsDonut() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, family: 'Inter' }, padding: 12 } }
            }
        };
    }

    function montarChart(id, config) {
        var canvas = document.getElementById(id);
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartInstances[id]) {
            chartInstances[id].destroy();
        }
        chartInstances[id] = new Chart(canvas.getContext('2d'), config);
    }

    function redimensionarCharts() {
        Object.keys(chartInstances).forEach(function (k) {
            if (chartInstances[k] && typeof chartInstances[k].resize === 'function') {
                chartInstances[k].resize();
            }
        });
    }

    /* ---------- agregações comerciais ---------- */

    function receitaPorCliente(orcs) {
        var mapa = {};
        orcs.filter(function (o) { return sit(o) === 'APROVADO'; }).forEach(function (o) {
            var nome = o.cliente_nome || nomeCliente(o.cliente_cnpj);
            if (!mapa[nome]) mapa[nome] = 0;
            mapa[nome] += num(o.total_venda);
        });
        return Object.keys(mapa).map(function (k) {
            return { nome: k, valor: mapa[k] };
        }).sort(function (a, b) { return b.valor - a.valor; });
    }

    function countsFunil(orcs) {
        var c = { PENDENTE: 0, ENVIADO: 0, APROVADO: 0, CANCELADO: 0 };
        orcs.forEach(function (o) {
            var s = sit(o);
            if (c[s] === undefined) c[s] = 0;
            c[s] += 1;
        });
        return c;
    }

    /* ---------- render KPIs visão geral ---------- */

    function renderKpisVisao(orcs, obras) {
        var previsto = 0;
        var realizado = 0;
        var emitidos = 0;
        var fechados = 0;

        orcs.forEach(function (o) {
            var s = sit(o);
            var v = num(o.total_venda);
            if (s === 'CANCELADO') return;
            emitidos += 1;
            if (s === 'APROVADO') {
                fechados += 1;
                realizado += v;
            } else {
                previsto += v;
            }
        });

        var taxa = emitidos > 0 ? (fechados / emitidos) * 100 : 0;
        var andamento = obras.filter(obraEmAndamento).length;
        var novos = obras.filter(function (o) { return num(o.progresso) === 0; }).length;
        var abertos = obras.filter(function (o) { return num(o.progresso) < 100; });
        var atrasados = abertos.filter(obraAtrasada).length;
        var noPrazo = abertos.length - atrasados;
        var saude = abertos.length > 0 ? (noPrazo / abertos.length) * 100 : 100;
        var cobertura = (previsto + realizado) > 0 ? (realizado / (previsto + realizado)) * 100 : 0;

        setTxt('kpiFatPrev', fmtBRL(previsto));
        setTxt('kpiFatReal', fmtBRL(realizado));
        var bar = document.getElementById('kpiFatBar');
        if (bar) bar.style.width = Math.min(100, cobertura).toFixed(0) + '%';
        setTxt('kpiFatTexto', fechados + ' aprovado(s) · pipeline ' + fmtBRL(previsto));

        setTxt('kpiConversao', taxa.toFixed(1).replace('.', ',') + '%');
        setTxt('kpiConversaoTexto', fechados + ' fechados em ' + emitidos + ' emitidos (exclui cancelados)');

        setTxt('kpiProjetosAndamento', String(andamento));
        setTxt('kpiProjetosTexto', novos + ' ainda não iniciados · ' + obras.length + ' no recorte');

        setTxt('kpiSaudePrazos', saude.toFixed(1).replace('.', ',') + '%');
        var elPrazo = document.getElementById('kpiPrazosTexto');
        if (elPrazo) {
            if (atrasados > 0) {
                elPrazo.innerHTML = '<span style="color:var(--erro);font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ' + atrasados + ' fora do prazo</span>';
            } else {
                elPrazo.innerHTML = '<span style="color:var(--sucesso);font-weight:700;"><i class="fa-solid fa-circle-check"></i> Todos no cronograma</span>';
            }
        }
    }

    function renderRankingEAlertas(orcs, obras) {
        var ranking = receitaPorCliente(orcs).slice(0, 5);
        var ol = document.getElementById('listaRankingClientes');
        if (ol) {
            if (!ranking.length) {
                ol.innerHTML = '<li class="ranking-vazio">Sem orçamentos aprovados no período.</li>';
            } else {
                var max = ranking[0].valor || 1;
                ol.innerHTML = ranking.map(function (r, i) {
                    var pct = Math.round((r.valor / max) * 100);
                    return '<li>' +
                        '<div class="ranking-topo"><span class="ranking-pos">' + (i + 1) + '</span>' +
                        '<strong>' + EqSec.escapeHtml(r.nome) + '</strong>' +
                        '<em>' + fmtBRL(r.valor) + '</em></div>' +
                        '<div class="kpi-track"><span style="width:' + pct + '%"></span></div>' +
                        '</li>';
                }).join('');
            }
        }

        var alerts = [];
        var atrasados = obras.filter(obraEmAndamento).filter(obraAtrasada);
        if (atrasados.length) {
            alerts.push({ tipo: 'risco', icon: 'fa-triangle-exclamation', txt: atrasados.length + ' projeto(s) em fabricação com data de entrega vencida.' });
        } else {
            alerts.push({ tipo: 'ok', icon: 'fa-circle-check', txt: 'Nenhum painel em linha com prazo vencido no recorte.' });
        }
        var pecas = obras.filter(function (o) { return classificarStatusObra(o) === 'Aguardando peças'; });
        if (pecas.length) {
            alerts.push({ tipo: '', icon: 'fa-boxes-stacked', txt: pecas.length + ' painel(is) aguardando peças — risco de ociosidade na montagem.' });
        }
        var enviados = orcs.filter(function (o) { return sit(o) === 'ENVIADO'; });
        if (enviados.length) {
            alerts.push({ tipo: '', icon: 'fa-paper-plane', txt: enviados.length + ' proposta(s) enviada(s) aguardando fechamento comercial.' });
        }
        var novos = obras.filter(function (o) { return !o.etapa_pcp_id && num(o.progresso) === 0; });
        if (novos.length) {
            alerts.push({ tipo: '', icon: 'fa-clipboard-list', txt: novos.length + ' obra(s) em Status Novos — ainda sem início de produção.' });
        }

        var box = document.getElementById('listaAlertas');
        if (box) {
            box.innerHTML = alerts.map(function (a) {
                return '<div class="alerta-item ' + a.tipo + '"><i class="fa-solid ' + a.icon + '"></i><span>' + EqSec.escapeHtml(a.txt) + '</span></div>';
            }).join('');
        }
    }

    function renderChartsVisao(orcs, obras) {
        var ranking = receitaPorCliente(orcs).slice(0, 8);
        if (!ranking.length) ranking = [{ nome: 'Sem aprovados', valor: 0 }];

        montarChart('chartReceitaClientes', {
            type: 'bar',
            data: {
                labels: ranking.map(function (r) { return r.nome.length > 28 ? r.nome.slice(0, 26) + '…' : r.nome; }),
                datasets: [{
                    label: 'Receita aprovada',
                    data: ranking.map(function (r) { return r.valor; }),
                    backgroundColor: CORES.sutil,
                    borderRadius: 6,
                    barThickness: 18
                }]
            },
            options: optsBarra()
        });

        var buckets = {
            'Novos': 0,
            'Aguardando engenharia': 0,
            'Aguardando peças': 0,
            'Em fabricação': 0,
            'Ensaios / QA': 0,
            'Finalizado': 0
        };
        obras.forEach(function (o) {
            var st = classificarStatusObra(o);
            if (buckets[st] === undefined) buckets[st] = 0;
            buckets[st] += 1;
        });
        var labels = Object.keys(buckets);
        var data = labels.map(function (k) { return buckets[k]; });
        if (obras.length === 0) {
            labels = ['Sem projetos'];
            data = [1];
        }

        montarChart('chartStatusProjetos', {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [CORES.slate, CORES.cobre, CORES.alerta, CORES.sutil, CORES.ciano, CORES.sucesso],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: optsDonut()
        });
    }

    /* ---------- comercial ---------- */

    function renderKpisComercial(orcs) {
        var pipeline = 0;
        var aprovadosVal = 0;
        var nAprov = 0;
        var nCanc = 0;
        orcs.forEach(function (o) {
            var s = sit(o);
            var v = num(o.total_venda);
            if (s === 'PENDENTE' || s === 'ENVIADO') pipeline += v;
            if (s === 'APROVADO') { aprovadosVal += v; nAprov += 1; }
            if (s === 'CANCELADO') nCanc += 1;
        });
        setTxt('kpiPipeline', fmtBRL(pipeline));
        setTxt('kpiTicket', fmtBRL(nAprov ? aprovadosVal / nAprov : 0));
        setTxt('kpiTicketTexto', nAprov + ' fechamento(s) no recorte');
        setTxt('kpiEmitidos', String(orcs.length));
        setTxt('kpiEmitidosTexto', 'Inclui cancelados para o volume total');
        setTxt('kpiCancelados', String(nCanc));
    }

    function renderFunil(orcs) {
        var c = countsFunil(orcs);
        var max = Math.max.apply(null, FUNIL_ORDEM.map(function (k) { return c[k] || 0; })) || 1;
        var labels = { PENDENTE: 'Pendente', ENVIADO: 'Enviado', APROVADO: 'Aprovado', CANCELADO: 'Cancelado' };
        var box = document.getElementById('funilOrcamentos');
        if (box) {
            box.innerHTML = FUNIL_ORDEM.map(function (k) {
                var q = c[k] || 0;
                var pct = Math.round((q / max) * 100);
                return '<div class="funil-linha">' +
                    '<em>' + labels[k] + '</em>' +
                    '<div class="funil-barra"><i style="width:' + pct + '%;background:' + FUNIL_COR[k] + '"></i></div>' +
                    '<strong>' + q + '</strong></div>';
            }).join('');
        }
        montarChart('chartFunilOrc', {
            type: 'bar',
            data: {
                labels: FUNIL_ORDEM.map(function (k) { return labels[k]; }),
                datasets: [{
                    label: 'Qtd',
                    data: FUNIL_ORDEM.map(function (k) { return c[k] || 0; }),
                    backgroundColor: FUNIL_ORDEM.map(function (k) { return FUNIL_COR[k]; }),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });

        var simples = 0;
        var ind = 0;
        orcs.forEach(function (o) {
            if (String(o.modalidade || '').toLowerCase() === 'simples') simples += 1;
            else ind += 1;
        });
        montarChart('chartModalidade', {
            type: 'doughnut',
            data: {
                labels: ['Industrialização', 'Simples'],
                datasets: [{
                    data: [ind, simples],
                    backgroundColor: [CORES.marca, CORES.ciano],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: optsDonut()
        });
    }

    function badgeSit(s) {
        var cls = 'status-pendente';
        if (s === 'APROVADO') cls = 'status-ok';
        else if (s === 'ENVIADO') cls = 'status-andamento';
        else if (s === 'CANCELADO') cls = 'status-atraso';
        return '<span class="badge-status ' + cls + '">' + EqSec.escapeHtml(s) + '</span>';
    }

    function tagMod(m) {
        var simples = String(m || '').toLowerCase() === 'simples';
        return '<span class="tag-tipo ' + (simples ? 'simples' : 'industrializacao') + '">' +
            (simples ? 'Simples' : 'Industrialização') + '</span>';
    }

    function renderTabelaOrc() {
        var corpo = document.getElementById('tabelaOrcCorpo');
        if (!corpo) return;
        var termo = ((document.getElementById('buscaOrcTabela') || {}).value || '').toLowerCase();
        var sitF = ((document.getElementById('filtroSitTabela') || {}).value || 'todos');
        var lista = orcFiltrados().filter(function (o) {
            if (sitF !== 'todos' && sit(o) !== sitF) return false;
            var blob = [o.numero, o.cliente_nome, o.projeto, o.cliente_cnpj].join(' ').toLowerCase();
            return !termo || blob.indexOf(termo) >= 0;
        });
        if (!lista.length) {
            corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--texto-secundario);">Nenhum orçamento neste filtro.</td></tr>';
            return;
        }
        corpo.innerHTML = lista.slice(0, 40).map(function (o) {
            return '<tr>' +
                '<td><strong>' + EqSec.escapeHtml(o.numero || '—') + '</strong></td>' +
                '<td>' + EqSec.escapeHtml(o.cliente_nome || nomeCliente(o.cliente_cnpj)) + '</td>' +
                '<td>' + tagMod(o.modalidade) + '</td>' +
                '<td>' + badgeSit(sit(o)) + '</td>' +
                '<td>' + fmtBRL(o.total_venda) + '</td>' +
                '<td>' + fmtData(dataOrc(o)) + '</td>' +
                '</tr>';
        }).join('');
    }

    /* ---------- produção ---------- */

    function renderKpisProducao(obras, chamados) {
        var total = obras.length;
        var concluidas = obras.filter(function (o) { return num(o.progresso) >= 100; }).length;
        var andamento = obras.filter(obraEmAndamento).length;
        var soma = 0;
        obras.forEach(function (o) { soma += num(o.progresso); });
        var media = total ? soma / total : 0;
        var abertos = chamados.filter(function (c) {
            var s = String(c.status || '').toLowerCase();
            return s === 'aberto' || s === 'em andamento' || s === 'pendente';
        }).length;
        var resolvidos = chamados.filter(function (c) {
            var s = String(c.status || '').toLowerCase();
            return s === 'resolvido' || s === 'fechado';
        }).length;

        setTxt('kpiTotalObras', String(total));
        setTxt('kpiObrasLinha', andamento + ' em linha de produção');
        setTxt('kpiConcluidas', String(concluidas));
        setTxt('kpiAvancoMedio', media.toFixed(1).replace('.', ',') + '%');
        setTxt('kpiChamadosAbertos', String(abertos));
        setTxt('kpiChamadosTexto', resolvidos + ' resolvidos no recorte');
    }

    function renderChartsProducao(obras, chamados) {
        var etapa = [0, 0, 0, 0, 0, 0];
        obras.forEach(function (o) {
            var p = num(o.progresso);
            if (p <= 15) etapa[0]++;
            else if (p <= 35) etapa[1]++;
            else if (p <= 65) etapa[2]++;
            else if (p <= 85) etapa[3]++;
            else if (p < 100) etapa[4]++;
            else etapa[5]++;
        });
        montarChart('chartEtapasPcp', {
            type: 'bar',
            data: {
                labels: ['Engenharia', 'Separação', 'Barramento', 'Fiação / CLP', 'Ensaios QA', 'Expedido'],
                datasets: [{
                    label: 'Painéis',
                    data: etapa,
                    backgroundColor: [CORES.slate, CORES.mt, CORES.sutil, CORES.cobre, CORES.alerta, CORES.sucesso],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });

        var mix = { 'QGBT (BT)': 0, 'CCM': 0, 'Média tensão': 0, 'Eletrocentro': 0, 'Outros painéis': 0 };
        obras.forEach(function (o) { mix[mixPainel(o.nome_obra)] += 1; });
        montarChart('chartMixPaineis', {
            type: 'doughnut',
            data: {
                labels: Object.keys(mix),
                datasets: [{
                    data: Object.keys(mix).map(function (k) { return mix[k]; }),
                    backgroundColor: [CORES.marca, CORES.sutil, CORES.mt, CORES.sucesso, '#cbd5e1'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: optsDonut()
        });

        var meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        var entregas = new Array(12).fill(0);
        var ativas = new Array(12).fill(0);
        obras.forEach(function (o) {
            var raw = o.data_fim || o.previsao_entrega || o.data_inicio;
            var mes = raw ? new Date(raw).getMonth() : new Date().getMonth();
            if (mes >= 0 && mes < 12) {
                if (num(o.progresso) >= 100) entregas[mes]++;
                else ativas[mes]++;
            }
        });
        montarChart('chartEntregasMes', {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Entregas concluídas',
                        data: entregas,
                        borderColor: CORES.sucesso,
                        backgroundColor: 'rgba(16,185,129,0.12)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    },
                    {
                        label: 'Em fabricação',
                        data: ativas,
                        borderColor: CORES.sutil,
                        backgroundColor: 'rgba(43,92,146,0.08)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });

        var chRes = chamados.filter(function (c) {
            var s = String(c.status || '').toLowerCase();
            return s === 'resolvido' || s === 'fechado';
        }).length;
        var chAb = chamados.filter(function (c) {
            var s = String(c.status || '').toLowerCase();
            return s === 'aberto' || s === 'em andamento' || s === 'pendente';
        }).length;
        montarChart('chartChamados', {
            type: 'doughnut',
            data: {
                labels: ['Resolvidos', 'Em atendimento'],
                datasets: [{
                    data: [chRes, chAb],
                    backgroundColor: [CORES.sucesso, CORES.alerta],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: optsDonut()
        });
    }

    function badgeEtapa(ok, andamento, labelOk, labelAnd) {
        if (ok) return '<span class="badge-status status-ok"><i class="fa-solid fa-check"></i> ' + labelOk + '</span>';
        if (andamento) return '<span class="badge-status status-andamento">' + labelAnd + '</span>';
        return '<span class="badge-status status-na">—</span>';
    }

    function renderTabelaPcp(obras) {
        var corpo = document.getElementById('tabelaPcpCorpo');
        if (!corpo) return;
        if (!obras.length) {
            corpo.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--texto-secundario);">Nenhum projeto no recorte.</td></tr>';
            return;
        }
        corpo.innerHTML = obras.map(function (obra) {
            var prog = num(obra.progresso);
            var dFim = obra.data_fim || obra.previsao_entrega;
            var nomeCli = nomeCliente(obra.cliente_cnpj);
            var atraso = obraAtrasada(obra);
            var stSep = badgeEtapa(prog >= 20, false, 'OK', '');
            var stMec = badgeEtapa(prog >= 40, prog >= 20, 'Montado', 'Em execução');
            var stBar = badgeEtapa(prog >= 60, prog >= 40, 'Ajustado', 'Dobra/corte');
            var stFia = badgeEtapa(prog >= 80, prog >= 60, 'Fiação 100%', 'Comando');
            var stQA = badgeEtapa(prog >= 95, prog >= 80, 'Aprovado', 'Ensaios');
            var stExp = prog >= 100
                ? '<span class="badge-status status-ok"><i class="fa-solid fa-truck-fast"></i> Expedido</span>'
                : '<span class="badge-status status-na">Fábrica</span>';
            var corBarra = prog >= 100 ? 'background:var(--sucesso);' : (atraso ? 'background:var(--erro);' : '');
            var prazoHtml = atraso
                ? '<span class="badge-status status-atraso">' + fmtData(dFim) + '</span>'
                : EqSec.escapeHtml(fmtData(dFim));

            return '<tr class="linha-obra-item" data-nome="' + EqSec.escapeHtml((obra.nome_obra || '').toLowerCase()) +
                '" data-cliente="' + EqSec.escapeHtml(nomeCli.toLowerCase()) +
                '" data-prog="' + prog + '" data-atraso="' + (atraso ? '1' : '0') + '">' +
                '<td><strong style="color:var(--azul-marca);">' + EqSec.escapeHtml(obra.nome_obra || 'Painel') + '</strong>' +
                (obra.codigo_orcamento ? '<div style="font-size:0.72rem;color:var(--texto-suave);">Cód: ' + EqSec.escapeHtml(obra.codigo_orcamento) + '</div>' : '') +
                '</td>' +
                '<td>' + EqSec.escapeHtml(nomeCli) + '</td>' +
                '<td>' + stSep + '</td><td>' + stMec + '</td><td>' + stBar + '</td><td>' + stFia + '</td><td>' + stQA + '</td><td>' + stExp + '</td>' +
                '<td><div style="font-weight:700;color:var(--azul-marca);">' + prog + '%</div>' +
                '<div class="barra-progresso-mini"><div class="barra-progresso-mini-fill" style="width:' + prog + '%;' + corBarra + '"></div></div></td>' +
                '<td style="white-space:nowrap;font-weight:600;">' + prazoHtml + '</td>' +
                '</tr>';
        }).join('');
        filtrarTabelaPcp();
    }

    function filtrarTabelaPcp() {
        var termo = ((document.getElementById('buscaObraTabela') || {}).value || '').toLowerCase();
        var statusFiltro = ((document.getElementById('filtroStatusTabela') || {}).value || 'todos');
        document.querySelectorAll('.linha-obra-item').forEach(function (linha) {
            var nome = linha.getAttribute('data-nome') || '';
            var cli = linha.getAttribute('data-cliente') || '';
            var prog = parseInt(linha.getAttribute('data-prog') || '0', 10);
            var atraso = linha.getAttribute('data-atraso') === '1';
            var bateBusca = nome.indexOf(termo) >= 0 || cli.indexOf(termo) >= 0;
            var bateStatus = true;
            if (statusFiltro === 'andamento') bateStatus = prog > 0 && prog < 100;
            else if (statusFiltro === 'concluido') bateStatus = prog >= 100;
            else if (statusFiltro === 'novo') bateStatus = prog === 0;
            else if (statusFiltro === 'atraso') bateStatus = atraso;
            linha.style.display = (bateBusca && bateStatus) ? '' : 'none';
        });
    }

    function exportarCsvPcp() {
        var obras = obrasFiltradas();
        if (!obras.length) {
            alert('Sem dados para exportar.');
            return;
        }
        var csv = 'ID;Nome da Obra;Cliente CNPJ;Progresso (%);Data Inicio;Previsao Entrega;Status\n';
        obras.forEach(function (o) {
            csv += '"' + String(o.id || '').replace(/"/g, '""') + '";"' +
                String(o.nome_obra || '').replace(/"/g, '""') + '";"' +
                String(o.cliente_cnpj || '').replace(/"/g, '""') + '";"' +
                num(o.progresso) + '";"' +
                String(o.data_inicio || '') + '";"' +
                String(o.data_fim || o.previsao_entrega || '') + '";"' +
                classificarStatusObra(o) + '"\n';
        });
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Relatorio_PCP_EngQuadros_' + hojeISO() + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /* ---------- orquestração ---------- */

    function atualizarChipFonte() {
        var chip = document.getElementById('chipFonte');
        if (!chip) return;
        var demo = estado.demoObras || estado.demoOrc;
        chip.textContent = demo ? 'Demonstração' : 'Dados ao vivo';
        chip.classList.toggle('demo', demo);
        chip.title = demo
            ? 'Consultas vazias ou indisponíveis — exibindo cenário ilustrativo. Os selects já estão prontos.'
            : 'Números agregados das tabelas orcamentos, obras, clientes e chamados_suporte.';
    }

    function renderTudo() {
        var orcs = orcFiltrados();
        var obras = obrasFiltradas();
        var chamados = estado.chamados;
        destruirCharts();
        renderKpisVisao(orcs, obras);
        renderRankingEAlertas(orcs, obras);
        renderChartsVisao(orcs, obras);
        renderKpisComercial(orcs);
        renderFunil(orcs);
        renderTabelaOrc();
        renderKpisProducao(obras, chamados);
        renderChartsProducao(obras, chamados);
        renderTabelaPcp(obras);
        atualizarChipFonte();
        setTimeout(redimensionarCharts, 60);
    }

    async function carregarIdentidadeTenant() {
        try {
            if (!empresaId) return;
            var res = await supabaseClient
                .from('admin_master')
                .select('nome_fantasia, logo_url, cor_primaria, cor_secundaria')
                .or('empresa_id.eq.' + empresaId + ',id.eq.' + empresaId)
                .limit(1)
                .maybeSingle();
            var tenant = res.data;
            if (!tenant) return;
            if (tenant.nome_fantasia) sessionStorage.setItem('masterNome', tenant.nome_fantasia);
            if (tenant.logo_url) sessionStorage.setItem('masterLogo', tenant.logo_url);
            if (tenant.cor_primaria) sessionStorage.setItem('masterCorPrimaria', tenant.cor_primaria);
            if (tenant.cor_secundaria) sessionStorage.setItem('masterCorSecundaria', tenant.cor_secundaria);
            if (typeof EqNav !== 'undefined') EqNav.aplicarIdentidade();
        } catch (e) {
            console.warn('Identidade do tenant indisponível.', e);
        }
    }

    async function carregarDadosBi() {
        var obras = null;
        var orcs = null;
        var clientes = null;
        var chamados = null;
        if (supabaseClient && empresaId) {
            obras = await buscarObras();
            orcs = await buscarOrcamentos();
            clientes = await buscarClientes();
            chamados = await buscarChamados();
        }

        estado.demoObras = !obras || obras.length === 0;
        estado.demoOrc = !orcs || orcs.length === 0;
        estado.demoChamados = !chamados || chamados.length === 0;

        estado.obras = estado.demoObras ? mocksObras() : obras;
        estado.orcamentos = estado.demoOrc ? mocksOrcamentos() : orcs;
        estado.clientes = (clientes && clientes.length) ? clientes : mocksClientes();
        estado.chamados = estado.demoChamados ? mocksChamados() : chamados;

        renderTudo();
    }

    function abrirAba(id) {
        var mapa = { visao: 'abaVisao', comercial: 'abaComercial', producao: 'abaProducao' };
        var alvo = mapa[id] || 'abaVisao';
        document.querySelectorAll('.nav-aba, .menu-lateral > .menu-btn[data-aba]').forEach(function (btn) {
            var on = btn.getAttribute('data-aba') === id;
            btn.classList.toggle('ativa', on);
            if (btn.classList.contains('nav-aba')) btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.painel-aba').forEach(function (p) {
            p.classList.toggle('ativa', p.id === alvo);
        });
        var menu = document.getElementById('eqMenuPrincipal');
        if (menu) menu.classList.remove('aberto');
        var main = document.querySelector('#telaDashboard > main');
        if (main) main.scrollTop = 0;
        setTimeout(redimensionarCharts, 50);
    }

    function aplicarPermissoesMenu() {
        document.querySelectorAll('[data-perm]').forEach(function (el) {
            if (!EqSec.temPermissao(el.getAttribute('data-perm'))) el.style.display = 'none';
        });
    }

    function init() {
        if (!EqSec.exigirPermissao('relatorios')) return;

        if (typeof EqSessionTimeout !== 'undefined') {
            EqSessionTimeout.iniciar(30 * 60 * 1000, function () {
                sessionStorage.clear();
                window.location.href = 'admin.html';
            });
        }

        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = 'Inter, sans-serif';
            Chart.defaults.color = '#475569';
        }

        aplicarPermissoesMenu();

        document.querySelectorAll('[data-aba]').forEach(function (el) {
            el.addEventListener('click', function () { abrirAba(el.getAttribute('data-aba')); });
        });

        var btnAtu = document.getElementById('btnAtualizarBi');
        if (btnAtu) btnAtu.addEventListener('click', carregarDadosBi);

        var btnPrint = document.getElementById('btnImprimirBi');
        if (btnPrint) btnPrint.addEventListener('click', function () { window.print(); });

        var btnCsv = document.getElementById('btnExportarCsv');
        if (btnCsv) btnCsv.addEventListener('click', exportarCsvPcp);

        var filtro = document.getElementById('filtroPeriodo');
        if (filtro) filtro.addEventListener('change', EqSec.debounce(renderTudo, 180));
        var filtroTxt = document.getElementById('filtroTexto');
        if (filtroTxt) filtroTxt.addEventListener('input', EqSec.debounce(renderTudo, 220));

        var buscaOrc = document.getElementById('buscaOrcTabela');
        if (buscaOrc) buscaOrc.addEventListener('keyup', EqSec.debounce(renderTabelaOrc, 180));
        var sitTabela = document.getElementById('filtroSitTabela');
        if (sitTabela) sitTabela.addEventListener('change', renderTabelaOrc);

        var buscaPcp = document.getElementById('buscaObraTabela');
        if (buscaPcp) buscaPcp.addEventListener('keyup', EqSec.debounce(filtrarTabelaPcp, 180));
        var stPcp = document.getElementById('filtroStatusTabela');
        if (stPcp) stPcp.addEventListener('change', filtrarTabelaPcp);

        carregarIdentidadeTenant();
        carregarDadosBi();
    }

    global.EqDashboard = {
        carregarDadosBi: carregarDadosBi,
        abrirAba: abrirAba,
        buscarOrcamentos: buscarOrcamentos,
        buscarObras: buscarObras
    };

    document.addEventListener('DOMContentLoaded', init);
})(window);
