// Gestore Isolato per il Registro Manutenzioni con Scadenziario in riga
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
        setTimeout(caricaRegistroManutenzioniIsolato, 1200);
    });

    function caricaRegistroManutenzioniIsolato() {
        if (typeof Papa === 'undefined') return;
        Papa.parse(FILE_MANUTENZIONI, {
            download: true,
            header: false,
            skipEmptyLines: false,
            complete: function(risultati) {
                elaboraManutenzioniProtetto(risultati.data);
            }
        });
    }

    function analizzaData(stringaData) {
        if (!stringaData) return null;
        let pulita = stringaData.replace(/^(dom|lun|mar|mer|gio|ven|sab)\s+/i, '').trim();
        
        const mesi = {
            'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5,
            'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11
        };

        let parti = pulita.split(/\s+/);
        if (parti.length >= 3) {
            let giorno = parseInt(parti[0], 10);
            let meseStr = parti[1].toLowerCase().substring(0, 3);
            let anno = parseInt(parti[2], 10);
            
            if (!isNaN(giorno) && mesi[meseStr] !== undefined && !isNaN(anno)) {
                return new Date(anno, mesi[meseStr], giorno);
            }
        }
        return null;
    }

    function elaboraManutenzioniProtetto(righe) {
        const tabella = document.getElementById("manutenzioniTable");
        if (!tabella || !righe || righe.length === 0) return;

        let html = "<thead><tr>";
        let indiceData = 0;
        let indiceNote = -1;
        let numeroColonne = 6; // Default standard del registro

        if (righe[0]) {
            numeroColonne = righe[0].length;
            righe[0].forEach((col, idx) => {
                let nomeCol = col.replace(/"/g, "").trim();
                html += `<th>${nomeCol}</th>`;
                if (nomeCol.toLowerCase().includes("data")) indiceData = idx;
                if (nomeCol.toLowerCase().includes("note") || nomeCol.toLowerCase().includes("intervento")) indiceNote = idx;
            });
            html += "</tr></thead><tbody>";
        }

        let ultimeDate = { "CONTROLAVAGGIO": null, "PULIZIA CESTELLI": null, "PULIZIA PREFILTRO": null };
        let conteggioRigheValide = 0;

        for (let i = 1; i < righe.length; i++) {
            let riga = righe[i];
            if (!riga || riga.length === 0 || (riga.length === 1 && riga[0] === "")) continue;

            let haContenuto = riga.some(cella => cella.strip ? cella.strip() !== "" : cella.trim() !== "");
            if (haContenuto) conteggioRigheValide = i;

            html += "<tr>";
            riga.forEach(cella => {
                html += `<td>${cella.replace(/"/g, "").trim()}</td>`;
            });
            html += "</tr>";

            if (indiceNote !== -1 && riga[indiceNote] && riga[indiceData]) {
                let testoNote = riga[indiceNote].toUpperCase();
                let dataValida = analizzaData(riga[indiceData]);

                if (dataValida) {
                    Object.keys(ultimeDate).forEach(chiave => {
                        if (testoNote.includes(chiave)) {
                            if (!ultimeDate[chiave] || dataValida > ultimeDate[chiave]) {
                                ultimeDate[chiave] = dataValida;
                            }
                        }
                    });
                }
            }
        }

        // Calcoliamo lo stato per capire il colore da dare alla riga pulsante
        let statoScadenze = calcolaStatoAllarmi(ultimeDate);

        // Inseriamo la riga speciale con il pulsante integrato che occupa tutte le colonne
        html += `
            <tr id="riga-pulsante-scadenze">
                <td colspan="${numeroColonne}" style="padding: 10px; text-align: center; background-color: #f8f9fa;">
                    <button id="btn-stato-manutenzioni" style="
                        width: 95%; padding: 10px; font-size: 15px; font-weight: bold;
                        color: ${statoScadenze.stato === 'GIALLO' ? '#000' : '#fff'}; 
                        background-color: ${statoScadenze.colore};
                        border: none; border-radius: 4px; cursor: pointer; transition: 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        ${statoScadenze.testo}
                    </button>
                </td>
            </tr>
            <tr><td colspan="${numeroColonne}">&nbsp;</td></tr> `;

        html += "</tbody>";
        tabella.innerHTML = html;

        // Agganciamo l'evento al click sul pulsante appena creato nella tabella
        document.getElementById("btn-stato-manutenzioni").addEventListener("click", mostraFinestraDettagli);

        // Scroll automatico calibrato esattamente sulla riga del pulsante
        setTimeout(() => {
            const rigaPulsante = document.getElementById("riga-pulsante-scadenze");
            if (rigaPulsante) {
                rigaPulsante.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }

    function calcolaStatoAllarmi(ultimeDate) {
        const oggi = new Date();
        let peggiorStato = "VERDE";
        statoScadenzeGlobali = [];

        Object.keys(SCADENZE).forEach(chiave => {
            let ultimaData = ultimeDate[chiave];
            let giorniTrascorsi = "-";
            let coloreTask = "green";

            if (ultimaData) {
                let diffTempo = Math.abs(oggi - ultimaData);
                giorniTrascorsi = Math.floor(diffTempo / (1000 * 60 * 60 * 24));

                if (giorniTrascorsi >= SCADENZE[chiave].rosso) {
                    coloreTask = "red";
                    if (peggiorStato !== "ROSSO") peggiorStato = "ROSSO";
                } else if (giorniTrascorsi >= SCADENZE[chiave].giallo) {
                    coloreTask = "orange";
                    if (peggiorStato !== "ROSSO") peggiorStato = "GIALLO";
                }
            } else {
                coloreTask = "red";
                peggiorStato = "ROSSO";
                giorniTrascorsi = "MAI ESEGUITO";
            }

            statoScadenzeGlobali.push({
                intervento: SCADENZE[chiave].msg,
                giorni: giorniTrascorsi,
                colore: coloreTask
            });
        });

        let configurazione = { colore: "#28a745", testo: "✅ Impianti OK - Nessuna Scadenza", stato: peggiorStato };
        if (peggiorStato === "ROSSO") {
            configurazione.colore = "#dc3545";
            configurazione.testo = "🚨 ATTENZIONE: Interventi Scaduti! Clicca per i dettagli";
        } else if (peggiorStato === "GIALLO") {
            configurazione.colore = "#ffc107";
            configurazione.testo = "⚠️ Interventi in Scadenza - Clicca per i dettagli";
        }

        return configurazione;
    }

    function mostraFinestraDettagli() {
        let vecchioPopup = document.getElementById("popup-scadenze");
        if (vecchioPopup) vecchioPopup.remove();

        let htmlElenco = "";
        statoScadenzeGlobali.forEach(item => {
            let cerchioColore = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${item.colore}; margin-right:8px;"></span>`;
            htmlElenco += `
                <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center;">${cerchioColore} <strong>${item.intervento}</strong></div>
                    <div>Ultimo intervento: <span style="font-weight:bold; color:${item.colore === 'orange' ? '#d97706' : item.colore}">${item.giorni} ${typeof item.giorni === 'number' ? 'giorni fa' : ''}</span></div>
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
                <h3 style="margin-top: 0; border-bottom: 2px solid #0275d8; padding-bottom: 10px; color: #333;">📋 Stato Scadenziario Manutenzioni</h3>
                <div style="margin: 20px 0;">
                    ${htmlElenco}
                </div>
                <button id="chiudi-popup-scadenze" style="
                    width: 100%; padding: 10px; background: #0275d8; color: #fff;
                    border: none; border-radius: 4px; font-weight: bold; cursor: pointer;
                ">Chiudi Finestra</button>
            </div>
        `;

        document.body.appendChild(popup);
        document.getElementById("chiudi-popup-scadenze").addEventListener("click", () => popup.remove());
        popup.addEventListener("click", (e) => { if (e.target === popup) popup.remove(); });
    }
})();