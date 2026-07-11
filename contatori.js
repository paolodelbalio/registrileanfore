document.addEventListener("DOMContentLoaded", function () {
    // Legge il file CSV specifico dei contatori
    fetch("REGISTRO CONTATORI.csv")
        .then(response => response.text())
        .then(csvText => {
            // Analizza il CSV riga per riga
            Papa.parse(csvText, {
                header: false, // false perché saltiamo la primissima riga di titolo a mano
                skipEmptyLines: true,
                complete: function (results) {
                    const data = results.data;
                    
                    // Se il file è vuoto o ha meno di 2 righe (titolo + intestazioni), si ferma
                    if (data.length < 2) return; 

                    // Riga 0: "Registro Lettura Contatori,,,,,," (la ignoriamo)
                    // Riga 1: I titoli veri ("Data", "Contatore Reintegro (L)", etc.)
                    const intestazioni Reali = data[1]; 
                    
                    // Dalla riga 2 in poi ci sono i dati dei giorni
                    const righeDati = data.slice(2); 

                    const tabella = document.getElementById("contatoriTable");
                    if (!tabella) return;

                    // Genera la testata della tabella (<th>)
                    let tabellaHtml = "<thead><tr>";
                    intestazioniReali.forEach(titolo => {
                        tabellaHtml += `<th>${titolo || ""}</th>`;
                    });
                    tabellaHtml += "</tr></thead>";

                    // Genera il corpo della tabella (<td>)
                    tabellaHtml += "<tbody>";
                    righeDati.forEach(riga => {
                        // Salta le righe totalmente vuote
                        if (riga.length === 0 || !riga[0]) return;

                        tabellaHtml += "<tr>";
                        riga.forEach(cella => {
                            tabellaHtml += `<td>${cella || ""}</td>`;
                        });
                        tabellaHtml += "</tr>";
                    });
                    tabellaHtml += "</tbody>";

                    // Inserisce i dati nella tabella HTML dei contatori
                    tabella.innerHTML = tabellaHtml;
                }
            });
        })
        .catch(error => console.error("Errore nel caricamento del file dei contatori:", error));
});