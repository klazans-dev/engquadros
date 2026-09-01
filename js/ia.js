/**
 * Assistente de IA isolado: só atualiza #boxAssistenteIa se existir.
 * Sem polling global — não redesenha o ERP.
 */
(function (global) {
    function init() {
        var box = document.getElementById('boxAssistenteIa');
        if (!box || box.dataset.eqIaReady) return;
        box.dataset.eqIaReady = '1';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.EqIa = { init: init };
})(window);
