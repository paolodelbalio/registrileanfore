// === CONFIGURAZIONE URL (Legge i file CSV locali) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE INTERVENTI .csv?t=" + new Date().getTime()
};

// === CONFIGURAZIONE PARAMETRI PISCINA (92 mc e Prodotti) ===
const PISCINA_CONFIG = {
    volume: 92, // metri cubi della vasca
    target: {
        ph: 7.3,        // Valore ideale pH
        cloro: 1.2      // Valore ideale Cloro Libero (ppm)
    },
    prodotti: {
        phMeno: {
            nome: "pH Minor CTX Professional",
            dosePerCentesimo: 11.0 // 11g per abbassare di 0.01 unità il pH in 92mc
        },
        cloroCa: {
            nome: "Brenntag Chlore Pure Ca Granular (Ipoclorito di Calcio 70%)",
            dosePerPpm: 130 // ~130g per alzare di 1 ppm il cloro in 92mc
        },
        waterStop: {
            nome: "Water Stop Clor (Abbattitore)",
            dosePerPpm: 92 // 92g per abbassare di 1 ppm il cloro in 92mc
        }
    }
};

// === LIMITI DI LEGGE (Per colorare le celle della tabella) ===
const LEGAL_RANGES = {
    "ph": [6.5, 7.5],
    "cl. lib": [0.7, 1.5],
    "cl. tot": [0.7, 1.9],
    "cl. com": [0.0, 0.4],
    "temp": [24.0, 30.0],
    "cya": [0.0, 75.0]
};

// === COLORI PERSONALIZZATI PER I GRAFICI ===
const CHART_COLORS = {
    "ph": { border: "#ff5722", background: "rgba(255, 87, 34, 0.2)" },
    "cl. lib": { border: "#00bcd4", background: "rgba(0, 188, 212, 0.2)" },
    "cl. tot": { border: "#03a9f4", background: "rgba(3, 169, 244, 0.2)" },
    "cl. com": { border: "#9c27b0", background: "rgba(156, 39, 176, 0.2)" },
    "temp": { border: "#4caf50", background: "rgba(76, 175, 80, 0.2)" },
    "cya": { border: "#ff9800", background: "rgba(255, 152, 0, 0.2)" },
    "n.ospiti": { border: "#e91e63", background: "rgba(233, 30, 99, 0.2)" },
    "reintegro": { border: "#2196f3", background: "rgba(33, 150, 243, 0.2)" },
    "ricircolo": { border: "#3f51b5", background: "rgba(63, 81, 181, 0.2)" },
    "default": { border: "#0066cc", background: "rgba(0, 102, 204, 0.2)" }
};

let currentChart = null;

// === AVVIO AUTOMATICO ===
(async function init() {
    console.log("Caricamento dati in corso...");
    
    // Inietta lo stile per forzare l'ancoraggio delle intestazioni delle tabelle
    const style = document.createElement('style');
    style.innerHTML = `
        table { border-collapse: separate !important; }
        thead { position: relative; z-index: 99; }
        thead th {
            position: sticky !important;
            position: -webkit-sticky !important; 
            top: -5px !important;
            background-color: #ebf3f9 !important; 
            z-index: 99 !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15); 
        }
    `;
    document.head.appendChild(style);

    let chimico = await loadFile(FILES.chimico);
    let contatori = await loadFile(FILES.contatori); 
    let pulizie = await loadFile(FILES.pulizie);
    let manutenzione = await loadFile(FILES.manutenzione);

    // Controlli flessibili per l'attivazione dei pulsanti dei grafici
    const isChimicoClickable = (col) => ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "n.ospiti", "ospiti"].some(k => col.includes(k));
    const isContatoriClickable = (col) => ["reintegro", "ricircolo"].some(k => col.includes(k));

    buildTable("chimicoTable", chimico, isChimicoClickable, (col) => showChart(col, chimico, "07:00"));
    buildTable("contatoriTable", contatori, isContatoriClickable, (col) => showChart(col, contatori));
    buildTable("pulizieTable", pulizie, () => false, null);
    buildTable("manutenzioneTable", manutenzione, () => false, null);

    // Se ci sono dati validi nel registro chimico, calcola i consigli sull'ultima riga disponibile
    if (chimico && chimico.length > 0 && !chimico.error) {
        generaConsigliDosaggio(chimico[chimico.length - 1]);
    }

    // Mostra il registro chimico all'avvio
    showRegister("chimicoSection");
})();

