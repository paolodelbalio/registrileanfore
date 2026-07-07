// CONFIGURAZIONI PARAMETRI E TARGET
const VOLUME_PISCINA = 92; 
const TARGET_PH = 7.3;
const TARGET_CLORO = 1.1;
const ALLARME_CYA = 60;

// DATI PRELEVATI DAL FILE CSV
const databaseLettureStoriche = [
    { data: "16 Mag 2026 08:30", ph: 7.3, cloro: 1.20, cya: 40, rabbocco: 0, contatore: 1240, lavaggio: "No", filtri: "Ok", trasparenza: "Limpida", note: "Apertura stagione" },
    { data: "01 Giu 2026 08:00", ph: 7.4, cloro: 1.10, cya: 45, rabbocco: 1000, contatore: 1241, lavaggio: "Lavaggio Filtro", filtri: "Ok", trasparenza: "Limpida", note: "Rabbocco ordinario" },
    { data: "15 Giu 2026 08:15", ph: 7.2, cloro: 1.30, cya: 50, rabbocco: 0, contatore: 1241, lavaggio: "No", filtri: "Ok", trasparenza: "Limpida", note: "Parametri regolari" },
    { data: "02 Lug 2026 18:00", ph: 7.3, cloro: 1.20, cya: 55, rabbocco: 0, contatore: 1241, lavaggio: "No", filtri: "Ok", trasparenza: "Limpida", note: "Controlli stabili" },
    { data: "03 Lug 2026 09:00", ph: 7.5, cloro: 1.10, cya: 55, rabbocco: 1500, contatore: 1242.5, lavaggio: "No", filtri: "Ok", trasparenza: "Limpida", note: "Caldo intenso" },
    { data: "04 Lug 2026 07:00", ph: 7.3, cloro: 0.51, cya: 55, rabbocco: 0, contatore: 1242.5, lavaggio: "No", filtri: "Ok", trasparenza: "Limpida", note: "Analisi mattutina Pool LAB" },
    { data: "05 Lug 2026 08:00", ph: 7.3, cloro: 1.10, cya: 55, rabbocco: 500, contatore: 1243, lavaggio: "Lavaggio Filtro", filtri: "Ok", trasparenza: "Limpida", note: "Ripristinato cloro granulare" },
    // Righe vuote del calendario generate fino a fine settembre
    { data: "06 Lug 2026 07:00", ph: null, cloro: null, cya: null, rabbocco: null, contatore: null, lavaggio: "", filtri: "", trasparenza: "", note: "" },
    { data: "07 Lug 2026 07:00", ph: null, cloro: null, cya: null, rabbocco: null, contatore: null, lavaggio: "", filtri: "", trasparenza: "", note: "" },
    { data: "08 Lug 2026 07:00", ph: null, cloro: null, cya: null, rabbocco: null, contatore: null, lavaggio: "", filtri: "", trasparenza: "", note: "" }
];

document.addEventListener("DOMContentLoaded", function() {
    caricaIQuattroRegistri(databaseLettureStoriche);
    inizializzaGraficiStorici(databaseLettureStoriche);
    
    // L'assistente chimico analizza l'ultima riga che contiene dati reali reali (es. riga dell'05 Lug)
    let ultimaLetturaValida = null;
    for (let i = databaseLettureStoriche.length - 1; i >= 0; i--) {
        if (databaseLettureStoriche[i].ph !== null && databaseLettureStoriche[i].cloro !== null) {
            ultimaLetturaValida = databaseLettureStoriche[i];
            break;
        }
    }
    if (ultimaLetturaValida) {
        elaboraAssistenteChimico(ultimaLetturaValida);
    }

    // Esegue lo scorrimento automatico focalizzandosi sulla riga vuota corrente
    setTimeout(scollaAdUltimaRigaCompilata, 300);
});

