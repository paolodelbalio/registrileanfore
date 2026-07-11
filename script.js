let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [] };

const VOL_PISCINA = 92;
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv"
};

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    Object.keys(FILE_REGISTRI).forEach(chiave => {
        Papa.parse(FILE_REGISTRI[chiave], {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                elaboraDatiTabella(chiave, risultati.data);
            }
        });
    });
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length < 2) return;
    let intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
    let datiFormattati = righeGrezze.slice(1).map(riga => {
        let obj = {};
        intestazioni.forEach((h, i) => obj[h] = riga[i] ? riga[i].trim() : "");
        return obj;
    });
    datiRegistriGlobali[chiave] = datiFormattati;
    
    if (chiave === 'chimico') {
        creaTabellaChimica(intestazioni, datiFormattati);
    }
}

function creaTabellaChimica(intestazioni, dati) {
    const tabella = document.getElementById("chimicoTable");
    if (!tabella) return;
    
    let html = "<thead><tr>";
    intestazioni.forEach(h => html += `<th>${h}</th>`);
    html += "</tr></thead><tbody>";
    
    dati.forEach(riga => {
        html += "<tr>";
        intestazioni.forEach(h => html += `<td>${riga[h] || ""}</td>`);
        html += "</tr>";
    });
    html += "</tbody>";
    tabella.innerHTML = html;
}