// Variabili globali e configurazione parametri
let currentChart = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // Volume vasca in m³

// Mappatura file CSV con timestamp per prevenire la cache del browser
const FILES = {
    chimico: "REGISTRO CHIMICO 2026.csv?t=" + new Date().getTime(),
    contatori: "REGISTRO CONTATORI.csv?t=" + new Date().getTime(),
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv?t=" + new Date().getTime(),
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv?t=" + new Date().getTime()
};

// Limiti per colorazione diagnostica condizionale delle celle
const LEGAL_RANGES = {
    "ph": { min: 6.5, max: 7.5, target: 7.3 },
    "cl. lib": { min: 0.7, max: 1.5, target: 1.1 },
    "cl. com": { min: 0.0, max: 0.4 },
    "temp": { min: 24.0, max: 30.0 },
    "cya": { min: 0.0, max: 60.0 } // Allarme impostato a 60 ppm
};

// Avvio dell'applicazione
document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    Object.keys(FILES).forEach(chiave => {
        Papa.parse(FILES[chiave], {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(results) {
                elaboraDatiTabella(chiave, results.data);
            }
        });
    });
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length === 0) return;

    let indiceIntestazione = 0;
    
    // Rilevamento intestazione corretta ed eliminazione sporcizia iniziale generata da LibreOffice
    for (let i = 0; i < righeGrezze.length; i++) {
        let primaCella = (righeGrezze[i][0] || "").trim().toLowerCase();
        if (primaCella.includes("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    let intestazioni = righeGrezze[indiceIntestazione].map(h => (h || "").trim());
    let righeDati = righeGrezze.slice(indiceIntestazione + 1);

    // Pulizia e filtraggio dinamico delle righe vuote o spezzate
    let righePulite = [];
    righeDati.forEach(riga => {
        let rigaVuota = riga.every(cella => !cella || cella.trim() === "" || cella.trim() === "0");
        if (rigaVuota) return;

        // Pulizia da ritorni a capo interni (\n) che spezzano la visualizzazione
        let rigaFormattata = riga.map(cella => cella ? cella.replace(/\r?\n|\r/g, " ").trim() : "");
        righePulite.push(rigaFormattata);
    });

    // Filtro specifico richiesto per Registro Pulizie (Colonna C / Indice 2 "Area Pulita")
    if (chiave === "pulizie") {
        let ultimoIndiceValido = -1;
        for (let i = 0; i < righePulite.length; i++) {
            let area = righePulite[i][2] || "";
            if (/[a-zA-Z]/.test(area)) {
                ultimoIndiceValido = i;
            }
        }
        if (ultimoIndiceValido !== -1) {
            righePulite = righePulite.slice(0, ultimoIndiceValido + 1);
        }
    }

    datiRegistriGlobali[chiave] = { headers: intestazioni, rows: righePulite };
    costruisciTabellaHTML(chiave, intestazioni, righePulite);
}

function costruisciTabellaHTML(chiave, intestazioni, righe) {
    const table = document.getElementById(chiave + "Table");
    if (!table) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => {
        let classeClick = ["ph", "cl. lib", "cl. com", "temp", "cya", "reintegro  (l)"].includes(h.toLowerCase()) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    righe.forEach((riga, rigaIdx) => {
        html += "<tr>";
        intestazioni.forEach((header, colIdx) => {
            let valore = riga[colIdx] || "";
            let classeCella = "";
            let attributiAggiuntivi = "";

            let hId = header.toLowerCase();
            if (LEGAL_RANGES[hId]) {
                let num = parseFloat(valore.replace(",", "."));
                if (!isNaN(num)) {
                    let limiti = LEGAL_RANGES[hId];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${header}', '${valore}')"`;
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

// Mostra la sezione ed esegue lo scorrimento automatico fino alle ultime modifiche reali
function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    
    const sezione = document.getElementById(sezioneId);
    if (!sezione) return;
    
    sezione.classList.remove('hidden');

    let chiave = sezioneId.replace("Section", "");
    let dati = datiRegistriGlobali[chiave];

    if (!dati || dati.rows.length === 0) return;

    let rigaTargetIndice = dati.rows.length - 1; // Di base punta all'ultima riga del foglio pulito

    // Logiche di puntamento millimetrico basate sulle colonne scelte
    if (chiave === "contatori") {
        // Colonna B (Contatore Reintegro, Indice 1)
        for (let i = dati.rows.length - 1; i >= 0; i--) {
            if (dati.rows[i][1] && dati.rows[i][1].trim() !== "" && dati.rows[i][1].trim() !== "0") {
                rigaTargetIndice = i;
                break;
            }
        }
    } else if (chiave === "manutenzioni") {
        // Colonna B (Impianto/Area, Indice 1)
        for (let i = dati.rows.length - 1; i >= 0; i--) {
            if (dati.rows[i][1] && dati.rows[i][1].trim() !== "") {
                rigaTargetIndice = i;
                break;
            }
        }
    }

    // Esegui lo scroll armonico fino alla riga individuata
    setTimeout(() => {
        const tabella = document.getElementById(chiave + "Table");
        if (tabella) {
            const righeTabella = tabella.querySelectorAll("tbody tr");
            if (righeTabella[rigaTargetIndice]) {
                righeTabella[rigaTargetIndice].scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, 150);
}

// Funzione Unica di Diagnostica e Calcolo - Stile Foto 1 Garantito per ogni cella rossa
function apriFinestraDosaggio(parametro, valore) {
    const modal = document.getElementById("dosageModal");
    const content = document.getElementById("dosageContent");
    let valNum = parseFloat(valore.replace(",", "."));
    let pId = parametro.toLowerCase();
    
    let testoDettaglio = `<h3>⚠️ Parametro Fuori Limite: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore riscontrato in vasca: <strong>${valore}</strong></p>`;

    if (pId === "ph") {
        if (valNum > 7.5) {
            let delta = valNum - 7.3;
            let grammiPerMetroCubo = 10; 
            let doseTotale = Math.round(delta * 10 * grammiPerMetroCubo * VOL_PISCINA);
            testoDettaglio += `<p>Il livello del pH è troppo alto rispetto al bersaglio ideale di 7.3.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Immettere nello skimmer circa <strong>${(doseTotale/1000).toFixed(2)} Kg</strong> di Correttore pH Meno (Acido Secco).</p>`;
        } else if (valNum < 6.5) {
            let delta = 7.3 - valNum;
            let doseTotale = Math.round(delta * 10 * 10 * VOL_PISCINA);
            testoDettaglio += `<p>Il livello del pH è pericolosamente basso rispetto al bersaglio ideale di 7.3.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Aggiungere circa <strong>${(doseTotale/1000).toFixed(2)} Kg</strong> di Correttore pH Più (Carbonato di Sodio).</p>`;
        }
    } else if (pId === "cl. lib") {
        if (valNum < 0.7) {
            let delta = 1.1 - valNum;
            let grammiPerM3 = delta / 0.65; 
            let doseTotale = Math.round(grammiPerM3 * VOL_PISCINA);
            testoDettaglio += `<p>Il valore del Cloro Libero è inferiore alla soglia minima di sicurezza sanitaria (0.7 ppm).</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Integrare con <strong>${doseTotale} grammi</strong> di Ipoclorito di Calcio granulare direttamente in vasca.</p>`;
        } else if (valNum > 1.5) {
            testoDettaglio += `<p>La concentrazione di Cloro Libero è superiore al limite massimo consentito di 1.5 ppm.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Sospendere i dosaggi e attendere il consumo naturale del disinfettante dovuto all'irraggiamento solare prima di consentire la balneazione.</p>`;
        }
    } else if (pId === "cya") {
        if (valNum > 60.0) {
            testoDettaglio += `<p>L'Acido Cianurico (Stabilizzante) ha superato la soglia critica di attenzione di 60 ppm.</p>`;
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> È indispensabile procedere ad uno svuotamento parziale della vasca e reintegrare con acqua fresca per diluire il parametro ed evitare il blocco del cloro.</p>`;
        }
    } else {
        testoDettaglio += `<p>Il valore registrato non rientra negli intervalli ottimali previsti dal piano di autocontrollo.</p>`;
        testoDettaglio += `<p><strong>Azione Correttiva:</strong> Verificare i sistemi di filtrazione e procedere ad un controllo manuale di riscontro.</p>`;
    }

    content.innerHTML = testoDettaglio;
    modal.classList.remove("hidden");
}

function chiudiDosaggio() {
    document.getElementById("dosageModal").classList.add("hidden");
}

// Logica per l'apertura e la visualizzazione dei grafici storici
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
        let valNum = parseFloat(valStr.replace(",", "."));

        if (!isNaN(valNum)) {
            etichette.push(dataOra.trim());
            valori.push(valNum);
        }
    });

    if (valori.length === 0) return;

    document.getElementById("overlayTitle").innerText = "Andamento Storico: " + parametro;
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
                backgroundColor: 'rgba(0, 102, 204, 0.1)',
                borderWidth: 2,
                tension: 0.15,
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