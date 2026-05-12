import requests
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.db.repositories.researcher_repository import ResearcherRepository
from dotenv import load_dotenv
import os


# Cargar variables del .env
load_dotenv()

# ---------------------------------------------------------
# Variables de entorno
# ---------------------------------------------------------

API_KEY = os.getenv("API_KEY_VALUE")
BASE_URL = os.getenv("BASE_URL")

# ---------------------------------------------------------
# Función auxiliar: ejecutar sincronización mensual
# ---------------------------------------------------------

def run_monthly_sync():
    db = SessionLocal()

    researchers = ResearcherRepository.get_all(db)

    for r in researchers:
        try:
            url = f"{BASE_URL}/researchers/{r.orcid_id}/sync"
            response = requests.post(
                url,
                headers={"X-API-Key": API_KEY}
            )

            if response.status_code != 200:
                print(f"[ERROR] Sync failed for {r.orcid_id}: {response.text}")
            else:
                print(f"[OK] Synced {r.orcid_id}")

        except Exception as e:
            print(f"[EXCEPTION] Error syncing {r.orcid_id}: {e}")

    db.close()

# ---------------------------------------------------------
# Función auxiliar: iniciar el scheduler
# ---------------------------------------------------------

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_monthly_sync, "cron", day=1, hour=3)  # día 1 a las 03:00
    scheduler.start()
