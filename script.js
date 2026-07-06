// === CONFIGURAZIONE PARAMETRI PISCINA (Volume Vasca: 92 m³ - Configurazione Toscana) ===
const PISCINA_CONFIG = {
    volume: 92, 
    target: { 
        ph: 7.30, 
        cloro: 1.1,  // Quota ideale a 1,1 ppm
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

// === ASSISTENTE CHIMICO (OVERLAY DOSI COINVOLGENDO I CONTATORI) ===
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
    
    let reintegroLitri = 0;
    if (datiRegistriGlobali.contatori && datiRegistriGlobali.contatori.length > 0) {
        const ultimaRigaContatori = datiRegistriGlobali.contatori[datiRegistriGlobali.contatori.length - 1];
        for (let k in ultimaRigaContatori) {
            if (k.toLowerCase().includes('reintegro') || k.toLowerCase().includes('litri')) {
                let valReint = parseFloat(String(ultimaRigaContatori[k]).replace(',', '.'));
                if (!isNaN(valReint)) reintegroLitri = valReint;
            }
        }
    }

    let consiglio = null;

    if (parametro === 'pH' && valoreAttuale > 7.5) {
        title.innerText = `🧪 Assistente Chimico - Correzione pH (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaPh = valoreAttuale - PISCINA_CONFIG.target.ph;
        const puntiCentesimi = Math.round(deltaPh * 100);
        let doseTotale = Math.round(puntiCentesimi * PISCINA_CONFIG.prodotti.phMeno.dosePerCentesimo);
        
        let notaModulazione = "Sciogliere la polvere in un secchio d'acqua pulita e versare uniformemente davanti alle bocchette.";
        if (reintegroLitri > 1000) {
            doseTotale = Math.round(doseTotale * 0.90);
            notaModulazione = `⚠️ Dose ridotta del 10% per effetto diluizione causato da recente reintegro di ${reintegroLitri.toLocaleString('it-IT')}L. ` + notaModulazione;
        }
        
        consiglio = {
            parametro: "pH",
            stato: `Alto (${valoreAttuale.toFixed(2)})`,
            azione: `Abbassare di ${deltaPh.toFixed(2)} unità per rientrare al valore ottimale di ${PISCINA_CONFIG.target.ph}`,
            prodotto: PISCINA_CONFIG.prodotti.phMeno.nome,
            quantita: `${(doseTotale / 1000).toFixed(2)} kg`,
            nota: notaModulazione
        };
    } 
    else if (parametro === 'CloroLibero' && valoreAttuale < 0.7) {
        title.innerText = `🧪 Assistente Chimico - Dosaggio Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = PISCINA_CONFIG.target.cloro - valoreAttuale;
        const fattoreTemp = getFattoreTemperatura(tempAttuale);
        let doseBase = deltaCloro * 100 * PISCINA_CONFIG.prodotti.cloroCa.dosePerPpm;
        let doseCorretta = Math.round(doseBase * fattoreTemp);

        let notaTemp = `Dosaggio rapido granulare. Aggiungere negli skimmer o premiscelare.`;
        if (fattoreTemp > 1.0 && !isNaN(tempAttuale)) {
            notaTemp += ` (Aumentato del ${Math.round((fattoreTemp - 1) * 100)}% per accelerazione termica a ${tempAttuale}°C).`;
        }

        consiglio = {
            parametro: "Cloro Libero",
            stato: `Basso (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Aumentare di ${deltaCloro.toFixed(2)} ppm per raggiungere la quota ideale di ${PISCINA_CONFIG.target.cloro} ppm`,
            prodotto: PISCINA_CONFIG.prodotti.cloroCa.nome,
            quantita: `${doseCorretta} grammi`,
            nota: notaTemp
        };
    } 
    else if (parametro === 'CloroLibero' && valoreAttuale > 2.0) {
        title.innerText = `🧪 Assistente Chimico - Abbattimento Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = valoreAttuale - PISCINA_CONFIG.target.cloro;
        const doseTotale = Math.round(deltaCloro * 100 * PISCINA_CONFIG.prodotti.waterStop.dosePerPpm);

        consiglio = {
            parametro: "Cloro Libero",
            stato: `Alto (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Abbassare di ${deltaCloro.toFixed(2)} ppm per riportare l'acqua in equilibrio a ${PISCINA_CONFIG.target.cloro} ppm`,
            prodotto: PISCINA_CONFIG.prodotti.waterStop.nome,
            quantita: `${doseTotale} grammi`,
            nota: "Utilizzare solo se necessario riaprire subito la vasca, altrimenti la radiazione solare UV lo abbatterà naturalmente."
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
            nota: "TASSATIVAMENTE a vasca vuota (assenza di bagnanti), preferibilmente al tramonto. Lasciare la filtrazione accesa H24."
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

// === CARICAMENTO CSV ===
function caricaTuttiIRegistri() {
    let promesseCaricamento = [];

    Object.keys(REGISTRI_FILES).forEach(chiave => {
        const config = REGISTRI_FILES[chiave];
        
        let p = new Promise((resolve) => {
            Papa.parse(config.file, {
                download: true,
                header: false,
                skipEmptyLines: 'greedy',
                complete: function(results) {
                    let righe = results.data;
                    if (!righe || righe.length === 0) { resolve(); return; }
                    
                    let indexHeader = righe.findIndex(r => r && r[0] && r[0].trim().toLowerCase() === 'data');
                    if (indexHeader === -1) indexHeader = 0;
                    
                    let headers = righe[indexHeader].map(h => h ? h.trim() : "");
                    
                    let datiTrasformati = [];
                    for (let i = indexHeader + 1; i < righe.length; i++) {
                        let rigaCorrente = righe[i];
                        if (!rigaCorrente || rigaCorrente.length === 0 || rigaCorrente.every(c => !c || c.trim() === "")) {
                            continue;
                        }
                        
                        let obj = {};
                        headers.forEach((h, idx) => {
                            if (h !== "") obj[h] = rigaCorrente[idx] ? rigaCorrente[idx].trim() : "";
                        });
                        datiTrasformati.push(obj);
                    }
                    
                    datiRegistriGlobali[chiave] = datiTrasformati;
                    popolaTabellaHtml(datiTrasformati, config.tableId, chiave);
                    resolve();
                },
                error: function() { resolve(); }
            });
        });
        promesseCaricamento.push(p);
    });

    Promise.all(promesseCaricamento);
}

// === FUNZIONE DI SCROLL DINAMICA UNIVERSALE PER TUTTI I REGISTRI ===
function eseguiScrollAlDatoOggi(tipoRegistro) {
    const config = REGISTRI_FILES[tipoRegistro];
    if (!config) return;

    const tabellaTarget = document.getElementById(config.tableId);
    if (!tabellaTarget) return;

    const righe = tabellaTarget.querySelectorAll('tbody tr');
    if (righe.length === 0) return;

    let ultimaRigaConDati = null;

    for (let i = righe.length - 1; i >= 0; i--) {
        let celle = righe[i].querySelectorAll('td');
        
        let rigaContieneDatiReali = false;
        for (let j = 2; j < celle.length; j++) {
            let contenutoCella = celle[j].innerText.trim();
            if (contenutoCella !== "" && contenutoCella !== "0" && contenutoCella !== "0,00") {
                rigaContieneDatiReali = true;
                break;
            }
        }

        if (rigaContieneDatiReali) {
            ultimaRigaConDati = righe[i];
            break;
        }
    }

    if (!ultimaRigaConDati) {
        for (let i = righe.length - 1; i >= 0; i--) {
            let celle = righe[i].querySelectorAll('td');
            if (celle.length > 2 && (celle[2].innerText.trim() !== "" || (celle[3] && celle[3].innerText.trim() !== ""))) {
                ultimaRigaConDati = righe[i];
                break;
            }
        }
    }

    if (ultimaRigaConDati) {
        ultimaRigaConDati.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        tabellaTarget.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

// === GENERAZIONE DELLE TABELLE HTML CON COLORI ACCENTUATI ===
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
        
        let daGraficare = false;
        if (tipoRegistro === 'chimico' && ['ph', 'cloro libero', 'cloro totale', 'cloro combinato', 'temperatura vasca', 'n.ospiti', 'cya', 'cl. lib', 'cl. tot', 'cl. com', 'temp'].includes(cleanKey)) {
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

            if (!isNaN(valoreFloat) && ['ph', 'cloro libero', 'cloro totale', 'cloro combinato', 'temperatura vasca', 'cya', 'cl. lib', 'cl. tot', 'cl. com', 'temp'].includes(cleanKey)) {
                cell.innerText = valoreFloat.toFixed(2).replace('.', ',');
            } else {
                cell.innerText = valoreTesto;
            }

            if (isNaN(valoreFloat) || valoreTesto === "" || tipoRegistro !== 'chimico') return;
            
            // --- REGOLE DI COLORAZIONE RECENTI ACCENTUATE ---
            if (cleanKey === 'ph') {
                if (valoreFloat >= 7.10 && valoreFloat <= 7.30) {
                    cell.style.backgroundColor = "#10b981"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Verde Acceso Intenso
                } else if ((valoreFloat >= 6.50 && valoreFloat < 7.10) || (valoreFloat > 7.30 && valoreFloat <= 7.50)) {
                    cell.style.backgroundColor = "#fef08a"; cell.style.color = "#854d0e"; // Giallo Attenzione
                    if (valoreFloat > 7.30) { cell.style.cursor = "pointer"; cell.onclick = () => mostraDosiInOverlay('pH', valoreFloat, riga); }
                } else {
                    cell.style.backgroundColor = "#ef4444"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Rosso Fuori Limite
                }
            }
            
            if (cleanKey === 'cloro libero' || cleanKey === 'cl. lib') {
                if (valoreFloat >= 0.90 && valoreFloat <= 1.20) {
                    cell.style.backgroundColor = "#10b981"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Verde Acceso Intenso
                } else if ((valoreFloat >= 0.70 && valoreFloat < 0.90) || (valoreFloat > 1.20 && valoreFloat <= 2.00)) {
                    cell.style.backgroundColor = "#fef08a"; cell.style.color = "#854d0e"; // Giallo Attenzione
                    cell.style.cursor = "pointer"; cell.onclick = () => mostraDosiInOverlay('CloroLibero', valoreFloat, riga);
                } else {
                    cell.style.backgroundColor = "#ef4444"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Rosso Fuori Limite
                }
            }

            if (cleanKey === 'cloro totale' || cleanKey === 'cl. tot') {
                if (valoreFloat >= 0.90 && valoreFloat <= 1.20) {
                    cell.style.backgroundColor = "#10b981"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Verde Acceso Intenso
                } else if ((valoreFloat >= 0.70 && valoreFloat < 0.90) || (valoreFloat > 1.20 && valoreFloat <= 2.00)) {
                    cell.style.backgroundColor = "#fef08a"; cell.style.color = "#854d0e"; // Giallo Attenzione
                } else {
                    cell.style.backgroundColor = "#ef4444"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Rosso Fuori Limite
                }
            }
            
            if (cleanKey === 'cloro combinato' || cleanKey === 'cl. com') {
                if (valoreFloat >= 0.0 && valoreFloat <= 0.20) {
                    cell.style.backgroundColor = "#10b981"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Verde Acceso Intenso
                } else if (valoreFloat > 0.20 && valoreFloat <= 0.40) {
                    cell.style.backgroundColor = "#fef08a"; cell.style.color = "#854d0e"; // Giallo Attenzione
                } else {
                    cell.style.backgroundColor = "#ef4444"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer"; // Rosso Fuori Limite
                    cell.onclick = () => mostraDosiInOverlay('CloroCombinato', valoreFloat, riga);
                }
            }
            
            if (cleanKey === 'cya') {
                if (valoreFloat >= 0 && valoreFloat <= 50.0) {
                    cell.style.backgroundColor = "#10b981"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; // Verde Acceso Intenso
                } else if (valoreFloat > 50.0 && valoreFloat <= 75.0) {
                    cell.style.backgroundColor = "#fef08a"; cell.style.color = "#854d0e"; // Giallo Attenzione
                    if (valoreFloat > 60.0) { cell.style.cursor = "pointer"; cell.onclick = () => mostraDosiInOverlay('CYA', valoreFloat, riga); }
                } else {
                    cell.style.backgroundColor = "#ef4444"; cell.style.color = "#ffffff"; cell.style.fontWeight = "bold"; cell.style.cursor = "pointer"; // Rosso Fuori Limite
                    cell.onclick = () => mostraDosiInOverlay('CYA', valoreFloat, riga);
                }
            }

            if (cleanKey === 'temperatura vasca' || cleanKey === 'temp') {
                if (valoreFloat < 24.0 || valoreFloat > 30.0) {
                    cell.style.backgroundColor = "#fee2e2"; cell.style.color = "#b91c1c";
                } else { cell.style.backgroundColor = "#e2fbf0"; cell.style.color = "#047857"; }
            }
        });
    });
}

// === GENERAZIONE DEI GRAFICI HISTORICAL (BLOCCATI AGLI ULTIMI 30 GIORNI CON BANDE COLORATE SULLO SFONDO) ===
function apriGrafico(parametro, tipoRegistro) {
    if (!tipoRegistro) tipoRegistro = 'chimico';
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');

    if (containerDosi) containerDosi.style.display = 'none';
    if (canvas) canvas.style.display = 'block';

    title.innerText = `Andamento Storico Parametro (Ultimi 30 Record): ${parametro}`;
    overlay.classList.remove('hidden');

    let etichetteTutte = [];
    let valoriTutti = [];
    let cleanParam = parametro.toLowerCase().trim();
    let datiDaUsare = datiRegistriGlobali[tipoRegistro] || [];

    datiDaUsare.forEach(riga => {
        let dataStr = riga["Data"] || riga["data"] || "";
        let oraStr = riga["Ora"] || riga["ora"] || "";
        let valStr = riga[parametro] || "";
        
        if (valStr !== "") {
            let valFloat = parseFloat(valStr.replace(',', '.'));
            if (!isNaN(valFloat)) {
                etichetteTutte.push(`${dataStr} ${oraStr}`.trim());
                valoriTutti.push(valFloat);
            }
        }
    });

    // === FILTRO DEI 30 GIORNI === Prende rigorosamente solo gli ultimi 30 record storici inseriti
    let etichette = etichetteTutte.slice(-30);
    let valori = valoriTutti.slice(-30);

    if (mioGrafico) {
        mioGrafico.destroy();
    }

    let tipoGrafico = 'line';
    if (cleanParam === 'n.ospiti' || cleanParam.includes('reintegro')) {
        tipoGrafico = 'bar';
    }

    let opzioniScale = {
        x: { ticks: { font: { size: 10 } } },
        y: { ticks: { font: { size: 10 } } }
    };

    // Impostiamo i limiti ottimali visivi per gli assi Y basandoci sui tuoi range
    if (cleanParam === 'ph') {
        opzioniScale.y.min = 6.0;
        opzioniScale.y.max = 8.0;
    } else if (['cloro libero', 'cloro totale', 'cl. lib', 'cl. tot'].includes(cleanParam)) {
        opzioniScale.y.min = 0.0;
        opzioniScale.y.max = 2.5;
    } else if (['cloro combinato', 'cl. com'].includes(cleanParam)) {
        opzioniScale.y.min = 0.0;
        opzioniScale.y.max = 0.8;
    } else if (cleanParam === 'cya') {
        opzioniScale.y.min = 0;
        opzioniScale.y.max = 100;
    } else if (cleanParam.includes('reintegro')) {
        opzioniScale.y.min = 0;
    }

    // Costruzione delle Fasce Colorate di sfondo (Bande ideali e soglie) usando un plugin Canvas integrato
    const pluginSfondoFasce = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
            ctx.save();

            function disegnaBanda(yMin, yMax, colore) {
                let pixelTop = y.getPixelForValue(yMax);
                let pixelBottom = y.getPixelForValue(yMin);
                // Evita di disegnare fuori dal grafico
                pixelTop = Math.max(pixelTop, top);
                pixelBottom = Math.min(pixelBottom, bottom);
                if (pixelTop < pixelBottom) {
                    ctx.fillStyle = colore;
                    ctx.fillRect(left, pixelTop, right - left, pixelBottom - pixelTop);
                }
            }

            // Applica i colori di sfondo strutturati in base alle richieste specifiche
            if (['cloro libero', 'cloro totale', 'cl. lib', 'cl. tot'].includes(cleanParam)) {
                disegnaBanda(0.0, 0.7, 'rgba(239, 68, 68, 0.15)');   // Rosso sotto limite legge
                disegnaBanda(0.7, 0.9, 'rgba(254, 240, 138, 0.4)');  // Giallo attenzione basso
                disegnaBanda(0.9, 1.2, 'rgba(16, 185, 129, 0.25)');  // VERDE IDEAL FASCIA (0,9 - 1,2)
                disegnaBanda(1.2, 2.0, 'rgba(254, 240, 138, 0.4)');  // Giallo attenzione alto
                disegnaBanda(2.0, 5.0, 'rgba(239, 68, 68, 0.15)');   // Rosso sopra limite legge
            } 
            else if (cleanParam === 'ph') {
                disegnaBanda(5.0, 6.5, 'rgba(239, 68, 68, 0.15)');   // Rosso fuori limite
                disegnaBanda(6.5, 7.1, 'rgba(254, 240, 138, 0.4)');  // Giallo attenzione
                disegnaBanda(7.1, 7.3, 'rgba(16, 185, 129, 0.25)');  // VERDE IDEAL FASCIA (7,1 - 7,3)
                disegnaBanda(7.3, 7.5, 'rgba(254, 240, 138, 0.4)');  // Giallo attenzione alto
                disegnaBanda(7.5, 9.0, 'rgba(239, 68, 68, 0.15)');   // Rosso fuori limite
            } 
            else if (['cloro combinato', 'cl. com'].includes(cleanParam)) {
                disegnaBanda(0.0, 0.2, 'rgba(16, 185, 129, 0.25)');  // VERDE IDEAL (0,0 - 0,2)
                disegnaBanda(0.2, 0.4, 'rgba(254, 240, 138, 0.4)');  // Giallo fino a 0,4
                disegnaBanda(0.4, 2.0, 'rgba(239, 68, 68, 0.15)');   // Rosso fuori limite superiore
            } 
            else if (cleanParam === 'cya') {
                disegnaBanda(0, 50, 'rgba(16, 185, 129, 0.25)');     // VERDE IDEAL (0 - 50)
                disegnaBanda(50, 75, 'rgba(254, 240, 138, 0.4)');    // Giallo fino a 75
                disegnaBanda(75, 200, 'rgba(239, 68, 68, 0.15)');    // Rosso sopra 75
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
                    borderColor: '#0f172a', // Linea blu scuro/nera per contrastare ottimamente sullo sfondo colorato
                    backgroundColor: tipoGrafico === 'bar' ? 'rgba(2, 132, 199, 0.8)' : '#0f172a',
                    borderWidth: 3,
                    pointRadius: tipoGrafico === 'bar' ? 0 : 4,         
                    pointHoverRadius: 7,      
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
            },
            plugins: [pluginSfondoFasce] // Inietta il motore di disegno delle fasce colorate
        });
    }, 60);
}

// === GESTIONE VISIBILITÀ SEZIONI CON SCROLL COERENTE ===
function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) {
        sez.classList.remove('hidden');
        let tipoReg = sezioneId.replace('Section', '');
        setTimeout(() => { 
            eseguiScrollAlDatoOggi(tipoReg); 
        }, 100);
    }
}

window.mostraSezione = mostraSezione;

window.onload = function() {
    caricaTuttiIRegistri();
};