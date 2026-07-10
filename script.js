let graficoCorrente = null;
let datiChimicoGlobali = [];
const VOL_PISCINA = 92; // 92 m³ costanti
const TEMP_REINTEGRO = 22.0;

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
                analizzaUltimaRigaPerAllarmeAutomatico(risultati.data);
            }
        }
    });
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

function apriConsiglioDettagliato(parametro, valore, dataOra) {
    let p = parametro.toLowerCase().trim();
    let titoloModale = `Diagnostica Parametro: ${parametro}`;
    let corpoHTML = `<p style='font-size:0.85rem; color:#64748b; margin-bottom: 10px;'>Rilevazione del ${dataOra}</p>`;

    if (p === 'ph') {
        if (valore > 7.3) {
            let delta = valore - 7.2;
            let grammi = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
            corpoHTML += `<h3>Stato: <span style="color:#dc2626;">pH Alto (${valore})</span></h3><br>
            <p>Il valore misurato è superiore al limite ideale (7.0 - 7.3).</p><br>
            <p><strong>Azione consigliata:</strong> Per abbassare il valore a 7.2, immettere nello skimmer o direttamente in vasca circa <strong>${grammi}g</strong> di <strong>Riduttore di pH Acido</strong>.</p>`;
        } else if (valore < 7.0) {
            let delta = 7.1 - valore;
            let grammi = Math.round((delta / 0.1) * 10 * VOL_PISCINA);
            corpoHTML += `<h3>Stato: <span style="color:#dc2626;">pH Basso (${valore})</span></h3><br>
            <p>Il valore è sceso sotto i livelli ottimali.</p><br>
            <p><strong>Azione consigliata:</strong> Per alzare il pH a 7.1, dosare circa <strong>${grammi}g</strong> di <strong>pH Plus (Innalzatore alcalino)</strong>.</p>`;
        }
    }
    else if (p === 'cl. lib' || p === 'cl. tot') {
        if (valore < 0.9) {
            let delta = 1.1 - valore;
            let grammiCloro = Math.round((delta / 0.1) * 1.5 * VOL_PISCINA);
            corpoHTML += `<h3>Stato: <span style="color:#dc2626;">Cloro Insufficiente (${valore} ppm)</span></h3><br>
            <p>Livello inferiore alla soglia ideale.</p><br>
            <p><strong>Azione consigliata:</strong> Per riportare il disinfettante a 1.1 ppm, aggiungere uniformemente in vasca <strong>${grammiCloro}g</strong> di <strong>Ipoclorito di Calcio Granulare</strong>.</p>`;
        } else if (valore > 1.2) {
            corpoHTML += `<h3>Stato: <span style="color:#d97706;">Cloro Elevato (${valore} ppm)</span></h3><br>
            <p>Il livello è alto ma provvisoriamente tollerato.</p><br>
            <p><strong>Azione consigliata:</strong> Sospendere temporaneamente i dosaggi e attendere il consumo solare biologico naturale prima di riprendere i trattamenti.</p>`;
        }
    }
    else if (p === 'cl. com') {
        corpoHTML += `<h3>Stato: <span style="color:#dc2626;">Cloro Combinato Alto (${valore} ppm)</span></h3><br>
        <p>Le cloroammine hanno superato la soglia di benessere (0.20 ppm) o il limite dell'Allegato A (0.40 ppm).</p><br>
        <p><strong>Azione consigliata:</strong> Valutare un ricambio parziale d'acqua o un trattamento shock localizzato per distruggere i legami chimici combinati.</p>`;
    }
    else if (p === 'temp') {
        if (valore > 28) {
            let volumeReintegro = Math.round(((valore - 27) / (valore - TEMP_REINTEGRO)) * VOL_PISCINA * 1000);
            corpoHTML += `<h3>Stato: <span style="color:#d97706;">Temperatura Alta (${valore} °C)</span></h3><br>
            <p>L'acqua supera il comfort ottimale (26°C - 28°C), aumentando il consumo di cloro.</p><br>
            <p><strong>Azione consigliata:</strong> Per scendere a 27°C, effettuare un ricambio immettendo circa <strong>${volumeReintegro.toLocaleString()} Litri</strong> di acqua fresca di rete (~22°C).</p>`;
        } else {
            corpoHTML += `<h3>Stato: <span style="color:#d97706;">Temperatura Bassa (${valore} °C)</span></h3><br>
            <p>L'acqua è fresca. Nessun intervento chimico necessario.</p>`;
        }
    }
    else if (p === 'cya') {
        let frazioneRicambio = (valore - 35) / valore;
        let litriRicambio = Math.round(frazioneRicambio * VOL_PISCINA * 1000);
        if (litriRicambio < 0) litriRicambio = 0;

        corpoHTML += `<h3>Stato: <span style="color:#dc2626;">Acido Cianurico Elevato (${valore} ppm)</span></h3><br>
        <p>L'accumulo di stabilizzante riduce l'efficacia dell'ipoclorito.</p><br>
        <p><strong>Azione consigliata:</strong> Per riportare la concentrazione alla quota ottimale di 35 ppm, occorre rinnovare circa <strong>${litriRicambio.toLocaleString()} Litri</strong> di acqua della vasca.</p>`;
    }
    else if (p === 'alka') {
        if (valore < 80) {
            let delta = 100 - valore;
            let grammiBic = Math.round(delta * 1.7 * VOL_PISCINA);
            corpoHTML += `<h3>Stato: <span style="color:#dc2626;">Alcalinità Bassa (${valore} ppm)</span></h3><br>
            <p>Il pH rischia instabilità e continui sbalzi repentini.</p><br>
            <p><strong>Azione consigliata:</strong> Per alzare il valore a 100 ppm, dosare in vasca circa <strong>${grammiBic}g</strong> di <strong>Bicarbonato di Sodio</strong>.</p>`;
        } else if (valore > 120) {
            corpoHTML += `<h3>Stato: <span style="color:#d97706;">Alcalinità Alta (${valore} ppm)</span></h3><br>
            <p>Il pH è bloccato e difficile da modificare.</p><br>
            <p><strong>Azione consigliata:</strong> Amministrare riduttore di pH acido a piccole dosi distribuite per abbassare gradualmente i carbonati.</p>`;
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

    datiChimicoGlobali.forEach(riga => {
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
                backgroundColor: tipoGrafico === 'bar' ? coloreLinea + '88' : 'transparent',
                borderWidth: 1,      // Linea finissima
                pointRadius: 1,      // Punti microscopici
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
        plugins: configurazioneFasce.length > 0 ? [pluginSfondoFasce] : []
    });
}

function chiudiDosaggio() { document.getElementById("dosageModal")?.classList.add("hidden"); }
function closeOverlay() {
    document.getElementById("chartOverlay")?.classList.add("hidden");
    if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
}