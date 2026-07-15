// ============================================================
// Gestore Isolato Separato per il Registro Pulizie
// ============================================================
(function () {
    const FILE_PULIZIE = "REGISTRO PULIZIE PISCINA 2026.csv";

    document.addEventListener("DOMContentLoaded", () => {
        caricaRegistroPulizie();
    });

    function caricaRegistroPulizie() {
        if (typeof Papa === 'undefined') {
            console.error("[Pulizie] PapaParse non è disponibile: controlla che papaparse.min.js sia caricato prima di pulizie.js");
            return;
        }

        Papa.parse(FILE_PULIZIE, {
            download: true,
            header: false,
            skipEmptyLines: true,
            complete: function (risultati) {
                console.log("[Pulizie] CSV caricato:", risultati.data.length, "righe");
                elaboraDatiPulizie(risultati.data);
            },
            error: function (errore) {
                console.error("[Pulizie] Errore nel caricamento del CSV:", errore, "- controlla che il file '" + FILE_PULIZIE + "' esista con questo nome esatto nel repository");
            }
        });
    }

    function elaboraDatiPulizie(righeGrezze) {
        if (!righeGrezze || righeGrezze.length < 2) return;

        // Il foglio Pulizie ha una riga di titolo ("Registro Pulizie Piscina...") prima
        // della vera intestazione delle colonne. Cerchiamo esplicitamente la riga che
        // inizia con "Data", invece di assumere sempre che sia la prima riga del foglio.
        let indiceHeader = righeGrezze.findIndex(r => r && r[0] && r[0].toString().trim().toLowerCase() === 'data');
        if (indiceHeader === -1) indiceHeader = 0;

        let intestazioniOriginali = righeGrezze[indiceHeader].map(h => h ? h.trim() : "");

        // Il foglio ha, nelle stesse righe dei dati, la legenda (Giornaliero/Settimanale/
        // Mensile) nelle colonne oltre "Firma". La escludiamo dalla tabella: viene mostrata
        // a parte, come blocco statico in fondo alla sezione (vedi index.html).
        const colonneValide = ["Data", "Ora", "Area Pulita", "Intervento", "Prodotto Usato", "Incaricato", "Firma"];
        let intestazioni = intestazioniOriginali.filter(h => colonneValide.includes(h));

        let datiFormattati = [];

        for (let i = indiceHeader + 1; i < righeGrezze.length; i++) {
            let rigaCorrente = righeGrezze[i];
            if (rigaCorrente.length === 0 || (rigaCorrente[0] === "" && rigaCorrente[1] === "")) continue;

            let oggettoRiga = {};
            intestazioniOriginali.forEach((intestazione, indice) => {
                if (!intestazioni.includes(intestazione)) return;
                oggettoRiga[intestazione] = rigaCorrente[indice] ? rigaCorrente[indice].trim() : "";
            });
            datiFormattati.push(oggettoRiga);
        }

        creaTabellaPulizie(intestazioni, datiFormattati);
        creaLegendaPulizie();
    }

    function creaTabellaPulizie(intestazioni, dati) {
        const tabella = document.getElementById("pulizieTable");
        if (!tabella) return;

        let html = "<thead><tr>";
        intestazioni.forEach(h => { html += `<th>${h}</th>`; });
        html += "</tr></thead><tbody>";

        dati.forEach(riga => {
            html += "<tr>";
            intestazioni.forEach(h => { html += `<td>${riga[h] || ""}</td>`; });
            html += "</tr>";
        });

        html += "</tbody>";
        tabella.innerHTML = html;
    }

    function creaLegendaPulizie() {
        const contenitore = document.getElementById("legendaPulizieContenuto");
        if (!contenitore || contenitore.dataset.generata === "1") return;

        contenitore.innerHTML = `
            <div class="legenda-colonna">
                <h4><span class="legenda-iniziale">G</span>iornaliero</h4>
                <ul><li>Bordo</li><li>Linea battente</li><li>Doccia</li><li>Solarium</li><li>Sdraio</li><li>Cestini</li><li>Pulizia</li></ul>
            </div>
            <div class="legenda-colonna">
                <h4><span class="legenda-iniziale">S</span>ettimanale</h4>
                <ul><li>Ombrelloni</li><li>Bacheca</li><li>Locale tecnico</li></ul>
            </div>
            <div class="legenda-colonna">
                <h4><span class="legenda-iniziale">M</span>ensile</h4>
                <ul><li>Pompa filtro</li><li>Pulizia</li></ul>
            </div>
        `;
        contenitore.dataset.generata = "1";
    }

    window.mostraLegendaPulizie = function () {
        const legenda = document.getElementById("legendaPulizie");
        if (!legenda) return;
        legenda.classList.remove("hidden");
        legenda.scrollIntoView({ behavior: "smooth", block: "start" });
    };
})();