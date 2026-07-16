// ============================================================
// Gestore Isolato Separato per il Registro Consumi
// (consumo giornaliero prodotti chimici: pH-, Cloro, Antialghe,
//  Decloratore, Flocculante - quantità in grammi/ml)
//
// NOVITÀ: incrocio con il Registro Chimico per verificare se un
// dosaggio ha prodotto l'effetto atteso sulla lettura successiva
// (colonna "Verifica" + dettaglio al click, riusa il modale del
// registro chimico #dosageModal per coerenza visiva).
// ============================================================
(function () {
    const FILE_CONSUMI = "REGISTRO CONSUMI.csv";

    const GIORNI_IT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

    // Prodotti per cui esiste un parametro numerico corrispondente nel registro
    // chimico e quindi è possibile verificare automaticamente l'effetto del dosaggio.
    // Antialghe e Flocculante agiscono su torbidità/alghe, non misurati numericamente
    // nel registro chimico: per questi non viene calcolata nessuna verifica.
    // Il Tricloro ha una logica di verifica dedicata (calcolaVerificaTricloro), diversa
    // da queste perché l'effetto atteso è sul CYA, non su pH/Cl. Lib, e si manifesta
    // su più giorni invece che nello stesso giorno.
    const PRODOTTI_VERIFICABILI = {
        "ph-": { parametro: "ph", label: "pH", direzioneAttesa: -1 },
        "cloro": { parametro: "cl", label: "Cl. Lib", direzioneAttesa: +1 },
        "decloratore": { parametro: "cl", label: "Cl. Lib", direzioneAttesa: -1 }
    };

    let mappaChimicoPerData = null; // "AAAA-MM-GG" -> { mattina:{ph,cl}, sera:{ph,cl} }
    let elencoCyaOrdinato = [];     // [{chiave:"AAAA-MM-GG", valore:Number}, ...] ordinato per data, una voce per giorno con CYA misurato
    let righeConsumiGrezze = null;
    let intestazioniConsumi = null;

    // Il tricloro (pastiglie) impiega 3-4 giorni a sciogliersi completamente: prima di
    // quel momento non ha senso cercare l'effetto sul CYA nelle letture del registro chimico.
    const GIORNI_DISSOLUZIONE_TRICLORO = 4;

    // Formula CYA da Tricloro (TCCA 90/200): stechiometricamente il 55,5% della massa di
    // TCCA diventa CYA residuo. Volume vasca Le Anfore: 92 m³ = 92.000 litri.
    const FRAZIONE_CYA_DA_TCCA = 0.555;
    const VOLUME_VASCA_LITRI = 92000;
    const PESO_PASTIGLIA_TRICLORO_G = 200; // pastiglie BIG-BLU TCCA 90/200, 200g cad.

    function formatDataItaliana(testo) {
        if (!testo) return testo;
        let t = testo.trim();
        if (t === "") return t;
        if (/[a-zA-Z]/.test(t)) return t;

        let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!m) return t;

        let giorno = parseInt(m[1], 10);
        let mese = parseInt(m[2], 10) - 1;
        let anno = parseInt(m[3], 10);
        if (anno < 100) anno += 2000;

        let d = new Date(anno, mese, giorno);
        if (isNaN(d.getTime())) return t;

        return `${GIORNI_IT[d.getDay()]} ${giorno} ${MESI_IT[mese]} ${anno}`;
    }

    // Interpreta date già formattate in italiano tipo "sab 16 mag 26" o "sab 16 mag 2026"
    // (formato usato sia da Consumi che dalla prima riga di ogni giorno in Chimico).
    function parseDataAbbreviata(testo) {
        if (!testo) return null;
        let parti = testo.trim().split(/\s+/);
        if (parti.length < 3) return null;

        let giorno, meseAbbr, annoStr;
        if (parti.length >= 4) {
            giorno = parseInt(parti[1], 10);
            meseAbbr = parti[2].toLowerCase();
            annoStr = parti[3];
        } else {
            giorno = parseInt(parti[0], 10);
            meseAbbr = parti[1].toLowerCase();
            annoStr = parti[2];
        }

        let meseIdx = MESI_IT.indexOf(meseAbbr);
        if (meseIdx === -1 || isNaN(giorno)) return null;

        let anno = parseInt(annoStr, 10);
        if (isNaN(anno)) return null;
        if (anno < 100) anno += 2000;

        return { anno, meseIdx, giorno };
    }

    function chiaveData(dataObj) {
        if (!dataObj) return null;
        return `${dataObj.anno}-${String(dataObj.meseIdx + 1).padStart(2, "0")}-${String(dataObj.giorno).padStart(2, "0")}`;
    }

    function chiaveGiornoPrecedente(chiave) {
        let [y, m, d] = chiave.split("-").map(Number);
        let dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() - 1);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }

    function chiaveGiornoSuccessivo(chiave) {
        let [y, m, d] = chiave.split("-").map(Number);
        let dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + 1);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }

    // Costruisce, a partire dai dati già letti da chimico.js, una mappa data -> letture
    // mattina (07:00) e sera (21:00). Nel registro chimico la Data è compilata solo sulla
    // prima riga di ogni giorno: qui viene "propagata" sulla riga delle 21:00 dello stesso giorno.
    // Costruisce in parallelo l'elenco ordinato delle letture di CYA (sparse, non giornaliere),
    // usato dalla verifica del tricloro per trovare la prima lettura utile dopo il dosaggio.
    function costruisciMappaChimico(datiChimico) {
        let mappa = {};
        let cyaPerGiorno = {};
        let chiaveCorrente = null;

        datiChimico.forEach(riga => {
            let dObj = parseDataAbbreviata(riga["Data"]);
            if (dObj) chiaveCorrente = chiaveData(dObj);
            if (!chiaveCorrente) return;

            let cya = parseFloat((riga["Cya"] || "").replace(",", "."));
            if (!isNaN(cya)) cyaPerGiorno[chiaveCorrente] = cya;

            let ora = (riga["Ora"] || "").trim();
            let fase = ora.startsWith("07") ? "mattina" : (ora.startsWith("21") ? "sera" : null);
            if (!fase) return;

            let ph = parseFloat((riga["pH"] || "").replace(",", "."));
            let cl = parseFloat((riga["Cl. Lib"] || "").replace(",", "."));

            if (!mappa[chiaveCorrente]) mappa[chiaveCorrente] = {};
            mappa[chiaveCorrente][fase] = {
                ph: isNaN(ph) ? null : ph,
                cl: isNaN(cl) ? null : cl
            };
        });

        elencoCyaOrdinato = Object.keys(cyaPerGiorno).sort().map(chiave => ({ chiave, valore: cyaPerGiorno[chiave] }));
        return mappa;
    }

    // Trova, per una data di dosaggio, l'ultima lettura CYA nota a quella data o prima
    // (baseline) e la prima lettura CYA successiva che disti almeno GIORNI_DISSOLUZIONE_TRICLORO
    // giorni (non semplicemente la prima in assoluto: una lettura troppo ravvicinata non avrebbe
    // ancora colto l'effetto del tricloro, e andrebbe scartata a favore di una successiva più lontana).
    function trovaCyaIntornoA(chiaveGiorno) {
        let prima = null, dopo = null, giorniDopo = null;
        let [y1, m1, d1] = chiaveGiorno.split("-").map(Number);
        let dataGiorno = new Date(y1, m1 - 1, d1);

        for (let i = 0; i < elencoCyaOrdinato.length; i++) {
            let voce = elencoCyaOrdinato[i];
            if (voce.chiave <= chiaveGiorno) {
                prima = voce;
                continue;
            }
            if (dopo) continue; // già trovata una lettura valida, non serve continuare a cercare

            let [y2, m2, d2] = voce.chiave.split("-").map(Number);
            let scarto = Math.round((new Date(y2, m2 - 1, d2) - dataGiorno) / 86400000);
            if (scarto >= GIORNI_DISSOLUZIONE_TRICLORO) {
                dopo = voce;
                giorniDopo = scarto;
            }
        }

        return { prima, dopo, giorniDopo };
    }

    // Verifica dedicata per il Tricloro: calcola il CYA atteso dalla formula stechiometrica
    // e lo confronta con la prima lettura CYA reale disponibile almeno GIORNI_DISSOLUZIONE_TRICLORO
    // giorni dopo il dosaggio. Se non è ancora passato abbastanza tempo, o non c'è ancora una
    // lettura successiva, la verifica resta "posticipata" mostrando comunque la previsione.
    function calcolaVerificaTricloro(chiaveGiorno, valoreTesto) {
        let pastiglie = parseFloat(valoreTesto.replace(",", "."));
        if (isNaN(pastiglie) || pastiglie <= 0) return null;

        let grammi = pastiglie * PESO_PASTIGLIA_TRICLORO_G;
        let cyaAtteso = (grammi * FRAZIONE_CYA_DA_TCCA * 1000) / VOLUME_VASCA_LITRI;
        let { prima, dopo, giorniDopo } = trovaCyaIntornoA(chiaveGiorno);

        if (!dopo) {
            return {
                posticipato: true,
                cyaAtteso: cyaAtteso,
                pastiglie: pastiglie,
                grammi: grammi,
                cyaUltimoNoto: prima ? prima.valore : null,
                dataUltimoNoto: prima ? prima.chiave : null
            };
        }

        if (!prima) {
            // Abbiamo una lettura dopo ma nessuna baseline prima del dosaggio: mostriamo il
            // valore osservato e l'atteso, ma senza poter calcolare un delta reale da giudicare.
            return {
                posticipato: false,
                esito: null,
                cyaAtteso: cyaAtteso,
                cyaDopo: dopo.valore,
                dataDopo: dopo.chiave,
                pastiglie: pastiglie,
                grammi: grammi
            };
        }

        let deltaOsservato = dopo.valore - prima.valore;
        let esito;
        if (deltaOsservato >= cyaAtteso * 0.5) {
            esito = "ok";
        } else if (deltaOsservato > 0) {
            esito = "parziale";
        } else {
            esito = "ko";
        }

        return {
            posticipato: false,
            esito: esito,
            delta: deltaOsservato,
            cyaAtteso: cyaAtteso,
            cyaPrima: prima.valore,
            cyaDopo: dopo.valore,
            dataDopo: dopo.chiave,
            pastiglie: pastiglie,
            grammi: grammi
        };
    }

    // Ricava la lettura "prima" (mattina dello stesso giorno, prima del dosaggio - con
    // fallback alla sera del giorno precedente se la mattina manca) e "dopo" (sera dello
    // stesso giorno, dopo il dosaggio - con fallback alla mattina del giorno successivo).
    // Il confronto è volutamente sullo stesso giorno: un confronto "sera di ieri -> mattina
    // di oggi" misurerebbe soprattutto il consumo notturno di cloro, non l'effetto del dosaggio.
    function ottieniLettureAttorno(chiaveGiorno) {
        if (!mappaChimicoPerData) return { prima: null, dopo: null };

        let giornoStesso = mappaChimicoPerData[chiaveGiorno] || {};
        let giornoPrec = mappaChimicoPerData[chiaveGiornoPrecedente(chiaveGiorno)] || {};
        let giornoSucc = mappaChimicoPerData[chiaveGiornoSuccessivo(chiaveGiorno)] || {};

        let prima = giornoStesso.mattina || giornoPrec.sera || null;
        let dopo = giornoStesso.sera || giornoSucc.mattina || null;

        return { prima, dopo };
    }

    function valutaEsito(chiaveProdotto, prima, dopo) {
        let def = PRODOTTI_VERIFICABILI[chiaveProdotto];
        if (!def || !prima || !dopo) return null;

        let vPrima = prima[def.parametro];
        let vDopo = dopo[def.parametro];
        if (vPrima == null || vDopo == null) return null;

        let delta = vDopo - vPrima;
        let deltaNellaDirezioneAttesa = (def.direzioneAttesa > 0 && delta > 0) || (def.direzioneAttesa < 0 && delta < 0);

        let inRangeIdeale = false;
        if (def.parametro === "ph") inRangeIdeale = vDopo >= 7.0 && vDopo <= 7.3;
        if (def.parametro === "cl") inRangeIdeale = vDopo >= 0.9 && vDopo <= 1.2;

        let sogliaVariazioneSignificativa = def.parametro === "ph" ? 0.05 : 0.15;

        let esito;
        if (deltaNellaDirezioneAttesa && (inRangeIdeale || Math.abs(delta) >= sogliaVariazioneSignificativa)) {
            esito = "ok";
        } else if (deltaNellaDirezioneAttesa) {
            esito = "parziale";
        } else {
            esito = "ko";
        }

        return { esito, delta, label: def.label, prima: vPrima, dopo: vDopo };
    }

    // Calcola gli esiti di verifica per tutti i prodotti dosati in una riga di Consumi.
    function calcolaVerificaRiga(intestazioni, riga) {
        let dObj = parseDataAbbreviata(riga[0]);
        if (!dObj) return [];
        let chiaveGiorno = chiaveData(dObj);

        let { prima, dopo } = ottieniLettureAttorno(chiaveGiorno);

        let risultati = [];
        intestazioni.forEach((intestazione, indice) => {
            let n = intestazione.trim().toLowerCase();
            let valoreTesto = riga[indice] ? riga[indice].trim() : "";
            if (valoreTesto === "") return;

            if (n === "tricloro") {
                let esitoTricloro = calcolaVerificaTricloro(chiaveGiorno, valoreTesto);
                if (esitoTricloro) {
                    risultati.push({
                        prodotto: intestazione.trim(),
                        quantita: valoreTesto,
                        tipo: "tricloro",
                        posticipato: esitoTricloro.posticipato,
                        esito: esitoTricloro.posticipato ? null : (esitoTricloro.esito ? {
                            esito: esitoTricloro.esito,
                            delta: esitoTricloro.delta,
                            label: "CYA",
                            prima: esitoTricloro.cyaPrima,
                            dopo: esitoTricloro.cyaDopo
                        } : null),
                        tricloroInfo: esitoTricloro
                    });
                }
                return;
            }

            if (!(n in PRODOTTI_VERIFICABILI)) return;

            let esito = valutaEsito(n, prima, dopo);
            risultati.push({
                prodotto: intestazione.trim(),
                quantita: valoreTesto,
                esito: esito
            });
        });

        return risultati;
    }

    function iconaEClasseEsitoComplessivo(risultati) {
        if (risultati.length === 0) return { icona: null, classe: "" };

        let hasKo = risultati.some(r => r.esito && r.esito.esito === "ko");
        let hasParziale = risultati.some(r => r.esito && r.esito.esito === "parziale");
        let hasOk = risultati.some(r => r.esito && r.esito.esito === "ok");
        let hasPosticipato = risultati.some(r => r.posticipato);
        let hasDatiMancanti = risultati.some(r => !r.esito && !r.posticipato);

        if (hasKo) return { icona: "❌", classe: "evidenzia-rosso" };
        if (hasParziale) return { icona: "⚠️", classe: "evidenzia-giallo" };
        if (hasOk) return { icona: "✅", classe: "evidenzia-verde" };
        if (hasPosticipato) return { icona: "⏳", classe: "testo-muto" };
        if (hasDatiMancanti) return { icona: "–", classe: "testo-muto" };
        return { icona: null, classe: "" };
    }

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroConsumi();

        // Se chimico.js ha già finito di caricare (ordine di script + tempi di rete non
        // sono garantiti), i dati sono già disponibili in window.__registroChimicoDati.
        if (window.__registroChimicoDati) {
            mappaChimicoPerData = costruisciMappaChimico(window.__registroChimicoDati);
            ridisegnaSeDatiPronti();
        }

        // In ogni caso resta in ascolto dell'evento, per il caso in cui consumi.js finisca
        // di caricare il proprio CSV prima che chimico.js abbia completato il suo.
        document.addEventListener("chimico:datiPronti", (e) => {
            mappaChimicoPerData = costruisciMappaChimico(e.detail);
            ridisegnaSeDatiPronti();
        });
    });

    function ridisegnaSeDatiPronti() {
        if (righeConsumiGrezze && intestazioniConsumi) {
            disegnaTabellaConsumi(intestazioniConsumi, righeConsumiGrezze);
        }
    }

    function caricaRegistroConsumi() {
        if (typeof Papa === "undefined") return;

        Papa.parse(FILE_CONSUMI, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function (risultati) {
                elaboraDatiConsumi(risultati.data);
            }
        });
    }

    function elaboraDatiConsumi(righeGrezze) {
        if (!righeGrezze || righeGrezze.length < 2) return;

        // Riga 0: intestazioni reali (Data, pH-, Cloro, Antialghe, Decloratore, Flocculante, Note)
        const intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
        const righeDati = righeGrezze.slice(1);

        intestazioniConsumi = intestazioni;
        righeConsumiGrezze = righeDati;

        disegnaTabellaConsumi(intestazioni, righeDati);
    }

    function disegnaTabellaConsumi(intestazioni, righeDati) {
        const tabella = document.getElementById("consumiTable");
        if (!tabella) return;

        let html = "<thead><tr>";
        intestazioni.forEach(titolo => {
            let classeColonna = "col-" + (titolo || "").trim().toLowerCase().replace(/\s+/g, "-");
            html += `<th class="${classeColonna}">${titolo || ""}</th>`;
        });
        html += `<th>Verifica</th>`;
        html += "</tr></thead><tbody>";

        righeDati.forEach(riga => {
            if (riga.length === 0 || !riga[0]) return;

            let risultatiVerifica = mappaChimicoPerData ? calcolaVerificaRiga(intestazioni, riga) : [];
            let { icona, classe } = iconaEClasseEsitoComplessivo(risultatiVerifica);

            html += "<tr>";
            intestazioni.forEach((intestazione, indice) => {
                let valore = riga[indice] ? riga[indice].trim() : "";
                let n = intestazione.trim().toLowerCase();

                if (n === "data") valore = formatDataItaliana(valore);

                // Colonne quantità (tutte tranne Data e Note): evidenzia solo se valorizzate
                const eColonnaQuantita = (n !== "data" && n !== "note");
                let classeColonna = "col-" + n.replace(/\s+/g, "-");
                let classi = [classeColonna];
                if (eColonnaQuantita && valore !== "") classi.push("consumo-valorizzato");

                html += `<td class="${classi.join(" ")}" title="${valore.replace(/"/g, '&quot;')}">${valore !== "" ? valore : "-"}</td>`;
            });

            if (icona) {
                let cliccabile = risultatiVerifica.some(r => r.esito !== null || r.posticipato || r.tipo === "tricloro");
                if (cliccabile) {
                    let rigaEscaped = btoa(unescape(encodeURIComponent(JSON.stringify({
                        data: formatDataItaliana(riga[0] ? riga[0].trim() : ""),
                        risultati: risultatiVerifica
                    }))));
                    html += `<td class="${classe}" style="cursor:pointer; text-align:center;" onclick="window.apriVerificaEfficacia('${rigaEscaped}')" title="Clicca per il dettaglio">${icona}</td>`;
                } else {
                    html += `<td class="${classe}" style="text-align:center;" title="Dati insufficienti nel registro chimico per verificare l'effetto">${icona}</td>`;
                }
            } else {
                html += `<td class="testo-muto" style="text-align:center;">-</td>`;
            }

            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }

    window.apriVerificaEfficacia = function (datiCodificati) {
        let dati;
        try {
            dati = JSON.parse(decodeURIComponent(escape(atob(datiCodificati))));
        } catch (e) {
            console.error("[Consumi] Errore nella decodifica dei dati di verifica", e);
            return;
        }

        const modal = document.getElementById("dosageModal");
        const contenitore = document.getElementById("dosageContent");
        if (!modal || !contenitore) return;

        modal.classList.remove("modal-critica");

        let corpoHTML = `<p style='font-size:0.85rem; color:#64748b; margin-bottom: 12px;'>Dosaggio del ${dati.data} — pH-/Cloro/Decloratore: confronto mattina/sera dello stesso giorno. Tricloro: confronto con la prima lettura CYA disponibile almeno ${GIORNI_DISSOLUZIONE_TRICLORO} giorni dopo.</p>`;

        dati.risultati.forEach(r => {
            if (r.tipo === "tricloro") {
                let info = r.tricloroInfo;
                let attesoTesto = info.cyaAtteso.toFixed(2).replace(".", ",");
                let etichettaQuantita = `${info.pastiglie} ${info.pastiglie === 1 ? "pastiglia" : "pastiglie"} (${info.grammi}g)`;

                if (info.posticipato) {
                    let ultimoNotoTesto = info.cyaUltimoNoto != null
                        ? `Ultimo CYA noto: <strong>${info.cyaUltimoNoto} ppm</strong> (${info.dataUltimoNoto}).`
                        : `Nessuna lettura CYA registrata prima di questa data.`;
                    corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                        <strong>${r.prodotto}</strong> — ${etichettaQuantita}
                        <br><span style="color:#0369a1; font-weight:bold;">⏳ Verifica posticipata</span>
                        <br><span style="font-size:0.85rem; color:#475569;">Il tricloro impiega 3-4 giorni a sciogliersi. ${ultimoNotoTesto} CYA atteso in aumento di circa +${attesoTesto} ppm (formula stechiometrica), quindi a circa ${info.cyaUltimoNoto != null ? (info.cyaUltimoNoto + parseFloat(attesoTesto.replace(",", "."))).toFixed(1).replace(".", ",") : '?'} ppm. Ricontrolla dopo la prossima lettura di CYA, almeno ${GIORNI_DISSOLUZIONE_TRICLORO} giorni dopo il dosaggio.</span>
                    </div>`;
                    return;
                }

                if (!r.esito) {
                    corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                        <strong>${r.prodotto}</strong> — ${etichettaQuantita}
                        <br><span style="color:#94a3b8;">CYA atteso in aumento di circa +${attesoTesto} ppm. Prima lettura CYA disponibile dopo il dosaggio: ${info.cyaDopo} ppm (${info.dataDopo}) — manca però una lettura CYA precedente al dosaggio per calcolare l'aumento reale.</span>
                    </div>`;
                    return;
                }

                let coloreEsito = r.esito.esito === "ok" ? "#166534" : (r.esito.esito === "parziale" ? "#854d0e" : "#991b1b");
                let testoEsito = r.esito.esito === "ok" ? "Aumento CYA coerente con l'atteso" : (r.esito.esito === "parziale" ? "Aumento CYA inferiore all'atteso" : "CYA non aumentato come previsto");
                let deltaTesto = info.delta.toFixed(2).replace(".", ",");

                corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                    <strong>${r.prodotto}</strong> — ${etichettaQuantita}
                    <br><span style="color:${coloreEsito}; font-weight:bold;">${testoEsito}</span>
                    <br><span style="font-size:0.85rem; color:#475569;">CYA: ${info.cyaPrima} → ${info.cyaDopo} ppm (Δ${info.delta>=0?'+':''}${deltaTesto}, atteso +${attesoTesto}) — lettura del ${info.dataDopo}</span>
                </div>`;
                return;
            }

            if (r.posticipato) {
                corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                    <strong>${r.prodotto}</strong> — ${r.quantita}<br>
                    <span style="color:#0369a1; font-weight:bold;">⏳ Verifica posticipata</span><br>
                    <span style="font-size:0.85rem; color:#475569;">Rilevato tricloro nelle note del registro chimico: si scioglie in 3-4 giorni, quindi l'effetto non è ancora misurabile confrontando mattina e sera dello stesso giorno. Ricontrolla il CYA e il cloro tra 4-5 giorni.</span>
                </div>`;
                return;
            }

            if (!r.esito) {
                corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                    <strong>${r.prodotto}</strong> — ${r.quantita}<br>
                    <span style="color:#94a3b8;">Dati insufficienti nel registro chimico per verificare l'effetto in questa data.</span>
                </div>`;
                return;
            }

            let coloreEsito = r.esito.esito === "ok" ? "#166534" : (r.esito.esito === "parziale" ? "#854d0e" : "#991b1b");
            let testoEsito = r.esito.esito === "ok" ? "Dose efficace" : (r.esito.esito === "parziale" ? "Variazione insufficiente" : "Nessun effetto / direzione inattesa");
            let prima = String(r.esito.prima).replace(".", ",");
            let dopo = String(r.esito.dopo).replace(".", ",");

            corpoHTML += `<div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                <strong>${r.prodotto}</strong> — ${r.quantita}<br>
                <span style="color:${coloreEsito}; font-weight:bold;">${testoEsito}</span><br>
                <span style="font-size:0.85rem; color:#475569;">${r.esito.label}: ${prima} → ${dopo}</span>
            </div>`;
        });

        contenitore.innerHTML = `<h2>Verifica Efficacia Dosaggio</h2><br>${corpoHTML}`;
        modal.classList.remove("hidden");
    };
})();