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
        var valores = valoresCnpjBusca(cnpjRef != null ? cnpjRef : sessionStorage.getItem('clienteCnpj'));
        if (!valores.length) return query;
        return query.in(coluna, valores);
    }

    function valoresCnpjBusca(cnpjRef) {
        var d = cnpjDigitos(cnpjRef);
        var f = cnpjMascarado(d);
        var out = [];
        if (d) out.push(d);
        if (f && f !== d) out.push(f);
        return out;
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

    var MSG_TENANT_INATIVO = 'Acesso Suspenso - entre em contato com o setor Comercial/Financeiro.';
    var MSG_CLIENTE_INATIVO = 'Acesso bloqueado: este cliente não está ativo no cadastro. Peça à equipe para alterar o Status da Conta para ativo no ERP.';

    function normalizarStatusConta(status) {
        return String(status == null ? '' : status).trim().toUpperCase();
    }

    function empresaEstaAtiva(status) {
        var s = normalizarStatusConta(status);
        return s === 'ATIVO' || s === 'ATIVA';
    }

    function clienteEstaAtivo(status) {
        return empresaEstaAtiva(status);
    }

    var COLUNAS_EMPRESA = 'id,status,cnpj,logo_url,razao_social';

    function acharPorCnpj(linhas, cnpjRef) {
        var d = cnpjDigitos(cnpjRef);
        if (!d) return null;
        return (linhas || []).find(function (row) { return cnpjDigitos(row.cnpj) === d; }) || null;
    }

    async function carregarEmpresa(sb, opts) {
        opts = opts || {};
        var alvoCnpj = cnpjDigitos(opts.cnpj);
        var emp = null;
        var valores = valoresCnpjBusca(alvoCnpj);

        if (opts.empresaId) {
            var r1 = await sb.from('empresas').select(COLUNAS_EMPRESA).eq('id', opts.empresaId).limit(1);
            if (!r1.error && r1.data && r1.data[0]) {
                emp = r1.data[0];
                if (alvoCnpj && cnpjDigitos(emp.cnpj) && cnpjDigitos(emp.cnpj) !== alvoCnpj) emp = null;
            }
        }

        if (!emp && valores.length) {
            var rIn = await sb.from('empresas').select(COLUNAS_EMPRESA).in('cnpj', valores).limit(20);
            if (!rIn.error) emp = acharPorCnpj(rIn.data, alvoCnpj);
        }

        if (!emp) {
            var rTodas = await sb.from('empresas').select(COLUNAS_EMPRESA).limit(1000);
            if (!rTodas.error) emp = acharPorCnpj(rTodas.data, alvoCnpj);
        }

        if (!emp && valores.length) {
            var rMaster = await sb.from('admin_master').select('empresa_id,logo_url,cnpj').in('cnpj', valores).limit(20);
            var master = !rMaster.error ? acharPorCnpj(rMaster.data, alvoCnpj) : null;
            if (!master) {
                var rMasters = await sb.from('admin_master').select('empresa_id,logo_url,cnpj').limit(1000);
                if (!rMasters.error) master = acharPorCnpj(rMasters.data, alvoCnpj);
            }
            if (master) {
                if (master.empresa_id) {
                    var r2 = await sb.from('empresas').select(COLUNAS_EMPRESA).eq('id', master.empresa_id).limit(1);
                    if (!r2.error) emp = r2.data && r2.data[0] ? r2.data[0] : null;
                }
                if (emp && !emp.logo_url) emp.logo_url = master.logo_url;
            }
        }

        return emp;
    }

    async function verificarTenantAtivo(sb, opts) {
        try {
            var emp = await carregarEmpresa(sb, opts || {});
            if (!emp || !emp.status) {
                return { ok: false, tenant: null, logo: (emp && emp.logo_url) || '', mensagem: 'Empresa não encontrada no painel SaaS. Confira o CNPJ cadastrado pelo operador.' };
            }
            if (empresaEstaAtiva(emp.status)) {
                return { ok: true, tenant: emp, logo: emp.logo_url || '', mensagem: '' };
            }
            return { ok: false, tenant: emp, logo: emp.logo_url || '', mensagem: MSG_TENANT_INATIVO };
        } catch (e) {
            console.warn('verificarTenantAtivo', e);
            return { ok: false, tenant: null, logo: '', mensagem: MSG_TENANT_INATIVO };
        }
    }

    async function verificarClienteAtivo(sb, opts) {
        opts = opts || {};
        var cnpj = cnpjDigitos(opts.cnpj);
        if (!sb || !cnpj) {
            return { ok: false, cliente: null, mensagem: MSG_CLIENTE_INATIVO };
        }
        try {
            var q = sb.from('clientes').select('id, status, empresa_id, razao_social, cnpj');
            if (opts.empresaId) q = q.eq('empresa_id', opts.empresaId);
            q = aplicarFiltroCnpj(q, 'cnpj', cnpj);
            var res = await q.limit(8);
            if (res.error) throw res.error;
            var row = (res.data || []).find(function (c) { return mesmaLinhaCnpj(c.cnpj, cnpj); }) || (res.data && res.data[0]) || null;
            if (!row) {
                return { ok: false, cliente: null, mensagem: 'Cadastro do cliente não encontrado.' };
            }
            if (!clienteEstaAtivo(row.status)) {
                return { ok: false, cliente: row, mensagem: MSG_CLIENTE_INATIVO };
            }
            return { ok: true, cliente: row, mensagem: '' };
        } catch (e) {
            console.warn('verificarClienteAtivo', e);
            return { ok: false, cliente: null, mensagem: MSG_CLIENTE_INATIVO };
        }
    }

    global.EqSec = {
        escapeHtml: escapeHtml,
        sanitizarFiltro: sanitizarFiltro,
        debounce: debounce,
        gerarSenha: gerarSenha,
        cnpjDigitos: cnpjDigitos,
        cnpjMascarado: cnpjMascarado,
        valoresCnpjBusca: valoresCnpjBusca,
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
        verificarTenantAtivo: verificarTenantAtivo,
        verificarClienteAtivo: verificarClienteAtivo,
        normalizarStatusConta: normalizarStatusConta,
        empresaEstaAtiva: empresaEstaAtiva,
        clienteEstaAtivo: clienteEstaAtivo,
        MSG_TENANT_INATIVO: MSG_TENANT_INATIVO,
        MSG_CLIENTE_INATIVO: MSG_CLIENTE_INATIVO,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_KEY: SUPABASE_KEY
    };
    global.escapeHtml = escapeHtml;
})(window);
