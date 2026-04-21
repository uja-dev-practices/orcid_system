from sqlalchemy.orm import Session
from app.services.orcid_client import ORCIDClient
from app.services.normalizer import PublicationNormalizer
from app.repositories.researcher_repository import ResearcherRepository
from app.repositories.publication_repository import PublicationRepository
from app.repositories.syncjob_repository import SyncJobRepository
import httpx


class SyncService:

    def __init__(self):
        self.orcid_client = ORCIDClient()

    def sync_researcher(self, db: Session, orcid_id: str):
        """
        Sincroniza las publicaciones de un investigador con manejo robusto de errores.
        """

        # 1. Obtener o crear investigador
        try:
            researcher = ResearcherRepository.get_by_orcid(db, orcid_id)

            if not researcher:
                record = self.orcid_client.fetch_record(orcid_id)
                name = (
                    record.get("person", {})
                          .get("name", {})
                          .get("given-names", {})
                          .get("value")
                )
                researcher = ResearcherRepository.create(db, orcid_id, name)

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {
                    "status": "error",
                    "message": f"El ORCID {orcid_id} no existe en Sandbox."
                }
            return {"status": "error", "message": str(e)}

        # 2. Crear SyncJob
        job = SyncJobRepository.start_job(db, researcher.id)

        # 3. Obtener works
        try:
            works_raw = self.orcid_client.fetch_works(orcid_id)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                SyncJobRepository.finish_job(db, job, 0, 0)
                ResearcherRepository.update_last_sync(db, researcher)
                return {
                    "status": "ok",
                    "message": "El ORCID existe pero no tiene publicaciones públicas.",
                    "new_records": 0,
                    "updated_records": 0,
                    "total": 0
                }
            return {"status": "error", "message": str(e)}

        groups = works_raw.get("group", [])

        new_records = 0
        updated_records = 0

        # 4. Procesar works
        for group in groups:
            summary = group["work-summary"][0]
            normalized = PublicationNormalizer.normalize_work(summary)

            # 🔥 AHORA SE DETECTAN DUPLICADOS POR put_code
            existing = PublicationRepository.get_by_put_code(
                db, researcher.id, normalized["put_code"]
            )

            if existing:
                PublicationRepository.update(db, existing, normalized)
                updated_records += 1
            else:
                PublicationRepository.create(db, researcher.id, normalized)
                new_records += 1

        # 5. Finalizar SyncJob
        SyncJobRepository.finish_job(db, job, new_records, updated_records)

        # 6. Actualizar last_sync_at
        ResearcherRepository.update_last_sync(db, researcher)

        return {
            "status": "ok",
            "message": "Sincronización completada correctamente.",
            "researcher": researcher.orcid_id,
            "new_records": new_records,
            "updated_records": updated_records,
            "total": new_records + updated_records
        }
