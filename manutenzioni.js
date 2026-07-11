(function() {
    const FILE_MANUTENZIONI = "REGISTRO MANUTENZIONE INTERVENTI .csv";

    document.addEventListener("DOMContentLoaded", () => {
        if (typeof Papa === 'undefined') {
            console.error("PapaParse non è caricato!");
            return;
        }
        
        Papa.parse(FILE_MANUTENZIONI, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function(risultati) {
                if (risultati && risultati.data) {
                    // PRENDIAMO LE ULTIME 3 RIGHE PER VEDERE COME SONO STRUTTURATE
                    let ultimeRighe = risultati.data.slice(-3);
                    alert("DEBUG DATI CSV:\n\n" + JSON.stringify(ultimeRighe, null, 2));
                } else {
                    alert("Il file CSV è vuoto o non viene letto.");
                }
            }
        });
    });
})();