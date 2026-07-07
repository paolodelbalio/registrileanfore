let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

const VOL_PISCINA = 92; 

const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

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
                        analizzaUltimoDatoChimico();
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
            
            if (indiceRiga === 0 && chiave === 'chimico' && (indiceColonna === 1 || indiceColonna === 2 || indiceColonna === 3)) {
                let nomeParametro = cella.split("(")[0].trim();
                elCell.innerHTML = `${cella} <br><button class="table-th-btn" onclick="apriGrafico('${nomeParametro}', 'line')">📊 Grafico</button>`;
            } else if (indiceRiga === 0 && chiave === 'contatori' && indiceColonna === 2) {
                elCell.innerHTML = `${cella} <br><button class="table-th-btn" onclick="apriGrafico('Reintegro', 'bar')">📊 Grafico</button>`;
            } else {
                elCell.textContent = cella;
            }

            if (indiceRiga > 0 && chiave === 'chimico') {
                if (indiceColonna === 1) { 
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val === 7.3) ? "cell-green" : "cell-red";
                }
                if (indiceColonna === 2) { 
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val >= 1.1) ? "cell-green" : "cell-red";
                }
                if (indiceColonna === 3) { 
                    let val = parseFloat(cella.replace(",", "."));
                    elCell.className = (!isNaN(val) && val < 60) ? "cell-green" : "cell-red";
                }
            }
            
            tr.appendChild(elCell);
        });
        
        tabella.appendChild(tr);
    });
}

