// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

const VOL_PISCINA = 92; // Volume fisso della vasca in metri cubi

// Mappatura file CSV con i nomi dei file precisi su GitHub
const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

// === CARICAMENTO INTEGRALE CSV E FILTRAGGIO RIGHE VUOTE ===
function caricaTuttiIRegistri() {
    Object.keys(REGISTRI_FILES).forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        Papa.parse(config.file, {
            download: true,
            header: false, // Leggiamo come array puro per ripulire intestazioni descrittive extra
            skipEmptyLines: true,
            complete: function(results) {
                let righeGrezze = results.data;
                if (!righeGrezze || righeGrezze.length === 0) return;
                
                // 1. Trova la riga delle intestazioni effettive (salta titoli decorativi in cima)
                let indiceHeader = 0;
                for (let i = 0; i < righeGrezze.length; i++) {
                    let uniti = righeGrezze[i].map(v => v ? v.toLowerCase().trim() : "");
                    if (uniti.includes("data") && (uniti.includes("ora") || uniti.includes("intervento") || uniti.includes("reintegro"))) {
                        indiceHeader = i;
                        break;
                    }
                }

                let headers = righeGrezze[indiceHeader].map(h => h ? h.trim() : "");
                let datiFiltrati = [];
                let ultimaDataValida = "";

                // 2. Processa le righe dei dati reali sotto la riga di intestazione trovato
                for (let i = indiceHeader + 1; i < righeGrezze.length; i++) {
                    let rigaCorrente = righeGrezze[i];
                    let valoriTrimmati = rigaCorrente.map(v => v ? v.trim() : "");
                    
                    // Se la riga è completamente vuota o contiene solo celle vuote, saltala
                    if (valoriTrimmati.every(v => v === "" || v === "0")) continue;

                    // Costruiamo l'oggetto riga associando l'intestazione corretta
                    let objRiga = {};
                    headers.forEach((h, idx) => {
                        if (h) objRiga[h] = rigaCorrente[idx] ? rigaCorrente[idx].trim() : "";
                    });

                    let dataCorrente = objRiga["Data"] ? objRiga["Data"].trim() : "";
                    if (dataCorrente !== "") {
                        ultimaDataValida = dataCorrente;
                    } else if (dataCorrente === "" && objRiga["Ora"] && objRiga["Ora"].trim() === "21:00") {
                        objRiga["Data"] = ultimaDataValida; 
                    }

                    datiFiltrati.push(objRiga);
                }
                
                datiRegistriGlobali[chiave] = datiFiltrati;
                popolaTabellaHtml(datiFiltrati, config.tableId, chiave, headers);
            },
            error: function(err) {
                console.error("Errore caricamento per il file:", config.file, err);
            }
        });
    });
}

