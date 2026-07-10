let graficoCorrente = null;
let datiChimicoGlobali = [];
const VOL_PISCINA = 92; // 92 m³ costanti

document.addEventListener("DOMContentLoaded", () => {
    caricaRegistroChimico();
});

function caricaRegistroChimico() {
    // Usiamo header: true così leggiamo i dati tramite il nome della colonna
    Papa.parse("REGISTRO CHIMICO 2026.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(risultati) {
            if (risultati.data && risultati.data.length > 0) {
                datiChimicoGlobali = risultati.data;
                creaTabellaChimica(risultati.data);
                analizzaParametriECalcolaDosaggi(risultati.data);
            }
        }
    });
}

function creaTabellaChimica(dati) {
    const tabella = document.getElementById("chimicoTable");
    if (!tabella) return;

    // 1. Rigeneriamo le intestazioni esatte rendendole TUTTE interattive e cliccabili
    let chiavi = Object.keys(dati[0]);
    let html = "<thead><tr>";
    
    chiavi.forEach(chiave => {
        let nomeVisualizzato = chiave.trim();
        
        // Assegniamo i colori e il tipo di grafico corretto per ciascuna colonna al click
        if (nomeVisualizzato.toLowerCase() === 'ph') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'pH', '#ff6384', 'line')" style="cursor:pointer; text-decoration:underline;">pH</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'cl. lib') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Libero', '#36a2eb', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Lib</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'cl. tot') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Totale', '#4bc0c0', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Tot</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'cl. com') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Combinato', '#ff9f40', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Com</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'temp') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Temperatura', '#ffcd56', 'line')" style="cursor:pointer; text-decoration:underline;">Temp</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'n.ospiti') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Numero Ospiti', '#9966ff', 'bar')" style="cursor:pointer; text-decoration:underline;">N.Ospiti</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'cya') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Acido Cianurico', '#c9cbcf', 'line')" style="cursor:pointer; text-decoration:underline;">Cya</th>`;
        } else if (nomeVisualizzato.toLowerCase() === 'alka') {
            html += `<th onclick="apriGraficoChimico('${chiave}', 'Alcalinità', '#22c55e', 'line')" style="cursor:pointer; text-decoration:underline;">Alka</th>`;
        } else {
            html += `<th>${nomeVisualizzato}</th>`;
        }
    });
    html += "</tr></thead><tbody>";

    // 2. Popoliamo le celle applicando i filtri di stabilità e di legge
    dati.forEach(riga => {
        // Salta le righe totalmente vuote
        if (!riga.Data && !riga.Ora) return;

        html += "<tr>";
        chiavi.forEach(chiave => {
            let valoreTesto = riga[chiave] ? riga[chiave].trim() : "";
            let classeColore = "";

            if (valoreTesto !== "") {
                let v = parseFloat(valoreTesto.replace(",", "."));
                let nomeChiaveBasso = chiave.trim().toLowerCase();

                if (!isNaN(v)) {
                    // Logica Filtro pH
                    if (nomeChiaveBasso === 'ph') {
                        if (v === 7.3) classeColore = "evidenzia-verde";
                        else if (v >= 7.2 && v <= 7.4) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                    // Logica Filtro Cloro Libero
                    if (nomeChiaveBasso === 'cl. lib') {
                        if (v === 1.1) classeColore = "evidenzia-verde";
                        else if (v >= 1.0 && v <= 1.2) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                    // Logica Filtro Cloro Combinato (Fuori limite di legge se > 0.4 ppm)
                    if (nomeChiaveBasso === 'cl. com') {
                        if (v <= 0.2) classeColore = "evidenzia-verde";
                        else if (v > 0.2 && v <= 0.4) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                    // Logica Filtro Acido Cianurico (Allarme impostato a 60 ppm)
                    if (nomeChiaveBasso === 'cya') {
                        if (v < 50) classeColore = "evidenzia-verde";
                        else if (v >= 50 && v < 60) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                }
            }

            html += `<td class="${classeColore}">${valoreTesto}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function analizzaParametriECalcolaDosaggi(dati) {
    if (dati.length === 0) return;
    
    // Recuperiamo l'ultima riga reale inserita nel registro
    let ultimaRiga = dati[dati.length - 1];

    // Estrazione dinamica basata sulle chiavi per evitare disallineamenti del CSV
    let phStr = ultimaRiga["pH"] || "";
    let clStr = ultimaRiga["Cl. Lib"] || "";
    let cyaStr = ultimaRiga["Cya"] || "";

    let ph = parseFloat(phStr.replace(",", "."));
    let cl = parseFloat(clStr.replace(",", "."));
    let cya = parseFloat(cyaStr.replace(",", "."));

    let consigli = [];

    // Calcolo Correzione pH Alto
    if (!isNaN(ph) && ph > 7.4) {
        let delta = ph - 7.3;
        let grammiTotali = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Fuori Limite di Legge (${ph}):</strong> Per rientrare al target ottimale di 7.3, immettere nello skimmer o in vasca circa <strong>${grammiTotali}g</strong> di riduttore di pH acico.`);
    } 
    // Calcolo Correzione pH Basso
    else if (!isNaN(ph) && ph < 7.2) {
        let delta = 7.3 - ph;
        let grammiTotali = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Sotto la Soglia di Stabilità (${ph}):</strong> Per rialzare il valore a 7.3, immettere circa <strong>${grammiTotali}g</strong> di pH Plus.`);
    }

    // Calcolo Correzione Cloro Basso (Reintegro con ipoclorito di calcio granulare)
    if (!isNaN(cl) && cl < 1.0) {
        let delta = 1.1 - cl;
        let grammiCloro = Math.round(delta * 1.5 * VOL_PISCINA);
        consigli.push(`<strong>Cloro Libero Insufficiente (${cl} ppm):</strong> Per raggiungere il livello ideale di 1.1 ppm, aggiungere uniformemente in vasca circa <strong>${grammiCloro}g</strong> di ipoclorito di calcio granulare.`);
    }

    // Allarme Acido Cianurico se uguale o superiore a 60 ppm
    if (!isNaN(cya) && cya >= 60) {
        consigli.push(`<strong>⚠️ ALLARME ACIDO CIANURICO SOGLIA CRITICA (${cya} ppm):</strong> Il valore ha superato il limite di allarme di 60 ppm. L'azione del cloro è parzialmente bloccata. È necessario sospendere prodotti stabilizzati e procedere con un ricambio parziale d'acqua.`);
    }

    // Se viene rilevata un'anomalia, forziamo l'apertura immediata della finestra modale
    if (consigli.length > 0) {
        const modal = document.getElementById("dosageModal");
        const contenitore = document.getElementById("dosageContent");
        if (modal && contenitore) {
            contenitore.innerHTML = `<h3>📋 Tabelle di Consiglio Trattamento</h3><br><p>${consigli.join('</p><br><p>')}</p>`;
            modal.classList.remove("hidden");
        }
    }
}

function apriGraficoChimico(chiaveFiltro, nomeParametro, coloreLinea, tipoGrafico) {
    const overlay = document.getElementById("chartOverlay");
    const ctx = document.getElementById("overlayCanvas")?.getContext("2d");
    if (!overlay || !ctx) return;

    document.getElementById("overlayTitle").textContent = "Andamento Storico: " + nomeParametro;
    overlay.classList.remove("hidden");

    let etichette = [];
    let valori = [];

    datiChimicoGlobali.forEach(riga => {
        let dataStr = riga["Data"] || "";
        let oraStr = riga["Ora"] || "";
        let dataOra = `${dataStr} ${oraStr}`.trim();
        
        let valStr = riga[chiaveFiltro] || "";
        let valNum = parseFloat(valStr.replace(",", "."));
        
        if (!isNaN(valNum) && dataOra !== "") {
            etichette.push(dataOra);
            valori.push(valNum);
        }
    });

    if (graficoCorrente) graficoCorrente.destroy();

    // Configurazione Chart.js: punti piccoli per le linee, barre piene per gli ospiti
    graficoCorrente = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: etichette,
            datasets: [{
                label: nomeParametro,
                data: valori,
                borderColor: coloreLinea,
                backgroundColor: tipoGrafico === 'bar' ? coloreLinea + '99' : 'transparent',
                borderWidth: 2,
                pointRadius: tipoGrafico === 'bar' ? 0 : 3,
                pointHoverRadius: tipoGrafico === 'bar' ? 0 : 5,
                tension: 0.15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function chiudiDosaggio() {
    document.getElementById("dosageModal")?.classList.add("hidden");
}

function closeOverlay() {
    document.getElementById("chartOverlay")?.classList.add("hidden");
    if (graficoCorrente) {
        graficoCorrente.destroy();
        graficoCorrente = null;
    }
}