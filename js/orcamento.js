/**
 * Orçamentos + montagem visual do quadro elétrico.
 */
(function () {
    var KEY_RASCUNHO = 'eq_orcamento_rascunho';
    var CAMPOS_PRODUTO = 'id, nome, sku, tipo, preco_custo, preco_venda, ncm, marca, fabricante, fabricante_id, grupo_produto_id, marca_id, dados_tecnicos';
    var CAMPOS_PRODUTO_MIN = 'id, nome, sku, tipo, preco_custo, preco_venda, ncm, marca, dados_tecnicos';
    var GRUPO_SOLTO = 'solto';

    var supabaseClient = null;
    var empresaId = null;
    var produtoSelecionado = null;
    var lastHitsProdutos = [];
    var itemAtivoIdx = -1;
    var pendingFocusGrupo = null;
    var cacheLista = [];
    var vistaAtual = 'lista';
    var blocosRecolhidos = { cliente: false, plantas: false, bom: false, rodape: true };
    var gruposRecolhidos = {};

    var estado = estadoVazio();
    var emitenteCache = {};
    var clientePrint = {};

    function estadoVazio() {
        var validade = new Date();
        validade.setDate(validade.getDate() + 15);
        return {
            id: null,
            numero: gerarNumero(),
            situacao: 'PENDENTE',
            validade: validade.toISOString().slice(0, 10),
            cliente_cnpj: '',
            cliente_nome: '',
            projeto: '',
            vendedor: '',
            prazo_pagamento: '',
            tipo_frete: 'CIF',
            mao_obra_pct: 0,
            markup_pct: 0,
            margem_minima_pct: 20,
            observacoes: '',
            itens: [],
            paineis: [],
            grupoAtivo: GRUPO_SOLTO,
            montagem: { paineis: [], soltos: { slots: [] }, temEnvelope: false },
            calcSoltos: null,
            comprador: '',
            transportadora: '',
            detalhes_pagto: '',
            obs_entrega: '',
            prazo_entrega_dias: '',
            data_aprov_cliente: '',
            data_limite_entrega: '',
            expedicao: '',
            faturamento: '',
            forma_pagamento: '',
            conta_corrente: '',
            frete_valor: 0,
            frete_custo: 0,
            q_volumes: '',
            n_volumes: '',
            peso_bruto: 0,
            peso_liquido: 0,
            desc_fabricante: '',
            desc_fabricante_pct: 0,
            auth_prazo_expirado: false,
            auth_margem_min: false,
            modalidade: 'industrializacao',
            origem: 'novo'
        };
    }

    function ehSimples() {
        return estado.modalidade === 'simples';
    }

    function inferirModalidade(o) {
        if (!o) return 'industrializacao';
        var m = String(o.modalidade || '').toLowerCase();
        if (m === 'simples' || m === 'industrializacao') return m;
        var c = (o.totais && o.totais.comercial) || {};
        m = String(c.modalidade || '').toLowerCase();
        if (m === 'simples' || m === 'industrializacao') return m;
        if (o.montagem && Array.isArray(o.montagem.paineis) && o.montagem.paineis.length) return 'industrializacao';
        return 'industrializacao';
    }

    function rotuloModalidade(m) {
        return m === 'simples' ? 'Simples' : 'Industrialização';
    }

    function aplicarModoEditor() {
        var ed = document.getElementById('vistaEditor');
        if (ed) {
            ed.classList.toggle('modo-simples', ehSimples());
            ed.classList.toggle('modo-industrial', !ehSimples());
        }
        var tit = document.getElementById('tituloEditorTxt');
        var sub = document.getElementById('subtituloEditorTxt');
        var icon = document.querySelector('#tituloEditorOrc > i');
        if (tit) tit.textContent = ehSimples() ? 'Orçamento simples' : 'Orçamento e planta do quadro';
        if (sub) {
            sub.textContent = ehSimples()
                ? 'Itens, custos e markup — sem montagem visual'
                : 'Cliente · vários painéis · adicionais soltos · BOM';
        }
        if (icon) {
            icon.className = ehSimples() ? 'fa-solid fa-list' : 'fa-solid fa-bolt';
            icon.style.color = 'var(--ciano)';
        }
    }

    function abrirEscolhaTipo() {
        var m = document.getElementById('modalTipoOrc');
        if (m) {
            m.removeAttribute('hidden');
            m.classList.add('aberto');
        }
    }

    function fecharEscolhaTipo() {
        var m = document.getElementById('modalTipoOrc');
        if (m) {
            m.classList.remove('aberto');
            m.setAttribute('hidden', '');
        }
    }

    function gerarNumero() {
        var d = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var r = String(Math.floor(Math.random() * 9000) + 1000);
        return 'ORC-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + r;
    }

    function uid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'loc-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    }

    function idProdutoBanco(v) {
        if (v == null || v === '') return null;
        var s = String(v);
        if (s.indexOf('loc-') === 0) return null;
        return s;
    }

    function mensagemErro(err) {
        if (!err) return 'erro desconhecido';
        return err.message || err.hint || err.details || String(err);
    }


    function toast(msg, erro) {
        var el = document.getElementById('toastOrc');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('erro', !!erro);
        el.classList.add('mostrar');
        setTimeout(function () { el.classList.remove('mostrar'); }, 3200);
    }

    function money(v) {
        return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function num(v) {
        var n = parseFloat(String(v == null ? 0 : v).replace(',', '.'));
        return isFinite(n) ? n : 0;
    }

    function inferirTipo(prod) {
        var t = ((prod.tipo || '') + ' ' + (prod.nome || prod.descricao || '') + ' ' + (prod.sku || '')).toLowerCase();
        if (/quadro|caixa|envelope|gabinete|caixa de comando|caixa de passagem/.test(t)) return 'quadro';
        if (/disjuntor|\bdj\b|\bdr\b|\bidr\b|interruptor diferencial/.test(t)) return 'disjuntor';
        if (/barramento|barra de cobre|busbar/.test(t)) return 'barramento';
        if (/borne/.test(t)) return 'borne';
        if (/cabo|fio|chicote/.test(t)) return 'cabo';
        if (/inversor|soft.?start|contator|rel[eé]|ihm|clp|fonte/.test(t)) return 'dispositivo';
        return 'modulo';
    }

    function corTipo(tipo) {
        return {
            quadro: '#0b1c35',
            disjuntor: '#c2410c',
            barramento: '#c2782a',
            borne: '#64748b',
            cabo: '#0e7490',
            dispositivo: '#1d4ed8',
            modulo: '#475569'
        }[tipo] || '#475569';
    }

    function tagClasse(tipo) {
        if (tipo === 'quadro') return 'tipo-quadro';
        if (tipo === 'disjuntor') return 'tipo-dj';
        if (tipo === 'barramento') return 'tipo-bar';
        return '';
    }

    function extrairEstoque(p) {
        if (!p) return null;
        if (p.estoque != null && p.estoque !== '') return p.estoque;
        var dt = p.dados_tecnicos;
        if (typeof dt === 'string') {
            try { dt = JSON.parse(dt); } catch (e) { dt = null; }
        }
        if (dt && typeof dt === 'object') {
            if (dt.estoque != null) return dt.estoque;
            if (dt.est_atual != null) return dt.est_atual;
        }
        return null;
    }

    function tipoItem(it) {
        return it.tipoVisual || inferirTipo(it);
    }

    function grupoDoItem(it) {
        return it.grupo_id || GRUPO_SOLTO;
    }

    function criarPainel(nome) {
        if (ehSimples()) {
            estado.grupoAtivo = GRUPO_SOLTO;
            return { id: GRUPO_SOLTO, nome: 'Itens', calc: estado.calcSoltos || calcPadrao() };
        }
        var n = estado.paineis.length + 1;
        var painel = {
            id: uid(),
            nome: (nome || ('Painel ' + n)).slice(0, 80),
            calc: calcPadrao()
        };
        estado.paineis.forEach(function (p) { gruposRecolhidos[p.id] = true; });
        estado.paineis.push(painel);
        gruposRecolhidos[painel.id] = false;
        estado.grupoAtivo = painel.id;
        return painel;
    }

    function nomeDoGrupo(grupoId) {
        if (!grupoId || grupoId === GRUPO_SOLTO) return ehSimples() ? 'Itens do orçamento' : 'Adicionais / itens soltos';
        var p = estado.paineis.filter(function (x) { return x.id === grupoId; })[0];
        return (p && p.nome) || 'Painel';
    }

    function migrarItensSemGrupo() {
        if (ehSimples()) {
            estado.itens.forEach(function (it) {
                if (!it.grupo_id || it.grupo_id === 'novo') it.grupo_id = GRUPO_SOLTO;
            });
            estado.grupoAtivo = GRUPO_SOLTO;
            return;
        }
        var ultimoPainel = null;
        estado.itens.forEach(function (it) {
            if (it.grupo_id) {
                if (it.grupo_id !== GRUPO_SOLTO) ultimoPainel = it.grupo_id;
                return;
            }
            if (tipoItem(it) === 'quadro') {
                var p = criarPainel(it.descricao || it.sku || 'Painel');
                it.grupo_id = p.id;
                ultimoPainel = p.id;
            } else {
                it.grupo_id = ultimoPainel || GRUPO_SOLTO;
            }
        });
        estado.paineis = estado.paineis.filter(function (p, i, arr) {
            return arr.findIndex(function (x) { return x.id === p.id; }) === i;
        });
        var conhecidos = {};
        estado.paineis.forEach(function (p) { conhecidos[p.id] = p; });
        estado.itens.forEach(function (it) {
            var g = it.grupo_id;
            if (!g || g === GRUPO_SOLTO || conhecidos[g]) return;
            conhecidos[g] = { id: g, nome: (tipoItem(it) === 'quadro' ? it.descricao : null) || 'Painel', calc: calcPadrao() };
            estado.paineis.push(conhecidos[g]);
        });
        if (!estado.grupoAtivo) {
            estado.grupoAtivo = (estado.paineis[0] && estado.paineis[0].id) || GRUPO_SOLTO;
        }
    }

    function itensDoGrupo(grupoId) {
        return estado.itens.map(function (it, idx) {
            return { it: it, idx: idx };
        }).filter(function (x) { return grupoDoItem(x.it) === grupoId; });
    }

    /* ---------- layout visual (um gabinete por grupo) ---------- */
    function layoutGrupo(pares) {
        var INNER_X = 42;
        var INNER_W = 196;
        var y = 78;
        var slots = [];
        var envelope = null;

        pares.forEach(function (p) {
            if (tipoItem(p.it) === 'quadro' && !envelope) envelope = p;
        });

        if (envelope) {
            slots.push({
                sku: envelope.it.sku || '',
                nome: envelope.it.descricao || envelope.it.nome || '',
                tipo: 'quadro',
                x: 16, y: 12, w: 248, h: 260,
                cor: corTipo('quadro'),
                idx: envelope.idx
            });
        }

        pares.forEach(function (p) {
            var it = p.it;
            var idx = p.idx;
            var tipo = tipoItem(it);
            if (tipo === 'quadro') return;
            var qtd = Math.max(1, Math.round(num(it.qtde)));
            var vis = Math.min(qtd, tipo === 'dispositivo' ? 4 : 8);

            if (tipo === 'barramento' || tipo === 'cabo' || tipo === 'borne') {
                var h = tipo === 'barramento' ? 16 : 22;
                slots.push({
                    sku: it.sku || '', nome: it.descricao, tipo: tipo,
                    x: INNER_X, y: y, w: INNER_W, h: h,
                    cor: corTipo(tipo), idx: idx, qtde: qtd
                });
                y += h + 10;
                return;
            }

            var wMod = tipo === 'dispositivo' ? 92 : 36;
            var gap = 6;
            var x = INNER_X;
            var rowH = tipo === 'dispositivo' ? 44 : 40;
            for (var i = 0; i < vis; i++) {
                if (x + wMod > INNER_X + INNER_W) {
                    x = INNER_X;
                    y += rowH + 8;
                }
                slots.push({
                    sku: it.sku || '', nome: it.descricao, tipo: tipo,
                    x: x, y: y, w: wMod, h: rowH - 4,
                    cor: corTipo(tipo), idx: idx, qtde: qtd
                });
                x += wMod + gap;
            }
            y += rowH + 8;
        });

        var altura = Math.max(envelope ? 300 : 260, y + 48);
        if (slots[0] && slots[0].tipo === 'quadro') slots[0].h = altura - 20;

        return { slots: slots, temEnvelope: !!envelope, altura: altura };
    }

    function processarLayout() {
        migrarItensSemGrupo();
        var paineis = estado.paineis.map(function (p) {
            var lay = layoutGrupo(itensDoGrupo(p.id));
            return {
                id: p.id,
                nome: p.nome,
                obra_id: p.obra_id || null,
                calc: Object.assign(calcPadrao(), p.calc || {}),
                slots: lay.slots,
                temEnvelope: lay.temEnvelope,
                altura: lay.altura
            };
        });
        var soltosLay = layoutGrupo(itensDoGrupo(GRUPO_SOLTO));
        return {
            paineis: paineis,
            soltos: {
                slots: soltosLay.slots,
                temEnvelope: false,
                altura: soltosLay.altura,
                calc: Object.assign(calcPadrao(), estado.calcSoltos || {})
            },
            temEnvelope: paineis.some(function (p) { return p.temEnvelope; }),
            slots: paineis.reduce(function (acc, p) { return acc.concat(p.slots); }, []).concat(soltosLay.slots)
        };
    }

    function esc(s) {
        return EqSec.escapeHtml(s == null ? '' : s);
    }

    function svgModulo(s, suf) {
        suf = suf || '';
        var x = s.x, y = s.y, w = s.w, h = s.h, c = s.cor;
        var label = esc((s.sku || s.nome || '').slice(0, 10));
        var hit = 'class="slot-hit" data-idx="' + (s.idx == null ? '' : s.idx) + '" style="cursor:pointer"';

        if (s.tipo === 'disjuntor') {
            return '<g ' + hit + '>' +
                '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#1c1917" stroke="' + c + '" stroke-width="1.4"/>' +
                '<rect x="' + (x + 4) + '" y="' + (y + 5) + '" width="' + (w - 8) + '" height="' + (h * 0.38) + '" rx="2" fill="' + c + '"/>' +
                '<rect x="' + (x + w * 0.38) + '" y="' + (y + h * 0.48) + '" width="' + (w * 0.24) + '" height="' + (h * 0.32) + '" rx="1.5" fill="#fbbf24"/>' +
                '<text x="' + (x + w / 2) + '" y="' + (y + h - 3) + '" text-anchor="middle" font-size="5.5" fill="#e2e8f0" font-family="Inter">' + label + '</text>' +
                '</g>';
        }
        if (s.tipo === 'barramento') {
            return '<g ' + hit + '>' +
                '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="url(#gradCobre' + suf + ')" stroke="#92400e"/>' +
                '<circle cx="' + (x + 12) + '" cy="' + (y + h / 2) + '" r="3" fill="#78350f"/>' +
                '<circle cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" r="3" fill="#78350f"/>' +
                '<circle cx="' + (x + w - 12) + '" cy="' + (y + h / 2) + '" r="3" fill="#78350f"/>' +
                '</g>';
        }
        if (s.tipo === 'borne') {
            var boxes = '';
            var n = Math.max(6, Math.min(14, Math.round(w / 14)));
            var bw = (w - 4) / n;
            for (var i = 0; i < n; i++) {
                boxes += '<rect x="' + (x + 2 + i * bw) + '" y="' + (y + 3) + '" width="' + (bw - 2) + '" height="' + (h - 6) + '" rx="1" fill="#e2e8f0" stroke="#94a3b8"/>';
            }
            return '<g ' + hit + '>' + boxes + '</g>';
        }
        if (s.tipo === 'cabo') {
            var y1 = y + 6, y2 = y + h - 4;
            return '<g ' + hit + ' fill="none" stroke-width="2">' +
                '<path d="M' + x + ' ' + y1 + ' C ' + (x + 40) + ' ' + y2 + ', ' + (x + 80) + ' ' + y1 + ', ' + (x + w) + ' ' + y2 + '" stroke="#111827"/>' +
                '<path d="M' + x + ' ' + (y1 + 5) + ' C ' + (x + 50) + ' ' + y1 + ', ' + (x + 90) + ' ' + y2 + ', ' + (x + w) + ' ' + (y1 + 2) + '" stroke="#dc2626"/>' +
                '<path d="M' + x + ' ' + (y1 + 10) + ' C ' + (x + 30) + ' ' + y2 + ', ' + (x + 110) + ' ' + y1 + ', ' + (x + w) + ' ' + y2 + '" stroke="#2563eb"/>' +
                '<path d="M' + (x + 8) + ' ' + y2 + ' C ' + (x + 70) + ' ' + y1 + ', ' + (x + 130) + ' ' + y2 + ', ' + (x + w - 4) + ' ' + y1 + '" stroke="#16a34a"/>' +
                '</g>';
        }
        if (s.tipo === 'dispositivo') {
            return '<g ' + hit + '>' +
                '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="#0f172a" stroke="' + c + '" stroke-width="1.5"/>' +
                '<rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="' + (w - 12) + '" height="10" rx="1" fill="#1e3a5f"/>' +
                '<circle cx="' + (x + 14) + '" cy="' + (y + 24) + '" r="3" fill="#22c55e"/>' +
                '<circle cx="' + (x + 24) + '" cy="' + (y + 24) + '" r="3" fill="#f59e0b"/>' +
                '<text x="' + (x + w / 2) + '" y="' + (y + h - 8) + '" text-anchor="middle" font-size="6.5" fill="#93c5fd" font-family="Montserrat" font-weight="600">' + label + '</text>' +
                '</g>';
        }
        return '<g ' + hit + '>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="#334155" stroke="#94a3b8"/>' +
            '<rect x="' + (x + 3) + '" y="' + (y + 4) + '" width="' + (w - 6) + '" height="6" rx="1" fill="#64748b"/>' +
            '<text x="' + (x + w / 2) + '" y="' + (y + h - 6) + '" text-anchor="middle" font-size="5.5" fill="#e2e8f0" font-family="Inter">' + label + '</text>' +
            '</g>';
    }

    function svgDefs(suf) {
        suf = suf || '';
        return '<defs>' +
            '<linearGradient id="gradMetal' + suf + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#cbd5e1"/><stop offset="45%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#64748b"/>' +
            '</linearGradient>' +
            '<linearGradient id="gradCobre' + suf + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#fbbf24"/><stop offset="50%" stop-color="#c2782a"/><stop offset="100%" stop-color="#92400e"/>' +
            '</linearGradient>' +
            '</defs>';
    }

    function svgInterior(layout, titulo, soltos, suf) {
        suf = suf || '';
        var altura = layout.altura || 280;
        var temEnv = layout.temEnvelope;
        var componentes = (layout.slots || []).filter(function (s) { return s.tipo !== 'quadro'; });
        var inner = '';

        if (!temEnv && componentes.length === 0) {
            inner =
                '<rect x="28" y="24" width="224" height="220" rx="10" fill="none" stroke="#64748b" stroke-dasharray="8 6" stroke-width="2"/>' +
                '<text x="140" y="118" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="Montserrat" font-weight="600">' +
                esc(soltos ? 'Itens soltos' : 'Envelope vazio') + '</text>' +
                '<text x="140" y="138" text-anchor="middle" fill="#64748b" font-size="10" font-family="Inter">' +
                esc(soltos ? 'Adicionais fora dos painéis' : 'Insira o quadro/caixa deste painel') + '</text>';
            altura = 270;
        } else {
            var cabH = altura - 24;
            var cavityH = cabH - 56;
            inner =
                '<rect x="16" y="12" width="248" height="' + cabH + '" rx="8" fill="url(#gradMetal' + suf + ')" stroke="#0b1c35" stroke-width="2.5"/>' +
                '<rect x="22" y="18" width="8" height="' + (cabH - 12) + '" rx="2" fill="#0b1c35" opacity="0.35"/>' +
                '<circle cx="26" cy="40" r="3.2" fill="#94a3b8"/>' +
                '<circle cx="26" cy="' + (cabH - 16) + '" r="3.2" fill="#94a3b8"/>' +
                '<rect x="36" y="36" width="216" height="18" rx="2" fill="#0b1c35"/>' +
                '<text x="144" y="49" text-anchor="middle" fill="#e2e8f0" font-size="8" font-family="Montserrat" font-weight="700">' +
                esc((titulo || (temEnv && layout.slots[0] ? (layout.slots[0].sku || layout.slots[0].nome) : 'MONTAGEM')).slice(0, 28)) +
                '</text>' +
                '<rect x="36" y="58" width="216" height="' + cavityH + '" rx="3" fill="#071018"/>';

            var rails = Math.max(2, Math.ceil(cavityH / 52));
            for (var r = 0; r < rails; r++) {
                var ry = 70 + r * 48;
                if (ry > 58 + cavityH - 10) break;
                inner += '<rect x="42" y="' + ry + '" width="204" height="5" rx="1" fill="#94a3b8" opacity="0.35"/>';
            }
            componentes.forEach(function (s) { inner += svgModulo(s, suf); });
            inner +=
                '<rect x="110" y="' + (cabH - 6) + '" width="60" height="6" rx="1" fill="#334155"/>' +
                '<text x="140" y="' + (cabH + 8) + '" text-anchor="middle" fill="#64748b" font-size="7" font-family="Inter">PE</text>';
            if (soltos || !temEnv) {
                inner +=
                    '<rect x="28" y="20" width="224" height="' + (cabH - 16) + '" rx="8" fill="none" stroke="#f59e0b" stroke-dasharray="6 5" stroke-width="1.5" opacity="0.75"/>';
            }
        }

        return '<svg viewBox="0 0 280 ' + (altura + 16) + '" xmlns="http://www.w3.org/2000/svg" role="img">' +
            svgDefs(suf) + inner + '</svg>';
    }

    function htmlInserePainel(grupoId) {
        var ph = ehSimples()
            ? 'Pesquisar e incluir item…'
            : (grupoId === 'novo'
                ? 'Pesquisar e iniciar um quadro…'
                : (grupoId === GRUPO_SOLTO ? 'Pesquisar e adicionar em Adicionais…' : 'Pesquisar e adicionar neste quadro…'));
        return '<div class="insere-painel" data-insere-grupo="' + esc(grupoId) + '">' +
            '<input type="text" class="busca-no-painel" placeholder="' + ph + '" autocomplete="off">' +
            '<input type="number" class="qtde-no-painel" min="0.01" step="1" value="1" title="Quantidade">' +
            '<div class="dropdown-hits dd-no-painel"></div>' +
            '</div>';
    }

    function htmlChipsMontagem(grupoId) {
        var pares = itensDoGrupo(grupoId);
        if (!pares.length) return '';
        return '<div class="chips-montagem">' + pares.map(function (p) {
            var it = p.it;
            var tipo = tipoItem(it);
            return '<button type="button" class="chip-monta" data-idx="' + p.idx + '" title="' + esc(it.descricao) + '">' +
                '<i class="swatch" style="background:' + corTipo(tipo) + '"></i>' +
                esc((it.sku || it.descricao || tipo).slice(0, 16)) +
                ' ×' + num(it.qtde) +
                '<span class="chip-x" data-tirar="' + p.idx + '" title="Remover">×</span>' +
                '</button>';
        }).join('') + '</div>';
    }

    function inserirNoGrupo(prod, qtde, grupoId, opts) {
        opts = opts || {};
        if (!prod) {
            toast('Selecione um produto no catálogo.', true);
            return;
        }
        qtde = num(qtde) || 1;
        var tipo = inferirTipo(prod);
        var gid = grupoId;

        if (ehSimples()) {
            gid = GRUPO_SOLTO;
        } else if (!gid || gid === 'novo') {
            gid = criarPainel(tipo === 'quadro' ? (prod.nome || prod.sku || 'Quadro') : ('Painel ' + (estado.paineis.length + 1))).id;
        } else if (tipo === 'quadro' && gid === GRUPO_SOLTO) {
            gid = criarPainel(prod.nome || prod.sku || 'Quadro').id;
        } else if (gid !== GRUPO_SOLTO && !estado.paineis.some(function (p) { return p.id === gid; })) {
            gid = criarPainel(prod.nome || 'Painel').id;
        }

        estado.itens.push({
            local_id: uid(),
            produto_id: prod.id,
            sku: prod.sku || '',
            descricao: prod.nome,
            qtde: qtde,
            custo_unit: num(prod.preco_custo),
            venda_unit: num(prod.preco_venda),
            tipoVisual: tipo,
            ncm: prod.ncm || '',
            marca: prod.marca || '',
            fabricante: prod.fabricante || '',
            fabricante_id: prod.fabricante_id || null,
            grupo_produto_id: prod.grupo_produto_id || null,
            marca_id: prod.marca_id || null,
            grupo_id: gid
        });
        estado.grupoAtivo = gid;
        gruposRecolhidos[gid] = false;
        pendingFocusGrupo = (opts.foco === 'topo') ? null : gid;
        if (!ehSimples()) {
            blocosRecolhidos.plantas = false;
            aplicarBlocosRecolhidos();
        }
        sincronizarTela();
        if (opts.foco === 'topo') {
            var bpTopo = document.getElementById('buscaProduto');
            if (bpTopo) setTimeout(function () { bpTopo.focus(); }, 0);
        }
        if (ehSimples()) {
            toast('Item incluído.');
        } else if (tipo === 'quadro' && grupoId === 'novo') {
            toast('Quadro iniciado. Pesquise os componentes neste mesmo cartão — a planta atualiza na hora.');
        } else if (gid === GRUPO_SOLTO) {
            toast('Item incluído em Adicionais.');
        } else {
            toast((tipo === 'quadro' ? 'Envelope' : 'Componente') + ' inserido em ' + nomeDoGrupo(gid) + '.');
        }
    }

    async function consultarProdutos(aplicarFiltro, campos) {
        var query = supabaseClient.from('produtos').select(campos || CAMPOS_PRODUTO).eq('empresa_id', empresaId);
        query = aplicarFiltro(query);
        var res = await query;
        if (res.error && /column|schema cache/i.test(String(res.error.message || ''))) {
            query = supabaseClient.from('produtos').select(CAMPOS_PRODUTO_MIN).eq('empresa_id', empresaId);
            query = aplicarFiltro(query);
            res = await query;
        }
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function listarProdutosCatalogo(termo) {
        termo = EqSec.sanitizarFiltro(termo);
        if (!termo) return [];
        try {
            return await consultarProdutos(function (q) {
                return q.or('nome.ilike.%' + termo + '%,sku.ilike.%' + termo + '%,marca.ilike.%' + termo + '%,fabricante.ilike.%' + termo + '%').limit(12);
            });
        } catch (e) {
            return consultarProdutos(function (q) {
                return q.or('nome.ilike.%' + termo + '%,sku.ilike.%' + termo + '%').limit(12);
            }, CAMPOS_PRODUTO_MIN);
        }
    }

    function htmlHitsProdutos(data) {
        return data.map(function (p, i) {
            var tipo = inferirTipo(p);
            var est = extrairEstoque(p);
            var ncm = p.ncm ? '<span class="tag ncm">NCM ' + esc(p.ncm) + '</span>' : '';
            var estTag = est != null ? '<span class="tag">Est. ' + esc(est) + '</span>' : '';
            var fab = [p.fabricante, p.marca].filter(Boolean).join(' · ');
            var fabTag = fab ? '<span class="tag">' + esc(fab) + '</span>' : '';
            return '<div class="prod-hit" data-i="' + i + '" title="Clique para incluir">' +
                '<div class="p-nome">' + esc(p.nome) + '</div>' +
                '<div class="p-meta">' +
                '<span class="tag ' + tagClasse(tipo) + '">' + esc(p.sku || tipo) + '</span>' +
                ncm + estTag + fabTag +
                '<span>' + money(p.preco_venda) + '</span>' +
                '<span class="hit-acao">Incluir</span></div></div>';
        }).join('');
    }

    var trocaCtx = { modo: 'item', idx: -1, equivalentes: [], mapaGrupos: {} };

    function rotuloFab(p) {
        return [p.fabricante, p.marca].filter(Boolean).join(' · ') || 'Sem fabricante';
    }

    function aplicarProdutoNoItem(it, prod) {
        if (!it || !prod) return;
        it.produto_id = prod.id;
        it.sku = prod.sku || '';
        it.descricao = prod.nome;
        it.custo_unit = num(prod.preco_custo);
        it.venda_unit = num(prod.preco_venda);
        it.ncm = prod.ncm || it.ncm || '';
        it.marca = prod.marca || '';
        it.fabricante = prod.fabricante || '';
        it.fabricante_id = prod.fabricante_id || null;
        it.grupo_produto_id = prod.grupo_produto_id || it.grupo_produto_id || null;
        it.marca_id = prod.marca_id || null;
        it.tipoVisual = inferirTipo(prod);
    }

    async function resolverGrupoProduto(it) {
        if (it.grupo_produto_id) return it.grupo_produto_id;
        var pid = idProdutoBanco(it.produto_id);
        if (!pid) return null;
        try {
            var lista = await consultarProdutos(function (q) { return q.eq('id', pid).limit(1); });
            var p = lista[0];
            if (p && p.grupo_produto_id) {
                it.grupo_produto_id = p.grupo_produto_id;
                if (!it.fabricante) it.fabricante = p.fabricante || '';
                if (!it.marca) it.marca = p.marca || '';
                it.fabricante_id = it.fabricante_id || p.fabricante_id;
                it.marca_id = it.marca_id || p.marca_id;
                return p.grupo_produto_id;
            }
        } catch (e) { /* catálogo sem coluna */ }
        return null;
    }

    async function buscarEquivalentes(grupoProdutoId) {
        if (!grupoProdutoId) return [];
        try {
            return await consultarProdutos(function (q) {
                return q.eq('grupo_produto_id', grupoProdutoId).order('nome').limit(80);
            });
        } catch (e) {
            return [];
        }
    }

    function abrirModalTroca() {
        var m = document.getElementById('modalTrocaFab');
        if (!m) return;
        m.removeAttribute('hidden');
        m.classList.add('aberto');
    }

    function fecharModalTroca() {
        var m = document.getElementById('modalTrocaFab');
        if (!m) return;
        m.classList.remove('aberto');
        m.setAttribute('hidden', '');
        trocaCtx = { modo: 'item', idx: -1, equivalentes: [], mapaGrupos: {} };
        var btn = document.getElementById('btnConfirmarTroca');
        if (btn) btn.hidden = true;
    }

    function htmlCardEquivalente(p, atualId, vendaAtual) {
        var mesmo = String(p.id) === String(atualId);
        var delta = num(p.preco_venda) - num(vendaAtual);
        var clsDelta = delta > 0.009 ? 'mais' : (delta < -0.009 ? 'menos' : '');
        var txtDelta = delta === 0 ? '' : ((delta > 0 ? '+' : '') + money(delta));
        return '<button type="button" class="troca-hit' + (mesmo ? ' atual' : '') + '" data-prod-id="' + esc(p.id) + '"' + (mesmo ? ' disabled' : '') + '>' +
            '<div class="t-nome">' + esc(p.nome) + (mesmo ? ' (atual)' : '') + '</div>' +
            '<div class="t-meta">' +
            '<span>' + esc(rotuloFab(p)) + '</span>' +
            '<span>SKU ' + esc(p.sku || '—') + '</span>' +
            '<span>' + money(p.preco_venda) + '</span>' +
            (txtDelta ? '<span class="t-delta ' + clsDelta + '">' + txtDelta + '</span>' : '') +
            '</div></button>';
    }

    async function abrirTrocaItem(idx) {
        var it = estado.itens[idx];
        if (!it) return;
        var gid = await resolverGrupoProduto(it);
        if (!gid) {
            toast('Este item não tem Grupo de equivalência. Vincule o produto a um grupo no cadastro para oferecer outro fabricante.', true);
            return;
        }
        var eqs = await buscarEquivalentes(gid);
        if (eqs.length < 2) {
            toast('Não há outro produto no mesmo grupo. Cadastre o equivalente de outro fabricante no mesmo Grupo.', true);
            return;
        }
        trocaCtx = { modo: 'item', idx: idx, equivalentes: eqs, mapaGrupos: {} };
        document.getElementById('titTrocaFab').textContent = 'Trocar este item';
        document.getElementById('txtTrocaFab').textContent = 'Equivalentes do grupo. Clique para substituir (quantidade se mantém).';
        document.getElementById('filtrosTrocaFab').innerHTML = '';
        document.getElementById('listaTrocaFab').innerHTML = eqs.map(function (p) {
            return htmlCardEquivalente(p, it.produto_id, it.venda_unit);
        }).join('');
        document.getElementById('btnConfirmarTroca').hidden = true;
        document.getElementById('listaTrocaFab').querySelectorAll('.troca-hit:not([disabled])').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-prod-id');
                var prod = eqs.filter(function (p) { return String(p.id) === String(id); })[0];
                if (!prod) return;
                aplicarProdutoNoItem(it, prod);
                fecharModalTroca();
                sincronizarTela();
                toast('Item trocado para ' + rotuloFab(prod) + '.');
            });
        });
        abrirModalTroca();
    }

    function fabricantesDos(lista) {
        var map = {};
        (lista || []).forEach(function (p) {
            var id = p.fabricante_id || p.fabricante || '';
            var nome = p.fabricante || 'Sem fabricante';
            if (!id && !p.fabricante) return;
            map[id || nome] = nome;
        });
        return map;
    }

    async function abrirTrocaOrcamento() {
        if (!estado.itens.length) {
            toast('Inclua itens antes de trocar o fabricante.', true);
            return;
        }
        var mapa = {};
        var todos = [];
        for (var i = 0; i < estado.itens.length; i++) {
            var gid = await resolverGrupoProduto(estado.itens[i]);
            if (!gid || mapa[gid]) continue;
            var eqs = await buscarEquivalentes(gid);
            mapa[gid] = eqs;
            todos = todos.concat(eqs);
        }
        var fabs = fabricantesDos(todos);
        var keys = Object.keys(fabs);
        if (!keys.length) {
            toast('Nenhum item tem Grupo com equivalentes. Cadastre fabricante/grupo/marca nos produtos e rode docs/8_FABRICANTE_GRUPO_MARCA.sql.', true);
            return;
        }
        trocaCtx = { modo: 'orcamento', idx: -1, equivalentes: todos, mapaGrupos: mapa };
        document.getElementById('titTrocaFab').textContent = 'Trocar fabricante do orçamento';
        document.getElementById('txtTrocaFab').textContent = 'O sistema troca cada item pelo equivalente do fabricante escolhido (mesmo grupo). Itens sem par permanecem.';
        var opts = '<option value="">— Escolha o fabricante —</option>' + keys.map(function (k) {
            return '<option value="' + esc(k) + '">' + esc(fabs[k]) + '</option>';
        }).join('');
        document.getElementById('filtrosTrocaFab').innerHTML =
            '<div class="campo"><label>Fabricante de destino</label><select id="selTrocaFabDest">' + opts + '</select></div>';
        document.getElementById('listaTrocaFab').innerHTML = '<p class="troca-resumo">Escolha o fabricante para ver o que será trocado.</p>';
        document.getElementById('btnConfirmarTroca').hidden = true;
        document.getElementById('selTrocaFabDest').addEventListener('change', function () {
            montarPreviewTrocaOrcamento(this.value, fabs[this.value]);
        });
        abrirModalTroca();
    }

    function montarPreviewTrocaOrcamento(fabKey, fabNome) {
        var lista = document.getElementById('listaTrocaFab');
        var btn = document.getElementById('btnConfirmarTroca');
        if (!fabKey) {
            lista.innerHTML = '<p class="troca-resumo">Escolha o fabricante para ver o que será trocado.</p>';
            btn.hidden = true;
            trocaCtx.plano = [];
            return;
        }
        var plano = [];
        var html = '';
        estado.itens.forEach(function (it, idx) {
            var eqs = trocaCtx.mapaGrupos[it.grupo_produto_id] || [];
            var cand = eqs.filter(function (p) {
                var k = p.fabricante_id || p.fabricante || '';
                return String(k) === String(fabKey) && String(p.id) !== String(it.produto_id);
            });
            var prod = cand[0] || null;
            if (prod) {
                plano.push({ idx: idx, prod: prod });
                html += '<div class="troca-resumo"><strong>' + esc(it.descricao) + '</strong> → ' + esc(prod.nome) +
                    ' · ' + money(it.venda_unit) + ' → ' + money(prod.preco_venda) + '</div>';
            } else {
                html += '<div class="troca-resumo">Sem equivalente: ' + esc(it.descricao) + '</div>';
            }
        });
        trocaCtx.plano = plano;
        lista.innerHTML = html || '<p class="troca-resumo">Nada para trocar neste fabricante.</p>';
        btn.hidden = !plano.length;
        btn.onclick = function () {
            plano.forEach(function (p) { aplicarProdutoNoItem(estado.itens[p.idx], p.prod); });
            fecharModalTroca();
            sincronizarTela();
            toast(plano.length + ' item(ns) trocado(s) para ' + (fabNome || 'o fabricante escolhido') + '.');
        };
    }

    function ligarInsercaoPainel(raiz) {
        if (!raiz) return;
        raiz.querySelectorAll('.insere-painel').forEach(function (box) {
            var gid = box.getAttribute('data-insere-grupo');
            var inp = box.querySelector('.busca-no-painel');
            var qtde = box.querySelector('.qtde-no-painel');
            var dd = box.querySelector('.dd-no-painel');
            if (!inp || !dd) return;
            var hits = [];
            var deb = EqSec.debounce(async function () {
                try {
                    var termo = inp.value;
                    if (!EqSec.sanitizarFiltro(termo)) {
                        dd.style.display = 'none';
                        dd.innerHTML = '';
                        hits = [];
                        return;
                    }
                    hits = await listarProdutosCatalogo(termo);
                    if (!hits.length) {
                        dd.innerHTML = '<div class="prod-hit">Nenhum produto no catálogo</div>';
                        dd.style.display = 'block';
                        return;
                    }
                    dd.innerHTML = htmlHitsProdutos(hits);
                    dd.style.display = 'block';
                    dd.querySelectorAll('.prod-hit').forEach(function (el) {
                        el.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var i = parseInt(el.getAttribute('data-i'), 10);
                            inserirNoGrupo(hits[i], qtde ? qtde.value : 1, gid);
                        });
                    });
                } catch (err) {
                    dd.innerHTML = '<div class="prod-hit">Falha na busca</div>';
                    dd.style.display = 'block';
                }
            }, 280);
            ['click', 'mousedown', 'pointerdown'].forEach(function (ev) {
                box.addEventListener(ev, function (e) { e.stopPropagation(); });
            });
            inp.addEventListener('input', deb);
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (hits.length) inserirNoGrupo(hits[0], qtde ? qtde.value : 1, gid);
                }
            });
        });
        raiz.querySelectorAll('[data-tirar]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var idx = parseInt(btn.getAttribute('data-tirar'), 10);
                if (!isNaN(idx)) {
                    pendingFocusGrupo = estado.itens[idx] ? estado.itens[idx].grupo_id : null;
                    estado.itens.splice(idx, 1);
                    sincronizarTela();
                }
            });
        });
        raiz.querySelectorAll('.chip-monta').forEach(function (chip) {
            chip.addEventListener('click', function (e) {
                if (e.target.closest('[data-tirar]')) return;
                e.stopPropagation();
                var idx = parseInt(chip.getAttribute('data-idx'), 10);
                if (!isNaN(idx)) destacarItem(idx);
            });
        });
    }

    function atualizarSelectDestino() {
        var sel = document.getElementById('selDestino');
        if (!sel) return;
        var atual = estado.grupoAtivo || GRUPO_SOLTO;
        sel.innerHTML =
            '<option value="novo">+ Novo painel</option>' +
            '<option value="' + GRUPO_SOLTO + '">Adicionais / itens soltos</option>' +
            estado.paineis.map(function (p) {
                return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>';
            }).join('');
        if (atual === 'novo') sel.value = 'novo';
        else if ([GRUPO_SOLTO].concat(estado.paineis.map(function (p) { return p.id; })).indexOf(atual) >= 0) {
            sel.value = atual;
        } else {
            sel.value = estado.paineis.length ? estado.paineis[estado.paineis.length - 1].id : GRUPO_SOLTO;
            estado.grupoAtivo = sel.value;
        }
    }

    function renderPlanta() {
        if (ehSimples()) return;
        var host = document.getElementById('plantaCanvas');
        if (!host) return;
        var layout = processarLayout();
        estado.montagem = layout;
        atualizarSelectDestino();

        var cards = [];
        if (!layout.paineis.length && !(layout.soltos.slots || []).length) {
            cards.push(
                '<div class="card-painel vazio" data-grupo="novo">' +
                htmlInserePainel('novo') +
                svgInterior({ slots: [], temEnvelope: false, altura: 270 }, '', false, 'vazio') +
                '<p class="vazio-hint" style="color:#94a3b8;text-align:center;">Pesquise o quadro/caixa neste cartão. Os próximos itens entram nele e a montagem aparece na hora.</p>' +
                '</div>'
            );
        }

        layout.paineis.forEach(function (p) {
            var ativo = estado.grupoAtivo === p.id ? ' ativo' : '';
            var rec = gruposRecolhidos[p.id] ? ' recolhido' : '';
            cards.push(
                '<article class="card-painel' + ativo + rec + '" data-grupo="' + esc(p.id) + '">' +
                '<header>' +
                btnMinmaxGrupo(p.id) +
                '<strong>' + esc(p.nome) + '</strong>' +
                badgePcpHtml(painelPorId(p.id)) +
                '<span>' + (p.temEnvelope ? 'montado' : 'sem envelope') + '</span>' +
                btnSolicitarHtml(p.id) +
                '</header>' +
                '<div class="card-painel-corpo">' +
                htmlInserePainel(p.id) +
                svgInterior(p, p.nome, false, String(p.id).replace(/\W/g, '').slice(0, 12)) +
                htmlChipsMontagem(p.id) +
                '</div>' +
                '</article>'
            );
        });

        var nSoltos = itensDoGrupo(GRUPO_SOLTO).length;
        if (nSoltos || estado.grupoAtivo === GRUPO_SOLTO || layout.paineis.length) {
            var recS = gruposRecolhidos[GRUPO_SOLTO] ? ' recolhido' : '';
            cards.push(
                '<article class="card-painel soltos' + (estado.grupoAtivo === GRUPO_SOLTO ? ' ativo' : '') + recS + '" data-grupo="' + GRUPO_SOLTO + '">' +
                '<header>' +
                btnMinmaxGrupo(GRUPO_SOLTO) +
                '<strong>Adicionais / itens soltos</strong><span>' + nSoltos + ' item(ns)</span>' +
                '</header>' +
                '<div class="card-painel-corpo">' +
                htmlInserePainel(GRUPO_SOLTO) +
                svgInterior(layout.soltos, 'ADICIONAIS', true, 'solto') +
                htmlChipsMontagem(GRUPO_SOLTO) +
                '</div>' +
                '</article>'
            );
        }

        host.innerHTML = '<div class="galeria-paineis">' + cards.join('') + '</div>';

        host.querySelectorAll('.card-painel[data-grupo]').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.insere-painel, .chips-montagem, .btn-minmax, [data-solicitar], .slot-hit')) return;
                var gid = card.getAttribute('data-grupo');
                if (gid === 'novo') return;
                if (estado.grupoAtivo === gid) return;
                estado.grupoAtivo = gid;
                atualizarSelectDestino();
                host.querySelectorAll('.card-painel').forEach(function (c) {
                    c.classList.toggle('ativo', c.getAttribute('data-grupo') === gid);
                });
                renderBom();
            });
        });
        host.querySelectorAll('[data-solicitar]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                solicitarProjetoPainel(btn.getAttribute('data-solicitar'));
            });
        });
        host.querySelectorAll('[data-minmax]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleGrupoRecolhido(btn.getAttribute('data-minmax'));
            });
        });
        host.querySelectorAll('.slot-hit').forEach(function (g) {
            g.addEventListener('click', function (e) {
                e.stopPropagation();
                var i = parseInt(g.getAttribute('data-idx'), 10);
                if (!isNaN(i)) destacarItem(i);
            });
        });
        ligarInsercaoPainel(host);
        if (pendingFocusGrupo) {
            var alvo = host.querySelector('.card-painel[data-grupo="' + pendingFocusGrupo + '"] .busca-no-painel');
            pendingFocusGrupo = null;
            if (alvo) {
                alvo.focus();
            }
        }
    }

    function destacarItem(idx) {
        itemAtivoIdx = idx;
        document.querySelectorAll('.bom-row').forEach(function (el) {
            el.classList.toggle('ativa', parseInt(el.getAttribute('data-idx'), 10) === idx);
        });
    }

    /* ---------- totais ---------- */
    function calcPadrao() {
        return {
            mo_incluir: true,
            mo_valor: 0,
            misc_pct: 0,
            misc_rs: 0,
            frete_venda: 0,
            frete_compra: 0,
            outros: 0,
            markup_pct: '',
            markup_rs: 0,
            acres_desc: 0
        };
    }

    function calcDoGrupo(grupoId) {
        if (grupoId === GRUPO_SOLTO) {
            estado.calcSoltos = Object.assign(calcPadrao(), estado.calcSoltos || {});
            return estado.calcSoltos;
        }
        var p = painelPorId(grupoId);
        if (!p) return calcPadrao();
        p.calc = Object.assign(calcPadrao(), p.calc || {});
        return p.calc;
    }

    function materialGrupo(grupoId) {
        return itensDoGrupo(grupoId).reduce(function (s, x) {
            return s + num(x.it.qtde) * num(x.it.custo_unit);
        }, 0);
    }

    function calcularIndustrializado(grupoId) {
        var c = calcDoGrupo(grupoId);
        var mat = materialGrupo(grupoId);
        var mo = c.mo_incluir
            ? (num(c.mo_valor) > 0 ? num(c.mo_valor) : mat * num(estado.mao_obra_pct) / 100)
            : 0;
        var miscRs = num(c.misc_pct) !== 0 ? mat * num(c.misc_pct) / 100 : num(c.misc_rs);
        var custo = mat + mo + miscRs + num(c.frete_venda) + num(c.frete_compra) + num(c.outros);
        var mkPct = (c.markup_pct === '' || c.markup_pct == null) ? num(estado.markup_pct) : num(c.markup_pct);
        var mkRs = custo * mkPct / 100;
        var venda = custo + mkRs + num(c.acres_desc);
        var lucro = venda - custo;
        var lucroPct = custo > 0 ? (lucro / custo) * 100 : 0;
        return {
            material: mat,
            mo: mo,
            misc_rs: miscRs,
            custo: custo,
            markup_pct: mkPct,
            markup_rs: mkRs,
            venda: venda,
            lucro: lucro,
            lucro_pct: lucroPct
        };
    }

    function gruposCalculo() {
        return estado.paineis.map(function (p) { return p.id; }).concat([GRUPO_SOLTO]);
    }

    function totais() {
        var material = 0;
        var mo = 0;
        var custo = 0;
        var venda = 0;
        var vendaItens = 0;
        gruposCalculo().forEach(function (gid) {
            if (!itensDoGrupo(gid).length && gid === GRUPO_SOLTO) return;
            var r = calcularIndustrializado(gid);
            material += r.material;
            mo += r.mo;
            custo += r.custo;
            venda += r.venda;
        });
        estado.itens.forEach(function (it) {
            vendaItens += num(it.qtde) * num(it.venda_unit);
        });
        if (!estado.paineis.length && !itensDoGrupo(GRUPO_SOLTO).length) {
            material = 0;
            estado.itens.forEach(function (it) { material += num(it.qtde) * num(it.custo_unit); });
            mo = material * num(estado.mao_obra_pct) / 100;
            custo = material + mo;
            var mk = num(estado.markup_pct);
            venda = mk > 0 ? custo * (1 + mk / 100) : (vendaItens || custo);
        }
        var lucro = venda - custo;
        var lucroPct = custo > 0 ? (lucro / custo) * 100 : 0;
        var frete = num(estado.frete_valor);
        return {
            material: material,
            mao_obra: mo,
            custo: custo,
            compra: material,
            venda: venda,
            lucro: lucro,
            lucro_pct: lucroPct,
            venda_itens: vendaItens,
            frete: frete,
            total_frete: venda + frete,
            frete_custo: num(estado.frete_custo)
        };
    }

    function metaMargem() {
        var m = num(estado.margem_minima_pct);
        return m > 0 ? m : 20;
    }

    function analiseLucro(t) {
        var meta = metaMargem();
        var pct = t.lucro_pct;
        var vendaAlvo = t.custo * (1 + meta / 100);
        var markupSugerido = Math.round(meta * 10) / 10;
        var paineis = [];
        gruposCalculo().forEach(function (gid) {
            if (!itensDoGrupo(gid).length) return;
            var r = calcularIndustrializado(gid);
            paineis.push({
                id: gid,
                nome: nomeDoGrupo(gid),
                lucro_pct: r.lucro_pct,
                lucro: r.lucro,
                venda: r.venda,
                custo: r.custo
            });
        });
        var fracos = paineis.filter(function (p) { return p.custo > 0 && p.lucro_pct < meta; }).sort(function (a, b) { return a.lucro_pct - b.lucro_pct; });
        var nivel = 'vazio';
        var rotulo = 'Sem itens';
        var dica = 'Inclua o quadro e os componentes. A margem aparece aqui na hora, mesmo com o painel minimizado.';
        if (t.custo > 0 || t.venda > 0) {
            if (pct < 0) {
                nivel = 'prejuizo';
                rotulo = 'Prejuízo';
                dica = 'A venda está ' + money(Math.abs(t.lucro)) + ' abaixo do custo. Aplique o markup da meta (' + meta.toFixed(1).replace('.', ',') + '%) ou revise mão de obra e misc. nos painéis.';
            } else if (pct + 0.05 < meta) {
                nivel = 'alerta';
                rotulo = 'Abaixo da meta';
                dica = 'Margem ' + pct.toFixed(1).replace('.', ',') + '% · meta ' + meta.toFixed(1).replace('.', ',') + '%. Faltam ' + money(Math.max(0, vendaAlvo - t.venda)) + ' na venda. Use “Aplicar markup da meta” ou suba o markup no cálculo industrializado.';
            } else if (pct < meta + 12) {
                nivel = 'ok';
                rotulo = 'Na meta';
                dica = 'Margem saudável (' + pct.toFixed(1).replace('.', ',') + '%). Confira se o frete de venda cobre o custo de frete e se a tabela do cliente aceita este valor.';
            } else {
                nivel = 'otimo';
                rotulo = 'Excelente';
                dica = 'Margem ' + pct.toFixed(1).replace('.', ',') + '%, acima da meta. Há folga para negociar desconto sem furar os ' + meta.toFixed(1).replace('.', ',') + '%.';
            }
        }
        if (t.frete_custo > t.frete && t.frete_custo > 0) {
            dica += ' Frete de venda não cobre o custo de frete (' + money(t.frete_custo - t.frete) + ').';
        }
        if (fracos.length && nivel !== 'vazio') {
            dica += ' Atenção: ' + fracos.slice(0, 3).map(function (p) {
                return p.nome + ' ' + p.lucro_pct.toFixed(1).replace('.', ',') + '%';
            }).join('; ') + '.';
        }
        var escala = Math.max(meta * 2, 40);
        var barra = Math.max(0, Math.min(100, (pct / escala) * 100));
        var marcaMeta = Math.max(0, Math.min(100, (meta / escala) * 100));
        return {
            meta: meta,
            pct: pct,
            nivel: nivel,
            rotulo: rotulo,
            dica: dica,
            barra: barra,
            marcaMeta: marcaMeta,
            markupSugerido: markupSugerido,
            vendaAlvo: vendaAlvo,
            fracos: fracos,
            paineis: paineis
        };
    }

    function renderBarraLucro(t) {
        var a = analiseLucro(t || totais());
        var barra = document.getElementById('barraLucro');
        if (barra) {
            barra.setAttribute('data-nivel', a.nivel);
            var fill = document.getElementById('blFill');
            var mark = document.getElementById('blMetaMark');
            if (fill) fill.style.width = a.barra + '%';
            if (mark) mark.style.left = a.marcaMeta + '%';
        }
        function setTxt(id, txt) {
            var el = document.getElementById(id);
            if (el) el.textContent = txt;
        }
        setTxt('blVenda', money(t.venda));
        setTxt('blLucro', money(t.lucro));
        setTxt('blMargem', a.nivel === 'vazio' ? '—' : (a.pct.toFixed(1).replace('.', ',') + '%'));
        setTxt('blSelo', a.rotulo);
        var dica = document.getElementById('lucroDica');
        if (dica) dica.textContent = a.dica;
        var boxP = document.getElementById('lucroPaineis');
        if (boxP) {
            boxP.innerHTML = a.paineis.map(function (p) {
                var nv = p.lucro_pct < 0 ? 'prejuizo' : (p.lucro_pct < a.meta ? 'alerta' : (p.lucro_pct < a.meta + 12 ? 'ok' : 'otimo'));
                return '<span class="chip-margem" data-nivel="' + nv + '" title="' + esc(p.nome) + '">' +
                    esc(p.nome) + ' <strong>' + p.lucro_pct.toFixed(1).replace('.', ',') + '%</strong></span>';
            }).join('');
        }
        var btnMk = document.getElementById('btnAplicarMarkupMeta');
        if (btnMk) {
            btnMk.disabled = a.nivel === 'vazio';
            btnMk.setAttribute('data-markup', a.markupSugerido);
        }
        return a;
    }

    function aplicarMarkupDaMeta() {
        if (!EqSec.temPermissao('orcamento_custos')) {
            toast('Sem permissão para ajustar markup.', true);
            return;
        }
        var a = analiseLucro(totais());
        if (a.nivel === 'vazio') {
            toast('Inclua itens antes de aplicar o markup da meta.', true);
            return;
        }
        var mk = a.markupSugerido;
        estado.markup_pct = mk;
        var inp = document.getElementById('orcMarkupPct');
        if (inp) inp.value = mk;
        sincronizarTela();
        toast('Markup padrão em ' + String(mk).replace('.', ',') + '% para buscar a meta de ' + a.meta.toFixed(1).replace('.', ',') + '%. Painéis com markup próprio não mudam.');
    }

    function renderTotais() {
        var t = totais();
        function setTxt(id, txt) {
            var el = document.getElementById(id);
            if (el) el.textContent = txt;
        }
        function setVal(id, v) {
            var el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = v;
        }
        setTxt('totVenda', money(t.venda));
        setTxt('totCompra', money(t.compra));
        setTxt('totCusto', money(t.custo));
        setTxt('totLucro', money(t.lucro));
        setTxt('totLucroPct', t.lucro_pct.toFixed(1).replace('.', ',') + '%');
        setTxt('totFrete', money(t.frete));
        setTxt('totMaisFrete', money(t.total_frete));
        setTxt('totFreteCusto', money(t.frete_custo));
        var elLucro = document.getElementById('totLucro');
        if (elLucro) elLucro.className = 'lucro-' + (t.lucro >= 0 ? 'ok' : 'ruim');
        renderBarraLucro(t);
        gruposCalculo().forEach(function (gid) { atualizarCalcBloco(gid); });
    }

    function inpCalc(grupoId, campo, valor, extra) {
        return '<input type="number" step="0.01" data-calc="' + campo + '" data-grupo="' + esc(grupoId) + '" value="' + (valor == null || valor === '' ? '' : valor) + '"' + (extra || '') + '>';
    }

    function htmlCalcIndustrializado(grupoId) {
        var c = calcDoGrupo(grupoId);
        var r = calcularIndustrializado(grupoId);
        var mkShow = (c.markup_pct === '' || c.markup_pct == null) ? '' : c.markup_pct;
        var titCalc = ehSimples() ? 'Cálculo de custo e venda' : 'Cálculo por produto industrializado';
        return '<div class="calc-ind" data-grupo-calc="' + esc(grupoId) + '">' +
            '<h4>' + titCalc + '</h4>' +
            '<div class="calc-linha">' +
            '<label>Custo material <input type="text" readonly class="calc-res" data-res="material" value="' + money(r.material) + '"></label>' +
            '<label>Mão de obra (R$)' + inpCalc(grupoId, 'mo_valor', c.mo_valor) +
            '<span class="calc-chk"><input type="checkbox" data-calc="mo_incluir" data-grupo="' + esc(grupoId) + '"' + (c.mo_incluir ? ' checked' : '') + '> Incluir</span></label>' +
            '<label>Misc. %' + inpCalc(grupoId, 'misc_pct', c.misc_pct) + '</label>' +
            '<label>Misc. R$' + inpCalc(grupoId, 'misc_rs', r.misc_rs.toFixed(2)) + '</label>' +
            '<label>Frete venda' + inpCalc(grupoId, 'frete_venda', c.frete_venda) + '</label>' +
            '<label>Frete compra' + inpCalc(grupoId, 'frete_compra', c.frete_compra) + '</label>' +
            '<label>Outros' + inpCalc(grupoId, 'outros', c.outros) + '</label>' +
            '<label>Custo total <input type="text" readonly class="calc-res amarelo" data-res="custo" value="' + money(r.custo) + '"></label>' +
            '</div>' +
            '<p class="calc-sub">Cálculo do valor de venda e lucro <span>(markup sobre o custo total' + (mkShow === '' ? ' · usa o % padrão do orçamento' : '') + ')</span></p>' +
            '<div class="calc-linha">' +
            '<label>Markup %' + inpCalc(grupoId, 'markup_pct', mkShow, ' placeholder="' + num(estado.markup_pct) + '"') + '</label>' +
            '<label>Markup R$ <input type="text" readonly class="calc-res" data-res="markup_rs" value="' + money(r.markup_rs) + '"></label>' +
            '<label>Acrés./Desc. R$' + inpCalc(grupoId, 'acres_desc', c.acres_desc) + '</label>' +
            '<label>Valor de venda <input type="text" readonly class="calc-res amarelo" data-res="venda" value="' + money(r.venda) + '"></label>' +
            '<label>Lucro % <input type="text" readonly class="calc-res amarelo" data-res="lucro_pct" value="' + r.lucro_pct.toFixed(2).replace('.', ',') + '%"></label>' +
            '<label>Lucro R$ <input type="text" readonly class="calc-res amarelo" data-res="lucro" value="' + money(r.lucro) + '"></label>' +
            '</div></div>';
    }

    function atualizarCalcBloco(grupoId) {
        var box = document.querySelector('.calc-ind[data-grupo-calc="' + grupoId + '"]');
        if (!box) return;
        var r = calcularIndustrializado(grupoId);
        var map = {
            material: money(r.material),
            custo: money(r.custo),
            markup_rs: money(r.markup_rs),
            venda: money(r.venda),
            lucro_pct: r.lucro_pct.toFixed(2).replace('.', ',') + '%',
            lucro: money(r.lucro)
        };
        var miscInp = box.querySelector('[data-calc="misc_rs"]');
        if (miscInp && document.activeElement !== miscInp) miscInp.value = r.misc_rs.toFixed(2);
        Object.keys(map).forEach(function (k) {
            var el = box.querySelector('[data-res="' + k + '"]');
            if (el) el.value = map[k];
        });
    }

    function ligarCamposCalc(raiz) {
        if (!raiz) return;
        raiz.querySelectorAll('[data-calc]').forEach(function (inp) {
            var ev = inp.type === 'checkbox' ? 'change' : 'change';
            inp.addEventListener(ev, function () {
                var gid = inp.getAttribute('data-grupo');
                var campo = inp.getAttribute('data-calc');
                var c = calcDoGrupo(gid);
                if (inp.type === 'checkbox') c[campo] = inp.checked;
                else if (campo === 'markup_pct' && inp.value === '') c.markup_pct = '';
                else c[campo] = num(inp.value);
                if (campo === 'misc_pct') c.misc_rs = materialGrupo(gid) * num(c.misc_pct) / 100;
                if (campo === 'misc_rs') c.misc_pct = 0;
                persistirLocalSilencioso();
                atualizarCalcBloco(gid);
                renderTotais();
            });
        });
    }

    function opcoesGrupoHtml(selecionado) {
        var opts = '<option value="' + GRUPO_SOLTO + '"' + (selecionado === GRUPO_SOLTO ? ' selected' : '') + '>Adicionais</option>';
        estado.paineis.forEach(function (p) {
            opts += '<option value="' + esc(p.id) + '"' + (selecionado === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>';
        });
        return opts;
    }

    function renderBom() {
        var lista = document.getElementById('bomLista');
        if (!lista) return;
        migrarItensSemGrupo();
        if (!estado.itens.length && !estado.paineis.length) {
            if (ehSimples()) {
                lista.innerHTML = htmlInserePainel(GRUPO_SOLTO) +
                    '<p class="vazio-hint">Nenhum item. Pesquise acima e inclua. Forme o preço com custo, mão de obra e markup.</p>';
                ligarInsercaoPainel(lista);
            } else {
                lista.innerHTML = '<p class="vazio-hint">Nenhum item. Pesquise o catálogo, escolha o destino (novo painel ou adicionais) e clique em Inserir.</p>';
            }
            renderTotais();
            return;
        }

        function blocoGrupo(grupoId, titulo, extraClass) {
            var pares = itensDoGrupo(grupoId);
            var subtotal = pares.reduce(function (s, p) {
                return s + num(p.it.qtde) * num(p.it.venda_unit);
            }, 0);
            var linhas = pares.map(function (p) {
                var it = p.it;
                var idx = p.idx;
                var tipo = tipoItem(it);
                var custoTxt = EqSec.temPermissao('orcamento_custos') ? (' · custo ' + money(it.custo_unit)) : '';
                var fabTxt = [it.fabricante, it.marca].filter(Boolean).join(' · ');
                var btnTroca = '<button type="button" class="icon-btn troca" data-act="trocar" title="Trocar por equivalente de outro fabricante/marca"><i class="fa-solid fa-right-left"></i></button>';
                return '<div class="bom-row' + (idx === itemAtivoIdx ? ' ativa' : '') + '" data-idx="' + idx + '">' +
                    '<div>' +
                    '<div class="bom-titulo">' + esc(it.descricao) + '</div>' +
                    (fabTxt ? '<div class="bom-fab">' + esc(fabTxt) + '</div>' : '') +
                    '<div class="bom-sub"><span class="tag ' + tagClasse(tipo) + '">' + esc(tipo) + '</span> ' +
                    esc(it.sku || '—') + ' · ' + num(it.qtde) + ' un' + custoTxt + '</div>' +
                    '<select class="sel-mover" data-idx="' + idx + '" title="Mover para">' + opcoesGrupoHtml(grupoDoItem(it)) + '</select>' +
                    '</div>' +
                    '<div>' +
                    '<div class="bom-val">' + money(num(it.qtde) * num(it.venda_unit)) + '</div>' +
                    '<div class="bom-acoes">' +
                    btnTroca +
                    '<button type="button" class="icon-btn" data-act="menos" title="Diminuir">−</button>' +
                    '<button type="button" class="icon-btn" data-act="mais" title="Aumentar">+</button>' +
                    '<button type="button" class="icon-btn" data-act="excluir" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
                    '</div></div></div>';
            }).join('');
            if (!linhas) linhas = '<p class="vazio-hint">Nenhum item neste grupo. Insira o envelope ou componentes com o destino selecionado.</p>';
            var ativo = estado.grupoAtivo === grupoId ? ' ativo' : '';
            var rec = gruposRecolhidos[grupoId] ? ' recolhido' : '';
            var insere = ehSimples() ? htmlInserePainel(grupoId) : '';
            return '<div class="bom-grupo' + extraClass + ativo + rec + '" data-grupo="' + esc(grupoId) + '">' +
                '<header>' +
                btnMinmaxGrupo(grupoId) +
                '<button type="button" class="btn-grupo" data-ativar="' + esc(grupoId) + '"><i class="fa-solid fa-bolt"></i> ' + esc(titulo) + '</button>' +
                badgePcpHtml(painelPorId(grupoId)) +
                '<span>' + pares.length + ' · ' + money(subtotal) + '</span>' +
                (grupoId !== GRUPO_SOLTO ? btnSolicitarHtml(grupoId) : '') +
                (grupoId !== GRUPO_SOLTO ? '<button type="button" class="icon-btn" data-apagar-painel="' + esc(grupoId) + '" title="Remover painel"><i class="fa-solid fa-xmark"></i></button>' : '') +
                '</header>' +
                '<div class="bom-grupo-corpo">' + insere + linhas + (EqSec.temPermissao('orcamento_custos') ? htmlCalcIndustrializado(grupoId) : '') + '</div></div>';
        }

        var html = '';
        if (ehSimples()) {
            html = blocoGrupo(GRUPO_SOLTO, 'Itens do orçamento', ' soltos');
        } else {
            html = estado.paineis.map(function (p) {
                return blocoGrupo(p.id, p.nome, '');
            }).join('');
            html += blocoGrupo(GRUPO_SOLTO, 'Adicionais / itens soltos', ' soltos');
        }
        lista.innerHTML = html;

        lista.querySelectorAll('.bom-row').forEach(function (row) {
            var idx = parseInt(row.getAttribute('data-idx'), 10);
            row.addEventListener('click', function (e) {
                if (e.target.closest('[data-act], .sel-mover')) return;
                destacarItem(idx);
            });
            row.querySelectorAll('[data-act]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var act = btn.getAttribute('data-act');
                    if (act === 'excluir') estado.itens.splice(idx, 1);
                    if (act === 'mais') estado.itens[idx].qtde = num(estado.itens[idx].qtde) + 1;
                    if (act === 'menos') {
                        estado.itens[idx].qtde = Math.max(0.01, num(estado.itens[idx].qtde) - 1);
                    }
                    if (act === 'trocar') {
                        abrirTrocaItem(idx);
                        return;
                    }
                    sincronizarTela();
                });
            });
        });
        lista.querySelectorAll('.sel-mover').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var idx = parseInt(sel.getAttribute('data-idx'), 10);
                if (!estado.itens[idx]) return;
                estado.itens[idx].grupo_id = sel.value;
                estado.grupoAtivo = sel.value;
                sincronizarTela();
            });
        });
        lista.querySelectorAll('[data-ativar]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                estado.grupoAtivo = btn.getAttribute('data-ativar');
                atualizarSelectDestino();
                renderPlanta();
                renderBom();
            });
        });
        lista.querySelectorAll('[data-solicitar]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                solicitarProjetoPainel(btn.getAttribute('data-solicitar'));
            });
        });
        lista.querySelectorAll('[data-minmax]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleGrupoRecolhido(btn.getAttribute('data-minmax'));
            });
        });
        lista.querySelectorAll('[data-apagar-painel]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var gid = btn.getAttribute('data-apagar-painel');
                if (!window.confirm('Remover este painel da montagem? Os itens vão para Adicionais.')) return;
                estado.itens.forEach(function (it) {
                    if (it.grupo_id === gid) it.grupo_id = GRUPO_SOLTO;
                });
                estado.paineis = estado.paineis.filter(function (p) { return p.id !== gid; });
                if (estado.grupoAtivo === gid) estado.grupoAtivo = GRUPO_SOLTO;
                sincronizarTela();
            });
        });
        ligarInsercaoPainel(lista);
        ligarCamposCalc(lista);
        renderTotais();
        if (pendingFocusGrupo && ehSimples()) {
            var alvoBom = lista.querySelector('.busca-no-painel');
            pendingFocusGrupo = null;
            if (alvoBom) alvoBom.focus();
        }
    }

    function atualizarCabecalho() {
        aplicarModoEditor();
        var n = document.getElementById('orcNumero');
        var v = document.getElementById('orcValidade');
        var s = document.getElementById('orcSituacao');
        var badge = document.getElementById('badgeSituacao');
        if (n) n.value = estado.numero;
        if (v) v.value = estado.validade || '';
        if (s) s.value = estado.situacao || 'PENDENTE';
        if (badge) {
            badge.textContent = estado.situacao || 'PENDENTE';
            badge.classList.toggle('salvo', estado.origem === 'supabase');
            badge.classList.toggle('local', estado.origem === 'local');
        }
        var buscaCli = document.getElementById('buscaCliente');
        var chip = document.getElementById('chipCliente');
        var chipTxt = document.getElementById('chipClienteTxt');
        if (estado.cliente_cnpj && chip && chipTxt) {
            chip.classList.add('visivel');
            chipTxt.textContent = (estado.cliente_nome || 'Cliente') + ' · ' + estado.cliente_cnpj;
            if (buscaCli) buscaCli.value = estado.cliente_nome || '';
        } else if (chip) {
            chip.classList.remove('visivel');
        }
        var mo = document.getElementById('orcMoPct');
        var mk = document.getElementById('orcMarkupPct');
        var vend = document.getElementById('orcVendedor');
        var prazo = document.getElementById('orcPrazo');
        var proj = document.getElementById('orcProjeto');
        if (mo && document.activeElement !== mo) mo.value = estado.mao_obra_pct;
        if (mk && document.activeElement !== mk) mk.value = estado.markup_pct;
        if (vend) vend.value = estado.vendedor || '';
        if (prazo) prazo.value = estado.prazo_pagamento || '';
        if (proj) proj.value = estado.projeto || '';
        function setI(id, v) {
            var el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = v == null ? '' : v;
        }
        function setC(id, v) {
            var el = document.getElementById(id);
            if (el) el.checked = !!v;
        }
        setI('orcComprador', estado.comprador);
        setI('orcFreteTipo', estado.tipo_frete || 'CIF');
        setI('orcTransportadora', estado.transportadora);
        setI('orcDetalhesPagto', estado.detalhes_pagto);
        setI('orcObsEntrega', estado.obs_entrega);
        setI('orcPrazoDias', estado.prazo_entrega_dias);
        setI('orcDataAprov', estado.data_aprov_cliente);
        setI('orcDataLimite', estado.data_limite_entrega);
        setI('orcExpedicao', estado.expedicao);
        setI('orcFaturamento', estado.faturamento);
        setI('orcFormaPagto', estado.forma_pagamento);
        setI('orcConta', estado.conta_corrente);
        setI('orcFreteValor', estado.frete_valor);
        setI('orcFreteCusto', estado.frete_custo);
        setI('orcQVolumes', estado.q_volumes);
        setI('orcNVolumes', estado.n_volumes);
        setI('orcPesoBruto', estado.peso_bruto);
        setI('orcPesoLiquido', estado.peso_liquido);
        setI('orcDescFabPct', estado.desc_fabricante_pct);
        setI('orcMargemMeta', estado.margem_minima_pct || 20);
        setC('orcAuthPrazo', estado.auth_prazo_expirado);
        setC('orcAuthMargem', estado.auth_margem_min);
        preencherSelectFabricantes();
        renderTotais();
    }

    function lerCamposCabecalho() {
        estado.numero = (document.getElementById('orcNumero') || {}).value || estado.numero;
        estado.validade = (document.getElementById('orcValidade') || {}).value || estado.validade;
        estado.situacao = (document.getElementById('orcSituacao') || {}).value || estado.situacao;
        estado.mao_obra_pct = num((document.getElementById('orcMoPct') || {}).value);
        estado.markup_pct = num((document.getElementById('orcMarkupPct') || {}).value);
        var metaEl = document.getElementById('orcMargemMeta');
        if (metaEl) estado.margem_minima_pct = num(metaEl.value) || 20;
        estado.vendedor = (document.getElementById('orcVendedor') || {}).value || '';
        estado.prazo_pagamento = (document.getElementById('orcPrazo') || {}).value || '';
        estado.projeto = (document.getElementById('orcProjeto') || {}).value || '';
        estado.comprador = (document.getElementById('orcComprador') || {}).value || '';
        estado.tipo_frete = (document.getElementById('orcFreteTipo') || {}).value || estado.tipo_frete || 'CIF';
        estado.transportadora = (document.getElementById('orcTransportadora') || {}).value || '';
        estado.detalhes_pagto = (document.getElementById('orcDetalhesPagto') || {}).value || '';
        estado.obs_entrega = (document.getElementById('orcObsEntrega') || {}).value || '';
        estado.prazo_entrega_dias = (document.getElementById('orcPrazoDias') || {}).value || '';
        estado.data_aprov_cliente = (document.getElementById('orcDataAprov') || {}).value || '';
        estado.data_limite_entrega = (document.getElementById('orcDataLimite') || {}).value || '';
        estado.expedicao = (document.getElementById('orcExpedicao') || {}).value || '';
        estado.faturamento = (document.getElementById('orcFaturamento') || {}).value || '';
        estado.forma_pagamento = (document.getElementById('orcFormaPagto') || {}).value || '';
        estado.conta_corrente = (document.getElementById('orcConta') || {}).value || '';
        estado.frete_valor = num((document.getElementById('orcFreteValor') || {}).value);
        estado.frete_custo = num((document.getElementById('orcFreteCusto') || {}).value);
        estado.q_volumes = (document.getElementById('orcQVolumes') || {}).value || '';
        estado.n_volumes = (document.getElementById('orcNVolumes') || {}).value || '';
        estado.peso_bruto = num((document.getElementById('orcPesoBruto') || {}).value);
        estado.peso_liquido = num((document.getElementById('orcPesoLiquido') || {}).value);
        estado.desc_fabricante = (document.getElementById('orcDescFab') || {}).value || '';
        estado.desc_fabricante_pct = num((document.getElementById('orcDescFabPct') || {}).value);
        if (EqSec.temPermissao('auth_prazo')) {
            estado.auth_prazo_expirado = !!(document.getElementById('orcAuthPrazo') || {}).checked;
        }
        if (EqSec.temPermissao('auth_margem')) {
            estado.auth_margem_min = !!(document.getElementById('orcAuthMargem') || {}).checked;
        }
    }

    function preencherSelectFabricantes() {
        var sel = document.getElementById('orcDescFab');
        if (!sel) return;
        var atual = estado.desc_fabricante || '';
        var marcas = {};
        estado.itens.forEach(function (it) {
            var m = (it.marca || it.fabricante || '').trim();
            if (m) marcas[m] = true;
        });
        var opts = '<option value="">Todos os itens</option>';
        Object.keys(marcas).sort().forEach(function (m) {
            opts += '<option value="' + esc(m) + '"' + (m === atual ? ' selected' : '') + '>' + esc(m) + '</option>';
        });
        sel.innerHTML = opts;
        if (atual && !marcas[atual]) sel.value = '';
        else sel.value = atual;
    }

    function aplicarDescFabricante() {
        if (!EqSec.temPermissao('orcamento_custos')) {
            toast('Sem permissão para aplicar acréscimo/desconto por fabricante.', true);
            return;
        }
        lerCamposCabecalho();
        var pct = num(estado.desc_fabricante_pct);
        var fab = estado.desc_fabricante;
        var n = 0;
        estado.itens.forEach(function (it) {
            var m = (it.marca || it.fabricante || '').trim();
            if (fab && m !== fab) return;
            it.venda_unit = Math.round(num(it.venda_unit) * (1 + pct / 100) * 10000) / 10000;
            n++;
        });
        sincronizarTela();
        toast(n ? ('Acréscimo/desconto de ' + pct + '% aplicado em ' + n + ' item(ns).') : 'Nenhum item para aplicar.', !n);
    }

    function sincronizarTela() {
        lerCamposCabecalho();
        estado.montagem = processarLayout();
        atualizarCabecalho();
        renderBom();
        renderPlanta();
        persistirLocalSilencioso();
    }

    /* ---------- busca ---------- */
    async function buscarClientes(termo) {
        var dd = document.getElementById('ddClientes');
        termo = EqSec.sanitizarFiltro(termo);
        if (!dd) return;
        if (!termo) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
        try {
            var query = supabaseClient.from('clientes').select('cnpj, razao_social, nome_fantasia')
                .eq('empresa_id', empresaId);
            query = query.or('razao_social.ilike.%' + termo + '%,cnpj.ilike.%' + termo + '%,nome_fantasia.ilike.%' + termo + '%');
            var res = await query.limit(10);
            if (res.error) {
                query = supabaseClient.from('clientes').select('cnpj, razao_social')
                    .eq('empresa_id', empresaId)
                    .or('razao_social.ilike.%' + termo + '%,cnpj.ilike.%' + termo + '%');
                res = await query.limit(10);
            }
            if (res.error) throw res.error;
            var data = res.data || [];
            if (!data.length) {
                dd.innerHTML = '<div class="cli-hit">Nenhum cliente encontrado</div>';
                dd.style.display = 'block';
                return;
            }
            dd.innerHTML = data.map(function (c) {
                return '<div class="cli-hit" data-cnpj="' + esc(c.cnpj) + '" data-nome="' + esc(c.razao_social) + '">' +
                    '<strong>' + esc(c.razao_social) + '</strong>' +
                    (c.nome_fantasia ? '<div class="p-meta">' + esc(c.nome_fantasia) + '</div>' : '') +
                    '<div class="p-meta">CNPJ: ' + esc(c.cnpj) + '</div></div>';
            }).join('');
            dd.style.display = 'block';
            dd.querySelectorAll('.cli-hit').forEach(function (el) {
                el.addEventListener('click', function () {
                    estado.cliente_cnpj = el.getAttribute('data-cnpj') || '';
                    estado.cliente_nome = el.getAttribute('data-nome') || '';
                    dd.style.display = 'none';
                    atualizarCabecalho();
                    persistirLocalSilencioso();
                });
            });
        } catch (err) {
            console.error(err);
            dd.innerHTML = '<div class="cli-hit">Falha na busca de clientes</div>';
            dd.style.display = 'block';
        }
    }

    async function buscarProdutos(termo) {
        var dd = document.getElementById('ddProdutos');
        if (!dd) return;
        if (!EqSec.sanitizarFiltro(termo)) { dd.style.display = 'none'; produtoSelecionado = null; lastHitsProdutos = []; return; }
        try {
            var data = await listarProdutosCatalogo(termo);
            lastHitsProdutos = data;
            if (!data.length) {
                dd.innerHTML = '<div class="prod-hit">Nenhum produto no catálogo</div>';
                dd.style.display = 'block';
                return;
            }
            dd.innerHTML = htmlHitsProdutos(data);
            dd.style.display = 'block';
            dd.querySelectorAll('.prod-hit[data-i]').forEach(function (el) {
                el.addEventListener('click', function () {
                    var i = parseInt(el.getAttribute('data-i'), 10);
                    if (isNaN(i) || !data[i]) return;
                    produtoSelecionado = data[i];
                    inserirProduto();
                });
            });
        } catch (err) {
            console.error(err);
            dd.innerHTML = '<div class="prod-hit">Falha na busca de produtos</div>';
            dd.style.display = 'block';
        }
    }

    function inserirProduto() {
        var dest = ehSimples()
            ? GRUPO_SOLTO
            : ((document.getElementById('selDestino') || {}).value || estado.grupoAtivo || GRUPO_SOLTO);
        var qtde = num((document.getElementById('prodQtde') || {}).value) || 1;
        var prod = produtoSelecionado;
        produtoSelecionado = null;
        var bp = document.getElementById('buscaProduto');
        var pq = document.getElementById('prodQtde');
        var dd = document.getElementById('ddProdutos');
        if (bp) bp.value = '';
        if (pq) pq.value = '1';
        if (dd) dd.style.display = 'none';
        lastHitsProdutos = [];
        inserirNoGrupo(prod, qtde, dest, { foco: 'topo' });
    }

    /* ---------- persistência ---------- */
    function persistirLocalSilencioso() {
        try {
            lerCamposCabecalho();
            sessionStorage.setItem(KEY_RASCUNHO, JSON.stringify(estado));
        } catch (e) { /* quota */ }
    }

    function cnpjObra() {
        return EqSec.cnpjDigitos(estado.cliente_cnpj) || String(estado.cliente_cnpj || '').trim();
    }

    function valorGrupo(grupoId) {
        return itensDoGrupo(grupoId).reduce(function (s, p) {
            return s + num(p.it.qtde) * num(p.it.venda_unit);
        }, 0);
    }

    function painelPorId(grupoId) {
        return estado.paineis.filter(function (p) { return p.id === grupoId; })[0] || null;
    }

    function btnMinmaxGrupo(grupoId) {
        var rec = !!gruposRecolhidos[grupoId];
        return '<button type="button" class="btn-minmax" data-minmax="' + esc(grupoId) + '" title="' + (rec ? 'Expandir painel' : 'Minimizar painel') + '">' +
            '<i class="fa-solid fa-chevron-' + (rec ? 'down' : 'up') + '"></i></button>';
    }

    function toggleGrupoRecolhido(grupoId) {
        gruposRecolhidos[grupoId] = !gruposRecolhidos[grupoId];
        renderPlanta();
        renderBom();
    }

    function aplicarBlocosRecolhidos() {
        ['cliente', 'plantas', 'bom', 'rodape'].forEach(function (id) {
            var el = document.querySelector('.painel-col[data-bloco="' + id + '"]');
            var btn = document.querySelector('.btn-minmax-bloco[data-bloco="' + id + '"] i');
            if (!el) return;
            el.classList.toggle('recolhido', !!blocosRecolhidos[id]);
            if (btn) btn.className = 'fa-solid fa-chevron-' + (blocosRecolhidos[id] ? 'down' : 'up');
        });
    }

    function toggleBloco(id) {
        blocosRecolhidos[id] = !blocosRecolhidos[id];
        aplicarBlocosRecolhidos();
    }

    function badgePcpHtml(p) {
        if (!p || !p.obra_id) return '';
        if (p.pcp && p.pcp.etapa) {
            var pct = p.pcp.progresso != null ? ' · ' + p.pcp.progresso + '%' : '';
            return '<span class="badge-pcp">No PCP' + pct + '</span>';
        }
        return '<span class="badge-pcp fila">Em Novos</span>';
    }

    function btnSolicitarHtml(grupoId) {
        if (!EqSec.temPermissao('orcamento_pcp')) return '';
        var p = painelPorId(grupoId);
        var ja = p && p.obra_id;
        var rotulo = ja ? 'Atualizar PCP' : 'Solicitar projeto';
        return '<button type="button" class="btn-pcp" data-solicitar="' + esc(grupoId) + '" title="Cria o projeto em Status (Novos). A produção só começa ao clicar em Iniciar Produção.">' +
            '<i class="fa-solid fa-diagram-project"></i> ' + rotulo + '</button>';
    }

    function payloadObraPainel(grupoId, etapaId) {
        var p = painelPorId(grupoId);
        var itens = itensDoGrupo(grupoId).map(function (x) {
            return {
                sku: x.it.sku || '',
                descricao: x.it.descricao || '',
                qtde: num(x.it.qtde),
                venda_unit: num(x.it.venda_unit),
                tipo: tipoItem(x.it)
            };
        });
        return {
            empresa_id: empresaId,
            cliente_cnpj: cnpjObra() || null,
            nome_obra: nomeDoGrupo(grupoId),
            codigo_orcamento: estado.numero || null,
            numero_orcamento: estado.numero || null,
            orcamento_id: estado.id ? String(estado.id) : null,
            grupo_id: grupoId,
            origem: 'orcamento',
            valor_total: valorGrupo(grupoId),
            progresso: 0,
            status_kanban: 'aguardando_engenharia',
            status_projeto: 'novo',
            data_inicio: new Date().toISOString().slice(0, 10),
            etapa_pcp_id: etapaId || null,
            especificacoes_tecnicas: {
                origem: 'orcamento',
                orcamento_numero: estado.numero,
                projeto: estado.projeto || '',
                cliente: estado.cliente_nome || '',
                painel: (p && p.nome) || nomeDoGrupo(grupoId),
                itens: itens
            }
        };
    }

    async function gravarLinhaObra(payload, obraId) {
        var body = Object.assign({}, payload);
        var grupoId = body.grupo_id;
        for (var i = 0; i < 10; i++) {
            var res = obraId
                ? await supabaseClient.from('obras').update(body).eq('id', obraId).eq('empresa_id', empresaId).select('id').maybeSingle()
                : await supabaseClient.from('obras').insert([body]).select('id').single();
            if (!res.error) return (res.data && res.data.id) || obraId;
            var msg = String(res.error.message || '');
            var col = msg.match(/Could not find the '([^']+)' column/i);
            if (col && Object.prototype.hasOwnProperty.call(body, col[1])) {
                delete body[col[1]];
                continue;
            }
            if (/duplicate|unique|idx_obras_orc_grupo/i.test(msg) && !obraId && grupoId) {
                var exist = await buscarObraPainel(grupoId);
                if (exist) return exist.id;
            }
            throw res.error;
        }
        throw new Error('Não foi possível gravar o projeto no PCP.');
    }

    async function buscarObraPainel(grupoId) {
        if (!grupoId) return null;
        var sel = 'id, grupo_id, orcamento_id, codigo_orcamento, etapa_pcp_id, progresso, status_kanban, nome_obra';
        async function tentar(filtro) {
            var q = supabaseClient.from('obras').select(sel).eq('empresa_id', empresaId);
            Object.keys(filtro).forEach(function (k) { q = q.eq(k, filtro[k]); });
            var res = await q.limit(5);
            if (res.error) throw res.error;
            return (res.data || []).filter(function (o) { return o.grupo_id === grupoId; })[0] || (res.data && res.data[0]) || null;
        }
        try {
            if (estado.id) {
                try {
                    var porId = await tentar({ orcamento_id: String(estado.id), grupo_id: grupoId });
                    if (porId) return porId;
                } catch (e1) {
                    if (!/orcamento_id|column/i.test(String(e1.message || e1))) throw e1;
                }
            }
            if (estado.numero) {
                return await tentar({ codigo_orcamento: estado.numero, grupo_id: grupoId });
            }
        } catch (e) {
            try {
                if (estado.numero) {
                    var res = await supabaseClient.from('obras').select(sel).eq('empresa_id', empresaId).eq('codigo_orcamento', estado.numero).limit(40);
                    return (res.data || []).filter(function (o) { return o.grupo_id === grupoId; })[0] || null;
                }
            } catch (e2) { /* ignore */ }
        }
        return null;
    }

    async function gravarMontagemVinculos() {
        if (!estado.id) return;
        estado.montagem = processarLayout();
        try {
            await supabaseClient.from('orcamentos').update({ montagem: estado.montagem }).eq('id', estado.id).eq('empresa_id', empresaId);
        } catch (e) { /* ignore */ }
        persistirLocalSilencioso();
    }

    async function sincronizarVinculosPcp() {
        if (ehSimples()) return;
        if (!estado.id && !estado.numero) return;
        var lista = [];
        try {
            var sel = 'id, grupo_id, orcamento_id, codigo_orcamento, etapa_pcp_id, progresso, status_kanban, nome_obra';
            var res = null;
            if (estado.id) {
                res = await supabaseClient.from('obras').select(sel).eq('empresa_id', empresaId).eq('orcamento_id', String(estado.id)).limit(80);
                if (res.error && /orcamento_id|column/i.test(String(res.error.message || ''))) res = null;
            }
            if ((!res || res.error || !(res.data || []).length) && estado.numero) {
                res = await supabaseClient.from('obras').select(sel).eq('empresa_id', empresaId).eq('codigo_orcamento', estado.numero).limit(80);
            }
            if (res && !res.error) lista = res.data || [];
        } catch (e) { lista = []; }
        estado.paineis.forEach(function (p) {
            var hit = lista.filter(function (o) { return o.grupo_id === p.id; })[0];
            if (hit) {
                p.obra_id = hit.id;
                p.pcp = { progresso: hit.progresso || 0, etapa: hit.etapa_pcp_id, status: hit.status_kanban };
            }
        });
        renderBom();
        renderPlanta();
    }

    async function solicitarProjetoPainel(grupoId, silencioso) {
        if (ehSimples()) {
            if (!silencioso) toast('Orçamento simples não envia quadros ao PCP.', true);
            return;
        }
        if (!EqSec.temPermissao('orcamento_pcp')) {
            if (!silencioso) toast('Sem permissão para enviar quadros ao Status/PCP.', true);
            return;
        }
        if (!grupoId || grupoId === GRUPO_SOLTO) {
            toast('Itens soltos não viram quadro no PCP. Monte um painel (QUADRO) para solicitar o projeto.', true);
            return;
        }
        lerCamposCabecalho();
        if (!cnpjObra()) {
            toast('Selecione o cliente antes de enviar o quadro ao PCP.', true);
            return;
        }
        if (!itensDoGrupo(grupoId).length) {
            toast('Este painel está vazio. Insira o quadro e os componentes antes de solicitar o projeto.', true);
            return;
        }
        if (!estado.id) {
            var ok = await salvarOrcamento();
            if (!ok || !estado.id) return;
        }
        try {
            var existente = await buscarObraPainel(grupoId);
            var payload = payloadObraPainel(grupoId, existente ? existente.etapa_pcp_id : null);
            if (existente) {
                delete payload.progresso;
                delete payload.data_inicio;
                delete payload.status_projeto;
                delete payload.etapa_pcp_id;
                delete payload.status_kanban;
            } else {
                payload.etapa_pcp_id = null;
            }
            var id = await gravarLinhaObra(payload, existente ? existente.id : null);
            var p = painelPorId(grupoId);
            if (p) {
                p.obra_id = id;
                p.pcp = {
                    progresso: existente ? (existente.progresso || 0) : 0,
                    etapa: existente ? existente.etapa_pcp_id : null,
                    status: existente ? existente.status_kanban : 'aguardando_engenharia'
                };
            }
            await gravarMontagemVinculos();
            renderBom();
            renderPlanta();
            if (silencioso) return;
            if (existente) {
                toast(nomeDoGrupo(grupoId) + ' atualizado. A etapa do PCP não muda por aqui.');
            } else {
                toast(nomeDoGrupo(grupoId) + ' foi para Status → Novos. Inicie a produção lá para entrar na etapa 1 do Kanban.');
            }
        } catch (err) {
            toast('Não foi possível enviar ao PCP: ' + mensagemErro(err) + '. Rode docs/6_LIGAR_ORCAMENTO_PCP.sql se faltar coluna.', true);
        }
    }

    async function solicitarTodosProjetos() {
        if (ehSimples()) {
            toast('Orçamento simples não envia quadros ao PCP. Use o tipo Industrialização.', true);
            return;
        }
        if (!EqSec.temPermissao('orcamento_pcp')) {
            toast('Sem permissão para enviar quadros ao Status/PCP.', true);
            return;
        }
        lerCamposCabecalho();
        var alvos = estado.paineis.filter(function (p) { return itensDoGrupo(p.id).length; });
        if (!alvos.length) {
            toast('Não há quadros com itens para enviar ao PCP.', true);
            return;
        }
        if (!cnpjObra()) {
            toast('Selecione o cliente antes de enviar os quadros ao PCP.', true);
            return;
        }
        if (!window.confirm('Enviar ' + alvos.length + ' quadro(s) para Status (Novos)?\n\nA fábrica só entra na etapa 1 depois de Iniciar Produção no Kanban.')) {
            return;
        }
        var novos = 0;
        var ja = 0;
        for (var i = 0; i < alvos.length; i++) {
            var antes = alvos[i].obra_id;
            await solicitarProjetoPainel(alvos[i].id, true);
            if (antes) ja++;
            else if (painelPorId(alvos[i].id) && painelPorId(alvos[i].id).obra_id) novos++;
        }
        toast((novos ? novos + ' quadro(s) enviado(s). ' : '') + (ja ? ja + ' já estavam no PCP e foram atualizados.' : ''));
    }

    function snapshotComercial() {
        return {
            comprador: estado.comprador || '',
            transportadora: estado.transportadora || '',
            detalhes_pagto: estado.detalhes_pagto || '',
            obs_entrega: estado.obs_entrega || '',
            prazo_entrega_dias: estado.prazo_entrega_dias || '',
            data_aprov_cliente: estado.data_aprov_cliente || '',
            data_limite_entrega: estado.data_limite_entrega || '',
            expedicao: estado.expedicao || '',
            faturamento: estado.faturamento || '',
            forma_pagamento: estado.forma_pagamento || '',
            conta_corrente: estado.conta_corrente || '',
            q_volumes: estado.q_volumes || '',
            n_volumes: estado.n_volumes || '',
            peso_bruto: num(estado.peso_bruto),
            peso_liquido: num(estado.peso_liquido),
            desc_fabricante: estado.desc_fabricante || '',
            desc_fabricante_pct: num(estado.desc_fabricante_pct),
            auth_prazo_expirado: !!estado.auth_prazo_expirado,
            auth_margem_min: !!estado.auth_margem_min,
            margem_minima_pct: num(estado.margem_minima_pct) || 20,
            modalidade: ehSimples() ? 'simples' : 'industrializacao'
        };
    }

    function hidratarComercial(o) {
        var c = (o && o.totais && o.totais.comercial) || {};
        estado.comprador = o.comprador || c.comprador || '';
        estado.transportadora = o.transportadora || c.transportadora || '';
        estado.detalhes_pagto = c.detalhes_pagto || '';
        estado.obs_entrega = c.obs_entrega || '';
        estado.prazo_entrega_dias = o.prazo_entrega || c.prazo_entrega_dias || '';
        estado.data_aprov_cliente = c.data_aprov_cliente || '';
        estado.data_limite_entrega = c.data_limite_entrega || '';
        estado.expedicao = c.expedicao || '';
        estado.faturamento = c.faturamento || '';
        estado.forma_pagamento = o.forma_pagamento || c.forma_pagamento || '';
        estado.conta_corrente = c.conta_corrente || '';
        estado.frete_valor = num(o.frete_valor != null ? o.frete_valor : c.frete_valor);
        estado.frete_custo = num(o.frete_custo != null ? o.frete_custo : c.frete_custo);
        estado.q_volumes = c.q_volumes || '';
        estado.n_volumes = c.n_volumes || '';
        estado.peso_bruto = num(c.peso_bruto);
        estado.peso_liquido = num(c.peso_liquido);
        estado.desc_fabricante = c.desc_fabricante || '';
        estado.desc_fabricante_pct = num(c.desc_fabricante_pct);
        estado.auth_prazo_expirado = !!c.auth_prazo_expirado;
        estado.auth_margem_min = !!c.auth_margem_min;
        estado.margem_minima_pct = num(c.margem_minima_pct) || 20;
        estado.calcSoltos = Object.assign(calcPadrao(), (o.montagem && o.montagem.soltos && o.montagem.soltos.calc) || {});
        estado.modalidade = inferirModalidade(o);
    }

    function payloadCabecalho() {
        var t = totais();
        return {
            empresa_id: empresaId,
            cliente_cnpj: estado.cliente_cnpj || null,
            cliente_nome: estado.cliente_nome || null,
            numero: estado.numero,
            situacao: estado.situacao || 'PENDENTE',
            validade: estado.validade || null,
            vendedor: estado.vendedor || null,
            projeto: estado.projeto || null,
            prazo_pagamento: estado.prazo_pagamento || null,
            tipo_frete: estado.tipo_frete || null,
            transportadora: estado.transportadora || null,
            prazo_entrega: estado.prazo_entrega_dias || null,
            forma_pagamento: estado.forma_pagamento || null,
            frete_valor: num(estado.frete_valor),
            frete_custo: num(estado.frete_custo),
            custo_material: t.material,
            mao_obra_pct: num(estado.mao_obra_pct),
            mao_obra_valor: t.mao_obra,
            markup_pct: num(estado.markup_pct),
            total_venda: t.venda,
            total_compra: t.material,
            lucro_valor: t.lucro,
            lucro_pct: t.lucro_pct,
            modalidade: ehSimples() ? 'simples' : 'industrializacao',
            totais: Object.assign({}, t, { comercial: snapshotComercial() }),
            montagem: estado.montagem || { slots: [] },
            observacoes: estado.observacoes || null,
            atualizado_em: new Date().toISOString()
        };
    }

    async function salvarOrcamento() {
        lerCamposCabecalho();
        estado.montagem = processarLayout();
        persistirLocalSilencioso();

        if (!estado.itens.length) {
            toast('Inclua ao menos um item antes de salvar.', true);
            return false;
        }

        var btn = document.getElementById('btnSalvarOrc');
        var lblSalvar = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando';
        }
        try {
            var cab = payloadCabecalho();
            var orcId = estado.id;
            for (var c = 0; c < 8; c++) {
                var resCab;
                if (orcId) {
                    resCab = await supabaseClient.from('orcamentos').update(cab).eq('id', orcId).eq('empresa_id', empresaId).select('id').maybeSingle();
                } else {
                    resCab = await supabaseClient.from('orcamentos').insert([cab]).select('id').single();
                }
                if (!resCab.error) {
                    if (!orcId && resCab.data) {
                        orcId = resCab.data.id;
                        estado.id = orcId;
                    }
                    break;
                }
                var mc = String(resCab.error.message || '').match(/Could not find the '([^']+)' column/i);
                if (!mc || !Object.prototype.hasOwnProperty.call(cab, mc[1])) throw resCab.error;
                delete cab[mc[1]];
                if (c === 7) throw resCab.error;
            }
            if (!orcId) throw new Error('Não foi possível gravar o cabeçalho do orçamento.');
            await supabaseClient.from('orcamento_itens').delete().eq('orcamento_id', orcId).eq('empresa_id', empresaId);
            var linhas = estado.itens.map(function (it, ordem) {
                var linha = {
                    orcamento_id: orcId,
                    empresa_id: empresaId,
                    sku: it.sku || null,
                    descricao: it.descricao,
                    qtde: num(it.qtde),
                    custo_unit: num(it.custo_unit),
                    venda_unit: num(it.venda_unit),
                    ordem: ordem,
                    tipo: it.tipoVisual || inferirTipo(it),
                    grupo_id: it.grupo_id || GRUPO_SOLTO,
                    grupo_nome: nomeDoGrupo(it.grupo_id),
                    marca: it.marca || null,
                    fabricante: it.fabricante || null,
                    grupo_produto_id: it.grupo_produto_id || null,
                    fabricante_id: it.fabricante_id || null,
                    marca_id: it.marca_id || null
                };
                var pid = idProdutoBanco(it.produto_id);
                if (pid) linha.produto_id = pid;
                return linha;
            });
            if (linhas.length) {
                var insIt = await supabaseClient.from('orcamento_itens').insert(linhas);
                if (insIt.error && /uuid|22P02|ean_gtin|column/i.test(mensagemErro(insIt.error))) {
                    linhas.forEach(function (l) {
                        delete l.produto_id;
                        delete l.grupo_id;
                        delete l.grupo_nome;
                        delete l.marca;
                        delete l.fabricante;
                        delete l.grupo_produto_id;
                        delete l.fabricante_id;
                        delete l.marca_id;
                    });
                    insIt = await supabaseClient.from('orcamento_itens').insert(linhas);
                }
                if (insIt.error) throw insIt.error;
            }
            estado.origem = 'supabase';
            persistirLocalSilencioso();
            atualizarCabecalho();
            await carregarListaOrcamentos();
            toast('Orçamento ' + estado.numero + ' salvo no banco.');
            await sincronizarVinculosPcp();
            if ((estado.situacao || '').toUpperCase() === 'APROVADO' && !ehSimples()) {
                var faltando = estado.paineis.filter(function (p) {
                    return !p.obra_id && itensDoGrupo(p.id).length;
                });
                if (faltando.length) {
                    toast('Aprovado. Solicite o projeto de cada quadro para ir ao Kanban e ao painel do cliente.');
                }
            }
            return true;
        } catch (err) {
            console.warn('Salvar Supabase falhou, rascunho local:', err);
            estado.origem = 'local';
            persistirLocalSilencioso();
            atualizarCabecalho();
            toast('Não gravou no banco (' + mensagemErro(err) + '). Rascunho ficou neste navegador. Rode docs/5_PROPOSTAS.sql se o erro for UUID.', true);
            return false;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = lblSalvar || '<i class="fa-solid fa-floppy-disk"></i> Salvar';
            }
        }
    }

    function dataBr(iso) {
        if (!iso) return '—';
        var p = String(iso).slice(0, 10).split('-');
        if (p.length !== 3) return String(iso);
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function dataHojeBr() {
        var d = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    function coresMarca() {
        return {
            pri: (emitenteCache && emitenteCache.cor_primaria) || sessionStorage.getItem('masterCorPrimaria') || '#0b1c35',
            sec: (emitenteCache && emitenteCache.cor_secundaria) || sessionStorage.getItem('masterCorSecundaria') || '#2b5c92'
        };
    }

    function dadosEmitente() {
        var e = emitenteCache || {};
        return {
            nome: e.nome_fantasia || sessionStorage.getItem('masterNome') || 'EngQuadros',
            logo: e.logo_url || sessionStorage.getItem('masterLogo') || 'public/logo.png',
            cnpj: EqSec.cnpjMascarado(e.cnpj || sessionStorage.getItem('masterCnpj') || '') || (e.cnpj || sessionStorage.getItem('masterCnpj') || ''),
            email: e.email || '',
            tel: e.telefone || '',
            wpp: e.whatsapp || ''
        };
    }

    function linhaCli(cli) {
        cli = cli || {};
        var end = [cli.endereco || cli.logradouro, cli.numero, cli.complemento, cli.bairro].filter(Boolean).join(', ');
        var cid = [cli.cidade, cli.uf].filter(Boolean).join(' / ');
        var cep = cli.cep ? ('CEP ' + cli.cep) : '';
        return [end, cid, cep].filter(Boolean).join(' · ');
    }

    function htmlDl(rotulo, valor) {
        if (!valor) return '';
        return '<div><span>' + esc(rotulo) + '</span><strong>' + esc(valor) + '</strong></div>';
    }

    function htmlTabelaItens(comPreco) {
        function linhasDe(pares) {
            return pares.map(function (p, i) {
                var it = p.it;
                var q = num(it.qtde);
                var vu = num(it.venda_unit);
                return '<tr>' +
                    '<td class="idx">' + (i + 1) + '</td>' +
                    '<td>' + esc(it.sku || '—') + '</td>' +
                    '<td>' + esc(it.descricao || '') +
                    (it.marca ? '<small class="eq-marca-item">' + esc(it.marca) + '</small>' : '') +
                    '</td>' +
                    '<td class="num">' + q + '</td>' +
                    (comPreco ? '<td class="num">' + money(vu) + '</td><td class="num">' + money(q * vu) + '</td>' : '') +
                    '</tr>';
            }).join('');
        }
        function bloco(titulo, pares) {
            if (!pares.length) return '';
            return '<h3>' + esc(titulo) + '</h3>' +
                '<table class="tab-print"><thead><tr>' +
                '<th>#</th><th>Cód.</th><th>Descrição</th><th>Qtde</th>' +
                (comPreco ? '<th>Unitário</th><th>Total</th>' : '') +
                '</tr></thead><tbody>' + linhasDe(pares) + '</tbody></table>';
        }
        var html = '';
        if (ehSimples()) {
            html += bloco('Itens', estado.itens.map(function (it, idx) { return { it: it, idx: idx }; }));
        } else {
            estado.paineis.forEach(function (p) {
                html += bloco(p.nome, itensDoGrupo(p.id));
            });
            html += bloco('Adicionais / itens soltos', itensDoGrupo(GRUPO_SOLTO));
        }
        return html;
    }

    function htmlPlantasPrint() {
        var layout = processarLayout();
        if (!layout.paineis.length) return '';
        var cards = layout.paineis.map(function (p, i) {
            return '<figure class="eq-planta">' +
                '<figcaption>' + esc(p.nome) + '</figcaption>' +
                svgInterior(p, p.nome, false, 'prn' + i) +
                '</figure>';
        }).join('');
        return '<section class="eq-sec eq-sec-plantas"><h3>Plantas dos painéis</h3><div class="eq-plantas">' + cards + '</div></section>';
    }

    function htmlCondicoesPrint() {
        var em = dadosEmitente();
        var validade = dataBr(estado.validade);
        var pagto = estado.forma_pagamento || estado.prazo_pagamento || 'Conforme combinado na aprovação';
        var frete = (estado.tipo_frete || 'CIF') + (estado.transportadora ? (' · ' + estado.transportadora) : '');
        var prazo = estado.prazo_entrega_dias || estado.prazo_pagamento || '';
        var itens = [];
        if (ehSimples()) {
            itens = [
                '<strong>Objeto.</strong> Fornecimento dos materiais e componentes relacionados nesta lista, novos e de primeiro uso, nas quantidades e especificações indicadas. Este orçamento <em>não</em> contempla projeto elétrico, montagem em painel, ensaios de conjunto nem instalação em campo.',
                '<strong>Validade.</strong> Oferta válida até <strong>' + esc(validade) + '</strong>. Após essa data, preços, prazos e disponibilidade ficam sujeitos a nova confirmação.',
                '<strong>Preços e tributos.</strong> Valores em reais (R$). Impostos (ICMS, IPI, PIS, COFINS e substituição tributária, quando aplicáveis) conforme legislação vigente na data da emissão da NF-e.',
                '<strong>Pagamento.</strong> ' + esc(pagto) + '.',
                '<strong>Frete.</strong> ' + esc(frete) + (estado.frete_valor ? ('. Frete destacado: ' + money(estado.frete_valor)) : '.') ,
                '<strong>Prazo de entrega.</strong> ' + (prazo ? esc(prazo) : 'A combinar na confirmação do pedido') + ', contado em dias úteis após o aceite e, se houver, a compensação da entrada.',
                '<strong>Garantia.</strong> Componentes com garantia do fabricante contra defeitos de fabricação, nas condições da respectiva marca. Não cobre mau uso, instalação inadequada, sobrecarga ou desgaste natural.',
                '<strong>Devolução.</strong> Itens sob encomenda ou corte especial não são passíveis de devolução. Cancelamento após confirmação sujeita-se à política comercial da emitente.',
                '<strong>Aceite.</strong> A aprovação deste orçamento (e-mail, assinatura ou pedido) constitui ordem de fornecimento nas condições aqui descritas. Este documento não substitui a nota fiscal.'
            ];
        } else {
            itens = [
                '<strong>Objeto.</strong> Industrialização de quadro(s) elétrico(s) — fornecimento de envelope, componentes, montagem, identificação e ensaios de rotina — conforme lista de materiais e plantas deste orçamento, para o cliente indicado.',
                '<strong>Normas.</strong> Projeto e montagem em conformidade com NBR IEC 61439 (conjuntos de manobra e comando), NBR 5410 (instalações de baixa tensão) e NR-10 no que couber ao produto industrializado. Grau de proteção, forma construtiva e corrente de curto-circuito conforme memorial ou campo técnico da proposta.',
                '<strong>Validade.</strong> Oferta válida até <strong>' + esc(validade) + '</strong>. Alteração de memorial, lista ou normas após o aceite gera revisão de prazo e preço.',
                '<strong>Preços e tributos.</strong> Valores em reais (R$). Tributos conforme legislação na data da NF-e. Industrialização sujeita ao destaque de IPI/ICMS quando aplicável.',
                '<strong>Pagamento.</strong> ' + esc(pagto) + '.',
                '<strong>Frete e entrega.</strong> ' + esc(frete) + '. Prazo: ' + (prazo ? esc(prazo) : 'a definir na confirmação') + '. Ex-works da fábrica, salvo CIF/FOB indicado.',
                '<strong>Escopo incluso.</strong> Unifilar e de montagem, envelope, barramentos, proteção e comando listados, bornes, identificação, ensaios de rotina e documentação de saída.',
                '<strong>Exclusões.</strong> Obras civis, bases, eletrocalhas e cabos de campo; interligação externa; ART e taxas de concessionária; start-up em sítio, salvo contratação à parte.',
                '<strong>Garantia.</strong> 12 meses contra defeitos de fabricação e montagem, a partir da entrega, desde que o conjunto seja instalado segundo as normas e o memorial. Não cobre ambiente corrosivo, sobrecarga, umidade excessiva ou intervenção de terceiros.',
                '<strong>Aceite.</strong> A aprovação deste orçamento autoriza a industrialização nas condições descritas. Documento comercial — não substitui a NF-e.'
            ];
        }
        return '<section class="eq-sec"><h3>Condições comerciais</h3><ol class="eq-cond">' +
            itens.map(function (t) { return '<li>' + t + '</li>'; }).join('') +
            '</ol>' +
            (estado.observacoes ? '<p class="eq-obs"><strong>Observações:</strong> ' + esc(estado.observacoes) + '</p>' : '') +
            '<p class="eq-confid">Documento confidencial emitido por ' + esc(em.nome) +
            (em.cnpj ? (' · CNPJ ' + esc(em.cnpj)) : '') +
            '. Uso exclusivo do destinatário.</p></section>';
    }

    function htmlFolhaOrcamento() {
        var t = totais();
        var em = dadosEmitente();
        var cli = clientePrint || {};
        var cores = coresMarca();
        var tipoDoc = ehSimples() ? 'Orçamento comercial' : 'Orçamento de industrialização';
        var kicker = ehSimples()
            ? 'Fornecimento de materiais e componentes elétricos'
            : 'Painéis elétricos · Montagem · NBR IEC 61439';
        var nomeCli = estado.cliente_nome || cli.razao_social || cli.nome_fantasia || '—';
        var cnpjCli = EqSec.cnpjMascarado(cli.cnpj || estado.cliente_cnpj) || estado.cliente_cnpj || '';
        var endCli = linhaCli(cli);
        var contatoCli = [cli.nome_contato || cli.responsavel, cli.email, cli.whatsapp || cli.telefone].filter(Boolean).join(' · ');
        var contatoEm = [em.tel, em.wpp ? ('WhatsApp ' + em.wpp) : '', em.email].filter(Boolean).join(' · ');

        return '<article class="folha-eq" style="--eq-pri:' + esc(cores.pri) + ';--eq-sec:' + esc(cores.sec) + ';">' +
            '<header class="eq-topo">' +
            '<div class="eq-marca">' +
            '<img src="' + esc(em.logo) + '" alt="' + esc(em.nome) + '">' +
            '<div><strong>' + esc(em.nome) + '</strong><span>' + kicker + '</span></div>' +
            '</div>' +
            '<div class="eq-doc">' +
            '<em>' + esc(tipoDoc) + '</em>' +
            '<strong>' + esc(estado.numero || 's/n') + '</strong>' +
            '<span>Emissão ' + esc(dataHojeBr()) + ' · Validade ' + esc(dataBr(estado.validade)) + '</span>' +
            '</div></header>' +
            '<div class="eq-faixa"></div>' +
            '<section class="eq-partes">' +
            '<div><h4>Emitente</h4>' +
            '<p class="eq-nome">' + esc(em.nome) + '</p>' +
            (em.cnpj ? '<p>CNPJ ' + esc(em.cnpj) + '</p>' : '') +
            (contatoEm ? '<p>' + esc(contatoEm) + '</p>' : '') +
            '</div>' +
            '<div><h4>Cliente</h4>' +
            '<p class="eq-nome">' + esc(nomeCli) + '</p>' +
            (cnpjCli ? '<p>CNPJ ' + esc(cnpjCli) + '</p>' : '') +
            (cli.inscricao_estadual ? '<p>IE ' + esc(cli.inscricao_estadual) + '</p>' : '') +
            (endCli ? '<p>' + esc(endCli) + '</p>' : '') +
            (contatoCli ? '<p>' + esc(contatoCli) + '</p>' : '') +
            '</div></section>' +
            (function () {
                var meta = [
                    htmlDl('Projeto / obra', estado.projeto),
                    htmlDl('Vendedor', estado.vendedor),
                    htmlDl('Comprador', estado.comprador),
                    htmlDl('Pagamento', estado.forma_pagamento || estado.prazo_pagamento),
                    htmlDl('Frete', (estado.tipo_frete || '') + (estado.transportadora ? (' · ' + estado.transportadora) : '')),
                    htmlDl('Prazo de entrega', estado.prazo_entrega_dias),
                    htmlDl('Situação', estado.situacao)
                ].join('');
                return meta ? '<section class="eq-meta">' + meta + '</section>' : '';
            }()) +
            '<section class="eq-sec">' + htmlTabelaItens(true) + '</section>' +
            '<aside class="eq-totais">' +
            '<div><span>Subtotal</span><strong>' + money(t.venda) + '</strong></div>' +
            '<div><span>Frete</span><strong>' + money(t.frete) + '</strong></div>' +
            '<div class="eq-total"><span>Total</span><strong>' + money(t.total_frete) + '</strong></div>' +
            '</aside>' +
            (ehSimples() ? '' : htmlPlantasPrint()) +
            htmlCondicoesPrint() +
            '<section class="eq-aceite">' +
            '<div><span>De acordo do cliente</span><i></i><small>Nome / carimbo</small></div>' +
            '<div><span>Data</span><i></i><small>Local e data</small></div>' +
            '<div><span>' + esc(em.nome) + '</span><i></i><small>Responsável comercial</small></div>' +
            '</section>' +
            '<footer class="eq-rod">' +
            '<span>' + esc(em.nome) + (em.cnpj ? ' · CNPJ ' + esc(em.cnpj) : '') + '</span>' +
            '<span>EngQuadros — painéis elétricos industriais</span>' +
            '</footer></article>';
    }

    async function garantirClientePrint() {
        clientePrint = clientePrint || {};
        if (!estado.cliente_cnpj || !supabaseClient) return;
        var dig = EqSec.cnpjDigitos(estado.cliente_cnpj);
        if (clientePrint.cnpj && EqSec.cnpjDigitos(clientePrint.cnpj) === dig) return;
        try {
            var res = await supabaseClient.from('clientes')
                .select('razao_social, nome_fantasia, cnpj, inscricao_estadual, email, telefone, whatsapp, nome_contato, responsavel, endereco, logradouro, numero, complemento, bairro, cidade, uf, cep')
                .eq('empresa_id', empresaId)
                .limit(80);
            if (res.error) {
                res = await supabaseClient.from('clientes')
                    .select('razao_social, cnpj, email, telefone, whatsapp')
                    .eq('empresa_id', empresaId)
                    .limit(80);
            }
            var lista = res.data || [];
            clientePrint = lista.filter(function (c) {
                return EqSec.cnpjDigitos(c.cnpj) === dig || EqSec.cnpjDigitos(c.cpf_cnpj) === dig;
            })[0] || { cnpj: estado.cliente_cnpj, razao_social: estado.cliente_nome };
        } catch (e) {
            clientePrint = { cnpj: estado.cliente_cnpj, razao_social: estado.cliente_nome };
        }
    }

    function dispararImpressaoOrc(folha) {
        document.body.classList.add('imprimindo-orc');
        var imgs = folha.querySelectorAll('img');
        var falta = 0;
        var feito = false;
        function go() {
            if (feito) return;
            feito = true;
            window.print();
            document.body.classList.remove('imprimindo-orc');
        }
        imgs.forEach(function (img) {
            if (img.complete) return;
            falta++;
            img.addEventListener('load', function () { falta--; if (!falta) go(); });
            img.addEventListener('error', function () { falta--; if (!falta) go(); });
        });
        if (!falta) go();
        else setTimeout(go, 1500);
    }

    async function imprimirOrcamento() {
        lerCamposCabecalho();
        await garantirClientePrint();
        var folha = document.getElementById('folhaPrintOrc');
        if (!folha) return;
        folha.innerHTML = htmlFolhaOrcamento();
        dispararImpressaoOrc(folha);
    }

    async function abrirEditorProposta() {
        if (!EqSec.temPermissao('propostas')) {
            toast('Sem permissão para o editor de proposta.', true);
            return;
        }
        lerCamposCabecalho();
        if (!estado.itens.length) {
            toast('Inclua ao menos um item antes de gerar a proposta.', true);
            return;
        }
        persistirLocalSilencioso();
        await garantirClientePrint();
        try {
            sessionStorage.setItem('eq_proposta_contexto', JSON.stringify({
                orcamento: estado,
                totais: totais(),
                plantaSvg: ehSimples() ? '' : (document.getElementById('plantaCanvas') ? document.getElementById('plantaCanvas').innerHTML : ''),
                empresaNome: dadosEmitente().nome,
                empresaLogo: dadosEmitente().logo,
                emitente: emitenteCache || null,
                cliente: clientePrint || null
            }));
        } catch (e) { /* quota */ }
        window.location.href = 'proposta.html';
    }

    function processarMontagem() {
        if (ehSimples()) {
            toast('Orçamento simples não tem montagem visual. Inclua itens e use o cálculo de custo e markup.');
            return;
        }
        lerCamposCabecalho();
        estado.montagem = processarLayout();
        renderPlanta();
        renderBom();
        persistirLocalSilencioso();
        var n = estado.itens.length;
        var nP = estado.paineis.length;
        var nS = itensDoGrupo(GRUPO_SOLTO).length;
        toast('Montagem: ' + nP + ' quadro(s), ' + n + ' item(ns)' + (nS ? ', ' + nS + ' adicional(is).' : '.'));
    }

    function mostrarVista(nome) {
        vistaAtual = nome;
        var lista = document.getElementById('vistaLista');
        var editor = document.getElementById('vistaEditor');
        if (lista) lista.style.display = nome === 'lista' ? 'flex' : 'none';
        if (editor) editor.style.display = nome === 'editor' ? 'flex' : 'none';
        if (nome === 'lista') {
            atualizarAvisoRascunho();
            filtrarERenderLista();
        }
    }

    function nomesQuadros(o) {
        var nomes = [];
        if (o.montagem && Array.isArray(o.montagem.paineis)) {
            o.montagem.paineis.forEach(function (p) {
                if (p && p.nome) nomes.push(p.nome);
            });
        }
        (o.itens || []).forEach(function (it) {
            var tipo = it.tipo || inferirTipo(it);
            if (tipo === 'quadro' && (it.descricao || it.sku)) nomes.push(it.descricao || it.sku);
            if (it.grupo_nome) nomes.push(it.grupo_nome);
        });
        var vistos = {};
        return nomes.filter(function (n) {
            var k = String(n).toLowerCase();
            if (vistos[k]) return false;
            vistos[k] = true;
            return true;
        });
    }

    function textoBuscaOrc(o) {
        return [
            o.numero, o.cliente_nome, o.cliente_cnpj, o.projeto, o.observacoes, o.vendedor, o.situacao,
            nomesQuadros(o).join(' ')
        ].join(' ').toLowerCase();
    }

    function filtrarERenderLista() {
        var corpo = document.getElementById('corpoListaOrc');
        var vazio = document.getElementById('msgListaVazia');
        if (!corpo) return;
        var fCli = String((document.getElementById('filtroCliente') || {}).value || '').toLowerCase().trim();
        var fCnpj = EqSec.cnpjDigitos((document.getElementById('filtroCnpj') || {}).value || '');
        var fProj = String((document.getElementById('filtroProjeto') || {}).value || '').toLowerCase().trim();
        var fQuadro = String((document.getElementById('filtroQuadro') || {}).value || '').toLowerCase().trim();
        var fMod = String((document.getElementById('filtroModalidade') || {}).value || '').trim();

        var filtrados = cacheLista.filter(function (o) {
            if (fCli && String(o.cliente_nome || '').toLowerCase().indexOf(fCli) < 0) return false;
            if (fCnpj && EqSec.cnpjDigitos(o.cliente_cnpj).indexOf(fCnpj) < 0) return false;
            if (fProj) {
                var proj = ((o.projeto || '') + ' ' + (o.numero || '') + ' ' + (o.observacoes || '')).toLowerCase();
                if (proj.indexOf(fProj) < 0) return false;
            }
            if (fQuadro) {
                var qs = nomesQuadros(o).join(' ').toLowerCase();
                if (qs.indexOf(fQuadro) < 0) return false;
            }
            if (fMod && inferirModalidade(o) !== fMod) return false;
            return true;
        });

        corpo.innerHTML = filtrados.map(function (o) {
            var data = o.criado_em ? String(o.criado_em).slice(0, 10).split('-').reverse().join('/') : '—';
            var quadros = nomesQuadros(o);
            var tipo = inferirModalidade(o);
            var nIt = (o.itens || []).length;
            var conteudo = tipo === 'simples'
                ? (nIt ? (nIt + (nIt === 1 ? ' item' : ' itens')) : '—')
                : (quadros.length ? quadros.join(', ') : (nIt ? nIt + ' item(ns)' : '—'));
            return '<tr data-id="' + esc(o.id) + '">' +
                '<td><strong>' + esc(o.numero || 's/n') + '</strong></td>' +
                '<td>' + esc(o.cliente_nome || '—') + '</td>' +
                '<td>' + esc(o.cliente_cnpj || '—') + '</td>' +
                '<td>' + esc(o.projeto || o.numero || '—') + '</td>' +
                '<td><span class="tag-tipo ' + tipo + '">' + esc(rotuloModalidade(tipo)) + '</span></td>' +
                '<td>' + esc(conteudo) + '</td>' +
                '<td><span class="badge-sit">' + esc(o.situacao || '') + '</span></td>' +
                '<td>' + money(o.total_venda) + '</td>' +
                '<td>' + esc(data) + '</td>' +
                '<td><button type="button" class="btn-acao ghost btn-abrir-orc" data-id="' + esc(o.id) + '">Abrir</button></td>' +
                '</tr>';
        }).join('');

        if (vazio) {
            var temFiltro = !!(fCli || fCnpj || fProj || fQuadro || fMod);
            vazio.textContent = filtrados.length
                ? ''
                : (temFiltro ? 'Nenhum orçamento com esses filtros.' : 'Nenhum orçamento encontrado. Clique em Novo para começar.');
            vazio.style.display = filtrados.length ? 'none' : 'block';
        }
        var btnLimpar = document.getElementById('btnLimparFiltros');
        if (btnLimpar) btnLimpar.style.display = (fCli || fCnpj || fProj || fQuadro || fMod) ? 'inline-flex' : 'none';
        corpo.querySelectorAll('.btn-abrir-orc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                abrirOrcamento(btn.getAttribute('data-id'));
            });
        });
        corpo.querySelectorAll('tr[data-id]').forEach(function (tr) {
            tr.addEventListener('click', function () {
                if (window.getSelection && String(window.getSelection()).length) return;
                abrirOrcamento(tr.getAttribute('data-id'));
            });
        });
    }

    function atualizarAvisoRascunho() {
        var box = document.getElementById('avisoRascunho');
        if (!box) return;
        var raw = sessionStorage.getItem(KEY_RASCUNHO);
        var tem = false;
        try {
            var obj = raw ? JSON.parse(raw) : null;
            tem = !!(obj && ((obj.itens && obj.itens.length) || obj.cliente_cnpj));
        } catch (e) { tem = false; }
        box.style.display = tem ? 'flex' : 'none';
    }

    async function carregarListaOrcamentos() {
        cacheLista = [];
        try {
            var query = supabaseClient.from('orcamentos')
                .select('id, numero, cliente_cnpj, cliente_nome, situacao, total_venda, criado_em, observacoes, montagem, vendedor, projeto, modalidade, totais')
                .eq('empresa_id', empresaId)
                .order('criado_em', { ascending: false })
                .limit(200);
            var res = await query;
            if (res.error && /modalidade|column/i.test(mensagemErro(res.error))) {
                res = await supabaseClient.from('orcamentos')
                    .select('id, numero, cliente_cnpj, cliente_nome, situacao, total_venda, criado_em, observacoes, montagem, vendedor, projeto, totais')
                    .eq('empresa_id', empresaId)
                    .order('criado_em', { ascending: false })
                    .limit(200);
            }
            if (res.error && /projeto|totais|column/i.test(mensagemErro(res.error))) {
                res = await supabaseClient.from('orcamentos')
                    .select('id, numero, cliente_cnpj, cliente_nome, situacao, total_venda, criado_em, observacoes, montagem, vendedor')
                    .eq('empresa_id', empresaId)
                    .order('criado_em', { ascending: false })
                    .limit(200);
            }
            if (res.error) throw res.error;
            cacheLista = res.data || [];
            var ids = cacheLista.map(function (o) { return o.id; }).filter(Boolean);
            if (ids.length) {
                var its = await supabaseClient.from('orcamento_itens')
                    .select('orcamento_id, descricao, sku, tipo, grupo_nome')
                    .in('orcamento_id', ids);
                if (!its.error && its.data) {
                    var porOrc = {};
                    its.data.forEach(function (it) {
                        porOrc[it.orcamento_id] = porOrc[it.orcamento_id] || [];
                        porOrc[it.orcamento_id].push(it);
                    });
                    cacheLista.forEach(function (o) { o.itens = porOrc[o.id] || []; });
                }
            }
        } catch (e) {
            cacheLista = [];
        }
        filtrarERenderLista();
        atualizarAvisoRascunho();
    }

    async function abrirOrcamento(id) {
        if (!id) return;
        try {
            var cab = await supabaseClient.from('orcamentos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle();
            if (cab.error) throw cab.error;
            if (!cab.data) return;
            var its = await supabaseClient.from('orcamento_itens').select('*').eq('orcamento_id', id).eq('empresa_id', empresaId).order('ordem');
            if (its.error) throw its.error;
            var o = cab.data;
            estado = Object.assign(estadoVazio(), {
                id: o.id,
                numero: o.numero,
                situacao: o.situacao || 'PENDENTE',
                validade: o.validade || '',
                cliente_cnpj: o.cliente_cnpj || '',
                cliente_nome: o.cliente_nome || '',
                vendedor: o.vendedor || '',
                projeto: o.projeto || '',
                prazo_pagamento: o.prazo_pagamento || '',
                tipo_frete: o.tipo_frete || 'CIF',
                mao_obra_pct: num(o.mao_obra_pct),
                markup_pct: num(o.markup_pct),
                observacoes: o.observacoes || '',
                itens: (its.data || []).map(function (it) {
                    return {
                        local_id: it.id,
                        produto_id: it.produto_id,
                        sku: it.sku,
                        descricao: it.descricao,
                        qtde: num(it.qtde),
                        custo_unit: num(it.custo_unit),
                        venda_unit: num(it.venda_unit),
                        tipoVisual: it.tipo || inferirTipo(it),
                        grupo_id: it.grupo_id || null,
                        marca: it.marca || '',
                        fabricante: it.fabricante || '',
                        grupo_produto_id: it.grupo_produto_id || null,
                        fabricante_id: it.fabricante_id || null,
                        marca_id: it.marca_id || null
                    };
                }),
                paineis: (o.montagem && o.montagem.paineis) ? o.montagem.paineis.map(function (p) {
                    return {
                        id: p.id,
                        nome: p.nome,
                        obra_id: p.obra_id || null,
                        calc: Object.assign(calcPadrao(), p.calc || {})
                    };
                }) : [],
                grupoAtivo: GRUPO_SOLTO,
                montagem: o.montagem || {},
                origem: 'supabase'
            });
            hidratarComercial(o);
            estado.modalidade = inferirModalidade(o);
            if (estado.cliente_cnpj) {
                try {
                    var cli = await supabaseClient.from('clientes').select('razao_social, cnpj').eq('empresa_id', empresaId)
                        .ilike('cnpj', '%' + EqSec.sanitizarFiltro(estado.cliente_cnpj) + '%').limit(1).maybeSingle();
                    if (cli.data) estado.cliente_nome = cli.data.razao_social;
                } catch (e2) { /* ignore */ }
            }
            estado.montagem = processarLayout();
            itemAtivoIdx = -1;
            mostrarVista('editor');
            atualizarCabecalho();
            renderBom();
            renderPlanta();
            persistirLocalSilencioso();
            await sincronizarVinculosPcp();
            toast('Orçamento ' + estado.numero + ' carregado.');
        } catch (err) {
            toast('Não foi possível abrir o orçamento.', true);
        }
    }

    function novoOrcamento(modalidade) {
        estado = estadoVazio();
        estado.modalidade = modalidade === 'simples' ? 'simples' : 'industrializacao';
        produtoSelecionado = null;
        itemAtivoIdx = -1;
        gruposRecolhidos = {};
        blocosRecolhidos = { cliente: false, plantas: false, bom: false, rodape: true };
        aplicarBlocosRecolhidos();
        var bp = document.getElementById('buscaProduto');
        var bc = document.getElementById('buscaCliente');
        if (bp) bp.value = '';
        if (bc) bc.value = '';
        fecharEscolhaTipo();
        mostrarVista('editor');
        sincronizarTela();
        setTimeout(function () {
            var alvo = document.getElementById('buscaCliente');
            if (alvo) alvo.focus();
        }, 60);
        toast(ehSimples()
            ? 'Orçamento simples. Busque o cliente e clique nos itens do catálogo.'
            : 'Industrialização. Busque o cliente e clique num QUADRO para iniciar a planta.');
    }

    function restaurarRascunho() {
        try {
            var raw = sessionStorage.getItem(KEY_RASCUNHO);
            if (!raw) return;
            var obj = JSON.parse(raw);
            if (obj && Array.isArray(obj.itens)) {
                estado = Object.assign(estadoVazio(), obj);
            }
        } catch (e) { /* ignore */ }
    }

    function toggleMenu() {
        var m = document.getElementById('menuLateralOrc');
        if (m) m.classList.toggle('aberto');
    }

    async function carregarIdentidade() {
        try {
            var { data: tenant } = await supabaseClient.from('admin_master')
                .select('nome_fantasia, logo_url, cnpj, email, whatsapp, telefone, cor_primaria, cor_secundaria')
                .or('empresa_id.eq.' + empresaId + ',id.eq.' + empresaId)
                .limit(1).maybeSingle();
            if (tenant) {
                emitenteCache = tenant;
                if (tenant.nome_fantasia) sessionStorage.setItem('masterNome', tenant.nome_fantasia);
                if (tenant.logo_url) sessionStorage.setItem('masterLogo', tenant.logo_url);
                if (tenant.cor_primaria) sessionStorage.setItem('masterCorPrimaria', tenant.cor_primaria);
                if (tenant.cor_secundaria) sessionStorage.setItem('masterCorSecundaria', tenant.cor_secundaria);
                if (typeof EqNav !== 'undefined') EqNav.aplicarIdentidade();
            }
        } catch (e) { emitenteCache = {}; }
    }

    function ligarUi() {
        var buscaCli = document.getElementById('buscaCliente');
        var buscaProd = document.getElementById('buscaProduto');
        var debCli = EqSec.debounce(function () { buscarClientes(buscaCli.value); }, 400);
        var debProd = EqSec.debounce(function () { buscarProdutos(buscaProd.value); }, 400);
        if (buscaCli) buscaCli.addEventListener('input', debCli);
        if (buscaProd) {
            buscaProd.addEventListener('input', debProd);
            buscaProd.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (!produtoSelecionado && lastHitsProdutos.length) produtoSelecionado = lastHitsProdutos[0];
                inserirProduto();
            });
        }

        document.getElementById('btnInserir').addEventListener('click', inserirProduto);
        var btnTrocarFab = document.getElementById('btnTrocarFab');
        if (btnTrocarFab) btnTrocarFab.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            abrirTrocaOrcamento();
        });
        var btnCancelarTroca = document.getElementById('btnCancelarTroca');
        if (btnCancelarTroca) btnCancelarTroca.addEventListener('click', fecharModalTroca);
        var modalTroca = document.getElementById('modalTrocaFab');
        if (modalTroca) {
            modalTroca.addEventListener('click', function (e) {
                if (e.target === modalTroca) fecharModalTroca();
            });
        }
        document.querySelectorAll('.btn-minmax-bloco').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleBloco(btn.getAttribute('data-bloco'));
            });
        });
        var h2Rodape = document.querySelector('#blocoRodape > h2');
        if (h2Rodape) {
            h2Rodape.addEventListener('click', function (e) {
                if (e.target.closest('.btn-minmax-bloco')) return;
                toggleBloco('rodape');
            });
            h2Rodape.style.cursor = 'pointer';
        }
        aplicarBlocosRecolhidos();
        document.getElementById('prodQtde').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); inserirProduto(); }
        });
        var selDest = document.getElementById('selDestino');
        if (selDest) {
            selDest.addEventListener('change', function () {
                estado.grupoAtivo = selDest.value === 'novo' ? 'novo' : selDest.value;
                renderPlanta();
                renderBom();
            });
        }
        var btnNovoP = document.getElementById('btnNovoPainel');
        var btnNovoPlanta = document.getElementById('btnNovoPainelPlanta');
        function novoPainelVazio(e) {
            if (e) e.stopPropagation();
            if (ehSimples()) {
                toast('Orçamento simples não cria painéis visuais.', true);
                return;
            }
            var p = criarPainel('Painel ' + (estado.paineis.length + 1));
            pendingFocusGrupo = p.id;
            blocosRecolhidos.plantas = false;
            aplicarBlocosRecolhidos();
            sincronizarTela();
            toast(p.nome + ' criado. Pesquise o envelope e os componentes neste cartão.');
        }
        if (btnNovoP) btnNovoP.addEventListener('click', novoPainelVazio);
        if (btnNovoPlanta) btnNovoPlanta.addEventListener('click', novoPainelVazio);
        document.getElementById('btnSalvarOrc').addEventListener('click', salvarOrcamento);
        var btnPrint = document.getElementById('btnImprimirOrc');
        if (btnPrint) btnPrint.addEventListener('click', imprimirOrcamento);
        var btnProp = document.getElementById('btnPropostaOrc');
        if (btnProp) btnProp.addEventListener('click', abrirEditorProposta);
        var btnPcp = document.getElementById('btnEnviarPcp');
        if (btnPcp) btnPcp.addEventListener('click', solicitarTodosProjetos);
        var btnProc = document.getElementById('btnProcessar');
        if (btnProc) btnProc.addEventListener('click', processarMontagem);
        var btnNovoLista = document.getElementById('btnNovoOrcLista');
        if (btnNovoLista) btnNovoLista.addEventListener('click', abrirEscolhaTipo);
        document.querySelectorAll('#modalTipoOrc [data-tipo]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                novoOrcamento(btn.getAttribute('data-tipo'));
            });
        });
        var btnCancelTipo = document.getElementById('btnCancelarTipoOrc');
        if (btnCancelTipo) btnCancelTipo.addEventListener('click', fecharEscolhaTipo);
        var modalTipo = document.getElementById('modalTipoOrc');
        if (modalTipo) {
            modalTipo.addEventListener('click', function (e) {
                if (e.target === modalTipo) fecharEscolhaTipo();
            });
        }
        var btnVoltar = document.getElementById('btnVoltarLista');
        if (btnVoltar) {
            btnVoltar.addEventListener('click', function () {
                persistirLocalSilencioso();
                mostrarVista('lista');
                carregarListaOrcamentos();
            });
        }
        var btnRasc = document.getElementById('btnContinuarRascunho');
        if (btnRasc) {
            btnRasc.addEventListener('click', function () {
                restaurarRascunho();
                mostrarVista('editor');
                sincronizarTela();
                toast('Rascunho reaberto.');
            });
        }
        var debFiltro = EqSec.debounce(filtrarERenderLista, 250);
        ['filtroCliente', 'filtroCnpj', 'filtroProjeto', 'filtroQuadro'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', debFiltro);
        });
        var filtroMod = document.getElementById('filtroModalidade');
        if (filtroMod) filtroMod.addEventListener('change', filtrarERenderLista);
        var btnLimparFiltros = document.getElementById('btnLimparFiltros');
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', function () {
                ['filtroCliente', 'filtroCnpj', 'filtroProjeto', 'filtroQuadro'].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.value = '';
                });
                if (filtroMod) filtroMod.value = '';
                filtrarERenderLista();
            });
        }
        var filtroCnpj = document.getElementById('filtroCnpj');
        if (filtroCnpj) {
            filtroCnpj.addEventListener('input', function () {
                var d = EqSec.cnpjDigitos(filtroCnpj.value).slice(0, 14);
                var m = d;
                if (d.length > 12) m = d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, '$1.$2.$3/$4-$5');
                else if (d.length > 8) m = d.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, '$1.$2.$3/$4');
                else if (d.length > 5) m = d.replace(/^(\d{2})(\d{3})(\d+)$/, '$1.$2.$3');
                else if (d.length > 2) m = d.replace(/^(\d{2})(\d+)$/, '$1.$2');
                filtroCnpj.value = m;
            });
        }
        ['orcMoPct', 'orcMarkupPct', 'orcNumero', 'orcValidade', 'orcSituacao', 'orcVendedor', 'orcPrazo', 'orcProjeto',
            'orcComprador', 'orcFreteTipo', 'orcTransportadora', 'orcDetalhesPagto', 'orcObsEntrega', 'orcPrazoDias',
            'orcDataAprov', 'orcDataLimite', 'orcExpedicao', 'orcFaturamento', 'orcFormaPagto', 'orcConta',
            'orcFreteValor', 'orcFreteCusto', 'orcQVolumes', 'orcNVolumes', 'orcPesoBruto', 'orcPesoLiquido',
            'orcDescFab', 'orcDescFabPct', 'orcAuthPrazo', 'orcAuthMargem', 'orcMargemMeta'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', function () {
                lerCamposCabecalho();
                persistirLocalSilencioso();
                if (id === 'orcMoPct' || id === 'orcMarkupPct') sincronizarTela();
                else renderTotais();
            });
            el.addEventListener('input', function () {
                if (id === 'orcMoPct' || id === 'orcMarkupPct' || id === 'orcFreteValor' || id === 'orcFreteCusto' || id === 'orcMargemMeta') {
                    lerCamposCabecalho();
                    renderTotais();
                }
            });
        });
        var btnDesc = document.getElementById('btnAplicarDescFab');
        if (btnDesc) btnDesc.addEventListener('click', aplicarDescFabricante);
        var btnMkMeta = document.getElementById('btnAplicarMarkupMeta');
        if (btnMkMeta) btnMkMeta.addEventListener('click', aplicarMarkupDaMeta);
        document.getElementById('btnLimparCliente').addEventListener('click', function () {
            estado.cliente_cnpj = '';
            estado.cliente_nome = '';
            document.getElementById('buscaCliente').value = '';
            atualizarCabecalho();
        });
        document.addEventListener('click', function (e) {
            var ddC = document.getElementById('ddClientes');
            var ddP = document.getElementById('ddProdutos');
            if (ddC && !e.target.closest('#campoCliente')) ddC.style.display = 'none';
            if (ddP && !e.target.closest('#campoProduto')) ddP.style.display = 'none';
            if (!e.target.closest('.insere-painel')) {
                document.querySelectorAll('.dd-no-painel').forEach(function (dd) { dd.style.display = 'none'; });
            }
        });
        document.addEventListener('keydown', function (e) {
            var modal = document.getElementById('modalTipoOrc');
            var modalAberto = modal && modal.classList.contains('aberto');
            if (modalAberto) {
                if (e.key === '1') { e.preventDefault(); novoOrcamento('simples'); return; }
                if (e.key === '2') { e.preventDefault(); novoOrcamento('industrializacao'); return; }
                if (e.key === 'Escape') { e.preventDefault(); fecharEscolhaTipo(); return; }
            }
            if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
                if (vistaAtual === 'editor') { e.preventDefault(); salvarOrcamento(); }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'p') {
                if (vistaAtual === 'editor') { e.preventDefault(); imprimirOrcamento(); }
                return;
            }
            if (e.key === 'F3' && vistaAtual === 'editor') {
                e.preventDefault();
                var local = ehSimples()
                    ? document.getElementById('buscaProduto')
                    : (document.querySelector('.card-painel.ativo .busca-no-painel') ||
                        document.querySelector('.busca-no-painel') ||
                        document.getElementById('buscaProduto'));
                if (local) local.focus();
            }
            if (e.key === 'Escape') fecharEscolhaTipo();
        });
        window.toggleMenuMobileOrc = toggleMenu;
    }

    function aplicarPermissoesOrc() {
        document.querySelectorAll('[data-perm]').forEach(function (el) {
            var ok = EqSec.temPermissao(el.getAttribute('data-perm'));
            el.classList.toggle('perm-oculto', !ok);
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') {
                el.disabled = !ok;
            }
            el.querySelectorAll('input, select, textarea, button').forEach(function (inp) {
                inp.disabled = !ok;
            });
        });
        document.body.classList.toggle('sem-custos', !EqSec.temPermissao('orcamento_custos'));
        var colAuth = document.getElementById('colAutorizacoes');
        if (colAuth) {
            colAuth.classList.toggle('perm-oculto', !EqSec.temPermissao('auth_prazo') && !EqSec.temPermissao('auth_margem'));
        }
    }

    function init() {
        if (!EqSec.exigirPermissao('orcamentos')) return;
        empresaId = sessionStorage.getItem('empresaId');
        supabaseClient = EqSec.criarClienteSupabase();
        if (typeof EqSessionTimeout !== 'undefined') {
            EqSessionTimeout.iniciar(30 * 60 * 1000, function () {
                sessionStorage.clear();
                window.location.href = 'admin.html';
            });
        }
        ligarUi();
        aplicarPermissoesOrc();
        carregarIdentidade();
        carregarListaOrcamentos();
        mostrarVista('lista');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
