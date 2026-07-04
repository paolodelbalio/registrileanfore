// === CONFIGURAZIONE URL (Legge i file CSV locali) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE 2026.csv?t=" + new Date().getTime()
};

// === LIMITI DI LEGGE (Per colorare le celle) ===
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
    
    // Inietta lo stile modificato per incollare l'intestazione perfettamente sotto il menu
    const style = document.createElement('style');
    style.innerHTML = `
        thead th {
            position: sticky !important;
            top: 10px; /* Valore calibrato per agganciarsi al millimetro sotto la barra dei pulsanti blu */
            background-color: #ebf3f9 !important; 
            z-index: 99 !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15); 
        }
    `;
    document.head.appendChild(style);

    let chimico = await loadFile(FILES.chimico, false);
    let contatori = await loadFile(FILES.contatori, true); 
    let pulizie = await loadFile(FILES.pulizie, false);
    let manutenzione = await loadFile(FILES.manutenzione, false);

    const chimicoClickable = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "n.ospiti"];
    const contatoriClickable = ["reintegro (l)", "ricircolo 24h (m³)"];

    buildTable("chimicoTable", chimico, chimicoClickable, (col) => showChart(col, chimico, "07:00"));
    buildTable("contatoriTable", contatori, contatoriClickable, (col) => showChart(col, contatori));
    buildTable("pulizieTable", pulizie, [], null);
    buildTable("manutenzioneTable", manutenzione, [], null);

    // Mostra il registro chimico all'avvio
    showRegister("chimicoSection");
})();

// === CARICAMENTO DATI CSV ===
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

        return Papa.parse(text, { 
            header: true, 
            skipEmptyLines: true,
            delimiter: "," 
        }).data;

    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return [];
    }
}

// === COSTRUZIONE TABELLE HTML ===
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
    let filtered = filterHour ? data.filter(r => r.Ora === filterHour) : data;
    
    if (filtered.length === 0) {
        filtered = data;
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

// === OVERLAY GRAFICO ===
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
            if (hasData) {
                lastFilledRowIndex = index;
            }
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

function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}