/**
 * Editor de proposta técnica / comercial (capa, textos, contrato, impressão).
 */
(function () {
    var KEY_CTX = 'eq_proposta_contexto';
    var KEY_MODELOS_LOCAL = 'eq_propostas_modelos';
    var ABAS = ['capa', 'cabecalho', 'rodape', 'texto1', 'texto2', 'texto3', 'texto4', 'contrato'];
    var NOMES_ABA = {
        capa: 'Capa', cabecalho: 'Cabeçalho', rodape: 'Rodapé',
        texto1: 'Texto 1', texto2: 'Texto 2', texto3: 'Texto 3', texto4: 'Texto 4', contrato: 'Contrato'
    };

    var supabaseClient = null;
    var empresaId = null;
    var abaAtual = 'capa';
    var modeloId = null;
    var ctx = { orcamento: null, totais: null, plantaSvg: '', cliente: null, emitente: null };
    var secoes = modeloPadrao();
    var APAR_PADRAO = { capa: '#ffffff', folha: '#ffffff', textoCapa: '#111111', texto: '#111111', destaque: '#0b1c35' };
    var PRESETS_CORES = {
        branco: { capa: '#ffffff', folha: '#ffffff', textoCapa: '#111111', texto: '#111111', destaque: '#0b1c35' },
        creme: { capa: '#fbf7ee', folha: '#fbf7ee', textoCapa: '#1c1917', texto: '#1c1917', destaque: '#0b1c35' },
        cinza: { capa: '#f1f5f9', folha: '#f1f5f9', textoCapa: '#0f172a', texto: '#0f172a', destaque: '#334155' },
        azul: { capa: '#0b1c35', folha: '#ffffff', textoCapa: '#f8fafc', texto: '#111111', destaque: '#0b1c35' },
        verde: { capa: '#ecfdf5', folha: '#ffffff', textoCapa: '#064e3b', texto: '#111111', destaque: '#0f766e' }
    };
    var aparencia = Object.assign({}, APAR_PADRAO);
    var fundosPagina = {};
    var resizeImg = null;

    var CAMPOS = [
        'NUM_ORCAM', 'NUM_PROPOSTA', 'DATA_PROPOSTA', 'STATUS', 'TOTAL_GERAL',
        'FRETE_TIPO', 'PRAZO_DE_PAGAMENTO', 'DATA_VALIDADE', 'PRAZO_ENTREGA',
        'CLIENTE', 'CNPJ_CLIENTE', 'CNPJ_CLIENTE_FORMATADO', 'INSCRICAO_CLIENTE',
        'TEL_CLIENTE', 'EMAIL_CLIENTE', 'ENDER_CLIENTE', 'CIDADE_CLIENTE',
        'BAIRRO_CLIENTE', 'CEP_CLIENTE', 'NUMERO_CLIENTE', 'COMPL_CLIENTE', 'CONTATO_CLIENTE',
        'EMITENTE', 'CNPJ_EMITENTE', 'LOGO_EMITENTE', 'TEL_EMITENTE', 'EMAIL_EMITENTE', 'WPP_EMITENTE',
        'ORCAMENTISTA', 'TIPO_ORCAMENTO', 'PROJETO', 'FORMA_PAGAMENTO',
        'OBS', 'DATA_ATUAL', 'TABELA_TECNICA', 'TABELA_COMERCIAL',
        'CAMPO1', 'CAMPO2', 'CAMPO3', 'CAMPO4', 'CAMPO5', 'CAMPO6'
    ];

    function orcamentoSimples() {
        return ctx.orcamento && ctx.orcamento.modalidade === 'simples';
    }

    function modeloCapa(titulo, sub) {
        return '<div style="font-family:Montserrat,Inter,sans-serif;color:inherit;">' +
            '<div style="background:#0b1c35;color:#f8fafc;padding:32px 28px 26px;">' +
            '{{LOGO_EMITENTE}}' +
            '<p style="letter-spacing:3.5px;font-size:10px;margin:16px 0 8px;opacity:.72;text-transform:uppercase;">{{EMITENTE}}</p>' +
            '<h1 style="font-size:22px;margin:0 0 8px;letter-spacing:.4px;font-weight:800;">' + titulo + '</h1>' +
            '<p style="font-size:12px;opacity:.88;margin:0;font-weight:500;">' + sub + '</p>' +
            '</div>' +
            '<div style="height:5px;background:linear-gradient(90deg,#0b1c35,#06b6d4 55%,#c2782a);"></div>' +
            '<table style="width:100%;margin-top:28px;border-collapse:collapse;">' +
            '<tr><td style="width:52%;vertical-align:top;padding-right:18px;">' +
            '<p style="letter-spacing:1.6px;font-size:10px;color:#2b5c92;font-weight:700;margin:0 0 6px;">CLIENTE</p>' +
            '<p style="font-size:16px;font-weight:700;margin:0 0 6px;color:#0b1c35;">{{CLIENTE}}</p>' +
            '<p style="font-size:12px;margin:0;color:#475569;">CNPJ {{CNPJ_CLIENTE_FORMATADO}}<br>{{ENDER_CLIENTE}} {{NUMERO_CLIENTE}}<br>{{CIDADE_CLIENTE}} {{CEP_CLIENTE}}<br>{{CONTATO_CLIENTE}} · {{TEL_CLIENTE}}</p>' +
            '</td><td style="vertical-align:top;border-left:1px solid #e2e8f0;padding-left:18px;">' +
            '<p style="letter-spacing:1.6px;font-size:10px;color:#2b5c92;font-weight:700;margin:0 0 8px;">REFERÊNCIA</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Proposta</strong> {{NUM_PROPOSTA}}</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Orçamento</strong> {{NUM_ORCAM}}</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Projeto</strong> {{PROJETO}}</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Emissão</strong> {{DATA_PROPOSTA}}</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Validade</strong> {{DATA_VALIDADE}}</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Total</strong> {{TOTAL_GERAL}}</p>' +
            '</td></tr></table>' +
            '<p style="margin-top:40px;font-size:11px;color:#64748b;line-height:1.5;">Documento confidencial. Destinado exclusivamente ao cliente identificado. ' +
            '{{EMITENTE}} · CNPJ {{CNPJ_EMITENTE}} · {{EMAIL_EMITENTE}} · {{TEL_EMITENTE}}</p>' +
            '</div>';
    }

    function modeloPadrao() {
        var simples = orcamentoSimples();
        if (simples) {
            return {
                capa: modeloCapa('PROPOSTA COMERCIAL', 'Fornecimento de materiais e componentes elétricos'),
                cabecalho:
                    '<table style="width:100%;border-collapse:collapse;font-family:Montserrat,Inter,sans-serif;">' +
                    '<tr><td style="width:22%;vertical-align:middle;">{{LOGO_EMITENTE}}</td>' +
                    '<td style="width:46%;"><strong style="color:#0b1c35;">{{EMITENTE}}</strong><br>' +
                    '<span style="font-size:10px;color:#64748b;">Proposta comercial {{NUM_PROPOSTA}} · Orçamento {{NUM_ORCAM}}</span></td>' +
                    '<td style="text-align:right;font-size:10px;color:#475569;">{{CLIENTE}}<br>{{DATA_ATUAL}} · Válida até {{DATA_VALIDADE}}</td></tr></table>' +
                    '<div style="height:3px;margin-top:8px;background:linear-gradient(90deg,#0b1c35,#06b6d4);"></div>',
                rodape:
                    '<p style="text-align:center;font-size:8.5px;color:#64748b;font-family:Inter,sans-serif;">{{EMITENTE}} · CNPJ {{CNPJ_EMITENTE}} · {{EMAIL_EMITENTE}} · Documento confidencial · {{DATA_ATUAL}}</p>',
                texto1:
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">1. Objeto</h2>' +
                    '<p style="text-align:justify;">A presente proposta tem por objeto o <strong>fornecimento dos materiais e componentes elétricos</strong> relacionados, novos e de primeiro uso, nas quantidades e especificações da lista abaixo, para <strong>{{CLIENTE}}</strong>.</p>' +
                    '<p style="text-align:justify;">Não estão incluídos projeto elétrico de conjunto, montagem em painel, ensaios de rotina de conjunto (NBR IEC 61439) nem instalação, comissionamento ou start-up em campo — salvo se contratados à parte em proposta de industrialização.</p>' +
                    '<p>{{TABELA_TECNICA}}</p>',
                texto2:
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">2. Condições de fornecimento</h2>' +
                    '<p style="text-align:justify;">Os itens serão fornecidos nas marcas e códigos indicados ou equivalente técnico de mesmo desempenho, mediante comunicação prévia em caso de substituição por descontinuidade de linha.</p>' +
                    '<ul>' +
                    '<li>Embalagem adequada ao transporte rodoviário nacional;</li>' +
                    '<li>Disponibilidade sujeita a estoque do fabricante na data da confirmação;</li>' +
                    '<li>Itens sob encomenda ou corte especial não são passíveis de devolução;</li>' +
                    '<li>Prazo de entrega: <strong>{{PRAZO_ENTREGA}}</strong> (dias úteis após aceite e, se houver, compensação da entrada).</li>' +
                    '</ul>' +
                    '<p><strong>Frete:</strong> {{FRETE_TIPO}}. <strong>Pagamento:</strong> {{PRAZO_DE_PAGAMENTO}} {{FORMA_PAGAMENTO}}.</p>',
                texto3:
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">3. Escopo incluso</h2>' +
                    '<ul>' +
                    '<li>Materiais e componentes da lista comercial, com nota fiscal;</li>' +
                    '<li>Manuais e certificados do fabricante, quando o item os possuir de origem;</li>' +
                    '<li>Conferência quantitativa na expedição.</li>' +
                    '</ul>' +
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">4. Exclusões</h2>' +
                    '<ul>' +
                    '<li>Projeto, diagramas unifilares e de montagem de conjunto;</li>' +
                    '<li>Envelope, barramento, fiação interna e identificação de painel;</li>' +
                    '<li>Obras civis, eletrocalhas, cabos de campo e mão de obra de instalação;</li>' +
                    '<li>ART, taxas de concessionária e laudos de NR-10 de sítio.</li>' +
                    '</ul>',
                texto4:
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">5. Garantia e responsabilidade</h2>' +
                    '<p style="text-align:justify;">A garantia dos componentes é a do respectivo fabricante contra defeitos de fabricação, nas condições da marca. Não cobre mau uso, instalação em desacordo com NBR 5410, sobrecarga, umidade, ambiente corrosivo ou intervenção de terceiros.</p>' +
                    '<p style="text-align:justify;">A {{EMITENTE}} não se responsabiliza por dimensionamento de proteção, seletividade ou curto-circuito quando o memorial não for de sua autoria.</p>' +
                    '<p>{{OBS}}</p>',
                contrato:
                    '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">Condições comerciais</h2>' +
                    '<p>{{TABELA_COMERCIAL}}</p>' +
                    '<p><strong>Total da proposta:</strong> {{TOTAL_GERAL}}</p>' +
                    '<p><strong>Prazo de pagamento:</strong> {{PRAZO_DE_PAGAMENTO}} &nbsp;|&nbsp; <strong>Forma:</strong> {{FORMA_PAGAMENTO}}</p>' +
                    '<p><strong>Validade:</strong> {{DATA_VALIDADE}} &nbsp;|&nbsp; <strong>Frete:</strong> {{FRETE_TIPO}} &nbsp;|&nbsp; <strong>Entrega:</strong> {{PRAZO_ENTREGA}}</p>' +
                    '<p style="text-align:justify;">Preços em reais. Impostos (ICMS, IPI, PIS, COFINS e ST, quando aplicáveis) conforme legislação vigente na data da NF-e. A aprovação desta proposta, por e-mail ou assinatura, constitui pedido de compra. Este documento não substitui a nota fiscal.</p>' +
                    '<p style="margin-top:28px;">Local e data: ________________________, {{DATA_ATUAL}}</p>' +
                    '<table style="width:100%;margin-top:36px;"><tr>' +
                    '<td style="width:48%;text-align:center;padding-top:36px;border-top:1px solid #94a3b8;font-size:11px;">De acordo — {{CLIENTE}}<br>Nome / carimbo</td>' +
                    '<td style="width:4%;"></td>' +
                    '<td style="width:48%;text-align:center;padding-top:36px;border-top:1px solid #94a3b8;font-size:11px;">{{EMITENTE}}<br>{{ORCAMENTISTA}}</td>' +
                    '</tr></table>'
            };
        }
        return {
            capa: modeloCapa('PROPOSTA TÉCNICA E COMERCIAL', 'Industrialização de painéis elétricos · NBR IEC 61439 · NBR 5410'),
            cabecalho:
                '<table style="width:100%;border-collapse:collapse;font-family:Montserrat,Inter,sans-serif;">' +
                '<tr><td style="width:22%;vertical-align:middle;">{{LOGO_EMITENTE}}</td>' +
                '<td style="width:46%;"><strong style="color:#0b1c35;">{{EMITENTE}}</strong><br>' +
                '<span style="font-size:10px;color:#64748b;">Proposta técnica/comercial {{NUM_PROPOSTA}} · {{NUM_ORCAM}}</span></td>' +
                '<td style="text-align:right;font-size:10px;color:#475569;">{{CLIENTE}}<br>{{DATA_ATUAL}} · Válida até {{DATA_VALIDADE}}</td></tr></table>' +
                '<div style="height:3px;margin-top:8px;background:linear-gradient(90deg,#0b1c35,#06b6d4 60%,#c2782a);"></div>',
            rodape:
                '<p style="text-align:center;font-size:8.5px;color:#64748b;font-family:Inter,sans-serif;">{{EMITENTE}} · CNPJ {{CNPJ_EMITENTE}} · Industrialização de painéis · Documento confidencial</p>',
            texto1:
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">1. Objeto</h2>' +
                '<p style="text-align:justify;">A {{EMITENTE}} apresenta a presente proposta para <strong>industrialização de quadro(s) elétrico(s)</strong> — fornecimento de envelope, componentes, montagem, identificação, ensaios de rotina e documentação de saída — conforme memorial, lista de materiais e plantas do orçamento <strong>{{NUM_ORCAM}}</strong>, destinado a <strong>{{CLIENTE}}</strong>.</p>' +
                '<p style="text-align:justify;">O conjunto será entregue montado, ensaiado e identificado, pronto para instalação em campo pelo contratante ou por terceiros por ele indicados.</p>' +
                '<p>{{TABELA_TECNICA}}</p>',
            texto2:
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">2. Normas e critérios</h2>' +
                '<p style="text-align:justify;">O projeto e a montagem observarão, no que couber ao produto industrializado:</p>' +
                '<ul>' +
                '<li><strong>NBR IEC 61439-1 e 61439-2</strong> — conjuntos de manobra e comando de baixa tensão;</li>' +
                '<li><strong>NBR 5410</strong> — instalações elétricas de baixa tensão (critérios de projeto do conjunto);</li>' +
                '<li><strong>NR-10</strong> — segurança em instalações e serviços em eletricidade, no âmbito do produto;</li>' +
                '<li>Grau de proteção, forma construtiva, tensão, corrente nominal e Icw / Ipk conforme memorial ou <strong>{{CAMPO1}}</strong>.</li>' +
                '</ul>' +
                '<p>Alteração de memorial, lista ou normas após o aceite gera revisão de prazo e preço.</p>',
            texto3:
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">3. Escopo incluso</h2>' +
                '<ul>' +
                '<li>Diagrama unifilar e de montagem do(s) painel(is) desta proposta;</li>' +
                '<li>Envelope / gabinete, placa de montagem, barramentos e sistema de aterramento interno;</li>' +
                '<li>Dispositivos de proteção e comando da lista, bornes, fiação interna e identificação;</li>' +
                '<li>Ensaios de rotina (continuidade de massa, rigidez dielétrica quando aplicável, inspeção visual e funcional);</li>' +
                '<li>Documentação de saída (lista de materiais as-built e relatórios de ensaio).</li>' +
                '</ul>' +
                '<p><strong>Prazo de fabricação / entrega:</strong> {{PRAZO_ENTREGA}} após aprovação do memorial e do pagamento da entrada, se houver.</p>',
            texto4:
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">4. Exclusões</h2>' +
                '<ul>' +
                '<li>Obras civis, bases, abrigos, eletrocalhas, leitos e infraestrutura de campo;</li>' +
                '<li>Cabos de interligação externa, seccionadoras de entrada de obra e padrão da concessionária;</li>' +
                '<li>ART, taxas, laudos de sítio e start-up em campo, salvo contratação à parte ({{CAMPO3}});</li>' +
                '<li>Itens não listados neste orçamento ou em aditivos formalmente aceitos.</li>' +
                '</ul>' +
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">5. Garantia</h2>' +
                '<p style="text-align:justify;">Garantia de <strong>12 (doze) meses</strong> contra defeitos de fabricação e montagem, a contar da entrega, condicionada à instalação segundo as normas e o memorial. Não cobre ambiente agressivo, sobrecarga, umidade excessiva, poluição condutiva ou intervenção de terceiros no conjunto.</p>' +
                '<p>{{OBS}}</p>',
            contrato:
                '<h2 style="color:#0b1c35;font-family:Montserrat,sans-serif;font-size:14px;">Condições comerciais</h2>' +
                '<p>{{TABELA_COMERCIAL}}</p>' +
                '<p><strong>Total da proposta:</strong> {{TOTAL_GERAL}}</p>' +
                '<p><strong>Prazo de pagamento:</strong> {{PRAZO_DE_PAGAMENTO}} &nbsp;|&nbsp; <strong>Forma:</strong> {{FORMA_PAGAMENTO}}</p>' +
                '<p><strong>Validade:</strong> {{DATA_VALIDADE}} &nbsp;|&nbsp; <strong>Frete:</strong> {{FRETE_TIPO}} &nbsp;|&nbsp; <strong>Entrega:</strong> {{PRAZO_ENTREGA}}</p>' +
                '<p style="text-align:justify;">Preços em reais. Tributos conforme legislação na data da NF-e; industrialização pode ensejar destaque de IPI/ICMS. A aprovação desta proposta autoriza a fabricação nas condições descritas. Aditivos de escopo serão orçados à parte. Este documento não substitui a nota fiscal.</p>' +
                '<p style="margin-top:28px;">Local e data: ________________________, {{DATA_ATUAL}}</p>' +
                '<table style="width:100%;margin-top:36px;"><tr>' +
                '<td style="width:48%;text-align:center;padding-top:36px;border-top:1px solid #94a3b8;font-size:11px;">De acordo — {{CLIENTE}}<br>Nome / carimbo / data</td>' +
                '<td style="width:4%;"></td>' +
                '<td style="width:48%;text-align:center;padding-top:36px;border-top:1px solid #94a3b8;font-size:11px;">{{EMITENTE}}<br>{{ORCAMENTISTA}}</td>' +
                '</tr></table>'
        };
    }

    function toast(msg, erro) {
        var el = document.getElementById('toastProp');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('erro', !!erro);
        el.classList.add('mostrar');
        setTimeout(function () { el.classList.remove('mostrar'); }, 3200);
    }

    function esc(s) {
        return EqSec.escapeHtml(s == null ? '' : s);
    }

    function money(v) {
        return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function dataBr(iso) {
        if (!iso) return '';
        var p = String(iso).slice(0, 10).split('-');
        if (p.length !== 3) return iso;
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function editor() {
        return document.getElementById('editorProp');
    }

    function salvarAbaAtual() {
        var ed = editor();
        if (!ed) return;
        var d = document.createElement('div');
        d.innerHTML = ed.innerHTML;
        d.querySelectorAll('.img-alca').forEach(function (n) { n.remove(); });
        d.querySelectorAll('.img-sel').forEach(function (n) { n.classList.remove('img-sel'); });
        secoes[abaAtual] = d.innerHTML;
    }

    function mostrarAba(nome, semSalvar) {
        if (!semSalvar) salvarAbaAtual();
        abaAtual = nome;
        var ed = editor();
        if (ed) ed.innerHTML = secoes[nome] || '';
        document.querySelectorAll('.aba').forEach(function (b) {
            b.classList.toggle('ativa', b.getAttribute('data-aba') === nome);
        });
        prepararImagensEditor();
        aplicarCoresFolha();
    }

    function tipoSelecionado() {
        var el = document.querySelector('input[name="tipoProp"]:checked');
        return (el && el.value) || 'tecnica_comercial';
    }

    function camposPersonalizados() {
        var out = {};
        document.querySelectorAll('.campos-pers input').forEach(function (inp) {
            out[inp.getAttribute('data-campo')] = inp.value || '';
        });
        return out;
    }

    function aplicarCamposPersonalizados(obj) {
        obj = obj || {};
        document.querySelectorAll('.campos-pers input').forEach(function (inp) {
            var k = inp.getAttribute('data-campo');
            inp.value = obj[k] || '';
        });
    }

    function hexOk(v) {
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim());
    }

    function normalizarHex(v, fallback) {
        v = String(v || '').trim();
        if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
        return hexOk(v) ? v.toLowerCase() : (fallback || '#ffffff');
    }

    function lumHex(hex) {
        var h = normalizarHex(hex, '#ffffff').slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.slice(0, 2), 16) / 255;
        var g = parseInt(h.slice(2, 4), 16) / 255;
        var b = parseInt(h.slice(4, 6), 16) / 255;
        function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function textoAuto(fundo) {
        return lumHex(fundo) > 0.45 ? '#111111' : '#f8fafc';
    }

    function aparenciaAtual() {
        return {
            capa: normalizarHex(aparencia.capa, '#ffffff'),
            folha: normalizarHex(aparencia.folha, '#ffffff'),
            textoCapa: normalizarHex(aparencia.textoCapa, '#111111'),
            texto: normalizarHex(aparencia.texto, '#111111'),
            destaque: normalizarHex(aparencia.destaque, '#0b1c35')
        };
    }

    function syncPickersCores() {
        var a = aparenciaAtual();
        var mapa = {
            corCapa: a.capa,
            corCapa2: a.capa,
            corFolha: a.folha,
            corFolha2: a.folha,
            corDestaque: a.destaque,
            corDestaque2: a.destaque,
            corTexto: abaAtual === 'capa' ? a.textoCapa : a.texto,
            corTexto2: abaAtual === 'capa' ? a.textoCapa : a.texto
        };
        Object.keys(mapa).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = mapa[id];
        });
        var sel = document.getElementById('selPresetCores');
        if (sel) {
            var match = '';
            Object.keys(PRESETS_CORES).forEach(function (k) {
                var p = PRESETS_CORES[k];
                if (p.capa === a.capa && p.folha === a.folha && p.destaque === a.destaque &&
                    p.textoCapa === a.textoCapa && p.texto === a.texto) match = k;
            });
            sel.value = match;
        }
    }

    function aplicarCoresFolha() {
        var a = aparenciaAtual();
        var ehCapa = abaAtual === 'capa';
        var fundo = ehCapa ? a.capa : a.folha;
        var texto = ehCapa ? a.textoCapa : a.texto;
        var ed = editor();
        if (ed) {
            ed.style.backgroundColor = fundo;
            ed.style.color = texto;
            ed.style.setProperty('--prop-destaque', a.destaque);
            ed.style.setProperty('--prop-folha', fundo);
            ed.style.setProperty('--prop-texto', texto);
            ed.style.setProperty('--prop-titulo', ehCapa ? texto : a.destaque);
            var fundoImg = fundosPagina[abaAtual];
            if (fundoImg) {
                ed.style.backgroundImage = cssUrlFundo(fundoImg);
                ed.style.backgroundSize = 'cover';
                ed.style.backgroundPosition = 'center';
                ed.style.backgroundRepeat = 'no-repeat';
                ed.classList.add('com-fundo-img');
            } else {
                ed.style.backgroundImage = 'none';
                ed.classList.remove('com-fundo-img');
            }
        }
        var raiz = document.getElementById('telaProposta');
        if (raiz) {
            raiz.style.setProperty('--prop-capa', a.capa);
            raiz.style.setProperty('--prop-folha', a.folha);
            raiz.style.setProperty('--prop-texto', a.texto);
            raiz.style.setProperty('--prop-texto-capa', a.textoCapa);
            raiz.style.setProperty('--prop-destaque', a.destaque);
        }
        syncPickersCores();
    }

    function cssUrlFundo(src) {
        return 'url("' + String(src || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
    }

    function lerFundos(obj) {
        fundosPagina = {};
        var src = (obj && obj.secoes && obj.secoes._fundos) || (obj && obj._fundos) || {};
        Object.keys(src || {}).forEach(function (k) {
            if (ABAS.indexOf(k) >= 0 && src[k]) fundosPagina[k] = src[k];
        });
    }

    function lerAparencia(obj) {
        var base = Object.assign({}, APAR_PADRAO);
        var src = obj || {};
        if (src.secoes && src.secoes._aparencia) src = src.secoes._aparencia;
        else if (src._aparencia) src = src._aparencia;
        ['capa', 'folha', 'textoCapa', 'texto', 'destaque'].forEach(function (k) {
            if (src[k]) base[k] = normalizarHex(src[k], base[k]);
        });
        if (src.texto && !src.textoCapa) base.textoCapa = normalizarHex(src.texto, base.textoCapa);
        aparencia = base;
        aplicarCoresFolha();
    }

    function aplicarPresetCores(nome, ajustarTexto) {
        var p = PRESETS_CORES[nome];
        if (!p) return;
        aparencia = Object.assign({}, p);
        aplicarCoresFolha();
        if (ajustarTexto) toast('Paleta “' + nome + '” aplicada à capa e às páginas.');
    }

    function mudarCorCampo(campo, valor, autoTexto) {
        valor = normalizarHex(valor, aparencia[campo]);
        aparencia[campo] = valor;
        if (autoTexto && campo === 'capa') aparencia.textoCapa = textoAuto(valor);
        if (autoTexto && campo === 'folha') aparencia.texto = textoAuto(valor);
        aplicarCoresFolha();
    }

    function itensOrc() {
        return (ctx.orcamento && ctx.orcamento.itens) || [];
    }

    function tabelaPorGrupos(comPreco, sku, fab) {
        var itens = itensOrc();
        var paineis = (ctx.orcamento && ctx.orcamento.paineis) || [];
        function linhas(lista) {
            return lista.map(function (it, i) {
                var q = Number(it.qtde || 1);
                var vu = Number(it.venda_unit || 0);
                var tr = '<tr><td>' + (i + 1) + '</td>' +
                    (sku ? '<td>' + esc(it.sku || '') + '</td>' : '') +
                    '<td>' + esc(it.descricao || '') + '</td>' +
                    '<td class="num">' + q + '</td>';
                if (comPreco) tr += '<td class="num">' + money(vu) + '</td><td class="num">' + money(q * vu) + '</td>';
                else if (fab) tr += '<td>' + esc(it.marca || it.fabricante || '') + '</td>';
                return tr + '</tr>';
            }).join('');
        }
        function cab() {
            return '<th>#</th>' + (sku ? '<th>Cód.</th>' : '') + '<th>' + (comPreco ? 'Item' : 'Descrição técnica') + '</th><th>Qtde</th>' +
                (comPreco ? '<th>Unitário</th><th>Total</th>' : '') +
                (!comPreco && fab ? '<th>Fabricante</th>' : '');
        }
        function bloco(titulo, lista) {
            if (!lista.length) return '';
            return '<h3>' + esc(titulo) + '</h3><table class="tab-prop"><thead><tr>' + cab() + '</tr></thead><tbody>' + linhas(lista) + '</tbody></table>';
        }
        var html = '';
        if (orcamentoSimples()) {
            html = bloco('Itens', itens);
        } else {
            html = paineis.map(function (p) {
                return bloco(p.nome || 'Painel', itens.filter(function (it) { return it.grupo_id === p.id; }));
            }).join('');
            var soltos = itens.filter(function (it) { return !it.grupo_id || it.grupo_id === 'solto'; });
            var orfaos = itens.filter(function (it) {
                if (!it.grupo_id || it.grupo_id === 'solto') return false;
                return !paineis.some(function (p) { return p.id === it.grupo_id; });
            });
            html += bloco('Adicionais / itens soltos', soltos.concat(orfaos));
        }
        if (!html) html = bloco('Itens', itens);
        return html;
    }

    function tabelaTecnica() {
        var sku = document.getElementById('chkSku').checked;
        var fab = document.getElementById('chkFab').checked;
        return tabelaPorGrupos(false, sku, fab);
    }

    function tabelaComercial() {
        var sku = document.getElementById('chkSku').checked;
        var t = ctx.totais || {};
        return tabelaPorGrupos(true, sku, false) +
            '<p><strong>Total da proposta: ' + money(t.venda) + '</strong></p>';
    }

    function mapaCampos() {
        var o = ctx.orcamento || {};
        var t = ctx.totais || {};
        var cli = ctx.cliente || {};
        var emp = ctx.emitente || {};
        var pers = camposPersonalizados();
        var cnpjCli = cli.cnpj || o.cliente_cnpj || '';
        var hoje = new Date();
        var dataHoje = ('0' + hoje.getDate()).slice(-2) + '/' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '/' + hoje.getFullYear();
        return Object.assign({
            NUM_ORCAM: o.numero || '',
            NUM_PROPOSTA: o.numero ? String(o.numero).replace(/^ORC/, 'PROP') : '',
            DATA_PROPOSTA: dataHoje,
            STATUS: o.situacao || '',
            TOTAL_GERAL: money(t.venda),
            FRETE_TIPO: o.tipo_frete || 'CIF',
            PRAZO_DE_PAGAMENTO: o.prazo_pagamento || '',
            DATA_VALIDADE: dataBr(o.validade),
            PRAZO_ENTREGA: o.prazo_entrega_dias || o.prazo_entrega || pers.CAMPO2 || '',
            CLIENTE: o.cliente_nome || cli.razao_social || '',
            CNPJ_CLIENTE: cnpjCli,
            CNPJ_CLIENTE_FORMATADO: EqSec.cnpjMascarado(cnpjCli) || cnpjCli,
            INSCRICAO_CLIENTE: cli.inscricao_estadual || '',
            TEL_CLIENTE: cli.whatsapp || cli.telefone || '',
            EMAIL_CLIENTE: cli.email || '',
            ENDER_CLIENTE: cli.endereco || cli.logradouro || '',
            CIDADE_CLIENTE: cli.cidade || '',
            BAIRRO_CLIENTE: cli.bairro || '',
            CEP_CLIENTE: cli.cep || '',
            NUMERO_CLIENTE: cli.numero || '',
            COMPL_CLIENTE: cli.complemento || '',
            CONTATO_CLIENTE: cli.nome_contato || cli.responsavel || '',
            EMITENTE: emp.nome_fantasia || sessionStorage.getItem('masterNome') || 'EngQuadros',
            CNPJ_EMITENTE: EqSec.cnpjMascarado(emp.cnpj || sessionStorage.getItem('masterCnpj') || '') || '',
            LOGO_EMITENTE: htmlLogo(urlLogoEmpresa(), '160'),
            TEL_EMITENTE: emp.telefone || '',
            EMAIL_EMITENTE: emp.email || '',
            WPP_EMITENTE: emp.whatsapp || '',
            ORCAMENTISTA: o.vendedor || emp.nome_fantasia || '',
            TIPO_ORCAMENTO: o.modalidade === 'simples' ? 'Simples (fornecimento)' : 'Industrialização',
            PROJETO: o.projeto || '',
            FORMA_PAGAMENTO: o.forma_pagamento || '',
            OBS: o.observacoes || '',
            DATA_ATUAL: dataHoje,
            TABELA_TECNICA: tabelaTecnica(),
            TABELA_COMERCIAL: tabelaComercial()
        }, pers);
    }

    function aplicarMerge(html, campos) {
        return String(html || '').replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, function (_, k) {
            var v = campos[k];
            return v == null ? '' : String(v);
        });
    }

    function sanitizarHtml(html) {
        var d = document.createElement('div');
        d.innerHTML = html || '';
        d.querySelectorAll('script,iframe,object,link').forEach(function (n) { n.remove(); });
        d.querySelectorAll('img').forEach(function (img) {
            var src = img.getAttribute('src') || '';
            if (!/^(https?:|data:image\/|public\/)/i.test(src)) img.remove();
            img.removeAttribute('onerror');
            img.removeAttribute('onload');
        });
        return d.innerHTML;
    }

    function urlLogoEmpresa() {
        return (ctx.emitente && ctx.emitente.logo_url) || sessionStorage.getItem('masterLogo') || 'public/logo.png';
    }

    function htmlLogo(src, largura) {
        var w = String(largura || (document.getElementById('selLarguraImg') || {}).value || '180');
        var widthStyle = w.indexOf('%') >= 0 ? w : (String(w).replace(/px$/i, '') + 'px');
        return '<span class="img-box" contenteditable="false" style="display:inline-block;width:' + widthStyle + ';max-width:100%;position:relative;vertical-align:middle;">' +
            '<img class="img-prop" src="' + esc(src || urlLogoEmpresa()) + '" alt="Imagem" style="width:100%;height:auto;display:block;">' +
            '</span>';
    }

    function larguraAtual() {
        return (document.getElementById('selLarguraImg') || {}).value || '180';
    }

    function inserirHtml(html) {
        var ed = editor();
        if (!ed) return;
        ed.focus();
        document.execCommand('insertHTML', false, html);
        salvarAbaAtual();
    }

    function compactarArquivoImagem(file) {
        return new Promise(function (resolve, reject) {
            if (!file || !/^image\//.test(file.type || '')) {
                reject(new Error('Selecione uma imagem (PNG, JPG, WEBP, SVG).'));
                return;
            }
            if (file.size > 8 * 1024 * 1024) {
                reject(new Error('A imagem deve ter no máximo 8 MB.'));
                return;
            }
            var tipo = (file.type || '').toLowerCase();
            if (tipo.indexOf('svg') >= 0 || tipo.indexOf('gif') >= 0) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(new Error('Falha ao ler a imagem.')); };
                reader.readAsDataURL(file);
                return;
            }
            var img = new Image();
            var obj = URL.createObjectURL(file);
            img.onload = function () {
                var max = 1200;
                var w = img.width;
                var h = img.height;
                if (w > max) { h = Math.round(h * max / w); w = max; }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(obj);
                var manterPng = tipo.indexOf('png') >= 0 || tipo.indexOf('webp') >= 0;
                resolve(manterPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.84));
            };
            img.onerror = function () {
                URL.revokeObjectURL(obj);
                reject(new Error('Não foi possível ler a imagem.'));
            };
            img.src = obj;
        });
    }

    function dataUrlParaBlob(dataUrl) {
        var partes = String(dataUrl).split(',');
        var mime = (partes[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
        var bin = atob(partes[1] || '');
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    async function urlImagemFinal(file, dataUrl) {
        try {
            var blob = dataUrlParaBlob(dataUrl);
            var mime = (blob.type || 'image/jpeg').toLowerCase();
            var ext = mime.indexOf('png') >= 0 ? '.png'
                : mime.indexOf('svg') >= 0 ? '.svg'
                : mime.indexOf('gif') >= 0 ? '.gif'
                : mime.indexOf('webp') >= 0 ? '.webp'
                : '.jpg';
            var base = (file && file.name ? file.name : 'imagem').replace(/\.[^.]+$/, '');
            var caminho = EqSec.caminhoStorage('propostas', base + ext);
            var up = await supabaseClient.storage.from('pdfs_clientes').upload(caminho, blob, {
                contentType: blob.type || 'image/jpeg',
                upsert: true
            });
            if (up.error) throw up.error;
            var pub = supabaseClient.storage.from('pdfs_clientes').getPublicUrl(caminho);
            if (pub && pub.data && pub.data.publicUrl) return pub.data.publicUrl;
        } catch (e) { /* usa data URL */ }
        return dataUrl;
    }

    async function anexarArquivo(file) {
        try {
            toast('Anexando imagem…');
            var dataUrl = await compactarArquivoImagem(file);
            var src = await urlImagemFinal(file, dataUrl);
            inserirHtml(htmlLogo(src, larguraAtual()));
            toast('Imagem inserida na proposta.');
        } catch (err) {
            toast(err.message || 'Falha ao anexar a imagem.', true);
        }
    }

    function escolherArquivo() {
        var inp = document.getElementById('inputImgProp');
        if (inp) inp.click();
    }

    function inserirLogoEmpresa() {
        inserirHtml(htmlLogo(urlLogoEmpresa(), larguraAtual()));
        toast('Logo da empresa inserida. O campo {{LOGO_EMITENTE}} também atualiza na impressão.');
    }

    function inserirPorUrl() {
        var url = window.prompt('Cole a URL da imagem (https://…):', '');
        if (!url) return;
        url = String(url).trim();
        if (!/^https?:\/\//i.test(url)) {
            toast('A URL precisa começar com http:// ou https://', true);
            return;
        }
        inserirHtml(htmlLogo(url, larguraAtual()));
    }

    function aplicarLarguraImagem() {
        var box = caixaImgSel();
        var img = imagemSelecionada();
        if (!box && !img) {
            toast('Clique na imagem da folha e depois escolha a largura — ou arraste o quadrado no canto.', true);
            return;
        }
        var w = larguraAtual();
        if (box) {
            box.style.width = String(w).indexOf('%') >= 0 ? w : (w + 'px');
            box.style.maxWidth = '100%';
            var im = box.querySelector('img');
            if (im) { im.style.width = '100%'; im.style.height = 'auto'; }
        } else {
            if (String(w).indexOf('%') >= 0) {
                img.style.width = w;
                img.style.maxWidth = '100%';
            } else {
                img.style.width = '';
                img.style.maxWidth = w + 'px';
            }
            img.style.height = 'auto';
        }
        salvarAbaAtual();
    }

    function caixaImgSel() {
        var ed = editor();
        return ed ? ed.querySelector('.img-box.img-sel') : null;
    }

    function imagemSelecionada() {
        var box = caixaImgSel();
        if (box) return box.querySelector('img');
        var ed = editor();
        return ed ? ed.querySelector('img.img-sel') : null;
    }

    function srcImagemSel() {
        var img = imagemSelecionada();
        return img ? (img.getAttribute('src') || '') : '';
    }

    function limparSelImagens() {
        var ed = editor();
        if (!ed) return;
        ed.querySelectorAll('.img-box').forEach(function (b) {
            b.classList.remove('img-sel');
            b.querySelectorAll('.img-alca').forEach(function (a) { a.remove(); });
        });
        ed.querySelectorAll('img.img-sel').forEach(function (im) { im.classList.remove('img-sel'); });
    }

    function garantirAlcas(box) {
        if (!box || box.querySelector('.img-alca')) return;
        ['nw', 'ne', 'sw', 'se'].forEach(function (pos) {
            var a = document.createElement('span');
            a.className = 'img-alca img-alca-' + pos;
            a.setAttribute('data-alca', pos);
            box.appendChild(a);
        });
    }

    function marcarImgSel(boxOuImg) {
        limparSelImagens();
        if (!boxOuImg) return;
        var box = boxOuImg.classList && boxOuImg.classList.contains('img-box')
            ? boxOuImg
            : (boxOuImg.closest ? boxOuImg.closest('.img-box') : null);
        if (box) {
            box.classList.add('img-sel');
            garantirAlcas(box);
        } else if (boxOuImg.tagName === 'IMG') {
            boxOuImg.classList.add('img-sel');
        }
    }

    function prepararImagensEditor() {
        var ed = editor();
        if (!ed) return;
        ed.querySelectorAll('img').forEach(function (img) {
            if (img.closest('.img-box')) return;
            var box = document.createElement('span');
            box.className = 'img-box';
            box.setAttribute('contenteditable', 'false');
            var w = img.style.width || img.style.maxWidth || '';
            if (!w) w = (img.naturalWidth ? Math.min(img.naturalWidth, 360) : 180) + 'px';
            box.style.cssText = 'display:inline-block;width:' + w + ';max-width:100%;position:relative;vertical-align:middle;';
            img.style.width = '100%';
            img.style.maxWidth = 'none';
            img.style.height = 'auto';
            img.style.display = 'block';
            if (img.parentNode) {
                img.parentNode.insertBefore(box, img);
                box.appendChild(img);
            }
        });
        ed.querySelectorAll('.img-box').forEach(function (b) {
            b.setAttribute('contenteditable', 'false');
            b.querySelectorAll('.img-alca').forEach(function (a) { a.remove(); });
        });
    }

    function iniciarResizeImg(e, box, alca) {
        e.preventDefault();
        e.stopPropagation();
        var startX = e.clientX;
        var startW = box.getBoundingClientRect().width;
        var max = (editor() && editor().clientWidth) || 800;
        alca = alca || 'se';
        resizeImg = { box: box, startX: startX, startW: startW, max: max, alca: alca };
        document.addEventListener('mousemove', duranteResizeImg);
        document.addEventListener('mouseup', fimResizeImg);
    }

    function duranteResizeImg(e) {
        if (!resizeImg) return;
        var dx = e.clientX - resizeImg.startX;
        if (resizeImg.alca === 'nw' || resizeImg.alca === 'sw') dx = -dx;
        var w = Math.max(48, Math.min(resizeImg.startW + dx, resizeImg.max - 4));
        resizeImg.box.style.width = Math.round(w) + 'px';
        resizeImg.box.style.maxWidth = '100%';
    }

    function fimResizeImg() {
        document.removeEventListener('mousemove', duranteResizeImg);
        document.removeEventListener('mouseup', fimResizeImg);
        resizeImg = null;
        salvarAbaAtual();
    }

    function aplicarComoCapa() {
        var src = srcImagemSel();
        if (!src) {
            toast('Clique na imagem e depois em Aplicar como capa.', true);
            return;
        }
        fundosPagina.capa = src;
        salvarAbaAtual();
        mostrarAba('capa');
        toast('Imagem aplicada como fundo da capa. Arraste o canto se quiser redimensionar as imagens do texto.');
    }

    function aplicarFundoDestaPagina() {
        var src = srcImagemSel();
        if (!src) {
            toast('Clique na imagem e depois em Fundo desta página.', true);
            return;
        }
        fundosPagina[abaAtual] = src;
        aplicarCoresFolha();
        toast('Fundo aplicado em “' + (NOMES_ABA[abaAtual] || abaAtual) + '”. Vale na tela e na impressão.');
    }

    function limparFundoPagina() {
        delete fundosPagina[abaAtual];
        aplicarCoresFolha();
        toast('Fundo de imagem removido desta página.');
    }

    function enviarImagemPara(abaDestino) {
        if (!abaDestino || ABAS.indexOf(abaDestino) < 0) return;
        var img = imagemSelecionada();
        if (!img) {
            toast('Clique na imagem que deseja enviar.', true);
            return;
        }
        var box = img.closest ? img.closest('.img-box') : null;
        var html = box ? box.outerHTML : img.outerHTML;
        if (abaDestino === abaAtual) {
            toast('A imagem já está nesta página.');
            return;
        }
        if (box) box.remove();
        else img.remove();
        salvarAbaAtual();
        secoes[abaDestino] = (secoes[abaDestino] || '') + html;
        mostrarAba(abaDestino);
        toast('Imagem movida para “' + (NOMES_ABA[abaDestino] || abaDestino) + '”. Arraste o canto para o tamanho.');
        var sel = document.getElementById('selEnviarImg');
        if (sel) sel.value = '';
    }

    function estiloFundoAba(aba, cor) {
        var s = 'background-color:' + (cor || '#fff') + ';';
        var src = fundosPagina[aba];
        if (src) {
            s += 'background-image:' + cssUrlFundo(src) + ';background-size:cover;background-position:center;background-repeat:no-repeat;';
        }
        return s;
    }

    function wrapFundoSecao(aba, html) {
        var src = fundosPagina[aba];
        if (!src) return html;
        return '<div class="sec-fundo" style="' + estiloFundoAba(aba, 'transparent') + 'min-height:240mm;padding:14mm 16mm;page-break-before:always;">' + html + '</div>';
    }

    function montarImpressao() {
        salvarAbaAtual();
        var campos = mapaCampos();
        var tipo = tipoSelecionado();
        var inversao = document.getElementById('chkInversao').checked;
        var capa = aplicarMerge(secoes.capa, campos);
        var cab = aplicarMerge(secoes.cabecalho, campos);
        var rod = aplicarMerge(secoes.rodape, campos);
        var t1 = wrapFundoSecao('texto1', aplicarMerge(secoes.texto1, campos));
        var t2 = wrapFundoSecao('texto2', aplicarMerge(secoes.texto2, campos));
        var t3 = wrapFundoSecao('texto3', aplicarMerge(secoes.texto3, campos));
        var t4 = wrapFundoSecao('texto4', aplicarMerge(secoes.texto4, campos));
        var contrato = wrapFundoSecao('contrato', aplicarMerge(secoes.contrato, campos));

        var tecnica = '<h2 class="sec-print">Proposta técnica</h2>' + t1 + t2 + t3 + t4;
        var comercial = '<h2 class="sec-print">Proposta comercial</h2>' + contrato;
        var meio = '';
        if (tipo === 'tecnica') meio = tecnica;
        else if (tipo === 'comercial') meio = comercial;
        else meio = inversao ? (comercial + tecnica) : (tecnica + comercial);

        var a = aparenciaAtual();
        return '<div class="pagina-capa" style="' + estiloFundoAba('capa', a.capa) + 'color:' + a.textoCapa + ';">' + capa + '</div>' +
            '<div class="pagina-corpo" style="background-color:' + a.folha + ';color:' + a.texto + ';">' +
            '<div class="print-cab">' + cab + '</div>' +
            meio +
            '<div class="print-rod">' + rod + '</div></div>';
    }

    function imprimir() {
        var folha = document.getElementById('folhaPrintProp');
        var a = aparenciaAtual();
        folha.innerHTML = montarImpressao();
        folha.style.setProperty('--prop-capa', a.capa);
        folha.style.setProperty('--prop-folha', a.folha);
        folha.style.setProperty('--prop-texto', a.texto);
        folha.style.setProperty('--prop-texto-capa', a.textoCapa);
        folha.style.setProperty('--prop-destaque', a.destaque);
        folha.style.setProperty('--prop-th-texto', textoAuto(a.destaque));
        folha.style.backgroundColor = a.folha;
        folha.style.color = a.texto;
        document.body.classList.add('imprimindo-prop');
        window.print();
        document.body.classList.remove('imprimindo-prop');
    }

    function cmd(comando) {
        document.execCommand(comando, false, null);
        editor().focus();
    }

    function aplicarFonte() {
        var nome = document.getElementById('selFonte').value;
        document.execCommand('fontName', false, nome);
        editor().focus();
    }

    function aplicarTamanho() {
        var px = document.getElementById('selTamanho').value;
        document.execCommand('fontSize', false, '7');
        editor().querySelectorAll('font[size="7"]').forEach(function (f) {
            var span = document.createElement('span');
            span.style.fontSize = px + 'px';
            span.innerHTML = f.innerHTML;
            f.parentNode.replaceChild(span, f);
        });
        editor().focus();
    }

    function inserirCampo(nome) {
        editor().focus();
        document.execCommand('insertText', false, '{{' + nome + '}}');
    }

    function payloadModelo() {
        salvarAbaAtual();
        ABAS.forEach(function (k) { secoes[k] = sanitizarHtml(secoes[k]); });
        secoes._aparencia = aparenciaAtual();
        secoes._fundos = fundosPagina;
        return {
            empresa_id: empresaId,
            nome: (document.getElementById('nomeModelo').value || 'Modelo').trim(),
            tipo: tipoSelecionado(),
            mostrar_sku: document.getElementById('chkSku').checked,
            mostrar_fabricante: document.getElementById('chkFab').checked,
            inversao: document.getElementById('chkInversao').checked,
            secoes: secoes,
            campos_personalizados: camposPersonalizados(),
            atualizado_em: new Date().toISOString()
        };
    }

    function aplicarPayload(p) {
        if (!p) return;
        secoes = Object.assign(modeloPadrao(), p.secoes || {});
        document.getElementById('nomeModelo').value = p.nome || '';
        document.getElementById('chkSku').checked = p.mostrar_sku !== false;
        document.getElementById('chkFab').checked = !!p.mostrar_fabricante;
        document.getElementById('chkInversao').checked = !!p.inversao;
        var radio = document.querySelector('input[name="tipoProp"][value="' + (p.tipo || 'tecnica_comercial') + '"]');
        if (radio) radio.checked = true;
        aplicarCamposPersonalizados(p.campos_personalizados);
        lerFundos(p);
        lerAparencia(p);
        mostrarAba('capa', true);
    }

    function modelosLocal() {
        try { return JSON.parse(localStorage.getItem(KEY_MODELOS_LOCAL) || '[]'); } catch (e) { return []; }
    }

    function gravarModelosLocal(lista) {
        localStorage.setItem(KEY_MODELOS_LOCAL, JSON.stringify(lista));
    }

    async function salvarModelo() {
        var body = payloadModelo();
        try {
            if (modeloId) {
                var upd = await supabaseClient.from('propostas_modelos').update(body).eq('id', modeloId).eq('empresa_id', empresaId).select('id').maybeSingle();
                if (upd.error) throw upd.error;
            } else {
                var ins = await supabaseClient.from('propostas_modelos').insert([body]).select('id').single();
                if (ins.error) throw ins.error;
                modeloId = ins.data.id;
            }
            toast('Modelo salvo no banco.');
            await carregarListaModelos();
        } catch (err) {
            var lista = modelosLocal().filter(function (m) { return m.id !== (modeloId || body.nome); });
            var localId = modeloId || ('loc-' + Date.now());
            modeloId = localId;
            lista.unshift(Object.assign({ id: localId }, body));
            gravarModelosLocal(lista);
            preencherSelectModelos(lista);
            toast('Modelo guardado neste navegador. Rode docs/5_PROPOSTAS.sql para gravar no banco.');
        }
    }

    function preencherSelectModelos(lista) {
        var sel = document.getElementById('selModelos');
        var atual = modeloId || '';
        sel.innerHTML = '<option value="">Novo modelo…</option>';
        (lista || []).forEach(function (m) {
            var opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nome || 'Modelo';
            if (String(m.id) === String(atual)) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    async function carregarListaModelos() {
        var lista = [];
        try {
            var res = await supabaseClient.from('propostas_modelos')
                .select('id, nome, tipo, secoes, mostrar_sku, mostrar_fabricante, inversao, campos_personalizados')
                .eq('empresa_id', empresaId)
                .order('atualizado_em', { ascending: false })
                .limit(40);
            if (res.error) throw res.error;
            lista = res.data || [];
        } catch (e) {
            lista = modelosLocal();
        }
        preencherSelectModelos(lista);
        return lista;
    }

    async function abrirModelo(id) {
        if (!id) {
            novoModelo();
            return;
        }
        try {
            var res = await supabaseClient.from('propostas_modelos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle();
            if (res.data) {
                modeloId = res.data.id;
                aplicarPayload(res.data);
                toast('Modelo carregado.');
                return;
            }
        } catch (e) { /* local */ }
        var local = modelosLocal().filter(function (m) { return String(m.id) === String(id); })[0];
        if (local) {
            modeloId = local.id;
            aplicarPayload(local);
            toast('Modelo local carregado.');
        }
    }

    function aplicarModeloEngquadros(silencioso) {
        secoes = modeloPadrao();
        fundosPagina = {};
        if (orcamentoSimples()) {
            aparencia = Object.assign({}, PRESETS_CORES.branco);
            document.getElementById('nomeModelo').value = 'EngQuadros — proposta comercial (simples)';
            var radioC = document.querySelector('input[name="tipoProp"][value="comercial"]');
            if (radioC) radioC.checked = true;
        } else {
            aparencia = Object.assign({}, PRESETS_CORES.azul);
            document.getElementById('nomeModelo').value = 'EngQuadros — proposta técnica e comercial';
            var radioT = document.querySelector('input[name="tipoProp"][value="tecnica_comercial"]');
            if (radioT) radioT.checked = true;
        }
        aplicarCoresFolha();
        mostrarAba('capa', true);
        if (!silencioso) toast('Modelo profissional EngQuadros aplicado. Ajuste os textos e imprima.');
    }

    function novoModelo() {
        modeloId = null;
        aplicarModeloEngquadros(true);
        document.getElementById('selModelos').value = '';
        aplicarCamposPersonalizados({});
        toast('Novo modelo EngQuadros iniciado.');
    }

    async function carregarContexto() {
        try {
            var raw = sessionStorage.getItem(KEY_CTX);
            if (raw) ctx = Object.assign(ctx, JSON.parse(raw));
        } catch (e) { /* ignore */ }

        var o = ctx.orcamento;
        var chip = document.getElementById('chipOrcProp');
        if (o && o.numero) {
            chip.textContent = 'Orçamento ' + o.numero + (o.cliente_nome ? ' · ' + o.cliente_nome : '');
        }

        try {
            var t = (typeof EqSec !== 'undefined' && EqSec.carregarIdentidadeTenant)
                ? await EqSec.carregarIdentidadeTenant(supabaseClient, empresaId)
                : null;
            ctx.emitente = (t && t.master) ? t.master : {};
            if (t && t.logo) ctx.emitente.logo_url = t.logo;
            if (t && t.nome) ctx.emitente.nome_fantasia = t.nome;
            if (t && t.logo) {
                var img = document.getElementById('logoSidebarProp');
                if (img) img.src = t.logo;
            } else {
                var imgVazio = document.getElementById('logoSidebarProp');
                if (imgVazio) imgVazio.removeAttribute('src');
            }
            if (t && t.nome) {
                var badge = document.getElementById('badgeEmpresaProp');
                if (badge) badge.textContent = t.nome;
            }
        } catch (e) { ctx.emitente = {}; }

        if (o && o.cliente_cnpj) {
            try {
                var dig = EqSec.cnpjDigitos(o.cliente_cnpj);
                var resCli = await supabaseClient.from('clientes').select('*').eq('empresa_id', empresaId).limit(80);
                var lista = resCli.data || [];
                ctx.cliente = lista.filter(function (c) {
                    return EqSec.cnpjDigitos(c.cnpj) === dig || EqSec.cnpjDigitos(c.cpf_cnpj) === dig;
                })[0] || {};
            } catch (e2) { ctx.cliente = {}; }
        }
    }

    function montarListaCampos() {
        var box = document.getElementById('listaCampos');
        box.innerHTML = CAMPOS.map(function (c) {
            return '<button type="button" class="campo-item" data-campo="' + c + '">{{' + c + '}}</button>';
        }).join('');
        box.querySelectorAll('.campo-item').forEach(function (b) {
            b.addEventListener('click', function () { inserirCampo(b.getAttribute('data-campo')); });
        });
    }

    function ligarUi() {
        document.querySelectorAll('.aba').forEach(function (b) {
            b.addEventListener('click', function () { mostrarAba(b.getAttribute('data-aba')); });
        });
        document.querySelectorAll('.btn-fmt[data-cmd]').forEach(function (b) {
            b.addEventListener('click', function () { cmd(b.getAttribute('data-cmd')); });
        });
        document.getElementById('selFonte').addEventListener('change', aplicarFonte);
        document.getElementById('selTamanho').addEventListener('change', aplicarTamanho);
        document.getElementById('btnSalvarModelo').addEventListener('click', salvarModelo);
        document.getElementById('btnNovoModelo').addEventListener('click', novoModelo);
        var btnModEq = document.getElementById('btnModeloEngq');
        if (btnModEq) btnModEq.addEventListener('click', function () { aplicarModeloEngquadros(false); });
        document.getElementById('btnImprimirProp').addEventListener('click', imprimir);
        document.addEventListener('keydown', function (e) {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (String(e.key).toLowerCase() === 's') {
                e.preventDefault();
                salvarModelo();
            }
            if (String(e.key).toLowerCase() === 'p') {
                e.preventDefault();
                imprimir();
            }
        });
        document.getElementById('selModelos').addEventListener('change', function () {
            abrirModelo(this.value);
        });
        var inpImg = document.getElementById('inputImgProp');
        if (inpImg) {
            inpImg.addEventListener('change', function () {
                var f = inpImg.files && inpImg.files[0];
                inpImg.value = '';
                if (f) anexarArquivo(f);
            });
        }
        function ligarBtn(id, fn) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        }
        ligarBtn('btnImgArquivo', escolherArquivo);
        ligarBtn('btnImgArquivo2', escolherArquivo);
        ligarBtn('btnImgLogo', inserirLogoEmpresa);
        ligarBtn('btnImgLogo2', inserirLogoEmpresa);
        ligarBtn('btnImgUrl', inserirPorUrl);
        ligarBtn('btnImgCapa', aplicarComoCapa);
        ligarBtn('btnImgFundoAba', aplicarFundoDestaPagina);
        ligarBtn('btnImgLimparFundo', limparFundoPagina);
        var selEnviar = document.getElementById('selEnviarImg');
        if (selEnviar) {
            selEnviar.addEventListener('change', function () {
                if (selEnviar.value) enviarImagemPara(selEnviar.value);
            });
        }
        var selLarg = document.getElementById('selLarguraImg');
        if (selLarg) selLarg.addEventListener('change', aplicarLarguraImagem);
        function ligarCor(id, campo, autoTexto) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', function () { mudarCorCampo(campo, el.value, !!autoTexto); });
        }
        ligarCor('corCapa', 'capa', true);
        ligarCor('corCapa2', 'capa', true);
        ligarCor('corFolha', 'folha', true);
        ligarCor('corFolha2', 'folha', true);
        ligarCor('corDestaque', 'destaque', false);
        ligarCor('corDestaque2', 'destaque', false);
        function ligarTexto(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', function () {
                mudarCorCampo(abaAtual === 'capa' ? 'textoCapa' : 'texto', el.value, false);
            });
        }
        ligarTexto('corTexto');
        ligarTexto('corTexto2');
        var selPreset = document.getElementById('selPresetCores');
        if (selPreset) {
            selPreset.addEventListener('change', function () { aplicarPresetCores(selPreset.value, true); });
        }
        var sw = document.getElementById('swatchesCores');
        if (sw) {
            sw.innerHTML = [
                ['branco', '#ffffff', 'Branco'],
                ['creme', '#fbf7ee', 'Creme'],
                ['cinza', '#f1f5f9', 'Cinza'],
                ['azul', '#0b1c35', 'Azul'],
                ['verde', '#ecfdf5', 'Verde']
            ].map(function (s) {
                return '<button type="button" class="swatch" data-preset="' + s[0] + '" title="' + s[2] + '" style="background:' + s[1] + '"></button>';
            }).join('');
            sw.querySelectorAll('.swatch').forEach(function (b) {
                b.addEventListener('click', function () {
                    var nome = b.getAttribute('data-preset');
                    var sel = document.getElementById('selPresetCores');
                    if (sel) sel.value = nome;
                    aplicarPresetCores(nome, true);
                });
            });
        }
        var ed = editor();
        if (ed) {
            ed.addEventListener('click', function (e) {
                var box = e.target && e.target.closest ? e.target.closest('.img-box') : null;
                var img = e.target && e.target.closest ? e.target.closest('img') : null;
                if (box) marcarImgSel(box);
                else if (img) marcarImgSel(img);
                else limparSelImagens();
            });
            ed.addEventListener('mousedown', function (e) {
                var alca = e.target && e.target.closest ? e.target.closest('.img-alca') : null;
                if (alca) {
                    var box = alca.closest('.img-box');
                    if (box) iniciarResizeImg(e, box, alca.getAttribute('data-alca') || 'se');
                    return;
                }
                var box = e.target && e.target.closest ? e.target.closest('.img-box') : null;
                if (!box || !box.classList.contains('img-sel')) return;
                var r = box.getBoundingClientRect();
                var nearSE = (r.right - e.clientX) < 18 && (r.bottom - e.clientY) < 18;
                if (nearSE) iniciarResizeImg(e, box, 'se');
            });
            ed.addEventListener('keydown', function (e) {
                if ((e.key === 'Delete' || e.key === 'Backspace') && caixaImgSel()) {
                    e.preventDefault();
                    caixaImgSel().remove();
                    salvarAbaAtual();
                }
            });
            ed.addEventListener('dragover', function (e) {
                e.preventDefault();
                ed.classList.add('arrastando');
            });
            ed.addEventListener('dragleave', function () { ed.classList.remove('arrastando'); });
            ed.addEventListener('drop', function (e) {
                e.preventDefault();
                ed.classList.remove('arrastando');
                var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) anexarArquivo(f);
            });
            ed.addEventListener('paste', function (e) {
                var itens = e.clipboardData && e.clipboardData.items;
                if (!itens) return;
                for (var i = 0; i < itens.length; i++) {
                    if (itens[i].type && itens[i].type.indexOf('image') === 0) {
                        e.preventDefault();
                        anexarArquivo(itens[i].getAsFile());
                        return;
                    }
                }
            });
        }
        window.toggleMenuMobileProp = function () {
            var m = document.getElementById('menuLateralProp');
            if (m) m.classList.toggle('aberto');
        };
        montarListaCampos();
    }

    async function init() {
        if (!EqSec.exigirPermissao('propostas')) return;
        empresaId = sessionStorage.getItem('empresaId');
        supabaseClient = EqSec.criarClienteSupabase();
        if (typeof EqSessionTimeout !== 'undefined') {
            EqSessionTimeout.iniciar(30 * 60 * 1000, function () {
                sessionStorage.clear();
                window.location.href = EqSec.urlPainelErp();
            });
        }
        ligarUi();
        document.querySelectorAll('[data-perm]').forEach(function (el) {
            if (!EqSec.temPermissao(el.getAttribute('data-perm'))) el.style.display = 'none';
        });
        aplicarCoresFolha();
        await carregarContexto();
        aplicarModeloEngquadros(true);
        await carregarListaModelos();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
