// === CONFIGURAZIONE URL (Legge i file CSV locali generati da Python con i nomi corretti) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE INTERVENTI .csv?t=" + new Date().getTime() // Corretto nome e spazio finale!
};

// === RANGE DI LEGALITÀ PER COLORAZIONE CELLE ===
const LEGAL_RANGES = {
    "Cloro Libero": [0.7, 1.5],
    "Cloro Combinato": [0, 0.4],
    "pH": [6.5, 7.5],
    "Temperatura": [24, 30]
};

// === CARICAMENTO DATI ===
async function loadFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
        const text = await response.text();
        return Papa.parse(text, { 
            header: true, 
            skipEmptyLines: true,
            delimiter: "," // Se LibreOffice esporta con virgola standard, altrimenti rimetti ";" 
        }).data;
    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return [];
    }
}

// === GENERATORE TABELLE ===
function buildTable(tableId, data, onColClick = null) {
    const table = document.getElementById(tableId);
    if (!table || !data || data.length === 0) return;
    
    table.innerHTML = "";
    const headers = Object.keys(data[0]);
    
    // Intestazione
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        if (onColClick && LEGAL_RANGES[h]) {
            th.style.cursor = "pointer";
            th.title = "Clicca per vedere il grafico";
            th.onclick = () => onColClick(h);
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Righe dati
    const tbody = document.createElement("tbody");
    data.forEach(row => {
        const tr = document.createElement("tr");
        headers.forEach(h => {
            const td = document.createElement("td");
            td.textContent = row[h] || "";
            colorCell(td, h, row[h] || "");
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

// === GESTIONE VISUALIZZAZIONE SEZIONI ===
function showRegister(sectionId) {
    document.querySelectorAll(".register-section").forEach(s => s.classList.add("hidden"));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.remove("hidden");
}

// === AVVIO PRINCIPALE ===
(async function init() {
    console.log("Caricamento dati in corso...");
    const chimico = await loadFile(FILES.chimico);
    const contatori = await loadFile(FILES.contatori);
    const pulizie = await loadFile(FILES.pulizie);
    const manutenzione = await loadFile(FILES.manutenzione);

    buildTable("chimicoTable", chimico, col => showChart(col, chimico, "07:00"));
    buildTable("contatoriTable", contatori, col => showChart(col, contatori));
    buildTable("pulizieTable", pulizie);
    buildTable("manutenzioneTable", manutenzione);

    showRegister("chimicoSection");
})();

// === FUNZIONI DI SUPPORTO (Colori e Grafici) ===
function colorCell(td, colName, rawValue) {
    if (!LEGAL_RANGES[colName]) return;
    const value = parseFloat(rawValue.replace(",", "."));
    if (isNaN(value)) return;
    const [min, max] = LEGAL_RANGES[colName];
    td.style.backgroundColor = (value < min || value > max) ? "rgba(255, 0, 0, 0.35)" : "rgba(0, 200, 0, 0.20)";
}

function showChart(colName, data, filterHour = null) {
    let filtered = filterHour ? data.filter(r => r.Ora === filterHour) : data;
    const labels = filtered.map(r => r.Data || "");
    const values = filtered.map(r => parseFloat(r[colName]?.replace(",", ".")) || null).filter(v => v !== null);
    
    if (values.length > 0 && typeof showOverlayChart === "function") {
        showOverlayChart(colName, labels, values);
    }
}