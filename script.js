let currentChart = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // Volume vasca in m³

// Nomi precisi dei file su disco
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

// GESTIONE DELLA BARRA DI NAVIGAZIONE DINAMICA (SCOMPARE/RIPRARE)
let lastScrollTop = 0;
window.addEventListener("scroll", () => {
    const navbar = document.getElementById("navbar");
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 150) {
        navbar.classList.add("nav-hidden"); // Nasconde scendendo
    } else {
        navbar.classList.remove("nav-hidden"); // Mostra salendo
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
            let valore = riga[colIdx] || "";
            let classeCella = "";
            let attributiAggiuntivi = "";

            let hId = header.toLowerCase();
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

// STUDIO CHIMICO AVANZATO ED EVOLUTO DEI DOSAGGI (BASATO SU FOTO, METEO E BAGNANTI)
function apriFinestraDosaggio(parametro, valore, rigaIndice) {
    const modal = document.getElementById("dosageModal");
    const content = document.getElementById("dosageContent");
    let valNum = parseFloat(valore.replace(",", "."));
    let pId = parametro.toLowerCase();
    
    let chimico = datiRegistriGlobali.chimico;
    let headers = chimico ? chimico.headers : [];
    let rigaCorrente = (chimico && chimico.rows) ? chimico.rows[rigaIndice] : [];

    // Estrazione parametri di contesto ambientali
    let oraIdx = headers.findIndex(h => h.toLowerCase() === "ora");
    let tempIdx = headers.findIndex(h => h.toLowerCase() === "temp");
    let bagnantiIdx = headers.findIndex(h => h.toLowerCase() === "n.ospiti");

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : 25;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;

    let testoDettaglio = `<h3>⚠️ Diagnostica Avanzata Vasca: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore rilevato: <strong style="color:#ef4444; font-size:1.1rem;">${valore}</strong> (Target ideale: ${LEGAL_RANGES[pId]?.target || '-' })</p>`;
    testoDettaglio += `<p style="font-size:0.9rem; background:#f1f5f9; padding:8px; border-radius:4px; margin-bottom:15px;">
        Context Monitor: Rilevamento ore <strong>${oraRilevamento || 'N.D.'}</strong> | Temp. Acqua: <strong>${isNaN(tempVasca) ? '25' : tempVasca}°C</strong> | Presenza Bagnanti: <strong>${numBagnanti} ospiti</strong>
    </p>`;

    if (pId === "ph") {
        if (valNum > 7.5) {
            let delta = valNum - 7.3;
            let doseBase = delta * 10 * 10 * VOL_PISCINA; 
            if (tempVasca > 28) doseBase *= 1.15; // Correzione per acqua calda
            let doseKg = (doseBase / 1000).toFixed(2);
            testoDettaglio += `<p><strong>Diagnosi:</strong> Il pH elevato riduce l'efficacia disinfettante dell'ipoclorito di calcio, favorendo la precipitazione calcarea.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Versare negli skimmer <strong>${doseKg} Kg</strong> di <strong>Correttore pH Meno (Acido Secco)</strong>.</p>`;
        } else if (valNum < 6.5) {
            let delta = 7.3 - valNum;
            let doseBase = delta * 10 * 10 * VOL_PISCINA;
            let doseKg = (doseBase / 1000).toFixed(2);
            testoDettaglio += `<p><strong>Diagnosi:</strong> Acqua acida e corrosiva. Rischio di irritazioni e danni strutturali alle condutture e ai metalli.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Dosare in vasca <strong>${doseKg} Kg</strong> di <strong>Correttore pH Più (Carbonato di Sodio)</strong>.</p>`;
        }
    } else if (pId === "cl. lib") {
        if (valNum < 0.7) {
            let delta = 1.1 - valNum;
            let grammiIpoclorito = Math.round((delta / 0.65) * VOL_PISCINA);
            
            // Incremento predittivo per consumo accelerato
            if (tempVasca > 27) grammiIpoclorito = Math.round(grammiIpoclorito * 1.2);
            if (numBagnanti > 15) grammiIpoclorito = Math.round(grammiIpoclorito * 1.25);

            testoDettaglio += `<p><strong>Diagnosi:</strong> Copertura igienica insufficiente. Il sole e il carico organico attuale stanno consumando rapidamente il disinfettante.</p>`;
            
            if (oraRilevamento.startsWith("07") || oraRilevamento.startsWith("08")) {
                testoDettaglio += `<p style="color:#b56000; font-weight:600;">💡 Strategia Mattutina: Essendo inizio giornata, immettere subito il 40% della dose (${Math.round(grammiIpoclorito*0.4)}g) per non disturbare i bagnanti, e programmare il resto a impianto chiuso.</p>`;
            } else {
                testoDettaglio += `<p style="color:#10b981; font-weight:600;">🌙 Strategia Serale: Momento perfetto per il ripristino. Versare l'intera dose senza l'azione fotolitica del sole.</p>`;
            }
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Trattare con <strong>${grammiIpoclorito} grammi</strong> di <strong>Ipoclorito di Calcio granulare</strong> sciolto preventivamente.</p>`;
        } else if (valNum > 1.5) {
            testoDettaglio += `<p><strong>Diagnosi:</strong> Livello superiore alla norma. Balneazione temporaneamente non ottimale.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Arrestare l'apporto manuale di cloro. Sfruttare l'irraggiamento solare diurno e il ricircolo per abbattere naturalmente il valore prima della riapertura.</p>`;
        }
    } else if (pId === "cya") {
        if (valNum > 60.0) {
            let percentualeSvuotamento = Math.round(((valNum - 40) / valNum) * 100);
            let litriDaCambiare = Math.round((percentualeSvuotamento / 100) * VOL_PISCINA * 1000);
            testoDettaglio += `<p><strong>Diagnosi Eccezionale:</strong> Sovrastabilizzazione critica. L'eccesso di acido cianurico causa il blocco del cloro.</p>`;
            testoDettaglio += `<p><strong>Azione Strategica:</strong> È tassativo pianificare un ricambio parziale del <strong>${percentualeSvuotamento}%</strong> dell'acqua (pari a circa <strong>${litriDaCambiare.toLocaleString()} litri</strong>) attingendo da acqua di reintegro pulita.</p>`;
        }
    } else {
        testoDettaglio += `<p>Valore fuori intervallo standard. Monitorare attentamente l'evoluzione nelle prossime 12 ore.</p>`;
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
                backgroundColor: 'rgba(0, 102, 204, 0.08)',
                borderWidth: 2,
                tension: 0.15,
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