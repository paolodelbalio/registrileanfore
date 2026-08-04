// ============================================================
// Modello condiviso per il dosaggio del Cloro (Ipoclorito di Calcio)
// ============================================================
// NUOVA VERSIONE (agosto 2026): il modello non usa più coefficienti fissi
// stimati una volta e poi congelati. Si RICALIBRA da solo ogni volta che il
// Registro Chimico + Registro Consumi vengono caricati, con una regressione
// diretta:
//
//    Cl.Lib(domani mattina) = f( Cl.Lib(oggi mattina), dose usata oggi,
//                                 temperatura media, ospiti, CYA, reintegro )
//
// cioè esattamente il principio richiesto: "parto da x alle 7, uso una
// certa dose, arrivo a y alle 7 del giorno dopo" — solo che invece di un
// singolo giorno usa la regressione su TUTTE le osservazioni reali dal
// 15/06/2026 (inizio periodo ipoclorito di calcio) ad oggi, pesando anche
// CYA (che agisce da conservante: più CYA c'è, meno cloro si consuma),
// ospiti, reintegro e temperatura.
//
// SICUREZZA: il target di dosaggio di default NON è più il centro fascia
// (1,05 mg/l) ma un valore più basso (vedi TARGET_CLORO_SICURO), apposta
// per lasciare margine rispetto al massimo di legge (1,5 mg/l Cl. libero)
// anche se il modello sovrastima leggermente in qualche giornata atipica.
// ============================================================
(function () {
    const DATA_INIZIO_CALIBRAZIONE = "2026-06-15"; // inizio periodo ipoclorito di calcio
    const MINIMO_LEGALE = 0.7;
    const MASSIMO_LEGALE = 1.5;
    const TARGET_CLORO_SICURO = 0.90; // sopra il minimo (0,7) con margine, ben sotto il massimo (1,5)
    const OSPITI_MEDIO_STAGIONE = 2.9;
    const CYA_STANDARD = 50;

    // Fallback: usato SOLO se non ci sono ancora abbastanza osservazioni reali per
    // calibrare (es. a inizio stagione, o pochi giorni dopo il 15/06). Formula precedente,
    // mai validata su questo periodo — va presa con più cautela del modello ricalibrato.
    const COEF_FALLBACK = {
        dose: 0.005873, temp: -0.056180, ospiti: -0.047088, cya: 0.027418, reintegro: 0.000043,
        intercetta: -0.580335
    };

    let coefAttuali = null; // { x, dose, temp, ospiti, cya, reintegro, intercetta }
    let infoCalibrazione = { attiva: false, n: 0, r2: null, dataInizio: DATA_INIZIO_CALIBRAZIONE };

    // ------------------------------------------------------------
    // Costruisce il dataset di calibrazione e rifà la regressione.
    // osservazioni: array di oggetti già pronti, uno per ogni giorno utile:
    //   { chiaveGiorno, clOggi, doseOggi, tempMedia, ospiti, cya, reintegro, clDomani }
    // (Il chiamante — consumi.js — si occupa di incrociare Registro Chimico,
    // Registro Consumi e Registro Contatori e produrre questo array filtrato
    // già dal 15/06/2026 in poi.)
    // ------------------------------------------------------------
    function ricalibra(osservazioni) {
        let valide = (osservazioni || []).filter(o =>
            o.chiaveGiorno >= DATA_INIZIO_CALIBRAZIONE &&
            [o.clOggi, o.doseOggi, o.tempMedia, o.clDomani].every(v => v != null && !isNaN(v)) &&
            o.doseOggi > 0 // solo giorni in cui è stato effettivamente dosato ipoclorito
        );

        let righe = valide.map(o => [
            o.clOggi,
            o.doseOggi,
            o.tempMedia,
            o.ospiti != null ? o.ospiti : OSPITI_MEDIO_STAGIONE,
            o.cya != null ? o.cya : CYA_STANDARD,
            o.reintegro != null ? o.reintegro : 0
        ]);
        let target = valide.map(o => o.clDomani);

        let esito = window.Calibrazione ? window.Calibrazione.regressioneLineareMultipla(righe, target) : null;

        if (esito) {
            let [x, dose, temp, ospiti, cya, reintegro, intercetta] = esito.coef;

            // CONTROLLO DI SICUREZZA: più dose di ipoclorito deve sempre significare più cloro
            // atteso domani, mai meno. Se con pochi dati rumorosi la regressione stimasse un
            // coefficiente negativo o nullo (fisicamente impossibile), la calibrazione viene
            // scartata e si torna alla formula di riserva, invece di rischiare di consigliare
            // dosi che vanno nella direzione sbagliata.
            if (dose <= 0) {
                coefAttuali = null;
                infoCalibrazione = { attiva: false, n: esito.n, r2: esito.r2, dataInizio: DATA_INIZIO_CALIBRAZIONE, scartata: true };
                return infoCalibrazione;
            }

            coefAttuali = { x, dose, temp, ospiti, cya, reintegro, intercetta };
            infoCalibrazione = { attiva: true, n: esito.n, r2: esito.r2, dataInizio: DATA_INIZIO_CALIBRAZIONE };
        } else {
            coefAttuali = null; // si torna al fallback
            infoCalibrazione = { attiva: false, n: valide.length, r2: null, dataInizio: DATA_INIZIO_CALIBRAZIONE };
        }
        return infoCalibrazione;
    }

    // Predice il Cl.Lib atteso domani mattina, dato che oggi si aggiungono "dose" grammi.
    function predici(clOggi, dose, tempMedia, ospiti, cya, reintegro) {
        let c = coefAttuali;
        let ospitiUsati = ospiti != null ? ospiti : OSPITI_MEDIO_STAGIONE;
        let cyaUsato = cya != null ? cya : CYA_STANDARD;
        let reintegroUsato = reintegro != null ? reintegro : 0;

        if (c) {
            return c.x * clOggi + c.dose * dose + c.temp * tempMedia + c.ospiti * ospitiUsati
                + c.cya * cyaUsato + c.reintegro * reintegroUsato + c.intercetta;
        }
        // Fallback: formula precedente (predice il DELTA rispetto a oggi, non il valore assoluto).
        let contributiNoti = COEF_FALLBACK.temp * tempMedia + COEF_FALLBACK.ospiti * ospitiUsati
            + COEF_FALLBACK.cya * cyaUsato + COEF_FALLBACK.reintegro * reintegroUsato + COEF_FALLBACK.intercetta;
        return clOggi + COEF_FALLBACK.dose * dose + contributiNoti;
    }

    window.ModelloCloro = {
        TARGET_CLORO_SICURO: TARGET_CLORO_SICURO,
        MINIMO_LEGALE: MINIMO_LEGALE,
        MASSIMO_LEGALE: MASSIMO_LEGALE,
        OSPITI_MEDIO_STAGIONE: OSPITI_MEDIO_STAGIONE,
        DATA_INIZIO_CALIBRAZIONE: DATA_INIZIO_CALIBRAZIONE,

        ricalibra: ricalibra,
        infoCalibrazione: function () { return infoCalibrazione; },
        // Espone il coefficiente "grammi -> mg/l" attualmente in uso (calibrato o fallback),
        // usato dalla formula dello shock clorativo in consumi.js per restare coerente con lo
        // stesso modello di efficacia del mantenimento ordinario.
        coefficienteDoseAttuale: function () { return coefAttuali ? coefAttuali.dose : COEF_FALLBACK.dose; },

        // input = { clMattina, tempMedia, ospiti, cya, reintegro }
        // (tempMedia = media tra la lettura delle 7 di oggi e quella delle 21 di ieri, come prima)
        // Restituisce { grammi, target, predettoSenzaDose, avvisoSuperaMassimo, calibrato }
        calcolaDoseCloro: function (input) {
            if (!input) return null;
            let { clMattina, tempMedia, ospiti, cya, reintegro } = input;
            if (clMattina == null || isNaN(clMattina) || tempMedia == null || isNaN(tempMedia)) return null;

            // Quanto Cl.Lib è previsto SENZA aggiungere altro prodotto (dose=0): serve per capire
            // se il target è già raggiungibile o se un giorno "difficile" (tanti ospiti, poco CYA)
            // farebbe scendere il cloro comunque, a prescindere dal dosaggio di oggi.
            let predettoSenzaDose = predici(clMattina, 0, tempMedia, ospiti, cya, reintegro);

            // Risolve per "dose" tale che predici(...) = TARGET_CLORO_SICURO.
            // predici è lineare in dose, quindi: dose = (target - predettoSenzaDose) / coefficiente_dose
            let coefDose = coefAttuali ? coefAttuali.dose : COEF_FALLBACK.dose;
            let grammi = Math.max(0, Math.round((TARGET_CLORO_SICURO - predettoSenzaDose) / coefDose));

            // Controllo di sicurezza: verifica cosa predice il modello CON questa dose. Se anche
            // così il risultato previsto superasse il massimo di legge (non dovrebbe succedere,
            // dato che il target è sotto il massimo, ma un modello con pochi dati può avere errore
            // residuo), l'avviso lo segnala esplicitamente invece di dare un falso senso di sicurezza.
            let predettoConDose = predici(clMattina, grammi, tempMedia, ospiti, cya, reintegro);

            return {
                grammi: grammi,
                target: TARGET_CLORO_SICURO,
                predettoSenzaDose: Math.round(predettoSenzaDose * 100) / 100,
                predettoConDose: Math.round(predettoConDose * 100) / 100,
                avvisoSuperaMassimo: predettoConDose > MASSIMO_LEGALE,
                calibrato: !!coefAttuali,
                n: infoCalibrazione.n,
                r2: infoCalibrazione.r2
            };
        }
    };
})();