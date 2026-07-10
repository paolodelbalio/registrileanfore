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
            skipEmptyLines: true,
            complete: function(risultati) {
                elaboraDatiTabella(chiave, risultati.data);
            }
        });
    });
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length < 2) return;

    let intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
    let datiFormattati = [];

    for (let i = 1; i < righeGrezze.length; i++) {
        let rigaCorrente = righeGrezze[i];
        if (rigaCorrente.length === 0 || (rigaCorrente[0] === "" && rigaCorrente[1] === "")) continue;

        let oggettoRiga = {};
        intestazioni.forEach((intestazione, indice) => {
            let valoreCella = rigaCorrente[indice] ? rigaCorrente[indice].trim() : "";
            
            // FILTRO COLONNA CYA: Isola la prima misurazione per ridurre la larghezza della colonna
            if (intestazione.toLowerCase() === 'cya' && valoreCella !== "") {
                let match = valoreCella.match(/^([0-9.,]+)/);
                if (match) {
                    valoreCella = match[1];
                }
            }
            
            oggettoRiga[intestazione] = valoreCella;
        });
        datiFormattati.push(oggettoRiga);
    }

    datiRegistriGlobali[chiave] = datiFormattati;

    if (chiave === 'chimico') {
        creaTabellaChimica(intestazioni, datiFormattati);
        analizzaUltimaRigaPerAllarmeAutomatico(datiFormattati);
    } else {
        creaTabellaStandard(chiave, intestazioni, datiFormattati);
    }
}

