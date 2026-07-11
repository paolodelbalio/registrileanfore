let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [] };

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv"
};

// Inizializzazione globale
document.addEventListener("DOMContentLoaded", () => {
    Object.keys(FILE_REGISTRI).forEach(chiave => {
        Papa.parse(FILE_REGISTRI[chiave], {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (res) => {
                datiRegistriGlobali[chiave] = res.data;
                console.log(`Caricato: ${chiave}`);
                // Se è il chimico, disegna subito
                if(chiave === 'chimico') renderizzaChimico();
            }
        });
    });
});

// Funzione specifica per renderizzare il Chimico
function renderizzaChimico() {
    const table = document.getElementById("chimicoTable");
    const dati = datiRegistriGlobali.chimico;
    if(!table || dati.length === 0) return;

    let html = `<thead><tr>${Object.keys(dati[0]).map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${dati.map(row => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>`;
    table.innerHTML = html;
}