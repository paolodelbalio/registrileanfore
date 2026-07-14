// ============================================================
// Gestore Isolato Separato per il Registro Pulizie
// ============================================================
(function () {
    const FILE_PULIZIE = "REGISTRO PULIZIE PISCINA 2026.csv";

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
            html += "<tr>";
            intestazioni.forEach((_, indice) => {
                let valore = riga[indice] ? riga[indice].trim() : "";
                html += `<td>${valore}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();