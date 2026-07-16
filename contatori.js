// ============================================================
// Gestore Isolato Separato per il Registro Contatori
// ============================================================
(function () {
    const FILE_CONTATORI = "REGISTRO CONTATORI.csv";

    const GIORNI_IT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

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

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroContatori();
    });

    function caricaRegistroContatori() {
        fetch(FILE_CONTATORI)
            .then(response => response.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: false, // gestiamo a mano il salto della riga di titolo
                    skipEmptyLines: true,
                    complete: function (risultati) {
                        const data = risultati.data;
                        if (data.length < 2) return;

                        // Riga 0: "Registro Lettura Contatori,,,,,," -> titolo, la saltiamo
                        // Riga 1: intestazioni reali delle colonne
                        const intestazioniReali = data[1];
                        const righeDati = data.slice(2);

                        console.log("[Contatori] CSV caricato:", righeDati.length, "righe");

                        disegnaTabellaContatori(intestazioniReali, righeDati);

                        // Espone i dati letti ad altri script (es. consumi.js) per incroci tra registri
                        let datiOggetti = righeDati
                            .filter(riga => riga.length > 0 && riga[0])
                            .map(riga => {
                                let oggetto = {};
                                intestazioniReali.forEach((intestazione, indice) => {
                                    oggetto[(intestazione || "").trim()] = riga[indice] ? riga[indice].toString().trim() : "";
                                });
                                return oggetto;
                            });
                        window.__registroContatoriDati = datiOggetti;
                        document.dispatchEvent(new CustomEvent("contatori:datiPronti", { detail: datiOggetti }));
                    }
                });
            })
            .catch(error => console.error("Errore nel caricamento del file dei contatori:", error));
    }

    function disegnaTabellaContatori(intestazioni, righeDati) {
        const tabella = document.getElementById("contatoriTable");
        if (!tabella) return;

        let html = "<thead><tr>";
        intestazioni.forEach(titolo => {
            html += `<th>${titolo || ""}</th>`;
        });
        html += "</tr></thead><tbody>";

        righeDati.forEach(riga => {
            if (riga.length === 0 || !riga[0]) return;
            html += "<tr>";
            riga.forEach((cella, indice) => {
                let valore = cella || "";
                let intestazione = (intestazioni[indice] || "").trim().toLowerCase();
                if (intestazione === "data") valore = formatDataItaliana(valore);
                html += `<td title="${valore.toString().replace(/"/g, '&quot;')}">${valore}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();