function ottieniClasseColore(parametro, v) {
    if (isNaN(v)) return "";
    let p = parametro.toLowerCase().trim();

    if (p === 'ph') {
        if (v >= 7.0 && v <= 7.3) return "evidenzia-verde";
        if ((v >= 6.5 && v < 7.0) || (v > 7.3 && v <= 7.5)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    if (p === 'cl. lib' || p === 'cl. tot') {
        if (v >= 0.9 && v <= 1.2) return "evidenzia-verde";
        if ((v >= 0.7 && v < 0.9) || (v > 1.2 && v <= 2.0)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    if (p === 'cl. com') {
        if (v <= 0.20) return "evidenzia-verde";
        if (v > 0.20 && v <= 0.40) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    if (p === 'temp') {
        if (v >= 26 && v <= 28) return "evidenzia-verde";
        if ((v >= 24 && v < 26) || (v > 28 && v <= 30)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    if (p === 'cya') {
        if (v >= 0 && v <= 40) return "evidenzia-verde";
        if (v > 40 && v <= 60) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    if (p === 'alka') {
        if (v >= 80 && v <= 120) return "evidenzia-verde";
        if ((v >= 60 && v < 80) || (v > 120 && v <= 150)) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }
    return "";
}

function creaTabellaChimica(intestazioni, dati) {
    const tabella = document.getElementById("chimicoTable");
    if (!tabella) return;

    let html = "<thead><tr>";
    intestazioni.forEach(chiave => {
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
        html += "<tr>";
        intestazioni.forEach(chiave => {
            let valoreTesto = riga[chiave] ? riga[chiave].trim() : "";
            let n = chiave.trim().toLowerCase();

            if (n === 'cl. com' && valoreTesto !== "") {
                let vCom = parseFloat(valoreTesto.replace(",", "."));
                if (!isNaN(vCom)) valoreTesto = vCom.toFixed(2).replace(".", ",");
            }

            let vNum = parseFloat(valoreTesto.replace(",", "."));
            let classeColore = ottieniClasseColore(chiave, vNum);

            let attributoClick = "";
            if (classeColore === "evidenzia-giallo" || classeColore === "evidenzia-rosso") {
                attributoClick = `onclick="apriConsiglioDettagliato('${chiave}', ${vNum}, '${riga.Data || ''} ${riga.Ora || ''}')"`;
            }

            html += `<td class="${classeColore}" ${attributoClick} style="${attributoClick !== '' ? 'cursor:pointer;' : ''}">${valoreTesto}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function creaTabellaStandard(chiaveTabella, intestazioni, dati) {
    const tabella = document.getElementById(`${chiaveTabella}Table`);
    if (!tabella) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => { html += `<th>${h}</th>`; });
    html += "</tr></thead><tbody>";

    dati.forEach(riga => {
        html += "<tr>";
        intestazioni.forEach(h => { html += `<td>${riga[h] || ""}</td>`; });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function apriConsiglioDettagliato(parametro, valore, dataOra) {
    let p = parametro.toLowerCase().trim();
    let titoloModale = `Diagnostica Parametro: ${parametro}`;
    let corpoHTML = `<p style='font-size:0.85rem; color:#64748b; margin-bottom: 12px;'>Rilevazione del ${dataOra}</p>`;

    if (p === 'ph') {
        if (valore > 7.3) {
            let dLimite = valore - 7.5;
            let dIdeale = valore - 7.2;
            let gLimite = Math.round((dLimite / 0.1) * 10 * VOL_PISCINA);
            let gIdeale = Math.round((dIdeale / 0.1) * 10 * VOL_PISCINA);
            
            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Alto (${valore})</span></h3><br>
            <p><strong>Dose minima per rientrare nei limiti (7.5):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Riduttore Acido.</p>
            <p><strong>Dose ottimale per raggiungere la fascia ideale (7.2):</strong> aggiungere <strong>${gIdeale}g</strong> di Riduttore Acido.</p>`;
        } else if (valore < 7.0) {
            let dLimite = 6.5 - valore;
            let dIdeale = 7.1 - valore;
            let gLimite = Math.round((dLimite / 0.1) * 10 * VOL_PISCINA);
            let gIdeale = Math.round((dIdeale / 0.1) * 10 * VOL_PISCINA);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Basso (${valore})</span></h3><br>
            <p><strong>Dose minima per rientrare nei limiti (6.5):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di pH Plus.</p>
            <p><strong>Dose ottimale per raggiungere la fascia ideale (7.1):</strong> aggiungere <strong>${gIdeale}g</strong> di pH Plus.</p>`;
        }
    }
    else if (p === 'cl. lib' || p === 'cl. tot') {
        if (valore < 0.9) {
            let dLimite = 1.0 - valore;
            let dIdeale = 1.1 - valore;
            let gLimite = Math.round((dLimite / 0.1) * 1.5 * VOL_PISCINA);
            let gIdeale = Math.round((dIdeale / 0.1) * 1.5 * VOL_PISCINA);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Insufficiente (${valore} ppm)</span></h3><br>
            <p><strong>Dose minima per rientrare nei limiti (1.0 ppm):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Ipoclorito di Calcio.</p>
            <p><strong>Dose ottimale per raggiungere la fascia ideale (1.1 ppm):</strong> aggiungere <strong>${gIdeale}g</strong> di Ipoclorito di Calcio.</p>`;
        } else if (valore > 1.2) {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Cloro Elevato (${valore} ppm)</span></h3><br>
            <p>Valore superiore alla fascia ottimale ma entro i limiti massimi di legge (2.0 ppm). Sospendere i dosaggi manuali e attendere il consumo solare naturale.</p>`;
        }
    }
    else if (p === 'cl. com') {
        corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Combinato Alto (${valore} ppm)</span></h3><br>
        <p>Valore sopra la norma (0.20 ppm) o limite massimo di legge (0.40 ppm). Effettuare un ricambio parziale d'acqua o una declorazione shock controllata.</p>`;
    }
    else if (p === 'temp') {
        if (valore > 28) {
            let lLimite = Math.round(((valore - 30) / (valore - TEMP_REINTEGRO)) * VOL_PISCINA * 1000);
            let lIdeale = Math.round(((valore - 27) / (valore - TEMP_REINTEGRO)) * VOL_PISCINA * 1000);

            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Temperatura Alta (${valore} °C)</span></h3><br>
            <p><strong>Reintegro minimo per rientrare nei limiti (30°C):</strong> immettere <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> di acqua di rete.</p>
            <p><strong>Reintegro ottimale per scendere alla fascia ideale (27°C):</strong> immettere <strong>${lIdeale.toLocaleString()} Litri</strong> di acqua fresca (~22°C).</p>`;
        } else {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Temperatura Bassa (${valore} °C)</span></h3><br>
            <p>Acqua fresca. Nessun intervento correttivo richiesto.</p>`;
        }
    }
    else if (p === 'cya') {
        let fLimite = (valore - 60) / valore;
        let fIdeale = (valore - 35) / valore;
        let lLimite = Math.round(fLimite * VOL_PISCINA * 1000);
        let lIdeale = Math.round(fIdeale * VOL_PISCINA * 1000);

        corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Acido Cianurico Elevato (${valore} ppm)</span></h3><br>
        <p><strong>Scarico minimo per scendere sotto la soglia d'allarme (60 ppm):</strong> rinnovare <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> d'acqua.</p>
        <p><strong>Scarico ottimale per tornare al valore ideale (35 ppm):</strong> rinnovare <strong>${lIdeale.toLocaleString()} Litri</strong> d'acqua pulita.</p>`;
    }
    else if (p === 'alka') {
        if (valore < 80) {
            let dLimite = 60 - valore;
            let dIdeale = 100 - valore;
            let gLimite = Math.round(dLimite * 1.7 * VOL_PISCINA);
            let gIdeale = Math.round(dIdeale * 1.7 * VOL_PISCINA);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Alcalinità Bassa (${valore} ppm)</span></h3><br>
            <p><strong>Dose minima per rientrare nei limiti (60 ppm):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Bicarbonato di Sodio.</p>
            <p><strong>Dose ottimale per raggiungere la fascia ideale (100 ppm):</strong> aggiungere <strong>${gIdeale}g</strong> di Bicarbonato di Sodio.</p>`;
        } else if (valore > 120) {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Alcalinità Alta (${valore} ppm)</span></h3><br>
            <p>Valore rigido. Dosare riduttore acido a piccole riprese per abbattere lentamente i carbonati.</p>`;
        }
    }

    const modal = document.getElementById("dosageModal");
    const contenitore = document.getElementById("dosageContent");
    if (modal && contenitore) {
        contenitore.innerHTML = `<h2>${titoloModale}</h2><br>${corpoHTML}`;
        modal.classList.remove("hidden");
    }
}

function analizzaUltimaRigaPerAllarmeAutomatico(dati) {
    if (dati.length === 0) return;
    let ultimaRiga = dati[dati.length - 1];

    let ph = parseFloat((ultimaRiga["pH"] || "").replace(",", "."));
    let cl = parseFloat((ultimaRiga["Cl. Lib"] || "").replace(",", "."));
    let cya = parseFloat((ultimaRiga["Cya"] || "").replace(",", "."));

    if (!isNaN(ph) && (ph > 7.4 || ph < 7.0)) {
        apriConsiglioDettagliato('pH', ph, `${ultimaRiga.Data || ''} ${ultimaRiga.Ora || ''}`);
    } else if (!isNaN(cl) && cl < 0.9) {
        apriConsiglioDettagliato('Cl. Lib', cl, `${ultimaRiga.Data || ''} ${ultimaRiga.Ora || ''}`);
    } else if (!isNaN(cya) && cya >= 60) {
        apriConsiglioDettagliato('Cya', cya, `${ultimaRiga.Data || ''} ${ultimaRiga.Ora || ''}`);
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
    let datiChimico = datiRegistriGlobali.chimico;

    datiChimico.forEach(riga => {
        let dataOra = `${riga["Data"] || ""} ${riga["Ora"] || ""}`.trim();
        let valNum = parseFloat((riga[chiaveFiltro] || "").replace(",", "."));
        if (!isNaN(valNum) && dataOra !== "") {
            etichette.push(dataOra);
            valori.push(valNum);
        }
    });

    if (graficoCorrente) graficoCorrente.destroy();

    let n = chiaveFiltro.trim().toLowerCase();
    let configurazioneFasce = [];

    if (n === 'ph') {
        configurazioneFasce = [
            { yMin: 0, yMax: 6.5, color: 'rgba(239, 68, 68, 0.08)' },
            { yMin: 6.5, yMax: 7.0, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 7.0, yMax: 7.3, color: 'rgba(34, 197, 94, 0.09)' },
            { yMin: 7.3, yMax: 7.5, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 7.5, yMax: 14, color: 'rgba(239, 68, 68, 0.08)' }
        ];
    } else if (n === 'cl. lib' || n === 'cl. tot') {
        configurazioneFasce = [
            { yMin: 0, yMax: 0.7, color: 'rgba(239, 68, 68, 0.08)' },
            { yMin: 0.7, yMax: 0.9, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 0.9, yMax: 1.2, color: 'rgba(34, 197, 94, 0.09)' },
            { yMin: 1.2, yMax: 2.0, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 2.0, yMax: 5, color: 'rgba(239, 68, 68, 0.08)' }
        ];
    } else if (n === 'cya') {
        configurazioneFasce = [
            { yMin: 0, yMax: 40, color: 'rgba(34, 197, 94, 0.09)' },
            { yMin: 40, yMax: 60, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 60, yMax: 150, color: 'rgba(239, 68, 68, 0.08)' }
        ];
    } else if (n === 'temp') {
        configurazioneFasce = [
            { yMin: 0, yMax: 24, color: 'rgba(239, 68, 68, 0.08)' },
            { yMin: 24, yMax: 26, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 26, yMax: 28, color: 'rgba(34, 197, 94, 0.09)' },
            { yMin: 28, yMax: 30, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 30, yMax: 50, color: 'rgba(239, 68, 68, 0.08)' }
        ];
    } else if (n === 'alka') {
        configurazioneFasce = [
            { yMin: 0, yMax: 60, color: 'rgba(239, 68, 68, 0.08)' },
            { yMin: 60, yMax: 80, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 80, yMax: 120, color: 'rgba(34, 197, 94, 0.09)' },
            { yMin: 120, yMax: 150, color: 'rgba(245, 158, 11, 0.08)' },
            { yMin: 150, yMax: 300, color: 'rgba(239, 68, 68, 0.08)' }
        ];
    }

    const pluginFasceSfondo = {
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
                backgroundColor: tipoGrafico === 'bar' ? coloreLinea + '88' : 'transparent',
                borderWidth: 1,
                pointRadius: 1,
                pointHoverRadius: 4,
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
        plugins: configurazioneFasce.length > 0 ? [pluginFasceSfondo] : []
    });
}

function mostraSezione(idSezione) {
    document.querySelectorAll(".register-section").forEach(s => s.classList.add("hidden"));
    document.getElementById(idSezione)?.classList.remove("hidden");
}

function chiudiDosaggio() { document.getElementById("dosageModal")?.classList.add("hidden"); }
function closeOverlay() {
    document.getElementById("chartOverlay")?.classList.add("hidden");
    if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
}