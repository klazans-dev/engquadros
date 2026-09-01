/**
 * Cadastro de Fabricante, Grupo (equivalência) e Marca.
 * Grupo = família que o orçamento usa para trocar o item por outro fabricante.
 */
(function (global) {
    'use strict';

    var cache = { fabricantes: [], grupos: [], marcas: [] };
    var abaAtual = 'fabricantes';
    var clientCache = null;

    function empresa() {
        return sessionStorage.getItem('empresaId') || global.empresaIdLogada || '';
    }

    function sb() {
        if (clientCache) return clientCache;
        if (typeof EqSec !== 'undefined' && EqSec.criarClienteSupabase) {
            clientCache = EqSec.criarClienteSupabase();
        }
        if (!clientCache && global.supabaseClient) clientCache = global.supabaseClient;
        return clientCache;
    }

    function exigirTenant() {
        var eid = empresa();
        var client = sb();
        if (!client) throw new Error('Sessão sem conexão com o banco. Entre de novo no painel.');
        if (!eid) throw new Error('Sessão sem empresa (tenant). Entre de novo no painel.');
        return { client: client, empresaId: eid };
    }

    function esc(s) {
        return (typeof EqSec !== 'undefined' && EqSec.escapeHtml) ? EqSec.escapeHtml(s) : String(s || '');
    }

    function soDesteTenant(lista) {
        var eid = String(empresa() || '');
        return (lista || []).filter(function (r) {
            return r && r.empresa_id && String(r.empresa_id) === eid;
        });
    }

    function queryTenant(tabela) {
        var ctx = exigirTenant();
        return ctx.client.from(tabela).select('*').eq('empresa_id', ctx.empresaId).order('nome');
    }

    async function carregarCaches() {
        var tabelas = [
            { key: 'fabricantes', tabela: 'produto_fabricantes' },
            { key: 'grupos', tabela: 'produto_grupos' },
            { key: 'marcas', tabela: 'produto_marcas' }
        ];
        for (var i = 0; i < tabelas.length; i++) {
            try {
                var res = await queryTenant(tabelas[i].tabela);
                cache[tabelas[i].key] = soDesteTenant(res.error ? [] : (res.data || []));
            } catch (e) {
                cache[tabelas[i].key] = [];
            }
        }
        preencherDropdownsProduto();
        return cache;
    }

    function optionLista(lista, selecionado, vazio) {
        var html = '<option value="">' + esc(vazio || '— Selecione —') + '</option>';
        (lista || []).forEach(function (r) {
            if (r.ativo === false) return;
            html += '<option value="' + esc(r.id) + '"' + (String(r.id) === String(selecionado || '') ? ' selected' : '') + '>' + esc(r.nome) + '</option>';
        });
        return html;
    }

    function marcasFiltradas(fabricanteId) {
        if (!fabricanteId) return cache.marcas;
        return cache.marcas.filter(function (m) {
            return !m.fabricante_id || String(m.fabricante_id) === String(fabricanteId);
        });
    }

    function preencherUmSelect(id, lista, vazio, selecionado) {
        var el = document.getElementById(id);
        if (!el) return;
        var atual = selecionado != null ? selecionado : el.value;
        el.innerHTML = optionLista(lista, atual, vazio);
        if (atual) el.value = atual;
    }

    function preencherDropdownsProduto(pref) {
        pref = pref || {};
        ['prodFabricante', 'fullEditProdFabricante'].forEach(function (id) {
            preencherUmSelect(id, cache.fabricantes, '— Fabricante —', pref.fabricante_id);
        });
        ['prodGrupoProd', 'fullEditProdGrupoProd'].forEach(function (id) {
            preencherUmSelect(id, cache.grupos, '— Grupo (equivalência) —', pref.grupo_produto_id);
        });
        var fabNovo = (document.getElementById('prodFabricante') || {}).value;
        var fabEdit = (document.getElementById('fullEditProdFabricante') || {}).value;
        preencherUmSelect('prodMarca', marcasFiltradas(fabNovo), '— Marca —', pref.marca_id);
        preencherUmSelect('fullEditProdMarca', marcasFiltradas(fabEdit), '— Marca —', pref.marca_id);
    }

    function ligarFiltroMarca() {
        ['prodFabricante', 'fullEditProdFabricante'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el || el.getAttribute('data-eq-cat')) return;
            el.setAttribute('data-eq-cat', '1');
            el.addEventListener('change', function () {
                var marcaId = id === 'prodFabricante' ? 'prodMarca' : 'fullEditProdMarca';
                preencherUmSelect(marcaId, marcasFiltradas(el.value), '— Marca —', '');
            });
        });
    }

    function nomesDoSelect(selectId) {
        var el = document.getElementById(selectId);
        if (!el || !el.value) return { id: null, nome: '' };
        var opt = el.options[el.selectedIndex];
        return { id: el.value, nome: opt ? String(opt.text || '').trim() : '' };
    }

    function payloadProdutoForm(prefixo) {
        var fab = nomesDoSelect(prefixo + 'Fabricante');
        var gru = nomesDoSelect(prefixo + 'GrupoProd');
        var mar = nomesDoSelect(prefixo + 'Marca');
        return {
            fabricante_id: fab.id,
            grupo_produto_id: gru.id,
            marca_id: mar.id,
            fabricante: fab.nome,
            marca: mar.nome
        };
    }

    async function gravarLinha(tabela, payload, id) {
        var ctx = exigirTenant();
        var body = Object.assign({}, payload, { empresa_id: ctx.empresaId });
        var res;
        if (id) {
            res = await ctx.client.from(tabela).update(body).eq('id', id).eq('empresa_id', ctx.empresaId).select('id').maybeSingle();
        } else {
            res = await ctx.client.from(tabela).insert([body]).select('id').maybeSingle();
        }
        if (res.error) throw res.error;
        return res.data;
    }

    async function novoRapido(tipo, selectId) {
        var labels = { fabricante: 'fabricante', grupo: 'grupo de equivalência', marca: 'marca' };
        var nome = window.prompt('Nome do ' + (labels[tipo] || tipo) + ':');
        if (!nome || !String(nome).trim()) return;
        nome = String(nome).trim();
        var tabela = tipo === 'fabricante' ? 'produto_fabricantes' : (tipo === 'grupo' ? 'produto_grupos' : 'produto_marcas');
        var payload = { nome: nome, ativo: true };
        if (tipo === 'marca') {
            var fabSel = document.getElementById(selectId === 'fullEditProdMarca' ? 'fullEditProdFabricante' : 'prodFabricante');
            if (fabSel && fabSel.value) payload.fabricante_id = fabSel.value;
        }
        try {
            var criado = await gravarLinha(tabela, payload, null);
            await carregarCaches();
            ligarFiltroMarca();
            if (selectId && criado && criado.id) {
                var el = document.getElementById(selectId);
                if (el) el.value = criado.id;
            }
            renderListas();
        } catch (e) {
            alert((e && e.message) ? e.message : String(e));
        }
    }

    function htmlCard(r, tipo) {
        var extra = '';
        if (tipo === 'marca' && r.fabricante_id) {
            var fab = cache.fabricantes.filter(function (f) { return f.id === r.fabricante_id; })[0];
            extra = fab ? '<p style="color:var(--texto-secundario);font-size:0.78rem;margin-top:4px;">Fabricante: ' + esc(fab.nome) + '</p>' : '';
        }
        if (tipo === 'grupo' && r.descricao) {
            extra = '<p style="color:var(--texto-secundario);font-size:0.78rem;margin-top:4px;">' + esc(r.descricao) + '</p>';
        }
        return '<div class="card-box item-cat-card" style="padding:14px 16px;border-left:4px solid var(--azul-sutil);margin:0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
            '<div><h4 style="color:var(--azul-marca);font-size:0.98rem;margin:0;">' + esc(r.nome) + '</h4>' + extra + '</div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button type="button" class="btn-acao" data-cat-editar="' + tipo + '" data-id="' + esc(r.id) + '" style="background:#f1f5f9;color:var(--texto-secundario);border:1px solid #cbd5e1;padding:5px 10px;font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>' +
            '<button type="button" class="btn-acao" data-cat-excluir="' + tipo + '" data-id="' + esc(r.id) + '" style="background:transparent;border:1px solid var(--erro);color:var(--erro);padding:5px 10px;font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button>' +
            '</div></div></div>';
    }

    function renderColuna(tipo, lista, buscaId, listaId) {
        var termo = String((document.getElementById(buscaId) || {}).value || '').toLowerCase().trim();
        var filtrada = (lista || []).filter(function (r) {
            return !termo || String(r.nome || '').toLowerCase().indexOf(termo) >= 0;
        });
        var box = document.getElementById(listaId);
        if (!box) return;
        if (!filtrada.length) {
            box.innerHTML = '<p style="color:var(--texto-secundario);font-size:0.85rem;">Nenhum cadastro.</p>';
            return;
        }
        box.innerHTML = filtrada.map(function (r) { return htmlCard(r, tipo); }).join('');
    }

    function renderListas() {
        renderColuna('fabricante', cache.fabricantes, 'buscaCatFab', 'listaCatFab');
        renderColuna('grupo', cache.grupos, 'buscaCatGrp', 'listaCatGrp');
        renderColuna('marca', cache.marcas, 'buscaCatMarca', 'listaCatMarca');
        ligarClicksLista();
        preencherSelectMarcaForm();
    }

    function preencherSelectMarcaForm() {
        var sel = document.getElementById('catMarcaFabricante');
        if (!sel) return;
        sel.innerHTML = optionLista(cache.fabricantes, sel.value, '— Sem fabricante —');
    }

    function ligarClicksLista() {
        document.querySelectorAll('[data-cat-editar]').forEach(function (btn) {
            btn.onclick = function () { editar(btn.getAttribute('data-cat-editar'), btn.getAttribute('data-id')); };
        });
        document.querySelectorAll('[data-cat-excluir]').forEach(function (btn) {
            btn.onclick = function () { excluir(btn.getAttribute('data-cat-excluir'), btn.getAttribute('data-id')); };
        });
    }

    function tabelaDe(tipo) {
        return tipo === 'fabricante' ? 'produto_fabricantes' : (tipo === 'grupo' ? 'produto_grupos' : 'produto_marcas');
    }

    function listaDe(tipo) {
        return tipo === 'fabricante' ? cache.fabricantes : (tipo === 'grupo' ? cache.grupos : cache.marcas);
    }

    function tituloAba(aba) {
        if (aba === 'grupos') return { icon: 'fa-layer-group', cor: '#7c3aed', tit: 'Grupos de produto', sub: 'Chave de equivalência. Produtos do mesmo grupo podem ser trocados no orçamento (ex.: Disjuntor 100A 3P).' };
        if (aba === 'marcas') return { icon: 'fa-tags', cor: '#c2410c', tit: 'Marcas', sub: 'Linha comercial (Acti9, SIRIUS, WEG…). Pode ficar ligada a um fabricante.' };
        return { icon: 'fa-industry', cor: '#0e7490', tit: 'Fabricantes', sub: 'Schneider, Siemens, WEG, ABB… Vincule no cadastro do produto.' };
    }

    function mostrarAba(aba) {
        abaAtual = aba === 'grupos-produto' || aba === 'grupo' || aba === 'grupos' ? 'grupos'
            : (aba === 'marcas' || aba === 'marca' ? 'marcas' : 'fabricantes');
        document.querySelectorAll('.eq-cat-col').forEach(function (col) {
            col.style.display = col.getAttribute('data-aba') === abaAtual ? 'block' : 'none';
        });
        var meta = tituloAba(abaAtual);
        var h2 = document.getElementById('tituloCatalogoComercial');
        var p = document.getElementById('subCatalogoComercial');
        if (h2) h2.innerHTML = '<i class="fa-solid ' + meta.icon + '" style="color:' + meta.cor + ';"></i> ' + meta.tit;
        if (p) p.textContent = meta.sub;
        var hashAlvo = abaAtual === 'grupos' ? 'grupos-produto' : abaAtual;
        if (String(location.hash || '').replace(/^#/, '') !== hashAlvo) {
            try { history.replaceState(null, '', '#' + hashAlvo); } catch (e) { /* ignore */ }
        }
        if (typeof EqNav !== 'undefined') EqNav.marcarAtivo('admin');
    }

    async function abrir(hash) {
        var painel = document.getElementById('painelCatalogoComercial');
        if (painel) painel.style.display = 'block';
        await carregarCaches();
        ligarFiltroMarca();
        renderListas();
        mostrarAba(hash || abaAtual);
    }

    function toggleForm(tipo, abrir) {
        var box = document.getElementById('boxFormCat' + ({ fabricante: 'Fab', grupo: 'Grp', marca: 'Marca' }[tipo] || ''));
        if (!box) return;
        var show = abrir == null ? (box.style.display === 'none' || !box.style.display) : !!abrir;
        box.style.display = show ? 'block' : 'none';
        if (show && !abrir) {
            var form = box.querySelector('form');
            if (form) form.reset();
            var hid = box.querySelector('input[type=hidden]');
            if (hid) hid.value = '';
        }
    }

    function editar(tipo, id) {
        var r = listaDe(tipo).filter(function (x) { return x.id === id; })[0];
        if (!r) return;
        toggleForm(tipo, true);
        if (tipo === 'fabricante') {
            document.getElementById('catFabId').value = r.id;
            document.getElementById('catFabNome').value = r.nome || '';
        } else if (tipo === 'grupo') {
            document.getElementById('catGrpId').value = r.id;
            document.getElementById('catGrpNome').value = r.nome || '';
            document.getElementById('catGrpDesc').value = r.descricao || '';
        } else {
            document.getElementById('catMarcaId').value = r.id;
            document.getElementById('catMarcaNome').value = r.nome || '';
            document.getElementById('catMarcaFabricante').value = r.fabricante_id || '';
        }
    }

    async function salvar(ev, tipo) {
        ev.preventDefault();
        try {
            if (tipo === 'fabricante') {
                await gravarLinha('produto_fabricantes', { nome: document.getElementById('catFabNome').value.trim(), ativo: true }, document.getElementById('catFabId').value || null);
                toggleForm('fabricante', false);
            } else if (tipo === 'grupo') {
                await gravarLinha('produto_grupos', {
                    nome: document.getElementById('catGrpNome').value.trim(),
                    descricao: document.getElementById('catGrpDesc').value.trim() || null,
                    ativo: true
                }, document.getElementById('catGrpId').value || null);
                toggleForm('grupo', false);
            } else {
                await gravarLinha('produto_marcas', {
                    nome: document.getElementById('catMarcaNome').value.trim(),
                    fabricante_id: document.getElementById('catMarcaFabricante').value || null,
                    ativo: true
                }, document.getElementById('catMarcaId').value || null);
                toggleForm('marca', false);
            }
            await carregarCaches();
            renderListas();
        } catch (e) {
            alert((e && e.message) ? e.message : String(e));
        }
    }

    async function excluir(tipo, id) {
        if (!confirm('Excluir este cadastro? Produtos vinculados ficam sem o vínculo.')) return;
        try {
            var ctx = exigirTenant();
            var res = await ctx.client.from(tabelaDe(tipo)).delete().eq('id', id).eq('empresa_id', ctx.empresaId);
            if (res.error) throw res.error;
            await carregarCaches();
            renderListas();
        } catch (e) {
            alert('Não foi possível excluir: ' + (e.message || e));
        }
    }

    function nomePorId(lista, id) {
        if (!id) return '';
        var r = (lista || []).filter(function (x) { return String(x.id) === String(id); })[0];
        return r ? r.nome : '';
    }

    global.EqCatalogo = {
        abrir: abrir,
        carregar: carregarCaches,
        preencherDropdowns: preencherDropdownsProduto,
        payloadProduto: payloadProdutoForm,
        novoRapido: novoRapido,
        toggleForm: toggleForm,
        salvar: salvar,
        mostrarAba: mostrarAba,
        renderListas: renderListas,
        ligarFiltroMarca: ligarFiltroMarca,
        cache: cache,
        nomeFabricante: function (id) { return nomePorId(cache.fabricantes, id); },
        nomeGrupo: function (id) { return nomePorId(cache.grupos, id); },
        nomeMarca: function (id) { return nomePorId(cache.marcas, id); }
    };
})(window);
