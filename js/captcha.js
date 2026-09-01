/**
 * CAPTCHA visual (canvas) + honeypot + bloqueio temporário após tentativas.
 * Uso: EngCaptcha.init('login'); EngCaptcha.validar('login');
 */
(function (global) {
    const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const instancias = {};
    const MAX_FALHAS = 5;
    const BLOQUEIO_MS = 2 * 60 * 1000;

    function chaveFalhas(escopo) { return 'eq_captcha_falhas_' + escopo; }
    function chaveBloqueio(escopo) { return 'eq_captcha_lock_' + escopo; }

    function gerarCodigo(tamanho) {
        let codigo = '';
        const cryptoObj = global.crypto || global.msCrypto;
        for (let i = 0; i < tamanho; i++) {
            let idx;
            if (cryptoObj && cryptoObj.getRandomValues) {
                const buf = new Uint32Array(1);
                cryptoObj.getRandomValues(buf);
                idx = buf[0] % ALFABETO.length;
            } else {
                idx = Math.floor(Math.random() * ALFABETO.length);
            }
            codigo += ALFABETO[idx];
        }
        return codigo;
    }

    function desenhar(canvas, codigo) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = 'rgba(43, 92, 146,' + (0.25 + Math.random() * 0.35) + ')';
            ctx.lineWidth = 1 + Math.random() * 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.random() * w, Math.random() * h);
            ctx.lineTo(Math.random() * w, Math.random() * h);
            ctx.stroke();
        }

        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.08 + Math.random() * 0.2) + ')';
            ctx.beginPath();
            ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        const passo = w / (codigo.length + 1);
        for (let i = 0; i < codigo.length; i++) {
            const x = passo * (i + 1);
            const y = h / 2 + (Math.random() * 10 - 5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((Math.random() * 0.5) - 0.25);
            ctx.font = 'bold ' + (26 + Math.floor(Math.random() * 6)) + 'px Montserrat, Arial, sans-serif';
            ctx.fillStyle = Math.random() > 0.5 ? '#e2e8f0' : '#93c5fd';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(codigo[i], 0, 0);
            ctx.restore();
        }
    }

    function bloqueadoAte(escopo) {
        const ate = Number(sessionStorage.getItem(chaveBloqueio(escopo)) || 0);
        return ate > Date.now() ? ate : 0;
    }

    function registrarFalhaCaptcha(escopo) {
        const n = Number(sessionStorage.getItem(chaveFalhas(escopo)) || 0) + 1;
        sessionStorage.setItem(chaveFalhas(escopo), String(n));
        if (n >= MAX_FALHAS) {
            sessionStorage.setItem(chaveBloqueio(escopo), String(Date.now() + BLOQUEIO_MS));
            sessionStorage.setItem(chaveFalhas(escopo), '0');
        }
    }

    function zerarFalhas(escopo) {
        sessionStorage.removeItem(chaveFalhas(escopo));
        sessionStorage.removeItem(chaveBloqueio(escopo));
    }

    function mensagemBloqueio(escopo) {
        const ate = bloqueadoAte(escopo);
        if (!ate) return '';
        const seg = Math.ceil((ate - Date.now()) / 1000);
        return 'Muitas tentativas. Aguarde ' + seg + 's e tente novamente.';
    }

    function init(id, opcoes) {
        const opts = opcoes || {};
        const canvas = document.getElementById('captchaCanvas-' + id);
        const input = document.getElementById('captchaInput-' + id);
        const btn = document.getElementById('captchaRefresh-' + id);
        if (!canvas || !input) return;

        const inst = {
            id: id,
            canvas: canvas,
            input: input,
            tamanho: opts.tamanho || 5,
            codigo: ''
        };
        instancias[id] = inst;

        function regenerar() {
            inst.codigo = gerarCodigo(inst.tamanho);
            desenhar(canvas, inst.codigo);
            input.value = '';
        }

        inst.regenerar = regenerar;
        regenerar();

        if (btn) btn.addEventListener('click', regenerar);
        canvas.addEventListener('click', regenerar);
        canvas.setAttribute('title', 'Clique para gerar um novo código');
        canvas.style.cursor = 'pointer';
    }

    function validar(id, honeypotSelector) {
        const inst = instancias[id];
        const escopo = (id.split('-')[0]) || id;
        const lockMsg = mensagemBloqueio(escopo);
        if (lockMsg) {
            return { ok: false, motivo: 'bloqueio', mensagem: lockMsg };
        }

        if (honeypotSelector) {
            const honey = document.querySelector(honeypotSelector);
            if (honey && honey.value) {
                return { ok: false, motivo: 'bot', mensagem: 'Validação de segurança falhou.' };
            }
        }

        if (!inst) {
            return { ok: false, motivo: 'captcha', mensagem: 'Complete o código de verificação.' };
        }

        const digitado = (inst.input.value || '').replace(/\s/g, '').toUpperCase();
        if (!digitado || digitado !== inst.codigo) {
            registrarFalhaCaptcha(escopo);
            inst.regenerar();
            const lockApos = mensagemBloqueio(escopo);
            return {
                ok: false,
                motivo: 'captcha',
                mensagem: lockApos || 'Código de verificação incorreto. Tente novamente.'
            };
        }

        return { ok: true };
    }

    function regenerar(id) {
        if (instancias[id]) instancias[id].regenerar();
    }

    global.EngCaptcha = {
        init: init,
        validar: validar,
        regenerar: regenerar,
        zerarFalhas: zerarFalhas,
        registrarFalhaLogin: registrarFalhaCaptcha,
        mensagemBloqueio: mensagemBloqueio
    };
})(window);
