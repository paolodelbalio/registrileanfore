// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

const VOL_PISCINA = 92; // Volume vasca in m³

const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

// Carica tutti i file CSV
function caricaTuttiIRegistri() {
    Object.keys(REGISTRI_FILES).forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        Papa.parse(config.file, {
            download: true,
            header: false, 
            skipEmptyLines: true,
            complete: function(results) {
                let righeGrezze = results.data;
                if (!righeGrezze || righeGrezze.length === 0) return;
                
                let indiceHeader = 0;
                for (let i = 0; i < righeGrezze.length; i++) {
                    let celleSottoEsame = righeGrezze[i].map(v => v ? v.toLowerCase().trim() : "");
                    if (celleSottoEsame.includes("data")) {
                        indiceHeader = i;
                        break;
                    }
                }

                let headers = righeGrezze[indiceHeader].map(h => h ? h.trim() : "");
                let datiFiltrati = [];
                let ultimaDataValida = "";

                // Individua gli indici chiave per il controllo del blocco righe vuote
                let idxData = headers.findIndex(h => h.toLowerCase().trim() === 'data');
                let idxPH = headers.findIndex(h => h.toLowerCase().trim() === 'ph');
                let idxOra = headers.findIndex(h => h.toLowerCase().trim() === 'ora');
                
                // Indici per gli altri registri
                let idxContatore = headers.findIndex(h => h.toLowerCase().trim().includes('contatore'));
                let idxFiltri = headers.findIndex(h => h.toLowerCase().trim().includes('filtri') || h.toLowerCase().trim().includes('operazione'));
                let idxTipoIntervento = headers.findIndex(h => h.toLowerCase().trim().includes('intervento') || h.toLowerCase().trim().includes('tipo'));

                for (let i = indiceHeader + 1; i < righeGrezze.length; i++) {
                    let rigaCorrente = righeGrezze[i];
                    while(rigaCorrente.length < headers.length) rigaCorrente.push("");
                    
                    let valoriTrimmati = rigaCorrente.map(v => v ? v.trim() : "");
                    
                    // CONTROLLO BLOCCO RIGHE VUOTE PER TUTTI I REGISTRI
                    if (chiave === 'chimico' && idxPH !== -1 && idxOra !== -1) {
                        let oraCorrente = valoriTrimmati[idxOra];
                        let valorePH = valoriTrimmati[idxPH];
                        if (oraCorrente === "07:00" && (valorePH === "" || valorePH === undefined)) {
                            break; // Si ferma alla data di oggi
                        }
                    } 
                    else if (chiave === 'contatori' && idxContatore !== -1) {
                        if (valoriTrimmati[idxContatore] === "" || valoriTrimmati[idxContatore] === undefined) {
                            break; // Si ferma se il contatore è vuoto
                        }
                    }
                    else if (chiave === 'pulizie' && idxFiltri !== -1) {
                        if (valoriTrimmati[idxFiltri] === "" || valoriTrimmati[idxFiltri] === undefined) {
                            break; // Si ferma se la descrizione pulizia è vuota
                        }
                    }
                    else if (chiave === 'manutenzioni' && idxTipoIntervento !== -1) {
                        if (valoriTrimmati[idxTipoIntervento] === "" || valoriTrimmati[idxTipoIntervento] === undefined) {
                            break; // Si ferma se la descrizione intervento è vuota
                        }
                    }

                    // Salto di sicurezza se la riga è completamente priva di testo
                    let rigaUnita = valoriTrimmati.join('').replace(/,/g, '').trim();
                    if (rigaUnita === "") continue;

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
                
                if (chiave === 'chimico') {
                    setTimeout(() => scollaAdUltimaRiga('chimicoSection'), 300);
                }
            }
        });
    });
}

// Genera le tabelle nel browser
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
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => calcolaDosaggio('cl. com', valoreFloat);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'temp') {
                if (valoreFloat < 24.0 || valoreFloat > 30.0) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c";
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cya') {
                if (valoreFloat > 60) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => calcolaDosaggio('cya', valoreFloat);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
        });
    });
}

// LOGICA SCORRIMENTO: Trova l'ultima riga reale popolata e si ferma lasciando lo spazio visivo di due righe sotto
function scollaAdUltimaRiga(sezioneId) {
    const sezione = document.getElementById(sezioneId);
    if (!sezione) return;

    const tabella = sezione.querySelector('table');
    if (!tabella || tabella.rows.length <= 1) return;

    const righe = tabella.rows;
    const ultimaRiga = righe[righe.length - 1];
    
    const altezzaRiga = ultimaRiga.offsetHeight || 40; 
    const offsetTarget = (ultimaRiga.getBoundingClientRect().top + window.pageYOffset) - window.innerHeight + (altezzaRiga * 3);

    window.scrollTo({
        top: Math.max(0, offsetTarget),
        behavior: 'smooth'
    });
}