// LOGICA MODIFICATA: CORRE LUNGO TUTTO IL REGISTRO E SI FERMA ALLA PRIMA CELLA VUOTA TROVATA
function eseguiScorrimentoRegistro(sezioneId) {
    let tabellaId = "";
    let righeDati = [];
    
    if (sezioneId === 'chimicoSection') { tabellaId = "chimicoTable"; righeDati = datiRegistriGlobali.chimico; }
    else if (sezioneId === 'contatoriSection') { tabellaId = "contatoriTable"; righeDati = datiRegistriGlobali.contatori; }
    else if (sezioneId === 'pulizieSection') { tabellaId = "pulizieTable"; righeDati = datiRegistriGlobali.pulizie; }
    else if (sezioneId === 'manutenzioniSection') { tabellaId = "manutenzioniTable"; righeDati = datiRegistriGlobali.manutenzioni; }

    const tabella = document.getElementById(tabellaId);
    if (!tabella || !righeDati || righeDati.length === 0) return;

    const contenitoreSfondo = tabella.closest('.table-responsive');
    if (!contenitoreSfondo) return;

    let rigaTargetIndice = -1;

    // Scorre in avanti dall'inizio (riga 1) fino alla fine del calendario (30/09)
    for (let i = 1; i < righeDati.length; i++) {
        let rigaIncompleta = false;
        
        // Verifica se c'è almeno una cella vuota tra quelle destinate all'inserimento dei dati (dalla colonna 1 in poi)
        for (let j = 1; j < righeDati[i].length; j++) {
            let contenuto = righeDati[i][j];
            if (!contenuto || contenuto.toString().trim() === "") {
                rigaIncompleta = true;
                break;
            }
        }
        
        // Se trova una riga non compilata, imposta il target lì per mostrare lei e lo spazio sotto
        if (rigaIncompleta) {
            rigaTargetIndice = i;
            break;
        }
    }

    if (rigaTargetIndice === -1) {
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

// RIPRISTINATE TUTTE LE FUNZIONI LOGICHE DELL'ASSISTENTE CHIMICO
function analizzaUltimoDatoChimico() {
    let righe = datiRegistriGlobali.chimico;
    if (righe.length < 2) return;

    let ultimoPh = null, ultimoCloro = null, ultimoCya = null, dataRilevazione = "";

    for (let i = righe.length - 1; i >= 1; i--) {
        if (righe[i][1] && righe[i][1].trim() !== "" && ultimoPh === null) {
            ultimoPh = parseFloat(righe[i][1].replace(",", "."));
            dataRilevazione = righe[i][0];
        }
        if (righe[i][2] && righe[i][2].trim() !== "" && ultimoCloro === null) ultimoCloro = parseFloat(righe[i][2].replace(",", "."));
        if (righe[i][3] && righe[i][3].trim() !== "" && ultimoCya === null) ultimoCya = parseFloat(righe[i][3].replace(",", "."));
    }

    if (ultimoPh === null || ultimoCloro === null) return;

    let modal = document.getElementById("dosageModal");
    let content = document.getElementById("dosageContent");
    let testoDettaglio = `<h3>🤖 Assistente Trattamento Acqua</h3><p>Ultimo controllo registrato il: <strong>${dataRilevazione}</strong></p><br>`;

    let serveIntervento = false;

    if (ultimoPh > 7.3) {
        serveIntervento = true;
        let delta = ultimoPh - 7.3;
        let dosePhMeno = Math.round(delta * 10 * VOL_PISCINA * 10); 
        testoDettaglio += `<p>⚠️ <strong>pH Elevato (${ultimoPh.toFixed(1)}):</strong> Per abbassarlo al target ideale di <strong>7.3</strong>, immettere circa <strong>${dosePhMeno} grammi</strong> di pH- Meno granulare direttamente negli skimmer.</p><br>`;
    } else if (ultimoPh < 7.3) {
        serveIntervento = true;
        let delta = 7.3 - ultimoPh;
        let dosePhPlus = Math.round(delta * 10 * VOL_PISCINA * 10);
        testoDettaglio += `<p>⚠️ <strong>pH Basso (${ultimoPh.toFixed(1)}):</strong> Per alzarlo al target ideale di <strong>7.3</strong>, immettere circa <strong>${dosePhPlus} grammi</strong> di pH+ Plus granulare.</p><br>`;
    }

    if (ultimoCloro < 1.1) {
        serveIntervento = true;
        let deltaCl = 1.1 - ultimoCloro;
        let doseCloro = Math.round((deltaCl * VOL_PISCINA) / 0.65 * 1.4); 
        testoDettaglio += `<p>⚠️ <strong>Cloro Insufficiente (${ultimoCloro.toFixed(1)} ppm):</strong> Per raggiungere il target di sicurezza minimo di <strong>1.1 ppm</strong>, dosare circa <strong>${doseCloro} grammi</strong> di Ipoclorito di Calcio granulare.</p><br>`;
    }

    if (ultimoCya >= 60) {
        serveIntervento = true;
        testoDettaglio += `<p>🚨 <strong>ALLARME Stabilizzante (${ultimoCya} ppm):</strong> L'Acido Cianurico ha superato la soglia critica di 60 ppm. Sospendere trattamenti stabilizzati ed effettuare parziali svuotamenti e reintegri di acqua pulita.</p><br>`;
    }

    if (serveIntervento) {
        content.innerHTML = testoDettaglio;
        modal.classList.remove("hidden");
    }
}

function chiudiDosaggio() {
    document.getElementById('dosageModal').classList.add('hidden');
}

// RIPRISTINATO IL MOTORE DEI GRAFICI CON BENDE COLORATE DI SFONDO (FOTO 2/3)
function apriGrafico(parametro, tipoGrafico) {
    const overlay = document.getElementById('chartOverlay');
    overlay.classList.remove('hidden');
    document.getElementById('overlayTitle').textContent = `Andamento Storico: ${parametro}`;
    
    if (mioGrafico) { mioGrafico.destroy(); }
    
    let etichette = [];
    let valori = [];
    let opzioniScale = {};
    
    if (parametro === 'pH' || parametro === 'Cloro Libero' || parametro === 'Acido Cianurico') {
        let indiceCol = (parametro === 'pH') ? 1 : (parametro === 'Cloro Libero' ? 2 : 3);
        datiRegistriGlobali.chimico.forEach((r, idx) => {
            if (idx > 0 && r[0] && r[indiceCol] && r[indiceCol].trim() !== "") {
                etichette.push(r[0].split(" ")[0]);
                valori.push(parseFloat(r[indiceCol].replace(",", ".")));
            }
        });
        
        if (parametro === 'pH') opzioniScale = { y: { min: 6.8, max: 8.2 } };
        else if (parametro === 'Cloro Libero') opzioniScale = { y: { min: 0, max: 3.0 } };
        else if (parametro === 'Acido Cianurico') opzioniScale = { y: { min: 0, max: 120 } };
        
    } else if (parametro === 'Reintegro') {
        datiRegistriGlobali.contatori.forEach((r, idx) => {
            if (idx > 0 && r[0] && r[2] && r[2].trim() !== "") {
                etichette.push(r[0]);
                valori.push(parseFloat(r[2].replace(",", ".")));
            }
        });
        opzioniScale = { y: { beginAtZero: true, max: 20000, ticks: { stepSize: 500 } } };
    }
    
    const canvas = document.getElementById('overlayCanvas');
    
    const pluginSfondoFasce = {
        id: 'pluginSfondoFasce',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
            ctx.save();
            
            function disegnaBanda(yStart, yEnd, colore) {
                let pixelTop = y.getPixelForValue(yEnd);
                let pixelBottom = y.getPixelForValue(yStart);
                ctx.fillStyle = colore;
                ctx.fillRect(left, pixelTop, right - left, pixelBottom - pixelTop);
            }

            if (parametro === 'pH') {
                disegnaBanda(6.8, 7.2, 'rgba(239, 68, 68, 0.08)');  
                disegnaBanda(7.2, 7.4, 'rgba(16, 185, 129, 0.15)'); 
                disegnaBanda(7.4, 8.2, 'rgba(239, 68, 68, 0.08)');  
            } else if (parametro === 'Cloro Libero') {
                disegnaBanda(0, 1.1, 'rgba(239, 68, 68, 0.08)');   
                disegnaBanda(1.1, 1.5, 'rgba(16, 185, 129, 0.15)'); 
                disegnaBanda(1.5, 3.0, 'rgba(239, 68, 68, 0.08)');  
            } else if (parametro === 'Acido Cianurico') {
                disegnaBanda(0, 60, 'rgba(16, 185, 129, 0.15)');    
                disegnaBanda(60, 120, 'rgba(239, 68, 68, 0.1)');   
            }
            ctx.restore();
        }
    };

    let ctx = canvas.getContext('2d');
    setTimeout(() => {
        mioGrafico = new Chart(ctx, {
            type: tipoGrafico,
            data: {
                labels: etichette,
                datasets: [{
                    label: parametro,
                    data: valori,
                    borderColor: '#1e293b',
                    backgroundColor: tipoGrafico === 'bar' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(30, 41, 59, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.15
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: opzioniScale, plugins: { legend: { display: false } } },
            plugins: [pluginSfondoFasce]
        });
    }, 60);
}

function closeOverlay() {
    document.getElementById('chartOverlay').classList.add('hidden');
}