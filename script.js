let graficoCorrente = null;
let datiRegistriGlobali = { chimico: [], contatori: [], pulizie: [], manutenzioni: [], consumi: []};

const VOL_PISCINA = 92; // 92 m³ costanti
const TEMP_REINTEGRO = 22.0;

const FILE_REGISTRI = {
    chimico: "REGISTRO CHIMICO 2026.csv",
    contatori: "REGISTRO CONTATORI.csv",
    pulizie: "REGISTRO PULIZIE PISCINA 2026.csv",
    consumi: "REGISTRO CONSUMI.csv"
};

document.addEventListener("DOMContentLoaded", () => {
    caricaTuttiIRegistri();
});

function caricaTuttiIRegistri() {
    let conteggioCaricamenti = 0;
    let chiavi = Object.keys(FILE_REGISTRI);

    chiavi.forEach(chiave => {
        Papa.parse(FILE_REGISTRI[chiave], {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                elaboraDatiTabella(chiave, risultati.data);
                conteggioCaricamenti++;
                
                if (conteggioCaricamenti === chiavi.length) {
                    setTimeout(scrollAllUltimaRiga, 300);
                }
            }
        });
    });
}

function elaboraDatiTabella(chiave, righeGrezze) {
    if (!righeGrezze || righeGrezze.length < 2) return;

    if (chiave === 'consumi') {
        try {
            mostraTabellaConsumi(righeGrezze);
        } catch (e) {
            console.error("Errore nel caricamento dei consumi:", e);
        }
        return; 
    }

    let intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
    let datiFormattati = [];

    for (let i = 1; i < righeGrezze.length; i++) {
        let rigaCorrente = righeGrezze[i];
        if (rigaCorrente.length === 0 || (rigaCorrente[0] === "" && rigaCorrente[1] === "")) continue;

        let oggettoRiga = {};
        intestazioni.forEach((intestazione, indice) => {
            let valoreCella = rigaCorrente[indice] ? rigaCorrente[indice].trim() : "";

            if (intestazione.toLowerCase() === 'ph' && valoreCella !== "") {
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
                let rigaEscaped = btoa(unescape(encodeURIComponent(JSON.stringify(riga))));
                attributoClick = `onclick="apriConsiglioDettagliato('${chiave}', ${vNum}, '${riga.Data || ''} ${riga.Ora || ''}', '${classeColore}', '${rigaEscaped}')"`;
            }

            html += `<td class="${classeColore}" ${attributoClick} style="${attributoClick !== '' ? 'cursor:pointer;' : ''}">${valoreTesto}</td>`;
        });
        html += "</tr>";
    });

    html += "</tr></tbody>";
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

function scrollAllUltimaRiga() {
    const tabellaCorpo = document.querySelector("#chimicoTable tbody");
    
    if (tabellaCorpo && tabellaCorpo.rows.length > 0) {
        let indiceUltimaCompilata = -1;
        const righe = tabellaCorpo.rows;

        let indiceColonnaPH = 2; 
        const ths = document.querySelectorAll("#chimicoTable thead th");
        ths.forEach((th, idx) => {
            if (th.textContent.trim().toLowerCase() === 'ph') {
                indiceColonnaPH = idx;
            }
        });

        for (let i = righe.length - 1; i >= 0; i--) {
            let cellaPH = righe[i].cells[indiceColonnaPH];
            if (cellaPH && cellaPH.textContent.trim() !== "") {
                indiceUltimaCompilata = i;
                break;
            }
        }

        if (indiceUltimaCompilata === -1) {
            indiceUltimaCompilata = righe.length - 1;
        }

        let indiceTarget = indiceUltimaCompilata + 2;
        
        if (indiceTarget >= righe.length) {
            indiceTarget = righe.length - 1;
        }

        let rigaTarget = righe[indiceTarget];
        rigaTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        
        let rigaCompilata = righe[indiceUltimaCompilata];
        rigaCompilata.style.transition = "background-color 0.5s";
        let colorePrecedente = rigaCompilata.style.backgroundColor;
        rigaCompilata.style.backgroundColor = "rgba(14, 165, 233, 0.15)";
        setTimeout(() => {
            rigaCompilata.style.backgroundColor = colorePrecedente;
        }, 1500);
    }
}

