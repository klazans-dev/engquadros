/**
 * Simulador IBS/CBS: atualiza apenas o container #simuladorIbsCbs.
 */
(function (global) {
    function formatarBrl(n) {
        return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function calcular(base, cbs, ibs, reducao) {
        var b = parseFloat(String(base).replace(',', '.')) || 0;
        var red = (parseFloat(String(reducao).replace(',', '.')) || 0) / 100;
        var baseLiq = b * (1 - red);
        var vCbs = baseLiq * ((parseFloat(String(cbs).replace(',', '.')) || 0) / 100);
        var vIbs = baseLiq * ((parseFloat(String(ibs).replace(',', '.')) || 0) / 100);
        return { baseLiq: baseLiq, cbs: vCbs, ibs: vIbs, total: vCbs + vIbs };
    }

    function renderResultado(box, r) {
        var out = box.querySelector('[data-sim-resultado]');
        if (!out) return;
        out.textContent = 'CBS ' + formatarBrl(r.cbs) + ' + IBS ' + formatarBrl(r.ibs) + ' = ' + formatarBrl(r.total);
    }

    function montar(root) {
        if (!root || root.dataset.eqSimReady) return;
        root.dataset.eqSimReady = '1';
        root.innerHTML =
            '<p class="eq-sim-titulo">Simulador IBS / CBS</p>' +
            '<div class="eq-sim-grid">' +
            '<label>Base R$<input type="text" data-sim="base" value="10000"></label>' +
            '<label>CBS %<input type="text" data-sim="cbs" value="8.80"></label>' +
            '<label>IBS %<input type="text" data-sim="ibs" value="17.70"></label>' +
            '<label>Redução %<input type="text" data-sim="red" value="0"></label>' +
            '</div>' +
            '<p data-sim-resultado class="eq-sim-out"></p>';

        function atualizar() {
            var r = calcular(
                root.querySelector('[data-sim="base"]').value,
                root.querySelector('[data-sim="cbs"]').value,
                root.querySelector('[data-sim="ibs"]').value,
                root.querySelector('[data-sim="red"]').value
            );
            renderResultado(root, r);
        }

        root.addEventListener('input', atualizar);
        atualizar();
    }

    function init() {
        document.querySelectorAll('#simuladorIbsCbs, [data-eq-simulador]').forEach(montar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.EqSimulador = { montar: montar, calcular: calcular, init: init };
})(window);
