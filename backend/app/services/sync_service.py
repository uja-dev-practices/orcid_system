from sqlalchemy.orm import Session
import httpx

from app.services.orcid_client import ORCIDClient
from app.services.normalizer import PublicationNormalizer

from app.db.repositories.researcher_repository import ResearcherRepository
from app.db.repositories.publication_repository import PublicationRepository
from app.db.repositories.syncjob_repository import SyncJobRepository


class SyncService:

    def __init__(self):
        self.orcid_client = ORCIDClient()

    def sync_researcher(self, db: Session, orcid_id: str):
        """
        Sincroniza las publicaciones de un investigador con manejo robusto de errores.
        """
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
                    "code": 404,
                    "message": f"El ORCID {orcid_id} no existe en ORCID."
                }
            return {
                "status": "error",
                "code": e.response.status_code,
                "message": f"Error al consultar ORCID: {str(e)}"
            }
        except Exception as e:
            return {
                "status": "error",
                "code": 500,
                "message": f"Error interno durante la sincronización: {str(e)}"
            }

        job = SyncJobRepository.start_job(db, researcher.id)

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
            return {
                "status": "error",
                "code": e.response.status_code,
                "message": f"Error al obtener works de ORCID: {str(e)}"
            }
        except Exception as e:
            return {
                "status": "error",
                "code": 500,
                "message": f"Error interno al obtener works: {str(e)}"
            }

        groups = works_raw.get("group", [])

        new_records = 0
        updated_records = 0

        for group in groups:
            summary = group["work-summary"][0]
            normalized = PublicationNormalizer.normalize_work(summary)

            existing = PublicationRepository.get_by_put_code(
                db, researcher.id, normalized["put_code"]
            )

            if existing:
                PublicationRepository.update(db, existing, normalized)
                updated_records += 1
            else:
                PublicationRepository.create(db, researcher.id, normalized)
                new_records += 1

        SyncJobRepository.finish_job(db, job, new_records, updated_records)
        ResearcherRepository.update_last_sync(db, researcher)

        return {
            "status": "ok",
            "message": "Sincronización completada correctamente.",
            "researcher_id": researcher.id,
            "new_records": new_records,
            "updated_records": updated_records,
            "total": new_records + updated_records
        }

    def sync_and_get_full(self, db: Session, orcid_id: str):
        """
        Sincroniza (si es necesario) y devuelve investigador + publicaciones.
        Pensado para el buscador: una sola petición.
        """
        sync_result = self.sync_researcher(db, orcid_id)

        if sync_result.get("status") == "error":
            return sync_result

        researcher = ResearcherRepository.get_by_orcid(db, orcid_id)
        if not researcher:
            return {
                "status": "error",
                "code": 500,
                "message": "Error interno: investigador no encontrado tras sincronización."
            }

        publications = PublicationRepository.list_by_researcher(db, researcher.id)

        return {
            "status": "ok",
            "researcher": researcher,
            "publications": publications
        }
