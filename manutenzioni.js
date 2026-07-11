// Gestore Isolato Separato per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    // Scadenze per gli allarmi visivi (Giallo a 4 giorni, Rosso a 7 giorni)
    const SCADENZE = {
        "CONTROLAVAGGIO": { giallo: 4, rosso: 7, msg: "Controlavaggio filtri" },
        "PULIZIA CESTELLI": { giallo: 5, rosso: 7, msg: "Pulizia cestelli skimmer" },
        "PULIZIA PREFILTRO": { giallo: 10, rosso: 15, msg: "Pulizia prefiltro pompa" }
    };

    window.statoScadenzeGlobali = [];

    document.addEventListener("DOMContentLoaded", () => {
        // Carica subito i dati senza ritardi pesanti
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
                    // Disegna subito il pulsante non appena i dati sono pronti!
                    window.aggiornaPulsanteStatoDinamico();
                }
            }
        });
    }

    function analizzaData(stringaData) {
        if (!stringaData) return null;
        let pulita = stringaData.trim();
        let parti = pulita.split(' ');
        let elementoData = parti.length > 1 ? parti[1] : parti[0];
        
        let subParti = elementoData.split('/');
        if (subParti.length !== 3) return null;
        
        let giorno = parseInt(subParti[0], 10);
        let mese = parseInt(subParti[1], 10) - 1;
        let anno = parseInt(subParti[2], 10);
        if (anno < 100) anno += 2000;
        
        let d = new Date(anno, mese, giorno);
        return isNaN(d.getTime()) ? null : d;
    }

    function disegnaTabellaManutenzioniFissa(righe) {
        const tabular = document.getElementById("tabellaManutenzioniIsolata");
        if (!tabular) return;

        let html = "<thead><tr><th>Data</th><th>Impianto/Componente</th><th>Intervento/Operazione</th><th>Note</th><th>Firma</th></tr></thead><tbody>";

        let ultimiInterventi = {};
        Object.keys(SCADENZE).forEach(k => { ultimiInterventi[k] = null; });

        righe.forEach(riga => {
            if (!riga || riga.length < 3) return;
            let dataGrezza = riga[0] ? riga[0].toString().trim() : "";
            if (dataGrezza === "" || dataGrezza.toUpperCase().includes("DATA") || dataGrezza.toUpperCase().includes("REGISTRO")) return;

            let oggettoData = analizzaData(dataGrezza);
            if (oggettoData) {
                let testoUnito = riga.join(" ").toUpperCase();
                Object.keys(SCADENZE).forEach(chiave => {
                    if (testoUnito.includes(chiave)) {
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

        righe.forEach(riga => {
            if (!riga || riga.length === 0) return;
            
            let colData = riga[0] ? riga[0].toString().trim() : "";
            if (colData === "" || colData.toUpperCase().includes("DATA") || colData.toUpperCase().includes("REGISTRO")) return;

            let oggettoData = analizzaData(colData);
            let stileRiga = "";

            if (oggettoData) {
                let testoUnito = riga.join(" ").toUpperCase();
                let peggiorStato = "";
                Object.keys(SCADENZE).forEach(chiave => {
                    if (testoUnito.includes(chiave)) {
                        let info = window.statoScadenzeGlobali.find(s => s.chiave === chiave);
                        if (info) {
                            if (info.stato === "rosso") peggiorStato = "rosso";
                            else if (info.stato === "giallo" && peggiorStato !== "rosso") peggiorStato = "giallo";
                        }
                    }
                });
                if (peggiorStato === "rosso") stileRiga = ' class="evidenzia-rosso"';
                else if (peggiorStato === "giallo") stileRiga = ' class="evidenzia-giallo"';
            }

            html += `<tr${stileRiga}>`;
            for (let i = 0; i < 5; i++) {
                let contenutoCella = riga[i] ? riga[i].toString().trim() : "";
                html += `<td>${contenutoCella}</td>`;
            }
            html += "</tr>";
        });

        html += "</tbody>";
        tabular.innerHTML = html;
    }

    window.aggiornaPulsanteStatoDinamico = function() {
        const container = document.getElementById("container-bottone-stato");
        if (!container) return;

        let infoControlavaggio = window.statoScadenzeGlobali.find(s => s.chiave === "CONTROLAVAGGIO");
        if (!infoControlavaggio) return;

        let coloreBottone = "#28a745"; // Verde standard
        let coloreTesto = "#fff";
        
        if (infoControlavaggio.stato === "rosso") {
            coloreBottone = "#dc3545"; // Rosso allarme
        } else if (infoControlavaggio.stato === "giallo") {
            coloreBottone = "#ffc107"; // Giallo/Arancio
            coloreTesto = "#212529";
        }

        container.innerHTML = `
            <button onclick="window.apriDettaglioControlavaggio()" style="
                background: ${coloreBottone}; color: ${coloreTesto};
                padding: 12px 20px; font-size: 1rem; border: none;
                border-radius: 6px; font-weight: bold; cursor: pointer;
                box-shadow: 0 3px 6px rgba(0,0,0,0.15); margin-bottom: 15px; font-family: Arial, sans-serif;">
                🔄 Stato Controlavaggio: ${infoControlavaggio.giorni === 'MAI ESEGUITO' ? 'MAI ESEGUITO' : infoControlavaggio.giorni + ' giorni fa'}
            </button>
        `;
    }

    window.apriDettaglioControlavaggio = function() {
        if (document.getElementById("popup-scadenze")) return;

        let infoControlavaggio = window.statoScadenzeGlobali.find(s => s.chiave === "CONTROLAVAGGIO");
        let giorniTesto = typeof infoControlavaggio.giorni === 'number' ? `${infoControlavaggio.giorni} giorni fa` : infoControlavaggio.giorni;

        const popup = document.createElement("div");
        popup.id = "popup-scadenze";
        popup.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        `;

        popup.innerHTML = `
            <div style="background: #fff; padding: 25px; border-radius: 8px; width: 95%; max-width: 550px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-top: 0; border-bottom: 2px solid #0066cc; padding-bottom: 10px; color: #333;">🔄 Dettaglio Intervento Controlavaggio</h3>
                
                <div style="margin: 15px 0; padding: 12px; background: #f8f9fa; border-left: 4px solid #0066cc;">
                    <p style="margin: 0 0 5px 0; font-size: 1.05rem;"><strong>Stato:</strong> Intervento eseguito <strong>${giorniTesto}</strong>.</p>
                    <p style="margin: 0; font-size: 0.95rem; color: #666;">Frequenza richiesta: Giallo a 4gg / Rosso a 7gg.</p>
                </div>

                <h4 style="margin: 15px 0 8px 0; color: #0066cc;">📖 Guida Tecnica alla Procedura:</h4>
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
                    Ho preso visione della procedura
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