function calcolaDosaggio(parametro, valoreCorrente) {
    const modal = document.getElementById('dosageModal');
    const content = document.getElementById('dosageContent');
    let markup = "";

    if (parametro === 'ph') {
        if (valoreCorrente > 7.50) {
            let delta = valoreCorrente - 7.30; 
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000).toFixed(2);
            markup = `
                <h3>Consigli di Trattamento</h3>
                <p>Il valore del pH è alto (<strong>${valoreCorrente.toFixed(2).replace('.', ',')}</strong>).</p>
                <p>Per abbassarlo al valore ideale di 7,30 inserire:</p>
                <p>👉 <strong>${doseKg.replace('.', ',')} Kg</strong> di <strong>pH MINUS</strong>.</p>
            `;
        } else if (valoreCorrente < 7.20) {
            let delta = 7.30 - valoreCorrente;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000).toFixed(2);
            markup = `
                <h3>Consigli di Trattamento</h3>
                <p>Il valore del pH è basso (<strong>${valoreCorrente.toFixed(2).replace('.', ',')}</strong>).</p>
                <p>Per alzarlo al valore ideale di 7,30 inserire:</p>
                <p>👉 <strong>${doseKg.replace('.', ',')} Kg</strong> di <strong>pH PLUS</strong>.</p>
            `;
        }
    } 
    else if (parametro === 'cl. lib') {
        if (valoreCorrente < 0.70) {
            let delta = 1.10 - valoreCorrente; 
            let doseGrammi = delta * 1.5 * VOL_PISCINA;
            let doseKg = (doseGrammi / 1000).toFixed(2);
            markup = `
                <h3>Consigli di Trattamento</h3>
                <p>Il Cloro Libero è insufficiente (<strong>${valoreCorrente.toFixed(2).replace('.', ',')} ppm</strong>).</p>
                <p>Per raggiungere il target ottimale di 1,10 ppm aggiungere:</p>
                <p>👉 <strong>${doseGrammi.toFixed(0)} g</strong> (circa <strong>${doseKg.replace('.', ',')} Kg</strong>) di <strong>Ipoclorito di Calcio</strong> granulare.</p>
            `;
        } else if (valoreCorrente > 2.00) {
            markup = `
                <h3>Consigli di Trattamento</h3>
                <p>Il Cloro Libero è molto alto (<strong>${valoreCorrente.toFixed(2).replace('.', ',')} ppm</strong>).</p>
                <p>👉 Sospendere temporaneamente le immissioni di cloro e scoprire la vasca per farlo scendere con il sole.</p>
            `;
        }
    }
    else if (parametro === 'cl. com') {
        markup = `
            <h3>Consigli di Trattamento</h3>
            <p>Il Cloro Combinato è fuori limite (<strong>${valoreCorrente.toFixed(2).replace('.', ',')} ppm</strong>).</p>
            <p>👉 Effettuare un <strong>controlavaggio filtro approfondito</strong> associato ad un abbondante <strong>reintegro di acqua nuova</strong>.</p>
        `;
    }
    else if (parametro === 'cya') {
        markup = `
            <h3>Consigli di Trattamento</h3>
            <p>L'Acido Cianurico ha superato la soglia critica (<strong>${valoreCorrente.toFixed(0)} ppm</strong>).</p>
            <p>👉 Si raccomanda di effettuare uno <strong>scarico parziale dell'acqua della piscina (20-30%)</strong> ed eseguire un successivo reintegro con acqua fresca pulita.</p>
        `;
    }

    content.innerHTML = markup;
    modal.classList.remove('hidden');
}

function chiudiDosaggio() {
    document.getElementById('dosageModal').classList.add('hidden');
}

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

    if (mioGrafico) mioGrafico.destroy();

    let tipoGrafico = (cleanParam === 'n.ospiti' || cleanParam.includes('reintegro')) ? 'bar' : 'line';
    let opzioniScale = {
        x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } },
        y: { ticks: { font: { size: 10 } } }
    };

    if (cleanParam === 'ph') { opzioniScale.y.min = 6.5; opzioniScale.y.max = 8.5; }
    else if (['cl. lib', 'cl. tot'].includes(cleanParam)) { opzioniScale.y.min = 0.0; opzioniScale.y.max = 4.0; }
    else if (cleanParam === 'cl. com') { opzioniScale.y.min = 0.0; opzioniScale.y.max = 0.8; }
    else if (cleanParam === 'cya') { opzioniScale.y.min = 0; opzioniScale.y.max = 120; }
    else if (cleanParam === 'temp') { opzioniScale.y.min = 10; opzioniScale.y.max = 35; }

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
            } else if (['cl. lib', 'cl. tot'].includes(cleanParam)) {
                disegnaBanda(0.0, 0.7, 'rgba(239, 68, 68, 0.1)');   
                disegnaBanda(0.7, 2.0, 'rgba(16, 185, 129, 0.15)'); 
                disegnaBanda(2.0, 4.0, 'rgba(239, 68, 68, 0.1)');   
            } else if (cleanParam === 'cl. com') {
                disegnaBanda(0.0, 0.2, 'rgba(16, 185, 129, 0.15)');  
                disegnaBanda(0.2, 0.4, 'rgba(254, 240, 138, 0.25)'); 
                disegnaBanda(0.4, 0.8, 'rgba(239, 68, 68, 0.12)');   
            } else if (cleanParam === 'cya') {
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
                    backgroundColor: 'rgba(30, 41, 59, 0.1)',
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

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) {
        sez.classList.remove('hidden');
        setTimeout(() => scollaAdUltimaRiga(sezioneId), 100); 
    }
}

window.mostraSezione = mostraSezione;

window.onload = function() {
    caricaTuttiIRegistri();
    mostraSezione('chimicoSection');
};