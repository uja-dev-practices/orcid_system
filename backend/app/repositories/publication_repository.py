from sqlalchemy.orm import Session
from app.db.models import Publication


class PublicationRepository:

    @staticmethod
    def get_by_put_code(db: Session, researcher_id: str, put_code: int):
        """
        Devuelve una publicación existente por put_code (único en ORCID).
        """
        return (
            db.query(Publication)
            .filter(
                Publication.researcher_id == researcher_id,
                Publication.put_code == put_code
            )
            .first()
        )

    @staticmethod
    def create(db: Session, researcher_id: str, data: dict):
        """
        Crea una nueva publicación normalizada.
        """
        pub = Publication(
            researcher_id=researcher_id,
            put_code=data["put_code"],
            title=data["title"],
            journal=data["journal"],
            doi=data["doi"],
            pub_year=data["pub_year"],
            type=data["type"],
            hash_fingerprint=data["hash_fingerprint"]
        )
        db.add(pub)
        db.commit()
        db.refresh(pub)
        return pub

    @staticmethod
    def update(db: Session, publication: Publication, data: dict):
        """
        Actualiza una publicación existente si ORCID ha cambiado algo.
        """
        publication.title = data["title"]
        publication.journal = data["journal"]
        publication.doi = data["doi"]
        publication.pub_year = data["pub_year"]
        publication.type = data["type"]
        publication.hash_fingerprint = data["hash_fingerprint"]

        db.commit()
        db.refresh(publication)
        return publication

    @staticmethod
    def list_by_researcher(db: Session, researcher_id: str):
        """
        Lista todas las publicaciones de un investigador.
        """
        return (
            db.query(Publication)
            .filter(Publication.researcher_id == researcher_id)
            .order_by(Publication.pub_year.desc().nullslast())
            .all()
        )
