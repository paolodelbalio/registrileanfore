// === CONFIGURAZIONE PARAMETRI PISCINA (Volume Vasca: 92 m³ - Configurazione Toscana) ===
const PISCINA_CONFIG = {
    volume: 92, 
    target: { 
        ph: 7.30, 
        cloro: 1.5,
        cya: 55,    
        temp: 27    
    },
    prodotti: {
        phMeno: { nome: "pH- (Acido Sec)", dosePerCentesimo: 9.2 },          
        cloroCa: { nome: "Cloro Granulare (Ipoclorito)", dosePerPpm: 1.84 }, 
        cloroShock: { nome: "Cloro Shock Granulare", doseShockPerMc: 15 },    
        waterStop: { nome: "Water Stop (Abbattitore)", dosePerPpm: 2.76 }   
    },
    acquaReintegro: { temp: 12 } 
};

// Variabili globali per memorizzare i dati di tutti i registri
let mioGrafico = null;
let datiRegistriGlobali = {
    chimico: [],
    contatori: [],
    pulizie: [],
    manutenzioni: []
}; 

// Mappatura file CSV con i nomi ESATTI rilevati nella tua cartella
const REGISTRI_FILES = {
    chimico: { file: "REGISTRO CHIMICO 2026.csv", tableId: "chimicoTable" },
    contatori: { file: "REGISTRO CONTATORI.csv", tableId: "contatoriTable" },
    pulizie: { file: "REGISTRO PULIZIE PISCINA 2026.csv", tableId: "pulizieTable" },
    manutenzioni: { file: "REGISTRO MANUTENZIONE INTERVENTI .csv", tableId: "manutenzioniTable" }
};

function getFattoreTemperatura(temp) {
    if (isNaN(temp) || temp <= 28) return 1.0;
    if (temp <= 30) return 1.15;
    return 1.30;
}

