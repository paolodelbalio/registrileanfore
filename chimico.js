// ============================================================
// Gestore Isolato Separato per il Registro Chimico
// ============================================================
(function () {
    const FILE_CHIMICO = "REGISTRO CHIMICO 2026.csv";
    const VOL_PISCINA = 92; // 92 m³ costanti
    const TEMP_REINTEGRO = 22.0;

    let graficoCorrente = null;
    let datiChimico = [];

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroChimico();
    });

    function caricaRegistroChimico() {
        if (typeof Papa === 'undefined') {
            console.error("[Chimico] PapaParse non è disponibile: controlla che papaparse.min.js sia caricato prima di chimico.js");
            return;
        }

        Papa.parse(FILE_CHIMICO, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function (risultati) {
                console.log("[Chimico] CSV caricato:", risultati.data.length, "righe");
                elaboraDatiChimico(risultati.data);
                setTimeout(scrollAllUltimaRiga, 300);
            },
            error: function (errore) {
                console.error("[Chimico] Errore nel caricamento del CSV:", errore, "- controlla che il file '" + FILE_CHIMICO + "' esista con questo nome esatto nel repository");
            }
        });
    }

    function elaboraDatiChimico(righeGrezze) {
        if (!righeGrezze || righeGrezze.length < 2) return;

        let intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
        let datiFormattati = [];

        for (let i = 1; i < righeGrezze.length; i++) {
            let rigaCorrente = righeGrezze[i];
            if (rigaCorrente.length === 0 || (rigaCorrente[0] === "" && rigaCorrente[1] === "")) continue;

            let oggettoRiga = {};
            intestazioni.forEach((intestazione, indice) => {
                let valoreCella = rigaCorrente[indice] ? rigaCorrente[indice].trim() : "";

                if (intestazione.toLowerCase() === 'cya' && valoreCella !== "") {
                    let match = valoreCella.match(/^([0-9.,]+)/);
                    if (match) valoreCella = match[1];
                }

                oggettoRiga[intestazione] = valoreCella;
            });
            datiFormattati.push(oggettoRiga);
        }

        datiChimico = datiFormattati;
        creaTabellaChimica(intestazioni, datiFormattati);
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
            if (n === 'ph') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'pH', '#ff6384', 'line')" style="cursor:pointer; text-decoration:underline;">pH</th>`;
            else if (n === 'cl. lib') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Cloro Libero', '#36a2eb', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Lib</th>`;
            // Cl. Tot è solo un dato di calcolo (non richiesto dalla legge): colonna sempre visibile
            // ma neutra, senza colori di allarme.
            else if (n === 'cl. tot') html += `<th>Cl. Tot</th>`;
            else if (n === 'cl. com') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Cloro Combinato', '#ff9f40', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Com</th>`;
            else if (n === 'temp') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Temperatura', '#ffcd56', 'line')" style="cursor:pointer; text-decoration:underline;">Temp</th>`;
            else if (n === 'n.ospiti') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Numero Ospiti', '#9966ff', 'bar')" style="cursor:pointer; text-decoration:underline;">N.Ospiti</th>`;
            else if (n === 'cya') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Acido Cianurico', '#c9cbcf', 'line')" style="cursor:pointer; text-decoration:underline;">Cya</th>`;
            else if (n === 'alka') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Alcalinità', '#22c55e', 'line')" style="cursor:pointer; text-decoration:underline;">Alka</th>`;
            else html += `<th>${label}</th>`;
        });
        html += "</tr></thead><tbody>";

        dati.forEach(riga => {
            html += "<tr>";
            intestazioni.forEach(chiave => {
                let n = chiave.trim().toLowerCase();
                let valoreTesto = riga[chiave] ? riga[chiave].trim() : "";

                if (n === 'cl. com' && valoreTesto !== "") {
                    let vCom = parseFloat(valoreTesto.replace(",", "."));
                    if (!isNaN(vCom)) valoreTesto = vCom.toFixed(2).replace(".", ",");
                }

                // Cl. Tot è solo un riferimento di calcolo: nessuna evidenziazione a colori,
                // nessun popup di dettaglio, sempre lo stesso colore neutro.
                if (n === 'cl. tot') {
                    html += `<td class="testo-muto">${valoreTesto}</td>`;
                    return;
                }

                let vNum = parseFloat(valoreTesto.replace(",", "."));
                let classeColore = ottieniClasseColore(chiave, vNum);

                let attributoClick = "";
                if (classeColore === "evidenzia-giallo" || classeColore === "evidenzia-rosso") {
                    let rigaEscaped = btoa(unescape(encodeURIComponent(JSON.stringify(riga))));
                    attributoClick = `onclick="window.apriConsiglioDettagliato('${chiave}', ${vNum}, '${riga.Data || ''} ${riga.Ora || ''}', '${classeColore}', '${rigaEscaped}')"`;
                }

                html += `<td class="${classeColore}" ${attributoClick} style="${attributoClick !== '' ? 'cursor:pointer;' : ''}">${valoreTesto}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }

    function scrollAllUltimaRiga() {
        const tabellaCorpo = document.querySelector("#chimicoTable tbody");
        if (!tabellaCorpo || tabellaCorpo.rows.length === 0) return;

        let indiceUltimaCompilata = -1;
        const righe = tabellaCorpo.rows;

        let indiceColonnaPH = 2;
        const ths = document.querySelectorAll("#chimicoTable thead th");
        ths.forEach((th, idx) => {
            if (th.textContent.trim().toLowerCase() === 'ph') indiceColonnaPH = idx;
        });

        for (let i = righe.length - 1; i >= 0; i--) {
            let cellaPH = righe[i].cells[indiceColonnaPH];
            if (cellaPH && cellaPH.textContent.trim() !== "") {
                indiceUltimaCompilata = i;
                break;
            }
        }

        if (indiceUltimaCompilata === -1) indiceUltimaCompilata = righe.length - 1;

        let indiceTarget = indiceUltimaCompilata + 2;
        if (indiceTarget >= righe.length) indiceTarget = righe.length - 1;

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

    window.apriConsiglioDettagliato = function (parametro, valore, dataOra, classeColore, rigaCriptata = "") {
        let p = parametro.toLowerCase().trim();
        const modalCard = document.querySelector(".dosage-card");

        let isRosso = (classeColore === "evidenzia-rosso");
        let intestazioneAllarme = "";

        let ospitiCorrenti = 0;
        let tempCorrente = 26.5;
        if (rigaCriptata !== "") {
            try {
                let rigaDecodificata = JSON.parse(decodeURIComponent(escape(atob(rigaCriptata))));
                if (rigaDecodificata["N.Ospiti"]) ospitiCorrenti = parseInt(rigaDecodificata["N.Ospiti"]) || 0;
                if (rigaDecodificata["Temp"]) tempCorrente = parseFloat(rigaDecodificata["Temp"].replace(",", ".")) || 26.5;
            } catch (e) { console.log("Errore parsing parametri riga", e); }
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
                let gIdeale = Math.round((baseGrammi + fattoreCaricoOspiti) * fattoreTemperatura);

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Basso (${valore} mg/l)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>Dose correttiva stimata (in base a ${ospitiCorrenti} ospiti e ${tempCorrente}°C):</strong> aggiungere circa <strong>${gIdeale > 0 ? gIdeale : 0}g</strong> di Ipoclorito di Calcio.</p>`;
            } else if (valore > 1.2) {
                corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Cloro Alto (${valore} mg/l)</span></h3><br>
                <p>Sospendere il dosaggio di cloro e attendere il rientro naturale dei valori prima di reintegrare.</p>`;
            }
        }
        else if (p === 'cl. com') {
            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Combinato Elevato (${valore} mg/l)</span></h3><br>
            <p>Valutare uno shock clorativo o l'aggiunta di ossidante non clorato, e verificare il ricambio d'acqua.</p>`;
        }
        else if (p === 'temp') {
            if (valore > 28) {
                let dLimite = valore - 30;
                let dIdeale = valore - 27;
                let lLimite = Math.round(dLimite * 1000 * VOL_PISCINA / (valore - TEMP_REINTEGRO));
                let lIdeale = Math.round(dIdeale * 1000 * VOL_PISCINA / (valore - TEMP_REINTEGRO));

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Temperatura Alta (${valore} °C)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>1. Reintegro minimo di raffreddamento (Limite 30°C):</strong> introdurre <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> di acqua fresca di rete.</p>
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

        const modal = document.getElementById("dosageModal");
        const contenitore = document.getElementById("dosageContent");
        if (modal && contenitore) {
            contenitore.innerHTML = `<h2>${titoloModale}</h2><br>${corpoHTML}`;
            modal.classList.remove("hidden");
        }
    };

    window.apriGraficoChimico = function (chiaveFiltro, nomeParametro, coloreLinea, tipoGrafico) {
        const overlay = document.getElementById("chartOverlay");
        const ctx = document.getElementById("overlayCanvas")?.getContext("2d");
        if (!overlay || !ctx) return;

        document.getElementById("overlayTitle").textContent = "Andamento Storico: " + nomeParametro;
        overlay.classList.remove("hidden");

        let etichette = [];
        let valori = [];

        // Individua l'indice dell'ultima riga con una misurazione reale (pH compilato).
        // Alcune colonne (es. Cl. Com) arrivano precompilate con "0" anche sulle righe
        // future non ancora misurate: senza questo taglio i grafici proseguirebbero
        // piatti fino all'ultima riga del registro (es. settembre) invece di fermarsi
        // all'ultima rilevazione effettiva.
        let ultimoIndiceValido = -1;
        datiChimico.forEach((riga, idx) => {
            let phTesto = (riga["pH"] || "").trim();
            if (phTesto !== "" && !isNaN(parseFloat(phTesto.replace(",", ".")))) {
                ultimoIndiceValido = idx;
            }
        });

        datiChimico.forEach((riga, idx) => {
            if (ultimoIndiceValido !== -1 && idx > ultimoIndiceValido) return;
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
    };

    window.chiudiDosaggio = function () {
        document.getElementById("dosageModal")?.classList.add("hidden");
    };

    window.closeOverlay = function () {
        document.getElementById("chartOverlay")?.classList.add("hidden");
        if (graficoCorrente) { graficoCorrente.destroy(); graficoCorrente = null; }
    };
})();