function caricaIQuattroRegistri(dati) {
    const chimicoBody = document.getElementById('corpo-registro-chimico');
    const acquaBody = document.getElementById('corpo-registro-acqua');
    const manutenzioneBody = document.getElementById('corpo-registro-manutenzione');
    const sicurezzaBody = document.getElementById('corpo-registro-sicurezza');

    chimicoBody.innerHTML = ''; acquaBody.innerHTML = ''; manutenzioneBody.innerHTML = ''; sicurezzaBody.innerHTML = '';

    dati.forEach(r => {
        // 1. Registro Chimico
        const rigaChimica = document.createElement('tr');
        let cellPh = r.ph !== null ? r.ph.toFixed(1) : '-';
        let cellCloro = r.cloro !== null ? r.cloro.toFixed(2) : '-';
        let cellCya = r.cya !== null ? r.cya + ' ppm' : '-';
        
        let classPh = r.ph === null ? 'cell-normal' : (r.ph === TARGET_PH ? 'cell-green' : 'cell-red');
        let classCloro = r.cloro === null ? 'cell-normal' : (r.cloro >= TARGET_CLORO ? 'cell-green' : 'cell-red');
        let classCya = r.cya === null ? 'cell-normal' : (r.cya < ALLARME_CYA ? 'cell-green' : 'cell-red');

        rigaChimica.innerHTML = `
            <td><strong>${r.data}</strong></td>
            <td class="${classPh}">${cellPh}</td>
            <td class="${classCloro}">${cellCloro}</td>
            <td class="${classCya}">${cellCya}</td>
            <td>${r.note || ''}</td>
        `;
        chimicoBody.appendChild(rigaChimica);

        // 2. Registro Contatori
        const rigaAcqua = document.createElement('tr');
        rigaAcqua.innerHTML = `
            <td><strong>${r.data.split(' ')[0] + ' ' + r.data.split(' ')[1]}</strong></td>
            <td>${r.contatore !== null ? r.contatore + ' m³' : '-'}</td>
            <td>${r.rabbocco !== null && r.rabbocco > 0 ? r.rabbocco + ' L' : '-'}</td>
            <td>${r.rabbocco !== null && r.rabbocco > 0 ? 'Rabbocco vasca' : '-'}</td>
        `;
        acquaBody.appendChild(rigaAcqua);

        // 3. Registro Manutenzione
        const rigaManutenzione = document.createElement('tr');
        rigaManutenzione.innerHTML = `
            <td><strong>${r.data}</strong></td>
            <td>${r.lavaggio || '-'}</td>
            <td>${r.lavaggio && r.lavaggio !== "No" ? "5 min" : "-"}</td>
            <td>${r.lavaggio && r.lavaggio !== "No" ? "Stato filtri ottimale dopo contropressione" : "-"}</td>
        `;
        manutenzioneBody.appendChild(rigaManutenzione);

        // 4. Registro Sicurezza
        const rigaSicurezza = document.createElement('tr');
        let classTrasparenza = r.trasparenza === '' ? 'cell-normal' : (r.trasparenza === 'Limpida' ? 'cell-green' : 'cell-red');
        rigaSicurezza.innerHTML = `
            <td><strong>${r.data.split(' ')[0] + ' ' + r.data.split(' ')[1]}</strong></td>
            <td>${r.filtri || '-'}</td>
            <td class="${classTrasparenza}">${r.trasparenza || '-'}</td>
            <td>${r.filtri ? 'Idoneo' : '-'}</td>
            <td>${r.filtri ? 'Paolo - Supervisione' : '-'}</td>
        `;
        sicurezzaBody.appendChild(rigaSicurezza);
    });
}

// LOGICA SCORRIMENTO MODIFICATA: Scorre dall'alto verso il basso e si ferma alla prima riga vuota trovata
function scollaAdUltimaRigaCompilata() {
    const tabelle = document.querySelectorAll('.registro-table');
    
    tabelle.forEach(tabella => {
        const container = tabella.closest('.table-responsive');
        if (!container) return;

        const righe = tabella.rows;
        let rigaTargetIndice = -1;

        // Cerca la prima riga vuota dall'alto (indice 1 salta l'intestazione)
        for (let i = 1; i < righe.length; i++) {
            let rigaVuota = true;
            const celle = righe[i].cells;
            
            // Controlla se le celle dei parametri (escludendo la colonna della data alla posizione 0) sono vuote
            for (let j = 1; j < celle.length; j++) {
                let testocella = celle[j].innerText.trim();
                if (testocella !== "" && testocella !== "-") {
                    rigaVuota = false;
                    break;
                }
            }
            
            // Se troviamo la riga vuota corrente, ci fermiamo qui
            if (rigaVuota) {
                rigaTargetIndice = i;
                break;
            }
        }

        // Se non trova nessuna riga vuota, va all'ultima riga disponibile
        if (rigaTargetIndice === -1) {
            rigaTargetIndice = righe.length - 1;
        }

        if (rigaTargetIndice > 0 && righe[rigaTargetIndice]) {
            container.scrollTop = righe[rigaTargetIndice].offsetTop - righe[0].offsetHeight;
        }
    });
}