// === CARICAMENTO E PARSING INTELLIGENTE DEL CSV ===
async function loadFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
        let text = await response.text();
        
        // Protezione contro file mancanti (se il server risponde con una pagina HTML/Errore)
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().toLowerCase().includes("<html")) {
            return { error: "File CSV non trovato sul server. Verifica che il nome del file sia identico e caricato correttamente." };
        }

        // Parsing iniziale in matrice di righe semplici
        let parsedRaw = Papa.parse(text, { 
            header: false, 
            skipEmptyLines: true,
            delimiter: "," 
        }).data;

        if (parsedRaw.length === 0) return [];

        // Ricerca intelligente della riga di intestazione reale
        let headerIndex = 0;
        for (let i = 0; i < parsedRaw.length; i++) {
            const rowCleaned = parsedRaw[i].map(cell => cell ? cell.trim().toLowerCase() : "");
            if (rowCleaned.includes("data") || rowCleaned.includes("ph") || rowCleaned.includes("intervento") || rowCleaned.includes("contatore")) {
                headerIndex = i;
                break;
            }
        }

        // Estrazione di chiavi e righe di dati
        const headers = parsedRaw[headerIndex].map(h => h ? h.trim() : "");
        const dataRows = parsedRaw.slice(headerIndex + 1);

        // Trasformazione in array di oggetti strutturati
        let finalData = dataRows.map(row => {
            let obj = {};
            headers.forEach((h, idx) => {
                if (h !== "") {
                    obj[h] = row[idx] !== undefined ? row[idx].trim() : "";
                }
            });
            return obj;
        });

        // Pulisce le righe interamente vuote
        return finalData.filter(row => {
            if (Object.keys(row).length === 0) return false;
            const totalContent = Object.values(row).join("").replace(/,/g, "").trim();
            return totalContent.length > 0;
        });

    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return { error: `Impossibile caricare il file (${e.message})` };
    }
}

