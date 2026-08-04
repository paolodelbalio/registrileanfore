// ============================================================
// Motore di calibrazione statistica condiviso
// ============================================================
// Regressione lineare multipla (minimi quadrati ordinari, risolta con
// le equazioni normali X^T X * coef = X^T y tramite eliminazione di
// Gauss con pivot parziale). Nessuna libreria esterna: poche variabili,
// pochi punti (decine, non migliaia), non serve altro.
//
// Usato da modello-cloro.js e modello-ph.js per ricalibrare i coefficienti
// sui dati REALI del Registro Chimico/Consumi ogni volta che vengono
// caricati, invece di tenere coefficienti fissi che invecchiano.
// ============================================================
(function () {

    function risolviSistema(A, b) {
        let n = A.length;
        let M = A.map((riga, i) => [...riga, b[i]]);

        for (let col = 0; col < n; col++) {
            let pivot = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
            }
            [M[col], M[pivot]] = [M[pivot], M[col]];

            if (Math.abs(M[col][col]) < 1e-9) return null; // sistema singolare: variabili collineari o dati insufficienti

            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                let fattore = M[r][col] / M[col][col];
                for (let c = col; c <= n; c++) M[r][c] -= fattore * M[col][c];
            }
        }
        return M.map((riga, i) => riga[n] / riga[i]);
    }

    // righe: array di array di predittori (SENZA intercetta, es. [dose, temp, ospiti, cya]).
    // target: array di numeri, stessa lunghezza di righe.
    // margineGradiLiberta: quanti punti in più delle variabili servono per fidarsi del fit
    // (default 3: con 5 variabili + intercetta = 6 coefficienti, servono almeno 9 punti).
    function regressioneLineareMultipla(righe, target, margineGradiLiberta) {
        margineGradiLiberta = margineGradiLiberta != null ? margineGradiLiberta : 3;
        let n = righe.length;
        if (n === 0 || n !== target.length) return null;

        let k = righe[0].length + 1; // + intercetta
        if (n < k + margineGradiLiberta) return null;

        let X = righe.map(r => [...r, 1]);

        let XtX = Array.from({ length: k }, () => new Array(k).fill(0));
        let Xty = new Array(k).fill(0);
        for (let i = 0; i < n; i++) {
            for (let a = 0; a < k; a++) {
                Xty[a] += X[i][a] * target[i];
                for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
            }
        }

        let coef = risolviSistema(XtX, Xty);
        if (!coef) return null;

        let media = target.reduce((s, v) => s + v, 0) / n;
        let ssTot = target.reduce((s, v) => s + (v - media) ** 2, 0);
        let ssRes = 0;
        for (let i = 0; i < n; i++) {
            let pred = X[i].reduce((s, v, j) => s + v * coef[j], 0);
            ssRes += (target[i] - pred) ** 2;
        }
        let r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;

        return { coef, r2, n, k };
    }

    // Media semplice di un array di numeri (ignora null/NaN), utile per i pannelli
    // informativi ("media CYA dal 15/06", ecc.) richiesti insieme alla calibrazione.
    function media(valori) {
        let validi = valori.filter(v => v != null && !isNaN(v));
        if (validi.length === 0) return null;
        return validi.reduce((s, v) => s + v, 0) / validi.length;
    }

    window.Calibrazione = { regressioneLineareMultipla, media };
})();