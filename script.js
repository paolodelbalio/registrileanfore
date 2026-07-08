let currentChart = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; 

const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv"
};

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
        let hLower = h.toLowerCase();
        let classeClick = ["ph", "cl. lib", "cl. com", "temp", "cya", "reintegro  (l)"].includes(hLower) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    righe.forEach((riga, rIdx) => {
        html += "<tr>";
        intestazioni.forEach((header, colIdx) => {
            let valoreRaw = riga[colIdx] || "";
            let hId = header.toLowerCase();
            
            // Applica la formattazione a 2 decimali solo sulle colonne numeriche di controllo
            let valore = ["ph", "cl. lib", "cl. com", "temp", "cya"].includes(hId) ? formattaValoreNumerico(valoreRaw) : valoreRaw;
            
            let classeCella = "";
            let attributiAggiuntivi = "";

            if (LEGAL_RANGES[hId]) {
                let num = parseFloat(valore.replace(",", "."));
                if (!isNaN(num)) {
                    let limiti = LEGAL_RANGES[hId];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
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
    let pId = parametro.toLowerCase();
    
    let chimico = datiRegistriGlobali.chimico;
    let headers = chimico ? chimico.headers : [];
    let rigaCorrente = (chimico && chimico.rows) ? chimico.rows[rigaIndice] : [];

    let oraIdx = headers.findIndex(h => h.toLowerCase() === "ora");
    let tempIdx = headers.findIndex(h => h.toLowerCase() === "temp");
    let bagnantiIdx = headers.findIndex(h => h.toLowerCase() === "n.ospiti");

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : 25;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;
    if (isNaN(tempVasca)) tempVasca = 25;

    let testoDettaglio = `<h3>Diagnostica Dosaggio: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore fuori limite: <strong style="color:#721c24;">${valore}</strong> (Target ideale: ${LEGAL_RANGES[pId]?.target || '-' })</p>`;
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
    } else if (pId === "cya") {
        if (valNum > 60.0) {
            let svuotamentoPerc = Math.round(((valNum - 40) / valNum) * 100);
            let litriReintegro = Math.round((svuotamentoPerc / 100) * VOL_PISCINA * 1000);
            testoDettaglio += `<p><strong>Criticità Acido Cianurico:</strong> Il cloro è parzialmente bloccato. Effettuare un ricambio parziale d'acqua del <strong>${svuotamentoPerc}%</strong> (circa <strong>${litriReintegro.toLocaleString()} litri</strong>).</p>`;
        }
    } else {
        testoDettaglio += `<p>Valore fuori norma. Monitorare alla prossima lettura.</p>`;
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