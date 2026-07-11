let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92;
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE.csv"
};

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    let conteggioCaricamenti = 0;
    let chiavi = Object.keys(FILE_REGISTRI);

    chiavi.forEach(chiave => {
        Papa.parse(FILE_REGISTRI[chiave], {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                elaboraDatiTabella(chiave, risultati.data);
                conteggioCaricamenti++;
                if (conteggioCaricamenti === chiavi.length) {
                    setTimeout(scrollAllUltimaRiga, 300);
                }
            }
        });
    });
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length < 2) return;
    let intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
    let datiFormattati = [];
    for (let i = 1; i < righeGrezze.length; i++) {
        let rigaCorrente = righeGrezze[i];
        let oggettoRiga = {};
        intestazioni.forEach((intestazione, indice) => {
            oggettoRiga[intestazione] = rigaCorrente[indice] ? rigaCorrente[indice].trim() : "";
        });
        datiFormattati.push(oggettoRiga);
    }
    datiRegistriGlobali[chiave] = datiFormattati;

    if (chiave === 'chimico') creaTabellaChimica(intestazioni, datiFormattati);
    else if (chiave === 'manutenzioni') popolaTabellaManutenzioni(datiFormattati);
    else creaTabellaStandard(chiave, intestazioni, datiFormattati);
}

// === FUNZIONI PER CHIMICO E CALCOLI ===
function ottieniClasseColore(parametro, v) { /* ... (inserisci qui la tua funzione originale) ... */ }
function creaTabellaChimica(intestazioni, dati) { /* ... (inserisci qui la tua funzione originale) ... */ }
function apriConsiglioDettagliato(parametro, valore, dataOra, classeColore, rigaCriptata) { /* ... (inserisci qui la tua funzione originale) ... */ }
function apriGraficoChimico(chiave, nome, colore, tipo) { /* ... (inserisci qui la tua funzione originale) ... */ }
function scrollAllUltimaRiga() { /* ... (inserisci qui la tua funzione originale) ... */ }

// === FUNZIONI MANUTENZIONE ===
function popolaTabellaManutenzioni(dati) {
    const body = document.getElementById('manutenzioni-body');
    if (!body) return;
    body.innerHTML = dati.map(row => `<tr><td>${row.Data || ''}</td><td>${row['Impianto/Area'] || ''}</td><td>${row.Intervento || ''}</td><td>${row.Tecnico || ''}</td><td>${row.Note || ''}</td></tr>`).join('');
}