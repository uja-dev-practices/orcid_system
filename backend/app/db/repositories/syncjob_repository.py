from sqlalchemy.orm import Session
from app.db.models import SyncJob
from sqlalchemy.sql import func

# ---------------------------------------------------------
# Repositorio de trabajos de sincronización
# ---------------------------------------------------------

class SyncJobRepository:

    # ---------------------------------------------------------
    # Función auxiliar: iniciar un nuevo trabajo de sincronización
    # ---------------------------------------------------------

    @staticmethod
    def start_job(db: Session, researcher_id: str):
        job = SyncJob(
            researcher_id=researcher_id,
            status="running",
            started_at=func.now()
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    # ---------------------------------------------------------
    # Función auxiliar: finalizar un trabajo de sincronización
    # ---------------------------------------------------------

    @staticmethod
    def finish_job(db: Session, job: SyncJob, new_records: int, updated_records: int):
        job.status = "finished"
        job.new_records = new_records
        job.updated_records = updated_records
        job.finished_at = func.now()
        db.commit()
        db.refresh(job)
        return job
