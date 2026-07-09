import os
import time
import subprocess
import csv

HOME_DIR = os.path.expanduser("~")
LOCAL_REGISTRI_DIR = os.path.join(HOME_DIR, "Desktop", "Lavoro 2026", "Le Anfore", "Registri Libre Office", "Registri 2026")
DRIVE_REGISTRI_DIR = os.path.join(HOME_DIR, "Documents", "GitHub", "registrileanfore")
LIBREOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"
GIT_EXE = os.path.join(HOME_DIR, "AppData", "Local", "GitHubDesktop", "app-3.6.2", "resources", "app", "git", "cmd", "git.exe")

FILE_TARGET = "REGISTRO MANUTENZIONE INTERVENTI .ods"

def pulisci_e_filtra_manutenzioni(percorso_csv):
    if not os.path.exists(percorso_csv):
        return
    righe_pulite = []
    with open(percorso_csv, mode='r', encoding='utf-8', errors='ignore') as f:
        lettore = csv.reader(f)
        for riga in lettore:
            if not riga or all(cella.strip() == "" for cella in riga):
                continue
            righe_pulite.append(riga)
            
    with open(percorso_csv, mode='w', encoding='utf-8', newline='') as f:
        scrittore = csv.writer(f)
        scrittore.writerows(righe_pulite)
    print(f"[OK] CSV Manutenzioni ripulito.")

def converti_e_invia():
    print(f"\n[RILEVATO] Modifica su Registro Manutenzioni.")
    time.sleep(2)
    
    percorso_ods = os.path.join(LOCAL_REGISTRI_DIR, FILE_TARGET)
    cmd_libreoffice = [
        LIBREOFFICE_PATH, "--headless",
        "--convert-to", "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,true",
        "--outdir", DRIVE_REGISTRI_DIR, percorso_ods
    ]
    try:
        subprocess.run(cmd_libreoffice, check=True)
        csv_creato = os.path.join(DRIVE_REGISTRI_DIR, "REGISTRO MANUTENZIONE INTERVENTI .csv")
        puli_e_filtra_manutenzioni(csv_creato)
        
        os.chdir(DRIVE_REGISTRI_DIR)
        subprocess.run([GIT_EXE, "add", "."], check=True)
        subprocess.run([GIT_EXE, "commit", "-m", "Aggiornamento indipendente Manutenzioni"], check=True)
        subprocess.run([GIT_EXE, "push"], check=True)
        print("[SUCCESSO] GitHub Aggiornato.")
    except Exception as e:
        print(f"[ERRORE]: {e}")

if __name__ == "__main__":
    print("====================================================")
    print("      MONITOR MANUTENZIONI ISOLATO - ATTIVO         ")
    print("====================================================")
    percorso_completo = os.path.join(LOCAL_REGISTRI_DIR, FILE_TARGET)
    
    stato_precedente = os.path.getmtime(percorso_completo) if os.path.exists(percorso_completo) else 0
    
    while True:
        try:
            time.sleep(2)
            if os.path.exists(percorso_completo):
                orario_corrente = os.path.getmtime(percorso_completo)
                if orario_corrente > stato_precedente:
                    stato_precedente = orario_corrente
                    converti_e_invia()
        except KeyboardInterrupt:
            break
        except Exception:
            time.sleep(2)