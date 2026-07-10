// Gestore Isolato per il Registro Manutenzioni
(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(caricaRegistroManutenzioniIsolato, 1200);
    });

    function caricaRegistroManutenzioniIsolato() {
        if (typeof Papa === 'undefined') return;
        Papa.parse(FILE_MANUTENZIONI, {
            download: true,
            header: false,
            skipEmptyLines: false,
            complete: function(risultati) {
                elaboraManutenzioniProtetto(risultati.data);
            }
        });
    }

    function elaboraManutenzioniProtetto(righe) {
        const tabella = document.getElementById("manutenzioniTable");
        if (!tabella || !righe || righe.length === 0) return;

        let html = "<thead><tr>";
        if (righe[0]) {
            righe[0].forEach(col => {
                html += `<th>${col.replace(/"/g, "").trim()}</th>`;
            });
            html += "</tr></thead><tbody>";
        }

        for (let i = 1; i < righe.length; i++) {
            let riga = righe[i];
            if (!riga || riga.length === 0 || (riga.length === 1 && riga[0] === "")) continue;

            html += "<tr>";
            riga.forEach(cella => {
                html += `<td>${cella.replace(/"/g, "").trim()}</td>`;
            });
            html += "</tr>";
        }
        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();