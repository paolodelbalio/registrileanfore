// ============================================================
// Modello condiviso per il dosaggio di pH- (Riduttore Acido)
// ============================================================
// Formula di base (teorica): grammi = (pH - 7,30) * VOL_PISCINA_M3 * Alka_ppm
// Cioè: 1 g di prodotto per m³ di volume per ogni ppm di pH da abbassare,
// scalato linearmente sull'alcalinità (più TA = più effetto tampone = più
// prodotto serve per lo stesso spostamento di pH).
//
// Range aggiornato il 05/08/2026, ricalcolato su tutti i 35 giorni reali
// disponibili dal 15/6/2026 (prima erano solo 16+2 osservazioni). Rapporto
// dose_reale/teorico, escludendo i giorni dove la correzione necessaria era
// quasi nulla (che gonfiano il rapporto senza motivo):
//
//  - Con Alka >= 70 ppm: 16 osservazioni pulite. Mediana del rapporto 1,11x
//    (prima era stimata 1,24x con meno dati) -> range = teorico * [0,85 - 1,35]
//
//  - Con Alka < 70 ppm: solo 4 osservazioni reali finora, mediana 0,27x ->
//    range = teorico * [0,25 - 0,40], con avviso esplicito di dati limitati
//    (ancora pochi punti per essere sicuri che la scalatura lineare
//    sull'Alka valga anche qui sotto)
//
// NOTA (05/08/2026): un tentativo di ricalibrazione automatica con
// regressione (come fatto con successo per il Cloro, vedi modello-cloro.js)
// è stato provato anche qui, incluso un test con la dose di Cloro dello
// stesso giorno come variabile (l'ipoclorito di calcio è basico e contrasta
// l'effetto del pH-: l'ipotesi era giusta, l'R² è salito parecchio), ma con
// soli 35 punti e 5+ variabili insieme i coefficienti risultavano instabili
// e a tratti con segno fisicamente impossibile. Si resta quindi sulla
// formula teorica + fasce empiriche, più semplice e più sicura da usare
// finché non si accumulano più dati reali (soprattutto con Alka<70).
// Da rivalutare più avanti in stagione con più osservazioni.
// ============================================================
(function () {
    const VOL_PISCINA_M3 = 92;
    const TARGET_PH = 7.30;
    const MINIMO_LEGALE = 6.5;
    const MASSIMO_LEGALE = 7.5;
    const SOGLIA_ALKA_VALIDATA = 70;
    const ALKA_STANDARD = 100; // usato solo se non è mai stata registrata nessuna Alka prima di quella data

    const FASCE_PER_ALKA = {
        validata: { min: 0.85, max: 1.35, mediana: 1.11 }, // Alka >= soglia, 16 osservazioni reali pulite (05/08/2026)
        limitata: { min: 0.25, max: 0.40, mediana: 0.27 }  // Alka < soglia, solo 4 osservazioni reali (05/08/2026)
    };

    // ------------------------------------------------------------
    // Dose di mantenimento (aggiunta 07/08/2026)
    // ------------------------------------------------------------
    // Una dose piccola, singola (non un range), da usare quando il pH è già a
    // target o sotto, per contrastare la deriva naturale verso l'alto che
    // avviene comunque durante la giornata (fotosintesi, aerazione,
    // degassamento di CO2). Derivata da:
    //
    //  - 15 giorni reali SENZA alcuna dose di pH-: il pH sale in media di
    //    +0,056 tra mattina e sera (mediana +0,06), e sale (invece di
    //    scendere) nel 67% dei giorni — non è un'eccezione, è la norma.
    //  - 9 giorni reali con una dose piccola (50-150g, media 99g) e pH già
    //    vicino al target: il delta medio scende a -0,017 (sostanzialmente
    //    stabile) — cioè una dose sui 75-100g è bastata storicamente a
    //    compensare la deriva.
    //
    // Rapporto dose_reale/teorico su questi 9 giorni (Alka nell'intervallo
    // 52-73 ppm): mediana ~0,30 — RAPPORTO_MANTENIMENTO qui sotto.
    //
    // Attenzione: solo 9 osservazioni, tutte con Alka sotto 75 — quindi il
    // numero è un punto di partenza ragionevole, non una certezza. Da
    // affinare settimanalmente insieme a Paolo, che terrà traccia delle
    // dosi al grammo: se si osserva una deriva verso l'alto nonostante la
    // dose di mantenimento, alzare RAPPORTO_MANTENIMENTO; se il pH scende
    // troppo, abbassarlo.
    const DERIVA_NATURALE_MEDIA = 0.056; // pH guadagnato in media in una giornata, senza alcuna dose di pH-
    const RAPPORTO_MANTENIMENTO = 0.30;  // vedi nota sopra — da affinare settimanalmente con i dati reali

    window.ModelloPH = {
        TARGET_PH: TARGET_PH,
        MINIMO_LEGALE: MINIMO_LEGALE,
        MASSIMO_LEGALE: MASSIMO_LEGALE,
        SOGLIA_ALKA_VALIDATA: SOGLIA_ALKA_VALIDATA,

        // Non c'è ricalibrazione automatica per il pH- (vedi nota sopra): questa funzione
        // esiste solo perché consumi.js la richiama comunque ogni volta che i registri si
        // aggiornano — non fa nulla, la formula resta sempre quella fissa qui sotto.
        ricalibra: function () { return { attiva: false, motivo: "regressione non usata per il pH-, vedi commento in modello-ph.js" }; },
        infoCalibrazione: function () { return { attiva: false }; },

        // Dose di mantenimento: un singolo numero in grammi (non un range), pensato per essere
        // regolato al grammo settimana per settimana. Da chiamare quando calcolaRangeDosePH ha
        // già restituito null (pH già a target o sotto).
        calcolaDoseMantenimento: function (alkaPpm) {
            let alkaNota = (alkaPpm != null && !isNaN(alkaPpm));
            let alka = alkaNota ? alkaPpm : ALKA_STANDARD;
            let teorico = DERIVA_NATURALE_MEDIA * VOL_PISCINA_M3 * alka;
            return {
                grammi: Math.round(teorico * RAPPORTO_MANTENIMENTO),
                alka: alka,
                alkaNota: alkaNota,
                rapportoUsato: RAPPORTO_MANTENIMENTO,
                n: 9
            };
        },

        // Prevede il pH atteso in giornata (sera) data una dose GIÀ DECISA (es. quella realmente
        // registrata nel Registro Consumi di oggi) — a differenza di calcolaRangeDosePH/
        // calcolaDoseMantenimento, che consigliano una dose invece di prevedere un risultato.
        // Usa la mediana della fascia pertinente (correzione se pH sopra target, mantenimento se
        // già a target o sotto) per convertire grammi in effetto atteso sul pH.
        // Attenzione: meno affidabile della stessa funzione per il Cloro (qui non c'è una vera
        // regressione validata, solo la formula teorica scalata con un rapporto mediano — vedi
        // le note in cima al file). Utile come punto di partenza da confrontare con la lettura
        // reale delle 21, non come previsione precisa.
        simulaEsito: function (phMattina, doseUsata, alkaPpm) {
            if (phMattina == null || isNaN(phMattina)) return null;
            let alkaNota = (alkaPpm != null && !isNaN(alkaPpm));
            let alka = alkaNota ? alkaPpm : ALKA_STANDARD;
            let dose = (doseUsata != null && !isNaN(doseUsata)) ? doseUsata : 0;

            let phAtteso;
            if (phMattina > TARGET_PH) {
                // Regime di correzione: il rapporto mediano include già la dinamica reale
                // (deriva compresa), non si aggiunge un'altra deriva separata.
                let datiLimitati = alka < SOGLIA_ALKA_VALIDATA;
                let ratio = (datiLimitati ? FASCE_PER_ALKA.limitata : FASCE_PER_ALKA.validata).mediana;
                let deltaDaDose = dose / (VOL_PISCINA_M3 * alka * ratio);
                phAtteso = phMattina - deltaDaDose;
            } else {
                // Regime di mantenimento: deriva naturale e effetto della dose stimati separatamente.
                let deltaDaDose = dose / (VOL_PISCINA_M3 * alka * RAPPORTO_MANTENIMENTO);
                phAtteso = phMattina + DERIVA_NATURALE_MEDIA - deltaDaDose;
            }

            return {
                predetto: Math.round(phAtteso * 1000) / 1000,
                doseUsata: dose,
                avvisoSuperaMassimo: phAtteso > MASSIMO_LEGALE,
                avvisoSottoMinimo: phAtteso < MINIMO_LEGALE,
                alka: alka,
                alkaNota: alkaNota
            };
        },

        // Calcola il range di dose consigliata di pH- (Riduttore Acido).
        // pH: valore misurato (es. 7.37). alkaPpm: ultima Alka nota (può essere null).
        // Restituisce null se il pH è già al target o sotto (nessuna dose serve).
        calcolaRangeDosePH: function (pH, alkaPpm) {
            if (pH == null || isNaN(pH) || pH <= TARGET_PH) return null;

            let alkaNota = (alkaPpm != null && !isNaN(alkaPpm));
            let alka = alkaNota ? alkaPpm : ALKA_STANDARD;

            let teorico = (pH - TARGET_PH) * VOL_PISCINA_M3 * alka;
            let datiLimitati = alka < SOGLIA_ALKA_VALIDATA;
            let fascia = datiLimitati ? FASCE_PER_ALKA.limitata : FASCE_PER_ALKA.validata;

            return {
                teorico: Math.round(teorico),
                min: Math.round(teorico * fascia.min),
                max: Math.round(teorico * fascia.max),
                alka: alka,
                alkaNota: alkaNota,
                datiLimitati: datiLimitati,
                calibrato: false,
                n: null,
                r2: null
            };
        }
    };
})();