// === GENERAZIONE DELLE TABELLE HTML E COLORAZIONE LOGICA SOGLIE ===
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
            
            // Logica colorazione parametri e attivazione click dosaggi su celle rosse
            if (cleanKey === 'ph') {
                if (valoreFloat > 7.50 || valoreFloat < 7.20) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => calcolaDosaggio('ph', valoreFloat);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. lib') {
                if (valoreFloat < 0.70 || valoreFloat > 2.00) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => calcolaDosaggio('cl. lib', valoreFloat);
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

// === CALCOLO AUTOMATICO DOSI CONSIGLIATE PRODOTTI ===
function calcolaDosaggio(parametro, valoreCorrente) {
    const modal = document.getElementById('dosageModal');
    const content = document.getElementById('dosageContent');
    let testoDose = "";

    if (parametro === 'ph') {
        if (valoreCorrente > 7.50) {
            let delta = valoreCorrente - 7.30; 
            // Regola standard indicativa: ~10g di pH- per m3 per abbassare di 0.1 unità
            let doseGrammi = delta * 10 * 10 * VOL_PISCINA;
            let doseKg = (doseGrammi / 1000).toFixed(2);
            testoDose = `
                <p>Il valore di <strong>pH misura ${valoreCorrente.toFixed(2).replace('.', ',')}</strong> ed è superiore al limite massimo consigliato (7,50).</p>
                <p style="margin: 15px 0; font-size: 1.1rem;">🎯 Obiettivo target: <strong>7,30</strong></p>
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; font-weight: bold; font-size: 1.1rem; color: #b91c1c;">
                    Aggiungere circa ${doseKg.replace('.', ',')} Kg di pH MINUS (Acido Secco)
                </div>
                <p style="margin-top: 10px; font-size: 0.85rem; color: #555;"><em>Versare il prodotto lentamente nello skimmer o diluito in un secchio d'acqua davanti alle bocchette di mandata con la pompa in funzione.</em></p>
            `;
        } else if (valoreCorrente < 7.20) {
            let delta = 7.30 - valoreCorrente;
            let doseGrammi = delta * 10 * 10 * VOL_PISCINA;
            let doseKg = (doseGrammi / 1000).toFixed(2);
            testoDose = `
                <p>Il valore di <strong>pH misura ${valoreCorrente.toFixed(2).replace('.', ',')}</strong> ed è inferiore al limite minimo consentito (7,20).</p>
                <p style="margin: 15px 0; font-size: 1.1rem;">🎯 Obiettivo target: <strong>7,30</strong></p>
                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; font-weight: bold; font-size: 1.1rem; color: #1d4ed8;">
                    Aggiungere circa ${doseKg.replace('.', ',')} Kg di pH PLUS (Incrementatore)
                </div>
            `;
        }
    } 
    else if (parametro === 'cl. lib') {
        if (valoreCorrente < 0.70) {
            let delta = 1.10 - valoreCorrente; // Target ottimale fisso stabilito a 1.1 ppm
            // Utilizzando Ipoclorito di Calcio granulare al 65-70%: servono ~1.5g per m3 per alzare di 1 ppm
            let doseGrammi = delta * 1.5 * VOL_PISCINA;
            let doseKg = (doseGrammi / 1000).toFixed(2);
            testoDose = `
                <p>Il valore di <strong>Cloro Libero misura ${valoreCorrente.toFixed(2).replace('.', ',')} ppm</strong> ed è troppo basso rispetto alle normative di sicurezza (minimo 0,70 ppm).</p>
                <p style="margin: 15px 0; font-size: 1.1rem;">🎯 Obiettivo target ottimale: <strong>1,10 ppm</strong></p>
                <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 12px; border-radius: 4px; font-weight: bold; font-size: 1.1rem; color: #b45309;">
                    Aggiungere circa ${doseGrammi.toFixed(0)} grammi (${doseKg.replace('.', ',')} Kg) di IPOCLORITO DI CALCIO granulare
                </div>
                <p style="margin-top: 10px; font-size: 0.85rem; color: #555;"><em>Sciogliere preventivamente il prodotto in acqua tiepida prima di inserirlo per evitare depositi sul fondo del PVC.</em></p>
            `;
        } else if (valoreCorrente > 2.00) {
            testoDose = `
                <p>Il valore di <strong>Cloro Libero misura ${valoreCorrente.toFixed(2).replace('.', ',')} ppm</strong> ed è superiore alla soglia di balneabilità (massimo 2,00 ppm).</p>
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-weight: bold; color: #78350f; margin-top: 15px;">
                    Sospendere temporaneamente i dosaggi di cloro e attendere il consumo naturale guidato dai raggi UV del sole. Lasciare scoperta la piscina.
                </div>
            `;
        }
    }

    content.innerHTML = testoDose;
    modal.classList.remove('hidden');
}

function chiudiDosaggio() {
    document.getElementById('dosageModal').classList.add('hidden');
}

// === GENERAZIONE DEI GRAFICI STORICI CON SOGLIE E FASCE COLORATE ===
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