// === CONFIGURAZIONE URL (Legge i file CSV locali generati da Python nella stessa cartella) ===
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzione: "REGISTRO MANUTENZIONE 2026.csv?t=" + new Date().getTime()
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
            delimiter: ";" 
        }).data;
    } catch (e) {
        console.error("Errore nel caricamento file:", e);
        return [];
    }
}
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
    
    if (values.length > 0) showOverlayChart(colName, labels, values);
}