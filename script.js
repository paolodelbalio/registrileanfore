let currentChart = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // Volume vasca in m³

const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv"
};

const LEGAL_RANGES = {
    "ph": { min: 6.5, max: 7.5, target: 7.3 },
    "cl. lib": { min: 0.7, max: 1.5, target: 1.1 },
    "cl. com": { min: 0.0, max: 0.4 },
    "temp": { min: 24.0, max: 30.0 },
    "cya": { min: 0.0, max: 60.0 }
};

// GESTIONE DELLA BARRA DI NAVIGAZIONE DINAMICA
let lastScrollTop = 0;
window.addEventListener("scroll", () => {
    const navbar = document.getElementById("navbar");
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 150) {
        navbar.classList.add("nav-hidden");
    } else {
        navbar.classList.remove("nav-hidden");
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    Object.keys(FILES).forEach(chiave => {
        Papa.parse(FILES[chiave], {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(results) {
                elaboraDatiTabella(chiave, results.data);
            },
            error: function(err) {
                console.error("Errore nel file " + chiave + ":", err);
            }
        });
    });
}

function formattaValoreNumerico(valoreStringa) {
    if (!valoreStringa || valoreStringa.trim() === "") return "";
    let num = parseFloat(valoreStringa.replace(",", "."));
    if (isNaN(num)) return valoreStringa; 
    // Ritorna sempre il valore con esattamente 2 decimali e la virgola
    return num.toFixed(2).replace(".", ",");
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length === 0) return;

    let indiceIntestazione = -1;
    for (let i = 0; i < righeGrezze.length; i++) {
        let primaCella = (righeGrezze[i][0] || "").trim().toLowerCase();
        if (primaCella.startsWith("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    if (indiceIntestazione === -1) indiceIntestazione = 0;

    let intestazioni = righeGrezze[indiceIntestazione].map(h => h ? h.trim() : "");
    let righeDati = righeGrezze.slice(indiceIntestazione + 1);

    let righePulite = [];
    righeDati.forEach(riga => {
        let rigaVuota = riga.every(cella => !cella || cella.trim() === "");
        if (rigaVuota) return;
        righePulite.push(riga.map(cella => cella ? cella.replace(/\r?\n|\r/g, " ").trim() : ""));
    });

    if (chiave === "pulizie") {
        let ultimoIndiceValido = -1;
        for (let i = 0; i < righePulite.length; i++) {
            if (/[a-zA-Z]/.test(righePulite[i][2] || "")) ultimoIndiceValido = i;
        }
        if (ultimoIndiceValido !== -1) righePulite = righePulite.slice(0, ultimoIndiceValido + 1);
    }

    datiRegistriGlobali[chiave] = { headers: intestazioni, rows: righePulite };
    costruisciTabellaHTML(chiave, intestazioni, righePulite);
}

function costruisciTabellaHTML(chiave, intestazioni, righe) {
    const table = document.getElementById(chiave + "Table");
    if (!table) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => {
        let hLower = h.toLowerCase();
        let classeClick = ["ph", "cl. lib", "cl. com", "temp", "cya", "reintegro  (l)"].includes(hLower) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    righe.forEach((riga, rIdx) => {
        html += "<tr>";
        intestazioni.forEach((header, colIdx) => {
            let valoreRaw = riga[colIdx] || "";
            let hId = header.toLowerCase();
            
            // Applica la formattazione a due decimali per le colonne chimiche rilevanti
            let valore = ["ph", "cl. lib", "cl. com", "temp", "cya"].includes(hId) ? formattaValoreNumerico(valoreRaw) : valoreRaw;
            
            let classeCella = "";
            let attributiAggiuntivi = "";

            if (LEGAL_RANGES[hId]) {
                let num = parseFloat(valore.replace(",", "."));
                if (!isNaN(num)) {
                    let limiti = LEGAL_RANGES[hId];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                }
            }
            html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    table.innerHTML = html;
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sezione = document.getElementById(sezioneId);
    if (!sezione) return;
    
    sezione.classList.remove('hidden');
    let chiave = sezioneId.replace("Section", "");
    let dati = datiRegistriGlobali[chiave];
    if (!dati || !dati.rows || dati.rows.length === 0) return;

    let rigaTargetIndice = dati.rows.length - 1;
    if (chiave === "chimico" || chiave === "contatori" || chiave === "manutenzioni") {
        let colTarget = chiave === "chimico" ? 2 : 1;
        for (let i = dati.rows.length - 1; i >= 0; i--) {
            if (dati.rows[i][colTarget] && dati.rows[i][colTarget].trim() !== "" && dati.rows[i][colTarget].trim() !== "0") {
                rigaTargetIndice = i;
                break;
            }
        }
    }

    setTimeout(() => {
        const tabella = document.getElementById(chiave + "Table");
        if (tabella) {
            const righeTabella = tabella.querySelectorAll("tbody tr");
            if (righeTabella[rigaTargetIndice]) {
                righeTabella[rigaTargetIndice].scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, 80);
}

// STUDIO QUANTITATIVO DEI DOSAGGI (BASATO SU VALORE IDEALE, TEMPERATURA E BAGNANTI)
function apriFinestraDosaggio(parametro, valore, rigaIndice) {
    const modal = document.getElementById("dosageModal");
    const content = document.getElementById("dosageContent");
    let valNum = parseFloat(valore.replace(",", "."));
    let pId = parametro.toLowerCase();
    
    let chimico = datiRegistriGlobali.chimico;
    let headers = chimico ? chimico.headers : [];
    let rigaCorrente = (chimico && chimico.rows) ? chimico.rows[rigaIndice] : [];

    // Estrazione del contesto reale per lo studio dei consumi chimici
    let oraIdx = headers.findIndex(h => h.toLowerCase() === "ora");
    let tempIdx = headers.findIndex(h => h.toLowerCase() === "temp");
    let bagnantiIdx = headers.findIndex(h => h.toLowerCase() === "n.ospiti");

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : 25;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;

    if (isNaN(tempVasca)) tempVasca = 25;

    let testoDettaglio = `<h3>Diagnostica Dosaggio: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore inserito: <strong style="color:#721c24;">${valore}</strong> (Valore ideale: ${LEGAL_RANGES[pId]?.target || '-' })</p>`;
    testoDettaglio += `<p style="font-size:0.85rem; background:#eee; padding:6px; margin-bottom:12px;">
        Condizioni vasca: Rilevato ore ${oraRilevamento || 'N.D.'} | Temp: ${tempVasca}°C | Bagnanti registrati: ${numBagnanti}
    </p>`;

    if (pId === "ph") {
        if (valNum > 7.5) {
            let delta = valNum - 7.3;
            let doseBase = delta * 10 * 10 * VOL_PISCINA; 
            if (tempVasca > 28) doseBase *= 1.15; // Correzione del consumo per calore aumentato
            let doseKg = (doseBase / 1000).toFixed(2);
            testoDettaglio += `<p><strong>Analisi:</strong> Il pH alto inibisce l'azione disinfettante del cloro. La temperatura a ${tempVasca}°C accelera questo fenomeno.</p>`;
            testoDettaglio += `<p><strong>Quantità Prodotto:</strong> Aggiungere nello skimmer <strong>${doseKg.replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong>.</p>`;
        } else if (valNum < 6.5) {
            let delta = 7.3 - valNum;
            let doseBase = delta * 10 * 10 * VOL_PISCINA;
            let doseKg = (doseBase / 1000).toFixed(2);
            testoDettaglio += `<p><strong>Analisi:</strong> Acqua aggressiva. Rischio corrosione metalli e irritazioni cutanee.</p>`;
            testoDettaglio += `<p><strong>Quantità Prodotto:</strong> Immettere in vasca <strong>${doseKg.replace(".", ",")} Kg</strong> di <strong>pH Più (Carbonato di Sodio)</strong>.</p>`;
        }
    } else if (pId === "cl. lib") {
        if (valNum < 0.7) {
            let delta = 1.1 - valNum;
            // Formula base per l'ipoclorito di calcio al 65%
            let grammiIpoclorito = Math.round((delta / 0.65) * VOL_PISCINA);
            
            // Studio correttivo avanzato basato su Sole, Calore e Affluenza
            if (tempVasca > 27) {
                grammiIpoclorito = Math.round(grammiIpoclorito * 1.20); // +20% per evaporazione termica
            }
            if (numBagnanti > 12) {
                grammiIpoclorito = Math.round(grammiIpoclorito * 1.25); // +25% per abbattimento organico
            }

            testoDettaglio += `<p><strong>Analisi:</strong> Mancanza di cloro libero. Con ${numBagnanti} bagnanti e un'acqua a ${tempVasca}°C, la proliferazione batterica è accelerata.</p>`;
            
            if (oraRilevamento.startsWith("07") || oraRilevamento.startsWith("08")) {
                testoDettaglio += `<p style="color:#856404; font-weight:bold;">⚠️ Strategia Mattutina: Per non sovraccaricare la vasca durante l'uso diurno, inserire subito il 40% (${Math.round(grammiIpoclorito*0.4)}g) e completare il trattamento la sera.</p>`;
            } else {
                testoDettaglio += `<p style="color:#155724; font-weight:bold;">🌙 Strategia Serale: Trattamento ottimale. L'assenza di sole eviterà la fotolisi del prodotto chimico.</p>`;
            }
            testoDettaglio += `<p><strong>Quantità Prodotto:</strong> Sciogliere ed immettere <strong>${grammiIpoclorito} grammi</strong> di <strong>Ipoclorito di Calcio granulare</strong>.</p>`;
        } else if (valNum > 1.5) {
            testoDettaglio += `<p><strong>Analisi:</strong> Livello superiore ai parametri ottimali.</p>`;
            testoDettaglio += `<p><strong>Strategia consigliata:</strong> Bloccare momentaneamente i reintegri di cloro. Lasciare che il sole e l'aerazione degradino naturalmente l'eccesso.</p>`;
        }
    } else if (pId === "cya") {
        if (valNum > 60.0) {
            let percentualeSvuotamento = Math.round(((valNum - 40) / valNum) * 100);
            let litriDaCambiare = Math.round((percentualeSvuotamento / 100) * VOL_PISCINA * 1000);
            testoDettaglio += `<p><strong>Analisi Critica:</strong> Livello di acido cianurico fuori controllo (${valNum} ppm). Il cloro è completamente bloccato dal legame stabilizzante.</p>`;
            testoDettaglio += `<p><strong>Azione Tassativa:</strong> È necessario rigenerare la massa d'acqua eseguendo un ricambio parziale del <strong>${percentualeSvuotamento}%</strong> (pari a circa <strong>${litriDaCambiary.toLocaleString()} litri</strong> di acqua nuova).</p>`;
        }
    } else {
        testoDettaglio += `<p>Valore fuori norma. Tenere monitorato nelle prossime ore.</p>`;
    }

    content.innerHTML = testoDettaglio;
    modal.classList.remove("hidden");
}

function chiudiDosaggio() {
    document.getElementById("dosageModal").classList.add("hidden");
}

function gestisciClickIntestazione(chiave, parametro) {
    let dati = datiRegistriGlobali[chiave];
    if (!dati) return;

    let colIdx = dati.headers.indexOf(parametro);
    if (colIdx === -1) return;

    let etichette = [];
    let valori = [];

    dati.rows.forEach(riga => {
        let dataOra = (riga[0] || "") + " " + (riga[1] || "");
        let valStr = riga[colIdx] || "";
        let valNum = parseFloat(valStr.replace(",", "."));

        if (!isNaN(valNum)) {
            etichette.push(dataOra.trim());
            valori.push(valNum);
        }
    });

    if (valori.length === 0) return;

    document.getElementById("overlayTitle").innerText = "Andamento Storico: " + parametro;
    document.getElementById("chartOverlay").classList.remove("hidden");

    const ctx = document.getElementById("overlayCanvas").getContext("2d");
    if (currentChart) { currentChart.destroy(); }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etichette,
            datasets: [{
                label: parametro,
                data: valori,
                borderColor: '#0066cc',
                backgroundColor: 'rgba(0, 102, 204, 0.05)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } }
        }
    });
}

function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (currentChart) { currentChart.destroy(); currentChart = null; }
}