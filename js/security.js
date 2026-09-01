/**
 * Segurança de sessão, sanitização e client Supabase com headers de tenant.
 */
(function (global) {
    var SUPABASE_URL = 'https://grqfsfvqfnybjckopwqy.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_VEaH0YLuk_Wmf55CpZFOrg_Rv2L5qxE';

    function escapeHtml(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizarFiltro(texto) {
        return String(texto || '').replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function debounce(fn, wait) {
        var timer = null;
        return function () {
            var ctx = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    function gerarSenha(tamanho) {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        var out = '';
        var cryptoObj = global.crypto;
        var n = tamanho || 12;
        for (var i = 0; i < n; i++) {
            var idx;
            if (cryptoObj && cryptoObj.getRandomValues) {
                var buf = new Uint32Array(1);
                cryptoObj.getRandomValues(buf);
                idx = buf[0] % chars.length;
            } else {
                idx = Math.floor(Math.random() * chars.length);
            }
            out += chars[idx];
        }
        return out;
    }

    function cnpjDigitos(valor) {
        return String(valor || '').replace(/\D/g, '');
    }

    function cnpjMascarado(valor) {
        var d = cnpjDigitos(valor);
        if (d.length !== 14) return d;
        return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    function headersTenant() {
        var headers = {};
        var empresaId = sessionStorage.getItem('empresaId') || '';
        var cnpj = cnpjDigitos(sessionStorage.getItem('clienteCnpj'));
        if (empresaId) headers['x-empresa-id'] = empresaId;
        if (cnpj) headers['x-cnpj'] = cnpj;
        return headers;
    }

    function criarClienteSupabase() {
        if (typeof global.supabase === 'undefined') return null;
        var headers = headersTenant();
        return global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            global: {
                headers: headers,
                fetch: function (url, options) {
                    options = options || {};
                    var extra = headersTenant();
                    var merged = new Headers(options.headers || {});
                    Object.keys(extra).forEach(function (k) {
                        merged.set(k, extra[k]);
                    });
                    options.headers = merged;
                    return fetch(url, options);
                }
            }
        });
    }

    function aplicarFiltroCnpj(query, coluna, cnpjRef) {
        coluna = coluna || 'cliente_cnpj';
        var d = cnpjDigitos(cnpjRef != null ? cnpjRef : sessionStorage.getItem('clienteCnpj'));
        var f = cnpjMascarado(d);
        if (!d) return query;
        if (f && f !== d) {
            return query.or(coluna + '.eq.' + d + ',' + coluna + '.eq."' + f + '"');
        }
        return query.eq(coluna, d);
    }

    function mesmaLinhaCnpj(valorBanco, cnpjRef) {
        var d = cnpjDigitos(cnpjRef != null ? cnpjRef : sessionStorage.getItem('clienteCnpj'));
        return !!d && cnpjDigitos(valorBanco) === d;
    }

    function rpcFalhouPorAusencia(error) {
        if (!error || !error.message) return false;
        return /could not find the function|does not exist|schema cache/i.test(error.message);
    }

    function exigirSessaoAdmin() {
        return sessionStorage.getItem('acessoCRM') === 'true' && !!sessionStorage.getItem('empresaId');
    }

    var PERM_TODAS = {
        clientes: true,
        obras: true,
        arquivos: true,
        tickets: true,
        vendas: true,
        compras: true,
        financeiro: true,
        relatorios: true,
        orcamentos: true,
        propostas: true,
        orcamento_custos: true,
        orcamento_pcp: true,
        auth_prazo: true,
        auth_margem: true
    };

    var PERM_FALLBACK = {
        orcamentos: ['vendas'],
        propostas: ['orcamentos', 'vendas'],
        orcamento_custos: ['orcamentos', 'vendas'],
        orcamento_pcp: ['obras']
    };

    function parsePermissoes(raw) {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        try { return JSON.parse(raw); } catch (e) { return {}; }
    }

    function gravarPermissoesSessao(raw) {
        var obj = parsePermissoes(raw);
        sessionStorage.setItem('permissoes', JSON.stringify(obj));
        return obj;
    }

    function isMaster() {
        return sessionStorage.getItem('tipoAcesso') === 'mestre';
    }

    function getPermissoes() {
        if (isMaster()) return Object.assign({}, PERM_TODAS);
        return parsePermissoes(sessionStorage.getItem('permissoes'));
    }

    function temPermissao(chave) {
        if (isMaster()) return true;
        if (!chave) return false;
        var p = getPermissoes();
        if (Object.prototype.hasOwnProperty.call(p, chave)) return !!p[chave];
        var fb = PERM_FALLBACK[chave] || [];
        for (var i = 0; i < fb.length; i++) {
            if (Object.prototype.hasOwnProperty.call(p, fb[i])) return !!p[fb[i]];
        }
        return false;
    }

    function urlPainelErp(hash) {
        return hash ? ('index.html#' + hash) : 'index.html';
    }

    function exigirPermissao(chave) {
        if (!exigirSessaoAdmin()) {
            window.location.href = urlPainelErp();
            return false;
        }
        if (chave && !temPermissao(chave)) {
            window.location.href = urlPainelErp();
            return false;
        }
        return true;
    }

    function valorPermissaoForm(p, chave, fallbackKeys) {
        if (p && Object.prototype.hasOwnProperty.call(p, chave)) return !!p[chave];
        var keys = fallbackKeys || PERM_FALLBACK[chave] || [];
        for (var i = 0; i < keys.length; i++) {
            if (p && p[keys[i]]) return true;
        }
        return false;
    }

    function caminhoStorage(pasta, nomeArquivo) {
        var empresaId = sessionStorage.getItem('empresaId') || 'publico';
        var limpo = String(nomeArquivo || 'arquivo.pdf').replace(/[^\w.\-]+/g, '_');
        return empresaId + '/' + (pasta || 'docs') + '/' + Date.now() + '_' + limpo;
    }

    function validarPdfFront(arquivo) {
        if (!arquivo) return 'Selecione um arquivo PDF.';
        var tipo = (arquivo.type || '').toLowerCase();
        var nome = (arquivo.name || '').toLowerCase();
        if (tipo !== 'application/pdf' && !nome.endsWith('.pdf')) {
            return 'Somente arquivos PDF são permitidos.';
        }
        if (arquivo.size > 20 * 1024 * 1024) {
            return 'O PDF deve ter no máximo 20 MB.';
        }
        return '';
    }

    global.EqSec = {
        escapeHtml: escapeHtml,
        sanitizarFiltro: sanitizarFiltro,
        debounce: debounce,
        gerarSenha: gerarSenha,
        cnpjDigitos: cnpjDigitos,
        cnpjMascarado: cnpjMascarado,
        headersTenant: headersTenant,
        criarClienteSupabase: criarClienteSupabase,
        aplicarFiltroCnpj: aplicarFiltroCnpj,
        mesmaLinhaCnpj: mesmaLinhaCnpj,
        rpcFalhouPorAusencia: rpcFalhouPorAusencia,
        exigirSessaoAdmin: exigirSessaoAdmin,
        isMaster: isMaster,
        parsePermissoes: parsePermissoes,
        gravarPermissoesSessao: gravarPermissoesSessao,
        getPermissoes: getPermissoes,
        temPermissao: temPermissao,
        exigirPermissao: exigirPermissao,
        urlPainelErp: urlPainelErp,
        valorPermissaoForm: valorPermissaoForm,
        PERM_TODAS: PERM_TODAS,
        caminhoStorage: caminhoStorage,
        validarPdfFront: validarPdfFront,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_KEY: SUPABASE_KEY
    };
    global.escapeHtml = escapeHtml;
})(window);
