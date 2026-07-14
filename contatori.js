// ============================================================
// Gestore Isolato Separato per il Registro Contatori
// ============================================================
(function () {
    const FILE_CONTATORI = "REGISTRO CONTATORI.csv";

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

                        disegnaTabellaContatori(intestazioniReali, righeDati);
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
            riga.forEach(cella => {
                html += `<td>${cella || ""}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }
})();