// === CONFIGURAZIONE URL (Legge i file CSV locali) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE 2026.csv?t=" + new Date().getTime()
};

// === LIMITI DI LEGGE ESTRATTI E CORRETTI (Per colorare le celle) ===
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
    "reintegro (l)": { border: "#2196f3", background: "rgba(33, 150, 243, 0.2)" },
    "ricircolo 24h (m³)": { border: "#3f51b5", background: "rgba(63, 81, 181, 0.2)" },
    "default": { border: "#0066cc", background: "rgba(0, 102, 204, 0.2)" }
};

let currentChart = null;

// === AVVIO AUTOMATICO ===
(async function init() {
    console.log("Caricamento dati in corso...");
    let chimico = await loadFile(FILES.chimico, false);
    let contatori = await loadFile(FILES.contatori, true); 
    let pulizie = await loadFile(FILES.pulizie, false);
    let manutenzione = await loadFile(FILES.manutenzione, false);

    // INVERSIONE: Mostra prima le righe più recenti (solo se contengono dati reali)
    if (chimico.length > 0) chimico.reverse();
    if (contatori.length > 0) contatori.reverse();
    if (pulizie.length > 0) pulizie.reverse();
    if (manutenzione.length > 0) manutenzione.reverse();

    const chimicoClickable = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "n.ospiti"];
    const contatoriClickable = ["reintegro (l)", "ricircolo 24h (m³)"];

    buildTable("chimicoTable", chimico, chimicoClickable, (col) => showChart(col, chimico, "07:00"));
    buildTable("contatoriTable", contatori, contatoriClickable, (col) => showChart(col, contatori));
    buildTable("pulizieTable", pulizie, [], null);
    buildTable("manutenzioneTable", manutenzione, [], null);

    showRegister("chimicoSection");
})();

// === CARICAMENTO DATI CON RIGIDA PULIZIA DELLE RIGHE VUOTE ===
async function loadFile(url, skipFirstLine) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
        let text = await response.text();
        
        if (skipFirstLine) {
            const lines = text.split(/\r?\n/);
            lines.shift();
            text = lines.join("\n");
        }

        const parsed = Papa.parse(text, { 
            header: true, 
            skipEmptyLines: true,
            delimiter: "," 
        }).data;

        // FILTRO AVANZATO: Rimuove le righe che non hanno una data valida o sono composte solo da virgole
        return parsed.filter(row => {
            if (!row["Data"] || row["Data"].trim() === "") return false;
            
            // Unisce tutti i valori della riga per verificare se c'è del testo reale inserito
            const allValues = Object.values(row).join("").replace(/,/g, "").replace(/"/g, "").trim();
            return allValues.length > 0;
        });

    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return [];
    }
}

// === COSTRUZIONE TABELLE HTML INTERE ===
function buildTable(tableId, data, clickableColumns, onHeaderClick) {
    const table = document.getElementById(tableId);
    if (!table || data.length === 0) {
        table.innerHTML = "<tr><td>Nessun dato disponibile nel file CSV.</td></tr>";
        return;
    }

    const headers = Object.keys(data[0]);
    
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    headers.forEach(h => {
        const th = document.createElement("th");
        const cleanHeader = h.trim().toLowerCase();
        
        if (clickableColumns.includes(cleanHeader)) {
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

            // FORMATTAZIONE DECIMALI: Applica i 2 decimali solo se la cella contiene effettivamente un valore
            if (valText !== "" && (cleanHeader === "cl. com" || cleanHeader === "cl. lib" || cleanHeader === "cl. tot" || cleanHeader === "ph")) {
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
    if (!LEGAL_RANGES[colName] || !rawValue || rawValue.trim() === "") return;
    
    const cleanValue = rawValue.replace(/"/g, "").replace(",", ".").trim();
    const value = parseFloat(cleanValue);
    if (isNaN(value)) return;
    
    const [min, max] = LEGAL_RANGES[colName];
    if (value < min || value > max) {
        td.style.backgroundColor = "rgba(255, 0, 0, 0.35)";
        td.style.color = "#721c24";
    } else {
        td.style.backgroundColor = "rgba(0, 200, 0, 0.20)";
        td.style.color = "#155724";
    }
}

// === VISUALIZZAZIONE GRAFICO COMPLETO ===
function showChart(colName, data, filterHour = null) {
    let chartData = [...data].reverse();
    let filtered = filterHour ? chartData.filter(r => r.Ora === filterHour) : chartData;
    
    if (filtered.length === 0) {
        filtered = chartData;
    }

    const labels = filtered.map(r => r.Data || "");
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

function showOverlayChart(title, labels, values) {
    document.getElementById("overlayTitle").innerText = "Andamento: " + title;
    document.getElementById("chartOverlay").classList.remove("hidden");

    const ctx = document.getElementById("overlayCanvas").getContext("2d");

    if (currentChart) {
        currentChart.destroy();
    }

    const key = title.trim().toLowerCase();
    const colors = CHART_COLORS[key] || CHART_COLORS["default"];

    currentChart = new Chart(ctx, {
        type: 'line',
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
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

// === NAVIGAZIONE INTERFACCIA ===
function showRegister(sectionId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}