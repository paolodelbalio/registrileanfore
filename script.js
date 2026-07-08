let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; 
const TARGET_PH = 7.2;
const TARGET_CL_LIBERO = 1.1;
const TEMP_VASCA_IDEALE = 27.0;
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv"
};

const LIMITI_LEGGE = {
    "ph": { min: 6.5, max: 7.5 },
    "cl. lib": { min: 0.7, max: 1.5 },
    "cl. com": { min: 0.0, max: 0.4 },
    "temp": { min: 24.0, max: 30.0 },
    "cya": { min: 0.0, max: 60.0 }
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
    return num.toFixed(2).replace(".", ",");
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length === 0) return;

    let indiceIntestazione = -1;
    for (let i = 0; i < righeGrezze.length; i++) {
        if (righeGrezze[i] && righeGrezze[i][0] && righeGrezze[i][0].toString().trim().toLowerCase().startsWith("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    if (indiceIntestazione === -1) {
        for(let i = 0; i < righeGrezze.length; i++) {
            if(righeGrezze[i].some(c => c && c.trim() !== "")) { indiceIntestazione = i; break; }
        }
    }
    if (indiceIntestazione === -1) indiceIntestazione = 0;

    let intestazioni = righeGrezze[indiceIntestazione].map(h => h ? h.trim() : "");
    let righeDati = righeGrezze.slice(indiceIntestazione + 1);

    let righePulite = [];
    righeDati.forEach(riga => {
        if (riga.some(cella => cella && cella.trim() !== "")) {
            righePulite.push(riga.map(cella => cella ? cella.trim() : ""));
        }
    });

    if (chiave === "pulizie") {
        let ultimoIndiceValido = -1;
        for (let i = 0; i < righePulite.length; i++) {
            if (/[a-zA-Z]/.test(righePulite[i][2] || "")) ultimoIndiceValido = i;
        }
        if (ultimoIndiceValido !== -1) righePulite = righePulite.slice(0, ultimoIndiceValido + 1);
    }

    datiRegistriGlobali[chiave] = { intestazioni: intestazioni, righe: righePulite };
    costruisciTabellaHTML(chiave, intestazioni, righePulite);
}

function costruisciTabellaHTML(chiave, intestazioni, righe) {
    const tabella = document.getElementById(chiave + "Table");
    if (!tabella) return;

    let html = "<thead><tr>";
    intestazioni.forEach(h => {
        let hLower = h.toLowerCase().trim();
        let classeClick = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "reintegro  (l)"].includes(hLower) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    righe.forEach((riga, rIdx) => {
        html += "<tr>";

        let idxLibero = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. lib");
        let idxTotale = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. tot");
        let idxCombinato = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. com");

        let clLibero = idxLibero !== -1 ? parseFloat((riga[idxLibero] || "").replace(/"/g, "").replace(",", ".")) : NaN;
        let clTotale = idxTotale !== -1 ? parseFloat((riga[idxTotale] || "").replace(/"/g, "").replace(",", ".")) : NaN;
        let clCombinato = idxCombinato !== -1 ? parseFloat((riga[idxCombinato] || "").replace(/"/g, "").replace(",", ".")) : NaN;

        if (isNaN(clCombinato) && !isNaN(clTotale) && !isNaN(clLibero)) {
            clCombinato = clTotale - clLibero;
        }

        intestazioni.forEach((intestazione, colIdx) => {
            let valoreGrezzo = riga[colIdx] || "";
            let hId = intestazione.toLowerCase().trim();
            
            let valore = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya"].includes(hId) ? formattaValoreNumerico(valoreGrezzo) : valoreGrezzo;
            
            let classeCella = "";
            let attributiAggiuntivi = "";
            let num = parseFloat(valoreGrezzo.replace(/"/g, "").replace(",", "."));

            if (!isNaN(num) || hId === "cl. tot" || hId === "cl. com") {
                
                // 1. VERIFICA PARAMETRI STANDARD (pH, Temperatura, Acido Cianurico)
                if (["ph", "temp", "cya"].includes(hId) && LIMITI_LEGGE[hId]) {
                    let limiti = LIMITI_LEGGE[hId];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                } 
                // 2. VERIFICA CLORO LIBERO
                else if (hId === "cl. lib" && LIMITI_LEGGE["cl. lib"]) {
                    let limiti = LIMITI_LEGGE["cl. lib"];
                    if (num < limiti.min || num > limiti.max) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                }
                // 3. VERIFICA CLORO COMBINATO (Max 0,4 ppm)
                else if (hId === "cl. com" && !isNaN(clCombinato)) {
                    if (clCombinato > 0.4) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-ok'";
                    }
                }
                // 4. VERIFICA INTEGRATA CLORO TOTALE (Rosso se uno dei due componenti fallisce)
                else if (hId === "cl. tot") {
                    let combinatoFuori = (!isNaN(clCombinato) && clCombinato > 0.4);
                    let liberoFuori = (!isNaN(clLibero) && (clLibero < LIMITI_LEGGE["cl. lib"].min || clLibero > LIMITI_LEGGE["cl. lib"].max));
                    
                    if (combinatoFuori || liberoFuori) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else if (!isNaN(clLibero) && !isNaN(clTotale)) {
                        classeCella = "class='cell-ok'";
                    }
                }
            }
            html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function mostraSezione(sezioneId) {
    document.querySelectorAll('.register-section').forEach(s => s.classList.add('hidden'));
    const sezione = document.getElementById(sezioneId);
    if (!sezione) return;
    
    sezione.classList.remove('hidden');
    let chiave = sezioneId.replace("Section", "");
    let dati = datiRegistriGlobali[chiave];
    if (!dati || !dati.righe || dati.righe.length === 0) return;

    let rigaTargetIndice = dati.righe.length - 1;
    let colTarget = (chiave === "chimico") ? 2 : 1;
    for (let i = dati.righe.length - 1; i >= 0; i--) {
        if (dati.righe[i][colTarget] && dati.righe[i][colTarget].trim() !== "" && dati.righe[i][colTarget].trim() !== "0") {
            rigaTargetIndice = i;
            break;
        }
    }

    setTimeout(() => {
        const tElement = document.getElementById(chiave + "Table");
        if (tElement) {
            const righeTabella = tElement.querySelectorAll("tbody tr");
            if (righeTabella[rigaTargetIndice]) {
                righeTabella[rigaTargetIndice].scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, 50);
}

function apriFinestraDosaggio(parametro, valore, rigaIndice) {
    const modal = document.getElementById("dosageModal");
    const contenuto = document.getElementById("dosageContent");
    let valNum = parseFloat(valore.replace(",", "."));
    let pId = parametro.toLowerCase().trim();
    
    let chimico = datiRegistriGlobali.chimico;
    let intestazioni = chimico ? chimico.intestazioni : [];
    let rigaCorrente = (chimico && chimico.righe) ? chimico.righe[rigaIndice] : [];

    let oraIdx = intestazioni.findIndex(h => h.toLowerCase().trim() === "ora");
    let tempIdx = intestazioni.findIndex(h => h.toLowerCase().trim() === "temp");
    let bagnantiIdx = intestazioni.findIndex(h => h.toLowerCase().trim() === "n.ospiti");
    let reintegroIdx = intestazioni.findIndex(h => h.toLowerCase().trim() === "reintegro  (l)");

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : TEMP_VASCA_IDEALE;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;
    let litriReintegro = reintegroIdx !== -1 ? parseFloat((rigaCorrente[reintegroIdx] || "").replace(",", ".")) || 0 : 0;
    
    if (isNaN(tempVasca)) tempVasca = TEMP_VASCA_IDEALE;

    // Estrazione parametri cloro per controllo incrociato clorammine
    let idxLibero = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. lib");
    let idxTotale = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. tot");
    let clLibero = idxLibero !== -1 ? parseFloat((rigaCorrente[idxLibero] || "").replace(",", ".")) : 0;
    let clTotale = idxTotale !== -1 ? parseFloat((rigaCorrente[idxTotale] || "").replace(",", ".")) : 0;
    let clCombinato = clTotale - clLibero;

    let targetIdeale = pId === "ph" ? TARGET_PH : (pId === "cl. lib" ? TARGET_CL_LIBERO : "-");
    let testoDettaglio = `<h3>Diagnostica Assistente Chimico: ${parametro}</h3>`;
    testoDettaglio += `<p>Valore fuori norma rilevato: <strong style="color:#e53e3e;">${valore}</strong> (Valore Target Ideale: ${targetIdeale})</p>`;
    
    // Calcolo impatto termico del reintegro se presente
    let stringaTermica = "";
    if (litriReintegro > 0) {
        let tempStimataPostReintegro = (( (VOL_PISCINA * 1000 - litriReintegro) * tempVasca ) + (litriReintegro * TEMP_REINTEGRO)) / (VOL_PISCINA * 1000);
        stringaTermica = ` | Impatto Reintegro (22°C): Miscelazione stimata a ${tempStimataPostReintegro.toFixed(1).replace(".", ",")}°C`;
    }

    testoDettaglio += `<p style="font-size:0.85rem; background:#edf2f7; padding:8px; margin: 10px 0; border-radius:4px; color:#4a5568;">
        Contesto di verifica: Ore ${oraRilevamento || 'N.D.'} | Temp Attuale: ${tempVasca}°C | Ospiti in Vasca: ${numBagnanti}${stringaTermica}
    </p>`;

    // BLOCCO LOGICO DIAGNOSTICO PRINCIPALE
    if (pId === "cl. com" || clCombinato > 0.4) {
        // TRATTAMENTO SHOCK AUTOMATICO SE IL COMBINATO SUPERA 0,4 PPM
        let doseShock = Math.round((5.0 - (isNaN(clLibero) ? 0 : clLibero)) * VOL_PISCINA * 1.54);
        testoDettaglio += `<div style="background:#fff5f5; border-left:4px solid #e53e3e; padding:10px; margin-top:10px;">
            <p style="color:#c53030; font-weight:bold; margin-bottom:5px;">⚠️ TRATTAMENTO SHOCK OBBLIGATORIO (Allegato A)</p>
            <p>Il Cloro Combinato ha superato la soglia critica di 0,4 ppm (Rilevato: ${clCombinato.toFixed(2).replace(".", ",")} ppm).</p>
            <p><strong>Azione:</strong> Sospendere la balneazione. Sciogliere e distribuire uniformemente in vasca <strong>${doseShock} grammi</strong> di <strong>Ipoclorito di Calcio granulare</strong> per raggiungere il breakpoint di 5,0 ppm. Mantenere la filtrazione attiva h24.</p>
        </div>`;
    } 
    else if (pId === "ph") {
        if (valNum > 7.5) {
            let delta = valNum - TARGET_PH;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000);
            if (tempVasca > TEMP_VASCA_IDEALE) doseKg *= 1.15; // Correzione evaporazione/attivazione sopra i 27 gradi
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Immettere nello skimmer o nella vasca di compenso <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong> per ritornare al target di ${TARGET_PH.toString().replace(".", ",")}.</p>`;
        } else if (valNum < 6.5) {
            let delta = TARGET_PH - valNum;
            let doseKg = ((delta * 10 * 10 * VOL_PISCINA) / 1000);
            testoDettaglio += `<p><strong>Azione Correttiva:</strong> Immettere direttamente in vasca <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Più</strong>.</p>`;
        }
    } 
    else if (pId === "cl. lib") {
        if (valNum < 0.7) {
            let delta = TARGET_CL_LIBERO - valNum;
            let grammiIpoclorito = (delta / 0.65) * VOL_PISCINA;
            
            // Studio fattori correttivi bagnanti e temperatura
            if (tempVasca > TEMP_VASCA_IDEALE) grammiIpoclorito *= (1 + (tempVasca - TEMP_VASCA_IDEALE) * 0.05);
            if (numBagnanti > 12) grammiIpoclorito *= 1.25;

            let grammiFinali = Math.round(grammiIpoclorito);
            let doseMattutina = Math.round(grammiFinali * 0.40);

            testoDettaglio += `<p><strong>Azione Correttiva (Ripristino Target 1,1 ppm):</strong><br>
            Fabbisogno totale calcolato: <strong>${grammiFinali} grammi</strong> di Ipoclorito di Calcio granulare.<br><br>
            <strong>Strategia di immissione consigliata:</strong><br>
            • Sciogliere e versare subito il 40% (<strong>${doseMattutina} grammi</strong>) negli skimmer per stabilizzare la vasca.<br>
            • Integrare il restante 60% (<strong>${grammiFinali - doseMattutina} grammi</strong>) la sera a impianto chiuso.</p>`;
        } else if (valNum > 1.5) {
            testoDettaglio += `<p style="color:#c53030; font-weight:bold;">Soglia di Balneazione Superata!</p>
            <p>Il livello di Cloro Libero è troppo alto. Sospendere temporaneamente i dosaggi automatici o manuali e attendere il consumo biologico naturale indotto dai raggi UV.</p>`;
        }
    } 
    else if (pId === "cya") {
        if (valNum > 60.0) {
            let percentualeSvuotamento = Math.round(((valNum - 40) / valNum) * 100);
            let litriNecessari = Math.round((percentualeSvuotamento / 100) * VOL_PISCINA * 1000);
            testoDettaglio += `<p><strong>Eccesso di Acido Cianurico (CYA):</strong> Lo stabilizzante ha superato il blocco di sicurezza di 60 ppm, rischiando di rendere inefficace l'ipoclorito.</p>
            <p><strong>Risoluzione:</strong> Effettuare un ricambio parziale d'acqua del <strong>${percentualeSvuotamento}%</strong> del volume totale (pari a circa <strong>${litriNecessari.toLocaleString()} litri</strong> di acqua fresca) per ricondurre il valore sotto la fascia di sicurezza.</p>`;
        }
    } 
    else if (pId === "temp") {
        testoDettaglio += `<p>Temperatura fuori range ottimale (${valNum}°C). Monitorare le ore di filtrazione e l'evaporazione diurna, che accelerano il consumo di cloro.</p>`;
    }

    contenuto.innerHTML = testoDettaglio;
    modal.classList.remove("hidden");
}

function chiudiDosaggio() {
    document.getElementById("dosageModal").classList.add("hidden");
}

function gestisciClickIntestazione(chiave, parametro) {
    let dati = datiRegistriGlobali[chiave];
    if (!dati) return;

    let colIdx = dati.intestazioni.indexOf(parametro);
    if (colIdx === -1) return;

    let etichette = [];
    let valori = [];

    dati.righe.forEach(riga => {
        let dataOra = (riga[0] || "") + " " + (riga[1] || "");
        let valStr = riga[colIdx] || "";
        let valNum = parseFloat(valStr.replace(/"/g, "").replace(",", "."));

        if (!isNaN(valNum)) {
            etichette.push(dataOra.trim());
            valori.push(valNum);
        }
    });

    if (valori.length === 0) return;

    document.getElementById("overlayTitle").innerText = "Andamento Temporale: " + parametro;
    document.getElementById("chartOverlay").classList.remove("hidden");

    const ctx = document.getElementById("overlayCanvas").getContext("2d");
    if (graficoCorrente) { graficoCorrente.destroy(); }

    graficoCorrente = new Chart(ctx, {
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
    if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
}