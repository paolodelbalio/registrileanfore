// Gestore Isolato per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    document.addEventListener("DOMContentLoaded", () => {
        // Diamo un secondo a script.js di caricare la tabella vecchia, poi la sovrascriviamo noi
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

    function estraiDataManutenzione(dataStr) {
        if (!dataStr) return null;
        let dLower = dataStr.toLowerCase().trim();
        
        const mesi = {\n            "gen": 0, "feb": 1, "mar": 2, "apr": 3, "mag": 4, "giu": 5,
            "lug": 6, "ago": 7, "set": 8, \"ott\": 9, \"nov\": 10, \"dic\": 11
        };

        let parti = dLower.split(/\s+/);
        let giorno = null;
        let mese = null;
        let anno = 2026;

        for (let p of parti) {
            let mNum = parseInt(p);
            if (!isNaN(mNum) && mNum > 0 && mNum <= 31) {
                giorno = mNum;
            }
            for (let mKey in mesi) {
                if (p.includes(mKey)) mese = mesi[mKey];
            }
            if (p.includes("202")) {
                let aNum = parseInt(p);
                if (!isNaN(aNum)) anno = aNum;
            }
        }

        if (giorno !== null && mese !== null) {
            return new Date(anno, mese, giorno);
        }
        return null;
    }

    function elaboraManutenzioniProtetto(righe) {
        if (!righe || righe.length === 0) return;
        let intestazioni = righe[0].map(h => h ? h.replace(/["']/g, "").trim() : "");
        let righePulite = righe.slice(1).filter(r => r.some(cella => cella && cella.trim() !== ""));
        costruisciTabellaManutenzioniProtetta(intestazioni, righePulite);
    }

    function costruisciTabellaManutenzioniProtetta(intestazioni, righe) {
        const tabella = document.getElementById("manutenzioniTable");
        if (!tabella) return;

        let idxDataMan = intestazioni.findIndex(h => h.toLowerCase().trim() === "data");
        let idxInterventoMan = intestazioni.findIndex(h => h.toLowerCase().trim() === "intervento");

        let giorniControlavaggio = 99;
        let giorniCestelli = 99;
        let giorniPrefiltro = 99;
        let rigaPrimaVuotaIdx = righe.length - 1;

        if (idxDataMan !== -1 && idxInterventoMan !== -1) {
            let uControlavaggio = null;
            let uCestelli = null;
            let uPrefiltro = null;

            for (let i = 0; i < righe.length - 3; i++) { 
                let tIntervento = (righe[i][idxInterventoMan] || "").toLowerCase().trim();
                let dObj = estraiDataManutenzione(righe[i][idxDataMan]);

                if (dObj && !isNaN(dObj.getTime())) {
                    if (tIntervento.includes("controlavaggio")) uControlavaggio = dObj;
                    if (tIntervento.includes("cestelli")) uCestelli = dObj;
                    if (tIntervento.includes("prefiltro")) uPrefiltro = dObj;
                }
            }

            let oggi = new Date();
            oggi.setHours(0,0,0,0);

            if (uControlavaggio) giorniControlavaggio = Math.floor((oggi - uControlavaggio) / (1000 * 60 * 60 * 24));
            if (uCestelli) giorniCestelli = Math.floor((oggi - uCestelli) / (1000 * 60 * 60 * 24));
            if (uPrefiltro) giorniPrefiltro = Math.floor((oggi - uPrefiltro) / (1000 * 60 * 60 * 24));
        }

        let html = "<thead><tr>";
        intestazioni.forEach(h => { html += `<th>${h}</th>`; });
        html += "</tr></thead><tbody>";

        righe.forEach((riga, rIdx) => {
            html += "<tr>";
            riga.forEach(cella => {
                let testo = cella ? cella.replace(/["']/g, "").trim() : "";
                html += `<td>${testo}</td>`;
            });
            html += "</tr>";
        });
        html += "</tbody>";
        tabella.innerHTML = html;

        aggiornaPannelloScadenzeFisso(giorniControlavaggio, giorniCestelli, giorniPrefiltro);
    }

    function aggiornaPannelloScadenzeFisso(ggFiltro, ggCestelli, ggPrefiltro) {
        let sFiltro = ggFiltro === 99 ? "Nessun dato" : `Fatto ${ggFiltro} giorni fa`;
        let sCestelli = ggCestelli === 99 ? "Nessun dato" : `Fatto ${ggCestelli} giorni fa`;
        let sPrefiltro = ggPrefiltro === 99 ? "Nessun dato" : `Fatto ${ggPrefiltro} giorni fa`;

        let containerVecchio = document.getElementById("manutenzioniScadenzeBox");
        if (containerVecchio) containerVecchio.remove();

        let htmlPopup = `
        <div id="manutenzioniScadenzeBox" style="margin-bottom:20px; padding:15px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px;">
            <h3 style="color:#0066cc; margin-bottom:10px; font-size:1.05rem;">Stato Scadenze Interventi</h3>
            <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                <tr style="border-bottom:2px solid #e2e8f0; background:#f8fafc;">
                    <th style="padding:10px; color:#0066cc;">OPERAZIONE</th>
                    <th style="padding:10px; color:#0066cc;">STATO ATTUALE</th>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:10px; font-weight:bold;">Controlavaggio</td>\n                    <td style="padding:10px; color:${ggFiltro > 4 ? '#ef4444' : '#10b981'}; font-weight:bold;">${sFiltro}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:10px; font-weight:bold;">Pulizia cestelli</td>
                    <td style="padding:10px; color:${ggCestelli > 3 ? '#ef4444' : '#10b981'}; font-weight:bold;">${sCestelli}</td>
                </tr>
                <tr>
                    <td style="padding:10px; font-weight:bold;">Pulizia prefiltro</td>
                    <td style="padding:10px; color:${ggPrefiltro > 15 ? '#ef4444' : '#10b981'}; font-weight:bold;">${sPrefiltro}</td>
                </tr>
            </table>
        </div>`;

        const sez = document.getElementById("manutenzioniSection");
        if (sez) {
            let wrapper = sez.querySelector(".table-wrapper");
            if (wrapper) {
                wrapper.insertAdjacentHTML('beforebegin', htmlPopup);
            }
        }
    }
})();