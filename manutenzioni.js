// Dashboard Piscina 2026 - Registro Chimico Integrato
(function() {
    const FILE_CHIMICO = "REGISTRO_CHIMICO.csv"; // Assicurati che il nome coincida col tuo file

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroChimico();
    });

    function caricaRegistroChimico() {
        if (typeof Papa === 'undefined') return;
        Papa.parse(FILE_CHIMICO, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(risultati) {
                visualizzaTabellaChimica(risultati.data);
            }
        });
    }

    function visualizzaTabellaChimica(dati) {
        const tabella = document.getElementById("chimicoTable");
        if (!tabella) return;

        let html = `<thead>
            <tr>
                <th>Data</th>
                <th>Ora</th>
                <th>pH <button class="btn-mini-grafico" onclick="mostraGrafico('pH')">📈</button></th>
                <th>Cl. Lib <button class="btn-mini-grafico" onclick="mostraGrafico('ClLib')">📈</button></th>
                <th>Cl. Tot</th>
                <th>Cl. Com</th>
                <th>Temp</th>
                <th>N.Ospiti</th>
                <th>Cya</th>
                <th>Alka</th>
                <th>Note</th>
            </tr>
        </thead><tbody>`;

        dati.forEach(riga => {
            if (!riga.Data && !riga.Ora) return;

            let phVal = riga.pH ? riga.pH.replace(',', '.') : "";
            let clVal = riga["Cl. Lib"] ? riga["Cl. Lib"].replace(',', '.') : "";

            let classePh = applicaFiltroColore(parseFloat(phVal), 7.2, 7.4, 7.3);
            let classeCl = applicaFiltroColore(parseFloat(clVal), 1.0, 1.2, 1.1);

            html += `<tr>
                <td>${riga.Data || ''}</td>
                <td>${riga.Ora || ''}</td>
                <td class="${classePh}">${riga.pH || ''}</td>
                <td class="${classeCl}">${riga["Cl. Lib"] || ''}</td>
                <td>${riga["Cl. Tot"] || ''}</td>
                <td>${riga["Cl. Com"] || ''}</td>
                <td>${riga.Temp || ''}</td>
                <td>${riga["N.Ospiti"] || ''}</td>
                <td>${riga.Cya || ''}</td>
                <td>${riga.Alka || ''}</td>
                <td>${riga.Note || ''}</td>
            </tr>`;
        });

        html += "</tbody>";
        tabella.innerHTML = html;
        
        // Esegue l'analisi per generare eventuali consigli o popup dosaggi
        generaConsigliDosaggio(dati);
    }

    function applicaFiltroColore(valore, min, max, perfetto) {
        if (isNaN(valore) || valore === 0) return "";
        if (valore === perfetto) return "evidenzia-verde";
        if (valore >= min && valore <= max) return "evidenzia-giallo";
        return "evidenzia-rosso";
    }

    function generaConsigliDosaggio(dati) {
        // Logica interna per l'elaborazione dei parametri ideali e dei messaggi di allarme
        if(!dati || dati.length === 0) return;
        const ultimaRiga = dati[dati.length - 1];
        
        let cyaVal = ultimaRiga.Cya ? parseFloat(ultimaRiga.Cya.replace(',', '.')) : 0;
        if (cyaVal >= 60) {
            console.log("Allarme CYA: Soglia limite superata!"); // Notifica di sicurezza a 60ppm
        }
    }
})();

// Funzione globale per l'apertura dei grafici associati ai pulsanti mini
function mostraGrafico(parametro) {
    alert("Apertura andamento storico per: " + parametro);
    // Qui si aggancia la logica di Chart.js configurata ieri
}