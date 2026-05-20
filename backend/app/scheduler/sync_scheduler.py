import requests
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.db.repositories.researcher_repository import ResearcherRepository
from dotenv import load_dotenv
import os
import logging

from app.core.config import settings


# Cargar variables del .env
load_dotenv()

# ---------------------------------------------------------
# Variables de entorno
# ---------------------------------------------------------

API_KEY = os.getenv("API_KEY_VALUE")
BASE_URL = os.getenv("BASE_URL")
logger = logging.getLogger("app.scheduler.sync")

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
    if not settings.SYNC_SCHEDULER_ENABLED:
        logger.info("Autosync scheduler disabled by SYNC_SCHEDULER_ENABLED=false")
        return

    scheduler = BackgroundScheduler()

    if settings.SYNC_SCHEDULE_MODE == "interval_minutes":
        scheduler.add_job(
            run_monthly_sync,
            "interval",
            minutes=settings.SYNC_INTERVAL_MINUTES,
            id="researchers-autosync",
            replace_existing=True,
        )
        logger.info(
            "Autosync scheduler started in interval mode: every %s minute(s)",
            settings.SYNC_INTERVAL_MINUTES,
        )
    else:
        scheduler.add_job(
            run_monthly_sync,
            "cron",
            day=settings.SYNC_CRON_DAY,
            hour=settings.SYNC_CRON_HOUR,
            id="researchers-autosync",
            replace_existing=True,
        )
        logger.info(
            "Autosync scheduler started in monthly mode: day=%s hour=%s",
            settings.SYNC_CRON_DAY,
            settings.SYNC_CRON_HOUR,
        )

    scheduler.start()
