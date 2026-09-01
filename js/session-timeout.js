/**
 * Timeout de inatividade: limpa sessão sem redesenhar o painel a cada tick.
 */
(function (global) {
    var timer = null;

    function iniciar(ms, aoExpirar) {
        var duracao = ms || 30 * 60 * 1000;
        function reset() {
            clearTimeout(timer);
            timer = setTimeout(function () {
                if (typeof aoExpirar === 'function') aoExpirar();
            }, duracao);
        }
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
            document.addEventListener(ev, reset, { passive: true });
        });
        reset();
        return reset;
    }

    function parar() {
        clearTimeout(timer);
        timer = null;
    }

    global.EqSessionTimeout = { iniciar: iniciar, parar: parar };
})(window);
