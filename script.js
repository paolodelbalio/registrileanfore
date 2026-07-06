// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

// Mappatura file CSV con i nomi dei file
const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

// === CARICAMENTO INTEGRALE CSV ===
function caricaTuttiIRegistri() {
    Object.keys(REGISTRI_FILES).forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        Papa.parse(config.file, {
            download: true,
            header: true, 
            skipEmptyLines: true,
            complete: function(results) {
                let datiLetti = results.data;
                if (!datiLetti || datiLetti.length === 0) return;
                
                let datiTrasformati = [];
                let ultimaDataValida = "";

                datiLetti.forEach(riga => {
                    let valori = Object.values(riga).map(v => v ? v.trim() : "");
                    if (valori.every(v => v === "")) return;

                    let dataCorrente = riga["Data"] ? riga["Data"].trim() : "";
                    if (dataCorrente !== "") {
                        ultimaDataValida = dataCorrente;
                    } else if (dataCorrente === "" && riga["Ora"] && riga["Ora"].trim() === "21:00") {
                        riga["Data"] = ultimaDataValida; 
                    }

                    datiTrasformati.push(riga);
                });
                
                datiRegistriGlobali[chiave] = datiTrasformati;
                
                // CORREZIONE CRASH: Trova la prima riga valida del CSV per estrarre le intestazioni corrette
                let rigaValida PerHeaders = datiLetti.find(riga => {
                    let valori = Object.values(riga).map(v => v ? v.trim() : "");
                    return !valori.every(v => v === "");
                }) || datiLetti[0];

                let headers = Object.keys(rigaValidaPerHeaders).map(h => h ? h.trim() : "");
                popolaTabellaHtml(datiTrasformati, config.tableId, chiave, headers);
            },
            error: function(err) {
                console.error("Errore caricamento per il file:", config.file, err);
            }
        });
    });
}

