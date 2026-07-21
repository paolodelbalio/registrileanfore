// ============================================================
// Gestore Isolato Separato per il Registro Chimico
// ============================================================
(function () {
    const FILE_CHIMICO = "REGISTRO CHIMICO 2026.csv";
    const VOL_PISCINA = 92; // 92 m³ costanti
    const TEMP_REINTEGRO = 22.0;

    // Modello validato sui dati reali del periodo ipoclorito (dose, temp, ospiti, CYA -> delta
    // Cl.Lib nella giornata, R²=0,68 su 30 giorni). Sostituisce la vecchia formula (mai validata).
    const COEF_CLORO_BASE = { dose: 0.00607, temp: -0.05777, ospiti: -0.05795, cya: 0.02951, intercetta: -0.57151 };
    const LIMITE_ANOMALO_CLORO_G = 350; // riferimento storico (dose massima normalmente usata finora), non una soglia di errore: superarlo può essere legittimo in certe condizioni

    // pH-: dose massima realmente testata sui dati storici (Registro Consumi). Non è una soglia
    // di errore ma di dati mancanti: oltre questo valore la scalatura per Alka non è verificata.
    const LIMITE_ANOMALO_PHMENO_G = 2000;

    // Water Stop Cloro (Sodio Bisolfito): dall'etichetta, 100g riducono il cloro di 0,5 ppm
    // ogni 100 m³ d'acqua. Convertito per la vasca di Le Anfore (92 m³): 184g per ogni ppm da ridurre.
    const GRAMMI_DECLORATORE_PER_PPM = 184;

    const MESI_IT_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

    // Interpreta una data nel formato "lun 13 lug 2026" (quello già usato nel CSV) e restituisce
    // un oggetto Date, o null se il testo non è nel formato atteso. Serve per confrontare la data
    // di una riga con la data di oggi (promemoria CYA/TA: deve accendersi solo il giorno giusto,
    // non su tutti i lun/gio passati o futuri).
    function parseDataItalianaChimico(testo) {
        let parti = (testo || '').trim().split(/\s+/);
        if (parti.length < 4) return null;
        let giorno = parseInt(parti[1], 10);
        let meseIdx = MESI_IT_BREVI.indexOf(parti[2].toLowerCase());
        let anno = parseInt(parti[3], 10);
        if (isNaN(giorno) || meseIdx === -1 || isNaN(anno)) return null;
        return new Date(anno, meseIdx, giorno);
    }

    // Costruisce uno sfondo "a bande" che replica l'alternanza bianco/grigio delle righe della
    // tabella (tr:nth-child(even) -> #f8fafc) dentro a una cella unita (rowspan). Serve perché
    // una cella con rowspan ha UN SOLO sfondo per tutta la sua area: senza questo trucco le
    // colonne CYA/Alka apparirebbero con un blocco di colore fisso invece di alternarsi.
    function costruisciSfondoARighe(numeroRighe, indiceRigaAncora) {
        const BIANCO = "#ffffff";
        const GRIGIO = "#f8fafc";
        const BORDO = "#cbd5e1";
        let step = 100 / numeroRighe;
        let stops = [];
        for (let i = 0; i < numeroRighe; i++) {
            let numeroRigaAssoluta = indiceRigaAncora + i + 1;
            let colore = (numeroRigaAssoluta % 2 === 0) ? GRIGIO : BIANCO;
            let inizio = (i * step).toFixed(3) + "%";
            let fine = ((i + 1) * step).toFixed(3) + "%";
            if (i === numeroRighe - 1) fine = "calc(100% - 1px)";
            stops.push(`${colore} ${inizio}`, `${colore} ${fine}`);
        }
        stops.push(`${BORDO} calc(100% - 1px)`, `${BORDO} 100%`);
        return `linear-gradient(to bottom, ${stops.join(", ")})`;
    }

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

        window.__registroChimicoDati = datiFormattati;
        document.dispatchEvent(new CustomEvent("chimico:datiPronti", { detail: datiFormattati }));
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
            if (v >= 0 && v <= 50) return "evidenzia-verde";
            if (v > 50 && v <= 75) return "evidenzia-giallo";
            return "evidenzia-rosso";
        }
        if (p === 'alka') {
            if (v >= 80 && v <= 100) return "evidenzia-verde";
            if ((v >= 60 && v < 80) || (v > 100 && v <= 150)) return "evidenzia-giallo";
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
            else if (n === 'cl. tot') html += `<th>Cl. Tot</th>`;
            else if (n === 'cl. com') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Cloro Combinato', '#ff9f40', 'line')" style="cursor:pointer; text-decoration:underline;">Cl. Com</th>`;
            else if (n === 'temp') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Temperatura', '#ffcd56', 'line')" style="cursor:pointer; text-decoration:underline;">Temp</th>`;
            else if (n === 'n.ospiti') html += `<th class="col-nospiti" onclick="window.apriGraficoChimico('${chiave}', 'Numero Ospiti', '#9966ff', 'bar')" style="cursor:pointer; text-decoration:underline;">N.Ospiti</th>`;
            else if (n === 'cya') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Acido Cianurico', '#c9cbcf', 'line')" style="cursor:pointer; text-decoration:underline;">Cya</th>`;
            else if (n === 'alka') html += `<th onclick="window.apriGraficoChimico('${chiave}', 'Alcalinità', '#22c55e', 'line')" style="cursor:pointer; text-decoration:underline;">Alka</th>`;
            else if (n === 'note') html += `<th class="col-note">${label}</th>`;
            else html += `<th>${label}</th>`;
        });
        html += "</tr></thead><tbody>";

        let cyaCorrente = null;
        let cyaPerRiga = dati.map(riga => {
            let val = parseFloat((riga['Cya'] || '').replace(',', '.'));
            if (!isNaN(val)) cyaCorrente = val;
            return cyaCorrente;
        });

        // Stesso principio del CYA: l'Alka è letta solo 2 volte/settimana, qui la "propaghiamo"
        // in avanti così il popup diagnostico del pH ha sempre un valore di riferimento recente.
        let alkaCorrente = null;
        let alkaPerRiga = dati.map(riga => {
            let val = parseFloat((riga['Alka'] || '').replace(',', '.'));
            if (!isNaN(val)) alkaCorrente = val;
            return alkaCorrente;
        });

        // Gli ospiti sono scritti solo sulla riga delle 7 di ogni giorno: qui li propaghiamo
        // alla riga delle 21 dello STESSO giorno (reset ad ogni nuova data, a differenza di
        // CYA/Alka che invece devono restare validi anche per giorni successivi).
        let ospitiCorrente = null;
        let ospitiPerRiga = dati.map(riga => {
            let d = (riga['Data'] || '').trim();
            if (d !== "") ospitiCorrente = null;
            let val = parseInt(riga['N.Ospiti'], 10);
            if (!isNaN(val)) ospitiCorrente = val;
            return ospitiCorrente;
        });

        let dataCorrente = "";
        let dataPerRiga = dati.map(riga => {
            let d = (riga['Data'] || '').trim();
            if (d !== "") dataCorrente = d;
            return dataCorrente;
        });

        let righeDaSaltare = { cya: 0, alka: 0 };

        dati.forEach((riga, indiceRiga) => {
            html += "<tr>";
            intestazioni.forEach(chiave => {
                let n = chiave.trim().toLowerCase();
                let valoreTesto = riga[chiave] ? riga[chiave].trim() : "";

                if (n === 'cl. com' && valoreTesto !== "") {
                    let vCom = parseFloat(valoreTesto.replace(",", "."));
                    if (!isNaN(vCom)) valoreTesto = vCom.toFixed(2).replace(".", ",");
                }

                if (n === 'cl. tot') {
                    html += `<td class="testo-muto" title="${valoreTesto.replace(/"/g, '&quot;')}">${valoreTesto}</td>`;
                    return;
                }

                if (n === 'cya' || n === 'alka') {
                    if (righeDaSaltare[n] > 0) {
                        righeDaSaltare[n]--;
                        return;
                    }

                    let ora07 = (riga['Ora'] || '').trim().startsWith('07');
                    let giornoTesto = dataPerRiga[indiceRiga];
                    let eAncoraLun = ora07 && giornoTesto.startsWith('lun ');
                    let eAncoraGio = ora07 && giornoTesto.startsWith('gio ');

                    if (!eAncoraLun && !eAncoraGio) {
                        html += `<td class="testo-muto col-${n}" title="${valoreTesto.replace(/"/g, '&quot;')}">${valoreTesto || '-'}</td>`;
                        return;
                    }

                    let righeBlocco = eAncoraLun ? 6 : 8;
                    righeBlocco = Math.min(righeBlocco, dati.length - indiceRiga);
                    righeDaSaltare[n] = righeBlocco - 1;

                    let vNum = parseFloat(valoreTesto.replace(",", "."));

                    let dataRigaObj = parseDataItalianaChimico(giornoTesto);
                    let oggiObj = new Date();
                    oggiObj.setHours(0, 0, 0, 0);
                    let eOggi = dataRigaObj && dataRigaObj.getTime() === oggiObj.getTime();

                    let ePromemoriaMancante = valoreTesto === '' && eOggi;
                    let classeValore = (valoreTesto === '') ? '' : ottieniClasseColore(chiave, vNum);

                    let attributoClick = "";
                    if (!ePromemoriaMancante && classeValore !== '' && !isNaN(vNum)) {
                        let rigaConCya = Object.assign({}, riga, { _cyaStimato: cyaPerRiga[indiceRiga], _alkaStimato: alkaPerRiga[indiceRiga], _ospitiStimato: ospitiPerRiga[indiceRiga] });
                        let rigaEscaped = btoa(unescape(encodeURIComponent(JSON.stringify(rigaConCya))));
                        attributoClick = `onclick="window.apriConsiglioDettagliato('${chiave}', ${vNum}, '${riga.Data || ''} ${riga.Ora || ''}', '${classeValore}', '${rigaEscaped}')"`;
                    }

                    let titoloCella = ePromemoriaMancante
                        ? `Misurazione ${n === 'cya' ? 'CYA' : 'TA/Alcalinità'} in programma oggi (lun/gio) — non ancora inserita`
                        : valoreTesto.replace(/"/g, '&quot;');

                    let contenutoBadge;
                    if (ePromemoriaMancante) {
                        contenutoBadge = `<span class="evidenzia-rosso" style="display:inline-block; padding:3px 10px; border-radius:5px;">&nbsp;</span>`;
                    } else {
                        contenutoBadge = `<span class="${classeValore}" style="display:inline-block; padding:3px 10px; border-radius:5px;">${valoreTesto}</span>`;
                    }

                    let sfondoARighe = costruisciSfondoARighe(righeBlocco, indiceRiga);

                    html += `<td class="col-${n}" rowspan="${righeBlocco}" ${attributoClick} title="${titoloCella}" style="text-align:center; vertical-align:${ePromemoriaMancante ? 'top' : 'middle'}; ${ePromemoriaMancante ? 'padding-top:8px;' : ''} background:${sfondoARighe}; ${attributoClick !== '' ? 'cursor:pointer;' : ''}">${contenutoBadge}</td>`;
                    return;
                }

                let vNum = parseFloat(valoreTesto.replace(",", "."));
                let classeColore = ottieniClasseColore(chiave, vNum);

                let attributoClick = "";
                if ((classeColore === "evidenzia-giallo" || classeColore === "evidenzia-rosso") && !isNaN(vNum)) {
                    let rigaConCya = Object.assign({}, riga, { _cyaStimato: cyaPerRiga[indiceRiga], _alkaStimato: alkaPerRiga[indiceRiga], _ospitiStimato: ospitiPerRiga[indiceRiga] });
                    let rigaEscaped = btoa(unescape(encodeURIComponent(JSON.stringify(rigaConCya))));
                    attributoClick = `onclick="window.apriConsiglioDettagliato('${chiave}', ${vNum}, '${riga.Data || ''} ${riga.Ora || ''}', '${classeColore}', '${rigaEscaped}')"`;
                }

                let classeColonnaExtra = (n === 'n.ospiti') ? ' col-nospiti' : (n === 'note' ? ' col-note' : '');

                html += `<td class="${classeColore}${classeColonnaExtra}" ${attributoClick} title="${valoreTesto.replace(/"/g, '&quot;')}" style="${attributoClick !== '' ? 'cursor:pointer;' : ''}">${valoreTesto}</td>`;
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
        let ospitiDisponibili = false;
        let tempCorrente = 26.5;
        let cyaCorrenteRiga = null;
        let alkaCorrenteRiga = null;
        let clLibCorrente = null;
        if (rigaCriptata !== "") {
            try {
                let rigaDecodificata = JSON.parse(decodeURIComponent(escape(atob(rigaCriptata))));
                if (rigaDecodificata["N.Ospiti"] !== undefined && rigaDecodificata["N.Ospiti"] !== "") {
                    ospitiCorrenti = parseInt(rigaDecodificata["N.Ospiti"]) || 0;
                    ospitiDisponibili = true;
                } else if (rigaDecodificata["_ospitiStimato"] != null) {
                    ospitiCorrenti = rigaDecodificata["_ospitiStimato"];
                    ospitiDisponibili = true;
                }
                if (rigaDecodificata["Temp"]) tempCorrente = parseFloat(rigaDecodificata["Temp"].replace(",", ".")) || 26.5;
                if (rigaDecodificata["_cyaStimato"] != null) cyaCorrenteRiga = rigaDecodificata["_cyaStimato"];
                if (rigaDecodificata["_alkaStimato"] != null) alkaCorrenteRiga = rigaDecodificata["_alkaStimato"];
                if (rigaDecodificata["Cl. Lib"]) clLibCorrente = parseFloat(rigaDecodificata["Cl. Lib"].replace(",", ".")) || null;
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
        corpoHTML += `<p style="font-size:0.8rem; color:#334155; background-color:#f1f5f9; padding:6px 10px; border-radius:4px; margin-bottom:12px;">
            👥 Ospiti: ${ospitiDisponibili ? ospitiCorrenti : 'n/d (non registrati su questa riga)'}
        </p>`;

        if (p === 'ph') {
            if (valore > 7.3) {
                // Tasso base validato sui dati reali (regressione pulita, n=30, post 15/6):
                // ~943g per 0,1 pH con Alka vasca ~100 ppm — praticamente identico al tasso
                // teorico della formula (920g), quindi confermato. Scalato linearmente sull'Alka
                // corrente: più tampone (Alka alto) = serve più prodotto per lo stesso effetto,
                // coerente con le due dosi da 2000g fatte con Alka 155-157 che hanno mosso il pH
                // pochissimo. Scalatura lineare di primo ordine, da raffinare con più letture Alka.
                let alkaRiferimento = alkaCorrenteRiga != null ? alkaCorrenteRiga : 100;
                let fattoreAlka = alkaRiferimento / 100;

                let dLimite = valore - 7.5;
                let dIdeale = valore - 7.3;
                let gLimite = Math.round((dLimite / 0.1) * 10 * VOL_PISCINA * fattoreAlka);
                let gIdeale = Math.round((dIdeale / 0.1) * 10 * VOL_PISCINA * fattoreAlka);

                let notaAlka = alkaCorrenteRiga != null
                    ? `<p style="font-size:0.75rem; color:#94a3b8;">Dose corretta per l'alcalinità attuale (Alka ${Math.round(alkaRiferimento)} ppm) — con TA più alto serve più prodotto per lo stesso effetto (effetto tampone), con TA più basso ne serve meno.</p>`
                    : `<p style="font-size:0.75rem; color:#94a3b8;">Nessuna lettura recente di Alka: dose calcolata assumendo Alka standard (100 ppm). Misurala per un consiglio più preciso.</p>`;

                let avvisoNonValidato = gIdeale > LIMITE_ANOMALO_PHMENO_G
                    ? `<p style="font-size:0.8rem; color:#0369a1;">ℹ️ Dose più alta di quanto tu abbia mai testato in un solo giorno (max storico ${LIMITE_ANOMALO_PHMENO_G}g) — non è detto sia sbagliata, ma a queste quantità non abbiamo dati reali. Valuta di dosarne una parte oggi, rimisurare, e completare nei giorni successivi.</p>`
                    : "";

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Alto (${valore})</span></h3><br>
                <p style="margin-bottom:8px;"><strong>1. Dose correttiva di rientro (Limite 7.5):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Riduttore Acido.</p>
                <p><strong>2. Dose ottimale di stabilizzazione (Ideale 7.3):</strong> aggiungere <strong>${gIdeale}g</strong> di Riduttore Acido.</p>
                ${notaAlka}
                ${avvisoNonValidato}`;
            } else if (valore < 7.0) {
                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">pH Basso (${valore})</span></h3><br>
                <p style="margin-bottom:8px;"><strong>Suggerimento:</strong> aumenta il reintegro nei prossimi giorni. L'acqua di rete (pH 7,49, alcalinità elevata) tende a far risalire gradualmente sia il pH che il TA della vasca.</p>
                <p style="font-size:0.75rem; color:#94a3b8;">Non abbiamo ancora un modello numerico affidabile "litri di reintegro → variazione pH" (a differenza del pH-, qui non ci sono dati sufficienti per calcolare grammi/litri precisi). Trattalo come indicazione qualitativa: aumenta il reintegro rispetto al solito, poi verifica l'effetto nella lettura successiva.</p>
                <p style="font-size:0.75rem; color:#94a3b8;">Nota: il rientro sarà più lento del pH- (non è un'aggiunta diretta di prodotto, ma un ricambio d'acqua), quindi non aspettarti un effetto già nella lettura delle 21:00 dello stesso giorno.</p>`;
            }
        }
        else if (p === 'cl. lib' || p === 'cl. tot') {
            if (valore < 1.1) {
                let cyaCorrente = cyaCorrenteRiga != null ? cyaCorrenteRiga : 50;
                let dIdeale = 1.05 - valore;
                let contributiNoti = COEF_CLORO_BASE.temp * tempCorrente + COEF_CLORO_BASE.ospiti * ospitiCorrenti
                    + COEF_CLORO_BASE.cya * cyaCorrente + COEF_CLORO_BASE.intercetta;
                let gIdeale = Math.max(0, Math.round((dIdeale - contributiNoti) / COEF_CLORO_BASE.dose));

                let avvisoAnomalo = gIdeale > LIMITE_ANOMALO_CLORO_G
                    ? `<p style="font-size:0.8rem; color:#0369a1;">ℹ️ Più alto di quanto tu abbia normalmente dosato finora (di solito sotto ${LIMITE_ANOMALO_CLORO_G}g) — non è detto sia sbagliato, ma vale la pena ricontrollare temperatura/CYA prima di seguirlo.</p>`
                    : "";

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Basso (${valore} mg/l)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>Dose correttiva stimata (in base a ${ospitiCorrenti} ospiti, ${tempCorrente}°C e CYA ${Math.round(cyaCorrente)} ppm):</strong> aggiungere circa <strong>${gIdeale}g</strong> di Ipoclorito di Calcio.</p>
                ${avvisoAnomalo}
                <p style="font-size:0.75rem; color:#94a3b8;">Stima di massima (modello validato R²=0,68) — per un calcolo più completo, che include anche il consumo notturno e il reintegro, usa "💡 Suggerimento dose di oggi" in cima alla pagina.</p>`;
            } else if (valore > 1.2) {
                let deltaDaRidurre = valore - 1.05;
                let grammiDecloratore = Math.round(deltaDaRidurre * GRAMMI_DECLORATORE_PER_PPM);

                corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Cloro Alto (${valore} mg/l)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>Dose di Decloratore (Water Stop Cloro) per rientrare in fascia:</strong> aggiungere circa <strong>${grammiDecloratore}g</strong>.</p>
                <p style="font-size:0.75rem; color:#94a3b8;">Calcolato dall'etichetta del prodotto (100g riducono 0,5 ppm ogni 100 m³), convertito per la vasca da 92 m³.</p>
                <p>In alternativa, sospendere il dosaggio di cloro e attendere il rientro naturale dei valori prima di reintegrare.</p>`;
            }
        }
        else if (p === 'cl. com') {
            let targetShock = valore * 10;
            let baseCorrente = clLibCorrente != null ? clLibCorrente : 1.0;
            let deltaShock = Math.max(0, targetShock - baseCorrente);
            let grammiShock = Math.round(deltaShock / COEF_CLORO_BASE.dose);

            let grammiPhStimati = Math.round(grammiShock * 0.10);

            corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Cloro Combinato Elevato (${valore} mg/l)</span></h3><br>
            <p style="margin-bottom:8px;"><strong>Shock clorativo stimato (target ${targetShock.toFixed(1)} mg/l, 10× il combinato):</strong> aggiungere circa <strong>${grammiShock}g</strong> di Ipoclorito di Calcio${clLibCorrente == null ? ' (Cl. Lib di partenza non disponibile in questa riga, stimato da 1,0 mg/l)' : ''}.</p>
            <p style="margin-bottom:8px;"><strong>pH- extra stimato per l'alcalinità dell'ipoclorito:</strong> circa <strong>${grammiPhStimati}g</strong>.</p>
            <p style="font-size:0.75rem; color:#991b1b;">⚠️ Lo shock è una dose molto più grande di quelle su cui è stato validato il modello (max osservato ~500g) — trattalo come stima di partenza, non come numero preciso. Il pH- extra è una regola di settore generica, non ancora verificata sui tuoi dati: osserva il risultato reale dopo il prossimo shock, così la calibriamo insieme.</p>
            <p>Verificare anche il ricambio d'acqua e valutare, in alternativa, l'aggiunta di un ossidante non clorato.</p>`;
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
            if (valore > 60) {
                let fLimite = (valore - 60) / valore;
                let fIdeale = (valore - 35) / valore;
                let lLimite = Math.round(fLimite * VOL_PISCINA * 1000);
                let lIdeale = Math.round(fIdeale * VOL_PISCINA * 1000);

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Acido Cianurico Elevato (${valore} ppm)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>1. Scarico minimo di rientro (Sotto allarme 60 ppm):</strong> rinnovare <strong>${lLimite > 0 ? lLimite.toLocaleString() : 0} Litri</strong> d'acqua.</p>
                <p><strong>2. Scarico ottimale di stabilizzazione (Valore perfetto 35 ppm):</strong> rinnovare <strong>${lIdeale.toLocaleString()} Litri</strong> d'acqua.</p>`;
            } else {
                corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Acido Cianurico Basso (${valore} ppm)</span></h3><br>
                <p>Scudo UV ridotto: il cloro si degrada più in fretta al sole. Valutare una pastiglia di tricloro per rialzarlo (vedi calcolatore nel Registro Consumi).</p>`;
            }
        }
        else if (p === 'alka') {
            if (valore < 80) {
                let dLimite = 60 - valore;
                let dIdeale = 90 - valore;
                let gLimite = Math.round(dLimite * 1.7 * VOL_PISCINA);
                let gIdeale = Math.round(dIdeale * 1.7 * VOL_PISCINA);

                corpoHTML += `<h3>Stato: <span style="color:#991b1b;">Alcalinità Bassa (${valore} ppm)</span></h3><br>
                <p style="margin-bottom:8px;"><strong>1. Dose minima di rientro (Limite 60 ppm):</strong> aggiungere <strong>${gLimite > 0 ? gLimite : 0}g</strong> di Bicarbonato di Sodio.</p>
                <p><strong>2. Dose ottimale di stabilizzazione (Ideale 80-100 ppm, centro 90):</strong> aggiungere <strong>${gIdeale}g</strong> di Bicarbonato di Sodio.</p>`;
            } else if (valore > 100) {
                let notaCritica = valore > 150
                    ? `<p style="font-size:0.8rem; color:#991b1b;">⚠️ Sopra 150 ppm il pH- diventa quasi inefficace (confermato dai tuoi dati reali: dosi da 2000g con Alka a 155-157 hanno spostato il pH di soli -0,02). Valuta un ricambio parziale d'acqua prima di continuare a dosare pH-.</p>`
                    : "";
                corpoHTML += `<h3>Stato: <span style="color:#854d0e;">Alcalinità Alta (${valore} ppm)</span></h3><br>
                <p>Effetto tampone rigido. Frazionare piccole dosi di riduttore acido.</p>
                ${notaCritica}`;
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
        let esistente = Chart.getChart(ctx.canvas);
        if (esistente) esistente.destroy();

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
                { yMin: 0, yMax: 50, color: 'rgba(34, 197, 94, 0.09)' },
                { yMin: 50, yMax: 75, color: 'rgba(245, 158, 11, 0.08)' },
                { yMin: 75, yMax: 150, color: 'rgba(239, 68, 68, 0.08)' }
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
                { yMin: 80, yMax: 100, color: 'rgba(34, 197, 94, 0.09)' },
                { yMin: 100, yMax: 150, color: 'rgba(245, 158, 11, 0.08)' },
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
        const canvas = document.getElementById("overlayCanvas");
        const esistente = canvas ? Chart.getChart(canvas) : null;
        if (esistente) esistente.destroy();
    };
})();