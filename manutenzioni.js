let datiManutenzioniGlobali = { intestazioni: [], righe: [] };
const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

document.addEventListener("DOMContentLoaded", () => {
    caricaRegistroManutenzioni();
});

function caricaRegistroManutenzioni() {
    Papa.parse(FILE_MANUTENZIONI, {
        download: true,
        header: false,
        skipEmptyLines: false,
        complete: function(risultati) {
            elaboraDatiManutenzioni(risultati.data);
        }
    });
}

function elaboraDatiManutenzioni(righeGrezze) {
    if (!righeGrezze || righeGrezze.length === 0) return;

    let indiceIntestazione = -1;
    for (let i = 0; i < righeGrezze.length; i++) {
        if (righeGrezze[i] && righeGrezze[i][0] && righeGrezze[i][0].toString().trim().toLowerCase().startsWith("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    if (indiceIntestazione === -1) indiceIntestazione = 0;

    let intestazioni = righeGrezze[indiceIntestazione].map(h => h ? h.trim() : "");
    let righeDati = righeGrezze.slice(indiceIntestazione + 1);

    let righePulite = [];
    righeDati.forEach(riga => {
        // Protezione PapaParse: pulizia da celle fantasma e stringhe con virgolette isolate
        if (riga.some(cella => cella && cella.trim() !== "")) {
            let rigaSistemata = riga.map(cella => {
                if (!cella) return "";
                let c = cella.trim();
                if (c === '"' || c === '",') return "";
                return c.replace(/^"/, "").replace(/"$/, "").trim();
            });
            righePulite.push(rigaSistemata);
        }
    });

    // Aggiunta riga fittizia per compilazione e allarme visivo
    if (righePulite.length > 0) {
        let rigaVuotaFittizia = new Array(intestazioni.length).fill("");
        righePulite.push(rigaVuotaFittizia);
    }

    datiManutenzioniGlobali = { intestazioni: intestazioni, righe: righePulite };
    costruisciTabellaManutenzioni(intestazioni, righePulite);
}

// Funzione helper per mappare i mesi testuali di LibreOffice in numeri Javascript
function estraiDataManutenzione(dataStr) {
    if (!dataStr) return null;
    let dLower = dataStr.toLowerCase();
    
    // Gestione formato testuale (es: mer 8 lug 2026 oppure mar 30 giu 2026)
    const mesi = {
        "gen": 0, "feb": 1, "mar": 2, "apr": 3, "mag": 4, "giu": 5,
        "lug": 6, "ago": 7, "set": 8, "ott": 9, "nov": 10, "dic": 11
    };

    let parti = dLower.split(/\s+/);
    let giorno = null;
    let mese = null;
    let anno = 2026;

    // Cerca il numero del giorno e il mese nelle parti della stringa
    for (let i = 0; i < parti.length; i++) {
        let p = parti[i].replace(/[^a-z0-9]/g, "");
        if (!isNaN(p) && p.length <= 2 && giorno === null) {
            giorno = parseInt(p);
        }
        if (mesi[p.substring(0, 3)] !== undefined) {
            mese = mesi[p.substring(0, 3)];
        }
        if (!isNaN(p) && p.length === 4) {
            anno = parseInt(p);
        }
    }

    if (giorno !== null && mese !== null) {
        return new Date(anno, mese, giorno);
    }

    // Fallback se per caso la data fosse scritta come DD/MM/YYYY
    let partiSlash = dataStr.split("/");
    if (partiSlash.length === 3) {
        let a = partiSlash[2].length === 2 ? "20" + partiSlash[2] : partiSlash[2];
        return new Date(parseInt(a), parseInt(partiSlash[1]) - 1, parseInt(partiSlash[0]));
    }

    return null;
}

function costruisciTabellaManutenzioni(intestazioni, righe) {
    const tabella = document.getElementById("manutenzioniTable");
    if (!tabella) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => { html += `<th>${h}</th>`; });
    html += "</tr></thead><tbody>";

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

        for (let i = 0; i < righe.length - 1; i++) {
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

    righe.forEach((riga, rIdx) => {
        html += "<tr>";
        intestazioni.forEach((intestazione, colIdx) => {
            let valore = riga[colIdx] || "";
            let classeCella = "";
            let attributiAggiuntivi = "";

            // Applica l'allarme visivo multicriterio alla riga vuota finale sulla colonna "Intervento"
            if (colIdx === idxInterventoMan && rIdx === rigaPrimaVuotaIdx) {
                let isScaduto = (giorniControlavaggio > 4 || giorniCestelli > 3 || giorniPrefiltro > 15);
                let isAttenzione = (giorniControlavaggio === 4 || giorniCestelli === 3 || giorniPrefiltro === 15);

                if (isScaduto) {
                    classeCella = "class='cell-alarm'";
                    attributiAggiuntivi = `onclick="apriPopupScadenziario(${giorniControlavaggio}, ${giorniCestelli}, ${giorniPrefiltro})" style="cursor:pointer;"`;
                } else if (isAttenzione) {
                    classeCella = "class='cell-warning'";
                    attributiAggiuntivi = `onclick="apriPopupScadenziario(${giorniControlavaggio}, ${giorniCestelli}, ${giorniPrefiltro})" style="cursor:pointer;"`;
                }
            }

            html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function apriPopupScadenziario(ggFiltro, ggCestelli, ggPrefiltro) {
    const modal = document.getElementById("dosageModal");
    const contenuto = document.getElementById("dosageContent");
    if (!modal || !contenuto) return;

    let sFiltro = ggFiltro > 4 ? `🚨 SCADUTO (${ggFiltro} gg fa)` : (ggFiltro === 4 ? "⏳ Scade oggi" : `✅ OK (${ggFiltro} gg fa)`);
    let sCestelli = ggCestelli > 3 ? `🚨 SCADUTO (${ggCestelli} gg fa)` : (ggCestelli === 3 ? "⏳ Scade oggi" : `✅ OK (${ggCestelli} gg fa)`);
    let sPrefiltro = ggPrefiltro > 15 ? `🚨 SCADUTO (${ggPrefiltro} gg fa)` : (ggPrefiltro === 15 ? "⏳ Scade oggi" : `✅ OK (${ggPrefiltro} gg fa)`);

    let htmlPopup = `<h3 style="color:#b91c1c; margin-bottom: 5px;">📋 Registro Manutenzioni Frequenti</h3>`;
    htmlPopup += `<p style="font-size:0.9rem; margin-bottom:10px;">Scadenze impostate: Controlavaggio (4gg) | Cestelli (3gg) | Prefiltro (15gg)</p>`;
    htmlPopup += `<div style="margin-top:15px; margin-bottom:15px; font-size:1rem; border:1px solid #e2e8f0; border-radius:6px; background:#fff;">
        <table style="width:100%; border-collapse: collapse; text-align:left;">
            <tr style="border-bottom:1px solid #e2e8f0; background:#f8fafc;">
                <th style="padding:10px; font-size:0.85rem; color:#004085;">OPERAZIONE</th>
                <th style="padding:10px; font-size:0.85rem; color:#004085;">STATO ATTUALE</th>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px; font-weight:bold; color:#1e293b;">Controlavaggio</td>
                <td style="padding:10px; color:${ggFiltro > 4 ? '#ef4444' : '#0f172a'}; font-weight:bold;">${sFiltro}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px; font-weight:bold; color:#1e293b;">Pulizia cestelli</td>
                <td style="padding:10px; color:${ggCestelli > 3 ? '#ef4444' : '#0f172a'}; font-weight:bold;">${sCestelli}</td>
            </tr>
            <tr>
                <td style="padding:10px; font-weight:bold; color:#1e293b;">Pulizia prefiltro</td>
                <td style="padding:10px; color:${ggPrefiltro > 15 ? '#ef4444' : '#0f172a'}; font-weight:bold;">${sPrefiltro}</td>
            </tr>
        </table>
    </div>`;
    htmlPopup += `<p style="font-size:0.9rem; color:#475569;">Scrivi l'azione esatta nel foglio LibreOffice per azzerare il rispettivo allarme visivo.</p>`;

    contenuto.innerHTML = htmlPopup;
    modal.classList.remove("hidden");
}