// === CONFIGURAZIONE PARAMETRI PISCINA (Volume Vasca: 92 m³) ===
const PISCINA_CONFIG = {
    target: { ph: 7.30, cloro: 1.5 },
    prodotti: {
        phMeno: { nome: "pH- (Acido Sec)", dosePerCentesimo: 9.2 },          // 9.2g per 0.01 pH per 92mc
        cloroCa: { nome: "Cloro Granulare (Ipoclorito)", dosePerPpm: 1.84 }, // 1.84g per 0.01 ppm per 92mc (184g per 1 ppm)
        waterStop: { nome: "Water Stop (Abbattitore)", dosePerPpm: 2.76 }   // 2.76g per 0.01 ppm per 92mc
    }
};

// Funzione ausiliaria per la compensazione termica del cloro
function getFattoreTemperatura(temp) {
    if (isNaN(temp) || temp <= 28) return 1.0;
    if (temp <= 30) return 1.15; // +15%
    if (temp <= 32) return 1.30; // +30%
    return 1.45;                 // +45%
}

// === FUNZIONE INTERATTIVA: CALCOLA E MOSTRA LE DOSI NELL'OVERLAY AL CLIC ===
function mostraDosiInOverlay(parametro, valoreAttuale, rigaDati) {
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    
    // Contenitore personalizzato per la tabella delle dosi (lo creiamo se non esiste)
    let containerDosi = document.getElementById('overlayDosiContent');
    if (!containerDosi) {
        containerDosi = document.createElement('div');
        containerDosi.id = 'overlayDosiContent';
        canvas.parentNode.insertBefore(containerDosi, canvas);
    }

    // Reset della finestra popup: nascondiamo il grafico Canvas e mostriamo il testo delle dosi
    if (canvas) canvas.style.display = 'none';
    containerDosi.style.display = 'block';
    containerDosi.innerHTML = "";

    // Estraiamo la data e la temperatura per la diagnosi
    const dataRilevamento = rigaDati["Data"] || rigaDati["data"] || "Rilevamento";
    const oraRilevamento = rigaDati["Ora"] || rigaDati["ora"] || "";
    const tempAttuale = rigaDati["Temp"] || rigaDati["temp"] ? parseFloat(String(rigaDati["Temp"] || rigaDati["temp"]).replace(',', '.')) : NaN;
    
    const fattoreTemp = getFattoreTemperatura(tempAttuale);
    let consiglio = null;

    // --- ELABORAZIONE DOSI IN BASE AL PARAMETRO CLICCATO ---
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
            nota: "Sciogliere la polvere in un secchio d'acqua pulita e versare uniformemente in vasca davanti alle bocchette con filtrazione attiva."
        };
    } 
    else if (parametro === 'Cloro' && valoreAttuale < 0.7) {
        title.innerText = `🧪 Assistente Chimico - Dosaggio Cloro (${dataRilevamento} ore ${oraRilevamento})`;
        const deltaCloro = PISCINA_CONFIG.target.cloro - valoreAttuale;
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

    if (!consiglio) return;

    // Generazione dinamica della tabella dentro il popup
    containerDosi.innerHTML = `
        <div class="card-assistente" style="border-left: 6px solid #d73a49; margin-top: 10px;">
            <p class="sottotitolo-assistente">Calcolo automatico istantaneo tarato per il volume vasca di <strong>92 m³</strong>.</p>
            <table class="tabella-consigli">
                <thead>
                    <tr>
                        <th>Parametro</th>
                        <th>Stato Rilevato</th>
                        <th>Obiettivo Tecnico</th>
                        <th>Prodotto da Usare</th>
                        <th>Dose Esatta</th>
                        <th>Istruzioni Applicazione</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${consiglio.parametro}</strong></td>
                        <td><span class="badge badge-pericolo">${consiglio.stato}</span></td>
                        <td>${consiglio.azione}</td>
                        <td><em>${consiglio.prodotto}</em></td>
                        <td><span class="badge-dose">${consiglio.quantita}</span></td>
                        <td class="nota-testo">${consiglio.nota}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    overlay.classList.remove('hidden');
}

// === CHIUSURA BLINDATA POPUP ===
function closeOverlay() {
    const overlay = document.getElementById('chartOverlay');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');
    
    if (overlay) overlay.classList.add('hidden');
    if (canvas) canvas.style.display = 'block';
    if (containerDosi) containerDosi.style.display = 'none';
}

// === LETTURA E COSTRUZIONE VISIVA DELLE TABELLE ===
function caricaTabelle() {
    // Caricamento del file CSV principale
    Papa.parse("REGISTRO CHIMICO 2026.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const data = results.data;
            const table = document.getElementById("chimicoTable");
            table.innerHTML = "";
            
            if (data.length === 0) return;

            // Creazione Intestazione con pulsanti grafici
            let keys = Object.keys(data[0]);
            let thead = table.createTHead();
            let rowHead = thead.insertRow();
            keys.forEach(key => {
                let th = document.createElement("th");
                if (['ph', 'cl. lib', 'cl. tot', 'cl. com', 'temp', 'n.ospiti', 'cya'].includes(key.toLowerCase().trim())) {
                    th.innerHTML = `<button class="table-th-btn" onclick="apriGrafico('${key}')">${key} 📊</button>`;
                } else {
                    th.innerText = key;
                }
                rowHead.appendChild(th);
            });

            // Popolamento Righe Dati
            let tbody = table.createTBody();
            data.forEach(riga => {
                let row = tbody.insertRow();
                keys.forEach(key => {
                    let cell = row.insertCell();
                    let valoreTesto = riga[key] ? riga[key].trim() : "";
                    cell.innerText = valoreTesto;

                    let valoreFloat = parseFloat(valoreTesto.replace(',', '.'));

                    // Evidenziazione pH e attivazione clic interattivo
                    if (key.toLowerCase().trim() === 'ph' && !isNaN(valoreFloat)) {
                        if (valoreFloat > 7.50 || valoreFloat < 7.20) {
                            cell.className = "badge-pericolo";
                            if (valoreFloat > 7.50) {
                                cell.style.cursor = "pointer";
                                cell.title = "Clicca per calcolare la dose di pH-";
                                cell.onclick = () => mostraDosiInOverlay('pH', valoreFloat, riga);
                            }
                        } else {
                            cell.style.backgroundColor = "#ecfdf5"; // Verde ottimale
                        }
                    }

                    // Evidenziazione Cloro Libero e attivazione clic interattivo
                    if (key.toLowerCase().includes('cl. lib') && !isNaN(valoreFloat)) {
                        if (valoreFloat < 0.70 || valoreFloat > 2.00) {
                            cell.className = "badge-pericolo";
                            cell.style.cursor = "pointer";
                            cell.title = "Clicca per calcolare il dosaggio del Cloro";
                            cell.onclick = () => mostraDosiInOverlay('Cloro', valoreFloat, riga);
                        } else {
                            cell.style.backgroundColor = "#ecfdf5";
                        }
                    }

                    // Evidenziazione altri parametri fuori soglia (Solo colore)
                    if (key.toLowerCase().includes('cl. com') && valoreFloat > 0.40) cell.className = "badge-pericolo";
                    if (key.toLowerCase().includes('temp') && (valoreFloat < 24 || valoreFloat > 30)) cell.className = "badge-pericolo";
                    if (key.toLowerCase().includes('cya') && valoreFloat > 50) cell.className = "badge-pericolo";
                });
            });
        }
    });
}

// Gestione dei menu e visualizzazione sezioni
function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sez = document.getElementById(sezioneId);
    if (sez) sez.classList.remove('hidden');
}

// Avvio della pagina
window.onload = function() {
    caricaTabelle();
    mostraSezione('chimicoSection'); // Mostra la sezione chimica come predefinita
};

// Funzione placeholder per i grafici (collegata ai pulsanti delle colonne)
function apriGrafico(parametro) {
    const overlay = document.getElementById('chartOverlay');
    const title = document.getElementById('overlayTitle');
    const canvas = document.getElementById('overlayCanvas');
    const containerDosi = document.getElementById('overlayDosiContent');

    if (containerDosi) containerDosi.style.display = 'none';
    if (canvas) canvas.style.display = 'block';

    title.innerText = `Andamento Storico Parametro: ${parametro}`;
    overlay.classList.remove('hidden');
    // Qui andrà l'eventuale logica di rendering del grafico Chart.js
}