// === GENERAZIONE DELLE TABELLE HTML ===
function popolaTabellaHtml(dati, tableId, tipoRegistro, headers) {
    const table = document.getElementById(tableId);
    if (!table || !dati || dati.length === 0) return;
    table.innerHTML = "";

    let thead = table.createTHead();
    let rowHead = thead.insertRow();
    
    headers.forEach(key => {
        if (!key) return;
        let th = document.createElement("th");
        let cleanKey = key.toLowerCase().trim();
        
        let daGraficare = false;
        if (tipoRegistro === 'chimico' && ['ph', 'cl. lib', 'cl. tot', 'cl. com', 'temp', 'n.ospiti', 'cya'].includes(cleanKey)) {
            daGraficare = true;
        } else if (tipoRegistro === 'contatori' && (cleanKey.includes('reintegro') || cleanKey.includes('ricircolo'))) {
            daGraficare = true;
        }

        if (daGraficare) {
            th.innerHTML = `<button class="table-th-btn" onclick="apriGrafico('${key}', '${tipoRegistro}')">${key} 📊</button>`;
        } else {
            th.innerText = key;
        }
        rowHead.appendChild(th);
    });

    let tbody = table.createTBody();
    dati.forEach(riga => {
        let row = tbody.insertRow();
        headers.forEach(key => {
            if (!key) return;
            let cell = row.insertCell();
            let valoreTesto = riga[key] ? riga[key].trim() : "";
            let cleanKey = key.toLowerCase().trim();
            let valoreFloat = parseFloat(valoreTesto.replace(',', '.'));

            if (!isNaN(valoreFloat) && ['ph', 'cl. lib', 'cl. tot', 'cl. com', 'temp', 'cya'].includes(cleanKey)) {
                cell.innerText = valoreFloat.toFixed(2).replace('.', ',');
            } else {
                cell.innerText = valoreTesto;
            }

            if (isNaN(valoreFloat) || valoreTesto === "" || tipoRegistro !== 'chimico') return;
            
            if (cleanKey === 'ph') {
                if (valoreFloat > 7.50 || valoreFloat < 7.20) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. lib') {
                if (valoreFloat < 0.70 || valoreFloat > 2.00) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. tot') {
                if (valoreFloat > 2.40 || valoreFloat < 0.90) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. com') {
                if (valoreFloat > 0.40) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'temp') {
                if (valoreFloat < 24.0 || valoreFloat > 30.0) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cya') {
                if (valoreFloat > 60) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
        });
    });
}

// === GENERAZIONE DEI GRAFICI STORICI ===
function apriGrafico(parametro, tipoRegistro) {
    if (!tipoRegistro) tipoRegistro = 'chimico';
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');

    title.innerText = `Andamento Storico Parametro: ${parametro}`;
    overlay.classList.remove('hidden');

    let etichette = [];
    let valori = [];
    let cleanParam = parametro.toLowerCase().trim(); 
    let datiDaUsare = datiRegistriGlobali[tipoRegistro] || [];

    datiDaUsare.forEach(riga => {
        let dataStr = riga["Data"] || riga["data"] || "";
        let oraStr = riga["Ora"] || riga["ora"] || "";
        
        let chiaveTrovata = Object.keys(riga).find(k => k.toLowerCase().trim() === cleanParam);
        let valStr = chiaveTrovata ? riga[chiaveTrovata] : "";
        
        if (valStr !== "" && valStr !== undefined) {
            let valFloat = parseFloat(String(valStr).replace(',', '.'));
            if (!isNaN(valFloat)) {
                etichette.push(`${dataStr} ${oraStr}`.trim());
                valori.push(valFloat);
            }
        }
    });

    if (mioGrafico) {
        mioGrafico.destroy();
    }

    let tipoGrafico = 'line';
    if (cleanParam === 'n.ospiti' || cleanParam.includes('reintegro')) {
        tipoGrafico = 'bar';
    }

    let opzioniScale = {
        x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } },
        y: { ticks: { font: { size: 10 } } }
    };

    if (cleanParam === 'ph') {
        opzioniScale.y.min = 6.5; opzioniScale.y.max = 8.5;
    } else if (['cl. lib', 'cl. tot'].includes(cleanParam)) {
        opzioniScale.y.min = 0.0; opzioniScale.y.max = 4.0;
    } else if (cleanParam === 'cl. com') { 
        opzioniScale.y.min = 0.0; opzioniScale.y.max = 0.8; 
    } else if (cleanParam === 'cya') {
        opzioniScale.y.min = 0; opzioniScale.y.max = 120;
    } else if (cleanParam === 'temp') {
        opzioniScale.y.min = 10; opzioniScale.y.max = 35;
    }

    const pluginSfondoFasce = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
            ctx.save();

            function disegnaBanda(yMin, yMax, colore) {
                let pixelTop = y.getPixelForValue(yMax);
                let pixelBottom = y.getPixelForValue(yMin);
                pixelTop = Math.max(pixelTop, top);
                pixelBottom = Math.min(pixelBottom, bottom);
                if (pixelTop < pixelBottom) {
                    ctx.fillStyle = colore;
                    ctx.fillRect(left, pixelTop, right - left, pixelBottom - pixelTop);
                }
            }

            if (cleanParam === 'ph') {
                disegnaBanda(6.5, 7.2, 'rgba(239, 68, 68, 0.1)');   
                disegnaBanda(7.2, 7.5, 'rgba(16, 185, 129, 0.15)'); 
                disegnaBanda(7.5, 8.5, 'rgba(239, 68, 68, 0.1)');   
            } 
            else if (['cl. lib', 'cl. tot'].includes(cleanParam)) {
                disegnaBanda(0.0, 0.7, 'rgba(239, 68, 68, 0.1)');   
                disegnaBanda(0.7, 2.0, 'rgba(16, 185, 129, 0.15)'); 
                disegnaBanda(2.0, 4.0, 'rgba(239, 68, 68, 0.1)');   
            } 
            else if (cleanParam === 'cl. com') {
                disegnaBanda(0.0, 0.2, 'rgba(16, 185, 129, 0.15)');  
                disegnaBanda(0.2, 0.4, 'rgba(254, 240, 138, 0.25)'); 
                disegnaBanda(0.4, 0.8, 'rgba(239, 68, 68, 0.12)');   
            }
            else if (cleanParam === 'cya') {
                disegnaBanda(0, 60, 'rgba(16, 185, 129, 0.15)');
                disegnaBanda(60, 120, 'rgba(239, 68, 68, 0.1)');
            }
            ctx.restore();
        }
    };

    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setTimeout(() => {
        mioGrafico = new Chart(ctx, {
            type: tipoGrafico,
            data: {
                labels: etichette,
                datasets: [{
                    label: parametro,
                    data: valori,
                    borderColor: '#1e293b',
                    backgroundColor: 'rgba(30, 41, 59, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,         
                    pointHoverRadius: 6,      
                    tension: 0.15             
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: opzioniScale,
                plugins: { legend: { display: false } }
            },
            plugins: [pluginSfondoFasce]
        });
    }, 60);
}

function closeOverlay() {
    const overlay = document.getElementById('chartOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) sez.classList.remove('hidden');
}

window.mostraSezione = mostraSezione;

window.onload = function() {
    caricaTuttiIRegistri();
    mostraSezione('chimicoSection');
};