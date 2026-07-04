// === CONFIGURAZIONE PARAMETRI PISCINA (Volume Vasca: 92 m³ - Configurazione Toscana) ===
const PISCINA_CONFIG = {
    volume: 92, // Metri cubi vasca
    target: { 
        ph: 7.30, 
        cloro: 1.5,
        cya: 55,    // Target di rientro preventivo di sicurezza
        temp: 27    // Temperatura ideale comfort bagnanti
    },
    prodotti: {
        phMeno: { nome: "pH- (Acido Sec)", dosePerCentesimo: 9.2 },          
        cloroCa: { nome: "Cloro Granulare (Ipoclorito)", dosePerPpm: 1.84 }, 
        cloroShock: { nome: "Cloro Shock Granulare", doseShockPerMc: 15 },    // 15g per mc per superclorazione d'urto
        waterStop: { nome: "Water Stop (Abbattitore)", dosePerPpm: 2.76 }   
    },
    acquaReintegro: { temp: 12 } // Temperatura dell'acqua fresca immessa (comunicata dall'utente)
};

// Funzione ausiliaria per la compensazione termica del cloro standard
function getFattoreTemperatura(temp) {
    if (isNaN(temp) || temp <= 28) return 1.0;
    if (temp <= 30) return 1.15;
    return 1.30;
}

