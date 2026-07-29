// ============================================================
// Modello condiviso per il dosaggio di pH- (Riduttore Acido)
// ============================================================
// Fino ad ora chimico.js (popup diagnostico) e consumi.js (Suggerimento
// dose di oggi) usavano DUE formule diverse con DUE target diversi (7,30 e
// 7,15), che sullo stesso identico giorno potevano dare numeri anche 3
// volte diversi. Questo file unifica tutto in un unico punto.
//
// Target unico: 7,30 (limite alto della fascia verde 7,0-7,3).
//
// Formula di base (teorica): grammi = (pH - 7,30) * VOL_PISCINA_M3 * Alka_ppm
// Cioè: 1 g di prodotto per m³ di volume per ogni ppm di pH da abbassare,
// scalato linearmente sull'alcalinità (più TA = più effetto tampone = più
// prodotto serve per lo stesso spostamento di pH).
//
// Range calibrato sui dati reali (dose pH- realmente immessa vs pH
// osservato la sera stessa, periodo ipoclorito di calcio dal 15/6/2026,
// confronto fatto il 29/7/2026, forbice stretta il 29/7/2026 su richiesta):
//
//  - Con Alka >= 70 ppm: 16 osservazioni reali. Rapporto dose_reale/teorico
//    mediana 1,24x -> range = teorico * [0,7 - 1,3]
//
//  - Con Alka < 70 ppm: SOLO 2 osservazioni reali finora (25 e 27/7/2026),
//    entrambe con dose_reale/teorico = 0,25x -> range = teorico * [0,25 - 0,5],
//    minimo ancorato alle 2 osservazioni reali, massimo tenuto più vicino
//    per non essere inutilmente ampio, con avviso esplicito di dati
//    limitati (troppo pochi punti per essere sicuri che la scalatura
//    lineare sull'Alka valga anche qui sotto)
//
// Da aggiornare quando si accumuleranno più letture reali di TA basso:
// vedi SOGLIA_ALKA_VALIDATA e le due fasce in FASCE_PER_ALKA.
// ============================================================
(function () {
    const VOL_PISCINA_M3 = 92;
    const TARGET_PH = 7.30;
    const SOGLIA_ALKA_VALIDATA = 70;

    const FASCE_PER_ALKA = {
        validata: { min: 0.7, max: 1.3 },   // Alka >= soglia, 16 osservazioni reali
        limitata: { min: 0.25, max: 0.5 }   // Alka < soglia, solo 2 osservazioni reali
    };

    window.ModelloPH = {
        TARGET_PH: TARGET_PH,
        SOGLIA_ALKA_VALIDATA: SOGLIA_ALKA_VALIDATA,

        // Calcola il range di dose consigliata di pH- (Riduttore Acido).
        // pH: valore misurato (es. 7.37). alkaPpm: ultima Alka nota (può essere null).
        // Restituisce null se il pH è già al target o sotto (nessuna dose serve).
        calcolaRangeDosePH: function (pH, alkaPpm) {
            if (pH == null || isNaN(pH) || pH <= TARGET_PH) return null;

            let alkaNota = (alkaPpm != null && !isNaN(alkaPpm));
            let alka = alkaNota ? alkaPpm : 100; // fallback standard se Alka non ancora misurata

            let teorico = (pH - TARGET_PH) * VOL_PISCINA_M3 * alka;
            let datiLimitati = alka < SOGLIA_ALKA_VALIDATA;
            let fascia = datiLimitati ? FASCE_PER_ALKA.limitata : FASCE_PER_ALKA.validata;

            return {
                teorico: Math.round(teorico),
                min: Math.round(teorico * fascia.min),
                max: Math.round(teorico * fascia.max),
                alka: alka,
                alkaNota: alkaNota,
                datiLimitati: datiLimitati
            };
        }
    };
})();