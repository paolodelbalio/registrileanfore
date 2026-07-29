// ============================================================
// Modello condiviso per il dosaggio del Cloro (Ipoclorito di Calcio)
// ============================================================
// Fino ad ora chimico.js (popup diagnostico, per singola riga) usava un
// modello semplificato a 4 variabili (dose, temp, ospiti, CYA — R²=0,68),
// mentre consumi.js (Suggerimento dose di oggi) usava un modello a 7
// variabili, che aggiunge il calo di cloro della notte precedente (libero
// e combinato) e il reintegro d'acqua (R²=0,78). Sullo stesso identico
// giorno potevano dare numeri diversi (es. 267g vs 290g il 29/7/2026).
//
// Da qui in poi entrambe le finestre usano SEMPRE il modello a 7
// variabili (quello più informato), tramite questa funzione condivisa.
// Il modello a 4 variabili resta disponibile in chimico.js solo come
// fallback per i casi in cui non è disponibile la lettura delle 21 del
// giorno prima o il reintegro (es. non è una lettura delle 7 del mattino).
//
// Target: 1,05 mg/l (centro fascia 0,9-1,2).
// ============================================================
(function () {
    const TARGET_CLORO = 1.05;
    const OSPITI_MEDIO_STAGIONE = 2.9; // media storica, usata quando gli ospiti del giorno non sono ancora noti

    const COEF = {
        dose: 0.005873, temp: -0.056180, ospiti: -0.047088, cya: 0.027418,
        notteLibero: -0.304696, notteCombinato: 2.139506, reintegro: 0.000043,
        intercetta: -0.580335
    };

    window.ModelloCloro = {
        TARGET_CLORO: TARGET_CLORO,
        OSPITI_MEDIO_STAGIONE: OSPITI_MEDIO_STAGIONE,

        // input = { clMattina, clSeraIeri, comMattina, comSeraIeri, tempMattina,
        //           tempSeraIeri, cya, ospiti, reintegro }
        // cya/ospiti/reintegro possono essere null (vengono stimati con fallback
        // prudenti — ospiti con la media stagionale, non zero: un giorno senza
        // ospiti registrati non è un giorno senza bagnanti, è solo un dato mancante).
        // Gli altri campi sono obbligatori — se mancano, restituisce null.
        calcolaDoseCloro: function (input) {
            if (!input) return null;
            let { clMattina, clSeraIeri, comMattina, comSeraIeri, tempMattina, tempSeraIeri, cya, ospiti, reintegro } = input;

            if ([clMattina, clSeraIeri, comMattina, comSeraIeri, tempMattina, tempSeraIeri].some(v => v == null || isNaN(v))) {
                return null;
            }

            let tempMedia = (tempMattina + tempSeraIeri) / 2;
            let deltaNotteLibero = clMattina - clSeraIeri;
            let deltaNotteCombinato = comMattina - comSeraIeri;
            let cyaUsato = (cya != null && !isNaN(cya)) ? cya : 50;
            let ospitiUsati = (ospiti != null && !isNaN(ospiti)) ? ospiti : OSPITI_MEDIO_STAGIONE;
            let reintegroUsato = (reintegro != null && !isNaN(reintegro)) ? reintegro : 0;

            let deltaTarget = TARGET_CLORO - clMattina;
            let contributiNoti = COEF.temp * tempMedia + COEF.ospiti * ospitiUsati + COEF.cya * cyaUsato
                + COEF.notteLibero * deltaNotteLibero + COEF.notteCombinato * deltaNotteCombinato
                + COEF.reintegro * reintegroUsato + COEF.intercetta;

            return Math.max(0, Math.round((deltaTarget - contributiNoti) / COEF.dose));
        }
    };
})();