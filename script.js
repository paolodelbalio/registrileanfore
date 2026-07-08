let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [] };

const VOL_PISCINA = 92; // 92 m³ costanti
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
        let classeClick = ["ph", "cl. lib", "cl. tot", "cl. com", "temp", "cya", "reintegro  (l)", "n.ospiti"].includes(hLower) ? "class='clickable-header'" : "";
        html += `<th ${classeClick} onclick="gestisciClickIntestazione('${chiave}', '${h}')">${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    // --- SCADENZIARIO MANUTENZIONI ---
    let giorniPassatiControlavaggio = 0;
    let giorniPassatiPrefiltri = 0;
    let rigaPrimaVuotaInterventoIdx = -1; 
    let idxInterventoMan = -1;

    if (chiave === "manutenzioni") {
        let idxDataMan = intestazioni.findIndex(h => h.toLowerCase().trim() === "data");
        idxInterventoMan = intestazioni.findIndex(h => h.toLowerCase().trim() === "intervento");

        if (idxDataMan !== -1 && idxInterventoMan !== -1) {
            let dataUltimoControlavaggio = null;
            let dataUltimaPuliziaPrefiltri = null;

            // Trova l'ultimo intervento eseguito (scorrendo dall'alto verso il basso o viceversa)
            for (let i = 0; i < righe.length; i++) {
                let testoIntervento = (righe[i][idxInterventoMan] || "").toLowerCase().trim();
                let dataStr = righe[i][idxDataMan] || "";
                
                let parti = dataStr.split("/");
                if (parti.length === 3) {
                    let anno = parti[2].length === 2 ? "20" + parti[2] : parti[2];
                    let dataMan = new Date(anno, parti[1] - 1, parti[0]);
                    
                    if (!isNaN(dataMan.getTime())) {
                        if (testoIntervento.includes("controlavaggio")) dataUltimoControlavaggio = dataMan;
                        if (testoIntervento.includes("prefiltri")) dataUltimaPuliziaPrefiltri = dataMan;
                    }
                }
                
                // Individua la PRIMA riga in cui la colonna Intervento è vuota
                if (rigaPrimaVuotaInterventoIdx === -1 && (!righe[i][idxInterventoMan] || righe[i][idxInterventoMan].trim() === "")) {
                    rigaPrimaVuotaInterventoIdx = i;
                }
            }

            // Se tutte le righe sono piene, ipotizziamo l'allarme sull'eventuale riga successiva (o l'ultima)
            if (rigaPrimaVuotaInterventoIdx === -1 && righe.length > 0) {
                rigaPrimaVuotaInterventoIdx = righe.length - 1;
            }

            let oggi = new Date();
            oggi.setHours(0,0,0,0);

            giorniPassatiControlavaggio = dataUltimoControlavaggio ? Math.floor((oggi - dataUltimoControlavaggio) / (1000 * 60 * 60 * 24)) : 99;
            giorniPassatiPrefiltri = dataUltimaPuliziaPrefiltri ? Math.floor((oggi - dataUltimaPuliziaPrefiltri) / (1000 * 60 * 60 * 24)) : 99;
        }
    }
    // ---------------------------------

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

            // COLORAZIONE REGISTRO CHIMICO
            if (chiave === "chimico" && (!isNaN(num) || hId === "cl. tot" || hId === "cl. com")) {
                if (hId === "ph") {
                    if (num >= 7.10 && num <= 7.30) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 6.50 && num < 7.10) || (num > 7.30 && num <= 7.50)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'giallo')"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    }
                }
                else if (hId === "cl. lib") {
                    if (num >= 0.90 && num <= 1.10) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 0.70 && num < 0.90) || (num > 1.10 && num <= 1.50)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'giallo')"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    }
                }
                else if (hId === "cl. com" && !isNaN(clCombinato)) {
                    if (clCombinato >= 0.00 && clCombinato <= 0.20) {
                        classeCella = "class='cell-ok'";
                    } else if (clCombinato > 0.20 && clCombinato <= 0.40) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'giallo')"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    }
                }
                else if (hId === "cya") {
                    if (num >= 0.00 && num <= 50.00) {
                        classeCella = "class='cell-ok'";
                    } else if (num > 50.00 && num <= 60.00) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'giallo')"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    }
                }
                else if (hId === "temp") {
                    if (num >= 25.00 && num <= 27.00) {
                        classeCella = "class='cell-ok'";
                    } else if ((num >= 24.00 && num < 25.00) || (num > 27.00 && num <= 30.00)) {
                        classeCella = "class='cell-warning'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'giallo')"`;
                    } else {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    }
                }
                else if (hId === "cl. tot") {
                    let combinatoFuoriLegge = (!isNaN(clCombinato) && clCombinato > 0.40);
                    let liberoFuoriLegge = (!isNaN(clLibero) && (clLibero < 0.70 || clLibero > 1.50));
                    if (combinatoFuoriLegge || liberoFuoriLegge) {
                        classeCella = "class='cell-alarm'";
                        attributiAggiuntivi = `onclick="apriFinestraDosaggio('${intestazione}', '${valore}', ${rIdx}, 'rosso')"`;
                    } else if (!isNaN(clLibero) && !isNaN(clTotale)) {
                        classeCella = "class='cell-ok'";
                    }
                }
            }

            // NUOVA LOGICA: COLORA SOLO LA PRIMA CELLA VUOTA IN BASE AI GIORNI TRASCORSI
            if (chiave === "manutenzioni" && colIdx === idxInterventoMan) {
                if (rIdx === rigaPrimaVuotaInterventoIdx) {
                    // Determina lo stato peggiore tra i due interventi richiesti (Controlavaggio vs Prefiltri)
                    let maxGiorni = Math.max(giorniPassatiControlavaggio, giorniPassatiPrefiltri);
                    let tipoInterventoMancante = "Controlavaggio / Prefiltri";

                    if (maxGiorni >= 4 && maxGiorni < 6) {
                        classeCella = "class='cell-warning'"; // Giallo
                        attributiAggiuntivi = `onclick="apriFinestraManutenzione('${tipoInterventoMancante}', ${maxGiorni}, 'giallo')" style="cursor:pointer;"`;
                    } else if (maxGiorni == 6) {
                        classeCella = "style='background-color: #ff9800; color: white; cursor:pointer;'"; // Arancione
                        attributiAggiuntivi = `onclick="apriFinestraManutenzione('${tipoInterventoMancante}', ${maxGiorni}, 'arancio')"`;
                    } else if (maxGiorni >= 7) {
                        classeCella = "class='cell-alarm'"; // Rosso
                        attributiAggiuntivi = `onclick="apriFinestraManutenzione('${tipoInterventoMancante}', ${maxGiorni}, 'rosso')" style="cursor:pointer;"`;
                    }
                    
                    // Se siamo a meno di 4 giorni, la cella rimane vuota e bianca senza colorazioni
                }
            }

            html += `<td ${classeCella} ${attributiAggiuntivi}>${valore}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody>";
    tabella.innerHTML = html;
}

function apriFinestraManutenzione(tipo, giorni, stato) {
    const modal = document.getElementById("dosageModal");
    const contenuto = document.getElementById("dosageContent");
    
    let titolo = "";
    let indicazione = "";

    if (stato === 'giallo') {
        titolo = `<h3 style="color:#d97706; margin-bottom: 5px;">⏳ Promemoria: Scadenza Avvicinamento</h3>`;
        indicazione = `Sono passati <strong>${giorni} giorni</strong> dall'ultimo intervento di manutenzione filtri. Inizia a pianificare un <strong>Controlavaggio</strong> o una <strong>Pulizia prefiltri</strong> per mantenere l'impianto efficiente.`;
    } else if (stato === 'arancio') {
        titolo = `<h3 style="color:#ea580c; margin-bottom: 5px;">⚠️ Attenzione: Intervento Richiesto</h3>`;
        indicazione = `Sono passati <strong>${giorni} giorni</strong> dall'ultima pulizia! La pressione del filtro potrebbe aumentare. Si consiglia caldamente di effettuare il lavaggio entro stasera.`;
    } else {
        titolo = `<h3 style="color:#b91c1c; margin-bottom: 5px;">🚨 MANUTENZIONE SCADUTA: Eseguire Controlavaggio</h3>`;
        indicazione = `Siamo al <strong>${giorni}° giorno</strong> senza manutenzione filtri. È fondamentale eseguire subito l'operazione per evitare cali di portata sulle bocchette e intorbidimento dell'acqua!`;
    }

    let testo = titolo;
    testo += `<p style="margin-top:10px; font-size:1rem; line-height:1.5;">${indicazione}</p>`;
    testo += `<div style="margin-top:15px; padding:10px; background:#f7fafc; border-radius:4px; font-size:0.85rem; color:#4a5568;">
        <strong>Procedura rapida per l'addetto:</strong><br>
        1. Spegnere la pompa di filtrazione.<br>
        2. Chiudere le valvole di aspirazione della vasca.<br>
        3. Posizionare la valvola selettrice del filtro su <strong>CONTROLAVAGGIO</strong> (o aprire i cestelli dei prefiltri della pompa per pulirli).<br>
        4. Riaprire le valvole e avviare la pompa per circa 2 minuti (fino a quando l'acqua nello spia-scarico torna limpida).<br>
        5. Effettuare un breve <strong>RISCIACQUO</strong> (15 secondi) a pompa spenta prima di rimettere in <strong>FILTRAZIONE</strong>.
    </div>`;

    contenuto.innerHTML = testo;
    modal.classList.remove("hidden");
}