// === FUNZIONE INTERATTIVA: CALCOLA E MOSTRA LE DOSI NELL'OVERLAY AL CLIC ===
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

    // --- CASE 1: pH ALTO ---
    if (parametro === 'pH' && valoreAttuale > 7.5) {
        title.innerText = `🧪 Assistente Chimico - Correzione pH (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaPh = valoreAttuale - PISCINA_CONFIG.target.ph;
        const puntiCentesimi = Math.round(deltaPh * 100);
        const doseTotale = Math.round(puntiCentesimi * PISCINA_CONFIG.prodotti.phMeno.dosePerCentesimo);
        
        consiglio = {
            parametro: "pH",
            stato: `Alto (${valoreActual.toFixed(2)})`,
            azione: `Abbassare di ${deltaPh.toFixed(2)} unità per rientrare al valore ottimale di ${PISCINA_CONFIG.target.ph}`,
            prodotto: PISCINA_CONFIG.prodotti.phMeno.nome,
            quantita: `${(doseTotale / 1000).toFixed(2)} kg`,
            nota: "Sciogliere la polvere in un secchio d'acqua pulita e versare uniformemente in vasca davanti alle bocchette con filtrazione attiva."
        };
    } 
    // --- CASE 2: CLORO LIBERO BASSO ---
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
            nota: `Dosaggio rapido granulare.${notaTemp} Aggiungere direttamente negli skimmer o premiscelare in un secchio.`
        };
    } 
    // --- CASE 3: CLORO LIBERO ALTO ---
    else if (parametro === 'Cloro' && valoreAttuale > 2.0) {
        title.innerText = `🧪 Assistente Chimico - Abbattimento Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = valoreAttuale - 1.5;
        const doseTotale = Math.round(deltaCloro * 100 * PISCINA_CONFIG.prodotti.waterStop.dosePerPpm);

        consiglio = {
            parametro: "Cloro Libero",
            stato: `Alto (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Abbassare di ${deltaCloro.toFixed(2)} ppm per riportare l'acqua in equilibrio di comfort`,
            prodotto: PISCINA_CONFIG.prodotti.waterStop.nome,
            quantita: `${doseTotale} grammi`,
            nota: "Utilizzare solo se è necessario riaprire immediatamente la vasca ai bagnanti, altrimenti l'azione del sole lo consumerà in modo naturale."
        };
    }
    // --- CASE 4: CLORO COMBINATO ALTO (TRATTAMENTO SHOCK) ---
    else if (parametro === 'CloroCombinato' && valoreAttuale > 0.40) {
        title.innerText = `🚨 Assistente Chimico - TRATTAMENTO SHOCK (${dataRilevamento} ore ${oraRilevamento})`;
        const doseShockTotale = PISCINA_CONFIG.volume * PISCINA_CONFIG.prodotti.cloroShock.doseShockPerMc;

        consiglio = {
            parametro: "Cloro Combinato (Clorammine)",
            stato: `Fuori Legge (${valoreAttuale.toFixed(2)} ppm)`,
            azione: `Eseguire iperclorazione shock d'urto per distruggere le clorammine accumulate e sanificare la vasca`,
            prodotto: PISCINA_CONFIG.prodotti.cloroShock.nome,
            quantita: `${(doseShockTotale / 1000).toFixed(2)} kg`,
            nota: "Eseguire il trattamento TASSATIVAMENTE a vasca vuota (assenza di bagnanti), preferibilmente al tramonto. Lasciare la filtrazione accesa H24. Attendere il rientro dei parametri normali prima di riaprire."
        };
    }
    // --- CASE 5: ACIDO CIANURICO ALTO (DILUIZIONE PREVENTIVA CON SOGLIA DI ALLARME A 60 ppm) ---
    else if (parametro === 'CYA' && valoreAttuale > 60) {
        title.innerText = `💧 Assistente Chimico - Diluizione Preventiva Stabilizzante (${dataRilevamento})`;
        
        // Target di sicurezza fissato a 55 ppm per risparmiare acqua pur sbloccando l'azione del cloro
        const targetSicurezzaCya = PISCINA_CONFIG.target.cya; 
        
        const frazioneRimanente = targetSicurezzaCya / valoreAttuale;
        const percentualeDaScaricare = (1 - frazioneRimanente) * 100;
        const mcDaScaricare = PISCINA_CONFIG.volume * (1 - frazioneRimanente);

        consiglio = {
            parametro: "Acido Cianurico (CYA)",
            stato: `Superata soglia di controllo (${valoreAttuale.toFixed(0)} ppm)`,
            azione: `Sostituire il ${percentualeDaScaricare.toFixed(1)}% dell'acqua per scendere a ${targetSicurezzaCya} ppm (evita il blocco del cloro)`,
            prodotto: "Reintegro Acqua Nuova (Pozzo / Acquedotto)",
            quantita: `Scaricare ${mcDaScaricare.toFixed(1)} m³ di acqua`,
            nota: `Effettuare uno scarico parziale controllato di ${mcDaScaricare.toFixed(1)} metri cubi (circa ${(Math.round(mcDaScaricare * 1000)).toLocaleString('it-IT')} litri) e ripristinare il livello della piscina. Agire preventivamente a 60 ppm ti evita di dover svuotare interamente la vasca in pieno luglio.`
        };
    }
    // --- CASE 6: TEMPERATURA ACQUA TROPPO ALTA (ABBASSAMENTO TERMICO CON REINTEGRO A 12°C) ---
    else if (parametro === 'Temperatura' && valoreAttuale > 30) {
        title.innerText = `❄️ Assistente Chimico - Raffreddamento Vasca (${dataRilevamento} ore ${oraRilevamento})`;
        
        const tempTarget = PISCINA_CONFIG.target.temp;
        const tempImmissione = PISCINA_CONFIG.acquaReintegro.temp; // 12°C
        
        const mcFredda = PISCINA_CONFIG.volume * (valoreAttuale - tempTarget) / (tempTarget - tempImmissione);

        consiglio = {
            parametro: "Temperatura Acqua",
            stato: `Elevata (${valoreAttuale.toFixed(1)}°C)`,
            azione: `Immettere acqua fredda a ${tempImmissione}°C per abbassare la temperatura al target ideale di ${tempTarget}°C`,
            prodotto: "Reintegro Termico Rapido (Acqua a 12°C)",
            quantita: `Immettere ${mcFredda.toFixed(1)} m³ di acqua fresca`,
            nota: `Attivare lo scarico e inserire simultaneamente circa ${mcFredda.toFixed(1)} metri cubi di acqua fresca dall'acquedotto per rinfrescare il volume totale e inibire la proliferazione batterica.`
        };
    }

    if (!consiglio) return;

    containerDosi.innerHTML = `
        <div class="card-assistente" style="border-left: 6px solid #d73a49; margin-top: 10px;">
            <p class="sottotitolo-assistente">Calcolo automatico di intervento tarato per la cubatura di <strong>92 m³</strong>.</p>
            <table class="tabella-consigli">
                <thead>
                    <tr>
                        <th>Parametro</th>
                        <th>Stato Rilevato</th>
                        <th>Obiettivo Tecnico</th>
                        <th>Azione / Prodotto</th>
                        <th>Dose / Volume Richiesto</th>
                        <th>Istruzioni Applicazione</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${consiglio.parametro}</strong></td>
                        <td><span class="badge badge-pericolo" style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${consiglio.stato}</span></td>
                        <td>${consiglio.azione}</td>
                        <td><em>${consiglio.prodotto}</em></td>
                        <td><span class="badge-dose" style="background-color: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${consiglio.quantita}</span></td>
                        <td class="nota-testo" style="font-size: 0.85rem; color: #4b5563;">${consiglio.nota}</td>
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

// === LETTURA E COSTRUZIONE DELLA TABELLA DATI CON COLORI E INTERATTIVITÀ ===
function caricaTabelle() {
    Papa.parse("REGISTRO CHIMICO 2026.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const data = results.data;
            const table = document.getElementById("chimicoTable");
            table.innerHTML = "";
            
            if (data.length === 0) return;

            let keys = Object.keys(data[0]);
            let thead = table.createTHead();
            let rowHead = thead.insertRow();
            keys.forEach(key => {
                let th = document.createElement("th");
                let cleanKey = key.toLowerCase().trim();
                if (['ph', 'cl. lib', 'cl. tot', 'cl. com', 'temp', 'n.ospiti', 'cya'].includes(cleanKey)) {
                    th.innerHTML = `<button class="table-th-btn" onclick="apriGrafico('${key}')">${key} 📊</button>`;
                } else {
                    th.innerText = key;
                }
                rowHead.appendChild(th);
            });

            let tbody = table.createTBody();
            data.forEach(riga => {
                let row = tbody.insertRow();
                keys.forEach(key => {
                    let cell = row.insertCell();
                    let valoreTesto = riga[key] ? riga[key].trim() : "";
                    let cleanKey = key.toLowerCase().trim();

                    let valoreFloat = parseFloat(valoreTesto.replace(',', '.'));

                    // Formattazione decimali visivi coerenti (virgola per l'italiano e blocco allargamento colonne)
                    if (!isNaN(valoreFloat) && ['ph', 'cl. lib', 'cl. tot', 'cl. com', 'temp', 'cya'].includes(cleanKey)) {
                        cell.innerText = valoreFloat.toFixed(2).replace('.', ',');
                    } else {
                        cell.innerText = valoreTesto;
                    }

                    if (isNaN(valoreFloat) || valoreTesto === "") return;
                    
                    // --- 1. pH ---
                    if (cleanKey === 'ph') {
                        if (valoreFloat > 7.50 || valoreFloat < 7.20) {
                            cell.style.backgroundColor = "#fee2e2"; 
                            cell.style.color = "#b91c1c";
                            cell.style.fontWeight = "bold";
                            if (valoreFloat > 7.50) {
                                cell.style.cursor = "pointer";
                                cell.title = "Clicca per calcolare la dose di pH-";
                                cell.onclick = () => mostraDosiInOverlay('pH', valoreFloat, riga);
                            }
                        } else {
                            cell.style.backgroundColor = "#ecfdf5"; 
                            cell.style.color = "#047857";
                        }
                    }

                    // --- 2. CLORO LIBERO ---
                    if (cleanKey === 'cl. lib') {
                        if (valoreFloat < 0.70 || valoreFloat > 2.00) {
                            cell.style.backgroundColor = "#fee2e2"; 
                            cell.style.color = "#b91c1c";
                            cell.style.fontWeight = "bold";
                            cell.style.cursor = "pointer";
                            cell.title = "Clicca per calcolare il dosaggio del Cloro";
                            cell.onclick = () => mostraDosiInOverlay('Cloro', valoreFloat, riga);
                        } else {
                            cell.style.backgroundColor = "#ecfdf5"; 
                            cell.style.color = "#047857";
                        }
                    }

                    // --- 3. CLORO COMBINATO (TRATTAMENTO SHOCK) ---
                    if (cleanKey === 'cl. com') {
                        if (valoreFloat > 0.40) {
                            cell.style.backgroundColor = "#fee2e2";
                            cell.style.color = "#b91c1c";
                            cell.style.fontWeight = "bold";
                            cell.style.cursor = "pointer";
                            cell.title = "Clicca per il Trattamento Shock!";
                            cell.onclick = () => mostraDosiInOverlay('CloroCombinato', valoreFloat, riga);
                        } else {
                            cell.style.backgroundColor = "#ecfdf5";
                            cell.style.color = "#047857";
                        }
                    }

                    // --- 4. TEMPERATURA ---
                    if (cleanKey === 'temp') {
                        if (valoreFloat < 24.0 || valoreFloat > 30.0) {
                            cell.style.backgroundColor = "#fee2e2";
                            cell.style.color = "#b91c1c";
                            if (valoreFloat > 30.0) {
                                cell.style.cursor = "pointer";
                                cell.title = "Clicca per il calcolo del reintegro freddo a 12°C";
                                cell.onclick = () => mostraDosiInOverlay('Temperatura', valoreFloat, riga);
                            }
                        } else {
                            cell.style.backgroundColor = "#ecfdf5";
                            cell.style.color = "#047857";
                        }
                    }

                    // --- 5. ACIDO CIANURICO SOGLIA PREVENTIVA DI ALLARME (60 ppm) ---
                    if (cleanKey === 'cya') {
                        if (valoreFloat > 60.0) {
                            cell.style.backgroundColor = "#fee2e2";
                            cell.style.color = "#b91c1c";
                            cell.style.fontWeight = "bold";
                            cell.style.cursor = "pointer";
                            cell.title = "Clicca per calcolare lo scarico preventivo dell'acqua";
                            cell.onclick = () => mostraDosiInOverlay('CYA', valoreFloat, riga);
                        } else {
                            cell.style.backgroundColor = "#ecfdf5";
                            cell.style.color = "#047857";
                        }
                    }

                    // Cloro Totale (estetica passiva)
                    if (cleanKey === 'cl. tot') {
                        if (valoreFloat < 0.70 || valoreFloat > 2.40) {
                            cell.style.backgroundColor = "#fee2e2";
                            cell.style.color = "#b91c1c";
                        } else {
                            cell.style.backgroundColor = "#ecfdf5";
                        }
                    }
                });
            });
        }
    });
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) sez.className = 'register-section';
}

window.onload = function() {
    caricaTabelle();
    mostraSezione('chimicoSection');
};

function apriGrafico(parametro) {
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');

    if (containerDosi) containerDosi.style.display = 'none';
    if (canvas) canvas.style.display = 'block';

    title.innerText = `Andamento Storico Parametro: ${parametro}`;
    overlay.classList.remove('hidden');
}