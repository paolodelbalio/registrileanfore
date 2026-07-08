let currentChart = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; 

const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv"
};

// Limiti impostati e allineati alle modifiche richieste (CYA allarme a 60, Target pH 7.3 e Libero 1.1)
const LEGAL_RANGES = {
    "ph": { min: 6.5, max: 7.5, target: 7.3 },
    "cl. lib": { min: 0.7, max: 1.5, target: 1.1 },
    "cl. com": { min: 0.0, max: 0.4 },
    "temp": { min: 24.0, max: 30.0 },
    "cya": { min: 0.0, max: 60.0 }
};

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    Object.keys(FILES).forEach(chiave => {
        Papa.parse(FILES[chiave], {
            download: true,
            header: false,
            skipEmptyLines: false, // Non saltiamo le righe a caso per non sfasare gli indici
            complete: function(results) {
                elaboraDatiTabella(chiave, results.data);
            }
        });
    });
}

// Forziamo 2 decimali dopo la virgola per i dati numerici calcolati o grezzi
function formattaValoreNumerico(valoreStringa) {
    if (!valoreStringa || valoreStringa.trim() === "") return "";
    let pulito = valoreStringa.replace(/"/g, "").replace(",", ".");
    let num = parseFloat(pulito);
    if (isNaN(num)) return valoreStringa; 
    return num.toFixed(2).replace(".", ",");
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length === 0) return;

    // Troviamo la riga esatta dell'intestazione (quella che contiene la parola "Data")
    let indiceIntestazione = -1;
    for (let i = 0; i < righeGrezze.length; i++) {
        if (righeGrezze[i] && righeGrezze[i][0] && righeGrezze[i][0].toString().trim().toLowerCase().startsWith("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    if (indiceIntestazione === -1) {
        // Se non trova "Data", cerca la prima riga popolata
        for(let i=0; i<righeGrezze.length; i++) {
            if(righeGrezze[i].some(c => c && c.trim() !== "")) { indiceIntestazione = i; break; }
        }
    }
    if (indiceIntestazione === -1) indiceIntestazione = 0;

    let intestazioni = righeGrezze[indiceIntestazione].map(h => h ? h.trim() : "");
    let righeDati = righeGrezze.slice(indiceIntestazione + 1);

    // Filtriamo solo le righe che contengono effettivamente almeno un dato per non fare tabelle vuote infinite
    let righePulite = [];
    righeDati.forEach(riga => {
        if (riga.some(cella => cella && cella.trim() !== "")) {
            righePulite.push(riga.map(cella => cella ? cella.trim() : ""));
        }
    });

    // Taglio specifico per il registro pulizie (rimozione legenda finale)
    if (chiave === "pulizie") {
        let ultimoIndiceValido = -1;
        for (let i = 0; i < righePulite.length; i++) {
            if (/[a-zA-Z]/.test(righePulite[i][2] || "")) ultimoIndiceValido = i;
        }
        if (ultimoIndiceValido !== -1) righePulite = righePulite.slice(0, ultimoIndiceValido + 1);
    }

    datiRegistriGlobali[chiave] = { headers: intestazioni, rows: righePulite };
    costruisciTabellaHTML(chiave, intestazioni, righePulite);
}

function costruisciTabellaHTML(chiave, intestazioni, righe) {
    const table = document.getElementById(chiave + "Table");
    if (!table) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => {
        let hLower = h.toLowerCase().trim();
        // Cloro totale aggiunto alle intestazioni interattive per i grafici temporali
        let classeClick = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "reintegro  (l)"].includes(hLower) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    righe.forEach((riga, rIdx) => {
        html += "<tr>";

        // Estrazione e normalizzazione indici del cloro sulla riga corrente per controlli incrociati ordinati
        let idxLibero = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. lib");
        let idxTotale = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. tot");
        let idxCombinato = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. com");

        let clLibero = idxLibero !== -1 ? parseFloat((riga[idxLibero] || "").replace(/"/g, "").replace(",", ".")) : NaN;
        let clTotale = idxTotale !== -1 ? parseFloat((riga[idxTotale] || "").replace(/"/g, "").replace(",", ".")) : NaN;
        let clCombinato = idxCombinato !== -1 ? parseFloat((riga[idxCombinato] || "").replace(/"/g, "").replace(",", ".")) : NaN;

        // Se manca il dato esplicito del combinato, lo ricaviamo matematicamente dal totale
        if (isNaN(clCombinato) && !isNaN(clTotale) && !isNaN(clLibero)) {
            clCombinato = clTotale - clLibero;
        }

        intestazioni.forEach((header, colIdx) => {
            let valoreRaw = riga[colIdx] || "";
            let hId = header.toLowerCase().trim();
            
            // Forza la formattazione a due decimali solo per le colonne dei parametri chimici principali
            let valore = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya"].includes(hId) ? formattaValoreNumerico(valoreRaw) : valoreRaw;
            
            let classeCella = "";
            let attributiAggiuntivi = "";
            let num = parseFloat(valoreRaw.replace(/"/g, "").replace(",", "."));

            if (!isNaN(num) || hId === "cl. tot" || hId === "cl. com") {
                
                // 1. PARAMETRI AGGIUNTIVI FISSI (pH, Temperatura, Acido Cianurico)
                if (["ph", "temp", "cya"].includes(hId) && LEGAL_RANGES[hId]) {
                    let limiti = LEGAL_RANGES[hId];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                } 
                // 2. CONTROLLO DI LEGGE CLORO LIBERO
                else if (hId === "cl. lib" && LEGAL_RANGES["cl. lib"]) {
                    let limiti = LEGAL_RANGES["cl. lib"];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                }
                // 3. CONTROLLO DI LEGGE CLORO COMBINATO (Toscana Allegato A: Max 0,4 ppm)
                else if (hId === "cl. com" && !isNaN(clCombinato)) {
                    if (clCombinato > 0.4) {
                        classeCella = "class='cell-alarm'"; 
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                }
                // 4. COLORAZIONE DINAMICA E INTEGRATA DEL CLORO TOTALE
                else if (hId === "cl. tot") {
                    let combinatoFuori = (!isNaN(clCombinato) && clCombinato > 0.4);
                    let liberoFuori = (!isNaN(clLibero) && (clLibero < LEGAL_RANGES["cl. lib"].min || clLibero > LEGAL_RANGES["cl. lib"].max));
                    
                    if (combinatoFuori || liberoFuori) {
                        // Se il combinato è molto alto (>0.5), forziamo la cella del totale in ROSSO critico
                        if (!isNaN(clCombinato) && clCombinato > 0.5) {
                            classeCella = "class='cell-alarm'";
                        } else {
                            // Negli altri casi di squilibrio leggero, si accende in ARANCIONE (Stile inline per preservare i testi scuri)
                            classeCella = "style='background-color: rgba(251, 191, 36, 0.25); color: #b45309; font-weight: bold;'";
                        }
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else if (!isNaN(clLibero) && !isNaN(clTotale)) {
                        classeCella = "class='cell-ok'"; // Bilanciamento perfetto tra le parti: VERDE
                    }
                }
            }
            html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    table.innerHTML = html;
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sezione = document.getElementById(sezioneId);
    if (!sezione) return;
    
    sezione.classList.remove('hidden');
    let chiave = sezioneId.replace("Section", "");
    let dati = datiRegistriGlobali[chiave];
    if (!dati || !dati.rows || dati.rows.length === 0) return;

    // Scroll automatico sull'ultimo dato inserito della colonna principale
    let rigaTargetIndice = dati.rows.length - 1;
    let colTarget = (chiave === "chimico") ? 2 : 1;
    for (let i = dati.rows.length - 1; i >= 0; i--) {
        if (dati.rows[i][colTarget] && dati.rows[i][colTarget].trim() !== "" && dati.rows[i][colTarget].trim() !== "0") {
            rigaTargetIndice = i;
            break;
        }
    }

    setTimeout(() => {
        const tabella = document.getElementById(chiave + "Table");
        if (tabella) {
            const righeTabella = tabella.querySelectorAll("tbody tr");
            if (righeTabella[rigaTargetIndice]) {
                righeTabella[rigaTargetIndice].scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, 50);
}

function apriFinestraDosaggio(parametro, valore, rigaIndice) {
    const modal = document.getElementById("dosageModal");
    const content = document.getElementById("dosageContent");
    let valNum = parseFloat(valore.replace(",", "."));
    let pId = parametro.toLowerCase().trim();
    
    let chimico = datiRegistriGlobali.chimico;
    let headers = chimico ? chimico.headers : [];
    let rigaCorrente = (chimico && chimico.rows) ? chimico.rows[rigaIndice] : [];

    let oraIdx = headers.findIndex(h => h.toLowerCase().trim() === "ora");
    let tempIdx = headers.findIndex(h => h.toLowerCase().trim() === "temp");
    let bagnantiIdx = headers.findIndex(h => h.toLowerCase().trim() === "n.ospiti");

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : 25;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;
    if (isNaN(tempVasca)) tempVasca = 25;

    let targetIdeale = LEGAL_RANGES[pId]?.target || (LEGAL_RANGES[pId] ? LEGAL_RANGES[pId].min + " - " + LEGAL_RANGES[pId].max : '-');
    let testoDettaglio = `<h3>Diagnostica Dosaggio: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore fuori limite: <strong style="color:#721c24;">${valore}</strong> (Fascia/Target ideale: ${targetIdeale})</p>`;
    testoDettaglio += `<p style="font-size:0.85rem; background:#eee; padding:6px; margin: 10px 0;">
        Contesto: Ore ${oraRilevamento || 'N.D.'} | Temp Acqua: ${tempVasca}°C | Ospiti: ${numBagnanti}
    </p>`;

    if (pId === "ph") {
        if (valNum > 7.5) {
            let delta = valNum - 7.3;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000);
            if (tempVasca > 28) doseKg *= 1.15; 
            testoDettaglio += `<p><strong>Azione:</strong> Aggiungere nello skimmer o vasca di compenso <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong>.</p>`;
        } else if (valNum < 6.5) {
            let delta = 7.3 - valNum;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000);
            testoDettaglio += `<p><strong>Azione:</strong> Immettere in vasca <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Più</strong>.</p>`;
        }
    } else if (pId === "cl. lib") {
        if (valNum < 0.7) {
            let delta = 1.1 - valNum;
            let grammiIpoclorito = Math.round((delta / 0.65) * VOL_PISCINA);
            if (tempVasca > 27) grammiIpoclorito = Math.round(grammiIpoclorito * 1.20);
            if (numBagnanti > 12) grammiIpoclorito = Math.round(grammiIpoclorito * 1.25);
            testoDettaglio += `<p><strong>Azione:</strong> Sciogliere e distribuire in vasca <strong>${grammiIpoclorito} grammi</strong> di <strong>Ipoclorito di Calcio granulare</strong>.</p>`;
        } else if (valNum > 1.5) {
            testoDettaglio += `<p><strong>Nota:</strong> Livello alto. Sospendere momentaneamente le immissioni di cloro e attendere il consumo biologico naturale.</p>`;
        }
    } else if (pId === "cl. tot" || pId === "cl. com") {
        testoDettaglio += `<p><strong>Nota Clorammine alte:</strong> Il Cloro combinato o totale risulta sbilanciato rispetto alla normativa (Cloro combinato > 0.40 mg/l). Effettuare un controlavaggio accurato del filtro e valutare un ricambio parziale d'acqua per abbattere i residui legati chimicamente.</p>`;
    } else if (pId === "cya") {
        if (valNum > 60.0) {
            let svuotamentoPerc = Math.round(((valNum - 40) / valNum) * 100);
            let litriReintegro = Math.round((svuotamentoPerc / 100) * VOL_PISCINA * 1000);
            testoDettaglio += `<p><strong>Criticità Acido Cianurico:</strong> Il cloro è parzialmente bloccato dall'eccesso di stabilizzante. Effettuare un ricambio parziale d'acqua del <strong>${svuotamentoPerc}%</strong> (circa <strong>${litriReintegro.toLocaleString()} litri</strong>) per scendere sotto la soglia critica.</p>`;
        }
    } else {
        testoDettaglio += `<p>Valore fuori norma. Monitorare attentamente alla prossima lettura di vasca.</p>`;
    }

    content.innerHTML = testoDettaglio;
    modal.classList.remove("hidden");
}

function chiudiDosaggio() {
    document.getElementById("dosageModal").classList.add("hidden");
}

function gestisciClickIntestazione(chiave, parametro) {
    let dati = datiRegistriGlobali[chiave];
    if (!dati) return;

    let colIdx = dati.headers.indexOf(parametro);
    if (colIdx === -1) return;

    let etichette = [];
    let valori = [];

    dati.rows.forEach(riga => {
        let dataOra = (riga[0] || "") + " " + (riga[1] || "");
        let valStr = riga[colIdx] || "";
        let valNum = parseFloat(valStr.replace(/"/g, "").replace(",", "."));

        if (!isNaN(valNum)) {
            etichette.push(dataOra.trim());
            valori.push(valNum);
        }
    });

    if (valori.length === 0) return;

    document.getElementById("overlayTitle").innerText = "Andamento: " + parametro;
    document.getElementById("chartOverlay").classList.remove("hidden");

    const ctx = document.getElementById("overlayCanvas").getContext("2d");
    if (currentChart) { currentChart.destroy(); }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etichette,
            datasets: [{
                label: parametro,
                data: valori,
                borderColor: '#0066cc',
                backgroundColor: 'rgba(0, 102, 204, 0.05)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } }
        }
    });
}

function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (currentChart) { currentChart.destroy(); currentChart = null; }
}