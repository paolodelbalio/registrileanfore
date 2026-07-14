// ============================================================
// Gestore Isolato Separato per il Registro Pulizie
// ============================================================
(function () {
    const FILE_PULIZIE = "REGISTRO PULIZIE PISCINA 2026.csv";

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
        caricaRegistroPulizie();
    });

    function caricaRegistroPulizie() {
        if (typeof Papa === "undefined") return;

        Papa.parse(FILE_PULIZIE, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function (risultati) {
                elaboraDatiPulizie(risultati.data);
            }
        });
    }

    function elaboraDatiPulizie(righeGrezze) {
        if (!righeGrezze || righeGrezze.length < 2) return;

        // Riga 0: intestazioni reali (Data, Ora, Area Pulita, Intervento, Prodotto Usato, Incaricato, Firma)
        const intestazioni = righeGrezze[0].map(h => h ? h.trim() : "");
        const righeDati = righeGrezze.slice(1);

        disegnaTabellaPulizie(intestazioni, righeDati);
    }

    function disegnaTabellaPulizie(intestazioni, righeDati) {
        const tabella = document.getElementById("pulizieTable");
        if (!tabella) return;

        let html = "<thead><tr>";
        intestazioni.forEach(titolo => {
            html += `<th>${titolo || ""}</th>`;
        });
        html += "</tr></thead><tbody>";

        righeDati.forEach(riga => {
            if (riga.length === 0 || (!riga[0] && !riga[1])) return;

            // Protezione difensiva: se una riga di legenda fosse ancora presente
            // nel CSV (non ancora ripulita alla fonte), la saltiamo qui senza
            // interrompere la lettura delle righe successive.
            let testoRiga = riga.join(" ").toUpperCase();
            if (testoRiga.includes("LEGENDA")) return;

            html += "<tr>";
            intestazioni.forEach((intestazione, indice) => {
                let valore = riga[indice] ? riga[indice].trim() : "";
                if (intestazione.trim().toLowerCase() === "data") valore = formatDataItaliana(valore);
                html += `<td>${valore}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();