function mostraSeSECTION(sezioneId) {
    mostraSezione(sezioneId);
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

function apriFinestraDosaggio(parametro, valore, rigaIndice, fasciaColore) {
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
    
    let titoloFinestra = "";
    let coloreStato = "";
    
    if (fasciaColore === "giallo") {
        titoloFinestra = `<h3 style="color:#d97706; margin-bottom: 5px;">🔧 Ottimizzazione Parametro: ${parametro}</h3>`;
        coloreStato = `<span style="color:#d97706; font-weight:bold;">Valore fuori range ottimale (${valore}) - Entro i limiti di legge</span>`;
    } else {
        titoloFinestra = `<h3 style="color:#b91c1c; margin-bottom: 5px;">⚠️ Diagnostica Critica: ${parametro}</h3>`;
        coloreStato = `<span style="color:#b91c1c; font-weight:bold;">Valore FUORI NORMA Rilevato (${valore}) - Violazione Allegato A</span>`;
    }

    let testoDettaglio = titoloFinestra;
    testoDettaglio += `<p style="margin-bottom:8px;">Stato attuale: ${coloreStato} | Target ideale: <strong>${targetIdeale}</strong></p>`;
    testoDettaglio += `<p style="font-size:0.85rem; background:#edf2f7; padding:8px; margin: 10px 0; border-radius:4px; color:#4a5568;">
        Lettura delle ore: ${oraRilevamento || 'N.D.'} | Temp Vasca: ${tempVasca}°C | Ospiti registrati: ${numBagnanti}
    </p>`;

    if (pId === "cl. com") {
        if (fasciaColore === "giallo") {
            testoDettaglio += `<p><strong>Nota di esercizio:</strong> Il cloro combinato è leggermente sopra il tuo valore ideale di comfort. Il parametro è comunque a norma di legge. Monitorare alla prossima lettura per verificare l'autosmaltimento naturale.</p>`;
        } else {
            let doseShock = Math.round((5.0 - (isNaN(clLibero) ? 0 : clLibero)) * VOL_PISCINA * 1.54);
            testoDettaglio += `<div style="background:#fff5f5; border-left:4px solid #e53e3e; padding:10px; border-radius:4px; margin-top:10px;">
                <p style="color:#c53030; font-weight:bold; margin-bottom:5px;">🚨 SUPERAMENTO SOGLIA CRITICA CLORAMMINE (Cloro Combinato: ${valore} ppm)</p>
                <p><strong>Trattamento Shock Obbligatorio (Allegato A):</strong> Sospendere temporaneamente la balneazione. Sciogliere preventivamente in un secchio d'acqua **${doseShock} grammi** di **Ipoclorito di Calcio granulare** e versarlo uniformemente davanti alle bocchette di mandata. Mantenere la filtrazione attiva h24.</p>
            </div>`;
        }
    }
    else if (pId === "ph") {
        if (valNum > 7.30) {
            let deltaPh = valNum - 7.2;
            let doseKg = (deltaPh / 0.1) * 0.92;
            if (tempVasca > 27.0) doseKg *= 1.15;
            
            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Azione Correttiva Consigliata:</strong> Per ricondurre dolcemente il pH al target perfetto di 7,2 si consiglia di immettere <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong>, diluendolo in un secchio e distribuendolo lentamente davanti alle bocchette di mandata con pompa attiva.</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">⚠️ PH FUORI DAI LIMITI DI LEGGE</p>
                <p>Immettere immediatamente <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Meno (Acido Secco)</strong> nello skimmer o davanti alle bocchette per scongiurare opacità dell'acqua e inefficacia dei disinfettanti.</p>`;
            }
        } else if (valNum < 7.10) {
            let deltaPh = 7.2 - valNum;
            let doseKg = (deltaPh / 0.1) * 0.92;
            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Azione Correttiva Consigliata:</strong> Per riallineare il pH al valore ideale, aggiungere <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Più</strong> distribuendolo davanti alle bocchette di mandata.</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">⚠️ PH SOTTO IL LIMITE MINIMO DI LEGGE</p>
                <p>Aggiungere con urgenza <strong>${doseKg.toFixed(2).replace(".", ",")} Kg</strong> di <strong>pH Più</strong> per evitare fenomeni corrosivi sulle parti metalliche dell'impianto.</p>`;
            }
        }
    }
    else if (pId === "cl. lib") {
        if (valNum < 0.90) {
            let deltaCl = 1.1 - valNum;
            let grammiIpoclorito = (deltaCl / 0.65) * VOL_PISCINA;
            if (tempVasca > 27.0) grammiIpoclorito *= (1 + (tempVasca - 27.0) * 0.05);
            if (numBagnanti > 12) grammiIpoclorito *= 1.25;

            let grammiFinali = Math.round(grammiIpoclorito);
            let doseMattutina = Math.round(grammiFinali * 0.40);

            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Integrazione standard di Cloro:</strong> Il valore è leggermente basso ma a norma. Per ritornare alla quota ideale, il fabbisogno calcolato è di **${grammiFinali} grammi** di Ipoclorito di Calcio granulare.<br><br>
                • Versare il 40% (**${doseMattutina} grammi**) negli skimmer la mattina.<br>
                • Versare il restante 60% (**${grammiFinali - doseMattutina} grammi**) la sera a impianto chiuso davanti alle bocchette.</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">⚠️ LIVELLO DI CLORO LIBERO INSUFFICIENTE</p>
                <p>Fabbisogno totale urgente di ripristino: **${grammiFinali} grammi** di Ipoclorito di Calcio granulare da immettere per ristabilire la barriera igienica contro i batteri.</p>`;
            }
        } 
        else if (valNum > 1.10) {
            let deltaAbbattimento = valNum - 1.1;
            let grammiDecloratore = Math.round(deltaAbbattimento * VOL_PISCINA * 2.5);

            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Gestione Cloro Alto (Entro i limiti):</strong> Il disinfettante è superiore al target ideale ma perfettamente balneabile. Se preferisci riportarlo rapidamente al valore di comfort (1,1 ppm), puoi sciogliere in un secchio **${grammiDecloratore} grammi** di **Tiosolfato di Sodio (Decloratore)** e immetterlo negli skimmer.</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">🚨 BALNEAZIONE REGOLARE BLOCCATA (Cloro Libero superiore a 1,5 ppm)</p>
                <p><strong>Azione Correttiva Rapida:</strong> Sciogliere e immettere subito negli skimmer a filtrazione attiva **${grammiDecloratore} grammi** di **Tiosolfato di Sodio (Decloratore)** per ricondurre il valore entro i limiti dell'Allegato A ed evitare irritazioni ai bagnanti.</p>`;
            }
        }
    }
    else if (pId === "cya") {
        if (valNum > 50.0) {
            let frazioneMantenimento = 49.0 / valNum;
            let percentualeSvuotamento = Math.round((1.0 - frazioneMantenimento) * 100);
            let litriDaSostituire = Math.round((percentualeSvuotamento / 100) * VOL_PISCINA * 1000);

            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Nota sullo Stabilizzante:</strong> L'acido cianurico ha superato il range consigliato di 50 ppm. Non c'è un blocco normativo immediato, ma l'azione dell'ipoclorito inizia a rallentare. Alla prima occasione utile o durante i normali lavaggi del filtro, favorisci i ricambi parziali d'acqua per riallinearti al target.</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">🚨 ECCESSO CRITICO DI STABILIZZANTE (Soglia di sicurezza di 60 ppm superata)</p>
                <p>L'acido cianurico è a ${valore} ppm. C'è il forte rischio di blocco dell'azione disinfettante del cloro. Si rende necessario un ricambio parziale controllato del **${percentualeSvuotamento}%** della vasca (pari a circa **${litriDaSostituire.toLocaleString()} litri** di acqua fresca).</p>`;
            }
        }
    }
    else if (pId === "temp") {
        if (valNum > 27.0) {
            let litriRaffreddamento = Math.round(VOL_PISCINA * 1000 * ((valNum - 27.0) / (27.0 - TEMP_REINTEGRO)));
            
            if (fasciaColore === "giallo") {
                testoDettaglio += `<p><strong>Consiglio Tecnico:</strong> L'acqua è calda ma ampiamente a norma di legge. Se desideri abbassarla calorimetricamente verso i 27°C, puoi pianificare un reintegro controllato di **${litriRaffreddamento.toLocaleString()} litri** d'acqua fresca di rete (stimata a 22°C).</p>`;
            } else {
                testoDettaglio += `<p style="color:#b91c1c; font-weight:bold; margin-bottom:5px;">⚠️ TEMPERATURA SUPERIORE AI LIMITI DI LEGGE (Max 30°C)</p>
                <p>L'acqua a ${valore}°C accelera drasticamente il consumo di cloro e favorisce la proliferazione algale. Effettuare un ricambio cospicuo inserendo acqua fresca di rete per abbassare la temperatura complessiva del bacino.</p>`;
            }
        } else if (valNum < 25.0) {
            testoDettaglio += `<p>Temperatura dell'acqua fresca (${valore}°C). Monitorare le ore di irraggiamento solare diretto e coprire la vasca di notte per limitare la dispersioni di calore.</p>`;
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
    let pId = parametro.toLowerCase().trim();

    let oraIdx = dati.intestazioni.findIndex(h => h.toLowerCase().trim() === "ora");
    let phIdx = dati.intestazioni.findIndex(h => h.toLowerCase().trim() === "ph");

    dati.righe.forEach(riga => {
        if (oraIdx !== -1 && (!riga[oraIdx] || riga[oraIdx].trim() === "")) return;
        if (phIdx !== -1 && (!riga[phIdx] || riga[phIdx].trim() === "")) return;

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

    let tipoGrafico = 'line';
    if (pId === 'n.ospiti' || pId === 'reintegro  (l)' || pId === 'reintegro') {
        tipoGrafico = 'bar';
    }

    let coloreParametro = '#0066cc'; 
    if (pId === 'ph') coloreParametro = '#4f46e5';
    else if (pId === 'cl. lib') coloreParametro = '#0284c7';
    else if (pId === 'cl. tot') coloreParametro = '#0d9488';
    else if (pId === 'cl. com') coloreParametro = '#7c3aed';
    else if (pId === 'temp') coloreParametro = '#ea580c';
    else if (pId === 'cya') coloreParametro = '#db2777';
    else if (pId === 'n.ospiti') coloreParametro = '#10b981'; 
    else if (pId === 'reintegro  (l)' || pId === 'reintegro') coloreParametro = '#06b6d4';

    let zoneSfondo = null;
    if (tipoGrafico === 'line') {
        if (pId === 'ph') {
            zoneSfondo = { min: 6.0, max: 8.0, okMin: 7.1, okMax: 7.3, warnMin: 6.5, warnMax: 7.5 };
        } else if (pId === 'cl. lib') {
            zoneSfondo = { min: 0.0, max: 2.0, okMin: 0.9, okMax: 1.1, warnMin: 0.7, warnMax: 1.5 };
        } else if (pId === 'cl. com') {
            zoneSfondo = { min: 0.0, max: 1.0, okMin: 0.0, okMax: 0.2, warnMin: 0.0, warnMax: 0.4 };
        } else if (pId === 'cya') {
            zoneSfondo = { min: 0.0, max: 100.0, okMin: 0.0, okMax: 50.0, warnMin: 0.0, warnMax: 60.0 };
        } else if (pId === 'temp') {
            zoneSfondo = { min: 20.0, max: 35.0, okMin: 25.0, okMax: 27.0, warnMin: 24.0, warnMax: 30.0 };
        }
    }

    const pluginFasceSfondo = {
        id: 'zoneSfondoPlugin',
        beforeDraw: (chart) => {
            if (!zoneSfondo) return;
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;

            const disegnaRettangolo = (valMin, valMax, colore) => {
                let yTop = y.getPixelForValue(valMax);
                let yBottom = y.getPixelForValue(valMin);
                yTop = Math.max(yTop, top);
                yBottom = Math.min(yBottom, bottom);
                if (yBottom > yTop) {
                    ctx.fillStyle = colore;
                    ctx.fillRect(left, yTop, right - left, yBottom - yTop);
                }
            };

            const colRosso = 'rgba(254, 226, 226, 0.45)';
            const colGiallo = 'rgba(254, 243, 199, 0.5)';
            const colVerde = 'rgba(220, 252, 231, 0.55)';

            ctx.fillStyle = colRosso;
            ctx.fillRect(left, top, right - left, bottom - top);

            disegnaRettangolo(zoneSfondo.warnMin, zoneSfondo.warnMax, colGiallo);
            disegnaRettangolo(zoneSfondo.okMin, zoneSfondo.okMax, colVerde);
        }
    };

    let datasetConfig = {
        label: parametro,
        data: valori,
        borderColor: coloreParametro,
        backgroundColor: tipoGrafico === 'bar' ? coloreParametro + 'cc' : 'transparent',
        borderWidth: tipoGrafico === 'bar' ? 1 : 2,
        tension: 0.15,
        pointRadius: tipoGrafico === 'bar' ? 0 : 2,
        pointHoverRadius: tipoGrafico === 'bar' ? 0 : 4,
        pointBackgroundColor: coloreParametro
    };

    graficoCorrente = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: etichette,
            datasets: [datasetConfig]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: pId === 'cl. com' || pId === 'cya' || tipoGrafico === 'bar',
                    suggestedMin: zoneSfondo ? zoneSfondo.min : undefined,
                    suggestedMax: zoneSfondo ? zoneSfondo.max : undefined,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: true }
            }
        },
        plugins: zoneSfondo ? [pluginFasceSfondo] : []
    });
}

function closeOverlay() {
    document.getElementById("chartOverlay").classList.add("hidden");
    if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
}