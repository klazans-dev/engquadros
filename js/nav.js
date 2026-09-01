/**
 * Menu principal do ERP — o mesmo em Admin, Dashboard, Orçamentos e Propostas.
 * Navegação sempre na aba atual (sem target=_blank).
 */
(function (global) {
    'use strict';

    function aplicarTema() {
        var pri = sessionStorage.getItem('masterCorPrimaria');
        var sec = sessionStorage.getItem('masterCorSecundaria');
        if (pri) {
            document.documentElement.style.setProperty('--azul-marca', pri);
            document.documentElement.style.setProperty('--azul-profundo', pri);
        }
        if (sec) {
            document.documentElement.style.setProperty('--azul-sutil', sec);
            document.documentElement.style.setProperty('--azul-hover', sec);
        }
    }

    aplicarTema();

    function arquivoAtual() {
        var p = (location.pathname || '').split('/').pop() || '';
        return p.toLowerCase();
    }

    function nomePagina(arquivo) {
        return String(arquivo || arquivoAtual()).toLowerCase().replace(/\.html$/, '');
    }

    function paginaErp() {
        return (typeof EqSec !== 'undefined' && EqSec.urlPainelErp)
            ? EqSec.urlPainelErp().split('#')[0]
            : 'index.html';
    }

    function ehAdmin() {
        var a = nomePagina();
        return !a || a === 'index' || a === 'admin' || a === 'admin_atual';
    }

    function hrefPara(arquivo, hash) {
        var dest = String(arquivo || '').toLowerCase();
        if (nomePagina() === nomePagina(dest)) {
            return hash ? ('#' + hash) : '#';
        }
        return hash ? (arquivo + '#' + hash) : arquivo;
    }

    function hrefModulo(hash) {
        return ehAdmin() ? ('#' + hash) : (paginaErp() + '#' + hash);
    }

    function temQualquer(chaves) {
        if (!chaves || !chaves.length) return true;
        if (typeof EqSec === 'undefined') return true;
        for (var i = 0; i < chaves.length; i++) {
            if (EqSec.temPermissao(chaves[i])) return true;
        }
        return false;
    }

    function visivel(item) {
        if (typeof EqSec === 'undefined') return true;
        if (item.master && !EqSec.isMaster()) return false;
        if (item.permsAny) return temQualquer(item.permsAny);
        if (item.perm) return EqSec.temPermissao(item.perm);
        return true;
    }

    function itens() {
        return [
            { id: 'inicio', href: hrefModulo('inicio'), icon: 'fa-house', label: 'Início' },
            {
                id: 'cadastros', href: hrefModulo('cadastros'), icon: 'fa-folder-tree', label: 'Cadastros', perm: 'clientes',
                filhos: [
                    { href: hrefModulo('clientes'), icon: 'fa-users', label: 'Clientes', perm: 'clientes', ativo: 'clientes' },
                    { href: hrefModulo('produtos'), icon: 'fa-boxes-stacked', label: 'Produtos', perm: 'clientes', ativo: 'produtos' },
                    { href: hrefModulo('fabricantes'), icon: 'fa-industry', label: 'Fabricantes', perm: 'clientes', ativo: 'fabricantes' },
                    { href: hrefModulo('grupos-produto'), icon: 'fa-layer-group', label: 'Grupos de produto', perm: 'clientes', ativo: 'grupos-produto' },
                    { href: hrefModulo('marcas'), icon: 'fa-tags', label: 'Marcas', perm: 'clientes', ativo: 'marcas' },
                    { href: hrefModulo('equipe'), icon: 'fa-user-shield', label: 'Equipe', master: true, ativo: 'equipe' },
                    { href: hrefModulo('trib-estadual'), icon: 'fa-landmark', label: 'Tributação Estadual', perm: 'clientes', ativo: 'trib-estadual' },
                    { href: hrefModulo('trib-federal'), icon: 'fa-building-columns', label: 'Tributação Federal', perm: 'clientes', ativo: 'trib-federal' },
                    { href: hrefModulo('trib-reforma'), icon: 'fa-scale-balanced', label: 'Tributação Reforma', perm: 'clientes', ativo: 'trib-reforma' },
                    { href: hrefModulo('processos'), icon: 'fa-list-check', label: 'Processos', perm: 'obras', ativo: 'processos' },
                    { href: hrefModulo('etapas'), icon: 'fa-gears', label: 'Etapas', perm: 'obras', ativo: 'etapas' }
                ]
            },
            {
                id: 'operacional', href: hrefModulo('operacional'), icon: 'fa-industry', label: 'Operacional', perm: 'obras',
                filhos: [
                    { href: hrefModulo('pcp'), icon: 'fa-gears', label: 'PCP / Fábrica', perm: 'obras', ativo: 'pcp' },
                    { href: hrefModulo('status'), icon: 'fa-table-columns', label: 'Status de obras', perm: 'obras', ativo: 'status' }
                ]
            },
            {
                id: 'vendas', href: hrefModulo('vendas'), icon: 'fa-cart-shopping', label: 'Vendas',
                permsAny: ['vendas', 'orcamentos', 'propostas'],
                filhos: [
                    { href: hrefPara('orcamento.html'), icon: 'fa-file-invoice', label: 'Orçamentos', perm: 'orcamentos', pagina: 'orcamento' },
                    { href: hrefPara('proposta.html'), icon: 'fa-file-signature', label: 'Propostas', perm: 'propostas', pagina: 'proposta' }
                ]
            },
            { id: 'compras', href: hrefModulo('compras'), icon: 'fa-bag-shopping', label: 'Compras', perm: 'compras' },
            { id: 'financeiro', href: hrefModulo('financeiro'), icon: 'fa-sack-dollar', label: 'Financeiro', perm: 'financeiro' },
            {
                id: 'relatorios', href: hrefModulo('relatorios'), icon: 'fa-chart-pie', label: 'Relatórios', perm: 'relatorios',
                filhos: [
                    { href: hrefPara('dashboard.html'), icon: 'fa-chart-line', label: 'Dashboard BI', perm: 'relatorios', pagina: 'dashboard' }
                ]
            },
            { id: 'atendimento', href: hrefModulo('atendimento'), icon: 'fa-headset', label: 'Atendimento ao cliente', perm: 'tickets' },
            { id: 'sistema', href: hrefModulo('sistema'), icon: 'fa-gear', label: 'Sistema', master: true,
                filhos: [
                    { href: hrefModulo('identidade'), icon: 'fa-palette', label: 'Identidade e Tema', master: true, ativo: 'identidade' },
                    { href: hrefModulo('manual'), icon: 'fa-book-open', label: 'Manual de uso', master: true, ativo: 'manual' }
                ]
            }
        ];
    }

    function idAba(id) {
        return 'aba' + id.charAt(0).toUpperCase() + id.slice(1);
    }

    function hashAtual() {
        return String(location.hash || '').replace(/^#/, '').split('?')[0].toLowerCase();
    }

    function marcarAtivo(pagina) {
        var hash = hashAtual();
        var mapaHash = {
            inicio: 'inicio', cadastros: 'cadastros', clientes: 'cadastros', produtos: 'cadastros', equipe: 'cadastros',
            fabricantes: 'cadastros', 'grupos-produto': 'cadastros', marcas: 'cadastros',
            'trib-estadual': 'cadastros', 'trib-federal': 'cadastros', 'trib-reforma': 'cadastros',
            processos: 'cadastros', etapas: 'cadastros',
            operacional: 'operacional', pcp: 'operacional', status: 'operacional',
            vendas: 'vendas', compras: 'compras', financeiro: 'financeiro',
            relatorios: 'relatorios', atendimento: 'atendimento', sistema: 'sistema', identidade: 'sistema', manual: 'sistema'
        };
        var modulo = mapaHash[hash] || '';
        if (pagina === 'dashboard') modulo = 'relatorios';
        if (pagina === 'orcamento' || pagina === 'proposta') modulo = 'vendas';

        document.querySelectorAll('#eqMenuPrincipal .item-menu').forEach(function (el) {
            var on = false;
            if (el.getAttribute('data-id') === modulo) on = true;
            if (pagina === 'orcamento' && el.getAttribute('data-pagina') === 'orcamento') on = true;
            if (pagina === 'proposta' && el.getAttribute('data-pagina') === 'proposta') on = true;
            if (pagina === 'dashboard' && el.getAttribute('data-pagina') === 'dashboard') on = true;
            if (hash && el.getAttribute('data-ativo') === hash) on = true;
            el.classList.toggle('ativa', on);
        });
        document.querySelectorAll('#eqMenuPrincipal .eq-nav-grupo').forEach(function (g) {
            var id = g.getAttribute('data-id');
            var filhoAtivo = g.querySelector('.item-menu.ativa');
            if (filhoAtivo || id === modulo) g.classList.add('aberto');
        });
    }

    function htmlItem(item, filho) {
        if (!visivel(item)) return '';
        var cls = 'item-menu' + (filho ? ' eq-nav-filho' : '');
        var id = item.id ? ' id="' + idAba(item.id) + '"' : '';
        var dataId = item.id ? ' data-id="' + item.id + '"' : '';
        var dataPag = item.pagina ? ' data-pagina="' + item.pagina + '"' : '';
        var dataAtivo = item.ativo ? ' data-ativo="' + item.ativo + '"' : '';
        var perm = item.perm ? ' data-perm="' + item.perm + '"' : '';
        return '<a class="' + cls + '" href="' + item.href + '"' + id + dataId + dataPag + dataAtivo + perm + '>' +
            '<i class="fa-solid ' + item.icon + '"></i>' +
            '<span class="txt-menu">' + item.label + '</span></a>';
    }

    function htmlGrupo(item) {
        if (!visivel(item)) return '';
        var filhos = (item.filhos || []).map(function (f) { return htmlItem(f, true); }).join('');
        if (!filhos) return htmlItem(item, false);
        return '<div class="eq-nav-grupo" data-id="' + item.id + '">' +
            '<button type="button" class="item-menu eq-nav-pai" data-id="' + item.id + '" id="' + idAba(item.id) + '"' +
            (item.perm ? ' data-perm="' + item.perm + '"' : '') + '>' +
            '<i class="fa-solid ' + item.icon + '"></i>' +
            '<span class="txt-menu">' + item.label + '</span>' +
            '<i class="fa-solid fa-chevron-down eq-nav-seta"></i></button>' +
            '<div class="eq-nav-filhos">' + filhos + '</div></div>';
    }

    function montar(opts) {
        opts = opts || {};
        var el = document.getElementById('eqMenuPrincipal');
        if (!el) return;
        var pagina = opts.pagina || el.getAttribute('data-eq-pagina') || detectarPagina();
        el.setAttribute('data-eq-pagina', pagina);

        var html = '';
        itens().forEach(function (item) {
            html += htmlGrupo(item);
        });
        el.innerHTML = html;
        marcarAtivo(pagina);
        aplicarTema();
        aplicarIdentidade();
        ligarSair();
        ligarMobile();
        ligarToggle();
        ligarSubmenus();
        sincronizarTemaBanco();
    }

    function detectarPagina() {
        var a = arquivoAtual();
        if (a.indexOf('dashboard') >= 0) return 'dashboard';
        if (a.indexOf('orcamento') >= 0) return 'orcamento';
        if (a.indexOf('proposta') >= 0) return 'proposta';
        return 'admin';
    }

    function aplicarIdentidade() {
        aplicarTema();
        var logo = sessionStorage.getItem('masterLogo') || '';
        var nome = sessionStorage.getItem('masterNome') || '';
        if (logo && logo !== 'null' && logo !== 'undefined') {
            var fav = document.querySelector("link[rel*='icon']");
            if (fav) fav.href = logo;
            ['logoSidebarBi', 'logoSidebarOrc', 'logoSidebarProp', 'logoTopoSidebar', 'logoSidebarAdmin'].forEach(function (id) {
                var img = document.getElementById(id);
                if (img) {
                    img.src = logo;
                    img.style.display = 'block';
                }
            });
        }
        if (nome) {
            var safe = EqSec ? EqSec.escapeHtml(nome) : nome;
            ['badgeEmpresaBi', 'badgeEmpresaOrc', 'badgeEmpresaProp'].forEach(function (id) {
                var b = document.getElementById(id);
                if (b) b.innerHTML = '<i class="fa-solid fa-industry"></i> ' + safe;
            });
            var razao = document.getElementById('razaoSocialSidebar');
            if (razao) razao.textContent = nome;
        }
    }

    function asideAtual() {
        return document.getElementById('sidebarAdmin')
            || document.querySelector('#telaDashboard > aside')
            || document.querySelector('#telaOrcamento > aside')
            || document.querySelector('#telaProposta > aside');
    }

    function mainAtual() {
        return document.querySelector('#telaPainel > main')
            || document.querySelector('#telaDashboard > main')
            || document.querySelector('#telaOrcamento > main')
            || document.querySelector('#telaProposta > main');
    }

    function definirMenuFechado(fechado) {
        var side = asideAtual();
        if (!side) return;
        side.classList.toggle('encolhida', !!fechado);
        var main = mainAtual();
        if (main) main.classList.toggle('expandido', !!fechado);
        var icone = document.getElementById('iconeToggle');
        if (icone) {
            icone.classList.remove('fa-chevron-left', 'fa-chevron-right');
            icone.classList.add(fechado ? 'fa-chevron-right' : 'fa-chevron-left');
        }
        var btn = document.getElementById('btnToggleSidebar');
        if (btn) btn.setAttribute('title', fechado ? 'Maximizar menu' : 'Minimizar menu');
        sessionStorage.setItem('eqMenuEncolhido', fechado ? '1' : '0');
    }

    function ligarToggle() {
        var btn = document.getElementById('btnToggleSidebar');
        if (!btn || btn.getAttribute('data-eq-toggle')) return;
        btn.setAttribute('data-eq-toggle', '1');
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var side = asideAtual();
            if (!side) return;
            definirMenuFechado(!side.classList.contains('encolhida'));
        });
        var salvo = sessionStorage.getItem('eqMenuEncolhido');
        if (salvo === '1') definirMenuFechado(true);
        else if (salvo === '0') definirMenuFechado(false);
    }

    function ligarSubmenus() {
        var menu = document.getElementById('eqMenuPrincipal');
        if (!menu || menu.getAttribute('data-eq-sub')) return;
        menu.setAttribute('data-eq-sub', '1');
        menu.addEventListener('click', function (e) {
            var pai = e.target.closest('.eq-nav-pai');
            if (!pai || !menu.contains(pai)) return;
            e.preventDefault();
            var grupo = pai.closest('.eq-nav-grupo');
            if (!grupo) return;
            var side = asideAtual();
            if (side && side.classList.contains('encolhida')) {
                definirMenuFechado(false);
                grupo.classList.add('aberto');
                return;
            }
            grupo.classList.toggle('aberto');
        });
    }

    function sincronizarTemaBanco() {
        if (typeof EqSec === 'undefined' || !sessionStorage.getItem('empresaId')) return;
        var sb = EqSec.criarClienteSupabase();
        if (!sb) return;
        var empresaId = sessionStorage.getItem('empresaId');
        sb.from('admin_master')
            .select('nome_fantasia, logo_url, cor_primaria, cor_secundaria')
            .or('empresa_id.eq.' + empresaId + ',id.eq.' + empresaId)
            .limit(1)
            .maybeSingle()
            .then(function (res) {
                var t = res && res.data;
                if (!t) return;
                if (t.nome_fantasia) sessionStorage.setItem('masterNome', t.nome_fantasia);
                if (t.logo_url) sessionStorage.setItem('masterLogo', t.logo_url);
                if (t.cor_primaria) sessionStorage.setItem('masterCorPrimaria', t.cor_primaria);
                if (t.cor_secundaria) sessionStorage.setItem('masterCorSecundaria', t.cor_secundaria);
                aplicarIdentidade();
            })
            .catch(function () { /* identidade da sessão permanece */ });
    }

    function sair() {
        sessionStorage.clear();
        window.location.href = paginaErp();
    }

    function ligarSair() {
        var rodape = document.querySelector('.eq-nav-rodape');
        if (rodape && !rodape.querySelector('.btn-sair-admin')) {
            rodape.innerHTML = '<button type="button" class="btn-sair-admin" id="eqBtnSair">' +
                '<i class="fa-solid fa-power-off"></i> <span>Encerrar sessão</span></button>';
        }
        var btn = document.getElementById('eqBtnSair');
        if (btn && !btn.getAttribute('data-eq-ligado')) {
            btn.setAttribute('data-eq-ligado', '1');
            btn.addEventListener('click', sair);
        }
    }

    function ligarMobile() {
        if (ehAdmin()) return;
        var btn = document.getElementById('btnMenuMobile');
        var menu = document.getElementById('eqMenuPrincipal');
        if (!btn || !menu || btn.getAttribute('data-eq-ligado')) return;
        btn.setAttribute('data-eq-ligado', '1');
        btn.addEventListener('click', function () {
            menu.classList.toggle('aberto');
        });
    }

    function boot() {
        if (document.getElementById('eqMenuPrincipal')) montar({});
    }

    global.EqNav = {
        montar: montar,
        aplicarTema: aplicarTema,
        aplicarIdentidade: aplicarIdentidade,
        marcarAtivo: marcarAtivo,
        definirMenuFechado: definirMenuFechado,
        sair: sair
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
