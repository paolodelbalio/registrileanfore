// ============================================================
// Modello condiviso per il dosaggio del Cloro (Ipoclorito di Calcio)
// ============================================================
// VERSIONE CORRETTA (04/08/2026): il modello confronta la dose delle 7 con
// la lettura delle 21 DELLO STESSO GIORNO (poche ore dopo), non più con la
// lettura delle 7 del giorno successivo (quasi 24 ore dopo). Il confronto a
// 24 ore includeva un'intera notte di consumo (alghe, richiesta di cloro
// organica, ecc.) che non ha nulla a che fare con l'efficacia di quella
// dose, e sui dati reali produceva stime di 3-4 volte superiori al
// necessario. Con il confronto mattina->sera il modello spiega molto più
// della variazione osservata (R² quasi raddoppiato sui dati reali) ed è
// anche più corretto operativamente: conta che il cloro sia in regola
// durante l'apertura, non esattamente alle 7 del giorno dopo.
//
//    Cl.Lib(sera stesso giorno) = f( Cl.Lib(mattina), dose usata,
//                                     temperatura del mattino, ospiti, CYA, reintegro )
//
// Si ricalibra da solo ogni volta che il Registro Chimico + Registro
// Consumi vengono caricati, usando tutte le osservazioni reali dal
// 15/06/2026 (inizio periodo ipoclorito di calcio) ad oggi.
//
// SICUREZZA: il target di dosaggio resta un valore sotto il centro fascia
// (vedi TARGET_CLORO_SICURO), apposta per lasciare margine rispetto al
// massimo di legge (1,5 mg/l Cl. libero) anche se il modello sovrastima
// leggermente in qualche giornata atipica.
// ============================================================
(function () {
    const DATA_INIZIO_CALIBRAZIONE = "2026-06-15"; // inizio periodo ipoclorito di calcio
    const MINIMO_LEGALE = 0.7;
    const MASSIMO_LEGALE = 1.5;
    const TARGET_CLORO_SICURO = 0.90; // sopra il minimo (0,7) con margine, ben sotto il massimo (1,5)
    const OSPITI_MEDIO_STAGIONE_FALLBACK = 2.9; // usato solo se non ci sono abbastanza dati recenti (es. inizio stagione)
    const CYA_STANDARD = 50;

    // Media ospiti "recente", aggiornata da aggiornaMediaOspiti() con una media ponderata delle
    // ultime 3 settimane (settimana più recente pesata 3x, quella di mezzo 2x, la più vecchia 1x)
    // invece di una media fissa su tutta la stagione — più reattiva a cambi di affluenza (es. alta
    // stagione vs bassa stagione, giorni feriali vs weekend che si susseguono).
    let ospitiMedioRecente = OSPITI_MEDIO_STAGIONE_FALLBACK;
    let infoMediaOspiti = { attiva: false, n: 0 };

    // Fallback: usato SOLO se non ci sono ancora abbastanza osservazioni reali per
    // calibrare (es. a inizio stagione, o pochi giorni dopo il 15/06).
    const COEF_FALLBACK = {
        dose: 0.003558, temp: -0.053152, ospiti: -0.032187, cya: 0.006303, reintegro: -0.000057,
        intercetta: 1.788241
    };

    let coefAttuali = null; // { x, dose, temp, ospiti, cya, reintegro, intercetta }
    let infoCalibrazione = { attiva: false, n: 0, r2: null, dataInizio: DATA_INIZIO_CALIBRAZIONE };

    // ------------------------------------------------------------
    // Ricalcola la media ospiti ponderata sulle ultime 3 settimane.
    // osservazioni: [{chiaveGiorno: "AAAA-MM-GG", ospiti: Number}, ...] — tipicamente da
    // mappaOspitiPerGiorno in consumi.js. Va richiamata insieme a ricalibra().
    // ------------------------------------------------------------
    function aggiornaMediaOspiti(osservazioni) {
        let valide = (osservazioni || []).filter(o => o.chiaveGiorno && o.ospiti != null && !isNaN(o.ospiti));
        if (valide.length === 0) {
            ospitiMedioRecente = OSPITI_MEDIO_STAGIONE_FALLBACK;
            infoMediaOspiti = { attiva: false, n: 0 };
            return infoMediaOspiti;
        }

        valide.sort((a, b) => a.chiaveGiorno < b.chiaveGiorno ? 1 : -1); // più recente prima
        let dataRiferimento = new Date(valide[0].chiaveGiorno);

        let sommaPesata = 0, sommaPesi = 0, n = 0;
        valide.forEach(o => {
            let giorniFa = Math.round((dataRiferimento - new Date(o.chiaveGiorno)) / 86400000);
            if (giorniFa < 0 || giorniFa > 20) return; // solo le ultime 3 settimane (0-20 giorni fa)
            let peso = giorniFa < 7 ? 3 : (giorniFa < 14 ? 2 : 1); // settimana più recente pesata di più
            sommaPesata += o.ospiti * peso;
            sommaPesi += peso;
            n++;
        });

        if (sommaPesi > 0) {
            ospitiMedioRecente = sommaPesata / sommaPesi;
            infoMediaOspiti = { attiva: true, n: n, valore: Math.round(ospitiMedioRecente * 10) / 10 };
        } else {
            ospitiMedioRecente = OSPITI_MEDIO_STAGIONE_FALLBACK;
            infoMediaOspiti = { attiva: false, n: 0 };
        }
        return infoMediaOspiti;
    }

    // ------------------------------------------------------------
    // Costruisce il dataset di calibrazione e rifà la regressione.
    // osservazioni: array di oggetti già pronti, uno per ogni giorno utile:
    //   { chiaveGiorno, clMattina, doseOggi, tempMattina, ospiti, cya, reintegro, clSera }
    // clSera è la lettura delle 21 DELLO STESSO GIORNO (non del giorno dopo).
    // (Il chiamante — consumi.js — si occupa di incrociare Registro Chimico,
    // Registro Consumi e Registro Contatori e produrre questo array filtrato
    // già dal 15/06/2026 in poi.)
    // ------------------------------------------------------------
    function ricalibra(osservazioni) {
        let valide = (osservazioni || []).filter(o =>
            o.chiaveGiorno >= DATA_INIZIO_CALIBRAZIONE &&
            [o.clMattina, o.doseOggi, o.tempMattina, o.clSera].every(v => v != null && !isNaN(v)) &&
            o.doseOggi > 0 // solo giorni in cui è stato effettivamente dosato ipoclorito
        );

        let righe = valide.map(o => [
            o.clMattina,
            o.doseOggi,
            o.tempMattina,
            o.ospiti != null ? o.ospiti : ospitiMedioRecente,
            o.cya != null ? o.cya : CYA_STANDARD,
            o.reintegro != null ? o.reintegro : 0
        ]);
        let target = valide.map(o => o.clSera);

        let esito = window.Calibrazione ? window.Calibrazione.regressioneLineareMultipla(righe, target) : null;

        if (esito) {
            let [x, dose, temp, ospiti, cya, reintegro, intercetta] = esito.coef;

            // CONTROLLO DI SICUREZZA: più dose di ipoclorito deve sempre significare più cloro
            // atteso in giornata, mai meno. Se con pochi dati rumorosi la regressione stimasse un
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

    // Predice il Cl.Lib atteso in giornata (sera, poche ore dopo), dato che si aggiungono
    // "dose" grammi subito dopo la lettura di partenza (clPartenza) di temperatura "temp".
    function predici(clPartenza, dose, temp, ospiti, cya, reintegro) {
        let c = coefAttuali;
        let ospitiUsati = ospiti != null ? ospiti : ospitiMedioRecente;
        let cyaUsato = cya != null ? cya : CYA_STANDARD;
        let reintegroUsato = reintegro != null ? reintegro : 0;

        if (c) {
            return c.x * clPartenza + c.dose * dose + c.temp * temp + c.ospiti * ospitiUsati
                + c.cya * cyaUsato + c.reintegro * reintegroUsato + c.intercetta;
        }
        let cf = COEF_FALLBACK;
        return clPartenza * 0.0569 + cf.dose * dose + cf.temp * temp + cf.ospiti * ospitiUsati
            + cf.cya * cyaUsato + cf.reintegro * reintegroUsato + cf.intercetta;
    }

    window.ModelloCloro = {
        TARGET_CLORO_SICURO: TARGET_CLORO_SICURO,
        MINIMO_LEGALE: MINIMO_LEGALE,
        MASSIMO_LEGALE: MASSIMO_LEGALE,
        DATA_INIZIO_CALIBRAZIONE: DATA_INIZIO_CALIBRAZIONE,
        // Media ospiti attualmente in uso (ponderata sulle ultime 3 settimane se ci sono dati
        // sufficienti, altrimenti la media stagionale fissa come riserva).
        OSPITI_MEDIO_STAGIONE: function () { return ospitiMedioRecente; },

        ricalibra: ricalibra,
        aggiornaMediaOspiti: aggiornaMediaOspiti,
        infoMediaOspiti: function () { return infoMediaOspiti; },
        infoCalibrazione: function () { return infoCalibrazione; },
        // Espone il coefficiente "grammi -> mg/l" attualmente in uso (calibrato o fallback),
        // usato dalla formula dello shock clorativo in consumi.js per restare coerente con lo
        // stesso modello di efficacia del mantenimento ordinario.
        coefficienteDoseAttuale: function () { return coefAttuali ? coefAttuali.dose : COEF_FALLBACK.dose; },

        // Prevede il Cl.Lib atteso in giornata (sera) data una dose GIÀ DECISA (es. quella
        // realmente registrata nel Registro Consumi di oggi) — a differenza di calcolaDoseCloro,
        // che calcola invece quanta dose serve per raggiungere il target. Utile per il pulsante
        // "Atteso stasera": non consiglia nulla, prevede solo cosa succederà.
        // input = { clMattina, tempMedia, doseUsata, ospiti, cya, reintegro }
        simulaEsito: function (input) {
            if (!input) return null;
            let { clMattina, tempMedia, doseUsata, ospiti, cya, reintegro } = input;
            if (clMattina == null || isNaN(clMattina) || tempMedia == null || isNaN(tempMedia)) return null;
            let dose = (doseUsata != null && !isNaN(doseUsata)) ? doseUsata : 0;
            let predetto = predici(clMattina, dose, tempMedia, ospiti, cya, reintegro);
            return {
                predetto: Math.round(predetto * 100) / 100,
                doseUsata: dose,
                avvisoSuperaMassimo: predetto > MASSIMO_LEGALE,
                avvisoSottoMinimo: predetto < MINIMO_LEGALE,
                calibrato: !!coefAttuali,
                n: infoCalibrazione.n,
                r2: infoCalibrazione.r2
            };
        },

        // input = { clMattina, tempMedia, ospiti, cya, reintegro }
        // clMattina: lettura di partenza (di norma quella delle 7). tempMedia: temperatura di
        // quella stessa lettura (non una media con letture future, che non sono ancora note).
        // Restituisce { grammi, target, predettoSenzaDose, avvisoSuperaMassimo, calibrato }
        calcolaDoseCloro: function (input) {
            if (!input) return null;
            let { clMattina, tempMedia, ospiti, cya, reintegro } = input;
            if (clMattina == null || isNaN(clMattina) || tempMedia == null || isNaN(tempMedia)) return null;

            // CONTROLLO DI SICUREZZA, PRIMA di consultare il modello: se il Cloro è già al livello
            // di sicurezza o oltre, la risposta è sempre "zero grammi" — punto, senza bisogno di
            // regressioni. Questo controllo non dipende dal modello statistico apposta: un valore
            // di partenza molto fuori dal range su cui il modello si è allenato (es. un Cloro Alto
            // anomalo) può fargli fare previsioni inaffidabili se lo si lascia calcolare comunque.
            if (clMattina >= TARGET_CLORO_SICURO) {
                return {
                    grammi: 0,
                    target: TARGET_CLORO_SICURO,
                    predettoSenzaDose: clMattina,
                    predettoConDose: clMattina,
                    avvisoSuperaMassimo: clMattina > MASSIMO_LEGALE,
                    giaSopraTarget: true,
                    calibrato: !!coefAttuali,
                    n: infoCalibrazione.n,
                    r2: infoCalibrazione.r2
                };
            }

            // Quanto Cl.Lib è previsto in giornata SENZA aggiungere altro prodotto (dose=0): serve
            // per capire se il target è già raggiungibile o se un giorno "difficile" (tanti ospiti,
            // poco CYA) farebbe scendere il cloro comunque, a prescindere dal dosaggio di oggi.
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
                giaSopraTarget: false,
                calibrato: !!coefAttuali,
                n: infoCalibrazione.n,
                r2: infoCalibrazione.r2
            };
        }
    };
})();