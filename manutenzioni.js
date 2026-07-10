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
        
        const mesi = {
            "gen": 0, "feb": 1, "mar": 2, "apr": 3, "mag": 4, "giu": 5,
            "lug": 6, "ago": 7, "set": 8, "ott": 9, "nov": 10, "dic": 11
        };

        let parti = dLower.split(/\s+/);
        let giorno = null;
        let mese = null;
        let anno = 2026;

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

        let partiSlash = dataStr.split("/");
        if (partiSlash.length === 3) {
            let a = partiSlash[2].length === 2 ? "20" + partiSlash[2] : partiSlash[2];
            return new Date(parseInt(a), parseInt(partiSlash[1]) - 1, parseInt(partiSlash[0]));
        }
        return null;
    }

    function elaboraManutenzioniProtetto(righeGrezze) {
        if (!righeGrezze || righeGrezze.length === 0) return;

        let indiceIntestazione = 0;
        for (let i = 0; i < righeGrezze.length; i++) {
            if (righeGrezze[i] && righeGrezze[i][0] && righeGrezze[i][0].toString().trim().toLowerCase().startsWith("data")) {
                indiceIntestazione = i;
                break;
            }
        }

        let intestazioni = righeGrezze[indiceIntestazione].map(h => h ? h.trim() : "");
        let righeDati = righeGrezze.slice(indiceIntestazione + 1);

        let righePulite = [];
        righeDati.forEach(riga => {
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

        // Aggiungiamo 3 righe vuote in fondo per dare spazio visivo
        if (righePulite.length > 0) {
            for (let r = 0; r < 3; r++) {
                let rigaFittizia = new Array(intestazioni.length).fill("");
                righePulite.push(rigaFittizia);
            }
        }

        costruisciTabellaManutenzioniProtetta(intestazioni, righePulite);
    }

  function costruisciTabellaManutenzioniProtetta(intestazioni, righe) {
    const tabella = document.getElementById("manutenzioniTable");
    if (!tabella) return;

    // Crea o recupera il contenitore per lo scorrimento verticale
    let wrapper = tabella.parentElement;
    if (!wrapper || !wrapper.classList.contains("manutenzioni-scroll-box")) {
        wrapper = document.createElement("div");
        wrapper.classList.add("manutenzioni-scroll-box");
        tabella.parentNode.insertBefore(wrapper, tabella);
        wrapper.appendChild(tabella);
    }

    // CREA UN CONTENITORE AUTOMATICO PER LO SCORRIMENTO
    let contenitore = tabella.parentElement;
    if (!contenitore.classList.contains("manutenzioni-scroll-box")) {
        contenitore = document.createElement("div");
        contenitore.classList.add("manutenzioni-scroll-box");
        tabella.parentNode.insertBefore(contenitore, tabella);
        contenitore.appendChild(tabella);
    }

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

            for (let i = 0; i < righe.length - 3; i++) { // Escludiamo le 3 righe fittizie finali dal calcolo delle date
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
            intestazioni.forEach((intestazione, colIdx) => {
                let valore = riga[colIdx] || "";
                let classeCella = "";
                let attributiAggiuntivi = "";

                // Applica l'allarme/pulsante solo sull'ultima delle 3 righe vuote
                if (colIdx === idxInterventoMan && rIdx === rigaPrimaVuotaIdx) {
                    let isScaduto = (giorniControlavaggio > 4 || giorniCestelli > 3 || giorniPrefiltro > 15);
                    let isAttenzione = (giorniControlavaggio === 4 || giorniCestelli === 3 || giorniPrefiltro === 15);

                    if (isScaduto) {
                        classeCella = "class='cell-alarm'";
                        valore = "🚨 SCADENZIARIO ATTIVO - CLICCA QUI";
                        attributiAggiuntivi = `onclick="window.apriPopupScadenziarioManutenzioni(${giorniControlavaggio}, ${giorniCestelli}, ${giorniPrefiltro})"`;
                    } else if (isAttenzione) {
                        classeCella = "class='cell-warning'";
                        valore = "⏳ SCADENZA OGGI - CLICCA QUI";
                        attributiAggiuntivi = `onclick="window.apriPopupScadenziarioManutenzioni(${giorniControlavaggio}, ${giorniCestelli}, ${giorniPrefiltro})"`;
                    } else {
                        classeCella = "style='background-color: rgba(40, 167, 69, 0.2); color: #155724; font-weight: bold; text-align: center;'";
                        valore = "✅ TUTTE LE MANUTENZIONI OK - CLICCA QUI";
                        attributiAggiuntivi = `onclick="window.apriPopupScadenziarioManutenzioni(${giorniControlavaggio}, ${giorniCestelli}, ${giorniPrefiltro})"`;
                    }
                }

                html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }

    window.apriPopupScadenziarioManutenzioni = function(ggFiltro, ggCestelli, ggPrefiltro) {
        const modal = document.getElementById("dosageModal");
        const contenuto = document.getElementById("dosageContent");
        if (!modal || !contenuto) return;

        let sFiltro = ggFiltro > 4 ? `🚨 SCADUTO (${ggFiltro} gg fa)` : (ggFiltro === 4 ? "⏳ Scade oggi" : `✅ OK (${ggFiltro} gg fa)`);
        let sCestelli = ggCestelli > 3 ? `🚨 SCADUTO (${ggCestelli} gg fa)` : (ggCestelli === 3 ? "⏳ Scade oggi" : `✅ OK (${ggCestelli} gg fa)`);
        let sPrefiltro = ggPrefiltro > 15 ? `🚨 SCADUTO (${ggPrefiltro} gg fa)` : (ggPrefiltro === 15 ? "⏳ Scade oggi" : `✅ OK (${ggPrefiltro} gg fa)`);

        let htmlPopup = `<h3 style="color:#b91c1c; margin-bottom: 5px; font-family:Arial;">📋 Registro Scadenze Manutenzioni</h3>`;
        htmlPopup += `<p style="font-size:0.85rem; margin-bottom:15px; color:#64748b;">Frequenze stabilite: Controlavaggio (4gg) | Cestelli (3gg) | Prefiltro (15gg)</p>`;
        htmlPopup += `<div style="margin-bottom:15px; border:1px solid #e2e8f0; border-radius:6px; background:#fff;">
            <table style="width:100%; border-collapse: collapse; text-align:left; font-family:Arial; font-size:0.95rem;">
                <tr style="border-bottom:1px solid #e2e8f0; background:#f8fafc;">
                    <th style="padding:10px; color:#0066cc;">OPERAZIONE</th>
                    <th style="padding:10px; color:#0066cc;">STATO ATTUALE</th>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:10px; font-weight:bold;">Controlavaggio</td>
                    <td style="padding:10px; color:${ggFiltro > 4 ? '#ef4444' : '#10b981'}; font-weight:bold;">${sFiltro}</td>
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
        htmlPopup += `<p style="font-size:0.85rem; color:#475569; font-style:italic;">Nota: Per azzerare un allarme, inserisci una nuova riga nel LibreOffice scrivendo esattamente "Controlavaggio", "Pulizia cestelli" o "Pulizia prefiltro" nella colonna Intervento.</p>`;

        contenuto.innerHTML = htmlPopup;
        modal.classList.remove("hidden");
    };
})();