// === COSTRUZIONE TABELLE HTML ===
function buildTable(tableId, data, checkClickable, onHeaderClick) {
    const table = document.getElementById(tableId);
    if (!table) return;

    if (data && data.error) {
        table.innerHTML = `<tr><td style='padding:25px; text-align:center; color:#d93025; font-weight:bold; background:#feeaea;'>⚠️ ${data.error}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        table.innerHTML = "<tr><td style='padding:20px; text-align:center;'>Nessun dato disponibile nel file CSV.</td></tr>";
        return;
    }

    const headers = Object.keys(data[0]);
    
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    headers.forEach(h => {
        const th = document.createElement("th");
        const cleanHeader = h.trim().toLowerCase();
        
        if (checkClickable(cleanHeader)) {
            const btn = document.createElement("button");
            btn.className = "table-th-btn";
            btn.innerText = h + " 📊";
            btn.title = "Clicca per visualizzare il grafico";
            
            btn.addEventListener("click", () => {
                if (onHeaderClick) onHeaderClick(h);
            });
            th.appendChild(btn);
        } else {
            th.innerText = h;
            th.style.padding = "12px 8px"; 
            th.style.fontWeight = "bold";
            th.style.color = "#333333";
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");
    data.forEach((row) => {
        const tr = document.createElement("tr");
        headers.forEach(h => {
            const td = document.createElement("td");
            const cleanHeader = h.trim().toLowerCase();
            let valText = row[h] ? row[h].trim() : "";

            if (valText !== "" && (cleanHeader.includes("cl. com") || cleanHeader.includes("cl. lib") || cleanHeader.includes("cl. tot") || cleanHeader === "ph")) {
                const numericValue = parseFloat(valText.replace(/"/g, "").replace(",", ".").trim());
                if (!isNaN(numericValue)) {
                    valText = numericValue.toFixed(2).replace(".", ",");
                }
            }

            td.innerText = valText;
            colorCell(td, cleanHeader, row[h]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.innerHTML = "";
    table.appendChild(thead);
    table.appendChild(tbody);
}

// === COLORAZIONE CELLE CONDIZIONALE ===
function colorCell(td, colName, rawValue) {
    if (!rawValue || rawValue.trim() === "") return;
    
    const matchingKey = Object.keys(LEGAL_RANGES).find(k => colName.includes(k));
    if (!matchingKey) return;

    const cleanValue = rawValue.replace(/"/g, "").replace(",", ".").trim();
    const value = parseFloat(cleanValue);
    if (isNaN(value)) return;
    
    const [min, max] = LEGAL_RANGES[matchingKey];
    if (value < min || value > max) {
        td.style.backgroundColor = "rgba(255, 0, 0, 0.35)";
        td.style.color = "#721c24";
    } else {
        td.style.backgroundColor = "rgba(0, 200, 0, 0.20)";
        td.style.color = "#155724";
    }
}

// === CALCOLO COEFFICIENTE TEMPERATURA PER DEGRADAZIONE CLORO ===
function getFattoreTemperatura(temp) {
    if (!temp || isNaN(temp)) return 1.0;
    if (temp <= 26) return 1.0;
    if (temp > 26 && temp <= 28) return 1.15; // +15% di dose
    if (temp > 28 && temp <= 30) return 1.30; // +30% di dose
    return 1.50; // Oltre i 30°C: +50% di dose necessaria
}

// === ASSISTENTE CHIMICO: GENERAZIONE DEI CONSIGLI DI DOSAGGIO ===
function generaConsigliDosaggio(ultimoDato) {
    const container = document.getElementById('assistente-chimico-container');
    if (!container) return;

    container.innerHTML = "";

    // Trova le chiavi corrette ignorando maiuscole/minuscole
    const keys = Object.keys(ultimoDato);
    const phKey = keys.find(k => k.toLowerCase().trim() === 'ph');
    const cloroKey = keys.find(k => k.toLowerCase().includes('cl. lib') || k.toLowerCase().includes('cloro lib'));
    const tempKey = keys.find(k => k.toLowerCase().includes('temp'));

    const phAttuale = phKey ? parseFloat(String(ultimoDato[phKey]).replace(',', '.')) : NaN;
    const cloroAttuale = cloroKey ? parseFloat(String(ultimoDato[cloroKey]).replace(',', '.')) : NaN;
    const tempAttuale = tempKey ? parseFloat(String(ultimoDato[tempKey]).replace(',', '.')) : NaN;

    if (isNaN(phAttuale) || isNaN(cloroAttuale)) {
        container.innerHTML = `<div class="avviso-assistente info">Inserisci i parametri dell'ultima lettura odierna per sbloccare i consigli sui prodotti chimici.</div>`;
        return;
    }

    let consigli = [];
    const fattoreTemp = getFattoreTemperatura(tempAttuale);

    // --- ANALISI PH ---
    if (phAttuale > 7.5) {
        const deltaPh = phAttuale - PISCINA_CONFIG.target.ph;
        const puntiCentesimi = Math.round(deltaPh * 100);
        const doseTotale = Math.round(puntiCentesimi * PISCINA_CONFIG.prodotti.phMeno.dosePerCentesimo);
        
        consigli.push({
            parametro: "pH",
            stato: `Alto (${phAttuale.toFixed(2)})`,
            azione: `Abbassare di ${deltaPh.toFixed(2)} unità per rientrare al valore ottimale di ${PISCINA_CONFIG.target.ph}`,
            prodotto: PISCINA_CONFIG.prodotti.phMeno.nome,
            quantita: `${(doseTotale / 1000).toFixed(2)} kg`,
            nota: "Sciogliere la polvere in un secchio d'acqua pulita e versare uniformemente in vasca davanti alle bocchette con filtrazione attiva."
        });
    }

    // --- ANALISI CLORO ---
    if (cloroAttuale < 0.7) {
        const deltaCloro = PISCINA_CONFIG.target.cloro - cloroAttuale;
        let doseBase = deltaCloro * PISCINA_CONFIG.prodotti.cloroCa.dosePerPpm;
        let doseCorretta = Math.round(doseBase * fattoreTemp);

        let notaTemp = "";
        if (fattoreTemp > 1.0) {
            notaTemp = ` (Incrementato del ${Math.round((fattoreTemp - 1) * 100)}% per compensare l'evaporazione causata dai ${tempAttuale}°C dell'acqua)`;
        }

        consigli.push({
            parametro: "Cloro Libero",
            stato: `Basso (${cloroAttuale.toFixed(2)} ppm)`,
            azione: `Aumentare di ${deltaCloro.toFixed(2)} ppm per raggiungere la quota ideale di ${PISCINA_CONFIG.target.cloro} ppm`,
            prodotto: PISCINA_CONFIG.prodotti.cloroCa.nome,
            quantita: `${doseCorretta} grammi`,
            nota: `Dosaggio rapido predittivo.${notaTemp} Aggiungere direttamente negli skimmer o premiscelare.`
        });
    } else if (cloroAttuale > 2.0) {
        const deltaCloro = cloroAttuale - 1.5;
        const doseTotale = Math.round(deltaCloro * PISCINA_CONFIG.prodotti.waterStop.dosePerPpm);

        consigli.push({
            parametro: "Cloro Libero",
            stato: `Alto (${cloroAttuale.toFixed(2)} ppm)`,
            azione: `Abbassare di ${deltaCloro.toFixed(2)} ppm per riportare l'acqua in equilibrio confortevole`,
            prodotto: PISCINA_CONFIG.prodotti.waterStop.nome,
            quantita: `${doseTotale} grammi`,
            nota: "Utilizzare solo se è necessario riaprire immediatamente la vasca agli ospiti, altrimenti l'azione del sole e dei raggi UV lo consumerà in modo naturale."
        });
    }

    // --- RENDERING INTERFACCIA GRAFICA ---
    if (consigli.length === 0) {
        container.innerHTML = `
            <div class="avviso-assistente successo">
                <strong>✨ Parametri Eccellenti!</strong> Tutti i valori dell'ultimo rilevamento sono perfettamente bilanciati per la cubatura di 92 m³. Non è richiesta alcuna correzione immediata.
            </div>`;
    } else {
        let htmlTabella = `
            <div class="card-assistente">
                <h3>🧪 Assistente di Dosaggio Intelligente (Volume Vasca: 92 m³)</h3>
                <p class="sottotitolo-assistente">Diagnosi in tempo reale calibrata sui prodotti commerciali in uso e compensazione termica attiva.</p>
                <div style="overflow-x: auto;">
                    <table class="tabella-consigli">
                        <thead>
                            <tr>
                                <th>Parametro</th>
                                <th>Diagnosi</th>
                                <th>Azione Suggerita</th>
                                <th>Prodotto Specifico</th>
                                <th>Quantità da Dosare</th>
                                <th>Modalità d'Uso</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        consigli.forEach(c => {
            htmlTabella += `
                <tr>
                    <td><strong>${c.parametro}</strong></td>
                    <td><span class="badge badge-pericolo">${c.stato}</span></td>
                    <td>${c.azione}</td>
                    <td><em>${c.prodotto}</em></td>
                    <td><span class="badge-dose">${c.quantita}</span></td>
                    <td class="nota-testo">${c.nota}</td>
                </tr>
            `;
        });

        htmlTabella += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = htmlTabella;
    }
}

// === VISUALIZZAZIONE GRAFICO COMPLETO ===
function showChart(colName, data, filterHour = null) {
    if (data.error || data.length === 0) return;

    let filtered = filterHour ? data.filter(r => r.Ora === filterHour) : data;
    if (filtered.length === 0) filtered = data;

    const dataKey = Object.keys(data[0]).find(k => k.toLowerCase().trim() === "data") || "Data";

    const labels = filtered.map(r => r[dataKey] || "");
    const values = filtered.map(r => {
        const val = r[colName];
        if (!val || val.trim() === "") return null;
        const cleanVal = val.replace(/"/g, "").replace(",", ".").trim();
        return parseFloat(cleanVal);
    });

    if (values.some(v => !isNaN(v) && v !== null)) {
        showOverlayChart(colName, labels, values);
    } else {
        alert(`Nessun dato numerico valido trovato nella colonna "${colName}".`);
    }
}

// === OVERLAY GRAFICO ===
function showOverlayChart(title, labels, values) {
    document.getElementById("overlayTitle").innerText = "Andamento: " + title;
    document.getElementById("chartOverlay").classList.remove("hidden");

    const ctx = document.getElementById("overlayCanvas").getContext("2d");
    if (currentChart) currentChart.destroy();

    const key = title.trim().toLowerCase();
    const colorKey = Object.keys(CHART_COLORS).find(k => key.includes(k)) || "default";
    const colors = CHART_COLORS[colorKey];

    let tipoGrafico = 'line';
    if (key.includes('reintegro') || key.includes('ricircolo') || key.includes('ospiti')) {
        tipoGrafico = 'bar';
    }

    currentChart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: values,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// === NAVIGAZIONE INTERFACCIA E INQUADRATURA AUTOMATICA ===
function showRegister(sectionId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    
    const activeSection = document.getElementById(sectionId);
    if (!activeSection) return;
    
    activeSection.classList.remove('hidden');

    const rows = activeSection.querySelectorAll('tbody tr');
    let targetRow = null;

    const today = new Date();
    const giorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
    const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    
    const stringaOggi = `${giorni[today.getDay()]} ${today.getDate()} ${mesi[today.getMonth()]} ${today.getFullYear()}`.toLowerCase();

    for (let row of rows) {
        const firstCellText = row.querySelector('td')?.innerText.toLowerCase().trim() || "";
        if (firstCellText.includes(stringaOggi)) {
            targetRow = row;
            break; 
        }
    }

    if (!targetRow) {
        let lastFilledRowIndex = -1;
        rows.forEach((row, index) => {
            const cells = Array.from(row.querySelectorAll('td'));
            const hasData = cells.slice(2).some(cell => cell.innerText.trim() !== "" && cell.innerText.trim() !== "0,00");
            if (hasData) lastFilledRowIndex = index;
        });
        
        if (lastFilledRowIndex !== -1 && rows[lastFilledRowIndex + 1]) {
            targetRow = rows[lastFilledRowIndex + 1];
        }
    }

    if (targetRow) {
        setTimeout(() => {
            targetRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 80);
    }
}

// === CHIUSURA OVERLAY ===
function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}