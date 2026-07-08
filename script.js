let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // 92 m³ costanti (Senza vasca di compenso)
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    manutenzioni: "REGISTRO MANUTENZIONE INTERVENTI .csv"
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

function elaboraDatiTabella(chiave, righeGrezZE) {
    if (!righeGrezZE || righeGrezZE.length === 0) return;

    let indiceIntestazione = -1;
    for (let i = 0; i < righeGrezZE.length; i++) {
        if (righeGrezZE[i] && righeGrezZE[i][0] && righeGrezZE[i][0].toString().trim().toLowerCase().startsWith("data")) {
            indiceIntestazione = i;
            break;
        }
    }

    if (indiceIntestazione === -1) {
        for(let i = 0; i < righeGrezZE.length; i++) {
            if(righeGrezZE[i].some(c => c && c.trim() !== "")) { indiceIntestazione = i; break; }
        }
    }
    if (indiceIntestazione === -1) indiceIntestazione = 0;

    let intestazioni = righeGrezZE[indiceIntestazione].map(h => h ? h.trim() : "");
    let righeDati = righeGrezZE.slice(indiceIntestazione + 1);

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
                
                // 1. GESTIONE pH (Ottimale: 7,10 - 7,30 | Limiti Legge: 6,50 - 7,50)
                if (hId === "ph") {
                    if (num >= 7.10 && num <= 7.30) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 6.50 && num < 7.10) || (num > 7.30 && num <= 7.50)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    }
                }
                
                // 2. GESTIONE CLORO LIBERO (Ottimale: 0,90 - 1,10 | Limiti Legge: 0,70 - 1,50)
                else if (hId === "cl. lib") {
                    if (num >= 0.90 && num <= 1.10) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 0.70 && num < 0.90) || (num > 1.10 && num <= 1.50)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    }
                }
                
                // 3. GESTIONE CLORO COMBINATO (Ottimale: 0,00 - 0,20 | Limiti Legge: Max 0,40)
                else if (hId === "cl. com" && !isNaN(clCombinato)) {
                    if (clCombinato >= 0.00 && clCombinato <= 0.20) {
                        classeCella = "class='cell-ok'";
                    } else if (clCombinato > 0.20 && clCombinato <= 0.40) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    }
                }
                
                // 4. GESTIONE ACIDO CIANURICO (Ottimale: 0 - 50 | Attenzione: 51 - 75 | Fuori Legge: > 75)
                else if (hId === "cya") {
                    if (num >= 0.00 && num <= 50.00) {
                        classeCella = "class='cell-ok'";
                    } else if (num > 50.00 && num <= 75.00) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    }
                }
                
                // 5. GESTIONE TEMPERATURA (Ottimale: 25 - 27 | Limiti Legge: 24 - 30)
                else if (hId === "temp") {
                    if (num >= 25.00 && num <= 27.00) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 24.00 && num < 25.00) || (num > 27.00 && num <= 30.00)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx})"`;
                    }
                }
                
                // 6. GESTIONE CLORO TOTALE (Solo Verde se ok / Rosso se fuori Allegato A)
                else if (hId === "cl. tot") {
                    let combinatoFuoriLegge = (!isNaN(clCombinato) && clCombinato > 0.40);
                    let liberoFuoriLegge = (!isNaN(clLibero) && (clLibero < 0.70 || clLibero > 1.50));
                    
                    if (combinatoFuoriLegge || liberoFuoriLegge) {
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

    let oraRilevamento = oraIdx !== -1 ? (rigaCorrente[oraIdx] || "") : "";
    let tempVasca = tempIdx !== -1 ? parseFloat((rigaCorrente[tempIdx] || "").replace(",", ".")) : 26.0;
    let numBagnanti = bagnantiIdx !== -1 ? parseInt(rigaCorrente[bagnantiIdx]) || 0 : 0;
    
    if (isNaN(tempVasca)) tempVasca = 26.0;

    let idxLibero = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. lib");
    let idxTotale = intestazioni.findIndex(h => h.toLowerCase().trim() === "cl. tot");
    let clLibero = idxLibero !== -1 ? parseFloat((rigaCorrente[idxLibero] || "").replace(",", ".")) : NaN;
    let clTotale = idxTotale !== -1 ? parseFloat((rigaCorrente[idxTotale] || "").replace(",", ".")) : NaN;
    let clCombinato = (!isNaN(clTotale) && !isNaN(clLibero)) ? (clTotale - clLibero) : 0;

    let targetIdeale = pId === "ph" ? "7,1 - 7,3" : (pId === "cl. lib" ? "0,9 - 1,1" : (pId === "temp" ? "25 - 27°C" : (pId === "cya" ? "< 50" : "-")));
    let testoDettaglio = `<h3>Diagnostica Avanzata: ${parametro}</h3>`;
    testoDettaglio += `<p>Stato attuale della cella: <strong>${valore}</strong> (Fascia Ottimale Paolo: ${targetIdeale})</p>`;
    testoDettaglio += `<p style="font-size:0.85rem; background:#edf2f7; padding:8px; margin: 10px 0; border-radius:4px; color:#4a5568;">
        Lettura: Ore ${oraRilevamento || 'N.D.'} | Temp Vasca: ${tempVasca}°C | Ospiti: ${numBagnanti}
    </p>`;

    // A. EVENTO SHOCK CRITICO (SOLO SE IL COMBINATO SUPERA 0,4 PPM)
    if (pId === "cl. com" && valNum > 0.40) {
        let doseShock = Math.round((5.0 - (isNaN(clLibero) ? 0 : clLibero)) * VOL_PISCINA * 1.54);
        testoDettaglio += `<div style="background:#fff5f5; border-left:4px solid #e53e3e; padding:10px; border-radius:4px;">
            <p style="color:#c53030; font-weight:bold; margin-bottom:5px;">⚠️ ALTO RISCHIO CLORAMMINE (Cloro Combinato: ${valore} ppm)</p>
            <p><strong>Azione Shock:</strong> Sospendere immediatamente la balneazione. Sciogliere preventivamente in un secchio d'acqua **${doseShock} grammi** di **Ipoclorito di Calcio granulare** e versarlo lentamente distribuendolo davanti alle bocchette di mandata. Mantenere la filtrazione attiva h24.</p>
        </div>`;
        contenuto.innerHTML = testoDettaglio;
        modal.classList.remove("hidden");
        return;
    }

    // B. CORREZIONE PH CON TARGET MEDIO 7,2 (920g ogni 0,1 di pH per 92 m³)
    if (pId === "ph") {
        if (valNum > 7.30) {
            let deltaPh = valNum - 7.2;
            let doseKg = (deltaPh / 0.1) * 0.92;
            if (tempVasca > 27.0) doseKg *= 1.15; // +15% per evaporazione acqua calda
            
            testoDettaglio += `<p><strong>Azione Consigliata (Target ottimale 7,2):</strong></p>
            <p>Il pH è sopra la fascia ideale. Sciogliere in un secchio d'acqua <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong> e distribuirlo lentamente **davanti alle bocchette di mandata** con impianto attivo per garantire omogeneità (assenza vasca compenso).</p>`;
        } else if (valNum < 7.10) {
            let deltaPh = 7.2 - valNum;
            let doseKg = (deltaPh / 0.1) * 0.92;
            testoDettaglio += `<p><strong>Azione Consigliata (Target ottimale 7,2):</strong></p>
            <p>Il pH è sotto la fascia di comfort. Immettere davanti alle bocchette di mandata <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Più</strong>.</p>`;
        }
    }

    // C. CORREZIONE CLORO LIBERO (SOTTO 0,90 → CLORO / SOPRA 1,10 → DECLORATORE)
    else if (pId === "cl. lib") {
        if (valNum < 0.90) {
            let deltaCl = 1.1 - valNum; // Riporta al valore medio ottimale di 1,1 ppm
            let grammiIpoclorito = (deltaCl / 0.65) * VOL_PISCINA;
            
            if (tempVasca > 27.0) grammiIpoclorito *= (1 + (tempVasca - 27.0) * 0.05);
            if (numBagnanti > 12) grammiIpoclorito *= 1.25;

            let grammiFinali = Math.round(grammiIpoclorito);
            let doseMattutina = Math.round(grammiFinali * 0.40);

            testoDettaglio += `<p><strong>Azione Consigliata (Integrazione Cloro Libero):</strong></p>
            <p>Fabbisogno totale calcolato: **${grammiFinali} grammi** di Ipoclorito di Calcio granulare.<br><br>
            • Versare subito la mattina il 40% (**${doseMattutina} grammi**) negli skimmer.<br>
            • Immettere il restante 60% (**${grammiFinali - doseMattutina} grammi**) la sera a impianto chiuso davanti alle bocchette di mandata.</p>`;
        } 
        else if (valNum > 1.10) {
            // DECLORATORE CON TIOSOLFATO DI SODIO (2,5g per ppm al m³)
            let deltaAbbattimento = valNum - 1.1;
            let grammiDecloratore = Math.round(deltaAbbattimento * VOL_PISCINA * 2.5);

            testoDettaglio += `<p style="color:#c53030; font-weight:bold;">ATTENZIONE: Cloro Libero alto (${valore} ppm).</p>
            <p>Se supera 1,5 ppm la balneazione viene bloccata dall'Allegato A.</p>
            <p><strong>Azione Abbatitrice Rapida:</strong> Sciogliere in un secchio d'acqua **${grammiDecloratore} grammi** di **Tiosolfato di Sodio (Decloratore)** e versarlo direttamente negli skimmer a filtrazione attiva per ricondurre velocemente il parametro al target di 1,1 ppm.</p>`;
        }
    }

    // D. GESTIONE ACIDO CIANURICO (DIFFERENZIATO FINO A 75 / SVUOTAMENTO)
    else if (pId === "cya") {
        if (valNum > 50.0) {
            let frazioneMantenimento = 49.0 / valNum;
            let percentualeSvuotamento = Math.round((1.0 - frazioneMantenimento) * 100);
            let litriDaSostituire = Math.round((percentualeSvuotamento / 100) * VOL_PISCINA * 1000);

            testoDettaglio += `<p><strong>Eccesso di Stabilizzante CYA (${valore} ppm):</strong></p>
            <p>Il valore ottimale deve stare sotto i 50 ppm per evitare la sovrastabilizzazione e il blocco del potere disinfettante dell'ipoclorito.</p>
            <p><strong>Azione Strutturale Consigliata:</strong> Per ricondurre il valore a **49 ppm**, effettuare uno svuotamento parziale controllato del **${percentualeSvuotamento}%** della vasca e reintegrare esattamente **${litriDaSostituire.toLocaleString()} litri** di acqua fresca.</p>`;
        }
    }

    // E. ABBATTIMENTO TEMPERATURA CON ACQUA DI REINTEGRO (22°C CON TARGET 27°C)
    else if (pId === "temp") {
        if (valNum > 27.0) {
            // Formula di miscelazione termica per target 27°C con acqua a 22°C
            let litriRaffreddamento = Math.round(VOL_PISCINA * 1000 * ((valNum - 27.0) / (27.0 - TEMP_REINTEGRO)));
            
            testoDettaglio += `<p><strong>Acqua Surriscaldata (${valore}°C):</strong></p>
            <p>Per ricondurre l'acqua alla temperatura ideale di 27°C senza sovraccaricare la filtrazione diurna, sfruttiamo l'immissione controllata di acqua fresca di rete a 22°C.</p>
            <p><strong>Azione Termica:</strong> Immettere in piscina **${litriRaffreddamento.toLocaleString()} litri** di acqua fresca di reintegro per miscelazione calorimetrica.</p>`;
        } else if (valNum < 25.0) {
            testoDettaglio += `<p>Temperatura dell'acqua fresca (${valore}°C). Si consiglia di coprire la vasca durante le ore notturne per limitare la dispersione termica.</p>`;
        }
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