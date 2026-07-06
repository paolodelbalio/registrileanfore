// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

const VOL_PISCINA = 92; // Volume vasca in m³

// Mappatura esatta file CSV
const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

// === CARICAMENTO INTEGRALE CSV CON SUPPORTO RIGHE PRE-HEADER RIGIDE ===
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
                
                // Individua l'intestazione esatta pulendo i metadati descrittivi iniziali di LibreOffice
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

                // Estrai i dati reali posizionati sotto l'intestazione scoperta
                for (let i = indiceHeader + 1; i < righeGrezze.length; i++) {
                    let rigaCorrente = righeGrezze[i];
                    
                    // Allinea la riga alla lunghezza corretta delle intestazioni
                    while(rigaCorrente.length < headers.length) {
                        rigaCorrente.push("");
                    }
                    
                    let valoriTrimmati = rigaCorrente.map(v => v ? v.trim() : "");
                    if (valoriTrimmati.every(v => v === "" || v === "0")) continue;

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
                console.error("Errore caricamento file:", config.file, err);
            }
        });
    });
}

// === GENERAZIONE DELLE TABELLE HTML E INTERATTIVITÀ SULLE SOGLIE ===
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
            
            // Logica Colorazione e Interattività click
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

// === AGGIORNATO: ASSISTENTE DOSAGGI INTERATTIVO CON STILE AVANZATO DI IERI ===
function calcolaDosaggio(parametro, valoreCorrente) {
    const modal = document.getElementById('dosageModal');
    const content = document.getElementById('dosageContent');
    let markup = "";

    if (parametro === 'ph') {
        if (valoreCorrente > 7.50) {
            let delta = valoreCorrente - 7.30; 
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000).toFixed(2);
            markup = `
                <div class="dosage-title">Correzione Valore pH</div>
                <div class="dosage-badge">VALORE ALTO: ${valoreCorrente.toFixed(2).replace('.', ',')}</div>
                <p>Il pH rilevato è fuori norma. Per stabilizzare l'acqua e ottimizzare l'azione del cloro libero, è necessario abbassarlo al valore target ideale.</p>
                <div class="dosage-box-alert">
                    <p style="margin:0; font-size:0.9rem; color:#475569;">Dose consigliata per ${VOL_PISCINA} m³ (Target 7,30):</p>
                    <div class="dosage-value-highlight">${doseKg.replace('.', ',')} Kg</div>
                    <p style="margin:5px 0 0 0; color:#b91c1c; font-weight:600;">di pH MINUS (Correttore Acido Secco)</p>
                </div>
                <p style="font-size:0.85rem; color:#64748b;"><em>Versare il prodotto lentamente negli skimmer o diluirlo preventivamente in un secchio d'acqua distribuendolo uniformemente davanti alle bocchette di mandata.</em></p>
            `;
        } else if (valoreCorrente < 7.20) {
            let delta = 7.30 - valoreCorrente;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000).toFixed(2);
            markup = `
                <div class="dosage-title">Correzione Valore pH</div>
                <div class="dosage-badge" style="background-color:#dbeafe; color:#1e40af;">VALORE BASSO: ${valoreCorrente.toFixed(2).replace('.', ',')}</div>
                <p>Il pH della vasca è troppo basso, rischiando di corrodere le parti metalliche o irritare la pelle.</p>
                <div class="dosage-box-alert" style="background-color:#eff6ff; border-left-color:#3b82f6;">
                    <p style="margin:0; font-size:0.9rem; color:#475569;">Dose consigliata per ${VOL_PISCINA} m³ (Target 7,30):</p>
                    <div class="dosage-value-highlight" style="color:#2563eb;">${doseKg.replace('.', ',')} Kg</div>
                    <p style="margin:5px 0 0 0; color:#1e40af; font-weight:600;">di pH PLUS (Incrementatore Alcalino)</p>
                </div>
            `;
        }
    } 
    else if (parametro === 'cl. lib') {
        if (valoreCorrente < 0.70) {
            let delta = 1.10 - valoreCorrente; 
            let doseGrammi = delta * 1.5 * VOL_PISCINA;
            let doseKg = (doseGrammi / 1000).toFixed(2);
            markup = `
                <div class="dosage-title">Integrazione Cloro Libero</div>
                <div class="dosage-badge" style="background-color:#fef3c7; color:#92400e;">LIVELLO INSUFFICIENTE: ${valoreCorrente.toFixed(2).replace('.', ',')} ppm</div>
                <p>Il livello di disinfettante attivo è sceso sotto la soglia di sicurezza normativa. È necessario un ripristino immediato.</p>
                <div class="dosage-box-alert" style="background-color:#fffbeb; border-left-color:#f59e0b;">
                    <p style="margin:0; font-size:0.9rem; color:#475569;">Dose per ${VOL_PISCINA} m³ per raggiungere il target ottimale (1,10 ppm):</p>
                    <div class="dosage-value-highlight" style="color:#d97706;">${doseGrammi.toFixed(0)} g (${doseKg.replace('.', ',')} Kg)</div>
                    <p style="margin:5px 0 0 0; color:#92400e; font-weight:600;">di IPOCLORITO DI CALCIO granulare</p>
                </div>
                <p style="font-size:0.85rem; color:#64748b;"><em>Nota: Si utilizza esclusivamente ipoclorito di calcio puro per non incrementare ulteriormente l'acido cianurico stabilizzante.</em></p>
            `;
        } else if (valoreCorrente > 2.00) {
            markup = `
                <div class="dosage-title">Eccesso Cloro Libero</div>
                <div class="dosage-badge">VALORE ELEVATO: ${valoreCorrente.toFixed(2).replace('.', ',')} ppm</div>
                <p>La concentrazione di cloro libero supera i limiti massimi consentiti per la balneazione.</p>
                <div class="dosage-box-alert">
                    <p style="margin:0; font-weight:600; color:#b91c1c;">Azione Consigliata:</p>
                    <p style="margin:5px 0 0 0; font-size:0.95rem; color:#334155;">Sospendere immediatamente ogni forma di clorazione. Rimuovere la copertura estiva e lasciare la vasca esposta al sole; l'azione dei raggi UV consumerà il cloro in eccesso in modo naturale.</p>
                </div>
            `;
        }
    }
    else if (parametro === 'cl. com') {
        markup = `
            <div class="dosage-title">Eccesso Cloro Combinato (Clorammine)</div>
            <div class="dosage-badge">FUORI LIMITE: ${valoreCorrente.toFixed(2).replace('.', ',')} ppm</div>
            <p>Le clorammine superano la soglia critica di 0,40 ppm. Questo causa il classico forte "odore di cloro", bruciore agli occhi e scarsa disinfezione reale.</p>
            <div class="dosage-box-alert" style="background-color:#fff1f2; border-left-color:#e11d48;">
                <p style="margin:0; font-weight:600; color:#b91c1c;">Intervento Tecnico Necessario:</p>
                <p style="margin:5px 0 0 0; font-size:0.95rem; color:#334155;">Effettuare un **Controlavaggio profondo del filtro** seguito da un abbondante **Reintegro di acqua nuova pulita** per diluire il parametro. Se non scende, programmare una clorazione d'urto serale a impianto chiuso.</p>
            </div>
        `;
    }
    else if (parametro === 'cya') {
        markup = `
            <div class="dosage-title">Saturazione Acido Cianurico (CYA)</div>
            <div class="dosage-badge">ALLARME: ${valoreCorrente.toFixed(0)} ppm</div>
            <p>Il livello dello stabilizzatore ha superato la soglia critica di **60 ppm**. Un eccesso di cianurico blocca l'efficacia del cloro libero ("blocco del cloro"), rendendolo inefficiente anche a dosaggi elevati.</p>
            <div class="dosage-box-alert" style="background-color:#fff1f2; border-left-color:#ef4444;">
                <p style="margin:0; font-weight:600; color:#b91c1c;">Unica Soluzione Efficace:</p>
                <p style="margin:5px 0 0 0; font-size:0.95rem; color:#334155;">L'acido cianurico non evapora e non può essere eliminato chimicamente. È tassativo **scaricare parzialmente la piscina (circa il 20-30% del volume)** ed effettuare un ampio reintegro con acqua fresca di acquedotto priva di stabilizzanti.</p>
            </div>
        `;
    }

    content.innerHTML = markup;
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