/* ==========================================================================
   1. IMPOSTAZIONI GLOBALI E STRUTTURA
   ========================================================================== */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: #f4f7f6;
    color: #333333;
    padding: 20px;
    line-height: 1.5;
}

header {
    text-align: center;
    margin-bottom: 25px;
    background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
    color: #ffffff;
    padding: 30px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

header h1 {
    font-size: 2.2rem;
    margin-bottom: 8px;
    font-weight: 700;
}

header p {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* ==========================================================================
   2. BOTTONI DI NAVIGAZIONE
   ========================================================================== */
.top-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 25px;
    flex-wrap: wrap;
}

.top-buttons button {
    padding: 12px 24px;
    font-size: 1rem;
    font-weight: 600;
    color: #333333;
    background-color: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04);
}

.top-buttons button:hover {
    background-color: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
    transform: translateY(-1px);
}

/* ==========================================================================
   3. SEZIONI E TABELLE
   ========================================================================== */
.register-section {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    margin-bottom: 30px;
}

.register-section h2 {
    color: #1e293b;
    margin-bottom: 15px;
    font-size: 1.6rem;
    border-bottom: 2px solid #f1f5f9;
    padding-bottom: 8px;
}

.table-wrapper {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
}

table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.9rem;
}

th, td {
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap; 
}

th {
    background-color: #f8fafc;
    color: #475569;
    font-weight: 600;
}

tr:hover td {
    background-color: #f8fafc;
}

.table-th-btn {
    background: none;
    border: none;
    color: #0066cc;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
}

.table-th-btn:hover {
    background-color: #e0f2fe;
    text-decoration: underline;
}

/* ==========================================================================
   4. MODALE OVERLAY
   ========================================================================== */
.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.overlay-content {
    background-color: #ffffff;
    padding: 30px;
    border-radius: 8px;
    width: 85%;
    max-width: 900px;
    height: 75vh;
    position: relative;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
}

.overlay-close {
    position: absolute;
    top: 15px;
    right: 20px;
    font-size: 24px;
    cursor: pointer;
    color: #888888;
    transition: color 0.15s;
}

.overlay-close:hover {
    color: #333333;
}

.overlay-content h3 {
    margin-bottom: 20px;
    color: #333333;
    font-size: 1.4rem;
    padding-right: 30px;
}

.overlay-content canvas {
    flex-grow: 1;
    width: 100% !important;
    height: calc(100% - 60px) !important;
}

/* Classi di utilità */
.hidden {
    display: none !important;
}