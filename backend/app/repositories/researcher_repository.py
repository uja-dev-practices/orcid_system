from sqlalchemy.orm import Session
from app.db.models import Researcher
from sqlalchemy.sql import func


class ResearcherRepository:

    @staticmethod
    def get_by_orcid(db: Session, orcid_id: str):
        return db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()

    @staticmethod
    def create(db: Session, orcid_id: str, name: str = None):
        researcher = Researcher(orcid_id=orcid_id, name=name)
        db.add(researcher)
        db.commit()
        db.refresh(researcher)
        return researcher

    @staticmethod
    def update_last_sync(db: Session, researcher: Researcher):
        researcher.last_sync_at = func.now()
        db.commit()
        db.refresh(researcher)
        return researcher
