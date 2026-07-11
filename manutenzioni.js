// Gestore Isolato Separato per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    // Scadenze per gli allarmi visivi
    const SCADENZE = {
        "CONTROLAVAGGIO": { giallo: 5, rosso: 7, msg: "Controlavaggio filtri" },
        "PULIZIA CESTELLI": { giallo: 5, rosso: 7, msg: "Pulizia cestelli skimmer" },
        "PULIZIA PREFILTRO": { giallo: 10, rosso: 15, msg: "Pulizia prefiltro pompa" }
    };

    let statoScadenzeGlobali = [];

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(caricaRegistroManutenzioniIsolato, 1000);
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
        const tabella = document.getElementById("tabellaManutenzioniIsolata");
        if (!tabella) return;

        // Forziamo le intestazioni pulite del vero registro
        let intestazioniFisse = ["Data", "Impianto/Componente", "Intervento/Operazione", "Note", "Firma"];
        
        let html = "<thead><tr>";
        intestazioniFisse.forEach(h => {
            html += `<th>${h}</th>`;
        });
        html += "</tr></thead><tbody>";

        let ultimiInterventi = {};
        Object.keys(SCADENZE).forEach(k => { ultimiInterventi[k] = null; });

        // Primo passaggio: calcolo delle scadenze per gli allarmi
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

        // Configurazione stati allarmi
        let oggi = new Date();
        oggi.setHours(0,0,0,0);
        statoScadenzeGlobali = [];
        Object.keys(SCADENZE).forEach(chiave => {
            let config = SCADENZE[chiave];
            let ultimaData = ultimiInterventi[chiave];
            if (!ultimaData) {
                statoScadenzeGlobali.push({ chiave: chiave, stato: "rosso", giorni: "MAI ESEGUITO", msg: config.msg });
            } else {
                let diffGiorni = Math.floor((oggi.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24));
                let stato = "verde";
                if (diffGiorni >= config.rosso) stato = "rosso";
                else if (diffGiorni >= config.giallo) stato = "giallo";
                statoScadenzeGlobali.push({ chiave: chiave, stato: stato, giorni: diffGiorni, msg: config.msg });
            }
        });

        // Secondo passaggio: Costruzione reale delle righe della tabella
        righe.forEach(riga => {
            if (!riga || riga.length === 0) return;
            
            let colData = riga[0] ? riga[0].toString().trim() : "";
            // Saltiamo le righe di intestazione del foglio LibreOffice per non sporcare la tabella
            if (colData === "" || colData.toUpperCase().includes("DATA") || colData.toUpperCase().includes("REGISTRO")) return;

            let oggettoData = analizzaData(colData);
            let stileRiga = "";

            if (oggettoData) {
                let testoUnito = riga.join(" ").toUpperCase();
                let peggiorStato = "";
                Object.keys(SCADENZE).forEach(chiave => {
                    if (testoUnito.includes(chiave)) {
                        let info = statoScadenzeGlobali.find(s => s.chiave === chiave);
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
            // Stampiamo solo le prime 5 colonne standard per evitare sfasamenti visivi
            for (let i = 0; i < 5; i++) {
                let contenutoCella = riga[i] ? riga[i].toString().trim() : "";
                html += `<td>${contenutoCella}</td>`;
            }
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;

        if (statoScadenzeGlobali.some(s => s.stato === "rosso" || s.stato === "giallo")) {
           // mostraPopupAllarmiManutenzioni();
        }
    }

    148    window.mostraPopupAllarmiManutenzioni = function() {
        if (document.getElementById("popup-scadenze")) return;

        let htmlElenco = "";
        statoScadenzeGlobali.forEach(item => {
            let coloreSfondo = "#d4edda"; let coloreTesto = "#155724";
            if (item.stato === "rosso") { coloreSfondo = "#f8d7da"; coloreTesto = "#721c24"; }
            else if (item.stato === "giallo") { coloreSfondo = "#fff3cd"; coloreTesto = "#856404"; }

            htmlElenco += `
                <div style="background: ${coloreSfondo}; color: ${coloreTesto}; padding: 10px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <strong>${item.msg}</strong>
                    <div><span style="font-size: 0.85rem; background: rgba(255,255,255,0.6); padding: 2px 6px; border-radius: 3px;">${item.giorni} ${typeof item.giorni === 'number' ? 'giorni fa' : ''}</span></div>
                </div>
            `;
        });

        const popup = document.createElement("div");
        popup.id = "popup-scadenze";
        popup.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        `;

        popup.innerHTML = `
            <div style="background: #fff; padding: 25px; border-radius: 8px; width: 90%; max-width: 500px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: sans-serif;">
                <h3 style="margin-top: 0; border-bottom: 2px solid #0066cc; padding-bottom: 10px; color: #333;">📋 Stato Scadenziario Manutenzioni</h3>
                <div style="margin: 20px 0;">
                    ${htmlElenco}
                </div>
                <button id="chiudi-popup-scadenze" style="
                    width: 100%; padding: 10px; background: #0066cc; color: #fff;
                    border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    Ho preso visione
                </button>
            </div>
        `;

        document.body.appendChild(popup);
        document.getElementById("chiudi-popup-scadenze").addEventListener("click", () => { popup.remove(); });
    }
})();