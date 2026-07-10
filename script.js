let graficoCorrente = null;
let datiChimicoGlobali = [];
const VOL_PISCINA = 92; 

document.addEventListener("DOMContentLoaded", () => {
    caricaRegistroChimico();
});

function caricaRegistroChimico() {
    Papa.parse("REGISTRO CHIMICO 2026.csv", {
        download: true,
        header: false,
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

function creaTabellaChimica(righe) {
    const tabella = document.getElementById("chimicoTable");
    if (!tabella) return;

    let html = "<thead><tr>";
    if (righe[0]) {
        righe[0].forEach((colonna, idx) => {
            let nome = colonna.replace(/"/g, "").trim();
            // Cliccando sul testo dell'intestazione si apre il grafico, senza icone esterne
            if (nome.toLowerCase() === 'ph') {
                html += `<th onclick="apriGraficoChimico(${idx}, 'pH', '#ff6384')" style="cursor:pointer; text-decoration:underline;">pH</th>`;
            } else if (nome.toLowerCase() === 'cl. lib') {
                html += `<th onclick="apriGraficoChimico(${idx}, 'Cloro Libero', '#36a2eb')" style="cursor:pointer; text-decoration:underline;">Cl. Lib</th>`;
            } else {
                html += `<th>${nome}</th>`;
            }
        });
        html += "</tr></thead><tbody>";
    }

    for (let i = 1; i < righe.length; i++) {
        let riga = righe[i];
        if (!riga || riga.length === 0) continue;

        html += "<tr>";
        riga.forEach((cella, colIdx) => {
            let valoreTesto = cella.replace(/"/g, "").trim();
            let classeColore = "";

            if (valoreTesto !== "") {
                let v = parseFloat(valoreTesto.replace(",", "."));
                if (!isNaN(v)) {
                    // Colonna pH
                    if (colIdx === 2) {
                        if (v === 7.3) classeColore = "evidenzia-verde";
                        else if (v >= 7.2 && v <= 7.4) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                    // Colonna Cloro Libero
                    if (colIdx === 3) {
                        if (v === 1.1) classeColore = "evidenzia-verde";
                        else if (v >= 1.0 && v <= 1.2) classeColore = "evidenzia-giallo";
                        else classeColore = "evidenzia-rosso";
                    }
                }
            }
            html += `<td class="${classeColore}">${valoreTesto}</td>`;
        });
        html += "</tr>";
    }
    html += "</tbody>";
    tabella.innerHTML = html;
}

function analizzaParametriECalcolaDosaggi(righe) {
    if (righe.length < 2) return;
    let ultimaRiga = righe[righe.length - 1];

    let ph = parseFloat(ultimaRiga[2]?.replace(",", "."));
    let cl = parseFloat(ultimaRiga[3]?.replace(",", "."));
    let cya = parseFloat(ultimaRiga[8]?.replace(",", "."));

    let consigli = [];

    if (!isNaN(ph) && ph > 7.4) {
        let delta = ph - 7.3;
        let grammiTotali = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Fuori Limite (${ph}):</strong> Immettere circa <strong>${grammiTotali}g</strong> di riduttore acido.`);
    } else if (!isNaN(ph) && ph < 7.2) {
        let delta = 7.3 - ph;
        let grammiTotali = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Sotto i Livelli (${ph}):</strong> Immettere circa <strong>${grammiTotali}g</strong> di pH Plus.`);
    }

    if (!isNaN(cl) && cl < 1.0) {
        let delta = 1.1 - cl;
        let grammiCloro = Math.round(delta * 1.5 * VOL_PISCINA);
        consigli.push(`<strong>Cloro Insufficiente (${cl} ppm):</strong> Aggiungere circa <strong>${grammiCloro}g</strong> di ipoclorito di calcio.`);
    }

    if (!isNaN(cya) && cya >= 60) {
        consigli.push(`<strong>⚠️ ALLARME ACIDO CIANURICO (${cya} ppm):</strong> Soglia limite superata! Pianificare ricambio d'acqua.`);
    }

    if (consigli.length > 0) {
        const modal = document.getElementById("dosageModal");
        const contenitore = document.getElementById("dosageContent");
        if (modal && contenitore) {
            contenitore.innerHTML = `<h3>📋 Tabelle di Consiglio Trattamento</h3><br><p>${consigli.join('</p><br><p>')}</p>`;
            modal.classList.remove("hidden");
        }
    }
}

function apriGraficoChimico(colIdx, nomeParametro, coloreLinea) {
    const overlay = document.getElementById("chartOverlay");
    const ctx = document.getElementById("overlayCanvas")?.getContext("2d");
    if (!overlay || !ctx) return;

    document.getElementById("overlayTitle").textContent = "Andamento Storico: " + nomeParametro;
    overlay.classList.remove("hidden");

    let etichette = [];
    let valori = [];

    for (let i = 1; i < datiChimicoGlobali.length; i++) {
        let riga = datiChimicoGlobali[i];
        if (!riga || riga.length <= colIdx) continue;
        
        let dataOra = `${riga[0]} ${riga[1]}`.trim();
        let valNum = parseFloat(riga[colIdx]?.replace(",", "."));
        
        if (!isNaN(valNum)) {
            etichette.push(dataOra);
            valori.push(valNum);
        }
    }

    if (graficoCorrente) graficoCorrente.destroy();

    graficoCorrente = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etichette,
            datasets: [{
                label: nomeParametro,
                data: valori,
                borderColor: coloreLinea,
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
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