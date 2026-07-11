// Gestore Isolato e Protetto per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    // Mappatura delle scadenze in giorni
    const SCADENZE = {
        "CONTROLAVAGGIO": { giallo: 5, rosso: 7, msg: "Controlavaggio filtri" },
        "PULIZIA CESTELLI": { giallo: 5, rosso: 7, msg: "Pulizia cestelli skimmer" },
        "PULIZIA PREFILTRO": { giallo: 10, rosso: 15, msg: "Pulizia prefiltro pompa" }
    };

    let statoScadenzeGlobali = [];

    document.addEventListener("DOMContentLoaded", () => {
        // Avvio ritardato per non sovrapporsi al chimico
        setTimeout(caricaRegistroManutenzioniIsolato, 1000);
    });

    function caricaRegistroManutenzioniIsolato() {
        if (typeof Papa === 'undefined') {
            console.error("PapaParse non caricato.");
            return;
        }
        
        Papa.parse(FILE_MANUTENZIONI, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                if (risultati && risultati.data) {
                    elaboraManutenzioniProtetto(risultati.data);
                }
            },
            error: function(errore) {
                console.error("File manutenzioni non trovato o errore Git 404. Verificare nome file.");
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

    function elaboraManutenzioniProtetto(righe) {
        if (!righe || righe.length === 0) return;

        let rigaIntestazione = null;
        let indiceData = -1;
        let righeDatiGrezze = [];

        // Trova la riga delle intestazioni stabili
        for (let i = 0; i < righe.length; i++) {
            let r = righe[i];
            if (!r || r.length === 0) continue;
            let testoUnito = r.join("").toUpperCase();
            
            if (testoUnito.includes("DATA") && (testoUnito.includes("INTERVENTO") || testoUnito.includes("OPERAZIONE"))) {
                rigaIntestazione = r.map(c => c ? c.trim() : "");
                indiceData = r.findIndex(c => c && c.toUpperCase().includes("DATA"));
                righeDatiGrezze = righe.slice(i + 1);
                break;
            }
        }

        // Se non trova intestazioni standard nel CSV, ne usa una di sicurezza
        if (!rigaIntestazione) {
            rigaIntestazione = ["Data", "Impianto/Componente", "Intervento/Operazione", "Note", "Firma"];
            indiceData = 0;
            righeDatiGrezze = righe.filter(r => r && r.length > 0 && r.join("").trim() !== "");
            if (righeDatiGrezze.length > 0 && righeDatiGrezze[0].join("").toUpperCase().includes("REGISTRO")) {
                righeDatiGrezze.shift();
            }
        }

        let ultimiInterventi = {};
        Object.keys(SCADENZE).forEach(k => { ultimiInterventi[k] = null; });
        let righeValideElaborate = [];

        righeDatiGrezze.forEach(r => {
            if (!r || r.length === 0 || indiceData === -1 || !r[indiceData]) return;
            let stringaData = r[indiceData].trim();
            if (stringaData === "" || stringaData.toUpperCase().includes("DATA")) return;

            let oggettoData = analizzaData(stringaData);
            righeValideElaborate.push({ rigaGrezza: r, dataObj: objetoData });

            if (oggettoData) {
                let testoCampi = r.join(" ").toUpperCase();
                Object.keys(SCADENZE).forEach(chiave => {
                    if (testoCampi.includes(chiave)) {
                        if (!ultimiInterventi[chiave] || oggettoData > ultimiInterventi[chiave]) {
                            ultimiInterventi[chiave] = oggettoData;
                        }
                    }
                });
            }
        });

        let oggi = new Date();
        oggi.setHours(0,0,0,0);
        statoScadenzeGlobali = [];

        Object.keys(SCADENZE).forEach(chiave => {
            let config = SCADENZE[chiave];
            let ultimaData = ultimiInterventi[chiave];
            if (!ultimaData) {
                statoScadenzeGlobali.push({ chiave: chiave, stato: "rosso", giorni: "MAI ESEGUITO", msg: config.msg });
            } else {
                let diffTempo = oggi.getTime() - ultimaData.getTime();
                let diffGiorni = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
                let stato = "verde";
                if (diffGiorni >= config.rosso) stato = "rosso";
                else if (diffGiorni >= config.giallo) stato = "giallo";
                
                statoScadenzeGlobali.push({ chiave: chiave, stato: stato, giorni: diffGiorni, msg: config.msg });
            }
        });

        const tabella = document.getElementById("tabellaManutenzioniIsolata");
        if (!tabella) return;

        // COSTRUZIONE SICURA DELLA TESTATA HTML
        let html = "<thead><tr>";
        rigaIntestazione.forEach(h => {
            html += `<th>${h || ""}</th>`;
        });
        html += "</tr></thead><tbody>";

        // COSTRUZIONE DEL CORPO DELLA TABELLA
        righeValideElaborate.forEach(item => {
            let r = item.rigaGrezza;
            let stileRiga = "";
            
            if (item.dataObj) {
                let testoCampi = r.join(" ").toUpperCase();
                let peggiorStato = "";
                
                Object.keys(SCADENZE).forEach(chiave => {
                    if (testoCampi.includes(chiave)) {
                        let infoScadenza = statoScadenzeGlobali.find(s => s.chiave === chiave);
                        if (infoScadenza) {
                            if (infoScadenza.stato === "rosso") peggiorStato = "rosso";
                            else if (infoScadenza.stato === "giallo" && peggiorStato !== "rosso") peggiorStato = "giallo";
                        }
                    }
                });

                if (peggiorStato === "rosso") stileRiga = ' class="evidenzia-rosso"';
                else if (peggiorStato === "giallo") stileRiga = ' class="evidenzia-giallo"';
            }

            html += `<tr${stileRiga}>`;
            r.forEach(cella => {
                html += `<td>${cella || ""}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;

        // Mostra il popup allarmi solo se ci sono reali elementi fuori scadenza
        if (statoScadenzeGlobali.some(s => s.stato === "rosso" || s.stato === "giallo")) {
            mostraPopupAllarmiManutenzioni();
        }
    }

    function mostraPopupAllarmiManutenzioni() {
        if (document.getElementById("popup-scadenze")) return;

        let htmlElenco = "";
        statoScadenzeGlobali.forEach(item => {
            let coloreSfondo = "#d4edda"; 
            let coloreTesto = "#155724";
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

        document.getElementById("chiudi-popup-scadenze").addEventListener("click", () => {
            popup.remove();
        });
    }
})();