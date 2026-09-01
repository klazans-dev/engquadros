/**
 * Timers isolados: só o nó alvo (slides / cronômetro) muda de classe ou texto.
 * Não recarrega admin.html nem o painel.
 */
(function (global) {
    var handles = [];

    function rotacionarSlides(seletor, intervaloMs) {
        var itens = document.querySelectorAll(seletor);
        if (!itens.length) return null;
        var idx = 0;
        itens[0].classList.add('active');
        var id = setInterval(function () {
            itens[idx].classList.remove('active');
            idx = (idx + 1) % itens.length;
            itens[idx].classList.add('active');
        }, intervaloMs || 7000);
        handles.push(id);
        return id;
    }

    function cronometroNoNo(el, segundos, aoFim) {
        if (!el) return null;
        var rest = segundos;
        el.textContent = rest + 's';
        var id = setInterval(function () {
            rest -= 1;
            el.textContent = rest + 's';
            if (rest <= 0) {
                clearInterval(id);
                if (typeof aoFim === 'function') aoFim();
            }
        }, 1000);
        handles.push(id);
        return id;
    }

    function iniciarSite() {
        rotacionarSlides('.slide-biblico', 7000);
        rotacionarSlides('.review-slide', 5000);
    }

    function pararTodos() {
        handles.forEach(function (id) { clearInterval(id); });
        handles = [];
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarSite);
    } else {
        iniciarSite();
    }

    global.EqTimers = {
        rotacionarSlides: rotacionarSlides,
        cronometroNoNo: cronometroNoNo,
        pararTodos: pararTodos
    };
})(window);