function apriConsiglioDettagliato(parametro, valore, dataOra, classeColore, rigaCriptata = "") {
    let p = parametro.toLowerCase().trim();
    const modalCard = document.querySelector(".dosage-card");
    
    let isRosso = (classeColore === "evidenzia-rosso");
    let intestazioneAllarme = "";
    
    let ospitiCorrenti = 0;
    let tempCorrente = 26.5; 
    let phCorrente = 7.3;
    let cyaCorrente = 0;

    if (rigaCriptata !== "") {
        try {
            let rigaDecodificata = JSON.parse(decodeURIComponent(escape(atob(rigaCriptata))));
            if (rigaDecodificata["N.Ospiti"]) ospitiCorrenti = parseInt(rigaDecodificata["N.Ospiti"]) || 0;
            if (rigaDecodificata["Temp"]) tempCorrente = parseFloat(rigaDecodificata["Temp"].replace(",", ".")) || 26.5;
            if (rigaDecodificata["pH"]) phCorrente = parseFloat(rigaDecodificata["pH"].replace(",", ".")) || 7.3;
            if (rigaDecodificata["CYA"]) cyaCorrente = parseFloat(rigaDecodificata["CYA"].replace(",", ".")) || 0;
        } catch(e) { console.log("Errore parsing parametri riga", e); }
    }
    
    if (modalCard) {
        if (isRosso) {
            modalCard.classList.add("modal-critica");
            intestazioneAllarme = `<div style="background-color:#fee2e2; color:#b91c1c; padding:10px; border-radius:4px; font-weight:bold; margin-bottom:15px;">🚨 ATTENZIONE: SEGNALAZIONE CRITICA FUORI LIMITE</div>`;
        } else {
            modalCard.classList.remove("modal-critica");
            intestazioneAllarme = `<div style="background-color:#fef9c3; color:#a16207; padding:10px; border-radius:4px; font-weight:bold; margin-bottom:15px;">⚠️ AVVISO: PARAMETRO FUORI FASCIA IDEALE</div>`;
        }
    }

    let titoloModale = `Diagnostica Parametro: ${parametro}`;
    let corpoHTML = `${intestazioneAllarme}<p style='font-size:0.85rem; color:#64748b; margin-bottom: 12px;'>Rilevazione del ${dataOra}</p>`;

    if (p === 'ph') {
        if (valore > 7.3) {
            let dLimite = valore - 7.5;
            let dIdeale = valore - 7.3;
            let gLimite = Math.round((dLimite / 0.1) * 10 * VOL_PISCINA);
            let gIdeale = Math.round((dIdeale / 0.1) * 10 * VOL_PISCINA);
            
            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Alto (${valore})</span></h3><br>
            <p style="margin-bottom:8px;"><strong>1. Dose correttiva di rientro (Limite 7.5):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Riduttore Acido.</p>
            <p><strong>2. Dose ottimale di stabilizzazione (Ideale 7.3):</strong> aggiungere <strong>${gIdeale}g</strong> di Riduttore Acido.</p>`;
        } else if (valore < 7.0) {
            let dLimite = 6.5 - valore;
            let dIdeale = 7.3 - valore;
            let gLimite = Math.round((dLimite / 0.1) * 10 * VOL_PISCINA);
            let gIdeale = Math.round((dIdeale / 0.1) * 10 * VOL_PISCINA);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Basso (${valore})</span></h3><br>
            <p style="margin-bottom:8px;"><strong>1. Dose correttiva di rientro (Limite 6.5):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di pH Plus.</p>
            <p><strong>2. Dose ottimale di stabilizzazione (Ideale 7.3):</strong> aggiungere <strong>${gIdeale}g</strong> di pH Plus.</p>`;
        }
    }
    else if (p === 'cl. lib' || p === 'cl. tot') {
        if (valore < 1.1) {
            let fattoreCaricoOspiti = ospitiCorrenti * 12; 
            let fattoreTemperatura = tempCorrente > 28 ? 1.4 : (tempCorrente > 26 ? 1.15 : 1.0);
            
            let dIdeale = 1.1 - valore;
            let baseGrammi = (dIdeale / 0.1) * 1.5 * VOL_PISCINA;
            let gIdeale = (baseGrammi + fattoreCaricoOspiti) * fattoreTemperatura;

            let notaIntegrazione = "";
            if (phCorrente > 7.5) {
                gIdeale = gIdeale * 1.35;
                notaIntegrazione += `<p style="color:#b45309; font-size:0.85rem; margin-top:4px;">ℹ️ <strong>Nota pH Alto (${phCorrente}):</strong> Il cloro è meno attivo. La dose è stata maggiorata del 35% per compensazione.</p>`;
            }

            if (cyaCorrente > 50) {
                let cloroMinimoRichiesto = cyaCorrente * 0.075;
                if (valore < cloroMinimoRichiesto) {
                    gIdeale = gIdeale * 1.5;
                    notaIntegrazione += `<p style="color:#b91c1c; font-size:0.85rem; margin-top:4px;">⚠️ <strong>Blocco da Stabilizzante (CYA ${cyaCorrente} ppm):</strong> Rilevato rischio blocco del cloro. Aggiunto il 50% di dosaggio per shock chimico.</p>`;
                }
            }

            gIdeale = Math.round(gIdeale);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Insufficiente (${valore} ppm)</span></h3><br>
            <p style="font-size:0.85rem; color:#475569; margin-bottom:8px;"><i>Analisi del contesto: Registrati ${ospitiCorrenti} ospiti con temp. acqua a ${tempCorrente}°C e pH a ${phCorrente}.</i></p>
            ${notaIntegrazione}
            <p style="margin-top:8px;"><strong>Dose ottimale di reintegro integrata (Ideale 1.1 ppm):</strong> aggiungere <strong>${gIdeale}g</strong> di Ipoclorito di Calcio granulare.</p>`;
        } else if (valore > 1.2) {
            if (isRosso) {
                let eccessoCloro = valore - 1.1;
                let grammiDecloratore = Math.round(eccessoCloro * 7 * VOL_PISCINA);

                corpoHTML += `<h3>Stato: <span style="color:#b91c1c;">🚨 CRITICITÀ: Cloro Fuori Limite di Legge (${valore} ppm)</span></h3><br>
                <p style="margin-bottom:12px; font-weight:bold; color:#b91c1c;">Il valore supera il tetto massimo di sicurezza (2.0 ppm). Vasca non balneabile.</p>
                <p><strong>Azione Correttiva di Etichetta:</strong></p>
                <p style="font-size:1.05rem; margin-top:6px;">Introdurre nello skimmer o nella vasca di compenso <strong>${grammiDecloratore}g</strong> di <strong>Decloratore (Sodio Tiosolfato)</strong> per rientrare tempestivamente a quota 1.1 ppm.</p>`;
            } else {
                corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Cloro Elevato (${valore} ppm)</span></h3><br>
                <p>Il valore supera la fascia ideale di 1.1 ppm ma rientra nei limiti tollerati di legge (2.0 ppm). Sospendere i dosaggi manuali e attendere il normale abbattimento.</p>`;
            }
        }
    }
    else if (p === 'cl. com') {
        if (isRosso) {
            let moltiplicatoreShock = valore > 0.6 ? 250 : 200; 
            let grammiIpocloritoShock = Math.round((moltiplicatoreShock * VOL_PISCINA) / 10);
            
            if (tempCorrente > 28) grammiIpocloritoShock = Math.round(grammiIpocloritoShock * 1.15);

            corpoHTML += `<h3>Stato: <span style="color:#b91c1c;">🚨 CRITICITÀ: Cloro Combinato Fuori Limite (${valore} ppm)</span></h3><br>
            <p style="margin-bottom:12px; font-weight:bold; color:#b91c1c;">Presenza elevata di cloroammine superiore al limite di sicurezza (0.40 ppm).</p>
            <p><strong>Trattamento Correttivo Shock da Scheda Tecnica:</strong></p>
            <p style="font-size:1.05rem; margin-top:6px; background:#fef2f2; padding:10px; border-left:4px solid #dc2626;">Immettere in vasca (preferibilmente a fine giornata senza bagnanti) <strong>${grammiIpocloritoShock}g</strong> di <strong>Ipoclorito di Calcio granulare</strong> per spezzare i legami azotati e ripulire l'acqua.</p>`;
        } else {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Cloro Combinato in Fasce di Avviso (${valore} ppm)</span></h3><br>
            <p style="margin-bottom:8px;">Il parametro supera il livello ottimale di benessere (0.20 ppm) ma è sotto il limite di legge (0.40 ppm). Monitorare e favorire leggeri ricambi d'acqua.</p>`;
        }
    }
    else if (p === 'temp') {
        if (valore > 28) {
            let lLimite = Math.round(((valore - 30) / (valore - TEMP_REINTEGRO)) * VOL_PISCINA * 1000);
            let lIdeale = Math.round(((valore - 27) / (valore - TEMP_REINTEGRO)) * VOL_PISCINA * 1000);

            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Temperatura Alta (${valore} °C)</span></h3><br>
            <p style="margin-bottom:8px;"><strong>1. Immissione minima di rientro (Limite 30°C):</strong> introdurre <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> di acqua nuova.</p>
            <p><strong>2. Immissione ottimale di benessere (Ideale 27°C):</strong> introdurre <strong>${lIdeale.toLocaleString()} Litri</strong> di acqua fresca di rete.</p>`;
        } else {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Temperatura Bassa (${valore} °C)</span></h3><br>
            <p>Nessun reintegro termico richiesto.</p>`;
        }
    }
    else if (p === 'cya') {
        let fLimite = (valore - 60) / valore;
        let fIdeale = (valore - 35) / valore;
        let lLimite = Math.round(fLimite * VOL_PISCINA * 1000);
        let lIdeale = Math.round(fIdeale * VOL_PISCINA * 1000);

        corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Acido Cianurico Elevato (${valore} ppm)</span></h3><br>
        <p style="margin-bottom:8px;"><strong>1. Scarico minimo di rientro (Sotto allarme 60 ppm):</strong> rinnovare <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> d'acqua.</p>
        <p><strong>2. Scarico ottimale di stabilizzazione (Valore perfetto 35 ppm):</strong> rinnovare <strong>${lIdeale.toLocaleString()} Litri</strong> d'acqua.</p>`;
    }
    else if (p === 'alka') {
        if (valore < 80) {
            let dLimite = 60 - valore;
            let dIdeale = 100 - valore;
            let gLimite = Math.round(dLimite * 1.7 * VOL_PISCINA);
            let gIdeale = Math.round(dIdeale * 1.7 * VOL_PISCINA);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Alcalinità Bassa (${valore} ppm)</span></h3><br>
            <p style="margin-bottom:8px;"><strong>1. Dose minima di rientro (Limite 60 ppm):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Bicarbonato di Sodio.</p>
            <p><strong>2. Dose ottimale di stabilizzazione (Ideale 100 ppm):</strong> aggiungere <strong>${gIdeale}g</strong> di Bicarbonato di Sodio.</p>`;
        } else if (valore > 120) {
            corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Alcalinità Alta (${valore} ppm)</span></h3><br>
            <p>Effetto tampone rigido. Frazionare piccole dosi di riduttore acido.</p>`;
        }
    }

    corpoHTML += `
    <button onclick="copiaTestoDosaggio()" style="margin-top:20px; width:100%; background:#0f172a; border:none; padding:10px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; color:#ffffff; transition: background 0.2s;">
        📋 Copia istruzioni di dosaggio
    </button>
    <script>
    function copiaTestoDosaggio() {
        let contenitore = document.getElementById('dosageContent');
        if(contenitore) {
            let testo = contenitore.innerText.replace('📋 Copia istruzioni di dosaggio', '');
            navigator.clipboard.writeText(testo.trim());
            alert('Istruzioni caricate negli appunti del telefono/PC!');
        }
    }
    </script>
    `;

    const modal = document.getElementById("dosageModal");
    const contenitore = document.getElementById("dosageContent");
    if (modal && contenitore) {
        contenitore.innerHTML = `<h2>${titoloModale}</h2><br>${corpoHTML}`;
        modal.classList.remove("hidden");
    }
}

