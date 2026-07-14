// ============================================================
// Gestore Isolato Separato per il Registro Consumi
// (consumo giornaliero prodotti chimici: pH-, Cloro, Antialghe,
//  Decloratore, Flocculante - quantità in grammi/ml)
// ============================================================
(function () {
    const FILE_CONSUMI = "REGISTRO CONSUMI.csv";

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
        caricaRegistroConsumi();
    });

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

        disegnaTabellaConsumi(intestazioni, righeDati);
    }

    function disegnaTabellaConsumi(intestazioni, righeDati) {
        const tabella = document.getElementById("consumiTable");
        if (!tabella) return;

        let html = "<thead><tr>";
        intestazioni.forEach(titolo => {
            html += `<th>${titolo || ""}</th>`;
        });
        html += "</tr></thead><tbody>";

        righeDati.forEach(riga => {
            if (riga.length === 0 || !riga[0]) return;

            html += "<tr>";
            intestazioni.forEach((intestazione, indice) => {
                let valore = riga[indice] ? riga[indice].trim() : "";
                let n = intestazione.trim().toLowerCase();

                if (n === "data") valore = formatDataItaliana(valore);

                // Colonne quantità (tutte tranne Data e Note): evidenzia solo se valorizzate
                const eColonnaQuantita = (n !== "data" && n !== "note");
                let classe = "";
                if (eColonnaQuantita && valore !== "") {
                    classe = ' class="consumo-valorizzato"';
                }

                html += `<td${classe}>${valore !== "" ? valore : "-"}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();