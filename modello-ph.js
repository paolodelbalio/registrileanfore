// ============================================================
// Modello condiviso per il dosaggio di pH- (Riduttore Acido)
// ============================================================
// NUOVA VERSIONE (agosto 2026): stesso principio del modello Cloro
// (vedi modello-cloro.js). Regressione diretta sui dati reali dal
// 15/06/2026:
//
//    pH(sera) = f( pH(mattina), grammi di pH- usati, Alkalinità )
//
// L'efficacia per grammo rispetto all'alcalinità (richiesta esplicitamente)
// è quindi calcolata dalla regressione stessa: il coefficiente sull'Alka
// dice quanto l'alcalinità "frena" l'effetto del prodotto (effetto tampone),
// invece delle due fasce fisse usate finora (Alka >=70 / <70 ppm).
//
// Target: 7,30 (già il limite alto della fascia interna 7,0-7,3, con
// margine di sicurezza rispetto al massimo di legge 7,5).
// ============================================================
(function () {
    const DATA_INIZIO_CALIBRAZIONE = "2026-06-15";
    const MINIMO_LEGALE = 6.5;
    const MASSIMO_LEGALE = 7.5;
    const TARGET_PH = 7.30;
    const ALKA_STANDARD = 100;

    // Fallback: formula teorica + fasce empiriche precedenti, usato solo se non ci sono
    // ancora abbastanza osservazioni reali per la regressione.
    const VOL_PISCINA_M3 = 92;
    const SOGLIA_ALKA_VALIDATA = 70;
    const FASCE_PER_ALKA_FALLBACK = {
        validata: { min: 0.7, max: 1.3 },
        limitata: { min: 0.25, max: 0.5 }
    };

    let coefAttuali = null; // { x (pH mattina), dose, alka, intercetta }
    let infoCalibrazione = { attiva: false, n: 0, r2: null, dataInizio: DATA_INIZIO_CALIBRAZIONE };

    // osservazioni: [{ chiaveGiorno, phMattina, doseOggi, alka, phSera }]
    function ricalibra(osservazioni) {
        let valide = (osservazioni || []).filter(o =>
            o.chiaveGiorno >= DATA_INIZIO_CALIBRAZIONE &&
            [o.phMattina, o.doseOggi, o.phSera].every(v => v != null && !isNaN(v)) &&
            o.doseOggi > 0
        );

        let righe = valide.map(o => [o.phMattina, o.doseOggi, o.alka != null ? o.alka : ALKA_STANDARD]);
        let target = valide.map(o => o.phSera);

        // Con poche variabili (3 + intercetta = 4 coefficienti) il margine di gradi di libertà
        // di default (3) richiede almeno 7 osservazioni: coerente con l'ordine di grandezza di
        // dati reali già raccolto finora (~18 osservazioni totali a fine luglio).
        let esito = window.Calibrazione ? window.Calibrazione.regressioneLineareMultipla(righe, target) : null;

        if (esito) {
            let [x, dose, alka, intercetta] = esito.coef;

            // CONTROLLO DI SICUREZZA: più pH- deve sempre abbassare il pH atteso, mai alzarlo.
            // Se la regressione stimasse un coefficiente positivo o nullo (fisicamente
            // impossibile), la calibrazione viene scartata e si torna alla formula di riserva.
            if (dose >= 0) {
                coefAttuali = null;
                infoCalibrazione = { attiva: false, n: esito.n, r2: esito.r2, dataInizio: DATA_INIZIO_CALIBRAZIONE, scartata: true };
                return infoCalibrazione;
            }

            coefAttuali = { x, dose, alka, intercetta };
            infoCalibrazione = { attiva: true, n: esito.n, r2: esito.r2, dataInizio: DATA_INIZIO_CALIBRAZIONE };
        } else {
            coefAttuali = null;
            infoCalibrazione = { attiva: false, n: valide.length, r2: null, dataInizio: DATA_INIZIO_CALIBRAZIONE };
        }
        return infoCalibrazione;
    }

    function predici(phMattina, dose, alka) {
        let alkaUsata = alka != null ? alka : ALKA_STANDARD;
        if (coefAttuali) {
            let c = coefAttuali;
            return c.x * phMattina + c.dose * dose + c.alka * alkaUsata + c.intercetta;
        }
        // Fallback: formula teorica g = (pH-target)*VOL*Alka, invertita e scalata con le
        // fasce empiriche precedenti (usa il centro fascia come stima puntuale).
        return null; // il fallback per il pH- resta a livello di "range", vedi calcolaRangeDosePH
    }

    window.ModelloPH = {
        TARGET_PH: TARGET_PH,
        MINIMO_LEGALE: MINIMO_LEGALE,
        MASSIMO_LEGALE: MASSIMO_LEGALE,
        SOGLIA_ALKA_VALIDATA: SOGLIA_ALKA_VALIDATA,
        DATA_INIZIO_CALIBRAZIONE: DATA_INIZIO_CALIBRAZIONE,

        ricalibra: ricalibra,
        infoCalibrazione: function () { return infoCalibrazione; },

        // Calcola il range di dose consigliata di pH- (Riduttore Acido).
        // pH: valore misurato (es. 7.37). alkaPpm: ultima Alka nota (può essere null).
        // Restituisce null se il pH è già al target o sotto (nessuna dose serve).
        calcolaRangeDosePH: function (pH, alkaPpm) {
            if (pH == null || isNaN(pH) || pH <= TARGET_PH) return null;

            let alkaNota = (alkaPpm != null && !isNaN(alkaPpm));
            let alka = alkaNota ? alkaPpm : ALKA_STANDARD;

            if (coefAttuali) {
                // Risolve per "dose" tale che predici(pH, dose, alka) = TARGET_PH.
                let c = coefAttuali;
                let doseCentrale = (TARGET_PH - (c.x * pH + c.alka * alka + c.intercetta)) / c.dose;
                doseCentrale = Math.max(0, doseCentrale);

                // Margine ±15% intorno alla stima puntuale del modello: la regressione dà già
                // un valore calibrato sui dati reali (non più una stima teorica da scalare con
                // fasce arbitrarie), quindi il range serve solo a coprire il rumore normale tra
                // un'osservazione e l'altra, non più a compensare un modello non validato.
                return {
                    teorico: Math.round(doseCentrale),
                    min: Math.round(doseCentrale * 0.85),
                    max: Math.round(doseCentrale * 1.15),
                    alka: alka,
                    alkaNota: alkaNota,
                    datiLimitati: false,
                    calibrato: true,
                    n: infoCalibrazione.n,
                    r2: infoCalibrazione.r2
                };
            }

            // Fallback: formula teorica + fasce fisse (comportamento precedente), usato solo
            // finché non ci sono abbastanza osservazioni reali per la regressione.
            let teorico = (pH - TARGET_PH) * VOL_PISCINA_M3 * alka;
            let datiLimitati = alka < SOGLIA_ALKA_VALIDATA;
            let fascia = datiLimitati ? FASCE_PER_ALKA_FALLBACK.limitata : FASCE_PER_ALKA_FALLBACK.validata;

            return {
                teorico: Math.round(teorico),
                min: Math.round(teorico * fascia.min),
                max: Math.round(teorico * fascia.max),
                alka: alka,
                alkaNota: alkaNota,
                datiLimitati: datiLimitati,
                calibrato: false,
                n: infoCalibrazione.n,
                r2: infoCalibrazione.r2
            };
        }
    };
})();