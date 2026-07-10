let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // 92 m³ costanti
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
};

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    Object.keys(FILE_REGISTRI).forEach(chiave => {
        Papa.parse(FILE_REGISTRI[chiave], {
            download: true,
            header: false,
            skipEmptyLines: false,
            complete: function(risultati) {
                elaboraDatiTabella(chiave, risultati.data);
            }
        });
    });
}

function formattaValoreNumerico(valoreStringa) {
    if (!valoreStringa || valoreStringa.trim() === "") return "";
    let pulito = valoreStringa.replace(/"/g, "").replace(",", ".");
    let num = parseFloat(pulito);
    if (isNaN(num)) return valoreStringa;
    return num;
}

function elaboraDatiTabella(chiave, righe) {
    if (!righe || righe.length === 0) return;
    datiRegistriGlobali[chiave] = righe;

    const idTabella = chiave + "Table";
    const tabella = document.getElementById(idTabella);
    if (!tabella) return;

    let html = "";
    let inizioIndice = 0;

    // Generazione Intestazioni (Header)
    if (righe[0] && righe[0].length > 0) {
        html += "<thead><tr>";
        righe[0].forEach((colonna, idx) => {
            let intestazione = colonna.replace(/"/g, "").trim();
            if (chiave === 'chimico') {
                if (intestazione.toLowerCase() === 'ph') {
                    intestazione += ` <button class="btn-mini-grafico" onclick="event.stopPropagation(); openChartOverlay('chimico', ${idx}, 'pH', 'line')">📈</button>`;
                } else if (intestazione.toLowerCase() === 'cl. lib') {
                    intestazione += ` <button class="btn-mini-grafico" onclick="event.stopPropagation(); openChartOverlay('chimico', ${idx}, 'Cloro Libero', 'line')">📈</button>`;
                }
            }
            html += `<th>${intestazione}</th>`;
        });
        html += "</tr></thead>";
        inizioIndice = 1;
    }

    // Generazione Corpo Tabella (Body) con filtri colore ideali
    html += "<tbody>";
    for (let i = inizioIndice; i < righe.length; i++) {
        let riga = righe[i];
        if (!riga || riga.length === 0 || (riga.length === 1 && riga[0] === "")) continue;

        html += "<tr>";
        riga.forEach((cella, colIdx) => {
            let testoCella = cella.replace(/"/g, "").trim();
            let classeCSS = "";

            if (chiave === 'chimico') {
                // Colonna pH (Indice 2) -> Target 7.3 perfetto
                if (colIdx === 2 && testoCella !== "") {
                    let v = parseFloat(testoCella.replace(",", "."));
                    if (!isNaN(v)) {
                        if (v === 7.3) classeCSS = "evidenzia-verde";
                        else if (v >= 7.2 && v <= 7.4) classeCSS = "evidenzia-giallo";
                        else classeCSS = "evidenzia-rosso";
                    }
                }
                // Colonna Cloro Libero (Indice 3) -> Target 1.1 perfetto
                if (colIdx === 3 && testoCella !== "") {
                    let v = parseFloat(testoCella.replace(",", "."));
                    if (!isNaN(v)) {
                        if (v === 1.1) classeCSS = "evidenzia-verde";
                        else if (v >= 1.0 && v <= 1.2) classeCSS = "evidenzia-giallo";
                        else classeCSS = "evidenzia-rosso";
                    }
                }
            }

            html += `<td class="${classeCSS}">${testoCella}</td>`;
        });
        html += "</tr>";
    }
    html += "</tbody>";
    tabella.innerHTML = html;

    if (chiave === 'chimico') {
        controllaUltimiParametriEAvvisa(righe);
    }
}

function controllaUltimiParametriEAvvisa(righe) {
    if (righe.length < 2) return;
    let ultimaRiga = righe[righe.length - 1];
    if (!ultimaRiga || ultimaRiga.length < 9) return;

    let ph = parseFloat(ultimaRiga[2]?.replace(",", "."));
    let cl = parseFloat(ultimaRiga[3]?.replace(",", "."));
    let cya = parseFloat(ultimaRiga[8]?.replace(",", "."));

    let messaggi = [];
    if (!isNaN(ph) && ph > 7.4) messaggi.push(`<strong>pH Alto (${ph}):</strong> Necessario riduttore acido.`);
    if (!isNaN(ph) && ph < 7.2) messaggi.push(`<strong>pH Basso (${ph}):</strong> Necessario correttore alcalino.`);
    if (!isNaN(cl) && cl < 1.0) messaggi.push(`<strong>Cloro Insufficiente (${cl} ppm):</strong> Integrare con ipoclorito di calcio granulare.`);
    if (!isNaN(cya) && cya >= 60) messaggi.push(`<strong>Allarme Acido Cianurico (${cya} ppm):</strong> Soglia limite superata!`);

    if (messaggi.length > 0) {
        const modal = document.getElementById("dosageModal");
        const content = document.getElementById("dosageContent");
        if (modal && content) {
            content.innerHTML = `<h3>⚠️ Diagnostica Trattamento Vasca</h3><br><p>${messaggi.join('</p><p>')}</p>`;
            modal.classList.remove("hidden");
        }
    }
}

function mostraSezione(idSezione) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(idSezione);
    if (target) target.classList.remove('hidden');
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

function openChartOverlay(chiave, colIdx, nomeParametro, tipoGrafico) {
    const overlay = document.getElementById("chartOverlay");
    const ctx = document.getElementById("overlayCanvas")?.getContext("2d");
    if (!overlay || !ctx) return;

    document.getElementById("overlayTitle").textContent = "Andamento Storico " + nomeParametro;
    overlay.classList.remove("hidden");

    let righe = datiRegistriGlobali[chiave];
    let etichette = [];
    let valori = [];

    for (let i = 1; i < righe.length; i++) {
        let riga = righe[i];
        if (!riga || riga.length <= colIdx) continue;
        let dataStr = riga[0] || "";
        let valStr = riga[colIdx] || "";
        let valNum = parseFloat(valStr.replace(",", "."));
        if (!isNaN(valNum)) {
            etichette.push(dataStr);
            valori.push(valNum);
        }
    }

    if (graficoCorrente) graficoCorrente.destroy();

    graficoCorrente = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: etichette,
            datasets: [{
                label: nomeParametro,
                data: valori,
                borderColor: "#0066cc",
                backgroundColor: "transparent",
                borderWidth: 2,
                tension: 0.15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}