function elaboraAssistenteChimico(lettura) {
    const container = document.getElementById('container-assistente-chimico');
    let righeHTML = '';
    let anomalie = false;

    if (lettura.cloro < TARGET_CLORO) {
        anomalie = true;
        const deltaCloro = (TARGET_CLORO - lettura.cloro).toFixed(2);
        const doseGrammi = Math.round(deltaCloro * 15 * VOLUME_PISCINA);

        righeHTML += `
            <tr>
                <td><span class="param-name">Cloro Libero</span></td>
                <td><div class="badge-low">Basso (${lettura.cloro} ppm)</div></td>
                <td class="objective-text">Aumentare di ${deltaCloro} ppm per raggiungere la quota ideale di ${TARGET_CLORO} ppm</td>
                <td class="product-text">Cloro Granulare (Ipoclorito)</td>
                <td><div class="dose-box">${doseGrammi} grammi</div></td>
                <td class="instruction-text">Dosaggio rapido granulare. Sciogliere preventivamente o aggiungere negli skimmer.</td>
            </tr>
        `;
    }

    if (anomalie) {
        container.innerHTML = `
            <div class="assistant-card">
                <div class="assistant-title">🧪 Assistente Chimico - Dosaggi e Allarmi (${lettura.data})</div>
                <div class="assistant-table-container">
                    <div class="status-indicator-bar"></div>
                    <table class="assistant-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">Parametro</th>
                                <th style="width: 12%;">Stato</th>
                                <th style="width: 25%;">Obiettivo</th>
                                <th style="width: 15%;">Prodotto</th>
                                <th style="width: 13%;">Dose</th>
                                <th style="width: 20%;">Istruzioni</th>
                            </tr>
                        </thead>
                        <tbody>${righeHTML}</tbody>
                    </table>
                </div>
            </div>
        `;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

function inizializzaGraficiStorici(dati) {
    // Filtra solo i record reali popolati per non sporcare il grafico con i null futuri
    const datiFiltrati = dati.filter(d => d.ph !== null && d.cloro !== null);
    const etichette = datiFiltrati.map(d => d.data.split(' ')[0] + ' ' + d.data.split(' ')[1]);

    // Grafico 1: Parametri Chimici con bende colorate native di sfondo
    new Chart(document.getElementById('chartAnalisiChimiche'), {
        type: 'line',
        data: {
            labels: etichette,
            datasets: [
                {
                    label: 'Cloro Libero (ppm)',
                    data: datiFiltrati.map(d => d.cloro),
                    borderColor: '#0284c7',
                    yAxisID: 'yCloro',
                    tension: 0.15
                },
                {
                    label: 'pH',
                    data: datiFiltrati.map(d => d.ph),
                    borderColor: '#10b981',
                    yAxisID: 'yPh',
                    tension: 0.15
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                yCloro: { type: 'linear', position: 'left', min: 0, max: 3, title: { display: true, text: 'Cloro' } },
                yPh: { type: 'linear', position: 'right', min: 6.8, max: 8.0, title: { display: true, text: 'pH' }, grid: { drawOnChartArea: false } }
            }
        },
        plugins: [{
            id: 'sfondoFasce',
            beforeDraw: (chart) => {
                const { ctx, chartArea: { top, bottom, left, right }, scales: { yPh } } = chart;
                ctx.save();
                // Banda pH ideale verde (7.2 - 7.4)
                let pTop = yPh.getPixelForValue(7.4);
                let pBot = yPh.getPixelForValue(7.2);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
                ctx.fillRect(left, pTop, right - left, pBot - pTop);
                ctx.restore();
            }
        }]
    });

    // Grafico 2: Consumo Idrico / Reintegri
    new Chart(document.getElementById('chartVolumeAcqua'), {
        type: 'bar',
        data: {
            labels: etichette,
            datasets: [{
                label: 'Rabbocchi Acqua (Litri)',
                data: datiFiltrati.map(d => d.rabbocco),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: '#3b82f6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 20000, ticks: { stepSize: 500 }, title: { display: true, text: 'Litri' } }
            }
        }
    });
}