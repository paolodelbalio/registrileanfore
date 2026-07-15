// Gestore Isolato Separato per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    // Scadenze per gli allarmi visivi
    const SCADENZE = {
        "CONTROLAVAGGIO": { giallo: 4, rosso: 7, msg: "Controlavaggio filtri", paroleChiave: ["CONTROLAVAGGIO", "LAVAGGIO FILTRI", "LAVAGGIO"] },
        "PULIZIA CESTELLI": { giallo: 5, rosso: 7, msg: "Pulizia cestelli skimmer", paroleChiave: ["PULIZIA CESTELLI", "PULITO CESTELLI", "CESTELLI"] },
        "PULIZIA PREFILTRO": { giallo: 10, rosso: 15, msg: "Pulizia prefiltro pompa", paroleChiave: ["PREFILTRO", "PRE-FILTRO"] }
    };

    // Mesi abbreviati italiani, per riconoscere date scritte come testo (es. "19 giu 2026")
    const MESI_IT = { "GEN": 0, "FEB": 1, "MAR": 2, "APR": 3, "MAG": 4, "GIU": 5, "LUG": 6, "AGO": 7, "SET": 8, "OTT": 9, "NOV": 10, "DIC": 11 };

    window.statoScadenzeGlobali = [];

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroManutenzioniIsolato();
    });

    function caricaRegistroManutenzioniIsolato() {
        if (typeof Papa === 'undefined') return;
        
        Papa.parse(FILE_MANUTENZIONI, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                if (risultati && risultati.data) {
                    disegnaTabellaManutenzioniFissa(risultati.data);
                }
            }
        });
    }

    // Identifica e valida la data all'interno della stringa, sia in formato numerico GG/MM/AAAA
    // sia in formato testuale italiano (es. "ven 19 giu 2026")
    function analizzaData(testo) {
        if (!testo) return null;

        // Formato numerico: GG/MM/AAAA
        let match = testo.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
            let giorno = parseInt(match[1], 10);
            let mese = parseInt(match[2], 10) - 1;
            let anno = parseInt(match[3], 10);
            if (anno < 100) anno += 2000;

            let d = new Date(anno, mese, giorno);
            return isNaN(d.getTime()) ? null : d;
        }

        // Formato testuale italiano: GG + mese abbreviato + AAAA (es. "19 GIU 2026")
        let matchTesto = testo.match(/(\d{1,2})\s+(GEN|FEB|MAR|APR|MAG|GIU|LUG|AGO|SET|OTT|NOV|DIC)\.?\s+(\d{4})/);
        if (matchTesto) {
            let giorno = parseInt(matchTesto[1], 10);
            let mese = MESI_IT[matchTesto[2]];
            let anno = parseInt(matchTesto[3], 10);

            let d = new Date(anno, mese, giorno);
            return isNaN(d.getTime()) ? null : d;
        }

        return null;
    }

    function disegnaTabellaManutenzioniFissa(righe) {
        const tabular = document.getElementById("tabellaManutenzioniIsolata");
        if (!tabular) return;

        let html = "<thead><tr><th>Data</th><th>Impianto/Area</th><th>Intervento</th><th>Tecnico</th><th>Note</th><th>Firma</th></tr></thead><tbody>";

        let ultimiInterventi = {};
        Object.keys(SCADENZE).forEach(k => { ultimiInterventi[k] = null; });

        // Fase 1: Calcolo dinamico dello scadenziario
        righe.forEach(riga => {
            if (!riga || riga.length === 0) return;
            
            // Uniamo tutta la riga pulendola per fare una ricerca globale a prova di errore
            let testoIntero = riga.map(c => c ? c.toString() : "").join(" ").replace(/"/g, "").toUpperCase();
            if (testoIntero.trim() === "" || testoIntero.includes("DATA") || testoIntero.includes("REGISTRO")) return;

            let oggettoData = analizzaData(testoIntero);
            if (oggettoData) {
                Object.keys(SCADENZE).forEach(chiave => {
                    let config = SCADENZE[chiave];
                    let corrisponde = config.paroleChiave.some(p => testoIntero.includes(p));
                    
                    if (corrisponde) {
                        if (!ultimiInterventi[chiave] || oggettoData > ultimiInterventi[chiave]) {
                            ultimiInterventi[chiave] = oggettoData;
                        }
                    }
                });
            }
        });

        let oggi = new Date();
        oggi.setHours(0,0,0,0);
        window.statoScadenzeGlobali = [];
        Object.keys(SCADENZE).forEach(chiave => {
            let config = SCADENZE[chiave];
            let ultimaData = ultimiInterventi[chiave];
            if (!ultimaData) {
                window.statoScadenzeGlobali.push({ chiave: chiave, stato: "rosso", giorni: "MAI ESEGUITO", msg: config.msg });
            } else {
                let diffGiorni = Math.floor((oggi.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24));
                let stato = "verde";
                if (diffGiorni >= config.rosso) stato = "rosso";
                else if (diffGiorni >= config.giallo) stato = "giallo";
                window.statoScadenzeGlobali.push({ chiave: chiave, stato: stato, giorni: diffGiorni, msg: config.msg });
            }
        });

        // Fase 2: Costruzione delle righe della tabella
        righe.forEach(riga => {
            if (!riga || riga.length === 0) return;
            
            let testoIntero = riga.map(c => c ? c.toString() : "").join(" ").replace(/"/g, "").toUpperCase();
            if (testoIntero.trim() === "" || testoIntero.includes("DATA") || testoIntero.includes("REGISTRO")) return;

            let oggettoData = analizzaData(testoIntero);
            let classeCellaIntervento = "";

            if (oggettoData) {
                let peggiorStato = "";
                Object.keys(SCADENZE).forEach(chiave => {
                    let config = SCADENZE[chiave];
                    let corrisponde = config.paroleChiave.some(p => testoIntero.includes(p));
                    // Coloriamo la cella solo se corrisponde ED è la riga più recente per questa categoria
                    let ultimaDataCategoria = ultimiInterventi[chiave];
                    let eUltimaOccorrenza = ultimaDataCategoria && oggettoData.getTime() === ultimaDataCategoria.getTime();

                    if (corrisponde && eUltimaOccorrenza) {
                        let info = window.statoScadenzeGlobali.find(s => s.chiave === chiave);
                        if (info) {
                            if (info.stato === "rosso") peggiorStato = "rosso";
                            else if (info.stato === "giallo" && peggiorStato !== "rosso") peggiorStato = "giallo";
                        }
                    }
                });
                if (peggiorStato === "rosso") classeCellaIntervento = ' class="evidenzia-rosso"';
                else if (peggiorStato === "giallo") classeCellaIntervento = ' class="evidenzia-giallo"';
            }

            html += "<tr>";
            
            // Gestione mista: supporta sia celle già divise da PapaParse, sia righe unite da dividere tramite ';'
            let celleDivise = [];
            if (riga.length === 1 || (riga[0] && riga[0].toString().includes(';'))) {
                celleDivise = riga[0].toString().split(';');
            } else {
                celleDivise = riga.map(c => c ? c.toString().trim() : "");
            }

            for (let i = 0; i < 6; i++) {
                let valoreGrafico = celleDivise[i] ? celleDivise[i].replace(/"/g, "").trim() : "";
                // Colonna 2 = Intervento: è la cella che indica quale manutenzione è stata fatta,
                // quindi è lì che ha senso segnalare che quel tipo di intervento è in ritardo.
                let attributoCella = (i === 2) ? classeCellaIntervento : "";
                html += `<td${attributoCella} title="${valoreGrafico.replace(/"/g, '&quot;')}">${valoreGrafico}</td>`;
            }
            html += "</tr>";
        });

        // Fase 3: Disegno del Pulsante Centrato e Ridotto (max-width: 240px)
        // Il colore del pulsante riflette lo stato PEGGIORE tra le tre scadenze monitorate
        let peggioreGlobale = "verde";
        window.statoScadenzeGlobali.forEach(s => {
            if (s.stato === "rosso") peggioreGlobale = "rosso";
            else if (s.stato === "giallo" && peggioreGlobale !== "rosso") peggioreGlobale = "giallo";
        });

        let coloreSfondo = "rgba(40, 167, 69, 0.12)";
        let coloreBordo = "rgba(40, 167, 69, 0.5)";
        let coloreTesto = "#1e7e34";

        if (peggioreGlobale === "rosso") {
            coloreSfondo = "rgba(220, 53, 69, 0.12)";
            coloreBordo = "rgba(220, 53, 69, 0.5)";
            coloreTesto = "#bd2130";
        } else if (peggioreGlobale === "giallo") {
            coloreSfondo = "rgba(255, 193, 7, 0.15)";
            coloreBordo = "rgba(211, 158, 0, 0.5)";
            coloreTesto = "#d39e00";
        }

        html += `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;

        html += `
            <tr>
                <td colspan="6" style="padding: 12px; background: transparent; border: none; text-align: center;">
                    <button onclick="window.apriDettaglioControlavaggio()" style="
                        width: 240px; box-sizing: border-box; background: ${coloreSfondo}; 
                        color: ${coloreTesto}; border: 1px solid ${coloreBordo};
                        padding: 7px 12px; font-size: 0.88rem; font-weight: bold; 
                        cursor: pointer; text-align: center; font-family: Arial, sans-serif;
                        border-radius: 4px; display: inline-block;">
                        🛠️ Stato Scadenze Manutenzione
                    </button>
                </td>
            </tr>
        `;


        for (let k = 0; k < 5; k++) {
            html += `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
        }

        html += "</tbody>";
        tabular.innerHTML = html;
    }

    window.aggiornaPulsanteStatoDinamico = function() {
        caricaRegistroManutenzioniIsolato();
    }

    // Genera il blocco colorato di riepilogo per una singola scadenza
    function generaRigaScadenza(info) {
        let giorniTesto = typeof info.giorni === 'number' ? `${info.giorni} giorni fa` : info.giorni;
        let colore = { sfondo: "#f0faf2", bordo: "#28a745", testo: "#1e7e34", icona: "✅" };
        if (info.stato === "rosso") colore = { sfondo: "#fdf1f2", bordo: "#dc3545", testo: "#bd2130", icona: "🚨" };
        else if (info.stato === "giallo") colore = { sfondo: "#fffaf0", bordo: "#ffc107", testo: "#d39e00", icona: "⚠️" };

        let sogliaTesto = SCADENZE[info.chiave] ? `Giallo a ${SCADENZE[info.chiave].giallo}gg / Rosso a ${SCADENZE[info.chiave].rosso}gg` : "";

        return `
            <div style="margin-bottom: 10px; padding: 12px; background: ${colore.sfondo}; border-left: 4px solid ${colore.bordo}; border-radius: 4px;">
                <p style="margin: 0 0 4px 0; font-size: 1rem; color: ${colore.testo};">${colore.icona} <strong>${info.msg}:</strong> eseguito <strong>${giorniTesto}</strong></p>
                <p style="margin: 0; font-size: 0.85rem; color: #777;">${sogliaTesto}</p>
            </div>
        `;
    }

    window.apriDettaglioControlavaggio = function() {
        if (document.getElementById("popup-scadenze")) return;

        // Ordine fisso di visualizzazione: Controlavaggio, Cestelli, Prefiltro
        let ordine = ["CONTROLAVAGGIO", "PULIZIA CESTELLI", "PULIZIA PREFILTRO"];
        let righeHtml = ordine.map(chiave => {
            let info = window.statoScadenzeGlobali.find(s => s.chiave === chiave);
            return info ? generaRigaScadenza(info) : "";
        }).join("");

        const popup = document.createElement("div");
        popup.id = "popup-scadenze";
        popup.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        `;

        popup.innerHTML = `
            <div style="background: #fff; padding: 25px; border-radius: 8px; width: 95%; max-width: 550px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-top: 0; border-bottom: 2px solid #0066cc; padding-bottom: 10px; color: #333;">🛠️ Stato Scadenze Manutenzione</h3>

                ${righeHtml}

                <h4 style="margin: 15px 0 8px 0; color: #0066cc;">📖 Guida Tecnica al Controlavaggio:</h4>
                <ol style="padding-left: 20px; line-height: 1.5; color: #444; font-size: 0.92rem;">
                    <li style="margin-bottom: 6px;"><strong>Spegnere la pompa</strong> di filtrazione della piscina.</li>
                    <li style="margin-bottom: 6px;">Ruotare la valvola selettrice del filtro sulla posizione <strong>"CONTROLAVAGGIO" (Backwash)</strong>.</li>
                    <li style="margin-bottom: 6px;">Aprire la valvola di scarico (se presente) e <strong>riaccendere la pompa</strong>.</li>
                    <li style="margin-bottom: 6px;">Lasciare circolare l'acqua per circa <strong>2-3 minuti</strong>, o finché la spia trasparente dello scarico non torna perfettamente limpida.</li>
                    <li style="margin-bottom: 6px;"><strong>Spegnere nuovamente la pompa</strong>.</li>
                    <li style="margin-bottom: 6px;">Spostare la valvola selettrice sulla posizione <strong>"RISCIACQUO" (Rinse)</strong>.</li>
                    <li style="margin-bottom: 6px;"><strong>Accendere la pompa</strong> per circa 30 secondi per assestare la sabbia del filtro ed evitare residui in piscina.</li>
                    <li style="margin-bottom: 6px;"><strong>Spegnere la pompa</strong>, rimettere la valvola su <strong>"FILTRAZIONE" (Filter)</strong> e riaccendere definitivamente.</li>
                </ol>

                <button id="chiudi-popup-scadenze" style="
                    width: 100%; padding: 12px; background: #0066cc; color: #fff;
                    border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 15px; font-size: 0.95rem;">
                    Ho preso visione
                </button>
            </div>
        `;

        document.body.appendChild(popup);
        document.getElementById("chiudi-popup-scadenze").addEventListener("click", () => { popup.remove(); });
    };

    window.mostraPopupAllarmiManutenzioni = function() {
        window.apriDettaglioControlavaggio();
    };
})();