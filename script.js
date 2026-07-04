// === CONFIGURAZIONE URL (Legge i file CSV locali) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE 2026.csv?t=" + new Date().getTime()
};

// === LIMITI DI LEGGE PER COLORE CELLE ===
const LEGAL_RANGES = {
    "ph": [6.5, 7.5],
    "cl. lib": [0.7, 1.5],
    "cl. com": [0.0, 0.4],
    "temp": [24.0, 30.0],
    "cya": [0.0, 75.0]
};

// === COLORI PERSONALIZZATI PER I GRAFICI ===
const CHART_COLORS = {
    "ph": { border: "#ff5722", background: "rgba(255, 87, 34, 0.2)" },
    "cl. lib": { border: "#00bcd4", background: "rgba(0, 188, 212, 0.2)" },
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
    const chimico = await loadFile(FILES.chimico, false);
    const contatori = await loadFile(FILES.contatori, true); // true = salta la riga del titolo iniziale "Registro Lettura Contatori"
    const pulizie = await loadFile(FILES.pulizie, false);
    const manutenzione = await loadFile(FILES.manutenzione, false);

    // Parametri abilitati a generare il grafico (controllati in minuscolo)
    const chimicoClickable = ["ph", "cl. lib", "cl. com", "temp", "cya", "n.ospiti"];
    const contatoriClickable = ["reintegro (l)", "ricircolo 24h (m³)"];

    buildTable("chimicoTable", chimico, chimicoClickable, (col) => showChart(col, chimico, "07:00"));
    buildTable("contatoriTable", contatori, contatoriClickable, (col) => showChart(col, contatori));
    buildTable("pulizieTable", pulizie, [], null);
    buildTable("manutenzioneTable", manutenzione, [], null);

    showRegister("chimicoSection");
})();

// === CARICAMENTO DATI CON PULIZIA DI SICUREZZA ===
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

        // Rimuove le righe vuote piene solo di virgole create da LibreOffice
        return parsed.filter(row => {
            const values = Object.values(row).join("").replace(/,/g, "").trim();
            return values.length > 0 && row["Data"] !== undefined;
        });

    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return [];
    }
}

// === COSTRUZIONE TABELLE HTML (VERSIONE AD ALTA COMPATIBILITÀ) ===
function buildTable(tableId, data, clickableColumns, onHeaderClick) {
    const table = document.getElementById(tableId);
    if (!table || data.length === 0) {
        table.innerHTML = "<tr><td>Nessun dato disponibile nel file CSV.</td></tr>";
        return;
    }

    const headers = Object.keys(data[0]);
    
    // 1. Creazione dell'Header (Testata)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    headers.forEach(h => {
        const th = document.createElement("th");
        th.innerText = h;
        const cleanHeader = h.trim().toLowerCase();
        
        // Se la colonna supporta i grafici, la trasformiamo visivamente e operativamente in pulsante
        if (clickableColumns.includes(cleanHeader)) {
            th.innerText += " 📊";
            th.style.cursor = "pointer";
            th.style.backgroundColor = "#e9f2fb";
            th.style.color = "#0066cc";
            th.style.textDecoration = "underline";
            th.title = "Clicca per visualizzare il grafico di andamento";
            
            // Assegnazione protetta del click nativo
            th.addEventListener("click", () => {
                if (onHeaderClick) onHeaderClick(h);
            });
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // 2. Creazione del Body (Righe del Registro)
    const tbody = document.createElement("tbody");
    data.forEach((row) => {
        const tr = document.createElement("tr");
        headers.forEach(h => {
            const td = document.createElement("td");
            td.innerText = row[h] || "";
            colorCell(td, h.trim().toLowerCase(), row[h]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // 3. Montaggio finale pulito sulla pagina
    table.innerHTML = "";
    table.appendChild(thead);
    table.appendChild(tbody);
}

// === COLORAZIONE CELLE (Verde/Rosso) ===
function colorCell(td, colName, rawValue) {
    if (!LEGAL_RANGES[colName] || !rawValue) return;
    
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
        if (!val) return null;
        const cleanVal = val.replace(/"/g, "").replace(",", ".").trim();
        return parseFloat(cleanVal);
    });

    if (values.some(v => !isNaN(v) && v !== null)) {
        showOverlayChart(colName, labels, values);
    } else {
        alert(`Impossibile generare il grafico: nessun dato numerico trovato nella colonna "${colName}".`);
    }
}

function showOverlayChart(title, labels, values) {
    document.getElementById("overlayTitle").innerText = "Andamento Parametro: " + title;
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