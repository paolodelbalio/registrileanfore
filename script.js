let graficoCorrente = null;
let datiChimicoGlobali = [];
const VOL_PISCINA = 92; // 92 m³ costanti

document.addEventListener("DOMContentLoaded", () => {
    caricaRegistroChimico();
});

function caricaRegistroChimico() {
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

function ottieniClasseColore(parametro, v) {
    if (isNaN(v)) return "";
    let p = parametro.toLowerCase().trim();

    // pH: verde (7.0-7.3), giallo sotto (6.5-7.0) o sopra (7.3-7.5), rosso fuori (<6.5 o >7.5)
    if (p === 'ph') {
        if (v >= 7.0 && v <= 7.3) return "evidenzia-verde";
        if ((v >= 6.5 && v < 7.0) || (v > 7.3 && v <= 7.5)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    // Cloro Libero / Cloro Totale: verde (0.9-1.2), giallo sotto (0.7-0.9) o sopra (1.2-2.0), rosso fuori (<0.7 o >2.0)
    if (p === 'cl. lib' || p === 'cl. tot') {
        if (v >= 0.9 && v <= 1.2) return "evidenzia-verde";
        if ((v >= 0.7 && v < 0.9) || (v > 1.2 && v <= 2.0)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    // Cloro Combinato: verde (<=0.2), giallo (0.2-0.4), rosso (>0.4)
    if (p === 'cl. com') {
        if (v <= 0.20) return "evidenzia-verde";
        if (v > 0.20 && v <= 0.40) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    // Temperatura: verde (26-28), giallo sotto (<26 fino a 24) o sopra (28-30), rosso (<24 o >30)
    if (p === 'temp') {
        if (v >= 26 && v <= 28) return "evidenzia-verde";
        if ((v >= 24 && v < 26) || (v > 28 && v <= 30)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    // CYA: verde (0-40), giallo (40-60), rosso (>60)
    if (p === 'cya') {
        if (v >= 0 && v <= 40) return "evidenzia-verde";
        if (v > 40 && v <= 60) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    // Alcalinità: verde (80-120), giallo (60-80 o 120-150), rosso (<60 o >150)
    if (p === 'alka') {
        if (v >= 80 && v <= 120) return "evidenzia-verde";
        if ((v >= 60 && v < 80) || (v > 120 && v <= 150)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    return "";
}

function creaTabellaChimica(dati) {
    const tabella = document.getElementById("chimicoTable");
    if (!tabella) return;

    let chiavi = Object.keys(dati[0]);
    let html = "<thead><tr>";
    
    chiavi.forEach(chiave => {
        let n = chiave.trim().toLowerCase();
        let label = chiave.trim();
        if (n === 'ph') html += `<th onclick="apriGraficoChimico('${chiave}', 'pH', '#ff6384', 'line')" style="cursor:pointer; text-decoration:underline;">pH</th>`;
        else if (n === 'cl. lib') html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Libero', '#36a2eb', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Lib</th>`;
        else if (n === 'cl. tot') html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Totale', '#4bc0c0', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Tot</th>`;
        else if (n === 'cl. com') html += `<th onclick="apriGraficoChimico('${chiave}', 'Cloro Combinato', '#ff9f40', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Com</th>`;
        else if (n === 'temp') html += `<th onclick="apriGraficoChimico('${chiave}', 'Temperatura', '#ffcd56', 'line')" style="cursor:pointer; text-decoration:underline;">Temp</th>`;
        else if (n === 'n.ospiti') html += `<th onclick="apriGraficoChimico('${chiave}', 'Numero Ospiti', '#9966ff', 'bar')" style="cursor:pointer; text-decoration:underline;">N.Ospiti</th>`;
        else if (n === 'cya') html += `<th onclick="apriGraficoChimico('${chiave}', 'Acido Cianurico', '#c9cbcf', 'line')" style="cursor:pointer; text-decoration:underline;">Cya</th>`;
        else if (n === 'alka') html += `<th onclick="apriGraficoChimico('${chiave}', 'Alcalinità', '#22c55e', 'line')" style="cursor:pointer; text-decoration:underline;">Alka</th>`;
        else html += `<th>${label}</th>`;
    });
    html += "</tr></thead><tbody>";

    dati.forEach(riga => {
        if (!riga.Data && !riga.Ora) return;

        html += "<tr>";
        chiavi.forEach(chiave => {
            let valoreTesto = riga[chiave] ? riga[chiave].trim() : "";
            let n = chiave.trim().toLowerCase();

            if (n === 'cl. com' && valoreTesto !== "") {
                let vCom = parseFloat(valoreTesto.replace(",", "."));
                if (!isNaN(vCom)) valoreTesto = vCom.toFixed(2).replace(".", ",");
            }

            let vNum = parseFloat(valoreTesto.replace(",", "."));
            let classeColore = ottieniClasseColore(chiave, vNum);
            let tipoGrafico = (n === 'n.ospiti') ? 'bar' : 'line';

            html += `<td class="${classeColore}" onclick="apriGraficoChimico('${chiave}', '${chiave}', '#0066cc', '${tipoGrafico}')" style="cursor:pointer;">${valoreTesto}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function analizzaParametriECalcolaDosaggi(dati) {
    if (dati.length === 0) return;
    let ultimaRiga = dati[dati.length - 1];

    let ph = parseFloat((ultimaRiga["pH"] || "").replace(",", "."));
    let cl = parseFloat((ultimaRiga["Cl. Lib"] || "").replace(",", "."));
    let cya = parseFloat((ultimaRiga["Cya"] || "").replace(",", "."));
    let alka = parseFloat((ultimaRiga["Alka"] || "").replace(",", "."));

    let consigli = [];

    if (!isNaN(ph) && ph > 7.3) {
        let delta = ph - 7.2; // Riporta a un valore ottimale sicuro
        let grammi = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Alto (${ph}):</strong> Immettere circa <strong>${gramms}g</strong> di riduttore acido granulare per scendere nella fascia ottimale.`);
    } else if (!isNaN(ph) && ph < 7.0) {
        let delta = 7.1 - ph;
        let grammi = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
        consigli.push(`<strong>pH Basso (${ph}):</strong> Aggiungere circa <strong>${grammi}g</strong> di innalzatore pH Plus.`);
    }

    if (!isNaN(cl) && cl < 0.9) {
        let delta = 1.1 - cl;
        let grammiCloro = Math.round((delta / 0.1) * 1.5 * VOL_PISCINA);
        consigli.push(`<strong>Cloro Libero Basso (${cl} ppm):</strong> Aggiungere <strong>${grammiCloro}g</strong> di ipoclorito di calcio granulare.`);
    }

    if (!isNaN(cya) && cya > 50) {
        consigli.push(`<strong>⚠️ ACIDO CIANURICO ELEVATO (${cya} ppm):</strong> Livello vicino al blocco dell'acqua o fuori limite. Sospendere prodotti stabilizzati e integrare acqua pulita.`);
    }

    if (!isNaN(alka) && alka < 80) {
        let delta = 100 - alka;
        let grammiBic = Math.round(delta * 1.7 * VOL_PISCINA);
        consigli.push(`<strong>Alcalinità Bassa (${alka} ppm):</strong> Per stabilizzare il pH ed evitare sbalzi repentinei, aggiungere circa <strong>${grammiBic}g</strong> di bicarbonato di sodio.`);
    }

    if (consigli.length > 0) {
        const modal = document.getElementById("dosageModal");
        const contenitore = document.getElementById("dosageContent");
        if (modal && contenitore) {
            contenitore.innerHTML = `<h3>📋 Consigli di Trattamento Vasca (92 m³)</h3><br><p>${consigli.join('</p><br><p>')}</p>`;
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
        let dataOra = `${riga["Data"] || ""} ${riga["Ora"] || ""}`.trim();
        let valNum = parseFloat((riga[chiaveFiltro] || "").replace(",", "."));
        if (!isNaN(valNum) && dataOra !== "") {
            etichette.push(dataOra);
            valori.push(valNum);
        }
    });

    if (graficoCorrente) graficoCorrente.destroy();

    // Generazione dinamica delle fasce di colore sullo sfondo del grafico
    let n = chiaveFiltro.trim().toLowerCase();
    let configurazioneFasce = [];

    if (n === 'ph') {
        configurazioneFasce = [
            { yMin: 0, yMax: 6.5, color: 'rgba(248, 215, 218, 0.4)' },
            { yMin: 6.5, yMax: 7.0, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 7.0, yMax: 7.3, color: 'rgba(209, 250, 229, 0.5)' },
            { yMin: 7.3, yMax: 7.5, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 7.5, yMax: 14, color: 'rgba(248, 215, 218, 0.4)' }
        ];
    } else if (n === 'cl. lib' || n === 'cl. tot') {
        configurazioneFasce = [
            { yMin: 0, yMax: 0.7, color: 'rgba(248, 215, 218, 0.4)' },
            { yMin: 0.7, yMax: 0.9, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 0.9, yMax: 1.2, color: 'rgba(209, 250, 229, 0.5)' },
            { yMin: 1.2, yMax: 2.0, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 2.0, yMax: 5, color: 'rgba(248, 215, 218, 0.4)' }
        ];
    } else if (n === 'cya') {
        configurazioneFasce = [
            { yMin: 0, yMax: 40, color: 'rgba(209, 250, 229, 0.5)' },
            { yMin: 40, yMax: 60, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 60, yMax: 150, color: 'rgba(248, 215, 218, 0.4)' }
        ];
    } else if (n === 'temp') {
        configurazioneFasce = [
            { yMin: 0, yMax: 24, color: 'rgba(248, 215, 218, 0.4)' },
            { yMin: 24, yMax: 26, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 26, yMax: 28, color: 'rgba(209, 250, 229, 0.5)' },
            { yMin: 28, yMax: 30, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 30, yMax: 50, color: 'rgba(248, 215, 218, 0.4)' }
        ];
    } else if (n === 'alka') {
        configurazioneFasce = [
            { yMin: 0, yMax: 60, color: 'rgba(248, 215, 218, 0.4)' },
            { yMin: 60, yMax: 80, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 80, yMax: 120, color: 'rgba(209, 250, 229, 0.5)' },
            { yMin: 120, yMax: 150, color: 'rgba(255, 243, 205, 0.4)' },
            { yMin: 150, yMax: 300, color: 'rgba(248, 215, 218, 0.4)' }
        ];
    }

    const pluginSfondoFasce = {
        id: 'boxFasceSfondo',
        beforeDraw: (chart) => {
            const { ctx, scales: { y, x } } = chart;
            configurazioneFasce.forEach(fascia => {
                let top = y.getPixelForValue(fascia.yMax);
                let bottom = y.getPixelForValue(fascia.yMin);
                let left = x.left;
                let right = x.right;
                ctx.fillStyle = fascia.color;
                ctx.fillRect(left, top, right - left, bottom - top);
            });
        }
    };

    graficoCorrente = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: etichette,
            datasets: [{
                label: nomeParametro,
                data: valori,
                borderColor: coloreLinea,
                backgroundColor: tipoGrafico === 'bar' ? coloreLinea + 'aa' : 'transparent',
                borderWidth: 1,      // Linea finissima
                pointRadius: 1,      // Punti minuscoli
                pointHoverRadius: 3,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(0,0,0,0.03)' } },
                x: { grid: { display: false } }
            }
        },
        plugins: configurazioneFasce.length > 0 ? [pluginSfondoFasce] : []
    });
}

function chiudiDosaggio() { document.getElementById("dosageModal")?.classList.add("hidden"); }
function closeOverlay() {
    document.getElementById("chartOverlay")?.classList.add("hidden");
    if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
}