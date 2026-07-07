// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: []
}; 

const VOL_PISCINA = 92; // Volume vasca in m³

const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" }
};

// Avvia il caricamento quando la pagina è pronta
document.addEventListener("DOMContentLoaded", function() {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    let conteggioCaricati = 0;
    const chiavi = Object.keys(REGISTRI_FILES);

    chiavi.forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        Papa.parse(config.file, {
            download: true,
            header: false, 
            skipEmptyLines: true,
            complete: function(results) {
                let righeGrezze = results.data;
                if (!righeGrezze || righeGrezze.length === 0) return;
                
                datiRegistriGlobali[chiave] = righeGrezze;
                generaTabellaHTML(chiave, righeGrezze, config.tableId);
                
                conteggioCaricati++;
                if (conteggioCaricati === chiavi.length) {
                    setTimeout(() => {
                        eseguiScorrimentoRegistro('chimicoSection');
                    }, 400);
                }
            }
        });
    });
}

function generaTabellaHTML(chiave, righe, tableId) {
    const tabella = document.getElementById(tableId);
    if (!tabella) return;
    
    tabella.innerHTML = "";
    
    righe.forEach((riga, indiceRiga) => {
        const tr = document.createElement("tr");
        
        riga.forEach((cella, indiceColonna) => {
            const elCell = (indiceRiga === 0) ? document.createElement("th") : document.createElement("td");
            
            // Bottoni grafici nelle intestazioni
            if (indiceRiga === 0 && chiave === 'chimico' && (indiceColonna === 1 || indiceColonna === 2 || indiceColonna === 3)) {
                let nomeParametro = cella.split("(")[0].trim();
                elCell.innerHTML = `${cella} <br><button class="table-th-btn" onclick="apriGrafico('${nomeParametro}', 'line')">📊 Grafico</button>`;
            } else if (indiceRiga === 0 && chiave === 'contatori' && indiceColonna === 2) {
                elCell.innerHTML = `${cella} <br><button class="table-th-btn" onclick="apriGrafico('Reintegro', 'bar')">📊 Grafico</button>`;
            } else {
                elCell.textContent = cella;
            }

            // Colorazione celle parametri Chimici (Target precisi)
            if (indiceRiga > 0 && chiave === 'chimico') {
                if (indiceColonna === 1) { // pH
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val === 7.3) ? "cell-green" : "cell-red";
                }
                if (indiceColonna === 2) { // Cloro Libero
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val >= 1.1) ? "cell-green" : "cell-red";
                }
                if (indiceColonna === 3) { // Acido Cianurico
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val < 60) ? "cell-green" : "cell-red";
                }
            }
            
            tr.appendChild(elCell);
        });
        
        tabella.appendChild(tr);
    });
}

// LOGICA DI SCROLLING FINO ALL'ULTIMA RIGA EFFETTIVAMENTE MODIFICATA
function eseguiScorrimentoRegistro(sezioneId) {
    let tabellaId = "";
    let righeDati = [];
    
    if (sezioneId === 'chimicoSection') {
        tabellaId = "chimicoTable";
        righeDati = datiRegistriGlobali.chimico;
    } else if (sezioneId === 'contatoriSection') {
        tabellaId = "contatoriTable";
        righeDati = datiRegistriGlobali.contatori;
    } else if (sezioneId === 'pulizieSection') {
        tabellaId = "pulizieTable";
        righeDati = datiRegistriGlobali.pulizie;
    }

    const tabella = document.getElementById(tabellaId);
    if (!tabella || !righeDati || righeDati.length === 0) return;

    const contenitoreSfondo = tabella.closest('.table-responsive');
    if (!contenitoreSfondo) return;

    let rigaTargetIndice = -1;

    // Scansiona dal basso verso l'alto cercandola prima riga compilata (esclusa la colonna data alla posizione 0)
    for (let i = righeDati.length - 1; i >= 1; i--) {
        let rigaModificata = false;
        
        for (let j = 1; j < righeDati[i].length; j++) {
            let contenutoCella = righeDati[i][j];
            if (contenutoCella && contenutoCella.toString().trim() !== "") {
                rigaModificata = true;
                break;
            }
        }
        
        if (rigaModificata) {
            rigaTargetIndice = i + 2; // Mostra le 2 righe vuote sotto l'ultima modifica!
            break;
        }
    }

    // Se non trova alcuna riga compilata, si posiziona in alto
    if (rigaTargetIndice === -1) {
        rigaTargetIndice = 1;
    }

    // Limita l'indice al numero massimo di righe per evitare errori
    if (rigaTargetIndice >= tabella.rows.length) {
        rigaTargetIndice = tabella.rows.length - 1;
    }

    if (rigaTargetIndice > 0 && tabella.rows[rigaTargetIndice]) {
        const rigaElemento = tabella.rows[rigaTargetIndice];
        contenitoreSfondo.scrollTop = rigaElemento.offsetTop - tabella.rows[0].offsetHeight;
    }
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sezioneSelezionata = document.getElementById(sezioneId);
    if (sezioneSelezionata) {
        sezioneSelezionata.classList.remove('hidden');
        setTimeout(() => {
            eseguiScorrimentoRegistro(sezioneId);
        }, 60);
    }
}

function chiudiDosaggio() {
    document.getElementById('dosageModal').classList.add('hidden');
}

function closeOverlay() {
    document.getElementById('chartOverlay').classList.add('hidden');
}

function apriGrafico(parametro, tipoGrafico) {
    const overlay = document.getElementById('chartOverlay');
    overlay.classList.remove('hidden');
    document.getElementById('overlayTitle').textContent = `Andamento Storico: ${parametro}`;
    
    if (mioGrafico) {
        mioGrafico.destroy();
    }
    
    let etichette = [];
    let valori = [];
    let opzioniScale = {};
    
    if (parametro === 'pH' || parametro === 'Cloro Libero' || parametro === 'Acido Cianurico') {
        let indiceCol = (parametro === 'pH') ? 1 : (parametro === 'Cloro Libero' ? 2 : 3);
        datiRegistriGlobali.chimico.forEach((r, idx) => {
            if (idx > 0 && r[0] && r[indiceCol]) {
                etichette.push(r[0].split(" ")[0]);
                valori.push(parseFloat(r[indiceCol].replace(",", ".")));
            }
        });
        
        if (parametro === 'pH') opzioniScale = { y: { min: 6.8, max: 8.2 } };
        else if (parametro === 'Cloro Libero') opzioniScale = { y: { min: 0, max: 3.0 } };
        else if (parametro === 'Acido Cianurico') opzioniScale = { y: { min: 0, max: 100 } };
        
    } else if (parametro === 'Reintegro') {
        datiRegistriGlobali.contatori.forEach((r, idx) => {
            if (idx > 0 && r[0] && r[2]) {
                etichette.push(r[0]);
                valori.push(parseFloat(r[2].replace(",", ".")));
            }
        });
        opzioniScale = { y: { beginAtZero: true, max: 20000, ticks: { stepSize: 500 } } };
    }
    
    const canvas = document.getElementById('overlayCanvas');
    let ctx = canvas.getContext('2d');
    
    mioGrafico = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: etichette,
            datasets: [{
                label: parametro,
                data: valori,
                borderColor: '#0066cc',
                backgroundColor: tipoGrafico === 'bar' ? 'rgba(0, 102, 204, 0.5)' : 'rgba(0, 102, 204, 0.1)',
                borderWidth: 2,
                tension: 0.15
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: opzioniScale 
        }
    });
}