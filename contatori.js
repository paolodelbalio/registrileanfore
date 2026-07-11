document.addEventListener("DOMContentLoaded", function () {
    // Legge il file CSV specifico dei contatori
    fetch("REGISTRO CONTATORI.csv")
        .then(response => response.text())
        .then(csvText => {
            // Analizza il CSV riga per riga tramite PapaParse
            Papa.parse(csvText, {
                header: false, // Disattivato per gestire manualmente il salto della prima riga
                skipEmptyLines: true,
                complete: function (results) {
                    const data = results.data;
                    
                    // Se il file ha meno di 2 righe (titolo iniziale + colonne reali), si ferma
                    if (data.length < 2) return; 

                    // Riga 0: "Registro Lettura Contatori,,,,,," -> La saltiamo di proposito
                    // Riga 1: I titoli delle colonne reali ("Data", "Contatore Reintegro (L)", ecc.)
                    const intestazioniReali = data[1]; 
                    
                    // Dalla riga 2 in poi ci sono i dati storici delle letture
                    const righeDati = data.slice(2); 

                    const tabella = document.getElementById("contatoriTable");
                    if (!tabella) return;

                    // 1. Genera l'intestazione HTML (<thead>)
                    let tabellaHtml = "<thead><tr>";
                    intestazioniReali.forEach(titolo => {
                        tabellaHtml += `<th>${titolo || ""}</th>`;
                    });
                    tabellaHtml += "</tr></thead>";

                    // 2. Genera il corpo HTML (<tbody>) con le letture giornaliere
                    tabellaHtml += "<tbody>";
                    righeDati.forEach(riga => {
                        // Salta le righe totalmente vuote per sicurezza
                        if (riga.length === 0 || !riga[0]) return;

                        tabellaHtml += "<tr>";
                        riga.forEach(cella => {
                            tabellaHtml += `<td>${cella || ""}</td>`;
                        });
                        tabellaHtml += "</tr>";
                    });
                    tabellaHtml += "</tbody>";

                    // Inserisce l'intera struttura dentro la tabella dei contatori
                    tabella.innerHTML = tabellaHtml;
                }
            });
        })
        .catch(error => console.error("Errore nel caricamento del file dei contatori:", error));
});