function mostraSezione(idSezione) {
    document.querySelectorAll(".register-section").forEach(s => s.classList.add("hidden"));
    document.getElementById(idSezione)?.classList.remove("hidden");
    
    if (idSezione === 'chimicoSection') {
        setTimeout(scrollAllUltimaRiga, 150);
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

function mostraTabellaConsumi(dati) {
    const tbody = document.querySelector("#tabella-consumi tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let totaleCloro = 0;
    let totalePhMeno = 0;

    // Partiamo da 1 per saltare l'intestazione del CSV
    for (let i = 1; i < dati.length; i++) {
        let riga = dati[i];
        // Se la riga è vuota o ha pochissimi elementi, la saltiamo
        if (!riga || riga.length < 2) continue;

        let data = riga[0] ? riga[0].trim() : "";
        let phTesto = riga[1] ? riga[1].trim() : "";
        let cloroTesto = riga[2] ? riga[2].trim() : "";
        
        // Cerchiamo la colonna Note: proviamo l'indice 6 (colonna G), altrimenti l'ultimo disponibile
        let note = "";
        if (riga[6]) {
            note = riga[6].trim();
        } else if (riga.length > 3) {
            note = riga[riga.length - 1].trim();
        }

        // Se l'intera riga non contiene informazioni utili, la saltiamo
        if (!data && !cloroTesto && !phTesto && !note) continue;

        // Pulizia dei caratteri di testo per la conversione numerica dei grammi
        let phMeno = parseInt(phTesto.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9]/g, ''), 10) || 0;
        let cloro = parseInt(cloroTesto.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9]/g, ''), 10) || 0;

        totaleCloro += cloro;
        totalePhMeno += phMeno;

        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${data}</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #0066cc;">${cloro > 0 ? cloro.toLocaleString('it-IT') + ' g' : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #cc0000;">${phMeno > 0 ? phMeno.toLocaleString('it-IT') + ' g' : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-style: italic; color: #555; padding-left: 20px;">${note}</td>
        `;
        tbody.appendChild(tr);
    }

    // Aggiorna i riquadri dei totali generali in alto nella scheda
    if (document.getElementById("tot-cloro")) {
        document.getElementById("tot-cloro").innerText = `${totaleCloro.toLocaleString('it-IT')} g`;
    }
    if (document.getElementById("tot-phmeno")) {
        document.getElementById("tot-phmeno").innerText = `${totalePhMeno.toLocaleString('it-IT')} g`;
    }
}