// === ASSISTENTE CHIMICO (OVERLAY DOSI) ===
function mostraDosiInOverlay(parametro, valoreAttuale, rigaDati) {
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    
    let containerDosi = document.getElementById('overlayDosiContent');
    if (!containerDosi) {
        containerDosi = document.createElement('div');
        containerDosi.id = 'overlayDosiContent';
        canvas.parentNode.insertBefore(containerDosi, canvas);
    }

    if (canvas) canvas.style.display = 'none';
    containerDosi.style.display = 'block';
    containerDosi.innerHTML = "";

    const dataRilevamento = rigaDati["Data"] || rigaDati["data"] || "Rilevamento";
    const oraRilevamento = rigaDati["Ora"] || rigaDati["ora"] || "";
    
    const keys = Object.keys(rigaDati);
    const tempKey = keys.find(k => k.toLowerCase().includes('temp'));
    const tempAttuale = tempKey ? parseFloat(String(rigaDati[tempKey]).replace(',', '.')) : NaN;
    
    let consiglio = null;

    if (parametro === 'pH' && valoreAttuale > 7.5) {
        title.innerText = `🧪 Assistente Chimico - Correzione pH (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaPh = valoreAttuale - PISCINA_CONFIG.target.ph;
        const puntiCentesimi = Math.round(deltaPh * 100);
        const doseTotale = Math.round(puntiCentesimi * PISCINA_CONFIG.prodotti.phMeno.dosePerCentesimo);
        
        consiglio = {
            parametro: "pH",
            stato: `Alto (${valoreAttuale.toFixed(2)})`,
            azione: `Abbassare di ${deltaPh.toFixed(2)} unità per rientrare al valore ottimale di ${PISCINA_CONFIG.target.ph}`,
            prodotto: PISCINA_CONFIG.prodotti.phMeno.nome,
            quantita: `${(doseTotale / 1000).toFixed(2)} kg`,
            nota: "Sciogliere la polvere in un secchio d'acqua pulita e versare uniformemente in vasca davanti alle bocchette."
        };
    } 
    else if (parametro === 'Cloro' && valoreAttuale < 0.7) {
        title.innerText = `🧪 Assistente Chimico - Dosaggio Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = PISCINA_CONFIG.target.cloro - valoreAttuale;
        const fattoreTemp = getFattoreTemperatura(tempAttuale);
        let doseBase = deltaCloro * 100 * PISCINA_CONFIG.prodotti.cloroCa.dosePerPpm;
        let doseCorretta = Math.round(doseBase * fattoreTemp);

        let notaTemp = "";
        if (fattoreTemp > 1.0 && !isNaN(tempAttuale)) {
            notaTemp = ` (Aumentato del ${Math.round((fattoreTemp - 1) * 100)}% per evaporazione causata da ${tempAttuale}°C dell'acqua).`;
        }

        consiglio = {
            parametro: "Cloro Libero",
            stato: `Basso (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Aumentare di ${deltaCloro.toFixed(2)} ppm per raggiungere la quota ideale di ${PISCINA_CONFIG.target.cloro} ppm`,
            prodotto: PISCINA_CONFIG.prodotti.cloroCa.nome,
            quantita: `${doseCorretta} grammi`,
            nota: `Dosaggio rapido granulare.${notaTemp} Aggiungere negli skimmer o premiscelare.`
        };
    } 
    else if (parametro === 'Cloro' && valoreAttuale > 2.0) {
        title.innerText = `🧪 Assistente Chimico - Abbattimento Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = valoreAttuale - 1.5;
        const doseTotale = Math.round(deltaCloro * 100 * PISCINA_CONFIG.prodotti.waterStop.dosePerPpm);

        consiglio = {
            parametro: "Cloro Libero",
            stato: `Alto (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Abbassare di ${deltaCloro.toFixed(2)} ppm per riportare l'acqua in equilibrio`,
            prodotto: PISCINA_CONFIG.prodotti.waterStop.nome,
            quantita: `${doseTotale} grammi`,
            nota: "Utilizzare solo se necessario riaprire subito la vasca, altrimenti il sole lo consumerà in modo naturale."
        };
    }
    else if (parametro === 'CloroCombinato' && valoreAttuale > 0.40) {
        title.innerText = `🚨 Assistente Chimico - TRATTAMENTO SHOCK (${dataRilevamento} ore ${oraRilevamento})`;
        const doseShockTotale = PISCINA_CONFIG.volume * PISCINA_CONFIG.prodotti.cloroShock.doseShockPerMc;

        consiglio = {
            parametro: "Cloro Combinato (Clorammine)",
            stato: `Fuori Legge (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Eseguire iperclorazione shock d'urto per distruggere le clorammine accumulate`,
            prodotto: PISCINA_CONFIG.prodotti.cloroShock.nome,
            quantita: `${(doseShockTotale / 1000).toFixed(2)} kg`,
            nota: "TASSATIVAMENTE a vasca vuota (assenza di bagnanti), preferibilmente al tramonto. Filtrazione accesa H24."
        };
    }
    else if (parametro === 'CYA' && valoreAttuale > 60) {
        title.innerText = `💧 Assistente Chimico - Diluizione Preventiva Stabilizzante (${dataRilevamento})`;
        const targetSicurezzaCya = PISCINA_CONFIG.target.cya; 
        const frazioneRimanente = targetSicurezzaCya / valoreAttuale;
        const percentualeDaScaricare = (1 - frazioneRimanente) * 100;
        const mcDaScaricare = PISCINA_CONFIG.volume * (1 - frazioneRimanente);

        consiglio = {
            parametro: "Acido Cianurico (CYA)",
            stato: `Superata soglia di controllo (${valoreAttuale.toFixed(0)} ppm)`,
            azione: `Sostituire il ${percentualeDaScaricare.toFixed(1)}% dell'acqua per scendere a ${targetSicurezzaCya} ppm`,
            prodotto: "Reintegro Acqua Nuova (Pozzo / Acquedotto)",
            quantita: `Scaricare ${mcDaScaricare.toFixed(1)} m³ di acqua`,
            nota: `Effettuare uno scarico parziale controllato di ${mcDaScaricare.toFixed(1)} m³ (circa ${(Math.round(mcDaScaricare * 1000)).toLocaleString('it-IT')} litri) e ripristinare il livello.`
        };
    }
    else if (parametro === 'Temperatura' && valoreAttuale > 30) {
        title.innerText = `❄️ Assistente Chimico - Raffreddamento Vasca (${dataRilevamento} ore ${oraRilevamento})`;
        const tempTarget = PISCINA_CONFIG.target.temp;
        const tempImmissione = PISCINA_CONFIG.acquaReintegro.temp; 
        const mcFredda = PISCINA_CONFIG.volume * (valoreAttuale - tempTarget) / (tempTarget - tempImmissione);

        consiglio = {
            parametro: "Temperatura Acqua",
            stato: `Elevata (${valoreAttuale.toFixed(1)}°C)`,
            azione: `Immettere acqua fredda a ${tempImmissione}°C per abbassare la temperatura a ${tempTarget}°C`,
            prodotto: "Reintegro Termico Rapido (Acqua a 12°C)",
            quantita: `Immettere ${mcFredda.toFixed(1)} m³ di acqua fresca`,
            nota: `Attivare lo scarico e inserire simultaneamente circa ${mcFredda.toFixed(1)} m³ di acqua fredda.`
        };
    }

    if (!consiglio) return;

    containerDosi.innerHTML = `
        <div class="card-assistente" style="border-left: 6px solid #d73a49; margin-top: 10px; padding: 10px; background: #fff;">
            <table class="tabella-consigli">
                <thead>
                    <tr>
                        <th>Parametro</th>
                        <th>Stato</th>
                        <th>Obiettivo</th>
                        <th>Prodotto</th>
                        <th>Dose Richiesta</th>
                        <th>Istruzioni</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${consiglio.parametro}</strong></td>
                        <td><span class="badge badge-pericolo" style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${consiglio.stato}</span></td>
                        <td>${consiglio.azione}</td>
                        <td><em>${consiglio.prodotto}</em></td>
                        <td><span class="badge-dose" style="background-color: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${consiglio.quantita}</span></td>
                        <td style="font-size: 0.82rem; color: #4b5563;">${consiglio.nota}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    overlay.classList.remove('hidden');
}

function closeOverlay() {
    const overlay = document.getElementById('chartOverlay');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');
    
    if (overlay) overlay.classList.add('hidden');
    if (canvas) canvas.style.display = 'block';
    if (containerDosi) containerDosi.style.display = 'none';
}

// === CARICAMENTO INTELLIGENTE DEI FILE CSV (Ignora le righe di intestazione descrittive) ===
function caricaTuttiIRegistri() {
    Object.keys(REGISTRI_FILES).forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        Papa.parse(config.file, {
            download: true,
            header: false, // Leggiamo come array di array per trovare la vera riga di intestazione
            skipEmptyLines: 'greedy',
            complete: function(results) {
                let righe = results.data;
                if (!righe || righe.length === 0) return;
                
                // Cerca dinamicamente la riga che contiene la parola "Data" come prima colonna
                let indexHeader = righe.findIndex(r => r && r[0] && r[0].trim().toLowerCase() === 'data');
                if (indexHeader === -1) {
                    indexHeader = 0; // Se non la trova, assume sia la prima
                }
                
                let headers = righe[indexHeader].map(h => h ? h.trim() : "");
                
                // Convertiamo le righe successive in oggetti chiave/valore puliti
                let datiTrasformati = [];
                for (let i = indexHeader + 1; i < righe.length; i++) {
                    let rigaCorrente = righe[i];
                    if (!rigaCorrente || rigaCorrente.length === 0 || rigaCorrente.every(c => !c || c.trim() === "")) {
                        continue; // Salta righe vuote
                    }
                    
                    let obj = {};
                    headers.forEach((h, idx) => {
                        if (h !== "") {
                            obj[h] = rigaCorrente[idx] ? rigaCorrente[idx].trim() : "";
                        }
                    });
                    datiTrasformati.push(obj);
                }
                
                // Salvataggio globale nello stato
                datiRegistriGlobali[chiave] = datiTrasformati;
                popolaTabellaHtml(datiTrasformati, config.tableId, chiave);
            },
            error: function(err) {
                console.error("Errore caricamento per il file:", config.file, err);
            }
        });
    });
}

// === GENERAZIONE DELLE TABELLE HTML CON PULSANTI GRAFICI ===
function popolaTabellaHtml(dati, tableId, tipoRegistro) {
    const table = document.getElementById(tableId);
    if (!table || !dati || dati.length === 0) return;
    table.innerHTML = "";

    let keys = Object.keys(dati[0]);
    let thead = table.createTHead();
    let rowHead = thead.insertRow();
    
    keys.forEach(key => {
        let th = document.createElement("th");
        let cleanKey = key.toLowerCase().trim();
        
        // Definiamo quali colonne meritano un grafico interattivo
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
        keys.forEach(key => {
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
            
            // Regole di evidenziazione per il registro chimico
            if (cleanKey === 'ph') {
                if (valoreFloat > 7.50 || valoreFloat < 7.20) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold";
                    if (valoreFloat > 7.50) { cell.style.cursor = "pointer"; cell.onclick = () => mostraDosiInOverlay('pH', valoreFloat, riga); }
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. lib') {
                if (valoreFloat < 0.70 || valoreFloat > 2.00) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => mostraDosiInOverlay('Cloro', valoreFloat, riga);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. com') {
                if (valoreFloat > 0.40) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => mostraDosiInOverlay('CloroCombinato', valoreFloat, riga);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'temp') {
                if (valoreFloat < 24.0 || valoreFloat > 30.0) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c";
                    if (valoreFloat > 30.0) { cell.style.cursor = "pointer"; cell.onclick = () => mostraDosiInOverlay('Temperatura', valoreFloat, riga); }
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cya') {
                if (valoreFloat > 60.0) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer";
                    cell.onclick = () => mostraDosiInOverlay('CYA', valoreFloat, riga);
                } else { cell.style.backgroundColor = "#ecfdf5"; cell.style.color = "#047857"; }
            }
            if (cleanKey === 'cl. tot') {
                if (valoreFloat < 0.70 || valoreFloat > 2.40) { cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c"; } 
                else { cell.style.backgroundColor = "#ecfdf5"; }
            }
        });
    });
}

// === GENERAZIONE DEI GRAFICI STORICI DINAMICI ===
function apriGrafico(parametro, tipoRegistro) {
    if (!tipoRegistro) tipoRegistro = 'chimico';
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');

    if (containerDosi) containerDosi.style.display = 'none';
    if (canvas) canvas.style.display = 'block';

    title.innerText = `Andamento Storico Parametro: ${parametro}`;
    overlay.classList.remove('hidden');

    let etichette = [];
    let valori = [];
    let cleanParam = parametro.toLowerCase().trim();
    let datiDaUsare = datiRegistriGlobali[tipoRegistro] || [];

    datiDaUsare.forEach(riga => {
        let dataStr = riga["Data"] || riga["data"] || "";
        let oraStr = riga["Ora"] || riga["ora"] || "";
        let valStr = riga[parametro] || "";
        
        if (valStr !== "") {
            let valFloat = parseFloat(valStr.replace(',', '.'));
            if (!isNaN(valFloat)) {
                etichette.push(`${dataStr} ${oraStr}`.trim());
                valori.push(valFloat);
            }
        }
    });

    if (mioGrafico) {
        mioGrafico.destroy();
    }

    let opzioniScale = {
        x: { ticks: { font: { size: 10 } } },
        y: { ticks: { font: { size: 10 } } }
    };

    if (cleanParam === 'ph') {
        opzioniScale.y.min = 7.0;
        opzioniScale.y.max = 8.0;
    }
    else if (cleanParam.includes('reintegro')) {
        opzioniScale.y.min = 0;
        opzioniScale.y.ticks = {
            stepSize: 500, // Griglia bloccata ogni 500 litri per i contatori
            font: { size: 10 }
        };
    }

    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setTimeout(() => {
        mioGrafico = new Chart(ctx, {
            type: 'line',
            data: {
                labels: etichette,
                datasets: [{
                    label: parametro,
                    data: valori,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 2,
                    pointRadius: 2,         
                    pointHoverRadius: 5,      
                    tension: 0.15             
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: opzioniScale,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }, 60);
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) sez.classList.remove('hidden');
}

window.onload = function() {
    caricaTuttiIRegistri();
    mostraSezione('chimicoSection');
};